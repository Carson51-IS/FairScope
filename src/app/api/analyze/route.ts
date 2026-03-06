import { NextResponse } from "next/server";
import { analyzeScenario } from "@/lib/analysis";
import type { ScenarioInput } from "@/lib/types";
import type { UseType } from "@/lib/types";

const VALID_USE_TYPES: UseType[] = [
  "parody",
  "commentary",
  "criticism",
  "thumbnail",
  "search_engine",
  "music_sampling",
  "news_reporting",
  "nonprofit_education",
  "commercial_remix",
  "ai_training",
  "biographical_excerpt",
  "software_api",
  "archival",
  "satire",
  "artistic_appropriation",
  "research",
  "other",
];

function validateScenarioInput(body: unknown): {
  valid: true;
  scenario: ScenarioInput;
} | {
  valid: false;
  error: string;
} {
  if (body === null || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const obj = body as Record<string, unknown>;

  const required = [
    "description",
    "work_type",
    "use_type",
    "amount_used",
    "is_commercial",
    "purpose",
    "licensing_available",
    "additional_context",
  ] as const;

  for (const key of required) {
    if (!(key in obj)) {
      return {
        valid: false,
        error: `Missing required field: ${key}.`,
      };
    }
  }

  if (typeof obj.description !== "string") {
    return { valid: false, error: "Field 'description' must be a string." };
  }
  if (typeof obj.work_type !== "string") {
    return { valid: false, error: "Field 'work_type' must be a string." };
  }
  if (typeof obj.use_type !== "string") {
    return { valid: false, error: "Field 'use_type' must be a string." };
  }
  if (!VALID_USE_TYPES.includes(obj.use_type as UseType)) {
    return {
      valid: false,
      error: `Field 'use_type' must be one of: ${VALID_USE_TYPES.join(", ")}.`,
    };
  }
  if (typeof obj.amount_used !== "number") {
    return { valid: false, error: "Field 'amount_used' must be a number." };
  }
  if (typeof obj.is_commercial !== "boolean") {
    return { valid: false, error: "Field 'is_commercial' must be a boolean." };
  }
  if (typeof obj.purpose !== "string") {
    return { valid: false, error: "Field 'purpose' must be a string." };
  }
  if (
    obj.licensing_available !== null &&
    typeof obj.licensing_available !== "boolean"
  ) {
    return {
      valid: false,
      error: "Field 'licensing_available' must be a boolean or null.",
    };
  }
  if (typeof obj.additional_context !== "string") {
    return {
      valid: false,
      error: "Field 'additional_context' must be a string.",
    };
  }

  const scenario: ScenarioInput = {
    description: obj.description as string,
    work_type: obj.work_type as string,
    use_type: obj.use_type as UseType,
    amount_used: obj.amount_used as number,
    is_commercial: obj.is_commercial as boolean,
    purpose: obj.purpose as string,
    licensing_available: obj.licensing_available as boolean | null,
    additional_context: obj.additional_context as string,
    jurisdiction: (obj.jurisdiction as ScenarioInput["jurisdiction"]) ?? null,
  };

  return { valid: true, scenario };
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const validation = validateScenarioInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const result = await analyzeScenario(validation.scenario);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analyze API error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/analyze",
    method: "POST",
    description:
      "Accepts a fair use scenario and returns an analysis result. Send a JSON body matching ScenarioInput.",
  });
}
