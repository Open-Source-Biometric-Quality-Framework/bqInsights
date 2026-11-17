import { app, BrowserWindow, ipcMain, dialog, Notification, nativeImage, shell } from "electron";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import { fileURLToPath } from 'node:url';

import { createLLMClient } from "@biometix/bx-llm-engine"
//import { registerReportBridge } from "./electron/report-bridge";

import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { platform, arch } from "process";
import net from 'net';
import { normalise_path } from "./normalisePath.js"
import { convertWSQCached } from "./wsq-converter.js";
import { checkDockerStatus, commandExists, runDockerCommand } from "./docker-util.js";
import { spawn, execFileSync } from "node:child_process";

import Papa from 'papaparse';
import JSZip from "jszip";

let __dirname = process.cwd();
if (app.isPackaged) {
    __dirname = app.getAppPath()
}

type ClientKey = string;
const clients = new Map<ClientKey, any>();

// Tracks whether this app instance started the Ollama container, so we can
// stop it again on quit (and avoid killing a container the user was already running).
let ollamaStartedByApp = false;

const BUNDLE_CSV_NAME = "data.csv";
const BUNDLE_INFO_NAME = "info.json";
const BUNDLE_MANIFEST_NAME = "manifest.json";
const METADATA_ROOT = "cached-metadata";
const ANALYSIS_CACHE_DIR_NAME = "openbq-analysis-cache";
const UMAP_CACHE_DIR_NAME = "umap-cache";
const LAST_CACHE_KEYS_FILE = "last-cache-keys.json";
const IMPORTED_BUNDLES_DIR = "imported-analysis-bundles";
const ANALYSIS_CACHE_PREFIX = "openbq:analysis:v1";

function hashAnalysisCacheKey(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

function sanitizePathSegment(input: string): string {
    const cleaned = (input || "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned || "imported-bundle";
}

async function ensureUniqueDirectory(parentDir: string, baseName: string): Promise<string> {
    const safeBase = sanitizePathSegment(baseName);
    let index = 0;

    for (;;) {
        const dirName = index === 0 ? safeBase : `${safeBase}-${index + 1}`;
        const candidate = path.join(parentDir, dirName);
        try {
            await fs.mkdir(candidate);
            return candidate;
        } catch (err: any) {
            if (err?.code === "EEXIST") {
                index += 1;
                continue;
            }
            throw err;
        }
    }
}

function stableStringify(value: unknown): string {
    const seen = new WeakSet();
    const normalize = (input: any): any => {
        if (input === null || typeof input !== "object") return input;
        if (seen.has(input)) return "[Circular]";
        seen.add(input);
        if (Array.isArray(input)) return input.map(normalize);
        const keys = Object.keys(input).sort();
        const out: Record<string, any> = {};
        for (const key of keys) out[key] = normalize(input[key]);
        return out;
    };
    return JSON.stringify(normalize(value));
}

function buildAnalysisCacheKeys(
    csvPath: string,
    params: Record<string, any> | null | undefined
): { baseKey: string; fullKey: string } | null {
    if (!params || typeof params !== "object") return null;
    const modality = typeof params.biometricModality === "string" ? params.biometricModality : null;
    if (!modality) return null;
    const profile = params.qualityMetric;
    const strict = false;
    const paramsKey = stableStringify(params);
    const baseKey = `${ANALYSIS_CACHE_PREFIX}:${modality}:${csvPath}:${profile}:${strict}`;
    return {
        baseKey,
        fullKey: `${baseKey}:${paramsKey}`
    };
}

function sanitizeZipEntryPath(entryPath: string): string | null {
    if (!entryPath || entryPath.includes("\0")) return null;
    const normalized = path.posix.normalize(entryPath);
    if (normalized.startsWith("../") || normalized === "..") return null;
    if (path.posix.isAbsolute(normalized)) return null;
    return normalized;
}

function parseCsvRows(csvText: string): any[] {
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });
    if (parsed.errors.length) {
        throw new Error("Failed to parse CSV in bundle");
    }
    return Array.isArray(parsed.data) ? parsed.data : [];
}

