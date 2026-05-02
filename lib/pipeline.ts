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
import { ExtractedScopeSchema, type ExtractedScopeT } from "./schemas";
import { EXTRACTION_SYSTEM } from "./prompts";
import { logEvent } from "./events";
import type { ProposalRow, ProposalStatus } from "./types";

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

export { PipelineError };
