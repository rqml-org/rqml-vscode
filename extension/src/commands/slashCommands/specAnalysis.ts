// Shared engine access for the slash commands that report on the specification.
//
// Every deterministic command needs the same three things — the parsed
// document, coverage, and drift against the baseline — resolved against the
// specification's own directory so implementation links and the baseline
// resolve per unit, exactly as the gate does.

import * as vscode from 'vscode';
import * as path from 'path';
import { loadCore, type CoverageReport, type DriftReport, type RqmlDocument } from '../../services/core';
import { getSpecService } from '../../services/specService';

export interface SpecAnalysis {
  document: RqmlDocument;
  coverage: CoverageReport;
  drift: DriftReport;
  /** The specification's own directory — the base for links and the baseline. */
  baseDir: string;
  xml: string;
}

/**
 * Analyse the active specification, or explain why it cannot be analysed.
 *
 * Reads from disk rather than using the cached view model: these commands are
 * asked precisely when the user wants to know the current state, and the cached
 * document can be a refresh behind.
 */
export async function analyseActiveSpec(): Promise<SpecAnalysis | string> {
  const uri = getSpecService().state.activeSpecUri;
  if (!uri) {return 'No RQML specification is active.';}

  const core = await loadCore();
  const xml = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  const parsed = core.parse(xml);
  if (!parsed.ok) {
    return `The specification does not parse: ${parsed.error.message}`;
  }

  const baseDir = path.dirname(uri.fsPath);
  const baseline = core.loadBaseline(baseDir);
  const driftOptions = baseline !== undefined ? { baseDir, baseline } : { baseDir };

  return {
    document: parsed.document,
    coverage: core.computeCoverage(parsed.document),
    drift: core.detectDrift(parsed.document, driftOptions),
    baseDir,
    xml,
  };
}
