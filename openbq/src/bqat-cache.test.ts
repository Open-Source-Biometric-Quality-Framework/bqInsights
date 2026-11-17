import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';

import {
  BQATRunner,
  BQATArgs,
  IMAGE_NAME,
  isDockerAvailable,
  isImageAvailable
} from './openbq';

/**
 * BQAT Cache Tests with Real Sample Images
 *
 * Uses real biometric samples to validate:
 *  - Cache creation
 *  - Cache hits
 *  - Cache invalidation
 *  - Output persistence
 */

const isGitLabCI = process.env.GITLAB_CI === 'true';
const dockerAvailable = !isGitLabCI && isDockerAvailable();
const imageAvailable = !isGitLabCI && dockerAvailable && isImageAvailable(IMAGE_NAME);
const dockerReady = !isGitLabCI && dockerAvailable && imageAvailable;
const describeIfDocker = dockerReady ? describe : describe.skip;

if (!dockerReady) {
  const reasons = [
    isGitLabCI ? 'running in GitLab CI' : null,
    dockerAvailable ? null : 'docker not available',
    dockerAvailable && !imageAvailable ? `image not available: ${IMAGE_NAME}` : null
  ].filter(Boolean);
  console.warn(
    `Skipping BQAT cache tests (${reasons.join(', ')})`
  );
}

describeIfDocker('BQAT Cache with Real Images', () => {
  let testDir: string;
  let inputDir: string;
  let outputDir: string;
  let runner: BQATRunner;

  /**
   * Create temp test workspace
   */
  beforeAll(() => {
    const tmp = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bqat-cache-test-')
    );

    testDir = tmp;
    inputDir = path.join(testDir, 'input');
    outputDir = path.join(testDir, 'output');

    fs.mkdirSync(inputDir);
    fs.mkdirSync(outputDir);

    /**
     * Copy sample images
     * Assumes repo has /sample/face/*
     */
    const sampleDir = path.resolve(
      __dirname,
      './sample'
    );

    if (!fs.existsSync(sampleDir)) {
      throw new Error(
        `Sample images not found at ${sampleDir}`
      );
    }

    for (const file of fs.readdirSync(sampleDir)) {
      fs.copyFileSync(
        path.join(sampleDir, file),
        path.join(inputDir, file)
      );
    }

    runner = new BQATRunner(IMAGE_NAME);
  });

  /**
   * Clean output between runs
   */
  beforeEach(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);
  });

  /**
   * Cleanup temp workspace
   */
  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to compute directory hash
   * Mirrors runner logic
   */
  function hashDirectory(dir: string): string {
    const hash = crypto.createHash('sha256');

    function walk(p: string) {
      const entries = fs
        .readdirSync(p, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const e of entries) {
        const full = path.join(p, e.name);
        hash.update(e.name);

        if (e.isDirectory()) {
          walk(full);
        } else {
          const stat = fs.statSync(full);
          hash.update(String(stat.size));
          hash.update(String(stat.mtimeMs));
        }
      }
    }

    walk(dir);
    return hash.digest('hex');
  }

  /**
   * Base args used in most tests
   */
  const baseArgs: BQATArgs = {
    mode: 'face',
    input: '',
    output: '',
    report: true
  };

  it('creates cache on first run', async () => {
    const args: BQATArgs = {
      ...baseArgs,
      input: inputDir,
      output: outputDir
    };

    const result = await runner.run(args);

    
  }, 300000);

  it('hits cache on second identical run', async () => {
    const args: BQATArgs = {
      ...baseArgs,
      input: inputDir,
      output: outputDir
    };

    const logs: string[] = [];

    runner.on('progress', (e: any) => {
      logs.push(e.message);
    });

    await runner.run(args);

    const cacheHit = logs.some(m =>
      m.includes('Using cached BQAT results')
    );

    expect(cacheHit).toBe(true);
  }, 300000);

  it('invalidates cache when input file changes', async () => {
    const testImage = fs
      .readdirSync(inputDir)
      .find(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png'));

    if (!testImage) {
      throw new Error('No image found for mutation test');
    }

    const imgPath = path.join(inputDir, testImage);

    /**
     * Modify file timestamp
     */
    const now = new Date();
    fs.utimesSync(imgPath, now, now);

    const args: BQATArgs = {
      ...baseArgs,
      input: inputDir,
      output: outputDir,
      engine: 'bqat'
    };

    const logs: string[] = [];

    runner.on('progress', (e: any) => {
      logs.push(e.message);
    });

    await runner.run(args);

    const cacheHit = logs.some(m =>
      m.includes('Using cached BQAT results')
    );

    expect(cacheHit).toBe(false);
  }, 300000);

  it('invalidates cache when args change', async () => {
    const args: BQATArgs = {
      ...baseArgs,
      input: inputDir,
      output: outputDir,
      engine: 'ofiq' // changed arg
    };

    const logs: string[] = [];

    runner.on('progress', (e: any) => {
      logs.push(e.message);
    });

    await runner.run(args);

    const cacheHit = logs.some(m =>
      m.includes('Using cached BQAT results')
    );

    expect(cacheHit).toBe(false);
  }, 300000);

  it('persists cached result files', async () => {
    const args: BQATArgs = {
      ...baseArgs,
      input: inputDir,
      output: outputDir
    };

    const result = await runner.run(args);

    const paths = result.getAllPaths();

    expect(paths.csv).toBeDefined();

    if (!fs.existsSync(paths.csv!)) {
      console.error(
        "CSV missing at:",
        paths.csv,
        "Cache dir contents:",
        fs.readdirSync(path.dirname(paths.csv!))
      );
    }

    expect(fs.existsSync(paths.csv!)).toBe(true);

    if (paths.report) {
      expect(fs.existsSync(paths.report)).toBe(true);
    }

    if (paths.previewTable) {
      expect(fs.existsSync(paths.previewTable)).toBe(true);
    }
  }, 300000);

  it('produces stable directory hash', () => {
    const h1 = hashDirectory(inputDir);
    const h2 = hashDirectory(inputDir);

    expect(h1).toBe(h2);
  });

});
