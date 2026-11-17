import { getProcessDefinition } from '../registry/process.loader';
import PROMPTS from '../prompts';
import PREPROCESSORS from '../preprocess';

export function buildPrompt(type: string, content: any, focusInstructions?: any): string {
  const def = getProcessDefinition(type);

  let data = content;
  for (const step of def.pre ?? []) {
    const fn = PREPROCESSORS[step];
    if (!fn) throw new Error(`Unknown preprocessor: ${step}`);
    data = fn(data);
  }

  const promptFn = PROMPTS[def.prompt];
  if (!promptFn) throw new Error(`Unknown prompt: ${def.prompt}`);

  console.log("Using prompt:", def.prompt); 
  console.log("Prompt content:", promptFn(data, focusInstructions));

  return promptFn(data, focusInstructions);
}
