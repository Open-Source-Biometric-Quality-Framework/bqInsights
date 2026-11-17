export type StepSpec = string | [string, ...any[]];

export interface ProcessDefinition {
  prompt: string;
  pre?: string[];
  post?: StepSpec[];
  meta?: {
    label?: string;
    description?: string;
    inputKind?: 'doc' | 'excel' | 'email' | 'plain';
    outputKind?: 'categories' | 'html' | 'string' | 'unknown' | 'render';
  };
}

export type ProcessRegistry = Record<string, ProcessDefinition>;
