// featureExtraction.ts - Feature extraction and normalization

export type FeatureExtractionResult = {
  features: number[][];
  featureCount: number;
  sampleCount: number;
  excluded: {
    nonNumeric: string[];
    nonScalar: string[];
    lowVariance: string[];
  };
};

type OneHotSpec = {
  key: string;
  categories: string[];
};

const DEFAULT_MAX_CATEGORICAL_DISTINCT = 20;
const DEFAULT_MAX_CATEGORICAL_RATIO = 0.1;

function normalizeCategoryValue(value: unknown): string {
  if (value === null || value === undefined) return "__missing__";
  const asString = String(value).trim();
  return asString === "" ? "__missing__" : asString;
}

function detectCategoricalSpecs(
  csvData: any[],
  keys: string[],
  maxDistinct = DEFAULT_MAX_CATEGORICAL_DISTINCT,
  maxDistinctRatio = DEFAULT_MAX_CATEGORICAL_RATIO
): OneHotSpec[] {
  if (!csvData.length || !keys.length) return [];
  const maxDistinctByRatio = Math.max(2, Math.floor(csvData.length * maxDistinctRatio));
  const cap = Math.min(maxDistinct, maxDistinctByRatio);
  const specs: OneHotSpec[] = [];

  for (const key of keys) {
    const distinct = new Set<string>();
    for (const row of csvData) {
      distinct.add(normalizeCategoryValue(row?.[key]));
      if (distinct.size > cap) break;
    }
    if (distinct.size >= 2 && distinct.size <= cap) {
      specs.push({ key, categories: Array.from(distinct) });
    }
  }

  return specs;
}

function buildOneHotFeatures(
  csvData: any[],
  specs: OneHotSpec[]
): { features: number[][]; featureLabels: string[] } {
  const featureLabels = specs.flatMap((spec) =>
    spec.categories.map((cat) => `${spec.key}__${cat}`)
  );

  const features = csvData.map((row) => {
    const rowFeatures: number[] = [];
    for (const spec of specs) {
      const value = normalizeCategoryValue(row?.[spec.key]);
      for (const cat of spec.categories) {
        rowFeatures.push(value === cat ? 1 : 0);
      }
    }
    return rowFeatures;
  });

  return { features, featureLabels };
}

export function extractNumericFeatures(
  csvData: any[],
  onProgress?: (message: string) => void,
  options?: { excludeLowVariance?: boolean; lowVarianceStd?: number; excludeNonScalar?: boolean }
): FeatureExtractionResult {
  if (!csvData || csvData.length === 0) {
    throw new Error('No CSV data available');
  }

  onProgress?.('🔍 Identifying numeric features...');

  const firstRow = csvData[0];
  const allKeys = Object.keys(firstRow);
  const nonNumericKeys: string[] = [];
  const numericKeys: string[] = [];
  const nonScalarKeys: string[] = [];

  for (const k of allKeys) {
    const v = firstRow[k];
    const isNumeric =
      typeof v === 'number' ||
      (typeof v === 'string' && v.trim() === 'NA') ||
      (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v));
    if (!isNumeric) {
      nonNumericKeys.push(k);
      continue;
    }
    const isScalar = k.includes('_scalar') || k.includes('Scalar');
    if (options?.excludeNonScalar && !isScalar) {
      nonScalarKeys.push(k);
      continue;
    }
    numericKeys.push(k);
  }

  let raw: number[][] = [];
  let usedCategoricalKeys: string[] = [];

  if (numericKeys.length === 0) {
    onProgress?.('🔁 No numeric features found; attempting one-hot encoding for categorical columns...');
    const categoricalSpecs = detectCategoricalSpecs(csvData, nonNumericKeys);
    if (categoricalSpecs.length === 0) {
      throw new Error('No numeric features found');
    }
    usedCategoricalKeys = categoricalSpecs.map((spec) => spec.key);
    const oneHot = buildOneHotFeatures(csvData, categoricalSpecs);
    raw = oneHot.features;
    onProgress?.(`📊 One-hot encoded ${categoricalSpecs.length} categorical columns into ${oneHot.featureLabels.length} features`);
  } else {
    onProgress?.(`📊 Found ${numericKeys.length} numeric features`);
    raw = csvData
      .map(row => numericKeys.map(k => Number(row[k])))
      .filter(row => row.every(v => Number.isFinite(v)));
  }

  onProgress?.('📐 Normalizing features...');

  const dim = raw[0]?.length ?? 0;
  const mean = Array(dim).fill(0);
  const std = Array(dim).fill(0);

  // Calculate mean
  raw.forEach(r => r.forEach((v, j) => (mean[j] += v)));
  mean.forEach((_, j) => (mean[j] /= raw.length));

  // Calculate standard deviation
  raw.forEach(r =>
    r.forEach((v, j) => (std[j] += (v - mean[j]) ** 2))
  );
  std.forEach((_, j) => (std[j] = Math.sqrt(std[j] / raw.length)));

  const minStd = options?.excludeLowVariance ? (options?.lowVarianceStd ?? 1e-3) : 1e-12;

  // Keep only features with sufficient variance
  const lowVarianceKeys: string[] = [];
  const keepIdx = std
    .map((s, i) => {
      if (s > minStd) return i;
      lowVarianceKeys.push(numericKeys[i] ?? `feature_${i}`);
      return -1;
    })
    .filter(i => i >= 0);

  if (keepIdx.length === 0) {
    throw new Error('All numeric features have zero variance');
  }

  // Normalize features
  const features = raw.map(row =>
    keepIdx.map(i => (row[i] - mean[i]) / std[i])
  );

  onProgress?.(`✅ Using ${keepIdx.length} normalized features (min std ${minStd})`);
  const excluded = {
    nonNumeric: nonNumericKeys.filter((key) => !usedCategoricalKeys.includes(key)),
    nonScalar: nonScalarKeys,
    lowVariance: lowVarianceKeys
  };
  console.log('Feature exclusions:', excluded);

  return {
    features,
    featureCount: keepIdx.length,
    sampleCount: features.length,
    excluded
  };
}
