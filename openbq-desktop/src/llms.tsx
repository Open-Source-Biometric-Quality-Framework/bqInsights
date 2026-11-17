import type { AISettings } from "./components/Settings.tsx";
//import {llm_prompt, llm_post_process_response} from './chunk.tsx';

const DEBUG=true

const isElectron = typeof window !== "undefined" && !!window.electron?.isElectron;

async function callAppleLLM(prompt: string) {
  if (!window.electron?.isElectron) throw new Error("Apple LLM requires Electron");
  const client = await window.electron.llm.create({
    provider: "apple",
    shortcutName: "Ask AI",
  });
  return client.chat(prompt); 
}

async function callOpenAI(prompt: string, apikey: string) {
  if (!window.electron?.isElectron) throw new Error("OpenAI LLM requires Electron");
  const client = await window.electron.llm.create({
    provider: "openai",
    apiKey: apikey,
  });
  return client.chat(prompt); 
}

async function callOllama(prompt: string, settings: AISettings) {
  if (!window.electron?.isElectron) throw new Error("Ollama LLM requires Electron");
  const client = await window.electron.llm.create({
    provider: "ollama",
    model: settings.ollamaModel,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    contextSize: settings.contextSize,
  });
  console.log(prompt)
  return client.chat(prompt);
}




  
// -----------------------------
// Small utilities
// -----------------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function fetchJsonOrText(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; statusText: string; text: string; json?: any }> {
  const res = await fetch(url, init);
  const text = await res.text(); // only read body once
  let json: any | undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore; caller can use text
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, text, json };
}

function redactKey(key?: string) {
  if (!key) return "";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

// -----------------------------
// Provider calls
// -----------------------------



async function callClaude(prompt: string, settings: AISettings): Promise<string> {
  if (!settings.claudeApiKey) throw new Error("Claude API key missing (settings.claudeApiKey).");

  const base = settings.claudeBaseUrl?.trim() || "https://api.anthropic.com";
  const url = joinUrl(base, "/v1/messages");

  const temperature = clamp(settings.temperature ?? 0.3, 0, 1);
  const maxTokens = Math.max(1, settings.maxTokens ?? 2048);

  const { ok, status, statusText, json, text } = await fetchJsonOrText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.claudeApiKey,
      // Anthropic requires anthropic-version header  [oai_citation:3‡Claude Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api?utm_source=chatgpt.com)
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.claudeModel,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (DEBUG) {
    console.log("Claude status:", status, statusText);
    console.log("Claude key:", redactKey(settings.claudeApiKey));
  }

  if (!ok) {
    const msg = json?.error?.message || text;
    throw new Error(`Claude error ${status}: ${String(msg).slice(0, 300)}`);
  }

  // Messages API returns content blocks; collect text blocks  [oai_citation:4‡Claude Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api?utm_source=chatgpt.com)
  const blocks = json?.content;
  if (Array.isArray(blocks)) {
    const t = blocks
      .map((b: any) => (b?.type === "text" && typeof b?.text === "string" ? b.text : ""))
      .join("")
      .trim();
    if (t) return t;
  }

  // Some SDKs also include a convenience field; keep a loose fallback
  const alt = json?.completion || json?.text || "";
  if (typeof alt === "string" && alt.trim()) return alt.trim();

  throw new Error(`Claude response had no extractable text (raw: ${String(text).slice(0, 200)})`);
}

// -----------------------------
// Unified LLM entry point
// -----------------------------
export async function callLLM(prompt: string, settings: AISettings): Promise<string> {
  switch (settings.backend) {
    case "apple": {
      const appleRes = await callAppleLLM(prompt);
      if (!appleRes?.content) throw new Error("Apple LLM returned empty content.");
      return appleRes.content;
    }
    case "ollama": {
      const res = await callOllama(prompt, settings);
      console.log('********'+JSON.stringify(res))
      if (!res?.content) throw new Error("Ollama returned empty content.");
      return res.content;
    }
    case "openai":{
      const res = await callOpenAI(prompt, settings.openaiApiKey);
      if (!res?.content) throw new Error("OpenAI returned empty content.");
      return res.content;
    }
    case "claude":
      return callClaude(prompt, settings);
    default:
      throw new Error(`Engine ${String(settings.backend)} not set up`);
  }
}

// -----------------------------
// Your refactored analyzeChunk
// -----------------------------
type LineFormatResult = {
  categories: Record<string, string[]>;
};

export async function analyzeChunk(
  content: unknown,
  fullDocumentText = "",
  opts?: {
    isExcel?: boolean;
    reportType?: string;
    settings?: AISettings;
    DEBUG?: boolean;
    adhocText?: string;
  }
): Promise<LineFormatResult> {
  const {
    isExcel = false,
    reportType = "default",
    settings,
    DEBUG = false,
    adhocText = ""
  } = opts || {};

  if (!settings) {
    return { categories: { Error: ["Missing AI settings."] } };
  }

  const text = typeof content === "string" ? content : String(content ?? "");
  const normalised = text.trim();

  if (!normalised || normalised.length < 10) {
    return {
      categories: {
        Info: ["Section too short to analyse. This section contains minimal content."],
      },
    };
  }

  console.log("FOCUS")
  let focus = settings.focusInstructions.find(o => o.id === settings.selectedFocusInstructionId)?.text ?? null;
  console.log(settings.selectedFocusInstructionId)
  console.log(settings.focusInstructions)
  if (settings.selectedFocusInstructionId != null) {
    console.log(focus);
  } else {
    console.log("No focus instruction selected.");
  }
  if (adhocText) {
    focus = focus+"\n\n"+adhocText
  }

  const prompt =  llm_prompt(reportType, text, focus)

  if (DEBUG) {
    console.log("=== SENDING TO LLM ===");
    console.log("Backend:", settings.backend);
    console.log("Content preview:", text.substring(0, 500));
    console.log("Content length:", text.length);
  }

  try {
    /* Call the LLM */
    let llmText = prompt
    if (!prompt.startsWith('# None')) {
        llmText = await callLLM(prompt, settings);
    }

    if (DEBUG) {
      console.log("=== LLM RESPONSE ===");
      console.log("Response length:", llmText.length);
      console.log("Content preview:", llmText.substring(0, 800));
    }

    //if (isExcel) {
    //  return { categories: { Null: [llmText] } };
    //}

    return llm_post_process_response(reportType, llmText);
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err);
    console.error("=== ANALYSIS ERROR ===", msg);

    return {
      categories: {
        Error: [`Analysis failed: ${msg}`],
      },
    };
  }
}

