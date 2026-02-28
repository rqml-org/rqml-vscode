// Individual chat message with markdown rendering and requirement ID links
import React, { useCallback } from 'react';
import type { Message, ChangeInfo } from './useAgentMessages';
import { renderMarkdown } from './markdown';
import { ChangeProposal } from './ChangeProposal';
import { ToolApprovalCard } from './ToolApprovalCard';
import { UserChoiceCard } from './UserChoiceCard';
import { getVsCodeApi } from '../shared/vscodeApi';

interface MessageBubbleProps {
  message: Message;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAllowAllChanges: (changeId: string) => void;
  onApproveToolCall: (approvalId: string) => void;
  onRejectToolCall: (approvalId: string) => void;
  onAllowAllToolCalls: (approvalId: string) => void;
  onRespondToChoice: (choiceId: string, selected: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onAcceptChange,
  onRejectChange,
  onAllowAllChanges,
  onApproveToolCall,
  onRejectToolCall,
  onAllowAllToolCalls,
  onRespondToChoice,
}) => {
  const vscode = getVsCodeApi();

  // Handle clicks on requirement ID links
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('req-link')) {
      e.preventDefault();
      const reqId = target.getAttribute('data-req-id');
      if (reqId) {
        vscode.postMessage({ type: 'navigateToRequirement', payload: { id: reqId } });
      }
    }
  }, []);

  if (message.role === 'user') {
    return (
      <div className="message message-user">
        {message.content}
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div className="message message-system">
        {!message.userChoice && message.content}
        {message.toolApproval && (
          <ToolApprovalCard
            approval={message.toolApproval}
            onApprove={onApproveToolCall}
            onReject={onRejectToolCall}
            onAllowAll={onAllowAllToolCalls}
          />
        )}
        {message.userChoice && (
          <UserChoiceCard
            choice={message.userChoice}
            onSelect={onRespondToChoice}
          />
        )}
      </div>
    );
  }

  // Assistant or command message — render as markdown
  const html = renderMarkdown(message.content);
  const className = message.role === 'command' ? 'message message-command' : 'message message-assistant';

  return (
    <div className={className}>
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
      {message.streaming && <span className="streaming-cursor" />}
      {message.change && (
        <ChangeProposal
          change={message.change}
          onAccept={onAcceptChange}
          onReject={onRejectChange}
          onAllowAll={onAllowAllChanges}
        />
      )}
    </div>
  );
};
