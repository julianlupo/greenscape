/**
 * Approve / reject — extracted from the route handlers so they can be called
 * from anywhere (web POST, Slack button click, future SMS / email approval).
 *
 * State transitions enforced here, not at the call site.
 */
import { supabase } from "./supabase";
import { logEvent } from "./events";
import { createDepositPaymentLink } from "./stripe";
import { sendProposalEmail } from "./send";
import {
  loadProposal,
  PipelineError,
  runProposalDrafting,
  runScopeExtraction,
} from "./pipeline";
import type { ProposalRow } from "./types";

export interface ApprovalResult {
  proposal: ProposalRow;
  stripe_payment_link: string | null;
}

export async function approveProposal(
  proposalId: string,
  actor: { source: "web" | "slack"; user?: string } = { source: "web" }
): Promise<ApprovalResult> {
  const sb = supabase();
  const proposal = await loadProposal(proposalId);
  if (proposal.status !== "pending_approval") {
    throw new PipelineError(`Cannot approve: status is '${proposal.status}'`, 409);
  }

  // 1. Stripe payment link (best effort)
  let stripe_payment_link = proposal.stripe_payment_link;
  if (!stripe_payment_link) {
    try {
      stripe_payment_link = await createDepositPaymentLink(proposal);
      await logEvent(proposalId, "stripe_link_created", { url: stripe_payment_link });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent(proposalId, "stripe_failed", { message });
      console.warn("[approve] stripe link failed:", message);
    }
  }

  // 2. Approve
  const approvedAt = new Date().toISOString();
  const { error: approveErr } = await sb
    .from("proposals")
    .update({ status: "approved", approved_at: approvedAt, stripe_payment_link })
    .eq("id", proposalId);
  if (approveErr) throw new PipelineError(approveErr.message);
  await logEvent(proposalId, "approved", { approved_at: approvedAt, ...actor });

  // 3. Send email (mocked or real depending on RESEND_API_KEY)
  await sendProposalEmail({ ...proposal, stripe_payment_link, status: "approved" });

  // 4. Mark sent
  const sentAt = new Date().toISOString();
  const { error: sentErr } = await sb
    .from("proposals")
    .update({ status: "sent", sent_at: sentAt })
    .eq("id", proposalId);
  if (sentErr) throw new PipelineError(sentErr.message);
  await logEvent(proposalId, "sent", { sent_at: sentAt });

  const updated = await loadProposal(proposalId);
  return { proposal: updated, stripe_payment_link };
}

export async function rejectProposal(
  proposalId: string,
  reason: string = "",
  actor: { source: "web" | "slack"; user?: string } = { source: "web" }
): Promise<ProposalRow> {
  const sb = supabase();
  const proposal = await loadProposal(proposalId);
  if (proposal.status !== "pending_approval") {
    throw new PipelineError(`Cannot reject: status is '${proposal.status}'`, 409);
  }

  const rejectedAt = new Date().toISOString();
  const { error } = await sb
    .from("proposals")
    .update({ status: "rejected", rejected_at: rejectedAt })
    .eq("id", proposalId);
  if (error) throw new PipelineError(error.message);
  await logEvent(proposalId, "rejected", { reason, rejected_at: rejectedAt, ...actor });

  return loadProposal(proposalId);
}

/**
 * Regenerate a previously-rejected (or stuck-in-draft) proposal — wipes the
 * extraction + draft and re-runs both Claude calls. Lands on
 * `pending_approval` with a fresh proposal_markdown + line items.
 */
export async function regenerateProposal(
  proposalId: string,
  reason: string = "",
  actor: { source: "web" | "slack"; user?: string } = { source: "web" }
): Promise<ProposalRow> {
  const sb = supabase();
  const proposal = await loadProposal(proposalId);
  if (!["rejected", "draft", "pending_approval", "error"].includes(proposal.status)) {
    throw new PipelineError(
      `Cannot regenerate from status '${proposal.status}'`,
      409
    );
  }

  // Reset to draft so the existing pipeline state guards pass. Wipe outputs
  // so a stale partial result doesn't poison the new run.
  const { error: resetErr } = await sb
    .from("proposals")
    .update({
      status: "draft",
      extracted_scope: null,
      line_items: null,
      subtotal_cents: 0,
      total_cents: 0,
      proposal_markdown: null,
      requires_render: false,
      rejected_at: null,
      // keep slack_message_ts + slack_channel_id so we can update the same
      // thread, and keep stripe_payment_link cleared (a new approve generates
      // a fresh deposit link on top of the new total).
      stripe_payment_link: null,
    })
    .eq("id", proposalId);
  if (resetErr) throw new PipelineError(resetErr.message);

  await logEvent(proposalId, "drafted", {
    stage: "regenerate.reset",
    reason,
    ...actor,
  });

  // Re-run both Claude calls. The drafting step transitions status to
  // pending_approval on success.
  await runScopeExtraction(proposalId);
  await runProposalDrafting(proposalId);

  return loadProposal(proposalId);
}
