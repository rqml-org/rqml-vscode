// REQ-AGT-013, REQ-AGT-014: resolve the project's strictness, once, for
// everything that needs it.
//
// Resolution order: the VS Code setting, then the nearest enclosing AGENTS.md,
// then `standard`. The AGENTS.md search walks parent directories from the
// governing specification's own directory and stops at the workspace folder —
// the same rule discovery uses (ADR-0007), so a monorepo unit with its own
// AGENTS.md gets its own strictness instead of the repository root's.

import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { getSpecService } from './specService';
import {
  DEFAULT_STRICTNESS,
  isStrictnessLevel,
  parseStrictness,
  type StrictnessLevel,
} from './strictness';

/**
 * Find the nearest enclosing AGENTS.md at or above `from`, without leaving the
 * workspace folder that contains it.
 */
async function findAgentsMd(from: vscode.Uri): Promise<string | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(from);
  if (!folder) {return undefined;}

  const boundary = path.resolve(folder.uri.fsPath);
  let dir = path.resolve(from.fsPath);

  // Guard against a symlink loop or an unexpected path shape rather than
  // trusting the walk to terminate on its own.
  for (let i = 0; i < 64; i++) {
    try {
      const candidate = vscode.Uri.file(path.join(dir, 'AGENTS.md'));
      const bytes = await vscode.workspace.fs.readFile(candidate);
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      // Not here; try the parent.
    }
    if (dir === boundary) {return undefined;}
    const parent = path.dirname(dir);
    if (parent === dir) {return undefined;}
    dir = parent;
  }
  return undefined;
}

/**
 * The strictness governing the active specification.
 *
 * Anchored to the governing spec's directory rather than the active editor, so
 * the gate and the agent agree even while the user is looking at a file in
 * another unit.
 */
export async function resolveStrictness(): Promise<StrictnessLevel> {
  const configured = vscode.workspace.getConfiguration('rqml').get<string>('agentStrictness', '');
  if (isStrictnessLevel(configured)) {return configured;}

  const specUri = getSpecService().state.activeSpecUri;
  if (specUri) {
    try {
      const agentsMd = await findAgentsMd(vscode.Uri.file(path.dirname(specUri.fsPath)));
      if (agentsMd) {
        const declared = parseStrictness(agentsMd);
        if (declared) {return declared;}
      }
    } catch (err) {
      log.error('Strictness', 'could not read AGENTS.md; falling back to the default', err);
    }
  }

  return DEFAULT_STRICTNESS;
}

/** The nearest enclosing AGENTS.md for the active specification, for prompts. */
export async function readGoverningAgentsMd(): Promise<string | undefined> {
  const specUri = getSpecService().state.activeSpecUri;
  const folders = vscode.workspace.workspaceFolders;
  const start = specUri
    ? vscode.Uri.file(path.dirname(specUri.fsPath))
    : folders?.[0]?.uri;
  if (!start) {return undefined;}
  return findAgentsMd(start);
}
