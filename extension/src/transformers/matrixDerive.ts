// REQ-MAT-002, REQ-MAT-006, REQ-MAT-008
//
// Pure derivation helpers for the redesigned Traceability Matrix.
// No vscode imports — these run server-side and could be unit-tested.

import type { RqmlDocument, RqmlItem, TraceEdge } from '../services/rqmlParser';
import type {
  ChipRef,
  Impact,
  RelationshipRef,
  SyncStatus,
  VerificationStatus,
  Warning,
} from '../schemas/matrixSchema';

// ── Item lookup helpers ─────────────────────────────────────────────────────

/** Build a flat id-to-item index across all sections. */
export function buildItemIndex(doc: RqmlDocument): Map<string, RqmlItem> {
  const index = new Map<string, RqmlItem>();
  for (const section of doc.sections.values()) {
    walkItems(section.items, item => {
      if (item.id) index.set(item.id, item);
    });
  }
  return index;
}

/** Walk every item recursively (depth-first), invoking the visitor. */
export function walkItems(items: RqmlItem[], visit: (item: RqmlItem) => void): void {
  for (const item of items) {
    visit(item);
    if (item.children?.length) walkItems(item.children, visit);
  }
}

// ── Trace-edge classification ───────────────────────────────────────────────

/**
 * Trace edge types that point to verification artifacts (test cases / suites).
 */
const VERIFICATION_TYPES = new Set(['verifiedBy', 'covers']);

/**
 * Trace edge types that indicate implementation linkage.
 */
const IMPLEMENTATION_TYPES = new Set(['implements', 'providesInterface']);

/**
 * Trace edge types that indicate upstream goal/rationale linkage.
 */
const UPSTREAM_TYPES = new Set(['satisfies', 'refines']);

// ── Edge filtering ──────────────────────────────────────────────────────────

/** All edges where this requirement is the source ("from"). */
export function outgoingEdges(reqId: string, edges: TraceEdge[]): TraceEdge[] {
  return edges.filter(e => e.from === reqId);
}

/** All edges where this requirement is the target ("to"). */
export function incomingEdges(reqId: string, edges: TraceEdge[]): TraceEdge[] {
  return edges.filter(e => e.to === reqId);
}

// ── Owner resolution ────────────────────────────────────────────────────────

/**
 * Resolve an ownerRef ID to a {id, name?} via the catalogs section
 * (`<actor>` or `<stakeholder>` entries).
 */
export function resolveOwner(
  ownerRef: string | undefined,
  catalogsIndex: Map<string, RqmlItem>,
): { id: string; name?: string } | undefined {
  if (!ownerRef) return undefined;
  const item = catalogsIndex.get(ownerRef);
  return { id: ownerRef, name: item?.title || item?.name };
}

/** Build an index of catalogs items (actors, stakeholders) for owner resolution. */
export function buildCatalogsIndex(doc: RqmlDocument): Map<string, RqmlItem> {
  const index = new Map<string, RqmlItem>();
  const catalogs = doc.sections.get('catalogs');
  if (!catalogs?.present) return index;
  walkItems(catalogs.items, item => {
    if (item.id) index.set(item.id, item);
  });
  return index;
}

// ── Chip building ───────────────────────────────────────────────────────────

/** Build a ChipRef from a target id, resolving against the item index. */
export function chipFromId(
  id: string,
  itemIndex: Map<string, RqmlItem>,
  externalUri?: string,
): ChipRef {
  if (id) {
    const item = itemIndex.get(id);
    if (item) {
      return {
        id,
        label: item.title || item.name || id,
        line: item.line,
      };
    }
    // Local id reference that doesn't resolve = broken
    return { id, label: id, broken: true };
  }
  // No local id — purely external
  if (externalUri) {
    return { id: externalUri, label: shortenUri(externalUri), external: true, uri: externalUri };
  }
  return { id: '(unknown)', label: '(unknown)', broken: true };
}

/** Trim long URIs for display. */
function shortenUri(uri: string): string {
  if (uri.length <= 40) return uri;
  // Show last segment, prefixed with an ellipsis
  const lastSlash = uri.lastIndexOf('/');
  if (lastSlash > 0 && lastSlash < uri.length - 1) {
    return '…/' + uri.slice(lastSlash + 1);
  }
  return uri.slice(0, 37) + '…';
}

// ── Per-requirement column derivation ───────────────────────────────────────

