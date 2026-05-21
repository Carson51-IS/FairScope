-- FairScope — Lock down public tables and vector RPCs (service_role only)
-- Safe to re-run: drops policies before recreate.

alter table cases enable row level security;
alter table factor_analyses enable row level security;
alter table factor_sections enable row level security;
alter table use_type_tags enable row level security;
alter table citation_graph enable row level security;
alter table canonical_quotes enable row level security;
alter table analyses enable row level security;

drop policy if exists "service_role_all_cases" on cases;
create policy "service_role_all_cases" on cases
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_factor_analyses" on factor_analyses;
create policy "service_role_all_factor_analyses" on factor_analyses
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_factor_sections" on factor_sections;
create policy "service_role_all_factor_sections" on factor_sections
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_use_type_tags" on use_type_tags;
create policy "service_role_all_use_type_tags" on use_type_tags
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_citation_graph" on citation_graph;
create policy "service_role_all_citation_graph" on citation_graph
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_canonical_quotes" on canonical_quotes;
create policy "service_role_all_canonical_quotes" on canonical_quotes
  for all using (auth.jwt() ->> 'role' = 'service_role');

drop policy if exists "service_role_all_analyses" on analyses;
create policy "service_role_all_analyses" on analyses
  for all using (auth.jwt() ->> 'role' = 'service_role');

revoke execute on function public.match_factor_sections(vector, int, int)
  from public, anon, authenticated;
revoke execute on function public.match_factor_sections_v2(vector, int, int, text)
  from public, anon, authenticated;
grant execute on function public.match_factor_sections(vector, int, int) to service_role;
grant execute on function public.match_factor_sections_v2(vector, int, int, text) to service_role;
