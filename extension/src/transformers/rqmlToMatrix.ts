// REQ-MAT-002, REQ-MAT-003: Transform parsed RQML into Traceability Matrix data.

import type { RqmlDocument, RqmlItem } from '../services/rqmlParser';
import {
  validateMatrixData,
  type MatrixData,
  type MatrixRow,
  type MatrixSummary,
} from '../schemas/matrixSchema';
import {
  buildCatalogsIndex,
  buildItemIndex,
  buildRelationships,
  deriveImpact,
  deriveSyncStatus,
  deriveVerificationStatus,
  detectWarnings,
  findDesignArtifactsForReq,
  findGoalsForReq,
  findImplementationsForReq,
  findTestCasesForReq,
  readAttribute,
  readChildText,
  resolveOwner,
  walkItems,
} from './matrixDerive';

const REQ_ITEM_TYPES = new Set([
  'req',
  'FR',
  'NFR',
  'IR',
  'DR',
  'SR',
  'CR',
  'PR',
  'UXR',
  'OR',
]);

/**
 * Transform a parsed RQML document into MatrixData.
 *
 * `fileName` is the bare file name (e.g. `requirements.rqml`) used in the tab
 * title and header. `parseError` is forwarded so the webview can render an
 * error state without losing whatever rows could still be extracted.
 */
export function transformToMatrix(
  doc: RqmlDocument,
  fileName = '',
  parseError?: string,
): MatrixData {
  const itemIndex = buildItemIndex(doc);
  const catalogsIndex = buildCatalogsIndex(doc);

  // Build per-section indexes used to classify trace targets
  const goalsIndex = new Map<string, RqmlItem>();
  const goalsSection = doc.sections.get('goals');
  if (goalsSection?.present) {
    walkItems(goalsSection.items, item => {
      if (item.id) goalsIndex.set(item.id, item);
    });
  }

  const verificationIndex = new Map<string, RqmlItem>();
  const verificationSection = doc.sections.get('verification');
  if (verificationSection?.present) {
    walkItems(verificationSection.items, item => {
      if (item.id) verificationIndex.set(item.id, item);
    });
  }

  const rows: MatrixRow[] = [];
  const reqsSection = doc.sections.get('requirements');
  if (reqsSection?.present) {
    for (const top of reqsSection.items) {
      if (top.type === 'reqPackage') {
        const groupName = top.title || top.id;
        if (top.children) {
          for (const child of top.children) {
            if (isRequirementItem(child)) {
              rows.push(buildRow(child, doc, itemIndex, catalogsIndex, goalsIndex, verificationIndex, groupName));
            }
          }
        }
      } else if (isRequirementItem(top)) {
        rows.push(buildRow(top, doc, itemIndex, catalogsIndex, goalsIndex, verificationIndex));
      }
    }
  }

  const summary = computeSummary(rows, doc);

  return validateMatrixData({
    fileName,
    rows,
    summary,
    parseError,
  } satisfies MatrixData);
}

function isRequirementItem(item: RqmlItem): boolean {
  return REQ_ITEM_TYPES.has(item.type) || item.type.toLowerCase().includes('req');
}

function buildRow(
  req: RqmlItem,
  doc: RqmlDocument,
  itemIndex: Map<string, RqmlItem>,
  catalogsIndex: Map<string, RqmlItem>,
  goalsIndex: Map<string, RqmlItem>,
  verificationIndex: Map<string, RqmlItem>,
  group?: string,
): MatrixRow {
  const goals = findGoalsForReq(req.id, doc.traceEdges, itemIndex, goalsIndex);
  const designArtifacts = findDesignArtifactsForReq(
    req.id,
    doc.traceEdges,
    itemIndex,
    goalsIndex,
    verificationIndex,
  );
  const implementations = findImplementationsForReq(req.id, doc.traceEdges, itemIndex);
  const testCases = findTestCasesForReq(req.id, doc.traceEdges, itemIndex, verificationIndex);
  const relationships = buildRelationships(req.id, doc.traceEdges, itemIndex);

  const verificationStatus = deriveVerificationStatus(testCases, req.status);
  const syncStatus = deriveSyncStatus(req.status, implementations, testCases);
  const impact = deriveImpact(req.id, doc.traceEdges);
  const warnings = detectWarnings(
    req.id,
    req.status,
    goals,
    testCases,
    implementations,
    relationships,
  );

  const ownerRef = readAttribute(req.raw, 'ownerRef');
  const owner = resolveOwner(ownerRef, catalogsIndex);

  return {
    id: req.id,
    title: req.title || req.name || req.id,
    type: req.type,
    status: req.status || 'draft',
    priority: req.priority,
    owner,
    rationale: readChildText(req.raw, 'rationale'),
    statement: readChildText(req.raw, 'statement'),
    goals,
    designArtifacts,
    implementations,
    testCases,
    relationships,
    verificationStatus,
    syncStatus,
    impact,
    warnings,
    line: req.line,
    group,
  };
}

function computeSummary(rows: MatrixRow[], doc: RqmlDocument): MatrixSummary {
  const total = rows.length;
  let unverified = 0;
  let withoutGoal = 0;
  let withoutImplementation = 0;
  let inSync = 0;
  let brokenReferences = 0;

  for (const row of rows) {
    if (row.verificationStatus === 'Unverified') unverified++;
    if (row.goals.length === 0) withoutGoal++;
    if (row.implementations.length === 0) withoutImplementation++;
    if (row.syncStatus === 'Implemented' && row.verificationStatus === 'Verified') inSync++;
    for (const w of row.warnings) {
      if (w.code === 'broken-reference') brokenReferences++;
    }
  }

  // Deprecated traces: count requirements that themselves are deprecated.
  // (Trace-edge-level deprecation would require a schema change.)
  const deprecatedTraces = rows.filter(r => r.status === 'deprecated').length;
  void doc; // doc is kept on the signature for future use

  return {
    total,
    unverified,
    withoutGoal,
    withoutImplementation,
    deprecatedTraces,
    brokenReferences,
    inSync,
  };
}
