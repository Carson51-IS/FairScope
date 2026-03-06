import { NextResponse } from "next/server";
import { getOpenAI, isOpenAIConfigured, logTokenUsage, truncatePassage } from "@/lib/openai";
import type { RetrievedPassage } from "@/lib/retrieval";

interface MemoRequest {
  scenario: string;
  structured_features: Record<string, unknown>;
  passages: RetrievedPassage[];
}

interface MemoResponse {
  memo: string;
  factor_analysis: Record<string, string>;
  cited_cases: string[];
}

function validateMemoResponse(obj: unknown): obj is MemoResponse {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.memo === "string" &&
    typeof o.factor_analysis === "object" &&
    Array.isArray(o.cited_cases)
  );
}

export async function POST(request: Request) {
  try {
    const body: MemoRequest = await request.json();

    if (!body.scenario || !body.passages) {
      return NextResponse.json(
        { error: "Missing scenario or passages" },
        { status: 400 }
      );
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        {
          memo: null,
          factor_analysis: null,
          cited_cases: [],
          source: "unavailable",
        }
      );
    }

    // Take top passages sorted by similarity, limit to reduce token cost
    const topPassages = body.passages
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8)
      .map((p) => ({
        ...p,
        text_chunk: truncatePassage(p.text_chunk),
      }));

    const caseNames = [...new Set(topPassages.map((p) => p.case_id))];

    const passageText = topPassages
      .map(
        (p, i) =>
          `[Passage ${i + 1}] (Case: ${p.case_id}, Factor ${p.factor_number}, Similarity: ${p.similarity.toFixed(3)})\n${p.text_chunk}`
      )
      .join("\n\n");

    const systemPrompt = `You are a legal research assistant writing a fair use analysis memo under 17 U.S.C. § 107.

RULES:
1. Analyze each of the four fair use factors.
2. ONLY cite cases that appear in the retrieved passages below.
3. Quote directly from passages when supporting your analysis.
4. Do NOT hallucinate or invent case names, citations, or holdings.
5. If a case is not in the retrieved passages, do NOT reference it.
6. Be balanced and identify both strengths and weaknesses.

Return ONLY valid JSON with this structure:
{
  "memo": "Full analysis memo text (use \\n for paragraphs)",
  "factor_analysis": {
    "factor_1": "Analysis of Purpose and Character of Use",
    "factor_2": "Analysis of Nature of Copyrighted Work",
    "factor_3": "Analysis of Amount and Substantiality",
    "factor_4": "Analysis of Market Effect"
  },
  "cited_cases": ["case_id_1", "case_id_2"]
}`;

    const userMessage =
      `SCENARIO:\n${body.scenario}\n\n` +
      `FEATURES:\n${JSON.stringify(body.structured_features, null, 2)}\n\n` +
      `RETRIEVED PASSAGES:\n${passageText}`;

    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    logTokenUsage("generateMemo", response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { memo: null, factor_analysis: null, cited_cases: [], source: "failed" }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("[generateMemo] Failed to parse LLM JSON");
      return NextResponse.json(
        { memo: content, factor_analysis: null, cited_cases: [], source: "raw" }
      );
    }

    if (!validateMemoResponse(parsed)) {
      return NextResponse.json(
        { memo: null, factor_analysis: null, cited_cases: [], source: "invalid" }
      );
    }

    const memo = parsed as MemoResponse;

    // Citation verification: reject any cited case not in retrieved set
    const validCases = memo.cited_cases.filter((c) => caseNames.includes(c));
    const rejected = memo.cited_cases.filter((c) => !caseNames.includes(c));
    if (rejected.length > 0) {
      console.warn(
        `[generateMemo] Rejected hallucinated citations: ${rejected.join(", ")}`
      );
    }

    return NextResponse.json({
      memo: memo.memo,
      factor_analysis: memo.factor_analysis,
      cited_cases: validCases,
      rejected_citations: rejected,
      source: "llm",
    });
  } catch (err) {
    console.error("[generateMemo] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
