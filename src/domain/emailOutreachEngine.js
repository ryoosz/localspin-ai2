const crypto = require('node:crypto');
const { resolveSpintax } = require('./spintaxEngine');

const EMAIL_VALID_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;

/**
 * Prevents SMTP/Email header injection (CRLF) in subject, sender, or recipient fields.
 */
function sanitizeHeaderValue(val) {
  return String(val || '').replace(/[\r\n]+/g, ' ').trim();
}

function isValidEmailAddress(email) {
  return EMAIL_VALID_REGEX.test(String(email || '').trim());
}

/**
 * Deterministic-yet-varied jitter helper in [minMs, maxMs].
 */
function computeRandomIntervalMs(minMinutes, maxMinutes, seedStr) {
  const minM = Math.max(0, Number(minMinutes) || 0);
  const maxM = Math.max(minM, Number(maxMinutes) || minM);
  if (maxM === 0) return 0;

  const hash = crypto.createHash('sha256').update(String(seedStr)).digest();
  const ratio = hash.readUInt32BE(0) / 0xffffffff;
  const minutes = minM + ratio * (maxM - minM);
  return Math.round(minutes * 60 * 1000);
}

/**
 * Default B2B Commodity Trade Offer Spintax templates (Indonesian & English-Japanese).
 */
function getCommodityTemplate({ language = 'en', commodity = 'Indonesian Specialty Arabica Green Beans' } = {}) {
  if (language === 'id') {
    return {
      subjectSpintax:
        '{Penawaran Kerja Sama Suplai|Proposal Dagang Langsung|Katalog Harga Grosir|Sampel Gratis Komoditas} {{komoditas}} {untuk {{nama_usaha}}|Khusus {{nama_usaha}} ({{kota_daerah}})|Penawaran B2B {{kota_daerah}}|dari Eksportir Langsung}',
      bodySpintax: [
        `{Halo Tim|Yth. Pengelola|Salam hangat untuk tim pengadaan|Halo Bapak/Ibu Pimpinan} {{nama_usaha}} di {{kota_daerah}},`,
        `{Kami dari {{perusahaan_pengirim}} ingin memperkenalkan pasokan langsung|Perkenalkan, kami adalah pemasok tangan pertama untuk|Melalui email ini kami menawarkan kerja sama suplai berkala} <strong>{{komoditas}}</strong> {dengan kualitas ekspor terstandarisasi dan harga kompetitif langsung dari sumbernya.|yang telah melalui proses sortasi ketat untuk kebutuhan bisnis di {{kota_daerah}}.|dengan konsistensi stok bulanan serta dukungan pengiriman tepat waktu.}`,
        `{Apabila {{nama_usaha}} sedang mencari mitra penyedia {{komoditas}} yang {stabil dari sisi mutu|fleksibel dalam kuantitas pemesanan|siap mengirimkan sampel uji coba}, kami sangat terbuka untuk berdiskusi lebih lanjut.|Kami siap mengirimkan daftar harga FOB/CIF terbaru maupun sampel produk agar tim {{nama_usaha}} dapat menguji kualitasnya secara langsung.}`,
        `{Silakan balas email ini ({{email_pengirim}}) atau hubungi kami via WhatsApp di {{wa_pengirim}} untuk permintaan katalog dan sampel.|Terima kasih atas waktu Anda, kami menantikan peluang kerja sama jangka panjang bersama {{nama_usaha}}.}`,
        `Hormat kami,\n{{nama_pengirim}} — {{perusahaan_pengirim}}`
      ].join('\n\n')
    };
  }

  return {
    subjectSpintax:
      '{Direct Trade Offer|Wholesale Supply Inquiry|B2B Partnership & Sample|Specialty Origin Proposal}: {{komoditas}} {for {{nama_usaha}}|— {{nama_usaha}} ({{kota_daerah}})|Direct from Indonesia to {{kota_daerah}}|Fresh Harvest Allocation}',
    bodySpintax: [
      `{Dear {{nama_usaha}} Team|Hello Coffee Buyer at {{nama_usaha}}|Greetings to the {{nama_usaha}} Roastery & Cafe Team|Dear Purchasing Manager at {{nama_usaha}}},`,
      `{We are reaching out from {{perusahaan_pengirim}} to introduce our direct-origin|Our export team at {{perusahaan_pengirim}} would love to share our latest harvest of|We specialize in supplying Japanese specialty cafes like {{nama_usaha}} in {{kota_daerah}} with} <strong>{{komoditas}}</strong> {graded for consistent cupping scores, clean processing, and reliable year-round container or air-freight delivery.|sourced directly from smallholder highland farms in Indonesia with full traceability and flexible MOQ for independent coffee shops.|crafted to complement pour-over and espresso menus in {{kota_daerah}}.}`,
      `{If {{nama_usaha}} is open to evaluating new seasonal lots, we would be glad to send a complimentary roasted or green sample pack along with our FOB/CIF Japan price sheet.|Many roasteries in {{kota_daerah}} partner with us for transparent pricing, moisture-controlled packaging, and responsive export documentation.}`,
      `{Simply reply to {{email_pengirim}} or reach our trade desk via WhatsApp ({{wa_pengirim}}) if you would like us to ship a sample box to {{nama_usaha}}.|Thank you very much for your time and continued passion for great coffee.}`,
      `Best regards,\n{{nama_pengirim}}\n{{perusahaan_pengirim}}`
    ].join('\n\n')
  };
}

