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
import { loadProposal, PipelineError } from "./pipeline";
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
