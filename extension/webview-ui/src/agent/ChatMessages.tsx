// Scrollable chat message list with auto-scroll
import React, { useEffect, useRef } from 'react';
import type { Message, StartupStatus } from './useAgentMessages';
import { MessageBubble } from './MessageBubble';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
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
      {isLoading && (
        <div className="working-indicator">
          {(window as any).__WEBVIEW_DATA__?.rqmlIconUri && (
            <img
              className="working-icon"
              src={(window as any).__WEBVIEW_DATA__.rqmlIconUri}
              alt=""
            />
          )}
          <span className="working-text">Working...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
