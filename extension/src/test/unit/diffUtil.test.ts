// computeLineDiff backs the agent's change-proposal view — the surface a user
// reads before approving a write to their specification. Line numbering that is
// off by one, or a row that reports the wrong side, misrepresents a change the
// user is about to accept.

import { describe, expect, it } from 'vitest';
import { computeLineDiff } from '../../services/diffUtil';

describe('computeLineDiff', () => {
  it('reports identical text as all equal, with aligned numbering', () => {
    const rows = computeLineDiff('a\nb\nc', 'a\nb\nc');
    expect(rows.every((r) => r.type === 'equal')).toBe(true);
    expect(rows.map((r) => r.leftNum)).toEqual(rows.map((r) => r.rightNum));
  });

  it('numbers lines from one, not zero', () => {
    const [first] = computeLineDiff('a', 'a');
    expect(first.leftNum).toBe(1);
    expect(first.rightNum).toBe(1);
  });

  it('marks an added line as an insert with no left side', () => {
    const rows = computeLineDiff('a\nc', 'a\nb\nc');
    const inserted = rows.filter((r) => r.type === 'insert');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].right).toBe('b');
    expect(inserted[0].left).toBeUndefined();
    expect(inserted[0].leftNum).toBeUndefined();
  });

  it('marks a removed line as a delete with no right side', () => {
    const rows = computeLineDiff('a\nb\nc', 'a\nc');
    const deleted = rows.filter((r) => r.type === 'delete');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].left).toBe('b');
    expect(deleted[0].right).toBeUndefined();
    expect(deleted[0].rightNum).toBeUndefined();
  });

  it('keeps right-side numbering continuous across a deletion', () => {
    // The line after a removed one is still line 2 on the right. Getting this
    // wrong makes every subsequent line in the proposal point at the wrong place.
    const rows = computeLineDiff('a\nb\nc', 'a\nc');
    const rightNums = rows.map((r) => r.rightNum).filter((n): n is number => n !== undefined);
    expect(rightNums).toEqual([1, 2]);
  });

  it('handles an empty original', () => {
    const rows = computeLineDiff('', 'a\nb');
    expect(rows.some((r) => r.type === 'insert')).toBe(true);
  });

  it('handles an emptied file', () => {
    const rows = computeLineDiff('a\nb', '');
    expect(rows.some((r) => r.type === 'delete')).toBe(true);
  });
});
