/**
 * Mocked customer email send.
 *
 * In production this would route via SendGrid (or GHL email API, since
 * Greenscape's CRM lives there). Mocked here to avoid the risk of an
 * accidental real-customer send during the take-home demo. The full email
 * payload is logged to proposal_events so reviewers can see exactly what
 * would have gone out.
 */
import { logEvent } from "./events";
import type { ProposalRow } from "./types";

export async function sendProposalEmail(proposal: ProposalRow): Promise<void> {
  const subject = `Your Greenscape Pro proposal — ${proposal.project_address}`;

  const body = [
    `Hi ${firstName(proposal.customer_name)},`,
    "",
    "Thanks for having us out. Your proposal is below — full PDF attached in the customer portal.",
    "",
    "---",
    proposal.proposal_markdown ?? "(empty proposal)",
    "---",
    "",
    proposal.stripe_payment_link
      ? `When you're ready to lock in your spot, here's the deposit link (50%): ${proposal.stripe_payment_link}`
      : "I'll send the deposit link separately once it's ready.",
    "",
    "— Marcus",
    "Greenscape Pro",
  ].join("\n");

  await logEvent(proposal.id, "email_mocked", {
    to: proposal.customer_email,
    subject,
    body_chars: body.length,
    body_preview: body.slice(0, 400),
    has_payment_link: Boolean(proposal.stripe_payment_link),
  });
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}
