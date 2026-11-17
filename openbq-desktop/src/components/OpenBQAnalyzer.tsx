// OpenBQAnalyzer.tsx - Main component orchestrating the analysis

import React, { useState, useEffect, useRef, startTransition } from 'react';
import "embedding-atlas/react";
import { InfoPanel } from './InfoPanel';


import type { ProcessingProgress } from '../utils/types';
import { AnalysisService } from '../services/analysisService';
import UMAPProcessor from '../processing/umapProcessor';
import { extractNumericFeatures } from '../processing/featureExtraction';
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  makeLocalStorageKey,
  loadLastCacheKey,
  saveLastCacheKey
} from '../services/cacheService';

import { EmbeddingVisualization } from './EmbeddingVisualization';
import { HoverInfo } from './HoverInfo';
import { LogPanel } from './LogPanel';

export type QualityMetric = 'ofiq' | 'nisqa' | 'obqe' | 'NFIQ2' | 'biqt';
export type BiometricModality = 'face' | 'finger' | 'iris' | 'voice';

export type AnalysisParams = {
  qualityMetric: QualityMetric;
  biometricModality: BiometricModality;
  dbscanMinPts: number;
  hdbscanMinSamples: number;
  dbscanEpsKNN: number;
  pcaMinPts: number;
  pcaMaxComponents: number;
  pcaSweepIterations: number;
  superclusterMinPoints: number;
  superclusterRadius: number;
  superclusterMinZoom: number;
  superclusterMaxZoom: number;
  umapNNeighbors: number;
  umapMinDist: number;
  excludeLowVariance: boolean;
  excludeNonScalar: boolean;
  runClustering: boolean;
  clusterMethod: 'umap' | 'pca' | 'supercluster' | 'jsdbscan';
};

type OpenBQAnalyzerProps = {
  directory: string;
  limit: number;
  analysisParams?: AnalysisParams;
  opening?: boolean;
  isCancelling?: boolean;
  onCancel?: () => void;
  onSelection?: (selection: any, folderPath: string) => void;
  onProcessingComplete?: (data: any) => void;
  customInfoPanel?: React.ReactNode;
  customLogPanel?: React.ReactNode;
  onLogUpdate?: (logs: string[]) => void;
  rowsInput?: any[]; // a new prop to receive the rows data if not using the OpenBQAnalyzer's internal file reading
  analysisKey?: number; // a key to force remounting when rowsInput changes
};

const CATEGORY_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#00b894', '#e17055'
];

