// analysisService.ts
// Main analysis orchestration with robust UMAP caching

import type {
  AnalysisData,
  UMAPResult,
  ProcessingProgress
} from "../utils/types";

import type { AnalysisParams } from "../types";

import {
  loadFromLocalStorage,
  saveToLocalStorage,
  makeLocalStorageKey,
  loadLastCacheKey,
  saveLastCacheKey
} from "./cacheService";

import { extractNumericFeatures } from "../processing/featureExtraction";
import UMAPWorkerClient from "../processing/UMAPWorkerClient";



/* ------------------------------------------------------------------ */
/* Analysis Service                                                   */
/* ------------------------------------------------------------------ */

export class AnalysisService {
  private umapClient: UMAPWorkerClient;
  private progressCallback?: (progress: ProcessingProgress) => void;
  private static readonly LARGE_DATASET_BACKEND_THRESHOLD = 10000;
  private static readonly DOCKER_HDBSCAN_MAX_ROWS = 60000;

  private pickDockerClusterAlgorithm(rowCount: number, params: AnalysisParams): "dbscan" | "hdbscan" {
    if (params.useDbscan) return "dbscan";
    return rowCount <= AnalysisService.DOCKER_HDBSCAN_MAX_ROWS ? "hdbscan" : "dbscan";
  }

  constructor() {
    this.umapClient = new UMAPWorkerClient();
  }

  /* ---------------- Progress Reporting ---------------- */

  setProgressCallback(
    callback: (progress: ProcessingProgress) => void
  ): void {
    this.progressCallback = callback;
  }

  private reportProgress(
    stage: ProcessingProgress["stage"],
    message: string,
    progress?: number
  ): void {
    this.progressCallback?.({
      stage,
      message,
      progress
    });
  }

  private stableStringify(value: unknown): string {
    const seen = new WeakSet();
    const normalize = (input: any): any => {
      if (input === null || typeof input !== "object") return input;
      if (seen.has(input)) return "[Circular]";
      seen.add(input);
      if (Array.isArray(input)) {
        return input.map(normalize);
      }
      const keys = Object.keys(input).sort();
      const out: Record<string, any> = {};
      for (const key of keys) {
        out[key] = normalize(input[key]);
      }
      return out;
    };
    return JSON.stringify(normalize(value));
  }

  private toNumberArray(value: any): number[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.map((v) => (Number.isFinite(v) ? Number(v) : 0));
    if (ArrayBuffer.isView(value)) return Array.from(value as any, (v) => (Number.isFinite(v) ? Number(v) : 0));
    if (typeof value === "object" && Number.isFinite((value as any).length)) {
      const len = Number((value as any).length);
      const arr = new Array(len);
      for (let i = 0; i < len; i++) {
        const v = (value as any)[i];
        arr[i] = Number.isFinite(v) ? Number(v) : 0;
      }
      return arr;
    }
    return [];
  }

  private normalizeUmapForCache(input: any): any {
    if (!input || typeof input !== "object") return input;
    return {
      ...input,
      x: this.toNumberArray(input.x),
      y: this.toNumberArray(input.y),
      categories: this.toNumberArray(input.categories ?? input.category)
    };
  }

  private isClusteredCacheKey(key: string | null | undefined): boolean {
    return typeof key === "string" && key.includes("_cluster1_");
  }

  private shouldSaveAsLastCache(params: AnalysisParams, umapCacheKey: string | null | undefined): boolean {
    return params.runClustering || this.isClusteredCacheKey(umapCacheKey);
  }

  private rehydrateUmapResult(input: any): UMAPResult | null {
    if (!input || typeof input !== "object") return null;
    const source =
      input.umapResult && typeof input.umapResult === "object"
        ? input.umapResult
        : input;

    const xArr = this.toNumberArray(source.x);
    const yArr = this.toNumberArray(source.y);
    const catArr = this.toNumberArray(source.categories ?? source.category);

    if (!xArr.length || !yArr.length) return null;

    const x = new Float32Array(xArr);
    const y = new Float32Array(yArr);
    let categories = new Uint8Array(catArr);
    if (categories.length !== x.length) {
      categories = new Uint8Array(x.length);
    }

    const points = Array.from(x, (vx, i) => ({
      x: vx,
      y: y[i]
    }));

    return {
      ...source,
      x,
      y,
      categories,
      points
    } as UMAPResult;
  }

