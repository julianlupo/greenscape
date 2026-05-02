import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents, formatDate } from "@/lib/utils";
import type { ProposalRow, ProposalStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let proposals: ProposalRow[] = [];
  let loadError: string | null = null;
  try {
    const { data, error } = await supabase()
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    proposals = (data ?? []) as ProposalRow[];
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            &larr; Home
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Quote dashboard</h1>
          <p className="text-sm text-zinc-500">
            Every site walk turned into a proposal. Newest first.
          </p>
        </div>
        <Link href="/intake" className={buttonVariants({ size: "lg" })}>
          + New site walk
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Proposals ({proposals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Could not load proposals: {loadError}
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
              No proposals yet.{" "}
              <Link href="/intake" className="text-emerald-700 hover:underline">
                Run your first site walk →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Project</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{p.customer_name}</div>
                        <div className="text-xs text-zinc-500">{p.customer_email}</div>
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">{p.project_address}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCents(p.total_cents)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-500">{formatDate(p.created_at)}</td>
                      <td className="py-3 text-right">
                        <Link
                          href={
                            p.status === "pending_approval"
                              ? `/review/${p.id}`
                              : `/proposals/${p.id}`
                          }
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          {p.status === "pending_approval" ? "Review" : "View"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
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
