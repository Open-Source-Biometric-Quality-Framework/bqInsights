import type { PromptFn } from '../types/prompt';
import { todayLocale } from '../../utils/date';

export const reviewPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a professional document editor.

        CONTENT TO REVIEW:
        ${content}

        ${focusInstructions ? `ADDITIONAL FOCUS: ${focusInstructions}` : ''}

        Review for grammar, spelling, consistency, repetition, style and suggestions.

        Respond with ONLY the issues you find, one per line. Each issue should have TWO sentences:
        1. First sentence: Describe the issue and provide context
        2. Second sentence: Provide a specific suggestion to fix it

        Format each issue like this:
        CATEGORY: Issue description with context. Suggestion to fix it.

        Valid categories: Grammar, Spelling, Consistency, Repetition, Style, Suggestions

        Example:
        Grammar: In paragraph 2, "the data shows" should be "the data show" since data is plural. Change to "the data show significant trends".
        Spelling: "occured" is misspelled in the third paragraph. Change to "occurred".
        Consistency: The document uses both "e-mail" and "email". Choose one spelling and use it throughout.
        Suggestions: Add some more examples in the section on user engagement to illustrate key points.

        If no issues found, respond with only:
        No issues found.
`.trim();
};

export default reviewPrompt;
