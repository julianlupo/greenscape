import { NextResponse } from "next/server";
import { z } from "zod";
import { regenerateProposal } from "@/lib/approval";
import { postSlackApprovalPing } from "@/lib/slack";
import { logEvent } from "@/lib/events";
import { PipelineError } from "@/lib/pipeline";

export const runtime = "nodejs";
// Both Claude calls run here serially — same budget as /draft.
export const maxDuration = 300;

const Body = z.object({
  reason: z.string().max(2000).optional().default(""),
  source: z.enum(["web", "slack"]).optional().default("web"),
});

/**
 * POST /api/proposals/[id]/regenerate
 *
 * Wipes the extracted scope + draft and re-runs the full pipeline. After the
 * new draft lands, posts a fresh Slack approval ping (or updates the
 * existing one).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const proposal = await regenerateProposal(params.id, parsed.data.reason, {
      source: parsed.data.source,
    });

    // Fresh Slack approval ping — best effort.
    try {
      await postSlackApprovalPing(params.id, "medium");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent(params.id, "slack_failed", { stage: "regenerate_ping", message });
    }

    return NextResponse.json({
      ok: true,
      total_cents: proposal.total_cents,
      status: proposal.status,
    });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[regenerate]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
