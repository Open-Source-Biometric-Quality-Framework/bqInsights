import { useState, useEffect, useCallback } from "react";

interface DockerInfo {
  installed: boolean;
  running: boolean;
}
interface OllamaInfo {
  installed: boolean;
  running: boolean;
}
interface UserInfo {
  username: string;
  uid: string | number;
}
interface AppInfo {
  name?: string;
  version?: string;
  platform?: string;
  company?: string;
  docker?: DockerInfo;
  ollama?: OllamaInfo;
  userInfo?: UserInfo;
}
interface FooterProps {
  appInfo?: AppInfo;
}

const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";
const DOCKER_DOWNLOAD_URL = "https://www.docker.com/products/docker-desktop/";
const OLLAMA_SEARCH_URL = "https://ollama.com/search";
const DOCKER_START_CMD =
  "docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama";

const OLLAMA_MODELS = [
  { name: "gemma3:270m", size: "292MB" },
  { name: "gemma3:1b", size: "815MB" },
  { name: "deepseek-r1:1.5b", size: "1.1 GB" },
  { name: "gemma3:4b", size: "3.3GB" },
  { name: "deepseek-r1:8b", size: "5.2GB" },
  { name: "gemma4:e2b", size: "7.2GB" },
  { name: "gemma4:e4b", size: "9.6GB" },
  { name: "gpt-oss:20b", size: "14GB" },
  { name: "gemma4:26b-mlx (Darwin)", size: "18GB" },
  { name: "qwen3.6:35b-mlx (Darwin)", size: "22Gb" },
];

