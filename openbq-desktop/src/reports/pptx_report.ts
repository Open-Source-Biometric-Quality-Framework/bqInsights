// reports/pptx_report.ts

import PptxGenJS from "pptxgenjs";
import Plotly from "plotly.js-dist-min";
import { Theme, PIE_PALETTE, SCORECARD_PALETTE } from "./theme";
import type { WeeklyScoreRow, DeviceRejection, CriticalEvent, OutlierRow, ScorecardMetric, ReportConfig } from "./types.ts";
import { devicePieChart, weeklyDistributionChart, criticalScatter, matchHistogramChart } from "./charts";

/* ─────────────────────────────────────────────────────────────────────────────
   NORMALISE CONFIG
───────────────────────────────────────────────────────────────────────────── */

/** Strips a leading # from a hex string → 6-char hex for PptxGenJS. */
function stripHash(hex: string): string {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}

/** Ensures a hex string has a leading # for use in CSS / Plotly. */
function ensureHash(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

interface NormalisedConfig {
  systemName: string;
  algorithmName: string;
  primaryRejectionThreshold: number;
  investigationThreshold: number;
  clientName: string;
  dateRange: string;
  version: string;
  company: string;
  confidentialText: string;
  insights: string[];
  recommendations: string[];
  weeklyAuthScores: WeeklyScoreRow[];
  weeklyQualityScores: WeeklyScoreRow[];
  rejectionsByDevice: Required<DeviceRejection>[];
  criticalEvents: Required<CriticalEvent>[];
  outliers: OutlierRow[];
  scorecard: Required<ScorecardMetric>[];
  matchHistogram: {match:{binStart: number; binEnd: number; count: number;}[], nonMatch:{binStart: number; binEnd: number; count: number; }[]} | undefined;
}

function normaliseConfig(raw: ReportConfig): NormalisedConfig {
  const primaryRejectionThreshold = raw.primaryRejectionThreshold ?? 0.35;
  const investigationThreshold = raw.investigationThreshold ?? 0.50;

  const normalisedEvents: Required<CriticalEvent>[] = raw.criticalEvents.map((e, i) => ({
    ...e,
    label: e.label ?? `EVT-${String(i + 1).padStart(5, "0")}`,
    device: e.device ?? "Unknown",
  }));

  // If caller supplies no outliers array, derive one from criticalEvents.
  // Each critical event becomes an outlier row with the event label as its ID.
  const outliers: OutlierRow[] = raw.outliers ?? normalisedEvents.map(e => ({
    id: e.label,
    datetime: `Event ${e.x}`,
    customerId: "—",
    authScore: e.y,
    qualityScore: 0,
    device: e.device,
    action: e.y < primaryRejectionThreshold ? "REVIEW" : "MONITOR",
  }));

  console.log("-----")
  console.log(raw.matchHistogram);

  return {
    ...raw,
    version: raw.version ?? "v1.0",
    company: raw.company ?? "Biometix",
    primaryRejectionThreshold,
    investigationThreshold,
    outliers,
    rejectionsByDevice: raw.rejectionsByDevice.map((d, i) => ({
      ...d,
      color: d.color ?? PIE_PALETTE[i % PIE_PALETTE.length],
    })),
    scorecard: raw.scorecard.map((m, i) => ({
      ...m,
      sub: m.sub ?? "",
      color: m.color ?? SCORECARD_PALETTE[i % SCORECARD_PALETTE.length],
    })),
    criticalEvents: normalisedEvents,
    matchHistogram: raw.matchHistogram ? {
      match: raw.matchHistogram.match.map(b => ({ binStart: b.binStart, binEnd: b.binEnd, count: b.count })),
      nonMatch: raw.matchHistogram.nonMatch.map(b => ({ binStart: b.binStart, binEnd: b.binEnd, count: b.count }))
    } : undefined
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED SLIDE HELPERS
───────────────────────────────────────────────────────────────────────────── */

function makeShadow() {
  return { type: "outer", blur: 8, offset: 2, color: "000000", opacity: 0.08, angle: 135 } as const;
}

function addHeader(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  title: string,
  sub?: string,
) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.75,
    fill: { color: Theme.NAVY },
    line: { color: Theme.NAVY, width: 0 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0.75, w: 10, h: 0.04,
    fill: { color: Theme.TEAL },
    line: { color: Theme.TEAL, width: 0 },
  });
  slide.addText(title, {
    x: 0.4, y: 0, w: 6, h: 0.75,
    fontSize: 14, bold: true,
    color: Theme.WHITE, fontFace: "Calibri",
    valign: "middle", charSpacing: 1.5, margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: 6.5, y: 0, w: 3.2, h: 0.75,
      fontSize: 11, color: Theme.SLATE,
      fontFace: "Calibri", valign: "middle", align: "right", margin: 0,
    });
  }
}

