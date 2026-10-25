# Centrim Life Design System (Phase 9D / first 9F slice)

Scope of this document: how screens should look, read and behave. It records the
tokens and shared building blocks. Phase 9D applies the foundation and the first
9F slice to Today, Visit List, header/sidebar and kiosk welcome/home/shell only.

This is a prototype design standard. It is **not** a compliance or accessibility
certification. Contrast and WCAG 2.2 AA items below are design targets verified by
inspection and scripted checks, not an audited conformance statement.

## 1. Principles

- Calm, not clinical. Reception staff should see the day's work first, with
  advanced modules (contractors, volunteers, keys and fobs, food, emergency,
  administration) revealed only when needed.
- Never a dashboard-first product. No decorative charts, no ornamental motion.
- Status is never colour alone: always an icon and a word.
- Critical actions always carry visible text, never an icon on its own.
- One shared code base, with Australian and UK wording supplied by the operating
  context packs. Never hardcode "aged care", "care home", "resident" or "village".

## 2. Colour roles

All colours are HSL design tokens in `src/index.css`, exposed through
`tailwind.config.ts`. Components must use the token classes
(`bg-primary`, `text-muted-foreground`, `border-border`, …) and never raw colour
utilities such as `text-white` or `bg-[#123456]`.

| Role | Token | Used for |
| --- | --- | --- |
| Background / foreground | `--background`, `--foreground` | Page canvas and body text |
| Card | `--card`, `--card-foreground` | Panels, rows, sheets |
| Primary | `--primary` | Main action, active navigation |
| Secondary / muted / accent | `--secondary`, `--muted`, `--accent` | Quiet surfaces and meta text |
| Success | `--success` | Signed in, safe, saved |
| Warning | `--warning` | Overdue, needs review |
| Destructive | `--destructive` | Errors, blocked, delete |
| Emergency (new) | `--emergency`, `--emergency-foreground`, `--emergency-muted` | Live emergency mode only |
| Checkout | `--checkout` | Sign-out actions and signed-out state |
| Info | `--info` | Expected, informational context |
| Border / input / ring | `--border`, `--input`, `--ring` | Edges, fields, focus |
| Sidebar | `--sidebar-*` | Navigation shell |

Emergency is deliberately separate from destructive so a live emergency never
reads like an ordinary validation error. It must not be used for anything else.

### Contrast targets

- Body and control text: 4.5:1 minimum against its background.
- Large text (18px bold / 24px regular and above) and non-text status
  indicators: 3:1 minimum.
- Focus ring: 3:1 against both the control and the surface behind it.
- Both light and dark themes must meet these targets.

## 3. Typography

Source Sans 3, locally bundled in weights 400/500/600/700 through package CSS,
via `--font-sans`, with system UI / Segoe UI / Roboto fallbacks. Its humanist
forms and open counters suit reception and older kiosk users. Fixed scale:

| Step | Class | Use |
| --- | --- | --- |
| 12px | `text-xs` | Rare small staff meta only |
| 14px | `text-sm` | Secondary text, timestamps, supporting controls |
| 16px | `text-base` | Staff body, names, search and form fields |
| 18px | `text-lg` | Card and section titles |
| 20–24px | `text-xl` / `text-2xl` | Kiosk body / staff page titles |
| 30px+ | `text-3xl`+ | Emergency totals and kiosk headings only |

Nothing below 12px is permitted in staff screens, and nothing below 16px for
input text on kiosk. Use `tabular-nums` for times, counts and totals.

## 4. Spacing, borders, radii

- Page padding: 16px (tablet) / 24px (desktop). Section gap: 24px.
- Card padding: 12px (dense) / 16px (default). Control gap: 8px.
- Rows: `min-h-row-compact` (40px) or `min-h-row-comfortable` (52px).
- Touch targets: `min-h-touch` / `min-w-touch` (44px) minimum on desktop and
  tablet, `min-h-kiosk` (56px) on kiosk.
- Borders: 1px `border-border`. Cards may use the existing `shadow-card`.
- Radii: `rounded-control` for controls and status labels, `rounded-card` (8px)
  for repeated framed items; existing rounded-xl modal convention remains.

## 5. Focus and motion

- A single global `:focus-visible` rule draws a 2px ring in `--focus-ring` with a
  2px offset. Focus outlines must never be removed; if a control needs a custom
  look, it must still show a visible ring.
- `prefers-reduced-motion: reduce` now disables animation and transition
  durations globally, including Tailwind utility transitions and component
  animation. Components should not reintroduce motion that ignores it.
- No new animation libraries. Motion is limited to state feedback under 200ms.

## 6. Status presentation

`src/lib/statusPresentation.ts` is the single source of truth. Each status has a
word, a plain-language description, a Lucide icon and a tone token:

| Group | Statuses |
| --- | --- |
| Visit and presence | Expected, On site, Overdue, Signed out, Away, Returned |
| Screening and safeguarding | Clear, Needs review, Blocked, Not provided |
| Emergency roll call | Safe, Safe elsewhere, Not located, Assistance required, Off site |

Unknown keys fall back to "Unknown" rather than rendering nothing.

```tsx
import { StatusBadge } from "@/components/ui/status-badge";

<StatusBadge status="overdue" />                      // warning pill, clock icon, "Overdue"
<StatusBadge status="not-located" emphasis="solid" size="md" />
```

## 7. Iconography rules

- Lucide only. No emoji and no decorative Unicode symbols (no tick, cross, warning triangle, arrow or keyboard glyphs).
  Use `Check`, `X`, `AlertTriangle`, `ArrowRight` components instead.
