// Transform RQML document to ReactFlow graph data
import { RqmlDocument, RqmlItem, RqmlSectionName, RQML_SECTIONS } from '../services/rqmlParser';
import { TraceGraphData, TraceNode, TraceEdge, validateTraceGraphData } from '../schemas/reactFlowSchema';

/**
 * Map RQML section names to graph section categories
 */
const SECTION_CATEGORIES: Record<RqmlSectionName, string> = {
  meta: 'Other',
  catalogs: 'Other',
  domain: 'Other',
  goals: 'Requirements',
  scenarios: 'Requirements',
  requirements: 'Requirements',
  behavior: 'Features',
  interfaces: 'Features',
  verification: 'TestCases',
  trace: 'Other',
  governance: 'Other'
};

/**
 * Transform an RQML document into ReactFlow-compatible graph data
 * Includes validation via Zod
 */
export function transformToReactFlow(doc: RqmlDocument): TraceGraphData {
  const nodes: TraceNode[] = [];
  const edges: TraceEdge[] = [];
  const nodeIds = new Set<string>();

  // Collect all items as nodes
  for (const sectionName of RQML_SECTIONS) {
    const section = doc.sections.get(sectionName);
    if (!section || !section.present) {
      continue;
    }

    for (const item of section.items) {
      addItemAsNode(item, sectionName, nodes, nodeIds);

      // Add children as nodes
      if (item.children) {
        for (const child of item.children) {
          addItemAsNode(child, sectionName, nodes, nodeIds);
        }
      }
    }
  }

  // Add trace edges
  for (const traceEdge of doc.traceEdges) {
    // Only add edge if both source and target nodes exist
    if (nodeIds.has(traceEdge.from) && nodeIds.has(traceEdge.to)) {
      edges.push({
        source: traceEdge.from,
        target: traceEdge.to,
        label: traceEdge.type
      });
    }
  }

  const data = { nodes, edges };

  // Validate with Zod before returning
  return validateTraceGraphData(data);
}

/**
 * Add a single RQML item as a graph node
 */
function addItemAsNode(
  item: RqmlItem,
  sectionName: RqmlSectionName,
  nodes: TraceNode[],
  nodeIds: Set<string>
): void {
  // Skip items without meaningful IDs
  if (!item.id || item.id === 'unknown' || item.id === 'meta') {
    return;
  }

  // Avoid duplicate nodes
  if (nodeIds.has(item.id)) {
    return;
  }

  nodeIds.add(item.id);

  nodes.push({
    id: item.id,
    type: item.type,
    label: item.title || item.name || item.id,
    status: item.status,
    section: SECTION_CATEGORIES[sectionName]
  });
}