function addConfBar(pres: PptxGenJS, slide: PptxGenJS.Slide, text: string) {
  const Y = 5.38;
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: Y, w: 10, h: 0.245,
    fill: { color: Theme.NAVY },
    line: { color: Theme.NAVY, width: 0 },
  });
  slide.addText(text, {
    x: 0, y: Y, w: 10, h: 0.245,
    fontSize: 8, color: Theme.MUTED,
    fontFace: "Calibri", align: "center", valign: "middle",
    charSpacing: 0.8, margin: 0,
  });
}

/** White card with a coloured top accent strip and drop shadow. */
function addCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  accentColor = Theme.TEAL,
) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: Theme.CARD },
    line: { color: Theme.BORDER, width: 0.75 },
    shadow: makeShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h: 0.06,
    fill: { color: accentColor },
    line: { color: accentColor, width: 0 },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SLIDE BUILDERS
───────────────────────────────────────────────────────────────────────────── */

function addCoverSlide(pres: PptxGenJS, cfg: NormalisedConfig) {
  const s = pres.addSlide();
  s.background = { color: Theme.NAVY };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: Theme.TEAL },
    line: { color: Theme.TEAL, width: 0 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -0.5, w: 3.5, h: 3.5,
    fill: { color: Theme.TEAL, transparency: 88 },
    line: { color: Theme.TEAL, width: 0 },
  });
  s.addShape(pres.shapes.OVAL, {
    x: 8.2, y: 2.8, w: 2.2, h: 2.2,
    fill: { color: Theme.TEAL_L, transparency: 90 },
    line: { color: Theme.TEAL_L, width: 0 },
  });

  s.addText("BIOMETRIC & IDENTITY DATA ANALYSIS", {
    x: 0.5, y: 0.88, w: 7, h: 0.28,
    fontSize: 9, color: Theme.MUTED,
    fontFace: "Calibri", charSpacing: 2.5, margin: 0,
  });
  s.addText("Performix Insights", {
    x: 0.5, y: 1.18, w: 7.5, h: 0.85,
    fontSize: 40, bold: true,
    color: Theme.WHITE, fontFace: "Georgia", margin: 0,
  });
  s.addText(cfg.systemName, {
    x: 0.5, y: 2.08, w: 7, h: 0.46,
    fontSize: 18, italic: true,
    color: Theme.TEAL_L, fontFace: "Calibri", margin: 0,
  });
  s.addText(`${cfg.clientName}  ·  ${cfg.dateRange}`, {
    x: 0.5, y: 2.62, w: 7, h: 0.38,
    fontSize: 13, color: Theme.SLATE,
    fontFace: "Calibri", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.28, w: 5.0, h: 1.58,
    fill: { color: Theme.NAVY2 },
    line: { color: Theme.TEAL, width: 1 },
  });
  s.addText([
    { text: "System: ", options: { color: Theme.SLATE, fontSize: 11 } },
    { text: cfg.systemName, options: { color: Theme.WHITE, fontSize: 11, bold: true, breakLine: false } },
    { text: "   |   Algorithm: ", options: { color: Theme.SLATE, fontSize: 11 } },
    { text: cfg.algorithmName, options: { color: Theme.WHITE, fontSize: 11, bold: true, breakLine: true } },
    { text: "Rejection Threshold: ", options: { color: Theme.SLATE, fontSize: 11 } },
    { text: `${cfg.primaryRejectionThreshold}   `, options: { color: Theme.ORANGE, fontSize: 13, bold: true, breakLine: false } },
    { text: "  Investigation Threshold: ", options: { color: Theme.SLATE, fontSize: 11 } },
    { text: String(cfg.investigationThreshold), options: { color: Theme.ORANGE, fontSize: 13, bold: true } },
  ], {
    x: 0.66, y: 3.4, w: 4.7, h: 1.36,
    fontFace: "Calibri", margin: 0,
  });

  s.addText(`${cfg.version}  ·  © 2026 ${cfg.company}  ·  Model: ${cfg.algorithmName}`, {
    x: 0.5, y: 5.0, w: 9, h: 0.28,
    fontSize: 9, color: Theme.FOOTER,
    fontFace: "Calibri", margin: 0,
  });

  addConfBar(pres, s, cfg.confidentialText);
}

