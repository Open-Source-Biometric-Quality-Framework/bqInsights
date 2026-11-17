
import { describe, it, expect, beforeAll } from "vitest";
import * as path from "path";
import * as fs from "fs";

import {
  BQATRunner,
  BQATArgs,
  IMAGE_NAME
} from "./openbq";

import {
  convertWSQToBase64,
  isDockerAvailable,
  isImageAvailable
} from "./openbq"; // adjust path if needed

/* ------------------------------------------------------------------
 * Test configuration
 * ------------------------------------------------------------------ */

const TEST_TIMEOUT_MS = 30000;

const sampleDir = path.resolve(
  __dirname,
  "./sample"
);

const isGitLabCI = process.env.GITLAB_CI === "true";
const dockerAvailable = !isGitLabCI && isDockerAvailable();
const imageAvailable = !isGitLabCI && dockerAvailable && isImageAvailable(IMAGE_NAME);
const dockerReady = !isGitLabCI && dockerAvailable && imageAvailable;
const itIfDocker = dockerReady ? it : it.skip;

if (!dockerReady) {
  const reasons = [
    isGitLabCI ? "running in GitLab CI" : null,
    dockerAvailable ? null : "docker not available",
    dockerAvailable && !imageAvailable ? `image not available: ${IMAGE_NAME}` : null
  ].filter(Boolean);
  console.warn(
    `Skipping WSQ conversion tests (${reasons.join(", ")})`
  );
}

function listWSQFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".wsq"))
    .map(f => path.join(dir, f));
}

/* ------------------------------------------------------------------
 * Integration tests
 * ------------------------------------------------------------------ */

describe("WSQ → Base64 Conversion (BQAT Docker)", () => {
  let wsqFiles: string[] = [];

  beforeAll(() => {
    if (!fs.existsSync(sampleDir)) {
      throw new Error(
        `Sample directory not found: ${sampleDir}`
      );
    }

    wsqFiles = listWSQFiles(sampleDir);

    if (wsqFiles.length === 0) {
      throw new Error(
        `No WSQ files found in sample directory: ${sampleDir}`
      );
    }

    console.log(`✓ Found ${wsqFiles.length} WSQ samples`);
  });

  /* --------------------------------------------------------------
   * Single file conversion
   * ------------------------------------------------------------ */

  itIfDocker("should convert a WSQ image to base64", async () => {
    const wsqPath = wsqFiles[0];

    const base64 = await convertWSQToBase64(wsqPath, {
      imageTag: IMAGE_NAME,
      format: "jpeg"
    });

    expect(base64).toBeDefined();
    expect(typeof base64).toBe("string");

    // Data URL validation
    expect(base64.startsWith("data:image/jpeg;base64,"))
      .toBe(true);

    // Ensure payload exists
    const payload = base64.split(",")[1];
    expect(payload.length).toBeGreaterThan(1000);
  }, TEST_TIMEOUT_MS);

  /* --------------------------------------------------------------
   * Multiple file conversion
   * ------------------------------------------------------------ */

  itIfDocker("should convert all WSQ samples to base64", async () => {
    const results: string[] = [];

    for (const wsqPath of wsqFiles) {
      const base64 = await convertWSQToBase64(wsqPath);
      results.push(base64);
    }

    expect(results.length).toBe(wsqFiles.length);

    for (const b64 of results) {
      expect(b64.startsWith("data:image/jpeg;base64,"))
        .toBe(true);
    }
  }, TEST_TIMEOUT_MS);

  /* --------------------------------------------------------------
   * PNG output option
   * ------------------------------------------------------------ */

  itIfDocker("should support PNG output format", async () => {
    const wsqPath = wsqFiles[0];

    const base64 = await convertWSQToBase64(wsqPath, {
      format: "png"
    });

    expect(base64.startsWith("data:image/png;base64,"))
      .toBe(true);
  }, TEST_TIMEOUT_MS);

  /* --------------------------------------------------------------
   * Invalid file handling
   * ------------------------------------------------------------ */

  itIfDocker("should fail for non-existent WSQ file", async () => {
    const fakePath = path.join(sampleDir, "missing.wsq");

    await expect(
      convertWSQToBase64(fakePath)
    ).rejects.toThrow();
  }, TEST_TIMEOUT_MS);
});
