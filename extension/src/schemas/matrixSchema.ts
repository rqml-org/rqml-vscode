// REQ-MAT-002, REQ-MAT-006, REQ-MAT-008
// Zod schemas for the redesigned Traceability Matrix view.
//
// The shape is requirements-centred: one row per requirement with all
// derived columns (goals, implementations, test cases, verification status,
// sync status, impact, warnings). Multi-valued cells use ChipRef[].

import { z } from 'zod';

// ── Status enums ────────────────────────────────────────────────────────────

export const VerificationStatusSchema = z.enum([
  'Verified',
  'Partially verified',
  'Unverified',
  'Unknown',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const SyncStatusSchema = z.enum([
  'Implemented',
  'Partially Implemented',
  'Not Started',
  'Deprecated',
  'Broken Trace',
]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const ImpactSchema = z.enum(['Low', 'Medium', 'High', 'Critical']);
export type Impact = z.infer<typeof ImpactSchema>;

export const WarningSeveritySchema = z.enum(['info', 'warning', 'error']);
export type WarningSeverity = z.infer<typeof WarningSeveritySchema>;

// ── Sub-shapes ──────────────────────────────────────────────────────────────

/** A clickable reference to another item in the spec (or an external URI). */
export const ChipRefSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** 1-indexed source line, when known and resolvable to a local item */
  line: z.number().optional(),
  /** Whether the reference targets an external URI rather than a local id */
  external: z.boolean().optional(),
  /** Resolved external URI, if any */
  uri: z.string().optional(),
  /** True if the target ID could not be resolved */
  broken: z.boolean().optional(),
});
export type ChipRef = z.infer<typeof ChipRefSchema>;

/** A single trace edge involving the row's requirement, with its direction. */
export const RelationshipRefSchema = z.object({
  edgeId: z.string(),
  type: z.string(),
  target: ChipRefSchema,
  direction: z.enum(['out', 'in']),
  notes: z.string().optional(),
});
export type RelationshipRef = z.infer<typeof RelationshipRefSchema>;

/** A traceability warning surfaced on a row or in the detail panel. */
export const WarningSchema = z.object({
  /** Stable code, suitable for filtering or future Problems-panel integration */
  code: z.string(),
  severity: WarningSeveritySchema,
  message: z.string(),
});
export type Warning = z.infer<typeof WarningSchema>;

/** Resolved owner reference. */
export const OwnerRefSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});
export type OwnerRef = z.infer<typeof OwnerRefSchema>;

// ── Row ─────────────────────────────────────────────────────────────────────

export const MatrixRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Requirement type (FR / NFR / IR / DR / SR / CR / PR / UXR / OR) or 'goal' / 'qgoal' */
  type: z.string(),
  /** RQML status (draft / review / approved / deprecated) */
  status: z.string(),
  priority: z.string().optional(),
  owner: OwnerRefSchema.optional(),
  rationale: z.string().optional(),
  /** Verbatim requirement statement, used for search and detail panel */
  statement: z.string().optional(),
  /** Upstream goals (refines/satisfies traces toward goals) */
  goals: z.array(ChipRefSchema),
  /** Linked design artifacts (ADRs, decisions, design entries) */
  designArtifacts: z.array(ChipRefSchema),
  /** Implementations: implements/providesInterface trace targets and external URIs */
  implementations: z.array(ChipRefSchema),
  /** Test cases / verification artifacts */
  testCases: z.array(ChipRefSchema),
  /** Every trace edge involving this requirement, both directions */
  relationships: z.array(RelationshipRefSchema),
  verificationStatus: VerificationStatusSchema,
  syncStatus: SyncStatusSchema,
  impact: ImpactSchema,
  warnings: z.array(WarningSchema),
  /** Source line in the .rqml file, for navigation */
  line: z.number().optional(),
  /** Optional grouping label (typically the parent reqPackage title) */
  group: z.string().optional(),
});
export type MatrixRow = z.infer<typeof MatrixRowSchema>;

// ── Top-level matrix data ───────────────────────────────────────────────────

export const MatrixSummarySchema = z.object({
  total: z.number(),
  unverified: z.number(),
  withoutGoal: z.number(),
  withoutImplementation: z.number(),
  deprecatedTraces: z.number(),
  brokenReferences: z.number(),
  inSync: z.number(),
});
export type MatrixSummary = z.infer<typeof MatrixSummarySchema>;

export const MatrixDataSchema = z.object({
  /** File name to show in the tab title and header. Empty if no file. */
  fileName: z.string(),
  rows: z.array(MatrixRowSchema),
  summary: MatrixSummarySchema,
  /** Set when the underlying RQML file has parse or validation errors */
  parseError: z.string().optional(),
});
export type MatrixData = z.infer<typeof MatrixDataSchema>;

/**
 * Validate matrix data.
 * @throws ZodError if validation fails
 */
export function validateMatrixData(data: unknown): MatrixData {
  return MatrixDataSchema.parse(data);
}
