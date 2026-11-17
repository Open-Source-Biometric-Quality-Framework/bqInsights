import type { RenderNode } from './render.types';

export function isRenderNode(value: any): value is RenderNode {
  return value && typeof value === 'object' && typeof value.type === 'string';
}

export function isRenderTree(value: any): value is RenderNode[] {
  return Array.isArray(value) && value.every(isRenderNode);
}