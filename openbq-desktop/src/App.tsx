// React core
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// Third-party libraries
import { Allotment } from "allotment";
import "allotment/dist/style.css";

// Hooks
import { useAppInfo } from './hooks/useAppInfo';
import { useMenuActions } from './hooks/useMenuActions';
import { useFileDropHandler } from './hooks/useFileDropHandler';
import { useSettingsPersistence } from './hooks/useSettingsPersistence';
import { useAISettings } from "./components/Settings";

// Components
import { TopBar } from './components/TopBar';
import { SidePanel } from './components/SidePanel';
import { MainContent } from './components/MainContent';
import { DetailPanel } from './components/DetailPanel';
import { LogPanel } from './components/LogPanel';
import Settings from "./components/Settings";
import Help from './components/Help';

import BuildPptx from "./components/BuildPptx";

import { openDirectory, openDocxAsHtml } from './fileActions';
import { extractNumericFeatures } from './processing/featureExtraction';
import { resolveDatasetProfile, updateProfileSettings, getCachedDatasetProfile } from './services/datasetProfiles';
import { clearCache } from './services/cacheService';

// Types
import type { AnalysisConfig, AnalysisParams, FileStats } from './types';

// Constants
import {
  SETTINGS_KEY,
  DEFAULT_ANALYSIS_PARAMS,
  FILE_LIST_LIMIT,
  SIDEBAR_MIN_SIZE,
  SIDEBAR_MAX_SIZE,
  DETAIL_PANE_PREFERRED_SIZE,
  DETAIL_PANE_MAX_SIZE,
  STATUS_BAR_MIN_SIZE,
  STATUS_BAR_PREFERRED_SIZE,
} from './constants';


/**
 * Main Application Component
 * 
 * This is the root component of the document review tool.
 * It manages the overall application state and coordinates
 * between different UI panels.
 */
