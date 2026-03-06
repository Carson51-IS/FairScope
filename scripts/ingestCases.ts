/**
 * Ingestion script v2: processes fetched CourtListener cases into Supabase.
 *
 * Pipeline:
 *   1. Read raw cases from data/courtlistener_raw.json
 *   2. Run fair-use-applied classifier (reject noise)
 *   3. Extract circuit, procedural posture, post-Warhol flag
 *   4. Generate summary + factor analysis via OpenAI
 *   5. Hierarchical section-aware chunking with section headings
 *   6. Generate embeddings in batches
 *   7. Insert into Supabase (cases, factor_sections, factor_analyses, canonical_quotes)
 *
 * Usage:
 *   npm run ingest
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}
if (!openaiKey) {
  console.error("Missing OPENAI_API_KEY in .env (required for summaries + embeddings)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: openaiKey });

interface RawCase {
  courtlistener_id: string;
  case_name: string;
  citation: string;
  court: string;
  date_filed: string;
  opinion_text: string;
  absolute_url: string;
  docket_number: string;
}

// ─── Fair Use Applied Classifier ─────────────────────────────────────────────
// Rejects cases where fair use is only mentioned in passing (dicta, procedural
// references, quoting other cases without analysis). Requires structured factor
// discussion or clear dispositive fair use language.

const FACTOR_DISCUSSION_PATTERNS = [
  /first\s+(?:fair\s+use\s+)?factor/i,
  /second\s+(?:fair\s+use\s+)?factor/i,
  /third\s+(?:fair\s+use\s+)?factor/i,
  /fourth\s+(?:fair\s+use\s+)?factor/i,
  /purpose\s+and\s+character\s+of\s+the\s+use/i,
  /nature\s+of\s+the\s+copyrighted\s+work/i,
  /amount\s+and\s+substantiality/i,
  /effect\s+(?:on|upon)\s+the\s+(?:potential\s+)?market/i,
  /§\s*107\s*\(\d\)/i,
];

const DISPOSITIVE_LANGUAGE = [
  /we\s+(?:conclude|hold|find)\s+that\s+(?:the\s+)?(?:use|defendant'?s?\s+use)\s+was\s+(?:not\s+)?fair/i,
  /(?:the\s+)?(?:district|lower)\s+court\s+erred\s+in\s+(?:finding|granting|denying)\s+(?:summary\s+judgment\s+on\s+)?fair\s+use/i,
  /summary\s+judgment\s+on\s+(?:the\s+)?fair\s+use\s+(?:defense|claim|issue)/i,
  /(?:constitutes|does\s+not\s+constitute)\s+(?:a\s+)?fair\s+use/i,
  /fair\s+use\s+(?:defense|analysis|doctrine)\s+(?:applies|fails|succeeds)/i,
  /weighing\s+(?:the|these|all)\s+(?:four\s+)?(?:statutory\s+)?factors/i,
  /balancing\s+(?:the|these)\s+factors/i,
];

function classifyFairUseApplied(text: string): { applied: boolean; confidence: number } {
  const lower = text.toLowerCase();

  let factorDiscussions = 0;
  for (const pat of FACTOR_DISCUSSION_PATTERNS) {
    if (pat.test(text)) factorDiscussions++;
  }

  let dispositiveHits = 0;
  for (const pat of DISPOSITIVE_LANGUAGE) {
    if (pat.test(text)) dispositiveHits++;
  }

  // Strong signal: 3+ distinct factor discussions AND dispositive language
  if (factorDiscussions >= 3 && dispositiveHits >= 1) {
    return { applied: true, confidence: 0.95 };
  }

  // Good signal: 2+ factor discussions AND dispositive language
  if (factorDiscussions >= 2 && dispositiveHits >= 1) {
    return { applied: true, confidence: 0.85 };
  }

  // Moderate: 3+ factor discussions without dispositive language
  if (factorDiscussions >= 3) {
    return { applied: true, confidence: 0.75 };
  }

  // Moderate: strong dispositive language alone
  if (dispositiveHits >= 2) {
    return { applied: true, confidence: 0.7 };
  }

  // Weak: only 1-2 factor discussions or 1 dispositive
  if (factorDiscussions >= 1 && dispositiveHits >= 1) {
    return { applied: true, confidence: 0.6 };
  }

  // Mentions fair use but doesn't analyze it
  if (lower.includes("fair use") && factorDiscussions === 0 && dispositiveHits === 0) {
    return { applied: false, confidence: 0.7 };
  }

  return { applied: false, confidence: 0.5 };
}

// ─── Circuit Extraction ──────────────────────────────────────────────────────

const CIRCUIT_MAP: Record<string, string> = {
  scotus: "scotus",
  supreme: "scotus",
  ca1: "ca1", "1st": "ca1", "first circuit": "ca1",
  ca2: "ca2", "2d": "ca2", "2nd": "ca2", "second circuit": "ca2",
  ca3: "ca3", "3d": "ca3", "3rd": "ca3", "third circuit": "ca3",
  ca4: "ca4", "4th": "ca4", "fourth circuit": "ca4",
  ca5: "ca5", "5th": "ca5", "fifth circuit": "ca5",
  ca6: "ca6", "6th": "ca6", "sixth circuit": "ca6",
  ca7: "ca7", "7th": "ca7", "seventh circuit": "ca7",
  ca8: "ca8", "8th": "ca8", "eighth circuit": "ca8",
  ca9: "ca9", "9th": "ca9", "ninth circuit": "ca9",
  ca10: "ca10", "10th": "ca10", "tenth circuit": "ca10",
  ca11: "ca11", "11th": "ca11", "eleventh circuit": "ca11",
  cadc: "cadc", "d.c. circuit": "cadc", "dc circuit": "cadc",
  cafc: "cafc", "federal circuit": "cafc",
};

function extractCircuit(court: string): string | null {
  const lower = court.toLowerCase();
  for (const [key, circuit] of Object.entries(CIRCUIT_MAP)) {
    if (lower.includes(key)) return circuit;
  }
  return null;
}

// ─── Procedural Posture Detection ────────────────────────────────────────────

function detectProceduralPosture(text: string): string {
  const lower = text.toLowerCase();

  if (/summary\s+judgment/i.test(lower)) return "summary_judgment";
  if (/motion\s+to\s+dismiss/i.test(lower)) return "motion_to_dismiss";
  if (/preliminary\s+injunction/i.test(lower)) return "preliminary_injunction";
  if (/jury\s+(?:verdict|trial|found)/i.test(lower)) return "jury_verdict";
  if (/bench\s+trial/i.test(lower)) return "bench_trial";
  if (/(?:we\s+)?(?:affirm|reverse|remand|vacate)/i.test(lower)) return "appeal";
  if (/certiorari/i.test(lower)) return "certiorari";
  return "unknown";
}

// ─── Hierarchical Section-Based Chunking ─────────────────────────────────────

const FACTOR_PATTERNS: { factor: number; patterns: RegExp[] }[] = [
  {
    factor: 1,
    patterns: [
      /first\s+(?:fair\s+use\s+)?factor/i,
      /purpose\s+and\s+character/i,
      /§\s*107\s*\(1\)/i,
      /transformative\s+(?:use|purpose|nature|character)/i,
      /commercial\s+(?:nature|character|use)\s+of/i,
    ],
  },
  {
    factor: 2,
    patterns: [
      /second\s+(?:fair\s+use\s+)?factor/i,
      /nature\s+of\s+the\s+copyrighted\s+work/i,
      /§\s*107\s*\(2\)/i,
      /creative\s+(?:work|expression|nature)/i,
      /factual\s+(?:work|nature)/i,
    ],
  },
  {
    factor: 3,
    patterns: [
      /third\s+(?:fair\s+use\s+)?factor/i,
      /amount\s+and\s+substantiality/i,
      /§\s*107\s*\(3\)/i,
      /heart\s+of\s+the\s+work/i,
      /portion\s+used/i,
    ],
  },
  {
    factor: 4,
    patterns: [
      /fourth\s+(?:fair\s+use\s+)?factor/i,
      /(?:effect|impact)\s+(?:on|upon)\s+the\s+(?:potential\s+)?market/i,
      /§\s*107\s*\(4\)/i,
      /market\s+(?:harm|substitut|impact|effect)/i,
    ],
  },
];

const SECTION_HEADING_RE = /^(?:[IVX]+\.?\s+|[A-Z]\.?\s+|\d+\.?\s+)([A-Z][A-Za-z\s,&']+)$/;
const LABELED_SECTION_RE = /^(?:(?:II?|III|IV|V|VI|VII|VIII|IX|X)[\.\)]\s*)?(?:Factor\s+(?:One|Two|Three|Four|1|2|3|4)|(?:Purpose|Nature|Amount|Market|Effect))/i;

const TARGET_CHUNK_CHARS = 4000;
const MAX_CHUNK_CHARS = 6000;
const MIN_CHUNK_CHARS = 500;

function detectFactorInText(text: string): number | null {
  for (const { factor, patterns } of FACTOR_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return factor;
    }
  }
  return null;
}

function extractSectionHeading(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (SECTION_HEADING_RE.test(trimmed)) return trimmed;
    if (LABELED_SECTION_RE.test(trimmed)) return trimmed;
  }
  return null;
}

interface TextChunk {
  text: string;
  factor_number: number | null;
  section_heading: string | null;
  factor_confidence: number;
}

function chunkOpinionText(opinionText: string): TextChunk[] {
  const paragraphs = opinionText.split(/\n{2,}|\r\n{2,}/);
  const chunks: TextChunk[] = [];

  let currentChunk = "";
  let currentFactor: number | null = null;
  let currentHeading: string | null = null;
  let factorHits = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const detectedFactor = detectFactorInText(trimmed);
    const heading = extractSectionHeading(trimmed);

    // New section boundary: either a new factor or a labeled heading
    const isSectionBoundary =
      (detectedFactor !== null && detectedFactor !== currentFactor) ||
      (heading !== null && currentChunk.length > MIN_CHUNK_CHARS);

    if (isSectionBoundary && currentChunk.length > MIN_CHUNK_CHARS) {
      const confidence = factorHits > 2 ? 0.9 : factorHits > 0 ? 0.7 : 0.3;
      chunks.push({
        text: currentChunk.trim(),
        factor_number: currentFactor,
        section_heading: currentHeading,
        factor_confidence: confidence,
      });
      currentChunk = "";
      factorHits = 0;
    }

    if (detectedFactor !== null) {
      currentFactor = detectedFactor;
      factorHits++;
    }
    if (heading !== null) {
      currentHeading = heading;
    }

    currentChunk += trimmed + "\n\n";

    if (currentChunk.length > MAX_CHUNK_CHARS) {
      const confidence = factorHits > 2 ? 0.9 : factorHits > 0 ? 0.7 : 0.3;
      chunks.push({
        text: currentChunk.trim(),
        factor_number: currentFactor,
        section_heading: currentHeading,
        factor_confidence: confidence,
      });
      currentChunk = "";
      currentFactor = null;
      currentHeading = null;
      factorHits = 0;
    }
  }

  if (currentChunk.trim().length > MIN_CHUNK_CHARS) {
    const confidence = factorHits > 2 ? 0.9 : factorHits > 0 ? 0.7 : 0.3;
    chunks.push({
      text: currentChunk.trim(),
      factor_number: currentFactor,
      section_heading: currentHeading,
      factor_confidence: confidence,
    });
  }

  if (chunks.every((c) => c.factor_number === null)) {
    return fixedSizeChunk(opinionText);
  }

  return chunks;
}

function fixedSizeChunk(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > TARGET_CHUNK_CHARS && current.length > MIN_CHUNK_CHARS) {
      chunks.push({ text: current.trim(), factor_number: null, section_heading: null, factor_confidence: 0 });
      current = "";
    }
    current += sentence + " ";
  }

  if (current.trim().length > MIN_CHUNK_CHARS) {
    chunks.push({ text: current.trim(), factor_number: null, section_heading: null, factor_confidence: 0 });
  }

  return chunks;
}

// ─── OpenAI Helpers ──────────────────────────────────────────────────────────

let totalTokens = 0;

async function generateSummaryAndAnalysis(
  caseName: string,
  opinionText: string,
): Promise<{
  summary: string;
  fair_use_outcome: string;
  factor_analyses: Array<{
    factor_number: number;
    direction: string;
    reasoning: string;
    key_quotes: string[];
    tags: string[];
  }>;
  use_types: string[];
  procedural_posture: string;
}> {
  const truncated = opinionText.slice(0, 8000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content: `You are a legal research assistant specializing in U.S. copyright fair use (17 U.S.C. § 107).

Given a court opinion, extract structured analysis. Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary focusing on fair use holding",
  "fair_use_outcome": "found" | "not_found" | "mixed" | "remanded",
  "factor_analyses": [
    {
      "factor_number": 1,
      "direction": "strongly_favors" | "favors" | "neutral" | "slightly_against" | "against" | "strongly_against" | "mixed",
      "reasoning": "1-2 sentence reasoning",
      "key_quotes": ["important quote from opinion"],
      "tags": ["transformative", "commercial", etc.]
    }
  ],
  "use_types": ["parody", "commentary", etc. — classify the type of use at issue],
  "procedural_posture": "summary_judgment" | "motion_to_dismiss" | "appeal" | "jury_verdict" | "bench_trial" | "preliminary_injunction" | "certiorari" | "unknown"
}

Include all 4 factors if discussed. Only include factors that are actually analyzed.`,
      },
      {
        role: "user",
        content: `Case: ${caseName}\n\nOpinion excerpt:\n${truncated}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  totalTokens += response.usage?.total_tokens ?? 0;
  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    return {
      summary: "",
      fair_use_outcome: "mixed",
      factor_analyses: [],
      use_types: [],
      procedural_posture: "unknown",
    };
  }
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const BATCH = 50;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    console.log(`    Embedding batch ${i + 1}..${i + batch.length} of ${texts.length}`);
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    totalTokens += resp.usage?.total_tokens ?? 0;
    results.push(...resp.data.map((d) => d.embedding));
  }

  return results;
}

// ─── Court Name Mapping ──────────────────────────────────────────────────────

function mapCourtLevel(court: string): string {
  const lower = court.toLowerCase();
  if (lower.includes("scotus") || lower.includes("supreme")) return "SCOTUS";
  if (lower.includes("ca") || lower.includes("circuit") || lower.includes("cir")) return "Circuit";
  return "District";
}

function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// Warhol v. Goldsmith was decided June 1, 2023
const WARHOL_DATE = new Date("2023-06-01");

function isPostWarhol(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= WARHOL_DATE;
}

// ─── Canonical Quotes (seed the most important ones) ─────────────────────────

const CANONICAL_QUOTES: Array<{
  case_name_pattern: string;
  factor_number: number;
  quote: string;
  attribution: string;
}> = [
  {
    case_name_pattern: "campbell",
    factor_number: 1,
    quote: "The more transformative the new work, the less will be the significance of other factors, like commercialism, that may weigh against a finding of fair use.",
    attribution: "Campbell v. Acuff-Rose Music, Inc., 510 U.S. 569, 579 (1994)",
  },
  {
    case_name_pattern: "campbell",
    factor_number: 4,
    quote: "When a lethal parody, like a scathing theater review, kills demand for the original, it does not produce a harm cognizable under the Copyright Act.",
    attribution: "Campbell v. Acuff-Rose Music, Inc., 510 U.S. 569, 591-92 (1994)",
  },
  {
    case_name_pattern: "warhol",
    factor_number: 1,
    quote: "The first fair use factor instead focuses on whether an allegedly infringing use has a further purpose or different character, which is a matter of degree, and the degree of difference must be balanced against the commercial nature of the use.",
    attribution: "Andy Warhol Foundation v. Goldsmith, 598 U.S. 508 (2023)",
  },
  {
    case_name_pattern: "google",
    factor_number: 3,
    quote: "Google's copying of the API was necessary to allow programmers to use their accrued talents in a new and transformative program.",
    attribution: "Google LLC v. Oracle America, Inc., 593 U.S. 1 (2021)",
  },
  {
    case_name_pattern: "harper",
    factor_number: 4,
    quote: "This last factor is undoubtedly the single most important element of fair use.",
    attribution: "Harper & Row v. Nation Enterprises, 471 U.S. 539, 566 (1985)",
  },
  {
    case_name_pattern: "harper",
    factor_number: 3,
    quote: "In view of the expressive value of the excerpts and their key role in the infringing work, we cannot agree with the Second Circuit that the 'weights' of the amounts of the original work used were 'insubstantial.'",
    attribution: "Harper & Row v. Nation Enterprises, 471 U.S. 539, 565 (1985)",
  },
];

// ─── Main Ingestion ──────────────────────────────────────────────────────────

async function main() {
  const rawPath = path.resolve(__dirname, "..", "data", "courtlistener_raw.json");

  if (!fs.existsSync(rawPath)) {
    console.error(
      "No data/courtlistener_raw.json found.\n" +
      "Run 'npm run fetch' first to download cases from CourtListener."
    );
    process.exit(1);
  }

  const rawCases: RawCase[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
  console.log(`\n=== Ingesting ${rawCases.length} cases into Supabase ===\n`);

  let inserted = 0;
  let skipped = 0;
  let rejected = 0;

  for (let i = 0; i < rawCases.length; i++) {
    const raw = rawCases[i];
    const caseId = slugify(raw.case_name) || `cl-${raw.courtlistener_id}`;

    console.log(`[${i + 1}/${rawCases.length}] ${raw.case_name.slice(0, 60)}...`);

    // Skip if already exists
    const { data: existing } = await supabase
      .from("cases")
      .select("id")
      .or(`case_id.eq.${caseId},citation.eq.${raw.citation}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  [skip] Already exists`);
      skipped++;
      continue;
    }

    // ── Fair Use Applied Classifier ──
    const classification = classifyFairUseApplied(raw.opinion_text);
    console.log(`  Fair use applied: ${classification.applied} (confidence: ${classification.confidence.toFixed(2)})`);

    if (!classification.applied && classification.confidence > 0.6) {
      console.log(`  [reject] Fair use not substantively analyzed in this opinion`);
      rejected++;
      continue;
    }

    // ── Extract metadata ──
    const year = extractYear(raw.date_filed);
    const courtLevel = mapCourtLevel(raw.court);
    const circuit = extractCircuit(raw.court);
    const postWarhol = isPostWarhol(raw.date_filed);
    const proceduralPosture = detectProceduralPosture(raw.opinion_text);

    // ── LLM: Generate summary + factor analysis ──
    console.log(`  Generating summary + factor analysis...`);
    const analysis = await generateSummaryAndAnalysis(raw.case_name, raw.opinion_text);

    // Insert case with new metadata fields
    const { data: insertedCase, error: insertErr } = await supabase
      .from("cases")
      .insert({
        case_id: caseId,
        name: raw.case_name,
        citation: raw.citation || null,
        court: raw.court,
        year,
        date: raw.date_filed,
        jurisdiction_level: courtLevel,
        opinion_text: raw.opinion_text,
        summary: analysis.summary,
        fair_use_outcome: analysis.fair_use_outcome,
        procedural_posture: analysis.procedural_posture !== "unknown"
          ? analysis.procedural_posture
          : proceduralPosture,
        fair_use_applied: classification.applied,
        circuit,
        is_post_warhol: postWarhol,
        procedural_posture_type: analysis.procedural_posture !== "unknown"
          ? analysis.procedural_posture
          : proceduralPosture,
        fair_use_classifier_confidence: classification.confidence,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`  [error] ${insertErr.message}`);
      continue;
    }

    const uuid = insertedCase!.id;

    // ── Insert factor analyses ──
    if (analysis.factor_analyses && analysis.factor_analyses.length > 0) {
      for (const fa of analysis.factor_analyses) {
        await supabase.from("factor_analyses").insert({
          case_id: uuid,
          factor_number: fa.factor_number,
          direction: fa.direction,
          reasoning: fa.reasoning,
          key_quotes: fa.key_quotes ?? [],
          tags: fa.tags ?? [],
        });
      }
      console.log(`  Inserted ${analysis.factor_analyses.length} factor analyses`);
    }

    // ── Insert use type tags ──
    if (analysis.use_types && analysis.use_types.length > 0) {
      for (const tag of analysis.use_types) {
        await supabase.from("use_type_tags").insert({
          case_id: uuid,
          tag,
        });
      }
    }

    // ── Seed canonical quotes if this is a landmark case ──
    const nameLower = raw.case_name.toLowerCase();
    for (const cq of CANONICAL_QUOTES) {
      if (nameLower.includes(cq.case_name_pattern)) {
        await supabase.from("canonical_quotes").insert({
          case_id: uuid,
          factor_number: cq.factor_number,
          quote: cq.quote,
          attribution: cq.attribution,
          approved: true,
        }).then(({ error }) => {
          if (error && !error.message.includes("duplicate")) {
            console.warn(`  [warn] Canonical quote insert: ${error.message}`);
          }
        });
      }
    }

    // ── Chunk with hierarchical section detection ──
    const chunks = chunkOpinionText(raw.opinion_text);
    console.log(`  Chunked into ${chunks.length} sections (${chunks.filter(c => c.section_heading).length} with headings)`);

    // Generate embeddings
    const embeddings = await embedTexts(chunks.map((c) => c.text.slice(0, 8000)));

    // Insert factor_sections with section headings and confidence
    for (let j = 0; j < chunks.length; j++) {
      const { error: secErr } = await supabase.from("factor_sections").insert({
        case_id: uuid,
        factor_number: chunks[j].factor_number,
        text_chunk: chunks[j].text,
        embedding: embeddings[j]?.length > 0 ? embeddings[j] : null,
        section_heading: chunks[j].section_heading,
        factor_confidence: chunks[j].factor_confidence,
      });
      if (secErr) {
        console.warn(`  [warn] Section insert failed: ${secErr.message}`);
      }
    }

    inserted++;
    console.log(`  [ok] Inserted with ${chunks.length} chunks | circuit=${circuit} | postWarhol=${postWarhol} | posture=${analysis.procedural_posture}`);
  }

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Rejected (fair use not applied): ${rejected}`);
  console.log(`Total OpenAI tokens used: ${totalTokens}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
