-- FairScope — Free-tier quota for chat and other secondary AI features

alter table user_usage
  add column if not exists free_auxiliary_ai_consumed int not null default 0;

-- Atomic increment for auxiliary AI (chat, standalone extract/memo), capped at p_limit
create or replace function consume_free_auxiliary_ai_use(
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
  insert into user_usage (user_id, free_analyses_consumed, free_auxiliary_ai_consumed)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  update user_usage
  set free_auxiliary_ai_consumed = free_auxiliary_ai_consumed + 1,
      updated_at = now()
  where user_id = p_user_id
    and free_auxiliary_ai_consumed < p_limit
  returning free_auxiliary_ai_consumed into new_consumed;

  return new_consumed;
end;
$$;

grant execute on function consume_free_auxiliary_ai_use(uuid, int) to service_role;
