// Inline approval card for /implement tool calls (writeFile, updateSpec)
import React, { useState } from 'react';
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

export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  approval,
  onApprove,
  onReject,
  onAllowAll,
}) => {
  const [expanded, setExpanded] = useState(false);
  const resolved = approval.status !== 'pending';
  const label = TOOL_LABELS[approval.toolName] || approval.toolName;

  return (
    <div className={`tool-approval-card${resolved ? ' tool-resolved' : ''}`}>
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
          <button className="btn-accept" onClick={() => onApprove(approval.approvalId)}>
            Accept
          </button>
          <button className="btn-reject" onClick={() => onReject(approval.approvalId)}>
            Reject
          </button>
          <button className="btn-reject" onClick={() => onAllowAll(approval.approvalId)}>
            Allow All
          </button>
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
