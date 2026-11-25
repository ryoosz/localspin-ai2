/**
 * LocalSpin AI SaaS - Interactive Client Engine v1.2.0 (DPES v1.3 HTML Visual Handoff)
 * Synchronized with src/domain/spintaxEngine.js, src/domain/autoSpinLanguageEngine.js,
 * and src/domain/copyscapeVerifier.js.
 * Features:
 * - Multi-Project Manager (Project A, Project B, etc.) with up to 99 Reference Images per Project
 * - Dynamic Image Title (`title="..."`) & Alt-Text adapted to Topic + Region
 * - Main Article Column (Kolom Artikel Utama) with Auto-Language Detection (ID / EN / Mixed) & Auto-Nested Spin
 * - Auto-Template Wrapper (Auto-Header H1 + Project Images + Spun Body + Auto-URL + Auto-CTA WhatsApp)
 * - Anti-Trash Capacity & Safe Article Recommendation Calculator
 */

const MAX_IMAGES_PER_PROJECT = 99;

const LOCALSPIN_REGIONS =
  (typeof window !== 'undefined' && Array.isArray(window.INDONESIAN_REGIONS_DATA) && window.INDONESIAN_REGIONS_DATA.length > 0)
    ? window.INDONESIAN_REGIONS_DATA
    : [
        {
          id: 'wil-jabar',
          wilayah: 'Jawa Barat',
          karakteristikWilayah: 'koridor ekonomi kreatif dan industri Priangan hingga megapolitan penyangga ibu kota',
          daerahList: [
            {
              id: 'jabar-bandung-kota',
              jenis: 'Kota',
              nama: 'Bandung',
              labelLengkap: 'Kota Bandung',
              konteksDaerah: 'pusat komersial, pendidikan tinggi, dan bisnis kreatif di cekungan Bandung',
              kecamatan: [
                { nama: 'Coblong', konteks: 'kawasan kampus, kuliner, dan hunian padat di Bandung Utara' },
                { nama: 'Buahbatu', konteks: 'koridor hunian keluarga dan akses utama menuju Bandung Selatan' }
              ]
            }
          ]
        }
      ];

const DEFAULT_PROJECTS_STATE = {
  proj_a: {
    id: 'proj_a',
    name: 'Project A — Solar Panel & Audit Energi',
    topic: 'Jasa Instalasi Panel Surya & Audit Energi',
    rawMainArticle:
      'Layanan pemasangan panel surya terbaik dan profesional untuk rumah maupun gedung komersial. Tim teknisi berpengalaman kami memberikan solusi hemat biaya listrik dengan kualitas instalasi bergaransi resmi.\n\nSetiap pelanggan mendapatkan pemeriksaan lokasi menyeluruh agar kapasitas sistem yang dipasang sesuai kebutuhan daya harian bangunan.',
    autoTemplateEnabled: true,
    whatsappNumber: '6281234567890',
    whatsappLabel: 'Chat WhatsApp Spesialis Panel Surya',
    targetUrl: 'https://nusantaraseo.id/panel-surya',
    anchorText: 'katalog paket panel surya resmi',
    linkRel: 'dofollow',
    callToAction: 'Hubungi tim spesialis kami untuk jadwal konsultasi dan survei gratis di lokasi Anda',
    imagesPerArticle: 2,
    imageTitlePattern: '{{topik}} — Dokumentasi #{{ nomor_gambar }} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
    imageAltPattern: '{Dokumentasi pengerjaan|Tim teknisi lapangan|Proses instalasi resmi|Standar kerja profesional} {{topik}} #{{ nomor_gambar }} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
    images: []
  },
  proj_b: {
    id: 'proj_b',
    name: 'Project B — Kontraktor Renovasi & Interior',
    topic: 'Jasa Kontraktor Renovasi Rumah & Bangunan',
    rawMainArticle:
      'Jasa kontraktor renovasi rumah terpercaya dengan rincian biaya transparan dan pengerjaan cepat tepat waktu. Tim arsitek serta teknisi sipil ahli kami siap menangani perbaikan struktur, pengecatan, hingga pembaruan interior terbaik.\n\nKami memastikan kualitas material bangunan selalu terjamin dan dilengkapi garansi pemeliharaan tertulis bagi setiap pelanggan.',
    autoTemplateEnabled: true,
    whatsappNumber: '6281987654321',
    whatsappLabel: 'Konsultasi WhatsApp Tim Renovasi',
    targetUrl: 'https://nusantaraseo.id/kontraktor-renovasi',
    anchorText: 'portofolio proyek renovasi bangunan',
    linkRel: 'dofollow',
    callToAction: 'Diskusikan RAB dan jadwal survei renovasi bangunan Anda bersama tim teknis kami hari ini',
    imagesPerArticle: 2,
    imageTitlePattern: '{{topik}} — Proyek #{{ nomor_gambar }} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
    imageAltPattern: '{Proyek renovasi bangunan|Tim sipil & arsitek|Pengerjaan interior rapi|Standar konstruksi resmi} {{topik}} #{{ nomor_gambar }} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
    images: []
  }
};

const ID_MARKERS = new Set([
  'yang', 'dan', 'di', 'ini', 'untuk', 'dengan', 'dalam', 'tidak', 'akan', 'dari',
  'pada', 'adalah', 'atau', 'juga', 'kami', 'anda', 'bisa', 'dapat', 'lebih', 'sebagai',
  'oleh', 'karena', 'tersebut', 'sangat', 'layanan', 'jasa', 'harga', 'terbaik', 'murah',
  'profesional', 'kecamatan', 'kota', 'kabupaten', 'wilayah', 'kebutuhan', 'solusi'
]);

const EN_MARKERS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'our', 'are',
  'can', 'will', 'have', 'more', 'best', 'service', 'services', 'professional',
  'quality', 'solution', 'solutions', 'trusted', 'affordable', 'reliable', 'area', 'local'
]);

const ID_NESTED_DICT = [
  { pattern: /\b(layanan|jasa)\b/gi, replacement: '{layanan|jasa|{solusi teknis|penanganan profesional|unit layanan}}' },
  { pattern: /\b(terbaik|unggulan)\b/gi, replacement: '{terbaik|unggulan|{pilihan utama|berstandar tinggi|paling direkomendasikan}}' },
  { pattern: /\b(terpercaya|amanah|resmi)\b/gi, replacement: '{terpercaya|resmi|{berpengalaman luas|memiliki reputasi teruji|bersertifikat lengkap}}' },
  { pattern: /\b(profesional|ahli|berpengalaman)\b/gi, replacement: '{profesional|ahli|{berpengalaman tinggi|kompeten di bidangnya|terlatih secara teknis}}' },
  { pattern: /\b(cepat|responsif|sigap)\b/gi, replacement: '{cepat|responsif|{sigap di lapangan|tepat waktu sesuai jadwal|tanpa waktu tunggu lama}}' },
  { pattern: /\b(murah|terjangkau|hemat)\b/gi, replacement: '{terjangkau|hemat anggaran|{kompetitif dan transparan|rasional tanpa biaya tersembunyi|ramah di kantong}}' },
  { pattern: /\b(bergaransi|jaminan)\b/gi, replacement: '{bergaransi resmi|dilengkapi jaminan mutu|{memiliki garansi tertulis|dijamin keamanannya|didukung layanan purna jual}}' },
  { pattern: /\b(pelanggan|klien|konsumen)\b/gi, replacement: '{pelanggan|klien|{pemilik properti|masyarakat maupun pelaku usaha|pengguna jasa}}' },
  { pattern: /\b(masalah|kendala|kerusakan)\b/gi, replacement: '{masalah|kendala|{hambatan teknis|gangguan fungsi|persoalan di lapangan}}' },
  { pattern: /\b(solusi|penanganan)\b/gi, replacement: '{solusi|penanganan|{langkah penyelesaian|metode perbaikan|pendekatan teknis}}' },
  { pattern: /\b(kualitas|mutu)\b/gi, replacement: '{kualitas|mutu|{standar hasil kerja|ketahanan jangka panjang|performa pengerjaan}}' },
  { pattern: /\b(biaya|harga|tarif|anggaran)\b/gi, replacement: '{biaya|estimasi anggaran|{rincian harga|skema tarif|investasi pengerjaan}}' },
  { pattern: /\b(tim|teknisi|petugas)\b/gi, replacement: '{tim teknis|personel lapangan|{tenaga spesialis|teknisi berpengalaman|petugas operasional}}' },
  { pattern: /\b(rumah|bangunan|gedung|properti)\b/gi, replacement: '{hunian|bangunan|{properti rumah tangga|gedung komersial|tempat usaha}}' },
  { pattern: /\b(memberikan|menghadirkan|menyediakan)\b/gi, replacement: '{memberikan|menghadirkan|{menyediakan|menawarkan|memastikan}}' },
  { pattern: /\b(mendapatkan|memperoleh|meraih)\b/gi, replacement: '{mendapatkan|memperoleh|{menerima secara langsung|merasakan manfaat|memastikan}}' },
  { pattern: /\b(pemasangan|instalasi|pengerjaan)\b/gi, replacement: '{pemasangan|instalasi|{pengerjaan teknis|implementasi sistem|penanganan lapangan}}' },
  { pattern: /\b(sesuai|selaras|mengikuti)\b/gi, replacement: '{sesuai|mengikuti|{selaras dengan|berdasarkan perhitungan|disesuaikan dengan}}' },
  { pattern: /\b(kebutuhan|keperluan|permintaan)\b/gi, replacement: '{kebutuhan|keperluan|{permintaan aktual|skala pemakaian|spesifikasi}}' },
  { pattern: /\b(memiliki|mempunyai|punya)\b/gi, replacement: '{memiliki|mempunyai|{menghadirkan|dilengkapi dengan|menawarkan}}' },
  { pattern: /\b(sangat|amat|begitu)\b/gi, replacement: '{sangat|begitu|{luar biasa|cukup|benar-benar}}' },
  { pattern: /\b(banyak|beragam|berbagai)\b/gi, replacement: '{banyak|berbagai|{beragam|sejumlah|puluhan hingga ratusan}}' },
  { pattern: /\b(populer|terkenal|favorit)\b/gi, replacement: '{populer|terkenal|{banyak diminati|menjadi favorit|dikenal luas}}' },
  { pattern: /\b(khas|unik|spesial|istimewa)\b/gi, replacement: '{khas|unik|{istimewa|berkarakter kuat|sulit ditandingi}}' },
  { pattern: /\b(produk|barang|komoditas|menu)\b/gi, replacement: '{produk|pilihan utama|{varian unggulan|koleksi terbaik|penawaran spesial}}' },
  { pattern: /\b(membuat|menjadikan|menciptakan)\b/gi, replacement: '{membuat|menjadikan|{menciptakan|menghasilkan|mendorong}}' },
  { pattern: /\b(membantu|mendukung|memudahkan)\b/gi, replacement: '{membantu|mendukung|{memudahkan|mempercepat|mengoptimalkan}}' },
  { pattern: /\b(menjaga|merawat|mempertahankan)\b/gi, replacement: '{menjaga|mempertahankan|{merawat|melindungi|memastikan konsistensi}}' },
  { pattern: /\b(cocok|tepat|ideal)\b/gi, replacement: '{cocok|tepat|{ideal|sangat sesuai|pas}}' },
  { pattern: /\b(nikmat|lezat|enak|segar)\b/gi, replacement: '{nikmat|berkualitas|{segar dan autentik|memanjakan selera|bercita rasa tinggi}}' },
  { pattern: /\b(lokasi|tempat|area|kawasan)\b/gi, replacement: '{lokasi|kawasan|{area sekitar|titik strategis|wilayah}}' },
  { pattern: /\b(sekarang|kini|saat ini)\b/gi, replacement: '{kini|saat ini|{pada era modern ini|sekarang juga|hari ini}}' },
  { pattern: /\b(hubungi|kontak|kunjungi)\b/gi, replacement: '{hubungi|kunjungi|{konsultasikan bersama|akses layanan|temui tim}}' },
  { pattern: /\b(dunia|pasar|industri)\b/gi, replacement: '{pasar luas|berbagai kalangan|{skala nasional hingga global|komunitas luas|industri terkait}}' },
  { pattern: /\b(setiap|seluruh|semua)\b/gi, replacement: '{setiap|seluruh|{masing-masing|semua|tiap-tiap}}' },
  { pattern: /\b(untuk|bagi|guna)\b/gi, replacement: '{untuk|bagi|{guna memenuhi|dalam mendukung|khusus}}' },
  { pattern: /\b(dengan|memakai|menggunakan)\b/gi, replacement: '{dengan|menggunakan|{berbekal|didukung|memanfaatkan}}' }
];

const EN_NESTED_DICT = [
  { pattern: /\b(service|services)\b/gi, replacement: '{service|professional assistance|{technical solutions|specialized support|dedicated service}}' },
  { pattern: /\b(best|top|leading)\b/gi, replacement: '{best|top-rated|{industry-leading|highly recommended|premier}}' },
  { pattern: /\b(trusted|reliable|dependable)\b/gi, replacement: '{trusted|reliable|{fully certified|proven and dependable|well-established}}' },
  { pattern: /\b(professional|expert|experienced)\b/gi, replacement: '{professional|expert|{highly experienced|certified specialist|skilled technical}}' },
  { pattern: /\b(fast|quick|rapid)\b/gi, replacement: '{fast|prompt|{rapid-response|on-schedule|time-efficient}}' },
  { pattern: /\b(affordable|cheap|cost-effective)\b/gi, replacement: '{affordable|cost-effective|{transparently priced|budget-friendly|competitively priced}}' },
  { pattern: /\b(quality|standard)\b/gi, replacement: '{quality|craftsmanship|{long-lasting performance|strict quality standard|durability}}' },
  { pattern: /\b(customer|customers|client|clients)\b/gi, replacement: '{customers|clients|{property owners|local businesses and residents|homeowners}}' }
];

