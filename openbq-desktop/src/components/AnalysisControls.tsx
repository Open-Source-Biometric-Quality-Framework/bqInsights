// AnalysisControlsAdvanced.tsx - Extended control panel with DBSCAN parameters

import React, { useState } from 'react';

export type BiometricModality = 'face' | 'finger' | 'iris' | 'voice';
export type QualityAlgorithm = 'ofiq' | 'nisqa' | 'obqe' | 'NFIQ2' | 'biqt';

export type AnalysisConfig = {
  modality: BiometricModality;
  algorithm: QualityAlgorithm;
  dbscanMinPts: number;
  hdbscanMinSamples: number;
  useDbscan: boolean;
  dbscanEpsKNN: number;
  umapNNeighbors: number;
  umapMinDist: number;
};

// Mapping of modalities to their available algorithms
const MODALITY_ALGORITHMS: Record<BiometricModality, QualityAlgorithm[]> = {
  face: ['ofiq', 'obqe', "biqt"],
  finger: ['NFIQ2'],
  iris: ['biqt'],
  voice: ['nisqa']
};

// Display names
const ALGORITHM_LABELS: Record<QualityAlgorithm, string> = {
  ofiq: 'OFIQ',
  obqe: 'OBQE',
  biqt: 'BIQT',
  NFIQ2: 'NFIQ2',
  nisqa: 'NISQA'
};

const MODALITY_LABELS: Record<BiometricModality, string> = {
  face: 'Face',
  finger: 'Fingerprint',
  iris: 'Iris',
  voice: 'Voice'
};

type AnalysisControlsAdvancedProps = {
  fileCount: number;
  onStart: (config: AnalysisConfig) => void;
  disabled?: boolean;
  showAdvanced?: boolean;
};

