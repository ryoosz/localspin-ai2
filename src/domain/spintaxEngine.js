const crypto = require('node:crypto');

/**
 * Deterministic PRNG based on string/number seed.
 */
function createSeededRandom(seedInput) {
  let hash = crypto.createHash('sha256').update(String(seedInput)).digest();
  let offset = 0;
  return function nextInt(max) {
    if (offset + 4 > hash.length) {
      hash = crypto.createHash('sha256').update(hash).digest();
      offset = 0;
    }
    const uint = hash.readUInt32BE(offset);
    offset += 4;
    return uint % Math.max(1, max);
  };
}

/**
 * Resolves nested spintax `{option1|option2|{sub1|sub2}}` from innermost braces outward.
 * Uses Latin-square orthogonal branch rotation (`regionOffset`) so that across N regions,
 * each region systematically selects a mutually exclusive branch before any branch repeats.
 */
function resolveSpintax(template, seed = 'default-seed', regionOffset = 0) {
  if (typeof template !== 'string') return '';

  // Protect double-curly geo variables {{var}} by temporary token replacement
  const geoTokens = [];
  let working = template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const idx = geoTokens.length;
    geoTokens.push(key);
    return `__GEO_VAR_${idx}__`;
  });

  const nextInt = createSeededRandom(seed);
  const innermostRegex = /\{([^{}]+)\}/g;
  let guard = 0;
  let blockCounter = 0;

  while (innermostRegex.test(working) && guard < 60) {
    guard++;
    working = working.replace(innermostRegex, (_, content) => {
      const options = content.split('|');
      if (options.length <= 1) return content;
      blockCounter++;
      const baseIndex = nextInt(options.length);
      const index = (baseIndex + regionOffset + blockCounter) % options.length;
      return options[index].trim();
    });
  }

  // Restore {{var}} tokens
  working = working.replace(/__GEO_VAR_(\d+)__/g, (_, idx) => `{{${geoTokens[Number(idx)]}}}`);
  return working;
}

/**
 * Automatically converts a multi-word phrase (like a long CTA) into
 * spintax variations if it isn't already spun, preventing verbatim 4-gram collisions.
 */
function spinLongPhrase(phrase, fallbackVariants) {
  const words = String(phrase || '').trim().split(/\s+/);
  if (words.length <= 3) return phrase;
  return `{${phrase}|${fallbackVariants.join('|')}}`;
}

/**
 * Builds a clean WhatsApp click-to-chat URL (`https://wa.me/...`) with dynamic regional message.
 */
function buildWhatsAppUrl(phoneRaw, messageText) {
  const digits = String(phoneRaw || '6281234567890').replace(/[^0-9]/g, '');
  const normalizedPhone = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`;
  const encodedMsg = encodeURIComponent(String(messageText || '').trim());
  return `https://wa.me/${normalizedPhone}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
}

/**
 * Injects regional and SEO variables into the template or resolved text.
 */
function injectGeoVariables(text, geoTarget, extraVars = {}) {
  if (typeof text !== 'string') return '';
  const wilayah = geoTarget.wilayah || 'Jawa Barat';
  const jenisDaerah = geoTarget.jenisDaerah || 'Kota';
  const kotaKabupaten = geoTarget.kotaKabupaten || 'Bandung';
  const labelKotaKabupaten =
    geoTarget.labelKotaKabupaten || `${jenisDaerah} ${kotaKabupaten}`;
  const kecamatan = geoTarget.kecamatan || 'Coblong';
  const topic = extraVars.topic || 'Layanan Profesional';

  const defaultGreeting = `Halo Admin, saya tertarik dengan {{topik}} untuk area Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}}). Mohon info estimasi & jadwal surveinya ya.`;
  const rawGreeting = String(extraVars.whatsappGreeting || defaultGreeting);
  const waMessage = rawGreeting
    .replace(/\{\{\s*topik\s*\}\}/gi, topic)
    .replace(/\{\{\s*kecamatan\s*\}\}/gi, kecamatan)
    .replace(/\{\{\s*label_kota_kabupaten\s*\}\}/gi, labelKotaKabupaten)
    .replace(/\{\{\s*kota_kabupaten\s*\}\}/gi, kotaKabupaten)
    .replace(/\{\{\s*wilayah\s*\}\}/gi, wilayah);
  const waUrl = buildWhatsAppUrl(extraVars.whatsappNumber || '6281234567890', waMessage);

  const map = {
    wilayah,
    jenis_daerah: jenisDaerah,
    kota_kabupaten: kotaKabupaten,
    label_kota_kabupaten: labelKotaKabupaten,
    kecamatan,
    konteks_wilayah: geoTarget.konteksWilayah || 'kawasan ekonomi strategis',
    konteks_daerah: geoTarget.konteksDaerah || 'pusat aktivitas niaga dan pemukiman warga',
    konteks_kecamatan: geoTarget.konteksKecamatan || 'area pemukiman dan komersial aktif',
    topik: topic,
    cta: extraVars.callToAction || 'Hubungi tim konsultan kami sekarang',
    wa_number: extraVars.whatsappNumber || '6281234567890',
    wa_url: waUrl,
    target_url: extraVars.targetUrl || 'https://nusantaraseo.id/layanan-lokal',
    image_url: extraVars.imageUrl || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80'
  };

  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, key) => {
    const normalized = key.toLowerCase();
    return Object.prototype.hasOwnProperty.call(map, normalized) ? map[normalized] : full;
  });
}

