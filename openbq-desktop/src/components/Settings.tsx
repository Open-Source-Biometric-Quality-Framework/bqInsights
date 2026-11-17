import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from 'react-dom';
import { clearCache as clearAnalysisCache } from '../services/cacheService';

type AIBackend = "ollama" | "apple" | "openai" | "claude";

export type FocusInstruction = {
  id: string;
  name: string;
  text: string;
};

export type AISettings = {
  // Focus instructions (multiple)
  focusInstructions: FocusInstruction[];
  selectedFocusInstructionId: string | null;

  backend: AIBackend;

  // Ollama
  ollamaUrl: string;
  ollamaModel: string;
  ollamaOpen: boolean;

  // Apple Intelligence (placeholder flags for your app)
  appleEnabled: boolean;

  // OpenAI
  openaiApiKey: string;
  openaiBaseUrl: string; // allow proxies / local gateways
  openaiModel: string;

  // Anthropic (Claude)
  claudeApiKey: string;
  claudeBaseUrl: string; // allow proxies / local gateways
  claudeModel: string;

  // Optional shared knobs (useful later)
  temperature: number;
  maxTokens: number;
  contextSize: number;

  // PDF Export (Beta)
  pdfExportEnabled: boolean;
  isdefault:boolean;
};

function makeId() {
  // Good enough for localStorage state; avoids extra deps.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_SETTINGS: AISettings = {
  focusInstructions: [],
  selectedFocusInstructionId: null,

  backend: "ollama",

  ollamaUrl: "http://localhost:11434",
  ollamaModel: "gpt-oss:20b",
  ollamaOpen: false,

  appleEnabled: true,

  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "gpt-5.2",

  claudeApiKey: "",
  claudeBaseUrl: "https://api.anthropic.com",
  claudeModel: "claude-3-5-sonnet-latest",

  temperature: 0.3,
  maxTokens: 10000,
  contextSize: 50000,

  pdfExportEnabled: false,

  isdefault:true
};

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampSettings(base: AISettings, incoming: Partial<AISettings>): AISettings {
  return {
    ...base,
    ...incoming,
    temperature:
      typeof incoming.temperature === "number"
        ? Math.min(2, Math.max(0, incoming.temperature))
        : base.temperature,
    maxTokens:
      typeof incoming.maxTokens === "number"
        ? Math.max(1, Math.floor(incoming.maxTokens))
        : base.maxTokens,
    contextSize:
      typeof incoming.contextSize === "number"
        ? Math.max(256, Math.floor(incoming.contextSize))
        : base.contextSize,
  };
}

/**
 * Migration/normalisation:
 * - If older settings had `focusInstructions: string`, upgrade to array + select it.
 * - Ensure selected ID exists; if not, pick first or null.
 */
function mergeSettings(base: AISettings, incoming: any | null): AISettings {
  if (!incoming) return base;

  let merged = clampSettings(base, incoming as Partial<AISettings>);

  let focusList: FocusInstruction[] = [];
  let selectedId: string | null = null;

  // Legacy: string → single instruction
  if (typeof incoming.focusInstructions === "string") {
    const id = makeId();
    focusList = [
      {
        id,
        name: "Default",
        text: incoming.focusInstructions,
      },
    ];
    selectedId = id;
  }

  // Current: array
  else if (Array.isArray(incoming.focusInstructions)) {
    focusList = incoming.focusInstructions
      .filter(Boolean)
      .map((x: any) => ({
        id: typeof x.id === "string" && x.id ? x.id : makeId(),
        name: typeof x.name === "string" ? x.name : "Untitled",
        text: typeof x.text === "string" ? x.text : "",
      }));

    if (typeof incoming.selectedFocusInstructionId === "string") {
      selectedId = incoming.selectedFocusInstructionId;
    }
  }

  // Ensure selectedId is valid
  if (selectedId && !focusList.some((f) => f.id === selectedId)) {
    selectedId = focusList[0]?.id ?? null;
  }
  if (!selectedId && focusList.length > 0) {
    selectedId = focusList[0].id;
  }

  const result = {
    ...merged,
    focusInstructions: focusList,
    selectedFocusInstructionId: selectedId,
  };

  // Return the original base reference if nothing actually changed so React can
  // bail out of re-renders (avoids infinite loops via the custom event bus).
  if (
    JSON.stringify(result) === JSON.stringify(base)
  ) {
    return base;
  }

  return result;
}

