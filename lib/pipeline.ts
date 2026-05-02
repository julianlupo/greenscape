/**
 * Pipeline orchestration — what happens between intake and Slack approval ping.
 *
 * The state machine is enforced here, not in the route handlers, so client
 * code can't drive an illegal transition by hitting the wrong endpoint.
 *
 *   draft           ──extract→     draft (now has extracted_scope)
 *   draft           ──draft→       pending_approval
 *   pending_approval──approve→     approved → sent
 *   pending_approval──reject→      rejected
 *   * any           ──error→       error (logged, surfaced to UI)
 */
import { supabase } from "./supabase";
import { extractStructured } from "./claude";
import {
  DraftResultSchema,
  ExtractedScopeSchema,
  type DraftResultT,
  type ExtractedScopeT,
} from "./schemas";
import { DRAFT_SYSTEM, EXTRACTION_SYSTEM } from "./prompts";
import { logEvent } from "./events";
import {
  matchLineItems,
  resolvePicksToLineItems,
  type ResolvedLineItem,
} from "./pricing";
import { formatCents } from "./utils";
import type {
  FeatureCandidates,
  ProposalRow,
  ProposalStatus,
  ScoredPricingCandidate,
} from "./types";

class PipelineError extends Error {
  constructor(message: string, readonly statusCode: number = 500) {
    super(message);
  }
}

export async function loadProposal(id: string): Promise<ProposalRow> {
  const { data, error } = await supabase()
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    throw new PipelineError(`Proposal ${id} not found`, 404);
  }
  return data as ProposalRow;
}

