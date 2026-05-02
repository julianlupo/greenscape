// Database row shapes — kept in sync with db/migrations/001_initial.sql.
// We hand-maintain these instead of `supabase gen types` to keep the toolchain
// minimal for the take-home; in production we'd generate.

export type ProposalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "sent"
  | "error";

export type PricingUnit = "sqft" | "linear_ft" | "each" | "hour" | "lump_sum";

export interface PricingItemRow {
  id: string;
  category: string;
  name: string;
  unit: PricingUnit;
  unit_price_cents: number;
  description: string;
  keywords: string[];
  created_at: string;
}

export interface ProposalRow {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  project_address: string;
  site_walk_notes: string;
  extracted_scope: ExtractedScope | null;
  line_items: SelectedLineItem[] | null;
  subtotal_cents: number;
  total_cents: number;
  proposal_markdown: string | null;
  status: ProposalStatus;
  requires_render: boolean;
  stripe_payment_link: string | null;
  slack_message_ts: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProposalEventType =
  | "created"
  | "extracted"
  | "drafted"
  | "submitted_for_approval"
  | "approved"
  | "rejected"
  | "sent"
  | "error"
  | "slack_posted"
  | "slack_failed"
  | "stripe_link_created"
  | "stripe_failed"
  | "email_mocked";

export interface ProposalEventRow {
  id: string;
  proposal_id: string;
  event_type: ProposalEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Pipeline-internal types (mirrors of Zod schemas in lib/schemas.ts)
// ----------------------------------------------------------------------------

export interface ExtractedFeature {
  type: string;
  dimensions: string | null;
  materials: string[];
  quantity: number | null;
  notes: string;
}

export interface ExtractedScope {
  project_summary: string;
  features: ExtractedFeature[];
  estimated_complexity: "simple" | "moderate" | "complex";
  open_questions: string[];
  red_flags: string[];
}

// A pricing item that survived the deterministic match step — sent to the
// drafting LLM call as candidates. Includes a score for explainability.
export interface ScoredPricingCandidate {
  pricing_item: PricingItemRow;
  score: number;
  matched_on: string[];
}

// Per-feature bundle of candidate items handed to the drafting LLM call.
export interface FeatureCandidates {
  feature: ExtractedFeature;
  candidates: ScoredPricingCandidate[];
}

// What Claude returns from the drafting call (after Zod validation).
export interface DraftPick {
  pricing_item_id: string;
  quantity: number;
  notes: string;
}

export interface DraftResult {
  selected_line_items: DraftPick[];
  proposal_markdown: string;
  internal_notes: string;
  confidence: "high" | "medium" | "low";
}

// What we persist to proposals.line_items — the LLM picks plus the resolved
// pricing snapshot, so the proposal is reproducible even if pricing changes.
export interface SelectedLineItem {
  pricing_item_id: string;
  name: string;
  category: string;
  unit: PricingUnit;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  notes: string;
}
