# DuitKu Comprehensive Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DuitKu more solid and professional by fixing real bugs/type errors, unifying UI/UX (date pickers, empty/loading/error states, primary-action color, iOS top padding), activating dead buttons, and adding error/retry + toast + haptic feedback.

**Architecture:** Three phases. Phase A fixes correctness (TypeScript errors, recurring start-date logic, API timeout, CORS). Phase B unifies and polishes the UI with small reusable components (`States`, `DatePickerModal`, `Toast`, `haptics`) and activates dead buttons. Phase C adds robustness (error+retry and loading states across list screens). Work bottom-up: build shared primitives first, then adopt them screen-by-screen.

**Tech Stack:** Expo (SDK 54) + expo-router, React Native 0.81, TypeScript, lucide-react-native, react-native-safe-area-context, expo-haptics/expo-linking (already installed). Backend: FastAPI + Motor (MongoDB Atlas), pytest.

**Verification note:** There is no JS test runner in this project. Frontend tasks are verified with `npx tsc --noEmit` (type safety) and `npx expo lint` (lint), plus manual run steps. Backend tasks are verified with `pytest`. Run all `cd` commands from the repo root `D:\DuitKu` unless stated.

---

## File Structure

**New files (shared primitives):**
- `frontend/src/components/States.tsx` — `EmptyState`, `LoadingState`, `ErrorState` (one file; they share visual language).
- `frontend/src/components/DatePickerModal.tsx` — reusable calendar modal, extracted from `transaction.tsx`.
- `frontend/src/components/Toast.tsx` — `ToastProvider` + `useToast()` mounted at the root.
- `frontend/src/lib/haptics.ts` — thin wrapper over `expo-haptics`, no-op on web.

**Modified files:**
- `frontend/src/lib/api.ts` — fetch timeout + `DataApi.recalc`.
- `frontend/src/components/Header.tsx` — remove duplicated top inset padding.
- `frontend/src/components/SideDrawer.tsx` — activate Share / Rate / Support buttons.
- `frontend/app/_layout.tsx` — mount `ToastProvider`.
- `frontend/app/transaction.tsx` — use shared `DatePickerModal`, fix types, primary save color, toast+haptic.
- `frontend/app/pembayaran-reguler.tsx` — add start-date picker, toast+haptic.
- `frontend/app/pengingat.tsx` — replace +/- day shift with shared `DatePickerModal`, toast+haptic.
- `frontend/app/rekening.tsx`, `frontend/app/kategori.tsx`, `frontend/app/index.tsx`, `frontend/app/bagan.tsx` — adopt `EmptyState`/`LoadingState`/`ErrorState`.
- `frontend/app/pengaturan.tsx` — wire "Hitung Ulang Saldo" to real endpoint.
- `backend/server.py` — `update_recurring` resets `nextDueDate` when `startDate` changes; add `POST /data/recalc`; fix CORS `allow_credentials`.
- `backend/tests/test_duitku_api.py` — tests for the two backend behavior changes.

---

# PHASE A — Bugs & Logic

## Task A1: Fix the 5 pre-existing TypeScript errors

**Files:**
- Modify: `frontend/src/auth/pinService.ts:36`
- Modify: `frontend/src/auth/biometricService.ts:42`
- Modify: `frontend/app/transaction.tsx` (DatePickerModal typing + `selected` coercion) — note: this file is restructured in Task B3; A1 fixes only the type errors so the tree is green first.

- [ ] **Step 1: Confirm the failing baseline**

Run: `cd frontend && npx tsc --noEmit`
Expected: FAIL with 5 errors — `pinService.ts(37,…)`, `biometricService.ts(43,…)`, `transaction.tsx(336,…)`, `transaction.tsx(395,…)`, `transaction.tsx(400,…)`.

- [ ] **Step 2: Widen `secureGet` generic in pinService**

In `frontend/src/auth/pinService.ts`, function `isPinSet`, change:

```ts
export async function isPinSet(): Promise<boolean> {
  const hash = await storage.secureGet<string>(PIN_HASH_KEY, "");
  return !!hash && typeof hash === "string" && hash.length > 0;
}
```

(The only change is `secureGet<string>(...)`. Without the explicit generic, `Fallback` infers the literal type `""`, so the value narrows to `never` after the truthy check.)

- [ ] **Step 3: Widen `secureGet` generic in biometricService**

In `frontend/src/auth/biometricService.ts`, function `isBiometricEnabled`, change:

```ts
export async function isBiometricEnabled(): Promise<boolean> {
  const v = await storage.secureGet<boolean>(BIOMETRIC_ENABLED_KEY, false);
  return v === true;
}
```

- [ ] **Step 4: Type the DatePickerModal props and coerce `selected` to boolean**

In `frontend/app/transaction.tsx`, replace the `DatePickerModal` signature line:

```tsx
function DatePickerModal({ visible, date, onClose, onSelect }: any) {
```

with a typed signature:

