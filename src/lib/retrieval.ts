import { getSupabaseServer, isSupabaseConfigured } from "./supabase";
import { createEmbedding, isOpenAIConfigured, truncatePassage } from "./openai";
import type { CaseLaw, ExtractedFeatures, CitationEdge, CircuitId, RetrievedPassageInfo } from "./types";

export interface RetrievedPassage {
  case_id: string;
  db_case_id: string;
  case_name: string;
  factor_number: number | null;
  text_chunk: string;
  similarity: number;
  section_heading: string | null;
}

export interface RetrievalResult {
  matchedCases: CaseLaw[];
  passages: RetrievedPassage[];
  citationEdges: CitationEdge[];
  source: "supabase";
  passageInfo: RetrievedPassageInfo[];
  circuitConflicts: string[];
}

export async function retrieveCases(
  scenarioText: string,
  _features: ExtractedFeatures,
  options?: {
    year?: number;
    factorNumber?: number;
    limit?: number;
    circuit?: CircuitId;
  }
): Promise<RetrievalResult> {
  if (!isSupabaseConfigured() || !isOpenAIConfigured()) {
    throw new Error(
      "Supabase and OpenAI must both be configured. " +
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY in .env"
    );
  }

  const supabase = getSupabaseServer();
  const queryEmbedding = await createEmbedding(scenarioText);
  const limit = options?.limit ?? 20;

  // Try v2 function first (circuit-aware, fair_use_applied filter)
  // Fall back to v1 if v2 doesn't exist yet
  let sections: Record<string, unknown>[] | null = null;

  try {
    const { data, error } = await supabase.rpc("match_factor_sections_v2", {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_factor: options?.factorNumber ?? null,
      filter_circuit: options?.circuit ?? null,
    });
    if (!error) sections = data;
  } catch {
    // v2 not available, fall through
  }

  if (!sections) {
    const { data, error } = await supabase.rpc("match_factor_sections", {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_factor: options?.factorNumber ?? null,
    });
    if (error) throw error;
    sections = data;
  }

  const passages: RetrievedPassage[] = (sections ?? []).map(
    (s: Record<string, unknown>) => ({
      case_id: "",
      db_case_id: s.case_id as string,
      case_name: "",
      factor_number: (s.factor_number as number) ?? null,
      text_chunk: truncatePassage(s.text_chunk as string),
      similarity: s.similarity as number,
      section_heading: (s.section_heading as string) ?? null,
    })
  );

  const uniqueCaseIds = [...new Set(passages.map((p) => p.db_case_id))];

  if (uniqueCaseIds.length === 0) {
    return {
      matchedCases: [],
      passages: [],
      citationEdges: [],
      source: "supabase",
      passageInfo: [],
      circuitConflicts: [],
    };
  }

  // Fetch case metadata
  let caseQuery = supabase.from("cases").select("*").in("id", uniqueCaseIds);
  if (options?.year) {
    caseQuery = caseQuery.gte("year", options.year);
  }

  const { data: cases, error: casesErr } = await caseQuery;
  if (casesErr) throw casesErr;

  const { data: tags } = await supabase
    .from("use_type_tags")
    .select("*")
    .in("case_id", uniqueCaseIds);

  const { data: factorData } = await supabase
    .from("factor_analyses")
    .select("*")
    .in("case_id", uniqueCaseIds);

  // Map DB case_id and case_name back onto passages
  for (const p of passages) {
    const c = (cases ?? []).find(
      (c: Record<string, unknown>) => c.id === p.db_case_id
    );
    if (c) {
      p.case_id = (c as Record<string, unknown>).case_id as string;
      p.case_name = (c as Record<string, unknown>).name as string;
    }
  }

  // Build CaseLaw objects
  const matchedCases: CaseLaw[] = (cases ?? []).map(
    (c: Record<string, unknown>) => {
      const caseFactors = (factorData ?? []).filter(
        (fa: Record<string, unknown>) => fa.case_id === c.id
      );
      const caseTags = (tags ?? []).filter(
        (t: Record<string, unknown>) => t.case_id === c.id
      );

      const caseYear = (c.year as number) ?? null;
      const postWarhol = caseYear ? caseYear >= 2023 : ((c.is_post_warhol as boolean) ?? false);

      return {
        case_id: (c.case_id as string) ?? "",
        case_name: (c.name as string) ?? "",
        citation: (c.citation as string) ?? "",
        court: (c.court as string) ?? "",
        date: (c.date as string) ?? "",
        year: caseYear ?? undefined,
        circuit: (c.circuit as string) ?? undefined,
        procedural_posture: (c.procedural_posture as string) ?? "",
        fair_use_outcome: (c.fair_use_outcome as string) ?? "mixed",
        jurisdiction_level: (c.jurisdiction_level as string) ?? "Circuit",
        use_types: caseTags.map(
          (t: Record<string, unknown>) => t.tag as string
        ),
        summary: (c.summary as string) ?? "",
        factor_analyses: caseFactors.map(
          (fa: Record<string, unknown>) => ({
            factor_number: fa.factor_number as number,
            direction: (fa.direction as string) ?? "neutral",
            reasoning: (fa.reasoning as string) ?? "",
            key_quotes: (fa.key_quotes as string[]) ?? [],
            tags: (fa.tags as string[]) ?? [],
          })
        ),
        key_quotes: (c.key_quotes as string[]) ?? [],
        is_post_warhol: postWarhol,
      } as CaseLaw;
    }
  );

  // Build passage info for transparency panel
  const passageInfo: RetrievedPassageInfo[] = passages
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10)
    .map((p) => ({
      case_name: p.case_name || p.case_id,
      case_id: p.case_id,
      factor_number: p.factor_number,
      similarity: Math.round(p.similarity * 1000) / 1000,
      text_preview: p.text_chunk.slice(0, 300) + (p.text_chunk.length > 300 ? "..." : ""),
      section_heading: p.section_heading ?? undefined,
    }));

  // Detect circuit conflicts
  const circuitConflicts: string[] = [];
  if (options?.circuit && matchedCases.length > 1) {
    const userCircuit = options.circuit;
    const outOfCircuit = matchedCases.filter(
      (c) => c.circuit && c.circuit !== userCircuit && c.jurisdiction_level !== "SCOTUS"
    );
    const inCircuit = matchedCases.filter(
      (c) => c.circuit === userCircuit || c.jurisdiction_level === "SCOTUS"
    );

    if (inCircuit.length > 0 && outOfCircuit.length > 0) {
      const inCircuitOutcomes = inCircuit.map((c) => c.fair_use_outcome);
      const outOfCircuitOutcomes = outOfCircuit.map((c) => c.fair_use_outcome);

      const inFairUse = inCircuitOutcomes.filter((o) => o === "found").length;
      const outFairUse = outOfCircuitOutcomes.filter((o) => o === "found").length;
      const inNotFairUse = inCircuitOutcomes.filter((o) => o === "not_found").length;
      const outNotFairUse = outOfCircuitOutcomes.filter((o) => o === "not_found").length;

      if (
        (inFairUse > inNotFairUse && outNotFairUse > outFairUse) ||
        (inNotFairUse > inFairUse && outFairUse > outNotFairUse)
      ) {
        circuitConflicts.push(
          `Cases in your circuit (${userCircuit.toUpperCase()}) trend differently from other circuits on similar facts. ` +
          `Your circuit: ${inFairUse} found fair use, ${inNotFairUse} denied. ` +
          `Other circuits: ${outFairUse} found, ${outNotFairUse} denied.`
        );
      }
    }
  }

  // Fetch citation graph
  let citationEdges: CitationEdge[] = [];
  if (uniqueCaseIds.length > 0) {
    const { data: citationData } = await supabase
      .from("citation_graph")
      .select("*")
      .or(
        uniqueCaseIds
          .map((id) => `citing_case_id.eq.${id},cited_case_id.eq.${id}`)
          .join(",")
      );

    citationEdges = (citationData ?? []).map(
      (e: Record<string, unknown>) => {
        const citing = (cases ?? []).find(
          (c: Record<string, unknown>) => c.id === e.citing_case_id
        );
        const cited = (cases ?? []).find(
          (c: Record<string, unknown>) => c.id === e.cited_case_id
        );
        return {
          citing_case_id:
            ((citing as Record<string, unknown>)?.case_id as string) ??
            (e.citing_case_id as string),
          cited_case_id:
            ((cited as Record<string, unknown>)?.case_id as string) ??
            (e.cited_case_id as string),
          treatment_type: (e.treatment_type as string) ?? "follows",
          citation_context: (e.citation_context as string) ?? "",
        } as CitationEdge;
      }
    );
  }

  return {
    matchedCases,
    passages,
    citationEdges,
    source: "supabase",
    passageInfo,
    circuitConflicts,
  };
}
