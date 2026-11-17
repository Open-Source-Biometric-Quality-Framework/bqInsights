import { ipcMain } from "electron";
import { PCA } from "ml-pca";
import Supercluster from "supercluster";
import clustering from "density-clustering";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
// als-statistics has a broken CJS bundle in this version; use exported ESM analyze path.
// @ts-expect-error no published types for this subpath
import Analyze from "als-statistics/analyze/index.js";
import { runDockerUmapPipeline } from "./docker-umap-cluster.js";

type ClusterMethod = "umap" | "pca" | "supercluster";

type Point2D = { x: number; y: number };

type ClusterParams = {
  dbscanMinPts?: number;
  hdbscanMinSamples?: number;
  useDbscan?: boolean;
  dbscanEpsKNN?: number;
  pcaMinPts?: number;
  pcaMaxComponents?: number;
  superclusterMinPoints?: number;
  superclusterRadius?: number;
  superclusterMinZoom?: number;
  superclusterMaxZoom?: number;
};

type ClusterRunRequest = {
  method: ClusterMethod;
  points?: Point2D[];
  features?: number[][];
  params?: ClusterParams;
};

type ClusterRunResponse = {
  labels: number[];
  clusterCount: number;
  noiseCount: number;
};

const HdbscanCtor = (Analyze as any)?.Clustering?.Hdbscan;
const MAX_HDBSCAN_POINTS = 10000;

function estimateEpsKNNForData(data: number[][], k: number, percentile: number): number {
  const distances: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const dists = data
      .map((p, j) => {
        if (i === j) return Infinity;
        let sum = 0;
        for (let d = 0; d < p.length; d++) {
          const diff = data[i][d] - p[d];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      })
      .sort((a, b) => a - b);

    distances.push(dists[Math.max(0, k - 1)]);
  }

  distances.sort((a, b) => a - b);
  const pct = Math.min(1, Math.max(0, percentile));
  return distances[Math.floor(distances.length * pct)];
}

function runLegacyDBSCANOnMatrix(
  data: number[][],
  minPts: number,
  epsKNN: number
): ClusterRunResponse {
  const eps = estimateEpsKNNForData(data, minPts, epsKNN);
  console.log(
    `[cluster] Using local JS DBSCAN on ${data.length} points ` +
      `(minPts=${minPts}, epsKNN=${epsKNN}, eps=${eps})`
  );
  const dbscan = new clustering.DBSCAN();
  const clusters = dbscan.run(data, eps, minPts);
  const noise = dbscan.noise;
  const labels = Array(data.length).fill(-1);
  clusters.forEach((cluster, clusterId) => {
    cluster.forEach((index) => {
      labels[index] = clusterId;
    });
  });
  const clusterCount = clusters.length;
  const noiseCount = noise.length;

  return {
    labels,
    clusterCount,
    noiseCount
  };
}

async function writePointsCsv(filePath: string, data: number[][]): Promise<void> {
  const out = createWriteStream(filePath, { encoding: "utf8" });
  out.write("x,y\n");
  for (const row of data) {
    const x = Number.isFinite(row[0]) ? row[0] : 0;
    const y = Number.isFinite(row[1]) ? row[1] : 0;
    if (!out.write(`${x},${y}\n`)) {
      await once(out, "drain");
    }
  }
  out.end();
  await once(out, "finish");
}

