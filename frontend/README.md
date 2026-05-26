# DuitKu Frontend — Deploy ke VPS Ubuntu (aaPanel)

Frontend DuitKu adalah aplikasi **Expo (React Native)** yang menghasilkan dua bentuk:

| Target | Cara distribusi |
|--------|-----------------|
| **Android** | APK yang di-*install* di HP (dibuat dengan **EAS Build**) — **tidak** di-hosting di VPS. |
| **Web** | Kumpulan file statis (HTML/JS/CSS) yang **bisa di-hosting** di VPS via aaPanel. |

Panduan ini fokus pada **deploy versi WEB** ke VPS Ubuntu memakai aaPanel. Untuk Android,
lihat bagian [Build APK](#build-apk-android-bukan-via-vps) di bawah.

> Untuk menjalankan secara lokal (development), lihat [README utama](../README.md).

## Prasyarat

- VPS Ubuntu dengan **aaPanel** terpasang.
- Domain/subdomain di-arahkan (A record) ke IP VPS, mis. `app.domainanda.com`.
- **Backend sudah online lebih dulu** (lihat [`../backend/README.md`](../backend/README.md)),
  karena URL backend "dibakar" ke dalam build web.

---

## Langkah 1 — Build versi web (di komputer Anda)

Variabel `EXPO_PUBLIC_*` ditanam **saat build**, jadi set dulu ke nilai produksi.
Buat/ubah `frontend/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=https://api.domainanda.com
EXPO_PUBLIC_API_KEY=<API_KEY-yang-sama-dengan-backend>
```

Lalu build:

```bash
cd frontend
npm install
npx expo export --platform web
```

Hasilnya ada di folder **`frontend/dist/`** — file statis siap di-hosting.

---

## Langkah 2 — Buat Website di aaPanel

1. Login aaPanel → menu **Website** → **Add site**.
2. Domain: `app.domainanda.com`. Opsi FTP & Database boleh dikosongkan (tidak perlu).
3. aaPanel membuat folder root, biasanya `/www/wwwroot/app.domainanda.com`.

## Langkah 3 — Unggah isi folder `dist/`

- Buka **File Manager** aaPanel → masuk ke folder root situs di atas.
- Unggah **isi** folder `dist/` (bukan foldernya). Tip: zip dulu `dist/`, unggah,
  lalu **Extract** di aaPanel.
- Pastikan `index.html` berada **langsung** di root situs.

## Langkah 4 — Atur nginx (fallback rute)

Agar refresh halaman dalam tidak menghasilkan 404, sesuaikan blok `location /`:

1. Website → klik situs → **Config**.
2. Ubah/ tambahkan:

   ```nginx
   location / {
       try_files $uri $uri.html $uri/ /index.html;
   }
   ```

3. Simpan, lalu **Reload** nginx.

## Langkah 5 — Aktifkan HTTPS (SSL)

- Website → situs → **SSL** → tab **Let's Encrypt** → pilih domain → **Apply**.
- Aktifkan **Force HTTPS**.

## Langkah 6 — Cek

Buka `https://app.domainanda.com`. Aplikasi tampil dan dapat memuat data dari backend.
Jika data tidak muncul:

- Pastikan `EXPO_PUBLIC_BACKEND_URL` saat build sudah benar (harus `https://...`).
- Pastikan backend online dan `EXPO_PUBLIC_API_KEY` cocok dengan `API_KEY` backend.

> Setiap kali kode berubah, ulangi **Langkah 1 & 3** (build ulang + unggah ulang `dist/`).

---

## Build APK Android (bukan via VPS)

APK tidak di-hosting di VPS — dibuat dengan **EAS Build**:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

EAS memberi tautan unduh APK untuk di-install di HP. Pastikan `frontend/.env`
(`EXPO_PUBLIC_BACKEND_URL` + `EXPO_PUBLIC_API_KEY`) menunjuk ke **backend produksi**
sebelum build.
