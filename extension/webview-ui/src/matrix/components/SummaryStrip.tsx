// REQ-MAT-003: Click-to-filter summary strip.
import React from 'react';
import type { MatrixSummary, SummaryFilter } from '../types';

interface SummaryStripProps {
  summary: MatrixSummary;
  active: SummaryFilter;
  onSelect: (filter: SummaryFilter) => void;
}

interface Tile {
  key: SummaryFilter;
  label: string;
  count: number;
  variant?: 'ok' | 'warn' | 'error';
}

export const SummaryStrip: React.FC<SummaryStripProps> = ({ summary, active, onSelect }) => {
  const tiles: Tile[] = [
    { key: null, label: 'Total', count: summary.total },
    { key: 'unverified', label: 'Unverified', count: summary.unverified, variant: 'warn' },
    { key: 'withoutGoal', label: 'Without goal', count: summary.withoutGoal, variant: 'warn' },
    { key: 'withoutImplementation', label: 'Without impl.', count: summary.withoutImplementation, variant: 'warn' },
    { key: 'deprecatedTraces', label: 'Deprecated', count: summary.deprecatedTraces },
    { key: 'brokenReferences', label: 'Broken refs', count: summary.brokenReferences, variant: 'error' },
    { key: 'inSync', label: 'In sync', count: summary.inSync, variant: 'ok' },
  ];

  return (
    <div className="summary-strip">
      {tiles.map((t) => {
        const isActive = active === t.key;
        const cls = ['summary-tile'];
        if (isActive) cls.push('active');
        if (t.variant && t.count > 0) cls.push(t.variant);
        return (
          <button
            key={String(t.key)}
            className={cls.join(' ')}
            onClick={() => onSelect(isActive ? null : t.key)}
            title={isActive ? 'Click to clear filter' : `Filter to ${t.label.toLowerCase()}`}
          >
            <span className="count">{t.count}</span>
            <span className="label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
