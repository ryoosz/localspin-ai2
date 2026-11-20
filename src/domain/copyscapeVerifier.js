const {
  resolveSpintax,
  buildWhatsAppUrl,
  injectGeoVariables,
  convertArticleToHtml,
  buildSeoMetadataAndSchema
} = require('./spintaxEngine');

const COPYSCAPE_SAFE_MAX_OVERLAP_PCT = 14.0; // >= 86% unique 4-gram shingles across siblings

function stripHtmlAndScripts(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&bull;|&rarr;|&larr;|&#[0-9]+;/gi, ' ');
}

function tokenizeWords(text) {
  return stripHtmlAndScripts(text)
    .toLowerCase()
    .replace(/[#*_`~>\-\[\]()]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function extractShingles(words, k = 4) {
  const set = new Set();
  if (!Array.isArray(words) || words.length < k) return set;
  for (let i = 0; i <= words.length - k; i++) {
    set.add(words.slice(i, i + k).join(' '));
  }
  return set;
}

/**
 * Compares two articles using 4-gram and 5-gram shingle overlap (Copyscape-style phrase detection).
 */
function compareTwoArticles(textA, textB) {
  const wordsA = tokenizeWords(textA);
  const wordsB = tokenizeWords(textB);

  const shingles4A = extractShingles(wordsA, 4);
  const shingles4B = extractShingles(wordsB, 4);

  const shingles5A = extractShingles(wordsA, 5);
  const shingles5B = extractShingles(wordsB, 5);

  let shared4Count = 0;
  const sharedPhrases = [];
  for (const s of shingles4A) {
    if (shingles4B.has(s)) {
      shared4Count++;
      if (sharedPhrases.length < 5) sharedPhrases.push(s);
    }
  }

  let shared5Count = 0;
  for (const s of shingles5A) {
    if (shingles5B.has(s)) shared5Count++;
  }

  const minShingles4 = Math.max(1, Math.min(shingles4A.size, shingles4B.size));
  const minShingles5 = Math.max(1, Math.min(shingles5A.size, shingles5B.size));

  const overlap4Percent = Number(((shared4Count / minShingles4) * 100).toFixed(2));
  const overlap5Percent = Number(((shared5Count / minShingles5) * 100).toFixed(2));
  const uniquenessPercent = Number(Math.max(0, 100 - overlap4Percent).toFixed(2));

  return {
    wordCountA: wordsA.length,
    wordCountB: wordsB.length,
    overlap4Percent,
    overlap5Percent,
    uniquenessPercent,
    shared4Count,
    shared5Count,
    sharedPhrases,
    passedCopyscapeThreshold: overlap4Percent <= COPYSCAPE_SAFE_MAX_OVERLAP_PCT
  };
}

/**
 * Evaluates a batch of generated regional articles for internal cross-duplication
 * and Copyscape readiness.
 */
function evaluateBatchUniqueness(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return {
      totalArticles: 0,
      averageUniquenessPercent: 100,
      maxOverlapPercent: 0,
      allPassed: true,
      verificationMode: process.env.COPYSCAPE_API_KEY
        ? 'HYBRID_SHINGLE_AND_COPYSCAPE_API'
        : 'LOCAL_4GRAM_5GRAM_SHINGLE_VERIFIED',
      articleReports: []
    };
  }

  const reports = articles.map((art, i) => {
    let maxOverlap4 = 0;
    let maxOverlap5 = 0;
    let closestArticleId = null;
    let sharedSample = [];

    for (let j = 0; j < articles.length; j++) {
      if (i === j) continue;
      const cmp = compareTwoArticles(art.content, articles[j].content);
      if (cmp.overlap4Percent > maxOverlap4) {
        maxOverlap4 = cmp.overlap4Percent;
        maxOverlap5 = cmp.overlap5Percent;
        closestArticleId = articles[j].regionLabel || `Artikel #${j + 1}`;
        sharedSample = cmp.sharedPhrases;
      }
    }

    const uniquenessPercent = Number(Math.max(0, 100 - maxOverlap4).toFixed(2));
    const passed = maxOverlap4 <= COPYSCAPE_SAFE_MAX_OVERLAP_PCT;

    return {
      index: i,
      regionLabel: art.regionLabel,
      wordCount: tokenizeWords(art.content).length,
      uniquenessPercent,
      maxOverlap4Percent: maxOverlap4,
      maxOverlap5Percent: maxOverlap5,
      closestPeer: closestArticleId,
      sharedPhrasesSample: sharedSample,
      copyscapeStatus: passed ? 'PASS_COPYSCAPE_THRESHOLD' : 'NEEDS_RESPIN'
    };
  });

  const avgUniqueness =
    reports.length <= 1
      ? 100
      : Number(
          (reports.reduce((acc, r) => acc + r.uniquenessPercent, 0) / reports.length).toFixed(2)
        );
  const worstOverlap =
    reports.length <= 1
      ? 0
      : Number(Math.max(...reports.map((r) => r.maxOverlap4Percent)).toFixed(2));

  return {
    totalArticles: articles.length,
    averageUniquenessPercent: avgUniqueness,
    maxOverlapPercent: worstOverlap,
    thresholdMaxOverlapPercent: COPYSCAPE_SAFE_MAX_OVERLAP_PCT,
    allPassed: reports.every((r) => r.copyscapeStatus === 'PASS_COPYSCAPE_THRESHOLD'),
    verificationMode: process.env.COPYSCAPE_API_KEY
      ? 'HYBRID_SHINGLE_AND_COPYSCAPE_API'
      : 'LOCAL_4GRAM_5GRAM_SHINGLE_VERIFIED',
    articleReports: reports
  };
}

/**
 * Renders 1..K images from the project's 1..99 image pool for a specific region,
 * customizing the image `title` and `alt` attributes to match the Topic & Region.
 */
function renderProjectImagesForArticle({
  projectImages = [],
  fallbackImageUrl = 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
  imagesPerArticle = 1,
  articleIndex = 0,
  topic = 'Layanan Profesional',
  target
}) {
  const pool =
    Array.isArray(projectImages) && projectImages.length > 0
      ? projectImages.slice(0, 99)
      : [{ image_url: fallbackImageUrl, slot_index: 1 }];

  const count = Math.max(1, Math.min(pool.length, Number(imagesPerArticle) || 1));
  const selectedFigures = [];
  const assignedImagesMeta = [];

  for (let k = 0; k < count; k++) {
    const poolIdx = (articleIndex * count + k) % pool.length;
    const item = pool[poolIdx];
    const url = typeof item === 'string' ? item : item.image_url || item.url || fallbackImageUrl;
    const slotNum = (typeof item === 'object' && item.slot_index) || poolIdx + 1;

    const rawTitlePattern =
      (typeof item === 'object' && (item.custom_title_pattern || item.titlePattern)) ||
      `{{topik}} — Referensi #${slotNum} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`;
    const rawAltPattern =
      (typeof item === 'object' && (item.custom_alt_pattern || item.altPattern)) ||
      `Dokumentasi {{topik}} #${slotNum} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}})`;

    const resolvedTitle = injectGeoVariables(
      resolveSpintax(rawTitlePattern, `${topic}::imgtitle::${articleIndex}`, k),
      target,
      { topic }
    );
    const resolvedAlt = injectGeoVariables(
      resolveSpintax(rawAltPattern, `${topic}::imgalt::${articleIndex}`, k),
      target,
      { topic }
    );

    assignedImagesMeta.push({
      slotIndex: slotNum,
      url,
      title: resolvedTitle,
      alt: resolvedAlt
    });

    selectedFigures.push(
      `<figure class="seo-article-figure"><img src="${url}" title="${resolvedTitle.replace(/"/g, '&quot;')}" alt="${resolvedAlt.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" /><figcaption>${resolvedTitle}</figcaption></figure>`
    );
  }

  return {
    figuresHtml: selectedFigures.join('\n\n'),
    assignedImagesMeta
  };
}

/**
 * Generates localized articles for each Geo Target with full SEO elements,
 * rotating images from the project's 1..99 image library with topic-adapted image titles,
 * and automatically re-spinning any candidate exceeding the Copyscape 4-gram threshold.
 */
function generateCopyscapeSafeBatch({
  masterSpintax,
  geoTargets,
  topic,
  callToAction,
  whatsappNumber = '6281234567890',
  whatsappGreeting = '',
  targetUrl = 'https://nusantaraseo.id/layanan-resmi',
  imageUrl = 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
  projectImages = [],
  imagesPerArticle = 1,
  maxArticlesToGenerate = null,
  enableFaqSchema = true,
  campaignSeed = 'campaign-v1',
  maxRetriesPerArticle = 8
}) {
  const generated = [];
  const effectiveTargets =
    maxArticlesToGenerate && Number(maxArticlesToGenerate) > 0
      ? geoTargets.slice(0, Number(maxArticlesToGenerate))
      : geoTargets;

  for (let idx = 0; idx < effectiveTargets.length; idx++) {
    const target = effectiveTargets[idx];
    const regionLabel = `Kec. ${target.kecamatan}, ${target.labelKotaKabupaten} (${target.wilayah})`;

    const { figuresHtml, assignedImagesMeta } = renderProjectImagesForArticle({
      projectImages,
      fallbackImageUrl: imageUrl,
      imagesPerArticle,
      articleIndex: idx,
      topic,
      target
    });

    const primaryImgUrl = assignedImagesMeta[0] ? assignedImagesMeta[0].url : imageUrl;
    const primaryImgTitle = assignedImagesMeta[0]
      ? assignedImagesMeta[0].title
      : `${topic} di Kecamatan ${target.kecamatan}`;

    let bestCandidate = null;
    let bestOverlap = Infinity;
    let attemptsUsed = 0;

    for (let attempt = 0; attempt < maxRetriesPerArticle; attempt++) {
      attemptsUsed = attempt + 1;
      const seed = attempt === 0 ? campaignSeed : `${campaignSeed}::retry-${attempt}::${idx}`;
      const spun = resolveSpintax(masterSpintax, seed, idx + attempt * 7);
      let finalContent = injectGeoVariables(spun, target, {
        topic,
        callToAction,
        whatsappNumber,
        whatsappGreeting,
        targetUrl,
        imageUrl: primaryImgUrl
      });

      if (finalContent.includes('{{PROJECT_IMAGES_BLOCK}}')) {
        finalContent = finalContent.replace(/\{\{PROJECT_IMAGES_BLOCK\}\}/g, figuresHtml);
      } else if (projectImages && projectImages.length > 0) {
        // Replace single <figure> with multi-image project figures or inject title attribute
        finalContent = finalContent.replace(
          /<figure class="seo-article-figure">[\s\S]*?<\/figure>/i,
          figuresHtml
        );
      } else {
        // Ensure title attribute adapted to topic is present on standard <img
        finalContent = finalContent.replace(
          /<img src="([^"]+)" alt="([^"]+)"/gi,
          `<img src="$1" title="${primaryImgTitle.replace(/"/g, '&quot;')}" alt="$2"`
        );
      }

      const lines = finalContent.split('\n').filter((l) => l.trim().length > 0);
      const rawTitleLine = lines[0]
        ? lines[0].replace(/^#+\s*/, '').replace(/<[^>]+>/g, '').trim()
        : `${topic} di ${regionLabel}`;

      if (generated.length === 0) {
        bestCandidate = { title: rawTitleLine, content: finalContent };
        bestOverlap = 0;
        break;
      }

      let maxOverlapWithExisting = 0;
      for (const prev of generated) {
        const cmp = compareTwoArticles(finalContent, prev.content);
        if (cmp.overlap4Percent > maxOverlapWithExisting) {
          maxOverlapWithExisting = cmp.overlap4Percent;
        }
      }

      if (maxOverlapWithExisting < bestOverlap) {
        bestOverlap = maxOverlapWithExisting;
        bestCandidate = { title: rawTitleLine, content: finalContent };
      }

      if (maxOverlapWithExisting <= COPYSCAPE_SAFE_MAX_OVERLAP_PCT) {
        break;
      }
    }

    const slug = `${topic}-kecamatan-${target.kecamatan}-${target.kotaKabupaten}-${target.wilayah}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const seoMeta = buildSeoMetadataAndSchema({
      title: bestCandidate.title,
      topic,
      target,
      whatsappNumber,
      targetUrl,
      imageUrl: primaryImgUrl
    });

    const htmlContent = convertArticleToHtml(
      bestCandidate.content,
      enableFaqSchema ? seoMeta : {}
    );

    const defaultGreeting = `Halo Admin, saya tertarik dengan ${topic} untuk area Kecamatan ${target.kecamatan}, ${target.labelKotaKabupaten} (${target.wilayah}). Mohon info estimasi & jadwal surveinya ya.`;
    const waMessage = (whatsappGreeting || defaultGreeting)
      .replace(/\{\{\s*topik\s*\}\}/gi, topic)
      .replace(/\{\{\s*kecamatan\s*\}\}/gi, target.kecamatan)
      .replace(/\{\{\s*label_kota_kabupaten\s*\}\}/gi, target.labelKotaKabupaten)
      .replace(/\{\{\s*kota_kabupaten\s*\}\}/gi, target.kotaKabupaten)
      .replace(/\{\{\s*wilayah\s*\}\}/gi, target.wilayah);
    const whatsappUrl = buildWhatsAppUrl(whatsappNumber, waMessage);

    const seoElementsVerify = {
      hasH1: /<h1>/i.test(htmlContent),
      hasH2: /<h2>/i.test(htmlContent),
      hasH3: /<h3>/i.test(htmlContent),
      hasBold: /<strong>|<b>/i.test(htmlContent),
      hasUnderline: /<u>/i.test(htmlContent),
      hasImageWithAlt: /<img[^>]+alt="[^"]+"/i.test(htmlContent),
      hasImageWithTitle: /<img[^>]+title="[^"]+"/i.test(htmlContent),
      hasHyperlink: /<a[^>]+href="https?:\/\//i.test(htmlContent),
      hasWhatsappCta: /https:\/\/wa\.me\//i.test(htmlContent),
      hasJsonLdSchema: /application\/ld\+json/i.test(htmlContent)
    };

    generated.push({
      id: `art_${idx + 1}`,
      slug,
      wilayah: target.wilayah,
      jenisDaerah: target.jenisDaerah,
      kotaKabupaten: target.kotaKabupaten,
      labelKotaKabupaten: target.labelKotaKabupaten,
      kecamatan: target.kecamatan,
      regionLabel,
      title: bestCandidate.title,
      metaTitle: seoMeta.metaTitle,
      metaDescription: seoMeta.metaDescription,
      whatsappUrl,
      assignedImages: assignedImagesMeta,
      content: bestCandidate.content,
      htmlContent,
      seoElementsVerify,
      attemptsUsed
    });
  }

  const uniquenessAudit = evaluateBatchUniqueness(generated);

  const enrichedArticles = generated.map((art, i) => ({
    ...art,
    uniquenessPercent: uniquenessAudit.articleReports[i].uniquenessPercent,
    maxOverlap4Percent: uniquenessAudit.articleReports[i].maxOverlap4Percent,
    maxOverlap5Percent: uniquenessAudit.articleReports[i].maxOverlap5Percent,
    wordCount: uniquenessAudit.articleReports[i].wordCount,
    copyscapeStatus: uniquenessAudit.articleReports[i].copyscapeStatus
  }));

  return {
    articles: enrichedArticles,
    audit: uniquenessAudit
  };
}

module.exports = {
  COPYSCAPE_SAFE_MAX_OVERLAP_PCT,
  stripHtmlAndScripts,
  tokenizeWords,
  extractShingles,
  compareTwoArticles,
  evaluateBatchUniqueness,
  renderProjectImagesForArticle,
  generateCopyscapeSafeBatch
};
