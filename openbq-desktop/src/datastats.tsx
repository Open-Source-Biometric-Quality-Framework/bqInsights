// DBSCAN outliers with explanations + cluster descriptions
// Changes:
// 1) CSV loading happens in main (outside the function)
// 2) Supports excludedColumns and includedColumns (allowlist)
//
// Install:
//   npm i density-clustering papaparse
//
// Run:
//   node outliers.js path/to/file.csv

import clustering from "density-clustering";

function isMissing(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

function normaliseHeaderName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function looksLikeIndexName(colName) {
  const n = normaliseHeaderName(colName);
  return /^(idx|index|row|rownum|row_num|rownumber|row_number|rank|ranking|seq|sequence|serial|line|lineno|line_no)$/.test(n)
    || /(index|row\s*number|rownum|ranking|rank|sequence|serial)/.test(n);
}

function looksLikeIndexColumn(values, cfg = {}) {
  const {
    minNonEmptyFraction = 0.85,
    minUniqueFraction = 0.95,
    monotonicMinFraction = 0.98,
    constantStepMinFraction = 0.9,
    allowCleanSequenceShortcut = true,
  } = cfg;

  const n = values.length;

  const nums = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const s = isMissing(values[i]) ? "" : String(values[i]).trim();
    if (!s) continue;

    const cleaned = s
      .replace(/^#/, "")
      .replace(/\.$/, "")
      .replace(/(st|nd|rd|th)$/i, "");

    const x = Number(cleaned);
    if (!Number.isFinite(x)) return false;
    nums[i] = x;
  }

  const nonEmpty = [];
  for (let i = 0; i < n; i++) if (nums[i] !== null) nonEmpty.push(nums[i]);

  if (nonEmpty.length < 3) return false;
  if (nonEmpty.length / n < minNonEmptyFraction) return false;

  const uniq = new Set(nonEmpty);
  if (uniq.size / nonEmpty.length < minUniqueFraction) return false;

  if (allowCleanSequenceShortcut) {
    let ok = true;
    const start = nonEmpty[0];
    for (let k = 1; k < nonEmpty.length; k++) {
      const expected = start + k;
      if (Math.abs(nonEmpty[k] - expected) > 1e-9) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  let inc = 0;
  let comparisons = 0;
  const diffs = [];

  for (let k = 1; k < nonEmpty.length; k++) {
    const d = nonEmpty[k] - nonEmpty[k - 1];
    comparisons++;
    if (d > 0) inc++;
    diffs.push(d);
  }

  if (comparisons === 0) return false;
  if (inc / comparisons < monotonicMinFraction) return false;

  const roundedDiffs = diffs.map((d) => {
    const r = Math.round(d);
    return Math.abs(d - r) < 1e-9 ? r : d;
  });

  const freq = new Map();
  for (const d of roundedDiffs) freq.set(d, (freq.get(d) || 0) + 1);

  let maxCount = 0;
  let mode = null;
  for (const [d, c] of freq.entries()) {
    if (c > maxCount) {
      maxCount = c;
      mode = d;
    }
  }

  if (!(mode > 0)) return false;
  if (maxCount / roundedDiffs.length < constantStepMinFraction) return false;

  return true;
}

function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

function std(arr) {
  if (arr.length < 2) return 1;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (arr.length - 1);
  return Math.sqrt(v) || 1;
}

function mode(arr) {
  const f = new Map();
  for (const x of arr) f.set(x, (f.get(x) || 0) + 1);
  let best = null;
  let bestC = 0;
  for (const [k, c] of f.entries()) {
    if (c > bestC) {
      best = k;
      bestC = c;
    }
  }
  return { value: best, count: bestC };
}

/**
 * Core function operates on already-loaded rows (array of dicts).
 *
 * includedColumns:
 * - if provided and non-empty, ONLY these columns are considered candidates (before type inference)
 * - excludedColumns still applies afterwards (wins over include)
 *
 * excludedColumns:
 * - columns to drop from consideration
 */
export function OutliersAndClusters(rows, opts = {}) {
  const {
    numericThreshold = 0.9,
    categoricalMaxUniqueFraction = 0.2,
    categoricalMaxUniqueAbsolute = 100,

    excludeIndexLikeColumns = true,
    excludeIndexByName = true,
    indexDetection = {
      minNonEmptyFraction: 0.85,
      minUniqueFraction: 0.95,
      monotonicMinFraction: 0.98,
      constantStepMinFraction: 0.9,
      allowCleanSequenceShortcut: true,
    },

    excludedColumns = [],
    includedColumns = null, // null or [] means "no allowlist"

    epsilon = 1.5,
    minPoints = 5,

    dropRowsWithMissing = false,
    numericImpute = "mean",

    topKFeatures = 6,

    maxLabelSignals = 4,
    categoricalDominanceThreshold = 0.6,
    zSignalThreshold = 0.8,
  } = opts;

  if (!rows?.length) {
    return {
      outliers: [],
      outlierIndices: [],
      explanations: [],
      clusterDescriptions: {},
      excludedIndexColumns: [],
      usedColumns: { numeric: [], categorical: [] },
      columnTypes: {},
    };
  }

  const allCols = Object.keys(rows[0]);
  const n = rows.length;

  const excludeSet = new Set(excludedColumns);

  // Apply allowlist first (if provided)
  const includeSet =
    Array.isArray(includedColumns) && includedColumns.length
      ? new Set(includedColumns)
      : null;

  const candidateCols = allCols.filter((c) => {
    if (includeSet && !includeSet.has(c)) return false;
    if (excludeSet.has(c)) return false;
    return true;
  });

  // Per-column raw values in row order (only candidates, for speed)
  const colToValues = {};
  for (const col of candidateCols) colToValues[col] = rows.map((r) => r[col]);

  // Detect index-like columns (within candidates)
  const indexCols = new Set();
  const excludedIndexColumns = [];

  for (const col of candidateCols) {
    if (excludeIndexByName && looksLikeIndexName(col)) {
      indexCols.add(col);
      excludedIndexColumns.push(col);
      continue;
    }
    if (excludeIndexLikeColumns && looksLikeIndexColumn(colToValues[col], indexDetection)) {
      indexCols.add(col);
      excludedIndexColumns.push(col);
    }
  }

  // Infer types (within candidates, excluding index)
  const columnTypes = {};
  let numericCols = [];
  let categoricalCols = [];

  for (const col of candidateCols) {
    if (indexCols.has(col)) {
      columnTypes[col] = "index";
      continue;
    }

    let nonEmpty = 0;
    let numericCount = 0;
    const unique = new Set();

    for (const r of rows) {
      const s = isMissing(r[col]) ? "" : String(r[col]).trim();
      if (!s) continue;

      nonEmpty++;
      unique.add(s);

      const num = Number(s);
      if (Number.isFinite(num)) numericCount++;
    }

    if (nonEmpty === 0) {
      columnTypes[col] = "other";
      continue;
    }

    const numericFrac = numericCount / nonEmpty;
    const uniqueCount = unique.size;
    const uniqueFrac = uniqueCount / n;

    if (numericFrac >= numericThreshold) {
      columnTypes[col] = "numeric";
      numericCols.push(col);
    } else if (uniqueCount <= categoricalMaxUniqueAbsolute || uniqueFrac <= categoricalMaxUniqueFraction) {
      columnTypes[col] = "categorical";
      categoricalCols.push(col);
    } else {
      columnTypes[col] = "other";
    }
  }

  // If user provided an allowlist, and wants to force those columns even if "other",
  // you can do it outside by passing only columns you want in includedColumns.
  // Here we keep "other" excluded from modelling.

  // Levels for categoricals
  const catLevels = {};
  for (const col of categoricalCols) {
    const levels = new Set();
    for (const r of rows) {
      const s = isMissing(r[col]) ? "" : String(r[col]).trim();
      if (s) levels.add(s);
    }
    catLevels[col] = Array.from(levels).sort();
  }

  // Used rows selection
  const usedRowIndices = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    if (dropRowsWithMissing) {
      let missing = false;
      for (const c of numericCols) if (isMissing(r[c])) missing = true;
      for (const c of categoricalCols) if (isMissing(r[c])) missing = true;
      if (missing) continue;
    }
    usedRowIndices.push(i);
  }

  // Numeric global stats over used rows
  const numericSeries = Object.fromEntries(numericCols.map((c) => [c, []]));
  for (const idx of usedRowIndices) {
    const r = rows[idx];
    for (const c of numericCols) {
      const s = isMissing(r[c]) ? "" : String(r[c]).trim();
      numericSeries[c].push(s ? Number(s) : NaN);
    }
  }

  const globalMean = {};
  const globalStd = {};
  for (const c of numericCols) {
    const vals = numericSeries[c].filter((v) => Number.isFinite(v));
    globalMean[c] = vals.length ? mean(vals) : 0;
    globalStd[c] = vals.length ? std(vals) : 1;
  }

  // Encode vectors
  const vectors = [];
  const vectorIndexToRowIndex = [];

  const catBlock = {};
  let cursor = numericCols.length;
  for (const c of categoricalCols) {
    const levels = catLevels[c];
    catBlock[c] = { start: cursor, levels };
    cursor += levels.length;
  }

  for (const idx of usedRowIndices) {
    const r = rows[idx];
    const vec = [];

    for (const c of numericCols) {
      const s = isMissing(r[c]) ? "" : String(r[c]).trim();
      const num = s ? Number(s) : NaN;

      let filled = num;
      if (!Number.isFinite(filled)) filled = numericImpute === "mean" ? globalMean[c] : globalMean[c];
      vec.push((filled - globalMean[c]) / (globalStd[c] || 1));
    }

    for (const c of categoricalCols) {
      const s = isMissing(r[c]) ? "" : String(r[c]).trim();
      const levels = catLevels[c];
      for (const level of levels) vec.push(s === level ? 1 : 0);
    }

    vectors.push(vec);
    vectorIndexToRowIndex.push(idx);
  }

  if (!vectors.length || vectors[0].length === 0) {
    return {
      outliers: [],
      outlierIndices: [],
      explanations: [],
      clusterDescriptions: {},
      columnTypes,
      excludedIndexColumns,
      usedColumns: { numeric: numericCols, categorical: categoricalCols },
      warning: "No usable numeric/categorical columns after filtering (index/other/excluded/include).",
    };
  }

  // Cluster
  const DBSCAN = clustering.DBSCAN;
  const dbscan = new DBSCAN();
  const clusters = dbscan.run(vectors, epsilon, minPoints);
  const noiseVecIndices = dbscan.noise.slice();

  const vectorClusterId = new Array(vectors.length).fill(null);
  clusters.forEach((members, cid) => {
    for (const vIdx of members) vectorClusterId[vIdx] = cid;
  });

  const inlierVecIndices = [];
  for (let i = 0; i < vectorClusterId.length; i++) {
    if (vectorClusterId[i] !== null) inlierVecIndices.push(i);
  }

  function getCategoryFromVector(vec, col) {
    const block = catBlock[col];
    if (!block) return "";
    const { start, levels } = block;
    for (let i = 0; i < levels.length; i++) if (vec[start + i] === 1) return levels[i];
    return "";
  }

  function explainOutlier(noiseVecIdx, nearestInlierVecIdx) {
    const v = vectors[noiseVecIdx];
    const u = vectors[nearestInlierVecIdx];
    const reasons = [];

    for (let j = 0; j < numericCols.length; j++) {
      const col = numericCols[j];
      const delta = v[j] - u[j];
      const score = Math.abs(delta);
      if (score > 0) {
        const noiseRow = rows[vectorIndexToRowIndex[noiseVecIdx]];
        const inlierRow = rows[vectorIndexToRowIndex[nearestInlierVecIdx]];
        reasons.push({
          column: col,
          type: "numeric",
          score,
          detail: {
            outlierValue: noiseRow[col],
            nearestInlierValue: inlierRow[col],
            zDelta: delta,
          },
        });
      }
    }

    for (const col of categoricalCols) {
      const noiseVal = getCategoryFromVector(v, col) || "(missing/unknown)";
      const inlierVal = getCategoryFromVector(u, col) || "(missing/unknown)";
      if (noiseVal !== inlierVal) {
        reasons.push({
          column: col,
          type: "categorical",
          score: 1,
          detail: { outlierValue: noiseVal, nearestInlierValue: inlierVal },
        });
      }
    }

    reasons.sort((a, b) => b.score - a.score);
    return reasons.slice(0, topKFeatures);
  }

  // Cluster descriptions
  const clusterDescriptions = {};
  for (let cid = 0; cid < clusters.length; cid++) {
    const members = clusters[cid];
    const memberRowIdx = members.map((vIdx) => vectorIndexToRowIndex[vIdx]);
    const size = memberRowIdx.length;

    const signals = [];

    for (const col of numericCols) {
      const vals = memberRowIdx
        .map((ri) => {
          const s = isMissing(rows[ri][col]) ? "" : String(rows[ri][col]).trim();
          const x = s ? Number(s) : NaN;
          return Number.isFinite(x) ? x : NaN;
        })
        .filter((x) => Number.isFinite(x));

      if (!vals.length) continue;

      const cm = mean(vals);
      const z = (cm - globalMean[col]) / (globalStd[col] || 1);

      if (Math.abs(z) >= zSignalThreshold) {
        signals.push({
          kind: "numeric",
          column: col,
          direction: z > 0 ? "high" : "low",
          strength: Math.abs(z),
          detail: { clusterMean: cm, globalMean: globalMean[col], z },
        });
      }
    }

    for (const col of categoricalCols) {
      const vals = memberRowIdx
        .map((ri) => (isMissing(rows[ri][col]) ? "" : String(rows[ri][col]).trim()))
        .filter((v) => v !== "");

      if (!vals.length) continue;
      const m = mode(vals);
      const frac = m.count / vals.length;

      if (frac >= categoricalDominanceThreshold) {
        signals.push({
          kind: "categorical",
          column: col,
          direction: "mode",
          strength: frac,
          detail: { mode: m.value, fraction: frac },
        });
      }
    }

    signals.sort((a, b) => b.strength - a.strength);
    const top = signals.slice(0, maxLabelSignals);

    const parts = top.map((s) => {
      if (s.kind === "numeric") return `${s.column} ${s.direction}`;
      return `${s.column}=${s.detail.mode}`;
    });

    clusterDescriptions[cid] = {
      label: parts.length ? parts.join(", ") : "Mixed profile cluster",
      size,
      signals: top,
    };
  }

  // Outlier explanations (include originalRow dict)
  const explanations = [];
  for (const noiseVecIdx of noiseVecIndices) {
    let bestInlier = null;
    let bestDist = Infinity;

    for (const inlierVecIdx of inlierVecIndices) {
      const d = euclidean(vectors[noiseVecIdx], vectors[inlierVecIdx]);
      if (d < bestDist) {
        bestDist = d;
        bestInlier = inlierVecIdx;
      }
    }

    const outlierRowIndex = vectorIndexToRowIndex[noiseVecIdx];
    const originalRow = rows[outlierRowIndex];

    const nearestInlierRowIndex = bestInlier === null ? null : vectorIndexToRowIndex[bestInlier];
    const nearestInlierClusterId = bestInlier === null ? null : vectorClusterId[bestInlier];
    const nearestInlierClusterLabel =
      nearestInlierClusterId === null ? null : clusterDescriptions[nearestInlierClusterId]?.label ?? null;

    explanations.push({
      rowIndex: outlierRowIndex,
      originalRow,
      distanceToNearestInlier: bestDist,
      nearestInlierRowIndex,
      nearestInlierClusterId,
      nearestInlierClusterLabel,
      topReasons: bestInlier === null ? [] : explainOutlier(noiseVecIdx, bestInlier),
    });
  }

  const outlierIndices = explanations.map((e) => e.rowIndex);
  const outliers = outlierIndices.map((idx) => rows[idx]);

  return {
    outliers,
    outlierIndices,
    explanations,
    clusterDescriptions,
    columnTypes,
    excludedIndexColumns,
    usedColumns: { numeric: numericCols, categorical: categoricalCols },
    dbscanParams: { epsilon, minPoints },
  };
}
