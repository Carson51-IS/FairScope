-- FairScope — Tie saved analyses to auth.users (ownership for API + optional RLS)

alter table analyses
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_analyses_user_id on analyses(user_id);

drop policy if exists "Users read own analyses" on analyses;
create policy "Users read own analyses" on analyses
  for select using (auth.uid() = user_id);
