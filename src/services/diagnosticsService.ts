// REQ-UI-013: Semantic diagnostics
// REQ-UI-013A: Real-time validation
// REQ-UI-013B: XSD schema validation
// Validates RQML files and reports errors to the Problems panel.

import * as vscode from 'vscode';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { DOMParser } from '@xmldom/xmldom';
import { validateXML } from 'xmllint-wasm';
import { getXsdPath, isXsdAvailable } from './xsdVersions';

/** Type for parsed XML objects */
type XmlObject = Record<string, unknown>;

/** XML error captured during parsing */
interface XmlError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * DiagnosticsService - Validates RQML files and reports to Problems panel.
 * REQ-UI-013B: Includes XSD schema validation using xmllint-wasm.
 */
export class DiagnosticsService {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private parser: XMLParser;
  private disposables: vscode.Disposable[] = [];

  /** Cached XSD schema content */
  private schemaContent: string | undefined;
  private schemaLoadError: string | undefined;
  private schemaVersion: string | undefined;
  private extensionPath: string = '';

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('rqml');
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      preserveOrder: false,
      parseAttributeValue: false,
      trimValues: true
    });
  }

  /**
   * Store the extension path for version-aware schema loading.
   */
  async loadSchema(extensionPath: string): Promise<void> {
    this.extensionPath = extensionPath;
  }

  /**
   * REQ-UI-011A: Load the XSD schema for a specific version.
   * Skips reload if the same version is already cached.
   */
  private loadSchemaForVersion(version: string): void {
    if (this.schemaVersion === version && this.schemaContent) return;

    if (!isXsdAvailable(this.extensionPath, version)) {
      this.schemaContent = undefined;
      this.schemaLoadError = `XSD schema for version ${version} not found`;
      this.schemaVersion = undefined;
      return;
    }

    try {
      const schemaPath = getXsdPath(this.extensionPath, version);
      this.schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      this.schemaVersion = version;
      this.schemaLoadError = undefined;
    } catch (error) {
      this.schemaLoadError = error instanceof Error ? error.message : 'Failed to load schema';
      this.schemaContent = undefined;
      this.schemaVersion = undefined;
    }
  }

  /**
   * Start watching for file changes and validate on change.
   */
  startWatching(): void {
    // Validate on document save
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'rqml' || doc.fileName.endsWith('.rqml')) {
          void this.validateDocument(doc);
        }
      })
    );

    // Validate on document open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.languageId === 'rqml' || doc.fileName.endsWith('.rqml')) {
          void this.validateDocument(doc);
        }
      })
    );

    // Validate on document change (with debounce)
    let changeTimeout: ReturnType<typeof setTimeout> | undefined;
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (doc.languageId === 'rqml' || doc.fileName.endsWith('.rqml')) {
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
      if (doc.languageId === 'rqml' || doc.fileName.endsWith('.rqml')) {
        void this.validateDocument(doc);
      }
    });
  }

  /**
   * Validate an RQML document and update diagnostics.
   */
  async validateDocument(document: vscode.TextDocument): Promise<void> {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // REQ-UI-011A: Extract version from document and load matching schema
    if (this.extensionPath) {
      const docVersion = this.extractRqmlVersion(text) || '2.1.0';
      this.loadSchemaForVersion(docVersion);
    }

    // REQ-UI-013A: XML well-formedness validation
    const xmlDiagnostics = this.validateXml(text, document);
    diagnostics.push(...xmlDiagnostics);

    // Only perform schema and semantic validation if XML is well-formed
    if (xmlDiagnostics.length === 0) {
      // REQ-UI-013B: XSD schema validation
      const schemaDiagnostics = await this.validateSchema(text, document);
      diagnostics.push(...schemaDiagnostics);

      try {
        const parsed = this.parser.parse(text) as XmlObject;
        const rqml = parsed.rqml as XmlObject | undefined;

        if (rqml) {
          // REQ-UI-013: Semantic diagnostics (beyond what XSD catches)
          const semanticDiagnostics = this.validateSemantics(rqml, text, document);
          diagnostics.push(...semanticDiagnostics);
        } else {
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'Missing root <rqml> element',
            vscode.DiagnosticSeverity.Error
          ));
        }
      } catch {
        // XML parse errors already captured
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * REQ-UI-013B: Validate XML against the RQML XSD schema.
   */
  private async validateSchema(text: string, document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];

    // Skip if schema not loaded
    if (!this.schemaContent) {
      if (this.schemaLoadError) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Schema validation unavailable: ${this.schemaLoadError}`,
          vscode.DiagnosticSeverity.Warning
        ));
      }
      return diagnostics;
    }

    try {
      const result = await validateXML({
        xml: { fileName: 'document.rqml', contents: text },
        schema: { fileName: `rqml-${this.schemaVersion || '2.1.0'}.xsd`, contents: this.schemaContent }
      });

      if (!result.valid && result.errors) {
        for (const error of result.errors) {
          // Get line number from structured error
          const line = error.loc?.lineNumber ? error.loc.lineNumber - 1 : 0;
          const safeLine = Math.min(Math.max(0, line), document.lineCount - 1);

          // Use the cleaned message from xmllint-wasm
          const message = error.message;

          diagnostics.push(new vscode.Diagnostic(
            this.getRangeForLine(document, safeLine),
            `Schema: ${message}`,
            vscode.DiagnosticSeverity.Error
          ));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema validation failed';
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Schema validation error: ${message}`,
        vscode.DiagnosticSeverity.Warning
      ));
    }

    return diagnostics;
  }

  /**
   * Validate XML structure using @xmldom/xmldom for strict validation.
   */
  private validateXml(text: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const errors: XmlError[] = [];

    // Use @xmldom/xmldom for stricter XML validation
    const domParser = new DOMParser({
      locator: {},
      errorHandler: {
        warning: (msg: string) => {
          // Warnings are less severe, include them
          const lineMatch = msg.match(/line[:\s]+(\d+)/i) || msg.match(/@(\d+):/);
          const colMatch = msg.match(/col[:\s]+(\d+)/i) || msg.match(/:(\d+)$/);
          errors.push({
            message: msg,
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            column: colMatch ? parseInt(colMatch[1], 10) : undefined
          });
        },
        error: (msg: string) => {
          const lineMatch = msg.match(/line[:\s]+(\d+)/i) || msg.match(/@(\d+):/);
          const colMatch = msg.match(/col[:\s]+(\d+)/i) || msg.match(/:(\d+)$/);
          errors.push({
            message: msg,
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            column: colMatch ? parseInt(colMatch[1], 10) : undefined
          });
        },
        fatalError: (msg: string) => {
          const lineMatch = msg.match(/line[:\s]+(\d+)/i) || msg.match(/@(\d+):/);
          const colMatch = msg.match(/col[:\s]+(\d+)/i) || msg.match(/:(\d+)$/);
          errors.push({
            message: msg,
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            column: colMatch ? parseInt(colMatch[1], 10) : undefined
          });
        }
      }
    });

    // Parse with DOM parser to trigger error handlers
    domParser.parseFromString(text, 'application/xml');

    // Convert collected errors to diagnostics
    for (const error of errors) {
      const line = error.line ? error.line - 1 : 0;
      const safeLine = Math.min(Math.max(0, line), document.lineCount - 1);
      const lineText = document.lineAt(safeLine).text;

      const range = new vscode.Range(
        safeLine,
        0,
        safeLine,
        lineText.length
      );

      // Clean up error message
      let message = error.message;
      // Remove location info from message since we show it via the range
      message = message.replace(/@\d+:\d+\s*/, '').replace(/\[.*?\]\s*/, '').trim();

      diagnostics.push(new vscode.Diagnostic(
        range,
        `XML Error: ${message}`,
        vscode.DiagnosticSeverity.Error
      ));
    }

    // Also try fast-xml-parser for any additional errors
    try {
      this.parser.parse(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'XML parse error';
      // Only add if we don't already have errors (avoid duplicates)
      if (diagnostics.length === 0) {
        const lineMatch = message.match(/line[:\s]+(\d+)/i);
        const line = lineMatch ? parseInt(lineMatch[1], 10) - 1 : 0;
        const safeLine = Math.min(Math.max(0, line), document.lineCount - 1);

        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(safeLine, 0, safeLine, document.lineAt(safeLine).text.length),
          `XML Error: ${message}`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    return diagnostics;
  }

  /**
   * Validate RQML semantics.
   */
  private validateSemantics(rqml: XmlObject, text: string, document: vscode.TextDocument): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const allIds = new Map<string, number>(); // ID -> line number

    // Collect all IDs from all sections
    this.collectIds(rqml, text, allIds);

    // Check for duplicate IDs
    const idCounts = new Map<string, number[]>();
    allIds.forEach((line, id) => {
      if (!idCounts.has(id)) {
        idCounts.set(id, []);
      }
      idCounts.get(id)!.push(line);
    });

    idCounts.forEach((lines, id) => {
      if (lines.length > 1) {
        lines.forEach((line) => {
          const range = this.getRangeForLine(document, line);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Duplicate ID: "${id}" appears ${lines.length} times`,
            vscode.DiagnosticSeverity.Error
          ));
        });
      }
    });

    // Validate trace edges - check for broken local references
    const traceSection = rqml.trace as XmlObject | undefined;
    if (traceSection) {
      const traceEdges = this.toArray(traceSection.edge);
      for (const edge of traceEdges) {
        const edgeId = this.str(edge['@_id']);
        const edgeLine = this.findLineNumber(text, edgeId);

        // Extract local IDs from structured endpoints
        const fromId = this.resolveLocalId(edge.from as XmlObject | undefined);
        const toId = this.resolveLocalId(edge.to as XmlObject | undefined);

        if (fromId && !allIds.has(fromId)) {
          const range = this.getRangeForLine(document, edgeLine || 0);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Broken trace reference: "${fromId}" not found in specification`,
            vscode.DiagnosticSeverity.Warning
          ));
        }

        if (toId && !allIds.has(toId)) {
          const range = this.getRangeForLine(document, edgeLine || 0);
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Broken trace reference: "${toId}" not found in specification`,
            vscode.DiagnosticSeverity.Warning
          ));
        }
      }
    }

    // Check for requirements without IDs
    const reqSection = rqml.requirements as XmlObject | undefined;
    if (reqSection) {
      this.checkRequirementsForMissingIds(reqSection, text, document, diagnostics);
    }

    // Check for items missing required attributes
    this.checkMissingAttributes(rqml, text, document, diagnostics);

    return diagnostics;
  }

  /**
   * Collect all IDs from the RQML document.
   */
  private collectIds(obj: XmlObject, text: string, ids: Map<string, number>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === '@_id' && typeof value === 'string') {
        const line = this.findLineNumber(text, value);
        ids.set(value, line || 0);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              this.collectIds(item as XmlObject, text, ids);
            }
          }
        } else {
          this.collectIds(value as XmlObject, text, ids);
        }
      }
    }
  }

  /**
   * Check requirements section for items without IDs.
   */
  private checkRequirementsForMissingIds(
    reqSection: XmlObject,
    text: string,
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ): void {
    const packages = this.toArray(reqSection.reqPackage);
    for (const pkg of packages) {
      if (!pkg['@_id']) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          'Requirement package missing required "id" attribute',
          vscode.DiagnosticSeverity.Error
        ));
      }

      const reqs = this.toArray(pkg.req);
      for (const req of reqs) {
        if (!req['@_id']) {
          const title = this.str(req['@_title']) || 'Untitled';
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            `Requirement "${title}" missing required "id" attribute`,
            vscode.DiagnosticSeverity.Error
          ));
        }
      }
    }

    const topLevelReqs = this.toArray(reqSection.req);
    for (const req of topLevelReqs) {
      if (!req['@_id']) {
        const title = this.str(req['@_title']) || 'Untitled';
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Requirement "${title}" missing required "id" attribute`,
          vscode.DiagnosticSeverity.Error
        ));
      }
    }
  }

  /**
   * Check for missing required attributes on common elements.
   */
  private checkMissingAttributes(
    rqml: XmlObject,
    text: string,
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ): void {
    // Check trace edges have from and to endpoints
    const traceSection = rqml.trace as XmlObject | undefined;
    if (traceSection) {
      const traceEdges = this.toArray(traceSection.edge);
      for (const edge of traceEdges) {
        const edgeId = this.str(edge['@_id']) || 'unknown';
        const line = this.findLineNumber(text, edgeId);
        const range = this.getRangeForLine(document, line || 0);

        if (!edge.from) {
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Trace edge "${edgeId}" missing required "from" endpoint`,
            vscode.DiagnosticSeverity.Error
          ));
        }
        if (!edge.to) {
          diagnostics.push(new vscode.Diagnostic(
            range,
            `Trace edge "${edgeId}" missing required "to" endpoint`,
            vscode.DiagnosticSeverity.Error
          ));
        }
      }
    }

    // Check goals have id
    const goalsSection = rqml.goals as XmlObject | undefined;
    if (goalsSection) {
      const goals = this.toArray(goalsSection.goal);
      for (const goal of goals) {
        if (!goal['@_id']) {
          const title = this.str(goal['@_title']) || 'Untitled';
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            `Goal "${title}" missing required "id" attribute`,
            vscode.DiagnosticSeverity.Error
          ));
        }
      }
    }
  }

  /**
   * Get a range for a specific line.
   */
  private getRangeForLine(document: vscode.TextDocument, line: number): vscode.Range {
    const safeLine = Math.min(Math.max(0, line), document.lineCount - 1);
    const lineText = document.lineAt(safeLine).text;
    return new vscode.Range(safeLine, 0, safeLine, lineText.length);
  }

  /**
   * Find the line number where an ID appears.
   */
  private findLineNumber(text: string, id: string | undefined): number | undefined {
    if (!id) {
      return undefined;
    }

    const pattern = new RegExp(`id=["']${this.escapeRegex(id)}["']`);
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i;
      }
    }

    return undefined;
  }

  /**
   * Resolve a local ID from a structured trace endpoint (from/to → locator → local).
   * Returns undefined for doc/external refs (not validatable locally).
   */
  private resolveLocalId(endpoint: XmlObject | undefined): string | undefined {
    if (!endpoint) return undefined;
    const locator = endpoint.locator as XmlObject | undefined;
    if (!locator) return undefined;
    const local = locator.local as XmlObject | undefined;
    if (!local) return undefined;
    return this.str(local['@_id']);
  }

  /**
   * Extract the version attribute from the root <rqml> element using an XML parser.
   * More robust than regex — handles multiline attributes, comments, and CDATA.
   */
  private extractRqmlVersion(text: string): string | undefined {
    try {
      const parsed = this.parser.parse(text) as XmlObject;
      const rqml = parsed.rqml as XmlObject | undefined;
      return rqml ? this.str(rqml['@_version']) : undefined;
    } catch {
      return undefined;
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private str(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value);
  }

  private toArray(value: unknown): XmlObject[] {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value as XmlObject[];
    }
    return [value as XmlObject];
  }

  /**
   * Dispose of the service.
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
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
