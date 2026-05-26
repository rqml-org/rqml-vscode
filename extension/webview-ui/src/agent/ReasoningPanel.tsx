// REQ-AGT-029: Collapsible reasoning panel attached to assistant messages.
//
// Streams reasoning text live while the model is thinking; auto-collapses
// once the final answer begins streaming, but keeps the full trace
// accessible behind a click on the header.

import React, { useEffect, useRef, useState } from 'react';

interface ReasoningPanelProps {
  reasoning: string;
  /** True while reasoning is actively streaming. */
  active: boolean;
  /** Epoch ms when reasoning started. */
  startedAt?: number;
  /** Epoch ms when reasoning ended. */
  endedAt?: number;
}

export const ReasoningPanel: React.FC<ReasoningPanelProps> = ({ reasoning, active, startedAt, endedAt }) => {
  // While streaming, the panel is open. Once it ends, it auto-collapses
  // — but the user may have manually expanded it again.
  const [userToggled, setUserToggled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Track active → ended transition to auto-collapse exactly once.
  useEffect(() => {
    if (active) {
      setExpanded(true);
      setUserToggled(false);
    } else if (!userToggled) {
      setExpanded(false);
    }
  }, [active, userToggled]);

  // Auto-scroll to the bottom while reasoning is streaming.
  useEffect(() => {
    if (active && expanded && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [reasoning, active, expanded]);

  // Live-update the elapsed timer while reasoning is active.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) return;
    const handle = window.setInterval(() => forceTick(t => t + 1), 500);
    return () => window.clearInterval(handle);
  }, [active, startedAt]);

  if (!reasoning && !active) return null;

  const elapsedMs = startedAt
    ? (endedAt && !active ? endedAt - startedAt : Date.now() - startedAt)
    : 0;
  const elapsedLabel = formatElapsed(elapsedMs);

  const headerText = active
    ? `Thinking… ${elapsedLabel}`
    : `Thought for ${elapsedLabel}`;

  return (
    <div className={`reasoning-panel${active ? ' active' : ''}${expanded ? ' expanded' : ''}`}>
      <button
        className="reasoning-header"
        type="button"
        onClick={() => {
          setUserToggled(true);
          setExpanded(e => !e);
        }}
        title={expanded ? 'Hide reasoning' : 'Show reasoning'}
        aria-expanded={expanded}
      >
        <span className="reasoning-icon" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        <span className="reasoning-label">{headerText}</span>
      </button>
      {expanded && (
        <div className="reasoning-body" ref={bodyRef}>
          {reasoning}
          {active && <span className="reasoning-cursor" />}
        </div>
      )}
    </div>
  );
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  return `${mins}m ${remSec}s`;
}
