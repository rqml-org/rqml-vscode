// Side-by-side line diff renderer.
// Left column shows old content (deletions highlighted red).
// Right column shows new content (additions highlighted green).

import React from 'react';
import type { DiffRow } from './useAgentMessages';

interface DiffViewProps {
  rows: DiffRow[];
  /** When true, the left column is suppressed and everything is rendered as an insertion */
  allInsert?: boolean;
}

export const DiffView: React.FC<DiffViewProps> = ({ rows, allInsert }) => {
  if (!rows || rows.length === 0) {
    return <div className="diff-view-empty">(no changes)</div>;
  }

  return (
    <div className={`diff-view${allInsert ? ' diff-view-new-file' : ''}`} role="table">
      {rows.map((row, idx) => (
        <div key={idx} className={`diff-row diff-row-${row.type}`} role="row">
          {!allInsert && (
            <>
              <div className="diff-gutter diff-gutter-left">
                {row.leftNum ?? ''}
              </div>
              <div className="diff-cell diff-cell-left">
                <span className="diff-marker">
                  {row.type === 'delete' || row.type === 'replace' ? '−' : ' '}
                </span>
                <span className="diff-text">{row.left ?? ''}</span>
              </div>
            </>
          )}
          <div className="diff-gutter diff-gutter-right">
            {row.rightNum ?? ''}
          </div>
          <div className="diff-cell diff-cell-right">
            <span className="diff-marker">
              {row.type === 'insert' || row.type === 'replace' ? '+' : ' '}
            </span>
            <span className="diff-text">{row.right ?? ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
