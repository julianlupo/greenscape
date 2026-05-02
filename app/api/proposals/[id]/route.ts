import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ReviewEditSchema } from "@/lib/schemas";
import { resolvePicksToLineItems } from "@/lib/pricing";
import { logEvent } from "@/lib/events";
import type { ProposalRow } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/proposals/[id]
 * Returns the proposal row + recent events.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid proposal id" }, { status: 400 });
  }

  const sb = supabase();
  const [proposalRes, eventsRes] = await Promise.all([
    sb.from("proposals").select("*").eq("id", id).single(),
    sb
      .from("proposal_events")
      .select("id, event_type, payload, created_at")
      .eq("proposal_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (proposalRes.error || !proposalRes.data) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  return NextResponse.json({
    proposal: proposalRes.data as ProposalRow,
    events: eventsRes.data ?? [],
  });
}

/**
 * PATCH /api/proposals/[id]
 * Save Marcus's review edits — line item quantity changes and/or proposal markdown.
 * Only legal while status is `pending_approval`.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Invalid proposal id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ReviewEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sb = supabase();
  const { data: proposal, error: fetchErr } = await sb
    .from("proposals")
    .select("*")
    .eq("id", params.id)
    .single();
  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if ((proposal as ProposalRow).status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot edit: proposal is in status '${(proposal as ProposalRow).status}'` },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {};

  if (parsed.data.line_items) {
    // Re-resolve to recompute totals server-side. The LLM never edits totals.
    const picks = parsed.data.line_items.map((li) => {
      const existing = ((proposal as ProposalRow).line_items ?? []).find(
        (x) => x.pricing_item_id === li.pricing_item_id
      );
      return {
        pricing_item_id: li.pricing_item_id,
        quantity: li.quantity,
        notes: existing?.notes ?? "",
      };
    });
    const { line_items, subtotal_cents, missing_ids } = await resolvePicksToLineItems(picks);
    if (missing_ids.length > 0) {
      return NextResponse.json(
        { error: `Unknown pricing_item_ids: ${missing_ids.join(", ")}` },
        { status: 400 }
      );
    }
    update.line_items = line_items;
    update.subtotal_cents = subtotal_cents;
    update.total_cents = subtotal_cents;
  }

  if (parsed.data.proposal_markdown !== undefined) {
    update.proposal_markdown = parsed.data.proposal_markdown;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { data: updated, error: updateErr } = await sb
    .from("proposals")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logEvent(params.id, "drafted", { source: "marcus_edit", fields: Object.keys(update) });

  return NextResponse.json({ ok: true, proposal: updated });
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
