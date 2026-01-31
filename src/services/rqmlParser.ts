// REQ-UI-005: Tree view of specification
// REQ-UI-006A: Show all RQML sections
// This service parses RQML documents and provides structured access to the content.

import { XMLParser } from 'fast-xml-parser';
import * as vscode from 'vscode';

/**
 * All possible RQML section names in document order per the schema.
 * Used to show all sections even if not present in the document (REQ-UI-006A).
 */
export const RQML_SECTIONS = [
  'meta',
  'catalogs',
  'domain',
  'goals',
  'scenarios',
  'requirements',
  'behavior',
  'interfaces',
  'verification',
  'trace',
  'governance'
] as const;

export type RqmlSectionName = typeof RQML_SECTIONS[number];

/** Represents a parsed RQML document */
export interface RqmlDocument {
  version: string;
  docId: string;
  status: string;
  sections: Map<RqmlSectionName, RqmlSection>;
  /** REQ-UI-006J: All trace edges in the document */
  traceEdges: TraceEdge[];
  raw: unknown;
  uri: vscode.Uri;
}

/** Represents a section in the RQML document */
export interface RqmlSection {
  name: RqmlSectionName;
  present: boolean;
  items: RqmlItem[];
  raw?: unknown;
}

/** Represents an item within a section (requirement, goal, etc.) */
export interface RqmlItem {
  id: string;
  type: string;
  title?: string;
  name?: string;
  status?: string;
  priority?: string;
  children?: RqmlItem[];
  raw: unknown;
  /** Line number in the source file (1-indexed) */
  line?: number;
  /** Parent section name */
  section: RqmlSectionName;
}

/** REQ-UI-006J: Trace edge linking two items */
export interface TraceEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  notes?: string;
}

/** Type for parsed XML objects */
type XmlObject = Record<string, unknown>;

/**
 * RqmlParser - Parses RQML XML documents into structured data.
 */