export const Footer = ({ appInfo }: FooterProps) => {
  const [showOllamaHelp, setShowOllamaHelp] = useState(false);
  const [showDockerHelp, setShowDockerHelp] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [serviceRunning, setServiceRunning] = useState<boolean | null>(null);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceMsg, setServiceMsg] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("gemma3:4b");
  const [customModel, setCustomModel] = useState("");
  const [pullBusy, setPullBusy] = useState(false);
  const [pullMsg, setPullMsg] = useState<string>("");
  const [dockerRunning, setDockerRunning] = useState<boolean | null>(null);

  const refreshStatus = useCallback(async () => {
    const ollamaRes = await window.electron?.ollama?.status();
    setServiceRunning(ollamaRes?.running ?? false);
    const info = await window.electron?.getAppInfo?.();
    if (info?.docker) setDockerRunning(info.docker.running);
  }, []);

  // Check once on mount.
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const getUserInitial = () => {
    return appInfo?.userInfo?.username?.charAt(0).toUpperCase() || '?';
  };

  const mailtoSubject = `SUPPORT: openbq desktop: v ${appInfo?.version} (${appInfo?.platform})`;
  const mailtoBody = [
    "Please describe the issue.",
    "",
    "[Include as much relevant info as you can, we will get back to you shortly]",
    "",
    "Debug Info -",
    `* Docker: installed ${appInfo?.docker?.installed}, running ${appInfo?.docker?.running}`,
    `* Ollama: installed ${appInfo?.ollama?.installed}, running ${appInfo?.ollama?.running}`,
  ].join("\n");
  const mailto = `mailto:support@openbq.io?subject=${encodeURIComponent(
    mailtoSubject
  )}&body=${encodeURIComponent(mailtoBody)}`;

  const copyCommand = async (label: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore copy failures
    }
  };

  const checkServiceStatus = async () => {
    try {
      const res = await window.electron?.ollama?.status();
      setServiceRunning(res?.running ?? false);
    } catch {
      setServiceRunning(false);
    }
  };

  const handleStartService = async () => {
    setServiceBusy(true);
    setServiceMsg("Starting Ollama service…");
    try {
      const res = await window.electron?.ollama?.startService();
      setServiceMsg(res?.message ?? "");
      setServiceRunning(res?.ok ?? false);
    } catch (err) {
      setServiceMsg(err instanceof Error ? err.message : "Failed to start service");
      setServiceRunning(false);
    } finally {
      setServiceBusy(false);
    }
  };

  const effectiveModel = selectedModel === "__custom__" ? customModel.trim() : selectedModel;
  const pullCommand = `curl http://localhost:11434/api/pull -d '{"model": "${effectiveModel}"}'`;

  const handlePullModel = async () => {
    const model = effectiveModel;
    if (!model) return;
    setPullBusy(true);
    setPullMsg(`Pulling "${model}"… this may take a while.`);
    try {
      const res = await window.electron?.ollama?.pullModel(model);
      setPullMsg(res?.message ?? "");
    } catch (err) {
      setPullMsg(err instanceof Error ? err.message : "Failed to pull model");
    } finally {
      setPullBusy(false);
    }
  };

  const ollamaAvailable = serviceRunning === true;

  return (
    <section className="h-full overflow-auto pr-4 text-left text-xs text-gray-500 dark:text-gray-400 leading-relaxed pr-10 pt-1">
      <div>
        {/*{appInfo?.name}
        <span className="mx-1">•</span>*/}
        v<span className="font-mono">{appInfo?.version} - {appInfo?.platform} </span>
        <br />

        {dockerRunning === true ? (
          <span>✓ Docker <button type="button" onClick={refreshStatus} className="inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh status">↻</button></span>
        ) : dockerRunning === false ? (
          <>
            <button
              type="button"
              onClick={() => setShowDockerHelp(true)}
              className="text-red-600 underline bg-transparent border-0 p-0 cursor-pointer font-inherit"
            >
              ✗ Docker not running
            </button>
            <button type="button" onClick={refreshStatus} className="ml-1 inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh status">↻</button>
          </>
        ) : (
          <span>… Docker <button type="button" onClick={refreshStatus} className="inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh status">↻</button></span>
        )}

        <span className="mx-1">•</span>
        {ollamaAvailable ? (
          <span>✓ Ollama <button type="button" onClick={refreshStatus} className="inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh status">↻</button></span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setShowOllamaHelp(true);
                checkServiceStatus();
              }}
              className="text-red-600 underline bg-transparent border-0 p-0 cursor-pointer font-inherit"
            >
              ✗ Ollama not running
            </button>
            <button type="button" onClick={refreshStatus} className="ml-1 inline bg-transparent border-0 p-0 cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh status">↻</button>
          </>
        )}
        <br />
        <a
          href={mailto}
          onClick={(e) => {
            e.preventDefault();
            window.electron?.shell?.openExternal(mailto);
          }}
        >
          Support or Issues
        </a>
        <br />

        {/*    <span>© 2026 {appInfo?.company}</span>
        <span className="mx-1">•</span> */}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-300 dark:bg-blue-600 text-gray-700 dark:text-gray-200 font-semibold text-[10px]">
            {getUserInitial()}
          </span>
          <span>{appInfo?.userInfo?.username}</span>
        </span>
      </div>

      {showOllamaHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowOllamaHelp(false)}
        >
          <div
            className="w-[520px] max-w-[90vw] rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold">Ollama is not running</h3>
              <button
                type="button"
                onClick={() => setShowOllamaHelp(false)}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 font-medium">Option 1 — Install Ollama Desktop</div>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Download and install the official Ollama desktop app.
                </p>
                <button
                  type="button"
                  onClick={() => window.electron?.shell?.openExternal(OLLAMA_DOWNLOAD_URL)}
                  className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors"
                >
                  Go to Ollama download page
                </button>
              </div>

              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 font-medium">Option 2 — Run Ollama via Docker</div>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Start the Ollama container, then pull a model.
                </p>

                <div className="mb-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Start service</span>
                    <span
                      className="inline-flex cursor-help items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500"
                      title="Uses GPU (--gpus=all) on Linux/Windows with an NVIDIA GPU + Container Toolkit. On macOS, use Ollama desktop app for better performance."
                    >
                      <span aria-hidden="true">ⓘ</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartService}
                      disabled={serviceBusy}
                      className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {serviceBusy ? "Starting…" : "Start service"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyCommand("start", DOCKER_START_CMD)}
                      className="shrink-0 rounded border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                      title={DOCKER_START_CMD}
                    >
                      {copied === "start" ? "Copied" : "Copy cmd"}
                    </button>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-[12px]">
                    <span
                      className={
                        serviceRunning === null
                          ? "inline-block w-2.5 h-2.5 rounded-full bg-gray-400"
                          : serviceRunning
                          ? "inline-block w-2.5 h-2.5 rounded-full bg-green-500"
                          : "inline-block w-2.5 h-2.5 rounded-full bg-red-500"
                      }
                    />
                    {serviceRunning === null
                      ? "checking…"
                      : serviceRunning
                      ? "Running"
                      : "Not running"}
                  </div>
                  {serviceMsg && (
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{serviceMsg}</div>
                  )}
                </div>

                <div>
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Download model</div>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {OLLAMA_MODELS.map((m) => (
                      <option key={m.name} value={m.name}>
                        {`${m.name} — ${m.size}`}
                      </option>
                    ))}
                    <option value="__custom__">Custom…</option>
                  </select>

                  {selectedModel === "__custom__" && (
                    <input
                      autoFocus
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Type a custom model name"
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px] dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    />
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePullModel}
                      disabled={pullBusy || !effectiveModel}
                      className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pullBusy ? "Downloading…" : "Download model"}
                    </button>
                    <button
                      type="button"
                      title={pullCommand}
                      onClick={() => copyCommand("pull", pullCommand)}
                      className="shrink-0 rounded border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                      {copied === "pull" ? "Copied" : "Copy cmd"}
                    </button>
                  </div>

                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => window.electron?.shell?.openExternal(OLLAMA_SEARCH_URL)}
                      className="text-[11px] text-blue-600 underline dark:text-blue-400"
                    >
                      Browse models on Ollama
                    </button>
                  </div>
                  {pullMsg && (
                    <div className="mt-1 whitespace-pre-wrap rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                      {pullMsg}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 font-medium">Already installed?</div>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  If you already have Ollama installed, it may need to be launched. Click Refresh to check again.
                </p>
                <button
                  type="button"
                  onClick={() => { refreshStatus(); setShowOllamaHelp(false); checkServiceStatus(); }}
                  className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors"
                >
                  Refresh status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDockerHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowDockerHelp(false)}
        >
          <div
            className="w-[520px] max-w-[90vw] rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold">Docker is not running</h3>
              <button
                type="button"
                onClick={() => setShowDockerHelp(false)}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 font-medium">Install Docker Desktop</div>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Download and install Docker Desktop for your platform.
                </p>
                <button
                  type="button"
                  onClick={() => window.electron?.shell?.openExternal(DOCKER_DOWNLOAD_URL)}
                  className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors"
                >
                  Go to Docker download page
                </button>
              </div>

              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-2 font-medium">Already installed?</div>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Docker may need to be launched or may still be starting up. Click Refresh to check again.
                </p>
                <button
                  type="button"
                  onClick={() => { refreshStatus(); setShowDockerHelp(false); }}
                  className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-md border border-black/10 dark:border-gray-600 bg-white dark:bg-black/30 text-[12px] font-medium shadow-sm hover:bg-black/5 dark:hover:bg-black/50 transition-colors"
                >
                  Refresh status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
