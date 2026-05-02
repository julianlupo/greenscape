# Loom script — 5 minutes max

> Reference doc for recording. Don't read it verbatim — use it as a structure to riff against.

**Tools open before you hit Record:**
- Browser tab 1: https://greenscape-psi.vercel.app/intake
- Browser tab 2: Your Slack workspace, focused on the approvals channel
- Browser tab 3: Your Gmail/iCloud inbox
- Browser tab 4: docs/strategy.md in the GitHub repo (showing the source)
- Code editor: lib/pipeline.ts visible (Claude wrapper + state machine)

---

## 0:00–0:45 — Strategy doc (top 3 + the cut)

> Hi, I'm Julian. This is the License & Scale take-home — building the P0 agent for Greenscape Pro, Marcus Tate's hardscape design-build company in Phoenix.
>
> Quick on the strategy doc — I ranked five agents, and the top three are:
>
> **One:** Quote Drafter. Marcus loses 35-40% of qualified leads to faster competitors. At $28K average project value × 150 projects a year, that's about a million dollars a year in won deals being left on the table. He himself said: *"I am the bottleneck."*
>
> **Two:** Closed-Lost Reactivator. He's got 1,400 dead leads sitting in GHL — at a 2% re-close, that's $784K of latent revenue.
>
> **Three:** Post-Sign Expediter. 8-12 projects always stuck in HOA / permit / deposit limbo — that's $224-336K of capital tied up at any given moment.
>
> The agent I cut from his stated priorities: a marketing/content agent. He literally said on the call he's *quote*-constrained, not lead-constrained. Putting more leads into a broken funnel would actively make things worse.

---

## 0:45–3:00 — The P0 working live

> Here's what I built — the Quote Drafter Agent. Live URL is greenscape-psi.vercel.app.
>
> Marcus pastes his messy site-walk notes into the intake form. *(Click "Insert sample" → submit.)*
>
> Two Claude Sonnet 4.6 calls run server-side. First one extracts structured scope — features, dimensions, materials, complexity, red flags. Second one picks line items from the pricing catalog and drafts the proposal in Marcus's voice. About 90 seconds.
>
> *(Switch to Slack tab.)*
>
> An interactive approval message lands in Slack — full breakdown, line items, total, deposit, confidence flag, and Approve/Reject buttons. Marcus never has to leave Slack to make a decision.
>
> *(Click Approve in Slack → confirm.)*
>
> When he approves: Stripe payment link for the 50% deposit gets generated, the customer email goes out via Resend from a verified r3ply.ai subdomain, and the Slack message updates in place to "Approved & sent."
>
> *(Switch to Gmail/iCloud → show the email landing.)*
>
> The customer gets a real email with the proposal, the line items table, and a Stripe button for the deposit.
>
> *(Click the Stripe button → land on Stripe test checkout.)*
>
> Real Stripe test-mode checkout. End-to-end, real services, real database, real audit log.

---

## 3:00–4:30 — Architecture decisions

> Stack is Next.js 14 on Vercel, Supabase Postgres, Claude Sonnet 4.6, Slack interactive app, Stripe Payment Links, Resend for email.
>
> A few decisions worth calling out:
>
> **Sonnet 4.6, not Opus.** This isn't frontier reasoning — it's structured extraction plus steered writing. Sonnet handles it cleanly and is 5× cheaper. About 4 cents per proposal end-to-end. At 150 proposals a year, that's six dollars of LLM cost to recapture a million dollars in won deals.
>
> **Server computes every total.** The LLM picks line items and quantities, but my code looks them up in the pricing table and does the multiplication. The LLM literally can't ship a wrong number to the customer. If it tries to pick a pricing item ID that doesn't exist, the request fails loud rather than ship a phantom item.
>
> **JSON-in-text plus Zod, not tool use.** I considered Claude's structured-output mode, but tool-use schemas would mean hand-writing JSON schemas alongside the Zod schemas — duplicate sources of truth. JSON-in-text plus a single retry on validation failure is robust enough for two well-shaped calls, and Zod stays the only place schemas live.
>
> **No vector search on the pricing catalog.** 50 line items doesn't justify embeddings — a structured category filter plus keyword scoring is faster, cheaper, and easier to debug. At 2,000 items I'd add embeddings.
>
> **Slack interactive, not just a webhook.** Marcus already lives in Slack — I went past the bar of "incoming webhook" to a real Slack app with signature-verified interactive buttons. He approves, rejects, and even triggers a "re-analyze with Claude" flow without leaving the channel.

---

## 4:30–5:00 — What I'd build next

> If I had another week:
>
> Voice intake — Whisper transcription of Marcus's voice memo from the truck, so he doesn't even type.
>
> Real GHL integration — push approved proposals into Marcus's CRM and let it route the customer email through GHL's existing automations.
>
> Render queue trigger — when a proposal goes over $30K, automatically file a job in Carlos's render queue with the scope summary.
>
> Learning loop — diff what Marcus actually approves against what Claude proposed, and use the deltas to re-prompt the drafter over time.
>
> The README has the full list, plus an honest "what would break first at scale" section. Repo and deployed URL are in the submission email. Thanks for the time.

---

## Cheatsheet — answers to likely live-walkthrough questions

| Question | Your answer |
|---|---|
| Why Sonnet not Opus? | Not frontier reasoning. 5× cheaper. Have headroom to upgrade if quality demands. |
| Why not vector search? | 50 items doesn't justify it. Structured filter is faster, cheaper, debuggable. At 2K+ I'd add embeddings. |
| Why JSON-in-text not tool use? | Tool use means hand-writing JSON schemas alongside Zod schemas — duplicate sources of truth. JSON-in-text + Zod retry-once is what the brief described. |
| What if Claude hallucinates a pricing item? | Server-side resolve fails loud — `resolvePicksToLineItems` returns `missing_ids`, which throws PipelineError(502). Better to fail than ship a phantom line. |
| What if the customer's notes are 5K words? | Sonnet's input window handles it. Quality may drop on huge inputs — would chunk + merge scopes at 2K+ words. Documented. |
| What would break first at scale? | Slack as single approval channel; pricing match recall past ~500 SKUs; no concurrency control on simultaneous reviews. |
| Why is approve flow synchronous if Stripe is slow? | Stripe is best-effort with try/catch; failure logs to audit log and approve continues. Marcus can re-generate from /review if needed. |
| Why mock the email? | Demo safety. Production would route through GHL's email API per Jenna's GHL-or-nothing constraint. |
| Why not real GHL? | Production data risk during a graded demo. Brittle APIs, no sandbox. Mocked the GHL boundary, demonstrated real Resend send instead. |
| Cost per proposal? | ~4 cents on a typical run. Visible live in the UI per proposal — see the "Run cost" panel on /review. |

---

## Don't do these on the recording

- Don't narrate code line-by-line — the brief explicitly says that loses points.
- Don't go over 5 minutes — they call out 20-min Looms specifically.
- Don't apologize for what you didn't build — frame as deliberate scope decisions.
- Don't skip the strategy doc summary — 40% of the grade is judgment, not engineering.
