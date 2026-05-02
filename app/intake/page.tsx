"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE = `Met with the Hendersons at 4421 E Stanford Dr. Backyard re-do. They want:
- 600 sqft travertine patio off the slider, French pattern, charcoal grout
- 12x14 cedar pergola over the patio, sealed clear
- Linear gas fire pit on the south end of the patio, 60in, glass media
- Pondless waterfall on the east wall, 6-8ft drop
- Replace 1200 sqft of dead lawn with pet-grade turf — they have 2 dogs
- Smart drip system on the new planting bed along the back wall (~80 ft)
- Path lighting, brass — maybe 8-10 fixtures, plus 4 uplights on the saguaro
HOA review needed (Stonebridge). Tight side gate — won't fit a skid steer.
Slope toward the house at the east corner — drainage matters here.
Budget they floated: ~$45-55K. I'd bring in PM + dust control given the dogs.`;

const FIELD_BASE = "flex flex-col gap-2";

export default function IntakePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<"idle" | "creating" | "extracting" | "drafting" | "done">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    project_address: "",
    site_walk_notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setStage("creating");

    try {
      const created = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const createdJson = await created.json();
      if (!created.ok) throw new Error(createdJson?.error ?? "Failed to create proposal");

      const proposalId: string = createdJson.proposal.id;

      setStage("extracting");
      const extracted = await fetch(`/api/proposals/${proposalId}/extract`, { method: "POST" });
      const extractedJson = await extracted.json();
      if (!extracted.ok) throw new Error(extractedJson?.error ?? "Scope extraction failed");

      setStage("drafting");
      const drafted = await fetch(`/api/proposals/${proposalId}/draft`, { method: "POST" });
      const draftedJson = await drafted.json();
      if (!drafted.ok) throw new Error(draftedJson?.error ?? "Proposal drafting failed");

      setStage("done");
      router.push(`/review/${proposalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("idle");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          &larr; Back
        </Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
          Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New site walk</CardTitle>
          <CardDescription>
            Drop the messy notes. The agent extracts scope, picks line items, drafts a proposal in
            Marcus&apos;s voice, and pings Slack for approval. ~10&ndash;20 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className={FIELD_BASE}>
                <Label htmlFor="customer_name">Customer name</Label>
                <Input
                  id="customer_name"
                  required
                  value={form.customer_name}
                  onChange={(e) => update("customer_name", e.target.value)}
                  placeholder="Henderson"
                  disabled={submitting}
                />
              </div>
              <div className={FIELD_BASE}>
                <Label htmlFor="customer_email">Customer email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={(e) => update("customer_email", e.target.value)}
                  placeholder="customer@example.com"
                  disabled={submitting}
                />
              </div>
              <div className={FIELD_BASE}>
                <Label htmlFor="customer_phone">Phone (optional)</Label>
                <Input
                  id="customer_phone"
                  value={form.customer_phone}
                  onChange={(e) => update("customer_phone", e.target.value)}
                  placeholder="(602) 555-0182"
                  disabled={submitting}
                />
              </div>
              <div className={FIELD_BASE}>
                <Label htmlFor="project_address">Project address</Label>
                <Input
                  id="project_address"
                  required
                  value={form.project_address}
                  onChange={(e) => update("project_address", e.target.value)}
                  placeholder="4421 E Stanford Dr, Phoenix AZ"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className={FIELD_BASE}>
              <div className="flex items-center justify-between">
                <Label htmlFor="site_walk_notes">Site walk notes</Label>
                <button
                  type="button"
                  className="text-xs text-emerald-700 hover:underline"
                  onClick={() => update("site_walk_notes", SAMPLE)}
                  disabled={submitting}
                >
                  Insert sample
                </button>
              </div>
              <Textarea
                id="site_walk_notes"
                required
                rows={14}
                value={form.site_walk_notes}
                onChange={(e) => update("site_walk_notes", e.target.value)}
                placeholder="Be as messy as you want — speak naturally. Dimensions, materials, callouts, customer quirks, HOA, access, drainage, anything Marcus would scribble in his notebook."
                disabled={submitting}
              />
              <p className="text-xs text-zinc-500">
                {form.site_walk_notes.trim().length} chars · min 20
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting} size="lg">
                {submitting ? <StageLabel stage={stage} /> : "Run quote agent"}
              </Button>
              {!submitting ? (
                <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
                  Cancel
                </Link>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function StageLabel({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    creating: "Creating proposal…",
    extracting: "Extracting scope (Claude)…",
    drafting: "Drafting proposal (Claude)…",
    done: "Done",
  };
  return <span>{map[stage] ?? "Working…"}</span>;
}
