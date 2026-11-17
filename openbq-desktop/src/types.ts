// ========================================
// Analysis Types
// ========================================

export type BiometricModality = 'face' | 'finger' | 'iris' | 'voice';
export type QualityAlgorithm = 'ofiq' | 'nisqa' | 'obqe' | 'NFIQ2' | 'biqt';

export interface AnalysisConfig {
  algorithm: QualityAlgorithm;
  modality: BiometricModality;
  dbscanMinPts: number;
  hdbscanMinSamples: number;
  useDbscan: boolean;
  dbscanEpsKNN: number;
  umapNNeighbors: number;
  umapMinDist: number;
}

export interface AnalysisParams {
  qualityMetric: QualityAlgorithm;
  biometricModality: BiometricModality;
  dbscanMinPts: number;
  hdbscanMinSamples: number;
  useDbscan: boolean;
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
}

// ========================================
// Application Types
// ========================================

export interface AppInfo {
  name?: string;
  appname?: string;
  icon?: string;
  description?: string;
  version?: string;
  platform?: string;
  company?: string;
  userInfo?: { username?: string; uid?: string };
  docker?: { installed?: boolean; running?: boolean };
  ollama?: { installed?: boolean; running?: boolean };
}

// ========================================
// File Types
// ========================================

export interface FileStats {
  files: string[];
  counts: Record<string, number>;
}

export interface OpenFileResult {
  content: string | any[];
  filePath: string;
  messages?: any[];
}