```tsx
type DatePickerModalProps = {
  visible: boolean;
  date: Date;
  onClose: () => void;
  onSelect: (d: Date) => void;
};

function DatePickerModal({ visible, date, onClose, onSelect }: DatePickerModalProps) {
```

Then in the same function, change the `selected` computation from:

```tsx
            const selected =
              d && d === date.getDate() && month === date.getMonth() && year === date.getFullYear();
```

to (wrap in `!!(...)` so the type is `boolean`, not `number | boolean | null`):

```tsx
            const selected = !!(
              d && d === date.getDate() && month === date.getMonth() && year === date.getFullYear()
            );
```

- [ ] **Step 5: Verify type-check is clean**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/auth/pinService.ts frontend/src/auth/biometricService.ts frontend/app/transaction.tsx
git commit -m "fix: resolve 5 pre-existing TypeScript errors (secureGet generics, date picker typing)"
```

---

## Task A2: API request timeout

**Files:**
- Modify: `frontend/src/lib/api.ts:9-19`

- [ ] **Step 1: Add an AbortController timeout to `request`**

In `frontend/src/lib/api.ts`, replace the `request` function:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  return res.json() as Promise<T>;
}
```

with:

```ts
const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...init,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${txt || res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Koneksi timeout. Periksa jaringan Anda lalu coba lagi.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add 15s timeout with friendly message to API requests"
```

---

## Task A3: Recurring payment — reset `nextDueDate` when `startDate` changes (backend)

**Files:**
- Modify: `backend/server.py` (`update_recurring`, around lines 611-622)
- Test: `backend/tests/test_duitku_api.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_duitku_api.py` (use the same client fixture pattern already in that file; if the fixture is named differently, match it):

```python
def test_update_recurring_startdate_resets_nextduedate(client):
    # Need an account + category to satisfy required fields
    acc = client.post("/api/accounts", json={"name": "Tunai"}).json()
    cat = client.post("/api/categories", json={"name": "Kos", "type": "expense"}).json()
    created = client.post("/api/recurring", json={
        "name": "Sewa Kos",
        "amount": 500000,
        "accountId": acc["id"],
        "categoryId": cat["id"],
        "type": "expense",
        "frequency": "monthly",
        "startDate": "2026-01-01",
    }).json()
    assert created["nextDueDate"] == "2026-01-01"

    updated = client.put(f"/api/recurring/{created['id']}", json={
        "startDate": "2026-03-15",
    }).json()
    # Changing the start date must also move the next due date
    assert updated["startDate"] == "2026-03-15"
    assert updated["nextDueDate"] == "2026-03-15"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_duitku_api.py::test_update_recurring_startdate_resets_nextduedate -v`
Expected: FAIL — `nextDueDate` is still `2026-01-01` because the update path never touches it.

- [ ] **Step 3: Implement the fix**

In `backend/server.py`, in `update_recurring`, after the `update` dict is built and before the DB call, add the reset rule:

```python
@api_router.put("/recurring/{item_id}", response_model=RegularPayment)
async def update_recurring(item_id: str, payload: RegularPaymentUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    # If the start date moves and the caller didn't set nextDueDate explicitly,
    # re-anchor the next due date to the new start date.
    if "startDate" in update and "nextDueDate" not in update:
        update["nextDueDate"] = update["startDate"]
    res = await db.recurring.update_one(
        {"id": item_id, "userId": USER_ID}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Pembayaran reguler tidak ditemukan")
    doc = await db.recurring.find_one({"id": item_id, "userId": USER_ID}, {"_id": 0})
    return RegularPayment(**_clean(doc))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_duitku_api.py::test_update_recurring_startdate_resets_nextduedate -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend/tests/test_duitku_api.py
git commit -m "fix: re-anchor recurring nextDueDate when startDate is edited"
```

---

## Task A4: Add `POST /data/recalc` endpoint (backend) and fix CORS

**Files:**
- Modify: `backend/server.py` (add endpoint near `data/reset`; adjust CORS middleware ~line 709)
- Test: `backend/tests/test_duitku_api.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_duitku_api.py`:

```python
def test_data_recalc_returns_ok_and_count(client):
    client.post("/api/accounts", json={"name": "Tunai"})
    res = client.post("/api/data/recalc")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert "recalculated" in body and body["recalculated"] >= 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_duitku_api.py::test_data_recalc_returns_ok_and_count -v`
Expected: FAIL with 404 (endpoint does not exist).

- [ ] **Step 3: Implement the endpoint**

In `backend/server.py`, immediately after the `reset_all_data` route, add:

```python
@api_router.post("/data/recalc")
async def recalc_all_balances():
    """Recompute every account balance from its transactions."""
    accounts = await db.accounts.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    for acc in accounts:
        await _recalc_account_balance(acc["id"])
    return {"ok": True, "recalculated": len(accounts)}
```

- [ ] **Step 4: Fix the CORS credentials/wildcard mismatch**

