# One loyalty program across all properties

The company operates two hotels (HF, HF Ville) but runs exactly one loyalty
program. Membership, points, and nights-based tiers are program-wide: a
member earns at either property and redeems at either property, and tier is
computed from total nights summed across properties. Property is an
*attribute* of a stay, redemption, or coupon restriction — never a partition
of members, balances, or tiers.

## Considered options

- **Two programs (one per property)** — rejected: doubles engineering and
  operations, weakens the guest value proposition, and contradicts how the
  company already operates (finance and P&L are company-wide).
- **Hybrid (shared tier, per-property points)** — rejected: the confusing
  middle; coupons get property scoping instead (see `CONTEXT.md`:
  a coupon may optionally be restricted to one property).

## Consequences

Once points from both properties commingle in one balance, splitting the
program later is effectively impossible — this is a one-way door, chosen
deliberately. The two LINE Official Accounts are two doors into the same
program, not two programs.
