// REQ-MAT-006: Detail panel showing full upstream/downstream context for the selected row.
import React from 'react';
import type { ChipRef, MatrixRow, RelationshipRef } from '../types';
import { Chip, ChipList } from './Chip';
import { ImpactPill, StatusPill, SyncPill, VerificationPill } from './StatusPill';

interface DetailPanelProps {
  row: MatrixRow;
  onClickChip: (chip: ChipRef) => void;
  onClose: () => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ row, onClickChip, onClose }) => {
  // Group relationships by type for readability
  const grouped = new Map<string, RelationshipRef[]>();
  for (const rel of row.relationships) {
    const list = grouped.get(rel.type) || [];
    list.push(rel);
    grouped.set(rel.type, list);
  }
  const relationshipTypes = Array.from(grouped.keys()).sort();

  return (
    <div className="detail-panel">
      <button
        className="detail-close"
        onClick={onClose}
        title="Close details (Esc)"
        aria-label="Close details"
        type="button"
      >
        ×
      </button>
      <header className="detail-section">
        <h2>{row.id}</h2>
        <div style={{ fontSize: '0.95em' }}>{row.title}</div>
      </header>

      <dl className="detail-meta">
        <dt>Type</dt>            <dd>{row.type}</dd>
        <dt>Status</dt>          <dd><StatusPill status={row.status} /></dd>
        <dt>Priority</dt>        <dd>{row.priority ?? '—'}</dd>
        <dt>Owner</dt>           <dd>{row.owner ? (row.owner.name || row.owner.id) : '—'}</dd>
        <dt>Verification</dt>    <dd><VerificationPill status={row.verificationStatus} /></dd>
        <dt>Sync</dt>            <dd><SyncPill status={row.syncStatus} /></dd>
        <dt>Impact</dt>          <dd><ImpactPill impact={row.impact} /></dd>
        {row.group && (<><dt>Package</dt><dd>{row.group}</dd></>)}
      </dl>

      {row.statement && (
        <section className="detail-section">
          <h3>Statement</h3>
          <div className="detail-statement">{row.statement}</div>
        </section>
      )}

      {row.rationale && (
        <section className="detail-section">
          <h3>Rationale</h3>
          <div className="detail-rationale">{row.rationale}</div>
        </section>
      )}

      <section className="detail-section">
        <h3>Goals</h3>
        <ChipList chips={row.goals} onClickChip={onClickChip} empty="No upstream goal — add a satisfies/refines trace." />
      </section>

      <section className="detail-section">
        <h3>Design Artifacts</h3>
        <ChipList chips={row.designArtifacts} onClickChip={onClickChip} empty="No design artifacts linked." />
      </section>

      <section className="detail-section">
        <h3>Implementation</h3>
        <ChipList chips={row.implementations} onClickChip={onClickChip} empty="No implementation linked. Add an implements trace once code exists." />
      </section>

      <section className="detail-section">
        <h3>Test Cases</h3>
        <ChipList chips={row.testCases} onClickChip={onClickChip} empty="No test cases linked. Add a verifiedBy/covers trace." />
      </section>

      {relationshipTypes.length > 0 && (
        <section className="detail-section">
          <h3>Relationships ({row.relationships.length})</h3>
          <div className="relationship-list">
            {relationshipTypes.map(type => (
              <div key={type}>
                <div className="relationship-type">{type}</div>
                {grouped.get(type)!.map(rel => (
                  <div key={rel.edgeId} className="relationship-row" title={rel.notes}>
                    <span className="relationship-arrow">{rel.direction === 'out' ? '→' : '←'}</span>
                    <Chip chip={rel.target} onClick={onClickChip} hoverTitle={rel.notes} />
                    {rel.notes && <span style={{ opacity: 0.6 }}>— {rel.notes}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {row.warnings.length > 0 && (
        <section className="detail-section">
          <h3>Warnings ({row.warnings.length})</h3>
          <div className="warning-list">
            {row.warnings.map((w, i) => (
              <div key={`${w.code}-${i}`} className={`warning-row severity-${w.severity}`}>
                <span className="icon">
                  {w.severity === 'error' ? '⛔' : w.severity === 'warning' ? '⚠' : 'ⓘ'}
                </span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
