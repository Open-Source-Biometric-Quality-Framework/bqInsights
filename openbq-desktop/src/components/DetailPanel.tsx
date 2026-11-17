import React, { useMemo, useState, useEffect, useRef } from 'react';
import FormattedFieldList from './FormattedFieldList';
import FieldHistogramPanel from './FieldHistogramPanel';
import { useImageLoader } from '../hooks/useImageLoader';
import { getBaseName, toPercent } from '../utils/formatting';
import { callLLM } from '../llms.tsx';
import { getAISettings, refreshAISettings } from './Settings.tsx';
import { getPdfCss } from '../utils/pdfExportStyles';
import { markdownToHtml } from '../utils/markdown/markdownToHtml';

interface DetailPanelProps {
  startProcessing: boolean;
  processingComplete: boolean;
  selectedData: any;
  activeFolder: string;
  aiLabelCacheKey?: string | null;
  clusterSummary?: {
    total: number;
    clusters: { id: number; count: number; percent: number }[];
    outliers: { count: number; percent: number };
  } | null;
  analysisRows?: any[];
  clusterCategories?: Uint8Array | null;
  excludeNonScalar?: boolean;
  oneHotEncode?: boolean;
  fieldConfig?: Record<string, any>;
  profileSettings?: { hidePerfect?: boolean; hideNonScalar?: boolean } | null;
  onProfileSettingsChange?: (settings: { hidePerfect: boolean; hideNonScalar: boolean }) => void;
  canEditInfoJson?: boolean;
  onEditInfoJson?: () => void;
}

/**
 * Right-side detail panel component
 */
