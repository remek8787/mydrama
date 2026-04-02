# MyDrama Hub

Website nonton drama multi-platform berbasis API:

- Dramabox
- Melolo
- Shortmax

## Fitur

- Pilih platform + bahasa
- Search drama
- Auto tampil daftar beranda/trending saat pertama dibuka (tanpa kata kunci)
- Buka detail drama
- Tampilkan daftar episode
- Play video (support HLS `.m3u8` via `hls.js`)
- Simpan API key/token di browser (`localStorage`)
- Episode berbayar ditandai 🔒 dan akan mencoba unlock saat token diisi

## Stack

- HTML + CSS + Vanilla JS
- `hls.js` CDN
- Deploy cocok untuk GitHub Pages

## Jalankan Lokal

Cukup buka `index.html`, atau lebih aman pakai static server:

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy ke GitHub Pages

1. Push ke branch `main`
2. Buka **Settings > Pages**
3. Source: `Deploy from a branch`
4. Branch: `main` + root
5. Save

## Catatan

- API key/token yang ditaruh di frontend bisa terlihat user (karena client-side).
- Jika mau lebih aman, gunakan backend proxy private.
