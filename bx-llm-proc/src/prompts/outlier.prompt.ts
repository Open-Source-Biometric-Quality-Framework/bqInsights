import type { PromptFn } from '../types/prompt';

export const outlierPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a data analyst.

OUTLIER INPUT:
${content}

${focusInstructions ? `ADDITIONAL FOCUS:
${focusInstructions}` : ''}

Identify likely outliers, explain why, and provide recommended follow-up checks.
Return a fenced code block with key findings if appropriate.
`.trim();
};

export default outlierPrompt;