export default function DocumentReviewTool() {
  // ========================================
  // State Management
  // ========================================

  // UI State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailPaneOpen, setDetailPaneOpen] = useState(false);

  // Data State
  const [dirStats, setDirStats] = useState<FileStats | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedData, setSelectedData] = useState({});
  const [activeFolder, setActiveFolder] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [openError, setOpenError] = useState<string | null>(null);

  // Processing State
  const [startProcessing, setStartProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [clusterSummary, setClusterSummary] = useState<{
    total: number;
    clusters: { id: number; count: number; percent: number }[];
    outliers: { count: number; percent: number };
  } | null>(null);
  const [analysisRows, setAnalysisRows] = useState<any[]>([]);
  const [clusterCategories, setClusterCategories] = useState<Uint8Array | null>(null);
  const [excludeNonScalar, setExcludeNonScalar] = useState(false);
  const [oneHotEncode, setOneHotEncode] = useState(false);
  const [excludeLowVariance, setExcludeLowVariance] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<Record<string, any>>({});
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{ profile_id: string } | null>(null);
  const [currentProfileSource, setCurrentProfileSource] = useState<'default' | 'user'>('default');
  const [profileSettings, setProfileSettings] = useState<any>(null);

  // Analysis Configuration
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>(
    DEFAULT_ANALYSIS_PARAMS
  );

  // Settings
  const { settings, setSettings } = useAISettings();
  const { reportType, setReportType } = useSettingsPersistence(SETTINGS_KEY);

  const [rowsInput, setRowsInput] = useState<any[]>([]); // state to hold the rows data for processing
  const [analysisKey, setAnalysisKey] = useState(0);
  const [umapCacheKey, setUmapCacheKey] = useState<string | null>(null);
  const [analysisCacheKey, setAnalysisCacheKey] = useState<string | null>(null);
  const umapCacheKeyRef = useRef<string | null>(null);
  const analysisCacheKeyRef = useRef<string | null>(null);
  const activeFolderRef = useRef("");
  const analysisParamsRef = useRef<AnalysisParams>(DEFAULT_ANALYSIS_PARAMS);

  useEffect(() => { umapCacheKeyRef.current = umapCacheKey; }, [umapCacheKey]);
  useEffect(() => { analysisCacheKeyRef.current = analysisCacheKey; }, [analysisCacheKey]);
  useEffect(() => { activeFolderRef.current = activeFolder; }, [activeFolder]);
  useEffect(() => { analysisParamsRef.current = analysisParams; }, [analysisParams]);
  const [opening, setOpening] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const openTokenRef = useRef(0);
  const openCancelledRef = useRef(false);
  const umapKeyRequestRef = useRef(0);
  const [recentItems, setRecentItems] = useState<
    { type: 'file' | 'directory'; path: string }[]
  >([]);
  const [currentInfoJsonPath, setCurrentInfoJsonPath] = useState<string | null>(null);
  const [activeInfoData, setActiveInfoData] = useState<Record<string, any> | null>(null);
  const [infoEditorOpen, setInfoEditorOpen] = useState(false);
  const [infoEditorPath, setInfoEditorPath] = useState<string | null>(null);
  const [infoEditorText, setInfoEditorText] = useState('');
  const [infoEditorError, setInfoEditorError] = useState<string | null>(null);
  const [infoEditorSourceJson, setInfoEditorSourceJson] = useState<Record<string, any> | null>(null);
  const [infoEditorSearch, setInfoEditorSearch] = useState('');
  const [infoEditorActiveMatchIndex, setInfoEditorActiveMatchIndex] = useState<number>(-1);
  const [infoEditorSelectedTopKey, setInfoEditorSelectedTopKey] = useState('');
  const infoEditorHighlightRef = useRef<HTMLPreElement | null>(null);
  const infoEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isClusteredUmapKey = useCallback((key: string | null | undefined) => {
    return typeof key === 'string' && key.includes('_cluster1_');
  }, []);
  const normalizeClusterMethod = useCallback((method: unknown): AnalysisParams['clusterMethod'] => {
    return method === 'jsdbscan' ? 'jsdbscan' : 'umap';
  }, []);

  const highlightedInfoEditorHtml = useMemo(() => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const escaped = escapeHtml(infoEditorText);
    const tokenized = escaped.replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
      (match) => {
        let color = '#1f2937';
        if (/^"/.test(match)) {
          color = /:$/.test(match) ? '#1d4ed8' : '#92400e';
        } else if (/true|false/.test(match)) {
          color = '#0369a1';
        } else if (/null/.test(match)) {
          color = '#7e22ce';
        } else {
          color = '#166534';
        }
        return `<span style="color:${color}">${match}</span>`;
      }
    );
    return tokenized || '&nbsp;';
  }, [infoEditorText]);

  const infoEditorMatches = useMemo(() => {
    const query = infoEditorSearch.trim().toLowerCase();
    if (!query) return [] as Array<{ start: number; end: number }>;
    const haystack = infoEditorText.toLowerCase();
    const matches: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    while (cursor < haystack.length) {
      const start = haystack.indexOf(query, cursor);
      if (start === -1) break;
      matches.push({ start, end: start + query.length });
      cursor = start + Math.max(1, query.length);
    }
    return matches;
  }, [infoEditorSearch, infoEditorText]);

  const infoEditorGroupedTopLevelKeys = useMemo(() => {
    try {
      const parsed = JSON.parse(infoEditorText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return [] as Array<{ group: string; keys: string[] }>;
      }

      const groups = new Map<string, string[]>();
      for (const key of Object.keys(parsed)) {
        const item = (parsed as Record<string, any>)[key];
        const groupName =
          item && typeof item === 'object' && typeof item.group === 'string' && item.group.trim().length > 0
            ? item.group.trim()
            : 'Ungrouped';
        const list = groups.get(groupName) ?? [];
        list.push(key);
        groups.set(groupName, list);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => {
          if (a === 'Ungrouped' && b !== 'Ungrouped') return 1;
          if (b === 'Ungrouped' && a !== 'Ungrouped') return -1;
          return a.localeCompare(b);
        })
        .map(([group, keys]) => ({
          group,
          keys: [...keys].sort((a, b) => a.localeCompare(b))
        }));
    } catch {
      return [] as Array<{ group: string; keys: string[] }>;
    }
  }, [infoEditorText]);

  const applyInfoToViewState = useCallback((info: any) => {
    if (!info || typeof info !== 'object') return;

    setActiveInfoData(info);

    if (info.analysisParams && typeof info.analysisParams === 'object') {
      setAnalysisParams({
        ...DEFAULT_ANALYSIS_PARAMS,
        ...info.analysisParams,
        clusterMethod: normalizeClusterMethod(info.analysisParams.clusterMethod),
        runClustering: false
      });
      if (typeof info.analysisParams.excludeNonScalar === 'boolean') {
        setExcludeNonScalar(info.analysisParams.excludeNonScalar);
      }
      if (typeof info.analysisParams.excludeLowVariance === 'boolean') {
        setExcludeLowVariance(info.analysisParams.excludeLowVariance);
      }
    }

    if (typeof info.umapCacheKey === 'string') {
      setUmapCacheKey((prev) => {
        if (isClusteredUmapKey(prev) && !isClusteredUmapKey(info.umapCacheKey)) {
          return prev;
        }
        return info.umapCacheKey;
      });
    }

    if (typeof info.analysisCacheKey === 'string') {
      setAnalysisCacheKey(info.analysisCacheKey);
    } else if (info.analysisCacheKey === null) {
      setAnalysisCacheKey(null);
    }

    if (info.clusterSummary && typeof info.clusterSummary === 'object') {
      setClusterSummary(info.clusterSummary);
    }

    if (info.fieldConfig && typeof info.fieldConfig === 'object') {
      setFieldConfig(info.fieldConfig);
    }
    if (info.profileSettings && typeof info.profileSettings === 'object') {
      setProfileSettings(info.profileSettings);
      setOneHotEncode(Boolean(info.profileSettings.oneHotEncode));
    }
    if (info.currentProfile && typeof info.currentProfile === 'object' && typeof info.currentProfile.profile_id === 'string') {
      setCurrentProfile({ profile_id: info.currentProfile.profile_id });
    }
    if (info.currentProfileSource === 'default' || info.currentProfileSource === 'user') {
      setCurrentProfileSource(info.currentProfileSource);
    }
  }, [isClusteredUmapKey, normalizeClusterMethod]);


  // ========================================
  // Custom Hooks
  // ========================================

  const appInfo = useAppInfo();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('openbq.recent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentItems(
            parsed.filter(
              (item) =>
                item &&
                (item.type === 'file' || item.type === 'directory') &&
                typeof item.path === 'string'
            )
          );
        }
      }
    } catch (err) {
      console.warn('Failed to load recent list', err);
    }
  }, []);

  const addRecentItem = useCallback((item: { type: 'file' | 'directory'; path: string }) => {
    setRecentItems((prev) => {
      const next = [
        item,
        ...prev.filter((x) => x.path !== item.path || x.type !== item.type),
      ].slice(0, 8);
      try {
        localStorage.setItem('openbq.recent', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to persist recent list', err);
      }
      return next;
    });
  }, []);

  const removeRecentItem = useCallback((item: { type: 'file' | 'directory'; path: string }) => {
    setRecentItems((prev) => {
      const next = prev.filter((x) => x.path !== item.path || x.type !== item.type);
      try {
        localStorage.setItem('openbq.recent', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to persist recent list', err);
      }
      return next;
    });
  }, []);

  // ========================================
  // Event Handlers
  // ========================================

  /**
   * Reset all processing-related state
   */
  const resetParams = useCallback(() => {
    setDetailPaneOpen(false);
    setProcessingComplete(false);
    setSettingsOpen(false);
    setReportType("review");
    setSelectedData({});
    setRowsInput([]);
    setDirStats(null);
    setOpenError(null);
    setUmapCacheKey(null);
    setAnalysisCacheKey(null);
    setCurrentInfoJsonPath(null);
    setActiveInfoData(null);
  }, [setReportType]);

  const handleCloseAnalysis = useCallback(() => {
    const uk = umapCacheKeyRef.current;
    const ak = analysisCacheKeyRef.current;
    if (uk) {
      clearCache(uk).catch(() => {});
      localStorage.removeItem(`${uk}:clusterLabels`);
      localStorage.removeItem(`${uk}:aiSummary`);
    }
    if (ak && ak !== uk) {
      clearCache(ak).catch(() => {});
    }

    const folder = activeFolderRef.current;
    const params = analysisParamsRef.current;
    if (folder && params && window.electron?.openbq?.clearCache) {
      window.electron.openbq.clearCache(
        params.biometricModality || 'iris',
        folder,
        folder,
        params.qualityMetric || 'biqt'
      ).catch(() => {});
    }

    setDetailPaneOpen(false);
    setProcessingComplete(false);
    setStartProcessing(false);
    setOpening(false);
    setSettingsOpen(false);
    setReportType("review");
    setSelectedData({});
    setRowsInput([]);
    setDirStats(null);
    setSelectedPath("");
    setActiveFolder("");
    setClusterSummary(null);
    setUmapCacheKey(null);
    setAnalysisCacheKey(null);
    setClusterCategories(null);
    setAnalysisRows([]);
    setExcludeNonScalar(false);
    setOneHotEncode(false);
    setExcludeLowVariance(false);
    setFieldConfig({});
    setProfileNotice(null);
    setCurrentProfile(null);
    setProfileSettings(null);
    setAnalysisParams(DEFAULT_ANALYSIS_PARAMS);
    setAnalysisKey(k => k + 1);
    setLogs([]);
    setOpenError(null);
    setCurrentInfoJsonPath(null);
    setActiveInfoData(null);
    setInfoEditorOpen(false);
    setInfoEditorPath(null);
    setInfoEditorText('');
    setInfoEditorError(null);
    setInfoEditorSourceJson(null);
    setInfoEditorSearch('');
    setInfoEditorActiveMatchIndex(-1);
  }, [setReportType]);

  /**
   * Handle file open action
   */
  const handleOpenError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to open file:", err);
    setOpenError(message || "Failed to open file.");
    setOpening(false);
    window.electron?.showNotification?.("Open file failed", message || "Failed to open file.");
  }, []);

  const handleOpenStartFile = useCallback(() => {
    const token = ++openTokenRef.current;
    openCancelledRef.current = false;
    setOpening(true);
    setStartProcessing(true);
    setProcessingComplete(false);
    setOpenError(null);
    return token;
  }, []);
  const handleOpenFinish = useCallback((opened: boolean, token?: number) => {
    if (token && token !== openTokenRef.current) return;
    if (!opened) {
      setOpening(false);
      setStartProcessing(false);
    }
  }, []);

  const handleCancel = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.style.cursor = 'wait';
    }
    setIsCancelling(true);
    openCancelledRef.current = true;
    openTokenRef.current += 1;
    setOpening(false);
    handleCloseAnalysis();
  }, [handleCloseAnalysis]);

  useEffect(() => {
    if (!isCancelling) {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = '';
      }
      return;
    }
    if (!startProcessing && !opening) {
      const timer = setTimeout(() => {
        setIsCancelling(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isCancelling, startProcessing, opening]);

  const handleOpen = useCallback(({ content, filePath }: { content: any[] | string; filePath: string }, token?: number) => {
    if (token && token !== openTokenRef.current) return;
    if (openCancelledRef.current) return;
    resetParams();
    console.log("*** File opened:", filePath);
    //console.log("*** Content preview:", content.slice(0,300)) //JSON.parse(content)[0]['rows'].slice(0, 5));
    //console.log(content);
    //setRowsInput(content);
    if (!Array.isArray(content)) {
      handleOpenError(new Error("Invalid file content: expected tabular rows."));
      return;
    }
    // detect if content has no "file" column in header - if not then add one from another row "guid"
    let rows = content;
    if (content.length > 0 && !content[0].hasOwnProperty("file")) {
      rows = content.map((row) => ({
        ...row,
        file: row.PhotoGuid || "unknown"
      }));
    }
    setRowsInput(rows);
    setOpening(false);
    // Always start file-open processing from defaults so default cache can be hit immediately.
    setAnalysisParams(DEFAULT_ANALYSIS_PARAMS);
    if (filePath) {
      setSelectedPath(filePath);
      addRecentItem({ type: 'file', path: filePath });
      const folder = filePath.replace(/[/\\][^/\\]+$/, '');
      setActiveFolder(folder);
      if (filePath.toLowerCase().endsWith('.csv') && window.electron?.fs?.readFile) {
        const fileName = filePath.split(/[/\\]/).pop() ?? '';
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const sidecarCandidates = [
          `${folder}/info.json`,
          `${folder}/${baseName}.json`
        ];
        setCurrentInfoJsonPath(sidecarCandidates[0]);
        setActiveInfoData(null);
        (async () => {
          let loadedFromSidecar = false;
          for (const candidate of sidecarCandidates) {
            try {
              const res = await window.electron?.fs?.readFile?.(candidate);
              if (!res?.success || !res.content) continue;
              const parsed = JSON.parse(res.content);
              if (!parsed || typeof parsed !== 'object') continue;
              setCurrentInfoJsonPath(candidate);
              applyInfoToViewState(parsed);
              loadedFromSidecar = true;
              break;
            } catch {
              // Try next candidate.
            }
          }

          if (loadedFromSidecar) return;

          try {
            const cachedProfile = await getCachedDatasetProfile(rows);
            if (!cachedProfile) return;
            applyInfoToViewState({
              fieldConfig: cachedProfile.profile.fields ?? {},
              profileSettings: cachedProfile.profile.settings ?? null,
              currentProfile: { profile_id: cachedProfile.profile.profile_id },
              currentProfileSource: cachedProfile.source
            });
          } catch (err) {
            console.warn('Failed to load cached profile fallback for missing info.json', err);
          }
        })();
      }
    }

    console.log("rowsInput set, opening detail pane");
    setAnalysisKey(k => k + 1);
    setStartProcessing(true);
    setProcessingComplete(false);

    setDetailPaneOpen(true);
  }, [resetParams, handleOpenError, applyInfoToViewState]);

  /**
   * Handle PDF print/export action
   */
  const handlePrint = useCallback(async () => {
    if (!window.electron) return;

    console.log("printing now");
    const result = await window.electron.report.savePdfDialog();

    if (result.canceled || !result.filePath) {
      console.log("User canceled save dialog");
      return;
    }

    console.log("Selected file path:", result.filePath);

    await window.electron.report.convertMarkdownToPdf({
      markdownFiles: "test.md",
      outputPath: result.filePath,
    });

    console.log("PDF saved to:", result.filePath);
    window.electron.showNotification(
      "Generating PDF",
      "Your PDF completed at " + result.filePath
    );
  }, []);

  /**
   * Handle help menu action
   */
  const handleHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);

  const handleExportBundle = useCallback(async () => {
    if (!window.electron?.bundle?.exportAnalysisBundle) return;

    const csvRows =
      Array.isArray(analysisRows) && analysisRows.length > 0
        ? analysisRows
        : Array.isArray(rowsInput)
          ? rowsInput
          : [];

    if (!csvRows.length) {
      window.electron?.showNotification?.(
        "Export Bundle",
        "No analysis data is loaded to export."
      );
      return;
    }

    const info = {
      exportedAt: new Date().toISOString(),
      appVersion: appInfo?.version ?? null,
      selectedPath,
      activeFolder,
      analysisParams,
      clusterSummary,
      umapCacheKey,
      analysisCacheKey,
      fieldConfig,
      currentProfile,
      currentProfileSource,
      profileSettings,
      recentItems
    };

    const result = await window.electron.bundle.exportAnalysisBundle({
      csvData: csvRows,
      info,
      activeCache: {
        analysisCacheKey,
        umapCacheKey
      }
    });

    if (result?.success && result.filePath) {
      const analysisCount = result.metadata?.analysisCacheFiles ?? 0;
      const umapCount = result.metadata?.umapCacheFiles ?? 0;
      window.electron?.showNotification?.(
        "Export Bundle",
        `Saved bundle with ${analysisCount + umapCount} cached metadata files.`
      );
      return;
    }

    if (!result?.canceled) {
      window.electron?.showNotification?.(
        "Export Bundle Failed",
        result?.error ?? "Unable to export bundle."
      );
    }
  }, [
    activeFolder,
    analysisParams,
    analysisRows,
    appInfo?.version,
    clusterSummary,
    currentProfile,
    currentProfileSource,
    fieldConfig,
    profileSettings,
    recentItems,
    rowsInput,
    selectedPath,
    umapCacheKey,
    analysisCacheKey
  ]);

  const handleImportBundle = useCallback(async () => {
    if (!window.electron?.bundle?.importAnalysisBundle) return;

    const result = await window.electron.bundle.importAnalysisBundle();
    if (!result?.success) {
      if (!result?.canceled) {
        window.electron?.showNotification?.(
          "Import Bundle Failed",
          result?.error ?? "Unable to import bundle."
        );
      }
      return;
    }

    if (!Array.isArray(result.csvData) || !result.csvData.length) {
      window.electron?.showNotification?.(
        "Import Bundle",
        "The imported bundle did not include CSV rows."
      );
      return;
    }

    handleOpen(
      { content: result.csvData, filePath: result.importedCsvPath ?? result.bundlePath ?? "imported-bundle.zip" },
      undefined
    );
    if (typeof result.importedInfoPath === 'string') {
      setCurrentInfoJsonPath(result.importedInfoPath);
    }

    const importedInfo = result.info ?? {};
    applyInfoToViewState(importedInfo);

    window.electron?.showNotification?.(
      "Import Bundle",
      `Imported CSV and restored ${result.restoredMetadataFiles ?? 0} cached metadata files.`
    );
  }, [handleOpen, applyInfoToViewState]);

  const handleEditInfoJson = useCallback(async () => {
    if (!currentInfoJsonPath) {
      window.electron?.showNotification?.("Edit info.json", "No active info.json path for this dataset.");
      return;
    }

    const toFieldConfigText = (payload: any) => {
      const fieldConfig =
        payload && typeof payload === 'object' && payload.fieldConfig && typeof payload.fieldConfig === 'object' && !Array.isArray(payload.fieldConfig)
          ? payload.fieldConfig
          : {};
      return `${JSON.stringify(fieldConfig, null, 2)}\n`;
    };

    const buildFallbackSource = () => {
      if (activeInfoData && typeof activeInfoData === 'object' && !Array.isArray(activeInfoData)) {
        return activeInfoData;
      }
      return {
        analysisParams,
        clusterSummary,
        umapCacheKey,
        analysisCacheKey,
        fieldConfig: fieldConfig && typeof fieldConfig === 'object' ? fieldConfig : {},
        currentProfile,
        currentProfileSource,
        profileSettings
      };
    };

    try {
      const res = await window.electron?.fs?.readFile?.(currentInfoJsonPath);
      if (res?.success && typeof res.content === 'string') {
        try {
          const parsed = JSON.parse(res.content);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setInfoEditorSourceJson(parsed);
            setInfoEditorText(toFieldConfigText(parsed));
          } else {
            setInfoEditorSourceJson({});
            setInfoEditorText('{\n}\n');
          }
        } catch {
          const fallbackSource = buildFallbackSource();
          setInfoEditorSourceJson(fallbackSource);
          setInfoEditorText(toFieldConfigText(fallbackSource));
        }
      } else {
        const fallbackSource = buildFallbackSource();
        setInfoEditorSourceJson(fallbackSource);
        setInfoEditorText(toFieldConfigText(fallbackSource));
      }
      setInfoEditorPath(currentInfoJsonPath);
      setInfoEditorError(null);
      setInfoEditorSearch('');
      setInfoEditorActiveMatchIndex(-1);
      setInfoEditorSelectedTopKey('');
      setInfoEditorOpen(true);
    } catch {
      const fallbackSource = buildFallbackSource();
      setInfoEditorSourceJson(fallbackSource);
      setInfoEditorText(toFieldConfigText(fallbackSource));
      setInfoEditorPath(currentInfoJsonPath);
      setInfoEditorError(null);
      setInfoEditorSearch('');
      setInfoEditorActiveMatchIndex(-1);
      setInfoEditorSelectedTopKey('');
      setInfoEditorOpen(true);
    }
  }, [
    currentInfoJsonPath,
    activeInfoData,
    analysisParams,
    clusterSummary,
    umapCacheKey,
    analysisCacheKey,
    fieldConfig,
    currentProfile,
    currentProfileSource,
    profileSettings
  ]);

  const selectInfoEditorMatch = useCallback((index: number) => {
    const textarea = infoEditorTextareaRef.current;
    const match = infoEditorMatches[index];
    if (!textarea || !match) return;
    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);
    setInfoEditorActiveMatchIndex(index);
    const before = infoEditorText.slice(0, match.start);
    const line = before.split('\n').length - 1;
    const lineHeight = 20; // matches `leading-5`
    const targetTop = Math.max(0, (line - 2) * lineHeight);
    textarea.scrollTop = targetTop;
    if (infoEditorHighlightRef.current) {
      infoEditorHighlightRef.current.scrollTop = targetTop;
      infoEditorHighlightRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, [infoEditorMatches, infoEditorText]);

  const jumpToInfoEditorRange = useCallback((start: number, end: number) => {
    const textarea = infoEditorTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const before = infoEditorText.slice(0, start);
    const line = before.split('\n').length - 1;
    const lineHeight = 20; // matches `leading-5`
    const targetTop = Math.max(0, (line - 2) * lineHeight);
    textarea.scrollTop = targetTop;
    if (infoEditorHighlightRef.current) {
      infoEditorHighlightRef.current.scrollTop = targetTop;
      infoEditorHighlightRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, [infoEditorText]);

  const handleInfoEditorSearchNext = useCallback(() => {
    if (infoEditorMatches.length === 0) return;
    const textarea = infoEditorTextareaRef.current;
    if (!textarea) return;
    const currentEnd = textarea.selectionEnd;
    const nextIndex = infoEditorMatches.findIndex((m) => m.start >= currentEnd);
    selectInfoEditorMatch(nextIndex >= 0 ? nextIndex : 0);
  }, [infoEditorMatches, selectInfoEditorMatch]);

  const handleInfoEditorSearchPrev = useCallback(() => {
    if (infoEditorMatches.length === 0) return;
    const textarea = infoEditorTextareaRef.current;
    if (!textarea) return;
    const currentStart = textarea.selectionStart;
    let prevIndex = -1;
    for (let i = 0; i < infoEditorMatches.length; i++) {
      if (infoEditorMatches[i].start < currentStart) {
        prevIndex = i;
      } else {
        break;
      }
    }
    selectInfoEditorMatch(prevIndex >= 0 ? prevIndex : infoEditorMatches.length - 1);
  }, [infoEditorMatches, selectInfoEditorMatch]);

  const handleInfoEditorTopKeyChange = useCallback((key: string) => {
    setInfoEditorSelectedTopKey(key);
    if (!key) return;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\n)\\s*"(?:${escapedKey})"\\s*:`, 'm');
    const found = regex.exec(infoEditorText);
    if (!found) return;
    const keyToken = `"${key}"`;
    const start = infoEditorText.indexOf(keyToken, found.index);
    if (start === -1) return;
    jumpToInfoEditorRange(start, start + keyToken.length);
  }, [infoEditorText, jumpToInfoEditorRange]);

  useEffect(() => {
    if (infoEditorMatches.length === 0) {
      setInfoEditorActiveMatchIndex(-1);
      return;
    }
    setInfoEditorActiveMatchIndex((prev) => {
      if (prev >= 0 && prev < infoEditorMatches.length) return prev;
      return 0;
    });
  }, [infoEditorMatches]);

  const handleSaveInfoJson = useCallback(async () => {
    if (!infoEditorPath) return;

    let parsedFieldConfig: any;
    try {
      parsedFieldConfig = JSON.parse(infoEditorText);
      if (!parsedFieldConfig || typeof parsedFieldConfig !== 'object' || Array.isArray(parsedFieldConfig)) {
        setInfoEditorError('fieldConfig must be a JSON object.');
        return;
      }
    } catch (err: any) {
      setInfoEditorError(`Invalid JSON: ${err?.message ?? String(err)}`);
      return;
    }

    try {
      const source =
        infoEditorSourceJson && typeof infoEditorSourceJson === 'object' && !Array.isArray(infoEditorSourceJson)
          ? infoEditorSourceJson
          : {};
      const nextInfoJson = {
        ...source,
        fieldConfig: parsedFieldConfig
      };
      const write = await window.electron?.fs?.writeFileAbsolute?.(
        infoEditorPath,
        `${JSON.stringify(nextInfoJson, null, 2)}\n`
      );
      if (!write?.success) {
        setInfoEditorError(write?.error ?? 'Failed to save info.json');
        return;
      }
      setInfoEditorError(null);
      setInfoEditorOpen(false);
      setCurrentInfoJsonPath(infoEditorPath);

      setInfoEditorSourceJson(nextInfoJson);
      applyInfoToViewState(nextInfoJson);
      if (rowsInput.length > 0) {
        setSelectedData([]);
        setAnalysisKey(k => k + 1);
        setStartProcessing(true);
        setProcessingComplete(false);
      }

      window.electron?.showNotification?.("Edit info.json", "Saved info.json");
    } catch (err: any) {
      setInfoEditorError(err?.message ?? String(err));
    }
  }, [infoEditorPath, infoEditorText, infoEditorSourceJson, rowsInput.length, applyInfoToViewState]);

  /**
   * Handle directory selection
   */
  const handleOpenDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath || !window.electron) return;

    console.log("DIR PATH", dirPath);
    resetParams();
    const token = ++openTokenRef.current;
    openCancelledRef.current = false;
    setOpening(true);
    setSelectedPath(dirPath);

    const files = await window.electron.fs.listFiles(dirPath, FILE_LIST_LIMIT);
    //console.log(files);
    if (token !== openTokenRef.current || openCancelledRef.current) {
      return;
    }

    setDirStats(files);
    addRecentItem({ type: 'directory', path: dirPath });
    setActiveFolder(dirPath);
    const directoryInfoPath = `${dirPath}/info.json`;
    setCurrentInfoJsonPath(directoryInfoPath);
    setActiveInfoData(null);
    setSelectedData([]);
    setClusterSummary(null);
    setUmapCacheKey(null);
    setAnalysisCacheKey(null);
    setClusterCategories(null);
    setAnalysisRows([]);
    setExcludeNonScalar(false);
    setOneHotEncode(false);
    setExcludeLowVariance(false);
    setFieldConfig({});
    setProfileNotice(null);
    setCurrentProfile(null);
    setProfileSettings(null);
    setOpening(false);

    try {
      const res = await window.electron?.fs?.readFile?.(directoryInfoPath);
      if (res?.success && typeof res.content === 'string') {
        const parsed = JSON.parse(res.content);
        if (parsed && typeof parsed === 'object') {
          applyInfoToViewState(parsed);
        }
      }
    } catch {
      // Directory may not have an info.json yet; editor can create it on save.
    }
  }, [resetParams, applyInfoToViewState]);

  const handleOpenRecent = useCallback(async (item: { type: 'file' | 'directory'; path: string }) => {
    if (item.type === 'directory') {
      await handleOpenDirectory(item.path);
      return;
    }

    try {
      const token = handleOpenStartFile();
      const file = await openDocxAsHtml(item.path);
      if (file) {
        handleOpen(file, token);
      } else {
        handleOpenFinish(false, token);
      }
    } catch (err) {
      handleOpenFinish(false);
      handleOpenError(err);
    }
  }, [handleOpenDirectory, handleOpen, handleOpenError, handleOpenStartFile, handleOpenFinish]);

  /**
   * Handle start of analysis
   */
  const handleStartAnalysis = useCallback((config: AnalysisConfig) => {
    setAnalysisParams({
      qualityMetric: config.algorithm,
      biometricModality: config.modality,
      dbscanMinPts: config.dbscanMinPts,
      hdbscanMinSamples: config.hdbscanMinSamples,
      useDbscan: config.useDbscan,
      dbscanEpsKNN: config.dbscanEpsKNN,
      pcaMinPts: 5,
      pcaMaxComponents: 10,
      pcaSweepIterations: 5,
      superclusterMinPoints: 2,
      superclusterRadius: 40,
      superclusterMinZoom: 0,
      superclusterMaxZoom: 16,
      umapNNeighbors: config.umapNNeighbors,
      umapMinDist: config.umapMinDist,
      clusterMethod: 'jsdbscan',
      excludeLowVariance,
      excludeNonScalar,
      runClustering: false
    });
    setSelectedData([]);
    setClusterSummary(null);
    setUmapCacheKey(null);
    setAnalysisCacheKey(null);
    setClusterCategories(null);
    setAnalysisRows([]);
    setFieldConfig({});
    setProfileNotice(null);
    setCurrentProfile(null);
    setProfileSettings(null);
    setStartProcessing(true);
  }, []);

  /**
   * Handle log updates from processing
   */
  const handleLogUpdate = useCallback((newLogs: string[]) => {
    if (JSON.stringify(newLogs) !== JSON.stringify(logs)) {
      setLogs(newLogs);
    }
  }, [logs]);

  /**
   * Handle data selection from analysis
   */
  const handleSelection = useCallback((sel: any, folder: string) => {
    console.log("Outer Folder:", folder);
    setActiveFolder(folder);
    setSelectedData(sel);
  }, []);

  /**
   * Handle processing completion
   */
  const handleProcessingComplete = useCallback((data?: any) => {
    setProcessingComplete(true);
    if (data?.csvData && Array.isArray(data.csvData)) {
      setAnalysisRows(data.csvData);
    }
    if (typeof data?.umapCacheKey === 'string') {
      console.log('[labels] received umapCacheKey', data.umapCacheKey);
      setUmapCacheKey((prev) => {
        if (isClusteredUmapKey(prev) && !isClusteredUmapKey(data.umapCacheKey)) {
          console.log('[labels] keeping existing clustered key', prev);
          return prev;
        }
        return data.umapCacheKey;
      });
    }
    if (typeof data?.analysisCacheKey === 'string') {
      setAnalysisCacheKey(data.analysisCacheKey);
    } else if (data?.analysisCacheKey === null) {
      setAnalysisCacheKey(null);
    }

    const categories: Uint8Array | undefined =
      data?.umapResult?.categories ?? data?.categories;
    if (categories && categories.length > 0) {
      const counts = new Map<number, number>();
      let outliers = 0;

      for (let i = 0; i < categories.length; i++) {
        const value = categories[i];
        if (value === 255) {
          outliers++;
          continue;
        }
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      const total = categories.length;
      const clusters = Array.from(counts.entries())
        .map(([id, count]) => ({
          id,
          count,
          percent: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      setClusterSummary({
        total,
        clusters,
        outliers: {
          count: outliers,
          percent: total > 0 ? (outliers / total) * 100 : 0
        }
      });
      setClusterCategories(categories);
    }

    if (!data?.umapCacheKey && data?.csvData && Array.isArray(data.csvData)) {
      const requestId = ++umapKeyRequestRef.current;
      (async () => {
        try {
          const { features } = extractNumericFeatures(
            data.csvData,
            () => undefined,
            {
              excludeLowVariance: analysisParams.excludeLowVariance,
              excludeNonScalar: analysisParams.excludeNonScalar
            }
          );
          if (!features?.length) return;
          let derivedKey: string | null = null;
          if (!analysisParams.runClustering) {
            const clustered = await window.electron.umap.getCachedResult(features, {
              ...analysisParams,
              runClustering: true
            });
            if (clustered?.key) {
              derivedKey = clustered.key;
            }
          }
          if (!derivedKey) {
            const { key } = await window.electron.umap.getCachedResult(features, analysisParams);
            derivedKey = key;
          }
          if (requestId === umapKeyRequestRef.current && derivedKey) {
            console.log('[labels] derived umapCacheKey', derivedKey);
            setUmapCacheKey((prev) => {
              if (isClusteredUmapKey(prev) && !isClusteredUmapKey(derivedKey)) {
                return prev;
              }
              return derivedKey;
            });
          }
        } catch (err) {
          console.warn('Failed to derive UMAP cache key on processing complete', err);
        }
      })();
    }
  }, [analysisParams.excludeLowVariance, analysisParams.excludeNonScalar, analysisParams.dbscanMinPts, analysisParams.hdbscanMinSamples, analysisParams.useDbscan, analysisParams.dbscanEpsKNN, analysisParams.pcaMinPts, analysisParams.pcaMaxComponents, analysisParams.pcaSweepIterations, analysisParams.superclusterMinPoints, analysisParams.superclusterRadius, analysisParams.superclusterMinZoom, analysisParams.superclusterMaxZoom, analysisParams.umapNNeighbors, analysisParams.umapMinDist, analysisParams.runClustering, analysisParams.clusterMethod, isClusteredUmapKey]);

  useEffect(() => {
    if (!analysisRows || analysisRows.length === 0) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const { profile, created, source } = await resolveDatasetProfile(analysisRows);
        if (cancelled) return;
        const hasInfoFieldConfig = Boolean(activeInfoData?.fieldConfig && typeof activeInfoData.fieldConfig === 'object');
        const hasInfoProfileSettings = Boolean(activeInfoData?.profileSettings && typeof activeInfoData.profileSettings === 'object');
        const hasInfoProfileIdentity =
          Boolean(activeInfoData?.currentProfile && typeof activeInfoData.currentProfile === 'object' && typeof activeInfoData.currentProfile.profile_id === 'string') &&
          (activeInfoData?.currentProfileSource === 'default' || activeInfoData?.currentProfileSource === 'user');
        const hasInfoAnalysisParams = Boolean(activeInfoData?.analysisParams && typeof activeInfoData.analysisParams === 'object');

        if (!hasInfoFieldConfig) {
          setFieldConfig(profile.fields || {});
        }
        if (!hasInfoProfileSettings) {
          setProfileSettings(profile.settings ?? null);
        }
        if (!hasInfoProfileIdentity) {
          setCurrentProfile({ profile_id: profile.profile_id });
          setCurrentProfileSource(source);
        }
        if (profile.settings && !hasInfoAnalysisParams) {
          setAnalysisParams(prev => ({
            ...prev,
            dbscanMinPts: profile.settings?.dbscanMinPts ?? prev.dbscanMinPts,
            hdbscanMinSamples: profile.settings?.hdbscanMinSamples ?? prev.hdbscanMinSamples,
            useDbscan: profile.settings?.useDbscan ?? prev.useDbscan,
            dbscanEpsKNN: profile.settings?.dbscanEpsKNN ?? prev.dbscanEpsKNN,
            umapNNeighbors: profile.settings?.umapNNeighbors ?? prev.umapNNeighbors,
            umapMinDist: profile.settings?.umapMinDist ?? prev.umapMinDist,
            clusterMethod: normalizeClusterMethod(profile.settings?.clusterMethod ?? prev.clusterMethod),
            pcaMinPts: profile.settings?.pcaMinPts ?? prev.pcaMinPts,
            pcaMaxComponents: profile.settings?.pcaMaxComponents ?? prev.pcaMaxComponents,
            pcaSweepIterations: profile.settings?.pcaSweepIterations ?? prev.pcaSweepIterations,
            superclusterMinPoints: profile.settings?.superclusterMinPoints ?? prev.superclusterMinPoints,
            superclusterRadius: profile.settings?.superclusterRadius ?? prev.superclusterRadius,
            superclusterMinZoom: profile.settings?.superclusterMinZoom ?? prev.superclusterMinZoom,
            superclusterMaxZoom: profile.settings?.superclusterMaxZoom ?? prev.superclusterMaxZoom,
            excludeLowVariance: profile.settings?.excludeLowVariance ?? prev.excludeLowVariance,
            excludeNonScalar: profile.settings?.excludeNonScalar ?? prev.excludeNonScalar
          }));
          setExcludeNonScalar(profile.settings.excludeNonScalar ?? false);
          setOneHotEncode(profile.settings.oneHotEncode ?? false);
          setExcludeLowVariance(profile.settings.excludeLowVariance ?? false);
        }
        if (created) {
          const msg = `New dataset profile created: ${profile.profile_id}`;
          setProfileNotice(msg);
          window.electron?.showNotification?.('Dataset profile created', msg);
        } else {
          setProfileNotice(null);
        }
      } catch (err) {
        console.error('Failed to resolve dataset profile', err);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [analysisRows, activeInfoData, normalizeClusterMethod]);

  const handleUpdateDbscan = useCallback((
    minPts: number,
    minSamples: number,
    useDbscan: boolean,
    eps: number,
    umapNNeighbors: number,
    umapMinDist: number,
    excludeLowVarianceFlag: boolean,
    clusterMethod: 'umap' | 'pca' | 'supercluster' | 'jsdbscan',
    pcaMinPts: number,
    pcaMaxComponents: number,
    pcaSweepIterations: number,
    superclusterMinPoints: number,
    superclusterRadius: number,
    superclusterMinZoom: number,
    superclusterMaxZoom: number
  ) => {
    setAnalysisParams(prev => ({
      ...prev,
      dbscanMinPts: minPts,
      hdbscanMinSamples: minSamples,
      useDbscan,
      dbscanEpsKNN: eps,
      umapNNeighbors,
      umapMinDist,
      clusterMethod,
      pcaMinPts,
      pcaMaxComponents,
      pcaSweepIterations,
      superclusterMinPoints,
      superclusterRadius,
      superclusterMinZoom,
      superclusterMaxZoom,
      excludeLowVariance: excludeLowVarianceFlag,
      excludeNonScalar,
      runClustering: true
    }));
    setExcludeLowVariance(excludeLowVarianceFlag);
    setAnalysisKey(k => k + 1);
    setStartProcessing(true);
    setProcessingComplete(false);
    if (currentProfile) {
      const settingsPayload = {
        dbscanMinPts: minPts,
        hdbscanMinSamples: minSamples,
        useDbscan,
        dbscanEpsKNN: eps,
        umapNNeighbors,
        umapMinDist,
        clusterMethod,
        pcaMinPts,
        pcaMaxComponents,
        pcaSweepIterations,
        superclusterMinPoints,
        superclusterRadius,
        superclusterMinZoom,
        superclusterMaxZoom,
        excludeLowVariance: excludeLowVarianceFlag,
        excludeNonScalar,
        oneHotEncode,
        hideNonScalar: profileSettings?.hideNonScalar ?? false,
        hidePerfect: profileSettings?.hidePerfect ?? false
      };
      updateProfileSettings(
        {
          profile_id: currentProfile.profile_id,
          fields: fieldConfig,
          settings: settingsPayload
        },
        currentProfileSource
      );
      setProfileSettings(settingsPayload);
    }
  }, [currentProfile, fieldConfig, currentProfileSource, excludeNonScalar, oneHotEncode, profileSettings]);

  const handleProfileViewSettings = useCallback((settings: { hidePerfect: boolean; hideNonScalar: boolean }) => {
    if (!currentProfile) return;
    const nextSettings = {
      ...(profileSettings ?? {}),
      hidePerfect: settings.hidePerfect,
      hideNonScalar: settings.hideNonScalar
    };
    setProfileSettings(nextSettings);
    updateProfileSettings(
      {
        profile_id: currentProfile.profile_id,
        fields: fieldConfig,
        settings: nextSettings
      },
      currentProfileSource
    );
  }, [currentProfile, profileSettings, fieldConfig, currentProfileSource]);

  // ========================================
  // Side Effects
  // ========================================

  useMenuActions({
    onOpen: handleOpen,
    onOpenStart: handleOpenStartFile,
    onOpenFinish: handleOpenFinish,
    onClose: handleCloseAnalysis,
    onPrint: handlePrint,
    onHelp: handleHelp,
    onExportBundle: handleExportBundle,
    onImportBundle: handleImportBundle,
    onError: handleOpenError,
  });

  useFileDropHandler(handleOpen, handleOpenStartFile, handleOpenFinish, handleOpenError);

  // Listen for custom 'open-file-dialog' event
  useEffect(() => {
    const handleOpenFileDialog = async () => {

      const dirPath = await openDirectory();

      if (dirPath) {
        handleOpenDirectory(dirPath);
        setStartProcessing(false);
      }
    };

    window.addEventListener('open-file-dialog', handleOpenFileDialog);

    return () => {
      window.removeEventListener('open-file-dialog', handleOpenFileDialog);
    };
  }, [handleOpenDirectory]);

  // ========================================
  // Render
  // ========================================

  const reportConfig = {
    systemName: "ANZ",
    algorithmName: "DeepVoice ML v3.2",

    clientName: "Bank Sample",
    dateRange: "7 Jan – 14 Jan 2025",

    confidentialText:
      "PRIVATE & CONFIDENTIAL — For authorised recipients only. Not for distribution.",

    /* -------------------------------------------------- */
    /* Insights                                           */
    /* -------------------------------------------------- */

    insights: [
      "Apple devices demonstrate consistently higher authentication stability compared to Android devices across all operating conditions.",
      "Seventeen outlier authentication events were detected, with 70 percent occurring during peak usage windows between 10 AM and 2 PM.",
      "Samsung Galaxy devices account for a disproportionate rejection share relative to installed base, suggesting device capture variability.",
      "Median authentication score remained stable week-on-week indicating algorithm consistency despite increased traffic volume."
    ],

    /* -------------------------------------------------- */
    /* Recommendations                                    */
    /* -------------------------------------------------- */

    recommendations: [
      "Increase investigation threshold during peak hours to reduce analyst workload while maintaining risk posture.",
      "Review voice enrolment prompts to improve first-capture quality in noisy environments.",
      "Conduct targeted analysis of Samsung S22 and S23 microphone pipelines.",
      "Implement continuous quality monitoring dashboards for operational teams.",
      "Assess backend scaling between 10 AM and 2 PM to mitigate performance bottlenecks."
    ],

    /* -------------------------------------------------- */
    /* Weekly Authentication Score Distribution           */
    /* -------------------------------------------------- */

    weeklyAuthScores: [
      { week: "Week 1", min: 0.18, q1: 0.28, median: 0.45, q3: 0.65, max: 0.88 },
      { week: "Week 2", min: 0.20, q1: 0.30, median: 0.48, q3: 0.68, max: 0.91 },
      { week: "Week 3", min: 0.15, q1: 0.26, median: 0.43, q3: 0.63, max: 0.85 },
      { week: "Week 4", min: 0.22, q1: 0.32, median: 0.50, q3: 0.70, max: 0.93 }
    ],

    /* -------------------------------------------------- */
    /* Weekly Quality Scores                              */
    /* -------------------------------------------------- */

    weeklyQualityScores: [
      { week: "Week 1", min: 0.22, q1: 0.32, median: 0.50, q3: 0.70, max: 0.90 },
      { week: "Week 2", min: 0.25, q1: 0.35, median: 0.53, q3: 0.73, max: 0.92 },
      { week: "Week 3", min: 0.20, q1: 0.30, median: 0.48, q3: 0.68, max: 0.88 },
      { week: "Week 4", min: 0.28, q1: 0.38, median: 0.56, q3: 0.76, max: 0.95 }
    ],

    /* -------------------------------------------------- */
    /* Rejections by Device                               */
    /* -------------------------------------------------- */

    rejectionsByDevice: [
      { name: "Samsung Galaxy S23", value: 22 },
      { name: "Samsung Galaxy S22", value: 19 },
      { name: "iPhone 15", value: 18 },
      { name: "iPhone 14", value: 15 },
      { name: "Google Pixel 7", value: 14 },
      { name: "Google Pixel 6", value: 12 }
    ],

    /* -------------------------------------------------- */
    /* Critical Events                                    */
    /* -------------------------------------------------- */

    criticalEvents: [
      { x: 1, y: 0.21, risk: "HIGH", device: "Samsung S23" },
      { x: 2, y: 0.19, risk: "HIGH", device: "Samsung S22" },
      { x: 3, y: 0.29, risk: "MED", device: "Pixel 7" },
      { x: 4, y: 0.16, risk: "CRIT", device: "Samsung S23" },
      { x: 5, y: 0.31, risk: "MED", device: "iPhone 14" },
      { x: 6, y: 0.23, risk: "HIGH", device: "Samsung S22" },
      { x: 7, y: 0.18, risk: "HIGH", device: "Pixel 6" },
      { x: 8, y: 0.12, risk: "CRIT", device: "Samsung S23" },
      { x: 9, y: 0.27, risk: "MED", device: "iPhone 15" },
      { x: 10, y: 0.14, risk: "CRIT", device: "Samsung S22" }
    ],

    /* -------------------------------------------------- */
    /* Scorecard Metrics                                  */
    /* -------------------------------------------------- */

    scorecard: [
      {
        label: "Total Events Analysed",
        value: "3,842"
      },
      {
        label: "Total Rejections",
        value: "247 (6.4%)"
      },
      {
        label: "Outliers Flagged",
        value: "17 Events"
      },
      {
        label: "Average Authentication Score",
        value: "0.463"
      },
      {
        label: "Average Quality Score",
        value: "0.541"
      },
      {
        label: "Peak Hour Transactions",
        value: "1,202 Events"
      }
    ],
    
    matchHistogram: {
        match: [
          { binStart: 0.2, binEnd: 0.25, count: 10 },
          { binStart: 0.4, binEnd: 0.45, count: 20 },
          { binStart: 0.7, binEnd: 0.75, count: 40 },
          { binStart: 0.75, binEnd: 0.8, count: 75 },
          { binStart: 0.8, binEnd: 0.85, count: 120 },
        ],
        nonMatch: [
          { binStart: 0.2, binEnd: 0.25, count: 90 },
          { binStart: 0.25, binEnd: 0.3, count: 60 },
          { binStart: 0.3, binEnd: 0.35, count: 25 },
        ],
      }

  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0b0b0f] overflow-hidden">
      {/* Top Navigation Bar */}
      <TopBar
        icon={appInfo?.icon}
        name={appInfo?.appname}
        settingsOpen={settingsOpen}
        helpOpen={helpOpen}
        onSettingsOpenChange={setSettingsOpen}
        onHelpOpenChange={setHelpOpen}
        Settings={
          <Settings
            value={settings}
            platform={appInfo?.platform}
            onClose={() => setSettingsOpen(false)}
            onChange={setSettings}
          />
        }
        Help={<Help isOpen={helpOpen} onClose={() => setHelpOpen(false)} />}
        onDetailPaneOpenChange={setDetailPaneOpen}
        detailPaneOpen={detailPaneOpen}
      />

      {/* Main Application Layout */}
      <div className="fixed top-0 h-screen w-screen pt-12">
        <Allotment>
          {/* Left Sidebar - Controls & Directory Info */}
          <Allotment.Pane minSize={SIDEBAR_MIN_SIZE} maxSize={SIDEBAR_MAX_SIZE}>
              <SidePanel
              dirStats={dirStats}
              selectedPath={selectedPath}
              startProcessing={startProcessing}
              processingComplete={processingComplete}
              appInfo={appInfo}
              onOpenDirectory={handleOpenDirectory}
              onStartAnalysis={handleStartAnalysis}
              onStartProcessingChange={setStartProcessing}
              analysisParams={analysisParams}
              excludeNonScalar={excludeNonScalar}
              oneHotEncode={oneHotEncode}
              onUpdateDbscan={handleUpdateDbscan}
              onToggleExcludeNonScalar={setExcludeNonScalar}
              onToggleOneHotEncode={setOneHotEncode}
              excludeLowVariance={excludeLowVariance}
              onToggleExcludeLowVariance={setExcludeLowVariance}
              recentItems={recentItems}
              onOpenRecent={handleOpenRecent}
              onDeleteRecent={removeRecentItem}
              onCloseAnalysis={handleCloseAnalysis}
              profileNotice={profileNotice}
            />
          </Allotment.Pane>

          {/* Right Side - Main Content & Details */}
          <Allotment.Pane>
            <Allotment vertical>
              <Allotment>
                {/* Main Content Area */}
                <Allotment.Pane>
                  <MainContent
                    appInfo={appInfo}
                    startProcessing={startProcessing}
                    processingComplete={processingComplete}
                    openError={openError}
                    selectedPath={selectedPath}
                    analysisParams={analysisParams}
                    rowsInput={rowsInput}
                    opening={opening}
                    isCancelling={isCancelling}
                    onCancel={handleCancel}
                    key={analysisKey}
                    onSelection={handleSelection}
                    onProcessingComplete={handleProcessingComplete}
                    onLogUpdate={handleLogUpdate}
                  />
                </Allotment.Pane>

                {/* Detail Panel - Right Side */}
                <Allotment.Pane
                  preferredSize={DETAIL_PANE_PREFERRED_SIZE}

                >
                {/*  <BuildPptx config={reportConfig} 
                  /> */}
                  <DetailPanel
                    startProcessing={startProcessing}
                    processingComplete={processingComplete}
                    selectedData={selectedData}
                    activeFolder={activeFolder}
                    clusterSummary={clusterSummary}
                    analysisRows={analysisRows}
                    clusterCategories={clusterCategories}
                    excludeNonScalar={excludeNonScalar}
                    oneHotEncode={oneHotEncode}
                    fieldConfig={fieldConfig}
                    profileSettings={profileSettings}
                    onProfileSettingsChange={handleProfileViewSettings}
                    aiLabelCacheKey={umapCacheKey}
                    canEditInfoJson={Boolean(currentInfoJsonPath)}
                    onEditInfoJson={handleEditInfoJson}
                  />
                </Allotment.Pane>
              </Allotment>

              {/* Bottom Status Bar */}
              <Allotment.Pane
                minSize={STATUS_BAR_MIN_SIZE}
                preferredSize={STATUS_BAR_PREFERRED_SIZE}
              >
                <section className="h-full overflow-auto pr-4 text-right text-xs text-gray-500 dark:text-gray-400 leading-relaxed pr-10 pt-1">
                  <div>
                    <span>Status: OK</span>
                    <span className="mx-1">•</span>
                    <span>licence Apache 2</span>
                    <span className="mx-1">•</span>
                    <span>openbq.io</span>
                  </div>
                  <LogPanel logs={logs} />
                </section>
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
      {infoEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="w-[min(900px,92vw)] h-[min(78vh,720px)] rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#101115] shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 text-sm font-semibold">
              Edit info.json fieldConfig
            </div>
            <div className="px-4 py-2 text-[11px] text-black/60 dark:text-white/60 break-all">
              {infoEditorPath}
            </div>
            <div className="px-4 pb-2 flex items-center gap-2 text-xs">
              <select
                value={infoEditorSelectedTopKey}
                onChange={(e) => handleInfoEditorTopKeyChange(e.target.value)}
                className="max-w-56 rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-[#0d0f13] px-2 py-1 text-xs text-black dark:text-white"
              >
                <option value="">Jump to key...</option>
                {infoEditorGroupedTopLevelKeys.map(({ group, keys }) => (
                  <optgroup key={group} label={group}>
                    {keys.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search fieldConfig..."
                value={infoEditorSearch}
                onChange={(e) => setInfoEditorSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (e.shiftKey) {
                    handleInfoEditorSearchPrev();
                  } else {
                    handleInfoEditorSearchNext();
                  }
                }}
                className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-[#0d0f13] px-2 py-1 text-xs text-black dark:text-white"
              />
              <button
                type="button"
                className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1"
                onClick={handleInfoEditorSearchPrev}
                disabled={infoEditorMatches.length === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-md border border-black/15 dark:border-white/20 px-2 py-1"
                onClick={handleInfoEditorSearchNext}
                disabled={infoEditorMatches.length === 0}
              >
                Next
              </button>
              <span className="min-w-14 text-right text-black/60 dark:text-white/60">
                {infoEditorSearch.trim().length > 0
                  ? `${infoEditorActiveMatchIndex >= 0 ? infoEditorActiveMatchIndex + 1 : 0}/${infoEditorMatches.length}`
                  : '-'}
              </span>
            </div>
            <div className="flex-1 px-4 pb-3">
              <div className="relative w-full h-full rounded-md border border-black/15 dark:border-white/20 bg-white dark:bg-[#0d0f13] overflow-hidden">
                <pre
                  ref={infoEditorHighlightRef}
                  aria-hidden="true"
                  className="absolute inset-0 m-0 p-3 text-xs font-mono leading-5 whitespace-pre-wrap break-words overflow-auto pointer-events-none text-gray-800 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: highlightedInfoEditorHtml }}
                />
                <textarea
                  ref={infoEditorTextareaRef}
                  className="absolute inset-0 w-full h-full m-0 p-3 text-xs font-mono leading-5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent text-transparent caret-gray-900 dark:caret-white"
                  spellCheck={false}
                  value={infoEditorText}
                  onChange={(e) => setInfoEditorText(e.target.value)}
                  onScroll={(e) => {
                    if (!infoEditorHighlightRef.current) return;
                    infoEditorHighlightRef.current.scrollTop = e.currentTarget.scrollTop;
                    infoEditorHighlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }}
                />
              </div>
            </div>
            <div className="px-4 pb-2 min-h-5 text-xs text-red-700 dark:text-red-300">
              {infoEditorError ?? ''}
            </div>
            <div className="px-4 py-3 border-t border-black/10 dark:border-white/10 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs"
                onClick={() => {
                  setInfoEditorOpen(false);
                  setInfoEditorError(null);
                  setInfoEditorSearch('');
                  setInfoEditorActiveMatchIndex(-1);
                  setInfoEditorSelectedTopKey('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700"
                onClick={handleSaveInfoJson}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
