import { getSupabaseServer } from "./supabase";

export async function getSubscriptionStatus(userId: string): Promise<{
  active: boolean;
  status?: string;
  currentPeriodEnd?: string;
}> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return { active: false };
    }

    const hasPaidStripeSub =
      typeof data.stripe_subscription_id === "string" &&
      data.stripe_subscription_id.length > 0;

    if (!hasPaidStripeSub) {
      return { active: false, status: data.status ?? undefined };
    }

    const activeStatuses = ["active", "canceling", "trialing"];
    const isActive =
      activeStatuses.includes(data.status) &&
      data.current_period_end &&
      new Date(data.current_period_end) > new Date();

    return {
      active: isActive,
      status: data.status ?? undefined,
      currentPeriodEnd: data.current_period_end ?? undefined,
    };
  } catch {
    return { active: false };
  }
}
