import { app, ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const CACHE_VERSION = 1;

function getCacheDir() {
  try {
    const base = app.getPath("userData");
    if (base) {
      return path.join(base, "cache", "openbq", "umap-cache");
    }
  } catch {
    // Fall back to env-based paths below.
  }

  const baseEnv =
    process.env.APPDATA ||
    process.env.HOME ||
    path.join(process.cwd(), ".openbq");

  return path.join(baseEnv, "openbq", "umap-cache");
}

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

async function ensureCacheDir() {
  await fs.mkdir(getCacheDir(), {
    recursive: true
  });
}

/* ---------------- Float normalisation ---------------- */

function normaliseNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6);
}

/* ---------------- Matrix hash ---------------- */

function hashMatrix(
  raw: any
): string {
  const data =
    coerceToMatrix(raw);

  const hash =
    crypto.createHash(
      "sha256"
    );

  for (const row of data) {
    for (const val of row) {
      const norm =
        Number.isFinite(val)
          ? val.toFixed(6)
          : "0";

      hash.update(norm);
    }
  }

  return hash
    .digest("hex")
    .slice(0, 16);
}

/* ---------------- Cache key ---------------- */

function makeCacheKey(
  features: number[][],
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
) {
  const dataHash = hashMatrix(
    features
  );

  return [
    "umap2",
    dataHash,
    `neighbors${params.umapNNeighbors ?? 0}`,
    `dist${normaliseNumber(params.umapMinDist ?? 0.3)}`,
    `algo${params.useDbscan ? "dbscan" : "hdbscan"}`,
    `min${params.dbscanMinPts}`,
    `minsamples${params.hdbscanMinSamples ?? params.dbscanMinPts}`,
    `eps${params.dbscanEpsKNN}`,
    `pcamin${params.pcaMinPts ?? 0}`,
    `pcamax${params.pcaMaxComponents ?? 0}`,
    `pcasweep${params.pcaSweepIterations ?? 0}`,
    `scmin${params.superclusterMinPoints ?? 0}`,
    `scrad${params.superclusterRadius ?? 0}`,
    `scminz${params.superclusterMinZoom ?? 0}`,
    `scmaxz${params.superclusterMaxZoom ?? 0}`,
    `cluster${params.runClustering === false ? 0 : 1}`,
    `method${params.clusterMethod ?? 'umap'}`
  ].join("_");
}

function coerceToMatrix(
  input: any
): number[][] {
  if (!Array.isArray(input)) {
    throw new Error(
      "Features must be an array"
    );
  }

  return input.map((row, i) => {
    // Already number[]
    if (Array.isArray(row)) {
      return row.map(Number);
    }

    // TypedArray (Float32Array etc.)
    if (
      ArrayBuffer.isView(row)
    ) {
      return Array.from(
        row as any
      ).map(Number);
    }

    // Object row → take numeric values
    if (
      row &&
      typeof row === "object"
    ) {
      const vals =
        Object.values(row)
          .filter(
            (v) =>
              typeof v ===
              "number"
          )
          .map(Number);

      if (!vals.length) {
        throw new Error(
          `Row ${i} contains no numeric values`
        );
      }

      return vals;
    }

    throw new Error(
      `Row ${i} is not iterable`
    );
  });
}
/* ---------------- File path ---------------- */

function getCachePath(key: string) {
  return path.join(
    getCacheDir(),
    `${key}.json`
  );
}

/* ------------------------------------------------------------------ */
/* Normalisation + Rehydration                                        */
/* ------------------------------------------------------------------ */

function toNumberArray(
  value: any
): number[] {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(
      (v) =>
        Number.isFinite(v)
          ? Number(v)
          : 0
    );
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(
      value as any,
      (v) =>
        Number.isFinite(v)
          ? Number(v)
          : 0
    );
  }

  if (
    typeof value === "object" &&
    Number.isFinite(
      (value as any).length
    )
  ) {
    const len = Number(
      (value as any).length
    );
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      const v = (value as any)[i];
      arr[i] =
        Number.isFinite(v)
          ? Number(v)
          : 0;
    }
    return arr;
  }

  return [];
}

