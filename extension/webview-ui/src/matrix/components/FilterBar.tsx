// REQ-MAT-004: Search field + filter dropdowns + warnings-only toggle.
import React from 'react';
import type { FilterState, MatrixRow } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  rows: MatrixRow[];
}

const VERIFICATION_OPTIONS = ['Verified', 'Partially verified', 'Unverified', 'Unknown'] as const;
const SYNC_OPTIONS = ['Implemented', 'Partially Implemented', 'Not Started', 'Deprecated', 'Broken Trace'] as const;

function unique<T>(values: (T | undefined)[]): T[] {
  const set = new Set<T>();
  for (const v of values) if (v != null) set.add(v as T);
  return Array.from(set).sort();
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange, rows }) => {
  const types = unique(rows.map(r => r.type));
  const statuses = unique(rows.map(r => r.status));
  const priorities = unique(rows.map(r => r.priority));
  const owners = unique(rows.map(r => r.owner?.id));

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const isFiltering =
    filters.search.length > 0 ||
    filters.type !== null ||
    filters.status !== null ||
    filters.priority !== null ||
    filters.ownerId !== null ||
    filters.verification !== null ||
    filters.sync !== null ||
    filters.warningsOnly ||
    filters.summary !== null;

  return (
    <div className="filter-bar">
      <input
        className="filter-search"
        type="search"
        placeholder="Search ID, title, statement, trace notes, URI…"
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
      />

      <select
        className="filter-select"
        value={filters.type ?? ''}
        onChange={(e) => update({ type: e.target.value || null })}
        title="Filter by requirement type"
      >
        <option value="">Type: any</option>
        {types.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.status ?? ''}
        onChange={(e) => update({ status: e.target.value || null })}
        title="Filter by requirement status"
      >
        <option value="">Status: any</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.priority ?? ''}
        onChange={(e) => update({ priority: e.target.value || null })}
        title="Filter by priority"
      >
        <option value="">Priority: any</option>
        {priorities.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.ownerId ?? ''}
        onChange={(e) => update({ ownerId: e.target.value || null })}
        title="Filter by owner"
      >
        <option value="">Owner: any</option>
        {owners.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.verification ?? ''}
        onChange={(e) => update({ verification: (e.target.value as FilterState['verification']) || null })}
        title="Filter by verification status"
      >
        <option value="">Verification: any</option>
        {VERIFICATION_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>

      <select
        className="filter-select"
        value={filters.sync ?? ''}
        onChange={(e) => update({ sync: (e.target.value as FilterState['sync']) || null })}
        title="Filter by sync status"
      >
        <option value="">Sync: any</option>
        {SYNC_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <button
        className={`filter-toggle${filters.warningsOnly ? ' active' : ''}`}
        onClick={() => update({ warningsOnly: !filters.warningsOnly })}
        title="Show only rows that have warnings"
      >
        ⚠ Warnings only
      </button>

      {isFiltering && (
        <button
          className="filter-clear"
          onClick={() => onChange({
            search: '', type: null, status: null, priority: null, ownerId: null,
            verification: null, sync: null, warningsOnly: false, summary: null,
          })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
};
