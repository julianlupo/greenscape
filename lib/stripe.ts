/**
 * Stripe payment link generation — 50% deposit on approve.
 *
 * Uses Stripe Payment Links (test-mode in the demo). Each link has its own
 * inline price + product, so we don't need a Products catalog in Stripe.
 *
 * Why payment links and not Checkout sessions: payment links are URLs that
 * survive being shared (Slack, email) without an active session. Checkout
 * Sessions expire and require a server callback to keep the URL alive.
 *
 * Failure mode: if STRIPE_SECRET_KEY is missing or Stripe rejects the
 * request, we throw — the approve route catches and logs, then continues
 * without a payment link. Marcus can re-approve to retry.
 */
import Stripe from "stripe";
import type { ProposalRow } from "./types";

let _stripe: Stripe | null = null;

function client(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

export async function createDepositPaymentLink(proposal: ProposalRow): Promise<string> {
  const total_cents = proposal.total_cents;
  if (total_cents <= 0) {
    throw new Error("Cannot create payment link: total is zero");
  }

  // 50% deposit, rounded to nearest cent.
  const deposit_cents = Math.round(total_cents / 2);

  const stripe = client();

  const link = await stripe.paymentLinks.create({
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: deposit_cents,
          product_data: {
            name: `Greenscape Pro — Deposit (${proposal.customer_name})`,
            description: `50% deposit for project at ${proposal.project_address}.`,
          },
        },
      },
    ],
    metadata: {
      proposal_id: proposal.id,
      customer_name: proposal.customer_name,
      project_address: proposal.project_address,
      total_cents: String(total_cents),
    },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: {
        custom_message:
          "Deposit received — Marcus will be in touch within 24 hours to schedule the project kickoff.",
      },
    },
  });

  return link.url;
}
