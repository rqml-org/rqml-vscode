// REQ-MAT-001..010: Top-level Traceability Matrix application.
import React, { useEffect, useMemo, useState } from 'react';
import './matrix.css';
import type {
  ChipRef, FilterState, MatrixData, MatrixRow, SortKey, SortState,
} from './types';
import { SummaryStrip } from './components/SummaryStrip';
import { FilterBar } from './components/FilterBar';
import { MatrixTable } from './components/MatrixTable';
import { DetailPanel } from './components/DetailPanel';

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };
let vscode: ReturnType<typeof acquireVsCodeApi> | undefined;
try { vscode = acquireVsCodeApi(); } catch { /* not in webview */ }

const EMPTY_FILTERS: FilterState = {
  search: '',
  type: null,
  status: null,
  priority: null,
  ownerId: null,
  verification: null,
  sync: null,
  warningsOnly: false,
  summary: null,
};

export const MatrixApp: React.FC = () => {
  const [data, setData] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'asc' });

  // Listen for postMessage from the extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'setMatrixData') {
        setData(msg.payload as MatrixData);
        setError(null);
      } else if (msg.type === 'error') {
        setError(String(msg.payload));
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ type: 'requestRefresh' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return applyFiltersAndSort(data.rows, filters, sort);
  }, [data, filters, sort]);

  // Esc closes the detail panel.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Keep `selectedId` valid when the data set changes
  useEffect(() => {
    if (!data) return;
    if (selectedId && !data.rows.some(r => r.id === selectedId)) {
      setSelectedId(undefined);
    }
  }, [data, selectedId]);

  const handleClickChip = (chip: ChipRef) => {
    if (chip.broken) return; // nothing to navigate to
    if (chip.external && chip.uri) {
      vscode?.postMessage({ type: 'openExternal', payload: { uri: chip.uri } });
      return;
    }
    if (chip.id) {
      vscode?.postMessage({ type: 'navigateToItem', payload: { itemId: chip.id } });
    }
  };

  const handleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  // ── Render states ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="matrix-app">
        <div className="matrix-error">
          <h2>Cannot load Traceability Matrix</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="matrix-app">
        <div className="matrix-empty"><p>Loading…</p></div>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="matrix-app">
        <Header data={data} />
        {data.parseError && (
          <div className="banner-warning">
            The Traceability Matrix may be incomplete because the RQML file contains validation errors:
            {' '}<em>{data.parseError}</em>
          </div>
        )}
        <div className="matrix-empty">
          <h2>No requirements found</h2>
          <p>{data.fileName ? `${data.fileName} has no requirement entries.` : 'No RQML file is loaded.'}</p>
        </div>
      </div>
    );
  }

  const noTraces = data.rows.every(r => r.relationships.length === 0);
  const selectedRow = selectedId ? data.rows.find(r => r.id === selectedId) : undefined;

  return (
    <div className="matrix-app">
      <Header data={data} />
      {data.parseError && (
        <div className="banner-warning">
          The Traceability Matrix may be incomplete because the RQML file contains validation errors:
          {' '}<em>{data.parseError}</em>
        </div>
      )}
      <div className="matrix-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <SummaryStrip
          summary={data.summary}
          active={filters.summary}
          onSelect={(f) => setFilters(prev => ({ ...prev, summary: f }))}
        />
        <FilterBar filters={filters} onChange={setFilters} rows={data.rows} />
      </div>

      {noTraces && (
        <div className="banner-warning">
          No trace relationships were found. The matrix can still show requirements, but coverage and warnings will be sparse until traces are added.
        </div>
      )}

      <div className="matrix-body">
        <div className="matrix-table-wrap">
          {filteredRows.length === 0 ? (
            <div className="matrix-empty">
              <h2>No matching rows</h2>
              <p>Adjust the filters or search to see requirements.</p>
            </div>
          ) : (
            <MatrixTable
              rows={filteredRows}
              sort={sort}
              selectedId={selectedId}
              onSort={handleSort}
              onSelect={(row) => setSelectedId(row.id === selectedId ? undefined : row.id)}
              onClickChip={handleClickChip}
            />
          )}
        </div>
        {selectedRow && (
          <aside className="matrix-detail">
            <DetailPanel
              row={selectedRow}
              onClickChip={handleClickChip}
              onClose={() => setSelectedId(undefined)}
            />
          </aside>
        )}
      </div>
    </div>
  );
};

