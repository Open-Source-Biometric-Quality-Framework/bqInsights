import Supercluster from 'supercluster';
import type { Point2D, ClusteringResult } from '../utils/types';

export type SuperclusterOptions = {
  minZoom?: number;
  maxZoom?: number;
  radius?: number;
  extent?: number;
  minPoints?: number;
};

type GeoFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { index: number; [key: string]: any };
};

export function runSupercluster(
  points: Point2D[],
  onProgress?: (message: string) => void,
  options?: SuperclusterOptions
): ClusteringResult {
  if (!points.length) {
    return {
      labels: [],
      clusterCount: 0,
      noiseCount: 0,
      eps: 0,
      minPts: options?.minPoints ?? 2
    };
  }

  const minZoom = options?.minZoom ?? 0;
  const maxZoom = options?.maxZoom ?? 16;
  const radius = options?.radius ?? 40;
  const extent = options?.extent ?? 512;
  const minPoints = options?.minPoints ?? 2;

  onProgress?.('🧩 Running Supercluster clustering...');

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

  const features: GeoFeature[] = points.map((p, i) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        (p.x - minX) / rangeX,
        (p.y - minY) / rangeY
      ]
    },
    properties: { index: i }
  }));

  const labels = Array(points.length).fill(255);

  const scaleRadius = (rawRadius: number) => {
    if (!Number.isFinite(rawRadius) || rawRadius <= 0) return 1;
    if (!Number.isFinite(rangeMax) || rangeMax <= 0) return rawRadius;
    const normalizedRadius = rawRadius / rangeMax;
    const scaled = normalizedRadius * extent;
    return Math.min(1_000_000, Math.max(1, scaled));
  };

  const runIndex = (radiusValue: number) => {
    const effectiveRadius = scaleRadius(radiusValue);
    onProgress?.(`🧮 Supercluster radius scaled: ${radiusValue} -> ${effectiveRadius.toFixed(2)}`);
    const index = new Supercluster({
      minZoom,
      maxZoom,
      radius: effectiveRadius,
      extent,
      minPoints
    });
    index.load(features as any);
    const clusters = index.getClusters([0, 0, 1, 1], maxZoom);
    return { index, clusters };
  };

  const assignClusters = (index: Supercluster<any, any>, clusters: any[]) => {
    let count = 0;
    labels.fill(255);

    for (const feature of clusters as any[]) {
      const props = feature.properties || {};
      const isCluster = !!props.cluster;
      if (!isCluster) continue;

      const clusterId = props.cluster_id;
      if (clusterId === undefined || clusterId === null) continue;

      const leaves = index.getLeaves(clusterId, points.length, 0) as any[];
      if (!leaves.length) continue;

      const label = count;
      count += 1;

      for (const leaf of leaves) {
        const leafIndex = leaf?.properties?.index;
        if (typeof leafIndex === 'number') {
          labels[leafIndex] = label;
        }
      }
    }

    return count;
  };

  const evaluate = (radiusValue: number) => {
    const { index, clusters } = runIndex(radiusValue);
    const count = assignClusters(index, clusters);
    const noiseCount = labels.reduce((acc, v) => (v === 255 ? acc + 1 : acc), 0);
    return { index, clusters, count, noiseCount, radiusValue };
  };

  let best = evaluate(radius);

  if (best.count <= 1) {
    onProgress?.('🧪 Supercluster retry with smaller radius');
    const candidates = [
      Math.max(5, Math.floor(radius / 2)),
      Math.max(5, Math.floor(radius / 4)),
      Math.max(5, Math.floor(radius / 8))
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    for (const candidate of candidates) {
      const attempt = evaluate(candidate);
      const betterClusterCount = attempt.count > best.count;
      const betterNoise = attempt.count === best.count && attempt.noiseCount < best.noiseCount;
      if (betterClusterCount || betterNoise) {
        best = attempt;
      }
      if (best.count >= 4 && best.count <= 12) {
        break;
      }
    }
  }

  // Re-assign with best result (labels already set by evaluate).
  const clusterCount = best.count;

  const noiseCount = labels.reduce((acc, v) => (v === 255 ? acc + 1 : acc), 0);

  onProgress?.(`✅ Supercluster clusters: ${clusterCount}, outliers: ${noiseCount}`);

  return {
    labels,
    clusterCount,
    noiseCount,
    eps: radius,
    minPts: minPoints
  };
}
