# In-app booking is a channel into the PMS — the app holds no inventory

Room-availability truth lives in the PMS (new-hotel, which also handles
legacy iHOTEL writeback). The loyalty app is a *booking channel*: it queries
live availability from a PMS API and creates confirmed bookings **in the
PMS**. The app's local room tables serve as a per-property display catalog
(photos, descriptions, prices) mapped to PMS room types; its booking rows are
channel records referencing the PMS booking ID.

## Considered options

- **Independent inventory with two-way sync** (what the pre-existing schema
  implies) — rejected: two sources of truth racing each other is an
  overbooking machine.
- **Allotment (PMS grants the app N rooms/night to sell)** — rejected: adds
  manual allotment upkeep and shows false "sold out"; allotments exist for
  third-party channels, and this channel is first-party.

## Consequences

- The app cannot confirm a booking when the PMS is unreachable — degraded
  mode is "browse but not book", accepted deliberately.
- `rooms` / `room_blocked_dates` stop being availability data; do not "fix"
  the booking flow by resurrecting them as inventory.
- Payment stays on the loyalty side (50% deposit or full, per-property
  PromptPay receiving accounts, staff slip verification); the PMS booking
  carries paid-vs-balance-due and unpaid bookings auto-release.
