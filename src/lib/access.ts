import { getSupabaseServer } from "./supabase";
import { getSubscriptionStatus } from "./subscription";

function parseEnvLimit(raw: string | undefined, defaultValue: number): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return Math.floor(parsed);
}

export const FREE_AI_USES_LIMIT = parseEnvLimit(
  process.env.FREE_AI_USES_LIMIT,
  5
);

export const FREE_AUXILIARY_AI_LIMIT = parseEnvLimit(
  process.env.FREE_AUXILIARY_AI_USES_LIMIT,
  3
);

export type AccessSource = "subscription" | "free" | "none";

export interface AccessStatus {
  active: boolean;
  canAnalyze: boolean;
  /** Chat and standalone AI endpoints (extractFeatures, generateMemo). */
  canChat: boolean;
  freeAnalysesRemaining: number;
  freeAnalysesLimit: number;
  freeAuxiliaryRemaining: number;
  freeAuxiliaryLimit: number;
  source: AccessSource;
  status?: string;
  currentPeriodEnd?: string;
}

async function getUsageRow(userId: string): Promise<{
  free_analyses_consumed: number;
  free_auxiliary_ai_consumed: number;
}> {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("user_usage")
      .select("free_analyses_consumed, free_auxiliary_ai_consumed")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      await supabase.from("user_usage").upsert(
        {
          user_id: userId,
          free_analyses_consumed: 0,
          free_auxiliary_ai_consumed: 0,
        },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
      return { free_analyses_consumed: 0, free_auxiliary_ai_consumed: 0 };
    }

    return {
      free_analyses_consumed: data.free_analyses_consumed ?? 0,
      free_auxiliary_ai_consumed: data.free_auxiliary_ai_consumed ?? 0,
    };
  } catch {
    return { free_analyses_consumed: 0, free_auxiliary_ai_consumed: 0 };
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
      freeAuxiliaryRemaining: 0,
      freeAuxiliaryLimit: FREE_AUXILIARY_AI_LIMIT,
      source: "subscription",
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  const usage = await getUsageRow(userId);
  const analysesRemaining = Math.max(
    0,
    FREE_AI_USES_LIMIT - usage.free_analyses_consumed
  );
  const auxiliaryRemaining = Math.max(
    0,
    FREE_AUXILIARY_AI_LIMIT - usage.free_auxiliary_ai_consumed
  );

  const hasAnyFree = analysesRemaining > 0 || auxiliaryRemaining > 0;

  return {
    active: false,
    canAnalyze: analysesRemaining > 0,
    canChat: auxiliaryRemaining > 0,
    freeAnalysesRemaining: analysesRemaining,
    freeAnalysesLimit: FREE_AI_USES_LIMIT,
    freeAuxiliaryRemaining: auxiliaryRemaining,
    freeAuxiliaryLimit: FREE_AUXILIARY_AI_LIMIT,
    source: hasAnyFree ? "free" : "none",
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

export async function consumeFreeAuxiliaryAiUse(
  userId: string
): Promise<ConsumeResult> {
  const sub = await getSubscriptionStatus(userId);
  if (sub.active) {
    return { ok: true, source: "subscription" };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc(
      "consume_free_auxiliary_ai_use",
      {
        p_user_id: userId,
        p_limit: FREE_AUXILIARY_AI_LIMIT,
      }
    );

    if (error || data == null) {
      return { ok: false, source: "none", remaining: 0 };
    }

    const consumed = typeof data === "number" ? data : Number(data);
    return {
      ok: true,
      consumed,
      remaining: Math.max(0, FREE_AUXILIARY_AI_LIMIT - consumed),
      source: "free",
    };
  } catch {
    return { ok: false, source: "none", remaining: 0 };
  }
}

/** Gate chat + standalone extractFeatures / generateMemo. */
export function canUseAuxiliaryAi(access: AccessStatus): boolean {
  return access.active || access.canChat;
}

/** Allow reading chat history after free auxiliary quota is used up. */
export function canAccessChatHistory(access: AccessStatus): boolean {
  if (access.active) return true;
  return (
    access.freeAuxiliaryLimit - access.freeAuxiliaryRemaining > 0
  );
}
