// React core
import React, { useRef, useEffect, useState, useCallback } from 'react';

// Third-party libraries
import { Allotment } from "allotment";
import "allotment/dist/style.css";
//import TurndownService from 'turndown';
//import turndownPluginGfm from 'turndown-plugin-gfm';

// Icons
import {
  FileText,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  Loader,
} from 'lucide-react';

// Local utilities
import { openDocxAsHtml, openDirectory } from './fileActions.tsx';

// Components
import Settings, { useAISettings, getSelectedFocusInstructions } from "./components/Settings.tsx";
import { DirectorySummary } from './components/DirStats.tsx'
import FormattedFieldList from './components/FormattedFieldList.tsx'
import { AnalysisControls, type AnalysisConfig, type BiometricModality, type QualityAlgorithm } from './components/AnalysisControls.tsx';
import { LogPanel } from './components/LogPanel.tsx';

import * as UI from "@biometix/ui-common";
console.log("ui-common exports", UI);

//import { Help } from "@biometix/ui-common";
import Help from './components/Help.tsx';
//import Help  from './components/Help.tsx'
import { TopBar } from './components/TopBar.tsx';
import { Footer } from './components/Footer.tsx';
import { OpenBQAnalyzer } from './components/OpenBQAnalyzer.tsx';

// Test data
import { matchTestData } from './data/test/matchTestData.tsx';

// config for fiels
import { fieldConfig } from './openbq_defs.tsx'
import FieldHistogramPanel from './components/FieldHistogramPanel.tsx';

const DEBUG = false;

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      llm: {
        create: (config: any) => Promise<any>;
      };
    };
  }
}


if (window.electron?.isElectron) {
  const TEST_CONFIG = {
    apple: {
      shortcutName: "Ask AI"
    }
  };

} else {
  console.log("Running in browser");
}



const pendingCategories = (label: string) => ({
  Info: [label]
});

const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  const key = encodeURIComponent(name) + '=';
  const parts = document.cookie.split('; ').find(row => row.startsWith(key));
  return parts ? decodeURIComponent(parts.slice(key.length)) : null;
};

