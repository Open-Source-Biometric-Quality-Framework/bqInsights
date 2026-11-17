
import type { RenderTree } from '../llm/render/render.types';
import { renderNodeRenderers } from './renderNodeRenderers';

export function RenderTreeView({ tree }: { tree: RenderTree }) {
  return (
    <>
      {tree.map((node, i) => {
        const renderer = renderNodeRenderers[node.type];
        if (!renderer) {
          return (
            <pre key={i}>
              Unsupported render node: {node.type}
            </pre>
          );
        }
        return renderer(node as any, i);
      })}
    </>
  );
}