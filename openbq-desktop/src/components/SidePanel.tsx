import React from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { AnalysisControls } from './AnalysisControls';
import { Footer } from './Footer';
import { openDirectory } from '../fileActions';
import type { AppInfo, FileStats, AnalysisConfig } from '../types';
import { ClusterSettings } from './ClusterSettings';
import type { AnalysisParams } from '../types';

interface SidePanelProps {
  dirStats: FileStats | null;
  selectedPath: string;
  startProcessing: boolean;
  processingComplete: boolean;
  appInfo: AppInfo | null;
  onOpenDirectory: (path: string) => void;
  onStartAnalysis: (config: AnalysisConfig) => void;
  onStartProcessingChange: (value: boolean) => void;
  analysisParams: AnalysisParams;
  excludeNonScalar: boolean;
  oneHotEncode: boolean;
  excludeLowVariance: boolean;
  onUpdateDbscan: (
    minPts: number,
    minSamples: number,
    useDbscan: boolean,
    eps: number,
    umapNNeighbors: number,
    umapMinDist: number,
    excludeLowVariance: boolean,
    clusterMethod: 'umap' | 'pca' | 'supercluster' | 'jsdbscan',
    pcaMinPts: number,
    pcaMaxComponents: number,
    pcaSweepIterations: number,
    superclusterMinPoints: number,
    superclusterRadius: number,
    superclusterMinZoom: number,
    superclusterMaxZoom: number
  ) => void;
  onToggleExcludeNonScalar: (value: boolean) => void;
  onToggleOneHotEncode: (value: boolean) => void;
  onToggleExcludeLowVariance: (value: boolean) => void;
  recentItems: { type: 'file' | 'directory'; path: string }[];
  onOpenRecent: (item: { type: 'file' | 'directory'; path: string }) => void;
  onDeleteRecent: (item: { type: 'file' | 'directory'; path: string }) => void;
  onCloseAnalysis: () => void;
  profileNotice?: string | null;
}

