# DuitKu — Modern Fintech Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give DuitKu a cohesive, modern, professional-but-simple look (indigo fintech, light mode) across every screen — not just a recolor, but intentional consistency and depth.

**Architecture:** All screens read design values from a single source (`frontend/src/lib/theme.ts`). The brand recolor (Phase 0) is already shipped, so most screens already inherit the new palette. The remaining work removes hardcoded color debt, adds shared visual primitives (card depth, sheet handles, header shadow), and does a per-screen polish + verification pass.

**Tech Stack:** React Native + Expo Router, TypeScript, `StyleSheet.create`, `lucide-react-native`, `react-native-svg`.

**Verification note:** This is visual styling — there are no unit tests to write. Each task is verified by (a) `npx tsc --noEmit` (no new type errors) and (b) a visual check in the running app (`npx expo start`). The repo has 5 PRE-EXISTING type errors in `transaction.tsx`, `biometricService.ts`, `pinService.ts` unrelated to styling — do not treat those as regressions; only new errors count.

---

## Design Decisions (locked)

- **Palette:** Indigo `#4F46E5` primary, cool-gray `#F4F5F8` background, white surfaces, amber `#F59E0B` accent. Income `#10B981`, expense `#EF4444`. (Shipped in Phase 0.)
- **Mode:** Light only. No dark mode this round.
- **FAB:** Stays **amber** (`colors.accent`). It is the signature CTA, pairs well with indigo, and the empty-state copy literally says "tombol kuning". Do NOT switch it to indigo unless the user later changes their mind.
- **Corner language:** Header/drawer chrome uses `radius.lg` (16) for a crisp profile; bottom sheets keep `radius.xl` (24) — large top radius is a deliberate modern bottom-sheet convention.

---

## File Structure

**Already modified (Phase 0 — shipped, verify still intact):**
- `frontend/src/lib/theme.ts` — indigo palette, `primarySoft` token, softer/cooler shadows.
- `frontend/app/_layout.tsx` — stack background uses `colors.background`.
- `frontend/src/components/SideDrawer.tsx` — active tint uses `colors.primarySoft`, header corner `radius.lg`.
- `frontend/src/components/Header.tsx` — bottom corner `radius.lg`.
- `frontend/src/lib/icons.tsx` — `COLOR_PALETTE` modernized.

**To modify in this plan:**
- `frontend/src/components/Header.tsx` — add soft drop shadow for depth.
- `frontend/app/transaction.tsx` — overlay token, sheet handle, card borders.
- `frontend/app/rekening.tsx` — overlay token, sheet handle, card border.
- `frontend/app/kategori.tsx` — overlay token, sheet handle.
- `frontend/app/pembayaran-reguler.tsx` — overlay token, sheet handle, card border.
- `frontend/app/pengingat.tsx` — overlay token, sheet handle, card border.
- `frontend/app/index.tsx` — card borders on chart/list/empty cards.
- `frontend/app/bagan.tsx` — unify tab font size, card borders.
- `frontend/app/pengaturan.tsx` — section card border.

No new shared component files are created — the existing modal button rows and tab rows are already identical and theme-driven, so extracting components would be pure refactor with `testID` risk and is explicitly out of scope (keep it simple).

---

## Phase 0 — Foundation (ALREADY SHIPPED)

### Task 0: Verify foundation is intact

- [ ] **Step 1: Confirm theme tokens**

Open `frontend/src/lib/theme.ts` and confirm `colors.primary === "#4F46E5"`, `colors.background === "#F4F5F8"`, `colors.primarySoft === "#EEF0FE"`, `colors.overlay === "rgba(17,24,39,0.5)"`, and `shadow.card.shadowColor === "#1A1D29"`.

- [ ] **Step 2: Confirm no stray brand hardcodes remain**

Run: `grep -rn "#4A8B7B\|#F8F5EC\|#FFC107\|rgba(74,139,123" frontend/app frontend/src --include=*.tsx --include=*.ts`
Expected: no matches.

- [ ] **Step 3: Baseline typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: exactly the 5 known pre-existing errors (transaction.tsx, biometricService.ts, pinService.ts). Record this count as the baseline.

---

## Phase 1 — Remove color debt: modal backdrops

All bottom-sheet modals hardcode `"rgba(0,0,0,0.5)"`. Replace with the theme's cool overlay so dimming matches the indigo identity.

### Task 1: Swap all hardcoded backdrops to `colors.overlay`

