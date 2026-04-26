// REQ-MAT-002: Webview-side types mirroring the extension-host MatrixData shape.
// Kept in sync with extension/src/schemas/matrixSchema.ts.

export type VerificationStatus =
  | 'Verified'
  | 'Partially verified'
  | 'Unverified'
  | 'Unknown';

export type SyncStatus =
  | 'Implemented'
  | 'Partially Implemented'
  | 'Not Started'
  | 'Deprecated'
  | 'Broken Trace';

export type Impact = 'Low' | 'Medium' | 'High' | 'Critical';

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface ChipRef {
  id: string;
  label: string;
  line?: number;
  external?: boolean;
  uri?: string;
  broken?: boolean;
}

export interface RelationshipRef {
  edgeId: string;
  type: string;
  target: ChipRef;
  direction: 'out' | 'in';
  notes?: string;
}

export interface Warning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

export interface OwnerRef {
  id: string;
  name?: string;
}

export interface MatrixRow {
  id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  owner?: OwnerRef;
  rationale?: string;
  statement?: string;
  goals: ChipRef[];
  designArtifacts: ChipRef[];
  implementations: ChipRef[];
  testCases: ChipRef[];
  relationships: RelationshipRef[];
  verificationStatus: VerificationStatus;
  syncStatus: SyncStatus;
  impact: Impact;
  warnings: Warning[];
  line?: number;
  group?: string;
}

export interface MatrixSummary {
  total: number;
  unverified: number;
  withoutGoal: number;
  withoutImplementation: number;
  deprecatedTraces: number;
  brokenReferences: number;
  inSync: number;
}

export interface MatrixData {
  fileName: string;
  rows: MatrixRow[];
  summary: MatrixSummary;
  parseError?: string;
}

/** Filter that scopes the visible rows. `null` = no scoping. */
export type SummaryFilter =
  | null
  | 'unverified'
  | 'withoutGoal'
  | 'withoutImplementation'
  | 'deprecatedTraces'
  | 'brokenReferences'
  | 'inSync';

export interface FilterState {
  search: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  ownerId: string | null;
  verification: VerificationStatus | null;
  sync: SyncStatus | null;
  warningsOnly: boolean;
  summary: SummaryFilter;
}

export type SortKey =
  | 'id'
  | 'title'
  | 'type'
  | 'status'
  | 'priority'
  | 'owner'
  | 'verification'
  | 'sync'
  | 'impact'
  | 'warnings';

export interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}
