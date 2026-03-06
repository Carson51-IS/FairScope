import {
  ScenarioInput,
  ExtractedFeatures,
  CaseLaw,
  CitationEdge,
  FactorScore,
  FactorNumber,
  FactorDirection,
  FactorWeight,
  FactorAnalysis,
  PrecedentStatus,
  AnalysisResult,
  UseType,
  MarketSubstitutionAnalysis,
  RetrievedPassageInfo,
} from "./types";
import { retrieveCases, RetrievalResult } from "./retrieval";
import { isOpenAIConfigured } from "./openai";
import { isSupabaseConfigured, getSupabaseServer } from "./supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const DISCLAIMER =
  "This analysis is informational and based only on the cases reviewed. " +
  "It does not constitute legal advice. You should consult a qualified " +
  "copyright attorney before relying on this analysis.";

const USE_TYPE_FAMILIES: Record<string, UseType[]> = {
  parody_satire: ["parody", "satire", "commentary", "criticism"],
  search_index: ["thumbnail", "search_engine", "archival"],
  appropriation: ["artistic_appropriation", "commercial_remix"],
  reporting: ["news_reporting", "biographical_excerpt"],
  education_research: ["nonprofit_education", "research"],
  technology: ["software_api", "ai_training"],
  music: ["music_sampling", "commercial_remix"],
};

function useTypeFamily(t: UseType): string {
  for (const [family, members] of Object.entries(USE_TYPE_FAMILIES)) {
    if (members.includes(t)) return family;
  }
  return "other";
}

function directionToScore(d: FactorDirection): number {
  switch (d) {
    case "strongly_favors": return 2;
    case "favors": return 1;
    case "neutral": return 0;
    case "slightly_against": return -0.5;
    case "mixed": return 0;
    case "against": return -1;
    case "strongly_against": return -2;
  }
}

function scoreToDirection(s: number): FactorDirection {
  if (s >= 1.5) return "strongly_favors";
  if (s >= 0.75) return "favors";
  if (s > 0.25) return "favors";
  if (s > -0.25) return "neutral";
  if (s >= -0.75) return "slightly_against";
  if (s >= -1.5) return "against";
  return "strongly_against";
}