// simple 256-entry Viridis palette (RGB hex strings)
const VIRIDIS_PALETTE = [
  "#440154", "#440256", "#450457", "#450559", "#46075A", "#46085B", "#470A5C", "#480C5D",
  "#490D5E", "#4B0F5F", "#4C105F", "#4D125F", "#4F145F", "#511560", "#531760", "#551961",
  "#571B61", "#591D62", "#5C1F62", "#5F2163", "#622363", "#642563", "#672763", "#6A2964",
  "#6D2B65", "#703D66", "#733F66", "#764166", "#794366", "#7D4566", "#804766", "#844967",
  "#884B67", "#8C4D67", "#914F68", "#955168", "#995368", "#9E5569", "#A25769", "#A65969",
  "#AB5B69", "#B05D6A", "#B45F6A", "#B9616A", "#BD636A", "#C1656B", "#C5676B", "#CA696B",
  "#CD6C6C", "#D16E6C", "#D5706D", "#D8726D", "#DC746E", "#DF766E", "#E3786F", "#E67A6F",
  "#E97C70", "#EC7E70", "#EF8171", "#F28371", "#F58572", "#F78772", "#FA8A73", "#FC8C73",
  "#FE8E74", "#FF9174", "#FF9375", "#FF9575", "#FF9876", "#FF9A76", "#FF9C77", "#FF9F77",
  "#FFA178", "#FFA378", "#FFA679", "#FFA879", "#FFAA7A", "#FFAD7A", "#FFAF7B", "#FFB17B",
  "#FFB47C", "#FFB67C", "#FFB87D", "#FFBB7D", "#FFBD7E", "#FFBF7E", "#FFC17F", "#FFC47F",
  "#FFC680", "#FFC880", "#FFCB81", "#FFCD81", "#FFCF82", "#FFD182", "#FFD383", "#FFD683",
  "#FFD884", "#FFDA84", "#FFDC85", "#FFDE85", "#FFE186", "#FFE386", "#FFE587", "#FFE787",
  "#FFE988", "#FFEC88", "#FFEE89", "#FFF089", "#FFF28A", "#FFF48A", "#FFF68B", "#FFF98B",
  "#FFFB8C", "#FFFD8C", "#FFFF8D", "#FFFE8D", "#FEFC8E", "#FEFA8E", "#FEF88F", "#FEF68F",
  "#FEF490", "#FEF390", "#FEF191", "#FEEF91", "#FEED92", "#FEEB92", "#FEE993", "#FEE793",
  "#FEE594", "#FEE394", "#FDE195", "#FDDF95", "#FDDD96", "#FDDB96", "#FDD997", "#FDD797",
  "#FDD598", "#FDD398", "#FDD199", "#FDCF99", "#FDCD9A", "#FDCB9A", "#FCC99B", "#FCC79B",
  "#FCC59C", "#FCC39C", "#FCC19D", "#FCBF9D", "#FCBD9E", "#FCBB9E", "#FCB99F", "#FCB79F",
  "#FCB5A0", "#FCB3A0", "#FCB1A1", "#FCAFA1", "#FCADA2", "#FCABA2", "#FCA9A3", "#FCA7A3",
  "#FCA5A4", "#FCA3A4", "#FCA1A5", "#FC9FA5", "#FC9DA6", "#FC9BA6", "#FC99A7", "#FC97A7",
  "#FC95A8", "#FC93A8", "#FC91A9", "#FC8FA9", "#FC8DAA", "#FC8BAA", "#FC89AB", "#FC87AB",
  "#FC85AC", "#FC83AC", "#FC81AD", "#FC7FAD", "#FC7DAE", "#FC7BAE", "#FC79AF", "#FC77AF",
  "#FC75B0", "#FC73B0", "#FC71B1", "#FC6FB1", "#FC6DB2", "#FC6BB2", "#FC69B3", "#FC67B3",
  "#FC65B4", "#FC63B4", "#FC61B5", "#FC5FB5", "#FC5DB6", "#FC5BB6", "#FC59B7", "#FC57B7",
  "#FC55B8", "#FC53B8", "#FC51B9", "#FC4FB9", "#FC4DBA", "#FC4BBA", "#FC49BB", "#FC47BB",
  "#FC45BC", "#FC43BC", "#FC41BD", "#FC3FBD", "#FC3DBE", "#FC3BBE", "#FC39BF", "#FC37BF",
  "#FC35C0", "#FC33C0", "#FC31C1", "#FC2FC1", "#FC2DC2", "#FC2BC2", "#FC29C3", "#FC27C3",
  "#FC25C4", "#FC23C4", "#FC21C5", "#FC1FC5", "#FC1DC6", "#FC1BC6", "#FC19C7", "#FC17C7",
  "#FC15C8", "#FC13C8", "#FC11C9", "#FC0FC9", "#FC0DCA", "#FC0BCA", "#FC09CB", "#FC07CB",
  "#FC05CC", "#FC03CC", "#FC01CD", "#FB00CD", "#F900CE", "#F700CE", "#F500CF", "#F300CF",
  "#F100D0", "#EF00D0", "#ED00D1", "#EB00D1", "#E900D2", "#E700D2", "#E500D3", "#E300D3",
  "#FDE725"
] as const;
const PALETTE_SIZE = VIRIDIS_PALETTE.length;


const DEFAULT_ANALYSIS_PARAMS: AnalysisParams = {
  qualityMetric: 'obqe',
  biometricModality: 'face',
  dbscanMinPts: 5,
  hdbscanMinSamples: 5,
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

function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const normalize = (input: any): any => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.map(normalize);
    const keys = Object.keys(input).sort();
    const out: Record<string, any> = {};
    for (const key of keys) out[key] = normalize(input[key]);
    return out;
  };
  return JSON.stringify(normalize(value));
}

function rehydrateUmapResult(input: any): any | null {
  if (!input || typeof input !== 'object') return null;
  const source = input.umapResult && typeof input.umapResult === 'object' ? input.umapResult : input;
  const toNum = (arr: any): number[] => {
    if (Array.isArray(arr)) return arr.map((v) => (Number.isFinite(v) ? Number(v) : 0));
    if (ArrayBuffer.isView(arr)) return Array.from(arr as any, (v: any) => (Number.isFinite(v) ? Number(v) : 0));
    return [];
  };
  const xArr = toNum(source.x);
  const yArr = toNum(source.y);
  const cArr = toNum(source.categories ?? source.category);
  if (!xArr.length || !yArr.length || xArr.length !== yArr.length) return null;
  const x = new Float32Array(xArr);
  const y = new Float32Array(yArr);
  let categories = new Uint8Array(cArr);
  if (categories.length !== x.length) categories = new Uint8Array(x.length);
  const points = Array.from(x, (vx, i) => ({ x: vx, y: y[i] }));
  return { ...source, x, y, categories, points };
}