/**
 * Generates an outbound email campaign queue with:
 * - Multi-sender rotation (different sender addresses & provider types)
 * - Per-recipient nested spintax resolution (subject + body)
 * - Schedule mode: 'drip_random' (e.g., 3-5 min random interval) OR 'blast' (immediate)
 * - Deduplication & CRLF header safety
 */
function buildEmailOutreachQueue({
  recipients = [],
  senders = [],
  subjectSpintax = '',
  bodySpintax = '',
  commodity = 'Indonesian Specialty Arabica Green Beans',
  companyName = 'Nusantara Commodity Export',
  senderWhatsapp = '+62 812-3456-7890',
  websiteUrl = 'https://nusantararoastery.id/katalog-ekspor',
  websiteLabel = 'Lihat Katalog & Spesifikasi Produk Kami',
  imageUrl = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
  imageCaption = 'Sampel Biji Kopi Specialty Ekspor Nusantara',
  scheduleMode = 'drip_random', // 'drip_random' | 'blast'
  minDelayMinutes = 3,
  maxDelayMinutes = 5,
  senderRotation = 'round_robin', // 'round_robin' | 'random'
  includeUnsubscribe = true,
  startTimeIso = null,
  campaignSeed = `email-cmp-${Date.now()}`
} = {}) {
  const validSenders = (Array.isArray(senders) ? senders : [])
    .filter((s) => s && isValidEmailAddress(s.email))
    .map((s, i) => ({
      id: s.id || `snd_${i + 1}`,
      name: sanitizeHeaderValue(s.name || 'Trade Team'),
      email: sanitizeHeaderValue(s.email).toLowerCase(),
      providerType: sanitizeHeaderValue(s.providerType || 'SMTP')
    }));

  if (validSenders.length === 0) {
    const err = new Error('Minimal satu alamat email pengirim yang valid wajib disediakan.');
    err.status = 400;
    err.code = 'NO_VALID_SENDERS';
    throw err;
  }

  // Deduplicate recipients by email & validate syntax
  const seenEmails = new Set();
  const validRecipients = [];
  const skippedRecipients = [];

  for (const r of Array.isArray(recipients) ? recipients : []) {
    const email = sanitizeHeaderValue(r.email).toLowerCase();
    if (!isValidEmailAddress(email)) {
      skippedRecipients.push({ name: r.name || '-', email: r.email || '', reason: 'INVALID_EMAIL' });
      continue;
    }
    if (seenEmails.has(email)) {
      skippedRecipients.push({ name: r.name || '-', email, reason: 'DUPLICATE_EMAIL' });
      continue;
    }
    seenEmails.add(email);
    validRecipients.push({
      name: sanitizeHeaderValue(r.name || 'Coffee Shop Partner'),
      email,
      cityArea: sanitizeHeaderValue(r.cityArea || r.address || 'Tokyo, Japan'),
      category: sanitizeHeaderValue(r.category || 'Coffee Shop')
    });
  }

  if (validRecipients.length === 0) {
    const err = new Error('Tidak ada alamat email penerima yang valid setelah validasi & deduplikasi.');
    err.status = 400;
    err.code = 'NO_VALID_RECIPIENTS';
    throw err;
  }

  const baseDate = startTimeIso ? new Date(startTimeIso) : new Date();
  let cumulativeMs = 0;

  const queueItems = validRecipients.map((rec, idx) => {
    // Select sender (round-robin or deterministic pseudo-random)
    let senderIdx = idx % validSenders.length;
    if (senderRotation === 'random' && validSenders.length > 1) {
      const h = crypto.createHash('sha256').update(`${campaignSeed}::snd::${idx}`).digest();
      senderIdx = h.readUInt32BE(0) % validSenders.length;
    }
    const sender = validSenders[senderIdx];

    // Compute schedule timestamp
    let intervalMs = 0;
    if (idx > 0) {
      if (scheduleMode === 'blast') {
        intervalMs = 1000; // 1 second minimal pacing in blast mode
      } else {
        intervalMs = computeRandomIntervalMs(
          minDelayMinutes,
          maxDelayMinutes,
          `${campaignSeed}::delay::${idx}::${rec.email}`
        );
      }
      cumulativeMs += intervalMs;
    }

    const scheduledAt = new Date(baseDate.getTime() + cumulativeMs).toISOString();
    const delayMinutesFromStart = Number((cumulativeMs / 60000).toFixed(2));
    const stepGapMinutes = Number((intervalMs / 60000).toFixed(2));

    // Resolve spintax for subject & body
    const spunSubjRaw = resolveSpintax(subjectSpintax, `${campaignSeed}::subj`, idx);
    const spunBodyRaw = resolveSpintax(bodySpintax, `${campaignSeed}::body`, idx);

    const varMap = {
      nama_usaha: rec.name,
      email_tujuan: rec.email,
      kota_daerah: rec.cityArea,
      kategori: rec.category,
      komoditas: sanitizeHeaderValue(commodity),
      nama_pengirim: sender.name,
      email_pengirim: sender.email,
      perusahaan_pengirim: sanitizeHeaderValue(companyName),
      wa_pengirim: sanitizeHeaderValue(senderWhatsapp),
      website_url: sanitizeHeaderValue(websiteUrl),
      website_label: sanitizeHeaderValue(websiteLabel),
      image_url: sanitizeHeaderValue(imageUrl)
    };

    const injectVars = (str) =>
      String(str || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, key) => {
        const k = key.toLowerCase();
        return Object.prototype.hasOwnProperty.call(varMap, k) ? varMap[k] : full;
      });

    const subject = sanitizeHeaderValue(injectVars(spunSubjRaw));
    let body = injectVars(spunBodyRaw);

    if (websiteUrl) {
      body += `\n\n${websiteLabel || 'Website Resmi'}: ${websiteUrl}`;
    }

    if (includeUnsubscribe) {
      body += `\n\n---\nJika Anda tidak ingin menerima penawaran dagang lagi, silakan balas dengan subjek "UNSUBSCRIBE" ke ${sender.email}.`;
    }

    const htmlParagraphs = injectVars(spunBodyRaw)
      .split(/\n\n+/)
      .map((p) => `<p style="margin:0 0 14px; line-height:1.65;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');

    const htmlImageBlock = imageUrl
      ? `<div style="margin:16px 0; text-align:center;"><img src="${imageUrl}" alt="${sanitizeHeaderValue(commodity)} - ${rec.name}" style="max-width:100%; max-height:280px; border-radius:8px; object-fit:cover;" /><div style="font-size:12px; color:#64748b; margin-top:4px;">${sanitizeHeaderValue(imageCaption || commodity)}</div></div>`
      : '';

    const htmlWebsiteBlock = websiteUrl
      ? `<div style="margin:16px 0;"><a href="${websiteUrl}" target="_blank" rel="noopener" style="display:inline-block; background:#2563eb; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">&#128279; ${sanitizeHeaderValue(websiteLabel || 'Kunjungi Website Kami')}</a></div>`
      : '';

    const htmlUnsub = includeUnsubscribe
      ? `<hr style="border:0; border-top:1px solid #e2e8f0; margin:18px 0;"/><p style="font-size:12px; color:#64748b;">Jika Anda tidak ingin menerima penawaran dagang lagi, balas email ini dengan subjek "UNSUBSCRIBE" ke ${sender.email}.</p>`
      : '';

    const htmlBody = `<div style="font-family:Arial,sans-serif; color:#0f172a; max-width:640px;">\n${htmlImageBlock}\n${htmlParagraphs}\n${htmlWebsiteBlock}\n${htmlUnsub}\n</div>`;

    return {
      index: idx + 1,
      recipientName: rec.name,
      recipientEmail: rec.email,
      cityArea: rec.cityArea,
      senderName: sender.name,
      senderEmail: sender.email,
      senderProviderType: sender.providerType,
      websiteUrl: sanitizeHeaderValue(websiteUrl),
      imageUrl: sanitizeHeaderValue(imageUrl),
      subject,
      body,
      htmlBody,
      scheduleMode,
      scheduledAt,
      stepGapMinutes,
      delayMinutesFromStart,
      status: scheduleMode === 'blast' ? 'READY_BLAST' : 'SCHEDULED_DRIP'
    };
  });

  const totalDurationMinutes = queueItems.length
    ? queueItems[queueItems.length - 1].delayMinutesFromStart
    : 0;

  return {
    summary: {
      totalQueued: queueItems.length,
      totalSkipped: skippedRecipients.length,
      uniqueSendersUsed: new Set(queueItems.map((q) => q.senderEmail)).size,
      scheduleMode,
      minDelayMinutes: scheduleMode === 'blast' ? 0 : Number(minDelayMinutes),
      maxDelayMinutes: scheduleMode === 'blast' ? 0 : Number(maxDelayMinutes),
      totalEstimatedDurationMinutes: totalDurationMinutes,
      estimatedFinishAt: queueItems.length ? queueItems[queueItems.length - 1].scheduledAt : baseDate.toISOString(),
      executionMode: process.env.SMTP_HOST ? 'SMTP_CONFIGURED' : 'SIMULATION_QUEUE_READY'
    },
    skippedRecipients,
    queueItems
  };
}

module.exports = {
  sanitizeHeaderValue,
  isValidEmailAddress,
  computeRandomIntervalMs,
  getCommodityTemplate,
  buildEmailOutreachQueue
};
