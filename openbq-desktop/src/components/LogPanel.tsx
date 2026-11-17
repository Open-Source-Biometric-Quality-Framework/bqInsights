import React, { useEffect, useRef } from 'react';

type LogPanelProps = {
  logs: string[];
  autoScroll?: boolean;
};

export function LogPanel({ logs, autoScroll = true }: LogPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  return (
    <div
      ref={containerRef}
      style={{
        marginTop: 20,
        background: '#000',
        color: '#0f0',
        padding: 10,
        fontFamily: 'monospace',
        maxHeight: 300,
        overflowY: 'auto',
        border: '1px solid #333',
        borderRadius: 4
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: '#666' }}>No logs yet...</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            {log}
          </div>
        ))
      )}
    </div>
  );
}