In `backend/server.py`, change the middleware block:

```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

to (a wildcard origin cannot be combined with credentials; the app uses no cookies/credentials, so disable it):

```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_duitku_api.py::test_data_recalc_returns_ok_and_count -v`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite for regressions**

Run: `cd backend && python -m pytest tests/ -v`
Expected: PASS (no regressions).

- [ ] **Step 7: Add the client method**

In `frontend/src/lib/api.ts`, extend `DataApi`:

```ts
export const DataApi = {
  reset: () => request<{ ok: boolean }>("/data/reset", { method: "POST" }),
  recalc: () => request<{ ok: boolean; recalculated: number }>("/data/recalc", { method: "POST" }),
  export: () => request<any>("/data/export"),
};
```

- [ ] **Step 8: Commit**

```bash
git add backend/server.py backend/tests/test_duitku_api.py frontend/src/lib/api.ts
git commit -m "feat: add /data/recalc endpoint and fix CORS credentials/wildcard combo"
```

---

# PHASE B — UI/UX Unification & Polish

## Task B1: Fix duplicated top padding on Header

**Files:**
- Modify: `frontend/src/components/Header.tsx:36-46`

Context: All 7 screens wrap `<Header>` in `<SafeAreaView edges={["top"]} style={styles.safeTop}>`, which already provides the status-bar/notch inset. Header *also* adds `(android ? StatusBar.currentHeight : 48) + spacing.sm`, double-counting it (especially visible on iOS).

- [ ] **Step 1: Remove the manual inset from Header's wrapper style**

In `frontend/src/components/Header.tsx`, change the `wrapper` style:

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

to:

```ts
  wrapper: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadow.card,
    zIndex: 1,
  },
```

- [ ] **Step 2: Remove now-unused imports**

In `frontend/src/components/Header.tsx`, change the import line:

```ts
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
```

to:

```ts
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
```

- [ ] **Step 3: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS, no unused-var warnings for `Platform`/`StatusBar`.

- [ ] **Step 4: Manual check**

Run: `cd frontend && npx expo start --web` (or device). Open Beranda — the indigo header should sit directly under the status bar without a large empty gap. Confirm on Beranda, Rekening, Bagan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "fix: remove duplicated top inset padding in Header (double-padding on iOS)"
```

---

## Task B2: Shared state components (EmptyState / LoadingState / ErrorState)

**Files:**
- Create: `frontend/src/components/States.tsx`

- [ ] **Step 1: Create the components file**

Create `frontend/src/components/States.tsx`:

```tsx
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Inbox, WifiOff, type LucideIcon } from "lucide-react-native";
import { colors, fontSizes, radius, spacing } from "@/src/lib/theme";

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.wrap} testID="loading-state">
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.desc}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon: IconCmp = Inbox,
  title,
  description,
  testID = "empty-state",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  testID?: string;
}) {
  return (
    <View style={styles.wrap} testID={testID}>
      <IconCmp size={48} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  );
}

export function ErrorState({
  onRetry,
  message = "Gagal memuat data. Periksa koneksi Anda.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <View style={styles.wrap} testID="error-state">
      <WifiOff size={48} color={colors.textMuted} />
      <Text style={styles.title}>Terjadi Masalah</Text>
      <Text style={styles.desc}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} testID="error-retry">
        <Text style={styles.retryText}>Coba Lagi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, alignItems: "center", marginTop: spacing.xl },
  title: {
    fontSize: fontSizes.h3,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  desc: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: "#FFFFFF", fontWeight: "600", fontSize: fontSizes.body },
});
```