export function findGoalsForReq(
  reqId: string,
  edges: TraceEdge[],
  itemIndex: Map<string, RqmlItem>,
  goalsIndex: Map<string, RqmlItem>,
): ChipRef[] {
  const seen = new Set<string>();
  const out: ChipRef[] = [];
  // Outgoing satisfies/refines from req → goal
  for (const e of outgoingEdges(reqId, edges)) {
    if (!UPSTREAM_TYPES.has(e.type)) continue;
    if (e.to && goalsIndex.has(e.to) && !seen.has(e.to)) {
      seen.add(e.to);
      out.push(chipFromId(e.to, itemIndex));
    }
  }
  return out;
}

export function findTestCasesForReq(
  reqId: string,
  edges: TraceEdge[],
  itemIndex: Map<string, RqmlItem>,
  verificationIndex: Map<string, RqmlItem>,
): ChipRef[] {
  const seen = new Set<string>();
  const out: ChipRef[] = [];
  // Outgoing verifiedBy/covers
  for (const e of outgoingEdges(reqId, edges)) {
    if (!VERIFICATION_TYPES.has(e.type)) continue;
    if (e.to && !seen.has(e.to)) {
      seen.add(e.to);
      out.push(chipFromId(e.to, itemIndex, e.toDisplay));
    }
  }
  // Incoming verifiedBy/covers from test cases that target the req
  for (const e of incomingEdges(reqId, edges)) {
    if (!VERIFICATION_TYPES.has(e.type)) continue;
    if (e.from && verificationIndex.has(e.from) && !seen.has(e.from)) {
      seen.add(e.from);
      out.push(chipFromId(e.from, itemIndex));
    }
  }
  return out;
}

export function findImplementationsForReq(
  reqId: string,
  edges: TraceEdge[],
  itemIndex: Map<string, RqmlItem>,
): ChipRef[] {
  const seen = new Set<string>();
  const out: ChipRef[] = [];
  for (const e of outgoingEdges(reqId, edges)) {
    if (!IMPLEMENTATION_TYPES.has(e.type)) continue;
    const key = e.to || e.toDisplay || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(chipFromId(e.to, itemIndex, e.toDisplay));
  }
  return out;
}

export function findDesignArtifactsForReq(
  reqId: string,
  edges: TraceEdge[],
  itemIndex: Map<string, RqmlItem>,
  goalsIndex: Map<string, RqmlItem>,
  verificationIndex: Map<string, RqmlItem>,
): ChipRef[] {
  const seen = new Set<string>();
  const out: ChipRef[] = [];
  for (const e of outgoingEdges(reqId, edges)) {
    // Skip categories already handled by other columns
    if (UPSTREAM_TYPES.has(e.type)) continue;
    if (VERIFICATION_TYPES.has(e.type)) continue;
    if (IMPLEMENTATION_TYPES.has(e.type)) continue;
    if (!e.to) continue;
    if (goalsIndex.has(e.to)) continue;
    if (verificationIndex.has(e.to)) continue;
    if (seen.has(e.to)) continue;
    seen.add(e.to);
    out.push(chipFromId(e.to, itemIndex));
  }
  return out;
}

export function buildRelationships(
  reqId: string,
  edges: TraceEdge[],
  itemIndex: Map<string, RqmlItem>,
): RelationshipRef[] {
  const out: RelationshipRef[] = [];
  for (const e of edges) {
    if (e.from === reqId) {
      out.push({
        edgeId: e.id,
        type: e.type,
        target: chipFromId(e.to, itemIndex, e.toDisplay),
        direction: 'out',
        notes: e.notes,
      });
    } else if (e.to === reqId) {
      out.push({
        edgeId: e.id,
        type: e.type,
        target: chipFromId(e.from, itemIndex, e.fromDisplay),
        direction: 'in',
        notes: e.notes,
      });
    }
  }
  return out;
}

// ── Status derivation ───────────────────────────────────────────────────────

export function deriveVerificationStatus(
  testCases: ChipRef[],
  reqStatus: string | undefined,
): VerificationStatus {
  if (reqStatus === 'deprecated') return 'Unknown';
  if (testCases.length === 0) return 'Unverified';
  const broken = testCases.filter(t => t.broken).length;
  if (broken === testCases.length) return 'Unverified';
  if (broken > 0) return 'Partially verified';
  return 'Verified';
}

export function deriveSyncStatus(
  reqStatus: string | undefined,
  implementations: ChipRef[],
  testCases: ChipRef[],
): SyncStatus {
  if (reqStatus === 'deprecated') return 'Deprecated';
  if (implementations.length === 0) return 'Not Started';
  const allBroken =
    implementations.every(i => i.broken) ||
    (testCases.length > 0 && testCases.every(t => t.broken));
  if (allBroken) return 'Broken Trace';
  if (testCases.length === 0) return 'Partially Implemented';
  return 'Implemented';
}