/**
 * Counts approximate total unique combinations in a nested spintax string.
 */
function countSpintaxPermutations(template) {
  if (typeof template !== 'string' || !template.trim()) {
    return { totalBlocks: 0, estimatedCombinations: 1, formatted: '1' };
  }

  let working = template.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, 'GEO');
  const innermostRegex = /\{([^{}]+)\}/g;
  let totalBlocks = 0;
  let log10Combinations = 0;

  let guard = 0;
  while (innermostRegex.test(working) && guard < 40) {
    guard++;
    working = working.replace(innermostRegex, (_, content) => {
      const options = content.split('|');
      if (options.length > 1) {
        totalBlocks++;
        log10Combinations += Math.log10(options.length);
      }
      return 'RESOLVED';
    });
  }

  let formatted = '1';
  let numericEstimate = 1;
  if (log10Combinations === 0) {
    formatted = '1';
  } else if (log10Combinations < 12) {
    numericEstimate = Math.round(Math.pow(10, log10Combinations));
    formatted = numericEstimate.toLocaleString('id-ID');
  } else {
    const exp = Math.floor(log10Combinations);
    const mantissa = Math.pow(10, log10Combinations - exp).toFixed(1);
    numericEstimate = Number.MAX_SAFE_INTEGER;
    formatted = `${mantissa} × 10^${exp} variasi unik`;
  }

  return {
    totalBlocks,
    log10Combinations: Number(log10Combinations.toFixed(2)),
    estimatedCombinations: numericEstimate,
    formatted
  };
}

/**
 * Tokenizes a multi-word topic into a micro-spintax expression so that the topic itself
 * does not create repetitive 4-word shingles when mentioned multiple times across articles.
 */
function buildTopicVariationSpintax(topic) {
  const words = String(topic || 'Layanan Profesional').trim().split(/\s+/);
  if (words.length <= 2) {
    return `{layanan ${topic}|jasa ${topic}|penanganan ${topic}|solusi ${topic}|spesialis ${topic}|instalasi & servis ${topic}|unit kerja ${topic}}`;
  }
  const head = words.slice(0, 2).join(' ');
  const tail = words.slice(2).join(' ');
  return `{${topic}|layanan ${head} untuk ${tail}|spesialis ${tail} (${head})|solusi ${head} serta ${tail}|pengerjaan ${tail} oleh tim ${head}|jasa profesional ${tail} – ${head}|penanganan ${head} khusus ${tail}}`;
}

/**
 * Builds a rich Multi-Layer AI Spintax Master Blueprint in Indonesian
 * supporting H1, H2, H3, Bold (<strong>), Underline (<u>), Image + Alt Spintax,
 * Hyperlinks (<a href>), WhatsApp Click-to-Chat CTA, and Local FAQ for Google SEO.
 */