**Files:**
- Modify: `frontend/app/transaction.tsx` (style `pickBackdrop`)
- Modify: `frontend/app/rekening.tsx` (style `modalBackdrop`)
- Modify: `frontend/app/kategori.tsx` (style `modalBackdrop`)
- Modify: `frontend/app/pembayaran-reguler.tsx` (style `modalBackdrop`)
- Modify: `frontend/app/pengingat.tsx` (style `modalBackdrop`)

- [ ] **Step 1: Edit each file**

In each file, find:
```ts
backgroundColor: "rgba(0,0,0,0.5)",
```
Replace with:
```ts
backgroundColor: colors.overlay,
```
(`colors` is already imported in all five files.)

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: still only the 5 baseline errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/transaction.tsx frontend/app/rekening.tsx frontend/app/kategori.tsx frontend/app/pembayaran-reguler.tsx frontend/app/pengingat.tsx
git commit -m "style: use theme overlay token for modal backdrops"
```

---

## Phase 2 — Add depth: header shadow + bottom-sheet handles

### Task 2: Add a soft drop shadow under the Header

Gives the curved header a professional float instead of a flat band. Done once, applies to every screen.

**Files:**
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: Import shadow**

Change the theme import line:
```ts
import { colors, fontSizes, spacing, radius } from "@/src/lib/theme";
```
to:
```ts
import { colors, fontSizes, spacing, radius, shadow } from "@/src/lib/theme";
```

- [ ] **Step 2: Apply shadow to wrapper**

In `styles.wrapper`, add `...shadow.card,` as the last property (after `paddingHorizontal: spacing.md,`), and add `zIndex: 1` so the shadow renders above the content below:
```ts
  wrapper: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingTop: (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 48) + spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadow.card,
    zIndex: 1,
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: 5 baseline errors only.

- [ ] **Step 4: Visual check**

Run `npx expo start`, open Beranda. Confirm a subtle shadow separates the teal/indigo header from the content. On screens where header tabs sit below the header (index, bagan, kategori) the tabs are part of the primary block, so the shadow should sit beneath the whole primary region — confirm it still looks clean and the tab pills are not clipped.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "style: add soft elevation under app header"
```

### Task 3: Add grab handles to bottom-sheet modals

A small rounded bar at the top of each sheet is a universally-recognized modern affordance and costs almost nothing.

**Files:**
- Modify: `frontend/app/rekening.tsx`
- Modify: `frontend/app/kategori.tsx`
- Modify: `frontend/app/pembayaran-reguler.tsx`
- Modify: `frontend/app/pengingat.tsx`
- Modify: `frontend/app/transaction.tsx` (the `pickSheet` account picker + `dateSheet`)

- [ ] **Step 1: Add a shared handle style to each file's StyleSheet**

Add this style object to the `StyleSheet.create({...})` in each of the five files:
```ts
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
```

- [ ] **Step 2: Render the handle at the top of each sheet**

In `rekening.tsx`, `kategori.tsx`, `pembayaran-reguler.tsx`, `pengingat.tsx`: inside `<View style={styles.modalSheet}>`, add as the FIRST child (before the title / ScrollView):
```tsx
<View style={styles.sheetHandle} />
```

In `transaction.tsx`: add the same `<View style={styles.sheetHandle} />` as the first child inside `<View style={styles.pickSheet}>` (account picker). Leave the `dateSheet` calendar popover as-is (it is a centered dialog, not a bottom sheet — a handle there would be misleading).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: 5 baseline errors only.

- [ ] **Step 4: Visual check**

In the app, open: add-account sheet (Rekening FAB), add-category sheet (Kategori "Buat"), add-recurring sheet, add-reminder sheet, and the account picker in Add Transaction. Confirm each shows the centered grab bar and spacing looks balanced.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/rekening.tsx frontend/app/kategori.tsx frontend/app/pembayaran-reguler.tsx frontend/app/pengingat.tsx frontend/app/transaction.tsx
git commit -m "style: add grab handles to bottom-sheet modals"
```

---

## Phase 3 — Crisp cards: hairline borders

On the very light `#F4F5F8` background, a 1px hairline border plus the soft shadow makes cards read as deliberate, modern surfaces (the Stripe/Linear card treatment). Apply only to primary content cards.

### Task 4: Add hairline borders to content cards

**Files & exact style targets:**
- `frontend/app/index.tsx` — styles `chartCard`, `list`, `emptyCard`
- `frontend/app/rekening.tsx` — style `card`
- `frontend/app/pembayaran-reguler.tsx` — style `card`
- `frontend/app/pengingat.tsx` — style `card`
- `frontend/app/bagan.tsx` — styles `statsCard`, `chartCard`
- `frontend/app/pengaturan.tsx` — style `sectionCard`

