/**
 * Case law types are defined in types.ts.
 *
 * Previously this file contained a hardcoded CASE_DATABASE and CITATION_GRAPH.
 * All case data now lives in Supabase, populated via:
 *   npm run fetch   — downloads cases from CourtListener
 *   npm run ingest  — processes and stores them in Supabase with embeddings
 */
