// REQ-GATE-001, REQ-GATE-003: compute the deterministic verdict and surface it.
//
// The editor layer only. The verdict itself is composed in gate/verdict.ts,
// which imports no vscode API so it can be tested against the CLI directly.
//
// This owns a DiagnosticCollection separate from the one DiagnosticsService
// uses. They answer different questions: DiagnosticsService gives live feedback
// while you type a document, and runs validation and integrity unconditionally
// so you see everything wrong with the text in front of you. The gate answers
// "would the build pass", and so must compose exactly as `rqml check` does,
// including skipping integrity when validation already failed. Two collections
// means neither has to compromise, and clearing one never clears the other.

import * as vscode from 'vscode';
import * as path from 'path';
import { log } from './logger';
import { getSpecService } from './specService';
import { anchorLine, idsInMessage } from './gate/anchor';
import { evaluate, summarise, type GateStrictness, type GateVerdict } from './gate/verdict';
import { resolveStrictness } from './strictnessService';
import type { Diagnostic } from './core';

export const GATE_DIAGNOSTIC_SOURCE = 'rqml-gate';

const STRICTNESS_VALUES: readonly GateStrictness[] = ['relaxed', 'standard', 'strict', 'certified'];

export class GateService implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly statusBar: vscode.StatusBarItem;
  private readonly onDidChange = new vscode.EventEmitter<GateVerdict | undefined>();
  private disposables: vscode.Disposable[] = [];
  private latest: GateVerdict | undefined;
  private running = false;

  /** Fires whenever the verdict is recomputed, or cleared when no spec is active. */
  readonly onDidChangeVerdict = this.onDidChange.event;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection(GATE_DIAGNOSTIC_SOURCE);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.statusBar.command = 'rqml-vscode.gateCheck';
    this.disposables.push(this.collection, this.statusBar, this.onDidChange);
  }

  get verdict(): GateVerdict | undefined {
    return this.latest;
  }

  /**
   * Recompute on save and whenever the active spec changes.
   *
   * Not on every keystroke: the gate reads the drift baseline and hashes
   * implementation files off disk, which is work that only has a meaningful
   * answer for a document that has been written. DiagnosticsService already
   * covers the typing case.
   */
  start(): void {
    const specService = getSpecService();

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'rqml' || doc.uri.fsPath.endsWith('.rqml')) {
          void this.run();
        }
      })
    );

    this.disposables.push(specService.onDidChangeSpec(() => void this.run()));
    void this.run();
  }

  /**
   * The strictness the gate runs at.
   *
   * Shared with the agent. This previously read only the VS Code setting, so a
   * project declaring `strict` in AGENTS.md with no setting configured got a
   * strict agent and a standard gate — and strictness is what decides whether
   * coverage findings fail the verdict.
   */
  async strictness(): Promise<GateStrictness> {
    return resolveStrictness();
  }

  /** Recompute the verdict for the active specification. */
  async run(): Promise<GateVerdict | undefined> {
    if (this.running) {return this.latest;}
    this.running = true;
    try {
      const state = getSpecService().state;
      const uri = state.activeSpecUri;
      if (!uri || state.status !== 'single') {
        this.clear();
        return undefined;
      }

      const xml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      const strictness = await this.strictness();
      const verdict = await evaluate(xml, { baseDir: path.dirname(uri.fsPath), strictness });

      this.latest = verdict;
      this.collection.set(uri, toVscodeDiagnostics(verdict.diagnostics, xml));
      this.render(verdict);
      this.onDidChange.fire(verdict);
      log.info('Gate', summarise(verdict), {
        exitCode: verdict.exitCode,
        diagnostics: verdict.diagnostics.length,
        drifted: verdict.drifted.length,
      });
      return verdict;
    } catch (err) {
      // A gate that throws must not look like a gate that passed.
      log.error('Gate', 'verdict could not be computed', err);
      this.collection.clear();
      this.latest = undefined;
      this.statusBar.text = '$(shield) RQML: gate error';
      this.statusBar.tooltip = 'The RQML gate could not run. See the RQML output channel.';
      this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBar.show();
      this.onDidChange.fire(undefined);
      return undefined;
    } finally {
      this.running = false;
    }
  }

  private clear(): void {
    this.collection.clear();
    this.latest = undefined;
    this.statusBar.hide();
    this.onDidChange.fire(undefined);
  }

  private render(v: GateVerdict): void {
    const passing = v.verdict === 'pass';
    this.statusBar.text = passing ? '$(shield) RQML' : `$(shield) RQML: ${v.diagnostics.length}`;

    const lines = [
      summarise(v),
      '',
      `Schema ${v.schemaVersion ?? 'unknown'} · strictness ${v.strictness}`,
    ];
    if (v.drifted.length > 0) {
      lines.push(`${v.drifted.length} implementation(s) drifted from their baseline`);
    }
    if (v.coverage && !v.coverageBlocks) {
      // Say why coverage findings exist but are not failing the build, rather
      // than showing a passing gate beside a list of unaddressed findings.
      const count =
        v.coverage.uncoveredGoals.length +
        v.coverage.unverifiedRequirements.length +
        v.coverage.orphanRequirements.length;
      if (count > 0) {
        lines.push(`${count} coverage finding(s) — advisory at ${v.strictness}`);
      }
    }
    lines.push('', 'Click to re-run the gate.');

    this.statusBar.tooltip = lines.join('\n');
    this.statusBar.backgroundColor = passing
      ? undefined
      : new vscode.ThemeColor('statusBarItem.errorBackground');
    this.statusBar.show();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

/**
 * Map engine diagnostics onto editor diagnostics, anchoring each to the most
 * specific line that can be determined for it (REQ-GATE-003 AC-02).
 */
export function toVscodeDiagnostics(
  diagnostics: readonly Diagnostic[],
  xml: string
): vscode.Diagnostic[] {
  const lines = xml.split('\n');
  return diagnostics.map((d) => {
    const line = anchorLine(xml, d.line, idsInMessage(d.message ?? '')) - 1;
    const clamped = Math.min(Math.max(0, line), Math.max(0, lines.length - 1));
    const text = lines[clamped] ?? '';
    const start = text.length - text.trimStart().length;
    const range = new vscode.Range(clamped, start, clamped, Math.max(start, text.length));

    const diagnostic = new vscode.Diagnostic(range, d.message ?? '', toSeverity(d.severity));
    diagnostic.source = GATE_DIAGNOSTIC_SOURCE;
    if (d.rule) {diagnostic.code = d.rule;}
    return diagnostic;
  });
}

function toSeverity(severity: string | undefined): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

let instance: GateService | undefined;

export function getGateService(): GateService {
  return (instance ??= new GateService());
}