- [ ] **Step 2: Verify type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS. (If `LucideIcon` type import fails for this version, replace `import { Inbox, WifiOff, type LucideIcon }` with `import { Inbox, WifiOff }` and change the `icon` prop type to `React.ComponentType<{ size?: number; color?: string }>`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/States.tsx
git commit -m "feat: add shared EmptyState/LoadingState/ErrorState components"
```

---

## Task B3: Extract reusable DatePickerModal

**Files:**
- Create: `frontend/src/components/DatePickerModal.tsx`
- Modify: `frontend/app/transaction.tsx` (remove local `DatePickerModal`, import shared one)

- [ ] **Step 1: Create the shared component**

Create `frontend/src/components/DatePickerModal.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { colors, fontSizes, radius, shadow, spacing } from "@/src/lib/theme";
import { monthsId } from "@/src/lib/format";

type Props = {
  visible: boolean;
  date: Date;
  onClose: () => void;
  onSelect: (d: Date) => void;
};

export function DatePickerModal({ visible, date, onClose, onSelect }: Props) {
  const [cur, setCur] = useState(new Date(date));

  useEffect(() => { setCur(new Date(date)); }, [date, visible]);

  const year = cur.getFullYear();
  const month = cur.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const grid: (number | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => setCur(new Date(year, month - 1, 1))} testID="date-month-prev" hitSlop={10}>
            <Text style={styles.navBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{monthsId[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCur(new Date(year, month + 1, 1))} testID="date-month-next" hitSlop={10}>
            <Text style={styles.navBtn}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dayHeader}>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <Text key={d} style={styles.dayHeaderText}>{d}</Text>
          ))}
        </View>
        <View style={styles.dayGrid}>
          {grid.map((d, i) => {
            const selected = !!(
              d && d === date.getDate() && month === date.getMonth() && year === date.getFullYear()
            );
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, selected && styles.dayCellActive]}
                disabled={!d}
                onPress={() => d && onSelect(new Date(year, month, d))}
                testID={d ? `day-${d}` : undefined}
              >
                <Text style={[styles.dayCellText, selected && { color: "#FFF", fontWeight: "700" }]}>
                  {d || ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={() => onSelect(new Date())} testID="date-today">
          <Text style={styles.todayText}>HARI INI</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute", top: "20%", left: spacing.md, right: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    ...shadow.card,
  },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  navBtn: { fontSize: 28, color: colors.primary, paddingHorizontal: 12 },
  navTitle: { fontSize: fontSizes.h3, fontWeight: "600", color: colors.textPrimary },
  dayHeader: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dayHeaderText: { flex: 1, textAlign: "center", fontSize: fontSizes.small, color: colors.textSecondary, fontWeight: "600" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 6 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  dayCellActive: { backgroundColor: colors.primary },
  dayCellText: { fontSize: fontSizes.body, color: colors.textPrimary },
  todayBtn: {
    marginTop: spacing.md, paddingVertical: 16, borderRadius: radius.md,
    alignItems: "center", backgroundColor: colors.primary,
  },
  todayText: { fontWeight: "700", fontSize: fontSizes.bodyLarge, color: "#FFFFFF", letterSpacing: 1 },
});
```

- [ ] **Step 2: Use it in transaction.tsx and delete the local copy**

In `frontend/app/transaction.tsx`:

(a) Add the import near the other component imports:

```tsx
import { DatePickerModal } from "@/src/components/DatePickerModal";
```

(b) Delete the entire local `function DatePickerModal(...) { ... }` block (the function defined after the default export, plus the `DatePickerModalProps` type added in Task A1). The JSX usage `<DatePickerModal visible={datePickerOpen} ... />` stays unchanged — it now resolves to the imported component, which has the identical prop shape.

- [ ] **Step 3: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS. (Leftover unused style keys like `dateSheet`/`dateNav` in `transaction.tsx` are harmless StyleSheet object members and will not error; remove them only if lint flags them.)

- [ ] **Step 4: Manual check**

Run the app, open Tambah Transaksi → tap Tanggal → calendar opens, pick a day and "HARI INI" — both close the modal and update the field.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DatePickerModal.tsx frontend/app/transaction.tsx
git commit -m "refactor: extract reusable DatePickerModal and use it in transaction screen"
```

---

## Task B4: Add a start-date picker to the Recurring form

**Files:**
- Modify: `frontend/app/pembayaran-reguler.tsx` (`RecurringFormModal`)

Context: `RecurringFormModal` already has `startDate`/`setStartDate` state but renders no UI for it, so users can never set it. `Calendar` is imported but unused.

- [ ] **Step 1: Import the shared picker and add local open state**

In `frontend/app/pembayaran-reguler.tsx`, add the import:

```tsx
import { DatePickerModal } from "@/src/components/DatePickerModal";
```

Inside `RecurringFormModal`, add a state next to the others:

```tsx
  const [dateOpen, setDateOpen] = useState(false);
```

- [ ] **Step 2: Render a Tanggal Mulai field + picker**

In `RecurringFormModal`'s JSX, immediately **after** the Kategori `ScrollView` block (the one closing right before `<View style={styles.row3}>`), insert:

```tsx
            <Text style={styles.label}>Tanggal Mulai</Text>
            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setDateOpen(true)}
              testID="recurring-date-field"
            >
              <Calendar size={18} color={colors.primary} />
              <Text style={styles.dateFieldText}>
                {formatDateId(startDate, { long: true, withDay: true })}
              </Text>
            </TouchableOpacity>
```

Then, just before the closing `</View>` of `styles.modalSheet` (after the `btnRow` block, still inside the `ScrollView`), add the picker:

```tsx
            <DatePickerModal
              visible={dateOpen}
              date={startDate}
              onClose={() => setDateOpen(false)}
              onSelect={(d) => { setStartDate(d); setDateOpen(false); }}
            />
```

- [ ] **Step 3: Add the two styles**

In the `pembayaran-reguler.tsx` StyleSheet, add:

```tsx
  dateField: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  dateFieldText: { fontSize: fontSizes.bodyLarge, color: colors.textPrimary, fontWeight: "500" },
```

- [ ] **Step 4: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS (no unused `Calendar` warning now).

- [ ] **Step 5: Manual check**

