// types.ts - Shared type definitions

export type Point2D = { x: number; y: number };

export type AnalysisData = {
  success: boolean;
  error?: string;
  csvData?: any[];
};

export type ClusteringResult = {
  labels: number[];
  clusterCount: number;
  noiseCount: number;
  eps: number;
  minPts: number;
};

export type UMAPResult = {
  x: Float32Array;
  y: Float32Array;
  categories: Uint8Array;
  points: Point2D[];
};

export type ProcessingProgress = {
  stage: 'loading' | 'features' | 'umap' | 'clustering' | 'complete';
  message: string;
  progress?: number;
};

export type CachedAnalysis = {
  timestamp: number;
  analysis: any;
};