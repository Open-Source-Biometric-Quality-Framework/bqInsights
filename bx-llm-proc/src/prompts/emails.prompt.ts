import type { PromptFn } from '../types/prompt';

const todayLocale = () => new Date().toLocaleDateString();

export const emailsPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a professional consultant.

DATE: ${todayLocale()}

BASE EMAIL DETAILS:
${content}

${focusInstructions ? `ADDITIONAL FOCUS:
${focusInstructions}` : ''}

Using the base email details provided, draft two professional emails: a short one and a longer one.
In the longer one include draft versions of outcomes e.g. agendas in a table, answers to questions etc.

Format the emails appropriately with paragraphs and proper punctuation. Use markdown.

Separate the two emails by <hr>

Email 1 - short

Email 2 - longer
`.trim();
};

export default emailsPrompt;