export const DetailPanel: React.FC<DetailPanelProps> = ({
  startProcessing,
  processingComplete,
  selectedData,
  activeFolder,
  aiLabelCacheKey = null,
  clusterSummary,
  analysisRows = [],
  clusterCategories = null,
  excludeNonScalar = false,
  oneHotEncode = false,
  fieldConfig = {},
  profileSettings = null,
  onProfileSettingsChange,
  canEditInfoJson = false,
  onEditInfoJson,
}) => {
  const loadImage = useImageLoader(activeFolder);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiResponseHtml, setAiResponseHtml] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Record<number, boolean>>({});
  const [aiExpanded, setAiExpanded] = useState<boolean>(true);
  const [clusterExampleImages, setClusterExampleImages] = useState<Record<number, string[]>>({});
  const [outlierExampleImages, setOutlierExampleImages] = useState<string[]>([]);
  const [clusterLabels, setClusterLabels] = useState<Record<number, string>>({});
  const [labelingClusters, setLabelingClusters] = useState<boolean>(false);
  const [exportBusy, setExportBusy] = useState(false);
  const labelStorageKey = aiLabelCacheKey ? `${aiLabelCacheKey}:clusterLabels` : null;
  const aiSummaryStorageKey = aiLabelCacheKey ? `${aiLabelCacheKey}:aiSummary` : null;
  const lastLoadedLabelKeyRef = useRef<string | null>(null);

  const CATEGORY_COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
    '#a29bfe', '#fd79a8', '#fdcb6e', '#00b894', '#e17055'
  ];
  const OUTLIER_COLOR = '#8a8a8a';

  const nestedItemLabel = (items: any, index: number, data: any) => {
    const source = data[index]?.fields ?? data[index] ?? {};
    const scoreKeys = Object.keys(fieldConfig || {}).filter(
      (key) => fieldConfig?.[key]?.is_score
    );
    const formatScore = (val: any) => {
      const num = typeof val === 'number' ? val : Number(val);
      if (Number.isFinite(num)) {
        return num.toFixed(2);
      }
      return String(val);
    };
    const scoreParts = scoreKeys
      .map((key) => {
        const value = source?.[key];
        if (value === undefined || value === null) return null;
        const label = fieldConfig?.[key]?.label ?? key;
        return `${label}: ${formatScore(value)}`;
      })
      .filter(Boolean)
      .join(' ');
    const fallbackScore =
      source?.unified_quality_score_scalar !== undefined
        ? `Quality Score: ${formatScore(source?.unified_quality_score_scalar)}`
        : '';
    return (
      <span>
        <h2>Record: {getBaseName(data[index].fields.file)}</h2>
        <p />
        {scoreParts || fallbackScore}{' '}
        {toPercent(data[index].fields.face_detection)}
      </span>
    );
  };

  const showContent = startProcessing && processingComplete;
  const showSummary = showContent && (selectedData?.length || 0) === 0;
  const showEmptyState = (selectedData?.length || 0) === 0;

  useEffect(() => {
    if (!labelStorageKey) {
      if (lastLoadedLabelKeyRef.current !== null) {
        setClusterLabels({});
      }
      lastLoadedLabelKeyRef.current = null;
      return;
    }
    if (lastLoadedLabelKeyRef.current === labelStorageKey) return;
    lastLoadedLabelKeyRef.current = labelStorageKey;
    try {
      console.log('[labels] load labelStorageKey', labelStorageKey);
      const raw = localStorage.getItem(labelStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const labels = parsed?.labels ?? parsed;
        if (labels && typeof labels === 'object') {
          console.log('[labels] loaded labels', Object.keys(labels).length);
          setClusterLabels(labels);
          return;
        }
      }
      if (labelStorageKey.includes('_cluster0_')) {
        const clusteredKey = labelStorageKey.replace('_cluster0_', '_cluster1_');
        const clusteredRaw = localStorage.getItem(clusteredKey);
        if (clusteredRaw) {
          const parsed = JSON.parse(clusteredRaw);
          const labels = parsed?.labels ?? parsed;
          if (labels && typeof labels === 'object') {
            console.log('[labels] loaded labels from clustered fallback key', clusteredKey);
            setClusterLabels(labels);
            return;
          }
        }
      }
      console.log('[labels] no cached labels for key');
      setClusterLabels({});
    } catch (err) {
      console.warn('Failed to load cluster label cache', err);
    }
  }, [labelStorageKey]);

  useEffect(() => {
    if (!labelStorageKey) return;
    if (!clusterLabels || Object.keys(clusterLabels).length === 0) return;
    try {
      const payload = {
        timestamp: Date.now(),
        labels: clusterLabels
      };
      localStorage.setItem(labelStorageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save cluster label cache', err);
    }
  }, [labelStorageKey, clusterLabels]);

  useEffect(() => {
    if (!aiSummaryStorageKey) {
      setAiResponse(null);
      setAiResponseHtml(null);
      return;
    }
    try {
      const raw = localStorage.getItem(aiSummaryStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.html) {
          setAiResponseHtml(parsed.html);
          setAiResponse(parsed.markdown ?? null);
        }
      }
    } catch (err) {
      console.warn('Failed to load AI summary cache', err);
    }
  }, [aiSummaryStorageKey]);

  useEffect(() => {
    if (!aiSummaryStorageKey) return;
    if (!aiResponseHtml) return;
    try {
      const payload = {
        timestamp: Date.now(),
        html: aiResponseHtml,
        markdown: aiResponse
      };
      localStorage.setItem(aiSummaryStorageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to save AI summary cache', err);
    }
  }, [aiSummaryStorageKey, aiResponseHtml]);

  const featureRows = useMemo(() => {
    if (!analysisRows || analysisRows.length === 0) return [];

    const rows = analysisRows.map(row => row?.fields ?? row ?? {});
    const hasScalar = rows.some(row =>
      Object.keys(row).some(key => key.includes('_scalar') || key.includes('Scalar'))
    );

    const includeOnlyScalar = excludeNonScalar || hasScalar;

    const categoryFields = new Map<string, Set<string>>();
    if (oneHotEncode) {
      rows.forEach(row => {
        Object.entries(row).forEach(([key, value]) => {
          if (value == null) return;
          if (typeof value === 'number') return;
          const val = String(value);
          if (!categoryFields.has(key)) categoryFields.set(key, new Set());
          const set = categoryFields.get(key)!;
          if (set.size < 50) set.add(val);
        });
      });
      for (const [key, set] of categoryFields.entries()) {
        if (set.size === 0 || set.size > 50) {
          categoryFields.delete(key);
        }
      }
    }

    return rows.map(row => {
      const result: Record<string, number> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (includeOnlyScalar) {
          if (!key.includes('_scalar') && !key.includes('Scalar')) return;
        }
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) return;
        result[key] = num;
      });

      if (oneHotEncode) {
        for (const [key, values] of categoryFields.entries()) {
          const val = row[key];
          if (val == null) continue;
          const asString = String(val);
          if (!values.has(asString)) continue;
          result[`${key}__${asString}`] = 1;
        }
      }

      return result;
    });
  }, [analysisRows, excludeNonScalar, oneHotEncode]);

  const scalarStats = useMemo(() => {
    if (featureRows.length === 0) return null;

    const stats: Record<string, { count: number; sum: number; sumSq: number; min: number; max: number }> = {};

    for (const row of featureRows) {
      for (const [key, value] of Object.entries(row)) {
        if (!Number.isFinite(value)) continue;

        if (!stats[key]) {
          stats[key] = { count: 0, sum: 0, sumSq: 0, min: value, max: value };
        }
        const entry = stats[key];
        entry.count += 1;
        entry.sum += value;
        entry.sumSq += value * value;
        entry.min = Math.min(entry.min, value);
        entry.max = Math.max(entry.max, value);
      }
    }

    const result: Record<string, { mean: number; std: number; min: number; max: number; count: number }> = {};
    for (const [key, entry] of Object.entries(stats)) {
      const mean = entry.count > 0 ? entry.sum / entry.count : 0;
      const variance = entry.count > 0 ? entry.sumSq / entry.count - mean * mean : 0;
      result[key] = {
        mean,
        std: Math.sqrt(Math.max(variance, 0)),
        min: entry.min,
        max: entry.max,
        count: entry.count
      };
    }

    return result;
  }, [featureRows]);

  const clusterDifferences = useMemo(() => {
    if (!clusterCategories || clusterCategories.length === 0 || analysisRows.length === 0) return null;
    const rowCount = Math.min(clusterCategories.length, featureRows.length);

    const overall: Record<string, { count: number; sum: number; sumSq: number }> = {};
    const perCluster: Record<number, Record<string, { count: number; sum: number }>> = {};

    for (let i = 0; i < rowCount; i++) {
      const clusterId = clusterCategories[i];
      if (clusterId === 255) continue;
      const source = featureRows[i] ?? {};

      if (!perCluster[clusterId]) perCluster[clusterId] = {};

      for (const [key, value] of Object.entries(source)) {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) continue;

        if (!overall[key]) overall[key] = { count: 0, sum: 0, sumSq: 0 };
        overall[key].count += 1;
        overall[key].sum += num;
        overall[key].sumSq += num * num;

        if (!perCluster[clusterId][key]) perCluster[clusterId][key] = { count: 0, sum: 0 };
        perCluster[clusterId][key].count += 1;
        perCluster[clusterId][key].sum += num;
      }
    }

    const overallStats: Record<string, { mean: number; std: number }> = {};
    for (const [key, entry] of Object.entries(overall)) {
      const mean = entry.count > 0 ? entry.sum / entry.count : 0;
      const variance = entry.count > 0 ? entry.sumSq / entry.count - mean * mean : 0;
      overallStats[key] = { mean, std: Math.sqrt(Math.max(variance, 0)) };
    }

    const result: Record<number, { key: string; score: number; mean: number; overallMean: number }[]> = {};

    for (const [clusterIdStr, fields] of Object.entries(perCluster)) {
      const clusterId = Number(clusterIdStr);
      const entries: { key: string; score: number; mean: number; overallMean: number }[] = [];

      for (const [key, entry] of Object.entries(fields)) {
        const overallEntry = overallStats[key];
        if (!overallEntry || entry.count === 0) continue;
        const mean = entry.sum / entry.count;
        const diff = mean - overallEntry.mean;
        const denom = overallEntry.std > 0 ? overallEntry.std : 1;
        const score = Math.abs(diff) / denom;
        entries.push({ key, score, mean, overallMean: overallEntry.mean });
      }

      entries.sort((a, b) => b.score - a.score);
      result[clusterId] = entries.slice(0, 4);
    }

    return result;
  }, [clusterCategories, featureRows]);

  useEffect(() => {
    const loadClusterExamples = async () => {
      if (!clusterCategories || clusterCategories.length === 0 || analysisRows.length === 0) {
        setClusterExampleImages({});
        setOutlierExampleImages([]);
        return;
      }

      const rowCount = Math.min(clusterCategories.length, analysisRows.length);
      const filesByCluster = new Map<number, string[]>();
      const outlierFiles: string[] = [];

      for (let i = 0; i < rowCount; i++) {
        const clusterId = clusterCategories[i];
        const source = analysisRows[i]?.fields ?? analysisRows[i] ?? {};
        const file = source?.file;
        if (!file) continue;

        if (clusterId === 255) {
          if (outlierFiles.length < 3) outlierFiles.push(file);
          continue;
        }

        const list = filesByCluster.get(clusterId) ?? [];
        if (list.length < 3) {
          list.push(file);
          filesByCluster.set(clusterId, list);
        }
      }

      const nextImages: Record<number, string[]> = {};
      for (const [clusterId, files] of filesByCluster.entries()) {
        const images: string[] = [];
        for (const file of files) {
          try {
            const base64 = await loadImage({ imageFile: file });
            if (base64) images.push(base64);
          } catch (err) {
            console.error('Error loading cluster example image:', err);
          }
        }
        if (images.length > 0) {
          nextImages[clusterId] = images;
        }
      }

      const outlierImages: string[] = [];
      for (const file of outlierFiles) {
        try {
          const base64 = await loadImage({ imageFile: file });
          if (base64) outlierImages.push(base64);
        } catch (err) {
          console.error('Error loading outlier example image:', err);
        }
      }

      setClusterExampleImages(nextImages);
      setOutlierExampleImages(outlierImages);
    };

    loadClusterExamples();
  }, [clusterCategories, analysisRows, loadImage]);

  useEffect(() => {
    setAiResponse(null);
    setAiResponseHtml(null);
    if (aiSummaryStorageKey) {
      localStorage.removeItem(aiSummaryStorageKey);
    }
  }, [analysisRows, aiSummaryStorageKey]);

  const handleClusterAISummary = async () => {
    if (!clusterSummary || analysisRows.length === 0) return;
    try {
      setLoadingAI(true);
      setAiResponse(null);

      const dataToAnalyze = {
        clusterSummary,
        scalarStats
      };

      const { placeholders, placeholderHints } = buildAiPlaceholders();
      const placeholderText = placeholderHints.length
        ? `You may embed these placeholder image tags in your markdown:\n${placeholderHints.join('\n')}`
        : 'No image placeholders are available.';

      let value = await callLLM(`
      The following are aggregated quality parameters for ${analysisRows.length} biometric images, grouped by cluster:
${JSON.stringify(dataToAnalyze, null, 2)} 
      ---
      Focus on differences between clusters (including outliers). Summarize the major concerns and quality issues that stand out per cluster and across clusters. 
      Provide 2-4 concise sentences.

      Include key recommendations for further investigation of the biometric quality of the dataset based on the identified issues.
      
      Start with "The assessed biometric quality of this dataset is ..." and then provide a concise analysis and recommendations.

      Use markdown and the following format for your response:

      # Summary of biometric quality assessment

      # Key findings by cluster

      1. Findings for Cluster 0
      2. Findings for Cluster 1

      # Outliers

      1. Key observations about outlier samples

      # Recommendations for further investigation

      1. Recommendation 1
      2. Recommendation 2

      ${placeholderText}
      `, getAISettings());

      Object.entries(placeholders).forEach(([key, replacement]) => {
        value = value.split(key).join(replacement);
      });

      value = value.replace(/(\[\[(?:cluster|outlier)_[^\]]+_img\]\])(\s*)/g, '$1');
      value = value.replace(/((?:<img[^>]*>\s*){2,})/g, (_match, imgs) => {
        return `<div style="display:flex;gap:4px;flex-wrap:nowrap;align-items:center;">${imgs}</div>\n\n`;
      });

      setAiResponse(value);
      setAiResponseHtml(markdownToHtml(value));
      window.electron?.showNotification?.('AI Analysis Complete', 'Cluster summary generated successfully.');
    } catch (error) {
      console.error('AI summary failed:', error);
      setAiResponse('Error generating AI summary');
      setAiResponseHtml(null);
    } finally {
      setLoadingAI(false);
    }
  };

  const toggleCluster = (id: number) => {
    setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const clusterColor = (clusterId: number) => {
    if (clusterId < 0) return OUTLIER_COLOR;
    return CATEGORY_COLORS[clusterId % CATEGORY_COLORS.length] ?? OUTLIER_COLOR;
  };

  const clusterByFile = useMemo(() => {
    const map = new Map<string, number>();
    if (!clusterCategories || clusterCategories.length === 0 || analysisRows.length === 0) return map;

    const rowCount = Math.min(clusterCategories.length, analysisRows.length);
    for (let i = 0; i < rowCount; i++) {
      const source = analysisRows[i]?.fields ?? analysisRows[i] ?? {};
      const file = source?.file;
      if (typeof file !== 'string' || file.length === 0) continue;
      const clusterId = clusterCategories[i];
      map.set(file, clusterId);
      map.set(getBaseName(file), clusterId);
    }
    return map;
  }, [analysisRows, clusterCategories]);

  const resolveClusterLabel = (item: any) => {
    const source = item?.fields ?? item ?? {};
    let clusterId: number | null = null;

    const directCandidates = [
      source?.category,
      source?.categories,
      source?.cluster,
      source?.cluster_id,
      source?.clusterId
    ];
    for (const candidate of directCandidates) {
      const num = Number(candidate);
      if (Number.isFinite(num)) {
        clusterId = num < 0 ? 255 : Math.round(num);
        break;
      }
    }

    if (clusterId === null) {
      const file = source?.file;
      if (typeof file === 'string' && file.length > 0) {
        const mapped = clusterByFile.get(file) ?? clusterByFile.get(getBaseName(file));
        if (typeof mapped === 'number') {
          clusterId = mapped;
        }
      }
    }

    if (clusterId === null) return null;
    if (clusterId === 255) return 'Outlier';
    return clusterLabels[clusterId] ? String(clusterLabels[clusterId]) : `Cluster ${clusterId}`;
  };

  const formatDiffLabel = (key: string) => {
    if (key.includes('__')) {
      const [field, value] = key.split('__');
      const base = formatDiffLabel(field);
      return `${base}: ${value}`;
    }
    let label = key.replace(/_scalar\b/g, '').replace(/Scalar\b/g, '');
    label = label.replace(/_/g, ' ');
    label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
    label = label.trim();
    if (label.length > 0) {
      label = label[0].toUpperCase() + label.slice(1);
    }
    if (key.includes('_scalar') || key.includes('Scalar')) {
      label = `${label} %`.trim();
    }
    return label;
  };

  const labelClustersOneByOne = async () => {
    if (!clusterSummary || !clusterDifferences) return;
    try {
      setLabelingClusters(true);
      for (const cluster of clusterSummary.clusters) {
        const diffs = clusterDifferences[cluster.id] ?? [];
        const diffText = diffs
          .map(diff => `${formatDiffLabel(diff.key)}: ${diff.mean.toFixed(2)} vs ${diff.overallMean.toFixed(2)}`)
          .join('\n');

        const prompt = `
Summarize this cluster with a short 6-10 word label.
Only words (no markdown). Use Title Case. No punctuation at the end.
Interpret % metrics as quality scores: low % is bad, high % is good. A low score indicates issues (not a low underlying attribute). 

Cluster size: ${cluster.count} (${cluster.percent.toFixed(1)}%)
Top differences vs overall:
${diffText || 'No differences available'}
`;

        const label = await callLLM(prompt, getAISettings());
        const cleaned = (label ?? '').trim().replace(/[\n\r]+/g, ' ');
        if (cleaned) {
          setClusterLabels(prev => ({ ...prev, [cluster.id]: cleaned }));
        }
      }
      window.electron?.showNotification?.('Cluster Labeling Complete', 'All clusters have been labeled.');
    } catch (error) {
      console.error('Cluster labeling failed:', error);
    } finally {
      setLabelingClusters(false);
    }
  };

  const buildAiPlaceholders = () => {
    const placeholders: Record<string, string> = {};
    const placeholderHints: string[] = [];

    Object.entries(clusterExampleImages).forEach(([clusterId, images]) => {
      images.forEach((img, idx) => {
        const key = `[[cluster_${clusterId}_${idx}_img]]`;
        placeholders[key] = `<img src="${img}" alt="Cluster ${clusterId} example ${idx + 1}" width="48" height="48" style="display:inline-block;margin-right:4px;vertical-align:middle;" />`;
        placeholderHints.push(`${key} = Cluster ${clusterId} example ${idx + 1}`);
      });
    });

    outlierExampleImages.forEach((img, idx) => {
      const key = `[[outlier_${idx}_img]]`;
      placeholders[key] = `<img src="${img}" alt="Outlier example ${idx + 1}" width="48" height="48" style="display:inline-block;margin-right:4px;vertical-align:middle;" />`;
      placeholderHints.push(`${key} = Outlier example ${idx + 1}`);
    });

    return { placeholders, placeholderHints };
  };

const [settings, setSettings] = useState(() => getAISettings());

const handleRefreshStatus = async () => {
  setSettings({ ...(await refreshAISettings()) });
};

useEffect(() => {
  handleRefreshStatus();
}, []);

useEffect(() => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === "openbq.settings.ai") {
      setSettings({ ...getAISettings() });
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);

  const handleExportPdf = async () => {
    if (!aiResponseHtml || !clusterSummary) return;

    setExportBusy(true);
    try {
      const save = await window.electron.report.savePdfDialog({
        defaultPath: `openbq-analysis-${Date.now()}.pdf`,
      });

      if (save.canceled || !save.filePath) return;

      let clustersHtml = '';
      
      for (const cluster of clusterSummary.clusters) {
        const label = clusterLabels[cluster.id] ?? `Cluster ${cluster.id}`;
        const images = clusterExampleImages[cluster.id] || [];
        
        clustersHtml += `
          <div class="cluster-card">
            <div class="cluster-label-heading">${label}</div>
            <div style="color: #6b7280; font-size: 0.9em;">${cluster.count} items (${cluster.percent.toFixed(1)}%)</div>
            ${images.length > 0 ? `
              <div class="cluster-images">
                ${images.map((img, idx) => `<img src="${img}" alt="Cluster ${cluster.id} example ${idx + 1}" class="cluster-example-img" />`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      const outlierImages = outlierExampleImages || [];
      if (outlierImages.length > 0) {
        clustersHtml += `
          <div class="outlier-card">
            <div class="outlier-label">Outliers</div>
            <div style="color: #6b7280; font-size: 0.9em;">${clusterSummary.outliers.count} items (${clusterSummary.outliers.percent.toFixed(1)}%)</div>
            <div class="cluster-images">
              ${outlierImages.map((img, idx) => `<img src="${img}" alt="Outlier example ${idx + 1}" class="cluster-example-img" />`).join('')}
            </div>
          </div>
        `;
      }

      const generatedAt = new Date().toLocaleString();

      const aiCaveat = `<div class="ai-caveat">
        <strong>⚠️ Notice:</strong> This summary was produced with the assistance of AI and may contain inaccuracies, omissions, or misinterpretations. It does not constitute professional advice. All content must be verified against original source material and reviewed by a qualified Subject Matter Expert before use in decision-making, publication, or formal deliverables.
      </div>`;

      const bodyContent = `
          <div class="report-title-block">
            <h1 class="report-main-title">BQInsights EDA Report</h1>
            <div class="report-subtitle">Produced by OpenBQ &middot; ${generatedAt}</div>
          </div>

          <div class="ai-analysis-section">
            <h1>AI Analysis</h1>
            ${aiResponseHtml}
          </div>

          <div class="cluster-labels-section">
            <h1>Cluster Labels</h1>
            ${clustersHtml}
          </div>

          ${aiCaveat}
        `;

      await window.electron.report.convertMarkdownToPdf({
        html: bodyContent,
        outputPath: save.filePath,
        css: getPdfCss(),
        pageOptions: {
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: '<div style="font-size:10px; text-align:center; width:100%; padding-top:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
          marginsType: 0,
          printBackground: true,
        },
      });

      window.electron?.showNotification?.('PDF Exported', `Saved to ${save.filePath}`);
      console.log('PDF exported to:', save.filePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      window.electron?.showNotification?.('PDF Export Failed', msg);
      console.error('PDF export failed:', error);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ contain: "layout size style paint" }}
    >
      {canEditInfoJson && onEditInfoJson && (
        <button
          type="button"
          className="absolute right-3 top-2 z-20 text-[11px] text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
          onClick={onEditInfoJson}
        >
          Edit info.json
        </button>
      )}
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ contain: "layout size style paint" }}
      >
        <div
          className="absolute inset-0"
          style={{ height: "100%", overflowY: "auto" }}
        >
          {showContent && (
            <div>
              <FormattedFieldList
                inputData={selectedData}
                dataKey="fields"
                itemLabel={nestedItemLabel}
                fieldConfig={fieldConfig}
                getItemClusterLabel={(item) => resolveClusterLabel(item)}
                imageFunc={loadImage}
                defaultHidePerfect={profileSettings?.hidePerfect ?? false}
                defaultHideNonScalar={profileSettings?.hideNonScalar ?? false}
                onSettingsChange={(settings) => onProfileSettingsChange?.(settings)}
              />

  <FieldHistogramPanel
    inputData={selectedData}
    dataKey="fields"
    itemLabel={nestedItemLabel}
    fieldConfig={fieldConfig}
    imageFunc={loadImage}
  />
</div>
)}

          {showEmptyState && (
            <div
              className="absolute inset-0 p-4 text-sm text-gray-700 dark:text-gray-300"
              style={{ height: "100%", minHeight: "100%", overflowY: "auto" }}
            >
              {clusterSummary && (
                <div className="space-y-3">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Cluster Summary</div>
                  <div className="rounded-md border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800/70">
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                      onClick={() => setAiExpanded(prev => !prev)}
                    >
                      <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <span className="font-semibold">AI Analysis</span>
                      </div>
                      <span className="text-gray-600 dark:text-gray-300">
                        {aiExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {aiExpanded && (
                      <div className="px-3 pb-3 text-sm text-gray-700 dark:text-gray-500">
                        <div className="mb-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="self-start w-fit inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/80 dark:bg-black/30 text-[12px] font-medium text-black dark:text-gray-100 shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={handleClusterAISummary}
                            disabled={loadingAI || analysisRows.length === 0 || settings.isdefault}
                          >
                            {loadingAI ? 'Analyzing...' : 'AI Summary'}
                          </button>
                           <button
    type="button"
    className="inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    title="Refresh status"
    onClick={handleRefreshStatus}
  >
    ↻
  </button>

                          {settings.pdfExportEnabled && aiResponseHtml && (
                            <button
                              type="button"
                              className="self-start w-fit inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/80 dark:bg-black/30 text-[12px] font-medium text-black dark:text-gray-100 shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={handleExportPdf}
                              disabled={!aiResponseHtml || loadingAI || exportBusy}
                            >
                              {exportBusy ? 'Exporting…' : 'Export PDF'}
                            </button>
                          )}
                        </div>

                        {aiResponse && (
                          <div className="ai-response text-gray-700 dark:text-gray-500">
                            <span className="mr-1" aria-hidden="true">✨</span>
                            <strong>AI Analysis:</strong>
                            <div
                              className="mt-1 prose prose-sm dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: aiResponseHtml ?? aiResponse }}
                            />
                            <br />
                            <strong>⚠️ Notice: This summary was produced with the assistance of AI and may contain inaccuracies, omissions, or misinterpretations. It does not constitute professional advice. All content must be verified against original source material and reviewed by a qualified Subject Matter Expert before use in decision-making, publication, or formal deliverables.</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="self-start w-fit inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/80 dark:bg-black/30 text-[12px] font-medium text-black dark:text-gray-100 shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={labelClustersOneByOne}
                    disabled={labelingClusters || !clusterSummary || settings.isdefault}
                  >
                    {labelingClusters ? 'Labeling Clusters...' : 'AI Label Clusters'}
                  </button>

                  <div className="text-gray-800 dark:text-gray-300">
                    Total points: {clusterSummary.total}
                  </div>
                  <div className="text-gray-800 dark:text-gray-300">
                    Outliers (-1): {clusterSummary.outliers.count} ({clusterSummary.outliers.percent.toFixed(1)}%)
                  </div>
                  <div className="space-y-2">
                    {clusterSummary.clusters.map(cluster => (
                      <div key={cluster.id} className="rounded-md border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800/70">
                        <button
                          className="flex w-full items-center justify-between px-3 py-2 text-left"
                          onClick={() => toggleCluster(cluster.id)}
                        >
                          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ background: clusterColor(cluster.id) }}
                            />
                            <span className="font-semibold">
                              {clusterLabels[cluster.id] ? `${clusterLabels[cluster.id]}` : `Cluster ${cluster.id}`}
                            </span>
                            <span className="text-gray-700 dark:text-gray-200">
                              {cluster.count} ({cluster.percent.toFixed(1)}%)
                            </span>
                          </div>
                          <span className="text-gray-600 dark:text-gray-300">
                            {expandedClusters[cluster.id] ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedClusters[cluster.id] && (
                          <div className="px-3 pb-3 text-xs text-gray-800 dark:text-gray-200">
                            <div className="mb-2 text-gray-600 dark:text-gray-300">
                              Cluster size: {cluster.count}
                            </div>
                            {clusterExampleImages[cluster.id]?.length ? (
                              <div className="mb-2 flex gap-2">
                                {clusterExampleImages[cluster.id].map((img, idx) => (
                                  <img
                                    key={`${cluster.id}-example-${idx}`}
                                    src={img}
                                    alt={`Cluster ${cluster.id} example ${idx + 1}`}
                                    className="h-12 w-12 rounded border border-gray-300 object-cover dark:border-gray-600"
                                  />
                                ))}
                              </div>
                            ) : null}
                            {clusterDifferences?.[cluster.id]?.length ? (
                              <div className="space-y-1">
                                {clusterDifferences[cluster.id].map((diff, idx) => (
                                  <div key={`${cluster.id}-${diff.key}-${idx}`}>
                                    {formatDiffLabel(diff.key)}: {diff.mean.toFixed(2)} vs {diff.overallMean.toFixed(2)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-gray-500 dark:text-gray-400">No differences available.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
            
       
        </div>
      </div>
    </div>
  );
};
