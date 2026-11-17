// openbq.ts
//
// Cache-first BQAT Docker runner.
// Key properties:
// - Deterministic cache key from input directory + args + imageTag
// - Output is ALWAYS written directly into an app-safe cache directory (host)
// - That cache directory is mounted into the container as /app/output
// - No post-run copying is required
// - Backwards-compatible API surface for Electron IPC:
//   - ensureReady
//   - ProgressEvent
//   - BQATResultData with getSummary/getAllPaths/loadCSV/loadCSVParsed
//   - runContainer/analyze/benchmark/version/help/updateBQAT/uninstallBQAT
//
// Assumptions:
// - Container runs `python3 -m bqat ...`
// - CLI accepts --input/--output and other flags
// - Results include a CSV and optionally report HTMLs and a log JSON

import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { EventEmitter } from "events";
import crypto from "crypto";

/**
 * Configuration constants
 */
export const IMAGE_NAME = "ghcr.io/open-source-biometric-quality-framework/bqcore-service:latest";

/**
 * Supported biometric modalities
 */
export type BQATMode = "face" | "finger" | "iris" | "voice";

/**
 * BQAT CLI arguments interface
 */
export interface BQATArgs {
  mode?: BQATMode;
  input?: string;
  output?: string; // user output is accepted but ignored for cache-first execution
  engine?: string;
  report?: boolean;
  benchmark?: boolean;
  version?: boolean;
  help?: boolean;
  [key: string]: any;
}

/**
 * Docker run options
 */
export interface DockerRunOptions {
  imageTag?: string;
  shmSize?: string;
  removeContainer?: boolean;
  interactive?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onProgress?: (progress: ProgressEvent) => void;
}

/**
 * Progress event interface
 */
export interface ProgressEvent {
  type: "stdout" | "stderr" | "start" | "end" | "error";
  message: string;
  timestamp: Date;
  code?: number;
}

/**
 * BQAT Result interface
 */
export interface BQATResult {
  summary?: BQATSummary;
  outputPath?: string;
  csvPath?: string;
  reportPath?: string;
  previewTablePath?: string;
  logPath?: string;
  rawOutput: string;
}

/**
 * BQAT Summary from JSON output
 */
export interface BQATSummary {
  "Total process time": string;
  "System throughput": string;
  "Assessment Task": {
    Processed: number;
    Input: string;
    Output: string;
    Report?: {
      "Preview Table"?: string;
      "EDA Report"?: string;
    };
    Log: string;
  };
}

/**
 * Result object wrapper (backwards compatible)
 */
export class BQATResultData {
  private result: BQATResult;
  private baseOutputPath: string;

  constructor(result: BQATResult, baseOutputPath: string) {
    this.result = result;
    this.baseOutputPath = baseOutputPath;
  }

  getSummary(): BQATSummary | undefined {
    return this.result.summary;
  }

  getCSVPath(): string | undefined {
    return this.result.csvPath;
  }

  getReportPath(): string | undefined {
    return this.result.reportPath;
  }

  getPreviewTablePath(): string | undefined {
    return this.result.previewTablePath;
  }

  getLogPath(): string | undefined {
    return this.result.logPath;
  }

  getRawOutput(): string {
    return this.result.rawOutput;
  }

  getAllPaths(): {
    csv?: string;
    report?: string;
    previewTable?: string;
    log?: string;
  } {
    return {
      csv: this.result.csvPath,
      report: this.result.reportPath,
      previewTable: this.result.previewTablePath,
      log: this.result.logPath
    };
  }

