import type { PromptFn } from '../types/prompt';

export const presentationPrompt: PromptFn = (content, focusInstructions) => {
  return `
You are a professional consultant creating an executive presentation.

  CONTENT TO REVIEW:
  ${content}

  ${focusInstructions ? `ADDITIONAL FOCUS: ${focusInstructions}` : ''}
  Create key points for a presentation based on the content provided. Each key point should be concise and informative.

  Organize the key points into a logical structure suitable for a presentation. Prepend each key point with a slide number.

  Format each slide like this:
  Slide <Number>: <b><Title></b><br>* <Key Point 1><br>* <Key Point 2><br>* <Key Point 3>

  Example:
  "
  Slide 1: <b>Introduction to the topic and its significance</b><br>* There were three main factors contributing to the issue.<br>* The first factor was economic downturn affecting markets.<br>* The second factor was changes in consumer behavior due to technological advancements.
  Slide 2: <b>Overview of the current situation and challenges</b><br>* Market volatility has increased due to geopolitical tensions.<br>* This has led to uncertainty among investors.
  "
  Each key point should be on its own line. Each slide should have at least three key points.

  The minimum number of slides is 2 and the maximum number of slides is 5.

  Respond with ONLY the text, Slide one per line. 
  
`.trim();
};

export default presentationPrompt;