Add a recurring payment, change Tanggal Mulai to a future date, save, reopen via edit — the date persists and "Jatuh tempo berikutnya" reflects it (works together with backend Task A3).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/pembayaran-reguler.tsx
git commit -m "feat: add start-date picker to recurring payment form"
```

---

## Task B5: Replace the reminder +/- day shifter with the calendar picker

**Files:**
- Modify: `frontend/app/pengingat.tsx` (`ReminderFormModal`)

- [ ] **Step 1: Import the picker and add open state**

In `frontend/app/pengingat.tsx`, add:

```tsx
import { DatePickerModal } from "@/src/components/DatePickerModal";
import { Calendar } from "lucide-react-native";
```

(Keep the existing `ArrowDownUp` import only if still used elsewhere; after this task it is not, so remove `ArrowDownUp` from the existing lucide import.)

Inside `ReminderFormModal`, add:

```tsx
  const [dateOpen, setDateOpen] = useState(false);
```

- [ ] **Step 2: Replace the dateRow block**

Replace this JSX:

```tsx
            <Text style={styles.label}>Tanggal</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.shiftBtn} testID="reminder-date-prev">
                <ArrowDownUp size={16} color={colors.textPrimary} style={{ transform: [{ rotate: "90deg" }] }} />
              </TouchableOpacity>
              <Text style={styles.dateText}>{formatDateId(date, { long: true, withDay: true })}</Text>
              <TouchableOpacity onPress={() => shiftDate(1)} style={styles.shiftBtn} testID="reminder-date-next">
                <ArrowDownUp size={16} color={colors.textPrimary} style={{ transform: [{ rotate: "-90deg" }] }} />
              </TouchableOpacity>
            </View>
```

with:

```tsx
            <Text style={styles.label}>Tanggal</Text>
            <TouchableOpacity style={styles.dateRow} onPress={() => setDateOpen(true)} testID="reminder-date-field">
              <Calendar size={18} color={colors.primary} />
              <Text style={styles.dateText}>{formatDateId(date, { long: true, withDay: true })}</Text>
            </TouchableOpacity>
```

- [ ] **Step 3: Delete the now-unused `shiftDate` helper and mount the picker**

Remove the `shiftDate` function from `ReminderFormModal`. Then add the picker before the closing `</View>` of the modal sheet (after `btnRow`, inside the ScrollView):

```tsx
            <DatePickerModal
              visible={dateOpen}
              date={date}
              onClose={() => setDateOpen(false)}
              onSelect={(d) => { setDate(d); setDateOpen(false); }}
            />
```

- [ ] **Step 4: Adjust the `dateRow` style for a single tappable row**

In `pengingat.tsx` styles, change `dateRow` to include an icon gap (replace the existing `dateRow`):

```tsx
  dateRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 12,
  },
```

(The `shiftBtn` style key becomes unused; harmless to leave.)

- [ ] **Step 5: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/pengingat.tsx
git commit -m "feat: use calendar picker for reminder date (replaces +/- day shifter)"
```

---

## Task B6: Haptics helper + toast provider

**Files:**
- Create: `frontend/src/lib/haptics.ts`
- Create: `frontend/src/components/Toast.tsx`
- Modify: `frontend/app/_layout.tsx`

- [ ] **Step 1: Create the haptics helper**

Create `frontend/src/lib/haptics.ts`:

```ts
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export function tapLight() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function notifySuccess() {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notifyWarning() {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
```

- [ ] **Step 2: Create the toast provider**

Create `frontend/src/components/Toast.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radius, spacing, shadow } from "@/src/lib/theme";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { showToast: (message: string, kind?: ToastKind) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<ToastKind>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, k: ToastKind = "success") => {
    setMessage(msg);
    setKind(k);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }, 2200);
  }, [opacity]);

  const bg =
    kind === "error" ? colors.expense : kind === "info" ? colors.textPrimary : colors.success;

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
        {message ? (
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.text}>{message}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center", zIndex: 1000 },
  toast: {
    maxWidth: "85%", paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderRadius: radius.full, ...shadow.fab,
  },
  text: { color: "#FFFFFF", fontSize: fontSizes.body, fontWeight: "600", textAlign: "center" },
});
```

- [ ] **Step 3: Mount ToastProvider at the root**

In `frontend/app/_layout.tsx`, add the import:

```tsx
import { ToastProvider } from "@/src/components/Toast";
```

Then wrap `RootStack` with `ToastProvider` inside `AppLockProvider`:

```tsx
        <AppLockProvider>
          <ToastProvider>
            <RootStack />
          </ToastProvider>
        </AppLockProvider>
```

