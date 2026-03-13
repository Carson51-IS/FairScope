-- FairScope v3 — Auth, Subscriptions, Chat
-- Run after 001_initial_schema.sql and 002_doctrinal_upgrades.sql

-- ============================================================
-- subscriptions: links auth.users to Stripe
-- ============================================================
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text check (status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id);

-- ============================================================
-- chat_messages: persistent chat history per user
-- ============================================================
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_user on chat_messages(user_id);
create index if not exists idx_chat_messages_created on chat_messages(user_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table subscriptions enable row level security;
alter table chat_messages enable row level security;

-- Users can read their own subscription
create policy "Users can read own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Service role can manage subscriptions (for webhook)
create policy "Service role full access subscriptions" on subscriptions
  for all using (auth.jwt() ->> 'role' = 'service_role');

-- Users can manage their own chat messages
create policy "Users can manage own chat messages" on chat_messages
  for all using (auth.uid() = user_id);
