# DuitKu — Personal Finance Tracker (Indonesian)

## Overview
DuitKu is an offline-first style React Native (Expo) personal finance tracker for Indonesian users. MVP Phase 1: track expenses/income, manage accounts and categories, view donut + bar charts, and import/export data.

## Stack
- Frontend: React Native (Expo Router v6, RN 0.81), react-native-svg, lucide-react-native
- Backend: FastAPI + Motor (MongoDB)
- Auth: NONE (single-user local; userId="default")
- Language: Bahasa Indonesia
- Currency: IDR (Rp123.456 format)

## Features (MVP + Phase 2 + Phase 3)
- Beranda, Rekening, Bagan, Kategori, Pembayaran Reguler, Pengingat, Pengaturan (Phase 1+2)
- **PIN Security** (Phase 3): 4-digit PIN setup with confirmation, SHA-256 + 16-byte random salt hashing via `expo-crypto`, stored in `expo-secure-store` (Keychain/EncryptedSharedPreferences). Lock overlay on cold start and background→foreground via `AppState`. Wrong PIN shows error + vibration. "Lupa PIN?" wipes all data + clears PIN.
- **Biometric Unlock** (Phase 3): Optional Face ID / Touch ID / fingerprint via `expo-local-authentication`. Auto-prompts when lock overlay appears. Switch in Pengaturan → Keamanan, disabled when no PIN, disabled when no hardware/enrolment. Falls back to PIN seamlessly. `NSFaceIDUsageDescription` configured via `expo-local-authentication` plugin in app.json.

## Local Authentication Files (Phase 3)
- `src/auth/pinService.ts` — hash/verify/clear PIN using SHA-256 + salt in SecureStore
- `src/auth/biometricService.ts` — biometric capability detection + authenticate
- `src/auth/AppLockContext.tsx` — global lock state + AppState listener
- `src/auth/LockOverlay.tsx` — fullscreen lock UI with keypad + biometric button + "Lupa PIN"
- `app/setup-pin.tsx` — Buat PIN / Konfirmasi PIN / edit / nonaktifkan flow
- Beranda: tabs Pengeluaran/Pemasukan, period selector (Hari/Minggu/Bulan/Tahun), donut chart, category breakdown list, FAB, **auto-process recurring on focus**
- Rekening: list of wallets with balance, add/edit/delete with icon & color picker
- Bagan: bar chart with 3 modes (Umum/Pengeluaran/Pemasukan), 3 granularities, income/expense/profit stats
- Kategori: grid layout 3 cols, tabs expense/income, create/edit/delete custom categories
- **Pembayaran Reguler** (Phase 2): list of recurring payments with toggle aktif/nonaktif, edit/delete, frequency Harian/Mingguan/Bulanan/Tahunan, automatic transaction creation when due
- **Pengingat** (Phase 2): list of reminders with local notifications via expo-notifications, repeat Sekali/Harian/Mingguan/Bulanan/Tahunan, toggle active, edit/delete
- Pengaturan: PIN (coming soon), theme, language, currency, export JSON, reset all data, links to Pembayaran Reguler and Pengingat
- Side Drawer: animated overlay with 7 navigation items
- Transaction Modal: numeric keypad, category grid, account picker, custom Indonesian calendar (Senin first day), notes

## API Endpoints (all under `/api`)
- GET/POST/PUT/DELETE `/accounts`
- GET/POST/PUT/DELETE `/categories` (with `?type=expense|income`)
- GET/POST/PUT/DELETE `/transactions` (with `?type/accountId/categoryId/start/end`)
- GET `/stats/summary?type=...&start=...&end=...` → donut data
- GET `/stats/bars?granularity=year|month|week|day` → bar chart data
- GET/POST/PUT/DELETE `/recurring` — recurring payments
- POST `/recurring/process` — generate due transactions and advance dates (idempotent)
- GET/POST/PUT/DELETE `/reminders?sort=date|priority` — reminders
- POST `/data/reset` → wipe & re-seed defaults (clears all 5 collections)
- GET `/data/export` → JSON snapshot

## Local Notifications
- Implemented via `expo-notifications` (configured in app.json plugins)
- Permission flow: contextual request when user taps FAB on Pengingat, respects `canAskAgain` flag, redirects to settings if denied
- Trigger types: DATE (one-shot), DAILY, WEEKLY, YEARLY (monthly falls back to DATE)
- The OS-returned `notificationId` is stored on the Reminder for cancellation on edit/delete/toggle
- **Note**: Local notifications work in Expo Go (foreground only) and dev/production builds. Web preview no-ops silently.

## Seeds (on startup if empty)
- 14 default expense categories (Makanan, Bensin, Laundry, ...)
- 5 default income categories (Gaji, Bonus, ...)
- 2 default accounts (Tunai, Bank)

## Data Models (MongoDB)
- Account: { id, userId, name, icon, color, balance, type, order, createdAt, initialBalance }
- Category: { id, userId, name, icon, color, type, order, isDefault, createdAt }
- Transaction: { id, userId, accountId, categoryId, amount, type, note, date(YYYY-MM-DD), createdAt }

Balances are recomputed from `initialBalance + sumIncome - sumExpense` whenever a transaction changes.

## Not in MVP (deferred)
- Recurring payments
- Reminders + push notifications
- PIN/biometric lock
- Multi-currency
- Cloud sync / Google Drive backup
- Transfer between accounts

## Smart Business Enhancement (Future)
Add a "Insight Harian" card on Beranda showing AI-suggested savings tips (e.g., "Pengeluaran Kafe sudah 30% di atas rata-rata") — drives daily engagement and is a clear premium upsell hook.