- [ ] **Step 1: Add border to each listed style**

For every style listed above, add these two properties (each style already has `...shadow.card` — add the border alongside it):
```ts
    borderWidth: 1,
    borderColor: colors.borderLight,
```
Example — `index.tsx` `chartCard` becomes:
```ts
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: 5 baseline errors only.

- [ ] **Step 3: Visual check**

Open Beranda, Rekening, Bagan, Pembayaran Reguler, Pengingat, Pengaturan. Confirm cards have a subtle defined edge and don't look "muddy" against the background. If borders look too strong anywhere, fall back to `colors.borderLight` only (already specified) — do not increase width above 1.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/index.tsx frontend/app/rekening.tsx frontend/app/pembayaran-reguler.tsx frontend/app/pengingat.tsx frontend/app/bagan.tsx frontend/app/pengaturan.tsx
git commit -m "style: add hairline borders to content cards"
```

---

## Phase 4 — Consistency nits

### Task 5: Unify Bagan tab typography

`bagan.tsx` uses a one-off `fontSize: 11` for its header tabs while `index.tsx` and `kategori.tsx` use `fontSizes.small` (12) with `letterSpacing: 0.5`. Align them.

**Files:**
- Modify: `frontend/app/bagan.tsx`

- [ ] **Step 1: Update `tabLabel` style**

Find:
```ts
  tabLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
```
Replace with:
```ts
  tabLabel: { fontSize: fontSizes.small, fontWeight: "600", color: "rgba(255,255,255,0.9)", letterSpacing: 0.5 },
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: 5 baseline errors only.

- [ ] **Step 3: Visual check**

Open Bagan. With three tabs (UMUM / PENGELUARAN / PEMASUKAN) confirm labels still fit on one line at the larger size. If "PENGELUARAN" wraps on small devices, keep `fontSize: 11` here and instead add `letterSpacing: 0.3` for consistency — note the deviation in the commit message.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/bagan.tsx
git commit -m "style: align Bagan tab typography with other screens"
```

---

## Phase 5 — Full verification pass

### Task 6: End-to-end visual QA + final typecheck

- [ ] **Step 1: Final typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: still exactly the 5 baseline errors, zero new ones.

- [ ] **Step 2: Walk every screen in the app**

Run `npx expo start`. Open each screen and confirm the indigo identity is consistent and nothing regressed:
- Beranda (index): header shadow, PENGELUARAN/PEMASUKAN tabs, period selector active = indigo, donut chart, category rows, empty state, amber FAB.
- Add/Edit Transaction: type tabs (red/green), amount color, account picker sheet (handle), date calendar, category grid active ring = indigo, keypad, amber SIMPAN button.
- Rekening: total balance header, account cards (border), add/edit sheet (handle).
- Bagan: 3 tabs (unified size), granularity pills active = indigo, stats card, bar chart (income green / expense amber / profit blue / loss orange).
- Kategori: tabs, grid, dashed "Buat" cell uses indigo, add/edit sheet (handle).
- Pengaturan: section cards (border), row icon tints = indigo, status pills, biometric switch track = indigo.
- Pembayaran Reguler: cards (border), toggles, add/edit sheet (handle).
- Pengingat: cards (border), amber bell icon tint, toggles, add/edit sheet (handle).
- SideDrawer: indigo header, amber avatar, active item uses `primarySoft` tint + indigo left border.
- Lock / Setup PIN: indigo background, amber PIN dots, keypad.

- [ ] **Step 3: Check contrast on key text**

Confirm white text on the indigo header and on the indigo primary buttons is legible (it is — `#4F46E5` vs white passes WCAG AA). Confirm amber FAB icon (`textPrimary` dark) is legible on `#F59E0B` (passes).

- [ ] **Step 4: Final commit (if any QA fixes were made)**

```bash
git add -A
git commit -m "style: final redesign QA fixes"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Every screen file in `frontend/app/` plus shared chrome (`Header`, `SideDrawer`) and charts is covered by Phase 0 (auto via theme) + Phases 1–4 (explicit) + Phase 5 (verify). ✓
- **No placeholders:** Every code step shows the exact string to find/replace or the exact style object. ✓
- **Consistency:** `colors.overlay`, `colors.borderLight`, `colors.primarySoft`, `shadow.card` are all real tokens defined in `theme.ts`. The `sheetHandle` style name is reused identically across files. ✓
- **Out of scope (intentional, keeps it "simple"):** dark mode; extracting shared Button/SegmentedTabs components (current inline versions are already identical + theme-driven); animation work; FAB color change.
