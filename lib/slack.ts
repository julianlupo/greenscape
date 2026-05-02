/**
 * Slack incoming-webhook sender for the approval ping.
 *
 * If SLACK_WEBHOOK_URL is unset we log and return — the rest of the pipeline
 * still works in dev without Slack configured. Marcus can review proposals
 * directly from /dashboard.
 *
 * Why incoming webhooks vs. a real Slack app: 5-min setup, no OAuth, no app
 * surface. The downside is no thread updates without storing message_ts —
 * which we do, because the approve/reject endpoints use it later to post a
 * "✅ Sent to <Customer>" follow-up. Threading via incoming webhooks is a
 * single POST with `thread_ts`.
 */
import { supabase } from "./supabase";
import { loadProposal } from "./pipeline";
import { logEvent } from "./events";
import { formatCents } from "./utils";

interface SlackResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

async function postWebhook(payload: Record<string, unknown>): Promise<SlackResponse> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    return { ok: false, error: "SLACK_WEBHOOK_URL not set" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  // Standard incoming webhooks return "ok" as text on success, with no JSON body
  // and no message_ts. (Real Slack apps with chat.postMessage return JSON with ts.)
  // We accept either shape.
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Slack returned ${res.status}: ${text}` };
  if (text === "ok") return { ok: true };
  try {
    const json = JSON.parse(text) as { ok?: boolean; ts?: string; error?: string };
    return { ok: json.ok ?? true, ts: json.ts, error: json.error };
  } catch {
    return { ok: true };
  }
}

export async function postSlackApprovalPing(
  proposalId: string,
  confidence: "high" | "medium" | "low" = "medium"
): Promise<void> {
  const proposal = await loadProposal(proposalId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const reviewUrl = `${appUrl}/review/${proposalId}`;

  const summary = proposal.extracted_scope?.project_summary ?? proposal.project_address;

  const total = formatCents(proposal.total_cents);

  const result = await postWebhook({
    text: `🪨 New quote draft for ${proposal.customer_name} — ${total}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `🪨 *New quote draft for ${proposal.customer_name}*`,
            `*Project:* ${summary}`,
            `*Total:* ${total}`,
            `*Confidence:* ${confidence}`,
            proposal.requires_render ? "⚠️ Over $30k — render queue triggered" : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review & Approve →" },
            url: reviewUrl,
            style: "primary",
          },
        ],
      },
    ],
  });

  if (!result.ok) {
    throw new Error(`Slack post failed: ${result.error ?? "unknown"}`);
  }

  if (result.ts) {
    await supabase().from("proposals").update({ slack_message_ts: result.ts }).eq("id", proposalId);
  }
  await logEvent(proposalId, "slack_posted", { ts: result.ts ?? null });
}

export async function postSlackSentReply(proposalId: string): Promise<void> {
  const proposal = await loadProposal(proposalId);
  if (!proposal.slack_message_ts) {
    // No thread to reply to (incoming webhooks don't return ts) — post fresh.
    await postWebhook({
      text: `✅ Sent to ${proposal.customer_name}`,
    });
    return;
  }
  await postWebhook({
    text: `✅ Sent to ${proposal.customer_name}`,
    thread_ts: proposal.slack_message_ts,
  });
}