export function useAISettings(storageKey = "openbq.settings.ai") {
  const initial = useMemo(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const parsed = safeParseJSON<any>(localStorage.getItem(storageKey));
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  }, [storageKey]);

  const [settings, setSettings] = useState<AISettings>(initial);

  // Save to localStorage on any change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (settings.backend === "ollama") {
  getOllamaModels(settings.ollamaUrl)
    .then((models) => {
      if (models.length === 0) {
        setSettings((prev) =>
        prev.backend !== "ollama" || prev.isdefault ? prev : { ...prev, isdefault: true }
);
      }
    })
    .catch((err) => console.warn("Failed to fetch Ollama models", err));
}
    localStorage.setItem(storageKey, JSON.stringify(settings));
    // Notify other useAISettings instances in the same tab by dispatching
    // a StorageEvent (the cross-tab listener below already handles this event).
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: JSON.stringify(settings) }));
  }, [settings, storageKey]);

  // Optional: listen for changes from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const parsed = safeParseJSON<any>(e.newValue);
      setSettings((prev) => {
        const merged = mergeSettings(prev, parsed);
        return merged !== prev ? merged : prev;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  return { settings, setSettings };
}
// Older method
// export function getAISettings(storageKey = "openbq.settings.ai"): AISettings {
//   if (typeof window === "undefined") return DEFAULT_SETTINGS;
//   const parsed = safeParseJSON<any>(localStorage.getItem(storageKey));
//   return mergeSettings(DEFAULT_SETTINGS, parsed);
// }

export function getAISettings(storageKey = "openbq.settings.ai"): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const parsed = safeParseJSON<any>(localStorage.getItem(storageKey));
  const merged = mergeSettings(DEFAULT_SETTINGS, parsed);
  return merged.backend !== "ollama" ? { ...merged, isdefault: false } : merged;
}

const loadSettings = () => {
    try {
      const raw = window.localStorage.getItem("openbq.settings.ai");
      return raw ? JSON.parse(raw) : null;
    } catch {
      console.warn('Failed to load settings from localStorage');
      return null;
    }
  };


export function setAISettings(next: AISettings, storageKey = "openbq.settings.ai") {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(next));
}

//Async: checks Ollama, updates isdefault/model, saves, notifies hooks
export async function refreshAISettings(storageKey = "openbq.settings.ai"): Promise<AISettings> {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  const current = getAISettings(storageKey);
  let updated: AISettings;

  if (current.backend !== "ollama") {
    // Claude / OpenAI / Apple don't need a local model
    updated = { ...current, isdefault: false };
  } else {
    let models: string[] = [];
    try {
      models = await getOllamaModels(current.ollamaUrl);
    } catch (err) {
      console.warn("Failed to fetch Ollama models", err);
    }

    if (models.length === 0) {
      updated = { ...current, isdefault: true };
    } else {
      const model = models.includes(current.ollamaModel) ? current.ollamaModel : models[0];
      updated = { ...current, ollamaModel: model, isdefault: false };
    }
  }

  // Only save + notify if something changed
  const json = JSON.stringify(updated);
if (json !== localStorage.getItem(storageKey)) {
  localStorage.setItem(storageKey, json);
  window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: json }));
}
return updated;
}

