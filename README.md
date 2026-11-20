# LocalSpin AI SaaS v1.0.0

Platform SaaS Generator Artikel SEO Lokal Indonesia berbasis **Multi-Layer AI Spintax**, penargetan hirarki **Wilayah (Provinsi) &rarr; Kota / Kabupaten &rarr; Kecamatan**, serta **Copyscape 4-Gram & 5-Gram Shingle Uniqueness Verifier**. Dibangun mengikuti metode **APOPS 2.2** dan **DPES v1.3**.

## Cara Membuka Preview Interaktif Tanpa Server
Buka langsung file berikut di browser Anda:
- Beranda Produk: `preview/index.html`
- Studio Generator (Aplikasi Utama): `preview/dashboard.html`

## Cara Menjalankan Backend API & Server Lokal
```powershell
cd C:\Users\LENOVO\.gemini\antigravity\scratch\localspin-ai-saas
node src/server.js
```
Server akan aktif di `http://127.0.0.1:3456`.

## Cara Menjalankan Pengujian Verifikasi Otomatis (L2, L3, L5)
```powershell
node --test tests/verification.test.js
```