function scoreToWeight(s: number): FactorWeight {
  const abs = Math.abs(s);
  if (abs >= 1.5) return "Dominant";
  if (abs >= 1.0) return "Significant";
  if (abs >= 0.5) return "Moderate";
  return "Low";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const FACTOR_NAMES: Record<FactorNumber, string> = {
  1: "Purpose and Character of the Use",
  2: "Nature of the Copyrighted Work",
  3: "Amount and Substantiality of the Portion Used",
  4: "Effect on the Market for the Original",
};

// ---------------------------------------------------------------------------
// Transformativeness keyword detection
// ---------------------------------------------------------------------------

const TRANSFORMATIVE_SIGNALS = [
  "parody", "satire", "commentary", "criticism", "critique",
  "transform", "new purpose", "different purpose", "different character",
  "new meaning", "new expression", "recontextualiz", "reimagine",
  "educational", "research", "scholarship", "indexing", "search",
  "archive", "preservation", "reporting", "news",
];

function detectTransformativeClaim(scenario: ScenarioInput): boolean {
  const text = `${scenario.description} ${scenario.purpose} ${scenario.additional_context}`.toLowerCase();
  return TRANSFORMATIVE_SIGNALS.some((sig) => text.includes(sig));
}

// ---------------------------------------------------------------------------
// 1. extractFeatures
// ---------------------------------------------------------------------------

export function extractFeatures(scenario: ScenarioInput): ExtractedFeatures {
  const amount = quantizeAmount(scenario.amount_used);
  const transformative_claim = detectTransformativeClaim(scenario);
  const market_substitution_risk = estimateMarketRisk(scenario, amount, transformative_claim);

  return {
    work_type: scenario.work_type,
    use_type: scenario.use_type,
    commercial: scenario.is_commercial,
    amount,
    transformative_claim,
    market_substitution_risk,
  };
}

function quantizeAmount(
  pct: number,
): ExtractedFeatures["amount"] {
  if (pct <= 5) return "minimal";
  if (pct <= 15) return "short excerpt";
  if (pct <= 40) return "moderate";
  if (pct <= 75) return "substantial";
  return "entire work";
}

function estimateMarketRisk(
  scenario: ScenarioInput,
  amount: ExtractedFeatures["amount"],
  transformative: boolean,
): ExtractedFeatures["market_substitution_risk"] {
  let risk = 0;

  if (scenario.is_commercial) risk += 2;
  if (amount === "entire work") risk += 2;
  else if (amount === "substantial") risk += 1;
  if (scenario.licensing_available) risk += 1;
  if (!transformative) risk += 1;

  const lowRiskTypes: UseType[] = [
    "parody", "criticism", "commentary", "search_engine",
    "thumbnail", "news_reporting", "research", "nonprofit_education",
  ];
  if (lowRiskTypes.includes(scenario.use_type)) risk -= 1;

  if (risk <= 1) return "low";
  if (risk <= 3) return "moderate";
  if (risk >= 4) return "high";
  return "unknown";
}

// ---------------------------------------------------------------------------
// 2. findMatchingCases
// ---------------------------------------------------------------------------

export function findMatchingCases(
  features: ExtractedFeatures,
  cases: CaseLaw[],
): CaseLaw[] {
  const scored = cases.map((c) => ({
    caseData: c,
    relevance: computeRelevance(features, c),
  }));

  scored.sort((a, b) => b.relevance - a.relevance);

  const topN = scored.slice(0, 8).filter((s) => s.relevance > 0);
  if (topN.length < 5) return scored.slice(0, 5).map((s) => s.caseData);
  return topN.map((s) => s.caseData);
}

function computeRelevance(features: ExtractedFeatures, c: CaseLaw): number {
  let score = 0;

  // Direct use-type match is the strongest signal
  if (c.use_types.includes(features.use_type)) {
    score += 10;
  }

  // Same family match
  const family = useTypeFamily(features.use_type);
  const caseFamily = c.use_types.map(useTypeFamily);
  if (caseFamily.includes(family)) {
    score += 5;
  }

  // Commercial alignment
  const caseIsCommercial = c.use_types.includes("commercial_remix");
  if (features.commercial === caseIsCommercial) {
    score += 3;
  }

  // SCOTUS cases get a relevance boost (binding authority)
  if (c.jurisdiction_level === "SCOTUS") {
    score += 4;
  } else if (c.jurisdiction_level === "Circuit") {
    score += 2;
  }

  // Amount-related tag alignment for factor 3
  const allTags = c.factor_analyses.flatMap((fa) => fa.tags);
  if (
    features.amount === "entire work" &&
    allTags.some((t) => t.includes("entire-work"))
  ) {
    score += 2;
  }
  if (
    features.transformative_claim &&
    allTags.some((t) => t.includes("transformative"))
  ) {
    score += 3;
  }

  // Market substitution alignment
  if (
    features.market_substitution_risk === "high" &&
    allTags.some((t) =>
      t.includes("market-harm") || t.includes("actual-market-harm"),
    )
  ) {
    score += 2;
  }
  if (
    features.market_substitution_risk === "low" &&
    allTags.some((t) =>
      t.includes("no-substitution") || t.includes("no-market"),
    )
  ) {
    score += 2;
  }

  // Work-type textual similarity (basic keyword overlap)
  const workLower = features.work_type.toLowerCase();
  const summaryLower = c.summary.toLowerCase();
  const workWords = workLower.split(/\s+/);
  for (const w of workWords) {
    if (w.length > 3 && summaryLower.includes(w)) {
      score += 1;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// 3. scoreFactors
// ---------------------------------------------------------------------------

export function scoreFactors(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore[] {
  return ([1, 2, 3, 4] as FactorNumber[]).map((fn) =>
    scoreSingleFactor(fn, scenario, features, matchedCases),
  );
}

function scoreSingleFactor(
  factorNum: FactorNumber,
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore {
  switch (factorNum) {
    case 1:
      return scoreFactor1(scenario, features, matchedCases);
    case 2:
      return scoreFactor2(scenario, features, matchedCases);
    case 3:
      return scoreFactor3(scenario, features, matchedCases);
    case 4:
      return scoreFactor4(scenario, features, matchedCases);
  }
}

// ---- Factor 1: Purpose and Character of the Use ----

function scoreFactor1(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore {
  let raw = 0;

  // Transformative claim is the most significant driver
  if (features.transformative_claim) raw += 1.0;

  // Use-type adjustments
  const stronglyFavoredUses: UseType[] = [
    "parody", "criticism", "commentary", "search_engine", "thumbnail",
    "news_reporting", "research", "nonprofit_education",
  ];
  const moderatelyFavoredUses: UseType[] = [
    "satire", "biographical_excerpt", "archival", "software_api",
  ];
  const disfavoredUses: UseType[] = ["commercial_remix"];

  if (stronglyFavoredUses.includes(features.use_type)) raw += 0.8;
  else if (moderatelyFavoredUses.includes(features.use_type)) raw += 0.4;
  else if (disfavoredUses.includes(features.use_type)) raw -= 0.4;

  // Commercial nature weighs against, but does not presume against fair use
  // per Campbell v. Acuff-Rose
  if (features.commercial) raw -= 0.5;

  // ── Post-Warhol Recalibration ──
  // After Andy Warhol Foundation v. Goldsmith (2023), transformative use
  // alone is not enough when the use is commercial and serves the same
  // purpose as the original. Commercial licensing market substitution
  // now matters even if the new work adds "new meaning."
  if (features.commercial && features.transformative_claim) {
    // Warhol narrows transformativeness for commercial same-purpose uses
    if (features.market_substitution_risk === "high") {
      raw -= 0.4; // Strong downward pressure post-Warhol
    } else if (features.market_substitution_risk === "moderate") {
      raw -= 0.2;
    }
  }

  // Post-Warhol: "artistic_appropriation" and "commercial_remix" face
  // heightened scrutiny even with transformative elements
  if (features.use_type === "artistic_appropriation" && features.commercial) {
    raw -= 0.3;
  }

  // Aggregate signal from matched cases
  const caseSignals = extractCaseSignals(1, matchedCases);
  raw += caseSignals.avgScore * 0.3;

  raw = clamp(raw, -2, 2);

  const reasoning = buildFactor1Reasoning(scenario, features, matchedCases, raw);
  const keyCases = relevantCaseNames(1, matchedCases);
  const keyQuotes = collectQuotes(1, matchedCases);
  const principles = factor1Principles(features);
  const comparison = factor1Comparison(scenario, features, matchedCases);

  return {
    factor_number: 1,
    factor_name: FACTOR_NAMES[1],
    internal_score: Math.round(raw * 100) / 100,
    direction: scoreToDirection(raw),
    weight: scoreToWeight(raw),
    reasoning,
    key_cases: keyCases,
    key_quotes: keyQuotes.slice(0, 4),
    governing_principles: principles,
    comparison_to_facts: comparison,
  };
}

function buildFactor1Reasoning(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  score: number,
): string {
  const parts: string[] = [];

  parts.push(
    `Under the first statutory factor, courts examine whether the new use "merely supersedes the objects" ` +
    `of the original creation or "adds something new, with a further purpose or different character." ` +
    `Campbell v. Acuff-Rose Music, Inc., 510 U.S. 569, 579 (1994). Since the Supreme Court's decision in ` +
    `Andy Warhol Foundation v. Goldsmith, 598 U.S. 508 (2023), this inquiry focuses not just on whether ` +
    `the secondary work is aesthetically different, but whether the specific use at issue has a ` +
    `"sufficiently distinct" purpose or character from the original.`,
  );

  if (features.transformative_claim) {
    parts.push(
      `The described use—${scenario.purpose}—appears to assert a transformative purpose. ` +
      `The use is characterized as "${features.use_type.replace(/_/g, " ")}", which courts ` +
      `have generally recognized as capable of serving a purpose different from the original work's ` +
      `expressive function. However, the degree of transformativeness would depend on the specific ` +
      `facts and how substantially the new work alters the original's purpose, meaning, or message.`,
    );
  } else {
    parts.push(
      `The described purpose does not clearly articulate a transformative rationale. Courts look ` +
      `for whether the secondary use serves a fundamentally different purpose from the original, ` +
      `and the absence of a clear transformative claim may weaken this factor. A use that merely ` +
      `repackages the original expression for the same purpose is less likely to be considered fair.`,
    );
  }

  if (features.commercial) {
    parts.push(
      `The commercial nature of the use is a relevant consideration, though Campbell clarified ` +
      `that "the more transformative the new work, the less will be the significance of other ` +
      `factors, like commercialism, that may weigh against a finding of fair use." 510 U.S. at 579. ` +
      `Nevertheless, after Warhol, commercial uses that share the same purpose as the original ` +
      `face heightened scrutiny under this factor.`,
    );
  } else {
    parts.push(
      `The noncommercial nature of the use is a favorable consideration. Under Sony Corp. v. ` +
      `Universal City Studios, 464 U.S. 417 (1984), noncommercial uses benefit from a presumption ` +
      `that the use is not harmful, though this presumption is not dispositive.`,
    );
  }

  const analogous = matchedCases.filter((c) =>
    c.use_types.some((ut) => useTypeFamily(ut) === useTypeFamily(features.use_type)),
  );
  if (analogous.length > 0) {
    const names = analogous.slice(0, 3).map((c) => c.case_name).join("; ");
    const outcomes = analogous.slice(0, 3).map((c) => {
      const fa = c.factor_analyses.find((f) => f.factor_number === 1);
      return fa ? `${c.case_name} (${fa.direction.replace(/_/g, " ")})` : c.case_name;
    });
    parts.push(
      `Among the most analogous precedents, courts have assessed similar uses as follows: ` +
      `${outcomes.join("; ")}. These cases provide the closest factual parallels, though ` +
      `each fair use determination is inherently fact-specific.`,
    );
  }

  if (score > 0.5) {
    parts.push(
      `On balance, the first factor appears likely to favor a finding of fair use, though ` +
      `the strength of this conclusion depends on whether a court would agree that the use ` +
      `serves a genuinely distinct purpose from the original.`,
    );
  } else if (score < -0.5) {
    parts.push(
      `On balance, the first factor appears likely to weigh against fair use. The combination ` +
      `of purpose, character, and commercial considerations suggests that a court may find ` +
      `the use insufficiently transformative to support this factor.`,
    );
  } else {
    parts.push(
      `The first factor presents a close question. The analysis could tip in either direction ` +
      `depending on how a court evaluates the degree of transformativeness and the specific ` +
      `purpose of the use in relation to the original.`,
    );
  }

  return parts.join("\n\n");
}

function factor1Principles(features: ExtractedFeatures): string[] {
  const principles = [
    "The central question is whether the new work 'adds something new, with a further purpose or different character' (Campbell, 510 U.S. at 579).",
    "After Warhol v. Goldsmith, the inquiry focuses on the specific use at issue, not just whether the secondary work is aesthetically different.",
    "Commercial character is relevant but does not create a presumption against fair use (Campbell, 510 U.S. at 584).",
  ];

  if (features.use_type === "parody" || features.use_type === "satire") {
    principles.push(
      "Parody has an obvious claim to transformative value because it provides social benefit by 'shedding light on an earlier work, and, in the process, creating a new one' (Campbell, 510 U.S. at 579).",
    );
  }
  if (features.use_type === "search_engine" || features.use_type === "thumbnail") {
    principles.push(
      "Search engines and thumbnail displays serve a transformative indexing function distinct from the original expressive purpose (Perfect 10 v. Amazon, 508 F.3d at 1165).",
    );
  }
  if (features.use_type === "software_api") {
    principles.push(
      "Reimplementation of a functional API in a new platform context can be transformative when it enables programmer investment and creativity in a new environment (Google v. Oracle, 593 U.S. 1).",
    );
  }
  if (features.use_type === "news_reporting") {
    principles.push(
      "News reporting is a specifically enumerated fair use purpose under § 107, though this does not guarantee fair use when the use goes beyond reporting facts to reproduce expressive content (Harper & Row, 471 U.S. at 561).",
    );
  }

  return principles;
}

function factor1Comparison(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): string {
  const parts: string[] = [];

  const bestMatch = matchedCases.find((c) =>
    c.use_types.includes(features.use_type),
  );

  if (bestMatch) {
    const fa = bestMatch.factor_analyses.find((f) => f.factor_number === 1);
    parts.push(
      `Compared to ${bestMatch.case_name}, where the court found the use ` +
      `${fa?.direction.replace(/_/g, " ") ?? "relevant"} under Factor 1: ` +
      `the present scenario involves a "${features.use_type.replace(/_/g, " ")}" use ` +
      `that is ${features.commercial ? "commercial" : "noncommercial"} in nature.`,
    );
    if (fa?.reasoning) {
      parts.push(
        `In ${bestMatch.case_name}, the court reasoned: "${fa.reasoning}" ` +
        `Whether the present facts would receive similar treatment depends on the ` +
        `degree to which the use serves a genuinely distinct purpose.`,
      );
    }
  } else {
    parts.push(
      `No directly on-point precedent was identified for "${features.use_type.replace(/_/g, " ")}" uses. ` +
      `Courts would likely reason by analogy to the closest available authorities, applying ` +
      `the general transformative use framework from Campbell.`,
    );
  }

  return parts.join(" ");
}

// ---- Factor 2: Nature of the Copyrighted Work ----

function scoreFactor2(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore {
  let raw = 0;

  // Factual works get more fair use latitude than creative works
  const factualSignals = [
    "factual", "informational", "data", "api", "functional",
    "technical", "scientific", "report", "database", "code",
    "software", "manual", "instruction", "reference",
  ];
  const creativeSignals = [
    "novel", "fiction", "song", "music", "poem", "photograph",
    "film", "movie", "painting", "artwork", "creative", "literary",
    "artistic", "story", "narrative",
  ];

  const workLower = `${features.work_type} ${scenario.description}`.toLowerCase();

  const isFactual = factualSignals.some((s) => workLower.includes(s));
  const isCreative = creativeSignals.some((s) => workLower.includes(s));

  if (isFactual && !isCreative) raw += 0.8;
  else if (isCreative && !isFactual) raw -= 0.7;
  else if (isFactual && isCreative) raw += 0.1;
  else raw -= 0.3; // unknown defaults slightly against

  // Published vs unpublished — unpublished works get stronger protection
  const unpublishedSignals = ["unpublished", "unreleased", "draft", "manuscript", "private"];
  const isUnpublished = unpublishedSignals.some((s) => workLower.includes(s));
  if (isUnpublished) raw -= 0.8;

  // When the use is highly transformative, Factor 2 carries less weight
  if (features.transformative_claim) raw *= 0.7;

  const caseSignals = extractCaseSignals(2, matchedCases);
  raw += caseSignals.avgScore * 0.2;

  raw = clamp(raw, -2, 2);

  const reasoning = buildFactor2Reasoning(scenario, features, matchedCases, raw, isFactual, isCreative, isUnpublished);
  const keyCases = relevantCaseNames(2, matchedCases);
  const keyQuotes = collectQuotes(2, matchedCases);

  return {
    factor_number: 2,
    factor_name: FACTOR_NAMES[2],
    internal_score: Math.round(raw * 100) / 100,
    direction: scoreToDirection(raw),
    weight: scoreToWeight(raw),
    reasoning,
    key_cases: keyCases,
    key_quotes: keyQuotes.slice(0, 3),
    governing_principles: [
      "Some works are 'closer to the core of intended copyright protection than others' (Campbell, 510 U.S. at 586).",
      "Creative, expressive works receive stronger protection than factual or functional works.",
      "Unpublished works receive heightened protection; the author's right of first publication is a significant consideration (Harper & Row, 471 U.S. at 564).",
      "This factor is 'of limited usefulness where the creative work of art is being used for a transformative purpose' (Blanch v. Koons, 467 F.3d at 257).",
    ],
    comparison_to_facts: buildFactor2Comparison(features, matchedCases, isFactual),
  };
}

function buildFactor2Reasoning(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  score: number,
  isFactual: boolean,
  isCreative: boolean,
  isUnpublished: boolean,
): string {
  const parts: string[] = [];

  parts.push(
    `The second fair use factor examines the nature of the copyrighted work, recognizing ` +
    `that "some works are closer to the core of intended copyright protection than others." ` +
    `Campbell, 510 U.S. at 586. This factor considers two primary dimensions: (1) whether ` +
    `the work is creative or factual in nature, and (2) whether it has been published.`,
  );

  if (isCreative) {
    parts.push(
      `The original work appears to be a creative, expressive work ("${features.work_type}"), ` +
      `which places it closer to the core of copyright protection. Creative works—such as ` +
      `novels, songs, photographs, and films—receive the strongest copyright protection because ` +
      `they represent the type of original expression the Copyright Act was designed to protect. ` +
      `This weighs against a finding of fair use under this factor.`,
    );
  } else if (isFactual) {
    parts.push(
      `The original work appears to be primarily factual or functional in nature ("${features.work_type}"), ` +
      `which places it further from the core of copyright protection. The Supreme Court has recognized ` +
      `that the scope of fair use is broader when the copyrighted work is factual or informational, ` +
      `as there is a greater public interest in the dissemination of factual works. This weighs ` +
      `in favor of fair use under this factor.`,
    );
  } else {
    parts.push(
      `The nature of the original work ("${features.work_type}") is not clearly categorizable ` +
      `as purely creative or purely factual. Courts would need to examine the specific content ` +
      `to determine where it falls on the spectrum of copyright protection.`,
    );
  }

  if (isUnpublished) {
    parts.push(
      `Critically, the original work appears to be unpublished. Under Harper & Row v. Nation ` +
      `Enterprises, 471 U.S. 539 (1985), the unpublished nature of a work is a "key" factor ` +
      `that weighs heavily against fair use. The author's right to control first publication ` +
      `is a significant copyright interest that courts treat with great deference.`,
    );
  }

  if (features.transformative_claim) {
    parts.push(
      `However, courts have consistently noted that this factor carries diminished weight ` +
      `when the secondary use is transformative. In Blanch v. Koons, 467 F.3d 244, 257 ` +
      `(2d Cir. 2006), the court observed that this factor is "of limited usefulness where ` +
      `the creative work of art is being used for a transformative purpose." Similarly, in ` +
      `the thumbnail and search engine cases, courts gave this factor limited weight given ` +
      `the highly transformative nature of the indexing function.`,
    );
  }

  if (score > 0.25) {
    parts.push(
      `This factor appears likely to favor fair use, though it is typically given less ` +
      `weight than the other three factors in the overall analysis.`,
    );
  } else if (score < -0.25) {
    parts.push(
      `This factor appears likely to weigh against fair use, though its significance ` +
      `may be tempered if the use is found to be highly transformative under Factor 1.`,
    );
  } else {
    parts.push(
      `This factor is likely neutral or of limited significance in the overall analysis.`,
    );
  }

  return parts.join("\n\n");
}

function buildFactor2Comparison(
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  isFactual: boolean,
): string {
  const relevant = matchedCases.filter((c) => {
    const fa = c.factor_analyses.find((f) => f.factor_number === 2);
    return fa !== undefined;
  });

  if (relevant.length === 0) {
    return "No closely analogous precedent was identified for Factor 2 comparison.";
  }

  const c = relevant[0];
  const fa = c.factor_analyses.find((f) => f.factor_number === 2)!;
  return (
    `In ${c.case_name}, the court treated Factor 2 as ` +
    `${fa.direction.replace(/_/g, " ")} because ${fa.reasoning} ` +
    `The present scenario involves a "${features.work_type}" original work, ` +
    `which a court would need to evaluate on the factual-creative spectrum. ` +
    `${isFactual ? "The factual nature of the work may provide additional support for fair use under this factor." : "The creative nature of the work suggests this factor may weigh against fair use, consistent with the treatment in " + c.case_name + "."}`
  );
}

// ---- Factor 3: Amount and Substantiality ----

function scoreFactor3(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore {
  let raw = 0;

  // Amount used directly influences the score
  switch (features.amount) {
    case "minimal": raw += 1.2; break;
    case "short excerpt": raw += 0.6; break;
    case "moderate": raw += 0.0; break;
    case "substantial": raw -= 0.7; break;
    case "entire work": raw -= 1.2; break;
  }

  // Transformative purpose can justify taking more
  if (features.transformative_claim && features.amount === "entire work") {
    raw += 0.6; // per Authors Guild v. Google — entire copying can be justified
  }
  if (features.transformative_claim && features.amount === "substantial") {
    raw += 0.3;
  }

  // Search/thumbnail uses often require full copying
  if (
    (features.use_type === "search_engine" || features.use_type === "thumbnail") &&
    (features.amount === "entire work" || features.amount === "substantial")
  ) {
    raw += 0.5;
  }

  // Parody needs to "conjure up" the original
  if (
    (features.use_type === "parody" || features.use_type === "satire") &&
    features.amount !== "entire work"
  ) {
    raw += 0.3;
  }

  const caseSignals = extractCaseSignals(3, matchedCases);
  raw += caseSignals.avgScore * 0.2;

  raw = clamp(raw, -2, 2);

  const reasoning = buildFactor3Reasoning(scenario, features, matchedCases, raw);
  const keyCases = relevantCaseNames(3, matchedCases);
  const keyQuotes = collectQuotes(3, matchedCases);

  return {
    factor_number: 3,
    factor_name: FACTOR_NAMES[3],
    internal_score: Math.round(raw * 100) / 100,
    direction: scoreToDirection(raw),
    weight: scoreToWeight(raw),
    reasoning,
    key_cases: keyCases,
    key_quotes: keyQuotes.slice(0, 4),
    governing_principles: [
      "The inquiry considers both the quantitative amount taken and whether the portion used constitutes the 'heart' of the original work (Harper & Row, 471 U.S. at 565).",
      "Copying an entire work does not preclude fair use when necessary for a transformative purpose (Authors Guild v. Google, 804 F.3d at 221).",
      "A parodist must be able to 'conjure up' enough of the original to make its critical point recognizable (Campbell, 510 U.S. at 588).",
      "The reasonableness of the amount taken must be assessed in relation to the purpose and character of the use.",
    ],
    comparison_to_facts: buildFactor3Comparison(scenario, features, matchedCases),
  };
}

function buildFactor3Reasoning(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  score: number,
): string {
  const parts: string[] = [];

  parts.push(
    `The third factor examines "the amount and substantiality of the portion used in ` +
    `relation to the copyrighted work as a whole." 17 U.S.C. § 107(3). This inquiry ` +
    `has both a quantitative dimension (how much was taken) and a qualitative dimension ` +
    `(whether what was taken constitutes the "heart" of the original work). Harper & Row, ` +
    `471 U.S. at 564-66.`,
  );

  parts.push(
    `The scenario indicates that approximately ${scenario.amount_used}% of the original ` +
    `work has been used, which the analysis categorizes as "${features.amount}." ` +
    `${features.amount === "entire work"
      ? "Using the entirety of a copyrighted work typically weighs against fair use, though it is not dispositive."
      : features.amount === "substantial"
        ? "Using a substantial portion of the original generally weighs against fair use, particularly if the portion taken includes the most distinctive or valuable elements."
        : features.amount === "moderate"
          ? "The moderate amount of material used presents a mixed picture under this factor."
          : features.amount === "short excerpt"
            ? "The relatively limited amount of material used generally supports a finding of fair use under this factor."
            : "The minimal amount of material used is a strong indicator favoring fair use under this factor."
    }`,
  );

  if (features.amount === "entire work" && features.transformative_claim) {
    parts.push(
      `However, courts have recognized that copying an entire work does not preclude fair use ` +
      `when the full copying is necessary to achieve a legitimate transformative purpose. In ` +
      `Authors Guild v. Google, Inc., 804 F.3d 202 (2d Cir. 2015), the court upheld Google's ` +
      `copying of entire books for its search index, reasoning that "the copying of the entirety ` +
      `of a work is sometimes necessary for a legitimate fair use purpose." Similarly, in the ` +
      `thumbnail cases (Kelly v. Arriba Soft, Perfect 10 v. Amazon), courts found that copying ` +
      `entire images was justified by the transformative search indexing purpose.`,
    );
  }

  if (features.use_type === "parody" || features.use_type === "satire") {
    parts.push(
      `In the parody context, the Supreme Court has recognized that a parodist must be able to ` +
      `"conjure up" at least enough of the original to make the object of the parody recognizable. ` +
      `Campbell, 510 U.S. at 588. This means that taking the recognizable elements—even the ` +
      `"heart" of the work—may be justified if the parodist goes no further than necessary to ` +
      `accomplish the parodic purpose.`,
    );
  }

  const qualitativeNote = scenario.description.toLowerCase().includes("heart") ||
    scenario.additional_context.toLowerCase().includes("key part") ||
    scenario.additional_context.toLowerCase().includes("most important");

  if (qualitativeNote) {
    parts.push(
      `The description suggests that the portion taken may include qualitatively significant ` +
      `elements of the original. As the Court warned in Harper & Row, taking "the heart of the ` +
      `book" can weigh against fair use even when the quantitative amount is small. 471 U.S. at 565.`,
    );
  }

  if (score > 0.5) {
    parts.push(
      `On balance, the third factor appears likely to favor a fair use finding, given the ` +
      `limited amount of material used and/or the justification for the amount taken.`,
    );
  } else if (score < -0.5) {
    parts.push(
      `On balance, the third factor appears likely to weigh against fair use. The amount ` +
      `of material taken, considered in light of the purpose of the use, may be deemed ` +
      `unreasonable by a reviewing court.`,
    );
  } else {
    parts.push(
      `The third factor presents a close question. Courts would likely scrutinize whether ` +
      `the amount taken was reasonable in relation to the purpose of the secondary use ` +
      `and whether it included qualitatively significant portions of the original.`,
    );
  }

  return parts.join("\n\n");
}

function buildFactor3Comparison(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): string {
  const amountCases = matchedCases.filter((c) => {
    const fa = c.factor_analyses.find((f) => f.factor_number === 3);
    return fa !== undefined;
  });

  if (amountCases.length === 0) {
    return "No closely analogous precedent was identified for Factor 3 comparison.";
  }

  const comparisons = amountCases.slice(0, 2).map((c) => {
    const fa = c.factor_analyses.find((f) => f.factor_number === 3)!;
    return `In ${c.case_name}, where Factor 3 was ${fa.direction.replace(/_/g, " ")}, ${fa.reasoning}`;
  });

  return (
    comparisons.join(" ") +
    ` The present scenario involves use of approximately ${scenario.amount_used}% ` +
    `of the original, which a court would evaluate in light of these precedents and ` +
    `the specific purpose of the use.`
  );
}

// ---- Factor 4: Effect on the Market ----

function scoreFactor4(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): FactorScore {
  let raw = 0;

  // Market substitution risk is the primary driver
  switch (features.market_substitution_risk) {
    case "low": raw += 1.0; break;
    case "moderate": raw += 0.0; break;
    case "high": raw -= 1.2; break;
    case "unknown": raw -= 0.3; break;
  }

  // Licensing availability signals an existing market
  if (scenario.licensing_available === true) raw -= 0.5;
  if (scenario.licensing_available === false) raw += 0.3;

  // Commercial use increases market harm concern
  if (features.commercial) raw -= 0.3;

  // Transformative uses typically serve different markets
  if (features.transformative_claim) raw += 0.4;

  // Parody and criticism serve different market functions
  if (features.use_type === "parody" || features.use_type === "criticism") {
    raw += 0.3;
  }

  // Search/thumbnail uses historically found to not harm markets
  if (features.use_type === "search_engine" || features.use_type === "thumbnail") {
    raw += 0.5;
  }

  // Entire-work copying that could substitute raises risk
  if (features.amount === "entire work" && !features.transformative_claim) {
    raw -= 0.5;
  }

  // ── Post-Warhol Recalibration for Factor 4 ──
  // Warhol emphasized licensing market substitution even when new meaning exists.
  // Commercial uses that overlap with the original's licensing market face
  // stronger Factor 4 headwinds.
  if (features.commercial && scenario.licensing_available === true) {
    raw -= 0.3; // Heightened post-Warhol concern
  }
  if (features.commercial && features.market_substitution_risk === "high" &&
      features.transformative_claim) {
    // Post-Warhol: transformativeness alone doesn't negate market harm
    // when the use competes in the same licensing channel
    raw -= 0.2;
  }

  const caseSignals = extractCaseSignals(4, matchedCases);
  raw += caseSignals.avgScore * 0.3;

  raw = clamp(raw, -2, 2);

  const reasoning = buildFactor4Reasoning(scenario, features, matchedCases, raw);
  const keyCases = relevantCaseNames(4, matchedCases);
  const keyQuotes = collectQuotes(4, matchedCases);

  return {
    factor_number: 4,
    factor_name: FACTOR_NAMES[4],
    internal_score: Math.round(raw * 100) / 100,
    direction: scoreToDirection(raw),
    weight: scoreToWeight(raw),
    reasoning,
    key_cases: keyCases,
    key_quotes: keyQuotes.slice(0, 4),
    governing_principles: [
      "The fourth factor is 'undoubtedly the single most important element of fair use' (Harper & Row, 471 U.S. at 566), though Campbell cautioned against treating any factor as dispositive.",
      "Courts consider harm to the market for the original and harm to potential derivative or licensing markets.",
      "Market harm from criticism or parody that reduces demand is not cognizable under copyright; only market substitution counts (Campbell, 510 U.S. at 591-92).",
      "When the secondary use serves a different market function, the risk of market substitution is diminished.",
      "After Warhol v. Goldsmith (2023), commercial licensing market substitution weighs heavily against fair use even when the new work adds 'new meaning or message.'",
    ],
    comparison_to_facts: buildFactor4Comparison(scenario, features, matchedCases),
  };
}

// ─── Market Substitution Structured Sub-Analysis ─────────────────────────────

function analyzeMarketSubstitution(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
): MarketSubstitutionAnalysis {
  const text = `${scenario.description} ${scenario.purpose} ${scenario.additional_context}`.toLowerCase();

  const isLicensingSubstitute =
    scenario.licensing_available === true &&
    features.commercial &&
    (features.market_substitution_risk === "high" || features.market_substitution_risk === "moderate");

  const sameAudienceSignals = [
    "same audience", "same market", "same consumers", "competing",
    "target audience", "same demographic", "same readers", "same viewers",
  ];
  const sameAudience = sameAudienceSignals.some((s) => text.includes(s)) ||
    (features.commercial && !features.transformative_claim);

  const sameFormatSignals = [
    "same format", "same medium", "same platform", "same channel",
    "republish", "repost", "redistribute",
  ];
  const sameFormat = sameFormatSignals.some((s) => text.includes(s)) ||
    (features.amount === "entire work" && !features.transformative_claim);

  const overlapSignals = [
    "sell", "monetize", "advertis", "license", "subscription",
    "streaming", "download", "purchase", "buy",
  ];
  const channelOverlap = features.commercial &&
    overlapSignals.some((s) => text.includes(s));

  const reasons: string[] = [];
  if (isLicensingSubstitute) {
    reasons.push("A licensing market exists, and the use could serve as a substitute for purchasing a license.");
  }
  if (sameAudience) {
    reasons.push("The secondary use appears to target a similar or overlapping audience as the original.");
  }
  if (sameFormat) {
    reasons.push("The use maintains the same format or medium as the original, increasing substitution risk.");
  }
  if (channelOverlap) {
    reasons.push("The commercial channel for the secondary use overlaps with the original's distribution.");
  }
  if (!isLicensingSubstitute && !sameAudience && !sameFormat && !channelOverlap) {
    reasons.push("The secondary use appears to serve a different market segment from the original work.");
  }

  return {
    is_licensing_substitute: isLicensingSubstitute,
    same_audience: sameAudience,
    same_format: sameFormat,
    commercial_channel_overlap: channelOverlap,
    reasoning: reasons.join(" "),
  };
}

function buildFactor4Reasoning(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  score: number,
): string {
  const parts: string[] = [];

  parts.push(
    `The fourth factor considers "the effect of the use upon the potential market for or ` +
    `value of the copyrighted work." 17 U.S.C. § 107(4). This includes not only harm to ` +
    `the existing market but also harm to potential derivative or licensing markets. Harper ` +
    `& Row, 471 U.S. at 568. While Harper & Row called this factor "undoubtedly the single ` +
    `most important element of fair use," Campbell later cautioned that no single factor ` +
    `should be treated in isolation.`,
  );

  if (features.market_substitution_risk === "high") {
    parts.push(
      `The analysis identifies a high risk of market substitution. The combination of ` +
      `${features.commercial ? "commercial use" : "the use"}, the amount of material taken ` +
      `(${features.amount}), and ${scenario.licensing_available ? "the existence of a licensing market" : "the nature of the original work"} ` +
      `suggests that the secondary use could serve as a substitute for the original or displace ` +
      `potential licensing revenue. This weighs significantly against fair use.`,
    );
  } else if (features.market_substitution_risk === "low") {
    parts.push(
      `The analysis identifies a low risk of market substitution. The secondary use ` +
      `appears to serve a different market function from the original, reducing the ` +
      `likelihood that it would displace demand for the copyrighted work or undermine ` +
      `potential licensing markets.`,
    );
  } else {
    parts.push(
      `The risk of market substitution is moderate or uncertain. A court would need to ` +
      `examine whether the secondary use could serve as a substitute for the original ` +
      `in any market segment, including derivative and licensing markets.`,
    );
  }

  if (scenario.licensing_available === true) {
    parts.push(
      `The availability of licensing for the original work is a significant consideration. ` +
      `Courts have recognized that when a licensing market exists, unauthorized use that ` +
      `could be served by that market weighs against fair use. The existence of a licensing ` +
      `mechanism suggests the copyright holder has an established economic interest that ` +
      `could be harmed by unlicensed use.`,
    );
  } else if (scenario.licensing_available === false) {
    parts.push(
      `The apparent absence of a licensing market for this type of use may support fair use. ` +
      `When no practical licensing mechanism exists, the case for fair use is somewhat ` +
      `strengthened, as the use does not displace a market the copyright holder has chosen ` +
      `to exploit.`,
    );
  }

  if (features.use_type === "parody" || features.use_type === "criticism") {
    parts.push(
      `Importantly, the Supreme Court has drawn a distinction between market harm from ` +
      `substitution and market harm from criticism. In Campbell, the Court explained that ` +
      `"when a lethal parody, like a scathing theater review, kills demand for the original, ` +
      `it does not produce a harm cognizable under the Copyright Act." 510 U.S. at 591-92. ` +
      `Only harm from market substitution—not from the persuasive force of criticism—is ` +
      `relevant to this factor.`,
    );
  }

  if (features.transformative_claim) {
    parts.push(
      `The transformative nature of the use is relevant to market analysis. As the ` +
      `Campbell Court recognized, "the more transformative the secondary use, the less ` +
      `likelihood that it will serve as a substitute for the original." Courts in ` +
      `Authors Guild v. Google and Perfect 10 v. Amazon found that highly transformative ` +
      `uses (search indexing, thumbnails) did not harm the market for the original works ` +
      `because they served entirely different functions.`,
    );
  }

  if (score > 0.5) {
    parts.push(
      `On balance, the fourth factor appears likely to favor fair use. The secondary use ` +
      `appears unlikely to serve as a market substitute for the original or to undermine ` +
      `its licensing value.`,
    );
  } else if (score < -0.5) {
    parts.push(
      `On balance, the fourth factor appears likely to weigh against fair use. There is ` +
      `a meaningful risk that the secondary use could displace demand for the original ` +
      `or undermine its market value.`,
    );
  } else {
    parts.push(
      `The fourth factor presents significant uncertainty. The market impact would likely ` +
      `be a contested issue in litigation, with the outcome depending on evidence of ` +
      `actual or potential market harm.`,
    );
  }

  return parts.join("\n\n");
}

function buildFactor4Comparison(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
): string {
  const relevant = matchedCases.filter((c) => {
    const fa = c.factor_analyses.find((f) => f.factor_number === 4);
    return fa !== undefined;
  });

  if (relevant.length === 0) {
    return "No closely analogous precedent was identified for Factor 4 comparison.";
  }

  const comparisons = relevant.slice(0, 2).map((c) => {
    const fa = c.factor_analyses.find((f) => f.factor_number === 4)!;
    return `In ${c.case_name}, Factor 4 was ${fa.direction.replace(/_/g, " ")} because ${fa.reasoning}`;
  });

  return (
    comparisons.join(" ") +
    ` The present scenario's market impact would depend on whether the use serves ` +
    `a different market function or could substitute for the original.`
  );
}

// ---------------------------------------------------------------------------
// Shared scoring helpers
// ---------------------------------------------------------------------------

function extractCaseSignals(
  factorNum: FactorNumber,
  cases: CaseLaw[],
): { avgScore: number; analyses: FactorAnalysis[] } {
  const analyses = cases
    .map((c) => c.factor_analyses.find((fa) => fa.factor_number === factorNum))
    .filter((fa): fa is FactorAnalysis => fa !== undefined);

  if (analyses.length === 0) return { avgScore: 0, analyses: [] };

  const total = analyses.reduce((sum, fa) => sum + directionToScore(fa.direction), 0);
  return { avgScore: total / analyses.length, analyses };
}

function relevantCaseNames(factorNum: FactorNumber, cases: CaseLaw[]): string[] {
  return cases
    .filter((c) => c.factor_analyses.some((fa) => fa.factor_number === factorNum))
    .map((c) => c.case_name);
}

function collectQuotes(factorNum: FactorNumber, cases: CaseLaw[]): string[] {
  const quotes: string[] = [];
  for (const c of cases) {
    const fa = c.factor_analyses.find((f) => f.factor_number === factorNum);
    if (fa) quotes.push(...fa.key_quotes);
  }
  // Deduplicate
  return [...new Set(quotes)];
}

// ---------------------------------------------------------------------------
// 4. generatePrecedentStatuses
// ---------------------------------------------------------------------------

export function generatePrecedentStatuses(
  matchedCases: CaseLaw[],
  citationGraph: CitationEdge[],
): PrecedentStatus[] {
  const dateCutoff = today();

  return matchedCases.map((c) => {
    const citedBy = citationGraph.filter((e) => e.cited_case_id === c.case_id);
    const treatments = citedBy.map((e) => {
      const citingCase = matchedCases.find((mc) => mc.case_id === e.citing_case_id);
      const citingName = citingCase?.case_name ?? e.citing_case_id;
      return `${e.treatment_type} by ${citingName}`;
    });

    const hasOverrule = citedBy.some((e) => e.treatment_type === "overrules");
    const hasCriticism = citedBy.some((e) => e.treatment_type === "criticizes");

    let treatmentSummary: string;
    if (citedBy.length === 0) {
      treatmentSummary = "No subsequent treatment identified within the reviewed case set.";
    } else if (hasOverrule) {
      treatmentSummary = `Overruled. ${treatments.join("; ")}.`;
    } else if (hasCriticism) {
      treatmentSummary = `Subsequently criticized but not overruled. ${treatments.join("; ")}.`;
    } else {
      treatmentSummary = `Positive treatment: ${treatments.join("; ")}.`;
    }

    const scotusAddressed = c.jurisdiction_level === "SCOTUS" ||
      citedBy.some((e) => {
        const citing = matchedCases.find((mc) => mc.case_id === e.citing_case_id);
        return citing?.jurisdiction_level === "SCOTUS";
      });

    return {
      case_name: c.case_name,
      citation: c.citation,
      treatment_summary: treatmentSummary,
      later_citation_count: citedBy.length,
      scotus_addressed: scotusAddressed,
      date_cutoff: dateCutoff,
    };
  });
}

// ---------------------------------------------------------------------------
// Overall assessment helpers
// ---------------------------------------------------------------------------

function computeOverallAssessment(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  factorScores: FactorScore[],
  matchedCases: CaseLaw[],
): AnalysisResult["overall_assessment"] {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];
  const uncertainties: string[] = [];

  for (const fs of factorScores) {
    if (fs.internal_score >= 0.75) {
      strengths.push(
        `Factor ${fs.factor_number} (${fs.factor_name}) ${fs.direction.replace(/_/g, " ")} fair use: ${summarizeFactorStrength(fs)}`,
      );
    } else if (fs.internal_score <= -0.75) {
      weaknesses.push(
        `Factor ${fs.factor_number} (${fs.factor_name}) ${fs.direction.replace(/_/g, " ")} fair use: ${summarizeFactorWeakness(fs)}`,
      );
    }
  }

  if (features.transformative_claim) {
    strengths.push(
      "The use asserts a transformative purpose, which is the most significant consideration in modern fair use analysis.",
    );
  }
  if (!features.commercial) {
    strengths.push(
      "The noncommercial nature of the use reduces the presumption of market harm and supports fair use under Factor 1.",
    );
  }

  if (features.commercial && features.amount === "entire work") {
    weaknesses.push(
      "The combination of commercial use and copying the entire work creates a strong presumption of market substitution.",
    );
  }
  if (features.market_substitution_risk === "high") {
    weaknesses.push(
      "High market substitution risk suggests the use could displace demand for the original work.",
    );
  }

  // Litigation risks
  risks.push(
    "Fair use is an affirmative defense; the burden of proof typically falls on the party asserting it.",
  );
  if (features.commercial) {
    risks.push(
      "Commercial uses face heightened scrutiny, particularly after Warhol v. Goldsmith clarified the limits of transformativeness in commercial contexts.",
    );
  }

  const unfoundCases = matchedCases.filter((c) => c.fair_use_outcome === "not_found");
  if (unfoundCases.length > 0) {
    risks.push(
      `${unfoundCases.length} of the ${matchedCases.length} most analogous cases resulted in fair use being denied, suggesting meaningful litigation risk.`,
    );
  }

  const mixedFactors = factorScores.filter(
    (fs) => Math.abs(fs.internal_score) < 0.5,
  );
  if (mixedFactors.length > 0) {
    uncertainties.push(
      `${mixedFactors.length} of 4 factors present close questions that could be resolved differently depending on the specific facts and the court's weighing of the evidence.`,
    );
  }

  uncertainties.push(
    "The qualitative significance of the portion taken (whether it constitutes the 'heart' of the work) cannot be fully assessed without detailed examination of the works themselves.",
  );
  uncertainties.push(
    "Market impact analysis requires evidence of actual or potential market harm that may not be fully determinable from the scenario description alone.",
  );

  if (strengths.length === 0) {
    strengths.push(
      "No strongly favorable factors were identified, though individual factors may tip in either direction depending on specific facts.",
    );
  }
  if (weaknesses.length === 0) {
    weaknesses.push(
      "No strongly unfavorable factors were identified, though this does not guarantee a court would find fair use.",
    );
  }

  return { strengths, weaknesses, litigation_risks: risks, fact_dependent_uncertainties: uncertainties };
}

function summarizeFactorStrength(fs: FactorScore): string {
  switch (fs.factor_number) {
    case 1:
      return "The purpose and character of the use support a finding of transformativeness.";
    case 2:
      return "The nature of the copyrighted work is less central to copyright protection.";
    case 3:
      return "The amount taken appears reasonable in relation to the purpose of the use.";
    case 4:
      return "The use appears unlikely to serve as a market substitute for the original.";
  }
}

function summarizeFactorWeakness(fs: FactorScore): string {
  switch (fs.factor_number) {
    case 1:
      return "The purpose and character of the use may not be sufficiently transformative.";
    case 2:
      return "The original is a creative, expressive work at the core of copyright protection.";
    case 3:
      return "The amount taken may be excessive relative to the purpose of the use.";
    case 4:
      return "There is a meaningful risk of market substitution or displacement.";
  }
}

function computeConfidence(
  features: ExtractedFeatures,
  matchedCases: CaseLaw[],
  factorScores: FactorScore[],
): AnalysisResult["confidence"] {
  let confidence = 0;

  // Direct use-type matches boost confidence
  const directMatches = matchedCases.filter((c) =>
    c.use_types.includes(features.use_type),
  );
  if (directMatches.length >= 3) confidence += 2;
  else if (directMatches.length >= 1) confidence += 1;

  // SCOTUS authority boosts confidence
  const scotusCases = matchedCases.filter((c) => c.jurisdiction_level === "SCOTUS");
  if (scotusCases.length >= 2) confidence += 1.5;
  else if (scotusCases.length >= 1) confidence += 1;

  // Consensus among factors boosts confidence
  const allPositive = factorScores.every((fs) => fs.internal_score > 0);
  const allNegative = factorScores.every((fs) => fs.internal_score < 0);
  if (allPositive || allNegative) confidence += 1;

  // Consensus among matched cases' outcomes
  const outcomeFound = matchedCases.filter((c) => c.fair_use_outcome === "found").length;
  const outcomeNotFound = matchedCases.filter((c) => c.fair_use_outcome === "not_found").length;
  if (matchedCases.length >= 3) {
    const outcomeRatio = Math.max(outcomeFound, outcomeNotFound) / matchedCases.length;
    if (outcomeRatio > 0.7) confidence += 0.5; // Strong consensus
    else if (outcomeRatio < 0.4) confidence -= 0.5; // High variance = lower confidence
  }

  // Mixed signals reduce confidence
  const mixedCount = factorScores.filter((fs) => Math.abs(fs.internal_score) < 0.3).length;
  confidence -= mixedCount * 0.5;

  // Factor score variance penalty: high variance = uncertain
  const scores = factorScores.map((fs) => fs.internal_score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  if (variance > 1.5) confidence -= 0.5;

  // Cross-circuit disagreement would lower confidence (if we had circuit data)
  const circuits = [...new Set(matchedCases.map((c) => c.circuit).filter(Boolean))];
  if (circuits.length >= 3) {
    // Multiple circuits represented — check for disagreement
    const circuitOutcomes = circuits.map((cir) => {
      const cases = matchedCases.filter((c) => c.circuit === cir);
      const found = cases.filter((c) => c.fair_use_outcome === "found").length;
      return found / cases.length;
    });
    const min = Math.min(...circuitOutcomes);
    const max = Math.max(...circuitOutcomes);
    if (max - min > 0.5) confidence -= 0.5; // Cross-circuit disagreement
  }

  if (confidence >= 3) return "high";
  if (confidence >= 1.5) return "moderate";
  return "low";
}

function generateFactSummary(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
): string {
  const commercialStr = features.commercial ? "commercial" : "noncommercial";
  const amountStr = features.amount;
  const transformStr = features.transformative_claim
    ? "asserts a transformative purpose"
    : "does not clearly articulate a transformative purpose";

  return (
    `The scenario involves a ${commercialStr} use characterized as ` +
    `"${features.use_type.replace(/_/g, " ")}." The user ${transformStr}. ` +
    `The use involves ${amountStr === "entire work" ? "the entire" : amountStr === "minimal" ? "a minimal portion of the" : `a ${amountStr} portion of the`} ` +
    `original work, which is described as "${features.work_type}." ` +
    `The stated purpose is: "${scenario.purpose}." ` +
    `${scenario.licensing_available === true
      ? "Licensing for the original work appears to be available."
      : scenario.licensing_available === false
        ? "No licensing mechanism for the original work has been identified."
        : "The availability of licensing is unknown."
    } ` +
    `The estimated market substitution risk is ${features.market_substitution_risk}.`
  );
}

function identifyAmbiguities(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
): string[] {
  const ambiguities: string[] = [];

  if (!features.transformative_claim) {
    ambiguities.push(
      "The scenario does not clearly articulate how the use is transformative. Courts increasingly focus on whether the use serves a genuinely different purpose, and this ambiguity could affect the Factor 1 analysis.",
    );
  }

  if (scenario.licensing_available === null) {
    ambiguities.push(
      "It is unclear whether a licensing market exists for the original work. This affects the Factor 4 market harm analysis.",
    );
  }

  if (features.amount === "moderate" || features.amount === "substantial") {
    ambiguities.push(
      "Whether the portion taken includes qualitatively significant elements (the 'heart' of the work) cannot be determined from the percentage alone. This affects the Factor 3 analysis.",
    );
  }

  if (scenario.additional_context.length < 20) {
    ambiguities.push(
      "Limited additional context was provided. A more detailed description of the specific use, the relationship between the original and secondary works, and the intended audience would improve the analysis.",
    );
  }

  const workType = features.work_type.toLowerCase();
  if (!workType || workType === "other" || workType === "unknown") {
    ambiguities.push(
      "The type of the original copyrighted work is not well specified. The creative-vs-factual nature of the original significantly affects the Factor 2 analysis.",
    );
  }

  return ambiguities;
}

// ---------------------------------------------------------------------------
// LLM Feature Extraction (calls internal API route)
// ---------------------------------------------------------------------------

interface LLMExtractionResult {
  features: ExtractedFeatures;
  assumptions: string[];
}

async function extractFeaturesLLM(
  scenario: ScenarioInput
): Promise<LLMExtractionResult | null> {
  if (!isOpenAIConfigured()) return null;

  try {
    const { getOpenAI, logTokenUsage } = await import("./openai");
    const client = getOpenAI();

    const userMessage =
      `Scenario Description: ${scenario.description}\n` +
      `Purpose: ${scenario.purpose}\n` +
      `Work Type (user selected): ${scenario.work_type}\n` +
      `Use Type (user selected): ${scenario.use_type}\n` +
      `Amount Used (user set): ${scenario.amount_used}%\n` +
      `Commercial (user set): ${scenario.is_commercial}\n` +
      `Licensing Available (user set): ${scenario.licensing_available}\n` +
      `Additional Context: ${scenario.additional_context}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are a legal research assistant specializing in U.S. copyright fair use (17 U.S.C. § 107).

The user may not be a legal expert. They may have chosen vague or generic options in the structured fields (like work_type, use_type, amount) but written detailed free-text in their Description, Purpose, and Additional Context.

YOUR JOB: Read their free-text carefully and make educated inferences. Do NOT leave things as "unknown" if the free-text gives you enough context to make a reasonable judgment. Be helpful, not passive.

For example:
- If they say "I want to use a clip of a song in my YouTube review" but picked "other" as use_type, infer it's likely "commentary" or "criticism"
- If they describe selling something but marked commercial as false, note the assumption
- If description mentions "a few seconds" but the slider is at 50%, trust the description and adjust
- If they describe the original work in detail, infer whether it's creative vs factual

Return ONLY valid JSON:
{
  "commerciality": "commercial" | "noncommercial",
  "transformation_level": "highly_transformative" | "moderately_transformative" | "minimally_transformative" | "not_transformative",
  "amount_used": "minimal" | "short excerpt" | "moderate" | "substantial" | "entire work",
  "market_harm_risk": "low" | "moderate" | "high" | "unknown",
  "transformative_claim": true | false,
  "inferred_work_type": "string — your best guess of what the original work actually is",
  "inferred_use_type": "string — your best guess of the actual use type (use one of: parody, commentary, criticism, thumbnail, search_engine, music_sampling, news_reporting, nonprofit_education, commercial_remix, ai_training, biographical_excerpt, software_api, archival, satire, artistic_appropriation, research, other)",
  "assumptions": ["assumption 1 — plain English, e.g. 'Based on your description, we're treating this as a commentary use since you mention reviewing the work'", "assumption 2", ...]
}

The assumptions array should list every educated guess you made in PLAIN ENGLISH that a non-lawyer can understand. These will be shown to the user so they can verify. If everything is clear and no assumptions were needed, return an empty array.`,
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    logTokenUsage("extractFeatures-inline", response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    const amountMap: Record<string, ExtractedFeatures["amount"]> = {
      minimal: "minimal",
      "short excerpt": "short excerpt",
      moderate: "moderate",
      substantial: "substantial",
      "entire work": "entire work",
    };
    const riskMap: Record<string, ExtractedFeatures["market_substitution_risk"]> = {
      low: "low",
      moderate: "moderate",
      high: "high",
      unknown: "unknown",
    };

    const validUseTypes = [
      "parody", "commentary", "criticism", "thumbnail", "search_engine",
      "music_sampling", "news_reporting", "nonprofit_education", "commercial_remix",
      "ai_training", "biographical_excerpt", "software_api", "archival",
      "satire", "artistic_appropriation", "research", "other",
    ];

    const inferredUseType = validUseTypes.includes(parsed.inferred_use_type)
      ? parsed.inferred_use_type
      : scenario.use_type;

    const inferredWorkType =
      parsed.inferred_work_type && parsed.inferred_work_type.length > 0
        ? parsed.inferred_work_type
        : scenario.work_type;

    return {
      features: {
        work_type: inferredWorkType,
        use_type: inferredUseType as UseType,
        commercial:
          parsed.commerciality === "commercial" || scenario.is_commercial,
        amount: amountMap[parsed.amount_used] ?? "moderate",
        transformative_claim: parsed.transformative_claim ?? false,
        market_substitution_risk: riskMap[parsed.market_harm_risk] ?? "unknown",
      },
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
    };
  } catch (err) {
    console.warn("[analyzeScenario] LLM feature extraction failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM Memo Generation (inline)
// ---------------------------------------------------------------------------

async function generateMemoLLM(
  scenario: ScenarioInput,
  features: ExtractedFeatures,
  retrieval: RetrievalResult
): Promise<{
  memo: string | null;
  factor_analysis: Record<string, string> | null;
  cited_cases: string[];
}> {
  if (!isOpenAIConfigured()) {
    return { memo: null, factor_analysis: null, cited_cases: [] };
  }

  try {
    const { getOpenAI, logTokenUsage, truncatePassage } = await import("./openai");
    const client = getOpenAI();

    const topPassages = retrieval.passages
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);

    const caseNames = [...new Set(topPassages.map((p) => p.case_id))];

    const passageText = topPassages
      .map(
        (p, i) =>
          `[Passage ${i + 1}] (Case: ${p.case_id}, Factor ${p.factor_number})\n${truncatePassage(p.text_chunk)}`
      )
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a legal research assistant writing a fair use analysis memo under 17 U.S.C. § 107. ONLY cite cases from the retrieved passages. Do NOT hallucinate case names. Return ONLY valid JSON: {"memo":"...","factor_analysis":{"factor_1":"...","factor_2":"...","factor_3":"...","factor_4":"..."},"cited_cases":["case_id"]}`,
        },
        {
          role: "user",
          content: `SCENARIO:\n${scenario.description}\nPurpose: ${scenario.purpose}\n\nFEATURES:\n${JSON.stringify(features)}\n\nPASSAGES:\n${passageText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    logTokenUsage("generateMemo-inline", response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) return { memo: null, factor_analysis: null, cited_cases: [] };

    const parsed = JSON.parse(content);
    const validCases = (parsed.cited_cases ?? []).filter((c: string) =>
      caseNames.includes(c)
    );

    return {
      memo: parsed.memo ?? null,
      factor_analysis: parsed.factor_analysis ?? null,
      cited_cases: validCases,
    };
  } catch (err) {
    console.warn("[analyzeScenario] LLM memo generation failed:", err);
    return { memo: null, factor_analysis: null, cited_cases: [] };
  }
}

// ---------------------------------------------------------------------------
// Persist analysis to Supabase
// ---------------------------------------------------------------------------

async function persistAnalysis(result: AnalysisResult): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseServer();
    await supabase.from("analyses").insert({
      id: result.id,
      scenario: result.scenario,
      structured_features: result.extracted_features,
      memo: result.memo ?? null,
      factor_scores: result.factor_scores,
      overall_assessment: result.overall_assessment,
      precedent_statuses: result.precedent_statuses,
      matched_cases: result.matched_cases,
      confidence: result.confidence,
      fact_summary: result.fact_summary,
      ambiguities: result.ambiguities,
      full_result: result,
    });
  } catch (err) {
    console.warn("[persistAnalysis] Failed to save:", err);
  }
}

// ---------------------------------------------------------------------------
// Load analysis from Supabase
// ---------------------------------------------------------------------------

export async function loadAnalysis(
  id: string
): Promise<AnalysisResult | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("analyses")
      .select("full_result")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data.full_result as AnalysisResult;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. analyzeScenario — main orchestrator (now async)
// ---------------------------------------------------------------------------

export async function analyzeScenario(
  scenario: ScenarioInput
): Promise<AnalysisResult> {
  // Step 1: Extract features (try LLM first, fall back to rule-based)
  let extracted: ExtractedFeatures;
  let analysisSource: "hybrid" | "rule-based" = "rule-based";
  let llmAssumptions: string[] = [];

  const llmResult = await extractFeaturesLLM(scenario);
  if (llmResult) {
    extracted = llmResult.features;
    llmAssumptions = llmResult.assumptions;
    analysisSource = "hybrid";
  } else {
    extracted = extractFeatures(scenario);
  }

  // Step 2: Retrieve matching cases from Supabase via vector similarity
  // Pass circuit for circuit-aware retrieval
  const scenarioText = `${scenario.description} ${scenario.purpose} ${scenario.additional_context}`;
  const retrieval = await retrieveCases(scenarioText, extracted, {
    circuit: scenario.jurisdiction ?? undefined,
  });

  const matched = retrieval.matchedCases;
  const citationEdges = retrieval.citationEdges;

  // Step 3: Score factors (always rule-based for consistency)
  const factors = scoreFactors(scenario, extracted, matched);

  // Step 4: Generate precedent statuses
  const precedents = generatePrecedentStatuses(matched, citationEdges);

  // Step 5: LLM memo generation (optional enrichment)
  const memoResult = await generateMemoLLM(scenario, extracted, retrieval);

  // Step 6: Build the rest
  const factSummary = generateFactSummary(scenario, extracted);
  const overall = computeOverallAssessment(scenario, extracted, factors, matched);
  const confidence = computeConfidence(extracted, matched, factors);
  const marketSub = analyzeMarketSubstitution(scenario, extracted);

  // Use LLM assumptions if available; only fall back to rigid ambiguity
  // detection if no LLM was used
  const ambiguities = llmAssumptions.length > 0
    ? []
    : identifyAmbiguities(scenario, extracted);

  const result: AnalysisResult = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    scenario,
    extracted_features: extracted,
    fact_summary: factSummary,
    ambiguities,
    factor_scores: factors,
    overall_assessment: overall,
    precedent_statuses: precedents,
    matched_cases: matched,
    confidence,
    disclaimer: DISCLAIMER,
    date_cutoff: today(),
    memo: memoResult.memo,
    llm_factor_analysis: memoResult.factor_analysis,
    cited_cases: memoResult.cited_cases,
    retrieval_source: retrieval.source,
    analysis_source: analysisSource,
    assumptions: llmAssumptions,
    retrieved_passages: retrieval.passageInfo,
    market_substitution: marketSub,
    circuit_conflicts: retrieval.circuitConflicts,
  };

  // Step 7: Persist to Supabase (fire-and-forget)
  persistAnalysis(result).catch(() => {});

  return result;
}
