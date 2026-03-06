-- FairScope v2 — Doctrinal Upgrades
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

-- ============================================================
-- Add doctrinal metadata columns to cases
-- ============================================================
alter table cases add column if not exists fair_use_applied boolean default false;
alter table cases add column if not exists circuit text;
alter table cases add column if not exists is_post_warhol boolean default false;
alter table cases add column if not exists procedural_posture_type text;
alter table cases add column if not exists fair_use_classifier_confidence numeric;

create index if not exists idx_cases_circuit on cases(circuit);
create index if not exists idx_cases_fair_use_applied on cases(fair_use_applied);

-- ============================================================
-- Add section_heading to factor_sections for hierarchical chunking
-- ============================================================
alter table factor_sections add column if not exists section_heading text;
alter table factor_sections add column if not exists factor_confidence numeric;

-- ============================================================
-- Canonical quotes table
-- ============================================================
create table if not exists canonical_quotes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  factor_number int check (factor_number between 1 and 4),
  quote text not null,
  attribution text,
  citation_page text,
  approved boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_canonical_quotes_case on canonical_quotes(case_id);
create index if not exists idx_canonical_quotes_factor on canonical_quotes(factor_number);

-- ============================================================
-- Add jurisdiction field to analyses for circuit-aware analysis
-- ============================================================
alter table analyses add column if not exists jurisdiction text;

-- ============================================================
-- Update match function to support circuit filtering
-- ============================================================
create or replace function match_factor_sections_v2(
  query_embedding vector(1536),
  match_count int default 20,
  filter_factor int default null,
  filter_circuit text default null
)
returns table (
  id uuid,
  case_id uuid,
  factor_number int,
  text_chunk text,
  section_heading text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    fs.id,
    fs.case_id,
    fs.factor_number,
    fs.text_chunk,
    fs.section_heading,
    1 - (fs.embedding <=> query_embedding) as similarity
  from factor_sections fs
  inner join cases c on c.id = fs.case_id
  where
    fs.embedding is not null
    and (filter_factor is null or fs.factor_number = filter_factor)
    and (filter_circuit is null or c.circuit = filter_circuit or c.jurisdiction_level = 'SCOTUS')
    and c.fair_use_applied = true
  order by fs.embedding <=> query_embedding
  limit match_count;
end;
$$;
