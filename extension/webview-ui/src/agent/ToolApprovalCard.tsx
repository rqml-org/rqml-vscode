// Inline approval card for /implement tool calls (writeFile, updateSpec)
// Features: keyboard navigation (Tab cycles, Enter selects, arrow keys)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ToolApprovalInfo } from './useAgentMessages';

interface ToolApprovalCardProps {
  approval: ToolApprovalInfo;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  onAllowAll: (approvalId: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  writeFile: 'Write File',
  updateSpec: 'Update Spec',
};

const ACTIONS = ['Accept', 'Reject', 'Allow All'] as const;

export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  approval,
  onApprove,
  onReject,
  onAllowAll,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const resolved = approval.status !== 'pending';
  const label = TOOL_LABELS[approval.toolName] || approval.toolName;

  // Auto-focus when pending so keyboard works immediately
  useEffect(() => {
    if (!resolved) {
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({ block: 'nearest' });
        containerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [resolved]);

  const executeAction = useCallback((index: number) => {
    switch (index) {
      case 0: onApprove(approval.approvalId); break;
      case 1: onReject(approval.approvalId); break;
      case 2: onAllowAll(approval.approvalId); break;
    }
  }, [approval.approvalId, onApprove, onReject, onAllowAll]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (resolved) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      setHighlightIndex(prev =>
        e.shiftKey
          ? (prev - 1 + ACTIONS.length) % ACTIONS.length
          : (prev + 1) % ACTIONS.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeAction(highlightIndex);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, ACTIONS.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    }
  }, [resolved, highlightIndex, executeAction]);

  return (
    <div
      className={`tool-approval-card${resolved ? ' tool-resolved' : ''}`}
      ref={containerRef}
      tabIndex={resolved ? undefined : 0}
      onKeyDown={handleKeyDown}
    >
      <div className="tool-approval-header">
        <span className="tool-approval-label">{label}</span>
        {approval.filePath && (
          <span className="tool-approval-path">{approval.filePath}</span>
        )}
      </div>

      {approval.preview && (
        <div className="tool-approval-preview-section">
          <button
            className="tool-approval-toggle"
            onClick={() => setExpanded(!expanded)}
            tabIndex={-1}
          >
            {expanded ? 'Hide preview' : 'Show preview'}
          </button>
          {expanded && (
            <pre className="tool-approval-preview">{approval.preview}</pre>
          )}
        </div>
      )}

      {approval.status === 'pending' && (
        <div className="tool-approval-actions">
          {ACTIONS.map((action, i) => (
            <button
              key={action}
              className={
                (i === 0 ? 'btn-accept' : 'btn-reject')
                + (highlightIndex === i ? ' highlighted' : '')
              }
              tabIndex={-1}
              onClick={() => executeAction(i)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {resolved && (
        <div className="tool-approval-status">
          {approval.status === 'approved' ? 'Approved.' : 'Rejected.'}
        </div>
      )}
    </div>
  );
};