/**
 * Impact: classify by transitive downstream fan-out.
 * Counts the number of distinct items reachable via outgoing edges from this req
 * and from the items it points to (1 hop further).
 */
export function deriveImpact(reqId: string, edges: TraceEdge[]): Impact {
  const direct = new Set(edges.filter(e => e.from === reqId && e.to).map(e => e.to));
  const indirect = new Set<string>();
  for (const id of direct) {
    for (const e of edges) {
      if (e.from === id && e.to) indirect.add(e.to);
    }
  }
  const fanOut = direct.size + indirect.size;
  if (fanOut >= 12) return 'Critical';
  if (fanOut >= 6) return 'High';
  if (fanOut >= 2) return 'Medium';
  return 'Low';
}

// ── Warnings ────────────────────────────────────────────────────────────────

export function detectWarnings(
  reqId: string,
  reqStatus: string | undefined,
  goals: ChipRef[],
  testCases: ChipRef[],
  implementations: ChipRef[],
  relationships: RelationshipRef[],
): Warning[] {
  const out: Warning[] = [];
  const isDeprecated = reqStatus === 'deprecated';

  if (!isDeprecated && goals.length === 0) {
    out.push({
      code: 'missing-goal',
      severity: 'info',
      message: `${reqId} has no upstream goal. Add a satisfies or refines trace to a goal or qgoal.`,
    });
  }
  if (!isDeprecated && testCases.length === 0) {
    out.push({
      code: 'missing-verification',
      severity: 'warning',
      message: `${reqId} has no linked verification. Add a verifiedBy or covers trace to a test case.`,
    });
  }
  if (!isDeprecated && implementations.length === 0) {
    out.push({
      code: 'missing-implementation',
      severity: 'info',
      message: `${reqId} has no linked implementation. Add an implements trace once code exists.`,
    });
  }

  // Broken references (target id does not resolve)
  for (const rel of relationships) {
    if (rel.target.broken) {
      out.push({
        code: 'broken-reference',
        severity: 'error',
        message: `Trace edge ${rel.edgeId} (${rel.type}) points to "${rel.target.id}", which does not resolve to any element in the document.`,
      });
    }
  }

  // Conflict / break / deprecates relationships
  for (const rel of relationships) {
    if (rel.type === 'conflictsWith') {
      out.push({
        code: 'conflicts',
        severity: 'warning',
        message: `${reqId} has a conflictsWith relationship with ${rel.target.label}. Review before implementation.`,
      });
    } else if (rel.type === 'breaks') {
      out.push({
        code: 'breaks',
        severity: 'error',
        message: `${reqId} declares it breaks ${rel.target.label}. Confirm this is intentional.`,
      });
    } else if (rel.type === 'deprecates' && rel.direction === 'out') {
      out.push({
        code: 'deprecates',
        severity: 'info',
        message: `${reqId} deprecates ${rel.target.label}. Make sure a replacement or migration note is documented.`,
      });
    }
  }

  return out;
}

// ── Raw-XML helpers ─────────────────────────────────────────────────────────
//
// The parser exposes the original XML object on `item.raw` but doesn't promote
// `<rationale>`, `<statement>`, or `@_ownerRef` to first-class fields. We read
// them directly here so the transformer doesn't need parser changes.

/** Extract a string-valued child element (e.g. <rationale>...</rationale>). */
export function readChildText(raw: unknown, childName: string): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = (raw as Record<string, unknown>)[childName];
  return readTextValue(value);
}

/** Extract an attribute (e.g. ownerRef → @_ownerRef). */
export function readAttribute(raw: unknown, attrName: string): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = (raw as Record<string, unknown>)['@_' + attrName];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

/**
 * fast-xml-parser may produce strings, objects with `#text`, or arrays — be tolerant.
 */
function readTextValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return readTextValue(first);
  }
  if (typeof value === 'object') {
    const text = (value as Record<string, unknown>)['#text'];
    if (typeof text === 'string') return text.trim() || undefined;
    // Sometimes the whole object is the body — fall back to a cheap stringify
    // of all string children.
    const parts: string[] = [];
    for (const v of Object.values(value)) {
      const t = readTextValue(v);
      if (t) parts.push(t);
    }
    return parts.length ? parts.join(' ') : undefined;
  }
  return undefined;
}