function addSummarySlide(pres: PptxGenJS, cfg: NormalisedConfig) {
  const s = pres.addSlide();
  s.background = { color: Theme.BG };
  addHeader(pres, s, "SYSTEM SUMMARY", `${cfg.clientName}  ·  ${cfg.dateRange}`);

  const metricCards = [
    { label: "System Name", value: cfg.systemName, color: Theme.DARK, x: 0.28 },
    { label: "Algorithm", value: cfg.algorithmName, color: Theme.DARK, x: 2.76 },
    { label: "Primary Rejection Threshold", value: String(cfg.primaryRejectionThreshold), color: Theme.ORANGE, x: 5.24 },
    { label: "Investigation Threshold", value: String(cfg.investigationThreshold), color: Theme.ORANGE, x: 7.55 },
  ];

  metricCards.forEach(c => {
    addCard(pres, s, c.x, 0.96, 2.22, 1.52);
    s.addText(c.label, {
      x: c.x + 0.14, y: 1.10, w: 2.0, h: 0.34,
      fontSize: 9, color: Theme.MUTED, fontFace: "Calibri", margin: 0,
    });
    s.addText(c.value, {
      x: c.x + 0.14, y: 1.50, w: 2.0, h: 0.75,
      fontSize: c.value.length > 10 ? 13 : 22, bold: true,
      color: c.color, fontFace: "Calibri", margin: 0, valign: "middle",
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 2.72, w: 9.44, h: 2.52,
    fill: { color: Theme.INSIGHT_BG },
    line: { color: Theme.TEAL, width: 1 },
  });
  s.addText("✦  AI-Generated Insights", {
    x: 0.46, y: 2.83, w: 4.5, h: 0.38,
    fontSize: 12, bold: true, color: Theme.TEAL, fontFace: "Calibri", margin: 0,
  });

  s.addText("KEY INSIGHTS", {
    x: 0.46, y: 3.30, w: 4.4, h: 0.26,
    fontSize: 9, bold: true, color: Theme.MUTED,
    fontFace: "Calibri", charSpacing: 2, margin: 0,
  });
  s.addText(
    cfg.insights.map((text, i) => ({
      text,
      options: { bullet: true, breakLine: i < cfg.insights.length - 1, fontSize: 10, color: Theme.DARK, paraSpaceAfter: 4 },
    })),
    { x: 0.46, y: 3.60, w: 4.4, h: 1.52, fontFace: "Calibri", margin: 0 },
  );

  s.addText("KEY RECOMMENDATIONS", {
    x: 5.10, y: 3.30, w: 4.5, h: 0.26,
    fontSize: 9, bold: true, color: Theme.MUTED,
    fontFace: "Calibri", charSpacing: 2, margin: 0,
  });
  s.addText(
    cfg.recommendations.slice(0, 3).map((text, i) => ({
      text,
      options: { bullet: true, breakLine: i < 2, fontSize: 10, color: Theme.DARK, paraSpaceAfter: 4 },
    })),
    { x: 5.10, y: 3.60, w: 4.5, h: 1.52, fontFace: "Calibri", margin: 0 },
  );

  addConfBar(pres, s, cfg.confidentialText);
}

function addChartSlide(
  pres: PptxGenJS,
  cfg: NormalisedConfig,
  title: string,
  sub: string,
  pngBase64: string,
) {
  const s = pres.addSlide();
  s.background = { color: Theme.BG };
  addHeader(pres, s, title, sub);
  addCard(pres, s, 0.28, 0.88, 5.74, 4.28);
  s.addImage({ data: `image/png;base64,${pngBase64}`, x: 0.32, y: 0.92, w: 5.66, h: 4.20 });
  addConfBar(pres, s, cfg.confidentialText);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.24, y: 0.88, w: 3.48, h: 0.52,
    fill: { color: Theme.NAVY }, line: { color: Theme.NAVY, width: 0 },
  });
  s.addText("Key Findings", {
    x: 6.38, y: 0.88, w: 3.24, h: 0.52,
    fontSize: 12, bold: true, color: Theme.WHITE, fontFace: "Calibri", valign: "middle", margin: 0,
  });

  const findings = [
    { group: "Trend Within Limits", pct: "41%", share: "28% usage", color: Theme.NAVY },
    { group: "Slight upward", pct: "33%", share: "35% usage", color: Theme.NAVY },
    { group: "No downwards", pct: "26%", share: "37% usage", color: Theme.NAVY },
  ];

  findings.forEach(({ group, pct, share, color }, i) => {
    const y = 1.56 + i * 1.02;
    addCard(pres, s, 6.24, y, 3.48, 0.88, color);
    s.addText(group, { x: 6.40, y: y + 0.16, w: 2.2, h: 0.30, fontSize: 11, bold: true, color: Theme.DARK, fontFace: "Calibri", margin: 0 });
    s.addText(`${pct} of rejections  ·  ${share}`, { x: 6.40, y: y + 0.50, w: 2.4, h: 0.26, fontSize: 9, color: Theme.MUTED, fontFace: "Calibri", margin: 0 });
    s.addText(pct, { x: 9.12, y: y + 0.16, w: 0.52, h: 0.52, fontSize: 22, bold: true, color, fontFace: "Calibri", align: "right", margin: 0 });
  });

}

