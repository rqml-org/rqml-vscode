// REQ-MAT-002, REQ-MAT-005: Sortable, sticky-header requirements table.
import React, { useLayoutEffect, useRef } from 'react';
import type { ChipRef, MatrixRow, SortKey, SortState } from '../types';
import { ChipList } from './Chip';
import { ImpactPill, StatusPill, SyncPill, VerificationPill } from './StatusPill';

interface MatrixTableProps {
  rows: MatrixRow[];
  sort: SortState;
  selectedId: string | undefined;
  onSort: (key: SortKey) => void;
  onSelect: (row: MatrixRow) => void;
  onClickChip: (chip: ChipRef) => void;
}

interface ColumnSpec {
  key: SortKey | null;
  className: string;
  label: string;
  sortable: boolean;
}

const COLUMNS: ColumnSpec[] = [
  { key: 'warnings', className: 'col-warnings', label: '!', sortable: true },
  { key: 'id', className: 'col-id', label: 'ID', sortable: true },
  { key: 'title', className: 'col-title', label: 'Title', sortable: true },
  { key: 'status', className: 'col-status', label: 'Status', sortable: true },
  { key: 'verification', className: 'col-verification', label: 'Verification', sortable: true },
  { key: 'sync', className: 'col-sync', label: 'Sync', sortable: true },
  { key: 'impact', className: 'col-impact', label: 'Impact', sortable: true },
  { key: 'type', className: 'col-type', label: 'Type', sortable: true },
  { key: 'priority', className: 'col-priority', label: 'Priority', sortable: true },
  { key: 'owner', className: 'col-owner', label: 'Owner', sortable: true },
  { key: null, className: 'col-goals', label: 'Goals', sortable: false },
  { key: null, className: 'col-rationale', label: 'Rationale', sortable: false },
  { key: null, className: 'col-design', label: 'Design Artifact', sortable: false },
  { key: null, className: 'col-impl', label: 'Implementation', sortable: false },
  { key: null, className: 'col-tests', label: 'Test Cases', sortable: false },
  { key: null, className: 'col-relations', label: 'Relationships', sortable: false },
];

/** Sticky-left column class names, in left-to-right order. */
const STICKY_COL_CLASSES = ['col-warnings', 'col-id', 'col-title', 'col-status', 'col-verification'];

export const MatrixTable: React.FC<MatrixTableProps> = ({
  rows, sort, selectedId, onSort, onSelect, onClickChip,
}) => {
  const tableRef = useRef<HTMLTableElement | null>(null);

  // Measure the rendered widths of each sticky-left header cell after layout
  // and publish cumulative `left` offsets as CSS variables. Lets each sticky
  // column adapt to its content width without leaving gaps for scrolled-under
  // cells to bleed through.
  useLayoutEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;
    const measure = () => {
      const headerCells = STICKY_COL_CLASSES.map(cls => tableEl.querySelector<HTMLTableCellElement>(`thead th.${cls}`));
      let cum = 0;
      for (let i = 0; i < headerCells.length; i++) {
        tableEl.style.setProperty(`--sticky-left-${i}`, `${cum}px`);
        cum += headerCells[i]?.offsetWidth ?? 0;
      }
      tableEl.style.setProperty('--sticky-band-width', `${cum}px`);
    };
    measure();
    // Re-measure when the table or panel is resized (font metrics, theme changes, etc.).
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(tableEl);
      return () => ro.disconnect();
    }
  }, [rows]);

  return (
    <table className="matrix-table" ref={tableRef}>
      <thead>
        <tr>
          {COLUMNS.map(col => (
            <th
              key={col.label}
              className={col.className}
              onClick={() => col.sortable && col.key && onSort(col.key)}
              style={{ cursor: col.sortable ? 'pointer' : 'default' }}
            >
              {col.label}
              {col.sortable && col.key && sort.key === col.key && (
                <span className="sort-arrow">{sort.direction === 'asc' ? '▲' : '▼'}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isSelected = row.id === selectedId;
          const worstSeverity = row.warnings.find(w => w.severity === 'error') ? 'error'
            : row.warnings.find(w => w.severity === 'warning') ? 'warning'
            : row.warnings.find(w => w.severity === 'info') ? 'info'
            : null;
          const warningTitle = row.warnings.length
            ? row.warnings.map(w => w.message).join('\n')
            : 'No warnings';
          const warningChar = worstSeverity === 'error' ? '⛔'
            : worstSeverity === 'warning' ? '⚠'
            : worstSeverity === 'info' ? 'ⓘ'
            : '';

          return (
            <tr
              key={row.id}
              className={isSelected ? 'selected' : undefined}
              onClick={() => onSelect(row)}
            >
              <td className="col-warnings" title={warningTitle}>
                <span className={`row-warning-icon${worstSeverity === 'error' ? ' error' : ''}`}>
                  {warningChar}
                </span>
              </td>
              <td className="col-id">
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickChip({ id: row.id, label: row.id, line: row.line });
                  }}
                  title={`Open ${row.id} in source`}
                >{row.id}</a>
              </td>
              <td className="col-title" title={row.title}>{row.title}</td>
              <td className="col-status"><StatusPill status={row.status} /></td>
              <td className="col-verification"><VerificationPill status={row.verificationStatus} /></td>
              <td className="col-sync"><SyncPill status={row.syncStatus} /></td>
              <td className="col-impact"><ImpactPill impact={row.impact} /></td>
              <td className="col-type">{row.type}</td>
              <td className="col-priority">{row.priority ?? '—'}</td>
              <td className="col-owner" title={row.owner?.id}>
                {row.owner ? (row.owner.name || row.owner.id) : '—'}
              </td>
              <td className="col-goals"><ChipList chips={row.goals} onClickChip={onClickChip} max={3} /></td>
              <td className="col-rationale" title={row.rationale}>
                {row.rationale ? truncate(row.rationale, 80) : '—'}
              </td>
              <td className="col-design"><ChipList chips={row.designArtifacts} onClickChip={onClickChip} max={3} /></td>
              <td className="col-impl"><ChipList chips={row.implementations} onClickChip={onClickChip} max={3} /></td>
              <td className="col-tests"><ChipList chips={row.testCases} onClickChip={onClickChip} max={3} /></td>
              <td className="col-relations">
                <span className="chip-overflow">{row.relationships.length}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
