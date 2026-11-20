# PAGE_MANIFEST | LocalSpin AI SaaS (DPES v1.3 T2.2)

**Versi Source:** `v1.4.0`  
**Tanggal Pembaruan:** 17 November 2026  

| Route | File HTML Preview | Nama Halaman | Tipe | Role / Scope | Status | Responsive (320-1440px) | Dependency & Catatan |
|---|---|---|---|---|---|---|---|
| `/` | `preview/index.html` | Beranda Produk SaaS | Publik | Publik | `implemented` | `PASS` | Mandiri (tanpa ketergantungan backend) |
| `/dashboard.html` | `preview/dashboard.html` | Studio Generator Spintax AI & Audit Copyscape | Aplikasi / Private | `owner`, `admin`, `editor` | `implemented` | `PASS` | Berfungsi penuh di browser (interaktif) + sinkron dengan endpoint `/api/v1/campaigns/generate` |
| `/leads.html` | `preview/leads.html` | Lead Finder Google Maps & Ulasan | Aplikasi / Private | `owner`, `admin`, `editor` | `implemented` | `PASS` | Simulasi demo Depok & Jepang di mode statis + terhubung ke `/api/v1/leads/search` |
| `/email-outreach.html` | `preview/email-outreach.html` | Spintax Email Penawaran & Jadwal Acak/Blast | Aplikasi / Private | `owner`, `admin`, `editor` | `implemented` | `PASS` | Simulasi antrean di mode statis + terhubung ke `/api/v1/email-campaigns` |
| `/login.html` | `preview/login.html` | Masuk & Registrasi Workspace | Autentikasi | Publik | `preview-only` (`SIMULASI`) | `PASS` | UI simulasi menuju Studio; autentikasi backend tersedia di `src/db/database.js` |
| `/pricing.html` | `preview/pricing.html` | Harga & Paket Kuota Artikel | Komersial / Publik | Publik | `preview-only` (`SIMULASI`) | `PASS` | Menampilkan paket kuota (Starter, Pro, Agency); transaksi pembayaran ditandai sebagai simulasi |
| `/privacy.html` | `preview/privacy.html` | Kebijakan Privasi (UU PDP) | Legal / Publik | Publik | `implemented` | `PASS` | Mencerminkan pemrosesan data aktual aplikasi |
| `/terms.html` | `preview/terms.html` | Syarat Layanan & Penggunaan | Legal / Publik | Publik | `implemented` | `PASS` | Menjelaskan ruang lingkup verifikasi shingle & API Copyscape |
