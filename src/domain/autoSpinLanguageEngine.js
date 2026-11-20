/**
 * Auto-Language Detection, Automatic Nested Spintax Transformer,
 * and Anti-Trash (Anti-Artikel Sampah) Capacity & Recommendation Engine.
 */

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

// Multi-level nested synonym & phrase dictionaries (Indonesian & English)
const ID_NESTED_DICTIONARY = [
  {
    pattern: /\b(layanan|jasa)\b/gi,
    replacement: '{layanan|jasa|{solusi teknis|penanganan profesional|unit layanan}}'
  },
  {
    pattern: /\b(terbaik|unggulan)\b/gi,
    replacement: '{terbaik|unggulan|{pilihan utama|berstandar tinggi|paling direkomendasikan}}'
  },
  {
    pattern: /\b(terpercaya|amanah|resmi)\b/gi,
    replacement: '{terpercaya|resmi|{berpengalaman luas|memiliki reputasi teruji|bersertifikat lengkap}}'
  },
  {
    pattern: /\b(profesional|ahli|berpengalaman)\b/gi,
    replacement: '{profesional|ahli|{berpengalaman tinggi|kompeten di bidangnya|terlatih secara teknis}}'
  },
  {
    pattern: /\b(cepat|responsif|sigap)\b/gi,
    replacement: '{cepat|responsif|{sigap di lapangan|tepat waktu sesuai jadwal|tanpa waktu tunggu lama}}'
  },
  {
    pattern: /\b(murah|terjangkau|hemat)\b/gi,
    replacement: '{terjangkau|hemat anggaran|{kompetitif dan transparan|rasional tanpa biaya tersembunyi|ramah di kantong}}'
  },
  {
    pattern: /\b(bergaransi|jaminan)\b/gi,
    replacement: '{bergaransi resmi|dilengkapi jaminan mutu|{memiliki garansi tertulis|dijamin keamanannya|didukung layanan purna jual}}'
  },
  {
    pattern: /\b(pelanggan|klien|konsumen)\b/gi,
    replacement: '{pelanggan|klien|{pemilik properti|masyarakat maupun pelaku usaha|pengguna jasa}}'
  },
  {
    pattern: /\b(masalah|kendala|kerusakan)\b/gi,
    replacement: '{masalah|kendala|{hambatan teknis|gangguan fungsi|persoalan di lapangan}}'
  },
  {
    pattern: /\b(solusi|jalan keluar|penanganan)\b/gi,
    replacement: '{solusi|penanganan|{langkah penyelesaian|metode perbaikan|pendekatan teknis}}'
  },
  {
    pattern: /\b(kualitas|mutu)\b/gi,
    replacement: '{kualitas|mutu|{standar hasil kerja|ketahanan jangka panjang|performa pengerjaan}}'
  },
  {
    pattern: /\b(biaya|harga|tarif|anggaran)\b/gi,
    replacement: '{biaya|estimasi anggaran|{rincian harga|skema tarif|investasi pengerjaan}}'
  },
  {
    pattern: /\b(tim|teknisi|petugas)\b/gi,
    replacement: '{tim teknis|personel lapangan|{tenaga spesialis|teknisi berpengalaman|petugas operasional}}'
  },
  {
    pattern: /\b(rumah|bangunan|gedung|properti)\b/gi,
    replacement: '{hunian|bangunan|{properti rumah tangga|gedung komersial|tempat usaha}}'
  },
  {
    pattern: /\b(penting|krusial|utama)\b/gi,
    replacement: '{penting|krusial|{sangat menentukan|menjadi prioritas utama|wajib diperhatikan}}'
  },
  {
    pattern: /\b(memberikan|menghadirkan|menyediakan)\b/gi,
    replacement: '{memberikan|menghadirkan|{menyediakan|menawarkan|memastikan}}'
  },
  {
    pattern: /\b(mendapatkan|memperoleh|meraih)\b/gi,
    replacement: '{mendapatkan|memperoleh|{menerima secara langsung|merasakan manfaat|memastikan}}'
  },
  {
    pattern: /\b(pemasangan|instalasi|pengerjaan)\b/gi,
    replacement: '{pemasangan|instalasi|{pengerjaan teknis|implementasi sistem|penanganan lapangan}}'
  },
  {
    pattern: /\b(sesuai|selaras|mengikuti)\b/gi,
    replacement: '{sesuai|mengikuti|{selaras dengan|berdasarkan perhitungan|disesuaikan dengan}}'
  },
  {
    pattern: /\b(kebutuhan|keperluan|permintaan)\b/gi,
    replacement: '{kebutuhan|keperluan|{permintaan aktual|skala pemakaian|spesifikasi}}'
  },
  {
    pattern: /\b(setiap|seluruh|semua)\b/gi,
    replacement: '{setiap|seluruh|{masing-masing|semua|tiap-tiap}}'
  },
  {
    pattern: /\b(untuk|bagi|guna)\b/gi,
    replacement: '{untuk|bagi|{guna memenuhi|dalam mendukung|khusus}}'
  },
  {
    pattern: /\b(dengan|memakai|menggunakan)\b/gi,
    replacement: '{dengan|menggunakan|{berbekal|didukung|memanfaatkan}}'
  },
  {
    pattern: /\b(memiliki|mempunyai|punya)\b/gi,
    replacement: '{memiliki|mempunyai|{menghadirkan|dilengkapi dengan|menawarkan}}'
  },
  {
    pattern: /\b(sangat|amat|begitu)\b/gi,
    replacement: '{sangat|begitu|{luar biasa|cukup|benar-benar}}'
  },
  {
    pattern: /\b(banyak|beragam|berbagai)\b/gi,
    replacement: '{banyak|berbagai|{beragam|sejumlah|puluhan hingga ratusan}}'
  },
  {
    pattern: /\b(populer|terkenal|favorit)\b/gi,
    replacement: '{populer|terkenal|{banyak diminati|menjadi favorit|dikenal luas}}'
  },
  {
    pattern: /\b(khas|unik|spesial|istimewa)\b/gi,
    replacement: '{khas|unik|{istimewa|berkarakter kuat|sulit ditandingi}}'
  },
  {
    pattern: /\b(produk|barang|komoditas|menu)\b/gi,
    replacement: '{produk|pilihan utama|{varian unggulan|koleksi terbaik|penawaran spesial}}'
  },
  {
    pattern: /\b(membuat|menjadikan|menciptakan)\b/gi,
    replacement: '{membuat|menjadikan|{menciptakan|menghasilkan|mendorong}}'
  },
  {
    pattern: /\b(membantu|mendukung|memudahkan)\b/gi,
    replacement: '{membantu|mendukung|{memudahkan|mempercepat|mengoptimalkan}}'
  },
  {
    pattern: /\b(menjaga|merawat|mempertahankan)\b/gi,
    replacement: '{menjaga|mempertahankan|{merawat|melindungi|memastikan konsistensi}}'
  },
  {
    pattern: /\b(cocok|tepat|ideal)\b/gi,
    replacement: '{cocok|tepat|{ideal|sangat sesuai|pas}}'
  },
  {
    pattern: /\b(nikmat|lezat|enak|segar)\b/gi,
    replacement: '{nikmat|berkualitas|{segar dan autentik|memanjakan selera|bercita rasa tinggi}}'
  },
  {
    pattern: /\b(lokasi|tempat|area|kawasan)\b/gi,
    replacement: '{lokasi|kawasan|{area sekitar|titik strategis|wilayah}}'
  },
  {
    pattern: /\b(sekarang|kini|saat ini)\b/gi,
    replacement: '{kini|saat ini|{pada era modern ini|sekarang juga|hari ini}}'
  },
  {
    pattern: /\b(hubungi|kontak|kunjungi)\b/gi,
    replacement: '{hubungi|kunjungi|{konsultasikan bersama|akses layanan|temui tim}}'
  },
  {
    pattern: /\b(dunia|pasar|industri)\b/gi,
    replacement: '{pasar luas|berbagai kalangan|{skala nasional hingga global|komunitas luas|industri terkait}}'
  }
];

