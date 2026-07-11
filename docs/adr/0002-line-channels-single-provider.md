# All LINE channels live under a single LINE provider

The two OAs' Messaging API channels (HF, HF Ville) and the existing LINE
Login channel (which the LIFF app attaches to) must all be created under the
**same LINE provider** — the provider that already holds the Login channel
whose `client_id` is in the OAuth config. LINE scopes userIds to the
provider, so this is what makes the userId obtained from LIFF/Login identical
to the userId each OA sees, giving us member↔OA-friend linking for free.

## Consequences

- **Channels can never be moved between providers.** Enabling Messaging API
  on an OA under the wrong (e.g., freshly auto-created) provider is an
  unrecoverable mistake short of recreating the channel. Whoever performs the
  console step must select the existing provider explicitly.
- Push routing (property-affinity, see `CONTEXT.md` **Friendship**) and
  silent LIFF enrollment both depend on this shared userId space; under
  split providers we would need LINE's per-OA account-linking flow instead.
