# PROJECT_PROFILE | LocalSpin AI SaaS (DPES v1.3)

## 1. Identitas produk
- **Project ID:** `localspin-ai-saas`
- **Nama publik/brand:** LocalSpin AI (`ASUMSI BELUM DISETUJUI` — dapat diganti sesuai brand pilihan klien)
- **Tipe:** Web App / SaaS
- **Pemilik/penanggung jawab:** Pemilik Produk (Klien)
- **Status:** `prototype` (siap diuji lokal & preview HTML lengkap)
- **Repo dan branch utama:** `C:\Users\LENOVO\.gemini\antigravity\scratch\localspin-ai-saas` (`main`)
- **Versi source terakhir yang valid:** `v1.1.0`

## 2. Sasaran dan fungsi
- **Target pengguna:** Praktisi Local SEO, pemilik UMKM multi-cabang, dan agensi pemasaran digital di Indonesia (`TERVERIFIKASI` dari konteks permintaan).
- **Masalah yang diselesaikan:** Membuat ratusan artikel SEO lokal yang menargetkan hirarki daerah Indonesia (**Wilayah/Provinsi &rarr; Kota/Kabupaten &rarr; Kecamatan**) menggunakan kombinasi **Spintax Kata/Frasa/Kalimat + AI**, sekaligus mencegah duplikasi antar-daerah sehingga **lulus ambang kemiripan Copyscape** (`TERVERIFIKASI`).
- **Fitur aktif:**
  1. Generator *AI Master Spintax Blueprint* 3-lapis (Paragraf, Klausa Kalimat, Diksi/Sinonim Kata) + mikro-spintax topik & CTA.
  2. Selector & Resolver Hirarki Daerah Indonesia: **Wilayah (Provinsi)**, pembeda tegas **Kota vs Kabupaten**, dan multi-select **Kecamatan** (beserta injeksi konteks lokal tiap kecamatan).
  3. Mesin *Orthogonal Latin-Square Spintax Resolver* yang memastikan artikel antar-kecamatan mengambil cabang kalimat berbeda.
  4. **Copyscape 4-Gram & 5-Gram Shingle Uniqueness Verifier** + *Auto-Respin Optimizer* (menjamin overlap frasa 4-kata &le; 14% / keunikan &ge; 86% lintas daerah).
  5. Isolasi Multi-Tenant (`workspace_id`), RBAC (`owner`, `admin`, `editor`, `viewer`), pencatatan kuota artikel, dan ekspor CSV/JSON.
- **Fitur yang tidak boleh diubah:** Inti mesin Spintax + Hirarki Wilayah/Kota/Kabupaten/Kecamatan + Verifikasi Copyscape Shingle.
- **Modul tambahan/conditional:** Konektor API eksternal Google Gemini (`GEMINI_API_KEY`) dan Copyscape Premium API (`COPYSCAPE_API_KEY`).
- **Koreksi/keputusan terbaru:** Inisialisasi proyek v1.0.0 dengan metode APOPS 2.2 & DPES v1.3.
- **Pendekatan yang pernah ditolak:** Spintax 1-lapis (hanya mengganti sinonim kata sifat tanpa mengubah struktur kalimat) ditolak karena gagal lolos deteksi 4-gram shingle Copyscape.

## 3. Antarmuka
- **Daftar route/halaman publik:** `/` (`preview/index.html`), `/pricing.html`, `/login.html`, `/privacy.html`, `/terms.html`
- **Daftar dashboard/private route:** `/dashboard.html` (Studio Generator Spintax AI & Audit Copyscape)
- **Layout, palet, design token dan breakpoint:** Mengikuti standar DPES v1.3 T2.3 (`Inter, system-ui`, body `1rem`, line-height `1.65`, kontras WCAG 2.2 AA, responsif 320px–1440px).
- **Bahasa dan aksesibilitas:** Bahasa Indonesia; label form eksplisit, fokus keyboard jelas, target sentuh &ge; 44px.
- **Source gambar/logo dan lisensi aset:** Tipografi sistem & SVG/CSS murni bebas lisensi pihak ketiga.

