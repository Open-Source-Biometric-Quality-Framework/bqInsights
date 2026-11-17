import React from 'react';

type ClusterSettingsProps = {
  minPts: number;
  minSamples: number;
  useDbscan: boolean;
  eps: number;
  umapNeighbors: number;
  umapMinDist: number;
  runClustering: boolean;
  clusterMethod: 'umap' | 'jsdbscan';
  excludeNonScalar: boolean;
  oneHotEncode: boolean;
  excludeLowVariance: boolean;
  onChangeMinPts: (value: number) => void;
  onChangeMinSamples: (value: number) => void;
  onToggleUseDbscan: (value: boolean) => void;
  onChangeEps: (value: number) => void;
  onChangeUmapNeighbors: (value: number) => void;
  onChangeUmapMinDist: (value: number) => void;
  onChangeClusterMethod: (value: 'umap' | 'jsdbscan') => void;
  onToggleExcludeNonScalar: (value: boolean) => void;
  onToggleOneHotEncode: (value: boolean) => void;
  onToggleExcludeLowVariance: (value: boolean) => void;
  onApply: () => void;
};

export const ClusterSettings: React.FC<ClusterSettingsProps> = ({
  minPts,
  minSamples,
  useDbscan,
  eps,
  umapNeighbors,
  umapMinDist,
  runClustering,
  clusterMethod,
  excludeNonScalar,
  oneHotEncode,
  excludeLowVariance,
  onChangeMinPts,
  onChangeMinSamples,
  onToggleUseDbscan,
  onChangeEps,
  onChangeUmapNeighbors,
  onChangeUmapMinDist,
  onChangeClusterMethod,
  onToggleExcludeNonScalar,
  onToggleOneHotEncode,
  onToggleExcludeLowVariance,
  onApply
}) => {
  type ClusterSensitivity = 'fine' | 'balanced' | 'coarse' | 'custom';

  const presets: Record<Exclude<ClusterSensitivity, 'custom'>, {
    minPts: number;
    minSamples: number;
    eps: number;
    umapNeighbors: number;
    umapMinDist: number;
  }> = {
    fine: { minPts: 4, minSamples: 2, eps: 0.25, umapNeighbors: 8, umapMinDist: 0.05 },
    balanced: { minPts: 5, minSamples: 5, eps: 0.6, umapNeighbors: 15, umapMinDist: 0.3 },
    coarse: { minPts: 12, minSamples: 10, eps: 0.85, umapNeighbors: 35, umapMinDist: 0.5 }
  };

  const activeSensitivity: ClusterSensitivity =
    minPts === presets.fine.minPts &&
    minSamples === presets.fine.minSamples &&
    Math.abs(eps - presets.fine.eps) < 1e-6 &&
    umapNeighbors === presets.fine.umapNeighbors &&
    Math.abs(umapMinDist - presets.fine.umapMinDist) < 1e-6
      ? 'fine'
      : minPts === presets.balanced.minPts &&
          minSamples === presets.balanced.minSamples &&
          Math.abs(eps - presets.balanced.eps) < 1e-6 &&
          umapNeighbors === presets.balanced.umapNeighbors &&
          Math.abs(umapMinDist - presets.balanced.umapMinDist) < 1e-6
        ? 'balanced'
        : minPts === presets.coarse.minPts &&
            minSamples === presets.coarse.minSamples &&
            Math.abs(eps - presets.coarse.eps) < 1e-6 &&
            umapNeighbors === presets.coarse.umapNeighbors &&
            Math.abs(umapMinDist - presets.coarse.umapMinDist) < 1e-6
          ? 'coarse'
          : 'custom';

  const applySensitivity = (mode: Exclude<ClusterSensitivity, 'custom'>) => {
    const preset = presets[mode];
    onChangeMinPts(preset.minPts);
    onChangeMinSamples(preset.minSamples);
    onChangeEps(preset.eps);
    onChangeUmapNeighbors(preset.umapNeighbors);
    onChangeUmapMinDist(preset.umapMinDist);
  };

  const selectedMethod: 'umap' | 'jsdbscan' = clusterMethod === 'jsdbscan' ? 'jsdbscan' : 'umap';

  return (
    <div className="rounded-md border border-black/10 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/70 p-3 space-y-3">
      <div className="text-xs font-semibold text-black/80 dark:text-gray-100">Cluster Settings</div>
      {!runClustering && (
        <div className="rounded-md border border-black/10 dark:border-white/10 bg-yellow-50/80 dark:bg-yellow-900/20 px-2.5 py-1.5 text-[11px] text-yellow-900 dark:text-yellow-200">
          Clustering not run yet, click Apply to generate clusters.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-black/70 dark:text-gray-300">
          Cluster Sensitivity
        </label>
        <select
          value={activeSensitivity}
          onChange={(e) => {
            const value = e.target.value as ClusterSensitivity;
            if (value !== 'custom') {
              applySensitivity(value);
            }
          }}
          className="h-8 px-3 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/70 dark:bg-black/30 text-[13px] font-medium text-black dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="fine">Fine (more clusters)</option>
          <option value="balanced">Balanced</option>
          <option value="coarse">Coarse (fewer clusters)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onApply}
        className="self-start w-fit inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/80 dark:bg-black/30 text-[12px] font-medium text-black dark:text-gray-100 shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors"
      >
        Apply
      </button>

      <details className="rounded-md border border-black/10 dark:border-gray-700/60 bg-black/[0.02] dark:bg-black/20">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-black/70 dark:text-gray-300 select-none">
          Advanced Settings
        </summary>
        <div className="border-t border-black/10 dark:border-gray-700/60 p-3 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300">
              Clustering Method
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => onChangeClusterMethod(e.target.value as 'umap' | 'jsdbscan')}
              className="h-8 px-3 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/70 dark:bg-black/30 text-[13px] font-medium text-black dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="jsdbscan">Standard</option>
              <option value="umap">Advanced</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300">
              Min Points (minPts)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="50"
                value={minPts}
                onChange={(e) => onChangeMinPts(parseInt(e.target.value, 10) || 1)}
                className="w-20 h-8 px-3 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/70 dark:bg-black/30 text-[13px] font-medium text-black dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-xs text-black/50 dark:text-gray-400">Minimum cluster size</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300">
              Min Samples
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="50"
                value={minSamples}
                onChange={(e) => onChangeMinSamples(parseInt(e.target.value, 10) || 1)}
                className="w-20 h-8 px-3 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/70 dark:bg-black/30 text-[13px] font-medium text-black dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-xs text-black/50 dark:text-gray-400">Density conservativeness</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-black/70 dark:text-gray-300">
            <input
              type="checkbox"
              checked={useDbscan}
              onChange={(e) => onToggleUseDbscan(e.target.checked)}
              className="h-3 w-3 rounded border border-black/20 dark:border-gray-600 bg-white/80 dark:bg-black/40 text-blue-500"
            />
            Use DBSCAN (disable HDBSCAN)
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300 flex items-center justify-between">
              <span>Legacy Epsilon KNN</span>
              <span className="font-normal text-black/50 dark:text-gray-400">
                {(eps * 100).toFixed(0)}%
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={eps}
              onChange={(e) => onChangeEps(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer
                bg-black/10 dark:bg-gray-700/60
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-black dark:[&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0"
            />
            <span className="text-xs text-black/50 dark:text-gray-400">Retained for profile compatibility (unused by HDBSCAN)</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300">
              UMAP Neighbors (0 = auto)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                value={umapNeighbors}
                onChange={(e) => onChangeUmapNeighbors(parseInt(e.target.value, 10) || 0)}
                className="w-20 h-8 px-3 rounded-md border border-black/10 dark:border-gray-700/60 bg-white/70 dark:bg-black/30 text-[13px] font-medium text-black dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-xs text-black/50 dark:text-gray-400">Local neighborhood size</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/70 dark:text-gray-300 flex items-center justify-between">
              <span>UMAP Min Dist</span>
              <span className="font-normal text-black/50 dark:text-gray-400">
                {umapMinDist.toFixed(2)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={umapMinDist}
              onChange={(e) => onChangeUmapMinDist(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer
                bg-black/10 dark:bg-gray-700/60
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-black dark:[&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0"
            />
            <span className="text-xs text-black/50 dark:text-gray-400">Minimum separation in embedding</span>
          </div>

          <label className="flex items-center gap-2 text-xs text-black/70 dark:text-gray-300">
            <input
              type="checkbox"
              checked={excludeNonScalar}
              onChange={(e) => onToggleExcludeNonScalar(e.target.checked)}
              className="h-3 w-3 rounded border border-black/20 dark:border-gray-600 bg-white/80 dark:bg-black/40 text-blue-500"
            />
            Exclude Non Scalar
          </label>

          <label className="flex items-center gap-2 text-xs text-black/70 dark:text-gray-300">
            <input
              type="checkbox"
              checked={oneHotEncode}
              onChange={(e) => onToggleOneHotEncode(e.target.checked)}
              className="h-3 w-3 rounded border border-black/20 dark:border-gray-600 bg-white/80 dark:bg-black/40 text-blue-500"
            />
            One-hot Encode Categories
          </label>

          <label className="flex items-center gap-2 text-xs text-black/70 dark:text-gray-300">
            <input
              type="checkbox"
              checked={excludeLowVariance}
              onChange={(e) => onToggleExcludeLowVariance(e.target.checked)}
              className="h-3 w-3 rounded border border-black/20 dark:border-gray-600 bg-white/80 dark:bg-black/40 text-blue-500"
            />
            Exclude Low Variance
          </label>
        </div>
      </details>
    </div>
  );
};