const EN_NESTED_DICTIONARY = [
  {
    pattern: /\b(service|services)\b/gi,
    replacement: '{service|professional assistance|{technical solutions|specialized support|dedicated service}}'
  },
  {
    pattern: /\b(best|top|leading)\b/gi,
    replacement: '{best|top-rated|{industry-leading|highly recommended|premier}}'
  },
  {
    pattern: /\b(trusted|reliable|dependable)\b/gi,
    replacement: '{trusted|reliable|{fully certified|proven and dependable|well-established}}'
  },
  {
    pattern: /\b(professional|expert|experienced)\b/gi,
    replacement: '{professional|expert|{highly experienced|certified specialist|skilled technical}}'
  },
  {
    pattern: /\b(fast|quick|rapid)\b/gi,
    replacement: '{fast|prompt|{rapid-response|on-schedule|time-efficient}}'
  },
  {
    pattern: /\b(affordable|cheap|cost-effective)\b/gi,
    replacement: '{affordable|cost-effective|{transparently priced|budget-friendly|competitively priced}}'
  },
  {
    pattern: /\b(quality|standard)\b/gi,
    replacement: '{quality|craftsmanship|{long-lasting performance|strict quality standard|durability}}'
  },
  {
    pattern: /\b(customer|customers|client|clients)\b/gi,
    replacement: '{customers|clients|{property owners|local businesses and residents|homeowners}}'
  }
];