- [ ] **Step 4: Verify type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/haptics.ts frontend/src/components/Toast.tsx frontend/app/_layout.tsx
git commit -m "feat: add haptics helper and app-wide toast provider"
```

---

## Task B7: Standardize primary action color + wire toast/haptic into save & delete flows

**Files:**
- Modify: `frontend/app/transaction.tsx`
- Modify: `frontend/app/rekening.tsx`
- Modify: `frontend/app/kategori.tsx`
- Modify: `frontend/app/pembayaran-reguler.tsx`
- Modify: `frontend/app/pengingat.tsx`

- [ ] **Step 1: Make the transaction SIMPAN button indigo (match modal save buttons)**

In `frontend/app/transaction.tsx` styles, change `saveBtn` / `saveBtnText`:

```tsx
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    ...shadow.fab,
  },
  saveBtnText: { fontWeight: "700", fontSize: fontSizes.bodyLarge, color: colors.textPrimary, letterSpacing: 1 },
```

to:

```tsx
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    ...shadow.fab,
  },
  saveBtnText: { fontWeight: "700", fontSize: fontSizes.bodyLarge, color: "#FFFFFF", letterSpacing: 1 },
```

- [ ] **Step 2: Toast + haptic on transaction save/delete**

In `frontend/app/transaction.tsx`, add imports:

```tsx
import { useToast } from "@/src/components/Toast";
import { notifySuccess, tapLight } from "@/src/lib/haptics";
```

Inside `TransactionScreen`, add `const { showToast } = useToast();` near the other hooks. In `submit`, after a successful create/update and before `router.back()`:

```tsx
      notifySuccess();
      showToast(editId ? "Transaksi diperbarui" : "Transaksi tersimpan");
      router.back();
```

In `onDelete`'s confirmed handler, after `await Transactions.remove(editId);`:

```tsx
            await Transactions.remove(editId);
            notifySuccess();
            showToast("Transaksi dihapus");
            router.back();
