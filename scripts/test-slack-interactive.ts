/**
 * Simulates a Slack button click against /api/slack/interactive.
 *
 * Usage: tsx scripts/test-slack-interactive.ts <proposal_id> [approve|reject]
 *
 * Builds a payload identical to what Slack POSTs when a user clicks a
 * button, signs it with SLACK_SIGNING_SECRET, and hits the production
 * endpoint. If this succeeds, the backend is fine and the issue is on
 * the Slack-app-config side.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHmac } from "node:crypto";

async function main() {
  const proposalId = process.argv[2];
  const action = (process.argv[3] ?? "approve") as "approve" | "reject";
  if (!proposalId) {
    console.error("Usage: tsx scripts/test-slack-interactive.ts <proposal_id> [approve|reject]");
    process.exit(1);
  }

  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.error("SLACK_SIGNING_SECRET not set in .env.local");
    process.exit(1);
  }

  const url =
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://greenscape-psi.vercel.app") +
    "/api/slack/interactive";

  const payload = {
    type: "block_actions",
    user: { id: "U_TEST", name: "test-script", username: "test-script" },
    api_app_id: "A_TEST",
    token: "verification-token",
    container: { type: "message" },
    trigger_id: "trigger.test",
    team: { id: "T0B16TWG405" },
    channel: { id: "C0B1DTXL2FN" },
    message: { ts: "0.0" },
    response_url: "https://hooks.slack.com/actions/test",
    actions: [
      {
        action_id: action === "approve" ? "approve_proposal" : "reject_proposal",
        block_id: `proposal_actions_${proposalId}`,
        text: { type: "plain_text", text: "Approve" },
        value: proposalId,
        type: "button",
        action_ts: String(Date.now() / 1000),
      },
    ],
  };

  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const sigBase = `v0:${ts}:${body}`;
  const signature = "v0=" + createHmac("sha256", secret).update(sigBase).digest("hex");

  console.log(`POST ${url}`);
  console.log(`  action: ${action}`);
  console.log(`  proposal: ${proposalId}`);
  console.log(`  ts: ${ts}`);
  console.log(`  signature: ${signature.slice(0, 24)}...`);
  console.log("");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": ts,
    },
    body,
  });

  const text = await res.text();
  console.log(`Response: ${res.status}`);
  console.log(text || "(empty body)");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
