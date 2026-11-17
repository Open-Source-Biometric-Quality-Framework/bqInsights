import type { ProcessRegistry, StepSpec } from '../types/process';
import processes from './processes.json';

export function getProcessRegistry(): ProcessRegistry {
  return processes as unknown as ProcessRegistry;
}

export function getProcessDefinition(type: string) {
  const reg = getProcessRegistry();
  const def = reg[type];
  if (!def) throw new Error(`Unknown process: ${type}`);
  return def;
}

export function normaliseStep(step: StepSpec): { name: string; args: any[] } {
  if (Array.isArray(step)) {
    const [name, ...args] = step as any[];
    return { name: String(name), args };
  }
  return { name: String(step), args: [] };
}
