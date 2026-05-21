import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAnalysis } from "@/lib/analysis";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await loadAnalysis(params.id, user.id);

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