function normaliseForCache(
  input: any
) {
  if (!input || typeof input !== "object")
    return input;

  return {
    ...input,
    x: toNumberArray(input.x),
    y: toNumberArray(input.y),
    categories: toNumberArray(
      input.categories
    )
  };
}

function rehydrateUMAPResult(
  input: any
) {
  if (!input || typeof input !== "object")
    return null;

  const source =
    input.umapResult &&
    typeof input.umapResult === "object"
      ? input.umapResult
      : input;

  const xArr = toNumberArray(
    source.x
  );
  const yArr = toNumberArray(
    source.y
  );

  if (
    (!xArr.length ||
      !yArr.length) &&
    Array.isArray(
      source.points
    )
  ) {
    const px = new Array(
      source.points.length
    );
    const py = new Array(
      source.points.length
    );
    for (
      let i = 0;
      i < source.points.length;
      i++
    ) {
      const p =
        source.points[i];
      px[i] =
        Number.isFinite(p?.x)
          ? Number(p.x)
          : 0;
      py[i] =
        Number.isFinite(p?.y)
          ? Number(p.y)
          : 0;
    }
    xArr.splice(0, xArr.length, ...px);
    yArr.splice(0, yArr.length, ...py);
  }
  const catArr = toNumberArray(
    source.categories ?? source.category
  );

  const x = new Float32Array(
    xArr
  );
  const y = new Float32Array(
    yArr
  );
  let categories = new Uint8Array(
    catArr
  );
  if (
    categories.length !==
    x.length
  ) {
    categories = new Uint8Array(
      x.length
    );
  }

  const points =
    Array.isArray(source.points) &&
    source.points.length === x.length
      ? source.points
      : Array.from(x, (vx, i) => ({
          x: vx,
          y: y[i]
        }));

  return {
    ...source,
    x,
    y,
    categories,
    points
  };
}

/* ------------------------------------------------------------------ */
/* Cache Read                                                         */
/* ------------------------------------------------------------------ */

async function readCache(
  key: string
) {
  const file =
    getCachePath(key);

  try {
    const raw =
      await fs.readFile(
        file,
        "utf-8"
      );

    const parsed =
      JSON.parse(raw);

    if (
      parsed.version !==
      CACHE_VERSION
    ) {
      return null;
    }

    return rehydrateUMAPResult(
      parsed.data
    );
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Cache Write                                                        */
/* ------------------------------------------------------------------ */

async function writeCache(
  key: string,
  data: any
) {
  const file =
    getCachePath(key);

  const envelope = {
    version:
      CACHE_VERSION,
    created: Date.now(),
    data: normaliseForCache(
      data
    )
  };

  await fs.writeFile(
    file,
    JSON.stringify(
      envelope,
      null,
      2
    ),
    "utf-8"
  );
}

/* ------------------------------------------------------------------ */
/* IPC Registration                                                   */
/* ------------------------------------------------------------------ */

export function registerUmapCacheHandlers() {
  /* ---------------- GET ---------------- */

  ipcMain.handle(
    "umap-cache:get",
    async (
      _event,
      features: number[][],
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
    ) => {
      await ensureCacheDir();

      const key =
        makeCacheKey(
          features,
          params
        );

      const cached =
        await readCache(key);

      return {
        key,
        cached
      };
    }
  );

  /* ---------------- SET ---------------- */

  ipcMain.handle(
    "umap-cache:set",
    async (
      _event,
      key: string,
      result: any
    ) => {
      await ensureCacheDir();

      await writeCache(
        key,
        result
      );

      return {
        success: true
      };
    }
  );

  /* ---------------- CLEAR (optional) ---------------- */

  ipcMain.handle(
    "umap-cache:clear",
    async () => {
      await ensureCacheDir();

      const files =
        await fs.readdir(
          getCacheDir()
        );

      await Promise.all(
        files.map((f) =>
          fs.unlink(
            path.join(
              getCacheDir(),
              f
            )
          )
        )
      );

      return {
        success: true,
        cleared:
          files.length
      };
    }
  );
}
