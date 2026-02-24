// Transform RQML document to Requirements Matrix data
import { RqmlDocument, RqmlItem } from '../services/rqmlParser';
import { MatrixData, RequirementRow, TestCaseColumn, TestCoverageStatus, validateMatrixData } from '../schemas/matrixSchema';

/**
 * Transform an RQML document into Matrix view data
 * Includes validation via Zod
 */
export function transformToMatrix(doc: RqmlDocument): MatrixData {
  const requirements: RequirementRow[] = [];
  const testCases: TestCaseColumn[] = [];
  const groups: string[] = [];
  const groupSet = new Set<string>();

  // Build a map of trace edges for quick lookup
  // Key: requirement ID, Value: map of test case ID to status
  const traceMap = new Map<string, Map<string, TestCoverageStatus>>();

  // Process trace edges
  for (const edge of doc.traceEdges) {
    // Check if this is a requirement-to-testcase trace
    // or testcase-to-requirement trace
    const fromId = edge.from;
    const toId = edge.to;

    // Determine status from edge type or default to pending
    const status = edgeTypeToStatus(edge.type);

    // Add to trace map (both directions)
    addToTraceMap(traceMap, fromId, toId, status);
    addToTraceMap(traceMap, toId, fromId, status);
  }

  // Extract requirements (from requirements section and goals)
  const requirementsSection = doc.sections.get('requirements');
  if (requirementsSection && requirementsSection.present) {
    for (const item of requirementsSection.items) {
      if (item.type === 'reqPackage') {
        // Add package as a group
        const groupName = item.title || item.id;
        if (!groupSet.has(groupName)) {
          groupSet.add(groupName);
          groups.push(groupName);
        }

        // Add requirements within the package
        if (item.children) {
          for (const child of item.children) {
            requirements.push(createRequirementRow(child, traceMap, groupName));
          }
        }
      } else if (item.type.includes('req') || item.type === 'FR' || item.type === 'NFR') {
        requirements.push(createRequirementRow(item, traceMap));
      }
    }
  }

  // Also include goals as requirements
  const goalsSection = doc.sections.get('goals');
  if (goalsSection && goalsSection.present) {
    const goalGroupName = 'Goals';
    if (goalsSection.items.length > 0) {
      if (!groupSet.has(goalGroupName)) {
        groupSet.add(goalGroupName);
        groups.push(goalGroupName);
      }

      for (const item of goalsSection.items) {
        if (item.type === 'goal' || item.type === 'qgoal') {
          requirements.push(createRequirementRow(item, traceMap, goalGroupName));
        }
      }
    }
  }

  // Extract test cases from verification section
  const verificationSection = doc.sections.get('verification');
  if (verificationSection && verificationSection.present) {
    for (const item of verificationSection.items) {
      if (item.type === 'testCase' || item.type === 'testSuite') {
        testCases.push({
          id: item.id,
          title: item.title || item.name || item.id
        });
      }
    }
  }

  const data = { requirements, testCases, groups };

  // Validate with Zod before returning
  return validateMatrixData(data);
}

/**
 * Create a requirement row with test coverage mapping
 */
function createRequirementRow(
  item: RqmlItem,
  traceMap: Map<string, Map<string, TestCoverageStatus>>,
  group?: string
): RequirementRow {
  const coverage = traceMap.get(item.id) || new Map();

  return {
    id: item.id,
    title: item.title || item.name || item.id,
    group,
    testCoverage: Object.fromEntries(coverage)
  };
}

/**
 * Add a trace relationship to the map
 */
function addToTraceMap(
  traceMap: Map<string, Map<string, TestCoverageStatus>>,
  fromId: string,
  toId: string,
  status: TestCoverageStatus
): void {
  if (!traceMap.has(fromId)) {
    traceMap.set(fromId, new Map());
  }
  const existing = traceMap.get(fromId)!.get(toId);

  // Don't downgrade passed to pending
  if (!existing || (existing === 'pending' && status !== 'pending')) {
    traceMap.get(fromId)!.set(toId, status);
  }
}

/**
 * Convert trace edge type to test coverage status
 */
function edgeTypeToStatus(edgeType: string): TestCoverageStatus {
  switch (edgeType.toLowerCase()) {
    case 'verifies':
    case 'validates':
    case 'tests':
    case 'passed':
      return 'passed';
    case 'failed':
    case 'fails':
      return 'failed';
    case 'pending':
    case 'implements':
    case 'satisfies':
    case 'derivedfrom':
    case 'relatedto':
    default:
      return 'pending';
  }
}
