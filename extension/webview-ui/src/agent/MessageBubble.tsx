// Individual chat message with markdown rendering and requirement ID links
import React, { useCallback } from 'react';
import type { Message, ChangeInfo } from './useAgentMessages';
import { renderMarkdown } from './markdown';
import { ChangeProposal } from './ChangeProposal';
import { getVsCodeApi } from '../shared/vscodeApi';

interface MessageBubbleProps {
  message: Message;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAllowAllChanges: (changeId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onAcceptChange,
  onRejectChange,
  onAllowAllChanges,
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
        {message.content}
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
