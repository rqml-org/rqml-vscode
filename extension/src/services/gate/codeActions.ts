// REQ-GATE-004: the drift re-pin affordance.
//
// Re-recording a baseline asserts that an implementation still satisfies its
// requirement. That is a judgement only a person can make, so the action is
// offered per edge and never in bulk: a single "re-pin everything" would let a
// user bless drift they never looked at, which is precisely the state the gate
// exists to detect.
//
// The rule identifiers and message extractors live in ./rules, which imports no
// vscode API so they can be asserted against the engine's real output.

import * as vscode from 'vscode';
import { GATE_DIAGNOSTIC_SOURCE } from '../gateService';
import { REPINNABLE_RULES, PREMATURE_RULE, firstQuoted, requirementIn } from './rules';

export const REPIN_COMMAND = 'rqml-vscode.gateRepinEdge';
export const APPROVE_COMMAND = 'rqml-vscode.gateApproveRequirement';

export class GateCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
  };

  provideCodeActions(
    _document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== GATE_DIAGNOSTIC_SOURCE) continue;
      const rule = typeof diagnostic.code === 'string' ? diagnostic.code : undefined;
      if (!rule) continue;

      if (REPINNABLE_RULES.has(rule)) {
        const edgeId = firstQuoted(diagnostic.message);
        if (edgeId) {
          const action = new vscode.CodeAction(
            `Re-pin baseline for ${edgeId}`,
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            command: REPIN_COMMAND,
            title: 'Re-pin baseline',
            arguments: [edgeId],
          };
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }

      if (rule === PREMATURE_RULE) {
        const requirementId = requirementIn(diagnostic.message);
        if (requirementId) {
          const action = new vscode.CodeAction(
            `Approve ${requirementId}`,
            vscode.CodeActionKind.QuickFix
          );
          action.command = {
            command: APPROVE_COMMAND,
            title: 'Approve requirement',
            arguments: [requirementId],
          };
          action.diagnostics = [diagnostic];
          actions.push(action);
        }
      }
    }

    return actions;
  }
}