function assertStatus(p: ProposalRow, allowed: ProposalStatus[]): void {
  if (!allowed.includes(p.status)) {
    throw new PipelineError(
      `Illegal transition: proposal is in status '${p.status}', expected one of [${allowed.join(", ")}]`,
      409
    );
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Scope extraction (Claude call #1)
// ---------------------------------------------------------------------------
export async function runScopeExtraction(proposalId: string): Promise<ExtractedScopeT> {
  const proposal = await loadProposal(proposalId);
  assertStatus(proposal, ["draft"]);

  let scope: ExtractedScopeT;
  let metaForLog: Record<string, unknown> = {};
  try {
    const { value, meta } = await extractStructured({
      system: EXTRACTION_SYSTEM,
      user: buildExtractionUserMessage(proposal),
      schema: ExtractedScopeSchema,
      maxTokens: 2048,
    });
    scope = value;
    metaForLog = {
      tokens_in: meta.input_tokens,
      tokens_out: meta.output_tokens,
      model: meta.model,
      attempts: meta.attempts,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(proposalId, "error", { stage: "extract", message });
    throw new PipelineError(`Scope extraction failed: ${message}`, 502);
  }

  const requiresRender = false; // computed after totals — fixed in draft step
  const { error: updateErr } = await supabase()
    .from("proposals")
    .update({ extracted_scope: scope, requires_render: requiresRender })
    .eq("id", proposalId);
  if (updateErr) {
    await logEvent(proposalId, "error", { stage: "extract.persist", message: updateErr.message });
    throw new PipelineError(`Failed to persist scope: ${updateErr.message}`);
  }

  await logEvent(proposalId, "extracted", {
    feature_count: scope.features.length,
    complexity: scope.estimated_complexity,
    open_questions: scope.open_questions.length,
    red_flags: scope.red_flags.length,
    ...metaForLog,
  });

  return scope;
}

function buildExtractionUserMessage(proposal: ProposalRow): string {
  return [
    `Customer: ${proposal.customer_name}`,
    `Project address: ${proposal.project_address}`,
    "",
    "Site walk notes (Marcus's words, exactly as written):",
    proposal.site_walk_notes,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Step 4 — Proposal drafting (Claude call #2)
// ---------------------------------------------------------------------------
// Threshold above which Carlos's render queue is required (mocked here, but
// flagged on the proposal so the UI can surface "render pending").
const RENDER_REQUIRED_CENTS = 30_000_00;

export interface DraftedProposal {
  draft: DraftResultT;
  line_items: ResolvedLineItem[];
  subtotal_cents: number;
  total_cents: number;
  requires_render: boolean;
}

export async function runProposalDrafting(proposalId: string): Promise<DraftedProposal> {
  const proposal = await loadProposal(proposalId);
  assertStatus(proposal, ["draft"]);
  if (!proposal.extracted_scope) {
    throw new PipelineError("Cannot draft: extracted_scope is missing. Run /extract first.", 409);
  }

  // Re-validate scope on the way in — it was Zod-validated when written, but
  // belt-and-suspenders against schema drift.
  const scopeParsed = ExtractedScopeSchema.safeParse(proposal.extracted_scope);
  if (!scopeParsed.success) {
    throw new PipelineError(
      `Stored extracted_scope is malformed: ${scopeParsed.error.message}`,
      500
    );
  }
  const scope = scopeParsed.data;

  const matched = await matchLineItems(scope);

  let draft: DraftResultT;
  let metaForLog: Record<string, unknown> = {};
  try {
    const { value, meta } = await extractStructured({
      system: DRAFT_SYSTEM,
      user: buildDraftUserMessage(scope, matched),
      schema: DraftResultSchema,
      maxTokens: 4096,
    });
    draft = value;
    metaForLog = {
      tokens_in: meta.input_tokens,
      tokens_out: meta.output_tokens,
      model: meta.model,
      attempts: meta.attempts,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(proposalId, "error", { stage: "draft", message });
    throw new PipelineError(`Proposal drafting failed: ${message}`, 502);
  }

  // Server-side total computation. The LLM never does customer-facing math.
  const { line_items, subtotal_cents, missing_ids } = await resolvePicksToLineItems(
    draft.selected_line_items
  );

  if (missing_ids.length > 0) {
    await logEvent(proposalId, "error", {
      stage: "draft.resolve",
      message: "Claude picked pricing_item_ids that don't exist",
      missing_ids,
    });
    throw new PipelineError(
      `Drafting picked ${missing_ids.length} non-existent pricing item(s). Bailing rather than ship a proposal with phantom items.`,
      502
    );
  }

  const total_cents = subtotal_cents; // tax/markup applied here in production
  const requires_render = total_cents >= RENDER_REQUIRED_CENTS;

  const { error: updateErr } = await supabase()
    .from("proposals")
    .update({
      line_items,
      subtotal_cents,
      total_cents,
      proposal_markdown: draft.proposal_markdown,
      requires_render,
      status: "pending_approval",
    })
    .eq("id", proposalId);
  if (updateErr) {
    await logEvent(proposalId, "error", { stage: "draft.persist", message: updateErr.message });
    throw new PipelineError(`Failed to persist draft: ${updateErr.message}`);
  }

  await logEvent(proposalId, "drafted", {
    line_item_count: line_items.length,
    subtotal_cents,
    total_cents,
    confidence: draft.confidence,
    requires_render,
    internal_notes_chars: draft.internal_notes.length,
    ...metaForLog,
  });
  await logEvent(proposalId, "submitted_for_approval", { total: formatCents(total_cents) });

  return { draft, line_items, subtotal_cents, total_cents, requires_render };
}

function buildDraftUserMessage(
  scope: ExtractedScopeT,
  matched: { per_feature: FeatureCandidates[]; global: ScoredPricingCandidate[] }
): string {
  const lines: string[] = [];
  lines.push("=== Extracted Scope ===");
  lines.push(JSON.stringify(scope, null, 2));
  lines.push("");
  lines.push("=== Candidate Line Items (grouped by feature) ===");

  for (const fc of matched.per_feature) {
    lines.push("");
    lines.push(
      `--- For feature: type="${fc.feature.type}", dimensions=${fc.feature.dimensions ?? "null"}, materials=[${fc.feature.materials.join(", ")}] ---`
    );
    if (fc.candidates.length === 0) {
      lines.push("(no candidates in matching category)");
      continue;
    }
    for (const c of fc.candidates) {
      lines.push(formatCandidate(c));
    }
  }

  if (matched.global.length > 0) {
    lines.push("");
    lines.push("--- Global add-ons (labor, permits, access, demo — pick when relevant) ---");
    for (const c of matched.global) {
      lines.push(formatCandidate(c));
    }
  }

  lines.push("");
  lines.push(
    "Pick the right items for this scope. Set realistic quantities. Don't double-count labor / PM if they're already inside other items. Write the proposal in Marcus's voice. Respond with a single JSON object only."
  );
  return lines.join("\n");
}

function formatCandidate(c: ScoredPricingCandidate): string {
  const i = c.pricing_item;
  return `  • id=${i.id}  name="${i.name}"  unit=${i.unit}  unit_price_cents=${i.unit_price_cents}  desc="${i.description}"  score=${c.score}`;
}

export { PipelineError };
