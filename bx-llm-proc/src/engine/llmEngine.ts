import { buildPrompt } from './execute';
import { postProcess } from './responseHandler';

export async function runLLMProcess(
  type: string,
  content: any,
  focusInstructions?: any,
  callLLM?: (prompt: string) => Promise<string>
) {
  const prompt = buildPrompt(type, content, focusInstructions);

  // Inject your provider here
  const raw = callLLM ? await callLLM(prompt) : prompt;

  const processed = postProcess(type, raw);
  return { prompt, raw, processed };
}
