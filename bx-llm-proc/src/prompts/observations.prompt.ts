import type { PromptFn } from '../types/prompt';
import { todayLocale } from '../../utils/date';

export const observationsPrompt: PromptFn = (content, focusInstructions) => {
  return  `You are a professional editor looking to ask probing questions about the content to improve understanding.

        CONTENT TO REVIEW:
        ${content}

        ${focusInstructions ? `ADDITIONAL FOCUS: ${focusInstructions}` : ''}
        Generate a list of questions that could be asked about the content provided to improve understanding or readability

        The observations or questions are open-ended and do not have specific answer options. Each question should be directed to if it is helping to improve understanding of the content.

        Format each question like this:
        <Observation Type>: <Explaination>.<Suggestion to improve understanding>.

        Example:
        Clarity: The section on market trends is vague. Could you provide specific examples to illustrate the points made?
        Depth: The analysis of customer behavior lacks depth. What additional data or insights could be included to enhance this section?
        Organization: The flow of ideas in the introduction is disjointed. How might rearranging the paragraphs improve coherence? 
        Figures: The charts provided are not clearly labeled. Would adding titles and legends help clarify the data presented?     
        
        If no questions found, respond with only:
        No questions found.
        `.trim();
};

export default observationsPrompt;
