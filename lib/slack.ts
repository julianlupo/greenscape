/**
 * Slack integration — two modes:
 *
 *   1. **Bot Token mode** (preferred): if SLACK_BOT_TOKEN is set, we post via
 *      chat.postMessage with rich Block Kit messages including interactive
 *      Approve / Reject buttons. The buttons hit /api/slack/interactive.
 *
 *   2. **Incoming webhook fallback**: if only SLACK_WEBHOOK_URL is set, we
 *      post a plain message with a link to the web review page. No buttons.
 *
 *   3. **Unconfigured**: log a `slack_failed` event and continue (Slack is
 *      non-blocking — Marcus can still use the web review page).
 */
import { supabase } from "./supabase";
import { loadProposal } from "./pipeline";
import { logEvent } from "./events";
import { formatCents } from "./utils";
import type { ProposalRow, SelectedLineItem } from "./types";

const BOT_TOKEN = () => process.env.SLACK_BOT_TOKEN;
const WEBHOOK_URL = () => process.env.SLACK_WEBHOOK_URL;
const CHANNEL_ID = () => process.env.SLACK_CHANNEL_ID; // required for bot mode

interface SlackBlock {
  // Loose typing — Block Kit has many shapes; we only build the ones we use.
  [key: string]: unknown;
}

async function postToSlack(args: {
  text: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
}): Promise<{ channel: string | null; ts: string | null }> {
  const token = BOT_TOKEN();
  const channel = CHANNEL_ID();

  if (token && channel) {
    // Bot Token mode
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text: args.text,
        blocks: args.blocks,
        thread_ts: args.thread_ts,
      }),
    });
    const json = (await res.json()) as { ok: boolean; ts?: string; channel?: string; error?: string };
    if (!json.ok) throw new Error(`Slack chat.postMessage failed: ${json.error}`);
    return { channel: json.channel ?? channel, ts: json.ts ?? null };
  }

  // Webhook fallback
  const url = WEBHOOK_URL();
  if (!url) {
    throw new Error("Slack not configured (set SLACK_BOT_TOKEN+SLACK_CHANNEL_ID or SLACK_WEBHOOK_URL)");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: args.text, blocks: args.blocks, thread_ts: args.thread_ts }),
  });
  const text = await res.text();
  if (!res.ok || (text !== "ok" && !text.startsWith("{"))) {
    throw new Error(`Slack webhook failed: ${res.status} ${text}`);
  }
  return { channel: null, ts: null };
}

async function updateSlackMessage(args: {
  channel: string;
  ts: string;
  text: string;
  blocks: SlackBlock[];
}): Promise<void> {
  const token = BOT_TOKEN();
  if (!token) return; // can't update via webhook
  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: args.channel, ts: args.ts, text: args.text, blocks: args.blocks }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) throw new Error(`Slack chat.update failed: ${json.error}`);
}

// ---------------------------------------------------------------------------
// Block Kit builders
// ---------------------------------------------------------------------------

function buildApprovalBlocks(
  proposal: ProposalRow,
  confidence: "high" | "medium" | "low"
): SlackBlock[] {
  const total = formatCents(proposal.total_cents);
  const deposit = formatCents(Math.round(proposal.total_cents / 2));
  const summary = proposal.extracted_scope?.project_summary ?? proposal.project_address;
  const complexity = proposal.extracted_scope?.estimated_complexity ?? "unknown";
  const confidenceEmoji = confidence === "high" ? "🟢" : confidence === "medium" ? "🟡" : "🔴";
  const features = proposal.extracted_scope?.features ?? [];
  const openQs = proposal.extracted_scope?.open_questions ?? [];
  const redFlags = proposal.extracted_scope?.red_flags ?? [];
  const lineItems = proposal.line_items ?? [];

  const featureBlock =
    features.length > 0
      ? `*Features:* ${features.map((f) => f.type).join(", ")}`
      : "";

  // Slack mrkdwn doesn't support tables. We build a fixed-width-ish list
  // using backticks + alignment via spaces.
  const lineItemsText = formatLineItemsForSlack(lineItems);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🪨 Quote draft — ${proposal.customer_name}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Project:*\n${summary}` },
        { type: "mrkdwn", text: `*Address:*\n${proposal.project_address}` },
        { type: "mrkdwn", text: `*Total:*\n*${total}*` },
        { type: "mrkdwn", text: `*Deposit (50%):*\n${deposit}` },
        { type: "mrkdwn", text: `*Complexity:*\n${complexity}` },
        { type: "mrkdwn", text: `*Confidence:*\n${confidenceEmoji} ${confidence}` },
      ],
    },
  ];

  if (featureBlock) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: featureBlock } });
  }

  if (proposal.requires_render) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "⚠️ *Over $30k — render queue triggered*" },
    });
  }

  if (openQs.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Open questions:*\n${openQs.map((q) => `• ${q}`).join("\n")}`,
      },
    });
  }

  if (redFlags.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🚩 Red flags:*\n${redFlags.map((r) => `• ${r}`).join("\n")}`,
      },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*Line items*\n\`\`\`${lineItemsText}\`\`\`` },
  });
  blocks.push({ type: "divider" });

  blocks.push({
    type: "actions",
    block_id: `proposal_actions_${proposal.id}`,
    elements: [
      {
        type: "button",
        action_id: "approve_proposal",
        text: { type: "plain_text", text: "✅ Approve & Send", emoji: true },
        style: "primary",
        value: proposal.id,
        confirm: {
          title: { type: "plain_text", text: "Approve and send to customer?" },
          text: {
            type: "mrkdwn",
            text: `This will email *${proposal.customer_name}* (${proposal.customer_email}) the proposal + a Stripe deposit link for *${deposit}*.`,
          },
          confirm: { type: "plain_text", text: "Send it" },
          deny: { type: "plain_text", text: "Wait" },
        },
      },
      {
        type: "button",
        action_id: "reject_proposal",
        text: { type: "plain_text", text: "❌ Reject", emoji: true },
        style: "danger",
        value: proposal.id,
      },
      {
        type: "button",
        action_id: "view_in_browser",
        text: { type: "plain_text", text: "Open in browser", emoji: true },
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/review/${proposal.id}`,
      },
    ],
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Proposal \`${proposal.id.slice(0, 8)}\` · ${lineItems.length} line items · created just now`,
      },
    ],
  });

  return blocks;
}