function addRejectionsSlide(pres: PptxGenJS, cfg: NormalisedConfig, pngBase64: string) {
  const s = pres.addSlide();
  s.background = { color: Theme.BG };
  addHeader(pres, s, "REJECTIONS BY DEVICE TYPE", `${cfg.clientName}  ·  ${cfg.dateRange}`);

  addCard(pres, s, 0.28, 0.88, 5.74, 4.28);
  s.addImage({ data: `image/png;base64,${pngBase64}`, x: 0.32, y: 0.92, w: 5.66, h: 4.16 });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.24, y: 0.88, w: 3.48, h: 0.52,
    fill: { color: Theme.NAVY }, line: { color: Theme.NAVY, width: 0 },
  });
  s.addText("Key Findings", {
    x: 6.38, y: 0.88, w: 3.24, h: 0.52,
    fontSize: 12, bold: true, color: Theme.WHITE, fontFace: "Calibri", valign: "middle", margin: 0,
  });

  const findings = [
    { group: "Samsung Galaxy", pct: "41%", share: "28% usage", color: Theme.RED },
    { group: "iPhone 14/15", pct: "33%", share: "35% usage", color: Theme.BLUE },
    { group: "Google Pixel", pct: "26%", share: "37% usage", color: Theme.GREEN },
  ];
  findings.forEach(({ group, pct, share, color }, i) => {
    const y = 1.56 + i * 1.02;
    addCard(pres, s, 6.24, y, 3.48, 0.88, color);
    s.addText(group, { x: 6.40, y: y + 0.16, w: 2.2, h: 0.30, fontSize: 11, bold: true, color: Theme.DARK, fontFace: "Calibri", margin: 0 });
    s.addText(`${pct} of rejections  ·  ${share}`, { x: 6.40, y: y + 0.50, w: 2.4, h: 0.26, fontSize: 9, color: Theme.MUTED, fontFace: "Calibri", margin: 0 });
    s.addText(pct, { x: 9.12, y: y + 0.16, w: 0.52, h: 0.52, fontSize: 22, bold: true, color, fontFace: "Calibri", align: "right", margin: 0 });
  });

  s.addText(
    "Samsung Galaxy over-indexes on rejections by 13 percentage points relative to usage share.",
    { x: 6.24, y: 4.72, w: 3.48, h: 0.40, fontSize: 9, italic: true, color: Theme.MUTED, fontFace: "Calibri", margin: 0 },
  );

  addConfBar(pres, s, cfg.confidentialText);
}

