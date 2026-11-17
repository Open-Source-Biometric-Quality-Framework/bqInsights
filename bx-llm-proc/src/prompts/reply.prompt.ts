import type { PromptFn } from '../types/prompt';

const todayLocale = () => new Date().toLocaleDateString();

export const replyPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a professional consultant.

DATE: ${todayLocale()}

BASE EMAIL DETAILS:
${content}

${focusInstructions ? `ADDITIONAL FOCUS:
${focusInstructions}` : ''}

Using the email details provided, draft a professional reply.

The email should be clear, concise, and tailored to the intended recipient.

Format the email appropriately with paragraphs and proper punctuation. Use markdown and markdown lists as appropriate.

Do not include any explanations or additional text outside of the email body.
`.trim();
};

export default replyPrompt;
