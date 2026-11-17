import type { PromptFn } from '../types/prompt';
import { todayLocale } from '../../utils/date';

export const minutesPrompt: PromptFn = (content, focusInstructions) => {
  return `You are a senior management consultant preparing a structured consulting report for executive stakeholders.

DATE: ${new Date().toLocaleDateString()}

SOURCE MATERIAL:
The following content is a verbatim meeting transcript. Treat it as raw input material.

TRANSCRIPT:
"
${content}

${focusInstructions ? `PRIMARY FOCUS AREA: ${focusInstructions}` : ''}
"

Your task is to create a formal set of meeting minutes, including

1. Summary
2. Key Discussion Points
3. Open Questions
4. Action Items

* Owner, Details, Due, Priority

Formatting requirements:
- Use markdown headings and bullet points
- Keep language crisp, structured, and executive-appropriate
- Avoid speculation or external knowledge

Output in markdown only.
`.trim();
};

export default minutesPrompt;