import { runLLMProcess } from '../../bx-llm-proc/src/engine/llmEngine' // './llm/engine/llmEngine';
import type { RenderTree } from '../../bx-llm-proc/src/render/render.types' // './llm/render/render.types';

type AnalyzeChunkResult =
  | { kind: 'render'; tree: RenderTree }
  | { kind: 'categories'; categories: Record<string, string[]> };

export async function analyzeChunk2(
  content: unknown,
  fullDocumentText = "",
  opts?: {
    isExcel?: boolean;
    reportType?: string;
    settings?: AISettings;
    DEBUG?: boolean;
    adhocText?: string;
  }
): Promise<AnalyzeChunkResult> {
  const {
    reportType = "default",
    settings,
    DEBUG = false,
    adhocText = ""
  } = opts || {};

  if (!settings) {
    return {
      kind: 'categories',
      categories: { Error: ["Missing AI settings."] }
    };
  }

  console.log("analyzeChunk2 called with reportType:", reportType,content,adhocText);

  const text = typeof content === "string" ? content : String(content ?? "");
  const normalised = text.trim();

  if (!normalised || normalised.length < 10) {
    return {
      kind: 'categories',
      categories: {
        Info: ["Section too short to analyse. This section contains minimal content."]
      }
    };
  }

  // Resolve focus instructions
  let focus =
    settings.focusInstructions.find(
      o => o.id === settings.selectedFocusInstructionId
    )?.text ?? null;

  if (adhocText) {
    focus = focus ? `${focus}\n\n${adhocText}` : adhocText;
  }

  if (DEBUG) {
    console.log("=== ANALYZE CHUNK ===");
    console.log("Report type:", reportType);
    console.log("Focus:", focus);
    console.log("Content length:", text.length);
  }

  try {
    const result = await runLLMProcess(
      reportType,
      text,
      focus,
      (prompt) => callLLM(prompt, settings)
    );

    if (DEBUG) {
      console.log("=== LLM RAW OUTPUT ===");
      console.log(result.raw.substring(0, 800));
    }

    const processed = result.processed;

    // RenderTree case
    if (Array.isArray(processed)) {
      return {
        kind: 'render',
        tree: processed as RenderTree
      };
    }

    // Categories case
    if (
      typeof processed === 'object' &&
      processed !== null &&
      'categories' in processed
    ) {
      return {
        kind: 'categories',
        categories: (processed as any).categories
      };
    }

    // Fallback (should not normally happen)
    return {
      kind: 'categories',
      categories: {
        Error: ["Unknown analysis output format."]
      }
    };
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err);

    console.error("=== ANALYSIS ERROR ===", msg);

    return {
      kind: 'categories',
      categories: {
        Error: [`Analysis failed: ${msg}`]
      }
    };
  }
}
