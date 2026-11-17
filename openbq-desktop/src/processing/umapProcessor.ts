// umapProcessor.ts - UMAP embedding computation

import { createUMAP } from 'embedding-atlas';
import type { Point2D, UMAPResult } from '../utils/types';
import { runHDBSCAN } from './clustering';
import type { DBSCANParams } from './UMAPWorkerClient'

function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => {
    // rAF gives React + layout a chance to flush
    requestAnimationFrame(() => resolve());
  });
}

export default class UMAPProcessor {
  private umapInstance: any = null;

  async compute(
    features: number[][],
    onProgress?: (message: string) => void,
     dbscanMinPts?: number,
     dbscanEpsKNN?:number
  ): Promise<UMAPResult> {
    onProgress?.(`🔄 Computing UMAP embedding! ${dbscanMinPts} ,${dbscanEpsKNN} ...`);


    try {
      // Clean up previous instance
      this.destroy();

      const n = features.length;
      const d = features[0].length;

      // Convert to Float32Array
      const data = new Float32Array(n * d);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < d; j++) {
          data[i * d + j] = features[i][j];
        }
      }

      const nNeighbors = Math.min(15, Math.max(5, Math.floor(n / 50)));

      onProgress?.(`⚙️ Creating UMAP with ${nNeighbors} neighbors...`);

      const umap = await createUMAP(
        n,
        d,
        2,
        data,
        {
          metric: 'euclidean',
          nNeighbors,
          minDist: 0.3,
        }
      );

      this.umapInstance = umap;

      onProgress?.('🔄 Running UMAP iterations...');

      for (let i = 0; i < 100; i++) {
        // Run to the i-th epoch.
        umap.run(i);
        onProgress?.(`🔄 Running UMAP ${i}...`);
         if (i % 2 === 0) {
            await yieldToBrowser();
        }
      }

      const emb = umap.embedding;

      // Extract x and y coordinates
      const x = new Float32Array(n);
      const y = new Float32Array(n);
      const points: Point2D[] = [];

      for (let i = 0; i < n; i++) {
        x[i] = emb[i * 2];
        y[i] = emb[i * 2 + 1];
        points.push({ x: x[i], y: y[i] });
      }

      onProgress?.(`✅ UMAP completed (${n} points)`);

      // Run clustering
      const { labels } = runHDBSCAN(points, onProgress);

      // Convert labels to category array
      const categories = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        categories[i] = labels[i] < 0 ? 255 : labels[i];
      }

      return {
        x,
        y,
        categories,
        points
      };

    } catch (err: any) {
      onProgress?.(`❌ UMAP Error: ${err.message}`);
      throw err;
    }
  }

  destroy(): void {
    if (this.umapInstance) {
      this.umapInstance.destroy();
      this.umapInstance = null;
    }
  }
}
