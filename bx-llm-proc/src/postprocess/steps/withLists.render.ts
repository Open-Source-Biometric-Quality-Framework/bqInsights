import type { RenderTree } from '../../render/render.types';

/* Example input:
Here is a list of items:<br>
- Item one<br>
- Item two<br>
- Item three<br><br>
This is a new paragraph.
*/

const tests_dict = {
  '$test1$': `Here is a list of items:<br>
- Item one<br>
- Item two<br>
- Item three<br><br>
This is a new paragraph`
}

export function stepWithListsToRenderTree(response: string): RenderTree {

  // find if response matches a test case
  for (const [key, test] of Object.entries(tests_dict)) {
    if (response.includes(key)) {
      response = test;
      break;
    }
  }
  const blocks = response.split(/\n\n+/);
  const tree: RenderTree = [];

  tree.push({ type: 'heading', text: 'Quiz', level: 1 });

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('<br>').map(l => l.trim()).filter(Boolean);

    let listItems: string[] = [];
    // Shuffle array utility
    function shuffle<T>(array: T[]): T[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    for (const line of lines) {
      if (/^[-*]\s/.test(line)) {
        listItems.push(line.replace(/^[-*]\s/, ''));
      } else {
        if (listItems.length) {
          tree.push({ type: 'list', items: shuffle([...listItems]) } as RenderTree[number]);
          listItems = [];
        }
        tree.push({ type: 'paragraph', text: line } as RenderTree[number]);
      }
    }
    if (listItems.length) {
      tree.push({ type: 'list', items: shuffle([...listItems]) } as RenderTree[number]);
      listItems = [];
    }
  }

  // let rows = [["A 1 2 3 4 5", "B", "C"], ["1", "2", "3"], ["4", "5", "6"]];

  // tree.push({ type: 'table', rows: rows  });

  return tree;
}