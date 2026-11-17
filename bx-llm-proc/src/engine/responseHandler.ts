import { getProcessDefinition, normaliseStep } from '../registry/process.loader';
import POST_STEPS from '../postprocess/steps';
import { PostProcessChain } from '../postprocess/chain/PostProcessChain';

export function postProcess(type: string, response: any): any {
  const def = getProcessDefinition(type);
  if (!def.post?.length) return response;

  const chain = PostProcessChain.start(response);

  for (const raw of def.post) {
    const { name, args } = normaliseStep(raw);
    const runner = POST_STEPS[name];
    if (!runner) throw new Error(`Unknown postprocess step: ${name}`);
    runner(chain, ...args);
  }

  return chain.done();
}
