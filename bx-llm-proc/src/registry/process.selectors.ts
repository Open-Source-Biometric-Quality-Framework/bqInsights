import { getProcessRegistry } from './process.loader';

export type ProcessOption = {
  value: string;
  label: string;
};

export function getProcessOptionsForInputKind(
  inputKind: 'doc' | 'excel' | 'email' | 'plain'
): ProcessOption[] {
  const registry = getProcessRegistry();

  return Object.entries(registry)
    .filter(([_, def]) => def.meta?.inputKind === inputKind)
    .map(([key, def]) => ({
      value: key,
      label: def.meta?.label ?? key
    }));
}