function buildMasterSpintaxBlueprint({
  topic = 'Jasa Instalasi Panel Surya & Audit Energi',
  category = 'jasa-lokal',
  tone = 'profesional',
  callToAction = 'Hubungi tim ahli kami untuk konsultasi dan survei lokasi gratis',
  whatsappNumber = '6281234567890',
  whatsappLabel = 'Chat WhatsApp Konsultan Sekarang',
  targetUrl = 'https://nusantaraseo.id/layanan-resmi',
  anchorText = 'halaman layanan resmi kami',
  linkRel = 'dofollow',
  imageUrl = 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
  imageAltSpintax = '{Dokumentasi pengerjaan|Tim teknisi lapangan|Proses instalasi resmi|Standar kerja profesional} {{topik}} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}',
  enableBoldKeywords = true,
  enableUnderlineBenefits = true,
  enableImageBlock = true,
  enableHyperlink = true,
  enableWhatsappCta = true,
  enableFaqSchema = true
} = {}) {
  const cleanTopic = String(topic || 'Layanan Profesional').trim();
  const cleanCta = String(
    callToAction || 'Hubungi tim spesialis kami untuk jadwal konsultasi dan penawaran resmi'
  ).trim();

  const topicSpin = buildTopicVariationSpintax(cleanTopic);
  const boldTopicSpin = enableBoldKeywords ? `<strong>${topicSpin}</strong>` : topicSpin;
  const boldKecamatan = enableBoldKeywords
    ? `<strong>Kecamatan {{kecamatan}}</strong>`
    : `Kecamatan {{kecamatan}}`;

  const uBenefit1 = enableUnderlineBenefits
    ? `<u>{bergaransi resmi tertulis|transparan tanpa biaya tersembunyi|dikerjakan teknisi bersertifikat|mengikuti standar mutu nasional|didukung layanan purna jual cepat|memiliki kepastian jadwal kerja|menggunakan material orisinal}</u>`
    : `{bergaransi resmi tertulis|transparan tanpa biaya tersembunyi|dikerjakan teknisi bersertifikat|mengikuti standar mutu nasional|didukung layanan purna jual cepat|memiliki kepastian jadwal kerja|menggunakan material orisinal}`;

  const ctaSpin = spinLongPhrase(cleanCta, [
    'Silakan kontak konsultan lapangan kami guna mengatur jadwal pengecekan lokasi',
    'Segera diskusikan rencana anggaran Anda bersama tim teknis resmi kami',
    'Kirimkan detail kebutuhan lokasi Anda agar teknisi kami menyiapkan estimasi akurat',
    'Dapatkan jadwal kunjungan inspeksi langsung dengan menghubungi layanan pelanggan kami',
    'Konsultasikan spesifikasi proyek Anda hari ini tanpa biaya komitmen awal',
    'Terhubung langsung dengan koordinator lapangan kami untuk penawaran terbaik'
  ]);

  const relAttr = linkRel === 'nofollow' ? ' rel="nofollow noopener"' : ' rel="noopener"';
  const hyperlinkSnippet = enableHyperlink && targetUrl
    ? ` Silakan kunjungi <a href="{{target_url}}" target="_blank"${relAttr}>{${anchorText || 'halaman resmi kami'}|portal informasi layanan {{kota_kabupaten}}|katalog spesifikasi teknis kami|daftar portofolio pengerjaan {{wilayah}}|pusat informasi resmi kami|halaman panduan pelanggan|tautan layanan utama kami}</a> untuk referensi lengkap.`
    : '';

  // H1 Title
  const h1Title = `# {Panduan Lengkap|Rekomendasi Terbaik|Layanan Spesialis|Pusat Layanan Terpercaya|Solusi Profesional|Mitra Resmi|Tim Ahli} ${topicSpin} {di Kecamatan {{kecamatan}} ({{label_kota_kabupaten}})|Area {{kecamatan}} – {{kota_kabupaten}}, {{wilayah}}|Wilayah {{kecamatan}} & Sekitarnya|Khusus Kecamatan {{kecamatan}}, {{wilayah}}|Terdekat di {{kecamatan}}, {{jenis_daerah}} {{kota_kabupaten}}|Koridor {{kecamatan}} ({{wilayah}})|Cakupan Area {{kecamatan}}}`;

  // Intro Paragraph with Bold & Underline
  const paragraph1 = [
    `{`,
    `Mencari {rekanan|mitra|penyedia|tim teknis} {terpercaya|berpengalaman|profesional|bersertifikat} dalam hal ${boldTopicSpin} di ${boldKecamatan} {kini jauh lebih praktis berkat sistem kerja terukur|membutuhkan ketelitian agar hasil akhirnya optimal|merupakan langkah penting demi kenyamanan properti Anda}.`,
    `|`,
    `Permintaan masyarakat terhadap ${boldTopicSpin} yang ${uBenefit1} terus tumbuh pesat di seputar ${boldKecamatan}, Provinsi {{wilayah}}.`,
    `|`,
    `Bagi {pemilik hunian maupun pelaku usaha|warga serta pengelola gedung|keluarga maupun instansi bisnis} yang beraktivitas di ${boldKecamatan} ({{label_kota_kabupaten}}), menentukan pelaksana ${boldTopicSpin} memerlukan pertimbangan objektif.`,
    `|`,
    `Pertumbuhan kawasan ${boldKecamatan} sebagai {{konteks_kecamatan}} mendorong {urgensi pengadaan|tingginya kebutuhan|permintaan rutin} atas ${boldTopicSpin} yang ${uBenefit1}.`,
    `|`,
    `Ketika merencanakan pekerjaan ${boldTopicSpin} di lingkup ${boldKecamatan}, {keakuratan diagnosa awal|pemilihan spesifikasi material|kompetensi teknisi lapangan} menjadi kunci keberhasilan jangka panjang.`,
    `|`,
    `Hadirnya dukungan spesialis ${boldTopicSpin} yang menjangkau langsung titik lokasi di ${boldKecamatan} memberikan {kemudahan koordinasi harian|penghematan waktu tunggu survei|solusi praktis bagi warga di {{wilayah}}}.`,
    `|`,
    `Kebutuhan penanganan ${boldTopicSpin} pada kawasan ${boldKecamatan} di {{jenis_daerah}} {{kota_kabupaten}} {kini dapat terlayani secara terjadwal|menuntut kesiapan perangkat kerja berstandar tinggi|memerlukan dukungan personel yang sigap dan jujur}.`,
    `} `,
    `{`,
    `Mengingat pesatnya perkembangan {{label_kota_kabupaten}}, setiap titik pengerjaan di {{kecamatan}} {wajib dievaluasi langsung sebelum eksekusi|memerlukan penyesuaian teknis sesuai kondisi bangunan|tidak boleh ditangani secara asal-asalan}.`,
    `|`,
    `Sejalan dengan dinamika ekonomi Provinsi {{wilayah}}, standar pelaksanaan di {{kecamatan}} {selalu mengacu pada kaidah efisiensi modern|dirancang agar awet serta mudah dirawat|mengutamakan kerapian instalasi}.`,
    `|`,
    `Kondisi spesifik {{kecamatan}} sebagai {{konteks_kecamatan}} menuntut {kesiapan peralatan lengkap sejak kunjungan pertama|dukungan personel yang memahami medan {{kota_kabupaten}}|perencanaan kerja yang sistematis dan terdokumentasi}.`,
    `|`,
    `Faktor lingkungan dan tata ruang di seputaran {{kecamatan}} ({{jenis_daerah}} {{kota_kabupaten}}) menjadikan {tahap inspeksi pendahuluan sangat krusial|pendekatan teknis yang presisi sebagai prioritas utama|pengawasan mutu berlapis sebagai kewajiban tim kami}.`,
    `|`,
    `Dengan memahami profil kawasan {{kecamatan}} secara menyeluruh, proses pelaksanaan ${boldTopicSpin} dapat {diselesaikan lebih efektif tanpa pemborosan anggaran|berjalan lancar sesuai jadwal yang disepakati|memberikan performa maksimal sejak hari pertama}.`,
    `|`,
    `Kedekatan jangkauan operasional kami menuju {{kecamatan}} memastikan {respons cepat untuk kebutuhan reguler maupun mendesak|fleksibilitas penjadwalan kunjungan survei|efisiensi logistik di seluruh koridor {{kota_kabupaten}}}.`,
    `|`,
    `Setiap proyek di wilayah {{kecamatan}} dipersiapkan dengan {perhitungan beban kerja yang matang|pemilihan komponen berkualitas tinggi|koordinasi langsung bersama pemilik lokasi di {{kota_kabupaten}}}.`,
    `}${hyperlinkSnippet}`
  ].join('');

  // Optional SEO Image Block with spun alt text & caption
  const imageSection = enableImageBlock && imageUrl
    ? `<figure class="seo-article-figure"><img src="{{image_url}}" alt="${imageAltSpintax}" loading="lazy" decoding="async" /><figcaption>{Dokumentasi layanan|Ilustrasi pengerjaan standar|Tim operasional lapangan|Standar kualitas teknis|Unit layanan profesional|Penanganan proyek terpadu|Inspeksi teknis lapangan} ${topicSpin} untuk wilayah Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}}).</figcaption></figure>`
    : '';

  // H2 Section 1 + H3 Subheadings
  const paragraph2 = [
    `## {Keunggulan Utama|Nilai Tambah Layanan|Mengapa Warga {{kecamatan}} Memilih|Standar Mutu Pengerjaan|Komitmen Profesional|Faktor Pembeda|Keistimewaan Teknis} di {{kecamatan}}, {{kota_kabupaten}}\n\n`,
    `{`,
    `Tidak sedikit pengguna jasa di {{kota_kabupaten}} yang {pernah kecewa akibat|mengeluhkan kendala berupa|menghindari risiko seperti} {pembengkakan biaya di luar kesepakatan|molornya target penyelesaian pekerjaan|spesifikasi komponen yang diturunkan sepihak}.`,
    `|`,
    `Dalam menyeleksi pelaksana ${boldTopicSpin} untuk area {{kecamatan}}, {kejujuran rincian anggaran|kecepatan tanggap darurat|kelengkapan dokumen garansi|rekam jejak penanganan di {{wilayah}}} merupakan tolok ukur utama.`,
    `|`,
    `Kami menghadirkan metode kerja terstruktur bagi klien di ${boldKecamatan} supaya {aktivitas harian Anda tetap berjalan tenang|setiap rupiah yang diinvestasikan menghasilkan kualitas terbaik|target waktu pengerjaan tercapai secara akurat}.`,
    `|`,
    `Prioritas utama tim kami saat bertugas di {{kecamatan}} ({{label_kota_kabupaten}}) adalah {menjaga keterbukaan informasi teknis sejak awal|memastikan seluruh prosedur standar terpenuhi|memberikan rekomendasi solusi yang paling hemat dan tepat}.`,
    `|`,
    `Berbekal pengalaman menangani beragam karakteristik bangunan di {{wilayah}}, unit ${boldTopicSpin} kami di {{kecamatan}} {mengedepankan ketelitian pengerjaan detail|menjamin kebersihan area kerja pasca-instalasi|menyediakan pendampingan teknis berkelanjutan}.`,
    `|`,
    `Kepercayaan pelanggan di koridor {{kecamatan}} dibangun melalui {konsistensi mutu di lapangan|komunikasi dua arah yang responsif|komitmen penuh terhadap jadwal serta spesifikasi kontrak}.`,
    `|`,
    `Standar operasional yang kami jalankan di {{kecamatan}} ({{kota_kabupaten}}) berfokus pada {ketepatan diagnosa masalah sejak awal|penggunaan suku cadang serta material orisinal|perlindungan garansi kerja yang mudah diklaim}.`,
    `} `,
    `{`,
    `Melalui tahapan ${uBenefit1} di {{kecamatan}}, potensi kendala berulang dapat dicegah sedini mungkin.`,
    `|`,
    `Setiap teknisi yang diterjunkan ke wilayah {{kecamatan}} telah {mengantongi jam terbang tinggi|dilengkapi instrumen kerja terkalibrasi|terlatih menghadapi tantangan teknis lokal} serta ${uBenefit1}.`,
    `|`,
    `Dukungan rantai pasok di {{label_kota_kabupaten}} memungkinkan distribusi perangkat kerja ke {{kecamatan}} {berlangsung tepat waktu|bebas dari hambatan logistik|lebih hemat dari sisi biaya operasional}.`,
    `|`,
    `Kami juga menerapkan {dokumentasi progres bertahap|laporan pemeriksaan sebelum dan sesudah kerja|pengecekan fungsi berlapis} bersama pemilik lokasi di {{kecamatan}}.`,
    `|`,
    `Pendekatan preventif yang kami terapkan di {{kecamatan}} dirancang agar {usia pakai hasil pekerjaan jauh lebih panjang|biaya pemeliharaan rutin tetap ringan|performa sistem tetap stabil sepanjang tahun}.`,
    `|`,
    `Seluruh komponen biaya untuk area {{kecamatan}} disampaikan {secara tertulis di muka|tanpa ada pungutan tambahan tersembunyi|dengan opsi paket yang fleksibel sesuai kebutuhan riil}.`,
    `|`,
    `Kualitas hasil pengerjaan di {{kecamatan}} selalu {diuji menggunakan parameter terukur|diawasi oleh supervisor berpengalaman|disesuaikan dengan standar keselamatan nasional}.`,
    `}\n\n`,
    `### {1. Jaminan Mutu & Spesifikasi Terukur|1. Transparansi Rincian Biaya Sejak Awal|1. Dukungan Teknisi Berpengalaman di {{kota_kabupaten}}|1. Kecepatan Respons Survei ke {{kecamatan}}|1. Standar Keselamatan & Kerapian Kerja|1. Garansi Resmi & Pendampingan Purna Jual|1. Kesiapan Peralatan Kerja Modern}\n\n`,
    `{`,
    `Setiap pengerjaan di ${boldKecamatan} selalu didahului dengan {pengukuran parameter lapangan yang objektif|pengecekan kondisi aktual secara cermat|evaluasi spesifikasi teknis yang transparan} serta ${uBenefit1} sehingga hasil akhirnya benar-benar presisi.`,
    `|`,
    `Pelanggan di {{label_kota_kabupaten}} memperoleh keuntungan berupa layanan yang ${uBenefit1} untuk seluruh cakupan wilayah Kecamatan {{kecamatan}}.`,
    `|`,
    `Tim pelaksana di {{kecamatan}} memastikan bahwa setiap tahapan berjalan ${uBenefit1} dan {sesuai kesepakatan tertulis|tanpa mengganggu kenyamanan lingkungan sekitar|dengan pengawasan kualitas berlapis}.`,
    `|`,
    `Kombinasi antara keahlian personel dan layanan yang ${uBenefit1} di {{kota_kabupaten}} membuat pengerjaan di {{kecamatan}} {lebih cepat tuntas|jauh lebih rapi|hemat biaya perawatan jangka panjang}.`,
    `|`,
    `Kami mengutamakan kepastian hasil yang ${uBenefit1} bagi warga Kecamatan {{kecamatan}} melalui {uji kelayakan fungsi sebelum serah terima|dokumentasi hasil kerja yang lengkap|kemudahan konsultasi pasca-pengerjaan}.`,
    `|`,
    `Seluruh material yang dipasang pada proyek di {{kecamatan}} ({{wilayah}}) telah {melewati seleksi mutu ketat|disesuaikan dengan beban pemakaian harian} serta ${uBenefit1}.`,
    `|`,
    `Fokus kami di {{kecamatan}} adalah memberikan solusi yang ${uBenefit1} dan {tuntas sejak kunjungan pertama|efisien dari sisi anggaran|tahan lama untuk pemakaian bertahun-tahun}.`,
    `}`
  ].join('');

  // H2 Section 2: Operational Steps
  const paragraph3 = [
    `## {Alur Operasional|Tahapan Pelaksanaan|Prosedur Standar|Mekanisme Penanganan|Rangkaian Proses Kerja|Sistem Kerja Terpadu|Langkah Penanganan} di Kecamatan {{kecamatan}}\n\n`,
    `- **{Pemetaan & Diagnosa Awal|Inspeksi Teknis Lokasi|Survei & Identifikasi Kebutuhan|Evaluasi Lapangan Terukur|Analisis Spesifikasi Area|Asesmen Kondisi Aktual|Pengecekan Parameter Lokasi}:** {Tim mempelajari kondisi titik lokasi di {{kecamatan}} guna merumuskan langkah paling efektif.|Pengecekan parameter dilakukan secara cermat menyesuaikan karakter kawasan {{kecamatan}}.|Data teknis dikumpulkan langsung di lapangan agar solusi ${topicSpin} benar-benar presisi.|Kami mendengarkan kebutuhan spesifik Anda di {{kecamatan}} sebelum menyusun rekomendasi.|Pemeriksaan menyeluruh memastikan tidak ada detail struktur yang terlewat.|Diagnosa objektif menjadi fondasi utama keberhasilan pengerjaan di {{kota_kabupaten}}.|Tim survei mendokumentasikan kebutuhan aktual bangunan Anda di {{kecamatan}} secara akurat.}\n`,
    `- **{Penyusunan Rincian Anggaran|Rencana Kerja & Estimasi Resmi|Proposal Biaya Transparan|Kalkulasi Teknis Terbuka|Penawaran Harga Jelas|Kontrak Jadwal & Spesifikasi|Rancangan Biaya Terukur}:** {Klien di {{kecamatan}} memperoleh rincian item kerja secara jelas sebelum proses dimulai.|Setiap tahapan dan material dijabarkan transparan sehingga anggaran terkendali.|Jadwal pelaksanaan disepakati bersama untuk menjaga ketepatan waktu di {{label_kota_kabupaten}}.|Tidak ada biaya mendadak karena seluruh skema telah dikunci sejak awal.|Anda dapat menyesuaikan skala pekerjaan sesuai prioritas kebutuhan di {{kecamatan}}.|Proposal kerja memuat target capaian yang terukur dan dapat dipertanggungjawabkan.|Estimasi anggaran disusun rasional berdasarkan hasil pengecekan aktual di {{kecamatan}}.}\n`,
    `- **{Implementasi oleh Tim Ahli|Eksekusi Standar Industri|Pengerjaan Lapangan Presisi|Penanganan Teknis Terkontrol|Instalasi & Tindakan Rapi|Pelaksanaan Berstandar Mutu|Penerapan Solusi Teruji}:** {Pekerjaan ${topicSpin} dijalankan secara disiplin mengikuti protokol keamanan kerja.|Personel berpengalaman memastikan setiap bagian berfungsi optimal di lokasi {{kecamatan}}.|Pengawasan kualitas dilakukan ketat demi menjaga kepuasan warga {{wilayah}}.|Kerapian dan ketepatan teknis menjadi fokus utama selama tim bekerja di {{kecamatan}}.|Peralatan modern digunakan untuk mempercepat durasi kerja tanpa mengurangi mutu.|Setiap prosedur dikerjakan sesuai pedoman teknis yang berlaku di {{kota_kabupaten}}.|Penerapan metode kerja yang tertib menjaga kenyamanan lingkungan sekitar {{kecamatan}}.}\n`,
    `- **{Pengujian Akhir & Garansi|Serah Terima & Quality Control|Verifikasi Fungsi & Jaminan|Inspeksi Pasca-Kerja|Validasi Hasil & Layanan Purna Jual|Uji Kelayakan & Dukungan Teknis|Evaluasi Akhir & Jaminan Mutu}:** {Pengujian dilakukan langsung bersama pelanggan di {{kecamatan}} sebelum serah terima.|Dokumen garansi resmi diterbitkan sebagai bukti komitmen layanan kami di {{kota_kabupaten}}.|Kami memastikan seluruh sistem berjalan seratus persen sesuai target awal.|Tim dukungan tetap siaga membantu perawatan berkala bagi klien di {{kecamatan}}.|Hasil pengerjaan diperiksa ulang guna menjamin keamanan jangka panjang.|Kepuasan Anda di {{kecamatan}} menjadi syarat mutlak berakhirnya tahapan proyek.|Bukti pemeriksaan fungsi diserahkan secara lengkap kepada pemilik properti di {{kecamatan}}.}`
  ].join('');

  // H2 Section 3: Long-term benefits
  const paragraph4 = [
    `## {Manfaat Jangka Panjang|Keuntungan Nyata|Dampak Positif|Nilai Investasi|Kelebihan Strategis|Manfaat Langsung|Keunggulan Berkelanjutan} bagi Warga {{kecamatan}} ({{wilayah}})\n\n`,
    `{`,
    `Mengandalkan tim ${boldTopicSpin} yang mengenal seluk-beluk {{label_kota_kabupaten}} menghadirkan {kemudahan layanan purna jual kapan saja|penghematan biaya perawatan tahunan|kepastian bahwa material cocok dengan iklim {{wilayah}}}.`,
    `|`,
    `Berbeda dengan penyedia luar wilayah yang kurang memahami kondisi {{kecamatan}}, personel lokal kami {siap merespons panggilan tindak lanjut dengan cepat|menguasai karakter teknis bangunan di seputar {{kota_kabupaten}}|memberikan solusi yang jauh lebih relevan dan efisien}.`,
    `|`,
    `Keputusan memilih pelaksana ${boldTopicSpin} yang tepat sejak awal di ${boldKecamatan} akan {menghindarkan Anda dari biaya bongkar-pasang berulang|menjaga nilai aset properti maupun tempat usaha|menjamin kelancaran operasional harian tanpa gangguan}.`,
    `|`,
    `Bagi pelaku usaha maupun keluarga di {{kecamatan}}, kualitas pengerjaan yang terstandarisasi berarti {ketenangan pikiran dalam jangka panjang|efisiensi konsumsi sumber daya yang terukur|dukungan teknis yang selalu mudah dijangkau}.`,
    `|`,
    `Sinergi antara keahlian teknis dan pemahaman lokal atas kawasan {{kecamatan}} menjadikan layanan kami {unggul dalam hal daya tahan hasil kerja|sangat kompetitif dari sisi rasio biaya dan manfaat|pilihan utama masyarakat di {{label_kota_kabupaten}}}.`,
    `|`,
    `Reputasi yang kami jaga di seluruh Provinsi {{wilayah}} bertumpu pada {pembuktian kualitas nyata di setiap titik proyek|kecepatan penyelesaian klaim garansi pelanggan|transparansi penuh dari tahap konsultasi hingga selesai}.`,
    `|`,
    `Dukungan berkelanjutan bagi pelanggan di Kecamatan {{kecamatan}} memastikan {setiap investasi teknis memberikan manfaat optimal|perawatan berkala dapat dijadwalkan secara fleksibel|keamanan instalasi terjaga sepanjang waktu}.`,
    `}`
  ].join('');

  // Optional H2 + H3 FAQ Section for Google "People Also Ask" SEO
  const faqSection = enableFaqSchema
    ? [
        `## {Tanya Jawab (FAQ)|Pertanyaan Umum Pelanggan|Informasi Penting|Panduan Tanya Jawab|Hal yang Sering Ditanyakan|FAQ Layanan Lokal|Penjelasan Singkat} Seputar Layanan di Kecamatan {{kecamatan}}\n\n`,
        `### {Apakah melayani survei langsung ke seluruh kelurahan di Kecamatan {{kecamatan}}?|Bagaimana prosedur pemesanan jadwal kunjungan ke area {{kecamatan}}?|Berapa cepat tim teknis dapat menjangkau lokasi di {{kecamatan}}, {{kota_kabupaten}}?|Apakah seluruh titik di Kecamatan {{kecamatan}} masuk dalam jangkauan layanan?|Bagaimana cara mengatur jadwal inspeksi awal di {{kecamatan}}?|Apakah tersedia kunjungan pengecekan lokasi di area {{kecamatan}}?|Dapatkah tim langsung datang mengecek lokasi di Kecamatan {{kecamatan}}?}\n\n`,
        `{Ya, tim operasional kami di {{label_kota_kabupaten}} menjangkau seluruh area Kecamatan {{kecamatan}} dengan penjadwalan fleksibel sesuai waktu luang Anda.|Tentu, petugas lapangan kami siap mengunjungi titik lokasi Anda di {{kecamatan}} setelah koordinasi waktu melalui WhatsApp.|Benar, seluruh kawasan pemukiman maupun komersial di Kecamatan {{kecamatan}} ({{wilayah}}) termasuk dalam rute layanan prioritas kami.|Kami melayani kunjungan survei terjadwal maupun kebutuhan mendesak untuk seluruh pelanggan di lingkup Kecamatan {{kecamatan}}.|Tim teknis cabang {{kota_kabupaten}} rutin bertugas di area {{kecamatan}} sehingga proses penjadwalan survei sangat cepat.|Anda cukup mengirimkan titik lokasi di Kecamatan {{kecamatan}} dan koordinator kami akan segera mengatur jadwal kedatangan teknisi.|Seluruh jalan utama hingga area perumahan di Kecamatan {{kecamatan}} dapat dijangkau dengan cepat oleh armada operasional kami.}\n\n`,
        `### {Apakah hasil pengerjaan di {{kecamatan}} dilengkapi garansi resmi?|Bagaimana sistem jaminan mutu untuk pelanggan di {{label_kota_kabupaten}}?|Apakah rincian biaya untuk area {{kecamatan}} sudah bersifat transparan?|Bagaimana jika diperlukan perawatan lanjutan di lokasi {{kecamatan}}?|Apakah ada garansi tertulis setelah pekerjaan di {{kecamatan}} selesai?|Bagaimana standar perlindungan konsumen untuk layanan di {{kecamatan}}?|Apakah pelanggan di {{kecamatan}} mendapatkan bukti garansi pengerjaan?}\n\n`,
        `{Setiap pekerjaan yang kami selesaikan di Kecamatan {{kecamatan}} mendapatkan dokumen garansi resmi serta dukungan purna jual yang jelas.|Kami memberikan rincian estimasi tertulis di awal dan menyertakan jaminan mutu bagi seluruh pelanggan di {{label_kota_kabupaten}}.|Tentu, kepuasan warga {{kecamatan}} dilindungi oleh garansi fungsi serta kemudahan klaim tindak lanjut tanpa prosedur rumit.|Seluruh komponen kerja di {{kecamatan}} tercatat dalam lembar serah terima resmi yang menjamin hak garansi Anda.|Kami menjamin tidak ada biaya tersembunyi dan setiap hasil kerja di {{kecamatan}} melalui uji fungsi bersama pelanggan.|Apabila dibutuhkan pengecekan berkala di lokasi {{kecamatan}}, tim dukungan teknis kami di {{kota_kabupaten}} siap membantu.|Komitmen kami di Provinsi {{wilayah}} adalah memastikan setiap klien di {{kecamatan}} menerima hasil yang aman dan bergaransi.}`
      ].join('')
    : '';

  // WhatsApp CTA Top & Bottom
  const waTopHtml = enableWhatsappCta
    ? `<div class="wa-cta-box wa-cta-top"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel || 'Chat WhatsApp Konsultan Sekarang'}|Konsultasi Cepat via WhatsApp ({{kecamatan}})|Hubungi WhatsApp Resmi Area {{kecamatan}}|Respon Cepat WhatsApp Cabang {{kota_kabupaten}}} ({{wa_number}})</a></div>`
    : '';

  const waButtonHtml = enableWhatsappCta
    ? `\n\n<div class="wa-cta-box wa-cta-bottom"><a href="{{wa_url}}" target="_blank" rel="noopener" class="wa-cta-button">&#128172; {${whatsappLabel || 'Chat WhatsApp Konsultan Sekarang'}|Klik untuk Chat WhatsApp Area {{kecamatan}}|Hubungi WhatsApp Resmi Cabang {{kota_kabupaten}}|Konsultasi Cepat via WhatsApp ({{kecamatan}})|Respon Cepat WhatsApp Tim Teknis {{kecamatan}}|Tanya Estimasi Biaya via WhatsApp|Jadwalkan Survei via WhatsApp Sekarang} ({{wa_number}})</a></div>`
    : '';

  const paragraph5 = [
    `## {Jadwalkan Survei di {{kecamatan}}|Hubungi Spesialis Area {{kecamatan}}|Konsultasi Kebutuhan Anda|Dapatkan Estimasi Wilayah {{kecamatan}}|Layanan Cepat Area {{kecamatan}}|Diskusikan Proyek Anda di {{kecamatan}}|Kontak Tim Teknis {{kota_kabupaten}}}\n\n`,
    `{`,
    `Jangan tunda kebutuhan ${boldTopicSpin} di lokasi Anda. ${ctaSpin} untuk seluruh area ${boldKecamatan}, {{label_kota_kabupaten}} ({{wilayah}}).`,
    `|`,
    `Siap memperoleh penanganan ${boldTopicSpin} yang rapi, transparan, dan bergaransi di {{kecamatan}}? ${ctaSpin} — tim {{kota_kabupaten}} kami siap melayani.`,
    `|`,
    `Untuk tanya jawab teknis, rincian anggaran, maupun jadwal kunjungan ke Kecamatan {{kecamatan}} ({{label_kota_kabupaten}}), segera hubungi kami. ${ctaSpin}.`,
    `|`,
    `Pastikan proyek ${boldTopicSpin} Anda di Kecamatan {{kecamatan}} ditangani oleh tenaga kompeten. ${ctaSpin} dan dapatkan solusi terbaik di {{wilayah}}.`,
    `|`,
    `Kami siap mendampingi kebutuhan ${boldTopicSpin} rumah tangga maupun komersial di {{kecamatan}}, {{jenis_daerah}} {{kota_kabupaten}}. ${ctaSpin}.`,
    `|`,
    `Ambil langkah tepat hari ini untuk kebutuhan ${boldTopicSpin} di kawasan {{kecamatan}}. ${ctaSpin} bersama tim profesional {{label_kota_kabupaten}}.`,
    `|`,
    `Wujudkan pengerjaan ${boldTopicSpin} yang aman dan tepat anggaran di Kecamatan {{kecamatan}}. ${ctaSpin} sekarang juga.`,
    `}${waButtonHtml}`
  ].join('');

  const sections = [h1Title];
  if (waTopHtml) sections.push(waTopHtml);
  sections.push(paragraph1);
  if (imageSection) sections.push(imageSection);
  sections.push(paragraph2, paragraph3, paragraph4);
  if (faqSection) sections.push(faqSection);
  sections.push(paragraph5);

  const masterSpintax = sections.join('\n\n');
  const stats = countSpintaxPermutations(masterSpintax);

  return {
    topic: cleanTopic,
    category,
    tone,
    callToAction: cleanCta,
    whatsappNumber,
    whatsappLabel,
    targetUrl,
    anchorText,
    linkRel,
    imageUrl,
    imageAltSpintax,
    enableBoldKeywords,
    enableUnderlineBenefits,
    enableImageBlock,
    enableHyperlink,
    enableWhatsappCta,
    enableFaqSchema,
    masterSpintax,
    stats,
    engineMode: process.env.GEMINI_API_KEY ? 'GEMINI_HYBRID_READY' : 'LOCAL_AI_PATTERN_ENGINE'
  };
}

