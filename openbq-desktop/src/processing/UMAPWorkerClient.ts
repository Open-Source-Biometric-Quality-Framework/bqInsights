// UMAPWorkerClient.ts
import UMAPWorker from '../workers/umap.worker.ts?worker';

export type DBSCANParams = {
  dbscanMinPts?: number;
  hdbscanMinSamples?: number;
  useDbscan?: boolean;
  dbscanEpsKNN?: number;
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
};

export default class UMAPWorkerClient {
  private worker: Worker | null = null;

  compute(
    features: number[][], 
    onProgress?: (msg: string) => void,
    dbscanParams?: DBSCANParams
  ) {
    this.destroy();
    this.worker = new UMAPWorker({ type: 'module' });

    return new Promise((resolve, reject) => {
      if (!this.worker) return;

      this.worker.onerror = (err) => {
        reject(new Error(err?.message || 'UMAP worker error'));
        this.destroy();
      };

      this.worker.onmessage = (e) => {
        const msg = e.data;
        
        if (msg.type === 'progress') {
          onProgress?.(msg.message);
        }
        
        if (msg.type === 'done') {
          resolve({
            ...msg.result,
            points: Array.from(msg.result.x, (x, i) => ({
              x,
              y: msg.result.y[i]
            }))
          });
          this.destroy();
        }
        
        if (msg.type === 'error') {
          reject(new Error(msg.error));
          this.destroy();
        }
      };

      // Post message with DBSCAN parameters
      this.worker.postMessage({ 
        type: 'start', 
        features,
        dbscanMinPts: dbscanParams?.dbscanMinPts ?? 5,
        hdbscanMinSamples: dbscanParams?.hdbscanMinSamples ?? dbscanParams?.dbscanMinPts ?? 5,
        useDbscan: dbscanParams?.useDbscan ?? false,
        dbscanEpsKNN: dbscanParams?.dbscanEpsKNN ?? 0.8,
        pcaMinPts: dbscanParams?.pcaMinPts ?? dbscanParams?.dbscanMinPts ?? 5,
        pcaMaxComponents: dbscanParams?.pcaMaxComponents ?? 10,
        pcaSweepIterations: dbscanParams?.pcaSweepIterations ?? 5,
        superclusterMinPoints: dbscanParams?.superclusterMinPoints ?? dbscanParams?.dbscanMinPts ?? 2,
        superclusterRadius: dbscanParams?.superclusterRadius ?? 40,
        superclusterMinZoom: dbscanParams?.superclusterMinZoom ?? 0,
        superclusterMaxZoom: dbscanParams?.superclusterMaxZoom ?? 16,
        umapNNeighbors: dbscanParams?.umapNNeighbors ?? 0,
        umapMinDist: dbscanParams?.umapMinDist ?? 0.3,
        runClustering: dbscanParams?.runClustering ?? true,
        clusterMethod: dbscanParams?.clusterMethod ?? 'umap'
      });
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
  }
}
