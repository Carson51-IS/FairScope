export type CourtLevel = "SCOTUS" | "Circuit" | "District";

export type FairUseOutcome = "found" | "not_found" | "mixed" | "remanded";

export type TreatmentType =
  | "follows"
  | "applies"
  | "distinguishes"
  | "criticizes"
  | "overrules";

export type UseType =
  | "parody"
  | "commentary"
  | "criticism"
  | "thumbnail"
  | "search_engine"
  | "music_sampling"
  | "news_reporting"
  | "nonprofit_education"
  | "commercial_remix"
  | "ai_training"
  | "biographical_excerpt"
  | "software_api"
  | "archival"
  | "satire"
  | "artistic_appropriation"
  | "research"
  | "other";

export type FactorNumber = 1 | 2 | 3 | 4;

export type FactorDirection =
  | "strongly_favors"
  | "favors"
  | "neutral"
  | "slightly_against"
  | "against"
  | "strongly_against"
  | "mixed";

export type FactorWeight = "Low" | "Moderate" | "Significant" | "Dominant";

export interface CaseLaw {
  case_id: string;
  case_name: string;
  citation: string;
  court: string;
  date: string;
  year?: number;
  circuit?: string;
  procedural_posture: string;
  fair_use_outcome: FairUseOutcome;
  jurisdiction_level: CourtLevel;
  use_types: UseType[];
  summary: string;
  factor_analyses: FactorAnalysis[];
  key_quotes: string[];
  is_post_warhol?: boolean;
}

export interface FactorAnalysis {
  factor_number: FactorNumber;
  direction: FactorDirection;
  reasoning: string;
  key_quotes: string[];
  tags: string[];
}

export interface CitationEdge {
  citing_case_id: string;
  cited_case_id: string;
  treatment_type: TreatmentType;
  citation_context: string;
}

export type CircuitId =
  | "scotus"
  | "ca1" | "ca2" | "ca3" | "ca4" | "ca5" | "ca6"
  | "ca7" | "ca8" | "ca9" | "ca10" | "ca11" | "cadc" | "cafc"
  | null;

export interface ScenarioInput {
  description: string;
  work_type: string;
  use_type: UseType;
  amount_used: number;
  is_commercial: boolean;
  purpose: string;
  licensing_available: boolean | null;
  additional_context: string;
  jurisdiction?: CircuitId;
}

export interface ExtractedFeatures {
  work_type: string;
  use_type: UseType;
  commercial: boolean;
  amount: "minimal" | "short excerpt" | "moderate" | "substantial" | "entire work";
  transformative_claim: boolean;
  market_substitution_risk: "low" | "moderate" | "high" | "unknown";
}

export interface FactorScore {
  factor_number: FactorNumber;
  factor_name: string;
  internal_score: number; // -2 to +2
  direction: FactorDirection;
  weight: FactorWeight;
  reasoning: string;
  key_cases: string[];
  key_quotes: string[];
  governing_principles: string[];
  comparison_to_facts: string;
}

export interface PrecedentStatus {
  case_name: string;
  citation: string;
  treatment_summary: string;
  later_citation_count: number;
  scotus_addressed: boolean;
  date_cutoff: string;
}

export interface RetrievedPassageInfo {
  case_name: string;
  case_id: string;
  factor_number: number | null;
  similarity: number;
  text_preview: string;
  section_heading?: string;
}

export interface MarketSubstitutionAnalysis {
  is_licensing_substitute: boolean;
  same_audience: boolean;
  same_format: boolean;
  commercial_channel_overlap: boolean;
  reasoning: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: string;
  scenario: ScenarioInput;
  extracted_features: ExtractedFeatures;
  fact_summary: string;
  ambiguities: string[];
  factor_scores: FactorScore[];
  overall_assessment: {
    strengths: string[];
    weaknesses: string[];
    litigation_risks: string[];
    fact_dependent_uncertainties: string[];
  };
  precedent_statuses: PrecedentStatus[];
  matched_cases: CaseLaw[];
  confidence: "high" | "moderate" | "low";
  disclaimer: string;
  date_cutoff: string;
  memo?: string | null;
  llm_factor_analysis?: Record<string, string> | null;
  cited_cases?: string[];
  retrieval_source?: "supabase" | "local";
  analysis_source?: "hybrid" | "rule-based";
  assumptions?: string[];
  retrieved_passages?: RetrievedPassageInfo[];
  market_substitution?: MarketSubstitutionAnalysis;
  circuit_conflicts?: string[];
}
