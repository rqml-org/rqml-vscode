// Zod schemas for ReactFlow data validation
import { z } from 'zod';

/**
 * Schema for a node in the trace graph
 */
export const TraceNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  status: z.string().optional(),
  section: z.string()
});

export type TraceNode = z.infer<typeof TraceNodeSchema>;

/**
 * Schema for an edge in the trace graph
 */
export const TraceEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional()
});

export type TraceEdge = z.infer<typeof TraceEdgeSchema>;

/**
 * Schema for the complete trace graph data
 */
export const TraceGraphDataSchema = z.object({
  nodes: z.array(TraceNodeSchema),
  edges: z.array(TraceEdgeSchema)
});

export type TraceGraphData = z.infer<typeof TraceGraphDataSchema>;

/**
 * Validate trace graph data
 * @throws ZodError if validation fails
 */
export function validateTraceGraphData(data: unknown): TraceGraphData {
  return TraceGraphDataSchema.parse(data);
}