export default function DocumentReviewTool() {

  const SETTINGS_KEY = 'docReviewSettings';

  const loadSettings = () => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      console.warn('Failed to load settings from localStorage');
      return null;
    }
  };

  const initial = typeof window !== 'undefined' ? loadSettings() : null;



  const [checkedItems, setCheckedItems] = useState({});

  const [reportType, setReportType] = useState<string>(initial?.reportType ?? 'review');

  const { settings, setSettings } = useAISettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [detailPaneOpen, setDetailPaneOpen] = useState(false);

  let data = Array.from({ length: 500 }, () => ({}));

  const [dirStats, setDirStats] = useState(null);
  const [selectedPath, setSelectedPath] = useState("")
  const [startProcessing, setStartProcessing] = useState(false)
  const [selectedData, setSelectedData] = useState({})
  const [activeFolder, setActiveFolder] = useState("")
  const [processingComplete, setProcessingComplete] = useState(false);

  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>({
    qualityMetric: 'obqe',
    biometricModality: 'face',
    dbscanMinPts: 5,
    hdbscanMinSamples: 5,
    dbscanEpsKNN: 0.8,
    umapNNeighbors: 0,
    umapMinDist: 0.3,
    pcaMinPts: 5,
    pcaMaxComponents: 10,
    pcaSweepIterations: 5,
    superclusterMinPoints: 2,
    superclusterRadius: 40,
    superclusterMinZoom: 0,
    superclusterMaxZoom: 16,
    excludeLowVariance: false,
    excludeNonScalar: false,
    runClustering: false,
    clusterMethod: 'umap'
  });

  const [logs, setLogs] = useState<string[]>([]);

  const handleLogUpdate = (newLogs: string[]) => {
    if (JSON.stringify(newLogs) !== JSON.stringify(logs)) {
      setLogs(newLogs);
    }
  };




  // guassian distributions
  data = matchTestData(data);


  type AppInfo = {
    name?: string;
    icon?: string;
    description?: string;
    version?: string;
    platform?: string;
    company?: string;
    userInfo?: { username?: string; uid?: string };
    docker?: { installed?: boolean; running?: boolean };
    ollama?: { installed?: boolean; running?: boolean };
  };
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    async function fetchAppInfo() {
      try {
        const info = await window.electron.getAppInfo();
        setAppInfo(info);
        //console.log("Info")
        //console.log(info)

      } catch (error) {
        const info = { name: 'DraftLoaded', decription: "Test", version: "0.x" }
        setAppInfo(info);
        console.error('INTERNAL: Failed to load app info:', error);
      }
    }
    fetchAppInfo();
  }, []);

  // renderer (proofread.tsx)
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // REQUIRED for "+" and for drop to work
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      const dt = e.dataTransfer;
      console.log("types:", Array.from(dt?.types ?? []));
      console.log("files.length:", dt?.files?.length ?? 0);
      console.log("items:", Array.from(dt?.items ?? []).map(i => ({ kind: i.kind, type: i.type })));
      console.log("uri-list:", dt?.getData("text/uri-list"));
      console.log("text/plain:", dt?.getData("text/plain"));


      const files = Array.from(e.dataTransfer?.files ?? []);
      const paths = files
        .map((f: any) => window.electron.getPathForFile(f))
        .filter(Boolean) as string[];

      // only accept docx/xlsx
      const first = paths.find(p => /\.(docx|xlsx)$/i.test(p));
      console.log("DROP paths:", paths);

      if (!first) return;

      try {
        const file = await openDocxAsHtml(first);
        if (file) handleOpen(file);
      } catch (err) {
        console.error("Failed to open dropped file:", err);
      }
    };

    // Register on BOTH window + document to avoid edge cases / navigation
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  const resetParams = () => {
    setDetailPaneOpen(false)
    setProcessingComplete(false);
    setSettingsOpen(false);
    setReportType("review");
    setSelectedData({});
  }

  const handleOpen = useCallback(({ content, filePath }: { content: string; filePath: string }) => {
    resetParams()
    setDetailPaneOpen(true)
  }, [
    resetParams,
    setReportType
  ]);

  const handlePrint = useCallback(async () => {



    console.log("printing now");
    const result = await window.electron.report.savePdfDialog();

    if (result.canceled || !result.filePath) {
      console.log("User canceled save dialog");
      return;
    }


    console.log("Selected file path:", result.filePath);

    // Now convert and save to that path
    await window.electron.report.convertMarkdownToPdf({
      markdownFiles: "test.md",
      outputPath: result.filePath,
      // ... other options
    });

    console.log("PDF saved to:", result.filePath);
    window.electron.showNotification("Generating PDF", "Your PDF completed at " + result.filePath);

  }, []);

  function useMenuActions(opts: {
    onOpen?: (file: { filePath: string; content: string; messages?: any[] }) => void;
    onPrint?: () => void;
  }) {
    const onOpenRef = useRef(opts.onOpen);
    const onPrintRef = useRef(opts.onPrint);

    useEffect(() => {
      onOpenRef.current = opts.onOpen;
      onPrintRef.current = opts.onPrint;
    }, [opts.onOpen, opts.onPrint]);

    useEffect(() => {
      let offOpen: undefined | (() => void);
      let offHelp: undefined | (() => void);
      let offPrint: undefined | (() => void);
      let offTestFeature: undefined | (() => void);

      try {
        offOpen = window.electron.menu.onOpen(async () => {
          const file = await openDocxAsHtml();
          if (file) onOpenRef.current?.(file);
        });

        offHelp = window.electron.menu.onHelp(async () => {
          setHelpOpen(true)
        });

        /*offTestFeature = window.electron.menu.onTestFeature(async () => {
          console.log("test feature triggered from menu");
          alert("Test Feature Triggered!");
        });*/



        offPrint = window.electron.menu.onPrint(() => onPrintRef.current?.());

      } catch (error) {
        console.error("INTERNAL: could not register electron callbacks ", error)
      }




      return () => {
        offOpen?.();
        offHelp?.();
        offPrint?.();
        offTestFeature?.();
      };
    }, []); // <— subscribe once
  }
  useMenuActions({ onOpen: handleOpen, onPrint: handlePrint });



  // recieve open-file-dialog event
  useEffect(() => {
    const handleOpenFileDialog = async () => {
      // Actually trigger the file open action
      const file = await openDocxAsHtml();
      if (file) {
        handleOpen(file); // or whatever you want to do with the file
      }
    };

    const handleOpenDirectoryDialog = async () => {
      // Actually trigger the directory open action
      const dirPath = await openDirectory();
      console.log("DIR PATH", dirPath)
      if (dirPath) {
        console.log("Opened directory:", dirPath);
      }
      resetParams()
      let files = await window.electron?.fs.listFiles(dirPath, 100)
      console.log(files)
      setSelectedPath(dirPath)
      setDirStats(files)
    }


    window.addEventListener('open-file-dialog', handleOpenDirectoryDialog);

    return () => {
      window.removeEventListener('open-file-dialog', handleOpenDirectoryDialog);
    };
  }, []);



  useEffect(() => {
    try {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ reportType })
      );
    } catch {
      console.warn('Failed to save settings to localStorage');
    }
  }, [reportType]);



  const scrollContainerRef = React.useRef(null);

  const toggleCheckbox = React.useCallback((itemId) => {
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;

    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));

    // Single restore, runs immediately after render
    queueMicrotask(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    });
  }, []);





  const InfoPanel = React.memo(({ processing = false }) => {
    return (
      <div className="logomain">
        <div className="logo-container">
          <div className={`segments-container ${processing ? 'animated' : ''}`}>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
            <div className="segment"></div>
          </div>
          <div className="inner-circle">
            <div className="inner-circle-white">
              <div className={`user-icon ${processing ? 'animated' : ''}`}>
                <div className="user-head"></div>
                <div className="user-body"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });



  // Add this to your main component
  React.useEffect(() => {
    console.log('Component rendered, checkedItems:', Object.keys(checkedItems).length);
  }, [checkedItems]);

  const nestedItemLabel = (items, index, data) => {
    function getBaseName(path) {
      const parts = path.split(/[/\\]/);
      return parts.pop() || '';
    }

    function roundTo(value, decimals = 2) {
      const factor = 10 ** decimals;
      return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    function perc(value, decimals = 4) {
      if (!value) { return "" }
      return 100 * roundTo(value, decimals)
    }

    return (
      <span>
        <h2>Record: {getBaseName(data[index].fields.file)}</h2>
        <p />
        Score: {data[index].fields.unified_quality_score_scalar} {perc(data[index].fields.face_detection)} %
      </span>
    )
  };

  const loadImage = async ({
    imageFile,
    maxWidth = 150
  }) => {
    try {
      const { success, base64 } = await window.electron.fs.readImageBase64(
        imageFile,
        activeFolder,
        { maxWidth }
      );

      if (success && base64) {
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (err) {
      console.error("Error reading file base64:", err);
    }
    return null;
  }

  // When user clicks "Start" in AnalysisControlsAdvanced
  const handleStartAnalysis = (config: AnalysisConfig) => {
    // Map AnalysisConfig to AnalysisParams
    setAnalysisParams({
      qualityMetric: config.algorithm as QualityAlgorithm,
      biometricModality: config.modality,
      dbscanMinPts: config.dbscanMinPts,
      hdbscanMinSamples: config.hdbscanMinSamples,
      dbscanEpsKNN: config.dbscanEpsKNN,
      umapNNeighbors: 0,
      umapMinDist: 0.3,
      pcaMinPts: 5,
      pcaMaxComponents: 10,
      pcaSweepIterations: 5,
      superclusterMinPoints: 2,
      superclusterRadius: 40,
      superclusterMinZoom: 0,
      superclusterMaxZoom: 16,
      excludeLowVariance: false,
      excludeNonScalar: false,
      runClustering: false,
      clusterMethod: 'umap'
    });
    console.log(analysisParams)
    setStartProcessing(true)
  };


  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0b0b0f] overflow-hidden">

      <TopBar
        icon={appInfo?.icon}
        name={appInfo?.appname}
        settingsOpen={settingsOpen}
        helpOpen={helpOpen}
        onSettingsOpenChange={setSettingsOpen}
        onHelpOpenChange={setHelpOpen}
        Settings={<Settings value={settings} platform={appInfo?.platform} onClose={() => setSettingsOpen(false)} onChange={setSettings} />}
        Help={<Help isOpen={helpOpen} onClose={() => setHelpOpen(false)} />}
        onDetailPaneOpenChange={setDetailPaneOpen}
        detailPaneOpen={detailPaneOpen}

      />

      <div className="fixed top-0 h-screen w-screen pt-12">
        <Allotment>
          {/* options right bar */}
          <Allotment.Pane minSize={250} maxSize={250}>
            {/* Add a file open button */}
            <div className="ml-4 pt-10 flex flex-col h-full">
              <button
                type="button"
                className="
   self-start
w-fit
inline-flex items-center gap-2
h-8 px-4
rounded-md
border border-black/10 dark:border-white/15
bg-gradient-to-b 
  from-white to-black/[0.03]
  dark:from-white/10 dark:to-black/40
text-[13px] font-medium
text-black dark:text-white
shadow-sm
dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]
  "
                onClick={() => {
                  const event = new CustomEvent('open-file-dialog')
                  window.dispatchEvent(event)
                  setStartProcessing(false)

                }}
              >
                <FolderOpen className="w-4 h-4 opacity-80" />
                Open Directory
              </button>
              {dirStats && (
                <div>
                  <DirectorySummary
                    directoryPath={selectedPath}
                    files={dirStats?.files}
                    counts={dirStats?.counts}
                    limit={20}
                  />

                  {dirStats?.files.length > 0 && (
                    <AnalysisControls
                      fileCount={dirStats.files.length}
                      disabled={startProcessing}
                      onStart={handleStartAnalysis}
                    />
                  )}



                </div>

              )}

              <div className="mt-auto pb-5 align-right">
                <Footer appInfo={appInfo} />
              </div>
            </div>








          </Allotment.Pane>


          {/* Right: Output */}
          <Allotment.Pane>
            <Allotment vertical>
              <Allotment>
                <Allotment.Pane >
                  <div className="
        lg:col-start-3 min-w-0 overflow-y-auto
        h-[calc(100vh-3rem)]
        bg-gradient-to-b
        from-gray-50/40
        to-gray-300/40
        dark:from-gray-900/60
        dark:to-gray-800/409
      ">


                    <div>
                      {!appInfo?.docker?.installed && (<div className='text-center pt-25'>Docker is not installed. Docker must be running to continue.</div>)}
                      {!appInfo?.docker?.running && (<div className='text-center pt-25'>Docker is not running, please check it is working and restart.</div>)}
                      {startProcessing && processingComplete ? (<div />) : (<InfoPanel processing={startProcessing} />)}
                      {startProcessing && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                          <OpenBQAnalyzer directory={selectedPath}
                            onSelection={(sel, folder) => { console.log("Outer Folder:", folder); setActiveFolder(folder); setSelectedData(sel) }}
                            onProcessingComplete={() => { setProcessingComplete(true) }}
                            analysisParams={analysisParams}
                            onLogUpdate={handleLogUpdate}      // Get log updates
                            customLogPanel={false}
                          />

                        </div>
                      )}
                    </div>




                  </div>



                </Allotment.Pane>
                {/* Detail pane */}
                <Allotment.Pane preferredSize={330} maxSize={330}>



                  <div
                    className="relative h-full w-full overflow-hidden"
                    style={{ contain: "layout size style paint" }}
                  >
                    <div
                      className="relative h-full w-full overflow-hidden"
                      style={{ contain: "layout size style paint" }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{ height: "100%", overflowY: "auto" }}
                        onScroll={(e) => {
                          // console.log('Scrolling! scrollTop:', e.currentTarget.scrollTop);
                        }}
                      >
                       
                        {startProcessing && processingComplete && (
                          <div>
                            <FormattedFieldList inputData={selectedData}
                              dataKey="fields"
                              itemLabel={nestedItemLabel}
                              fieldConfig={fieldConfig}
                              imageFunc={loadImage} />


                            <FieldHistogramPanel inputData={selectedData}
                              dataKey="fields"
                              itemLabel={nestedItemLabel}
                              fieldConfig={fieldConfig}
                              imageFunc={loadImage} />

                          </div>
                        )

                        }




                        {/*<EATest></EATest>*/}
                      </div>
                    </div>
                  </div>

                </Allotment.Pane>

              </Allotment>

              <Allotment.Pane minSize={30} preferredSize={30}>

                <section className="h-full overflow-auto pr-4 text-right text-xs text-gray-500 dark:text-gray-400 leading-relaxed pr-10 pt-1">
                  <div>
                    <span>Status: OK</span>
                    <span className="mx-1">•</span>
                    <span>licence Appache 2</span>
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


    </div>
  );
}
