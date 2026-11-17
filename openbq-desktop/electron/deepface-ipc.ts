import { ipcMain } from "electron";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  downloadOrBuildLatestImage,
  isDockerImageDownloaded,
  runDockerCommand
} from "./docker-util.js";

export type DeepfaceAnalyzeRequest = {
  imagePath: string;
  detectorBackend?:
    | "opencv"
    | "retinaface"
    | "mtcnn"
    | "ssd"
    | "dlib"
    | "mediapipe"
    | "yolov8"
    | "yunet"
    | "centerface"
    | "skip";
  enforceDetection?: boolean;
  antiSpoofing?: boolean;
  includeRaw?: boolean;
};

export type DeepfaceAnalyzeResponse = {
  success: boolean;
  age: number | null;
  gender: string | null;
  emotion: string | null;
  race: string | null;
  isReal: boolean | null;
  antiSpoofingSupported?: boolean;
  genderProbabilities?: Record<string, number>;
  emotionProbabilities?: Record<string, number>;
  raceProbabilities?: Record<string, number>;
  raw?: Record<string, unknown>;
};

const IMAGE_TAG = "openbq-deepface:v3";
const DEEPFACE_CACHE_VOLUME = "openbq-deepface-cache-v1";
const KERAS_CACHE_VOLUME = "openbq-deepface-keras-cache-v1";
const DOCKER_PLATFORM = "linux/amd64";

function logStage(message: string) {
  console.log(`[deepface] ${message}`);
}

async function ensureDeepfaceImage(electronDir: string): Promise<void> {
  logStage(`Checking Docker image ${IMAGE_TAG}`);
  const downloaded = await isDockerImageDownloaded(IMAGE_TAG, "deepface");
  if (downloaded) {
    logStage(`Image ${IMAGE_TAG} already available`);
    return;
  }

  const dockerDir = path.join(electronDir, "docker", "deepface");
  logStage(`Building Docker image ${IMAGE_TAG} from ${dockerDir}`);
  const buildRes = await downloadOrBuildLatestImage({
    imageTag: IMAGE_TAG,
    buildContextDir: dockerDir,
    platform: DOCKER_PLATFORM,
    pullLatest: false,
    logPrefix: "deepface"
  });
  if (buildRes.result.exitCode !== 0) {
    throw new Error(`DeepFace Docker image build failed with exit code ${buildRes.result.exitCode}`);
  }
}

function parseJsonFromStdout(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
    try {
      return JSON.parse(lines[idx]) as Record<string, unknown>;
    } catch {
      // keep scanning backwards for the JSON payload
    }
  }

  throw new Error("DeepFace returned no JSON payload");
}

export async function runDeepfaceAnalyze(
  req: DeepfaceAnalyzeRequest
): Promise<DeepfaceAnalyzeResponse> {
  const imagePath = path.resolve(req.imagePath);
  await access(imagePath);

  const imageDir = path.dirname(imagePath);
  const imageName = path.basename(imagePath);
  const detectorBackend = req.detectorBackend ?? "opencv";
  const enforceDetection = req.enforceDetection ?? true;
  const antiSpoofing = req.antiSpoofing ?? true;
  const includeRaw = req.includeRaw ?? false;

  const electronDir = path.resolve(process.cwd(), "electron");
  await ensureDeepfaceImage(electronDir);

  const dockerArgs = [
    "run",
    "--rm",
    "--platform",
    DOCKER_PLATFORM,
    "-v",
    `${imageDir}:/input:ro`,
    "-v",
    `${DEEPFACE_CACHE_VOLUME}:/root/.deepface`,
    "-v",
    `${KERAS_CACHE_VOLUME}:/root/.keras`,
    IMAGE_TAG,
    "--image",
    `/input/${imageName}`,
    "--detector-backend",
    detectorBackend,
    "--enforce-detection",
    enforceDetection ? "true" : "false",
    "--anti-spoofing",
    antiSpoofing ? "true" : "false",
    "--include-raw",
    includeRaw ? "true" : "false"
  ];

  logStage("Starting DeepFace Docker analysis");
  const runRes = await runDockerCommand(dockerArgs, { logPrefix: "deepface" });
  if (runRes.exitCode !== 0) {
    throw new Error(
      `DeepFace analysis failed with exit code ${runRes.exitCode}: ${runRes.stderr || runRes.stdout}`
    );
  }

  const payload = parseJsonFromStdout(runRes.stdout);
  return {
    success: true,
    age: typeof payload.age === "number" ? payload.age : null,
    gender: typeof payload.gender === "string" ? payload.gender : null,
    emotion: typeof payload.emotion === "string" ? payload.emotion : null,
    race: typeof payload.race === "string" ? payload.race : null,
    isReal: typeof payload.is_real === "boolean" ? payload.is_real : null,
    antiSpoofingSupported:
      typeof payload.antiSpoofingSupported === "boolean"
        ? payload.antiSpoofingSupported
        : undefined,
    genderProbabilities:
      typeof payload.genderProbabilities === "object" &&
      payload.genderProbabilities !== null &&
      !Array.isArray(payload.genderProbabilities)
        ? (payload.genderProbabilities as Record<string, number>)
        : undefined,
    emotionProbabilities:
      typeof payload.emotionProbabilities === "object" &&
      payload.emotionProbabilities !== null &&
      !Array.isArray(payload.emotionProbabilities)
        ? (payload.emotionProbabilities as Record<string, number>)
        : undefined,
    raceProbabilities:
      typeof payload.raceProbabilities === "object" &&
      payload.raceProbabilities !== null &&
      !Array.isArray(payload.raceProbabilities)
        ? (payload.raceProbabilities as Record<string, number>)
        : undefined,
    raw:
      typeof payload.raw === "object" && payload.raw !== null && !Array.isArray(payload.raw)
        ? (payload.raw as Record<string, unknown>)
        : undefined
  };
}

export function registerDeepfaceHandlers() {
  ipcMain.handle(
    "deepface:analyzeImage",
    async (_event, req: DeepfaceAnalyzeRequest): Promise<DeepfaceAnalyzeResponse> =>
      runDeepfaceAnalyze(req)
  );
}