  private collectCsvPaths(value: unknown, out: Set<string>): void {
    if (typeof value === "string") {
      if (value.toLowerCase().endsWith(".csv")) {
        out.add(value);
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) this.collectCsvPaths(item, out);
      return;
    }
    for (const v of Object.values(value as Record<string, unknown>)) {
      this.collectCsvPaths(v, out);
    }
  }

  private getAnalysisCsvCandidates(analysis: any): string[] {
    const candidates = new Set<string>();
    this.collectCsvPaths(analysis?.outputFiles, candidates);
    return Array.from(candidates);
  }

  private findColumnKey(row: Record<string, unknown>, candidates: string[]): string | null {
    const keyMap = new Map<string, string>();
    for (const key of Object.keys(row)) {
      keyMap.set(key.trim().toLowerCase(), key);
    }
    for (const candidate of candidates) {
      const match = keyMap.get(candidate.trim().toLowerCase());
      if (match) return match;
    }
    return null;
  }

  public getEmbeddedUmapFromCsvData(rows: any[]): UMAPResult | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const firstRow = rows.find((row) => row && typeof row === "object");
    if (!firstRow) return null;

    const xKey = this.findColumnKey(firstRow as Record<string, unknown>, ["umap_x"]);
    const yKey = this.findColumnKey(firstRow as Record<string, unknown>, ["umap_y"]);
    if (!xKey || !yKey) return null;

    const categoryKey = this.findColumnKey(firstRow as Record<string, unknown>, [
      "category",
      "categories",
      "cluster",
      "cluster_id",
      "clusterid"
    ]);

    const x = new Float32Array(rows.length);
    const y = new Float32Array(rows.length);
    const categories = new Uint8Array(rows.length);
    const points = new Array(rows.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? {};
      const rawX = Number((row as any)[xKey]);
      const rawY = Number((row as any)[yKey]);
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return null;
      }

      x[i] = rawX;
      y[i] = rawY;
      points[i] = { x: rawX, y: rawY };

