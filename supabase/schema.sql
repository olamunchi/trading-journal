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
