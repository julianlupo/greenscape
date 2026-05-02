# Greenscape Pro — AI Agent Strategy

**Prepared for License & Scale | 5 agents, ranked by ROI**

---

## #1 — Quote Drafter Agent (built — see deployed URL + repo)

**Purpose:** Compress the site-walk-to-proposal cycle from 6–9 days to under 24 hours.

- Marcus drops messy site-walk notes into a web form (or, in v1.1, dictates via voice + Whisper transcription).
- Two Claude Sonnet 4.6 calls: structured scope extraction (Zod-validated, retry-on-malformed), then proposal drafting in Marcus's voice.
- Deterministic line-item match against the pricing catalog — no LLM in the math path; server computes every total. The model literally cannot ship a wrong number to the customer.
- Approval lands as an interactive Slack message with line items, total, deposit, confidence flag, and inline Approve/Reject buttons. Marcus never leaves Slack.
- On approve: Stripe Payment Link for 50% deposit, real customer email via Resend (verified `proposals.r3ply.ai` sender), audit log of every state transition. Reject opens a "Re-analyze with Claude" follow-up.

**What it replaces:** Marcus's nightly proposal-drafting sessions — the bottleneck he names directly: *"I am the bottleneck."*

**ROI:** 35–40% of qualified leads lost to faster competitors. $28K AOV × ~150 projects/yr × ~30% close-rate recapture = **~$1.1M/yr in won deals**. LLM cost: ~$0.04 per draft × ~150 drafts/yr = **~$6/yr**. ROI ratio: ~180,000×.

**Why #1:** The math dwarfs every other lever 3–to–1. Until this leak is plugged, every other improvement compounds on a broken funnel — including Agent #2, which would feed reactivated leads into the same slow proposal pipe.

---

## #2 — Closed-Lost Reactivator

**Purpose:** Mine the 1,400-lead dead pile with personalized, Marcus-voiced re-engagement at scale.

- Pulls historical notes from each closed-lost lead in GHL (project type, last conversation, drop-off reason, lead source).
- Drafts a one-to-one SMS referencing original project context — *"the backyard with the slope near the pool"*, not a generic blast.
- Sends in throttled waves; reply detection routes warm responses to Brittany or Marcus, ignores out-of-office.
- A/B tests message angle (price-anchor / seasonal urgency / personal check-in) and learns what reactivates whom.
- Re-close attribution back to original lead source for ROAS reporting.

**What it replaces:** Brittany's sporadic, untargeted re-engagement blasts that *"do not feel personal."*

**ROI:** 1,400 leads × 2% re-close × $28K AOV = **~$784K/yr in latent revenue**. Marcus has personally confirmed personal-feeling messages convert; the constraint has always been execution capacity, not strategy.

**Why #2:** Pure upside. Dead leads have zero opportunity cost. Runs while Marcus sleeps. Pays for itself in week one. Ships only after #1 because reactivated leads need a fast quote pipe to land in.

---

## #3 — Post-Sign Expediter

**Purpose:** Eliminate the 4–6 week post-signature drag killing crew utilization and cash flow.

- Tracks each signed deal across HOA / permit / deposit / final-design milestones in Supabase.
- Sends customer-facing nudges with deadline framing: *"Your HOA board meets in 9 days — here's what we still need."*
- Auto-generates pre-filled HOA submission packets from project data.
- Escalates stuck deals to Jenna with the **specific blocker named**, not a generic "follow up."
- Predicts crew start dates from milestone state for accurate Jobber scheduling.

**What it replaces:** Jenna's manual chase of HOA / permit / deposit status across 8–12 active projects at any given time.

**ROI:** 8–12 projects in limbo × $28K = **$224–336K of capital tied up at any moment**. Compressing average post-sign cycle from 4–6 weeks to 2–3 weeks unlocks earlier crew utilization and accelerates cash collection by **weeks per project**.

**Why #3:** Operationally invisible to Marcus but the silent constraint on revenue *velocity*. Also frees Jenna's attention so #4 actually works.

---

## #4 — Internal Approvals Agent ("The Rule Book")

**Purpose:** Codify Marcus's pricing and decision framework so Jenna can decide without Slack-pinging him.

- Receives Jenna's question via Slack (refund amount, change-order pricing, add-on quote).
- Returns Marcus's likely decision *with reasoning*, citing prior similar decisions and outcomes.
- Logs every actual Marcus decision; the rule book grows organically rather than requiring him to write it down.
- Auto-approves clear-rule cases (refunds under threshold for known delay reasons); escalates only edge cases.
- Surfaces rule conflicts and proposes codification for Marcus to ratify.

