-- Greenscape Quote Drafter — initial schema
-- Run in Supabase SQL editor (or `supabase db push` if CLI is set up).

create extension if not exists "pgcrypto";

-- ============================================================================
-- pricing_items: Greenscape's seedable pricing sheet
-- ============================================================================
create table if not exists pricing_items (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,
  name            text not null,
  unit            text not null check (unit in ('sqft','linear_ft','each','hour','lump_sum')),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  description     text not null default '',
  keywords        text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists pricing_items_category_idx on pricing_items (category);
create index if not exists pricing_items_keywords_idx on pricing_items using gin (keywords);

-- ============================================================================
-- proposals: one row per customer quote
-- ============================================================================
create table if not exists proposals (
  id                  uuid primary key default gen_random_uuid(),
  customer_name       text not null,
  customer_email      text not null,
  customer_phone      text not null default '',
  project_address     text not null,
  site_walk_notes     text not null,
  extracted_scope     jsonb,
  line_items          jsonb,
  subtotal_cents      integer not null default 0,
  total_cents         integer not null default 0,
  proposal_markdown   text,
  status              text not null default 'draft'
                         check (status in ('draft','pending_approval','approved','rejected','sent','error')),
  requires_render     boolean not null default false,
  stripe_payment_link text,
  slack_message_ts    text,
  approved_at         timestamptz,
  rejected_at         timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists proposals_status_idx on proposals (status);
create index if not exists proposals_created_at_idx on proposals (created_at desc);

-- Maintain updated_at on every UPDATE.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proposals_set_updated_at on proposals;
create trigger proposals_set_updated_at
  before update on proposals
  for each row execute function set_updated_at();

-- ============================================================================
-- proposal_events: audit log of every state transition + side effect
-- ============================================================================
create table if not exists proposal_events (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references proposals(id) on delete cascade,
  event_type   text not null
                 check (event_type in (
                   'created','extracted','drafted','submitted_for_approval',
                   'approved','rejected','sent','error',
                   'slack_posted','slack_failed','stripe_link_created','stripe_failed',
                   'email_mocked'
                 )),
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists proposal_events_proposal_id_idx on proposal_events (proposal_id, created_at);

-- Note: For the take-home demo we are using the service role key from server-side
-- API routes only, so RLS is intentionally left disabled. In production we would:
--   alter table proposals enable row level security;
--   alter table proposal_events enable row level security;
--   alter table pricing_items enable row level security;
-- ...and add policies scoped to the authenticated tenant (Marcus's org).
