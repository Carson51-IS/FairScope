-- FairScope Database Schema
-- Run this in Supabase SQL Editor or via CLI migration

-- Enable pgvector for embedding storage
create extension if not exists vector;

-- ============================================================
-- 1. cases — stores case law opinions
-- ============================================================
create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  case_id text unique,
  name text not null,
  citation text,
  court text,
  year int,
  date text,
  procedural_posture text,
  fair_use_outcome text,
  jurisdiction_level text,
  use_types text[] default '{}',
  opinion_text text,
  summary text,
  key_quotes text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_cases_case_id on cases(case_id);
create index if not exists idx_cases_year on cases(year);
create index if not exists idx_cases_court on cases(court);

-- ============================================================
-- 2. factor_analyses — per-case, per-factor structured data
-- ============================================================
create table if not exists factor_analyses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  factor_number int not null check (factor_number between 1 and 4),
  direction text,
  reasoning text,
  key_quotes text[] default '{}',
  tags text[] default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_factor_analyses_case on factor_analyses(case_id);

-- ============================================================
-- 3. factor_sections — chunked text with embeddings for RAG
-- ============================================================
create table if not exists factor_sections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  factor_number int check (factor_number between 1 and 4),
  text_chunk text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists idx_factor_sections_case on factor_sections(case_id);
create index if not exists idx_factor_sections_factor on factor_sections(factor_number);

-- ============================================================
-- 4. use_type_tags
-- ============================================================
create table if not exists use_type_tags (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  tag text not null
);

create index if not exists idx_use_type_tags_case on use_type_tags(case_id);
create index if not exists idx_use_type_tags_tag on use_type_tags(tag);

-- ============================================================
-- 5. citation_graph
-- ============================================================
create table if not exists citation_graph (
  id uuid primary key default gen_random_uuid(),
  citing_case_id uuid references cases(id),
  cited_case_id uuid references cases(id),
  treatment_type text,
  citation_context text
);

create index if not exists idx_citation_graph_citing on citation_graph(citing_case_id);
create index if not exists idx_citation_graph_cited on citation_graph(cited_case_id);

-- ============================================================
-- 6. analyses — persisted analysis results
-- ============================================================
create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  scenario jsonb not null,
  structured_features jsonb,
  retrieved_case_ids uuid[] default '{}',
  memo text,
  factor_scores jsonb,
  overall_assessment jsonb,
  precedent_statuses jsonb,
  matched_cases jsonb,
  confidence text,
  fact_summary text,
  ambiguities text[] default '{}',
  full_result jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_analyses_created on analyses(created_at desc);

-- ============================================================
-- Vector similarity search function
-- ============================================================
create or replace function match_factor_sections(
  query_embedding vector(1536),
  match_count int default 20,
  filter_factor int default null
)
returns table (
  id uuid,
  case_id uuid,
  factor_number int,
  text_chunk text,
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
    1 - (fs.embedding <=> query_embedding) as similarity
  from factor_sections fs
  where
    fs.embedding is not null
    and (filter_factor is null or fs.factor_number = filter_factor)
  order by fs.embedding <=> query_embedding
  limit match_count;
end;
$$;