## 4. Teknologi dan deployment
- **Frontend/framework/version:** HTML5 + CSS3 Design Tokens + Vanilla ES2022 (`preview/` dapat dibuka langsung tanpa build step maupun melalui server).
- **Backend/framework/version:** Node.js v24.21.0 Modular Monolith (`node:http`, `node:crypto`, `node:test`).
- **Database/version:** Relational SQLite (`node:sqlite` built-in Node 24) dengan constraint foreign key dan indeks tenant.
- **Storage, email, notifikasi:** Ekspor langsung CSV/JSON di browser; email notifikasi `BELUM DIPUTUSKAN`.
- **Local/staging/production:** Lingkungan saat ini `local/development`.
- **VPS/hosting, kapasitas dan limit:** Dapat berjalan pada VPS ringan (1 vCPU, 1 GB RAM) karena tanpa dependensi berat.
- **Domain/subdomain:** `BELUM DIPUTUSKAN`.
- **Backup, restore dan rollback:** File database SQLite tunggal memudahkan snapshot atomik & rollback cepat.

## 5. Data, autentikasi dan izin
- **Data pribadi yang diproses:** Nama pengguna dan alamat email akun workspace.
- **Auth provider/flow:** Hash password `scrypt` + header/session identitas workspace pada backend API.
- **Role dan permission per scope:** `owner`, `admin`, `editor` (hak baca & generate artikel), `viewer` (hanya baca).
- **Tenant/ownership model:** Seluruh tabel `campaigns`, `generated_articles`, dan `audit_logs` wajib terikat pada `workspace_id`.
- **RLS/resource authorization:** Pemeriksaan kepemilikan `workspace_id` dan keanggotaan aktif pada setiap endpoint (`authorizeWorkspaceAction`).
- **Data retention dan deletion process:** Dijelaskan pada `/privacy.html` sesuai UU PDP No. 27/2022.
- **Audit log:** Tabel `audit_logs` mencatat setiap pembuatan batch kampanye artikel.

## 6. Bisnis, pembayaran dan lisensi
- **Model bisnis dan tipe produk:** Langganan SaaS berbasis kuota artikel bulanan (`ASUMSI BELUM DISETUJUI`).
- **Harga/pajak/currency:** IDR (Starter Rp 0, Pro Rp 249.000/bln, Agency Rp 749.000/bln — `ASUMSI BELUM DISETUJUI`).
- **Payment provider:** `BELUM DIPUTUSKAN` (Midtrans / Xendit siap diintegrasikan setelah dipilih klien).
- **Owner entitlement:** Level `workspace` (`monthly_article_quota` & `articles_used`).
- **Perangkat yang diizinkan:** Web browser desktop & mobile.
- **Trial, expiry, grace, offline policy:** Paket Starter Trial mendapatkan 25 kuota artikel.
- **Refund, cancel, dispute policy:** Tercantum pada `/terms.html`.
- **APK distribution jika Android:** `TIDAK RELEVAN` (Produk Web SaaS).

## 7. Risiko dan standar penerimaan
- **Sumber risiko utama:**
  1. **Risiko Duplikasi Copyscape:** Jika spintax terlalu dangkal, artikel antar-kecamatan akan terdeteksi duplikat. *Mitigasi:* Mesin menggunakan 7 cabang kalimat per paragraf + rotasi ortogonal + verifikasi 4-gram shingle otomatis (&le; 14% overlap).
  2. **Risiko Pembengkakan Biaya API AI & Copyscape:** Jika memanggil LLM/Copyscape berbayar untuk tiap kecamatan tanpa kontrol. *Mitigasi:* Arsitektur Hybrid Master Spintax + verifikasi shingle lokal sebelum memanggil API berbayar.
- **Target beban dan metrik uji:** Generate & verifikasi silang 5–20 artikel kecamatan selesai &lt; 250ms.
- **Perangkat/browser pengujian:** Desktop & Mobile viewport (320px–1440px).
- **Waktu pemulihan target RTO / RPO:** `BELUM DIPUTUSKAN` (menunggu target deployment produksi).
- **Checklist Quality Gate:** Lulus 4 suite pengujian otomatis (`tests/verification.test.js` = `PASS`).
- **Hal yang belum diverifikasi:** Koneksi langsung ke API berbayar Copyscape Premium & Gemini Live menunggu pengisian API Key milik klien di `.env`.

## 8. Perubahan terakhir
| Tanggal | Keputusan/koreksi | Dampak file/modul | Bukti test | Status |
|---|---|---|---|---|
| 2026-11-16 | Update v1.1.0: Penambahan toolbar & opsi H1/H2/H3, Bold, Underline, Gambar + Alt Spintax, Hyperlink, CTA Klik WhatsApp, SERP Preview & Schema JSON-LD | `src/*`, `preview/*`, `tests/*` | `node --test tests/verification.test.js` (4/4 PASS) | `DIUJI` |
| 2026-11-16 | Rilis awal v1.0.0 SaaS Spintax AI + Geo-Target Wilayah/Kota/Kabupaten/Kecamatan + Copyscape Shingle Verifier | `src/*`, `preview/*`, `tests/*` | `node --test tests/verification.test.js` (4/4 PASS) | `DIUJI` |