  async loadCSV(): Promise<string> {
    if (!this.result.csvPath) {
      throw new Error("No CSV file path available in results");
    }

    const csvPath = this.result.csvPath;

    if (path.isAbsolute(csvPath) && fs.existsSync(csvPath)) {
      return fs.promises.readFile(csvPath, "utf-8");
    }

    // Fallback: try baseOutputPath + basename
    const candidates: string[] = [
      csvPath,
      path.resolve(csvPath),
      path.join(this.baseOutputPath, path.basename(csvPath)),
      path.join(this.baseOutputPath, csvPath)
    ];

    for (const candidate of candidates) {
      const normalized = path.normalize(candidate);
      if (fs.existsSync(normalized)) {
        return fs.promises.readFile(normalized, "utf-8");
      }
    }

    throw new Error(
      `CSV file not found. Tried:\n${candidates.map(c => `  - ${c}`).join("\n")}`
    );
  }

  async loadCSVParsed(): Promise<Record<string, any>[]> {
    const csvContent = await this.loadCSV();
    return parseCSV(csvContent);
  }
}

/**
 * Simple CSV parser (keeps earlier semantics)
 */
function parseCSV(csvContent: string): Record<string, any>[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map(h => h.trim().replace(/^"|"$/g, ""));

  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(",")
      .map(v => v.trim().replace(/^"|"$/g, ""));

    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      const value = values[index] ?? "";

      if (header === "file") {
        row[header] = value;
        return;
      }

      if (/^-?\d+(\.\d+)?$/.test(value)) {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

/* ------------------------------------------------------------------
 * App directories
 * ------------------------------------------------------------------ */

function getBQATAppDir(): string {
  const home = os.homedir();
  const plat = os.platform();

  if (plat === "darwin") {
    return path.join(home, "Library", "Application Support", "BQAT");
  }

  if (plat === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(localAppData, "BQAT");
  }

  return path.join(process.env.XDG_CACHE_HOME || path.join(home, ".cache"), "bqat");
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function getCacheRoot(): string {
  const root = path.join(getBQATAppDir(), "cache");
  ensureDir(root);
  return root;
}

function getCacheEntryDir(key: string): string {
  const dir = path.join(getCacheRoot(), key);
  ensureDir(dir);
  return dir;
}

/* ------------------------------------------------------------------
 * Docker discovery / readiness
 * ------------------------------------------------------------------ */

function resolveDockerBinary(): string {
  const plat = os.platform();

  if (plat === "darwin") {
    const candidates = [
      "/Applications/Docker.app/Contents/Resources/bin/docker",
      "/opt/homebrew/bin/docker",
      "/usr/local/bin/docker"
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return "docker";
  }

  if (plat === "win32") {
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"];

    const candidates = [
      path.join(programFiles, "Docker", "Docker", "resources", "bin", "docker.exe"),
      programFilesX86
        ? path.join(programFilesX86, "Docker", "Docker", "resources", "bin", "docker.exe")
        : null,
      "docker.exe"
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (p === "docker.exe" || fs.existsSync(p)) return p;
    }
    return "docker.exe";
  }

  const linuxCandidates = ["/usr/bin/docker", "/usr/local/bin/docker", "docker"];
  for (const p of linuxCandidates) {
    if (p === "docker" || fs.existsSync(p)) return p;
  }
  return "docker";
}

export function isDockerAvailable(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isImageAvailable(imageTag: string = IMAGE_NAME): boolean {
  try {
    execSync(`docker image inspect ${imageTag}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function updateBQAT(
  imageTag: string = IMAGE_NAME,
  onProgress?: (message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onProgress?.(`Pulling latest image: ${imageTag}...`);
    const dockerPath = resolveDockerBinary();
    const proc = spawn(dockerPath, ["pull", imageTag], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env
      }
    });

    proc.stdout?.on("data", d => onProgress?.(d.toString()));
    proc.stderr?.on("data", d => onProgress?.(d.toString()));

    proc.on("close", code => {
      if (code === 0) {
        onProgress?.("✅ Update successful!");
        resolve();
      } else {
        reject(new Error(`Update failed with code ${code}`));
      }
    });

    proc.on("error", err => reject(new Error(`Failed to execute docker: ${err.message}`)));
  });
}

export async function uninstallBQAT(
  imageTag: string = IMAGE_NAME,
  onProgress?: (message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onProgress?.(`Removing image: ${imageTag}...`);
    const dockerPath = resolveDockerBinary();
    const proc = spawn(dockerPath, ["rmi", imageTag], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env
      }
    });

    proc.stdout?.on("data", d => onProgress?.(d.toString()));
    proc.stderr?.on("data", d => onProgress?.(d.toString()));

    proc.on("close", code => {
      if (code === 0) {
        onProgress?.("✅ Uninstall successful!");
        resolve();
      } else {
        reject(new Error(`Uninstall failed with code ${code}`));
      }
    });

    proc.on("error", err => reject(new Error(`Failed to execute docker: ${err.message}`)));
  });
}

export async function ensureReady(
  imageTag: string = IMAGE_NAME,
  onProgress?: (message: string) => void
): Promise<void> {
  if (!isDockerAvailable()) {
    throw new Error("Docker is not available. Please install Docker and ensure it is running.");
  }

  if (!isImageAvailable(imageTag)) {
    onProgress?.(`BQAT image not found locally. Pulling ${imageTag}...`);
    await updateBQAT(imageTag, onProgress);
  } else {
    onProgress?.("BQAT image is ready.");
  }
}

/* ------------------------------------------------------------------
 * Cache key hashing
 * ------------------------------------------------------------------ */

function hashDirectory(dir: string): string {
  const hash = crypto.createHash("sha256");

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
  return hash.digest("hex");
}

function normaliseArgsForCache(args: BQATArgs): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;

    // input/output should not affect compute beyond input directory hash
    if (k === "input" || k === "output") continue;

    out[k] = v;
  }

  // Stable key ordering
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function hashArgs(args: BQATArgs, imageTag: string): string {
  const normalised = normaliseArgsForCache(args);

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalised))
    .update(imageTag)
    .digest("hex");
}

function computeCacheKey(inputDir: string, args: BQATArgs, imageTag: string): string {
  const dirHash = hashDirectory(inputDir);
  const argsHash = hashArgs(args, imageTag);

  return crypto
    .createHash("sha256")
    .update(dirHash)
    .update(argsHash)
    .digest("hex");
}

/* ------------------------------------------------------------------
 * Runner
 * ------------------------------------------------------------------ */

function getTotalMemoryMB(): number {
  return Math.floor(os.totalmem() / (1024 * 1024));
}

function getShmSize(totalMemMB: number): string {
  const shmMB = Math.max(512, Math.min(8192, Math.floor(totalMemMB * 0.5)));
  return `${shmMB}m`;
}

function validateCacheEntry(dir: string): boolean {
  const summaryPath = path.join(dir, "summary.json");
  if (!fs.existsSync(summaryPath)) return false;

  // Require at least one CSV to be present to consider it usable
  const files = safeReaddir(dir);
  const hasCsv = files.some(f => f.endsWith(".csv"));
  return hasCsv;
}

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function writeText(p: string, content: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

function argsToArray(args: BQATArgs): string[] {
  const result: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;

    // input/output are forced by cache-first execution, do not pass through
    if (key === "input" || key === "output") continue;

    const flag = key.length === 1 ? `-${key}` : `--${key}`;

    if (typeof value === "boolean") {
      if (value) result.push(flag);
    } else {
      result.push(flag, String(value));
    }
  }

  return result;
}

/**
 * BQAT Runner class with event emitter
 */
export class BQATRunner extends EventEmitter {
  private imageTag: string;
  private outputBuffer = "";

  constructor(imageTag: string = IMAGE_NAME) {
    super();
    this.imageTag = imageTag;
    this.run = this.run.bind(this);
  }

  getCacheDir(inputPath: string, args: BQATArgs): string | null {
    const imageTag = this.imageTag;
    const resolved = path.resolve(String(inputPath));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return null;
    }
    const cacheKey = computeCacheKey(resolved, args, imageTag);
    return getCacheEntryDir(cacheKey);
  }

  async run(args: BQATArgs = {}, options: DockerRunOptions = {}): Promise<BQATResultData> {
    const imageTag = options.imageTag ?? this.imageTag;

    if (!args.input) {
      throw new Error("BQATRunner.run requires args.input");
    }

    const inputPath = path.resolve(String(args.input));

    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isDirectory()) {
      throw new Error(`Input path not found or not a directory: ${inputPath}`);
    }

    const cacheKey = computeCacheKey(inputPath, args, imageTag);
    const cacheDir = getCacheEntryDir(cacheKey);

    const summaryPath = path.join(cacheDir, "summary.json");
    const outputLogPath = path.join(cacheDir, "output.log");

    const emitProgress = (e: ProgressEvent) => {
      this.emit("progress", e);
      options.onProgress?.(e);
    };

    // Cache hit
    if (validateCacheEntry(cacheDir)) {
      emitProgress({
        type: "stdout",
        message: `♻️ Using cached BQAT results (${cacheKey})`,
        timestamp: new Date()
      });

      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as BQATSummary;
      const result = this.materialiseResultFromDir(summary, cacheDir, "");
      return new BQATResultData(result, cacheDir);
    }

    // Cache miss / incomplete cache: clear dir
    try {
      // Keep directory but remove contents to avoid mixed artifacts
      for (const f of safeReaddir(cacheDir)) {
        fs.rmSync(path.join(cacheDir, f), { recursive: true, force: true });
      }
    } catch {
      // best effort
    }

    const dockerPath = resolveDockerBinary();

    const shmSize = options.shmSize || getShmSize(getTotalMemoryMB());
    const removeContainer = options.removeContainer ?? true;
    const interactive = options.interactive ?? false;

    const dockerArgs: string[] = [];

    dockerArgs.push("run");

    if (removeContainer) dockerArgs.push("--rm");
    if (interactive) dockerArgs.push("-it");

    dockerArgs.push(`--shm-size=${shmSize}`);

    // Mounts
    // TODO fix Iris so mount can be :ro
    dockerArgs.push("-v", `${inputPath}:/app/input`);
    dockerArgs.push("-v", `${cacheDir}:/app/output`);

    // Image
    dockerArgs.push(imageTag);

    // Do NOT override --entrypoint.
    // The bqcore-service image appears to expect a full command string.
    const openBqCommand = [
      "python3",
      "-m",
      "openbq",

      // Force input/output
      "--input",
      "input",
      "--output",
      "output",

      // Optional working dir if BQAT expects it
      "-W",
      "/app",

      // Pass through remaining args, e.g. --mode iris --engine biqt
      ...argsToArray(args)
    ].join(" ");

    dockerArgs.push(openBqCommand);

    // Optional: safer log rendering
    const quoteArg = (arg: string) =>
      /\s/.test(arg) ? JSON.stringify(arg) : arg;

    const cmdString = `${dockerPath} ${dockerArgs.map(quoteArg).join(" ")}`;

    emitProgress({
      type: "start",
      message: `Starting OpenBQ: ${cmdString}`,
      timestamp: new Date()
    });

    this.outputBuffer = "";

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(dockerPath, dockerArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PATH: [
            process.env.PATH,
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/Applications/Docker.app/Contents/Resources/bin"
          ]
            .filter(Boolean)
            .join(":")
        }
      });

      proc.stdout?.on("data", data => {
        const message = data.toString();
        this.outputBuffer += message;

        emitProgress({
          type: "stdout",
          message,
          timestamp: new Date()
        });

        options.onStdout?.(message);
      });

      proc.stderr?.on("data", data => {
        const message = data.toString();
        this.outputBuffer += message;

        emitProgress({
          type: "stderr",
          message,
          timestamp: new Date()
        });

        options.onStderr?.(message);
      });

      proc.on("error", err => {
        emitProgress({
          type: "error",
          message: err.message,
          timestamp: new Date()
        });

        reject(err);
      });

      proc.on("close", code => {
        emitProgress({
          type: "end",
          message: code === 0 ? "Completed successfully" : `Failed with code ${code}`,
          timestamp: new Date(),
          code: code ?? undefined
        });

        if (code !== 0) {
          reject(new Error(`Docker command failed with code ${code}`));
          return;
        }

        resolve();
      });
    });

    // Persist raw output log in the cache dir (no copying of artifacts)
    writeText(outputLogPath, this.outputBuffer);

    // Parse summary (from stdout) and persist to cache dir
    const summary = this.parseSummaryFromOutput(this.outputBuffer);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    const result = this.materialiseResultFromDir(summary, cacheDir, this.outputBuffer);

    // If artifacts are still missing, treat as failure (helps tests + integrity)
    if (!result.csvPath || !fs.existsSync(result.csvPath)) {
      const files = safeReaddir(cacheDir);
      throw new Error(
        `BQAT completed but CSV not found in cacheDir.\ncacheDir=${cacheDir}\nfiles=${files.join(
          ", "
        )}\nrawOutput saved=${outputLogPath}`
      );
    }

    emitProgress({
      type: "stdout",
      message: `✅ Results available in cache dir: ${cacheDir}`,
      timestamp: new Date()
    });

    return new BQATResultData(result, cacheDir);
  }

  private parseSummaryFromOutput(output: string): BQATSummary {
    // Match the JSON block after "> Summary:"
    const match = output.match(/> Summary:\s*(\{[\s\S]*?\})\s*(?:>>|$)/);
    if (!match) {
      throw new Error("Failed to parse BQAT summary: summary block not found in output");
    }

    try {
      return JSON.parse(match[1]) as BQATSummary;
    } catch (e: any) {
      throw new Error(`Failed to parse BQAT summary JSON: ${e?.message ?? e}`);
    }
  }

  private materialiseResultFromDir(summary: BQATSummary, dir: string, rawOutput: string): BQATResult {
    const files = safeReaddir(dir);

    const csvFile =
      files.find(f => f.endsWith(".csv")) ??
      files.find(f => f.includes("output_") && f.endsWith(".csv"));

    const logFile = files.find(f => f.startsWith("log_") && f.endsWith(".json"));
    const reportFile = files.find(f => f.startsWith("eda_report_") && f.endsWith(".html"));
    const previewFile = files.find(f => f.startsWith("data_table_") && f.endsWith(".html"));

    return {
      summary,
      csvPath: csvFile ? path.join(dir, csvFile) : undefined,
      reportPath: reportFile ? path.join(dir, reportFile) : undefined,
      previewTablePath: previewFile ? path.join(dir, previewFile) : undefined,
      logPath: logFile ? path.join(dir, logFile) : undefined,
      outputPath: dir,
      rawOutput
    };
  }
}

/* ------------------------------------------------------------------
 * Convenience API (backwards compatible)
 * ------------------------------------------------------------------ */

export function showVersion(imageTag: string = IMAGE_NAME): void {
  // Kept for compatibility
  console.log(`BQAT CLI - TypeScript`);
  console.log(`Docker Image: ${imageTag}`);
}

export async function runContainer(args: BQATArgs = {}, options: DockerRunOptions = {}): Promise<BQATResultData> {
  const runner = new BQATRunner(options.imageTag ?? IMAGE_NAME);

  if (options.onProgress) {
    runner.on("progress", options.onProgress);
  }

  return runner.run(args, options);
}

export async function analyze(
  mode: BQATMode,
  inputPath?: string,
  _outputPath?: string, // ignored in cache-first design
  generateReport: boolean = false,
  options: DockerRunOptions = {}
): Promise<BQATResultData> {
  const args: BQATArgs = {
    mode,
    ...(inputPath && { input: inputPath }),
    ...(generateReport && { report: true })
  };

  return runContainer(args, options);
}

export async function benchmark(options: DockerRunOptions = {}): Promise<BQATResultData> {
  return runContainer({ benchmark: true }, options);
}

export async function version(options: DockerRunOptions = {}): Promise<BQATResultData> {
  return runContainer({ version: true }, options);
}

export async function help(options: DockerRunOptions = {}): Promise<BQATResultData> {
  // Some CLIs use --help without running; we pass help: true -> "--help"
  return runContainer({ help: true }, options);
}

/**
 * Convert WSQ → Base64 via BQAT preprocess
 */
export async function convertWSQToBase64(
  wsqFilePath: string,
  options: {
    imageTag?: string;
    format?: "jpeg" | "png";
  } = {}
): Promise<string> {
  const imageTag = options.imageTag ?? IMAGE_NAME;
  const format = options.format ?? "jpeg";

  if (!fs.existsSync(wsqFilePath)) {
    throw new Error(`WSQ file not found: ${wsqFilePath}`);
  }

  /* -----------------------------------------------------------
   * Temp workspace
   * --------------------------------------------------------- */

  const tmpRoot = path.join(os.tmpdir(), "bqat-wsq");
  const jobId = crypto.randomBytes(6).toString("hex");

  const workDir = path.join(tmpRoot, jobId);
  const inputDir = path.join(workDir, "input");
  const outputDir = path.join(workDir, "output");

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const filename = path.basename(wsqFilePath);
  const stagedWSQ = path.join(inputDir, filename);

  fs.copyFileSync(wsqFilePath, stagedWSQ);

  /* -----------------------------------------------------------
   * Docker execution
   * --------------------------------------------------------- */

  const dockerPath = "docker";

  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${inputDir}:/app/input`,
    "-v",
    `${outputDir}:/app/output`,
    "--entrypoint",
    "python3",
    imageTag,
    "-m",
    "openbq",
    "-M",
    "preprocess",
    "--config",
    format,
    "-I",
    "input",
    "-O",
    "output",
    "-W",
    "/app"
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(dockerPath, dockerArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";

    proc.stderr?.on("data", d => {
      stderr += d.toString();
    });

    proc.on("error", reject);

    proc.on("close", code => {
      if (code !== 0) {
        reject(
          new Error(
            `BQAT preprocess failed (code ${code})\n${stderr}`
          )
        );
        return;
      }
      resolve();
    });
  });

  /* -----------------------------------------------------------
   * Locate converted file
   * --------------------------------------------------------- */

  const baseName = path.parse(filename).name;

  const files = fs.readdirSync(outputDir);

  const convertedFile =
    files.find(f =>
      f.startsWith(baseName) &&
      (f.endsWith(".jpeg") || f.endsWith(".jpg") || f.endsWith(".png"))
    ) ?? null;

  if (!convertedFile) {
    throw new Error(
      `Converted file not found in output dir.\nFiles: ${files.join(", ")}`
    );
  }

  const convertedPath = path.join(outputDir, convertedFile);

  /* -----------------------------------------------------------
   * Base64 encode
   * --------------------------------------------------------- */

  const buffer = fs.readFileSync(convertedPath);
  const base64 = buffer.toString("base64");

  const mime =
    convertedFile.endsWith(".png")
      ? "image/png"
      : "image/jpeg";

  const dataUrl = `data:${mime};base64,${base64}`;

  /* -----------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------- */

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return dataUrl;
}

// Default export (kept)
export default {
  BQATRunner,
  runContainer,
  analyze,
  benchmark,
  version,
  help,
  updateBQAT,
  uninstallBQAT,
  showVersion,
  isDockerAvailable,
  isImageAvailable,
  ensureReady,
  convertWSQToBase64,
  IMAGE_NAME
};