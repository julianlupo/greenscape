/**
 * Slack interactive endpoint — handles button clicks from the approval ping.
 *
 * Flow:
 *   1. Slack POSTs a `application/x-www-form-urlencoded` body with a `payload`
 *      field whose value is a JSON string.
 *   2. We verify the request signature using SLACK_SIGNING_SECRET.
 *   3. We parse the payload, find which button was clicked, and run the
 *      appropriate flow (approve or reject).
 *   4. We respond with 200 + a `response_action` that updates the original
 *      message in place — so the buttons disappear and the message shows the
 *      outcome.
 *
 * Slack's 3-second response timeout: the approve flow does Stripe + email +
 * DB writes in series and typically completes in 1-2s. If it overruns, the
 * work still finishes; Slack just shows a transient "request timed out"
 * warning to the user, which clears once the message is updated.
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  approveProposal,
  rejectProposal,
} from "@/lib/approval";
import {
  markSlackApproved,
  markSlackRejected,
  postSlackSentReply,
} from "@/lib/slack";
import { logEvent } from "@/lib/events";
import { PipelineError } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

function verifySlackSignature(args: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
}): boolean {
  if (!args.signature || !args.timestamp) return false;
  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(args.timestamp, 10)) > 300) return false;

  const baseString = `v0:${args.timestamp}:${args.rawBody}`;
  const expected = "v0=" + createHmac("sha256", args.secret).update(baseString).digest("hex");

  // Constant-time compare to avoid timing attacks
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.error("[slack/interactive] SLACK_SIGNING_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackSignature({ rawBody, signature, timestamp, secret })) {
    console.warn("[slack/interactive] signature verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Parse the payload — Slack sends application/x-www-form-urlencoded
  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  if (!payloadRaw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  let payload: SlackInteractivePayload;
  try {
    payload = JSON.parse(payloadRaw) as SlackInteractivePayload;
  } catch {
    return NextResponse.json({ error: "invalid payload JSON" }, { status: 400 });
  }

  const action = payload.actions?.[0];
  if (!action) {
    return NextResponse.json({ error: "no action in payload" }, { status: 400 });
  }

  const proposalId = action.value;
  const userName =
    payload.user?.name ??
    payload.user?.username ??
    payload.user?.id ??
    "unknown";

  try {
    if (action.action_id === "approve_proposal") {
      await approveProposal(proposalId, { source: "slack", user: userName });
      await markSlackApproved(proposalId, userName);
      await postSlackSentReply(proposalId);
      return NextResponse.json({ response_action: "clear" });
    }

    if (action.action_id === "reject_proposal") {
      await rejectProposal(proposalId, "Rejected from Slack", { source: "slack", user: userName });
      await markSlackRejected(proposalId, userName);
      return NextResponse.json({ response_action: "clear" });
    }

    // Unknown action — ignore
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[slack/interactive] handler failed:", message);
    await logEvent(proposalId, "error", { stage: "slack_interactive", message });
    if (err instanceof PipelineError) {
      // Surface the conflict back to the user as an ephemeral Slack message
      // (200 + replace_original=false + ephemeral=true would be ideal, but
      // the simplest safe response is to update the original message text).
      return NextResponse.json({
        replace_original: false,
        response_type: "ephemeral",
        text: `⚠️ Couldn't process: ${message}`,
      });
    }
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Types — minimal subset of Slack interactive payload
// ---------------------------------------------------------------------------

interface SlackInteractivePayload {
  type?: string;
  user?: { id?: string; name?: string; username?: string };
  actions?: Array<{
    action_id: string;
    block_id?: string;
    value: string;
    type: string;
  }>;
  response_url?: string;
  trigger_id?: string;
  channel?: { id: string };
  message?: { ts: string };
}
