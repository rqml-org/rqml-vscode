// Scrollable chat message list with auto-scroll
import React, { useEffect, useRef, useState } from 'react';
import type { Message, StartupStatus } from './useAgentMessages';
import { MessageBubble } from './MessageBubble';
import { getVsCodeApi } from '../shared/vscodeApi';

/** Format elapsed seconds as e.g. "8s" or "1m 05s". */
function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) { return `${totalSeconds}s`; }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  tokensUsed: number;
  startupStatus: StartupStatus | null;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAllowAllChanges: (changeId: string) => void;
  onApproveToolCall: (approvalId: string) => void;
  onRejectToolCall: (approvalId: string) => void;
  onAllowAllToolCalls: (approvalId: string) => void;
  onRespondToChoice: (choiceId: string, selected: string) => void;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  tokensUsed,
  startupStatus,
  onAcceptChange,
  onRejectChange,
  onAllowAllChanges,
  onApproveToolCall,
  onRejectToolCall,
  onAllowAllToolCalls,
  onRespondToChoice,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // REQ-AGT-033: tick elapsed seconds while the agent is working. Restarts each
  // time work begins (isLoading false → true).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isLoading) { return; }
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  return (
    <div className="chat-messages" ref={containerRef}>
      {messages.length === 0 && !isLoading && (
        <div className="welcome-banner">
          {(window as any).__WEBVIEW_DATA__?.logoUri && (
            <img
              className="welcome-logo"
              src={(window as any).__WEBVIEW_DATA__.logoUri}
              alt="RQML"
            />
          )}
          {startupStatus ? (
            <div className="status-card">
              <div className="status-summary">{startupStatus.summary}</div>
              <div className="status-next-step">{startupStatus.nextStep}</div>
              {!startupStatus.specLoaded && (
                <button
                  className="init-spec-btn"
                  onClick={() => getVsCodeApi().postMessage({ type: 'initSpec' })}
                >
                  Create RQML Spec
                </button>
              )}
            </div>
          ) : (
            <div className="status-card">
              <div className="status-summary">Loading...</div>
            </div>
          )}
        </div>
      )}
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onAcceptChange={onAcceptChange}
          onRejectChange={onRejectChange}
          onAllowAllChanges={onAllowAllChanges}
          onApproveToolCall={onApproveToolCall}
          onRejectToolCall={onRejectToolCall}
          onAllowAllToolCalls={onAllowAllToolCalls}
          onRespondToChoice={onRespondToChoice}
        />
      ))}
      {/* Suppress the generic working indicator while a reasoning panel is
          actively streaming — the panel's own header + cursor are a clearer
          indicator. */}
      {isLoading && !messages.some(m => m.reasoningActive) && (() => {
        const iconsRaw = (window as any).__WEBVIEW_DATA__?.rqmlIcons;
        const icons = iconsRaw ? (typeof iconsRaw === 'string' ? JSON.parse(iconsRaw) : iconsRaw) : null;
        const src = icons?.purple;
        return (
          <div className="working-indicator" role="status" aria-label="Working">
            {src && <img className="working-icon" src={src} alt="Working" />}
            <span className="working-stats">
              <span className="working-stat">{formatElapsed(elapsed)}</span>
              <span className="working-stat-dot" />
              <span className="working-stat">{tokensUsed.toLocaleString()} tokens</span>
            </span>
          </div>
        );
      })()}
      <div ref={bottomRef} />
    </div>
  );
};
