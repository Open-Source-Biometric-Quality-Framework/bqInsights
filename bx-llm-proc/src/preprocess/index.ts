import { normaliseInput } from './normaliseInput';
import { toDataRows } from './toDataRows';
import { toClusters } from './toClusters';
import { toOutliers } from './toOutliers';

export type PreProcessFn = (data: any) => any;

export const PREPROCESSORS: Record<string, PreProcessFn> = {
  normaliseInput,
  toDataRows,
  toClusters,
  toOutliers,
};

export default PREPROCESSORS;