function clientDetectLanguage(rawText) {
  const clean = String(rawText || '')
    .replace(/\{\{[a-zA-Z0-9_]+\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[{}|]/g, ' ')
    .toLowerCase();

  const words = clean.split(/[^a-z0-9]+/i).filter((w) => w.length >= 2);
  let idHits = 0;
  let enHits = 0;

  for (const w of words) {
    if (ID_MARKERS.has(w)) idHits++;
    if (EN_MARKERS.has(w)) enHits++;
    if (/^(meny|meng|mem|ber|ter|per|ke)[a-z]{4,}(kan|i|an|nya)?$/.test(w)) idHits += 0.5;
    if (/^[a-z]{4,}(tion|ment|ness|able|ively)$/.test(w)) enHits += 0.5;
  }

  const total = Math.max(1, idHits + enHits);
  const idRatio = idHits / total;
  const enRatio = enHits / total;

  let languageCode = 'id';
  let label = 'Bahasa Indonesia (Otomatis)';
  if (idHits > 0 && enHits > 0 && idRatio >= 0.25 && enRatio >= 0.25) {
    languageCode = 'mixed';
    label = 'Bilingual Indonesia + English (Otomatis)';
  } else if (enHits > idHits) {
    languageCode = 'en';
    label = 'English (Auto-Detected)';
  }
  const confidence = Math.round(Math.min(99, Math.max(68, Math.max(idRatio, enRatio) * 100)));
  return { languageCode, label, confidence, wordCount: words.length };
}


function stripSectionMarkers(text) {
  return String(text || '')
    .replace(/\[\s*(?:BAGIAN|BAGAN|SECTION|STAGE|PART|TAHAP)\s*0?\d+[^\]]*\]\s*[:\-–—]?/gi, ' ')
    .replace(/^(\s*#{1,4}\s+)\*{0,2}(?:BAGIAN|BAGAN|SECTION|TAHAP)\s*0?\d+\*{0,2}\s*[:\-–—]\s*/gim, '$1')
    .replace(/^\s*(?:#{1,4}\s*)?\*{0,2}(?:BAGIAN|BAGAN|SECTION|TAHAP)\s*0?\d+\*{0,2}\s*[:\-–—]?\s*$/gim, '')
    .replace(/\b(?:BAGIAN|BAGAN)\s*0?[1-9]\b\s*[:\-–—]?/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSmartHref(rawTarget) {
  const val = String(rawTarget || '').trim();
  if (!val) return { href: '', isWeb: false, kind: 'empty', display: '' };
  if (/^mailto:/i.test(val)) {
    const cleanMail = val.replace(/^mailto:/i, '').trim();
    return { href: 'mailto:' + cleanMail, isWeb: false, kind: 'email', display: cleanMail.split('?')[0] };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return { href: 'mailto:' + val, isWeb: false, kind: 'email', display: val };
  }
  if (/^tel:/i.test(val)) {
    const rawPh = val.replace(/^tel:/i, '').trim();
    const digits = rawPh.replace(/[^0-9+]/g, '');
    return { href: 'tel:' + digits, isWeb: false, kind: 'phone', display: rawPh };
  }
  if (/^[+\d][\d\s().\-]{5,22}$/.test(val) && !val.includes('.')) {
    const digitsOnly = val.replace(/[^0-9]/g, '');
    const normPhone = digitsOnly.startsWith('0')
      ? '+62' + digitsOnly.slice(1)
      : digitsOnly.startsWith('62')
        ? '+' + digitsOnly
        : '+' + digitsOnly;
    return { href: 'tel:' + normPhone, isWeb: false, kind: 'phone', display: val };
  }
  const webUrl = /^https?:\/\//i.test(val) ? val : 'https://' + val;
  return { href: webUrl, isWeb: true, kind: 'url', display: val };
}

function splitBodyAtMidpointClient(bodyStr) {
  const blocks = String(bodyStr || '').split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) return [bodyStr, ''];
  let splitIdx = Math.ceil(blocks.length / 2);
  for (let offset = 0; offset <= 2; offset++) {
    const cand = splitIdx + offset;
    if (cand > 0 && cand < blocks.length && /^#{2,3}\s+/.test(blocks[cand])) {
      splitIdx = cand;
      break;
    }
    const candBack = splitIdx - offset;
    if (candBack > 0 && candBack < blocks.length && /^#{2,3}\s+/.test(blocks[candBack])) {
      splitIdx = candBack;
      break;
    }
  }
  return [blocks.slice(0, splitIdx).join('\n\n'), blocks.slice(splitIdx).join('\n\n')];
}

function clientAutoSpinRawArticle(rawText, topic = 'Layanan Profesional') {
  const input = stripSectionMarkers(rawText);
  const detection = clientDetectLanguage(input || topic);
  const lang = detection.languageCode;
  if (!input) return { detectedLanguage: detection, spunArticleBody: '', blocksCreated: 0 };

  const normalizedInput = input.replace(/(^|\n)(#{1,3}\s+[^\n]+)\n(?!\n)/g, '$1$2\n\n');
  const paragraphs = normalizedInput.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const dict = lang === 'en' ? EN_NESTED_DICT : lang === 'mixed' ? [...ID_NESTED_DICT, ...EN_NESTED_DICT] : ID_NESTED_DICT;

  let blocksCreated = 0;
  const spunParagraphs = paragraphs.map((para, pIdx) => {
    let headingPrefix = '';
    let bodyText = para;
    const headingMatch = para.match(/^(#{1,3}\s+)/);
    if (headingMatch) {
      headingPrefix = headingMatch[1];
      bodyText = para.slice(headingPrefix.length);
    }

    let transformed = bodyText;
    for (const rule of dict) {
      transformed = transformed.replace(rule.pattern, (match, _g1, offset, fullStr) => {
        const before = fullStr.slice(0, offset);
        const openB = (before.match(/\{/g) || []).length;
        const closeB = (before.match(/\}/g) || []).length;
        if (openB > closeB) return match;
        blocksCreated++;
        return rule.replacement;
      });
    }

    if (headingPrefix) {
      if (/\{\{kecamatan\}\}/i.test(transformed)) {
        return `${headingPrefix}${transformed}`;
      }
      blocksCreated += 1;
      return `${headingPrefix}${transformed} {di Kecamatan {{kecamatan}}|Area {{kecamatan}}, {{label_kota_kabupaten}}|Wilayah {{kecamatan}} ({{wilayah}})}`;
    }

    if (/^[-*]\s+|^\d+\.\s+/m.test(bodyText)) {
      return transformed;
    }

    if (lang === 'en') {
      const enOpeners = [
        `{In the growing area of Kecamatan {{kecamatan}} ({{label_kota_kabupaten}}),|For residents and businesses across {{kecamatan}}, {{wilayah}},|When planning your project in Kecamatan {{kecamatan}} ({{kota_kabupaten}}),|Across the commercial and residential zones of {{kecamatan}},|To achieve optimal results in Kecamatan {{kecamatan}}, {{label_kota_kabupaten}},|As demand continues to rise in {{kecamatan}} ({{wilayah}}),|For property owners located in Kecamatan {{kecamatan}},}`,
        `{Furthermore, our local team serving {{kecamatan}} ensures that|In addition, every project handled in {{kecamatan}} ({{label_kota_kabupaten}}) follows|Moreover, clients throughout Kecamatan {{kecamatan}} benefit from the fact that|Specifically within the {{kecamatan}} corridor of {{kota_kabupaten}},|To maintain strict quality standards in {{kecamatan}} ({{wilayah}}),|Consequently, our specialists in {{label_kota_kabupaten}} make sure that|With dedicated coverage across Kecamatan {{kecamatan}},}`
      ];
      const enClosers = `{This approach guarantees {long-term reliability|maximum efficiency|complete peace of mind} for every client in Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}.|Therefore, property owners in {{kecamatan}} ({{wilayah}}) always receive {verifiable quality|transparent pricing|dependable after-sales support}.|Our commitment across {{label_kota_kabupaten}}, especially in {{kecamatan}}, is built on {proven field results|certified workmanship|timely project delivery}.|That is why residents in Kecamatan {{kecamatan}} consistently trust our {structured workflow|dedicated local technicians|comprehensive service warranty}.|Every step executed in {{kecamatan}} ({{kota_kabupaten}}) is designed to {prevent recurring issues|optimize your budget|deliver lasting value}.|By focusing on the specific needs of {{kecamatan}}, we provide {faster response times|accurate technical assessments|superior service standards} in {{wilayah}}.|Ultimately, clients in Kecamatan {{kecamatan}} enjoy {hassle-free execution|guaranteed satisfaction|professional support from start to finish}.}`;
      blocksCreated += 3;
      return `${enOpeners[pIdx % enOpeners.length]} ${transformed} ${enClosers}`;
    }

    const idOpeners = [
      `{Khusus bagi warga serta pelaku usaha di <strong>Kecamatan {{kecamatan}}</strong> ({{label_kota_kabupaten}}),|Dalam memenuhi kebutuhan masyarakat di seputar <strong>Kecamatan {{kecamatan}}</strong>, Provinsi {{wilayah}},|Seiring berkembangnya kawasan {{kecamatan}} sebagai {{konteks_kecamatan}} di {{label_kota_kabupaten}},|Ketika merencanakan kebutuhan di wilayah <strong>Kecamatan {{kecamatan}}</strong> ({{kota_kabupaten}}),|Demi menjamin hasil yang presisi bagi pelanggan di <strong>Kecamatan {{kecamatan}}</strong>,|Bagi pemilik hunian maupun pengelola gedung di koridor {{kecamatan}}, {{label_kota_kabupaten}},|Menjawab tingginya permintaan di area <strong>Kecamatan {{kecamatan}}</strong> ({{wilayah}}),}`,
      `{Lebih lanjut, penerapan standar kerja di kawasan <strong>Kecamatan {{kecamatan}}</strong> ({{label_kota_kabupaten}}) memastikan bahwa|Di samping itu, dukungan tim lokal kami yang menjangkau <strong>Kecamatan {{kecamatan}}</strong> membuktikan bahwa|Tidak hanya itu, setiap tahapan yang dijalankan untuk area {{kecamatan}} di {{kota_kabupaten}} dirancang agar|Secara teknis, karakteristik lingkungan di <strong>Kecamatan {{kecamatan}}</strong> ({{konteks_kecamatan}}) menuntut agar|Untuk menjaga kepuasan pelanggan di seluruh kelurahan <strong>Kecamatan {{kecamatan}}</strong> ({{wilayah}}),|Sebagai mitra resmi di {{label_kota_kabupaten}}, operasional kami di {{kecamatan}} mengutamakan bahwa|Melalui pengawasan mutu berlapis di lokasi Anda di <strong>Kecamatan {{kecamatan}}</strong>,}`
    ];
    const idClosers = `{Pendekatan ini memastikan setiap pelanggan di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} mendapatkan <u>{jaminan mutu tertulis|kepastian jadwal pengerjaan|efisiensi anggaran yang terukur}</u>.|Dengan demikian, kebutuhan Anda di area {{kecamatan}} ({{wilayah}}) dapat {ditangani secara tuntas sejak kunjungan pertama|diselesaikan tepat waktu tanpa biaya tersembunyi|memberikan manfaat jangka panjang yang optimal}.|Komitmen operasional kami di {{label_kota_kabupaten}}, khususnya koridor {{kecamatan}}, selalu bertumpu pada {ketelitian diagnosa lapangan|penggunaan peralatan berstandar tinggi|kemudahan layanan purna jual}.|Itulah alasan mengapa banyak pelanggan rumah tangga maupun komersial di Kecamatan {{kecamatan}} mempercayakan penanganannya kepada {tim spesialis kami|unit teknis {{kota_kabupaten}} kami|layanan resmi kami di {{wilayah}}}.|Seluruh prosedur di Kecamatan {{kecamatan}} tersebut dieksekusi untuk {mencegah risiko kendala berulang|menjaga keamanan fungsi properti Anda|memberikan rasio harga dan kualitas terbaik}.|Kedekatan armada teknis kami dari pusat {{label_kota_kabupaten}} menuju {{kecamatan}} juga menjamin {kecepatan respons survei lokasi|fleksibilitas jadwal pengerjaan|kemudahan klaim garansi kapan pun dibutuhkan}.|Hasil akhirnya, warga di Kecamatan {{kecamatan}} ({{wilayah}}) memperoleh solusi yang <u>{rapi, aman, dan bergaransi resmi|transparan serta teruji kualitasnya|hemat biaya perawatan tahunan}</u>.}`;

    blocksCreated += 4;
    return `${idOpeners[pIdx % idOpeners.length]} ${transformed} ${idClosers}`;
  });

  return {
    detectedLanguage: detection,
    spunArticleBody: spunParagraphs.join('\n\n'),
    blocksCreated
  };
}

function clientCalculateSafeCapacity({ spintaxTemplate = '', projectImageCount = 1, requestedArticleCount = 5 }) {
  let working = String(spintaxTemplate || '').replace(/\{\{[a-zA-Z0-9_]+\}\}/g, 'GEO');
  const innerRegex = /\{([^{}]+)\}/g;
  let totalBlocks = 0;
  let sentenceLevelBlocks = 0;
  let wordLevelBlocks = 0;
  let log10 = 0;
  let guard = 0;

  while (innerRegex.test(working) && guard < 50) {
    guard++;
    working = working.replace(innerRegex, (_, content) => {
      const opts = content.split('|');
      if (opts.length > 1) {
        totalBlocks++;
        log10 += Math.log10(opts.length);
        const avgWords = opts.reduce((a, o) => a + o.trim().split(/\s+/).length, 0) / opts.length;
        if (avgWords >= 5) sentenceLevelBlocks++;
        else wordLevelBlocks++;
      }
      return 'X';
    });
  }

  let formattedMaxCombinations = '1';
  if (log10 > 0 && log10 < 12) {
    formattedMaxCombinations = Math.round(Math.pow(10, log10)).toLocaleString('id-ID');
  } else if (log10 >= 12) {
    const exp = Math.floor(log10);
    const mant = Math.pow(10, log10 - exp).toFixed(1);
    formattedMaxCombinations = `${mant} × 10^${exp} variasi`;
  }

  const clampedImages = Math.max(1, Math.min(99, Number(projectImageCount) || 1));
  const baseSafe = Math.max(1, Math.round(sentenceLevelBlocks * 7 + wordLevelBlocks * 1.8));
  const imgBonus = Math.min(40, Math.round(clampedImages * 0.6));
  const recommendedSafeMaxArticles = Math.min(250, Math.max(3, baseSafe + imgBonus));
  const optimalSweetSpot = Math.max(3, Math.min(recommendedSafeMaxArticles, Math.round(recommendedSafeMaxArticles * 0.65)));

  let status = 'AMAN_BEBAS_SAMPAH';
  let statusBadge = 'AMAN (Bebas Artikel Sampah & Lolos Copyscape)';
  let advice = `Kombinasi ${sentenceLevelBlocks} blok struktur kalimat, ${wordLevelBlocks} blok sinonim kata, dan ${clampedImages} gambar referensi sanggup men-generate hingga ${recommendedSafeMaxArticles} artikel unik (Rekomendasi Ideal: ${optimalSweetSpot} artikel) tanpa terdeteksi sebagai artikel sampah.`;

  if (totalBlocks < 5) {
    status = 'RISIKO_TINGGI_SAMPAH';
    statusBadge = 'PERINGATAN: Variasi Spintax Terlalu Sedikit (Risiko Artikel Sampah)';
    advice = `Hanya ada ${totalBlocks} blok spintax. Klik "Auto-Spin Artikel Utama" agar sistem membuat struktur spintax berlapis sebelum men-generate banyak daerah.`;
  } else if (requestedArticleCount > recommendedSafeMaxArticles) {
    status = 'MELEBIHI_BATAS_AMAN';
    statusBadge = `PERINGATAN: Target (${requestedArticleCount}) Melebihi Rekomendasi Aman (${recommendedSafeMaxArticles})`;
    advice = `Memaksa generate ${requestedArticleCount} artikel dari kerangka ini berisiko memicu duplikasi >14% (artikel sampah). Batasi maksimal ${recommendedSafeMaxArticles} artikel (ideal: ${optimalSweetSpot} artikel) atau tambah gambar referensi (hingga 99 gambar) & paragraf baru.`;
  }

  return {
    totalBlocks,
    sentenceLevelBlocks,
    wordLevelBlocks,
    projectImageCount: clampedImages,
    formattedMaxCombinations,
    recommendedSafeMaxArticles,
    optimalSweetSpot,
    requestedArticleCount,
    status,
    statusBadge,
    advice
  };
}

function simpleHashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function nextInt(max) {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) % Math.max(1, max);
  };
}

function clientBuildWhatsAppUrl(phoneRaw, messageText) {
  const digits = String(phoneRaw || '6281234567890').replace(/[^0-9]/g, '');
  const normalizedPhone = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`;
  const encodedMsg = encodeURIComponent(String(messageText || '').trim());
  return `https://wa.me/${normalizedPhone}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
}

function buildClientTopicSpin(topic) {
  const words = String(topic || 'Layanan Profesional').trim().split(/\s+/);
  if (words.length <= 2) {
    return `{layanan ${topic}|jasa ${topic}|penanganan ${topic}|solusi ${topic}|spesialis ${topic}|instalasi & servis ${topic}|unit kerja ${topic}}`;
  }
  const head = words.slice(0, 2).join(' ');
  const tail = words.slice(2).join(' ');
  return `{${topic}|layanan ${head} untuk ${tail}|spesialis ${tail} (${head})|solusi ${head} serta ${tail}|pengerjaan ${tail} oleh tim ${head}|jasa profesional ${tail} – ${head}|penanganan ${head} khusus ${tail}}`;
}

function clientBuildMasterSpintax(options = {}) {
  const cleanTopic = (options.topic || 'Jasa Instalasi Panel Surya & Audit Energi').trim();
  const cleanCta = (options.callToAction || 'Hubungi konsultan teknis kami untuk jadwal survei gratis').trim();
  const whatsappLabel = (options.whatsappLabel || 'Chat WhatsApp Konsultan Sekarang').trim();
  const anchorText = (options.anchorText || 'halaman layanan resmi kami').trim();
  const linkRel = options.linkRel || 'dofollow';
  const imagePosition = options.imagePosition || 'top';
  const whatsappPosition = options.whatsappPosition || 'top_bottom';
  const linkPosition = options.linkPosition || 'middle';
  const phoneLinkNumber = String(options.phoneLinkNumber || '').trim();
  const phoneLinkAnchor = String(options.phoneLinkAnchor || '').trim();
  const emailLinkAddress = String(options.emailLinkAddress || '').trim();
  const emailLinkAnchor = String(options.emailLinkAnchor || '').trim();

  const enableBoldKeywords = options.enableBoldKeywords !== false;
  const enableUnderlineBenefits = options.enableUnderlineBenefits !== false;
  const enableImageBlock = options.enableImageBlock !== false;
  const enableHyperlink = options.enableHyperlink !== false;
  const enableWhatsappCta = options.enableWhatsappCta !== false;
  const enableFaqSchema = options.enableFaqSchema !== false;
  const autoTemplateEnabled = options.autoTemplateEnabled !== false;

  const topicSpin = buildClientTopicSpin(cleanTopic);
  const boldTopicSpin = enableBoldKeywords ? `<strong>${topicSpin}</strong>` : topicSpin;
  const boldKecamatan = enableBoldKeywords
    ? `<strong>Kecamatan {{kecamatan}}</strong>`
    : `Kecamatan {{kecamatan}}`;

  const uBenefit1 = enableUnderlineBenefits
    ? `<u>{bergaransi resmi tertulis|transparan tanpa biaya tersembunyi|dikerjakan teknisi bersertifikat|mengikuti standar mutu nasional|didukung layanan purna jual cepat|memiliki kepastian jadwal kerja|menggunakan material orisinal}</u>`
    : `{bergaransi resmi tertulis|transparan tanpa biaya tersembunyi|dikerjakan teknisi bersertifikat|mengikuti standar mutu nasional|didukung layanan purna jual cepat|memiliki kepastian jadwal kerja|menggunakan material orisinal}`;

  const ctaSpin = `{${cleanCta}|Silakan kontak konsultan lapangan kami guna mengatur jadwal pengecekan lokasi|Segera diskusikan rencana anggaran Anda bersama tim teknis resmi kami|Kirimkan detail kebutuhan lokasi Anda agar teknisi kami menyiapkan estimasi akurat|Konsultasikan spesifikasi proyek Anda hari ini tanpa biaya komitmen awal}`;

  const relAttr = linkRel === 'nofollow' ? ' rel="nofollow noopener"' : ' rel="noopener"';
  const linkItems = [];
  if (enableHyperlink && String(options.targetUrl || 'https://nusantaraseo.id').trim()) {
    const parsedTarget = normalizeSmartHref(options.targetUrl || 'https://nusantaraseo.id');
    const targetAttr = parsedTarget.isWeb ? ` target="_blank"${relAttr}` : '';
    const hrefVal = parsedTarget.isWeb ? '{{target_url}}' : parsedTarget.href;
    linkItems.push(`<a href="${hrefVal}"${targetAttr}>{${anchorText}|portal informasi layanan {{kota_kabupaten}}|pusat informasi resmi kami}</a>`);
  }
  if (phoneLinkNumber) {
    const ph = normalizeSmartHref(phoneLinkNumber);
    linkItems.push(`<a href="${ph.href}" class="contact-tel-link">&#128222; <strong>${phoneLinkAnchor || 'Telepon Resmi (' + ph.display + ')'}</strong></a>`);
  }
  if (emailLinkAddress) {
    const em = normalizeSmartHref(emailLinkAddress);
    linkItems.push(`<a href="${em.href}" class="contact-email-link">&#9993; <strong>${emailLinkAnchor || 'Email Resmi (' + em.display + ')'}</strong></a>`);
  }
  const hyperlinkBlock = linkItems.length > 0
    ? `## {Informasi Resmi & Kontak Layanan|Saluran Konsultasi & Referensi Resmi|Kontak & Tautan Resmi Layanan} di {{label_kota_kabupaten}}\n\n{Untuk informasi lengkap, konsultasi teknis, maupun penjadwalan layanan di Kecamatan {{kecamatan}}, silakan hubungi atau kunjungi saluran resmi kami:|Akses informasi spesifikasi serta kontak resmi layanan pelanggan kami untuk area {{kecamatan}} ({{label_kota_kabupaten}}) melalui:} ${linkItems.join(' | ')}.`
    : '';

  const h1Title = `# {Panduan Lengkap|Rekomendasi Terbaik|Layanan Spesialis|Pusat Layanan Terpercaya|Solusi Profesional|Mitra Resmi|Tim Ahli} ${topicSpin} {di Kecamatan {{kecamatan}} ({{label_kota_kabupaten}})|Area {{kecamatan}} – {{kota_kabupaten}}, {{wilayah}}|Wilayah {{kecamatan}} & Sekitarnya|Khusus Kecamatan {{kecamatan}}, {{wilayah}}|Terdekat di {{kecamatan}}, {{jenis_daerah}} {{kota_kabupaten}}}`;

  let coreBodySpintax = '';
  if (options.useRawMainArticle && options.rawMainArticle && stripSectionMarkers(options.rawMainArticle).length > 15) {
    const spunRaw = clientAutoSpinRawArticle(options.rawMainArticle, cleanTopic);
    coreBodySpintax = stripSectionMarkers(spunRaw.spunArticleBody);
  } else {
    const paragraph1 = `{Mencari {rekanan|mitra|penyedia|tim teknis} {terpercaya|berpengalaman|profesional|bersertifikat} dalam hal ${boldTopicSpin} di ${boldKecamatan} {kini jauh lebih praktis berkat sistem kerja terukur|membutuhkan ketelitian agar hasil akhirnya optimal|merupakan langkah penting demi kenyamanan properti Anda}.|Permintaan masyarakat terhadap ${boldTopicSpin} yang ${uBenefit1} terus tumbuh pesat di seputar ${boldKecamatan}, Provinsi {{wilayah}}.|Bagi {pemilik hunian maupun pelaku usaha|warga serta pengelola gedung} yang beraktivitas di ${boldKecamatan} ({{label_kota_kabupaten}}), menentukan pelaksana ${boldTopicSpin} memerlukan pertimbangan objektif.} {Mengingat pesatnya perkembangan {{label_kota_kabupaten}}, setiap titik pengerjaan di {{kecamatan}} {wajib dievaluasi langsung sebelum eksekusi|memerlukan penyesuaian teknis sesuai kondisi bangunan}.|Kondisi spesifik {{kecamatan}} sebagai {{konteks_kecamatan}} menuntut {kesiapan peralatan lengkap sejak kunjungan pertama|dukungan personel yang memahami medan {{kota_kabupaten}}}.}`;

    const paragraph2 = `## {Keunggulan Utama|Nilai Tambah Layanan|Mengapa Warga {{kecamatan}} Memilih|Standar Mutu Pengerjaan} di {{kecamatan}}, {{kota_kabupaten}}\n\n{Dalam menyeleksi pelaksana ${boldTopicSpin} untuk area {{kecamatan}}, {kejujuran rincian anggaran|kecepatan tanggap darurat|kelengkapan dokumen garansi} merupakan tolok ukur utama.|Kami menghadirkan metode kerja terstruktur bagi klien di ${boldKecamatan} supaya {aktivitas harian Anda tetap berjalan tenang|setiap rupiah yang diinvestasikan menghasilkan kualitas terbaik}.}\n\n### {1. Jaminan Mutu & Spesifikasi Terukur|1. Transparansi Rincian Biaya Sejak Awal|1. Dukungan Teknisi Berpengalaman di {{kota_kabupaten}}}\n\n{Setiap pengerjaan di ${boldKecamatan} selalu didahului dengan {pengukuran parameter lapangan yang objektif|pengecekan kondisi aktual secara cermat} serta ${uBenefit1} sehingga hasil akhirnya benar-benar presisi.|Pelanggan di {{label_kota_kabupaten}} memperoleh keuntungan berupa layanan yang ${uBenefit1} untuk seluruh cakupan wilayah Kecamatan {{kecamatan}}.}`;

    const paragraph3 = `## {Alur Operasional|Tahapan Pelaksanaan|Prosedur Standar|Langkah Penanganan} di Kecamatan {{kecamatan}}\n\n- **{Pemetaan & Diagnosa Awal|Inspeksi Teknis Lokasi|Survei & Identifikasi Kebutuhan}:** {Tim mempelajari kondisi titik lokasi di {{kecamatan}} guna merumuskan langkah paling efektif.|Data teknis dikumpulkan langsung di lapangan agar solusi ${topicSpin} benar-benar presisi.}\n- **{Penyusunan Rincian Anggaran|Rencana Kerja & Estimasi Resmi|Proposal Biaya Transparan}:** {Klien di {{kecamatan}} memperoleh rincian item kerja secara jelas sebelum proses dimulai.|Setiap tahapan dan material dijabarkan transparan sehingga anggaran terkendali.}\n- **{Implementasi oleh Tim Ahli|Eksekusi Standar Industri|Pengerjaan Lapangan Presisi}:** {Pekerjaan ${topicSpin} dijalankan secara disiplin mengikuti protokol keamanan kerja.|Personel berpengalaman memastikan setiap bagian berfungsi optimal di lokasi {{kecamatan}}.}`;

    coreBodySpintax = [paragraph1, paragraph2, paragraph3].join('\n\n');
  }

  if (!autoTemplateEnabled) {
    return stripSectionMarkers(coreBodySpintax);
  }

  const faqSection = enableFaqSchema
    ? `## {Tanya Jawab (FAQ)|Pertanyaan Umum Pelanggan|Informasi Penting} Seputar Layanan di Kecamatan {{kecamatan}}\n\n### {Apakah melayani survei langsung ke seluruh kelurahan di Kecamatan {{kecamatan}}?|Bagaimana prosedur pemesanan jadwal kunjungan ke area {{kecamatan}}?|Berapa cepat tim teknis dapat menjangkau lokasi di {{kecamatan}}, {{kota_kabupaten}}?}\n\n{Ya, tim operasional kami di {{label_kota_kabupaten}} menjangkau seluruh area Kecamatan {{kecamatan}} dengan penjadwalan fleksibel.|Tentu, petugas lapangan kami siap mengunjungi titik lokasi Anda di {{kecamatan}} setelah koordinasi waktu melalui WhatsApp.}`
    : '';

  const waTopHtml = enableWhatsappCta
    ? `<div class="wa-cta-box wa-cta-top"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel}|Konsultasi Cepat via WhatsApp ({{kecamatan}})|Hubungi WhatsApp Resmi Area {{kecamatan}}} ({{wa_number}})</a></div>`
    : '';
  const waMidHtml = enableWhatsappCta
    ? `<div class="wa-cta-box wa-cta-middle"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel}|Tanya Estimasi Biaya Area {{kecamatan}}|Chat Tim Teknis {{kota_kabupaten}}} ({{wa_number}})</a></div>`
    : '';
  const waBotHtml = enableWhatsappCta
    ? `<div class="wa-cta-box wa-cta-bottom"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel}|Klik untuk Chat WhatsApp Area {{kecamatan}}|Jadwalkan Survei via WhatsApp Sekarang} ({{wa_number}})</a></div>`
    : '';

  const showWaTop = whatsappPosition === 'top' || whatsappPosition === 'top_bottom' || whatsappPosition === 'all';
  const showWaMid = whatsappPosition === 'middle' || whatsappPosition === 'all';
  const showWaBot = whatsappPosition === 'bottom' || whatsappPosition === 'top_bottom' || whatsappPosition === 'all';

  const imgTop = enableImageBlock && imagePosition === 'top' ? '{{PROJECT_IMAGES_BLOCK}}'
    : enableImageBlock && imagePosition === 'top_bottom' ? '{{PROJECT_IMAGES_BLOCK_TOP}}' : '';
  const imgMid = enableImageBlock && imagePosition === 'middle' ? '{{PROJECT_IMAGES_BLOCK}}' : '';
  const imgBot = enableImageBlock && imagePosition === 'bottom' ? '{{PROJECT_IMAGES_BLOCK}}'
    : enableImageBlock && imagePosition === 'top_bottom' ? '{{PROJECT_IMAGES_BLOCK_BOTTOM}}' : '';

  const lnkTop = linkPosition === 'top' ? hyperlinkBlock : '';
  const lnkMid = (linkPosition === 'middle' || linkPosition === 'middle_bottom') ? hyperlinkBlock : '';
  const lnkBot = (linkPosition === 'bottom' || linkPosition === 'middle_bottom') ? hyperlinkBlock : '';

  const hasOwnH1 = /^#\s+/m.test(coreBodySpintax);
  const hasOwnFaq = /^#{2,3}\s+.*(faq|tanya jawab|pertanyaan)/im.test(coreBodySpintax);

  let firstHeader = h1Title;
  let bodyContent = coreBodySpintax;
  if (hasOwnH1) {
    const lines = coreBodySpintax.split('\n');
    firstHeader = lines[0];
    bodyContent = lines.slice(1).join('\n').trim();
  }

  const [firstHalf, secondHalf] = splitBodyAtMidpointClient(bodyContent);
  const closingSection = `## {Jadwalkan Survei di {{kecamatan}}|Hubungi Spesialis Area {{kecamatan}}|Konsultasi Kebutuhan Anda}\n\n{Jangan tunda kebutuhan ${boldTopicSpin} di lokasi Anda. ${ctaSpin} untuk seluruh area ${boldKecamatan}, {{label_kota_kabupaten}} ({{wilayah}}).|Siap memperoleh penanganan ${boldTopicSpin} yang rapi, transparan, dan bergaransi di {{kecamatan}}? ${ctaSpin} — tim {{kota_kabupaten}} kami siap melayani.}${showWaBot && waBotHtml ? '\n\n' + waBotHtml : ''}`;

  return [
    firstHeader,
    showWaTop ? waTopHtml : '',
    imgTop,
    lnkTop,
    firstHalf,
    imgMid,
    lnkMid,
    showWaMid ? waMidHtml : '',
    secondHalf,
    imgBot,
    lnkBot,
    hasOwnFaq ? '' : faqSection,
    hasOwnH1 ? (showWaBot ? waBotHtml : '') : closingSection
  ]
    .filter(Boolean)
    .join('\n\n');
}

function clientRenderProjectImagesForArticle({
  projectImages = [],
  imagesPerArticle = 2,
  articleIndex = 0,
  topic = 'Layanan Profesional',
  imageTitlePattern = '{{topik}} — Dokumentasi #{{nomor_gambar}} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
  imageAltPattern = 'Dokumentasi {{topik}} #{{nomor_gambar}} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
  target
}) {
  const pool = Array.isArray(projectImages) && projectImages.length > 0
    ? projectImages.slice(0, MAX_IMAGES_PER_PROJECT)
    : [];

  if (pool.length === 0) {
    return { figuresHtml: '', topFiguresHtml: '', bottomFiguresHtml: '', metaList: [] };
  }

  const count = Math.max(1, Math.min(pool.length, Number(imagesPerArticle) || 1));
  const figures = [];
  const metaList = [];

  for (let k = 0; k < count; k++) {
    const poolIdx = (articleIndex * count + k) % pool.length;
    const url = pool[poolIdx];
    const slotNum = poolIdx + 1;

    const spunTitle = clientResolveSpintax(
      imageTitlePattern.replace(/\{\{\s*nomor_gambar\s*\}\}/gi, String(slotNum)),
      `${topic}::title::${articleIndex}`,
      k
    );
    const spunAlt = clientResolveSpintax(
      imageAltPattern.replace(/\{\{\s*nomor_gambar\s*\}\}/gi, String(slotNum)),
      `${topic}::alt::${articleIndex}`,
      k
    );

    const finalTitle = clientInjectGeo(spunTitle, target, { topic });
    const finalAlt = clientInjectGeo(spunAlt, target, { topic });

    metaList.push({ slotIndex: slotNum, url, title: finalTitle, alt: finalAlt });
    figures.push(
      `<figure class="seo-article-figure"><img src="${url}" title="${finalTitle.replace(/"/g, '&quot;')}" alt="${finalAlt.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" /><figcaption><strong>Gambar #${slotNum}:</strong> ${finalTitle}</figcaption></figure>`
    );
  }

  return {
    figuresHtml: `<div class="article-images-grid">${figures.join('\n')}</div>`,
    metaList
  };
}

function clientResolveSpintax(template, seedStr, regionOffset) {
  const geoTokens = [];
  let working = String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, k) => {
    const idx = geoTokens.length;
    geoTokens.push(k);
    return `__GEO_${idx}__`;
  });

  const nextInt = simpleHashSeed(seedStr);
  const innerRegex = /\{([^{}]+)\}/g;
  let guard = 0;
  let blockCounter = 0;

  while (innerRegex.test(working) && guard < 60) {
    guard++;
    working = working.replace(innerRegex, (_, content) => {
      const opts = content.split('|');
      if (opts.length <= 1) return content;
      blockCounter++;
      const baseIndex = nextInt(opts.length);
      const idx = (baseIndex + regionOffset + blockCounter) % opts.length;
      return opts[idx].trim();
    });
  }

  return working.replace(/__GEO_(\d+)__/g, (_, i) => `{{${geoTokens[Number(i)]}}}`);
}

function clientInjectGeo(text, target, extraVars = {}) {
  const topic = extraVars.topic || 'Layanan Profesional';
  const defaultGreeting = `Halo Admin, saya tertarik dengan {{topik}} untuk area Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}}). Mohon info estimasi & jadwal surveinya ya.`;
  const rawGreeting = String(extraVars.whatsappGreeting || defaultGreeting);
  const waMsg = rawGreeting
    .replace(/\{\{\s*topik\s*\}\}/gi, topic)
    .replace(/\{\{\s*kecamatan\s*\}\}/gi, target.kecamatan)
    .replace(/\{\{\s*label_kota_kabupaten\s*\}\}/gi, target.labelKotaKabupaten)
    .replace(/\{\{\s*kota_kabupaten\s*\}\}/gi, target.kotaKabupaten)
    .replace(/\{\{\s*wilayah\s*\}\}/gi, target.wilayah);
  const waUrl = clientBuildWhatsAppUrl(extraVars.whatsappNumber || '6281234567890', waMsg);

  const map = {
    wilayah: target.wilayah,
    jenis_daerah: target.jenisDaerah,
    kota_kabupaten: target.kotaKabupaten,
    label_kota_kabupaten: target.labelKotaKabupaten,
    kecamatan: target.kecamatan,
    konteks_wilayah: target.konteksWilayah,
    konteks_daerah: target.konteksDaerah,
    konteks_kecamatan: target.konteksKecamatan,
    topik: topic,
    cta: extraVars.callToAction || 'Hubungi konsultan teknis kami sekarang',
    wa_number: extraVars.whatsappNumber || '6281234567890',
    wa_url: waUrl,
    target_url: normalizeSmartHref(extraVars.targetUrl || 'https://nusantaraseo.id/layanan-resmi').href,
    tel_url: normalizeSmartHref(extraVars.phoneLinkNumber || extraVars.whatsappNumber || '6281234567890').href,
    phone_display: extraVars.phoneLinkNumber || extraVars.whatsappNumber || '0812-3456-7890',
    mailto_url: normalizeSmartHref(extraVars.emailLinkAddress || 'info@wevo.biz.id').href,
    email_display: extraVars.emailLinkAddress || 'info@wevo.biz.id',
    image_url: extraVars.imageUrl || ''
  };
  return String(text || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, k) => {
    const key = k.toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : full;
  });
}

function clientConvertArticleToHtml(rawContent, seoMeta = {}) {
  const blocks = stripSectionMarkers(rawContent)
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const htmlParts = blocks.map((block) => {
    if (block.startsWith('### ')) {
      return `<h3>${block.slice(4).trim()}</h3>`;
    }
    if (block.startsWith('## ')) {
      return `<h2>${block.slice(3).trim()}</h2>`;
    }
    if (block.startsWith('# ')) {
      return `<h1>${block.slice(2).trim()}</h1>`;
    }
    if (block.startsWith('<figure') || block.startsWith('<div')) {
      return block;
    }
    const lines = block.split('\n');
    if (lines.every((l) => l.trim().startsWith('- '))) {
      const items = lines
        .map((l) => {
          const itemText = l
            .trim()
            .slice(2)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          return `  <li>${itemText}</li>`;
        })
        .join('\n');
      return `<ul>\n${items}\n</ul>`;
    }
    const formatted = block.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<p>${formatted}</p>`;
  });

  if (seoMeta && seoMeta.jsonLdString) {
    htmlParts.push(`<script type="application/ld+json">\n${seoMeta.jsonLdString}\n</script>`);
  }

  return htmlParts.join('\n\n');
}

function clientSliceAtWordBoundary(text, maxLen) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.5) ? cut.slice(0, lastSpace) : cut).trim();
}

function clientBuildSeoMeta({ title, topic, target, whatsappNumber, targetUrl, imageUrl }) {
  const cleanTitle = String(title || `${topic} di Kecamatan ${target.kecamatan}`)
    .replace(/<[^>]+>/g, '')
    .trim();

  const metaTitle =
    cleanTitle.length <= 60
      ? cleanTitle
      : clientSliceAtWordBoundary(`${topic} Kec. ${target.kecamatan}, ${target.labelKotaKabupaten}`, 60);

  const metaDescription = clientSliceAtWordBoundary(
    `Layanan ${topic} terpercaya di Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten} (${target.wilayah}). Bergaransi resmi, transparan & survei lokasi cepat.`,
    158
  );

  const slug = `${topic}-kecamatan-${target.kecamatan}-${target.kotaKabupaten}-${target.wilayah}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const jsonLdObj = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: `${topic} - Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten}`,
        description: metaDescription,
        areaServed: {
          '@type': 'AdministrativeArea',
          name: `Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten}, ${target.wilayah}`
        },
        provider: {
          '@type': 'LocalBusiness',
          name: `Spesialis ${topic} ${target.labelKotaKabupaten}`,
          telephone: whatsappNumber || '+6281234567890',
          url: targetUrl || 'https://nusantaraseo.id',
          image: imageUrl || undefined
        }
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Apakah melayani ${topic} di seluruh Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Ya, tim teknis kami melayani seluruh kelurahan di Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten} (${target.wilayah}) dengan jadwal survei fleksibel.`
            }
          }
        ]
      }
    ]
  };

  return {
    slug,
    metaTitle,
    metaDescription,
    jsonLdString: JSON.stringify(jsonLdObj, null, 2)
  };
}

function clientCountPermutations(template) {
  let working = String(template || '').replace(/\{\{[a-zA-Z0-9_]+\}\}/g, 'GEO');
  const innerRegex = /\{([^{}]+)\}/g;
  let totalBlocks = 0;
  let log10 = 0;
  let guard = 0;
  while (innerRegex.test(working) && guard < 40) {
    guard++;
    working = working.replace(innerRegex, (_, content) => {
      const opts = content.split('|');
      if (opts.length > 1) {
        totalBlocks++;
        log10 += Math.log10(opts.length);
      }
      return 'X';
    });
  }
  let formatted = '1';
  if (log10 > 0 && log10 < 12) {
    formatted = Math.round(Math.pow(10, log10)).toLocaleString('id-ID');
  } else if (log10 >= 12) {
    const exp = Math.floor(log10);
    const mant = Math.pow(10, log10 - exp).toFixed(1);
    formatted = `${mant} × 10^${exp} variasi`;
  }
  return { totalBlocks, formatted };
}

function clientTokenize(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&bull;|&rarr;|&larr;|&#[0-9]+;/gi, ' ')
    .toLowerCase()
    .replace(/[#*_`~>\-\[\]().,!?:;"'/\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function clientShingles(words, k = 4) {
  const s = new Set();
  for (let i = 0; i <= words.length - k; i++) {
    s.add(words.slice(i, i + k).join(' '));
  }
  return s;
}

function clientCompareArticles(a, b) {
  const wA = clientTokenize(a);
  const wB = clientTokenize(b);
  const s4A = clientShingles(wA, 4);
  const s4B = clientShingles(wB, 4);
  const s5A = clientShingles(wA, 5);
  const s5B = clientShingles(wB, 5);

  let shared4 = 0;
  const sharedPhrases = [];
  for (const x of s4A) {
    if (s4B.has(x)) {
      shared4++;
      if (sharedPhrases.length < 5) sharedPhrases.push(x);
    }
  }
  let shared5 = 0;
  for (const x of s5A) {
    if (s5B.has(x)) shared5++;
  }

  const denom4 = Math.max(1, Math.min(s4A.size, s4B.size));
  const denom5 = Math.max(1, Math.min(s5A.size, s5B.size));
  const overlap4 = Number(((shared4 / denom4) * 100).toFixed(2));
  const overlap5 = Number(((shared5 / denom5) * 100).toFixed(2));
  const uniquePct = Number(Math.max(0, 100 - overlap4).toFixed(2));

  return {
    wordCount: wA.length,
    overlap4,
    overlap5,
    uniquePct,
    sharedPhrases,
    passed: overlap4 <= 14.0
  };
}

function initWorkspaceLayoutControls({
  layoutSelector = '.studio-layout',
  resizerId = 'sidebarResizer',
  toggleBtnId = 'btnToggleSidebar',
  widthSliderId = 'rangeSidebarWidth',
  storageKey = 'localspin_sidebar_width'
} = {}) {
  const layout = document.querySelector(layoutSelector);
  if (!layout) return;

  const savedWidth = Number(localStorage.getItem(storageKey));
  if (savedWidth >= 280 && savedWidth <= 680) {
    layout.style.setProperty('--sidebar-width', `${savedWidth}px`);
  }

  const resizer = document.getElementById(resizerId);
  const toggleBtn = document.getElementById(toggleBtnId);
  const widthSlider = document.getElementById(widthSliderId);

  if (widthSlider && savedWidth >= 280 && savedWidth <= 680) {
    widthSlider.value = String(savedWidth);
  }

  if (widthSlider) {
    widthSlider.addEventListener('input', () => {
      const w = Math.max(280, Math.min(680, Number(widthSlider.value) || 430));
      layout.classList.remove('sidebar-collapsed');
      layout.style.setProperty('--sidebar-width', `${w}px`);
      localStorage.setItem(storageKey, String(w));
      if (toggleBtn) toggleBtn.innerHTML = '&#9703; Minimize Sidebar';
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const collapsed = layout.classList.toggle('sidebar-collapsed');
      toggleBtn.innerHTML = collapsed ? '&#9704; Buka Sidebar' : '&#9703; Minimize Sidebar';
    });
  }

  if (resizer) {
    let isDragging = false;
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      resizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = layout.getBoundingClientRect();
      const newWidth = Math.max(280, Math.min(680, Math.round(e.clientX - rect.left)));
      layout.classList.remove('sidebar-collapsed');
      layout.style.setProperty('--sidebar-width', `${newWidth}px`);
      if (widthSlider) widthSlider.value = String(newWidth);
      localStorage.setItem(storageKey, String(newWidth));
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove('is-dragging');
      document.body.style.cursor = '';
    });
  }
}

function clientCopyText(text) {
  const str = String(text || '');
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(str).catch(() => fallbackCopyText(str));
  }
  return Promise.resolve(fallbackCopyText(str));
}

function fallbackCopyText(str) {
  const ta = document.createElement('textarea');
  ta.value = str;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed; left:-9999px; top:0; opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

function clientDownloadFile(filename, content, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

function initQuickGuideAndScrollTop() {
  if (!document.getElementById('btnScrollTopGlobal')) {
    const upBtn = document.createElement('button');
    upBtn.id = 'btnScrollTopGlobal';
    upBtn.type = 'button';
    upBtn.className = 'btn-scroll-top';
    upBtn.innerHTML = '&#8593; Ke Atas';
    upBtn.title = 'Kembali ke bagian atas halaman';
    upBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.studio-main-pane, .studio-layout > aside.card, .leads-table-wrap').forEach((el) => {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    document.body.appendChild(upBtn);
  }

  let guideModal = document.getElementById('modalGlobalGuide');
  if (!guideModal) {
    guideModal = document.createElement('div');
    guideModal.id = 'modalGlobalGuide';
    guideModal.className = 'editor-modal-backdrop';
    guideModal.setAttribute('role', 'dialog');
    guideModal.setAttribute('aria-modal', 'true');
    guideModal.innerHTML = `
      <div class="editor-modal-dialog" style="max-width:780px;">
        <div class="editor-modal-header">
          <h3 style="margin:0; font-size:1.15rem;">&#128214; Panduan Cepat Penggunaan LocalSpin AI SaaS</h3>
          <button type="button" id="btnCloseGlobalGuide" class="btn btn-secondary btn-sm">&times; Tutup</button>
        </div>
        <div class="editor-modal-body">
          <div class="guide-step-box">
            <strong>1. Studio Artikel Spintax AI &amp; 99 Gambar (<a href="dashboard.html">dashboard.html</a>)</strong>
            <p style="margin:4px 0 0; font-size:0.9rem;">
              Pilih <strong>Project</strong> (tiap project menyimpan hingga <strong>99 gambar</strong>), pilih <strong>Wilayah &rarr; Kota/Kabupaten &rarr; Kecamatan</strong>, tulis artikel biasa di <strong>Kolom Artikel Utama</strong> lalu klik <strong>Auto-Spin</strong> (atau klik <strong>Pop-Up Editor Lebar</strong>). Sistem otomatis memasang <strong>Header H1, Gambar, URL, FAQ Schema &amp; Tombol WhatsApp (Atas &amp; Bawah)</strong>. Hasilnya tampil ringkas (<em>mode minimize</em>) dengan checkbox, nomor <code>#1..#N</code>, serta tombol <strong>All Download HTML</strong> &amp; <strong>WordPress XML</strong>.
            </p>
          </div>
          <div class="guide-step-box">
            <strong>2. Lead Finder Google Maps (<a href="leads.html">leads.html</a>)</strong>
            <p style="margin:4px 0 0; font-size:0.9rem;">
              Cari usaha berdasarkan kata kunci &amp; kota (contoh: <em>Coffee Shop di Depok</em> atau klik <strong>Demo Coffee Shop Jepang</strong>). Saring berdasarkan <strong>Nomor Telepon, Email, Jam Buka, Rating</strong>, lalu centang usaha yang diinginkan dan klik <strong>Kirim ke Spintax Email</strong>.
            </p>
          </div>
          <div class="guide-step-box" style="margin-bottom:0;">
            <strong>3. Spintax Email Penawaran &amp; Jadwal Acak 3–5 Menit (<a href="email-outreach.html">email-outreach.html</a>)</strong>
            <p style="margin:4px 0 0; font-size:0.9rem;">
              Tambahkan beberapa alamat &amp; jenis email pengirim untuk rotasi, masukkan <strong>Link Website</strong> &amp; <strong>Gambar Produk</strong>, lalu pilih <strong>Jadwal Acak (3–5 menit, anti-blast)</strong> atau <strong>Mode Blast Email</strong>.
            </p>
          </div>
        </div>
        <div class="editor-modal-footer">
          <span class="form-hint" style="margin:0;">Tips: Anda bisa mengatur lebar sidebar dengan menggeser slider atau menyeret garis pemisah.</span>
          <button type="button" id="btnOkGlobalGuide" class="btn btn-primary btn-sm">Mengerti, Tutup Panduan</button>
        </div>
      </div>
    `;
    document.body.appendChild(guideModal);

    const closeGuide = () => guideModal.classList.remove('is-open');
    document.getElementById('btnCloseGlobalGuide').addEventListener('click', closeGuide);
    document.getElementById('btnOkGlobalGuide').addEventListener('click', closeGuide);
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) closeGuide();
    });
  }

  document.querySelectorAll('.btn-open-guide').forEach((btn) => {
    btn.addEventListener('click', () => guideModal.classList.add('is-open'));
  });
}

function clientGenerateSitemapXml({ siteUrl = 'https://www.domainanda.com/', slugs = [] } = {}) {
  const base = String(siteUrl || 'https://www.domainanda.com/').replace(/\/+$/, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const urls = [
    `  <url>\n    <loc>${esc(base)}/</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
  ];
  for (const s of Array.isArray(slugs) ? slugs : []) {
    const clean = String(s || '').replace(/^\/+/, '').trim();
    if (!clean) continue;
    urls.push(
      `  <url>\n    <loc>${esc(`${base}/${clean}`)}</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

function renderColorizedSpintaxHtml(rawCode) {
  let html = String(rawCode || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. WhatsApp blocks & variables (Green)
  html = html.replace(
    /(&lt;div class="wa-cta-box[^"]*"&gt;[\s\S]*?&lt;\/div&gt;|\{\{wa_url\}\}|\{\{wa_number\}\})/g,
    '<span class="hl-wa">$1</span>'
  );

  // 2. Image blocks & variables (Purple)
  html = html.replace(
    /(&lt;figure class="seo-article-figure"&gt;[\s\S]*?&lt;\/figure&gt;|\{\{PROJECT_IMAGES_BLOCK\}\}|\{\{image_url\}\})/g,
    '<span class="hl-img">$1</span>'
  );

  // 3. Hyperlinks & URLs (Sky Blue)
  html = html.replace(
    /(&lt;a\b[^&]*(?:(?!&lt;\/a&gt;)[\s\S])*?&lt;\/a&gt;|\{\{target_url\}\})/g,
    (m) => (m.includes('wa-cta-button') ? m : `<span class="hl-link">${m}</span>`)
  );

  // 4. Geo & Topic variables (Teal)
  html = html.replace(
    /(\{\{(?:kecamatan|label_kota_kabupaten|kota_kabupaten|wilayah|jenis_daerah|konteks_kecamatan|konteks_daerah|konteks_wilayah|topik|cta|nama_usaha|email_tujuan|kota_daerah|komoditas|email_pengirim|wa_pengirim|website_url|image_url)\}\})/gi,
    '<span class="hl-geo">$1</span>'
  );

  // 5. Bold / Underline / Italic tags (Amber)
  html = html.replace(
    /(&lt;\/?(?:strong|u|em|b|i)&gt;|\*\*[^*\n]+\*\*)/gi,
    '<span class="hl-fmt">$1</span>'
  );

  // 6. Markdown Headings H1/H2/H3 (Indigo)
  html = html.replace(/^(#{1,3}\s.*)$/gm, '<span class="hl-heading">$1</span>');

  // 7. Spintax braces & pipes (Rose/Pink)
  html = html.replace(/(\{|\||\})/g, '<span class="hl-spin">$1</span>');

  // Trailing newline prevents height mismatch on last line
  return `${html}\n`;
}

function bindSyntaxHighlightOverlay(textareaEl, layerEl) {
  if (!textareaEl || !layerEl) return () => {};
  const wrap = textareaEl.closest('.code-editor-wrap');
  const sync = () => {
    layerEl.innerHTML = renderColorizedSpintaxHtml(textareaEl.value);
    layerEl.scrollTop = textareaEl.scrollTop;
    layerEl.scrollLeft = textareaEl.scrollLeft;
    if (wrap) wrap.classList.add('is-hl-active');
  };
  textareaEl.addEventListener('input', sync);
  textareaEl.addEventListener('scroll', () => {
    layerEl.scrollTop = textareaEl.scrollTop;
    layerEl.scrollLeft = textareaEl.scrollLeft;
  });
  sync();
  return sync;
}

async function apiRequest(endpoint, { method = 'GET', body = null, headers = {} } = {}) {
  if (window.location.protocol === 'file:') {
    return { ok: false, offline: true, error: 'Mode file:// lokal' };
  }
  try {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr_owner_a',
        'x-workspace-id': 'wks_nusantara',
        ...headers
      },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined
    };
    if (body !== null && method !== 'GET') {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const resp = await fetch(endpoint, opts);
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    return { ok: false, offline: true, error: err.message };
  }
}

async function checkBackendHealth(badgeEl) {
  const res = await apiRequest('/api/v1/health');
  if (badgeEl) {
    if (res.ok && res.data && res.data.status === 'healthy') {
      badgeEl.className = 'badge badge-pass';
      badgeEl.textContent = 'Backend API: Online';
      badgeEl.title = `Server aktif (${res.data.version || '1.4.0'})`;
    } else {
      badgeEl.className = 'badge badge-sim';
      badgeEl.textContent = 'Mode Client (Offline)';
      badgeEl.title = 'Menjalankan engine langsung di browser';
    }
  }
  return res;
}

const SEO_PROMPT_SECTIONS_SPEC = [
  { id: 's1_intro', num: '01', title: 'Introduction (Pembuka & Tujuan)', baseWords: 100, instruction: 'Kenalkan topik, masalah pembaca, primary keyword di paragraf pembuka, dan tujuan artikel.' },
  { id: 's2_def', num: '02', title: 'Pembahasan Utama 1: Definisi & Jenis Layanan', baseWords: 150, instruction: 'Gunakan H2 & H3. Jelaskan pengertian secara spesifik dan jenis-jenis layanan/solusi.' },
  { id: 's3_mech', num: '03', title: 'Pembahasan Utama 2: Cara Kerja & Proses', baseWords: 150, instruction: 'Gunakan H2 & H3. Uraikan alur kerja, mekanisme, atau tahapan proses secara logis.' },
  { id: 's4_benefit', num: '04', title: 'Pembahasan Utama 3: Manfaat, Fitur & Keunggulan', baseWords: 150, instruction: 'Gunakan H2 & H3. Jelaskan fungsi, manfaat utama, fitur teknis, dan nilai tambah.' },
  { id: 's5_case', num: '05', title: 'Pembahasan Utama 4: Contoh, Biaya & Penerapan Daerah', baseWords: 150, instruction: 'Gunakan H2 & H3. Berikan contoh penerapan, estimasi biaya/pemeliharaan, dan konteks wilayah {{kecamatan}}, {{label_kota_kabupaten}}.' },
  { id: 's6_risk', num: '06', title: 'Pembahasan Tambahan: Risiko & Kesalahan Umum', baseWords: 100, instruction: 'Gunakan H2. Jelaskan kesalahan umum yang harus dihindari pembaca beserta solusinya.' },
  { id: 's7_faq', num: '07', title: 'FAQ (Pertanyaan Sesuai Search Intent)', baseWords: 100, instruction: 'Gunakan H2 & H3. Jawab 3 pertanyaan paling relevan dengan long-tail keyword & search intent.' },
  { id: 's8_conc', num: '08', title: 'Conclusion (Kesimpulan)', baseWords: 60, instruction: 'Gunakan H2. Rangkum inti pembahasan secara padat dan sebutkan kembali primary keyword secara alami.' },
  { id: 's9_cta', num: '09', title: 'CTA (Tindakan Berikutnya)', baseWords: 40, instruction: 'Arahkan pembaca ke tindakan relevan (Konsultasi WhatsApp / Kunjungi Website / Pemesanan).' }
];

function getScaledSectionSpec(targetLength = 1000) {
  const scale = Math.max(0.5, Number(targetLength || 1000) / 1000);
  return SEO_PROMPT_SECTIONS_SPEC.map((s) => ({
    ...s,
    targetWords: Math.round(s.baseWords * scale)
  }));
}

function buildKeywordResearchMiniPrompt(cfg = {}) {
  const primaryKw = String(cfg.primaryKeyword || 'Jasa Pembuatan Website').trim();
  const rawArticle = stripSectionMarkers(String(cfg.mainArticleText || '').trim());
  const snippet = rawArticle.length > 1200 ? `${rawArticle.slice(0, 1200).trim()}...` : rawArticle;
  const regionNote = cfg.daerah || cfg.wilayah
    ? `\n- Target Wilayah: ${[cfg.daerah, cfg.wilayah].filter(Boolean).join(', ')} (gunakan placeholder Kecamatan {{kecamatan}} bila relevan)`
    : '';
  const articleBlock = snippet
    ? `\n- Artikel Utama / Gambaran Materi Awal:\n"""\n${snippet}\n"""`
    : '';

  return `ROLE:
Bertindak sebagai Pakar Riset Keyword SEO & Semantic Entity Strategist (Bahasa Indonesia).

INPUT AWAL:
- Keyword Utama / Topik Awal: ${primaryKw}${regionNote}${articleBlock}

TUGAS:
Analisis Keyword Utama${snippet ? ' beserta materi Artikel Utama di atas' : ''}, lalu keluarkan daftar Keyword Khusus (turunan relevan), Semantic Keywords (LSI), dan Related Entities secara otomatis & terstruktur.
WAJIB gunakan 3 penanda blok persis di bawah ini (1 baris per item diawali tanda "-", tanpa kalimat pembuka/penutup panjang):

[KEYWORD_KHUSUS]
- (tuliskan 10 keyword khusus / long-tail / komersial yang berhubungan langsung dengan "${primaryKw}")

[SEMANTIC_KEYWORDS]
- (tuliskan 10 semantic keywords / LSI / istilah teknis & topik pendukung yang memperkaya kedalaman artikel)

[RELATED_ENTITIES]
- (tuliskan 10 related entities: komponen, profesi/tim ahli, standar layanan, segmen pelanggan, & entitas lokal Kecamatan {{kecamatan}})`;
}

const ID_STOPWORDS_MINI = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'dalam', 'atau', 'ini', 'itu',
  'adalah', 'merupakan', 'akan', 'dapat', 'bisa', 'lebih', 'sangat', 'juga', 'serta', 'oleh',
  'karena', 'agar', 'supaya', 'bagi', 'para', 'kami', 'anda', 'kita', 'mereka', 'secara',
  'sebagai', 'setiap', 'seluruh', 'melalui', 'hingga', 'sampai', 'tanpa', 'saat', 'ketika',
  'sudah', 'telah', 'belum', 'tidak', 'bukan', 'hanya', 'namun', 'tetapi', 'seperti', 'antara',
  'dalam', 'atas', 'bawah', 'awal', 'akhir', 'hal', 'cara', 'proses', 'hasil'
]);

function suggestLocalKeywordsAndEntities(primaryKeyword = '', mainArticleText = '') {
  const pk = String(primaryKeyword || 'Layanan Profesional').trim();
  const pkLower = pk.toLowerCase();
  const cleanArticle = stripSectionMarkers(String(mainArticleText || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/[{}|#*_"`~]/g, ' ');

  // Extract topical 2-word & 3-word phrases from mainArticleText if provided
  const tokens = cleanArticle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !ID_STOPWORDS_MINI.has(w) && !/^\d+$/.test(w));

  const phraseCounts = new Map();
  for (let i = 0; i < tokens.length - 1; i++) {
    const w1 = tokens[i];
    const w2 = tokens[i + 1];
    if (ID_STOPWORDS_MINI.has(w1) || ID_STOPWORDS_MINI.has(w2) || w1 === w2) continue;
    const bi = `${w1} ${w2}`;
    if (bi !== pkLower && !pkLower.includes(bi)) {
      phraseCounts.set(bi, (phraseCounts.get(bi) || 0) + 1);
    }
  }
  const extractedPhrases = [...phraseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p]) => p);

  const secondary = [
    `harga ${pkLower} terbaru`,
    `biaya ${pkLower} transparan`,
    `paket ${pkLower} bergaransi`,
    `${pkLower} terdekat`,
    `${pkLower} terpercaya`,
    `konsultasi ${pkLower} gratis`,
    `rekomendasi ${pkLower} terbaik`,
    `spesialis ${pkLower} berpengalaman`
  ];

  const semanticBase = [
    ...extractedPhrases.slice(0, 5),
    'standar operasional prosedur',
    'garansi resmi tertulis',
    'efisiensi biaya dan waktu',
    'spesifikasi teknis terukur',
    'survei lokasi dan pemetaan kebutuhan',
    'dukungan purna jual berkelanjutan',
    'kualitas pengerjaan rapi'
  ];

  const entitiesBase = [
    ...extractedPhrases.slice(5, 8),
    'Tim Teknisi & Konsultan Bersertifikat',
    'UMKM & Pelaku Usaha Lokal',
    'Pelanggan Rumah Tangga & Komersial',
    'Standar Mutu & Keamanan Kerja',
    'Layanan Customer Support WhatsApp',
    'Kecamatan {{kecamatan}}',
    '{{label_kota_kabupaten}}',
    'Provinsi {{wilayah}}'
  ];

  const dedupe = (arr, limit = 10) => {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
      const s = String(item || '').trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= limit) break;
    }
    return out;
  };

  return {
    secondary: dedupe(secondary, 10),
    semantic: dedupe(semanticBase, 10),
    entities: dedupe(entitiesBase, 10)
  };
}

function cleanKeywordChecklistItem(rawItem = '') {
  let s = String(rawItem || '')
    .replace(/^[\s\-*•‣▪◦]+/, '')
    .replace(/^\(?\d+[\).\-\s]+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();

  // If chatbot wrote "Keyword: long explanation...", keep the crisp keyword phrase before ':' or ' - ' / ' — '
  const colonMatch = s.match(/^([^:–—]{3,55})\s*[:–—]\s+.{12,}$/);
  if (colonMatch) {
    s = colonMatch[1].trim();
  }
  s = s.replace(/[.;,]+$/, '').trim();
  if (s.length < 2 || s.length > 90) return '';
  if (/^\[(KEYWORD_KHUSUS|SECONDARY_KEYWORDS?|SEMANTIC_KEYWORDS?|RELATED_ENTITIES|LSI_KEYWORDS?)\]$/i.test(s)) return '';
  if (/^(keyword khusus|secondary keywords?|semantic keywords?|related entities|entitas terkait|lsi keywords?)$/i.test(s)) return '';
  return s;
}

function splitLinesOrCommaItems(blockText = '') {
  const lines = String(blockText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rawItems = [];
  for (const line of lines) {
    // Skip instructional placeholder lines like "(tuliskan 10 keyword...)"
    if (/^\(tuliskan\s+\d+/i.test(line)) continue;
    // If single line has multiple comma-separated items and no sentence structure
    if (!/^[-*•\d]/.test(line) && line.includes(',') && line.split(',').length >= 3) {
      line.split(',').forEach((part) => rawItems.push(part));
    } else if (/^[-*•]/.test(line) && line.includes(',') && line.split(',').length >= 4) {
      line.replace(/^[-*•\s]+/, '').split(',').forEach((part) => rawItems.push(part));
    } else {
      rawItems.push(line);
    }
  }

  const seen = new Set();
  const out = [];
  for (const r of rawItems) {
    const cleaned = cleanKeywordChecklistItem(r);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function parseKeywordResearchIntoChecklist(rawResponse = '', primaryKeyword = '', mainArticleText = '') {
  const raw = String(rawResponse || '').trim();
  const fallback = suggestLocalKeywordsAndEntities(primaryKeyword, mainArticleText);
  if (!raw) return fallback;

  const buckets = { secondary: [], semantic: [], entities: [] };
  let currentBucket = null;
  let structuredHit = false;

  const lines = raw.split(/\r?\n/);
  const secHeaderRx = /^(?:\[\s*(?:KEYWORD_KHUSUS|SECONDARY_KEYWORDS?|SPECIFIC_KEYWORDS?)\s*\]|#{1,4}\s*.*(?:keyword\s*khusus|secondary\s*keyword|kata\s*kunci\s*khusus|kata\s*kunci\s*turunan).*|(?:\*\*|\d+[\).\s]*)?(?:keyword\s*khusus|secondary\s*keywords?|kata\s*kunci\s*turunan|kata\s*kunci\s*spesifik)(?:\*\*)?\s*:?\s*)$/i;
  const semHeaderRx = /^(?:\[\s*(?:SEMANTIC_KEYWORDS?|LSI_KEYWORDS?|SEMANTIC)\s*\]|#{1,4}\s*.*(?:semantic\s*keyword|lsi\s*keyword|kata\s*kunci\s*semantik).*|(?:\*\*|\d+[\).\s]*)?(?:semantic\s*keywords?|lsi\s*keywords?|kata\s*kunci\s*semantik)(?:\*\*)?\s*:?\s*)$/i;
  const entHeaderRx = /^(?:\[\s*(?:RELATED_ENTITIES|ENTITIES|SEMANTIC_ENTITIES|ENTITAS_TERKAIT)\s*\]|#{1,4}\s*.*(?:related\s*entit|entitas\s*terkait|entitas\s*pendukung).*|(?:\*\*|\d+[\).\s]*)?(?:related\s*entities|entitas\s*terkait|semantic\s*&\s*related\s*entities)(?:\*\*)?\s*:?\s*)$/i;

  const bucketLines = { secondary: [], semantic: [], entities: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (secHeaderRx.test(trimmed)) {
      currentBucket = 'secondary';
      structuredHit = true;
      continue;
    }
    if (semHeaderRx.test(trimmed)) {
      currentBucket = 'semantic';
      structuredHit = true;
      continue;
    }
    if (entHeaderRx.test(trimmed)) {
      currentBucket = 'entities';
      structuredHit = true;
      continue;
    }

    // Inline "Secondary Keywords: a, b, c" single-line format
    const inlineSec = trimmed.match(/^(?:\*\*|-|\d+\.)?\s*(?:keyword\s*khusus|secondary\s*keywords?)\s*(?:\*\*)?:\s*(.+)$/i);
    if (inlineSec) {
      bucketLines.secondary.push(inlineSec[1]);
      currentBucket = 'secondary';
      structuredHit = true;
      continue;
    }
    const inlineSem = trimmed.match(/^(?:\*\*|-|\d+\.)?\s*(?:semantic\s*keywords?|lsi\s*keywords?)\s*(?:\*\*)?:\s*(.+)$/i);
    if (inlineSem) {
      bucketLines.semantic.push(inlineSem[1]);
      currentBucket = 'semantic';
      structuredHit = true;
      continue;
    }
    const inlineEnt = trimmed.match(/^(?:\*\*|-|\d+\.)?\s*(?:related\s*entities|entitas\s*terkait)\s*(?:\*\*)?:\s*(.+)$/i);
    if (inlineEnt) {
      bucketLines.entities.push(inlineEnt[1]);
      currentBucket = 'entities';
      structuredHit = true;
      continue;
    }

    if (currentBucket) {
      bucketLines[currentBucket].push(trimmed);
    }
  }

  if (structuredHit) {
    buckets.secondary = splitLinesOrCommaItems(bucketLines.secondary.join('\n'));
    buckets.semantic = splitLinesOrCommaItems(bucketLines.semantic.join('\n'));
    buckets.entities = splitLinesOrCommaItems(bucketLines.entities.join('\n'));
    // If chatbot combined Semantic & Entities into 1 block, fill missing bucket gracefully
    if (!buckets.secondary.length) buckets.secondary = fallback.secondary.slice(0, 6);
    if (!buckets.semantic.length) buckets.semantic = fallback.semantic.slice(0, 6);
    if (!buckets.entities.length) buckets.entities = fallback.entities.slice(0, 6);
    return buckets;
  }

  // Unstructured paste fallback: classify items automatically into Secondary, Semantic, and Entities
  const allItems = splitLinesOrCommaItems(raw);
  if (!allItems.length) return fallback;

  const pkTokens = String(primaryKeyword || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const commercialRx = /\b(harga|biaya|tarif|paket|jasa|layanan|murah|terbaik|terdekat|profesional|bergaransi|resmi|pesan|order|konsultasi)\b/i;
  const entityRx = /(\{\{|\bkecamatan\b|\bkota\b|\bkabupaten\b|\bprovinsi\b|\bumkm\b|\bperusahaan\b|\binstansi\b|\bteknisi\b|\bkonsultan\b|\bspesialis\b|\bsertifikat\b|\bsni\b|\biso\b)/i;

  for (const item of allItems) {
    const lower = item.toLowerCase();
    const hasPkWord = pkTokens.some((t) => lower.includes(t));
    if (entityRx.test(item)) {
      buckets.entities.push(item);
    } else if (commercialRx.test(item) || hasPkWord) {
      buckets.secondary.push(item);
    } else {
      buckets.semantic.push(item);
    }
  }

  if (!buckets.secondary.length) buckets.secondary = allItems.slice(0, Math.ceil(allItems.length / 3));
  if (!buckets.semantic.length) buckets.semantic = fallback.semantic.slice(0, 6);
  if (!buckets.entities.length) buckets.entities = fallback.entities.slice(0, 6);

  return buckets;
}

function buildSeoPromptFramework(cfg = {}) {
  const primaryKw = String(cfg.primaryKeyword || 'Jasa Pembuatan Website').trim();
  const secondaryKw = String(cfg.secondaryKeywords || 'biaya layanan, fitur unggulan, proses pengerjaan, bergaransi resmi').trim();
  const semanticKw = String(cfg.semanticKeywords || 'kualitas profesional, konsultasi teknis, dukungan pemeliharaan, solusi bisnis').trim();
  const entities = String(cfg.relatedEntities || 'UMKM, Perusahaan, Pelaku Usaha Lokal, Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}').trim();
  const mainSeed = stripSectionMarkers(String(cfg.mainArticleSeed || '').trim());
  const mainSeedSnippet = mainSeed ? `\n- Konteks Artikel Utama / Referensi Materi: ${mainSeed.slice(0, 600)}` : '';
  const targetLen = Number(cfg.articleLength || 1000);
  const minLen = Math.round(targetLen * 0.9);
  const maxLen = Math.round(targetLen * 1.1);
  const articleType = cfg.articleType || 'Commercial';
  const searchIntent = cfg.searchIntent || 'Commercial';
  const writingStyle = cfg.writingStyle || 'Professional';
  const tone = cfg.tone || 'Persuasive';
  const audience = cfg.audience || 'Intermediate';
  const depth = cfg.contentDepth || 'Comprehensive';
  const ctaType = cfg.ctaType || 'Contact';
  const lang = cfg.language || 'Indonesia';
  const scaled = getScaledSectionSpec(targetLen);

  const structureLines = scaled
    .map((s) => `[BAGIAN ${s.num}] ${s.title}: ~${s.targetWords} kata — ${s.instruction}`)
    .join('\n');

  const master = `ROLE:
Bertindak sebagai SEO Content Strategist dan Professional Article Writer.

INPUT CONFIGURATION:
- Primary Keyword / Topik: ${primaryKw}
- Secondary Keywords: ${secondaryKw}
- Semantic Keywords: ${semanticKw}
- Related Entities & Lokal: ${entities}
- Target Panjang: ${targetLen} kata unik/orisinal (Toleransi: ${minLen}–${maxLen} kata)
- Article Type: ${articleType} | Search Intent: ${searchIntent}
- Writing Style: ${writingStyle} | Tone: ${tone}
- Target Audience: ${audience} | Content Depth: ${depth}
- CTA Type: ${ctaType} | Bahasa: ${lang}${mainSeedSnippet}

CONTENT STRUCTURE (WAJIB IKUTI 9 BAGIAN & PENANDA [BAGIAN 01] s/d [BAGIAN 09]):
${structureLines}

KEYWORD DISTRIBUTION & HEADING RULES:
- Letakkan Primary Keyword (${primaryKw}) pada: Judul H1 (#), Paragraf Pembuka (Bagian 01), minimal satu H2 (##), dan Kesimpulan (Bagian 08).
- Sebarkan Secondary & Semantic Keywords secara alami di Pembahasan Utama (Bagian 02–06) dan FAQ (Bagian 07).
- Gunakan satu H1 (#) di awal Bagian 01, H2 (##) untuk tiap pembahasan utama, dan H3 (###) untuk subtopik penting.
- Sertakan placeholder wilayah {{kecamatan}}, {{label_kota_kabupaten}}, dan {{wilayah}} agar siap di-spin untuk banyak daerah.
- Jangan mengulang ide yang sama untuk mengejar jumlah kata.`;

  const stage1 = `PROMPT 1 — RESEARCH & PLANNING (${primaryKw}):
Analisis sebelum menulis artikel ${targetLen} kata (${articleType} / Intent: ${searchIntent}):
1. Identifikasi masalah utama pembaca (${audience}) terkait "${primaryKw}".
2. Petakan distribusi Primary Keyword (${primaryKw}), Secondary (${secondaryKw}), Semantic (${semanticKw}), dan Entities (${entities}).
3. Susun kerangka H1, H2, dan H3 untuk 9 bagian artikel agar tidak ada subtopik yang tumpang tindih.`;

  const stage2 = `PROMPT 2 — CONTENT GENERATION (9 BAGIAN = ${targetLen} KATA):
Tuliskan isi artikel lengkap mengikuti pembagian kata berikut (awali tiap bagian dengan label [BAGIAN 01] s/d [BAGIAN 09]):
${structureLines}`;

  const stage3 = `PROMPT 3 — SEO OPTIMIZATION:
Optimalkan hasil artikel "${primaryKw}" untuk:
- SEO Title, Meta Description, dan URL Slug
- Penempatan Primary Keyword di H1, Intro, H2, dan Conclusion
- Peluang Internal Link, Alt Text Gambar Daerah ({{kecamatan}}), dan FAQ Schema`;

  const stage4 = `PROMPT 4 — QUALITY AUDIT:
Periksa kembali artikel yang telah dibuat:
1. Apakah total kata berada di rentang ${minLen}–${maxLen} kata orisinal?
2. Apakah ke-9 bagian memiliki informasi spesifik tanpa pengulangan kalimat?
3. Apakah struktur H1, H2, H3 dan Search Intent (${searchIntent}) sudah terpenuhi?`;

  return { master, stage1, stage2, stage3, stage4, scaledSpec: scaled };
}

function generateStructured9SectionsDraft(cfg = {}) {
  const primaryKw = String(cfg.primaryKeyword || 'Jasa Pembuatan Website').trim();
  const secondaryList = String(cfg.secondaryKeywords || 'jenis layanan, fitur utama, rincian biaya, garansi pemeliharaan')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const semanticList = String(cfg.semanticKeywords || 'standar profesional, efisiensi anggaran, konsultasi teknis, hasil terukur')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const entities = String(cfg.relatedEntities || 'pelaku usaha, UMKM, instansi, serta masyarakat di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}').trim();
  const sec1 = secondaryList[0] || 'jenis layanan unggulan';
  const sec2 = secondaryList[1] || 'fitur dan spesifikasi';
  const sec3 = secondaryList[2] || 'estimasi biaya transparan';
  const sem1 = semanticList[0] || 'kualitas pengerjaan terukur';
  const sem2 = semanticList[1] || 'dukungan teknis berkelanjutan';

  return {
    s1_intro: `# ${primaryKw}: Panduan Memilih Solusi Terbaik di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}\n\nKebutuhan terhadap ${primaryKw} semakin meningkat seiring berkembangnya aktivitas ekonomi dan digitalisasi bagi ${entities} di Provinsi {{wilayah}}. Namun, banyak calon pengguna yang masih menghadapi kendala saat menentukan spesifikasi layanan, memperkirakan anggaran yang rasional, serta memastikan ${sem1} agar investasi yang dikeluarkan memberikan hasil jangka panjang. Artikel ini hadir sebagai panduan menyeluruh untuk membantu Anda memahami definisi, mekanisme kerja, manfaat utama, rincian biaya, hingga cara menghindari kesalahan umum saat memilih ${primaryKw} di wilayah Kecamatan {{kecamatan}} ({{label_kota_kabupaten}}).`,
    s2_def: `## Apa Itu ${primaryKw} dan Mengapa Penting?\n\nSecara spesifik, ${primaryKw} merupakan solusi terstruktur yang dirancang untuk menjawab kebutuhan teknis maupun operasional pelanggan dengan standar mutu yang teruji. Layanan ini tidak sekadar menyediakan hasil akhir, melainkan mencakup perencanaan awal, pemetaan kebutuhan, hingga implementasi yang disesuaikan dengan karakter pengguna di {{label_kota_kabupaten}}.\n\n### Jenis Layanan dan Cakupan Solusi\n\nDalam praktiknya, cakupan ${sec1} dibagi menjadi paket standar untuk kebutuhan dasar yang cepat serta paket kustom (custom) yang fleksibel mengikuti skala bisnis maupun properti Anda di Kecamatan {{kecamatan}}.`,
    s3_mech: `## Bagaimana Proses dan Cara Kerja ${primaryKw}?\n\nAgar setiap pekerjaan berjalan tepat waktu dan sesuai spesifikasi, pelaksanaan ${primaryKw} dilakukan melalui tahapan operasional yang sistematis dan terdokumentasi sejak hari pertama.\n\n### Tahapan Analisis, Eksekusi, dan Uji Kelayakan\n\n1. **Konsultasi & Pemetaan Kebutuhan:** Mengidentifikasi target, kondisi aktual, serta ruang lingkup ${sec2} yang dibutuhkan pelanggan di Kecamatan {{kecamatan}}.\n2. **Perancangan & Penyusunan Rincian Teknis:** Menyusun cetak biru pengerjaan, jadwal waktu, serta rincian komponen secara transparan.\n3. **Implementasi & Pengawasan Mutu:** Eksekusi oleh personel berpengalaman diikuti pengujian menyeluruh sebelum serah terima kepada pelanggan di {{label_kota_kabupaten}}.`,
    s4_benefit: `## Manfaat Utama, Fungsi, dan Keunggulan ${primaryKw}\n\nMenggunakan ${primaryKw} yang dikelola secara profesional memberikan nilai tambah nyata dibandingkan penanganan tanpa perencanaan matang. Fokus utamanya adalah menghadirkan ${sem1} sekaligus memastikan efisiensi waktu dan biaya.\n\n### Fitur Unggulan dan Nilai Tambah Layanan\n\n- **Spesifikasi Terukur & Modern:** Setiap elemen ${sec2} dirancang agar mudah digunakan, aman, dan tahan lama.\n- **Dukungan Purna Jual & Pemeliharaan:** Dilengkapi ${sem2} sehingga pelanggan di Kecamatan {{kecamatan}} mendapatkan ketenangan jangka panjang.\n- **Fleksibilitas Pengembangan:** Mudah ditingkatkan kapasitasnya seiring pertumbuhan kebutuhan Anda di Provinsi {{wilayah}}.`,
    s5_case: `## Contoh Penerapan, Estimasi Biaya, dan Studi Kasus di {{kecamatan}}\n\nSebagai gambaran nyata, banyak pelaku usaha dan warga di koridor Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} yang berhasil meningkatkan efisiensi operasional mereka setelah menerapkan ${primaryKw} secara tepat sasaran. Pemilihan spesifikasi yang pas sejak awal terbukti memangkas biaya perbaikan berulang hingga puluhan persen.\n\n### Perhitungan Biaya dan Pemeliharaan Berkala\n\nSkema ${sec3} sangat bergantung pada tingkat kompleksitas fitur, durasi pengerjaan, serta dukungan pemeliharaan rutin. Dengan rincian anggaran yang terbuka sejak tahap konsultasi, pelanggan di {{label_kota_kabupaten}} dapat menyesuaikan paket layanan tanpa khawatir adanya biaya tersembunyi.`,
    s6_risk: `## Kesalahan Umum yang Harus Dihindari Saat Memilih ${primaryKw}\n\nKesalahan paling sering terjadi adalah tergiur penawaran harga terlalu murah tanpa memeriksa portofolio, kejelasan spesifikasi ${sec2}, serta ketersediaan garansi layanan. Akibatnya, hasil pengerjaan sering kali tidak sesuai ekspektasi atau sulit dirawat di kemudian hari. Solusinya, pastikan Anda selalu meminta rincian kerja tertulis, memeriksa rekam jejak tim pelaksana di {{label_kota_kabupaten}}, dan memastikan adanya dukungan teknis yang responsif untuk area Kecamatan {{kecamatan}}.`,
    s7_faq: `## Pertanyaan yang Sering Diajukan (FAQ) Seputar ${primaryKw}\n\n### Berapa lama waktu pengerjaan ${primaryKw} untuk area Kecamatan {{kecamatan}}?\nDurasi pengerjaan disesuaikan dengan skala dan spesifikasi yang dipilih, namun seluruh jadwal disepakati secara tertulis sejak awal agar tepat waktu.\n\n### Apakah tersedia layanan konsultasi awal untuk wilayah {{label_kota_kabupaten}}?\nYa, tim kami menyediakan sesi konsultasi dan pemetaan kebutuhan awal bagi pelanggan di seluruh Kecamatan {{kecamatan}} dan sekitarnya di {{wilayah}}.\n\n### Bagaimana sistem garansi dan pemeliharaan setelah layanan selesai?\nSetiap pelanggan mendapatkan jaminan mutu tertulis serta dukungan teknis berkala untuk memastikan seluruh fungsi berjalan optimal.`,
    s8_conc: `## Kesimpulan\n\nMemilih ${primaryKw} yang tepat di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} memerlukan pemahaman menyeluruh mengenai jenis layanan, tahapan proses kerja, fitur utama, serta transparansi biaya. Dengan mengutamakan ${sem1} dan dukungan tim yang kompeten di Provinsi {{wilayah}}, Anda akan memperoleh solusi yang aman, efektif, dan bernilai investasi tinggi.`,
    s9_cta: `Siap mendiskusikan kebutuhan ${primaryKw} Anda hari ini? Hubungi tim spesialis kami untuk mendapatkan konsultasi gratis, rincian estimasi anggaran terbaik, dan jadwal penanganan cepat khusus wilayah Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}.`
  };
}

function combine9SectionsToRawArticle(sectionsMap = {}) {
  return SEO_PROMPT_SECTIONS_SPEC.map((s) => stripSectionMarkers(sectionsMap[s.id] || ''))
    .filter(Boolean)
    .join('\n\n');
}

function parseChatbotOutputInto9Sections(rawText = '', fallbackCfg = {}) {
  const text = String(rawText || '').trim();
  if (!text) return generateStructured9SectionsDraft(fallbackCfg);

  const result = {};
  const markerRegex = /\[\s*(?:BAGIAN|BAGAN|SECTION)\s*0?([1-9])[^\]]*\][^\n]*\n?([\s\S]*?)(?=\[\s*(?:BAGIAN|BAGAN|SECTION)\s*0?[1-9][^\]]*\]|$)/gi;
  let match;
  let foundMarkers = 0;
  while ((match = markerRegex.exec(text)) !== null) {
    const idx = Number(match[1]) - 1;
    if (SEO_PROMPT_SECTIONS_SPEC[idx]) {
      result[SEO_PROMPT_SECTIONS_SPEC[idx].id] = stripSectionMarkers(match[2]);
      foundMarkers++;
    }
  }
  if (foundMarkers >= 3) return result;

  // Fallback: split by H2 headings (## ) or paragraphs across the 9 buckets
  const cleanedText = stripSectionMarkers(text);
  const blocks = cleanedText.split(/(?=^##\s+)/m).map((b) => b.trim()).filter(Boolean);
  if (blocks.length >= 2) {
    SEO_PROMPT_SECTIONS_SPEC.forEach((spec, idx) => {
      result[spec.id] = blocks[idx] || '';
    });
    if (blocks.length > 9) {
      result.s9_cta = blocks.slice(8).join('\n\n');
    }
    return result;
  }

  const paras = stripSectionMarkers(text).split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  SEO_PROMPT_SECTIONS_SPEC.forEach((spec, idx) => {
    result[spec.id] = paras[idx] || '';
  });
  return result;
}

function countWordsSimple(str) {
  const clean = String(str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[{}|#*_]/g, ' ')
    .trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function audit9SectionsAndArticle(sectionsMap = {}, combinedArticle = '', spintaxText = '', cfg = {}) {
  const targetLen = Number(cfg.articleLength || 1000);
  const primaryKw = String(cfg.primaryKeyword || '').trim().toLowerCase();
  const scaled = getScaledSectionSpec(targetLen);

  let filledSections = 0;
  const sectionStats = scaled.map((spec) => {
    const val = String(sectionsMap[spec.id] || '').trim();
    const wc = countWordsSimple(val);
    if (wc > 0) filledSections++;
    return {
      id: spec.id,
      num: spec.num,
      title: spec.title,
      targetWords: spec.targetWords,
      actualWords: wc
    };
  });

  const articleWords = countWordsSimple(combinedArticle);
  const h1Count = (combinedArticle.match(/^#\s+/gm) || []).length;
  const h2Count = (combinedArticle.match(/^##\s+/gm) || []).length;
  const h3Count = (combinedArticle.match(/^###\s+/gm) || []).length;

  const spintaxH2Count = (spintaxText.match(/^##\s+/gm) || []).length;
  const kwInArticle = primaryKw ? combinedArticle.toLowerCase().includes(primaryKw) : true;
  const kwInSpintax = primaryKw ? spintaxText.toLowerCase().includes(primaryKw) : true;
  const isSynced = articleWords > 0 && spintaxText.trim().length > 0 && kwInSpintax && spintaxH2Count >= h2Count;

  return {
    targetLength: targetLen,
    articleWords,
    filledSections,
    totalSections: 9,
    h1Count,
    h2Count,
    h3Count,
    kwInArticle,
    kwInSpintax,
    isSynced,
    sectionStats
  };
}

// Pure-JS CRC32 & PKZIP Builder (1 Article = 1 Individual HTML File inside ZIP)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(u8) {
  let crc = 0xffffffff;
  for (let i = 0; i < u8.length; i++) {
    crc = CRC32_TABLE[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function clientBuildZipUint8Array(files = []) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const safeName = String(f.name || 'file.html').replace(/^[\/\\]+/, '');
    const nameBytes = encoder.encode(safeName);
    const dataBytes = f.content instanceof Uint8Array ? f.content : encoder.encode(String(f.content || ''));
    const crc = crc32Bytes(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localTotal = 0;
  let centralTotal = 0;
  entries.forEach((e) => {
    localTotal += 30 + e.nameBytes.length + e.dataBytes.length;
    centralTotal += 46 + e.nameBytes.length;
  });

  const out = new Uint8Array(localTotal + centralTotal + 22);
  const view = new DataView(out.buffer);
  let localOffset = 0;
  let centralOffset = localTotal;

  entries.forEach((e) => {
    const myLocalOffset = localOffset;
    // Local file header
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x0800, true); // UTF-8 flag
    view.setUint16(localOffset + 8, 0, true); // Store (0)
    view.setUint16(localOffset + 10, 0, true);
    view.setUint16(localOffset + 12, 0x21, true);
    view.setUint32(localOffset + 14, e.crc, true);
    view.setUint32(localOffset + 18, e.dataBytes.length, true);
    view.setUint32(localOffset + 22, e.dataBytes.length, true);
    view.setUint16(localOffset + 26, e.nameBytes.length, true);
    view.setUint16(localOffset + 28, 0, true);
    out.set(e.nameBytes, localOffset + 30);
    out.set(e.dataBytes, localOffset + 30 + e.nameBytes.length);
    localOffset += 30 + e.nameBytes.length + e.dataBytes.length;

    // Central directory header
    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint16(centralOffset + 4, 20, true);
    view.setUint16(centralOffset + 6, 20, true);
    view.setUint16(centralOffset + 8, 0x0800, true);
    view.setUint16(centralOffset + 10, 0, true);
    view.setUint16(centralOffset + 12, 0, true);
    view.setUint16(centralOffset + 14, 0x21, true);
    view.setUint32(centralOffset + 16, e.crc, true);
    view.setUint32(centralOffset + 20, e.dataBytes.length, true);
    view.setUint32(centralOffset + 24, e.dataBytes.length, true);
    view.setUint16(centralOffset + 28, e.nameBytes.length, true);
    view.setUint16(centralOffset + 30, 0, true);
    view.setUint16(centralOffset + 32, 0, true);
    view.setUint16(centralOffset + 34, 0, true);
    view.setUint16(centralOffset + 36, 0, true);
    view.setUint32(centralOffset + 38, 0, true);
    view.setUint32(centralOffset + 42, myLocalOffset, true);
    out.set(e.nameBytes, centralOffset + 46);
    centralOffset += 46 + e.nameBytes.length;
  });

  // End of central directory
  view.setUint32(centralOffset, 0x06054b50, true);
  view.setUint16(centralOffset + 4, 0, true);
  view.setUint16(centralOffset + 6, 0, true);
  view.setUint16(centralOffset + 8, entries.length, true);
  view.setUint16(centralOffset + 10, entries.length, true);
  view.setUint32(centralOffset + 12, centralTotal, true);
  view.setUint32(centralOffset + 16, localTotal, true);
  view.setUint16(centralOffset + 20, 0, true);

  return out;
}

function clientDownloadZip(zipFilename, files = []) {
  const zipBytes = clientBuildZipUint8Array(files);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
}

function buildCleanCsvString(headers = [], rowsArray = []) {
  const escCell = (val) => {
    let s = Array.isArray(val) ? val.join(' | ') : val === null || val === undefined ? '' : String(val);
    s = s.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const headerLine = headers.map(escCell).join(',');
  const rowLines = rowsArray.map((r) => r.map(escCell).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

function normalizeGscSiteEntry(rawSiteUrl, customSitemapUrl = '') {
  const raw = String(rawSiteUrl || '').trim();
  if (!raw) return null;
  let propertyUrl = raw;
  let publicBaseUrl = raw;

  if (raw.startsWith('sc-domain:')) {
    const dom = raw.slice('sc-domain:'.length).replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    propertyUrl = `sc-domain:${dom}`;
    publicBaseUrl = `https://${dom}/`;
  } else {
    if (!/^https?:\/\//i.test(propertyUrl)) {
      propertyUrl = `https://${propertyUrl}`;
    }
    if (!propertyUrl.endsWith('/')) {
      propertyUrl += '/';
    }
    publicBaseUrl = propertyUrl;
  }

  let sitemapUrl = String(customSitemapUrl || '').trim();
  if (!sitemapUrl) {
    sitemapUrl = `${publicBaseUrl}sitemap.xml`;
  } else if (!/^https?:\/\//i.test(sitemapUrl)) {
    sitemapUrl = `${publicBaseUrl}${sitemapUrl.replace(/^\/+/, '')}`;
  }

  return {
    propertyUrl,
    publicBaseUrl,
    sitemapUrl
  };
}

// B2B Email Outreach Prompting Quiz & 5-Section Modular Builder
const EMAIL_PROMPT_SECTIONS_SPEC = [
  { id: 'e1_subject', num: '01', title: 'Subject Line Spintax (Subjek Email)', targetWords: 12, instruction: 'Buat subjek spintax B2B yang relevan, menyebut {{nama_usaha}} atau {{komoditas}}, bebas kata spam.' },
  { id: 'e2_greeting', num: '02', title: 'Personalized Greeting & Hook Pembuka', targetWords: 35, instruction: 'Sapaan profesional ke {{nama_usaha}} di {{kota_daerah}} dan alasan menghubungi.' },
  { id: 'e3_value', num: '03', title: 'Value Proposition & Spesifikasi Komoditas', targetWords: 60, instruction: 'Jelaskan keunggulan {{komoditas}}, kualitas/grade, kapasitas suplai, dan origin.' },
  { id: 'e4_proof', num: '04', title: 'Penawaran Sampel, Katalog & Bukti Kualitas', targetWords: 45, instruction: 'Tawarkan pengiriman sampel gratis/katalog spesifikasi untuk evaluasi tim buyer.' },
  { id: 'e5_cta', num: '05', title: 'Low-Friction CTA & Sign-Off Pengirim', targetWords: 30, instruction: 'Ajakan balasan ringan (jadwal call/kirim sampel) + penutup {{nama_pengirim}} ({{email_pengirim}}).' }
];

function buildEmailPromptFramework(cfg = {}) {
  const commodity = String(cfg.commodity || 'Indonesian Specialty Arabica Green Beans').trim();
  const targetMarket = String(cfg.targetMarket || 'Specialty Coffee Roasters & Buyers in Japan').trim();
  const usp = String(cfg.usp || 'Direct Trade, Cupping Score 86+, G1 Grade, 5 Tons/Month Capacity').trim();
  const goal = cfg.emailGoal || 'Sample & Direct Trade Offer';
  const tone = cfg.tone || 'Polite & Consultative B2B';
  const lang = cfg.language || 'English (International B2B)';
  const targetWords = Number(cfg.targetWords || 180);

  const structureLines = EMAIL_PROMPT_SECTIONS_SPEC.map(
    (s) => `[EMAIL ${s.num}] ${s.title} (~${s.targetWords} kata): ${s.instruction}`
  ).join('\n');

  const master = `ROLE:
Bertindak sebagai B2B Export Trade Specialist & Cold Email Copywriter.

INPUT CONFIGURATION:
- Komoditas / Produk: ${commodity}
- Target Penerima / Pasar: ${targetMarket}
- Keunggulan Utama (USP): ${usp}
- Tujuan Email (Intent): ${goal}
- Tone & Bahasa: ${tone} | Bahasa: ${lang}
- Target Panjang: ~${targetWords} kata

WAJIB IKUTI 5 BAGIAN DENGAN PENANDA [EMAIL 01] s/d [EMAIL 05] & FORMAT SPINTAX {opsi 1|opsi 2|opsi 3}:
${structureLines}

ATURAN VARIABEL & ANTI-SPAM:
- Gunakan variabel {{nama_usaha}}, {{kota_daerah}}, {{komoditas}}, {{nama_pengirim}}, dan {{email_pengirim}}.
- Hindari huruf kapital berlebih dan kata pemicu filter spam.`;

  return { master, spec: EMAIL_PROMPT_SECTIONS_SPEC };
}

function generateStructured5EmailParts(cfg = {}) {
  const commodity = String(cfg.commodity || 'Indonesian Specialty Arabica Green Beans').trim();
  const usp = String(cfg.usp || 'Cupping Score 86+, Direct Farm Traceability, and Consistent Moisture Control').trim();
  const isId = String(cfg.language || '').toLowerCase().includes('indonesia');

  if (isId) {
    return {
      e1_subject: `{Penawaran Kerjasama Suplai|Proposal Komoditas Ekspor|Katalog & Sampel Resmi} {{komoditas}} untuk {{nama_usaha}} ({{kota_daerah}})`,
      e2_greeting: `{Yth. Tim Purchasing & Manajemen|Halo Tim Buyer|Salam hangat untuk tim} {{nama_usaha}} di {{kota_daerah}},\n\n{Kami mengikuti perkembangan {{nama_usaha}} sebagai salah satu pelaku usaha terkemuka di {{kota_daerah}}.|Perkenalkan kami dari divisi perdagangan langsung untuk komoditas ${commodity}.}`,
      e3_value: `{Saat ini kami menyuplai|Kami menyediakan langsung dari sentra produksi} {{komoditas}} dengan keunggulan utama berupa ${usp}. {Seluruh batch melewati sortir mutu ketat agar konsisten untuk kebutuhan rutin bisnis Anda.|Kami menjamin ketertelusuran produk serta kestabilan pasokan bulanan.}`,
      e4_proof: `{Sebagai bahan evaluasi awal, kami sangat senang mengirimkan|Kami telah menyiapkan paket} {sampel produk gratis (200g–500g) beserta spesifikasi lengkap|katalog harga grosir terbaru dan lembar hasil uji mutu} langsung ke alamat {{nama_usaha}} di {{kota_daerah}}.`,
      e5_cta: `{Apakah kami boleh mengirimkan rincian spesifikasi dan sampel minggu ini?|Silakan balas email ini dengan alamat penerima sampel jika Anda berkenan memeriksa kualitas produk kami.}\n\nSalam hormat,\n{{nama_pengirim}} ({{email_pengirim}})`
    };
  }

  return {
    e1_subject: `{Direct Trade Sample Offer|Specialty Supply Inquiry|New Harvest Allocation}: {{komoditas}} for {{nama_usaha}} ({{kota_daerah}})`,
    e2_greeting: `{Dear Roasting & Green Buying Team at|Hello Sourcing Team at|Warm greetings to the team at} {{nama_usaha}} in {{kota_daerah}},\n\n{We have been admiring {{nama_usaha}}'s dedication to quality in {{kota_daerah}}.|I am reaching out from our direct-origin export desk specializing in ${commodity}.}`,
    e3_value: `{Our current harvest of|We are currently allocating} {{komoditas}} featuring ${usp}. {Each lot is carefully processed and vacuum-packed to preserve clarity and shelf stability for discerning buyers.|We offer flexible volume allocations from micro-lots to full container loads.}`,
    e4_proof: `{We would be honored to send a complimentary|To support your upcoming menu evaluation, we can dispatch a} {250g sample box along with full technical specs and pricing|roast profile sheet and green sample kit} directly to {{nama_usaha}} in {{kota_daerah}}.`,
    e5_cta: `{Would you be open to receiving our latest offer sheet or a sample pack this week?|Simply reply with your preferred shipping address if you would like to cup or test our current lots.}\n\nWarm regards,\n{{nama_pengirim}} ({{email_pengirim}})`
  };
}

function parseChatbotInto5EmailParts(rawText = '', fallbackCfg = {}) {
  const text = String(rawText || '').trim();
  if (!text) return generateStructured5EmailParts(fallbackCfg);
  const res = generateStructured5EmailParts(fallbackCfg);
  const rx = /\[EMAIL\s*0?([1-5])\][^\n]*\n([\s\S]*?)(?=\[EMAIL\s*0?[1-5]\]|$)/gi;
  let m;
  let hits = 0;
  while ((m = rx.exec(text)) !== null) {
    const idx = Number(m[1]) - 1;
    if (EMAIL_PROMPT_SECTIONS_SPEC[idx]) {
      res[EMAIL_PROMPT_SECTIONS_SPEC[idx].id] = m[2].trim();
      hits++;
    }
  }
  if (hits >= 2) return res;
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length >= 2) {
    res.e1_subject = paras[0].replace(/^subject\s*:\s*/i, '');
    res.e2_greeting = paras[1] || res.e2_greeting;
    res.e3_value = paras[2] || res.e3_value;
    res.e4_proof = paras[3] || res.e4_proof;
    res.e5_cta = paras.slice(4).join('\n\n') || res.e5_cta;
  }
  return res;
}

window.LocalSpinClient = {
  MAX_IMAGES_PER_PROJECT,
  LOCALSPIN_REGIONS,
  DEFAULT_PROJECTS_STATE,
  SEO_PROMPT_SECTIONS_SPEC,
  EMAIL_PROMPT_SECTIONS_SPEC,
  buildKeywordResearchMiniPrompt,
  suggestLocalKeywordsAndEntities,
  parseKeywordResearchIntoChecklist,
  buildSeoPromptFramework,
  generateStructured9SectionsDraft,
  combine9SectionsToRawArticle,
  parseChatbotOutputInto9Sections,
  audit9SectionsAndArticle,
  buildEmailPromptFramework,
  generateStructured5EmailParts,
  parseChatbotInto5EmailParts,
  clientDownloadZip,
  buildCleanCsvString,
  normalizeGscSiteEntry,
  initWorkspaceLayoutControls,
  initQuickGuideAndScrollTop,
  apiRequest,
  checkBackendHealth,
  clientCopyText,
  clientDownloadFile,
  clientGenerateSitemapXml,
  renderColorizedSpintaxHtml,
  bindSyntaxHighlightOverlay,
  clientDetectLanguage,
  clientAutoSpinRawArticle,
  clientCalculateSafeCapacity,
  clientRenderProjectImagesForArticle,
  clientBuildWhatsAppUrl,
  clientBuildMasterSpintax,
  clientResolveSpintax,
  clientInjectGeo,
  clientConvertArticleToHtml,
  clientBuildSeoMeta,
  clientCountPermutations,
  stripSectionMarkers,
  normalizeSmartHref,
  clientCompareArticles
};