export function registerHandlers() {

    ipcMain.handle('open-external', async (_event, url: string) => {
        if (!url || typeof url !== 'string') return;

        // Basic safety: only allow known-safe schemes
        if (
            url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('mailto:') ||
            url.startsWith('file://')
        ) {
            await shell.openExternal(url);
        }
    });

    ipcMain.handle("llm:create", (_event, config) => {
        const key = crypto.randomUUID();
        const client = createLLMClient(config); // config must satisfy types
        clients.set(key, client);
        return { key };
    });

    ipcMain.handle("llm:chat", async (_event, key: ClientKey, prompt: string) => {
        const client = clients.get(key);
        if (!client) throw new Error(`Unknown LLM client key: ${key}`);
        const res = await client.chat(prompt);
        return res; // must be JSON-serialisable
    });

    ipcMain.handle("show-save-dialog", async (event, options) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
            throw new Error("No window found");
        }
        return await dialog.showSaveDialog(window, options);
    });

    // In your IPC handler
    ipcMain.handle("write-file", async (event, filePath: string, content: string) => {
        console.log("Writing to:", filePath);
        console.log("Content length:", content.length);
        console.log("Full path:", path.resolve(filePath));
       
            // In your renderer:
        const fileName = path.join(os.tmpdir(), path.basename(filePath)); // e.g. /tmp/report.html
        try {
            //const dir = path.dirname(filePath);
            //await fs.mkdir(dir, { recursive: true }); // Create dir if needed
            await fs.writeFile(fileName, content, "utf-8");
            return { success: true, fileName: fileName };
        } catch (error) {
            console.error("Write file error:", error);
            return { success: false };
        }
    });

    ipcMain.handle("show-open-dialog", async (event, options) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) throw new Error("No window found");
        return await dialog.showOpenDialog(window, options);
    });

    ipcMain.handle("read-file", async (_event, filePath: string) => {
        const content = await fs.readFile(filePath, "utf-8");
        return { success: true, content };
    });

    ipcMain.handle("write-file-absolute", async (_event, filePath: string, content: string) => {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, "utf-8");
            return { success: true, fileName: filePath };
        } catch (error) {
            console.error("Write file absolute error:", error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle("delete-file-absolute", async (_event, filePath: string) => {
        try {
            await fs.unlink(filePath);
            return { success: true, deleted: true };
        } catch (error: any) {
            if (error?.code === "ENOENT") {
                return { success: true, deleted: false };
            }
            console.error("Delete file absolute error:", error);
            return { success: false, error: String(error), deleted: false };
        }
    });

    ipcMain.handle("read-dir", async (_event, dirPath: string) => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            return {
                success: true,
                entries: entries.map(entry => ({
                    name: entry.name,
                    isFile: entry.isFile(),
                    isDirectory: entry.isDirectory()
                }))
            };
        } catch (err: any) {
            return { success: false, error: err?.message ?? String(err), entries: [] };
        }
    });

    ipcMain.handle("ensure-dir", async (_event, dirPath: string) => {
        await fs.mkdir(dirPath, { recursive: true });
        return { success: true };
    });

    type FileCounts = Record<string, number>;

    type FileEntry = {
        filename: string;
        path: string;
        size: number;
        extension: string;
    };

    ipcMain.handle(
        "list-files-recursive",
        async (
            _event,
            rootPath: string,
            limit: number = 1000
        ): Promise<{
            success: boolean;
            files: FileEntry[];
            counts: FileCounts;
        }> => {
            const files: FileEntry[] = [];
            const counts: FileCounts = {};

            async function walk(currentPath: string): Promise<void> {
                let entries;
                try {
                    entries = await fs.readdir(currentPath, { withFileTypes: true });
                } catch {
                    return;
                }

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    if (entry.isDirectory()) {
                        await walk(fullPath);
                        continue;
                    }

                    if (!entry.isFile()) continue;

                    const ext =
                        path.extname(entry.name).replace(".", "").toLowerCase() || "none";

                    // count ALL files, regardless of limit
                    counts[ext] = (counts[ext] || 0) + 1;

                    // only collect details until limit reached
                    if (files.length < limit) {
                        try {
                            const stat = await fs.stat(fullPath);

                            files.push({
                                filename: entry.name,
                                path: fullPath,
                                size: stat.size,
                                extension: ext
                            });
                        } catch {
                            // skip unreadable files but keep counts
                        }
                    }
                }
            }

            await walk(rootPath);

            return {
                success: true,
                files,
                counts
            };
        }
    );



    ipcMain.handle("read-file-base64", async (_event, filePath: string) => {
        const buf = await fs.readFile(normalise_path(filePath)); // no encoding => Buffer
        return { success: true, base64: buf.toString("base64") };
    });


    ipcMain.handle(
        "read-image-base64",
        async (
            _event,
            filePath: string,
            folderPath: string,
            opts?: { maxWidth?: number }
        ) => {
            try {
                /* ---------------------------------------------------------
                 * Resolve folder fallback
                 * ------------------------------------------------------- */

                if (folderPath === "") {
                    folderPath = app.isPackaged
                        ? path.join(process.resourcesPath, "assets")
                        : path.join(app.getAppPath(), "assets");
                }

                const pathStr = normalise_path(filePath, "" + folderPath);

                if (!pathStr) {
                    throw new Error("Invalid resolved image path");
                }

                const ext = path.extname(pathStr).toLowerCase();

                let image: Electron.NativeImage;

                /* ---------------------------------------------------------
                 * WSQ branch → Docker conversion
                 * ------------------------------------------------------- */

                if (ext === ".wsq") {
                    const base64DataUrl = await convertWSQCached(pathStr);

                    const base64 = base64DataUrl.split(",")[1];
                    const buf = Buffer.from(base64, "base64");

                    image = nativeImage.createFromBuffer(buf);
                }
                /* ---------------------------------------------------------
                 * Standard image branch
                 * ------------------------------------------------------- */

                else {
                    const buf = await fs.readFile(pathStr);
                    image = nativeImage.createFromBuffer(buf);
                }

                /* ---------------------------------------------------------
                 * Optional resize
                 * ------------------------------------------------------- */

                if (opts?.maxWidth) {
                    const { width } = image.getSize();

                    if (width > opts.maxWidth) {
                        image = image.resize({
                            width: opts.maxWidth,
                            quality: "best"
                        });
                    }
                }

                /* ---------------------------------------------------------
                 * Output encoding
                 * ------------------------------------------------------- */

                const outputBuffer = image.toPNG();

                return {
                    success: true,
                    base64: outputBuffer.toString("base64"),
                    width: image.getSize().width,
                    height: image.getSize().height,
                    size: outputBuffer.byteLength
                    // isWSQ: ext === ".wsq"
                };
            } catch (err: any) {
                return {
                    success: false,
                    error: err?.message ?? String(err)
                };
            }
        }
    );

    ipcMain.handle("docx:toHtml", async (_event, filePath: string) => {
        const buffer = await fs.readFile(filePath);

        const result = await mammoth.convertToHtml(
            { buffer }
        );

        return { type: "docx", html: result.value, messages: result.messages };
    });


    ipcMain.handle("xlsx:toJson", async (_event, filePath) => {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);


        const sheets = workbook.worksheets.map((ws) => ({
            name: ws.name,
            rows: ws.getSheetValues().slice(1), // 1-based sheet indexing
        }));

        console.log(sheets)


        return {type: 'xlsx', sheets };
    });

    ipcMain.handle("csv:toJson", async (_event, filePath) => {
       // use papaparse to read CSV file and convert to JSON
         const content = await fs.readFile(filePath, "utf-8");
         const result = Papa.parse(content, {
          header: true, // treat first row as header
          skipEmptyLines: true,
          // infer data types (e.g. convert "123" to number)
          dynamicTyping: true
         });
        if (result.errors.length) {
            console.error("CSV parse errors:", result.errors);
            throw new Error("Failed to parse CSV file");
        }
        return {type: 'csv', content: result.data }; // array of objects
    });

    ipcMain.handle("analysis-bundle:export", async (event, payload) => {
        try {
            const ownerWindow = BrowserWindow.fromWebContents(event.sender);
            if (!ownerWindow) {
                throw new Error("No active window for export");
            }

            const csvData = Array.isArray(payload?.csvData) ? payload.csvData : [];
            if (!csvData.length) {
                return { success: false, error: "No CSV rows available to export." };
            }

            const saveResult = await dialog.showSaveDialog(ownerWindow, {
                title: "Export OpenBQ Analysis Bundle",
                defaultPath: "openbq-analysis-bundle.zip",
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
            });

            if (saveResult.canceled || !saveResult.filePath) {
                return { success: false, canceled: true };
            }

            const zip = new JSZip();
            const csvText = Papa.unparse(csvData);
            zip.file(BUNDLE_CSV_NAME, `${csvText}\n`);
            zip.file(BUNDLE_INFO_NAME, JSON.stringify(payload?.info ?? {}, null, 2));

            const userDataPath = app.getPath("userData");
            const analysisCachePath = path.join(userDataPath, ANALYSIS_CACHE_DIR_NAME);
            const umapCachePath = path.join(userDataPath, "cache", "openbq", UMAP_CACHE_DIR_NAME);
            const activeAnalysisCacheKey =
                typeof payload?.activeCache?.analysisCacheKey === "string"
                    ? payload.activeCache.analysisCacheKey
                    : null;
            const activeUmapCacheKey =
                typeof payload?.activeCache?.umapCacheKey === "string"
                    ? payload.activeCache.umapCacheKey
                    : null;

            const metadataStats = {
                analysisCacheFiles: 0,
                umapCacheFiles: 0
            };

            if (activeAnalysisCacheKey) {
                const analysisFileName = `analysis-${hashAnalysisCacheKey(activeAnalysisCacheKey)}.json`;
                const analysisEntryPath = path.join(analysisCachePath, analysisFileName);
                try {
                    const data = await fs.readFile(analysisEntryPath);
                    zip.file(`${METADATA_ROOT}/${ANALYSIS_CACHE_DIR_NAME}/${analysisFileName}`, data);
                    metadataStats.analysisCacheFiles += 1;
                } catch {
                    // Active key may not exist on disk yet.
                }

                const lastKeysPath = path.join(analysisCachePath, LAST_CACHE_KEYS_FILE);
                try {
                    const raw = await fs.readFile(lastKeysPath, "utf-8");
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object") {
                        const filtered: Record<string, unknown> = {};
                        for (const [baseKey, value] of Object.entries(parsed as Record<string, any>)) {
                            if (value?.key === activeAnalysisCacheKey) {
                                filtered[baseKey] = value;
                            }
                        }
                        if (Object.keys(filtered).length > 0) {
                            zip.file(
                                `${METADATA_ROOT}/${ANALYSIS_CACHE_DIR_NAME}/${LAST_CACHE_KEYS_FILE}`,
                                JSON.stringify(filtered, null, 2)
                            );
                            metadataStats.analysisCacheFiles += 1;
                        }
                    }
                } catch {
                    // Missing/invalid last cache map is non-fatal.
                }
            }

            if (activeUmapCacheKey) {
                const umapFileName = `${activeUmapCacheKey}.json`;
                const umapEntryPath = path.join(umapCachePath, umapFileName);
                try {
                    const data = await fs.readFile(umapEntryPath);
                    zip.file(`${METADATA_ROOT}/${UMAP_CACHE_DIR_NAME}/${umapFileName}`, data);
                    metadataStats.umapCacheFiles += 1;
                } catch {
                    // Active key may not exist on disk yet.
                }
            }

            zip.file(
                BUNDLE_MANIFEST_NAME,
                JSON.stringify(
                    {
                        format: "openbq-analysis-bundle/v1",
                        exportedAt: new Date().toISOString(),
                        appVersion: app.getVersion(),
                        metadata: metadataStats
                    },
                    null,
                    2
                )
            );

            const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
            await fs.writeFile(saveResult.filePath, zipBuffer);

            return {
                success: true,
                filePath: saveResult.filePath,
                metadata: metadataStats
            };
        } catch (error) {
            console.error("Failed to export analysis bundle", error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle("analysis-bundle:import", async (event) => {
        try {
            const ownerWindow = BrowserWindow.fromWebContents(event.sender);
            if (!ownerWindow) {
                throw new Error("No active window for import");
            }

            const openResult = await dialog.showOpenDialog(ownerWindow, {
                title: "Import OpenBQ Analysis Bundle",
                properties: ["openFile"],
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
            });

            if (openResult.canceled || !openResult.filePaths?.length) {
                return { success: false, canceled: true };
            }

            const bundlePath = openResult.filePaths[0];
            const bundleBuffer = await fs.readFile(bundlePath);
            const zip = await JSZip.loadAsync(bundleBuffer);
            const bundleBaseName = path.basename(bundlePath, path.extname(bundlePath));

            const csvEntry =
                zip.file(BUNDLE_CSV_NAME) ??
                zip.file("analysis.csv") ??
                Object.values(zip.files).find((entry) => path.posix.basename(entry.name) === BUNDLE_CSV_NAME);
            if (!csvEntry) {
                throw new Error(`Bundle missing ${BUNDLE_CSV_NAME}`);
            }
            const csvText = await csvEntry.async("string");
            const csvData = parseCsvRows(csvText);

            const infoEntry =
                zip.file(BUNDLE_INFO_NAME) ??
                zip.file("analysis.json") ??
                Object.values(zip.files).find((entry) => path.posix.basename(entry.name) === BUNDLE_INFO_NAME);
            let info: Record<string, any> = {};
            if (infoEntry) {
                const infoText = await infoEntry.async("string");
                try {
                    const parsed = JSON.parse(infoText);
                    if (parsed && typeof parsed === "object") {
                        info = parsed;
                    }
                } catch (err) {
                    console.warn("Ignoring invalid info.json in imported bundle", err);
                }
            }

            const userDataPath = app.getPath("userData");
            const importRootPath = path.join(userDataPath, IMPORTED_BUNDLES_DIR);
            await fs.mkdir(importRootPath, { recursive: true });
            const importDirPath = await ensureUniqueDirectory(importRootPath, bundleBaseName);
            const importedCsvFileName = `${sanitizePathSegment(bundleBaseName)}.csv`;
            const importedCsvPath = path.join(importDirPath, importedCsvFileName);
            const importedInfoPath = path.join(importDirPath, BUNDLE_INFO_NAME);
            await fs.writeFile(importedCsvPath, `${csvText.trimEnd()}\n`, "utf-8");

            let remappedAnalysisKeys: { baseKey: string; fullKey: string } | null = null;
            if (info?.analysisParams && typeof info.analysisParams === "object") {
                remappedAnalysisKeys = buildAnalysisCacheKeys(importedCsvPath, info.analysisParams);
                if (remappedAnalysisKeys) {
                    info.analysisCacheKey = remappedAnalysisKeys.fullKey;
                }
            }
            await fs.writeFile(importedInfoPath, JSON.stringify(info, null, 2), "utf-8");

            const analysisCachePath = path.join(userDataPath, ANALYSIS_CACHE_DIR_NAME);
            const umapCachePath = path.join(userDataPath, "cache", "openbq", UMAP_CACHE_DIR_NAME);
            await fs.mkdir(analysisCachePath, { recursive: true });
            await fs.mkdir(umapCachePath, { recursive: true });

            let restoredMetadataFiles = 0;

            for (const entry of Object.values(zip.files)) {
                if (entry.dir) continue;
                const safeEntryPath = sanitizeZipEntryPath(entry.name);
                if (!safeEntryPath) continue;
                if (!safeEntryPath.startsWith(`${METADATA_ROOT}/`)) continue;

                const analysisPrefix = `${METADATA_ROOT}/${ANALYSIS_CACHE_DIR_NAME}/`;
                const umapPrefix = `${METADATA_ROOT}/${UMAP_CACHE_DIR_NAME}/`;

                let targetRoot: string | null = null;
                let relativePart = "";

                if (safeEntryPath.startsWith(analysisPrefix)) {
                    targetRoot = analysisCachePath;
                    relativePart = safeEntryPath.slice(analysisPrefix.length);
                } else if (safeEntryPath.startsWith(umapPrefix)) {
                    targetRoot = umapCachePath;
                    relativePart = safeEntryPath.slice(umapPrefix.length);
                } else {
                    continue;
                }

                if (!relativePart) continue;
                const normalizedRelative = sanitizeZipEntryPath(relativePart);
                if (!normalizedRelative) continue;

                let destinationRelative = normalizedRelative;
                let destinationBuffer = await entry.async("nodebuffer");

                if (targetRoot === analysisCachePath) {
                    const parsedEntry = path.posix.parse(normalizedRelative);
                    if (parsedEntry.base === LAST_CACHE_KEYS_FILE && remappedAnalysisKeys) {
                        destinationBuffer = Buffer.from(
                            JSON.stringify(
                                {
                                    [remappedAnalysisKeys.baseKey]: {
                                        key: remappedAnalysisKeys.fullKey,
                                        timestamp: Date.now()
                                    }
                                },
                                null,
                                2
                            ),
                            "utf-8"
                        );
                    } else if (
                        parsedEntry.name.startsWith("analysis-") &&
                        parsedEntry.ext === ".json" &&
                        remappedAnalysisKeys
                    ) {
                        destinationRelative = path.posix.join(
                            parsedEntry.dir,
                            `analysis-${hashAnalysisCacheKey(remappedAnalysisKeys.fullKey)}.json`
                        );
                        try {
                            const parsed = JSON.parse(destinationBuffer.toString("utf-8"));
                            if (parsed && typeof parsed === "object") {
                                parsed.key = remappedAnalysisKeys.fullKey;
                                destinationBuffer = Buffer.from(JSON.stringify(parsed), "utf-8");
                            }
                        } catch {
                            // If the entry is not JSON, keep raw bytes.
                        }
                    }
                }

                const destinationPath = path.join(targetRoot, ...destinationRelative.split("/"));
                await fs.mkdir(path.dirname(destinationPath), { recursive: true });
                await fs.writeFile(destinationPath, destinationBuffer);
                restoredMetadataFiles += 1;
            }

            return {
                success: true,
                bundlePath,
                importDirPath,
                importedCsvPath,
                importedInfoPath,
                csvData,
                info,
                restoredMetadataFiles
            };
        } catch (error) {
            console.error("Failed to import analysis bundle", error);
            return { success: false, error: String(error) };
        }
    });

    function normalisePlatform(platform: NodeJS.Platform) {
        switch (platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            case 'linux':
                return 'linux';
            default:
                return platform; // fallback, e.g. aix, freebsd
        }
    }


    async function checkOllama() {
        const serviceRunning = await checkOllamaService();

        return {
            installed: serviceRunning,
            running: serviceRunning
        };
    }

    function checkOllamaService(
        host = '127.0.0.1',
        port = 11434,
        timeout = 1000
    ): Promise<boolean> {
        return new Promise(resolve => {
            const socket = new net.Socket();

            socket.setTimeout(timeout);
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.once('error', () => {
                resolve(false);
            });

            socket.connect(port, host);
        });
    }

    async function waitForOllamaService(
        retries = 30,
        intervalMs = 1000
    ): Promise<boolean> {
        for (let i = 0; i < retries; i += 1) {
            if (await checkOllamaService()) return true;
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        return false;
    }

    async function startOllamaService(): Promise<{ ok: boolean; message: string }> {
        const dockerInstalled = await commandExists("docker");
        if (!dockerInstalled) {
            return { ok: false, message: "Docker is not installed. Please install Docker or use the Ollama desktop app." };
        }

        // If the service is already reachable, it was started outside this app —
        // don't take ownership of stopping it on quit.
        const alreadyRunning = await checkOllamaService();

        const baseArgs = [
            "run", "-d",
            "-v", "ollama:/root/.ollama",
            "-p", "11434:11434",
            "--name", "ollama", "ollama/ollama",
        ];
        // macOS Docker has no GPU passthrough, so --gpus=all would fail there.
        const useGpu = process.platform !== "darwin";
        const runArgs = useGpu ? ["run", "-d", "--gpus=all", ...baseArgs.slice(2)] : baseArgs;

        // Start the container (idempotent: --name ollama will error if already exists)
        let startRes = await runDockerCommand(runArgs, { logPrefix: "ollama" });

        if (startRes.exitCode !== 0) {
            const out = (startRes.stderr || startRes.stdout).trim();
            // If the container already exists, that's fine — just ensure it's running.
            if (/already in use|is already in use|container name|already exists/i.test(out)) {
                const startExisting = await runDockerCommand(["start", "ollama"], { logPrefix: "ollama" });
                if (startExisting.exitCode !== 0) {
                    return { ok: false, message: `Failed to start existing container: ${startExisting.stderr || startExisting.stdout}` };
                }
            } else if (useGpu && /gpu|nvidia|could not select device driver/i.test(out)) {
                // No usable GPU on this host — retry without --gpus=all (CPU only).
                startRes = await runDockerCommand(baseArgs, { logPrefix: "ollama" });
                if (startRes.exitCode !== 0) {
                    const cpuOut = (startRes.stderr || startRes.stdout).trim();
                    if (/already in use|is already in use|container name|already exists/i.test(cpuOut)) {
                        const startExisting = await runDockerCommand(["start", "ollama"], { logPrefix: "ollama" });
                        if (startExisting.exitCode !== 0) {
                            return { ok: false, message: `Failed to start existing container: ${startExisting.stderr || startExisting.stdout}` };
                        }
                    } else {
                        return { ok: false, message: cpuOut || "Failed to start Ollama container." };
                    }
                }
            } else {
                return { ok: false, message: out || "Failed to start Ollama container." };
            }
        }

        const ready = await waitForOllamaService();
        if (!ready) {
            return { ok: false, message: "Container started but Ollama did not become ready on port 11434." };
        }
        if (!alreadyRunning) {
            ollamaStartedByApp = true;
        }
        return { ok: true, message: "Ollama service is running on port 11434." };
    }

    async function stopOllamaContainer(): Promise<void> {
        if (!ollamaStartedByApp) return;
        try {
            await runDockerCommand(["stop", "ollama"], { logPrefix: "ollama" });
        } catch (err) {
            console.error("Failed to stop Ollama container on exit:", err);
        } finally {
            ollamaStartedByApp = false;
        }
    }

    // Synchronous stop for signal-based shutdown (Ctrl+C / SIGTERM in dev,
    // where async work isn't guaranteed to finish before the process exits).
    function stopOllamaContainerSync(): void {
        if (!ollamaStartedByApp) return;
        try {
            execFileSync("docker", ["stop", "ollama"], { stdio: "ignore" });
        } catch (err) {
            console.error("Failed to stop Ollama container on exit:", err);
        } finally {
            ollamaStartedByApp = false;
        }
    }

    function pullOllamaModel(model: string): Promise<{ ok: boolean; message: string }> {
        return new Promise((resolve) => {
            const child = spawn("curl", [
                "http://localhost:11434/api/pull",
                "-d", JSON.stringify({ model }),
            ], { stdio: ["ignore", "pipe", "pipe"] });

            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (chunk: Buffer) => { stdout += String(chunk); });
            child.stderr.on("data", (chunk: Buffer) => { stderr += String(chunk); });
            child.on("error", (err: Error) => resolve({ ok: false, message: String(err.message || err) }));
            child.on("close", (code: number) => {
                if (code === 0) {
                    resolve({ ok: true, message: `Model "${model}" pulled successfully.` });
                } else {
                    resolve({ ok: false, message: (stderr || stdout || `curl exited with code ${code}`).trim() });
                }
            });
        });
    }

    ipcMain.handle("app:getInfo", async () => {

        const packageJson = JSON.parse(
            await fs.readFile(path.join(__dirname, './package.json'), 'utf8')
        );

        const userInfo = os.userInfo();

        const docker = await checkDockerStatus();
        const ollama = await checkOllama();

        const args = process.argv.slice(app.isPackaged ? 1 : 2);

        return {
            name: app.getName(),
            version: app.getVersion(),
            description: packageJson.description,
            author: packageJson.author,
            company: packageJson.company,
            icon: packageJson.icon,
            userInfo,
            platform: normalisePlatform(platform),
            arch,
            docker,
            ollama,
            appname: packageJson.appname,
            licence: packageJson.licence,
            testmode: args.includes('--test') || args.includes('-t'),
            logofile: packageJson.logofile
        };
    });

    ipcMain.handle("app:getPath", async (_event, name: string) => {
        if (name === "appPath") return app.getAppPath();
        return app.getPath(name as any);
    });


    ipcMain.on("dropped-paths", async (_evt, paths) => {
        // Example: read first file
        const first = paths[0];
        const data = await fs.readFile(first, "utf8");
        console.log("Read:", first, "bytes:", data.length);
    });

    ipcMain.handle("show-notification", (_event, title: string, body: string) => {
        new Notification({ title, body }).show();
    });

    ipcMain.handle("ollama:startService", async () => {
        return startOllamaService();
    });

    ipcMain.handle("ollama:status", async () => {
        const running = await checkOllamaService();
        return { running };
    });

    ipcMain.handle("ollama:pullModel", async (_event, model: string) => {
        if (!model || typeof model !== "string") {
            return { ok: false, message: "No model specified." };
        }
        return pullOllamaModel(model.trim());
    });

    // Stop the Ollama container on quit if this app started it.
    let stoppingOllama = false;
    app.on("before-quit", (event) => {
        if (!ollamaStartedByApp || stoppingOllama) return;
        event.preventDefault();
        stoppingOllama = true;
        stopOllamaContainer().finally(() => {
            app.quit();
        });
    });

    // Signal-based shutdown (Ctrl+C / SIGTERM, e.g. `concurrently -k` in dev)
    // bypasses "before-quit", so stop the container synchronously here.
    const handleSignal = (signal: NodeJS.Signals) => {
        stopOllamaContainerSync();
        process.exit(signal === "SIGINT" ? 130 : 143);
    };
    process.once("SIGINT", () => handleSignal("SIGINT"));
    process.once("SIGTERM", () => handleSignal("SIGTERM"));
    process.once("exit", () => {
        // Last resort for a normal process exit.
        stopOllamaContainerSync();
    });

}
