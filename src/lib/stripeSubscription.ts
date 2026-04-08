import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export function subscriptionPeriodEndIso(
  subscription: Stripe.Subscription
): string | null {
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_end) {
    return new Date(firstItem.current_period_end * 1000).toISOString();
  }
  return null;
}

export async function upsertSubscriptionFromStripe(
  supabase: SupabaseClient,
  params: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: string | null;
  }
): Promise<void> {
  await supabase.from("subscriptions").upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      status: params.status,
      current_period_end: params.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
