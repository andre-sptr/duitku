# DuitKu — Pelacak Keuangan Pribadi

Aplikasi keuangan pribadi: catat pemasukan/pengeluaran, kelola rekening & kategori,
pembayaran reguler, pengingat, dan grafik. Project ini terdiri dari dua bagian:

- **`frontend/`** — aplikasi [Expo](https://expo.dev) (React Native) untuk Android & web.
- **`backend/`** — API [FastAPI](https://fastapi.tiangolo.com) (Python) dengan database MongoDB Atlas.

## Arsitektur singkat

```
[Aplikasi (HP / web)]  ──►  [Backend FastAPI]  ──►  [MongoDB Atlas]
      frontend/               backend/server.py        (database cloud)
```

Aplikasi **tidak pernah** menghubungi database secara langsung — selalu lewat backend.

## Prasyarat

- [Node.js](https://nodejs.org) 18+ dan npm — untuk frontend.
- [Python](https://www.python.org) 3.11+ — untuk backend.
- Akun [MongoDB Atlas](https://www.mongodb.com/atlas) (gratis) beserta *connection string*-nya.

---

## 1. Menjalankan Backend (development)

```bash
cd backend

# Buat & aktifkan virtual environment (disarankan)
python -m venv venv
# Windows (PowerShell):  venv\Scripts\Activate.ps1
# Windows (cmd):         venv\Scripts\activate.bat
# Linux / macOS:         source venv/bin/activate

# Pasang dependency
pip install -r requirements.txt
```

Buat file `backend/.env` (salin dari `backend/.env.example`), lalu isi:

```env
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=duitku
API_KEY=          # kosongkan untuk dev lokal (API terbuka)
```

> Di MongoDB Atlas → **Network Access**, pastikan IP Anda diizinkan (atau `0.0.0.0/0`).

Jalankan server:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

- `--reload` → otomatis restart saat kode berubah.
- `--host 0.0.0.0` → bisa diakses HP fisik di WiFi yang sama (lihat bagian frontend).
- Cek di browser: <http://localhost:8000/> → `{"status":"ok"}`.

---

## 2. Menjalankan Frontend (development)

```bash
cd frontend
npm install
```

Buat file `frontend/.env`:

```env
# Emulator / web di komputer yang sama:
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000

# HP fisik: ganti dengan IP LAN komputer Anda (cek `ipconfig` / `ifconfig`), contoh:
# EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:8000

EXPO_PUBLIC_API_KEY=        # kosongkan untuk dev (samakan dengan backend yang API_KEY-nya kosong)
```

Jalankan:

```bash
npm start
```

Lalu pilih cara membuka aplikasi:

- **Tekan `w`** → buka versi **web** di browser (paling cepat untuk cek tampilan).
- **Development build** di HP/emulator → untuk fitur lengkap. Bangun sekali dengan
  `npx expo run:android` (butuh Android Studio) atau lewat EAS.

> ⚠️ **Jangan pakai Expo Go** untuk fitur PIN, biometrik, atau notifikasi — fitur native
> ini butuh *development build*. Expo Go hanya untuk pratinjau cepat.

---

## 3. Menjalankan Tes

**Frontend** (unit test logika format & tanggal):

```bash
cd frontend
npm test
```

**Backend** (tes API end-to-end):

```bash
cd backend
# arahkan ke server lokal yang sedang berjalan:
# Windows PowerShell:  $env:EXPO_PUBLIC_BACKEND_URL="http://localhost:8000"; pytest
# Linux/macOS:         EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 pytest
pytest
```

> ⚠️ Tes backend memanggil `/data/reset` yang **menghapus semua data** pada server yang
> dituju. Jalankan hanya terhadap server **lokal/khusus tes**, jangan ke produksi.

---

## Deploy ke produksi

- **Backend → VPS Ubuntu (aaPanel):** [`backend/README.md`](backend/README.md)
- **Frontend (web) → VPS Ubuntu (aaPanel):** [`frontend/README.md`](frontend/README.md)
- **Backend → Render (alternatif):** tersedia `render.yaml` di root project.
- **Android APK:** dibangun dengan EAS Build (`eas build -p android`) — di-*install* di HP,
  bukan di-hosting di VPS.