export class RqmlParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      preserveOrder: false,
      parseAttributeValue: false,
      trimValues: true
    });
  }

  /**
   * Parse an RQML document from text content.
   */
  async parseText(content: string, uri: vscode.Uri): Promise<RqmlDocument> {
    const parsed = this.parser.parse(content) as XmlObject;
    const rqml = parsed.rqml as XmlObject | undefined;

    if (!rqml) {
      throw new Error('Invalid RQML document: missing root <rqml> element');
    }

    const doc: RqmlDocument = {
      version: this.str(rqml['@_version']) || '2.0.1',
      docId: this.str(rqml['@_docId']) || 'unknown',
      status: this.str(rqml['@_status']) || 'draft',
      sections: new Map(),
      traceEdges: [],
      raw: rqml,
      uri
    };

    // Parse each section, creating empty placeholders for missing ones
    for (const sectionName of RQML_SECTIONS) {
      const sectionData = rqml[sectionName];
      const section: RqmlSection = {
        name: sectionName,
        present: sectionData !== undefined,
        items: [],
        raw: sectionData
      };

      if (sectionData) {
        section.items = this.extractItems(sectionName, sectionData as XmlObject, content);
      }

      doc.sections.set(sectionName, section);
    }

    // REQ-UI-006J: Extract trace edges for quick lookup
    doc.traceEdges = this.extractTraceEdges(rqml);

    return doc;
  }

  /**
   * Parse an RQML document from a file URI.
   */
  async parseFile(uri: vscode.Uri): Promise<RqmlDocument> {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');
    return this.parseText(text, uri);
  }

  /**
   * Safely convert value to string
   */
  private str(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    return String(value);
  }

  /**
   * Extract items from a section based on section type.
   */
  private extractItems(sectionName: RqmlSectionName, data: XmlObject, sourceText: string): RqmlItem[] {
    const items: RqmlItem[] = [];

    switch (sectionName) {
      case 'meta':
        items.push({
          id: 'meta',
          type: 'meta',
          title: this.str(data.title) || 'Document Metadata',
          raw: data,
          section: sectionName
        });
        break;

      case 'catalogs':
        this.extractCatalogItems(data, items, sourceText);
        break;

      case 'domain':
        this.extractDomainItems(data, items, sourceText);
        break;

      case 'goals':
        this.extractGoalItems(data, items, sourceText);
        break;

      case 'scenarios':
        this.extractScenarioItems(data, items, sourceText);
        break;

      case 'requirements':
        this.extractRequirementItems(data, items, sourceText);
        break;

      case 'behavior':
        this.extractBehaviorItems(data, items, sourceText);
        break;

      case 'interfaces':
        this.extractInterfaceItems(data, items, sourceText);
        break;

      case 'verification':
        this.extractVerificationItems(data, items, sourceText);
        break;

      case 'trace':
        this.extractTraceItems(data, items, sourceText);
        break;

      case 'governance':
        this.extractGovernanceItems(data, items, sourceText);
        break;
    }

    return items;
  }

  private extractCatalogItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    const glossary = data.glossary as XmlObject | undefined;
    if (glossary) {
      this.extractArrayItems(glossary, 'term', 'term', items, 'catalogs', sourceText);
    }

    const actors = data.actors as XmlObject | undefined;
    if (actors) {
      this.extractArrayItems(actors, 'actor', 'actor', items, 'catalogs', sourceText);
    }

    const stakeholders = data.stakeholders as XmlObject | undefined;
    if (stakeholders) {
      this.extractArrayItems(stakeholders, 'stakeholder', 'stakeholder', items, 'catalogs', sourceText);
    }

    const constraints = data.constraints as XmlObject | undefined;
    if (constraints) {
      this.extractArrayItems(constraints, 'constraint', 'constraint', items, 'catalogs', sourceText);
    }

    const policies = data.policies as XmlObject | undefined;
    if (policies) {
      this.extractArrayItems(policies, 'policy', 'policy', items, 'catalogs', sourceText);
    }

    const decisions = data.decisions as XmlObject | undefined;
    if (decisions) {
      this.extractArrayItems(decisions, 'decision', 'decision', items, 'catalogs', sourceText);
    }

    const risks = data.risks as XmlObject | undefined;
    if (risks) {
      this.extractArrayItems(risks, 'risk', 'risk', items, 'catalogs', sourceText);
    }
  }

  private extractDomainItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    const entities = data.entities as XmlObject | undefined;
    if (entities) {
      this.extractArrayItems(entities, 'entity', 'entity', items, 'domain', sourceText);
    }

    const businessRules = data.businessRules as XmlObject | undefined;
    if (businessRules) {
      this.extractArrayItems(businessRules, 'rule', 'rule', items, 'domain', sourceText);
    }
  }

  private extractGoalItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    this.extractArrayItems(data, 'goal', 'goal', items, 'goals', sourceText);
    this.extractArrayItems(data, 'qgoal', 'qgoal', items, 'goals', sourceText);
    this.extractArrayItems(data, 'obstacle', 'obstacle', items, 'goals', sourceText);
    this.extractArrayItems(data, 'goalLink', 'goalLink', items, 'goals', sourceText);
  }

  private extractScenarioItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    this.extractArrayItems(data, 'scenario', 'scenario', items, 'scenarios', sourceText);
    this.extractArrayItems(data, 'misuseCase', 'misuseCase', items, 'scenarios', sourceText);
    this.extractArrayItems(data, 'edgeCase', 'edgeCase', items, 'scenarios', sourceText);
  }

  private extractRequirementItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    // Requirement packages
    const packages = this.toArray(data.reqPackage);
    for (const pkg of packages) {
      const pkgItem: RqmlItem = {
        id: this.str(pkg['@_id']) || 'unknown',
        type: 'reqPackage',
        title: this.str(pkg['@_title']),
        raw: pkg,
        section: 'requirements',
        line: this.findLineNumber(sourceText, this.str(pkg['@_id'])),
        children: []
      };

      // Requirements within package
      const reqs = this.toArray(pkg.req);
      for (const req of reqs) {
        pkgItem.children!.push({
          id: this.str(req['@_id']) || 'unknown',
          type: this.str(req['@_type']) || 'FR',
          title: this.str(req['@_title']),
          status: this.str(req['@_status']),
          priority: this.str(req['@_priority']),
          raw: req,
          section: 'requirements',
          line: this.findLineNumber(sourceText, this.str(req['@_id']))
        });
      }

      items.push(pkgItem);
    }

    // Top-level requirements (not in packages)
    const topLevelReqs = this.toArray(data.req);
    for (const req of topLevelReqs) {
      items.push({
        id: this.str(req['@_id']) || 'unknown',
        type: this.str(req['@_type']) || 'FR',
        title: this.str(req['@_title']),
        status: this.str(req['@_status']),
        priority: this.str(req['@_priority']),
        raw: req,
        section: 'requirements',
        line: this.findLineNumber(sourceText, this.str(req['@_id']))
      });
    }
  }

  private extractBehaviorItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    const machines = this.toArray(data.stateMachine);
    for (const sm of machines) {
      const smItem: RqmlItem = {
        id: this.str(sm['@_id']) || 'unknown',
        type: 'stateMachine',
        name: this.str(sm['@_name']),
        raw: sm,
        section: 'behavior',
        line: this.findLineNumber(sourceText, this.str(sm['@_id'])),
        children: []
      };

      const states = this.toArray(sm.state);
      for (const state of states) {
        smItem.children!.push({
          id: this.str(state['@_id']) || 'unknown',
          type: 'state',
          name: this.str(state['@_name']),
          raw: state,
          section: 'behavior',
          line: this.findLineNumber(sourceText, this.str(state['@_id']))
        });
      }

      const transitions = this.toArray(sm.transition);
      for (const trans of transitions) {
        smItem.children!.push({
          id: this.str(trans['@_id']) || 'unknown',
          type: 'transition',
          raw: trans,
          section: 'behavior',
          line: this.findLineNumber(sourceText, this.str(trans['@_id']))
        });
      }

      items.push(smItem);
    }
  }

  private extractInterfaceItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    const apis = this.toArray(data.api);
    for (const api of apis) {
      const apiItem: RqmlItem = {
        id: this.str(api['@_id']) || 'unknown',
        type: 'api',
        name: this.str(api['@_name']),
        raw: api,
        section: 'interfaces',
        line: this.findLineNumber(sourceText, this.str(api['@_id'])),
        children: []
      };

      const endpoints = this.toArray(api.endpoint);
      for (const ep of endpoints) {
        apiItem.children!.push({
          id: this.str(ep['@_id']) || 'unknown',
          type: 'endpoint',
          raw: ep,
          section: 'interfaces',
          line: this.findLineNumber(sourceText, this.str(ep['@_id']))
        });
      }

      items.push(apiItem);
    }

    this.extractArrayItems(data, 'event', 'event', items, 'interfaces', sourceText);
  }

  private extractVerificationItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    const suites = this.toArray(data.testSuite);
    for (const suite of suites) {
      items.push({
        id: this.str(suite['@_id']) || 'unknown',
        type: 'testSuite',
        title: this.str(suite['@_title']),
        raw: suite,
        section: 'verification',
        line: this.findLineNumber(sourceText, this.str(suite['@_id']))
      });
    }

    this.extractArrayItems(data, 'testCase', 'testCase', items, 'verification', sourceText);
  }

  private extractTraceItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    this.extractArrayItems(data, 'traceEdge', 'traceEdge', items, 'trace', sourceText);
  }

  /**
   * REQ-UI-006J: Extract all trace edges as structured objects for quick lookup.
   */
  private extractTraceEdges(rqml: XmlObject): TraceEdge[] {
    const edges: TraceEdge[] = [];
    const traceSection = rqml.trace as XmlObject | undefined;

    if (!traceSection) {
      return edges;
    }

    const traceEdges = this.toArray(traceSection.traceEdge);
    for (const edge of traceEdges) {
      const notes = edge.notes;
      edges.push({
        id: this.str(edge['@_id']) || 'unknown',
        from: this.str(edge['@_from']) || '',
        to: this.str(edge['@_to']) || '',
        type: this.str(edge['@_type']) || 'relatedTo',
        notes: typeof notes === 'string' ? notes : undefined
      });
    }

    return edges;
  }

  private extractGovernanceItems(data: XmlObject, items: RqmlItem[], sourceText: string): void {
    this.extractArrayItems(data, 'issue', 'issue', items, 'governance', sourceText);
    this.extractArrayItems(data, 'approval', 'approval', items, 'governance', sourceText);
  }

  private extractArrayItems(
    container: XmlObject,
    key: string,
    type: string,
    items: RqmlItem[],
    section: RqmlSectionName,
    sourceText: string
  ): void {
    const arr = this.toArray(container[key]);

    for (const item of arr) {
      items.push({
        id: this.str(item['@_id']) || 'unknown',
        type,
        title: this.str(item['@_title']),
        name: this.str(item['@_name']),
        status: this.str(item['@_status']),
        priority: this.str(item['@_priority']),
        raw: item,
        section,
        line: this.findLineNumber(sourceText, this.str(item['@_id']))
      });
    }
  }

  private toArray(value: unknown): XmlObject[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as XmlObject[];
    return [value as XmlObject];
  }

  /**
   * Find the line number where an ID appears in the source text.
   * Used for go-to-definition support (REQ-UI-006F).
   */
  private findLineNumber(sourceText: string, id: string | undefined): number | undefined {
    if (!id) return undefined;

    const pattern = new RegExp(`id=["']${this.escapeRegex(id)}["']`);
    const lines = sourceText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1; // 1-indexed line numbers
      }
    }

    return undefined;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/** Singleton parser instance */
let parserInstance: RqmlParser | undefined;

export function getRqmlParser(): RqmlParser {
  if (!parserInstance) {
    parserInstance = new RqmlParser();
  }
  return parserInstance;
}

/**
 * REQ-UI-006J: Get all trace edges that involve a specific item ID.
 * Returns traces where the item is either the source (from) or target (to).
 */
export function getTracesForItem(doc: RqmlDocument, itemId: string): { edge: TraceEdge; direction: 'outgoing' | 'incoming' }[] {
  const result: { edge: TraceEdge; direction: 'outgoing' | 'incoming' }[] = [];

  for (const edge of doc.traceEdges) {
    if (edge.from === itemId) {
      result.push({ edge, direction: 'outgoing' });
    } else if (edge.to === itemId) {
      result.push({ edge, direction: 'incoming' });
    }
  }

  return result;
}