/**
 * Automatically detects the language of raw text or nested spintax text.
 * Returns { languageCode: 'id' | 'en' | 'mixed', label, confidence, idScore, enScore }
 */
function detectArticleLanguage(rawText) {
  const clean = String(rawText || '')
    .replace(/\{\{[a-zA-Z0-9_]+\}\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[{}|]/g, ' ')
    .toLowerCase();

  const words = clean.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  let idHits = 0;
  let enHits = 0;

  for (const w of words) {
    if (ID_MARKERS.has(w)) idHits++;
    if (EN_MARKERS.has(w)) enHits++;
    // Indonesian morphological affixes (me-, ber-, pe-, -kan, -nya, -an)
    if (/^(meny|meng|mem|ber|ter|per|ke)[a-z]{4,}(kan|i|an|nya)?$/.test(w)) {
      idHits += 0.5;
    }
    if (/^[a-z]{4,}(tion|ment|ness|able|ively)$/.test(w)) {
      enHits += 0.5;
    }
  }

  const totalSignal = Math.max(1, idHits + enHits);
  const idRatio = idHits / totalSignal;
  const enRatio = enHits / totalSignal;

  let languageCode = 'id';
  let label = 'Bahasa Indonesia (Terdeteksi Otomatis)';

  if (idHits > 0 && enHits > 0 && idRatio >= 0.25 && enRatio >= 0.25) {
    languageCode = 'mixed';
    label = 'Bilingual / Campuran Indonesia + Inggris (Terdeteksi Otomatis)';
  } else if (enHits > idHits) {
    languageCode = 'en';
    label = 'English (Auto-Detected)';
  }

  const confidence = Number(Math.min(0.99, Math.max(0.65, Math.max(idRatio, enRatio))).toFixed(2));

  return {
    languageCode,
    label,
    confidence,
    idScore: Number(idHits.toFixed(1)),
    enScore: Number(enHits.toFixed(1)),
    wordCount: words.length
  };
}

/**
 * Automatically converts a user's plain "Artikel Utama" into a Multi-Level Nested Spintax body,
 * adapting to the automatically detected language ('id', 'en', or 'mixed') and injecting
 * regional hooks ({{kecamatan}}, {{label_kota_kabupaten}}, {{wilayah}}) so every paragraph
 * has deep structural variation.
 */
function autoSpinRawArticle(rawArticleText, { topic = 'Layanan Profesional', forceLanguage = 'auto' } = {}) {
  const input = String(rawArticleText || '').trim();
  const detection = detectArticleLanguage(input || topic);
  const lang = forceLanguage && forceLanguage !== 'auto' ? forceLanguage : detection.languageCode;

  if (!input) {
    return {
      detectedLanguage: detection,
      spunArticleBody: '',
      blocksCreated: 0
    };
  }

  const normalizedInput = input.replace(/(^|\n)(#{1,3}\s+[^\n]+)\n(?!\n)/g, '$1$2\n\n');
  const paragraphs = normalizedInput
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const dictionary =
    lang === 'en'
      ? EN_NESTED_DICTIONARY
      : lang === 'mixed'
        ? [...ID_NESTED_DICTIONARY, ...EN_NESTED_DICTIONARY]
        : ID_NESTED_DICTIONARY;

  let blocksCreated = 0;

  const spunParagraphs = paragraphs.map((para, pIdx) => {
    // Preserve headings or HTML blocks if present
    let headingPrefix = '';
    let bodyText = para;
    const headingMatch = para.match(/^(#{1,3}\s+)/);
    if (headingMatch) {
      headingPrefix = headingMatch[1];
      bodyText = para.slice(headingPrefix.length);
    }

    // Apply nested lexical/phrase spintax dictionary only outside existing {...} or {{...}}
    let transformed = bodyText;
    for (const rule of dictionary) {
      transformed = transformed.replace(rule.pattern, (match, _g1, offset, fullStr) => {
        // Avoid replacing inside an already open {spintax} or {{geo}}
        const before = fullStr.slice(0, offset);
        const openBraces = (before.match(/\{/g) || []).length;
        const closeBraces = (before.match(/\}/g) || []).length;
        if (openBraces > closeBraces) return match;
        blocksCreated++;
        return rule.replacement;
      });
    }

    // Wrap each paragraph with nested opening & closing contextual sentence variations
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
      const enClosers = [
        `{This approach guarantees {long-term reliability|maximum efficiency|complete peace of mind} for every client in Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}.|Therefore, property owners in {{kecamatan}} ({{wilayah}}) always receive {verifiable quality|transparent pricing|dependable after-sales support}.|Our commitment across {{label_kota_kabupaten}}, especially in {{kecamatan}}, is built on {proven field results|certified workmanship|timely project delivery}.|That is why residents in Kecamatan {{kecamatan}} consistently trust our {structured workflow|dedicated local technicians|comprehensive service warranty}.|Every step executed in {{kecamatan}} ({{kota_kabupaten}}) is designed to {prevent recurring issues|optimize your budget|deliver lasting value}.|By focusing on the specific needs of {{kecamatan}}, we provide {faster response times|accurate technical assessments|superior service standards} in {{wilayah}}.|Ultimately, clients in Kecamatan {{kecamatan}} enjoy {hassle-free execution|guaranteed satisfaction|professional support from start to finish}.}`
      ];
      const opener = enOpeners[pIdx % enOpeners.length];
      blocksCreated += 3;
      return `${opener} ${transformed} ${enClosers[0]}`;
    }

    // Default Indonesian / Mixed nested sentence wrapper
    const idOpeners = [
      `{Khusus bagi warga serta pelaku usaha di <strong>Kecamatan {{kecamatan}}</strong> ({{label_kota_kabupaten}}),|Dalam memenuhi kebutuhan masyarakat di seputar <strong>Kecamatan {{kecamatan}}</strong>, Provinsi {{wilayah}},|Seiring berkembangnya kawasan {{kecamatan}} sebagai {{konteks_kecamatan}} di {{label_kota_kabupaten}},|Ketika merencanakan kebutuhan di wilayah <strong>Kecamatan {{kecamatan}}</strong> ({{kota_kabupaten}}),|Demi menjamin hasil yang presisi bagi pelanggan di <strong>Kecamatan {{kecamatan}}</strong>,|Bagi pemilik hunian maupun pengelola gedung di koridor {{kecamatan}}, {{label_kota_kabupaten}},|Menjawab tingginya permintaan di area <strong>Kecamatan {{kecamatan}}</strong> ({{wilayah}}),}`,
      `{Lebih lanjut, penerapan standar kerja di kawasan <strong>Kecamatan {{kecamatan}}</strong> ({{label_kota_kabupaten}}) memastikan bahwa|Di samping itu, dukungan tim lokal kami yang menjangkau <strong>Kecamatan {{kecamatan}}</strong> membuktikan bahwa|Tidak hanya itu, setiap tahapan yang dijalankan untuk area {{kecamatan}} di {{kota_kabupaten}} dirancang agar|Secara teknis, karakteristik lingkungan di <strong>Kecamatan {{kecamatan}}</strong> ({{konteks_kecamatan}}) menuntut agar|Untuk menjaga kepuasan pelanggan di seluruh kelurahan <strong>Kecamatan {{kecamatan}}</strong> ({{wilayah}}),|Sebagai mitra resmi di {{label_kota_kabupaten}}, operasional kami di {{kecamatan}} mengutamakan bahwa|Melalui pengawasan mutu berlapis di lokasi Anda di <strong>Kecamatan {{kecamatan}}</strong>,}`
    ];

    const idClosers = [
      `{Pendekatan ini memastikan setiap pelanggan di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} mendapatkan <u>{jaminan mutu tertulis|kepastian jadwal pengerjaan|efisiensi anggaran yang terukur}</u>.|Dengan demikian, kebutuhan Anda di area {{kecamatan}} ({{wilayah}}) dapat {ditangani secara tuntas sejak kunjungan pertama|diselesaikan tepat waktu tanpa biaya tersembunyi|memberikan manfaat jangka panjang yang optimal}.|Komitmen operasional kami di {{label_kota_kabupaten}}, khususnya koridor {{kecamatan}}, selalu bertumpu pada {ketelitian diagnosa lapangan|penggunaan peralatan berstandar tinggi|kemudahan layanan purna jual}.|Itulah alasan mengapa banyak pelanggan rumah tangga maupun komersial di Kecamatan {{kecamatan}} mempercayakan penanganannya kepada {tim spesialis kami|unit teknis {{kota_kabupaten}} kami|layanan resmi kami di {{wilayah}}}.|Seluruh prosedur di Kecamatan {{kecamatan}} tersebut dieksekusi untuk {mencegah risiko kendala berulang|menjaga keamanan fungsi properti Anda|memberikan rasio harga dan kualitas terbaik}.|Kedekatan armada teknis kami dari pusat {{label_kota_kabupaten}} menuju {{kecamatan}} juga menjamin {kecepatan respons survei lokasi|fleksibilitas jadwal pengerjaan|kemudahan klaim garansi kapan pun dibutuhkan}.|Hasil akhirnya, warga di Kecamatan {{kecamatan}} ({{wilayah}}) memperoleh solusi yang <u>{rapi, aman, dan bergaransi resmi|transparan serta teruji kualitasnya|hemat biaya perawatan tahunan}</u>.}`
    ];

    const opener = idOpeners[pIdx % idOpeners.length];
    blocksCreated += 4;
    return `${opener} ${transformed} ${idClosers[0]}`;
  });

  return {
    detectedLanguage: detection,
    spunArticleBody: spunParagraphs.join('\n\n'),
    blocksCreated
  };
}

/**
 * Wraps a spun article body with an automatic Template Wrapper:
 * 1. Auto-Header (H1 Title + Meta/Regional Intro)
 * 2. Auto-Gallery / Project Reference Images (rotating from up to 99 project images with topic-matched title & alt)
 * 3. Spun Core Article Body (from user's main article column or blueprint)
 * 4. Auto-URL / Contextual Backlink Block
 * 5. Auto-CTA & Click-to-WhatsApp Footer Block + FAQ Schema
 */
function assembleAutoTemplate({
  spunBody,
  topic = 'Jasa Instalasi Panel Surya & Audit Energi',
  callToAction = 'Hubungi konsultan teknis kami untuk jadwal survei gratis',
  whatsappNumber = '6281234567890',
  whatsappLabel = 'Chat WhatsApp Konsultan Sekarang',
  targetUrl = 'https://nusantaraseo.id/layanan-resmi',
  anchorText = 'halaman layanan resmi kami',
  linkRel = 'dofollow',
  enableBoldKeywords = true,
  enableUnderlineBenefits = true,
  enableImageBlock = true,
  enableHyperlink = true,
  enableWhatsappCta = true,
  enableFaqSchema = true,
  imagesPerArticle = 2
} = {}) {
  const cleanTopic = String(topic || 'Layanan Profesional').trim();
  const relAttr = linkRel === 'nofollow' ? ' rel="nofollow noopener"' : ' rel="noopener"';

  const autoHeader = `# {Panduan Lengkap & Solusi|Rekomendasi Terbaik|Layanan Spesialis|Pusat Layanan Terpercaya|Solusi Profesional|Mitra Resmi|Tim Ahli} ${cleanTopic} {di Kecamatan {{kecamatan}} ({{label_kota_kabupaten}})|Area {{kecamatan}} – {{kota_kabupaten}}, {{wilayah}}|Wilayah {{kecamatan}} & Sekitarnya|Khusus Kecamatan {{kecamatan}}, {{wilayah}}|Terdekat di {{kecamatan}}, {{jenis_daerah}} {{kota_kabupaten}}|Koridor {{kecamatan}} ({{wilayah}})|Cakupan Area {{kecamatan}}}`;

  const waTopHtml = enableWhatsappCta
    ? `<div class="wa-cta-box wa-cta-top"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel || 'Chat WhatsApp Konsultan Sekarang'}|Konsultasi Cepat via WhatsApp ({{kecamatan}})|Hubungi WhatsApp Resmi Area {{kecamatan}}|Respon Cepat WhatsApp Cabang {{kota_kabupaten}}} ({{wa_number}})</a></div>`
    : '';

  const imagePlaceholderBlock = enableImageBlock
    ? `{{PROJECT_IMAGES_BLOCK}}`
    : '';

  const autoUrlBlock = enableHyperlink && targetUrl
    ? `## {Informasi Resmi & Referensi Layanan|Portal Layanan & Spesifikasi Teknis|Tautan Resmi Layanan Pelanggan|Pusat Informasi & Portofolio Kerja|Rujukan Teknis & Katalog Layanan|Akses Informasi Resmi Cabang|Referensi Lengkap Layanan} di {{label_kota_kabupaten}}\n\n{Untuk melihat rincian standar operasional serta cakupan wilayah kerja kami di Provinsi {{wilayah}}, silakan kunjungi|Informasi lebih mendalam mengenai spesifikasi pengerjaan untuk area Kecamatan {{kecamatan}} dapat Anda akses melalui|Anda juga dapat memeriksa daftar layanan lengkap serta portofolio terbaru kami di {{label_kota_kabupaten}} pada|Guna memastikan transparansi prosedur dan rincian layanan di Kecamatan {{kecamatan}}, silakan buka|Pelajari lebih lanjut mengenai standar kualitas dan jaminan layanan kami di {{kota_kabupaten}} dengan mengunjungi|Referensi teknis serta panduan pemesanan jadwal survei untuk kawasan {{kecamatan}} tersedia secara lengkap di|Dapatkan pembaruan informasi layanan resmi untuk seluruh area {{label_kota_kabupaten}} melalui} <a href="{{target_url}}" target="_blank"${relAttr}><strong>{${anchorText || 'halaman layanan resmi kami'}|portal resmi ${cleanTopic} {{kota_kabupaten}}|halaman utama layanan {{label_kota_kabupaten}}|katalog spesifikasi ${cleanTopic} {{wilayah}}|pusat informasi resmi kami}</strong></a>.`
    : '';

  const faqBlock = enableFaqSchema
    ? `## {Tanya Jawab (FAQ)|Pertanyaan Umum Pelanggan|Informasi Penting|Panduan Tanya Jawab|Hal yang Sering Ditanyakan|FAQ Layanan Lokal|Penjelasan Singkat} Seputar ${cleanTopic} di Kecamatan {{kecamatan}}\n\n### {Apakah melayani kunjungan survei ke seluruh kelurahan di Kecamatan {{kecamatan}}?|Bagaimana prosedur pemesanan jadwal ke area {{kecamatan}}, {{kota_kabupaten}}?|Berapa cepat tim teknis dapat menjangkau lokasi di {{kecamatan}}?|Apakah seluruh titik di Kecamatan {{kecamatan}} masuk dalam rute layanan?|Bagaimana cara mengatur jadwal inspeksi awal di {{kecamatan}}?|Apakah tersedia pengecekan lokasi langsung di area {{kecamatan}}?|Dapatkah teknisi langsung datang ke lokasi di Kecamatan {{kecamatan}}?}\n\n{Ya, tim operasional kami di {{label_kota_kabupaten}} menjangkau seluruh area Kecamatan {{kecamatan}} dengan penjadwalan fleksibel.|Tentu, petugas lapangan kami siap mengunjungi titik lokasi Anda di {{kecamatan}} setelah koordinasi waktu melalui WhatsApp.|Benar, seluruh kawasan pemukiman maupun komersial di Kecamatan {{kecamatan}} ({{wilayah}}) termasuk dalam rute prioritas kami.|Kami melayani kunjungan survei terjadwal maupun kebutuhan mendesak untuk seluruh pelanggan di lingkup Kecamatan {{kecamatan}}.|Tim teknis cabang {{kota_kabupaten}} rutin bertugas di area {{kecamatan}} sehingga proses penjadwalan sangat cepat.|Anda cukup mengirimkan titik lokasi di Kecamatan {{kecamatan}} dan koordinator kami segera mengatur jadwal kedatangan.|Seluruh jalan utama hingga area perumahan di Kecamatan {{kecamatan}} dapat dijangkau dengan cepat oleh armada kami.}`
    : '';

  const waButtonHtml = enableWhatsappCta
    ? `\n\n<div class="wa-cta-box wa-cta-bottom"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel || 'Chat WhatsApp Konsultan Sekarang'}|Klik untuk Chat WhatsApp Area {{kecamatan}}|Hubungi WhatsApp Resmi Cabang {{kota_kabupaten}}|Konsultasi Cepat via WhatsApp ({{kecamatan}})|Respon Cepat WhatsApp Tim Teknis {{kecamatan}}|Tanya Estimasi Biaya via WhatsApp|Jadwalkan Survei via WhatsApp Sekarang} ({{wa_number}})</a></div>`
    : '';

  const autoCtaFooter = `## {Jadwalkan Survei di {{kecamatan}}|Hubungi Spesialis Area {{kecamatan}}|Konsultasi Kebutuhan Anda|Dapatkan Estimasi Wilayah {{kecamatan}}|Layanan Cepat Area {{kecamatan}}|Diskusikan Proyek Anda di {{kecamatan}}|Kontak Tim Teknis {{kota_kabupaten}}}\n\n{Jangan tunda kebutuhan <strong>${cleanTopic}</strong> di lokasi Anda. ${callToAction} untuk seluruh area Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}}).|Siap memperoleh penanganan <strong>${cleanTopic}</strong> yang rapi, transparan, dan bergaransi di {{kecamatan}}? ${callToAction} — tim {{kota_kabupaten}} kami siap melayani.|Untuk tanya jawab teknis, rincian anggaran, maupun jadwal kunjungan ke Kecamatan {{kecamatan}} ({{label_kota_kabupaten}}), segera hubungi kami. ${callToAction}.|Pastikan proyek <strong>${cleanTopic}</strong> Anda di Kecamatan {{kecamatan}} ditangani oleh tenaga kompeten. ${callToAction} dan dapatkan solusi terbaik di {{wilayah}}.|Kami siap mendampingi kebutuhan <strong>${cleanTopic}</strong> rumah tangga maupun komersial di {{kecamatan}}, {{jenis_daerah}} {{kota_kabupaten}}. ${callToAction}.|Ambil langkah tepat hari ini untuk kebutuhan <strong>${cleanTopic}</strong> di kawasan {{kecamatan}}. ${callToAction} bersama tim profesional {{label_kota_kabupaten}}.|Wujudkan pengerjaan <strong>${cleanTopic}</strong> yang aman dan tepat anggaran di Kecamatan {{kecamatan}}. ${callToAction} sekarang juga.}${waButtonHtml}`;

  const bodyStr = String(spunBody || '').trim();
  const hasOwnH1 = /^#\s+/m.test(bodyStr);
  const hasOwnFaq = /^#{2,3}\s+.*(faq|tanya jawab|pertanyaan)/im.test(bodyStr);

  if (hasOwnH1) {
    const lines = bodyStr.split('\n');
    const firstLine = lines[0];
    const restBody = lines.slice(1).join('\n').trim();
    return [
      firstLine,
      waTopHtml,
      imagePlaceholderBlock,
      restBody,
      autoUrlBlock,
      hasOwnFaq ? '' : faqBlock,
      waButtonHtml ? waButtonHtml.trim() : ''
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [autoHeader, waTopHtml, imagePlaceholderBlock, bodyStr, autoUrlBlock, hasOwnFaq ? '' : faqBlock, autoCtaFooter]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Calculates how many unique articles can be generated mathematically vs
 * the SAFE RECOMMENDED number of articles to prevent "artikel sampah" (thin/duplicate doorway spam).
 */
function calculateSafeArticleCapacity({
  spintaxTemplate = '',
  projectImageCount = 1,
  requestedArticleCount = 5
} = {}) {
  const clean = String(spintaxTemplate || '').replace(/\{\{[a-zA-Z0-9_]+\}\}/g, 'GEO');
  const innerRegex = /\{([^{}]+)\}/g;

  let totalBlocks = 0;
  let sentenceLevelBlocks = 0; // blocks where options have >= 5 words
  let wordLevelBlocks = 0;
  let log10Combinations = 0;
  let totalBranchOptions = 0;

  let working = clean;
  let guard = 0;
  while (innerRegex.test(working) && guard < 50) {
    guard++;
    working = working.replace(innerRegex, (_, content) => {
      const opts = content.split('|');
      if (opts.length > 1) {
        totalBlocks++;
        totalBranchOptions += opts.length;
        log10Combinations += Math.log10(opts.length);
        const avgWords =
          opts.reduce((acc, o) => acc + o.trim().split(/\s+/).length, 0) / opts.length;
        if (avgWords >= 5) {
          sentenceLevelBlocks++;
        } else {
          wordLevelBlocks++;
        }
      }
      return 'RESOLVED_BLOCK';
    });
  }

  let formattedMaxCombinations = '1';
  if (log10Combinations > 0 && log10Combinations < 12) {
    formattedMaxCombinations = Math.round(Math.pow(10, log10Combinations)).toLocaleString('id-ID');
  } else if (log10Combinations >= 12) {
    const exp = Math.floor(log10Combinations);
    const mant = Math.pow(10, log10Combinations - exp).toFixed(1);
    formattedMaxCombinations = `${mant} × 10^${exp} kemungkinan`;
  }

  // Anti-Trash / Anti-Doorway Formula:
  // Even if mathematical permutations are 10^20, Google & Copyscape look at 4-gram shingle diversity
  // and visual media diversity. Each sentence-level block adds ~8 safe unique articles,
  // each word-level block adds ~1.5, and rotating from a pool of up to 99 images adds visual uniqueness.
  const clampedImages = Math.max(1, Math.min(99, Number(projectImageCount) || 1));
  const baseSafeFromText = Math.max(
    1,
    Math.round(sentenceLevelBlocks * 7 + wordLevelBlocks * 1.8)
  );
  const imageDiversityBonus = Math.min(40, Math.round(clampedImages * 0.6));
  const recommendedSafeMaxArticles = Math.min(
    250,
    Math.max(3, baseSafeFromText + imageDiversityBonus)
  );
  const optimalSweetSpot = Math.max(
    3,
    Math.min(recommendedSafeMaxArticles, Math.round(recommendedSafeMaxArticles * 0.65))
  );

  let status = 'AMAN_BEBAS_SAMPAH';
  let statusBadge = 'AMAN (Bebas Artikel Sampah & Lolos Copyscape)';
  let advice = `Kombinasi ${sentenceLevelBlocks} blok struktur kalimat, ${wordLevelBlocks} blok sinonim kata, dan ${clampedImages} gambar referensi sanggup menghasilkan hingga ${recommendedSafeMaxArticles} artikel daerah yang unik tanpa terdeteksi sebagai artikel sampah/duplikat.`;

  if (totalBlocks < 5) {
    status = 'RISIKO_TINGGI_SAMPAH';
    statusBadge = 'PERINGATAN: Variasi Spintax Terlalu Sedikit (Risiko Artikel Sampah)';
    advice = `Artikel hanya memiliki ${totalBlocks} blok spintax. Gunakan tombol "Auto-Spin Artikel Utama" agar sistem membuat variasi kalimat berlapis sebelum men-generate lebih dari 3 daerah.`;
  } else if (requestedArticleCount > recommendedSafeMaxArticles) {
    status = 'MELEBIHI_BATAS_AMAN';
    statusBadge = `PERINGATAN: Target (${requestedArticleCount}) Melebihi Rekomendasi Aman (${recommendedSafeMaxArticles})`;
    advice = `Men-generate ${requestedArticleCount} artikel dari template ini berisiko meningkatkan kemiripan frasa di atas 14%. Disarankan maksimal ${recommendedSafeMaxArticles} artikel per batch (ideal: ${optimalSweetSpot} artikel) atau tambahkan paragraf/gambar referensi baru.`;
  }

  return {
    totalBlocks,
    sentenceLevelBlocks,
    wordLevelBlocks,
    projectImageCount: clampedImages,
    log10Combinations: Number(log10Combinations.toFixed(2)),
    formattedMaxCombinations,
    recommendedSafeMaxArticles,
    optimalSweetSpot,
    requestedArticleCount,
    status,
    statusBadge,
    advice
  };
}

module.exports = {
  detectArticleLanguage,
  autoSpinRawArticle,
  assembleAutoTemplate,
  calculateSafeArticleCapacity
};
