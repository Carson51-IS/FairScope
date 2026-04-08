-- OPTIONAL: run once in Supabase SQL editor if old rows granted access without Stripe.
-- Removes subscription rows that never had a real Stripe subscription id.
-- delete from subscriptions
-- where stripe_subscription_id is null or stripe_subscription_id = '';

-- OPTIONAL: wipe all subscription access (everyone must re-checkout)
-- truncate table subscriptions restart identity cascade;