      if (categoryKey) {
        const label = Number((row as any)[categoryKey]);
        categories[i] = Number.isFinite(label)
          ? label < 0
            ? 255
            : Math.max(0, Math.min(254, Math.round(label)))
          : 0;
      } else {
        categories[i] = 0;
      }
    }

    return { x, y, categories, points };
  }

  private labelsToCategories(size: number, labels: number[]): Uint8Array {
    const categories = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      const label = labels[i] ?? -1;
      categories[i] = label < 0 ? 255 : Math.max(0, Math.min(254, Math.round(label)));
    }
    return categories;
  }

  public async clusterEmbeddedUmap(
    umapResult: UMAPResult,
    features: number[][],
    params: AnalysisParams
  ): Promise<UMAPResult> {
    if (!params.runClustering) {
      return umapResult;
    }

    const points = Array.isArray(umapResult.points)
      ? umapResult.points
      : Array.from(umapResult.x, (vx, i) => ({ x: vx, y: umapResult.y[i] }));

    const canUseBackendClustering =
      Boolean(window.electron?.cluster?.run) && params.clusterMethod !== "jsdbscan";

    if (canUseBackendClustering) {
      this.reportProgress("clustering", "🔎 Running clustering in Electron backend...");

      let stopProgress: (() => void) | undefined;
      try {
        stopProgress = window.electron?.cluster?.onProgress?.((message: string) => {
          this.reportProgress("clustering", message);
        });

        const backendMethod = params.clusterMethod === "pca" || params.clusterMethod === "supercluster"
          ? params.clusterMethod
          : "umap";

        const backendResult = await window.electron.cluster.run({
          method: backendMethod,
          points,
          features,
          params: {
            dbscanMinPts: params.dbscanMinPts,
            hdbscanMinSamples: params.hdbscanMinSamples,
            useDbscan: params.useDbscan,
            dbscanEpsKNN: params.dbscanEpsKNN,
            pcaMinPts: params.pcaMinPts,
            pcaMaxComponents: params.pcaMaxComponents,
            superclusterMinPoints: params.superclusterMinPoints,
            superclusterRadius: params.superclusterRadius,
            superclusterMinZoom: params.superclusterMinZoom,
            superclusterMaxZoom: params.superclusterMaxZoom
          }
        });

        umapResult.categories = this.labelsToCategories(points.length, backendResult?.labels ?? []);
        return umapResult;
      } finally {
        stopProgress?.();
      }
    }

    this.reportProgress("clustering", "🔎 Running clustering in renderer...");

    let labels: number[] = [];
    if (params.clusterMethod === "pca") {
      const { runPCAClustering } = await import("../processing/pca_clustering");
      labels = runPCAClustering(
        features,
        (message: string) => this.reportProgress("clustering", message),
        {
          minPts: params.pcaMinPts ?? params.dbscanMinPts,
          maxComponents: params.pcaMaxComponents
        }
      ).labels;
    } else if (params.clusterMethod === "supercluster") {
      const { runSupercluster } = await import("../processing/supercluster_clustering");
      labels = runSupercluster(
        points,
        (message: string) => this.reportProgress("clustering", message),
        {
          minPoints: params.superclusterMinPoints ?? params.dbscanMinPts,
          radius: params.superclusterRadius,
          minZoom: params.superclusterMinZoom,
          maxZoom: params.superclusterMaxZoom
        }
      ).labels;
    } else {
      const { runDBSCAN, runHDBSCAN } = await import("../processing/clustering");
      const result = params.useDbscan || params.clusterMethod === "jsdbscan"
        ? runDBSCAN(
            points,
            (message: string) => this.reportProgress("clustering", message),
            {
              minPts: params.dbscanMinPts,
              minSamples: params.hdbscanMinSamples,
              epsKNN: params.dbscanEpsKNN
            }
          )
        : runHDBSCAN(
            points,
            (message: string) => this.reportProgress("clustering", message),
            {
              minPts: params.dbscanMinPts,
              minSamples: params.hdbscanMinSamples,
              epsKNN: params.dbscanEpsKNN
            }
          );
      labels = result.labels;
    }

    umapResult.categories = this.labelsToCategories(points.length, labels);
    return umapResult;
  }

  private async runLargeDatasetBackendUmapFromFeatures(
    features: number[][],
    params: AnalysisParams
  ): Promise<UMAPResult> {
    const electronApi = window.electron as any;
    const dockerApi = electronApi?.dockerUmap;
    const csvApi = electronApi?.csv;
    const fsApi = electronApi?.fs;
    const getPath = electronApi?.getPath;

    if (
      !dockerApi?.run ||
      !csvApi?.toJson ||
      !fsApi?.writeFileAbsolute ||
      !getPath
    ) {
      throw new Error("Required Electron APIs unavailable for backend Docker UMAP");
    }

    const dim = features[0]?.length ?? 0;
    if (dim <= 0) {
      throw new Error("Feature matrix has no columns");
    }

    const tempDir = await getPath("temp");
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inputCsvPath = `${tempDir}/openbq_umap_features_${nonce}.csv`;
    const outputCsvPath = `${tempDir}/openbq_umap_features_${nonce}.out.csv`;
    const numericColumns = Array.from({ length: dim }, (_, i) => `f${i}`);

    try {
      const lines: string[] = [numericColumns.join(",")];
      for (let i = 0; i < features.length; i++) {
        const row = features[i] ?? [];
        const values = new Array(dim);
        for (let j = 0; j < dim; j++) {
          const value = Number(row[j]);
          values[j] = Number.isFinite(value) ? String(value) : "0";
        }
        lines.push(values.join(","));
      }

      const writeRes = await fsApi.writeFileAbsolute(inputCsvPath, `${lines.join("\n")}\n`);
      if (!writeRes?.success) {
        throw new Error(`Failed to write backend Docker input CSV: ${inputCsvPath}`);
      }

      this.reportProgress("umap", `🐳 Backend Docker UMAP from feature matrix (${features.length} rows)...`);
      const clusterAlgorithm = this.pickDockerClusterAlgorithm(features.length, params);
      this.reportProgress(
        "clustering",
        `🧩 Backend cluster algorithm: ${clusterAlgorithm.toUpperCase()}`
      );
        const dockerRes = await dockerApi.run({
          inputCsvPath,
          outputCsvPath,
          clusterAlgorithm,
          umapNNeighbors: params.umapNNeighbors,
          umapMinDist: params.umapMinDist,
          dbscanEps: params.dbscanEpsKNN,
          dbscanMinSamples: params.dbscanMinPts,
          maxDbscanPoints: 120000,
          kmeansClusters: 0,
          hdbscanMinClusterSize: params.dbscanMinPts,
          hdbscanMinSamples: params.hdbscanMinSamples,
          pcaComponents: dim > 12 ? 12 : 0,
          numericColumns
        });

      const parsed = await csvApi.toJson(dockerRes.outputCsvPath);
      const rows: any[] = Array.isArray(parsed?.content) ? parsed.content : [];
      if (!rows.length) {
        throw new Error("Docker output CSV is empty");
      }
      if (rows.length !== features.length) {
        throw new Error(
          `Docker output row count mismatch: got ${rows.length}, expected ${features.length}`
        );
      }

      const x = new Float32Array(rows.length);
      const y = new Float32Array(rows.length);
      const categories = new Uint8Array(rows.length);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] ?? {};
        const ux = Number(row.umap_x);
        const uy = Number(row.umap_y);
        const label = Number(row.cluster);
        if (!Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(label)) {
          throw new Error(`Invalid Docker output row at index ${i}`);
        }
        x[i] = ux;
        y[i] = uy;
        categories[i] = label < 0 ? 255 : Math.max(0, Math.min(254, label));
      }

      const points = Array.from(x, (vx, i) => ({ x: vx, y: y[i] }));
      return { x, y, categories, points };
    } finally {
      if (fsApi?.deleteFileAbsolute) {
        await fsApi.deleteFileAbsolute(inputCsvPath).catch(() => undefined);
        await fsApi.deleteFileAbsolute(outputCsvPath).catch(() => undefined);
      }
    }
  }

  private async runLargeDatasetBackendUmap(
    analysis: any,
    params: AnalysisParams
  ): Promise<UMAPResult> {
    const csvCandidates = this.getAnalysisCsvCandidates(analysis);
    if (!csvCandidates.length) {
      throw new Error("No CSV output path found in OpenBQ analysis outputFiles");
    }

    const dockerApi = (window.electron as any)?.dockerUmap;
    const csvApi = (window.electron as any)?.csv;
    if (!dockerApi?.run || !csvApi?.toJson) {
      throw new Error("dockerUmap/csv IPC APIs unavailable in renderer");
    }

    let lastErr: unknown = null;
    for (const inputCsvPath of csvCandidates) {
      try {
        this.reportProgress("umap", `🐳 Backend Docker UMAP on ${inputCsvPath}...`);
        const estimatedRows = Array.isArray(analysis?.csvData) ? analysis.csvData.length : 0;
        const clusterAlgorithm = this.pickDockerClusterAlgorithm(estimatedRows, params);
        this.reportProgress(
          "clustering",
          `🧩 Backend cluster algorithm: ${clusterAlgorithm.toUpperCase()}`
        );
        const dockerRes = await dockerApi.run({
          inputCsvPath,
          clusterAlgorithm,
          umapNNeighbors: params.umapNNeighbors,
          umapMinDist: params.umapMinDist,
          dbscanEps: params.dbscanEpsKNN,
          dbscanMinSamples: params.dbscanMinPts,
          maxDbscanPoints: 120000,
          kmeansClusters: 0,
          hdbscanMinClusterSize: params.dbscanMinPts,
          hdbscanMinSamples: params.hdbscanMinSamples,
          pcaComponents: 12
        });

        const parsed = await csvApi.toJson(dockerRes.outputCsvPath);
        const rows: any[] = Array.isArray(parsed?.content) ? parsed.content : [];
        if (!rows.length) {
          throw new Error("Docker output CSV is empty");
        }

        const x = new Float32Array(rows.length);
        const y = new Float32Array(rows.length);
        const categories = new Uint8Array(rows.length);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] ?? {};
          const ux = Number(row.umap_x);
          const uy = Number(row.umap_y);
          const label = Number(row.cluster);
          if (!Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(label)) {
            throw new Error(`Invalid Docker output row at index ${i}`);
          }

          x[i] = ux;
          y[i] = uy;
          categories[i] = label < 0 ? 255 : Math.max(0, Math.min(254, label));
        }

        const points = Array.from(x, (vx, i) => ({ x: vx, y: y[i] }));
        return { x, y, categories, points };
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr instanceof Error
      ? lastErr
      : new Error("Docker UMAP backend failed for all CSV candidates");
  }

  /* ------------------------------------------------------------------ */
  /* Main Analysis Pipeline                                             */
  /* ------------------------------------------------------------------ */

  async runAnalysis(
    directory: string,
    params: AnalysisParams
  ): Promise<{
    analysis: AnalysisData;
    umapResult: UMAPResult | null;
    umapCacheKey?: string | null;
    analysisCacheKey?: string | null;
  }> {
    /* ---------------- Profile Mapping ---------------- */

    const profile = params.qualityMetric;
    const modality = params.biometricModality;
    const strict = false;
    const paramsKey = this.stableStringify(params);
    const baseCacheKey = makeLocalStorageKey(modality, directory, profile, strict);
    const cacheKey = `${baseCacheKey}:${paramsKey}`;

    const resolveCachedEntry = async (
      entryKey: string,
      entry: any
    ): Promise<{
      analysis: AnalysisData;
      umapResult: UMAPResult;
      umapCacheKey: string | null;
      analysisCacheKey: string;
    } | null> => {
      if (!entry?.analysis || !entry?.umapResult) return null;
      const cachedUmap = this.rehydrateUmapResult(entry.umapResult);
      if (!cachedUmap) return null;

      let resolvedUmap = cachedUmap;
      let umapCacheKey = entry.umapCacheKey ?? null;

      if (entry.analysis?.csvData?.length) {
        try {
          const { features } = extractNumericFeatures(
            entry.analysis.csvData,
            () => undefined,
            {
              excludeLowVariance: params.excludeLowVariance,
              excludeNonScalar: params.excludeNonScalar
            }
          );
          if (features?.length) {
            if (!params.runClustering) {
              const clustered = await window.electron.umap.getCachedResult(features, {
                ...params,
                runClustering: true
              });
              if (clustered?.key) {
                umapCacheKey = clustered.key;
              }
              if (clustered?.cached) {
                const clusteredUmap = this.rehydrateUmapResult(
                  (clustered.cached as any)?.umapResult ?? clustered.cached
                );
                if (clusteredUmap) {
                  resolvedUmap = clusteredUmap;
                }
              }
            }
            if (!umapCacheKey) {
              const { key } = await window.electron.umap.getCachedResult(features, params);
              umapCacheKey = key;
            }
            await saveToLocalStorage(entryKey, {
              ...entry,
              umapCacheKey
            });
          }
        } catch (err) {
          console.warn("Failed to derive UMAP cache key from cached analysis", err);
        }
      }

      return {
        analysis: entry.analysis,
        umapResult: resolvedUmap,
        umapCacheKey,
        analysisCacheKey: entryKey
      };
    };

    if (!params.runClustering) {
      const lastKey = await loadLastCacheKey(baseCacheKey);
      if (lastKey && lastKey !== cacheKey) {
        const lastCached = await loadFromLocalStorage(lastKey);
        const resolvedLast = await resolveCachedEntry(lastKey, lastCached);
        if (resolvedLast) {
          this.reportProgress("loading", "⚡ Loaded last cached analysis");
          this.reportProgress("complete", "✅ Analysis complete (cached)");
          return resolvedLast;
        }
      }
    }

    const cached = await loadFromLocalStorage(cacheKey);
    const resolvedCached = await resolveCachedEntry(cacheKey, cached);
    if (resolvedCached) {
      this.reportProgress("loading", "⚡ Loaded analysis from cache");
      this.reportProgress("complete", "✅ Analysis complete (cached)");
      return resolvedCached;
    }

    /* ---------------- Stage 1 — OpenBQ ---------------- */

    this.reportProgress(
      "loading",
      `🚀 Running OpenBQ analysis (${profile} on ${modality})...`
    );

    const analysis = await window.electron.openbq.analyze(
      modality,
      directory,
      directory,
      profile,
      strict
    );

    if (!analysis.success) {
      throw new Error(analysis.error);
    }

    this.reportProgress(
      "loading",
      "✅ Analysis completed"
    );

    /* ---------------- Stage 2 — Feature Extraction ---------------- */

    if (!analysis.csvData?.length) {
      this.reportProgress(
        "complete",
        "⚠️ No CSV data available for UMAP"
      );

      return {
        analysis,
        umapResult: null
      };
    }

    const embeddedUmap = this.getEmbeddedUmapFromCsvData(analysis.csvData);
    if (embeddedUmap && !params.runClustering) {
      this.reportProgress(
        "umap",
        "⚡ Found umap_x/umap_y columns in CSV, skipping UMAP computation"
      );
      this.reportProgress("complete", "✅ Analysis complete (embedded UMAP)");
      const umapCacheKey = null;
      await saveToLocalStorage(cacheKey, {
        analysis,
        umapResult: this.normalizeUmapForCache(embeddedUmap),
        umapCacheKey
      });
      if (this.shouldSaveAsLastCache(params, umapCacheKey)) {
        await saveLastCacheKey(baseCacheKey, cacheKey);
      }
      return {
        analysis,
        umapResult: embeddedUmap,
        umapCacheKey,
        analysisCacheKey: cacheKey
      };
    }

    const backendDbscanMode = params.clusterMethod === "umap" && params.useDbscan;
    const canUseBackendDocker =
      Boolean((window.electron as any)?.dockerUmap?.run) &&
      Boolean((window.electron as any)?.csv?.toJson);
    if (
      canUseBackendDocker &&
      params.runClustering &&
      !backendDbscanMode &&
      analysis.csvData.length > AnalysisService.LARGE_DATASET_BACKEND_THRESHOLD
    ) {
      try {
        const largeAlgo = this.pickDockerClusterAlgorithm(analysis.csvData.length, params).toUpperCase();
        this.reportProgress(
          "umap",
          `🐳 Large dataset (${analysis.csvData.length} rows): using Electron backend Docker UMAP+${largeAlgo}...`
        );

        const umapResult = await this.runLargeDatasetBackendUmap(analysis, params);
        const umapCacheKey = null;

        this.reportProgress("complete", "✅ Analysis complete (backend Docker)");
        await saveToLocalStorage(cacheKey, {
          analysis,
          umapResult: this.normalizeUmapForCache(umapResult),
          umapCacheKey
        });
        if (this.shouldSaveAsLastCache(params, umapCacheKey)) {
          await saveLastCacheKey(baseCacheKey, cacheKey);
        }

        return {
          analysis,
          umapResult,
          umapCacheKey,
          analysisCacheKey: cacheKey
        };
      } catch (err) {
        console.warn(
          "Large dataset backend Docker path failed",
          err
        );
        throw err instanceof Error
          ? err
          : new Error("Backend Docker path failed for large dataset");
      }
    }

    this.reportProgress(
      "features",
      "🔍 Extracting numeric features..."
    );

    const { features, excluded } = extractNumericFeatures(
      analysis.csvData,
      (msg) =>
        this.reportProgress("features", msg),
      {
        excludeLowVariance: params.excludeLowVariance,
        excludeNonScalar: params.excludeNonScalar
      }
    );
    if (
      excluded.nonNumeric.length === 0 &&
      excluded.nonScalar.length === 0 &&
      excluded.lowVariance.length === 0
    ) {
      console.log("Feature exclusions (analysisService): none");
    } else {
      console.log("Feature exclusions (analysisService):", excluded);
    }
    const formatList = (items: string[]) =>
      items.length > 10 ? `${items.slice(0, 10).join(", ")} … (+${items.length - 10} more)` : items.join(", ") || "none";
    this.reportProgress(
      "features",
      `🧹 Feature exclusions — nonNumeric: ${formatList(excluded.nonNumeric)}, nonScalar: ${formatList(excluded.nonScalar)}, lowVariance: ${formatList(excluded.lowVariance)}`
    );

    if (!features?.length) {
      this.reportProgress(
        "complete",
        "⚠️ Feature extraction returned no data"
      );

      return {
        analysis,
        umapResult: null
      };
    }

    if (embeddedUmap) {
      this.reportProgress(
        "umap",
        "⚡ Found umap_x/umap_y columns in CSV, skipping UMAP embedding and running clustering"
      );
      const umapResult = await this.clusterEmbeddedUmap(embeddedUmap, features, params);
      const umapCacheKey = null;
      this.reportProgress("complete", "✅ Analysis complete (embedded UMAP)");
      await saveToLocalStorage(cacheKey, {
        analysis,
        umapResult: this.normalizeUmapForCache(umapResult),
        umapCacheKey
      });
      if (this.shouldSaveAsLastCache(params, umapCacheKey)) {
        await saveLastCacheKey(baseCacheKey, cacheKey);
      }
      return {
        analysis,
        umapResult,
        umapCacheKey,
        analysisCacheKey: cacheKey
      };
    }

    /* ---------------- Stage 3 — UMAP ---------------- */

    const { umapResult, cacheKey: umapCacheKey } =
      await this.umapProcess(features, params);

    console.log("Final UMAP result", umapResult);

    this.reportProgress(
      "complete",
      "✅ Analysis complete"
    );

    await saveToLocalStorage(cacheKey, {
      analysis,
      umapResult: this.normalizeUmapForCache(umapResult),
      umapCacheKey
    });
    if (this.shouldSaveAsLastCache(params, umapCacheKey)) {
      await saveLastCacheKey(baseCacheKey, cacheKey);
    }

    return {
      analysis,
      umapResult,
      umapCacheKey,
      analysisCacheKey: cacheKey
    };
  }

  /* ------------------------------------------------------------------ */
  /* UMAP Processing + Caching                                          */
  /* ------------------------------------------------------------------ */

  async umapProcess(
    features: number[][],
    params: AnalysisParams
  ): Promise<{
    umapResult: UMAPResult | null;
    cacheKey?: string | null;
  }> {
    if (!features?.length) {
      this.reportProgress(
        "complete",
        "⚠️ No features provided to UMAP"
      );

      return { umapResult: null, cacheKey: null };
    }
    console.log("parameters for umapProcess", { featuresLength: features.length, params });

    let cacheKey: string | null = null;
    try {
      if (!params.runClustering) {
        const fallbackParams = { ...params, runClustering: true };
        const fallback = await window.electron.umap.getCachedResult(features, fallbackParams);
        if (fallback.cached) {
          this.reportProgress(
            "umap",
            "⚡ Loaded UMAP from cache (clustered)"
          );
          console.log("UMAP cache hit (clustered) - key", fallback.key);
          console.log("Cached UMAP result", fallback.cached);

          const cachedResult =
            (fallback.cached as any)?.umapResult ??
            fallback.cached;

          return {
            umapResult: cachedResult,
            cacheKey: fallback.key
          };
        }
      }

      const { key, cached } = await window.electron.umap.getCachedResult(features, params);
      cacheKey = key;

      if (cached) {
        this.reportProgress(
          "umap",
          "⚡ Loaded UMAP from cache"
        );
        console.log("UMAP cache hit - key", key);
        console.log("Cached UMAP result", cached);

        const cachedResult =
          (cached as any)?.umapResult ??
          cached;

        return {
          umapResult: cachedResult,
          cacheKey
        };
      }
      console.log("UMAP cache miss, computing new result - key", key);
    } catch (err) {
      console.warn("UMAP cache lookup failed", err);
    }

    const useFrontendJsDbscan = params.clusterMethod === "jsdbscan";
    const backendDbscanMode = params.clusterMethod === "umap" && params.useDbscan;

    const canUseBackendDockerLargePath =
      params.runClustering &&
      !useFrontendJsDbscan &&
      !backendDbscanMode &&
      features.length > AnalysisService.LARGE_DATASET_BACKEND_THRESHOLD &&
      Boolean((window.electron as any)?.dockerUmap?.run) &&
      Boolean((window.electron as any)?.csv?.toJson) &&
      Boolean((window.electron as any)?.fs?.writeFileAbsolute) &&
      Boolean((window.electron as any)?.getPath);

    if (canUseBackendDockerLargePath) {
      const largeAlgo = this.pickDockerClusterAlgorithm(features.length, params).toUpperCase();
      this.reportProgress(
        "umap",
        `🐳 Large dataset (${features.length} rows): forcing backend Docker UMAP+${largeAlgo}`
      );
      console.log(
        `[umap] Large dataset (${features.length}) -> forcing backend Docker UMAP+${largeAlgo}`
      );
      const umapResult = await this.runLargeDatasetBackendUmapFromFeatures(features, params);
      this.reportProgress("complete", "✅ UMAP processing complete (backend Docker)");
      return { umapResult, cacheKey };
    }

    /* ---------------- Compute UMAP ---------------- */

    const canUseBackendClustering =
      Boolean(window.electron?.cluster?.run) && params.runClustering && !useFrontendJsDbscan;

    this.reportProgress(
      "umap",
      canUseBackendClustering
        ? "🔄 Computing UMAP embedding (backend clustering enabled)..."
        : !params.runClustering
          ? "🔄 Computing UMAP (clustering skipped)..."
          : params.clusterMethod === "jsdbscan"
            ? `🔄 Computing UMAP (frontend JS DBSCAN: minPts=${params.dbscanMinPts}, epsKNN=${params.dbscanEpsKNN})...`
          : params.useDbscan
            ? `🔄 Computing UMAP (DBSCAN: minPts=${params.dbscanMinPts}, epsKNN=${params.dbscanEpsKNN})...`
            : `🔄 Computing UMAP (HDBSCAN: minClusterSize=${params.dbscanMinPts}, minSamples=${params.hdbscanMinSamples})...`
    );

    const umapResult = await this.umapClient.compute(
      features,
      (msg) => this.reportProgress("umap", msg),
      {
        dbscanMinPts: params.dbscanMinPts,
        hdbscanMinSamples: params.hdbscanMinSamples,
        useDbscan: params.useDbscan,
        dbscanEpsKNN: params.dbscanEpsKNN,
        pcaMinPts: params.pcaMinPts,
        pcaMaxComponents: params.pcaMaxComponents,
        pcaSweepIterations: params.pcaSweepIterations,
        superclusterMinPoints: params.superclusterMinPoints,
        superclusterRadius: params.superclusterRadius,
        superclusterMinZoom: params.superclusterMinZoom,
        superclusterMaxZoom: params.superclusterMaxZoom,
        umapNNeighbors: params.umapNNeighbors,
        umapMinDist: params.umapMinDist,
        runClustering: canUseBackendClustering ? false : params.runClustering,
        clusterMethod: params.clusterMethod
      }
    );

    if (canUseBackendClustering && umapResult && Array.isArray((umapResult as any).points)) {
      this.reportProgress("clustering", "🔎 Running clustering in Electron backend...");

      let stopProgress: (() => void) | undefined;
      try {
        stopProgress = window.electron?.cluster?.onProgress?.((message: string) => {
          this.reportProgress("clustering", message);
        });

        const backendMethod = params.clusterMethod === "pca" || params.clusterMethod === "supercluster"
          ? params.clusterMethod
          : "umap";

        const backendResult = await window.electron.cluster.run({
          method: backendMethod,
          points: (umapResult as any).points,
          features,
          params: {
            dbscanMinPts: params.dbscanMinPts,
            hdbscanMinSamples: params.hdbscanMinSamples,
            useDbscan: params.useDbscan,
            dbscanEpsKNN: params.dbscanEpsKNN,
            pcaMinPts: params.pcaMinPts,
            pcaMaxComponents: params.pcaMaxComponents,
            superclusterMinPoints: params.superclusterMinPoints,
            superclusterRadius: params.superclusterRadius,
            superclusterMinZoom: params.superclusterMinZoom,
            superclusterMaxZoom: params.superclusterMaxZoom
          }
        });

        const labels: number[] = Array.isArray(backendResult?.labels)
          ? backendResult.labels
          : [];

        const categories = new Uint8Array((umapResult as any).x?.length ?? labels.length);
        for (let i = 0; i < categories.length; i++) {
          const label = labels[i] ?? -1;
          categories[i] = label < 0 ? 255 : label;
        }
        (umapResult as any).categories = categories;
      } finally {
        stopProgress?.();
      }
    }

    this.reportProgress(
      "complete",
      "✅ UMAP processing complete"
    );

    /* ---------------- Cache Save ---------------- */

    if (cacheKey) {
      try {
        await window.electron.umap.cacheResult(cacheKey, umapResult);
      } catch (err) {
        console.warn(
          "UMAP cache save failed",
          err
        );
      }
      console.log("UMAP result computed and cached with key", cacheKey);
    }

    return { umapResult: umapResult as any, cacheKey };
  }

  /* ------------------------------------------------------------------ */
  /* Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  destroy(): void {
    // Optional: terminate worker if implemented
    // this.umapClient.cancel();
  }

  cancel(): void {
    this.umapClient.destroy();
  }
}
