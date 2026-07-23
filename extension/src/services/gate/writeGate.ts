// REQ-GATE-005: refuse a write to code linked to a requirement that is not
// approved, and REQ-AGT-030: keep Spec mode out of project source.
//
// This is the one enforcement the extension can perform reliably, because it
// governs a write the extension itself is about to make (ADR-0006). It reaches
// the built-in agent's writeFile tool and nothing else.
//
// Kept free of any `vscode` import so both decisions can be unit-tested without
// an extension host.

import * as path from 'path';
import type { RqmlDocument } from '../core';

export interface BlockedWrite {
  edgeId: string;
  requirementId: string;
  /** The message shown to the agent in place of performing the write. */
  reason: string;
}

/**
 * Resolve a tool-supplied path against the workspace root, refusing anything
 * that leaves it.
 *
 * Returns the workspace-relative POSIX path, or undefined when the path escapes.
 * Comparing resolved absolute paths is the check that matters: inspecting the
 * string for ".." is not enough, because a path can contain no ".." and still
 * be absolute, and one that does contain ".." may still land inside.
 */
export function resolveWorkspacePath(
  workspaceRoot: string,
  candidate: string
): string | undefined {
  if (!candidate) return undefined;
  if (path.isAbsolute(candidate)) {
    const rel = path.relative(workspaceRoot, candidate);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    return rel.split(path.sep).join('/');
  }

  const resolved = path.resolve(workspaceRoot, candidate);
  const root = path.resolve(workspaceRoot);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return undefined;

  return path.relative(root, resolved).split(path.sep).join('/');
}

/**
 * REQ-AGT-030: in Spec mode the agent maintains design and planning artifacts
 * but not project source.
 *
 * Takes an already-resolved workspace-relative path. The previous
 * implementation tested the raw tool input with `startsWith('.rqml/adr/')`,
 * which admitted `.rqml/adr/../../src/extension.ts` — a path that satisfies the
 * prefix, escapes the restriction, and (with one more `..`) escapes the
 * workspace. Normalising first is what closes that.
 */
export function isSpecModeAllowedWritePath(resolvedRelativePath: string): boolean {
  const p = resolvedRelativePath;
  return p.startsWith('.rqml/adr/') || p === '.rqml/plan.md' || p.startsWith('.rqml/plans/');
}

/**
 * Decide whether an approved-requirement gate blocks writing `relativePath`.
 *
 * Delegates the judgement to @rqml/core's approvalGate scoped to this one path,
 * so the editor's answer is the same one `rqml gate` gives.
 */
export function blockedWrite(
  approvalGate: (doc: RqmlDocument, opts?: { changedPaths?: string[] }) => {
    blocked: boolean;
    findings: { edgeId: string; requirementId: string; uri?: string }[];
  },
  doc: RqmlDocument,
  relativePath: string
): BlockedWrite | undefined {
  const verdict = approvalGate(doc, { changedPaths: [relativePath] });
  if (!verdict.blocked || verdict.findings.length === 0) return undefined;

  const finding = verdict.findings[0];
  return {
    edgeId: finding.edgeId,
    requirementId: finding.requirementId,
    reason:
      `Refused to write "${relativePath}": it implements ${finding.requirementId}, ` +
      `which is not approved (trace edge ${finding.edgeId}). ` +
      `Approve the requirement first — "RQML: Approve Requirement", or ` +
      `\`rqml approve ${finding.requirementId}\` — or change the specification ` +
      `before implementing against it. ` +
      `This check governs this agent's writes only; it is disabled by setting ` +
      `rqml.gate.blockAgentEdits to false.`,
  };
}