const Header: React.FC<{ data: MatrixData }> = ({ data }) => (
  <div className="matrix-header">
    <h1>
      Traceability Matrix
      {data.fileName && <span className="subtle"> — {data.fileName}</span>}
    </h1>
  </div>
);

// ── Filter + sort logic ────────────────────────────────────────────────────

function applyFiltersAndSort(rows: MatrixRow[], filters: FilterState, sort: SortState): MatrixRow[] {
  let out = rows;

  // Summary filter (one-click filters from the strip)
  switch (filters.summary) {
    case 'unverified':
      out = out.filter(r => r.verificationStatus === 'Unverified');
      break;
    case 'withoutGoal':
      out = out.filter(r => r.goals.length === 0);
      break;
    case 'withoutImplementation':
      out = out.filter(r => r.implementations.length === 0);
      break;
    case 'deprecatedTraces':
      out = out.filter(r => r.status === 'deprecated');
      break;
    case 'brokenReferences':
      out = out.filter(r => r.warnings.some(w => w.code === 'broken-reference'));
      break;
    case 'inSync':
      out = out.filter(r => r.syncStatus === 'Implemented' && r.verificationStatus === 'Verified');
      break;
    case null:
      break;
  }

  if (filters.warningsOnly) out = out.filter(r => r.warnings.length > 0);
  if (filters.type) out = out.filter(r => r.type === filters.type);
  if (filters.status) out = out.filter(r => r.status === filters.status);
  if (filters.priority) out = out.filter(r => r.priority === filters.priority);
  if (filters.ownerId) out = out.filter(r => r.owner?.id === filters.ownerId);
  if (filters.verification) out = out.filter(r => r.verificationStatus === filters.verification);
  if (filters.sync) out = out.filter(r => r.syncStatus === filters.sync);

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    out = out.filter(r => rowMatchesSearch(r, q));
  }

  // Sort
  const dir = sort.direction === 'asc' ? 1 : -1;
  out = [...out].sort((a, b) => {
    const av = sortKey(a, sort.key);
    const bv = sortKey(b, sort.key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return out;
}

function rowMatchesSearch(row: MatrixRow, q: string): boolean {
  const fields: (string | undefined)[] = [
    row.id, row.title, row.statement, row.rationale,
    row.owner?.id, row.owner?.name,
    ...row.relationships.map(r => r.notes),
    ...row.relationships.map(r => r.target.label),
    ...row.relationships.map(r => r.target.uri),
  ];
  return fields.some(f => f && f.toLowerCase().includes(q));
}

function sortKey(row: MatrixRow, key: SortKey): string | number {
  switch (key) {
    case 'id': return row.id;
    case 'title': return row.title.toLowerCase();
    case 'type': return row.type;
    case 'status': return row.status;
    case 'priority': {
      // Sort by must > should > may using a numeric weight; unset goes last.
      const w: Record<string, number> = { must: 0, should: 1, may: 2 };
      return row.priority ? (w[row.priority] ?? 99) : 99;
    }
    case 'owner': return row.owner?.name || row.owner?.id || '~';
    case 'verification': {
      const w = { 'Verified': 0, 'Partially verified': 1, 'Unverified': 2, 'Unknown': 3 };
      return w[row.verificationStatus];
    }
    case 'sync': {
      const w = { 'Implemented': 0, 'Partially Implemented': 1, 'Not Started': 2, 'Deprecated': 3, 'Broken Trace': 4 };
      return w[row.syncStatus];
    }
    case 'impact': {
      const w = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return w[row.impact];
    }
    case 'warnings': return -row.warnings.length;
  }
}
