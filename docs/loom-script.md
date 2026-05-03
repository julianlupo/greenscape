# Loom Script — 5 minutes flat

> Read aloud or riff against. Every line is timed. Every screen cue is in **[brackets]**.
> Your job: hit each bullet from the brief without going over 5 minutes.

---

## Setup checklist (do this BEFORE you hit Record)

**Tabs in this exact order, ⌘1 → ⌘6:**

1. https://greenscape-psi.vercel.app/intake — form ready, customer name `Julian Lupolover`, email `julian.lupolover@icloud.com`, address `17001 Collins Avenue, Sunny Isles Beach FL`, **notes textarea pre-filled** (click "Insert sample" then leave it)
2. Slack workspace — focused on your approvals channel, scrolled to bottom
3. Your iCloud or Gmail inbox — search box ready
4. https://github.com/julianlupo/greenscape — file tree view
5. https://github.com/julianlupo/greenscape/blob/main/docs/strategy.md — rendered strategy doc
6. https://greenscape-psi.vercel.app/dashboard — dashboard for the architecture talk

**Other prep:**
- Phone on do-not-disturb
- Quit Slack desktop in any other workspace
- Close every Chrome tab not on this list
- Loom: loom.com/start (browser-based, free, easiest) — choose "Cam off" or "Cam bubble in corner" — your call
- Mic check before hitting record

---

## The script (read or riff — every line is timed)

### 🎬 0:00–0:25 · Open

**[Cam on you / or just screen]**

> "Hey, I'm Julian. This is the License & Scale take-home — building the priority-zero AI agent for Greenscape Pro, Marcus Tate's hardscape design-build company in Phoenix. I'm gonna walk you through my strategy doc, demo what I built, talk architecture decisions, and what I'd ship next. Let's go."

---

### 🎬 0:25–0:35 · Kick off the demo (timing trick)

**[Switch to Tab 1 — /intake]**

> "First — I'm gonna submit a fresh proposal so the pipeline runs in the background while I talk strategy. Notes are already pasted from a real-feeling site walk."

