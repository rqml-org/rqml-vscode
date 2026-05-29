// REQ-UI-005: Tree view of specification
// REQ-UI-006A: Show all RQML sections
//
// This service exposes the structured, view-facing shape the tree/details/matrix
// views consume. It no longer parses XML itself: rqml-core is the single parsing
// engine. parseText() delegates to loadCore().parse() and adapts the rich typed
// model into the legacy view shape, putting the typed core element on each
// item.raw (core uses plain property names, so existing raw reads keep working).

import * as vscode from 'vscode';
import { loadCore } from './core';
import type {
  RqmlDocument as CoreDocument,
  Locator as CoreLocator,
} from './core';

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
  /** Resolved local ID of the source (empty string for external/doc refs) */
  from: string;
  /** Resolved local ID of the target (empty string for external/doc refs) */
  to: string;
  type: string;
  notes?: string;
  /** Full from endpoint for display (URI for external/doc refs) */
  fromDisplay?: string;
  /** Full to endpoint for display (URI for external/doc refs) */
  toDisplay?: string;
}

/**
 * RqmlParser - Adapts rqml-core's typed model into the view-facing shape.
 */
export class RqmlParser {
  /**
   * Parse an RQML document from text content.
   */
  async parseText(content: string, uri: vscode.Uri): Promise<RqmlDocument> {
    const core = await loadCore();
    const result = core.parse(content);
    if (!result.ok) {
      throw new Error(`Invalid RQML document: ${result.error.message}`);
    }
    return this.adapt(result.document, content, uri);
  }

  /**
   * Parse an RQML document from a file URI.
   */
  async parseFile(uri: vscode.Uri): Promise<RqmlDocument> {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');
    return this.parseText(text, uri);
  }

  /** Adapt a typed core document into the legacy view shape. */
  private adapt(core: CoreDocument, source: string, uri: vscode.Uri): RqmlDocument {
    const sections = new Map<RqmlSectionName, RqmlSection>();

    const add = (
      name: RqmlSectionName,
      present: boolean,
      items: RqmlItem[],
      raw: unknown,
    ): void => {
      sections.set(name, { name, present, items, raw });
    };

    add('meta', true, this.metaItems(core, source), core.meta);
    add('catalogs', !!core.catalogs, this.catalogItems(core, source), core.catalogs);
    add('domain', !!core.domain, this.domainItems(core, source), core.domain);
    add('goals', !!core.goals, this.goalItems(core, source), core.goals);
    add('scenarios', !!core.scenarios, this.scenarioItems(core, source), core.scenarios);
    add(
      'requirements',
      true,
      this.requirementItems(core, source),
      { packages: core.packages, looseRequirements: core.looseRequirements },
    );
    add('behavior', !!core.behavior, this.behaviorItems(core, source), core.behavior);
    add('interfaces', !!core.interfaces, this.interfaceItems(core, source), core.interfaces);
    add('verification', !!core.verification, this.verificationItems(core, source), core.verification);
    add('trace', core.trace.length > 0, this.traceItems(core, source), core.trace);
    add('governance', !!core.governance, this.governanceItems(core, source), core.governance);

    return {
      version: core.version,
      docId: core.docId,
      status: core.status,
      sections,
      traceEdges: this.traceEdges(core),
      raw: core,
      uri,
    };
  }

  // ── Section item builders ──────────────────────────────────────────────────

  private metaItems(core: CoreDocument, source: string): RqmlItem[] {
    return [
      this.mkItem(core.meta, 'meta', 'meta', source, {
        id: 'meta',
        title: core.meta.title || 'Document Metadata',
      }),
    ];
  }

