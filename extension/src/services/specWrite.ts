// The one guarded path by which the specification file may be written.
//
// Before this existed, `updateSpec` took a language model's string and wrote it
// straight to disk: `content: z.string()` accepts the empty string, prose, or a
// document truncated mid-element, and nothing between the tool call and
// `writeFile` inspected it. The write did not go through a WorkspaceEdit, so it
// never entered VS Code's undo stack, and no backup was taken — the previous
// specification was simply gone. The change-proposal path had the same shape,
// and auto-approve can apply it with no confirmation at all.
//
// The decision itself lives in spec/writeGuard.ts, which imports no vscode API
// so it can be tested against the real engine. This file is only the file I/O.

import * as vscode from 'vscode';
import { log } from './logger';
import { evaluateSpecWrite, refusalMessage } from './spec/writeGuard';
import type { Diagnostic } from './core';

export interface SpecWriteRefusal {
  ok: false;
  /** Shown to the agent in place of performing the write. */
  reason: string;
  introduced: Diagnostic[];
}

export interface SpecWriteSuccess {
  ok: true;
  /** Errors the document still carries, if it was already imperfect. */
  remaining: Diagnostic[];
}

export type SpecWriteResult = SpecWriteRefusal | SpecWriteSuccess;

/**
 * Write `nextXml` to `uri`, refusing anything that would leave the document
 * worse than it is now.
 *
 * The current content is read from disk rather than taken from the caller, so
 * the comparison is against what is actually there and not a stale parse.
 */
export async function writeSpecGuarded(
  uri: vscode.Uri,
  nextXml: string,
  context: string
): Promise<SpecWriteResult> {
  let currentXml: string | undefined;
  try {
    currentXml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  } catch {
    currentXml = undefined;
  }

  const decision = await evaluateSpecWrite(currentXml, nextXml);

  if (!decision.allow) {
    log.info('SpecWrite', `refused (${context}): ${decision.kind}`, {
      introduced: decision.introduced.slice(0, 5).map((d) => d.message),
    });
    return { ok: false, reason: refusalMessage(decision), introduced: decision.introduced };
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(nextXml, 'utf8'));
  log.info('SpecWrite', `wrote the specification (${context})`, {
    remainingErrors: decision.remaining.length,
  });
  return { ok: true, remaining: decision.remaining };
}
