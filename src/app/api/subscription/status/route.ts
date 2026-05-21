import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_AI_USES_LIMIT,
  FREE_AUXILIARY_AI_LIMIT,
  getAccessStatus,
} from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        active: false,
        canAnalyze: false,
        canChat: false,
        freeAnalysesRemaining: 0,
        freeAnalysesLimit: FREE_AI_USES_LIMIT,
        freeAuxiliaryRemaining: 0,
        freeAuxiliaryLimit: FREE_AUXILIARY_AI_LIMIT,
        source: "none",
      });
    }

    const access = await getAccessStatus(user.id);
    return NextResponse.json(access);
  } catch {
    return NextResponse.json({
      active: false,
      canAnalyze: false,
      canChat: false,
      freeAnalysesRemaining: 0,
      freeAnalysesLimit: FREE_AI_USES_LIMIT,
      freeAuxiliaryRemaining: 0,
      freeAuxiliaryLimit: FREE_AUXILIARY_AI_LIMIT,
      source: "none",
    });
  }
}
