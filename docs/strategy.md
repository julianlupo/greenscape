# Greenscape Pro — AI Agent Strategy

**Prepared for License & Scale | 5 Agents Ranked by ROI**

---

## #1 — Quote Drafter Agent

**Purpose:** Compress the site-walk-to-proposal cycle from 6–9 days to under 24 hours.

- Marcus dictates site walk notes (text or voice); agent extracts scope, dimensions, materials, and constraints into a structured brief
- Retrieves matching line items from the 200+ row pricing sheet via semantic search and quantity reasoning
- Drafts the proposal in his existing Google Doc template; auto-flags projects over $30K for Carlos's render queue
- Routes to Marcus for one-tap approval (Slack or web), then sends via GHL with Stripe deposit link attached
- Logs every accepted edit to Supabase so pricing logic improves over time

**Replaces:** Marcus's nightly proposal-drafting session — the bottleneck he explicitly names ("I am the bottleneck").

**ROI:** 35–40% of qualified leads currently lost to faster competitors. At $28K AOV × ~150 projects/year × 30% close rate-loss recapture = **~$1.1M in won deals annually.** Single highest-leverage intervention in the business.

**Why #1:** The math dwarfs every other lever by roughly 3-to-1. Until this leak is plugged, every other improvement compounds on a broken funnel.

---

## #2 — Closed-Lost Reactivator

**Purpose:** Mine the 1,400-lead dead pile with personalized, Marcus-voiced re-engagement at scale.

- Pulls historical notes from each closed-lost lead in GHL (project type, last conversation, drop-off reason)
- Drafts a one-to-one SMS referencing original project context ("the backyard with the slope near the pool")
- Sends in throttled waves; reply detection routes warm responses to Brittany or Marcus, ignores out-of-office
- A/B tests message angle (price-anchor, seasonal urgency, personal check-in) and learns what reactivates
- Tracks re-close attribution back to original lead source for ROAS reporting

**Replaces:** Brittany's sporadic, untargeted re-engagement blasts that "do not feel personal."

**ROI:** 1,400 leads × 2% re-close × $28K = **$784K in latent revenue.** Marcus confirmed personal-feeling messages convert; the constraint has been execution, not strategy.

**Why #2:** Pure upside. Dead leads have zero opportunity cost. The agent runs while Marcus sleeps and pays for itself in the first month.

---

## #3 — Post-Sign Expediter

**Purpose:** Eliminate the 4–6 week post-signature drag killing crew utilization and cash flow.

- Tracks each signed deal across HOA / permit / deposit / final-design milestones in Supabase
- Sends customer-facing nudges with deadline framing ("Your HOA board meets in 9 days — here's what we still need")
- Auto-generates pre-filled HOA submission packets from project data
- Escalates stuck deals to Jenna with the exact blocker named, not a generic "follow up"
- Predicts crew start dates from milestone state for accurate Jobber scheduling

**Replaces:** Jenna's manual chase of HOA/permit/deposit status across 8–12 active projects at any time.

**ROI:** 8–12 projects per limbo × $28K = **$224–336K in delayed revenue at any moment.** Compressing average cycle from 4–6 weeks to 2–3 weeks unlocks materially earlier crew utilization and accelerates cash collection by weeks per project.

**Why #3:** Operationally invisible to Marcus but the silent constraint on revenue velocity. Also frees Jenna to focus on the agent below.

---

## #4 — Internal Approvals Agent ("The Rule Book")

**Purpose:** Codify Marcus's pricing and approval framework so Jenna can decide without Slack-pinging him.

- Receives Jenna's question via Slack (refund amount, change order pricing, add-on quote)
- Returns Marcus's likely decision with reasoning, citing prior similar decisions and their outcomes
- Logs every actual Marcus decision; the rule book grows organically rather than requiring him to write it down
- Auto-approves clear-rule cases (e.g., refunds under a threshold for known delay reasons); escalates only edge cases
- Surfaces rule conflicts and proposes codification for Marcus to ratify

