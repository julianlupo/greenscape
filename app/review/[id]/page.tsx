"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, formatDate } from "@/lib/utils";
import { computeProposalCost, formatCostCents } from "@/lib/cost";
import type { ProposalEventRow, ProposalRow } from "@/lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; proposal: ProposalRow; events: ProposalEventRow[] };

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldRegenerate = searchParams.get("regenerate") === "1";

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [editedMarkdown, setEditedMarkdown] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<{
    stage: "starting" | "running" | "done" | "error";
    message?: string;
  } | null>(null);

  const fetchProposal = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/proposals/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load proposal");
      setState({ kind: "ready", proposal: json.proposal, events: json.events });
      setEditedQuantities({});
      setEditedMarkdown(null);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [params.id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Auto-trigger regenerate when arriving with ?regenerate=1 (from Slack reject flow)
  useEffect(() => {
    if (!shouldRegenerate || regenerating) return;
    let cancelled = false;
    (async () => {
      setRegenerating({ stage: "starting" });
      try {
        setRegenerating({ stage: "running" });
        const res = await fetch(`/api/proposals/${params.id}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "web" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Regenerate failed");
        if (cancelled) return;
        setRegenerating({ stage: "done" });
        // Strip ?regenerate=1 so a refresh doesn't re-trigger
        router.replace(`/review/${params.id}`);
        await fetchProposal();
      } catch (err) {
        if (cancelled) return;
        setRegenerating({
          stage: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldRegenerate, regenerating, params.id, router, fetchProposal]);

  if (regenerating && regenerating.stage !== "done") {
    return (
      <CenterMessage>
        {regenerating.stage === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-800 max-w-lg">
            <p className="font-semibold mb-1">Regenerate failed</p>
            <p className="mb-3">{regenerating.message}</p>
            <Link
              href={`/review/${params.id}`}
              className="text-emerald-700 hover:underline"
              onClick={() => setRegenerating(null)}
            >
              Back to review →
            </Link>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-3xl mb-4">🔄</p>
            <p className="text-lg font-semibold text-zinc-900">Re-analyzing with Claude</p>
            <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
              Re-extracting scope and re-drafting the proposal. This takes ~90 seconds.
              We&apos;ll post a fresh approval ping in Slack and reload this page when it&apos;s done.
            </p>
            <p className="mt-4 text-xs text-zinc-400">Don&apos;t close this tab.</p>
          </div>
        )}
      </CenterMessage>
    );
  }

  if (state.kind === "loading") {
    return <CenterMessage>Loading…</CenterMessage>;
  }
  if (state.kind === "error") {
    return <CenterMessage>Error: {state.message}</CenterMessage>;
  }

  const { proposal, events } = state;
  const isPending = proposal.status === "pending_approval";

  const lineItems = proposal.line_items ?? [];
  const liveLineItems = lineItems.map((li) => {
    const q = editedQuantities[li.pricing_item_id] ?? li.quantity;
    const line_total_cents = Math.round(li.unit_price_cents * q);
    return { ...li, quantity: q, line_total_cents };
  });
  const liveSubtotal = liveLineItems.reduce((sum, li) => sum + li.line_total_cents, 0);
  const dirty =
    Object.keys(editedQuantities).length > 0 ||
    (editedMarkdown !== null && editedMarkdown !== proposal.proposal_markdown);

  async function saveEdits() {
    setBusy("save");
    setActionError(null);
    try {
      const body: { line_items?: { pricing_item_id: string; quantity: number }[]; proposal_markdown?: string } = {};
      if (Object.keys(editedQuantities).length > 0) {
        body.line_items = lineItems.map((li) => ({
          pricing_item_id: li.pricing_item_id,
          quantity: editedQuantities[li.pricing_item_id] ?? li.quantity,
        }));
      }
      if (editedMarkdown !== null && editedMarkdown !== proposal.proposal_markdown) {
        body.proposal_markdown = editedMarkdown;
      }
      const res = await fetch(`/api/proposals/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Save failed");
      await fetchProposal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (dirty && !confirm("You have unsaved edits. Approve will use the saved version. Save first?")) {
      return;
    }
    setBusy("approve");
    setActionError(null);
    try {
      const res = await fetch(`/api/proposals/${params.id}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Approve failed");
      router.push(`/proposals/${params.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  async function reject() {
    const reason = prompt("Reject reason? (optional)");
    if (reason === null) return; // user hit cancel
    setBusy("reject");
    setActionError(null);
    try {
      const res = await fetch(`/api/proposals/${params.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Reject failed");
      await fetchProposal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
            &larr; Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {proposal.customer_name}
          </h1>
          <p className="text-sm text-zinc-500">
            {proposal.project_address} · {proposal.customer_email}
            {proposal.customer_phone ? ` · ${proposal.customer_phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={proposal.status} />
          {proposal.requires_render ? (
            <Badge variant="warning">Render queue triggered</Badge>
          ) : null}
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Live total</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCents(liveSubtotal)}</p>
            {dirty && liveSubtotal !== proposal.total_cents ? (
              <p className="text-xs text-amber-600">
                Saved: {formatCents(proposal.total_cents)} (unsaved edits)
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {isPending ? (
        <div className="sticky top-0 z-10 -mx-6 mb-6 border-b border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur flex items-center gap-2">
          <Button onClick={approveAndSend} disabled={busy !== null} size="lg">
            {busy === "approve" ? "Approving & sending…" : "Approve & Send"}
          </Button>
          <Button onClick={saveEdits} disabled={busy !== null || !dirty} variant="outline" size="lg">
            {busy === "save" ? "Saving…" : "Save edits"}
          </Button>
          <Button onClick={reject} disabled={busy !== null} variant="destructive" size="lg">
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </Button>
          {actionError ? (
            <span className="ml-3 text-sm text-red-700">{actionError}</span>
          ) : null}
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          This proposal is in status <strong>{proposal.status}</strong>. Review-and-edit is locked. View only.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Line items table */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              {liveLineItems.length === 0 ? (
                <p className="text-sm text-zinc-500">No line items yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 pr-4">Unit</th>
                        <th className="py-2 pr-4 text-right">Unit price</th>
                        <th className="py-2 pr-4 text-right">Qty</th>
                        <th className="py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveLineItems.map((li) => (
                        <tr key={li.pricing_item_id} className="border-b border-zinc-100 align-top">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{li.name}</div>
                            <div className="text-xs text-zinc-500">{li.category}</div>
                            {li.notes ? (
                              <div className="text-xs text-zinc-500 italic mt-1">{li.notes}</div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-zinc-600 text-xs">{li.unit}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatCents(li.unit_price_cents)}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            {isPending ? (
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                className="w-24 ml-auto text-right tabular-nums"
                                value={editedQuantities[li.pricing_item_id] ?? li.quantity}
                                onChange={(e) => {
                                  const q = parseFloat(e.target.value);
                                  setEditedQuantities((prev) => ({
                                    ...prev,
                                    [li.pricing_item_id]: isFinite(q) ? q : 0,
                                  }));
                                }}
                              />
                            ) : (
                              <span className="tabular-nums">{li.quantity}</span>
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium">
                            {formatCents(li.line_total_cents)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} className="py-3 pr-4 text-right text-sm font-medium">
                          Subtotal
                        </td>
                        <td className="py-3 text-right tabular-nums font-semibold">
                          {formatCents(liveSubtotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proposal preview */}
          <Card>
            <CardHeader>
              <CardTitle>Proposal preview (customer-facing)</CardTitle>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Textarea
                    rows={20}
                    className="font-mono text-xs"
                    value={editedMarkdown ?? proposal.proposal_markdown ?? ""}
                    onChange={(e) => setEditedMarkdown(e.target.value)}
                  />
                  <div className="prose prose-sm max-w-none rounded-md border border-zinc-200 bg-white p-4">
                    <ReactMarkdown>
                      {editedMarkdown ?? proposal.proposal_markdown ?? "*Empty.*"}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{proposal.proposal_markdown ?? "*Empty.*"}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <ScopePanel proposal={proposal} />
          <CostPanel events={events} />
          <InternalNotesPanel proposal={proposal} />
          <EventsPanel events={events} />
        </aside>
      </div>
    </main>
  );
}

function ScopePanel({ proposal }: { proposal: ProposalRow }) {
  const scope = proposal.extracted_scope;
  if (!scope) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">No extracted scope yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scope</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Project</p>
          <p>{scope.project_summary}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Complexity</p>
          <Badge
            variant={
              scope.estimated_complexity === "complex"
                ? "warning"
                : scope.estimated_complexity === "moderate"
                ? "secondary"
                : "success"
            }
          >
            {scope.estimated_complexity}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Features</p>
          <ul className="space-y-1.5">
            {scope.features.map((f, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{f.type}</span>
                {f.dimensions ? <span className="text-zinc-500"> · {f.dimensions}</span> : null}
                {f.materials.length > 0 ? (
                  <span className="text-zinc-500"> · {f.materials.join(", ")}</span>
                ) : null}
                {f.notes ? <span className="text-zinc-500 italic"> — {f.notes}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        {scope.open_questions.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-700 mb-1">Open questions</p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {scope.open_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {scope.red_flags.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-red-700 mb-1">Red flags</p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {scope.red_flags.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InternalNotesPanel({ proposal }: { proposal: ProposalRow }) {
  // Internal notes aren't stored separately yet — they're embedded in events
  // payload. Keeping the panel as a placeholder; in production we'd persist.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Site walk notes</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-xs text-zinc-700 leading-relaxed font-sans">
          {proposal.site_walk_notes}
        </pre>
      </CardContent>
    </Card>
  );
}

function CostPanel({ events }: { events: ProposalEventRow[] }) {
  const cost = computeProposalCost(events);
  if (cost.tokens_in === 0 && cost.tokens_out === 0) return null;

  const stageLabel: Record<string, string> = {
    extracted: "Scope extraction",
    drafted: "Proposal drafting",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-baseline justify-between border-b border-zinc-100 pb-2">
          <span className="text-zinc-500 uppercase tracking-wide">Total this proposal</span>
          <span className="text-lg font-semibold tabular-nums text-emerald-700">
            {formatCostCents(cost.cents)}
          </span>
        </div>
        <div className="space-y-1.5">
          {cost.per_event.map((e, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <span className="text-zinc-700">{stageLabel[e.event_type] ?? e.event_type}</span>
              <span className="text-zinc-500 tabular-nums">
                {e.tokens_in.toLocaleString()} in · {e.tokens_out.toLocaleString()} out
                {e.attempts > 1 ? <span className="text-amber-600"> · {e.attempts}× retried</span> : null}
              </span>
              <span className="text-zinc-900 tabular-nums w-16 text-right">{formatCostCents(e.cents)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-100 pt-2 text-zinc-500">
          Sonnet 4.6 · $3 / $15 per Mtok in/out
        </div>
      </CardContent>
    </Card>
  );
}

function EventsPanel({ events }: { events: ProposalEventRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-zinc-500">No events.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {events.slice(0, 12).map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <span className="text-zinc-400 tabular-nums shrink-0">
                  {formatDate(e.created_at)}
                </span>
                <span className="font-mono text-zinc-700">{e.event_type}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 text-zinc-600">
      {children}
    </main>
  );
}
