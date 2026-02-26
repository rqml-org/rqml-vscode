// Accept/reject UI for file change proposals
import React from 'react';
import type { ChangeInfo } from './useAgentMessages';

interface ChangeProposalProps {
  change: ChangeInfo;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAllowAll: (changeId: string) => void;
}

export const ChangeProposal: React.FC<ChangeProposalProps> = ({
  change,
  onAccept,
  onReject,
  onAllowAll,
}) => {
  const resolved = change.status !== 'pending';

  return (
    <div className={`change-proposal${resolved ? ' change-applied' : ''}`}>
      <div className="change-proposal-header">Proposed change</div>
      {change.diff && (
        <div className="change-proposal-diff">{change.diff}</div>
      )}
      {!change.diff && change.description && (
        <div className="change-proposal-diff">{change.description}</div>
      )}
      {change.status === 'pending' && (
        <div className="change-proposal-actions">
          <button className="btn-accept" onClick={() => onAccept(change.changeId)}>Accept</button>
          <button className="btn-reject" onClick={() => onReject(change.changeId)}>Reject</button>
          <button className="btn-reject" onClick={() => onAllowAll(change.changeId)}>Allow All</button>
        </div>
      )}
      {resolved && (
        <div className="change-status">
          {change.status === 'applied' ? 'Change applied.' : 'Change rejected.'}
        </div>
      )}
    </div>
  );
};