function normalizeUmapForCache(input: any): any {
  if (!input || typeof input !== 'object') return input;
  const toNum = (arr: any): number[] => {
    if (Array.isArray(arr)) return arr.map((v) => (Number.isFinite(v) ? Number(v) : 0));
    if (ArrayBuffer.isView(arr)) return Array.from(arr as any, (v: any) => (Number.isFinite(v) ? Number(v) : 0));
    return [];
  };
  return {
    ...input,
    x: toNum(input.x),
    y: toNum(input.y),
    categories: toNum(input.categories ?? input.category)
  };
}

function isClusteredKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.includes('_cluster1_');
}

export function OpenBQAnalyzer({
  directory,
  limit,
  analysisParams = DEFAULT_ANALYSIS_PARAMS,
  opening = false,
  isCancelling = false,
  onCancel,
  onSelection,
  onProcessingComplete,
  customInfoPanel,
  customLogPanel,
  onLogUpdate,
  rowsInput,
  analysisKey
}: OpenBQAnalyzerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [hasError, setHasError] = useState<string | null>(null);

  const [xColumn, setXColumn] = useState<Float32Array | null>(null);
  const [yColumn, setYColumn] = useState<Float32Array | null>(null);
  const [categoryColumn, setCategoryColumn] = useState<Uint8Array | null>(null);

  const [mainData, setMainData] = useState<any>(null);
  const [folderPath, setFolderPath] = useState<string | null>(directory);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverImageBase64, setHoverImageBase64] = useState<string | null>(null);
  const [filteringOn, setFilteringOn] = useState(false);

  // Color mode state
  const [colorMode, setColorMode] = useState<'category' | 'numeric'>('category');
  const [selectedNumericField, setSelectedNumericField] = useState<string>('score');
  const [numericColorData, setNumericColorData] = useState<Float32Array | null>(null);
  const [numericRange, setNumericRange] = useState<{ min: number; max: number } | null>(null);
  const [availableNumericFields, setAvailableNumericFields] = useState<string[]>([]);

  const analysisServiceRef = useRef<AnalysisService | null>(null);
  const umapProcessorRef = useRef<UMAPProcessor | null>(null);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    analysisServiceRef.current = new AnalysisService();
    umapProcessorRef.current = new UMAPProcessor();

    return () => {
      analysisServiceRef.current?.destroy();
      umapProcessorRef.current?.destroy();
    };
  }, []);

  const cancelRun = () => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    analysisServiceRef.current?.cancel();
    setIsRunning(false);
    setHasError(null);
    onCancel?.();
  };

  // Notify parent of log updates
  const onLogUpdateRef = useRef(onLogUpdate);

  // Keep ref updated
  useEffect(() => {
    onLogUpdateRef.current = onLogUpdate;
  }, [onLogUpdate]);

  // Use the ref in your effect
  useEffect(() => {
    if (onLogUpdateRef.current) {
      onLogUpdateRef.current(logs);
    }
  }, [logs]); // Only depend on logs

  const resetAnalysisState = () => {
    setLogs([]);
    setIsRunning(false);

    setXColumn(null);
    setYColumn(null);
    setCategoryColumn(null);

    setMainData(null);

    setHoverIndex(null);
    setHoverImageBase64(null);

    setFilteringOn(false);
    setNumericColorData(null);
    setNumericRange(null);
    setAvailableNumericFields([]);
    setHasError(null);

  };

  useEffect(() => {
    // Ignore first mount if directory is null
    if (!directory) return;

    resetAnalysisState();
    setFolderPath(directory);

    // Optional: auto-run analysis on prop change
    // processDirectory(directory);

  }, [directory]);

  // Listen to Electron progress events
  useEffect(() => {
    const cleanup = window.electron.openbq.onProgress(progress => {
      setLogs(prev => [...prev, progress.message]);
    });
    return cleanup;
  }, []);

  // Handle hover image loading
  useEffect(() => {
    if (hoverIndex === null || !mainData || !folderPath) {
      setHoverImageBase64(null);
      return;
    }
    let imageFile = mainData[hoverIndex]["file"];
    (async () => {
      try {
        const { success, base64 } = await window.electron.fs.readImageBase64(
          imageFile,
          folderPath,
          { maxWidth: 80 }
        );

        if (success && base64) {
          setHoverImageBase64(base64);
        } else {
          setHoverImageBase64(null);
        }
      } catch (err) {
        console.error("Error reading file base64:", err);
        setHoverImageBase64(null);
      }
    })();
  }, [hoverIndex, mainData, folderPath]);

  // Extract numeric color data when field changes - FIXED VERSION
  useEffect(() => {
    if (!mainData || colorMode !== 'numeric' || !selectedNumericField) {
      setNumericColorData(null);
      setNumericRange(null);
      return;
    }

    try {
      const rawValues = new Float32Array(mainData.length);
      let min = Infinity;
      let max = -Infinity;

      // First pass: extract raw values and find min/max
      for (let i = 0; i < mainData.length; i++) {
        const val = mainData[i][selectedNumericField];
        const numVal = typeof val === 'number' ? val : 0;
        rawValues[i] = numVal;
        if (numVal < min) min = numVal;
        if (numVal > max) max = numVal;
      }

      // Store the ORIGINAL range for display
      setNumericRange({ min, max });

      // Pass the RAW values directly - let EmbeddingVisualization handle normalization
      setNumericColorData(rawValues);

      console.log(`Extracted ${selectedNumericField}: min=${min}, max=${max}, samples=${rawValues.slice(0, 5)}`);
    } catch (err) {
      console.error('Error extracting numeric field:', err);
      setNumericColorData(null);
      setNumericRange(null);
    }
  }, [mainData, colorMode, selectedNumericField]);

  // Detect available numeric fields from data
  useEffect(() => {
    if (!mainData || mainData.length === 0) {
      setAvailableNumericFields([]);
      return;
    }

    const firstRow = mainData[0];
    // const numericFields = Object.keys(firstRow);
    const numericFields = Object.keys(firstRow).filter(key => {
      const val = firstRow[key];
      return (typeof val === 'number' || (typeof val === 'string' && val.trim() === 'NA'));
    });

    setAvailableNumericFields(numericFields);

    // Set default if score exists
    if (numericFields.includes('score')) {
      setSelectedNumericField('score');
    } else if (numericFields.length > 0) {
      setSelectedNumericField(numericFields[0]);
    }
  }, [mainData]);

  useEffect(() => {
    setIsRunning(true);
    if (!rowsInput || rowsInput.length === 0) return;

    const rows = Array.isArray(rowsInput) ? rowsInput : (rowsInput as any).data ?? [];
    if (rows.length === 0) {
      setLogs(prev => [...prev, `⚠️ rowsInput contained no data rows`]);
      return;
    }

    setMainData(rows);
    processDirectory(directory || '', rows);
  }, [rowsInput]); // ← must watch rowsInput

  const handleProgress = (progress: ProcessingProgress) => {
    if (cancelledRef.current) return;
    startTransition(() => {
      console.log(progress.message)
      setLogs(prev => [...prev, progress.message]);
    });
  };

  const processDirectory = async (dir: string, inlineRows?: any[]) => {
    cancelledRef.current = false;
    const runId = ++runIdRef.current;
    setIsRunning(true);
    setLogs([]);
    setFilteringOn(false);

    if (!analysisServiceRef.current) return;

    // Use inlineRows if provided, otherwise fall back to mainData state
    const rowsToProcess = inlineRows ?? mainData;

    if (rowsToProcess && rowsToProcess.length > 0) {
      setLogs(prev => [
        ...prev,
        `📥 Using provided rows input entries`,
        `📐 Features extracted, running UMAP…`,
      ]);

      try {
        if (!umapProcessorRef.current) throw new Error('UMAP processor not initialised');

        analysisServiceRef.current.setProgressCallback(handleProgress);
        const profile = String(analysisParams.qualityMetric);
        const strict = false;
        const baseCacheKey = makeLocalStorageKey(
          analysisParams.biometricModality,
          dir,
          profile,
          strict
        );
        const paramsKey = stableStringify(analysisParams);
        const cacheKey = `${baseCacheKey}:${paramsKey}`;

        if (!analysisParams.runClustering && dir) {
          const lastKey = await loadLastCacheKey(baseCacheKey);
          if (lastKey && lastKey !== cacheKey) {
            const lastCached = await loadFromLocalStorage(lastKey);
            const lastUmap = rehydrateUmapResult(lastCached?.umapResult);
            if (lastUmap) {
              setXColumn(lastUmap.x);
              setYColumn(lastUmap.y);
              setCategoryColumn(lastUmap.categories);
              setLogs(prev => [...prev, `⚡ Loaded last clustered result from cache`]);
              onProcessingComplete?.({
                csvData: rowsToProcess,
                umapResult: lastUmap,
                params: analysisParams,
                umapCacheKey: lastCached?.umapCacheKey ?? null,
                analysisCacheKey: lastKey
              });
              return;
            }
          }
        }

        const embeddedUmap = analysisServiceRef.current.getEmbeddedUmapFromCsvData(rowsToProcess);
        if (embeddedUmap) {
          let finalUmap = embeddedUmap;
          if (analysisParams.runClustering) {
            const { features } = extractNumericFeatures(
              rowsToProcess,
              (msg) => handleProgress({ stage: 'features', message: msg }),
              {
                excludeLowVariance: analysisParams.excludeLowVariance,
                excludeNonScalar: analysisParams.excludeNonScalar
              }
            );
            if (features?.length) {
              finalUmap = await analysisServiceRef.current.clusterEmbeddedUmap(
                embeddedUmap,
                features,
                analysisParams
              );
            }
          }

          setXColumn(finalUmap.x);
          setYColumn(finalUmap.y);
          setCategoryColumn(finalUmap.categories);
          setLogs(prev => [...prev, `⚡ Found umap_x/umap_y in CSV, skipped UMAP embedding`]);

          if (onProcessingComplete) {
            onProcessingComplete({
              csvData: rowsToProcess,
              umapResult: finalUmap,
              params: analysisParams,
              umapCacheKey: null,
              analysisCacheKey: dir ? cacheKey : null
            });
          }
          if (dir) {
            await saveToLocalStorage(cacheKey, {
              analysis: { csvData: rowsToProcess },
              umapResult: normalizeUmapForCache(finalUmap),
              umapCacheKey: null
            });
            if (analysisParams.runClustering) {
              await saveLastCacheKey(baseCacheKey, cacheKey);
            }
          }
          return;
        }

        const { features, excluded } = extractNumericFeatures(
          rowsToProcess,
          (msg) => handleProgress({ stage: 'features', message: msg }),
          {
            excludeLowVariance: analysisParams.excludeLowVariance,
            excludeNonScalar: analysisParams.excludeNonScalar
          }
        );
        if (cancelledRef.current || runId !== runIdRef.current) return;
        console.log("Feature exclusions (rowsInput):", excluded);
        const { umapResult, cacheKey: umapCacheKey } = await analysisServiceRef.current.umapProcess(
          features,
          analysisParams
        );
        if (cancelledRef.current || runId !== runIdRef.current) return;

        if (umapResult) {
          setXColumn(umapResult.x);
          setYColumn(umapResult.y);
          setCategoryColumn(umapResult.categories);
          setLogs(prev => [...prev, `✅ UMAP processing complete with ${umapResult.x.length} points`]);
        } else {
          setLogs(prev => [...prev, `⚠️ UMAP processing did not return results`]);
          setHasError('UMAP processing did not return results');
        }

        if (onProcessingComplete) {
          onProcessingComplete({
            csvData: rowsToProcess,
            umapResult,
            params: analysisParams,
            umapCacheKey,
            analysisCacheKey: dir ? cacheKey : null
          });
        }
        if (dir) {
          await saveToLocalStorage(cacheKey, {
            analysis: { csvData: rowsToProcess },
            umapResult: normalizeUmapForCache(umapResult),
            umapCacheKey: umapCacheKey ?? null
          });
          if (analysisParams.runClustering || isClusteredKey(umapCacheKey ?? null)) {
            await saveLastCacheKey(baseCacheKey, cacheKey);
          }
        }
      } catch (err: any) {
        if (cancelledRef.current || runId !== runIdRef.current) return;
        setLogs(prev => [...prev, `❌ ${err.message}`]);
        setHasError(err.message)
        console.error(err);
        setIsRunning(false);

      } finally {
        setIsRunning(false);
      }

      return;
    }

    // ── directory path (unchanged below) ─────────────────────────────────────

    try {
      analysisServiceRef.current.setProgressCallback(handleProgress);

      setLogs(prev => [
        ...prev,
        `📊 Analysis Parameters:`,
        `  - Quality Metric: ${analysisParams.qualityMetric}`,
        `  - Modality: ${analysisParams.biometricModality}`,
        `  - HDBSCAN min cluster size: ${analysisParams.dbscanMinPts}`,
        `  - HDBSCAN min samples: ${analysisParams.hdbscanMinSamples}`
      ]);

      const { analysis, umapResult: umapResultWrapper, umapCacheKey, analysisCacheKey } = await analysisServiceRef.current.runAnalysis(
        dir,
        analysisParams
      );
      if (cancelledRef.current || runId !== runIdRef.current) return;
      const umapResult = (umapResultWrapper as any)?.umapResult ?? umapResultWrapper;

      if (analysis.csvData) {
        setMainData(analysis.csvData);
      }

      if (umapResult) {
        setXColumn(umapResult.x);
        setYColumn(umapResult.y);
        setCategoryColumn(umapResult.categories);
      } else {
        setLogs(prev => [...prev, `⚠️ UMAP processing did not return results`]);
        setHasError('UMAP processing did not return results');
      }

        if (onProcessingComplete) {
          onProcessingComplete({
            csvData: analysis.csvData,
            umapResult,
            params: analysisParams,
            umapCacheKey,
            analysisCacheKey
          });
        }

    } catch (err: any) {
      if (cancelledRef.current || runId !== runIdRef.current) return;
      setLogs(prev => [...prev, `❌ ${err.message}`]);
      console.error(err);
      setHasError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run on mount if directory provided
  useEffect(() => {
    if (directory && (!rowsInput || rowsInput.length === 0)) {
      processDirectory(directory);
    }
  }, [directory]);

  // choose palette
  const VIRIDIS_256_MUTABLE: string[] = [...VIRIDIS_PALETTE];

  //console.log(isRunning ? "Processing..." : "Idle", { xColumn, yColumn, categoryColumn, mainData });


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {(isRunning || hasError || opening) && (
        <InfoPanel
          processing={isRunning || opening}
          error_msg={hasError}
          onCancel={(isRunning || isCancelling) ? cancelRun : undefined}
          cancelLabel={isCancelling ? 'Canceling, please wait ...' : 'Cancel'}
          cancelDisabled={isCancelling}
        />
      )}

      {xColumn && yColumn && (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <EmbeddingVisualization
            xColumn={xColumn}
            yColumn={yColumn}
            categoryColumn={colorMode === 'category' ? categoryColumn : null}
            numericColorColumn={colorMode === 'numeric' ? numericColorData : null}
            numericRange={numericRange}
            categoryColors={colorMode === 'category' ? CATEGORY_COLORS : VIRIDIS_256_MUTABLE}
            onHover={setHoverIndex}
            tooltipData={(idx: number) => JSON.stringify(mainData[idx])}
            onSelection={sel => { onSelection!(sel, folderPath!) }}
            onProcessingComplete={onProcessingComplete}
          />

          {/* Color Mode Dropdown */}
          <div style={{
            position: 'absolute',
            bottom: 120,
            left: 20,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '8px 12px',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>
                Color by:
              </label>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as 'category' | 'numeric')}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#222',
                  color: '#fff',
                  fontSize: 12
                }}
              >
                <option value="category">Category</option>
                <option value="numeric">Numeric Field</option>
              </select>
            </div>

            {colorMode === 'numeric' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>
                  Field:
                </label>
                <select
                  value={selectedNumericField}
                  onChange={(e) => setSelectedNumericField(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#222',
                    color: '#fff',
                    fontSize: 12
                  }}
                >
                  {availableNumericFields.map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* <CategoryLegend
            categoryColumn={categoryColumn}
            categoryColors={CATEGORY_COLORS}
            filteringOn={filteringOn}
            onCategoryClick={handleCategoryClick}
            onResetFilters={handleResetFilters}
          /> */}

          {customInfoPanel ? (
            customInfoPanel
          ) : (
            <HoverInfo
              hoverIndex={hoverIndex}
              hoverImageBase64={hoverImageBase64}
            />
          )}
        </div>
      )}

      {/* Render custom log panel if provided, otherwise use default */}
      {customLogPanel !== undefined ? customLogPanel : <LogPanel logs={logs} />}
    </div>
  );
}