export function AnalysisControls({ 
  fileCount, 
  onStart, 
  disabled = false,
  showAdvanced = true
}: AnalysisControlsAdvancedProps) {
  const [modality, setModality] = useState<BiometricModality>('face');
  const [algorithm, setAlgorithm] = useState<QualityAlgorithm>('ofiq');
  const [dbscanMinPts, setDbscanMinPts] = useState(5);
  const [hdbscanMinSamples, setHdbscanMinSamples] = useState(5);
  const [useDbscan, setUseDbscan] = useState(false);
  const [dbscanEpsKNN, setDbscanEpsKNN] = useState(0.8);
  const [umapNNeighbors, setUmapNNeighbors] = useState(0);
  const [umapMinDist, setUmapMinDist] = useState(0.3);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleModalityChange = (newModality: BiometricModality) => {
    setModality(newModality);
    const availableAlgorithms = MODALITY_ALGORITHMS[newModality];
    setAlgorithm(availableAlgorithms[0]);
  };

  const handleStart = () => {
    onStart({
      modality,
      algorithm,
      dbscanMinPts,
      hdbscanMinSamples,
      useDbscan,
      dbscanEpsKNN,
      umapNNeighbors,
      umapMinDist
    });
  };

  if (fileCount === 0) {
    return null;
  }

  const availableAlgorithms = MODALITY_ALGORITHMS[modality];

  return (
    <section>
    <div className="ml-4 pt-5 pr-3">
      <div className="flex flex-col gap-3 max-w-sm">
        {/* Modality Selection */}
        <div className="flex flex-col gap-1.5">
          <label 
            htmlFor="modality-select"
            className="text-xs font-medium text-black/70 dark:text-white/70"
          >
            Biometric Modality
          </label>
          <select
            id="modality-select"
            value={modality}
            onChange={(e) => handleModalityChange(e.target.value as BiometricModality)}
            disabled={disabled}
            className="h-8 px-3 pr-8
              rounded-md
              border border-black/10 dark:border-white/15
              bg-white dark:bg-white/5
              text-[13px] font-medium
              text-black dark:text-white
              shadow-sm
              appearance-none
              bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%23666%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]
              bg-[length:1.25em] bg-[right_0.3rem_center] bg-no-repeat
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {(Object.keys(MODALITY_ALGORITHMS) as BiometricModality[]).map((mod) => (
              <option key={mod} value={mod}>
                {MODALITY_LABELS[mod]}
              </option>
            ))}
          </select>
        </div>

        {/* Algorithm Selection */}
        <div className="flex flex-col gap-1.5">
          <label 
            htmlFor="algorithm-select"
            className="text-xs font-medium text-black/70 dark:text-white/70"
          >
            Quality Algorithm
          </label>
          <select
            id="algorithm-select"
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as QualityAlgorithm)}
            disabled={disabled}
            className="h-8 px-3 pr-8
              rounded-md
              border border-black/10 dark:border-white/15
              bg-white dark:bg-white/5
              text-[13px] font-medium
              text-black dark:text-white
              shadow-sm
              appearance-none
              bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3cpath%20d%3D%22M7%207l3%203%203-3%22%20stroke%3D%22%23666%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]
              bg-[length:1.25em] bg-[right_0.3rem_center] bg-no-repeat
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {availableAlgorithms.map((alg) => (
              <option key={alg} value={alg}>
                {ALGORITHM_LABELS[alg]}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Settings Toggle */}
        {showAdvanced && (
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            disabled={disabled}
            className="flex items-center gap-2 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors disabled:opacity-50"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-90' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Settings (DBSCAN)
          </button>
        )}

        {/* Advanced Settings Panel */}
        {showAdvanced && advancedOpen && (
          <div className="p-3 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <div className="space-y-3">
                 {/* Todo add upload button for meta data */}
         <button
          type="button" disabled={true} className="self-start
            w-fit
            inline-flex align-right gap-2
            border border-black/10 dark:border-white/15
            bg-gradient-to-b 
              from-white to-black/[0.03]
              dark:from-white/10 dark:to-black/40
              text-[13px] font-medium">
            * Attach meta data
        </button>

              {/* Min Points */}
              <div className="flex flex-col gap-1.5">
                <label 
                  htmlFor="minpts-input"
                  className="text-xs font-medium text-black/70 dark:text-white/70"
                >
                  Min Points (minPts)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="minpts-input"
                    type="number"
                    min="1"
                    max="50"
                    value={dbscanMinPts}
                    onChange={(e) => setDbscanMinPts(parseInt(e.target.value) || 1)}
                    disabled={disabled}
                    className="w-20 h-8 px-3
                      rounded-md
                      border border-black/10 dark:border-white/15
                      bg-white dark:bg-white/5
                      text-[13px] font-medium
                      text-black dark:text-white
                      shadow-sm
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-xs text-black/50 dark:text-white/50">
                    Minimum cluster size
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="minsamples-input"
                  className="text-xs font-medium text-black/70 dark:text-white/70"
                >
                  HDBSCAN Min Samples
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="minsamples-input"
                    type="number"
                    min="1"
                    max="50"
                    value={hdbscanMinSamples}
                    onChange={(e) => setHdbscanMinSamples(parseInt(e.target.value, 10) || 1)}
                    disabled={disabled}
                    className="w-20 h-8 px-3
                      rounded-md
                      border border-black/10 dark:border-white/15
                      bg-white dark:bg-white/5
                      text-[13px] font-medium
                      text-black dark:text-white
                      shadow-sm
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-xs text-black/50 dark:text-white/50">
                    Density conservativeness
                  </span>
                </div>
              </div>

              {/* Eps KNN */}
              <div className="flex flex-col gap-1.5">
                <label 
                  htmlFor="epsknn-input"
                  className="text-xs font-medium text-black/70 dark:text-white/70 flex items-center justify-between"
                >
                  <span>Epsilon KNN</span>
                  <span className="font-normal text-black/50 dark:text-white/50">
                    {(dbscanEpsKNN * 100).toFixed(0)}%
                  </span>
                </label>
                <input
                  id="epsknn-input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={dbscanEpsKNN}
                  onChange={(e) => setDbscanEpsKNN(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer
                    bg-black/10 dark:bg-white/10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-black dark:[&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-0
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-black/50 dark:text-white/50">
                  Distance threshold percentile
                </span>
              </div>

              {/* UMAP Neighbors */}
              <div className="flex flex-col gap-1.5">
                <label 
                  htmlFor="umap-neighbors-input"
                  className="text-xs font-medium text-black/70 dark:text-white/70"
                >
                  UMAP Neighbors (0 = auto)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="umap-neighbors-input"
                    type="number"
                    min="0"
                    max="100"
                    value={umapNNeighbors}
                    onChange={(e) => setUmapNNeighbors(parseInt(e.target.value, 10) || 0)}
                    disabled={disabled}
                    className="w-20 h-8 px-3
                      rounded-md
                      border border-black/10 dark:border-white/15
                      bg-white dark:bg-white/5
                      text-[13px] font-medium
                      text-black dark:text-white
                      shadow-sm
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-xs text-black/50 dark:text-white/50">
                    Local neighborhood size
                  </span>
                </div>
              </div>

              {/* UMAP Min Dist */}
              <div className="flex flex-col gap-1.5">
                <label 
                  htmlFor="umap-mindist-input"
                  className="text-xs font-medium text-black/70 dark:text-white/70 flex items-center justify-between"
                >
                  <span>UMAP Min Dist</span>
                  <span className="font-normal text-black/50 dark:text-white/50">
                    {umapMinDist.toFixed(2)}
                  </span>
                </label>
                <input
                  id="umap-mindist-input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={umapMinDist}
                  onChange={(e) => setUmapMinDist(parseFloat(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer
                    bg-black/10 dark:bg-white/10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-black dark:[&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-0
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-black/50 dark:text-white/50">
                  Minimum separation in embedding
                </span>
              </div>
            </div>

          
          </div>
        )}

        {/* File Count Info */}
        <div className="text-xs text-black/60 dark:text-white/60">
          {fileCount} file{fileCount !== 1 ? 's' : ''} selected
        </div>
        
       

        {/* Start Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={disabled}
          className="self-start
            w-fit
            inline-flex items-center justify-center gap-2
            h-9 px-5
            rounded-md
            border border-black/10 dark:border-white/15
            bg-gradient-to-b 
              from-white to-black/[0.03]
              dark:from-white/10 dark:to-black/40
            text-[13px] font-medium
            text-black dark:text-white
            shadow-sm
            dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]
            hover:bg-gradient-to-b hover:from-white hover:to-black/[0.06]
            dark:hover:from-white/[0.12] dark:hover:to-black/50
            active:bg-gradient-to-b active:from-black/[0.02] active:to-black/[0.08]
            dark:active:from-white/[0.08] dark:active:to-black/60
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          Start Analysis
        </button>
      </div>
    </div>
    </section>
  );
}
