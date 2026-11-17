import { ipcMain } from "electron";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  downloadOrBuildLatestImage,
  isDockerImageDownloaded,
  runDockerCommand
} from "./docker-util.js";

type ClusterAlgorithm = "dbscan" | "hdbscan";

export type DockerUmapRequest = {
  inputCsvPath: string;
  outputCsvPath?: string;
  clusterAlgorithm?: ClusterAlgorithm;
  umapNNeighbors?: number;
  umapMinDist?: number;
  dbscanEps?: number;
  dbscanMinSamples?: number;
  maxDbscanPoints?: number;
  kmeansClusters?: number;
  hdbscanMinClusterSize?: number;
  hdbscanMinSamples?: number;
  pcaComponents?: number;
  numericColumns?: string[];
};

export type DockerUmapResponse = {
  success: boolean;
  outputCsvPath: string;
  exitCode: number;
};

const IMAGE_TAG = "openbq-python-umap:v5";

function logStage(message: string) {
  console.log(`[docker-umap] ${message}`);
}

async function ensureDockerImage(electronDir: string): Promise<void> {
  logStage(`Checking Docker image ${IMAGE_TAG}`);
  const downloaded = await isDockerImageDownloaded(IMAGE_TAG, "docker-umap");
  if (downloaded) {
    logStage(`Image ${IMAGE_TAG} already available`);
    return;
  }

  const dockerDir = path.join(electronDir, "docker", "umap-cluster");
  logStage(`Building Docker image ${IMAGE_TAG} from ${dockerDir}`);
  const buildRes = await downloadOrBuildLatestImage({
    imageTag: IMAGE_TAG,
    buildContextDir: dockerDir,
    pullLatest: false,
    logPrefix: "docker-umap"
  });
  if (buildRes.result.exitCode !== 0) {
    throw new Error(`Docker image build failed with exit code ${buildRes.result.exitCode}`);
  }
}

function outputPathFor(inputCsvPath: string, outputCsvPath?: string): string {
  if (outputCsvPath && outputCsvPath.trim()) {
    return path.resolve(outputCsvPath);
  }
  const absInput = path.resolve(inputCsvPath);
  const dir = path.dirname(absInput);
  const ext = path.extname(absInput);
  const base = path.basename(absInput, ext);
  return path.join(dir, `${base}.umap_clustered.csv`);
}

export async function runDockerUmapPipeline(
  req: DockerUmapRequest
): Promise<DockerUmapResponse> {
  const inputCsvPath = path.resolve(req.inputCsvPath);
  const outputCsvPath = outputPathFor(inputCsvPath, req.outputCsvPath);
  const clusterAlgorithm: ClusterAlgorithm = req.clusterAlgorithm ?? "dbscan";
  const electronDir = path.resolve(process.cwd(), "electron");

  await access(inputCsvPath);

  logStage("Preparing Docker UMAP pipeline");
  logStage(`Input CSV: ${inputCsvPath}`);
  logStage(`Output CSV: ${outputCsvPath}`);
  logStage(`Cluster algorithm: ${clusterAlgorithm}`);

  await ensureDockerImage(electronDir);

  const inputDir = path.dirname(inputCsvPath);
  const outputDir = path.dirname(outputCsvPath);
  const inputName = path.basename(inputCsvPath);
  const outputName = path.basename(outputCsvPath);

  const pythonArgs = [
    "/app/umap_cluster.py",
    "--input",
    `/input/${inputName}`,
    "--output",
    `/output/${outputName}`,
    "--cluster-algo",
    clusterAlgorithm,
    "--umap-n-neighbors",
    String(req.umapNNeighbors && req.umapNNeighbors > 0 ? req.umapNNeighbors : 15),
    "--umap-min-dist",
    String(req.umapMinDist ?? 0.3),
    "--dbscan-eps",
    String(req.dbscanEps ?? 0.6),
    "--dbscan-min-samples",
    String(req.dbscanMinSamples ?? 10),
    "--max-dbscan-points",
    String(req.maxDbscanPoints ?? 120000),
    "--kmeans-clusters",
    String(req.kmeansClusters ?? 0),
    "--hdbscan-min-cluster-size",
    String(req.hdbscanMinClusterSize ?? 20),
    "--hdbscan-min-samples",
    String(req.hdbscanMinSamples ?? req.hdbscanMinClusterSize ?? 20),
    "--pca-components",
    String(req.pcaComponents ?? 0)
  ];

  if (req.numericColumns?.length) {
    pythonArgs.push("--numeric-columns", req.numericColumns.join(","));
  }

  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${inputDir}:/input:ro`,
    "-v",
    `${outputDir}:/output`,
    IMAGE_TAG,
    "python",
    ...pythonArgs
  ];

  logStage("Starting Docker container");
  let runRes = await runDockerCommand(dockerArgs, { logPrefix: "docker-umap" });

  if (
    runRes.exitCode !== 0 &&
    runRes.stderr.includes("unrecognized arguments: --hdbscan-min-samples")
  ) {
    logStage(
      "Container script does not support --hdbscan-min-samples; retrying with compatibility args"
    );
    const compatArgs = dockerArgs.filter((arg, idx, arr) => {
      if (arg !== "--hdbscan-min-samples") return true;
      // drop flag and value
      arr[idx + 1] = "__DROP__";
      return false;
    }).filter((arg) => arg !== "__DROP__");
    runRes = await runDockerCommand(compatArgs, { logPrefix: "docker-umap" });
  }

  if (runRes.exitCode !== 0) {
    throw new Error(`Docker UMAP pipeline failed with exit code ${runRes.exitCode}`);
  }

  logStage("Docker UMAP pipeline completed");
  return {
    success: true,
    outputCsvPath,
    exitCode: runRes.exitCode
  };
}

export function registerDockerUmapHandlers() {
  ipcMain.handle(
    "docker-umap:run",
    async (_event, req: DockerUmapRequest): Promise<DockerUmapResponse> =>
      runDockerUmapPipeline(req)
  );
}
