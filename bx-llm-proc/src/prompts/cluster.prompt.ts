import type { PromptFn } from '../types/prompt';

export const clusterPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a data analyst.

CLUSTER INPUT:
${content}

${focusInstructions ? `ADDITIONAL FOCUS:
${focusInstructions}` : ''}

Provide a structured clustering interpretation.
Use markdown headings for sections and concise bullet points.
`.trim();
};

export default clusterPrompt;
