-- FairScope — Free-tier usage tracking
-- Run after 003_auth_subscriptions_chat.sql

-- ============================================================
-- user_usage: tracks free AI uses per user
-- ============================================================
create table if not exists user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_analyses_consumed int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_usage_user on user_usage(user_id);

-- ============================================================
-- RLS
-- ============================================================
alter table user_usage enable row level security;

-- Users can read their own usage row
create policy "Users can read own usage" on user_usage
  for select using (auth.uid() = user_id);

-- Service role manages writes (consume RPC runs as definer)
create policy "Service role full access usage" on user_usage
  for all using (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- consume_free_analysis_use: atomic increment, capped at p_limit
-- Returns new consumed count on success, NULL when limit reached.
-- ============================================================
create or replace function consume_free_analysis_use(
  p_user_id uuid,
  p_limit int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_consumed int;
begin
  insert into user_usage (user_id, free_analyses_consumed)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  update user_usage
  set free_analyses_consumed = free_analyses_consumed + 1,
      updated_at = now()
  where user_id = p_user_id
    and free_analyses_consumed < p_limit
  returning free_analyses_consumed into new_consumed;

  return new_consumed;
end;
$$;

grant execute on function consume_free_analysis_use(uuid, int) to service_role;
