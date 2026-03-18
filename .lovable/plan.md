

## Deep-Dive Visual & UX Analysis: Centrim Life Design System

### Reference Point
The uploaded screenshot shows the **existing Centrim Life production UI** — this is our branding north star. Key observations from that reference:

### 1. What the Reference Design Gets Right

| Element | Reference (Screenshot) | Our Current Build |
|---------|----------------------|-------------------|
| **Header** | Clean white bar, logo left, facility selector + icon toolbar right | Dark navy sidebar + slim shell header — different pattern but valid |
| **Count Cards** | Large coloured numbers (blue/green/red), full-width cards with generous padding, clear labels | Cramped cards with tiny `text-[11px]` uppercase labels, `text-2xl` numbers — close but lacks the breathing room |
| **Tab Bar** | Full-width underline tabs (Visitors / Residents / Staff / Contractor) with blue active indicator | Pill-style tabs inside a muted container — inconsistent with reference |
| **List Items** | Card-style rows with avatar, red left border, generous whitespace, large readable names | Dense table rows with small `text-sm` names — too compact for care staff |
| **Typography** | Names at ~16px, labels at ~13px, numbers at ~28-32px in cards | Names at 14px (`text-sm`), labels at 11px, numbers at 24px — all undersized |
| **Colour Usage** | Blue for counts, green for active status with green dot, red/green for card accents | Correct palette but applied too subtly |

### 2. Critical Visual Issues in Current Build

**A. Typography is too small across the board**
- Page title `text-lg` (18px) — should be `text-xl` (20px)
- Count card numbers `text-2xl` (24px) — reference shows ~32px, use `text-3xl`
- Card labels `text-[11px]` uppercase — too small for care staff, bump to `text-xs` (12px)
- Table header labels `text-[11px]` — acceptable for headers but row content `text-sm` (14px) should be 15-16px for names
- Command bar elements at `text-[12px]`/`text-[13px]` — fine for toolbar but buttons need minimum 13px

**B. Count cards lack visual weight**
- Reference shows bordered cards with coloured number (not coloured icon + label)
- Cards need more padding (`p-5` not `p-3.5`) and the number should be the dominant element
- The "Active" card in reference has a green status dot — currently missing
- Cards should have a subtle left border or background tint matching the accent colour

**C. Tab styling inconsistent with Centrim Life brand**
- Reference uses full-width underline tabs, not pill tabs
- Active tab has a thick blue bottom border (3-4px)
- Tab text is larger (~15px) and bold when active
- Current pill tabs work but look like a different product

**D. Table rows too dense**
- Reference shows card-like rows with ~80px height, avatar, and generous spacing
- Current rows are ~48px with small avatars (h-8)
- Names should be `text-[15px] font-semibold`, not `text-sm font-medium`
- Row left border (status indicator) should be thicker (3-4px, not 2px)

**E. Sidebar colour palette is good** — dark navy matches the Centrim Life brand. No changes needed.

**F. Filter bar styling**
- Reference shows clean dropdown selectors with subtle borders
- Wing pills are fine but should use the brand blue when active, not primary (which is dark navy)

### 3. Proposed Visual Refinements

**Scope: VisitList, Residents, and shared components**

#### 3a. Count Cards — Match reference style
- Increase padding to `p-5`
- Number: `text-3xl font-bold` with colour matching the card type (blue for total, green for active, red for overstayed)
- Label: `text-sm text-muted-foreground` below the number (not uppercase)
- Add subtle background tint on active cards
- Add green status dot on "Active" card (matching reference)
- Remove the icon from the label row — the number colour IS the indicator

#### 3b. Tab Bar — Underline style
- Switch from pill tabs to underline tabs matching the reference
- Full-width tabs with equal spacing
- Active: `text-primary font-semibold` with 3px blue bottom border
- Inactive: `text-muted-foreground font-medium`
- Remove the muted background container

#### 3c. Table Typography
- Visitor/resident names: `text-[15px] font-semibold`
- Contact/secondary info: `text-[13px]`
- Table headers: `text-xs uppercase tracking-wider` (keep current)
- Row height: min `h-[64px]` with `py-3`
- Avatar: `h-10 w-10` (up from h-8)
- Left border: `border-l-[3px]`

#### 3d. Command Bar
- Keep the current layout — it works well
- Bump action button text to `text-[13px]`
- "New Visit" primary button: add slightly more padding `px-4`

#### 3e. Residents Page — Align with VisitList
- Apply same count card styling (3 cards: In Building / Away / Overdue)
- Apply same underline tab pattern
- Apply same table row sizing/typography
- Stats strip below header: keep but increase font to `text-[13px]`

#### 3f. Global Typography Adjustment
- No changes to `index.css` or `tailwind.config.ts` — all fixes are component-level
- Ensure Inter font is loading (it is, via the config)

### 4. Files to Modify

1. **`src/pages/VisitList.tsx`** — Count cards: larger numbers, coloured text, more padding, no icons in labels, add status dot
2. **`src/components/VisitorTable.tsx`** — Underline tabs, larger row content, bigger avatars, thicker left borders
3. **`src/pages/Residents.tsx`** — Same count card and tab styling as VisitList
4. **`src/components/ResidentPresenceTable.tsx`** — Larger rows, bigger avatars, thicker borders
5. **`src/components/ResidentDirectoryTable.tsx`** — Same row sizing
6. **`src/components/TabContextStats.tsx`** — Slightly larger text
7. **`src/components/ResidentFilterBar.tsx`** — Minor spacing tweaks

### 5. What NOT to Change
- Sidebar design (already matches brand)
- Colour palette / CSS variables (correct)
- Page layout architecture (slim shell + command bar)
- Font family (Inter is correct)

