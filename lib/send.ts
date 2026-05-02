/**
 * Customer email send via Resend.
 *
 * Demo-mode behavior:
 *   - FROM: "Greenscape Pro <onboarding@resend.dev>" (Resend's sandbox sender;
 *     no verified domain required for the take-home)
 *   - TO: the customer email from the proposal
 *   - BCC: julian@r3ply.ai (so every send is auditable from the inbox, not
 *     just the proposal_events log)
 *   - Body: HTML rendering of proposal_markdown + a CTA button to the Stripe
 *     deposit link, plus a plain-text fallback.
 *
 * If RESEND_API_KEY is unset we fall back to the previous mock (logs the
 * payload to proposal_events and returns), so local dev without Resend keeps
 * working.
 */
import { Resend } from "resend";
import { marked } from "marked";
import { logEvent } from "./events";
import { formatCents } from "./utils";
import type { ProposalRow } from "./types";

const FROM = "Greenscape Pro <onboarding@resend.dev>";
// Demo-mode safety: Resend's free tier without a verified domain only allows
// sending to the account owner's own email. We honor that by always routing
// to DEMO_INBOX, with the intended customer email surfaced in the subject and
// a banner at the top of the body. Once a domain is verified at
// resend.com/domains, set RESEND_DEMO_INBOX="" (empty) to deliver to the
// real customer email instead.
const DEMO_INBOX = process.env.RESEND_DEMO_INBOX ?? "julian@r3ply.ai";

let _resend: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (_resend) return _resend;
  _resend = new Resend(key);
  return _resend;
}

export async function sendProposalEmail(proposal: ProposalRow): Promise<void> {
  const customerName = firstName(proposal.customer_name);
  const total = formatCents(proposal.total_cents);
  const deposit = formatCents(Math.round(proposal.total_cents / 2));
  const proposalMd = proposal.proposal_markdown ?? "(empty proposal)";

  const isDemoRouted = Boolean(DEMO_INBOX);
  const actualTo = isDemoRouted ? DEMO_INBOX : proposal.customer_email;
  const subject = isDemoRouted
    ? `[DEMO → would have sent to ${proposal.customer_email}] Your Greenscape Pro proposal — ${proposal.project_address}`
    : `Your Greenscape Pro proposal — ${proposal.project_address}`;

  const demoBanner = isDemoRouted
    ? `🎬 DEMO MODE — this email was rerouted to ${DEMO_INBOX} for safety. Intended recipient: ${proposal.customer_email}. (Resend free tier; verify a domain to deliver to real customers.)\n\n---\n\n`
    : "";

  const intro = `${demoBanner}Hi ${customerName},\n\nThanks for having us out. Your proposal is below.`;
  const closing = proposal.stripe_payment_link
    ? `Ready to lock in your spot? The 50% deposit is **${deposit}** — secure deposit link: ${proposal.stripe_payment_link}\n\nOnce that's in, we get on the schedule.`
    : `I'll send the deposit link separately once it's ready.`;
  const sigOff = `— Marcus\nGreenscape Pro\nPhoenix, AZ`;

  const fullMarkdown = [intro, "---", proposalMd, "---", closing, "", sigOff].join("\n\n");

  const resend = client();

  // No API key → fall back to mock-only behavior (preserves the original
  // mocked-send guarantee for local dev / unconfigured environments).
  if (!resend) {
    await logEvent(proposal.id, "email_mocked", {
      to: proposal.customer_email,
      subject,
      body_chars: fullMarkdown.length,
      body_preview: fullMarkdown.slice(0, 400),
      has_payment_link: Boolean(proposal.stripe_payment_link),
      reason: "RESEND_API_KEY not set",
    });
    return;
  }

  const html = renderHtmlEmail({
    customerName,
    proposalHtml: await marked.parse(proposalMd, { gfm: true, breaks: false }),
    total,
    deposit,
    paymentLink: proposal.stripe_payment_link ?? null,
    demoBanner: isDemoRouted
      ? `Demo mode — would normally have sent to ${proposal.customer_email}.`
      : null,
  });

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: [actualTo],
      subject,
      html,
      text: fullMarkdown,
    });

    if (result.error) {
      throw new Error(result.error.message ?? "unknown Resend error");
    }

    await logEvent(proposal.id, "email_mocked", {
      intended_to: proposal.customer_email,
      actual_to: actualTo,
      demo_routed: isDemoRouted,
      subject,
      resend_id: result.data?.id ?? null,
      has_payment_link: Boolean(proposal.stripe_payment_link),
      sent_via: "resend",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent(proposal.id, "error", {
      stage: "email_send",
      message,
      intended_to: proposal.customer_email,
      actual_to: actualTo,
    });
    // Don't fail the approve flow on email failure — the proposal is still
    // approved + linked to a payment link. Marcus can manually resend.
    console.warn(`[send] resend failed: ${message}`);
  }
}

function renderHtmlEmail(args: {
  customerName: string;
  proposalHtml: string;
  total: string;
  deposit: string;
  paymentLink: string | null;
  demoBanner: string | null;
}): string {
  const demoBlock = args.demoBanner
    ? `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #78350f;">
         🎬 <strong>Demo mode:</strong> ${escapeHtml(args.demoBanner)}
       </div>`
    : "";
  // Inline-styled HTML email — minimal CSS to avoid email-client weirdness.
  const cta = args.paymentLink
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
        <tr>
          <td style="background-color: #047857; border-radius: 6px;">
            <a href="${escapeHtml(args.paymentLink)}"
               style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-family: -apple-system, sans-serif; font-size: 15px;">
              Secure your project — pay ${escapeHtml(args.deposit)} deposit →
            </a>
          </td>
        </tr>
      </table>
      <p style="color: #71717a; font-size: 13px; margin-top: 0;">
        Total project: ${escapeHtml(args.total)}. Deposit is 50%, balance split 40% mid-project and 10% on completion.
      </p>
      `
    : `<p style="color: #71717a; font-size: 13px;">I'll send the deposit link separately once it's ready.</p>`;

  return `<!doctype html>
<html>
  <body style="margin: 0; padding: 24px; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; line-height: 1.55;">
    <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e4e4e7;">
      ${demoBlock}
      <p style="margin-top: 0;">Hi ${escapeHtml(args.customerName)},</p>
      <p>Thanks for having us out. Your proposal is below — let me know if anything looks off.</p>
      <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <div style="font-size: 15px;">${args.proposalHtml}</div>
      <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      ${cta}
      <p style="margin-bottom: 0; color: #52525b;">— Marcus<br/>Greenscape Pro<br/>Phoenix, AZ</p>
    </div>
    <p style="text-align: center; color: #a1a1aa; font-size: 11px; margin-top: 16px;">
      Greenscape Pro · Phoenix, AZ
    </p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}