function formatLineItemsForSlack(items: SelectedLineItem[]): string {
  if (items.length === 0) return "(no items)";
  const rows = items.map((li) => {
    const name = truncate(li.name, 38);
    const qty = formatQty(li.quantity);
    const lineTotal = formatCents(li.line_total_cents);
    return `${name.padEnd(40)} ${qty.padStart(6)} ${li.unit.padEnd(10)} ${lineTotal.padStart(10)}`;
  });
  const header = "Item".padEnd(40) + " " + "Qty".padStart(6) + " " + "Unit".padEnd(10) + " " + "Total".padStart(10);
  const sep = "─".repeat(header.length);
  return [header, sep, ...rows].join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function postSlackApprovalPing(
  proposalId: string,
  confidence: "high" | "medium" | "low" = "medium"
): Promise<void> {
  const proposal = await loadProposal(proposalId);
  const blocks = buildApprovalBlocks(proposal, confidence);
  const fallbackText = `🪨 New quote draft for ${proposal.customer_name} — ${formatCents(proposal.total_cents)}`;

  const result = await postToSlack({ text: fallbackText, blocks });

  if (result.ts) {
    await supabase()
      .from("proposals")
      .update({ slack_message_ts: result.ts, slack_channel_id: result.channel })
      .eq("id", proposalId);
  }
  await logEvent(proposalId, "slack_posted", { ts: result.ts ?? null, channel: result.channel ?? null });
}

export async function postSlackSentReply(proposalId: string): Promise<void> {
  const proposal = await loadProposal(proposalId);
  const stripeText = proposal.stripe_payment_link
    ? `\nDeposit link: ${proposal.stripe_payment_link}`
    : "";
  await postToSlack({
    text: `✅ Sent to ${proposal.customer_name}${stripeText}`,
    thread_ts: proposal.slack_message_ts ?? undefined,
  });
}

/**
 * Update the original Slack approval message after Marcus clicks a button.
 * Replaces buttons with a status row so it can't be re-clicked.
 */
export async function markSlackApproved(proposalId: string, by: string): Promise<void> {
  const proposal = await loadProposal(proposalId);
  if (!proposal.slack_message_ts || !proposal.slack_channel_id) return;
  const blocks = buildClosedBlocks(proposal, "approved", by);
  await updateSlackMessage({
    channel: proposal.slack_channel_id,
    ts: proposal.slack_message_ts,
    text: `✅ Approved & sent — ${proposal.customer_name}`,
    blocks,
  });
}

export async function markSlackRejected(proposalId: string, by: string): Promise<void> {
  const proposal = await loadProposal(proposalId);
  if (!proposal.slack_message_ts || !proposal.slack_channel_id) return;
  const blocks = buildClosedBlocks(proposal, "rejected", by);
  await updateSlackMessage({
    channel: proposal.slack_channel_id,
    ts: proposal.slack_message_ts,
    text: `❌ Rejected — ${proposal.customer_name}`,
    blocks,
  });
}

function buildClosedBlocks(
  proposal: ProposalRow,
  outcome: "approved" | "rejected",
  by: string
): SlackBlock[] {
  const total = formatCents(proposal.total_cents);
  const summary = proposal.extracted_scope?.project_summary ?? proposal.project_address;
  const emoji = outcome === "approved" ? "✅" : "❌";
  const verb = outcome === "approved" ? "Approved & sent" : "Rejected";
  const stripeLine =
    outcome === "approved" && proposal.stripe_payment_link
      ? `\n*Deposit link:* ${proposal.stripe_payment_link}`
      : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${verb} — ${proposal.customer_name}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Project:*\n${summary}` },
        { type: "mrkdwn", text: `*Total:*\n*${total}*` },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${emoji} ${verb} by *${by}* at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|just now>${stripeLine}`,
        },
      ],
    },
  ];

  if (outcome === "rejected") {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*What's next?*" },
    });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "regenerate_open",
          text: { type: "plain_text", text: "🔄 Re-analyze with Claude", emoji: true },
          style: "primary",
          url: `${appUrl}/review/${proposal.id}?regenerate=1`,
        },
        {
          type: "button",
          action_id: "edit_on_web",
          text: { type: "plain_text", text: "✏️ Edit on web", emoji: true },
          url: `${appUrl}/review/${proposal.id}`,
        },
        {
          type: "button",
          action_id: "leave_rejected",
          text: { type: "plain_text", text: "Leave rejected", emoji: true },
          url: `${appUrl}/proposals/${proposal.id}`,
        },
      ],
    });
  } else {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "view_in_browser",
          text: { type: "plain_text", text: "Open in browser", emoji: true },
          url: `${appUrl}/proposals/${proposal.id}`,
        },
      ],
    });
  }

  return blocks;
}
