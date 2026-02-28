// Scrollable chat message list with auto-scroll
import React, { useEffect, useRef } from 'react';
import type { Message } from './useAgentMessages';
import { MessageBubble } from './MessageBubble';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
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
          <div className="message message-system">
            Ask about your requirements, request quality assessments,
            or let the agent monitor your spec. Type /help for commands.
          </div>
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
        <div className="message message-system">Thinking...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
