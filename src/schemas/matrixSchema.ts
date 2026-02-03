// Zod schemas for Requirements Matrix data validation
import { z } from 'zod';

/**
 * Test coverage status
 */
export const TestCoverageStatusSchema = z.enum(['passed', 'failed', 'pending', 'none']);
export type TestCoverageStatus = z.infer<typeof TestCoverageStatusSchema>;

/**
 * Schema for a requirement row in the matrix
 */
export const RequirementRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  group: z.string().optional(),
  testCoverage: z.record(z.string(), TestCoverageStatusSchema)
});

export type RequirementRow = z.infer<typeof RequirementRowSchema>;

/**
 * Schema for a test case column
 */
export const TestCaseColumnSchema = z.object({
  id: z.string(),
  title: z.string()
});

export type TestCaseColumn = z.infer<typeof TestCaseColumnSchema>;

/**
 * Schema for the complete matrix data
 */
export const MatrixDataSchema = z.object({
  requirements: z.array(RequirementRowSchema),
  testCases: z.array(TestCaseColumnSchema),
  groups: z.array(z.string())
});

export type MatrixData = z.infer<typeof MatrixDataSchema>;

/**
 * Validate matrix data
 * @throws ZodError if validation fails
 */
export function validateMatrixData(data: unknown): MatrixData {
  return MatrixDataSchema.parse(data);
}
