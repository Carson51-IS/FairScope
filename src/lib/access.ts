import { getSupabaseServer } from "./supabase";
import { getSubscriptionStatus } from "./subscription";

export const FREE_AI_USES_LIMIT = (() => {
  const raw = process.env.FREE_AI_USES_LIMIT;
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < 0) return 5;
  return Math.floor(parsed);
})();

export type AccessSource = "subscription" | "free" | "none";

export interface AccessStatus {
  active: boolean;
  canAnalyze: boolean;
  canChat: boolean;
  freeAnalysesRemaining: number;
  freeAnalysesLimit: number;
  source: AccessSource;
  status?: string;
  currentPeriodEnd?: string;
}

async function getFreeAnalysesConsumed(userId: string): Promise<number> {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("user_usage")
      .select("free_analyses_consumed")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      await supabase
        .from("user_usage")
        .upsert(
          { user_id: userId, free_analyses_consumed: 0 },
          { onConflict: "user_id", ignoreDuplicates: true }
        );
      return 0;
    }

    return data.free_analyses_consumed ?? 0;
  } catch {
    return 0;
  }
}

export async function getAccessStatus(userId: string): Promise<AccessStatus> {
  const sub = await getSubscriptionStatus(userId);

  if (sub.active) {
    return {
      active: true,
      canAnalyze: true,
      canChat: true,
      freeAnalysesRemaining: 0,
      freeAnalysesLimit: FREE_AI_USES_LIMIT,
      source: "subscription",
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  const consumed = await getFreeAnalysesConsumed(userId);
  const remaining = Math.max(0, FREE_AI_USES_LIMIT - consumed);

  return {
    active: false,
    canAnalyze: remaining > 0,
    canChat: false,
    freeAnalysesRemaining: remaining,
    freeAnalysesLimit: FREE_AI_USES_LIMIT,
    source: remaining > 0 ? "free" : "none",
    status: sub.status,
  };
}

export interface ConsumeResult {
  ok: boolean;
  consumed?: number;
  remaining?: number;
  source: AccessSource;
}

export async function consumeFreeAnalysisUse(
  userId: string
): Promise<ConsumeResult> {
  const sub = await getSubscriptionStatus(userId);
  if (sub.active) {
    return { ok: true, source: "subscription" };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("consume_free_analysis_use", {
      p_user_id: userId,
      p_limit: FREE_AI_USES_LIMIT,
    });

    if (error || data == null) {
      return { ok: false, source: "none", remaining: 0 };
    }

    const consumed = typeof data === "number" ? data : Number(data);
    return {
      ok: true,
      consumed,
      remaining: Math.max(0, FREE_AI_USES_LIMIT - consumed),
      source: "free",
    };
  } catch {
    return { ok: false, source: "none", remaining: 0 };
  }
}