async function readClusterLabels(outputCsvPath: string): Promise<number[]> {
  const labels: number[] = [];
  const stream = createReadStream(outputCsvPath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let clusterIndex = -1;
  let isHeader = true;
  for await (const line of rl) {
    if (!line) continue;
    const cells = line.split(",");
    if (isHeader) {
      isHeader = false;
      clusterIndex = cells.indexOf("cluster");
      continue;
    }
    if (clusterIndex < 0 || clusterIndex >= cells.length) {
      throw new Error("Docker output CSV missing cluster column");
    }
    const label = Number(cells[clusterIndex]);
    labels.push(Number.isFinite(label) ? label : -1);
  }
  return labels;
}

async function runDockerDBSCANOnMatrix(
  data: number[][],
  minPts: number,
  epsKNN: number,
  report: (message: string) => void
): Promise<ClusterRunResponse> {
  if (!data.length) {
    return { labels: [], clusterCount: 0, noiseCount: 0 };
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "openbq-cluster-"));
  const inputCsvPath = path.join(workDir, "input.csv");
  const outputCsvPath = path.join(workDir, "output.csv");

  try {
    report("🐳 Large dataset detected; running Docker Python DBSCAN...");
    await writePointsCsv(inputCsvPath, data);
    const result = await runDockerUmapPipeline({
      inputCsvPath,
      outputCsvPath,
      clusterAlgorithm: "dbscan",
      dbscanEps: Math.min(1, Math.max(0, epsKNN)),
      dbscanMinSamples: Math.max(1, minPts),
      numericColumns: ["x", "y"]
    });

    const labels = await readClusterLabels(result.outputCsvPath);
    if (labels.length !== data.length) {
      throw new Error(
        `Docker output row count mismatch: got ${labels.length}, expected ${data.length}`
      );
    }

    const clusterCount = Math.max(0, ...labels.map((label) => (label >= 0 ? label + 1 : 0)));
    const noiseCount = labels.filter((label) => label < 0).length;
    return { labels, clusterCount, noiseCount };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function runHDBSCANOnMatrix(
  data: number[][],
  minPts: number,
  minSamples: number,
  epsKNN: number,
  report: (message: string) => void
): Promise<ClusterRunResponse> {
  if (!data.length) {
    return { labels: [], clusterCount: 0, noiseCount: 0 };
  }

  if (!HdbscanCtor) {
    console.log("[cluster] HDBSCAN constructor unavailable, using DBSCAN fallback");
    report("⚠️ HDBSCAN unavailable, falling back to DBSCAN");
    return runLegacyDBSCANOnMatrix(data, minPts, epsKNN);
  }

  if (data.length > MAX_HDBSCAN_POINTS) {
    console.log(
      `[cluster] Dataset has ${data.length} points (> ${MAX_HDBSCAN_POINTS}); using Docker DBSCAN`
    );
    report(
      `⚠️ Dataset too large for HDBSCAN (${data.length} points), using Docker DBSCAN`
    );
    try {
      return await runDockerDBSCANOnMatrix(data, minPts, epsKNN, report);
    } catch (err) {
      console.warn("[cluster] Docker DBSCAN failed, using local DBSCAN fallback", err);
      report("⚠️ Docker DBSCAN failed, falling back to local DBSCAN");
      return runLegacyDBSCANOnMatrix(data, minPts, epsKNN);
    }
  }

  try {
    console.log(
      `[cluster] Using HDBSCAN on ${data.length} points ` +
        `(minPts=${minPts}, minSamples=${minSamples})`
    );
    const samples = Object.fromEntries(
      data.map((vector, index) => [String(index), vector])
    );
    const hdbscan = new HdbscanCtor(samples, {
      minClusterSize: minPts,
      minSamples,
      metric: "mad"
    });
    const labels: number[] = Array.isArray(hdbscan.labels)
      ? hdbscan.labels.map((label: unknown) => (typeof label === "number" ? label : -1))
      : Array(data.length).fill(-1);
    // als-statistics uses 1..N cluster IDs and -1 for noise.
    const normalizedLabels: number[] = labels.map((label: number) => (label > 0 ? label - 1 : -1));
    const clusterCount = Math.max(
      0,
      ...normalizedLabels.map((label: number) => (label >= 0 ? label + 1 : 0))
    );
    const noiseCount = normalizedLabels.filter((label: number) => label < 0).length;
    return {
      labels: normalizedLabels,
      clusterCount,
      noiseCount
    };
  } catch (err) {
    console.warn("[cluster] Backend HDBSCAN failed, using DBSCAN fallback", err);
    report("⚠️ HDBSCAN failed, falling back to DBSCAN");
    return runLegacyDBSCANOnMatrix(data, minPts, epsKNN);
  }
}

async function runPreferredDensityClustering(
  data: number[][],
  minPts: number,
  minSamples: number,
  epsKNN: number,
  useDbscan: boolean,
  report: (message: string) => void
): Promise<ClusterRunResponse> {
  if (useDbscan) {
    report("🔎 DBSCAN selected; using local JS DBSCAN");
    return runLegacyDBSCANOnMatrix(data, minPts, epsKNN);
  }

  return runHDBSCANOnMatrix(data, minPts, minSamples, epsKNN, report);
}

function runSupercluster(points: Point2D[], params: ClusterParams): ClusterRunResponse {
  if (!points.length) {
    return { labels: [], clusterCount: 0, noiseCount: 0 };
  }

  const minZoom = params.superclusterMinZoom ?? 0;
  const maxZoom = params.superclusterMaxZoom ?? 16;
  const radius = params.superclusterRadius ?? 40;
  const minPoints = params.superclusterMinPoints ?? 2;
  const extent = 512;
  console.log(
    `[cluster] Using Supercluster on ${points.length} points ` +
      `(minPoints=${minPoints}, radius=${radius}, zoom=${minZoom}-${maxZoom})`
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === maxX) {
    minX -= 1e-6;
    maxX += 1e-6;
  }
  if (minY === maxY) {
    minY -= 1e-6;
    maxY += 1e-6;
  }

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeMax = Math.max(rangeX, rangeY);
  const effectiveRadius = Math.max(1, (radius / Math.max(rangeMax, 1e-6)) * extent);

  const features = points.map((p, i) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [(p.x - minX) / rangeX, (p.y - minY) / rangeY] as [number, number]
    },
    properties: { index: i }
  }));

  const index = new Supercluster({
    minZoom,
    maxZoom,
    radius: effectiveRadius,
    extent,
    minPoints
  });
  index.load(features as any);

  const labels = Array(points.length).fill(-1);
  const clusters = index.getClusters([0, 0, 1, 1], maxZoom) as any[];
  let clusterCount = 0;

  for (const feature of clusters) {
    const props = feature?.properties ?? {};
    if (!props.cluster) continue;
    const clusterId = props.cluster_id;
    const leaves = index.getLeaves(clusterId, points.length, 0) as any[];
    const label = clusterCount++;
    for (const leaf of leaves) {
      const i = leaf?.properties?.index;
      if (typeof i === "number") {
        labels[i] = label;
      }
    }
  }

  const noiseCount = labels.filter((v) => v < 0).length;
  return { labels, clusterCount, noiseCount };
}

