// HoverInfo.tsx - Hover information display component

import React from 'react';

type HoverInfoProps = {
  hoverIndex: number | null;
  hoverImageBase64: string | null;
};

export function HoverInfo({ hoverIndex, hoverImageBase64 }: HoverInfoProps) {
  if (hoverIndex === null) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 10,
        top: 10,
        background: '#000',
        color: '#0f0',
        padding: 8,
        fontFamily: 'monospace',
        fontSize: 12,
        border: '1px solid #333',
        pointerEvents: 'none',
        borderRadius: 4
      }}
    >

      {hoverImageBase64 && (
        <div style={{ marginTop: 10 }}>
          <img
            src={`data:image/jpeg;base64,${hoverImageBase64}`}
            alt="Hover preview"
            style={{
              maxWidth: 200,
              maxHeight: 200,
              display: 'block',
              borderRadius: 4
            }}
          />
        </div>
      )}
    </div>
  );
}