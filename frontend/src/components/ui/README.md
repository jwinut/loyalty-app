# UI primitives

Core design-system building blocks: `Button`, `Card`, `Badge`, `Skeleton`,
plus the `cn()` class-merge helper. Everything here composes the tokens
from `tailwind.config.js` (PR1) — it does not introduce new colors, radii,
shadows, or type sizes of its own.

## Token grammar recap

These rules are enforced by `scripts/check-design.cjs`, wired into
`npm run lint`. New off-system styling fails CI; existing debt is
grandfathered via `scripts/design-baseline.json` (never edit that file
upward — only ratchet it down with `--update` as pages migrate).

- **Color** — one accent (`brand-*`), warm neutrals only
  (`surface.page/card/sunken`, `ink.*`, `hairline.*`, `tile.*`), plus the
  semantic set `success/warning/error/info`. No `gray-`/`slate-`/`zinc-`/
  `neutral-`, no hardcoded hex literals.
- **Weight** — `font-semibold` (600) and `font-bold` (700) only.
  `font-medium` (500) and `font-extrabold` (800) are banned; the ladder
  doesn't include those steps.
- **Radii** — `rounded-lg` (8px, utility surfaces), `rounded-card` (18px,
  cards), `rounded-full` (pills, avatars). `rounded-md/xl/2xl/3xl` are
  off-grammar.
- **Shadows** — `shadow-soft` and `shadow-pop` are the only two
  elevations (imagery/QR card, and popovers/centered modals,
  respectively). Legacy `shadow`/`shadow-sm/md/lg/xl/2xl/inner` are
  hard-overridden to no-ops — don't reach for them.
- **Type** — the named scale only: `text-fine/caption/body/title/
  display/display-lg/display-xl/hero`. Never `text-3xl`-style raw sizes.
- **Spacing** — the base Tailwind scale plus `5.5` (22px, pill button
  horizontal padding). Prefer the primitives below over hand-rolled
  padding/radius/shadow combinations.

## Primitives

| Component  | Purpose                                   | Key props |
|------------|--------------------------------------------|-----------|
| `Button`   | Actions, in five variants + three sizes    | `variant`, `size`, `loading` |
| `buttonVariants()` | Class string only — for non-`<button>` elements (e.g. `<Link>`) that must look like a button | `variant`, `size`, `className` |
| `Card`     | Grouped content on `card`/`sunken`/`tile` surfaces | `surface`, `padding`, `as` |
| `Badge`    | Small status/tier pill                     | `tone`, `size` |
| `Skeleton` | Loading placeholder                        | `className` |

Every primitive stamps a `data-*` attribute matching its variant prop
(`data-variant`, `data-size`, `data-surface`, `data-tone`) so tests and
downstream styling can hook off state without parsing class strings.

`Card` and `Button` never render a shadow — flat surfaces read via
border + surface-color changes only, per the grammar above.

## Grid collapse conventions

Use these breakpoints consistently so pages built from these primitives
collapse the same way:

- **Card grids** (dashboards, listing pages):
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Stat tiles** (KPI rows):
  `grid-cols-2 lg:grid-cols-4`
- **Forms** (label/field pairs, settings panels):
  `grid-cols-1 md:grid-cols-2`

## Test doctrine

Tests in `__tests__/` follow these rules:

- Assert **roles and accessible names** (`getByRole('button', { name: ... })`),
  not implementation details.
- Assert **`data-variant` / `data-size` / `data-surface` / `data-tone`**
  attributes to pin down variant behavior.
- Assert **disabled state** (`toBeDisabled()`) and **`aria-busy`** when
  `Button` is `loading`.
- The `loading` spinner must be **invisible to the accessibility tree**
  (`aria-hidden="true"`, no competing accessible name/role) — the
  button's accessible name must still resolve to its children only.
- **Do not assert raw Tailwind class strings** anywhere except the one
  `buttonVariants()` merge sanity test, which exists specifically to
  confirm the `tailwind-merge` integration resolves conflicting
  utilities (e.g. a caller's `className` overriding a size's padding)
  down to a single winner instead of emitting both.
- Caller-supplied `className` passthrough is tested with a plain,
  non-Tailwind marker class (e.g. `"promo-card-marker"`) — that's
  testing prop wiring, not the design system's token grammar.
