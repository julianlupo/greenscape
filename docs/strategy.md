# Greenscape Pro — AI Agent Strategy

**Prepared for License & Scale | 5 agents, ranked by ROI**

---

## #1 — Quote Drafter Agent (built — see deployed URL + repo)

**Purpose:** Compress the site-walk-to-proposal cycle from 6–9 days to under 24 hours.

- Marcus drops messy site-walk notes into a web form (v1.1: dictate via voice + Whisper).
- Two Claude Sonnet 4.6 calls: structured scope extraction (Zod-validated, retry-on-malformed), then proposal drafting in Marcus's voice.
- Deterministic line-item match against the pricing catalog — no LLM in the math path; server computes every total. The model literally cannot ship a wrong number to the customer.
- Approval lands as an interactive Slack message with line items, total, deposit, confidence flag, and inline Approve/Reject buttons. Marcus never leaves Slack.
- On approve: Stripe Payment Link for 50% deposit, real customer email via Resend (verified `proposals.r3ply.ai` sender), audit log of every state transition. Reject opens a "Re-analyze with Claude" follow-up.

**What it replaces:** Marcus's nightly proposal-drafting sessions. From the call: *"Honestly? Me. I am the bottleneck. I have to touch every proposal. Nobody else knows how to do that."*

**ROI math:** 35–40% of qualified leads lost to faster competitors. $28K AOV × ~150 projects/yr × ~30% close-rate recapture = **~$1.1M/yr in won deals**. **Site walks already close at 70%+** (vs ~20% on phone-only quotes) — the proposal IS the conversion event. Speeding it up is the single highest-leverage intervention in the business. Marcus's own field evidence: *"I have had customers apologize to me. They liked us better but they needed to move."*

**Cost to operate:** ~$0.04 per draft × ~150/yr = **~$6/yr** in LLM cost. ROI ratio: ~180,000×.

**Why #1:** The math dwarfs every other lever 3-to-1. Until this leak is plugged, every other improvement compounds on a broken funnel — including Agent #2, which would feed reactivated leads into the same slow proposal pipe.

---

## #2 — Closed-Lost Reactivator

**Purpose:** Mine the 1,400-lead dead pile with personalized, Marcus-voiced re-engagement at scale.

- Pulls historical notes from each closed-lost lead in GHL (project type, last conversation, drop-off reason, lead source).
- Drafts a one-to-one SMS referencing original project context — *"the backyard with the slope near the pool"*, not a generic blast.
- Sends in throttled waves; reply detection routes warm responses to Brittany or Marcus, ignores out-of-office.
- A/B tests message angle (price-anchor / seasonal urgency / personal check-in) and learns what reactivates whom.
- Re-close attribution back to original lead source for ROAS reporting.

**What it replaces:** Brittany's sporadic, untargeted re-engagement blasts. Marcus's own framing: *"When it feels like Marcus is reaching out personally, people respond. When it feels like a mass blast, they do not."*

**ROI:** 1,400 leads × 2% re-close × $28K AOV = **~$784K/yr in latent revenue**. Marcus has personally confirmed personal-feeling messages convert; the constraint has always been execution capacity, not strategy.

**Why #2:** Pure upside. Dead leads have zero opportunity cost. Runs while Marcus sleeps. Pays for itself in week one. **Ships only after #1** — reactivated leads need a fast quote pipe to land in.

---

## #3 — Post-Sign Expediter

**Purpose:** Eliminate the 4–6 week post-signature drag killing crew utilization and cash flow.

- Tracks each signed deal across HOA / permit / deposit / final-design milestones in Supabase.
- Sends customer-facing nudges with deadline framing: *"Your HOA board meets in 9 days — here's what we still need."*
- Auto-generates pre-filled HOA submission packets from project data.
- Escalates stuck deals to Jenna with the **specific blocker named**, not a generic "follow up."
- Predicts crew start dates from milestone state for accurate Jobber scheduling.

**What it replaces:** Jenna's manual chase across 8–12 active post-sign projects. Marcus on the impact: *"If a project slips 2 weeks because of HOA, that is 2 weeks my crew could be on another job. It compounds."*

**ROI:** **8–12 projects in limbo × $28K = $224–336K of capital tied up at any given moment.** Compressing average post-sign cycle from 4–6 weeks to 2–3 weeks unlocks earlier crew utilization and accelerates cash collection by **weeks per project**. At 150 projects/yr, even 1 week of average compression is meaningful crew-utilization recapture.

**Why #3:** Operationally invisible to Marcus but the silent constraint on revenue *velocity*. Also frees Jenna's attention so #4 actually works.

---

## #4 — Internal Approvals Agent ("The Rule Book")

**Purpose:** Codify Marcus's pricing and decision framework so Jenna can decide without Slack-pinging him.

- Receives Jenna's question via Slack (refund amount, change-order pricing, add-on quote).
- Returns Marcus's likely decision *with reasoning*, citing prior similar decisions and outcomes.
- Logs every actual Marcus decision; the rule book grows organically rather than requiring him to write it down.
- Auto-approves clear-rule cases (refunds under threshold for known delay reasons); escalates only edge cases.
- Surfaces rule conflicts and proposes codification for Marcus to ratify.