**Replaces:** 5–10 daily Slack pings from Jenna to Marcus on small approvals — explicitly one of Marcus's three "tasks I'd fire myself from."

**ROI:** ~25–40 hours/month of Marcus's attention recovered, plus Jenna unblocked on standard decisions. Hard to fully dollarize, but it directly enables the outcome Marcus stated: *"I want my evenings back."* Indirectly, it removes the cognitive load preventing Marcus from focusing on site walks and oversight of agents #1–#3.

**Why #4:** Meta-leverage. It scales Marcus across the entire business rather than one workflow. Indirect revenue impact, but addresses two stated needs simultaneously (Marcus's evenings, Jenna's autonomy).

---

## #5 — Build Comms Agent

**Purpose:** Automate Marcus-voiced project updates triggered by CompanyCam photo uploads and Jobber milestone events.

- Watches CompanyCam and Jobber for trigger events (photo posted, milestone completed, day count elapsed)
- Generates a customer-facing update in Marcus's voice ("Hey — Andre laid the pavers today, here's what's next")
- Sends via SMS or email; for first 30 days, drafts queue for Marcus's tap-to-approve, then auto-sends as confidence stabilizes
- Detects customer responses; flags concerns to crew lead and Jenna; surfaces positive sentiment as referral candidates
- Tracks NPS-style signal across active builds so Marcus sees customer mood at a glance

**Replaces:** Marcus's inconsistent Loom updates (30% of jobs) and the customer anxiety calls Jenna fields daily.

**ROI:** Drives referrals — Marcus explicitly said *"I have gotten referrals from people who said you are the only contractor who kept us informed."* One extra referred deal per month at $28K = **$336K annually.** Plus reduces inbound anxiety calls and lifts review-request conversion at project end.

**Why #5:** Real revenue signal from Marcus's own admission, but it sits downstream of the four agents above. Build it once the bigger leaks are plugged so the customer experience matches the now-faster business.

---

## Why #1 is what it is

Marcus's stated #1 is also quote speed — but he frames it as personal pain ("it's killing us"). The right framing is the math: **35–40% of qualified leads lost to speed differential is the single largest revenue leak in a $4.2M business.** Even if Marcus had ranked this #3, the numbers would demand it be #1. The conclusion is reached by reasoning from the data, not by deferring to the founder's stack-rank — which is exactly the difference between an agent strategist and an order-taker.

## One agent I considered but cut: the Marketing/Content Agent

Marcus's stated #4. Cut deliberately. On the call he said directly: *"I cannot keep up with the leads I have."* When asked lead-volume vs. quote-volume constrained, he answered "quote." His Meta ROAS sits at 4–4.5x. He is not lead-constrained — he is *throughput*-constrained on the quote side. A content agent would be solving a non-problem and would actively worsen the existing bottleneck by stuffing more leads into a funnel that loses 35–40% of qualified deals on speed. Crew Coaching was the close runner-up cut: a real $104K/year opportunity, but an order of magnitude smaller than #1–#3 and the kind of pick that signals the priority list was set by founder enthusiasm rather than data.

---

## Assumptions & dependencies

- **GHL is the system of record.** Every agent reads from and writes back to GHL. Jenna's constraint is non-negotiable: anything outside GHL won't get used.
- **Agent #1 unblocks the funnel; Agent #3 unblocks the backlog.** Running #1 without #3 would just shift the bottleneck downstream as more deals close faster than ops can absorb them. They should be built in sequence but deployed close together.
- **Agent #4 is the force multiplier.** Without it, Marcus remains the rate limiter on agents #1–#3 because every approval still routes through him. Building it fourth (not first) is correct because there's no rule book to codify yet — the earlier agents generate the decision data the rule book learns from.
- **Voice cloning is out of scope for v1.** Marcus's "voice" in agents #2 and #5 means tone and phrasing, not synthesized audio. Real voice/video clones (HeyGen, ElevenLabs) are a v2 conversation once trust is established.
