import type { PromptFn } from '../types/prompt';

import review from './review.prompt';
import facts from './facts.prompt';
import emails from './emails.prompt';
import reply from './reply.prompt';
import quiz from './quiz.prompt';
import presentation from './presentation.prompt';
import cluster from './cluster.prompt';
import outlier from './outlier.prompt';
import observations from './observations.prompt';
import transcription from './transcription.prompt';
import actions from './actions.prompt'
import minutes from './minutes.prompt'

export const PROMPTS: Record<string, PromptFn> = {
  review,
  facts,
  emails,
  reply,
  quiz,
  presentation,
  cluster,
  outlier,
  observations,
  transcription,
  actions,
  minutes
};

export default PROMPTS;
