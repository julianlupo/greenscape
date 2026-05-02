import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents, formatDate } from "@/lib/utils";
import { computeProposalCost, formatCostCents } from "@/lib/cost";
import type { ProposalEventRow, ProposalRow, ProposalStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProposalReadOnlyPage({ params }: { params: { id: string } }) {
  const sb = supabase();
  const [{ data: pData, error }, { data: eData }] = await Promise.all([
    sb.from("proposals").select("*").eq("id", params.id).single(),
    sb
      .from("proposal_events")
      .select("id, event_type, payload, created_at")
      .eq("proposal_id", params.id),
  ]);
  if (error || !pData) notFound();
  const proposal = pData as ProposalRow;
  const events = (eData ?? []) as ProposalEventRow[];
  const cost = computeProposalCost(events);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
            &larr; Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{proposal.customer_name}</h1>
          <p className="text-sm text-zinc-500">
            {proposal.project_address} · {proposal.customer_email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={proposal.status} />
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCents(proposal.total_cents)}
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Created" value={formatDate(proposal.created_at)} />
        <Stat label="Approved" value={proposal.approved_at ? formatDate(proposal.approved_at) : "—"} />
        <Stat label="Sent" value={proposal.sent_at ? formatDate(proposal.sent_at) : "—"} />
        <Stat
          label="Stripe link"
          value={
            proposal.stripe_payment_link ? (
              <Link
                href={proposal.stripe_payment_link}
                target="_blank"
                rel="noreferrer noopener"
                className="text-emerald-700 hover:underline"
              >
                Open ↗
              </Link>
            ) : (
              "—"
            )
          }
        />
        <Stat
          label="LLM cost"
          value={
            cost.cents > 0 ? (
              <span title={`${cost.tokens_in.toLocaleString()} in / ${cost.tokens_out.toLocaleString()} out tok · Sonnet 4.6`}>
                {formatCostCents(cost.cents)}
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Proposal</CardTitle>
          </CardHeader>
          <CardContent>
            {proposal.proposal_markdown ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{proposal.proposal_markdown}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No proposal content.</p>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              {(proposal.line_items?.length ?? 0) === 0 ? (
                <p className="text-sm text-zinc-500">No line items.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {proposal.line_items!.map((li) => (
                    <li key={li.pricing_item_id} className="flex justify-between gap-2">
                      <span>
                        <span className="font-medium">{li.name}</span>
                        <span className="text-zinc-500">
                          {" "}
                          · {li.quantity} {li.unit}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatCents(li.line_total_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const variant: "default" | "secondary" | "success" | "warning" | "destructive" =
    status === "sent" || status === "approved"
      ? "success"
      : status === "rejected" || status === "error"
      ? "destructive"
      : status === "pending_approval"
      ? "warning"
      : "secondary";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}
