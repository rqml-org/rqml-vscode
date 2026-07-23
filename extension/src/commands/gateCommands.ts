// REQ-GATE-003, REQ-GATE-004: the commands behind the gate's surface.

import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../services/logger';
import { loadCore } from '../services/core';
import { getSpecService } from '../services/specService';
import { getGateService } from '../services/gateService';
import { summarise } from '../services/gate/verdict';
import {
  GateCodeActionProvider,
  REPIN_COMMAND,
  APPROVE_COMMAND,
} from '../services/gate/codeActions';

export function registerGateCommands(context: vscode.ExtensionContext): void {
  const gate = getGateService();

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'rqml' },
      new GateCodeActionProvider(),
      GateCodeActionProvider.metadata
    )
  );

  // RQML: Check — recompute and report, in the CLI's own phrasing.
  context.subscriptions.push(
    vscode.commands.registerCommand('rqml-vscode.gateCheck', async () => {
      const verdict = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: 'RQML: running gate' },
        () => gate.run()
      );

      if (!verdict) {
        vscode.window.showWarningMessage('RQML: no active specification to check.');
        return;
      }

      if (verdict.verdict === 'pass') {
        vscode.window.showInformationMessage(`RQML ${summarise(verdict)}`);
        return;
      }

      const action = await vscode.window.showErrorMessage(
        `RQML ${summarise(verdict)} — ${verdict.diagnostics.length} finding(s).`,
        'Show Problems'
      );
      if (action === 'Show Problems') {
        await vscode.commands.executeCommand('workbench.actions.view.problems');
      }
    })
  );

  // REQ-GATE-004: re-pin one edge. Never a bulk action — re-recording a
  // baseline asserts the implementation still satisfies the requirement, which
  // is a judgement per edge.
  context.subscriptions.push(
    vscode.commands.registerCommand(REPIN_COMMAND, async (edgeId?: string) => {
      const state = getSpecService().state;
      const uri = state.activeSpecUri;
      if (!uri) {
        vscode.window.showWarningMessage('RQML: no active specification.');
        return;
      }

      const id = edgeId ?? (await pickDriftedEdge());
      if (!id) return;

      const confirmed = await vscode.window.showWarningMessage(
        `Re-pin the baseline for ${id}?`,
        {
          modal: true,
          detail:
            'This records the implementation as it is now, asserting that it still satisfies its requirement. ' +
            'The drift finding will clear. Only do this if you have reviewed the change.',
        },
        'Re-pin'
      );
      if (confirmed !== 'Re-pin') return;

      try {
        const core = await loadCore();
        const baseDir = path.dirname(uri.fsPath);
        const xml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
        const parsed = core.parse(xml);
        if (!parsed.ok) {
          vscode.window.showErrorMessage('RQML: the specification does not parse; fix it first.');
          return;
        }

        // Recompute the whole baseline, then keep only this edge's new value on
        // top of what was already recorded — so re-pinning one edge never
        // silently blesses another.
        const recomputed = core.computeBaseline(parsed.document, { baseDir });
        const existing = core.loadBaseline(baseDir) ?? {};
        if (!(id in recomputed)) {
          vscode.window.showWarningMessage(`RQML: ${id} has no implementation to re-pin.`);
          return;
        }
        core.saveBaseline(baseDir, { ...existing, [id]: recomputed[id] });

        log.info('Gate', `re-pinned baseline for ${id}`);
        vscode.window.showInformationMessage(`RQML: re-pinned ${id}.`);
        await gate.run();
      } catch (err) {
        log.error('Gate', `failed to re-pin ${id}`, err);
        vscode.window.showErrorMessage(`RQML: could not re-pin ${id}. See the RQML output channel.`);
      }
    })
  );

  // Approve a requirement blocking an implementation, behind a confirmation:
  // approval is the gate's whole premise, so it must never be a stray click.
  context.subscriptions.push(
    vscode.commands.registerCommand(APPROVE_COMMAND, async (requirementId?: string) => {
      const state = getSpecService().state;
      const uri = state.activeSpecUri;
      if (!uri || !requirementId) return;

      const confirmed = await vscode.window.showWarningMessage(
        `Approve ${requirementId}?`,
        {
          modal: true,
          detail:
            'Approving states that this requirement is settled and may be implemented. ' +
            'It is the judgement the gate is built to enforce, so make it deliberately.',
        },
        'Approve'
      );
      if (confirmed !== 'Approve') return;

      try {
        const core = await loadCore();
        const xml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
        const result = core.setStatus(xml, { artifactId: requirementId, status: 'approved' });
        if (!result.ok) {
          vscode.window.showErrorMessage(`RQML: ${result.error}`);
          return;
        }
        await vscode.workspace.fs.writeFile(uri, Buffer.from(result.xml, 'utf8'));
        log.info('Gate', `approved ${requirementId}`);
        vscode.window.showInformationMessage(`RQML: approved ${requirementId}.`);
        await gate.run();
      } catch (err) {
        log.error('Gate', `failed to approve ${requirementId}`, err);
        vscode.window.showErrorMessage(`RQML: could not approve ${requirementId}.`);
      }
    })
  );
}

/**
 * Offer the drifted edges as a multi-select QuickPick.
 *
 * Multi-select rather than a "re-pin all" button: the user has to see and
 * choose each edge, so blessing drift stays a decision rather than a default.
 */
async function pickDriftedEdge(): Promise<string | undefined> {
  const verdict = getGateService().verdict;
  const drifted = verdict?.drifted ?? [];
  if (drifted.length === 0) {
    vscode.window.showInformationMessage('RQML: nothing has drifted.');
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    drifted.map((d) => ({
      label: d.edgeId,
      description: d.status,
      detail: d.uri,
    })),
    { title: 'Re-pin which trace edge?', matchOnDescription: true }
  );
  return picked?.label;
}