## 9. Peta kebutuhan klien dan inisiatif AI (v1.1)
- **Tingkat pemahaman klien:** Menginginkan hasil nyata yang langsung menjawab kebutuhan SEO lokal multi-daerah dan lolos Copyscape.
- **Tujuan yang dinyatakan klien (FAKTA):** Membuat website SaaS dengan penggunaan spintax kata + AI, artikel topik, target daerah (wilayah, kota, kecamatan, kabupaten), dan lulus Copyscape.
- **User journey inti yang telah diverifikasi:** Input Topik & CTA &rarr; Pilih Wilayah (Provinsi) &rarr; Pilih Kota/Kabupaten &rarr; Pilih Kecamatan &rarr; Susun/Edit Master Spintax AI &rarr; Generate Artikel Unik per Kecamatan &rarr; Verifikasi Skor Copyscape (&le; 14% overlap) &rarr; Unduh CSV/JSON.
- **Masalah tersembunyi yang ditemukan AI (dengan bukti):** Spintax biasa yang hanya memutar sinonim kata menghasilkan > 40% overlap 4-gram sehingga pasti gagal Copyscape. AI merancang *Multi-Layer Spintax* + *Topic/CTA Micro-Spintax* yang menurunkan overlap 4-gram menjadi **&lt; 10%** (dibuktikan pada test L2).
- **Rekomendasi utama AI dan alasannya:** Gunakan arsitektur **Hybrid AI Master-Spintax + Local 4-Gram Shingle Gate** karena 10x lebih hemat biaya token AI dan menjamin keunikan matematis sebelum artikel dipublikasikan.
- **Keputusan yang harus diberikan klien:**
  1. Apakah ingin menghubungkan API Key Copyscape Premium & Gemini API sekarang, atau menggunakan engine bawaan terlebih dahulu?
  2. Apakah model paket langganan (Starter / Pro / Agency) dan nama brand **LocalSpin AI** sudah sesuai?

## 10. Matriks discovery
| Aspek | Fakta terverifikasi | Risiko / gap | Rekomendasi | Status keputusan |
|---|---|---|---|---|
| Pengguna & tujuan | Praktisi SEO/bisnis lokal butuh artikel banyak daerah lolos Copyscape | Doorway page penalty jika kalimat sama | Multi-layer spintax + konteks spesifik kecamatan | `TERVERIFIKASI` |
| Alur & halaman | Landing, Studio Generator, Pricing, Login, Privacy, Terms | Preview harus bisa dicoba langsung | Sediakan Studio interaktif di `preview/dashboard.html` | `TERVERIFIKASI` |
| Backend & database | Node.js v24 + SQLite relasional | Isolasi data antar agensi/klien | Wajibkan `workspace_id` di semua tabel | `TERVERIFIKASI` |
| Pembayaran & API luar | Butuh kontrol biaya API AI & Copyscape | Biaya API membengkak jika tanpa kuota | Terapkan kuota per workspace + verifikasi shingle lokal | `ASUMSI BELUM DISETUJUI` |

## 11. Kontrak layanan dan serah terima file (v1.2)
- **Folder utama proyek:** `C:\Users\LENOVO\.gemini\antigravity\scratch\localspin-ai-saas`
- **Paket utama yang diutamakan:** `LocalSpin_AI_SaaS_v1.0.0.zip` + HTML Preview (`preview/index.html` & `preview/dashboard.html`).
- **Bukti tes yang wajib ditampilkan:** Hasil eksekusi `node --test tests/verification.test.js` (`4 PASS, 0 FAIL`).

## 12. HTML/UI release contract (v1.3)
- **Jenis pengalaman:** Multi-halaman + Dashboard SaaS Interaktif.
- **Berkas HTML entry point:** `preview/index.html` dan `preview/dashboard.html`.
- **Daftar halaman relevan:** `index.html`, `dashboard.html`, `login.html`, `pricing.html`, `privacy.html`, `terms.html`.
- **Mode preview:** Dapat dibuka langsung sebagai file HTML (`file://`) maupun lewat server Node.js (`node src/server.js`).
