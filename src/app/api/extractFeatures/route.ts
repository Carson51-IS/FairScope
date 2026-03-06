import { NextResponse } from "next/server";
import { getOpenAI, isOpenAIConfigured, logTokenUsage } from "@/lib/openai";
import { extractFeatures as extractFeaturesLocal } from "@/lib/analysis";
import type { ScenarioInput, ExtractedFeatures } from "@/lib/types";

const SYSTEM_PROMPT = `You are a legal research assistant specializing in U.S. copyright fair use analysis under 17 U.S.C. § 107.

Given a scenario description, extract structured features relevant to fair use analysis.

Return ONLY valid JSON with this exact structure:
{
  "commerciality": "commercial" | "noncommercial" | "mixed",
  "transformation_level": "highly_transformative" | "moderately_transformative" | "minimally_transformative" | "not_transformative",
  "amount_used": "minimal" | "short excerpt" | "moderate" | "substantial" | "entire work",
  "market_harm_risk": "low" | "moderate" | "high" | "unknown",
  "purpose_type": string (e.g. "parody", "commentary", "education", "commercial use", etc.),
  "work_type_nature": "creative" | "factual" | "mixed" | "functional",
  "transformative_claim": boolean,
  "reasoning": string (1-2 sentences explaining your assessment)
}

Be precise. Base your assessment on the facts provided, not assumptions.`;

interface LLMFeatures {
  commerciality: string;
  transformation_level: string;
  amount_used: string;
  market_harm_risk: string;
  purpose_type: string;
  work_type_nature: string;
  transformative_claim: boolean;
  reasoning: string;
}

function validateLLMFeatures(obj: unknown): obj is LLMFeatures {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.commerciality === "string" &&
    typeof o.transformation_level === "string" &&
    typeof o.amount_used === "string" &&
    typeof o.market_harm_risk === "string" &&
    typeof o.purpose_type === "string" &&
    typeof o.transformative_claim === "boolean"
  );
}

function mapLLMToExtracted(
  llm: LLMFeatures,
  scenario: ScenarioInput
): ExtractedFeatures {
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

  return {
    work_type: scenario.work_type,
    use_type: scenario.use_type,
    commercial: llm.commerciality === "commercial" || scenario.is_commercial,
    amount: amountMap[llm.amount_used] ?? "moderate",
    transformative_claim: llm.transformative_claim,
    market_substitution_risk: riskMap[llm.market_harm_risk] ?? "unknown",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scenario = body as ScenarioInput;

    if (!scenario.description) {
      return NextResponse.json(
        { error: "Missing scenario description" },
        { status: 400 }
      );
    }

    // Fall back to rule-based if OpenAI not configured
    if (!isOpenAIConfigured()) {
      const features = extractFeaturesLocal(scenario);
      return NextResponse.json({
        features,
        llm_features: null,
        source: "rule-based",
      });
    }

    const client = getOpenAI();

    const userMessage =
      `Scenario Description: ${scenario.description}\n` +
      `Purpose: ${scenario.purpose}\n` +
      `Work Type: ${scenario.work_type}\n` +
      `Use Type: ${scenario.use_type}\n` +
      `Amount Used: ${scenario.amount_used}%\n` +
      `Commercial: ${scenario.is_commercial}\n` +
      `Licensing Available: ${scenario.licensing_available}\n` +
      `Additional Context: ${scenario.additional_context}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    });

    logTokenUsage("extractFeatures", response.usage);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      const features = extractFeaturesLocal(scenario);
      return NextResponse.json({
        features,
        llm_features: null,
        source: "rule-based-fallback",
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("[extractFeatures] Failed to parse LLM JSON, falling back");
      const features = extractFeaturesLocal(scenario);
      return NextResponse.json({
        features,
        llm_features: null,
        source: "rule-based-fallback",
      });
    }

    if (!validateLLMFeatures(parsed)) {
      console.warn("[extractFeatures] Invalid LLM response schema, falling back");
      const features = extractFeaturesLocal(scenario);
      return NextResponse.json({
        features,
        llm_features: null,
        source: "rule-based-fallback",
      });
    }

    const llmFeatures = parsed as LLMFeatures;
    const features = mapLLMToExtracted(llmFeatures, scenario);

    return NextResponse.json({
      features,
      llm_features: llmFeatures,
      source: "llm",
    });
  } catch (err) {
    console.error("[extractFeatures] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
