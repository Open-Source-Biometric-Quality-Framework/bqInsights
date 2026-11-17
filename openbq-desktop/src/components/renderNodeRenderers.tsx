import React from 'react';
import type { RenderNode } from '../llm/render/render.types';
import type { JSX } from 'react';


export const renderNodeRenderers: {
  [K in RenderNode['type']]?: (
    node: Extract<RenderNode, { type: K }>,
    key: React.Key
  ) => React.ReactElement;
} = {
  paragraph: (node, key) => <p key={key}>{node.text}</p>,

list: (node, key) => (
  <ul key={key} style={{ listStyle: 'none', paddingLeft: 0 }}>
    {node.items.map((item, i) => (
      <li
        key={i}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <input
          type="radio"
          name={`list-${key}`}   // ← groups the radios
          aria-label={`Option ${i + 1}`}
        />
        <span>{item}</span>
      </li>
    ))}
  </ul>
),

  heading: (node, key) => {
    const H = `h${node.level}` as keyof JSX.IntrinsicElements;
    return <H key={key}>** {node.text} **</H>;
  },

  html: (node, key) => (
    <div key={key} dangerouslySetInnerHTML={{ __html: node.html }} />
  ),

  table: (node, key) => (
    <table key={key}>
      <tbody>
        {node.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),

  tab: (node, key) => (
    <div key={key} className="tab">
      {node.content}
    </div>
  )
};