```

Add `tapLight()` as the first line of `onKey`:

```tsx
  const onKey = (k: string) => {
    tapLight();
```

- [ ] **Step 3: Toast on rekening save/delete**

In `frontend/app/rekening.tsx`, add `import { useToast } from "@/src/components/Toast";` and `import { notifySuccess } from "@/src/lib/haptics";`. In `Rekening`, add `const { showToast } = useToast();`. In `onSave` after success (`load()` line), and in `onDelete`'s success path after `load()`, add:

```tsx
      notifySuccess();
      showToast(editing ? "Rekening diperbarui" : "Rekening ditambah");
```

(for delete: `showToast("Rekening dihapus");`).

- [ ] **Step 4: Toast on kategori save/delete**

Same pattern in `frontend/app/kategori.tsx`: import `useToast`/`notifySuccess`, add `const { showToast } = useToast();`, and after success in `onSave` → `showToast(editing ? "Kategori diperbarui" : "Kategori dibuat");` and in `onLongPress` delete → `showToast("Kategori dihapus");`.

- [ ] **Step 5: Toast on recurring + reminder save/delete**

Same pattern in `frontend/app/pembayaran-reguler.tsx` (`showToast(editing ? "Pembayaran reguler diperbarui" : "Pembayaran reguler ditambah");`, delete → `"Pembayaran reguler dihapus"`) and `frontend/app/pengingat.tsx` (`showToast(editing ? "Pengingat diperbarui" : "Pengingat dibuat");`, delete → `"Pengingat dihapus"`).

- [ ] **Step 6: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 7: Manual check**

Save a transaction → green toast appears bottom-center + (on device) a success haptic; keypad taps give light haptics. Confirm toast on each entity save.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/transaction.tsx frontend/app/rekening.tsx frontend/app/kategori.tsx frontend/app/pembayaran-reguler.tsx frontend/app/pengingat.tsx
git commit -m "feat: unify primary action color and add toast+haptic feedback on save/delete"
```

---

## Task B8: Activate the dead SideDrawer buttons + Settings recalc

**Files:**
- Modify: `frontend/src/components/SideDrawer.tsx`
- Modify: `frontend/app/pengaturan.tsx`

- [ ] **Step 1: Implement Share / Rate / Support in SideDrawer**

In `frontend/src/components/SideDrawer.tsx`, add imports:

```tsx
import { Share, Linking, Alert } from "react-native";
```

(merge `Share`, `Linking`, `Alert` into the existing `react-native` import instead of duplicating it.)

Add handlers inside `SideDrawer`, before `return`:

```tsx
  const onShare = async () => {
    onClose();
    try {
      await Share.share({
        message: "Coba DuitKu — aplikasi pelacak keuangan pribadi yang simpel. https://duitku.app",
      });
    } catch {}
  };
  const onRate = () => {
    onClose();
    Alert.alert("Beri Nilai", "Terima kasih! Penilaian aplikasi akan tersedia saat DuitKu rilis di store.");
  };
  const onSupport = async () => {
    onClose();
    const url = "mailto:andresaputra07012019@gmail.com?subject=Dukungan%20DuitKu";
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert("Hubungi Dukungan", "Email: andresaputra07012019@gmail.com");
  };
```

Wire them to the three buttons (replace `onPress={onClose}` on the share/rate/support `TouchableOpacity`s):

```tsx
          <TouchableOpacity style={styles.item} testID="drawer-share" onPress={onShare}>
            <Share2 size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Bagikan dengan teman</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} testID="drawer-rate" onPress={onRate}>
            <Star size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Beri nilai aplikasi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} testID="drawer-support" onPress={onSupport}>
            <Mail size={22} color={colors.textPrimary} />
            <Text style={styles.itemLabel}>Hubungi tim dukungan</Text>
          </TouchableOpacity>
```

- [ ] **Step 2: Wire Settings "Hitung Ulang Saldo" to the real endpoint**

In `frontend/app/pengaturan.tsx`, add an async handler in `Pengaturan` (use the existing `DataApi` import):

```tsx
  const onRecalc = async () => {
    try {
      const res = await DataApi.recalc();
      Alert.alert("Selesai", `Saldo ${res.recalculated} rekening telah dihitung ulang.`);
    } catch (e: any) {
      Alert.alert("Gagal", e?.message || "Coba lagi");
    }
  };
```

Change the recalc Row's `onPress`:

```tsx
          <Row icon={RefreshCw} title="Hitung Ulang Saldo" subtitle="Perbarui semua saldo rekening"
            onPress={onRecalc}
            testID="setting-recalc"
          />
```

- [ ] **Step 3: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 4: Manual check**

Open the drawer → "Bagikan" opens the share sheet; "Hubungi dukungan" opens the mail composer. In Settings → "Hitung Ulang Saldo" shows a "Selesai" alert with the account count.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SideDrawer.tsx frontend/app/pengaturan.tsx
git commit -m "feat: activate drawer share/rate/support and wire settings recalc to backend"
```

---

# PHASE C — Robustness (Loading & Error States)

> Pattern applied per screen: add `loading` (where missing) and `error` state, set `error` in the `catch` of `load`, and render `LoadingState` / `ErrorState` / `EmptyState` / data in priority order. `ErrorState`'s `onRetry` calls `load()`.

## Task C1: Rekening — loading + error + empty states

**Files:**
- Modify: `frontend/app/rekening.tsx`

- [ ] **Step 1: Import shared states and add state vars**

Add `import { EmptyState, LoadingState, ErrorState } from "@/src/components/States";` and `import { Wallet } from "lucide-react-native";` (merge with existing lucide import). In `Rekening`, add:

```tsx
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
```

- [ ] **Step 2: Update `load` to manage loading/error**

Replace the `load` callback body:

```tsx
  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await Accounts.list();
      setAccounts(data);
    } catch (e) {
      console.warn(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Render states in priority order**

Replace the ScrollView's children conditional (the `accounts.length === 0 ? ... : accounts.map(...)`) with:

```tsx
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="Belum ada rekening" description="Tambahkan rekening pertama Anda" />
        ) : (
          accounts.map((acc) => (
            // ...unchanged account card JSX...
          ))
        )}
```

(Keep the existing account-card JSX inside the final branch. Remove the old `styles.empty/emptyTitle/emptyDesc` usage; the style keys may remain unused harmlessly.)

- [ ] **Step 4: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/rekening.tsx
git commit -m "feat: add loading/error/empty states to Rekening"
```

---

## Task C2: Kategori — loading + error states

**Files:**
- Modify: `frontend/app/kategori.tsx`

- [ ] **Step 1: Import + state**

Add `import { LoadingState, ErrorState } from "@/src/components/States";`. In `Kategori`, add `const [loading, setLoading] = useState(true);` and `const [error, setError] = useState(false);`.

- [ ] **Step 2: Update `load`**

```tsx
  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await Categories.list(type);
      setItems(data);
    } catch (e) {
      console.warn(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [type]);
```

- [ ] **Step 3: Guard the grid**

Wrap the `<View style={styles.grid}>...</View>` so that while loading it shows the spinner and on error the retry:

```tsx
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : (
          <View style={styles.grid}>
            {/* ...existing items.map(...) and the add-category cell... */}
          </View>
        )}
```

- [ ] **Step 4: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/kategori.tsx
git commit -m "feat: add loading/error states to Kategori"
```

---

## Task C3: Pembayaran Reguler — loading + error + shared empty

**Files:**
- Modify: `frontend/app/pembayaran-reguler.tsx`

- [ ] **Step 1: Import + state**

Add `import { EmptyState, LoadingState, ErrorState } from "@/src/components/States";` (keep `Repeat` import — reuse as the empty icon). In `PembayaranRegulerScreen`, add `const [loading, setLoading] = useState(true);` and `const [error, setError] = useState(false);`.

- [ ] **Step 2: Update `load`**

```tsx
  const load = useCallback(async () => {
    try {
      setError(false);
      const [list, accs, cats] = await Promise.all([
        Recurring.list(),
        Accounts.list(),
        Categories.list(),
      ]);
      setItems(list);
      setAccounts(accs);
      setCategories(cats);
    } catch (e) {
      console.warn(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Render states**

Replace the `items.length === 0 ? (<View style={styles.empty}>...) : items.map(...)` conditional with:

```tsx
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Tambahkan pembayaran reguler"
            description="Cicilan, sewa kos, langganan — DuitKu akan otomatis mencatatnya saat jatuh tempo."
          />
        ) : (
          items.map((item) => {
            // ...unchanged card JSX...
          })
        )}
