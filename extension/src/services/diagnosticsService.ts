// REQ-UI-013: Semantic diagnostics
// REQ-UI-013A: Real-time validation
// REQ-UI-013B: XSD schema validation
// Validates RQML files and reports errors to the Problems panel.
//
// Validation is delegated to @rqml/core: parse() reports XML well-formedness
// and structural problems, validate() runs the canonical XSD (covering
// use="required" and value constraints), and checkIntegrity() covers duplicate
// ids and dangling trace references.
//
// The 2.1.0 schema's xs:unique selectors used unprefixed names against a
// namespaced, qualified schema, so libxml2 matched nothing and the identity
// constraints were inert — checkIntegrity() was the only thing reporting a
// duplicate id. In 2.2.0 those selectors are namespace-qualified and now fire,
// so a duplicate id is reported twice: once by libxml2 in its own phrasing
// ("Duplicate key-sequence ['X'] in unique identity-constraint...") and once by
// checkIntegrity() in a readable one. mergeDiagnostics() drops the former when
// the latter covers the same defect. Dangling trace references and enum
// violations do not overlap — the schema has no keyref for endpoints, and
// checkIntegrity() does not check facets.

import * as vscode from 'vscode';
import { loadCore, loadValidate, type Diagnostic } from './core';
import { mergeDiagnostics } from './diagnosticsMerge';

/**
 * DiagnosticsService - Validates RQML files and reports to Problems panel.
 * REQ-UI-013B: Includes XSD schema validation via rqml-core (bundled schemas).
 */
export class DiagnosticsService {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('rqml');
  }

  /**
   * Kept for API compatibility. rqml-core bundles its schemas, so no schema
   * file needs to be loaded from disk.
   */
  async loadSchema(_extensionPath: string): Promise<void> {
    // no-op: schemas ship inside rqml-core
  }

  /**
   * Start watching for file changes and validate on change.
   */
  startWatching(): void {
    // Validate on document save
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isRqml(doc)) {
          void this.validateDocument(doc);
        }
      })
    );

    // Validate on document open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.isRqml(doc)) {
          void this.validateDocument(doc);
        }
      })
    );

    // Validate on document change (with debounce)
    let changeTimeout: ReturnType<typeof setTimeout> | undefined;
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (this.isRqml(doc)) {
          if (changeTimeout) {
            clearTimeout(changeTimeout);
          }
          changeTimeout = setTimeout(() => {
            void this.validateDocument(doc);
          }, 500); // Debounce 500ms
        }
      })
    );

    // Clear diagnostics when document is closed
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((doc) => {
        this.diagnosticCollection.delete(doc.uri);
      })
    );

    // Validate all currently open RQML documents
    vscode.workspace.textDocuments.forEach((doc) => {
      if (this.isRqml(doc)) {
        void this.validateDocument(doc);
      }
    });
  }

  /**
   * Validate an RQML document and update the Problems panel.
   */
  async validateDocument(document: vscode.TextDocument): Promise<void> {
    const text = document.getText();

    // REQ-UI-013A: well-formedness + structural parse (never throws).
    const core = await loadCore();
    const parseResult = core.parse(text);
    if (!parseResult.ok) {
      this.diagnosticCollection.set(document.uri, [
        this.toVscodeDiagnostic(parseResult.error, document),
      ]);
      return;
    }

    // REQ-UI-013B: canonical XSD validation (required attributes, value
    // constraints, structure) plus code-side referential integrity (duplicate
    // ids, dangling trace references) that the XSD identity constraints do not
    // enforce under libxml2.
    const { validate } = await loadValidate();
    const report = validate(text);
    const integrity = core.checkIntegrity(text);

    this.diagnosticCollection.set(
      document.uri,
      mergeDiagnostics(report.diagnostics, integrity).map((d) =>
        this.toVscodeDiagnostic(d, document)
      )
    );
  }

  /** Map a normalized rqml-core Diagnostic to a vscode.Diagnostic. */
  private toVscodeDiagnostic(d: Diagnostic, document: vscode.TextDocument): vscode.Diagnostic {
    // rqml-core lines/columns are 1-based; vscode is 0-based.
    const line = Math.min(Math.max(0, (d.line ?? 1) - 1), Math.max(0, document.lineCount - 1));
    const range = this.getRangeForLine(document, line);
    const diagnostic = new vscode.Diagnostic(
      range,
      `${this.sourceLabel(d.source)}: ${d.message}`,
      this.toVscodeSeverity(d.severity)
    );
    diagnostic.source = 'rqml';
    if (d.rule) diagnostic.code = d.rule;
    return diagnostic;
  }

  private sourceLabel(source: Diagnostic['source']): string {
    switch (source) {
      case 'parse':
        return 'XML';
      case 'validate':
        return 'Schema';
      case 'lint':
        return 'Lint';
      case 'trace':
        return 'Trace';
      case 'coverage':
        return 'Coverage';
      case 'drift':
        return 'Drift';
    }
  }

  private toVscodeSeverity(severity: Diagnostic['severity']): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
    }
  }

  private getRangeForLine(document: vscode.TextDocument, line: number): vscode.Range {
    const safeLine = Math.min(Math.max(0, line), Math.max(0, document.lineCount - 1));
    const lineText = document.lineCount > 0 ? document.lineAt(safeLine).text : '';
    return new vscode.Range(safeLine, 0, safeLine, lineText.length);
  }

  private isRqml(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'rqml' || doc.fileName.endsWith('.rqml');
  }

  /**
   * Dispose of the service.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.diagnosticCollection.dispose();
  }
}

/** Singleton instance */
let diagnosticsServiceInstance: DiagnosticsService | undefined;

export function getDiagnosticsService(): DiagnosticsService {
  if (!diagnosticsServiceInstance) {
    diagnosticsServiceInstance = new DiagnosticsService();
  }
  return diagnosticsServiceInstance;
}
