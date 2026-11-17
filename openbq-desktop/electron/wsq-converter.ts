import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";

import { convertWSQToBase64 } from "@biometix/openbq";

/* ------------------------------------------------------------------
 * Cache directory
 * ------------------------------------------------------------------ */

function getCacheDir(): string {
  const home = os.homedir();
  const dir = path.join(
    home,
    "Library",
    "Application Support",
    "BQAT",
    "wsq-cache"
  );

  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/* ------------------------------------------------------------------
 * Cache key
 * ------------------------------------------------------------------ */

function hashFile(filePath: string): string {
  const stat = fs.statSync(filePath);

  return crypto
    .createHash("sha256")
    .update(filePath)
    .update(String(stat.mtimeMs))
    .digest("hex");
}

/* ------------------------------------------------------------------
 * Conversion queue
 * ------------------------------------------------------------------ */

class WSQConversionQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      await job();
    }

    this.running = false;
  }
}

const queue = new WSQConversionQueue();

/* ------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------ */

export async function convertWSQCached(
  wsqPath: string
): Promise<string> {
  const cacheDir = getCacheDir();
  const key = hashFile(wsqPath);

  const cachedPNG = path.join(cacheDir, `${key}.png`);

  /* --------------------------------------------------------------
   * Cache hit
   * ------------------------------------------------------------ */

  if (fs.existsSync(cachedPNG)) {
    const buf = fs.readFileSync(cachedPNG);
    return `data:image/png;base64,${buf.toString("base64")}`;
  }

  /* --------------------------------------------------------------
   * Queue conversion
   * ------------------------------------------------------------ */

  return queue.enqueue(async () => {
    // Double-check after waiting (another job may have produced it)
    if (fs.existsSync(cachedPNG)) {
      const buf = fs.readFileSync(cachedPNG);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }

    const dataUrl = await convertWSQToBase64(wsqPath, {
      format: "png"
    });

    const base64 = dataUrl.split(",")[1];
    const buf = Buffer.from(base64, "base64");

    fs.writeFileSync(cachedPNG, buf);

    return dataUrl;
  });
}