// Side-by-side line diff utility for rendering change proposals.
// Uses the `diff` (jsdiff) library to compute line-level diffs, then
// pairs removed+added blocks into aligned rows for side-by-side display.

import { diffLines } from 'diff';

export type DiffRowType = 'equal' | 'delete' | 'insert' | 'replace';

export interface DiffRow {
  type: DiffRowType;
  /** Text on the left (old) side, if any */
  left?: string;
  /** Text on the right (new) side, if any */
  right?: string;
  /** 1-indexed line number on the left side, if any */
  leftNum?: number;
  /** 1-indexed line number on the right side, if any */
  rightNum?: number;
}

/**
 * Compute a side-by-side line diff suitable for UI rendering.
 *
 * Consecutive `removed` blocks followed by `added` blocks are paired
 * line-by-line into `replace` rows. Unpaired removals become `delete`
 * rows and unpaired additions become `insert` rows. Identical content
 * is represented by `equal` rows.
 */
export function computeLineDiff(oldText: string, newText: string): DiffRow[] {
  const parts = diffLines(oldText, newText);
  const rows: DiffRow[] = [];

  let leftLine = 1;
  let rightLine = 1;

  // Split each diff part into its constituent lines, preserving the
  // added/removed/unchanged classification.
  type LineEntry = { type: 'add' | 'remove' | 'equal'; text: string };
  const entries: LineEntry[] = [];
  for (const part of parts) {
    const lines = part.value.split('\n');
    // diffLines typically leaves a trailing empty string after the final
    // newline — drop it so we don't emit a phantom blank row at the end.
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    for (const text of lines) {
      if (part.added) {
        entries.push({ type: 'add', text });
      } else if (part.removed) {
        entries.push({ type: 'remove', text });
      } else {
        entries.push({ type: 'equal', text });
      }
    }
  }

  // Walk the entries and pair consecutive remove+add runs into replace rows.
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];

    if (entry.type === 'equal') {
      rows.push({
        type: 'equal',
        left: entry.text,
        right: entry.text,
        leftNum: leftLine++,
        rightNum: rightLine++,
      });
      i++;
      continue;
    }

    if (entry.type === 'remove') {
      // Collect the full remove run
      const removed: string[] = [];
      while (i < entries.length && entries[i].type === 'remove') {
        removed.push(entries[i].text);
        i++;
      }
      // Collect an adjacent add run, if any
      const added: string[] = [];
      while (i < entries.length && entries[i].type === 'add') {
        added.push(entries[i].text);
        i++;
      }
      const pairs = Math.min(removed.length, added.length);
      for (let k = 0; k < pairs; k++) {
        rows.push({
          type: 'replace',
          left: removed[k],
          right: added[k],
          leftNum: leftLine++,
          rightNum: rightLine++,
        });
      }
      for (let k = pairs; k < removed.length; k++) {
        rows.push({
          type: 'delete',
          left: removed[k],
          leftNum: leftLine++,
        });
      }
      for (let k = pairs; k < added.length; k++) {
        rows.push({
          type: 'insert',
          right: added[k],
          rightNum: rightLine++,
        });
      }
      continue;
    }

    // Stand-alone add (no preceding remove)
    if (entry.type === 'add') {
      rows.push({
        type: 'insert',
        right: entry.text,
        rightNum: rightLine++,
      });
      i++;
    }
  }

  return rows;
}
