# DuitKu Backend — Deploy ke VPS Ubuntu (aaPanel)

API FastAPI untuk DuitKu. Panduan ini men-deploy backend ke VPS Ubuntu memakai
**aaPanel** (Python Project Manager + reverse proxy nginx) dengan database
**MongoDB Atlas**.

> Untuk menjalankan secara lokal (development), lihat [README utama](../README.md).

## Arsitektur di server

```
Internet ──► nginx (aaPanel, :443) ──► uvicorn (127.0.0.1:8000) ──► MongoDB Atlas
              domain + SSL                proses Python (FastAPI)        (cloud)
```

## Prasyarat

- VPS Ubuntu dengan **aaPanel** terpasang.
- Domain/subdomain di-arahkan ke IP VPS, mis. `api.domainanda.com`.
- *Connection string* MongoDB Atlas.

---

## Langkah 1 — Pasang Python di aaPanel

aaPanel → **App Store** → cari & install **"Python Project Manager"**
(pilih versi Python **3.11+**).

## Langkah 2 — Unggah kode backend

Letakkan isi folder `backend/` ke VPS, mis. di `/www/wwwroot/duitku-backend`. Pilihan:

- **File Manager** aaPanel (unggah zip, lalu Extract), atau
- **Terminal** aaPanel: `git clone <repo-anda>` lalu masuk ke folder `backend`.

Wajib ada: `server.py` dan `requirements.txt`.

## Langkah 3 — Buat Python Project

Di **Python Project Manager** → **Add Project**:

- **Path:** folder backend di atas (`/www/wwwroot/duitku-backend`).
- **Python version:** 3.11+.
- **Run / Startup command:**

  ```bash
  uvicorn server:app --host 127.0.0.1 --port 8000
  ```

- **Port:** `8000` (port internal — nanti di-proxy oleh nginx).
- Biarkan aaPanel membuat **virtualenv** dan menjalankan `pip install -r requirements.txt`.
  (Jika tidak otomatis: buka **Terminal**, masuk ke folder, jalankan
  `pip install -r requirements.txt`.)

## Langkah 4 — Set Environment Variables

Backend butuh 3 variabel. Set lewat panel **Environment** project, **atau** buat file
`.env` di folder backend (aplikasi membacanya otomatis via `python-dotenv`):

```env
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=duitku
API_KEY=<isi-dengan-string-acak-yang-panjang>
```

> ⚠️ **Wajib isi `API_KEY` di produksi** — ini "gembok" API Anda. Tanpa itu, siapa pun yang
> tahu URL bisa membaca/menghapus seluruh data. Pakai nilai yang **sama** pada
> `EXPO_PUBLIC_API_KEY` di frontend.

## Langkah 5 — Izinkan VPS di MongoDB Atlas

Atlas → **Network Access** → **Add IP Address** → masukkan **IP publik VPS** Anda
(atau `0.0.0.0/0`). Database tetap aman karena tetap butuh username + password.

## Langkah 6 — Reverse proxy, domain, & SSL

1. **Website** → **Add site** dengan domain `api.domainanda.com`.
2. Buka situs → **Reverse Proxy** → **Add**:
   - **Target URL:** `http://127.0.0.1:8000`
   - Simpan. (Ini meneruskan trafik domain ke uvicorn.)

   *Catatan:* sebagian versi aaPanel bisa langsung **bind domain** di Python Project
   Manager. Pilih salah satu cara saja, jangan dobel.
3. **SSL** → **Let's Encrypt** → Apply, lalu aktifkan **Force HTTPS**.

## Langkah 7 — Jalankan & cek

- Di Python Project Manager, **Start** project (dan aktifkan **auto-start on boot**).
- Verifikasi:
  - `https://api.domainanda.com/` → `{"status":"ok"}` (terbuka, untuk health check).
  - `https://api.domainanda.com/api/accounts` **tanpa** header → `401 Unauthorized`
    (artinya gembok aktif ✅).
  - Dengan header `X-API-Key: <API_KEY>` → `200` + data.

## Langkah 8 — Sambungkan frontend

Pada frontend, set `EXPO_PUBLIC_BACKEND_URL=https://api.domainanda.com` dan
`EXPO_PUBLIC_API_KEY=<API_KEY>`, lalu build ulang
(lihat [`../frontend/README.md`](../frontend/README.md)).

---

## Update kode (deploy ulang)

1. Tarik kode baru (File Manager / `git pull` di Terminal).
2. Jika `requirements.txt` berubah: aktifkan venv, `pip install -r requirements.txt`.
3. **Restart** project di Python Project Manager.

## Masalah umum

| Gejala | Kemungkinan penyebab |
|--------|----------------------|
| **502 Bad Gateway** | Proses uvicorn mati — cek log project; pastikan port 8000 cocok dengan Reverse Proxy. |
| **Gagal konek DB / timeout** | IP VPS belum diizinkan di Atlas Network Access (Langkah 5). |
| **Semua request `401`** | `API_KEY` di server beda dengan `EXPO_PUBLIC_API_KEY` di frontend. |
| **`KeyError: MONGO_URL` saat start** | `.env` / environment variable belum ter-set (Langkah 4). |
