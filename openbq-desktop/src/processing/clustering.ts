// clustering.ts - HDBSCAN clustering implementation

import { Analyze } from 'als-statistics';
import clustering from 'density-clustering';
import type { Point2D, ClusteringResult } from '../utils/types';

const HdbscanCtor = (Analyze as any)?.Clustering?.Hdbscan;

// HDBSCAN can exhaust renderer memory on large datasets. Keep it as default,
// but fail safe to DBSCAN.
const MAX_HDBSCAN_POINTS = 2000;

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
  epsKNN: number,
  onProgress?: (message: string) => void
): ClusteringResult {
  const eps = estimateEpsKNNForData(data, minPts, epsKNN);
  const dbscan = new clustering.DBSCAN();
  const clusters = dbscan.run(data, eps, minPts);
  const noise = dbscan.noise;
  const labels = Array(data.length).fill(-1);

  clusters.forEach((cluster, clusterId) => {
    cluster.forEach((index) => {
      labels[index] = clusterId;
    });
  });

  onProgress?.(`⚠️ Fallback DBSCAN: clusters=${clusters.length}, noise=${noise.length}`);

  return {
    labels,
    clusterCount: clusters.length,
    noiseCount: noise.length,
    eps,
    minPts
  };
}

export function runHDBSCANOnMatrix(
  data: number[][],
  onProgress?: (message: string) => void,
  params?: { minPts?: number; minSamples?: number; epsKNN?: number }
): ClusteringResult {
  onProgress?.('🧩 Running HDBSCAN clustering...');

  if (!data.length) {
    return {
      labels: [],
      clusterCount: 0,
      noiseCount: 0,
      eps: 0,
      minPts: params?.minPts ?? 5
    };
  }

  const minPts = Math.max(2, params?.minPts ?? 5);
  const minSamples = Math.max(1, params?.minSamples ?? minPts);
  const epsKNN = params?.epsKNN ?? 0.8;
  onProgress?.(`📐 Using min cluster size=${minPts}, min samples=${minSamples}`);

  if (data.length > MAX_HDBSCAN_POINTS) {
    onProgress?.(
      `⚠️ HDBSCAN disabled for ${data.length} points (limit ${MAX_HDBSCAN_POINTS}); using DBSCAN fallback`
    );
    return runLegacyDBSCANOnMatrix(data, minPts, epsKNN, onProgress);
  }

  if (!HdbscanCtor) {
    throw new Error('Failed to load als-statistics HDBSCAN constructor');
  }

  let labels: number[];
  try {
    const samples = Object.fromEntries(
      data.map((vector, index) => [String(index), vector])
    );
    const hdbscan = new HdbscanCtor(samples, {
      minClusterSize: minPts,
      minSamples,
      metric: 'mad'
    });
    labels = Array.isArray(hdbscan.labels)
      ? hdbscan.labels.map((label: unknown) => (typeof label === 'number' ? label : -1))
      : Array(data.length).fill(-1);
  } catch (err) {
    console.warn('HDBSCAN failed, falling back to DBSCAN', err);
    return runLegacyDBSCANOnMatrix(data, minPts, epsKNN, onProgress);
  }

  const normalizedLabels = labels.map((label) => (label > 0 ? label - 1 : -1));

  const noiseCount = normalizedLabels.filter((label) => label < 0).length;
  const clusterCount = Math.max(
    0,
    ...normalizedLabels.map((label) => (label >= 0 ? label + 1 : 0))
  );

  onProgress?.(`✅ Found ${clusterCount} clusters, ${noiseCount} noise points`);

  console.log('HDBSCAN clusters:', clusterCount, 'noise:', noiseCount);
  console.log('Min cluster size:', minPts);

  return {
    labels: normalizedLabels,
    clusterCount,
    noiseCount,
    eps: 0,
    minPts
  };
}

export function runDBSCANOnMatrix(
  data: number[][],
  onProgress?: (message: string) => void,
  params?: { minPts?: number; minSamples?: number; epsKNN?: number }
): ClusteringResult {
  const minPts = Math.max(2, params?.minPts ?? 5);
  const epsKNN = params?.epsKNN ?? 0.8;
  return runLegacyDBSCANOnMatrix(data, minPts, epsKNN, onProgress);
}

export function runHDBSCAN(
  points: Point2D[],
  onProgress?: (message: string) => void,
  params?: { minPts?: number; minSamples?: number; epsKNN?: number }
): ClusteringResult {
  const data = points.map(p => [p.x, p.y]);
  return runHDBSCANOnMatrix(data, onProgress, params);
}

export function runDBSCAN(
  points: Point2D[],
  onProgress?: (message: string) => void,
  params?: { minPts?: number; minSamples?: number; epsKNN?: number }
): ClusteringResult {
  const data = points.map(p => [p.x, p.y]);
  return runDBSCANOnMatrix(data, onProgress, params);
}