async function runPCAHdbscan(
  features: number[][],
  params: ClusterParams,
  report: (message: string) => void
): Promise<ClusterRunResponse> {
  if (!features.length) {
    return { labels: [], clusterCount: 0, noiseCount: 0 };
  }

  console.log(
    `[cluster] Using PCA + HDBSCAN on ${features.length} rows ` +
      `(pcaMinPts=${params.pcaMinPts ?? params.dbscanMinPts ?? 5}, maxComponents=${params.pcaMaxComponents ?? 10})`
  );

  report("🧮 Running PCA for backend clustering...");
  const pca = new PCA(features, { center: true, scale: true });
  const explained = pca.getExplainedVariance();
  let cumulative = 0;
  let k = 0;
  for (let i = 0; i < explained.length; i++) {
    cumulative += explained[i];
    k = i + 1;
    if (cumulative >= 0.75) break;
  }
  const components = Math.max(2, Math.min(k || 2, params.pcaMaxComponents ?? 10));
  const embeddings = pca.predict(features, { nComponents: components }).to2DArray();

  const cols = components;
  const means = new Array(cols).fill(0);
  const vars = new Array(cols).fill(0);
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) means[j] += embeddings[i][j];
  }
  for (let j = 0; j < cols; j++) means[j] /= embeddings.length;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) {
      const d = embeddings[i][j] - means[j];
      vars[j] += d * d;
    }
  }
  const std = vars.map((v) => Math.sqrt(v / Math.max(1, embeddings.length - 1)) || 1);
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) {
      embeddings[i][j] = (embeddings[i][j] - means[j]) / std[j];
    }
  }

  return runPreferredDensityClustering(
    embeddings,
    Math.max(2, params.pcaMinPts ?? params.dbscanMinPts ?? 5),
    Math.max(1, params.hdbscanMinSamples ?? params.pcaMinPts ?? params.dbscanMinPts ?? 5),
    params.dbscanEpsKNN ?? 0.8,
    Boolean(params.useDbscan),
    report
  );
}

export function registerClusteringHandlers() {
  ipcMain.handle("cluster:run", async (event, req: ClusterRunRequest) => {
    const params = req.params ?? {};
    const report = (message: string) => {
      event.sender.send("cluster:progress", message);
    };

    const method = req.method ?? "umap";
    console.log(`[cluster] cluster:run requested with method=${method}`);
    report(`🔎 Backend clustering (${method})...`);

    if (method === "supercluster") {
      const points = req.points ?? [];
      const result = runSupercluster(points, params);
      report(`✅ Backend supercluster complete (${result.clusterCount} clusters)`);
      return result;
    }

    if (method === "pca") {
      const features = req.features ?? [];
      const result = await runPCAHdbscan(features, params, report);
      report(`✅ Backend PCA clustering complete (${result.clusterCount} clusters)`);
      return result;
    }

    const points = req.points ?? [];
    const data = points.map((p) => [p.x, p.y]);
    const result = await runPreferredDensityClustering(
      data,
      Math.max(2, params.dbscanMinPts ?? 5),
      Math.max(1, params.hdbscanMinSamples ?? params.dbscanMinPts ?? 5),
      params.dbscanEpsKNN ?? 0.8,
      Boolean(params.useDbscan),
      report
    );
    report(`✅ Backend clustering complete (${result.clusterCount} clusters)`);
    return result;
  });
}
