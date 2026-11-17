// umap.worker.ts
// Runs UMAP + clustering off the main thread with progress streaming

import { createUMAP } from 'embedding-atlas';
import { runDBSCAN, runHDBSCAN } from '../processing/clustering';
import type { Point2D } from '../utils/types';

type WorkerMessage =
  | {
      type: 'start';
      features: number[][];
      dbscanMinPts?: number;
      hdbscanMinSamples?: number;
      useDbscan?: boolean;
      dbscanEpsKNN?: number;
      pcaMinPts?: number;
      pcaMaxComponents?: number;
      pcaSweepIterations?: number;
      umapNNeighbors?: number;
      umapMinDist?: number;
      runClustering?: boolean;
      clusterMethod?: 'umap' | 'pca' | 'supercluster' | 'jsdbscan';
      superclusterMinPoints?: number;
      superclusterRadius?: number;
      superclusterMinZoom?: number;
      superclusterMaxZoom?: number;
    }
  | {
      type: 'cancel';
    };

let cancelled = false;
let umapInstance: any = null;

function postProgress(message: string) {
  (self as DedicatedWorkerGlobalScope).postMessage({
    type: 'progress',
    message
  });
}

function cleanup() {
  if (umapInstance) {
    try {
      umapInstance.destroy();
    } catch {}
    umapInstance = null;
  }
}

(self as DedicatedWorkerGlobalScope).onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    cancelled = true;
    cleanup();
    postProgress('⛔ UMAP cancelled');
    return;
  }

  if (msg.type !== 'start') return;

  cancelled = false;

  try {
    const features = msg.features;
    const n = features.length;
    const d = features[0].length;

    postProgress('🔄 Computing UMAP embedding...');

    // Flatten features into Float32Array
    const data = new Float32Array(n * d);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < d; j++) {
        data[i * d + j] = features[i][j];
      }
    }

    const nNeighbors = (msg.umapNNeighbors && msg.umapNNeighbors > 0)
      ? msg.umapNNeighbors
      : Math.min(15, Math.max(5, Math.floor(n / 50)));
    postProgress(`⚙️ Creating UMAP with ${nNeighbors} neighbours...`);

    const umap = await createUMAP(
      n,
      d,
      2,
      data,
      {
        metric: 'euclidean',
        nNeighbors,
        minDist: msg.umapMinDist ?? 0.3
      }
    );

    umapInstance = umap;

    postProgress('🔄 Running UMAP iterations...');

    const ITERATIONS = 100;
    for (let i = 0; i < ITERATIONS; i++) {
      if (cancelled) {
        cleanup();
        return;
      }

      umap.run(i);

      // Throttle progress spam
      if (i % 20 === 0) {
        postProgress(`🔄 Running UMAP ${i + 1}/${ITERATIONS}`);
        // Yield cooperatively inside the worker
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const emb = umap.embedding;

    // Extract x/y
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const points: Point2D[] = new Array(n);

    for (let i = 0; i < n; i++) {
      x[i] = emb[i * 2];
      y[i] = emb[i * 2 + 1];
      points[i] = { x: x[i], y: y[i] };
    }

    const categories = new Uint8Array(n);

    if (msg.runClustering === false) {
      postProgress('🟡 Skipping clustering (single cluster)');
      for (let i = 0; i < n; i++) {
        categories[i] = 0;
      }
    } else {
      const method = msg.clusterMethod ?? 'umap';
      postProgress(
        method === 'pca'
          ? `🧮 Running PCA + ${msg.useDbscan ? 'DBSCAN' : 'HDBSCAN'} clustering...`
          : method === 'jsdbscan'
            ? '🔎 Running JavaScript DBSCAN clustering...'
          : `🔎 Running ${msg.useDbscan ? 'DBSCAN' : 'HDBSCAN'} clustering...`
      );

      const { labels } =
        method === 'pca'
          ? await (async () => {
              const { runPCAClustering } = await import('../processing/pca_clustering');
              return runPCAClustering(
                features,
                (msg: string) => {
                  postProgress(msg);
                },
                {
                  minPts: msg.pcaMinPts ?? msg.dbscanMinPts,
                  maxComponents: msg.pcaMaxComponents
                }
              );
            })()
          : method === 'supercluster'
            ? await (async () => {
                const { runSupercluster } = await import('../processing/supercluster_clustering');
                return runSupercluster(
                  points,
                  (msg: string) => {
                    postProgress(msg);
                  },
                  {
                    minPoints: msg.superclusterMinPoints ?? msg.dbscanMinPts,
                    radius: msg.superclusterRadius,
                    minZoom: msg.superclusterMinZoom,
                    maxZoom: msg.superclusterMaxZoom
                  }
                );
              })()
              : method === 'jsdbscan'
                ? runDBSCAN(
                    points,
                    (progressMessage: string) => {
                      postProgress(progressMessage);
                    },
                    {
                      minPts: msg.dbscanMinPts,
                      minSamples: msg.hdbscanMinSamples,
                      epsKNN: msg.dbscanEpsKNN
                    }
                  )
              : msg.useDbscan
                ? runDBSCAN(
                    points,
                    (progressMessage: string) => {
                      postProgress(progressMessage);
                    },
                    {
                      minPts: msg.dbscanMinPts,
                      minSamples: msg.hdbscanMinSamples,
                      epsKNN: msg.dbscanEpsKNN
                    }
                  )
                : runHDBSCAN(
                    points,
                    (progressMessage: string) => {
                      postProgress(progressMessage);
                    },
                    {
                      minPts: msg.dbscanMinPts,
                      minSamples: msg.hdbscanMinSamples,
                      epsKNN: msg.dbscanEpsKNN
                    }
                  );

      for (let i = 0; i < n; i++) {
        categories[i] = labels[i] < 0 ? 255 : labels[i];
      }
    }

    cleanup();

    postProgress(`✅ UMAP completed (${n} points)`);

    // Transfer typed arrays back to main thread
    (self as DedicatedWorkerGlobalScope).postMessage(
      {
        type: 'done',
        result: {
          x,
          y,
          categories
        }
      },
      [x.buffer, y.buffer, categories.buffer]
    );

  } catch (err: any) {
    cleanup();
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: 'error',
      error: err?.message ?? String(err)
    });
  }
};
