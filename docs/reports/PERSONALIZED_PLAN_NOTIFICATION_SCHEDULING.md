# Personalized plan notification scheduling

Both production endpoints must be invoked by the external scheduler at least
once every five minutes:

- `POST /api/cron/plan-event-reminders`
- `POST /api/cron/plan-tomorrow-digests`

Requests use the existing `Authorization: Bearer $CRON_SECRET` contract. The
five-minute cadence is required for the admin-only five-minute real-event test
offset and is also the maximum expected scheduling jitter for normal reminders
and evening digests.

The reminder job queries only the indexed future `PlanItem.startsAt` window and
batch-loads user schedules. The digest job queries the indexed
`UserNotificationSchedule(planEveningEnabled, planEveningNextRunAt)` queue,
then batch-loads plan items for the due user/date pairs. Neither job creates a
per-user cron or scans every user on each tick.
