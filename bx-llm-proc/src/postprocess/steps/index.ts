import { PostProcessChain } from '../chain/PostProcessChain';

import { stepLists } from './lists';
import { stepHiddenAnswers } from './hiddenAnswers';
import { stepExtractFenced } from './extractFenced';
import { stepMdToHtml } from './mdToHtml';
import { stepSlideLists } from './slideLists';
import { stepSectionsFromHeadings } from './sectionsFromHeadings';
import { stepParseLineFormat } from './parseLineFormat';
import { stepWrapSingle } from './wrapSingle';
import { stepWithListsToRenderTree } from './withLists.render';

export type StepRunner = (chain: PostProcessChain, ...args: any[]) => PostProcessChain;

export const POST_STEPS: Record<string, StepRunner> = {
  lists: (c) => c.apply(v => stepLists(String(v)), 'lists'),
  hiddenAnswers: (c) => c.apply(v => stepHiddenAnswers(v), 'hiddenAnswers'),
  extractFenced: (c) => c.apply(v => stepExtractFenced(String(v)), 'extractFenced'),
  mdToHtml: (c) => c.apply(v => stepMdToHtml(String(v)), 'mdToHtml'),
  slideLists: (c) => c.apply(v => stepSlideLists(String(v)), 'slideLists'),
  sectionsFromHeadings: (c) => c.apply(v => stepSectionsFromHeadings(v), 'sectionsFromHeadings'),
  parseLineFormat: (c) => c.apply(v => stepParseLineFormat(String(v)) as any, 'parseLineFormat'),
  wrapSingle: (c, heading: string) => c.apply(v => stepWrapSingle(heading, String(v)) as any, 'wrapSingle'),
  withListsRender: (c) =>
  c.apply(v => stepWithListsToRenderTree(String(v)), 'withListsRender'),
};

export default POST_STEPS;
