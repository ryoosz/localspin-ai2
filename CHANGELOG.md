# CHANGELOG | LocalSpin AI SaaS

## [1.4.0] - 2026-11-17
### Ditambahkan
- **Spintax Email Penawaran Komoditas & Jadwal Acak Anti-Blast (`src/domain/emailOutreachEngine.js` & `preview/email-outreach.html`):**
  - Alur terhubung langsung dari **Lead Finder Maps** (centang usaha seperti *Coffee Shop di Jepang* &rarr; klik **Kirim ke Spintax Email**).
  - **Multi-Sender Rotation:** Mendukung banyak alamat email pengirim & jenis layanan berbeda (`SMTP Server`, `Gmail Workspace`, `Resend / API`, `Zoho Mail`) dengan rotasi `Round-Robin` atau `Acak`.
  - **Spintax Subjek & Isi Penawaran Dagang:** Preset otomatis B2B Kopi Jepang (English) dan Komoditas (Indonesia) dengan injeksi `{{nama_usaha}}`, `{{kota_daerah}}`, `{{komoditas}}`, `{{email_pengirim}}`, dan `{{wa_pengirim}}`.
  - **Dua Mode Pengiriman:** **Jadwal Acak (Anti-Blast)** dengan jeda acak misalnya **3–5 menit** antar-email, atau **Mode Blast Email** untuk pengiriman sekaligus.
  - **Keamanan & Kepatuhan:** Deduplikasi email otomatis, sanitasi *CRLF header injection*, opsi teks *Opt-Out/Unsubscribe*, isolasi `workspace_id`, dan RBAC.

## [1.3.0] - 2026-11-17
### Ditambahkan
- **Fitur Tersendiri: Lead Finder Google Maps & Ulasan (`src/domain/placesLeadFinder.js` & `preview/leads.html`):**
  - Pencarian tempat usaha berdasarkan jenis usaha & daerah (contoh: *Coffee Shop / Tempat Kopi di Depok*) melalui jalur resmi **Google Maps Platform — Places API (New)** (`GOOGLE_PLACES_API_KEY`) hingga 60 hasil terpaginasi, tanpa scraping HTML atau bypass anti-bot/CAPTCHA.
  - Mengambil **Nama Tempat**, **Kategori**, **Alamat**, **Nomor Telepon** (nasional & internasional), **Website**, **Jam Buka**, status **Buka Sekarang**, **Rating**, **Jumlah Ulasan**, dan **Ulasan Google**.
  - **Enrichment Email Kontak Otomatis & Aman:** Membaca halaman kontak publik website milik usaha (`/` , `/contact`, `/kontak`, `/hubungi-kami`) dengan menghormati `robots.txt`, batas ukuran payload, timeout, dan proteksi **SSRF** (memblokir IP privat/localhost).
  - **Filter & Pengurutan Lengkap:** Filter wajib ada **Nomor Telepon**, **Email**, **Jam Buka**, **Website**, **Sedang Buka Sekarang**, **Rating Minimal**, **Minimal Ulasan**, pencarian nama, serta pengurutan berdasarkan rating, jumlah ulasan, kelengkapan data, atau nama A–Z.
  - **Ekspor CSV (anti formula-injection) & JSON** serta atribusi resmi `"Data tempat: Google Maps"`.

## [1.2.0] - 2026-11-16
### Ditambahkan
- **Penyimpanan Hingga 99 Gambar Referensi per Project (`src/db/database.js` & `preview/dashboard.html`):**
  - Manajemen Multi-Project (*Project A*, *Project B*, *+ Buat Project Baru*) di mana setiap project menyimpan koleksi hingga **99 gambar referensi** secara terpisah.
  - Mendukung rotasi gambar otomatis maupun pemasangan galeri (1–4 gambar per artikel) dari 99 gambar yang tersedia.
- **Judul Gambar (`title="..."`) & Caption Otomatis Disesuaikan Topik & Daerah:**
  - Setiap gambar yang dipasang memiliki atribut `title="..."`, `alt="..."`, dan `<figcaption>` yang otomatis di-spin dan disesuaikan dengan **Topik + Nomor Slot Gambar + Kecamatan + Kota/Kabupaten**.
- **Kolom Artikel Utama + Deteksi Bahasa Otomatis & Auto-Nested Spin (`src/domain/autoSpinLanguageEngine.js`):**
  - Kolom khusus untuk mengisi/paste artikel utama mentah.
  - Mesin pendeteksi bahasa otomatis (`Bahasa Indonesia`, `English`, atau `Bilingual ID-EN`) yang langsung mengubah kalimat biasa menjadi **Nested Spintax 3 Lapis** (`{frase|{sub-frase 1|sub-frase 2}}`) tanpa perlu menulis kode kurung kurawal manual.
- **Sistem Pasang Template Otomatis (`assembleAutoTemplate`):**
  - Opsi *Pasang Template Otomatis* yang menyematkan **Header H1 + Gambar Project + URL Hyperlink + FAQ Schema + Tombol CTA WhatsApp** secara otomatis di sekeliling artikel, sehingga pengguna cukup men-spin **isi artikel utamanya saja**.
- **Kalkulator Kemungkinan Generate & Rekomendasi Anti-Artikel Sampah (`calculateSafeArticleCapacity`):**
  - Menghitung total kemungkinan kombinasi matematis sekaligus memberikan **Rekomendasi Jumlah Artikel Optimal & Batas Maksimal Aman** agar hasil generate tidak terdeteksi sebagai artikel sampah (*thin/doorway spam*) dan tetap lulus Copyscape (&le;14% overlap).

## [1.1.0] - 2026-11-16
### Ditambahkan
- Toolbar & opsi otomatis `H1`, `H2`, `H3`, `Bold`, `Underline`, Gambar + Alt Spintax, Hyperlink, Tombol Klik WhatsApp, dan Google SERP Preview.

## [1.0.0] - 2026-11-16
### Ditambahkan
- Rilis awal Multi-Layer AI Spintax Engine, Hirarki Daerah Indonesia (Wilayah, Kota, Kabupaten, Kecamatan), dan Copyscape 4-Gram/5-Gram Shingle Verifier.
