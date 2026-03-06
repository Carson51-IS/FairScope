import { NextResponse } from "next/server";
import { loadAnalysis } from "@/lib/analysis";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await loadAnalysis(params.id);

    if (!result) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/analysis/:id] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