  private catalogItems(core: CoreDocument, source: string): RqmlItem[] {
    const c = core.catalogs;
    if (!c) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, c.glossary, 'term', 'catalogs', source);
    this.pushAll(items, c.actors, 'actor', 'catalogs', source);
    this.pushAll(items, c.stakeholders, 'stakeholder', 'catalogs', source);
    this.pushAll(items, c.constraints, 'constraint', 'catalogs', source);
    this.pushAll(items, c.policies, 'policy', 'catalogs', source);
    this.pushAll(items, c.decisions, 'decision', 'catalogs', source);
    this.pushAll(items, c.risks, 'risk', 'catalogs', source);
    return items;
  }

  private domainItems(core: CoreDocument, source: string): RqmlItem[] {
    const d = core.domain;
    if (!d) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, d.entities, 'entity', 'domain', source);
    this.pushAll(items, d.businessRules, 'rule', 'domain', source);
    return items;
  }

  private goalItems(core: CoreDocument, source: string): RqmlItem[] {
    const g = core.goals;
    if (!g) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, g.goals, 'goal', 'goals', source);
    this.pushAll(items, g.qualityGoals, 'qgoal', 'goals', source);
    this.pushAll(items, g.obstacles, 'obstacle', 'goals', source);
    this.pushAll(items, g.goalLinks, 'goalLink', 'goals', source);
    return items;
  }

  private scenarioItems(core: CoreDocument, source: string): RqmlItem[] {
    const s = core.scenarios;
    if (!s) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, s.scenarios, 'scenario', 'scenarios', source);
    this.pushAll(items, s.misuseCases, 'misuseCase', 'scenarios', source);
    this.pushAll(items, s.edgeCases, 'edgeCase', 'scenarios', source);
    return items;
  }

  private requirementItems(core: CoreDocument, source: string): RqmlItem[] {
    const items: RqmlItem[] = [];
    for (const pkg of core.packages) {
      const children = pkg.requirements.map((req) =>
        this.mkItem(req, 'req', 'requirements', source, { type: req.type }),
      );
      items.push(
        this.mkItem(pkg, 'reqPackage', 'requirements', source, { children }),
      );
    }
    for (const req of core.looseRequirements) {
      items.push(
        this.mkItem(req, 'req', 'requirements', source, { type: req.type }),
      );
    }
    return items;
  }

  private behaviorItems(core: CoreDocument, source: string): RqmlItem[] {
    const machines = core.behavior?.stateMachines ?? [];
    return machines.map((sm) => {
      const children: RqmlItem[] = [];
      this.pushAll(children, sm.states, 'state', 'behavior', source);
      this.pushAll(children, sm.transitions, 'transition', 'behavior', source);
      return this.mkItem(sm, 'stateMachine', 'behavior', source, { children });
    });
  }

  private interfaceItems(core: CoreDocument, source: string): RqmlItem[] {
    const it = core.interfaces;
    if (!it) return [];
    const items: RqmlItem[] = [];
    for (const api of it.apis ?? []) {
      const children: RqmlItem[] = [];
      this.pushAll(children, api.endpoints, 'endpoint', 'interfaces', source);
      items.push(this.mkItem(api, 'api', 'interfaces', source, { children }));
    }
    this.pushAll(items, it.events, 'event', 'interfaces', source);
    return items;
  }

  private verificationItems(core: CoreDocument, source: string): RqmlItem[] {
    const v = core.verification;
    if (!v) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, v.testSuites, 'testSuite', 'verification', source);
    this.pushAll(items, v.testCases, 'testCase', 'verification', source);
    return items;
  }

  private traceItems(core: CoreDocument, source: string): RqmlItem[] {
    return core.trace.map((edge) =>
      this.mkItem(edge, 'edge', 'trace', source),
    );
  }

  private governanceItems(core: CoreDocument, source: string): RqmlItem[] {
    const g = core.governance;
    if (!g) return [];
    const items: RqmlItem[] = [];
    this.pushAll(items, g.issues, 'issue', 'governance', source);
    this.pushAll(items, g.approvals, 'approval', 'governance', source);
    return items;
  }

  // ── Trace edges (flat, resolved) ───────────────────────────────────────────

  /**
   * REQ-UI-006J: Flatten core's normalized trace into resolved view edges.
   * Local endpoints carry their id; doc/external endpoints carry a display URI.
   */
  private traceEdges(core: CoreDocument): TraceEdge[] {
    return core.trace.map((edge) => {
      const from = this.endpoint(edge.from);
      const to = this.endpoint(edge.to);
      const view: TraceEdge = {
        id: edge.id,
        from: from.id,
        to: to.id,
        type: edge.type,
      };
      if (edge.notes !== undefined) view.notes = edge.notes;
      if (from.display !== from.id) view.fromDisplay = from.display;
      if (to.display !== to.id) view.toDisplay = to.display;
      return view;
    });
  }

  /** Resolve a core locator to a local id and a human display string. */
  private endpoint(loc: CoreLocator): { id: string; display: string } {
    if (loc.kind === 'local') return { id: loc.id, display: loc.id };
    if (loc.kind === 'doc') {
      return { id: '', display: loc.uri ? `${loc.uri}#${loc.id}` : loc.id };
    }
    return { id: '', display: loc.uri };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private pushAll(
    items: RqmlItem[],
    els: unknown[] | undefined,
    kind: string,
    section: RqmlSectionName,
    source: string,
  ): void {
    for (const el of els ?? []) {
      items.push(this.mkItem(el, kind, section, source));
    }
  }

  /** Build a view item from a typed core element (kept on item.raw). */
  private mkItem(
    el: unknown,
    kind: string,
    section: RqmlSectionName,
    source: string,
    opts?: { id?: string; type?: string; title?: string; children?: RqmlItem[] },
  ): RqmlItem {
    const r = (el && typeof el === 'object' ? el : {}) as Rec;
    const id = opts?.id ?? this.str(r.id) ?? 'unknown';
    const item: RqmlItem = {
      id,
      type: opts?.type ?? kind,
      title: opts?.title ?? this.str(r.title),
      name: this.str(r.name),
      status: this.str(r.status),
      priority: this.str(r.priority),
      raw: el,
      section,
      line: this.findLineNumber(source, this.str(r.id)),
    };
    if (opts?.children) item.children = opts.children;
    return item;
  }

  /** Safely convert a value to a trimmed string. */
  private str(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    return String(value);
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

/** Loose record view of a typed core element for field extraction. */
type Rec = Record<string, unknown>;

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