```

- [ ] **Step 4: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/pembayaran-reguler.tsx
git commit -m "feat: add loading/error states to Pembayaran Reguler"
```

---

## Task C4: Pengingat — loading + error + shared empty

**Files:**
- Modify: `frontend/app/pengingat.tsx`

- [ ] **Step 1: Import + state**

Add `import { EmptyState, LoadingState, ErrorState } from "@/src/components/States";` (keep `BellRing` for the empty icon). In `PengingatScreen`, add `const [loading, setLoading] = useState(true);` and `const [error, setError] = useState(false);`.

- [ ] **Step 2: Update `load`**

```tsx
  const load = useCallback(async () => {
    try {
      setError(false);
      const list = await Reminders.list("date");
      setItems(list);
    } catch (e) {
      console.warn(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Render states**

Replace the `items.length === 0 ? (<View style={styles.empty}>...) : items.map(...)` conditional with:

```tsx
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="Tambahkan pengingat"
            description="Buat pengingat agar tidak lupa membayar tagihan atau mencatat pengeluaran."
          />
        ) : (
          items.map((item) => {
            // ...unchanged card JSX...
          })
        )}
```

- [ ] **Step 4: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/pengingat.tsx
git commit -m "feat: add loading/error states to Pengingat"
```

---

## Task C5: Beranda + Bagan — error states

**Files:**
- Modify: `frontend/app/index.tsx`
- Modify: `frontend/app/bagan.tsx`

- [ ] **Step 1: Beranda error state**

In `frontend/app/index.tsx`, add `import { EmptyState, ErrorState } from "@/src/components/States";` and `const [error, setError] = useState(false);`. In `load`, set `setError(false)` at the start of `try` and `setError(true)` in `catch`. In the ScrollView, render `ErrorState` when `error` and not loading, above the existing breakdown/empty conditional:

```tsx
        {error ? (
          <ErrorState onRetry={load} />
        ) : breakdown.length === 0 ? (
          <EmptyState
            title="Belum ada transaksi"
            description="Tekan tombol kuning di kanan bawah untuk menambah transaksi pertama"
          />
        ) : (
          <View style={styles.list}>
            {breakdown.map((b) => (
              <CategoryRow key={b.categoryId} item={b} total={total} />
            ))}
          </View>
        )}
```

(The donut chart card above stays as-is; this only swaps the list/empty section and adds the error branch. The old inline empty `View` can be removed.)

- [ ] **Step 2: Bagan error state**

In `frontend/app/bagan.tsx`, add `import { ErrorState } from "@/src/components/States";` and `const [error, setError] = useState(false);`. In `load`, set `setError(false)` at start of `try`, `setError(true)` in `catch`. In the chartCard, render error first:

```tsx
        <View style={styles.chartCard}>
          {loading ? (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : (
            <BarChart data={bars} mode={mode} />
          )}
        </View>
```

- [ ] **Step 3: Verify type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/index.tsx frontend/app/bagan.tsx
git commit -m "feat: add error/retry states to Beranda and Bagan"
```

---

## Final verification

- [ ] **Frontend gate:** `cd frontend && npx tsc --noEmit && npx expo lint` → both PASS.
- [ ] **Backend gate:** `cd backend && python -m pytest tests/ -v` → PASS.
- [ ] **Manual smoke (device or web):** Launch app, walk every screen — header spacing correct; pull-to-refresh and retry work after toggling the backend off/on; add/edit/delete each entity shows a toast; recurring start date is editable and persists; drawer share/support buttons open native sheets; settings recalc reports a count.

---

## Self-Review Notes

- **Spec coverage:** Bug list items 1-4 → Tasks A1-A4. UI/UX 5-10 → B1 (padding), B8 (dead buttons), B7 (color/toast/haptic), B2/C* (empty states), B3-B5 (date pickers), B6/B7 (toast+haptic). Robustness 11-12 → C1-C5 (error+retry, loading). All review findings mapped.
- **Type consistency:** Shared component prop names are stable across tasks — `DatePickerModal({ visible, date, onClose, onSelect })`, `EmptyState({ icon, title, description })`, `ErrorState({ onRetry, message })`, `useToast().showToast(message, kind)`, haptics `tapLight()/notifySuccess()/notifyWarning()`, `DataApi.recalc()` ↔ backend `{ ok, recalculated }`.
- **Assumption to confirm during execution:** the pytest client fixture name in `backend/tests/test_duitku_api.py` — if it is not `client`, adapt the two new tests to the existing fixture/`TestClient` setup.
