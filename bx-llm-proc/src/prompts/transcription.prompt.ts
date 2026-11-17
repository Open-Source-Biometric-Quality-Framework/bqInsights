import type { PromptFn } from '../types/prompt';
import { todayLocale } from '../../utils/date';

export const transcriptionPrompt: PromptFn = (content, focusInstructions) => {
  return `You are a senior management consultant preparing a structured consulting report for executive stakeholders.

DATE: ${new Date().toLocaleDateString()}

SOURCE MATERIAL:
The following content is a verbatim meeting transcript. Treat it as raw input material, not as meeting minutes.

TRANSCRIPT:
${content}

${focusInstructions ? `PRIMARY FOCUS AREA: ${focusInstructions}` : ''}

Your task is to synthesise the transcript into a clear, executive-ready consulting report.
The report should emphasise analysis, implications, and decision-relevant insights, with particular depth applied to the PRIMARY FOCUS AREA.

Guiding principles:
- Do not restate the transcript or narrate the conversation
- Abstract and synthesise themes, positions, and signals
- Prioritise implications, trade-offs, and strategic relevance
- Use professional, neutral, consulting-grade language
- Base all findings strictly on the transcript content
- Explicitly weight and expand analysis related to the PRIMARY FOCUS AREA

Include the following sections:

# Title
A clear, consulting-style report title reflecting the core subject and focus area.

## Executive Summary
A succinct overview of:
- The context and objective
- The most material insights
- The key implications for decision-makers
- Any high-confidence recommended direction

## Context and Objectives
Two short paragraphs outlining:
- Why the discussion took place
- What outcomes or decisions the discussion was intended to support

## Current State Assessment
An analytical summary of the situation as evidenced in the transcript, including:
- Capabilities, constraints, or assumptions
- Stakeholder positions or alignments
- Maturity, readiness, or gaps
Where relevant, explicitly relate this to the PRIMARY FOCUS AREA.

## Key Insights
A bullet list of the most important insights emerging from the discussion.
Each insight should reflect synthesis and interpretation, not quotes.

## Issues, Risks, and Constraints
A structured list of:
- Material risks or concerns raised
- Uncertainties or dependencies
- Organisational, technical, or commercial constraints
Highlight any risks that disproportionately affect the PRIMARY FOCUS AREA.

## Options and Implications
Where options or directions are discussed or implied, outline:
- The viable options
- The implications, trade-offs, or consequences of each
Do not invent options not grounded in the transcript.

## Recommendations
Based on the transcript and analysis:
- Provide clear, consulting-style recommendations
- Indicate confidence level (e.g. strong signal vs emerging)
- Tie recommendations explicitly to the PRIMARY FOCUS AREA where applicable

## Actions and Next Steps
Present a markdown table with:
| Action | Owner | Rationale | Indicative Timing |
Only include actions supported by the transcript.

## Open Questions and Information Gaps
List unresolved questions, assumptions requiring validation, or information gaps that must be addressed before further progress.

Formatting requirements:
- Use markdown headings and bullet points
- Keep language crisp, structured, and executive-appropriate
- Avoid speculation or external knowledge
- Produce a report, not meeting notes

Output in markdown only.
`.trim();
};

export default transcriptionPrompt;