// ========================================
// Electron Window Types
// ========================================

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      llm?: {
        create: (config: any) => Promise<any>;
      };
      shell?: {
        openExternal: (url: string) => Promise<void>;
      };
      getAppInfo?: () => Promise<AppInfo>;
      getPath?: (name: string) => Promise<string>;
      getPathForFile?: (file: File) => string | null;
      fs?: {
        showSaveDialog?: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
        showOpenDialog?: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
        listFiles: (path: string, limit: number) => Promise<FileStats>;
        readFile?: (path: string) => Promise<{ success: boolean; content: string }>;
        writeFile?: (path: string, content: string) => Promise<{ success: boolean }>;
        writeFileAbsolute?: (path: string, content: string) => Promise<{ success: boolean; fileName?: string; error?: string }>;
        deleteFileAbsolute?: (path: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
        readDir: (path: string) => Promise<{ success: boolean; entries: { name: string; isFile: boolean; isDirectory: boolean }[]; error?: string }>;
        ensureDir: (path: string) => Promise<{ success: boolean }>;
        readImageBase64: (
          imageFile: string,
          basePath: string,
          options: { maxWidth: number }
        ) => Promise<{ success: boolean; base64?: string }>;
      };
      report?: {
        savePdfDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
        convertMarkdownToPdf: (options: {
          markdownFiles: string;
          outputPath: string;
        }) => Promise<void>;
      };
      ollama?: {
        startService: () => Promise<{ ok: boolean; message: string }>;
        status: () => Promise<{ running: boolean }>;
        pullModel: (model: string) => Promise<{ ok: boolean; message: string }>;
      };
      showNotification?: (title: string, body: string) => void;
      openbq?: {
        analyze: (mode: string, inputPath: string, outputPath: string, engine: string, report: boolean) => Promise<{ success: boolean; summary?: any; outputFiles?: any; csvData?: any; error?: any }>;
        clearCache: (mode: string, inputPath: string, outputPath: string, engine: string) => Promise<{ success: boolean }>;
        benchmark: () => Promise<{ success: boolean; error?: any }>;
        ensureReady: () => Promise<{ success: boolean; error?: any }>;
        onProgress: (callback: (progress: any) => void) => () => void;
      };
      menu?: {
        onOpen: (callback: () => void) => () => void;
        onClose: (callback: () => void) => () => void;
        onHelp: (callback: () => void) => () => void;
        onPrint: (callback: () => void) => () => void;
        onExportBundle?: (callback: () => void) => () => void;
        onImportBundle?: (callback: () => void) => () => void;
      };
      bundle?: {
        exportAnalysisBundle: (payload: {
          csvData: any[];
          info: Record<string, any>;
          activeCache?: { analysisCacheKey?: string | null; umapCacheKey?: string | null };
        }) => Promise<{
          success: boolean;
          canceled?: boolean;
          filePath?: string;
          error?: string;
          metadata?: { analysisCacheFiles: number; umapCacheFiles: number };
        }>;
        importAnalysisBundle: () => Promise<{
          success: boolean;
          canceled?: boolean;
          error?: string;
          bundlePath?: string;
          importDirPath?: string;
          importedCsvPath?: string;
          importedInfoPath?: string;
          csvData?: any[];
          info?: Record<string, any>;
          restoredMetadataFiles?: number;
        }>;
      };
      umap?: {
        cacheResult: (key: string, data: any) => Promise<{ success: boolean }>;
        getCachedResult: (
          data: number[][],
          params: {
            dbscanMinPts: number;
            hdbscanMinSamples?: number;
            useDbscan?: boolean;
            dbscanEpsKNN: number;
            pcaMinPts?: number;
            pcaMaxComponents?: number;
            pcaSweepIterations?: number;
            superclusterMinPoints?: number;
            superclusterRadius?: number;
            superclusterMinZoom?: number;
            superclusterMaxZoom?: number;
            umapNNeighbors?: number;
            umapMinDist?: number;
            runClustering?: boolean;
            clusterMethod?: 'umap' | 'pca' | 'supercluster' | 'jsdbscan';
          }
        ) => Promise<{ key: string; cached: any }>;
        clearCache: () => Promise<{ success: boolean; cleared?: number }>;
      };
      cluster?: {
        run: (payload: {
          method: 'umap' | 'pca' | 'supercluster';
          points?: { x: number; y: number }[];
          features?: number[][];
          params?: {
            dbscanMinPts?: number;
            hdbscanMinSamples?: number;
            useDbscan?: boolean;
            dbscanEpsKNN?: number;
            pcaMinPts?: number;
            pcaMaxComponents?: number;
            superclusterMinPoints?: number;
            superclusterRadius?: number;
            superclusterMinZoom?: number;
            superclusterMaxZoom?: number;
          };
        }) => Promise<{ labels: number[]; clusterCount: number; noiseCount: number }>;
        onProgress: (callback: (message: string) => void) => () => void;
      };
      dockerUmap?: {
        run: (payload: {
          inputCsvPath: string;
          outputCsvPath?: string;
          clusterAlgorithm?: 'dbscan' | 'hdbscan';
          umapNNeighbors?: number;
          umapMinDist?: number;
          dbscanEps?: number;
          dbscanMinSamples?: number;
          maxDbscanPoints?: number;
          kmeansClusters?: number;
          hdbscanMinClusterSize?: number;
          hdbscanMinSamples?: number;
          pcaComponents?: number;
          numericColumns?: string[];
        }) => Promise<{ success: boolean; outputCsvPath: string; exitCode: number }>;
      };
      deepface?: {
        analyzeImage: (payload: {
          imagePath: string;
          detectorBackend?:
            | 'opencv'
            | 'retinaface'
            | 'mtcnn'
            | 'ssd'
            | 'dlib'
            | 'mediapipe'
            | 'yolov8'
            | 'yunet'
            | 'centerface'
            | 'skip';
          enforceDetection?: boolean;
          antiSpoofing?: boolean;
          includeRaw?: boolean;
        }) => Promise<{
          success: boolean;
          age: number | null;
          gender: string | null;
          emotion: string | null;
          race: string | null;
          isReal: boolean | null;
          antiSpoofingSupported?: boolean;
          genderProbabilities?: Record<string, number>;
          emotionProbabilities?: Record<string, number>;
          raceProbabilities?: Record<string, number>;
          raw?: Record<string, unknown>;
        }>;
      };
    };
  }
}

export {};
