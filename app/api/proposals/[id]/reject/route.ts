import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectProposal } from "@/lib/approval";
import { markSlackRejected } from "@/lib/slack";
import { logEvent } from "@/lib/events";
import { PipelineError } from "@/lib/pipeline";

export const runtime = "nodejs";

const RejectSchema = z.object({ reason: z.string().max(2000).optional().default("") });

/**
 * POST /api/proposals/[id]/reject
 * Web-side reject. Slack reject goes through /api/slack/interactive.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    await rejectProposal(params.id, parsed.data.reason, { source: "web" });
    try {
      await markSlackRejected(params.id, "web");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent(params.id, "slack_failed", { stage: "rejected_update", message });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
