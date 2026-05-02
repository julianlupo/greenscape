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
    lineItems: proposal.line_items ?? [],
    subtotalCents: proposal.subtotal_cents,
    totalCents: proposal.total_cents,
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
  lineItems: ReadonlyArray<{
    name: string;
    category: string;
    unit: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
    notes: string;
  }>;
  subtotalCents: number;
  totalCents: number;
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

  const lineItemsTable =
    args.lineItems.length === 0
      ? ""
      : `
      <h3 style="margin-top: 32px; margin-bottom: 12px; font-size: 16px; color: #18181b;">Itemized line items</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background-color: #fafafa; text-align: left;">
            <th style="padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #52525b;">Item</th>
            <th style="padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #52525b; text-align: right;">Qty</th>
            <th style="padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #52525b;">Unit</th>
            <th style="padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #52525b; text-align: right;">Unit price</th>
            <th style="padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-weight: 600; color: #52525b; text-align: right;">Line total</th>
          </tr>
        </thead>
        <tbody>
          ${args.lineItems
            .map(
              (li) => `
            <tr>
              <td style="padding: 10px 8px; border-bottom: 1px solid #f4f4f5;">
                <div style="color: #18181b; font-weight: 500;">${escapeHtml(li.name)}</div>
                ${li.notes ? `<div style="color: #71717a; font-size: 12px; margin-top: 2px; font-style: italic;">${escapeHtml(li.notes)}</div>` : ""}
              </td>
              <td style="padding: 10px 8px; border-bottom: 1px solid #f4f4f5; text-align: right; color: #18181b; font-variant-numeric: tabular-nums;">${formatQty(li.quantity)}</td>
              <td style="padding: 10px 8px; border-bottom: 1px solid #f4f4f5; color: #71717a; font-size: 12px;">${escapeHtml(li.unit)}</td>
              <td style="padding: 10px 8px; border-bottom: 1px solid #f4f4f5; text-align: right; color: #52525b; font-variant-numeric: tabular-nums;">${escapeHtml(formatCents(li.unit_price_cents))}</td>
              <td style="padding: 10px 8px; border-bottom: 1px solid #f4f4f5; text-align: right; color: #18181b; font-weight: 500; font-variant-numeric: tabular-nums;">${escapeHtml(formatCents(li.line_total_cents))}</td>
            </tr>`
            )
            .join("")}
          <tr>
            <td colspan="4" style="padding: 14px 8px 6px; text-align: right; font-weight: 600; color: #18181b;">Subtotal</td>
            <td style="padding: 14px 8px 6px; text-align: right; font-weight: 600; color: #18181b; font-variant-numeric: tabular-nums;">${escapeHtml(formatCents(args.subtotalCents))}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding: 6px 8px; text-align: right; font-weight: 700; color: #18181b; font-size: 14px;">Total</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #047857; font-size: 16px; font-variant-numeric: tabular-nums;">${escapeHtml(formatCents(args.totalCents))}</td>
          </tr>
        </tbody>
      </table>`;
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
      ${lineItemsTable}
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

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
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