**What it replaces:** 5–10 daily Slack pings from Jenna to Marcus — explicitly one of Marcus's three *"tasks I'd fire myself from."*

**ROI:** ~25–40 hours/month of Marcus's attention recovered. Hard to dollarize directly, but it directly enables Marcus's stated outcome: *"I want my evenings back."* More importantly, it removes the human rate-limit on agents #1–#3 — without it, every quote, every reactivation, every milestone escalation eventually queues behind Marcus's Slack inbox.

**Why #4 (not #1):** It can't be built first because there's no decision history yet to learn from. Building it fourth lets the earlier agents *generate* the training data it needs.

---

## #5 — Build Comms Agent

**Purpose:** Automate Marcus-voiced project updates triggered by CompanyCam photo uploads and Jobber milestone events.

- Watches CompanyCam + Jobber for trigger events (photo posted, milestone hit, day count elapsed).
- Generates a customer-facing update in Marcus's voice: *"Hey — Andre laid the pavers today, here's what's next."*
- Sends via SMS or email. First 30 days: drafts queue for one-tap Marcus approval. After confidence stabilizes: auto-sends.
- Detects customer responses; flags concerns to crew lead and Jenna; surfaces positive sentiment as referral candidates.
- Tracks NPS-style signal across active builds so Marcus sees customer mood at a glance.

**What it replaces:** Marcus's inconsistent Loom updates (he sends them on ~30% of jobs) and the customer anxiety calls Jenna fields daily.

**ROI:** Drives referrals — Marcus's own words: *"I have gotten referrals from people who said you are the only contractor who kept us informed."* One extra referred deal/month at $28K = **~$336K/yr**. Plus reduces inbound anxiety calls and lifts review-request conversion at project end.

**Why #5:** Real revenue signal from Marcus's own admission, but it sits downstream of the four agents above. The customer experience needs to match a now-faster business — build it once the bigger leaks are plugged.

---

## Why my #1 isn't Marcus's stated #1 (it is — but for the wrong reason)

Marcus also ranks Quote Speed first. He frames it as personal pain: *"it's killing us."* That framing leads to the wrong next move: hire a junior estimator, work later nights, throw bodies at it.

The right framing is the math: **35–40% of qualified leads lost to speed differential is the single largest revenue leak in a $4.2M business.** Even if Marcus had ranked this #3, the numbers would demand it be #1. Reaching that conclusion from data, not deference to the founder's gut, is the job. An agent built around "Marcus is tired" optimizes for Marcus's evenings; an agent built around the speed-loss math optimizes for $1.1M in won deals — and gives Marcus his evenings back as a side effect.

## One agent I considered but cut: Marketing/Content (Marcus's stated #4)

Cut deliberately. On the call Marcus said directly: *"I cannot keep up with the leads I have."* When pushed on lead-volume vs. quote-volume constraint, he answered *"quote."* His Meta ROAS sits at 4–4.5×.

He is **not lead-constrained**. He is **throughput-constrained on the quote side**. A content agent would solve a non-problem and *actively worsen* the existing bottleneck — stuffing more leads into a funnel that loses 35–40% of qualified deals on speed. The brief explicitly rewards "pushing back on the founder's stated priorities with evidence." This is that.

(Runner-up cut: a Crew Coaching agent — real $104K/yr opportunity, but an order of magnitude smaller than #1–#3, and the kind of pick that signals the priority list was set by founder enthusiasm rather than data.)

---

## Assumptions, dependencies, and what would break first at scale

- **GHL is the system of record.** Every agent reads from and writes back to GHL. Jenna's constraint is non-negotiable: anything outside GHL won't get used. The P0 build mocks the GHL email send (real-customer-risk avoidance during demo); production routes through GHL's email API.
- **#1 unblocks the funnel; #3 unblocks the backlog.** Running #1 without #3 just shifts the bottleneck downstream as more deals close faster than ops can absorb. They ship in sequence, deploy close together.
- **#4 is the force multiplier.** Without it, Marcus remains the rate limiter on agents #1–#3 because every edge-case approval still routes through him.
- **Voice cloning is out of scope for v1.** "Marcus's voice" in agents #2 and #5 means tone and phrasing, not synthesized audio. ElevenLabs / HeyGen is a v2 conversation once trust is established.
- **First-to-break at scale (built P0):** single shared Slack approval channel doesn't scale past one approver; pricing match degrades past ~500 SKUs without embeddings; no concurrency control on simultaneous reviews of the same proposal. All documented in the README.
