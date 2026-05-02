import { NextResponse } from "next/server";
import { runProposalDrafting, PipelineError } from "@/lib/pipeline";
import { postSlackApprovalPing } from "@/lib/slack";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
// Drafting can take 60–120s on a complex scope (Sonnet 4.6 generating 4k+
// output tokens). 300s is the Vercel Pro ceiling; on Hobby the cap is 60s
// and this endpoint may need to be refactored to async/polling — flagged
// in the README under "What would break first at scale."
export const maxDuration = 300;

/**
 * POST /api/proposals/[id]/draft
 *
 * Runs Claude call #2 (drafting), computes server-side totals, transitions
 * the proposal to `pending_approval`, and posts the approval ping to Slack.
 *
 * Slack failure is non-fatal — the draft is saved either way. Marcus can
 * still review the proposal directly from the dashboard.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await runProposalDrafting(params.id);

    // Post-draft side effect: ping Slack for approval. Don't fail the request
    // if Slack is misconfigured — log and continue.
    try {
      await postSlackApprovalPing(params.id, result.draft.confidence);
    } catch (slackErr) {
      const message = slackErr instanceof Error ? slackErr.message : String(slackErr);
      await logEvent(params.id, "slack_failed", { message });
      console.warn("[draft] slack ping failed:", message);
    }

    return NextResponse.json({
      ok: true,
      total_cents: result.total_cents,
      confidence: result.draft.confidence,
      requires_render: result.requires_render,
    });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/proposals/[id]/draft] unexpected:", message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
