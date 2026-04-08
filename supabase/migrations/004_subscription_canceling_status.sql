-- Allow cancel_at_period_end flow stored as canceling (see subscription/cancel route).
alter table subscriptions drop constraint if exists subscriptions_status_check;

alter table subscriptions add constraint subscriptions_status_check
  check (status in (
    'active',
    'canceled',
    'past_due',
    'trialing',
    'incomplete',
    'canceling'
  ));