export function getSelectedFocusInstructions(settings: AISettings): string {
  const id = settings.selectedFocusInstructionId;
  if (!id) return "";
  const item = settings.focusInstructions.find((x) => x.id === id);
  return item?.text ?? "";
}

  const getOllamaModels = async (ollamaBase: string) => {
    const normalizedOllamaBase = ollamaBase.replace(/\/+$/, ""); // Remove trailing slash
    const res = await fetch(`${normalizedOllamaBase}/api/tags`, { method: "GET" });
    if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status} ${res.statusText}`);

    // Types can be in one place
    type OllamaTag = { name: string; modified_at?: string; size?: number; digest?: string; details?: any };
    type OllamaTagsResponse = { models?: OllamaTag[] };

    const data = (await res.json()) as OllamaTagsResponse;
    const models = Array.isArray(data.models) ? data.models : [];

    // Sort alphabetically for the dropdown
    models.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return models.map((m) => m.name);
  };

type SettingsProps = {
  storageKey?: string;
  value?: AISettings;
  onChange?: (next: AISettings) => void;
  onClose: () => void
  className?: string;
  title?: string;
  subtitle?: string;
  platform?: string;
};

const Settings = React.memo(function Settings({
  storageKey = "openbq.settings.ai",
  value,
  onChange,
  onClose,
  className,
  platform = "",
  title = "Settings",
  subtitle = "AI and API configuration",
}: SettingsProps) {
  const hook = useAISettings(storageKey);

  console.log('Settings rendered', Date.now()); // ← Add this

  // If value/onChange supplied, be controlled; otherwise use hook state.
  const settings = value ?? hook.settings;
  const setSettings = onChange ?? hook.setSettings;
  const [isDark, setIsDark] = React.useState(
    document.documentElement.classList.contains("dark")
  );

  const [showApiKeys, setShowApiKeys] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  const update = useCallback(<K extends keyof AISettings>(key: K, nextValue: AISettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: nextValue }));
  }, [setSettings]);

  const masked = (s: string) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "");

  // Focus helpers
  const selectedFocus = useMemo(() => {
    const id = settings.selectedFocusInstructionId;
    return id ? settings.focusInstructions.find((x) => x.id === id) ?? null : null;
  }, [settings.focusInstructions, settings.selectedFocusInstructionId]);

  const addFocusInstruction = () => {
    const id = makeId();
    const next: FocusInstruction = { id, name: "New focus", text: "" };
    setSettings({
      ...settings,
      focusInstructions: [...settings.focusInstructions, next],
      selectedFocusInstructionId: id,
    });
  };

  type OllamaTag = { name: string; modified_at?: string; size?: number; digest?: string; details?: any };
  type OllamaTagsResponse = { models?: OllamaTag[] };

  const getOllamaModels = async (ollamaBase: string) => {
    const normalizedOllamaBase = ollamaBase.replace(/\/+$/, ""); // Remove trailing slash
    const res = await fetch(`${normalizedOllamaBase}/api/tags`, { method: "GET" });
    if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status} ${res.statusText}`);

    const data = (await res.json()) as OllamaTagsResponse;
    const models = Array.isArray(data.models) ? data.models : [];

    // Sort alphabetically for the dropdown
    models.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return models.map((m) => m.name);
  };

  // Ollama models state and effect
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.backend !== "ollama") return;
    let cancelled = false;
    setOllamaModelsError(null);
    getOllamaModels(settings.ollamaUrl)
      .then((models) => {
        if (cancelled) return;
        setOllamaModels(models);
        // Auto-select a loaded model on first run / when the configured model
        // isn't actually available in Ollama, so the app works without the
        // user having to manually pick one.
        if (models.length > 0 && !models.includes(settings.ollamaModel)) {
          update("ollamaModel", models[0]);
        }
      })
      .catch((err) => {
        if (!cancelled) setOllamaModelsError(err.message || "Failed to fetch models");
      });
    return () => {
      cancelled = true;
    };
  }, [settings.backend, settings.ollamaUrl]);


  const renameFocusInstruction = (id: string, name: string) => {
    setSettings({
      ...settings,
      focusInstructions: settings.focusInstructions.map((x) => (x.id === id ? { ...x, name } : x)),
    });
  };

  const editFocusInstruction = (id: string, text: string) => {
    setSettings({
      ...settings,
      focusInstructions: settings.focusInstructions.map((x) => (x.id === id ? { ...x, text } : x)),
    });
  };

  const deleteFocusInstruction = (id: string) => {
    const nextList = settings.focusInstructions.filter((x) => x.id !== id);
    const nextSelected =
      settings.selectedFocusInstructionId === id ? nextList[0]?.id ?? null : settings.selectedFocusInstructionId;

    setSettings({
      ...settings,
      focusInstructions: nextList,
      selectedFocusInstructionId: nextSelected,
    });
  };

  const toggleDarkMode = () => {
    const root = document.documentElement;

    root.classList.toggle("dark");

    const nowDark = root.classList.contains("dark");
    setIsDark(nowDark);

    localStorage.setItem("theme", nowDark ? "dark" : "light");
  };

  const handleClearCache = async () => {
    setCacheStatus(null);
    let umapCleared: number | null = null;

    try {
      const res = await window.electron?.umap?.clearCache?.();
      if (res?.success) {
        umapCleared = typeof res.cleared === 'number' ? res.cleared : 0;
      }
    } catch (err) {
      console.warn('Failed to clear UMAP cache', err);
    }

    clearAnalysisCache();

    let clusterLabelsCleared = 0;
    let aiSummaryCleared = 0;
    Object.keys(localStorage).forEach(k => {
      if (k.endsWith(':clusterLabels')) {
        localStorage.removeItem(k);
        clusterLabelsCleared++;
      }
      if (k.endsWith(':aiSummary')) {
        localStorage.removeItem(k);
        aiSummaryCleared++;
      }
    });

    const parts: string[] = [];
    if (umapCleared !== null) parts.push(`${umapCleared} UMAP cache entr${umapCleared === 1 ? 'y' : 'ies'}`);
    parts.push('local analysis cache');
    if (clusterLabelsCleared > 0) parts.push(`${clusterLabelsCleared} cluster label entr${clusterLabelsCleared === 1 ? 'y' : 'ies'}`);
    if (aiSummaryCleared > 0) parts.push(`${aiSummaryCleared} AI summary entr${aiSummaryCleared === 1 ? 'y' : 'ies'}`);
    const msg = 'Cleared ' + parts.join(', ') + '.';

    setCacheStatus(msg);
    window.electron?.showNotification?.('Cache cleared', msg);
  };

  // ESC to close (optional but nice)
  /* useEffect(() => {
     const onKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape') onClose();
     };
     window.addEventListener('keydown', onKeyDown);
     return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);*/

  if (typeof document === 'undefined') return null;


  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40 p-4 sm:p-6 overflow-y-auto z-[9999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-full max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-black/10 dark:border-white/10">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">{title}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {subtitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium
                       border border-black/10 dark:border-white/10
                       bg-white/70 dark:bg-white/5
                       hover:bg-black/5 dark:hover:bg-white/10
                       dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-64px)] overflow-y-auto">
          <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4">
            <div className="flex items-start justify-between gap-3">

              <button
                type="button"
                onClick={() => setShowApiKeys((v) => !v)}
                className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
                title="Toggle API key visibility (stored in localStorage)"
              >
                {showApiKeys ? "Hide keys" : "Show keys"}
              </button>
            </div>
            
            <div className="flex items-start justify-between gap-3">

              <button
                type="button"
                onClick={toggleDarkMode}
                className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
                title="Toggle API key visibility (stored in localStorage)"
              >
                 {isDark ? "Disable Dark Mode" : "Enable Dark Mode"}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="text-xs text-black/60 dark:text-white/60">
                Clear cached analysis results and UMAP embeddings.
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Clear Analysis Cache
                </button>
                {cacheStatus && (
                  <span className="text-xs text-black/60 dark:text-white/60">
                    {cacheStatus}
                  </span>
                )}
              </div>
            </div>

          
            {/* Focus Instructions (multiple) */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold dark:text-gray-300 text-sm">Focus instructions</h4>
                  <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                    Create named instruction sets and select the one to apply during analysis.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addFocusInstruction}
                  className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
                  title="Add a new focus instruction"
                >
                  + Add
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/10 p-3">
                  <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                    Select instruction set
                  </label>

                  <select
                    value={settings.selectedFocusInstructionId ?? ""}
                    onChange={(e) => update("selectedFocusInstructionId", e.target.value || null)}
                    className="w-full px-3 py-2 text-sm rounded-lg
                  bg-white/70 dark:bg-white/5
                  border border-black/10 dark:border-white/10
                  focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40"
                  >
                    <option value="">None</option>
                    {settings.focusInstructions.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name || "Untitled"}
                      </option>
                    ))}
                  </select>

                  {selectedFocus && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={selectedFocus.name}
                        onChange={(e) => renameFocusInstruction(selectedFocus.id, e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg
                      bg-white/70 dark:bg-white/5
                      border border-black/10 dark:border-white/10
                      focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40"
                      />

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-black/60 dark:text-white/60">
                          This selection is what your app should use as the active instructions.
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteFocusInstruction(selectedFocus.id)}
                          className="rounded-md border border-red-300/60 dark:border-red-400/40 px-3 py-1.5 text-xs text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-500/10"
                          title="Delete this instruction set"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedFocus && settings.focusInstructions.length === 0 && (
                    <p className="text-xs text-black/60 dark:text-white/60 mt-2">
                      No focus instruction sets yet. Click “Add” to create one.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/10 p-3">
                  <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                    Instruction text
                  </label>
                  <textarea
                    value={selectedFocus?.text ?? ""}
                    onChange={(e) => {
                      if (!selectedFocus) return;
                      editFocusInstruction(selectedFocus.id, e.target.value);
                    }}
                    placeholder="E.g., 'Pay special attention to technical terminology' or 'Focus on tone and audience appropriateness'"
                    className="w-full px-3 py-2 text-sm rounded-lg h-28
                  bg-white/70 dark:bg-white/5
                  border border-black/10 dark:border-white/10
                  focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40"
                    disabled={!selectedFocus}
                  />
                  {!selectedFocus && (
                    <p className="text-xs text-black/60 dark:text-white/60 mt-2">
                      Select an instruction set to edit its text.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Backend Selection */}
            <div className="mt-4">
              <h4 className="font-semibold dark:text-gray-300 mb-3 text-sm">AI Selection</h4>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.backend === "ollama"}
                    onChange={() => update("backend", "ollama")}
                    className="w-4 h-4"
                  />
                  <span className="dark:text-gray-300 text-sm">
                    Local AI <i className="text-black/60 dark:text-white/60">no data sent externally</i>
                  </span>
                </label>

                {platform == 'macos' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.backend === "apple"}
                      onChange={() => update("backend", "apple")}
                      className="w-4 h-4"
                    />
                    <span className="dark:text-gray-300 text-sm">
                      External AI <i className="text-black/60 dark:text-white/60">Apple Intelligence</i>
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.backend === "openai"}
                    onChange={() => update("backend", "openai")}
                    className="w-4 h-4"
                  />
                  <span className="dark:text-gray-300 text-sm">OpenAI</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={settings.backend === "claude"}
                    onChange={() => update("backend", "claude")}
                    className="w-4 h-4"
                  />
                  <span className="dark:text-gray-300 text-sm">Claude</span>
                </label>

              </div>
            </div>

            {/* Shared knobs */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                  Temperature
                </label>
                <input
                  type="number"
                  value={settings.temperature}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(e) => update("temperature", Number(e.target.value))}
                  className="w-full p-2 text-sm border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                  Max tokens
                </label>
                <input
                  type="number"
                  value={settings.maxTokens}
                  min={1}
                  step={100}
                  onChange={(e) => update("maxTokens", Number(e.target.value))}
                  className="w-full p-2 text-sm border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                  Context size
                </label>
                <input
                  type="number"
                  value={settings.contextSize}
                  min={256}
                  step={1024}
                  onChange={(e) => update("contextSize", Number(e.target.value))}
                  className="w-full p-2 text-sm border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={settings.pdfExportEnabled}
                  onChange={(e) => update("pdfExportEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                Enable PDF Export
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Beta
                </span>
              </label>
            </div>

            {/* Ollama */}
            {settings.backend === "ollama" && (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => update("ollamaOpen", !settings.ollamaOpen)}
                  className="w-full flex items-center justify-between rounded-md border border-blue-300 px-4 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span>Ollama configuration</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${settings.ollamaOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {settings.ollamaOpen && (
                  <div className="space-y-3 pl-6 border-l-2 border-blue-300">
                    <div>
                      <span className="text-sm text-black/70 dark:text-white/70 mb-1 block">
                        1) Install the Ollama server (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://ollama.com/download"
                          className="text-blue-600 underline"
                        >
                          https://ollama.com
                        </a>
                        )
                        <br />
                        2) Choose a model (default gpt-oss:20b)
                        <br />
                        3) Run a test prompt to download the model, e.g.{" "}
                        <code className="bg-black/5 dark:bg-white/10 px-1 rounded ml-1">hello</code>
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                        Ollama URL
                      </label>
                      <input
                        type="text"
                        value={settings.ollamaUrl}
                        onChange={(e) => update("ollamaUrl", e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                        Model name
                      </label>
                      <input
                        type="text"
                        value={settings.ollamaModel}
                        onChange={(e) => update("ollamaModel", e.target.value)}
                        placeholder="llama3.1, mistral, codellama, etc."
                        className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                        Enter the exact Ollama model tag you have pulled.
                      </p>
                      {settings.ollamaOpen && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-black/70 dark:text-white/70 mb-1">
                            Choose from available models
                          </label>
                          <select
                            value={settings.ollamaModel}
                            onChange={(e) => update("ollamaModel", e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg
                          bg-white/70 dark:bg-white/5
                          border border-black/10 dark:border-white/10
                          focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40 mb-2"
                            disabled={ollamaModelsError !== null || ollamaModels.length === 0}
                          >
                            <option value="">Select a model…</option>
                            {ollamaModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-black/60 dark:text-white/60">
                            {ollamaModelsError
                              ? <span>Error loading models: {ollamaModelsError}</span>
                              : ollamaModels.length > 0
                                ? <span>Available models: {ollamaModels.join(", ")}</span>
                                : <span>Loading models…</span>
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Apple */}
            {settings.backend === "apple" && (
              <div className="mt-4 rounded-lg border border-black/10 dark:border-white/10 p-3 bg-white/40 dark:bg-black/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium dark:text-gray-200">Apple Intelligence</div>
                    <div className="text-xs text-black/60 dark:text-white/60">
                      Uses your Apple client integration. Requires installation of a shortcut{" "}
                      <a target="_blank" rel="noreferrer" href="https://www.icloud.com/shortcuts/8ee9fad25fa04de287035487f714cffa">
                        (click here)
                      </a>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.appleEnabled}
                      onChange={(e) => update("appleEnabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm dark:text-gray-200">Enabled</span>
                  </label>
                </div>
              </div>
            )}

            {/* OpenAI */}
            {settings.backend === "openai" && (
              <div className="mt-4 space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3 bg-white/40 dark:bg-black/10">
                <div className="text-sm font-medium dark:text-gray-200">OpenAI</div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    API key
                  </label>
                  <input
                    type={showApiKeys ? "text" : "password"}
                    value={settings.openaiApiKey}
                    onChange={(e) => update("openaiApiKey", e.target.value)}
                    placeholder={showApiKeys ? "sk-..." : masked(settings.openaiApiKey) || "sk-..."}
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                    Stored in localStorage. For production, prefer a server-side proxy to avoid exposing keys.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={settings.openaiBaseUrl}
                    onChange={(e) => update("openaiBaseUrl", e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={settings.openaiModel}
                    onChange={(e) => update("openaiModel", e.target.value)}
                    placeholder="gpt-5.2"
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Claude */}
            {settings.backend === "claude" && (
              <div className="mt-4 space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3 bg-white/40 dark:bg-black/10">
                <div className="text-sm font-medium dark:text-gray-200">Claude</div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    API key
                  </label>
                  <input
                    type={showApiKeys ? "text" : "password"}
                    value={settings.claudeApiKey}
                    onChange={(e) => update("claudeApiKey", e.target.value)}
                    placeholder={showApiKeys ? "sk-ant-..." : masked(settings.claudeApiKey) || "sk-ant-..."}
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  <p className="text-xs text-black/60 dark:text-white/60 mt-1">
                    Stored in localStorage. For production, prefer a server-side proxy to avoid exposing keys.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={settings.claudeBaseUrl}
                    onChange={(e) => update("claudeBaseUrl", e.target.value)}
                    placeholder="https://api.anthropic.com"
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black/70 dark:text-white/70 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={settings.claudeModel}
                    onChange={(e) => update("claudeModel", e.target.value)}
                    placeholder="claude-3-5-sonnet-latest"
                    className="w-full p-2 border border-black/10 dark:border-white/10 rounded bg-white/70 dark:bg-black/20 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-black/60 dark:text-white/60"></div>
          </div>
        </div>
      </div>
    </div>
    ,
    document.body);
})

export default Settings;

/*
USAGE (example)

import Settings, { useAISettings } from "./Settings";

function Page() {
  const { settings, setSettings } = useAISettings();

  return (
    <>
      <div className="hidden lg:block w-px bg-black/10 dark:bg-white/10" />
      <main className="lg:col-start-3 min-w-0">
        <div className="space-y-6">
          <Settings value={settings} onChange={setSettings} />
          ...
        </div>
      </main>
    </>
  );
}

*/


