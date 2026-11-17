
/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

export interface WeeklyScoreRow {
  week: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface DeviceRejection {
  name: string;
  value: number;
  color?: string; // Optional — auto-assigned from palette if omitted
}

export interface CriticalEvent {
  x: number;       // event index
  y: number;       // auth score
  label?: string;  // Optional display label
  device?: string; // Optional device name
  risk: "CRIT" | "HIGH" | "MED";
}

export interface OutlierRow {
  id: string;
  datetime: string;
  customerId: string;
  authScore: number;
  qualityScore: number;
  device: string;
  action: "REVIEW" | "MONITOR";
}

export interface ScorecardMetric {
  label: string;
  value: string;
  sub?: string;   // Optional sub-label
  color?: string; // Optional hex (with or without #); auto-assigned if omitted
}

/* ─────────────────────────────────────────────────────────────────────────────
   HISTOGRAM TYPES
───────────────────────────────────────────────────────────────────────────── */

export interface HistogramBin {
  binStart: number;   // lower bound of bin
  binEnd: number;     // upper bound of bin
  count: number;      // samples in bin
}

export interface MatchDistribution {
  match: HistogramBin[];
  nonMatch: HistogramBin[];
}

export interface HistogramThresholds {
  rejectionThreshold: number;
  investigationThreshold: number;
}

export interface ReportConfig {
  systemName: string;
  algorithmName: string;
  primaryRejectionThreshold?: number; // Default: 0.35
  investigationThreshold?: number;    // Default: 0.50
  clientName: string;
  dateRange: string;
  version?: string;                   // Default: "v1.0"
  company?: string;                   // Default: "Biometix"
  confidentialText: string;

  insights: string[];
  recommendations: string[];

  weeklyAuthScores: WeeklyScoreRow[];
  weeklyQualityScores: WeeklyScoreRow[];
  rejectionsByDevice: DeviceRejection[];
  criticalEvents: CriticalEvent[];
  outliers?: OutlierRow[];            // Optional — auto-derived from criticalEvents if absent
  scorecard: ScorecardMetric[];
  matchHistogram?: MatchDistribution; 
}