- Decorative icons: `aria-hidden="true"`.
- Icon-only controls: an `aria-label` describing the action ("Refresh list").
- Critical actions (sign in, sign out, resolve emergency, save settings, export)
  must show visible text next to the icon.
- Icon size: 16px inline, 20px in headers, 24px+ on kiosk.

## 8. Shared building blocks

| Component | Purpose |
| --- | --- |
| `ui/status-badge.tsx` | Status as icon + word, colour-independent |
| `ui/page-header.tsx` | One `<h1>` per page, description, site context, actions slot |
| `ui/data-table-shell.tsx` | Toolbar, announced result count, one "Clear filters" control |
| `components/states/index.tsx` (existing) | Loading, empty, error, permission, offline |
| `components/ui/*` (existing shadcn) | Buttons, inputs, dialogs, sheets, tables |
| `ui/reception-primitives.tsx` | Compact QuickAction, MetricStrip, AttentionRow, KioskActionTile; presentation only |

These do not replace existing components; they standardise the frame around them.

```tsx
<PageHeader
  title="Visit list"
  description="Everyone expected, on site and signed out today."
  context="Riverstone Aged Care"
  actions={<Button><UserPlus aria-hidden="true" className="h-4 w-4" /><span>Sign someone in</span></Button>}
/>

<DataTableShell
  toolbar={searchAndChips}
  resultCount={rows.length}
  resultNoun="visit"
  filtersActive={hasFilters}
  onClearFilters={resetAll}
>
  <VisitorTable ... />
</DataTableShell>
```

## 9. Accessibility rules

- Exactly one `<main>` and one `<h1>` per route; heading levels never skip.
- Every input has a visible `<Label>` or an `aria-label`; placeholders are not labels.
- Keyboard reaches every control, in a logical order; dialogs and sheets trap and
  then restore focus.
- Result counts, save outcomes and roll-call totals use `aria-live="polite"`;
  emergency state changes use `aria-live="assertive"`.
- Status must be understandable with colour ignored.
- Screen-reader text uses the same words as the visible label.

## 10. Responsive principles

| Width | Behaviour |
| --- | --- |
| 768 (tablet) | Single column, sticky action bar, 44px targets, no horizontal scroll |
| 1024 | Two-pane where already present |
| 1280 / 1440 | Max content width; tables do not stretch to full bleed |
| Kiosk | Own layout, 56px targets, no staff or administration surfaces |

Full-height shells use `h-dvh` rather than `h-screen` (applied in Increment 2).
No horizontal overflow at 768, 1024, 1280 or 1440 on any route.

## 11. Known limitations

- Remaining modules have not received a screen-by-screen visual review. Shared
  tokens do not establish accessibility conformance of untouched screens.
- The `leave_types.emoji` column is untouched. The table holds no rows, and the
  UI will move to a fixed display-only Lucide mapping in a later increment; no
  stored data is migrated.
- WCAG 2.2 AA is the design target. No assistive-technology user testing has been
  carried out, and nothing here should be presented as certified compliance.

## 12. Accessible status colour variants

Base status colours (`--success`, `--warning`, `--destructive`, `--emergency`,
`--info`, `--checkout`) are tuned for fills, borders and large text. For small
status words two additional token families were added:

- `--{role}-strong` — status text on the page background, at least 4.5:1 in both
  light and dark themes (`text-warning-strong`, `text-emergency-strong`, …).
- `--{role}-solid` — chip background paired with white text, at least 4.5:1 in
  both themes (`bg-emergency-solid text-emergency-foreground`).

`STATUS_TONE_CLASSES` in `src/lib/statusPresentation.ts` already uses these, so
`StatusBadge` is accessible by default. Measured contrast (page background):
success 4.82 / 8.70, warning 4.77 / 7.20, error 4.69 / 4.67, emergency 4.71 /
4.68, info 4.66 / 5.88, sign-out 4.69 / 5.28 (light / dark).

## 13. Phase 9D visual foundation and bounded first slice

- Light canvas near #F6F9FE (`--background`), white surfaces (`--card`), deep
  Centrim blue near #123F8C (`--primary`), charcoal foreground and subtle borders.
  Logo remains unchanged; bright `--brand-accent` is restrained. Dark primary
  pairs a light blue fill with a dark foreground for readable controls.
- Semantic emergency and status-strong/solid roles remain separate. Attendance
  status labels do not imply physically verified emergency safety.
- Global body/secondary/kiosk font, page gutter, section gap, density and touch
  tokens are centralised. Light shadows use token values, not decorative elevation.
- Today uses an action toolbar, compact metric strip, attention rows, on-site
  list then recent activity. Existing handlers/counts are unchanged.
- Visit List shows search and named commands, wrapping view/type controls, and
  date controls only in historic/expected-back views. Below wide desktop it uses
  readable stacked rows; no horizontally scrolling table is required.
- Header uses PageHeader as its single title treatment and retains the site
  switcher, occupancy, outbreak control and notifications. White sidebar with
  deep blue current-route indicator; emergency entry remains red and labelled.
- Kiosk welcome/home/shell use plain light surfaces, dominant Sign In/Sign Out,
  configured resident/card actions, labelled Help and visible Start Over. PIN,
  binding, idle warning, routes and check-in/out logic are unchanged. Help uses
  the existing accessible Dialog primitive; no photographic blur or pulsing CTA.
- No operational record, schema, policy or RPC is changed in this slice.
