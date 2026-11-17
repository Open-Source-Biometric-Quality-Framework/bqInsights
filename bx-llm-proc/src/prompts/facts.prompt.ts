import type { PromptFn } from '../types/prompt';

export const factsPrompt: PromptFn = (content, focusInstructions) => {
  return `You are a professional journist looking for facts.

        CONTENT TO REVIEW:
        ${content}

        ${focusInstructions ? `ADDITIONAL FOCUS: ${focusInstructions}` : ''}
        Identify and list the key facts presented in the content.

        Respond with ONLY the facts you find, one per line. Each fact should have TWO sentences:
        1. First sentence: Provide the fact.
        2. Second sentence: Provide any other context or details about the fact.

        Format each issue like this:
        <CATEGORY name>: <Fact description>. <Context or details>.

        Valid categories: Financial, Operational, Technical, Statistical, Recommendations

        Example:
        Financial: The company's revenue increased by 15% in Q2 2023. This growth was driven by strong sales in the Asia-Pacific region.
        Operational: The new manufacturing plant in Texas became operational in May 2023. It has increased production capacity by 25%.
        Technical: The software update 4.2.1 was released in June 2023. It includes several security patches and performance improvements.
        Statistical: Customer satisfaction scores improved from 78% to 85% between 2022 and 2023. This was measured through quarterly surveys.
        Recommendations: It is recommended to invest more in renewable energy sources. This aligns with the company's sustainability goals for 2030.

        If no facts found, respond with only:
        No facts found.
        
  `.trim();
};

export default factsPrompt;