/**
 * Left sidebar component with directory selection and analysis controls
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  dirStats,
  selectedPath,
  startProcessing,
  processingComplete,
  appInfo,
  onOpenDirectory,
  onStartAnalysis,
  onStartProcessingChange,
  analysisParams,
  excludeNonScalar,
  oneHotEncode,
  excludeLowVariance,
  onUpdateDbscan,
  onToggleExcludeNonScalar,
  onToggleOneHotEncode,
  onToggleExcludeLowVariance,
  recentItems,
  onOpenRecent,
  onDeleteRecent,
  onCloseAnalysis,
  profileNotice,
}) => {
  const [localMinPts, setLocalMinPts] = React.useState<number>(analysisParams.dbscanMinPts);
  const [localMinSamples, setLocalMinSamples] = React.useState<number>(analysisParams.hdbscanMinSamples);
  const [localUseDbscan, setLocalUseDbscan] = React.useState<boolean>(analysisParams.useDbscan);
  const [localEps, setLocalEps] = React.useState<number>(analysisParams.dbscanEpsKNN);
  const [localUmapNeighbors, setLocalUmapNeighbors] = React.useState<number>(analysisParams.umapNNeighbors);
  const [localUmapMinDist, setLocalUmapMinDist] = React.useState<number>(analysisParams.umapMinDist);
  const [localClusterMethod, setLocalClusterMethod] = React.useState<'umap' | 'jsdbscan'>(
    analysisParams.clusterMethod === 'jsdbscan' ? 'jsdbscan' : 'umap'
  );

  React.useEffect(() => {
    setLocalMinPts(analysisParams.dbscanMinPts);
    setLocalMinSamples(analysisParams.hdbscanMinSamples);
    setLocalUseDbscan(analysisParams.useDbscan);
    setLocalEps(analysisParams.dbscanEpsKNN);
    setLocalUmapNeighbors(analysisParams.umapNNeighbors);
    setLocalUmapMinDist(analysisParams.umapMinDist);
    setLocalClusterMethod(analysisParams.clusterMethod === 'jsdbscan' ? 'jsdbscan' : 'umap');
  }, [analysisParams]);

  const handleOpenDirectory = async () => {
    const dirPath = await openDirectory();
    
    if (dirPath) {
      onOpenDirectory(dirPath);
      onStartProcessingChange(false);
    }
  };

  return (
    <div className="ml-4 pt-10 flex flex-col h-full">
      {!(startProcessing || processingComplete) ? (
        <button
          type="button"
          className="
            self-start w-fit inline-flex items-center gap-2
            h-8 px-4 rounded-md
            border border-black/10 dark:border-white/15
            bg-gradient-to-b 
            from-white to-black/[0.03]
            dark:from-white/10 dark:to-black/40
            text-[13px] font-medium
            text-black dark:text-white
            shadow-sm
            dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]
          "
          onClick={handleOpenDirectory}
        >
          <FolderOpen className="w-4 h-4 opacity-80" />
          Open Directory
        </button>
      ) : (
        <button
          type="button"
          className="
            self-start w-fit inline-flex items-center gap-2
            h-8 px-4 rounded-md
            border border-black/10 dark:border-white/15
            bg-gradient-to-b 
            from-white to-black/[0.03]
            dark:from-white/10 dark:to-black/40
            text-[13px] font-medium
            text-black dark:text-white
            shadow-sm
            dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]
          "
          onClick={onCloseAnalysis}
        >
          Close
        </button>
      )}

      {dirStats && dirStats.files.length > 0 && !processingComplete && (
        <div>
          <AnalysisControls
            fileCount={dirStats.files.length}
            disabled={startProcessing}
            onStart={onStartAnalysis}
          />
        </div>
      )}

      {processingComplete && (
        <div className="ml-4 pt-4 pr-3">
          {profileNotice && (
            <div className="mb-3 rounded-md border border-black/10 dark:border-white/10 bg-yellow-50/80 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-900 dark:text-yellow-200">
              {profileNotice}
            </div>
          )}
          <ClusterSettings
            minPts={localMinPts}
            minSamples={localMinSamples}
            useDbscan={localUseDbscan}
            eps={localEps}
            umapNeighbors={localUmapNeighbors}
            umapMinDist={localUmapMinDist}
            runClustering={analysisParams.runClustering}
            clusterMethod={localClusterMethod}
            excludeNonScalar={excludeNonScalar}
            oneHotEncode={oneHotEncode}
            excludeLowVariance={excludeLowVariance}
            onChangeMinPts={setLocalMinPts}
            onChangeMinSamples={setLocalMinSamples}
            onToggleUseDbscan={setLocalUseDbscan}
            onChangeEps={setLocalEps}
            onChangeUmapNeighbors={setLocalUmapNeighbors}
            onChangeUmapMinDist={setLocalUmapMinDist}
            onChangeClusterMethod={setLocalClusterMethod}
            onToggleExcludeNonScalar={onToggleExcludeNonScalar}
            onToggleOneHotEncode={onToggleOneHotEncode}
            onToggleExcludeLowVariance={onToggleExcludeLowVariance}
            onApply={() => onUpdateDbscan(
              localMinPts,
              localMinSamples,
              localUseDbscan,
              localEps,
              localUmapNeighbors,
              localUmapMinDist,
              excludeLowVariance,
              localClusterMethod,
              analysisParams.pcaMinPts,
              analysisParams.pcaMaxComponents,
              analysisParams.pcaSweepIterations,
              analysisParams.superclusterMinPoints,
              analysisParams.superclusterRadius,
              analysisParams.superclusterMinZoom,
              analysisParams.superclusterMaxZoom
            )}
          />
        </div>
      )}

      {(!dirStats || dirStats.files.length === 0) && !startProcessing && !processingComplete && recentItems.length > 0 && (
        <div className="mt-6 pr-3">
          <div className="text-xs font-semibold text-black/70 dark:text-gray-300 mb-2">
            Recently opened
          </div>
          <div className="space-y-2">
            {recentItems.map((item) => (
              <div
                key={`${item.type}-${item.path}`}
                className="flex items-start gap-2 rounded-md border border-black/10 dark:border-white/10 px-2 py-2 text-xs text-black/70 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => onOpenRecent(item)}
                  className="flex-1 min-w-0 text-left"
                  title={item.path}
                >
                  <div className="font-medium truncate">
                    {item.path.split(/[/\\]/).pop()}
                  </div>
                  <div className="text-[11px] text-black/50 dark:text-gray-400 truncate">
                    {item.type === 'directory' ? 'Folder' : 'File'} · {item.path}
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Remove from recently opened"
                  className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-black/10 dark:border-white/10 text-black/60 hover:text-black dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => onDeleteRecent(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pb-5 align-right">
        <Footer appInfo={appInfo} />
      </div>
    </div>
  );
};