function addQueueSlide(pres: PptxGenJS, cfg: NormalisedConfig) {
  const s = pres.addSlide();
  s.background = { color: Theme.BG };
  addHeader(pres, s, "OUTLIERS & INVESTIGATION QUEUE");

  const total = cfg.outliers.length;

  s.addShape(pres.shapes.OVAL, {
    x: 8.38, y: 0.14, w: 1.30, h: 0.46,
    fill: { color: Theme.ORANGE }, line: { color: Theme.ORANGE, width: 0 },
  });
  s.addText(`${total} Items`, {
    x: 8.38, y: 0.14, w: 1.30, h: 0.46,
    fontSize: 10, bold: true, color: Theme.WHITE,
    fontFace: "Calibri", align: "center", valign: "middle", margin: 0,
  });

  const COL_X = [0.34, 1.68, 3.22, 4.76, 5.86, 7.00, 8.38];
  const COL_W = [1.26, 1.46, 1.46, 1.00, 1.06, 1.30, 1.24];
  const HDRS = ["Event ID", "Date & Time", "Customer ID", "Auth Score", "Quality Score", "Device", "Action"];

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.28, y: 0.84, w: 9.44, h: 0.44,
    fill: { color: Theme.NAVY }, line: { color: Theme.NAVY, width: 0 },
  });
  HDRS.forEach((h, i) => {
    s.addText(h, {
      x: COL_X[i], y: 0.86, w: COL_W[i], h: 0.40,
      fontSize: 9, bold: true, color: Theme.WHITE,
      fontFace: "Calibri", valign: "middle", margin: 0,
    });
  });

  cfg.outliers.forEach((row, ri) => {
    const y = 1.30 + ri * 0.52;
    const bg = ri % 2 === 0 ? Theme.CARD : "F8FAFC";
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.28, y, w: 9.44, h: 0.50,
      fill: { color: bg }, line: { color: Theme.BORDER, width: 0.4 },
    });

    const cells: string[] = [
      row.id, row.datetime, row.customerId,
      String(row.authScore), String(row.qualityScore || "—"),
      row.device, row.action,
    ];
    cells.forEach((cell, ci) => {
      const isScore = ci === 3;
      const isAction = ci === 6;
      const scoreColor = isScore && row.authScore < 0.30 ? Theme.RED : Theme.ORANGE;
      const actionColor = row.action === "REVIEW" ? Theme.RED : Theme.TEAL;
      s.addText(cell, {
        x: COL_X[ci], y: y + 0.06, w: COL_W[ci], h: 0.38,
        fontSize: 9.5,
        bold: isScore || isAction,
        color: isAction ? actionColor : (isScore ? scoreColor : Theme.DARK),
        fontFace: "Calibri", valign: "middle", margin: 0,
      });
    });
  });

  s.addText(
    total > 0
      ? `Showing ${total} items  ·  Events below rejection threshold flagged for REVIEW`
      : "No outlier records in this dataset.",
    { x: 0.28, y: 5.18, w: 9.44, h: 0.26, fontSize: 9, color: Theme.MUTED, fontFace: "Calibri", margin: 0 },
  );

  addConfBar(pres, s, cfg.confidentialText);
}

function addScorecardSlide(pres: PptxGenJS, cfg: NormalisedConfig) {
  const s = pres.addSlide();
  s.background = { color: Theme.BG };
  addHeader(pres, s, "PERFORMANCE SCORECARD", `${cfg.clientName}  ·  ${cfg.dateRange}`);

  const POSITIONS: [number, number][] = [
    [0.28, 0.92], [3.46, 0.92], [6.64, 0.92],
    [0.28, 2.96], [3.46, 2.96], [6.64, 2.96],
  ];

  cfg.scorecard.forEach((m, i) => {
    const [x, y] = POSITIONS[i] ?? [0.28, 0.92];
    const hexColor = stripHash(m.color);
    addCard(pres, s, x, y, 3.10, 1.90, hexColor);
    s.addText(m.label, {
      x: x + 0.16, y: y + 0.20, w: 2.80, h: 0.34,
      fontSize: 10, color: Theme.MUTED, fontFace: "Calibri", margin: 0,
    });
    s.addText(m.value, {
      x: x + 0.16, y: y + 0.58, w: 2.80, h: 0.80,
      fontSize: 30, bold: true, color: hexColor, fontFace: "Calibri", margin: 0,
    });
    s.addText(m.sub, {
      x: x + 0.16, y: y + 1.50, w: 2.80, h: 0.30,
      fontSize: 10, italic: true, color: Theme.MUTED, fontFace: "Calibri", margin: 0,
    });
  });

  addConfBar(pres, s, cfg.confidentialText);
}

