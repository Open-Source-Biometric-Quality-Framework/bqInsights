import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DockerCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type DockerStatus = {
  installed: boolean;
  running: boolean;
};

type DockerCommandOptions = {
  logPrefix?: string;
};

type DockerImageUpdateOptions = {
  imageTag: string;
  platform?: string;
  pullRef?: string;
  buildContextDir?: string;
  pullLatest?: boolean;
  noCache?: boolean;
  logPrefix?: string;
};

export async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [command]);
    return true;
  } catch {
    return false;
  }
}

export function runDockerCommand(
  args: string[],
  options: DockerCommandOptions = {}
): Promise<DockerCommandResult> {
  const { logPrefix = "docker" } = options;

  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk).trim();
      stdout += String(chunk);
      if (text) console.log(`[${logPrefix}][stdout] ${text}`);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk).trim();
      stderr += String(chunk);
      if (text) console.log(`[${logPrefix}][stderr] ${text}`);
    });

    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      })
    );
  });
}

export async function checkDockerStatus(timeoutMs = 3000): Promise<DockerStatus> {
  const installed = await commandExists("docker");
  if (!installed) {
    return { installed: false, running: false };
  }

  try {
    await execFileAsync("docker", ["info"], { timeout: timeoutMs });
    return { installed: true, running: true };
  } catch {
    return { installed: true, running: false };
  }
}

export async function isDockerImageDownloaded(
  imageTag: string,
  logPrefix = "docker"
): Promise<boolean> {
  const inspectRes = await runDockerCommand(["image", "inspect", imageTag], { logPrefix });
  return inspectRes.exitCode === 0;
}

export async function pullDockerImage(
  imageRef: string,
  options: { platform?: string; logPrefix?: string } = {}
): Promise<DockerCommandResult> {
  const args = ["pull"];
  if (options.platform) {
    args.push("--platform", options.platform);
  }
  args.push(imageRef);
  return runDockerCommand(args, { logPrefix: options.logPrefix ?? "docker-pull" });
}

export async function buildDockerImage(
  imageTag: string,
  buildContextDir: string,
  options: { platform?: string; noCache?: boolean; logPrefix?: string } = {}
): Promise<DockerCommandResult> {
  const args = ["build"];
  if (options.platform) {
    args.push("--platform", options.platform);
  }
  if (options.noCache) {
    args.push("--no-cache");
  }
  args.push("-t", imageTag, buildContextDir);
  return runDockerCommand(args, { logPrefix: options.logPrefix ?? "docker-build" });
}

export async function downloadOrBuildLatestImage(
  options: DockerImageUpdateOptions
): Promise<{ action: "pulled" | "built"; result: DockerCommandResult }> {
  const {
    imageTag,
    platform,
    pullRef,
    buildContextDir,
    pullLatest = true,
    noCache = false,
    logPrefix = "docker-image"
  } = options;

  if (pullLatest) {
    const ref = pullRef ?? imageTag;
    const pullRes = await pullDockerImage(ref, { platform, logPrefix });
    if (pullRes.exitCode === 0) {
      return { action: "pulled", result: pullRes };
    }
    if (!buildContextDir) {
      throw new Error(
        `Failed to pull Docker image ${ref}: ${pullRes.stderr || pullRes.stdout || "unknown error"}`
      );
    }
  }

  if (buildContextDir) {
    const buildRes = await buildDockerImage(imageTag, buildContextDir, {
      platform,
      noCache,
      logPrefix
    });
    if (buildRes.exitCode !== 0) {
      throw new Error(
        `Failed to build Docker image ${imageTag}: ${
          buildRes.stderr || buildRes.stdout || "unknown error"
        }`
      );
    }
    return { action: "built", result: buildRes };
  }

  throw new Error(`No image source configured for ${imageTag}. Provide pullRef or buildContextDir.`);
}

