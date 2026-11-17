// ========================================
// Debug & Configuration Constants
// ========================================

import type { AnalysisParams } from './types';

export const DEBUG = false;

export const SETTINGS_KEY = 'docReviewSettings';

export const DEFAULT_ANALYSIS_PARAMS: AnalysisParams = {
  qualityMetric: 'obqe' as const,
  biometricModality: 'face' as const,
  dbscanMinPts: 5,
  hdbscanMinSamples: 5,
  useDbscan: false,
  dbscanEpsKNN: 0.8,
  pcaMinPts: 5,
  pcaMaxComponents: 10,
  pcaSweepIterations: 5,
  superclusterMinPoints: 2,
  superclusterRadius: 40,
  superclusterMinZoom: 0,
  superclusterMaxZoom: 16,
  umapNNeighbors: 0,
  umapMinDist: 0.3,
  excludeLowVariance: false,
  excludeNonScalar: false,
  runClustering: false,
  clusterMethod: 'jsdbscan'
};

export const DEFAULT_REPORT_TYPE = 'review';

export const FILE_LIST_LIMIT = 100;

export const IMAGE_MAX_WIDTH = 150;

// ========================================
// UI Constants
// ========================================

export const SIDEBAR_MIN_SIZE = 250;
export const SIDEBAR_MAX_SIZE = 250;

export const DETAIL_PANE_PREFERRED_SIZE = 330;
export const DETAIL_PANE_MAX_SIZE = 330;

export const STATUS_BAR_MIN_SIZE = 30;
export const STATUS_BAR_PREFERRED_SIZE = 30;