function addRecommendationsSlide(pres: PptxGenJS, cfg: NormalisedConfig) {
  const s = pres.addSlide();
  s.background = { color: Theme.NAVY };

  s.addShape(pres.shapes.OVAL, {
    x: 7.8, y: 3.2, w: 3.0, h: 3.0,
    fill: { color: Theme.TEAL, transparency: 90 },
    line: { color: Theme.TEAL, width: 0 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.14, h: 5.625,
    fill: { color: Theme.TEAL }, line: { color: Theme.TEAL, width: 0 },
  });

  s.addText("Recommendations", {
    x: 0.42, y: 0.30, w: 8, h: 0.72,
    fontSize: 30, bold: true, color: Theme.WHITE, fontFace: "Georgia", margin: 0,
  });
  s.addText("& Next Steps", {
    x: 0.42, y: 0.96, w: 6, h: 0.50,
    fontSize: 22, italic: true, color: Theme.TEAL_L, fontFace: "Calibri", margin: 0,
  });

  cfg.recommendations.forEach((rec, i) => {
    const y = 1.62 + i * 0.86;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.40, y, w: 9.20, h: 0.74,
      fill: { color: Theme.NAVY2 }, line: { color: Theme.TEAL, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.40, y, w: 0.12, h: 0.74,
      fill: { color: Theme.TEAL_L }, line: { color: Theme.TEAL_L, width: 0 },
    });
    s.addText(`0${i + 1}`, {
      x: 0.60, y: y + 0.14, w: 0.38, h: 0.44,
      fontSize: 15, bold: true, color: Theme.TEAL, fontFace: "Calibri", margin: 0,
    });
    s.addText(rec, {
      x: 1.08, y: y + 0.14, w: 8.30, h: 0.48,
      fontSize: 11, color: Theme.NAVY_MID,
      fontFace: "Calibri", valign: "middle", margin: 0,
    });
  });

  s.addText(
    `${cfg.systemName}  ·  ${cfg.algorithmName}  ·  © 2026 ${cfg.company}`,
    { x: 0.42, y: 5.18, w: 9, h: 0.24, fontSize: 9, color: Theme.FOOTER, fontFace: "Calibri", margin: 0 },
  );

  addConfBar(pres, s, cfg.confidentialText);
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN ENTRY POINT
───────────────────────────────────────────────────────────────────────────── */

export async function generatePptxReport(rawCfg: ReportConfig): Promise<PptxGenJS> {
  const cfg = normaliseConfig(rawCfg);
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Performix Insights";
  pres.author = cfg.company;
  pres.subject = `${cfg.clientName} · ${cfg.dateRange}`;

  console.log("Generating charts...");
  console.log(cfg.matchHistogram);

  // Render all chart images in parallel
  const [authImg, qualImg, pieImg, scatterImg, histImg] = await Promise.all([
    weeklyDistributionChart(
      cfg.weeklyAuthScores,
      cfg.primaryRejectionThreshold,
      cfg.investigationThreshold,
      "Weekly Authentication Score Distribution",
    ),
    weeklyDistributionChart(
      cfg.weeklyQualityScores,
      0.75,
      0.75,
      "Weekly Audio Quality Score Distribution",
    ),
    devicePieChart(cfg.rejectionsByDevice),
    criticalScatter(cfg.criticalEvents, cfg.primaryRejectionThreshold, cfg.investigationThreshold),
    matchHistogramChart(
      cfg.matchHistogram,
      {
        rejectionThreshold: 0.35,
        investigationThreshold: 0.5,
      },
      "Match vs Non-Match Score Distribution"
    )
  ]);

  addCoverSlide(pres, cfg);
  addSummarySlide(pres, cfg);
  addChartSlide(pres, cfg, "MATCH HISTOGRAM", "Histogram chart", histImg);
  addChartSlide(pres, cfg, "WEEKLY AUTHENTICATION SCORES", "Line chart — distribution bands per week", authImg);
  addChartSlide(pres, cfg, "WEEKLY AUDIO QUALITY SCORES", "Line chart — distribution bands per week", qualImg);
  addRejectionsSlide(pres, cfg, pieImg);
  addChartSlide(pres, cfg, "CRITICAL EVENTS — SCATTER ANALYSIS", "Auth score per event · sized & coloured by risk level", scatterImg);
  addQueueSlide(pres, cfg);
  addScorecardSlide(pres, cfg);
  addRecommendationsSlide(pres, cfg);

  return pres;
}
