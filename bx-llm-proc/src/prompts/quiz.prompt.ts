import type { PromptFn } from '../types/prompt';

export const quizPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a professional educator.

 CHAPTER TO REVIEW:
${content}
${focusInstructions ? `ADDITIONAL FOCUS: ${focusInstructions}` : ''}
Generate a list of insightful questions and multiple choice options based on the content provided.
Each question should be followed by three answer options labeled A, B, and C.

Format each question like this:
Question <Number>: <B><Question Text></B><br>* A. <Option A><br>* B. <Option B><br>* C. <Option C><br><br>Answer: <Correct Option Letter>

Example:

Question 1: <B>What is the capital of France?</B><br>* A. Berlin<br>* B. Madrid<br>* C. Paris<br><br>Answer: C 
Question 2: <B>Which element has the chemical symbol 'O'?</B><br>* A. Gold<br>* B. Oxygen<br>* C. Silver<br><br>Answer: B

Ensure that the questions cover key concepts from the content and vary in difficulty level.
Each question should be a separate paragraph.
Answers should be randomly distributed among options A, B, and C.
`.trim();
};

export default quizPrompt;
