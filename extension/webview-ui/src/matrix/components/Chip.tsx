// REQ-MAT-002, REQ-MAT-007: Clickable artifact reference chip.
import React from 'react';
import type { ChipRef } from '../types';

interface ChipProps {
  chip: ChipRef;
  onClick: (chip: ChipRef) => void;
  /** Optional title-text shown on hover */
  hoverTitle?: string;
}

export const Chip: React.FC<ChipProps> = ({ chip, onClick, hoverTitle }) => {
  const cls = ['chip'];
  if (chip.broken) cls.push('broken');
  if (chip.external) cls.push('external');

  const titleParts: string[] = [];
  if (hoverTitle) titleParts.push(hoverTitle);
  if (chip.uri) titleParts.push(chip.uri);
  if (chip.broken) titleParts.push('Unresolved reference');

  return (
    <span
      className={cls.join(' ')}
      title={titleParts.join(' · ')}
      onClick={(e) => {
        e.stopPropagation();
        onClick(chip);
      }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(chip);
        }
      }}
    >
      {chip.label}
    </span>
  );
};

interface ChipListProps {
  chips: ChipRef[];
  onClickChip: (chip: ChipRef) => void;
  /** Maximum chips before showing a "+N more" overflow indicator */
  max?: number;
  /** Placeholder shown when the list is empty */
  empty?: string;
}

export const ChipList: React.FC<ChipListProps> = ({ chips, onClickChip, max, empty = '—' }) => {
  if (!chips || chips.length === 0) {
    return <span className="chip-overflow">{empty}</span>;
  }
  const visible = max ? chips.slice(0, max) : chips;
  const overflow = max ? chips.length - max : 0;
  return (
    <span className="chip-list">
      {visible.map((c) => (
        <Chip key={c.id + (c.uri ?? '')} chip={c} onClick={onClickChip} />
      ))}
      {overflow > 0 && (
        <span className="chip-overflow" title={chips.slice(max).map(c => c.label).join(', ')}>
          +{overflow}
        </span>
      )}
    </span>
  );
};
