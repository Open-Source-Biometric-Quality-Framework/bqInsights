import { PCA } from 'ml-pca';
import { runHDBSCANOnMatrix } from './clustering';

export type PCAClusteringOptions = {
  minPts?: number;
  targetVariance?: number;
  minComponentVariance?: number;
  maxComponents?: number;
};

export type PCAClusteringResult = {
  labels: number[];
  embeddings: number[][];
  explainedVariance: number[];
  componentsUsed: number;
  varianceCaptured: number;
};

function selectComponentCount(
  explainedVariance: number[],
  targetVariance: number,
  minComponentVariance: number
) {
  let cumulative = 0;
  let k = 0;

  for (let i = 0; i < explainedVariance.length; i++) {
    cumulative += explainedVariance[i];
    k = i + 1;
    if (cumulative >= targetVariance) {
      break;
    }
  }

  while (
    k > 1 &&
    explainedVariance[k - 1] < minComponentVariance &&
    cumulative - explainedVariance[k - 1] >= targetVariance
  ) {
    cumulative -= explainedVariance[k - 1];
    k -= 1;
  }

  return { components: k, varianceCaptured: cumulative };
}

export function runPCAClustering(
  features: number[][],
  onProgress?: (message: string) => void,
  options?: PCAClusteringOptions
): PCAClusteringResult {
  if (!features.length) {
    return {
      labels: [],
      embeddings: [],
      explainedVariance: [],
      componentsUsed: 0,
      varianceCaptured: 0
    };
  }

  const targetVariance = options?.targetVariance ?? 0.75;
  const minComponentVariance = options?.minComponentVariance ?? 0.05;

  onProgress?.('🧮 Running PCA for clustering...');

  const pca = new PCA(features, { center: true, scale: true });
  const explainedVariance = pca.getExplainedVariance();

  const { components, varianceCaptured } = selectComponentCount(
    explainedVariance,
    targetVariance,
    minComponentVariance
  );

  const maxComponents = options?.maxComponents ?? 10;
  const usedComponents = Math.min(components, maxComponents);
  if (usedComponents < components) {
    onProgress?.(`🧪 PCA component cap: ${usedComponents}/${components}`);
  }

  onProgress?.(
    `📉 PCA components: ${usedComponents} (variance ${(varianceCaptured * 100).toFixed(1)}%)`
  );

  const embeddings = pca.predict(features, { nComponents: usedComponents }).to2DArray();

  // Standardize PCA embeddings to unit variance per component to stabilize clustering.
  const cols = usedComponents;
  const means = new Array(cols).fill(0);
  const variances = new Array(cols).fill(0);

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) {
      means[j] += embeddings[i][j];
    }
  }
  for (let j = 0; j < cols; j++) {
    means[j] /= embeddings.length;
  }
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) {
      const diff = embeddings[i][j] - means[j];
      variances[j] += diff * diff;
    }
  }
  const std = variances.map(v => Math.sqrt(v / Math.max(1, embeddings.length - 1)) || 1);

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < cols; j++) {
      embeddings[i][j] = (embeddings[i][j] - means[j]) / std[j];
    }
  }

  if (explainedVariance.length) {
    const top = explainedVariance
      .slice(0, Math.min(5, explainedVariance.length))
      .map(v => (v * 100).toFixed(1))
      .join('% , ');
    onProgress?.(`📊 PCA variance (top): ${top}%`);
  }

  const minPts = options?.minPts ?? 5;
  onProgress?.('🧩 Running HDBSCAN on PCA embeddings...');
  const result = runHDBSCANOnMatrix(embeddings, undefined, { minPts });
  const labels = result.labels;
  onProgress?.(
    `✅ PCA HDBSCAN result: clusters=${result.clusterCount}, noise=${result.noiseCount}`
  );

  return {
    labels,
    embeddings,
    explainedVariance,
    componentsUsed: components,
    varianceCaptured
  };
}
