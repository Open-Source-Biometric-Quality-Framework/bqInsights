import React, { useState } from 'react';
import { RenderTreeView } from './RenderTreeView';
import { runLLMProcess } from './../llm/engine/llmEngine';
import type { RenderTree } from './../llm/render/render.types';

function callLLM(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`${prompt}`);
    }, 50);
  });
}
;
export function LLMProcessTest() {
  const [tree, setTree] = useState<RenderTree | null>(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);

    const result = await runLLMProcess(
      'quiz',
      '$test1$',
      undefined,
      callLLM
    );

    // IMPORTANT: use result.processed
    // check if result.processed is RenderTree or a categories object
    if (typeof result.processed === 'object' && Array.isArray(result.processed)) {
      setTree(result.processed as RenderTree);
      console.log("RenderTree", result);
    } else if (typeof result.processed === 'object' && result.processed !== null && 'categories' in result.processed) {
      console.log("Categories", result);
      setCategories(result.processed.categories);
    }

    setLoading(false);
  }

  return (
    <div>
      <button onClick={run} disabled={loading}>
        Run quiz
      </button>

      {tree && <RenderTreeView tree={tree} />}
      {categories && (<div>
        <h3>Categories Result:</h3>
        <pre>{JSON.stringify(categories, null, 2)}</pre>
      </div>
      )}
    </div>
  );
}
;