**[Click "Run quote agent" submit button. Don't wait — switch tabs immediately.]**

---

### 🎬 0:35–1:30 · Strategy: top 3 agents + the cut

**[Switch to Tab 5 — strategy.md on GitHub]**

> "Strategy doc is in the repo at docs/strategy.md. Five agents ranked by ROI. Top three:
>
> **One — Quote Drafter.** This is what I built. Marcus loses 35 to 40 percent of qualified leads to faster competitors. At 28K average project value times 150 projects a year, that's about 1.1 million dollars in won deals being left on the table. He literally said on the discovery call: *'I am the bottleneck.'*
>
> **Two — Closed-Lost Reactivator.** 1,400 dead leads sitting in his GHL CRM. At a 2 percent re-close rate, that's 784K of latent revenue.
>
> **Three — Post-Sign Expediter.** 8 to 12 projects always stuck in HOA / permit / deposit limbo. Roughly 224 to 336K of capital tied up at any given moment.
>
> One agent I deliberately cut from his stated priorities: a marketing and content agent. He literally admitted on the call he's *quote-constrained*, not lead-constrained. His Meta ROAS is already 4.5x. Putting more leads into a broken funnel would actively make things worse. The L&S auditor flagged the exact same thing in the transcript."

---

### 🎬 1:30–3:15 · Demo the P0 end-to-end

**[Switch to Tab 2 — Slack. By now the approval message should have landed.]**

> "OK — back to Slack. The pipeline I started 90 seconds ago just landed an approval ping. Here's what Marcus sees: project summary, address, total of around 70K, deposit calculated automatically, complexity flag, confidence rating from Claude itself, full line items breakdown right in the message, and Approve / Reject buttons."

**[Hover the message so the buttons show. Maybe scroll the line items table.]**

> "He never has to leave Slack. Click Approve and Send."

**[Click ✅ Approve & Send → confirm.]**

> "On the back end: Stripe payment link gets generated for the 50 percent deposit, customer email goes out, Slack message updates in place to 'Approved and Sent'."

**[Wait 3-5 seconds. Slack updates. Then switch to Tab 3 — inbox.]**

> "Email lands in iCloud. Real send from a verified r3ply.ai subdomain — no demo routing."

**[Open the email. Scroll through it: header, scope of work, line items table, big green Stripe button.]**

> "Customer-facing proposal, full line items table inline, and a Stripe deposit button right in the email."

**[Click the Stripe button → land on Stripe checkout.]**

> "Real Stripe test-mode checkout. End-to-end, real services, real database, real audit log. About 90 seconds from messy notes to customer-ready proposal — versus Marcus's current 6 to 9 days."

---

### 🎬 3:15–4:30 · Architecture decisions

**[Switch to Tab 4 — GitHub repo file tree.]**

> "Stack: Next.js 14 on Vercel, Supabase for Postgres, Anthropic Sonnet 4.6, Slack interactive app, Stripe Payment Links, Resend for email. A few decisions worth calling out.
>
> **Sonnet 4.6, not Opus.** This isn't frontier reasoning — it's structured extraction plus steered writing. Sonnet handles it cleanly and is 5x cheaper. About 4 cents per proposal. At 150 proposals a year, that's 6 dollars of LLM cost to recapture 1.1 million in won deals. Cost panel is live in the UI per proposal — see the dashboard.
>
> **Server computes every total, not the LLM.** Claude picks line items and quantities, but my code looks them up in the pricing table and does the multiplication. The LLM literally cannot ship a wrong number to the customer. If it tries to pick a pricing item ID that doesn't exist, the request fails loud rather than ship a phantom item.
>
> **JSON-in-text plus Zod validation, not tool use.** Tool use would mean hand-writing JSON schemas alongside the Zod schemas — duplicate sources of truth. JSON-in-text plus a single retry on validation failure is robust enough for two well-shaped calls, and Zod stays the only place schemas live.
>
> **No vector search on the pricing catalog.** 50 line items doesn't justify embeddings — a structured category filter plus keyword scoring is faster, cheaper, debuggable. At 2,000 items I'd add embeddings.
>
> **Slack interactive, not just a webhook.** Marcus already lives in Slack — I went past the 'incoming webhook' bar to a real Slack app with signature-verified interactive buttons. Approve, reject, even a 'Re-analyze with Claude' flow on rejection — all without leaving the channel."

**[Briefly show the GitHub commit graph.]**

> "And on the engineering hygiene side — 23 logical commits, no mega-commits, every state transition logged to an audit table."

---

### 🎬 4:30–4:55 · What I'd ship next

> "Another week, here's what I'd build:
>
> Voice intake — Whisper transcription of Marcus's voice memo from the truck. Skip the typing entirely.
>
> Real GHL integration — push approved proposals into Marcus's CRM and let his existing automations route the customer email. Per Jenna on the call: 'It has to talk to GHL or it's not going to get used.'
>
> Render queue trigger — proposals over 30K automatically file a job in Carlos's render queue.
>
> Learning loop — diff what Marcus actually approves against what Claude proposed, use the deltas to re-prompt the drafter over time.
>
> Repo, deployed URL, and full README with the trade-offs and 'what would break first at scale' are all in the submission. Thanks for the time."

**[End recording.]**

---

## Backup plan if the live demo breaks

If the pipeline times out, the Slack message doesn't land, or the email doesn't show:

> "Looks like that one's slow — let me show you a previous run instead. *(Switch to /dashboard or open a previous proposal.)*"

You have ~7 previous proposals in the dashboard. Show one in `sent` status — same architecture, same audit log, just a different one.

---

## Q&A cheatsheet (for the live walkthrough call after submission)

| Question | Your answer |
|---|---|
| Why Sonnet not Opus? | Not frontier reasoning. 5× cheaper. Headroom to upgrade if quality demands it. |
| Why not vector search? | 50 items doesn't justify it. Structured filter is faster, cheaper, debuggable. At 2K+ I'd add embeddings. |
| Why JSON-in-text not tool use? | Tool use means duplicate JSON schemas alongside Zod. JSON + Zod retry-once is what the brief described. |
| What if Claude hallucinates a pricing item? | Server-side resolve fails loud — `resolvePicksToLineItems` returns `missing_ids`, throws PipelineError. Better fail than ship phantom. |
| What if notes are 5K words? | Sonnet's window handles it. Quality may drop on huge inputs — would chunk + merge scopes at 2K+ words. |
| What breaks first at scale? | Slack as single approval channel; pricing match recall past 500 SKUs; no concurrency control on simultaneous reviews. |
| Why is approve flow synchronous if Stripe is slow? | Stripe is best-effort with try/catch; failure logs to audit log and approve continues. Marcus can re-generate. |
| Why mock the email originally? | Demo safety. Then verified proposals.r3ply.ai domain mid-build and flipped to real send. |
| Why not real GHL? | Production data risk during a graded demo. Brittle APIs, no sandbox. Mocked the boundary, real Resend send instead. |
| Cost per proposal? | ~4 cents typical. Visible live in the UI per proposal. |

---

## Things to NOT do on the recording

- ❌ Read this script word-for-word in a robotic voice. Use it as a scaffold.
- ❌ Narrate code line-by-line. Brief explicitly says this loses points.
- ❌ Go over 5 minutes. Brief specifically calls out 20-minute Looms as bad.
- ❌ Apologize for what you didn't build. Frame as deliberate scope.
- ❌ Skip the strategy doc summary. 40% of the grade is judgment, not engineering.
- ❌ Show your IDE / `lib/pipeline.ts` unless you're making a specific architecture point.
- ❌ Re-record 8 times. One take. Mistakes feel huge to you, invisible to viewers.
