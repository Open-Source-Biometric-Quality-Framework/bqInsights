import type { PromptFn } from '../types/prompt';
import { todayLocale } from '../../utils/date';

export const actionsPrompt: PromptFn = (content, focusInstructions) => {
  return `You are a senior management consultant preparing a structured consulting report for executive stakeholders.

DATE: ${new Date().toLocaleDateString()}

SOURCE MATERIAL:
The following content is a verbatim meeting transcript. Treat it as raw input material.

TRANSCRIPT:
"
${content}

${focusInstructions ? `PRIMARY FOCUS AREA: ${focusInstructions}` : ''}
"

Your task is to extract the key acion items from the transcript and summarize in a set of headings like

# **Task_1_Description**


**Owner(s)**: (Person Responsible | blank if not clear)

**Details**: (Deatiled Description of the Task)

**Due**: (e.g. Soon | blank if not clear)

**Priority**: (High, Med, Low | blank if not clear)

Use --- between tasks

Formatting requirements:
- Use markdown headings and bullet points
- Keep language crisp, structured, and executive-appropriate
- Avoid speculation or external knowledge

Output in markdown only.
`.trim();
};

export default actionsPrompt;