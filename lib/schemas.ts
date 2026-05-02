/**
 * Zod schemas — single source of truth for API request bodies and LLM responses.
 *
 * Every Claude call validates its output against the relevant schema here. On
 * validation failure we retry once (see lib/claude.ts) and fail loud thereafter.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Intake — POST /api/proposals
// ---------------------------------------------------------------------------
export const ProposalIntakeSchema = z.object({
  customer_name: z.string().trim().min(1, "Required").max(200),
  customer_email: z.string().trim().email("Must be a valid email"),
  customer_phone: z.string().trim().max(50).default(""),
  project_address: z.string().trim().min(1, "Required").max(500),
  site_walk_notes: z
    .string()
    .trim()
    .min(20, "Need at least a couple sentences for the agent to work with")
    .max(20000, "That's more than 20k characters — paste a shorter note"),
});
export type ProposalIntake = z.infer<typeof ProposalIntakeSchema>;

// ---------------------------------------------------------------------------
// Scope extraction — Claude call #1 output
// ---------------------------------------------------------------------------
export const ExtractedFeatureSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Feature category, e.g. 'patio', 'pergola', 'fire_pit', 'water_feature', 'retaining_wall', 'outdoor_kitchen', 'lighting', 'irrigation', 'artificial_turf', 'planting', 'demolition'."
    ),
  dimensions: z.string().nullable(),
  materials: z.array(z.string()).default([]),
  quantity: z.number().nullable(),
  notes: z.string().default(""),
});
export type ExtractedFeatureT = z.infer<typeof ExtractedFeatureSchema>;

export const ExtractedScopeSchema = z.object({
  project_summary: z.string().min(1),
  features: z.array(ExtractedFeatureSchema).min(1, "Needs at least one feature"),
  estimated_complexity: z.enum(["simple", "moderate", "complex"]),
  open_questions: z.array(z.string()).default([]),
  red_flags: z.array(z.string()).default([]),
});
export type ExtractedScopeT = z.infer<typeof ExtractedScopeSchema>;

// ---------------------------------------------------------------------------
// Drafting — Claude call #2 output
// ---------------------------------------------------------------------------
export const DraftPickSchema = z.object({
  pricing_item_id: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().default(""),
});

export const DraftResultSchema = z.object({
  selected_line_items: z.array(DraftPickSchema).min(1),
  proposal_markdown: z.string().min(20),
  internal_notes: z.string().default(""),
  confidence: z.enum(["high", "medium", "low"]),
});
export type DraftResultT = z.infer<typeof DraftResultSchema>;

// ---------------------------------------------------------------------------
// Review edits — PATCH /api/proposals/[id]
// ---------------------------------------------------------------------------
export const LineItemEditSchema = z.object({
  pricing_item_id: z.string().uuid(),
  quantity: z.number().nonnegative(),
});

export const ReviewEditSchema = z.object({
  line_items: z.array(LineItemEditSchema).optional(),
  proposal_markdown: z.string().optional(),
});
export type ReviewEdit = z.infer<typeof ReviewEditSchema>;
