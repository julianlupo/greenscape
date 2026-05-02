import { NextResponse } from "next/server";
import { approveProposal } from "@/lib/approval";
import { markSlackApproved, postSlackSentReply } from "@/lib/slack";
import { logEvent } from "@/lib/events";
import { PipelineError } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/proposals/[id]/approve
 *
 * Web-side approve. Slack-side approve goes through /api/slack/interactive
 * which calls the same `approveProposal` to keep one path through the state
 * machine.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await approveProposal(params.id, { source: "web" });

    // Slack updates (best effort)
    try {
      await markSlackApproved(params.id, "web");
      await postSlackSentReply(params.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent(params.id, "slack_failed", { stage: "approved_update", message });
    }

    return NextResponse.json({
      ok: true,
      stripe_payment_link: result.stripe_payment_link,
      sent_at: result.proposal.sent_at,
    });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[approve]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
