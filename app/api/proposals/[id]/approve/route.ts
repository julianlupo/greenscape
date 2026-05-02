import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/events";
import { createDepositPaymentLink } from "@/lib/stripe";
import { sendProposalEmail } from "@/lib/send";
import { postSlackSentReply } from "@/lib/slack";
import type { ProposalRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/proposals/[id]/approve
 *
 * Approve the proposal. Atomic-ish flow:
 *   1. State guard: must be `pending_approval`.
 *   2. Generate Stripe payment link (50% deposit). If Stripe fails, log and
 *      continue — Marcus can re-generate from /review.
 *   3. Transition status → `approved`.
 *   4. Send (mocked) customer email.
 *   5. Transition status → `sent`.
 *   6. Post Slack thread reply.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabase();
  const { data: row, error: fetchErr } = await sb
    .from("proposals")
    .select("*")
    .eq("id", params.id)
    .single();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  const proposal = row as ProposalRow;
  if (proposal.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve: status is '${proposal.status}'` },
      { status: 409 }
    );
  }

  // 1. Stripe payment link (best effort)
  let stripe_payment_link: string | null = proposal.stripe_payment_link;
  if (!stripe_payment_link) {
    try {
      stripe_payment_link = await createDepositPaymentLink(proposal);
      await logEvent(params.id, "stripe_link_created", { url: stripe_payment_link });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent(params.id, "stripe_failed", { message });
      console.warn("[approve] stripe link failed:", message);
    }
  }

  // 2. Approve
  const approvedAt = new Date().toISOString();
  const { error: approveErr } = await sb
    .from("proposals")
    .update({
      status: "approved",
      approved_at: approvedAt,
      stripe_payment_link,
    })
    .eq("id", params.id);
  if (approveErr) {
    return NextResponse.json({ error: approveErr.message }, { status: 500 });
  }
  await logEvent(params.id, "approved", { approved_at: approvedAt });

  // 3. Mocked send
  await sendProposalEmail({ ...proposal, stripe_payment_link, status: "approved" });

  const sentAt = new Date().toISOString();
  const { error: sentErr } = await sb
    .from("proposals")
    .update({ status: "sent", sent_at: sentAt })
    .eq("id", params.id);
  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 500 });
  }
  await logEvent(params.id, "sent", { sent_at: sentAt });

  // 4. Slack thread reply (non-fatal)
  try {
    await postSlackSentReply(params.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(params.id, "slack_failed", { message, stage: "sent_reply" });
  }

  return NextResponse.json({ ok: true, stripe_payment_link, sent_at: sentAt });
}