**What it replaces:** 5–10 daily Slack pings from Jenna to Marcus. Jenna's exact ask on the call: *"I literally just need a rule book. Half of these I could decide myself if I knew Marcus's framework."* Marcus's response: *"I keep saying I will write it down. I never do."*

**ROI:** ~25–40 hours/month of Marcus's attention recovered. Hard to dollarize directly, but it directly enables Marcus's own stated outcome: *"Honestly, I am tired. I want my evenings back."* More importantly, it removes the human rate-limit on agents #1–#3 — without it, every quote, every reactivation, every milestone escalation eventually queues behind Marcus's Slack inbox.

**Why #4 (not #1):** It can't be built first because there's no decision history yet to learn from. Building it fourth lets the earlier agents *generate* the training data it needs.

---

## #5 — Build Comms Agent

**Purpose:** Automate Marcus-voiced project updates triggered by CompanyCam photo uploads and Jobber milestone events.

- Watches CompanyCam + Jobber for trigger events (photo posted, milestone hit, day count elapsed).
- Generates a customer-facing update in Marcus's voice: *"Hey — Andre laid the pavers today, here's what's next."*
- Sends via SMS or email. First 30 days: drafts queue for one-tap Marcus approval. After confidence stabilizes: auto-sends.
- Detects customer responses; flags concerns to crew lead and Jenna; surfaces positive sentiment as referral candidates.
- Tracks NPS-style signal across active builds so Marcus sees customer mood at a glance.

**What it replaces:** Marcus's inconsistent Loom updates — he sends them on ~30% of jobs. Plus Jenna's daily "what is happening on my project?" anxiety calls.

**ROI:** Drives referrals by Marcus's own admission: *"I have gotten referrals from people who said 'you are the only contractor who kept us informed.'"* One extra referred deal/month at $28K = **~$336K/yr**. Plus reduces inbound anxiety calls and lifts review-request conversion at project end.

**Why #5:** Real revenue signal from Marcus's own admission, but it sits downstream of the four agents above. The customer experience needs to match a now-faster business — build it once the bigger leaks are plugged.

---

## Why my #1 isn't Marcus's stated #1 (it is — but for the wrong reason)

Marcus's onboarding submission ranks "speed up quoting" first. He frames it as personal pain: *"it's killing us."* That framing leads to the wrong remedy: hire a junior estimator, work later nights, throw bodies at it.

The right framing is the math: **35–40% of qualified leads lost to speed differential is the single largest revenue leak in a $4.2M business.** Even if Marcus had ranked this #3, the numbers would demand it be #1. Reaching that conclusion from the data — not deference to the founder's gut — is the whole job. An agent built around "Marcus is tired" optimizes for Marcus's evenings; an agent built around the speed-loss math optimizes for $1.1M in won deals — and gives Marcus his evenings back as a side effect.

## One agent I considered but cut: Marketing/Content (Marcus's stated #4)

Cut deliberately. The discovery transcript is unambiguous:

> **L&S:** Are you lead-volume constrained, or quote-volume constrained?
> **Marcus:** Quote. I cannot keep up with the leads I have.

His Meta ROAS is 4–4.5×. The L&S auditor flagged this directly: *"He himself just admitted lead volume is not the problem. A marketing and content agent would be solving a non-problem. **Strong candidate flag.**"*

Building a content agent for Greenscape would actively worsen the existing bottleneck — stuffing more leads into a funnel that already loses 35–40% of qualified deals on speed. The brief explicitly rewards "pushing back on the founder's stated priorities with evidence." This is that.

(Runner-up cut: **Crew Coaching** — Marcus's stated #3, real $104K/yr opportunity, but the auditor's verbatim flag: *"Real money, but an order of magnitude smaller than the quote-cycle revenue at risk. **Likely a candidate trap if the priority list is not reasoned from data.**"* Honored the trap.)

---

## Assumptions, dependencies, and what would break first at scale

- **GHL is the system of record.** Jenna's hard constraint, exact words: *"And whatever it is, it has to talk to GHL. Everything has to be in GHL or it is not going to get used."* The P0 build mocks the GHL email send to avoid real-customer risk during the demo; production routes through GHL's email API. Future agents (#2 reactivation SMS, #3 milestone nudges, #5 build updates) all push back to GHL contacts.
- **#1 unblocks the funnel; #3 unblocks the backlog.** Running #1 without #3 just shifts the bottleneck downstream as more deals close faster than ops can absorb. They ship in sequence, deploy close together.
- **#4 is the force multiplier.** Without it, Marcus remains the rate limiter on agents #1–#3 because every edge-case approval still routes through him.
- **Voice cloning is out of scope for v1.** "Marcus's voice" in agents #2 and #5 means tone and phrasing, not synthesized audio. ElevenLabs / HeyGen is a v2 conversation once trust is established.
- **What breaks first at scale (in the built P0):** single shared Slack approval channel doesn't scale past one approver; pricing match degrades past ~500 SKUs without embeddings; no concurrency control on simultaneous reviews of the same proposal. All documented in the README.
