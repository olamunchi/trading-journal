-- Trading Journal — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists trades (
  id             text primary key,          -- "nt8-<entryMs>-<exitMs>" from api/trades.js
  created_at     timestamptz default now(),

  -- mirrors the in-app Trade object (src/store/tradeStore.js)
  instrument     text not null,
  side           text not null check (side in ('long','short')),
  qty            int,
  entry_price    numeric not null,
  exit_price     numeric not null,
  entry_time     timestamptz not null,
  exit_time      timestamptz not null,
  profit         numeric not null,
  commission     numeric default 0,
  mae            numeric,
  mfe            numeric,
  strategy_name  text,
  account        text,

  -- filled later by the user in the journal UI (all nullable)
  note            text,
  tags            text[],
  stop_price      numeric,
  execution_score int,
  mood            text,
  confidence      text,
  followed_plan   boolean,
  mistake_type    text,
  denisenko       jsonb
);

create index if not exists trades_entry_time_idx on trades (entry_time);

-- Row-level security: the public anon key (shipped in the browser) may only
-- READ. All inserts/updates go through the Vercel function using the service
-- key, which bypasses RLS.
alter table trades enable row level security;

drop policy if exists "anon read" on trades;
create policy "anon read" on trades for select using (true);

-- Prop-firm challenge attempts for PropTraderAccountTool (NT8 indicator). One row per
-- attempt on an account; exactly one open row (ended_at is null) per account at a time.
-- api/prop-summary.js scopes its trade replay to [started_at, now) of the current open
-- attempt; api/challenge-attempt-close.js closes the open attempt and opens the next one
-- the moment NT8 detects a pass or fail, so the next trade counts toward a fresh attempt.
create table if not exists challenge_attempts (
  id          bigserial primary key,
  account     text not null,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  outcome     text check (outcome in ('passed','failed')),
  created_at  timestamptz default now()
);

create index if not exists challenge_attempts_account_idx on challenge_attempts (account, started_at);

alter table challenge_attempts enable row level security;

drop policy if exists "anon read" on challenge_attempts;
create policy "anon read" on challenge_attempts for select using (true);