/**
 * Converts Markdown-like headings (# H1, ## H2, ### H3) and bullet lists (- item)
 * mixed with inline HTML (<strong>, <u>, <a>, <figure>, <div>) into clean semantic HTML
 * for CMS/WordPress publishing and visual preview.
 */
function convertArticleToHtml(rawContent, seoMeta = {}) {
  const blocks = String(rawContent || '')
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

function sliceAtWordBoundary(text, maxLen) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.5) ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Generates Google SEO Meta Title, Meta Description, URL Slug, and JSON-LD Schema
 * (`LocalBusiness` / `Service` + `FAQPage`) for a specific regional article.
 */
function buildSeoMetadataAndSchema({ title, topic, target, whatsappNumber, targetUrl, imageUrl }) {
  const cleanTitle = String(title || `${topic} di Kecamatan ${target.kecamatan}`)
    .replace(/<[^>]+>/g, '')
    .trim();

  const metaTitle =
    cleanTitle.length <= 60
      ? cleanTitle
      : sliceAtWordBoundary(`${topic} Kec. ${target.kecamatan}, ${target.labelKotaKabupaten}`, 60);

  const metaDescription = sliceAtWordBoundary(
    `Layanan ${topic} terpercaya di Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten} (${target.wilayah}). Bergaransi resmi, transparan & survei lokasi cepat.`,
    158
  );

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
          },
          {
            '@type': 'Question',
            name: `Apakah layanan di Kecamatan ${target.kecamatan} dilengkapi garansi resmi?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Seluruh pengerjaan di Kecamatan ${target.kecamatan} mendapatkan rincian anggaran transparan dan garansi resmi tertulis.`
            }
          }
        ]
      }
    ]
  };

  return {
    metaTitle,
    metaDescription,
    jsonLdString: JSON.stringify(jsonLdObj, null, 2)
  };
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a valid XML Sitemap (`sitemap.xml`) for Google Search Console submission.
 */
function generateSitemapXml({ siteUrl = 'https://www.domainanda.com/', slugs = [], lastmod = null } = {}) {
  const base = String(siteUrl || 'https://www.domainanda.com/').replace(/\/+$/, '');
  const dateStr = lastmod || new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${escapeXml(base)}/</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
  ];

  for (const s of Array.isArray(slugs) ? slugs : []) {
    const cleanSlug = String(s || '').replace(/^\/+/, '').trim();
    if (!cleanSlug) continue;
    urls.push(
      `  <url>\n    <loc>${escapeXml(`${base}/${cleanSlug}`)}</loc>\n    <lastmod>${dateStr}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

module.exports = {
  createSeededRandom,
  resolveSpintax,
  buildWhatsAppUrl,
  injectGeoVariables,
  countSpintaxPermutations,
  buildMasterSpintaxBlueprint,
  convertArticleToHtml,
  buildSeoMetadataAndSchema,
  generateSitemapXml
};
