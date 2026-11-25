const test = require('node:test');
const assert = require('node:assert/strict');
const { getAllRegions, resolveGeoTargets } = require('../src/domain/regions');
const {
  resolveSpintax,
  injectGeoVariables,
  countSpintaxPermutations,
  buildMasterSpintaxBlueprint,
  generateSitemapXml
} = require('../src/domain/spintaxEngine');
const {
  detectArticleLanguage,
  autoSpinRawArticle,
  assembleAutoTemplate,
  calculateSafeArticleCapacity
} = require('../src/domain/autoSpinLanguageEngine');
const {
  generateCopyscapeSafeBatch,
  COPYSCAPE_SAFE_MAX_OVERLAP_PCT
} = require('../src/domain/copyscapeVerifier');
const {
  buildTextQuery,
  searchPlaces,
  assertPublicHttpUrl,
  extractEmails,
  findEmailOnWebsite,
  filterAndSortLeads,
  leadsToCsv
} = require('../src/domain/placesLeadFinder');
const {
  sanitizeHeaderValue,
  getCommodityTemplate,
  buildEmailOutreachQueue
} = require('../src/domain/emailOutreachEngine');
const { createAppServer, APP_IDENTITY } = require('../src/server');

test('L2 - Nested Spintax Engine resolves multi-level options and counts permutations accurately', () => {
  const sample = '{Halo|Selamat {Pagi|Siang|Sore}} warga {{kecamatan}} di {{label_kota_kabupaten}}!';
  const stats = countSpintaxPermutations(sample);
  assert.equal(stats.totalBlocks, 2);

  const spun = resolveSpintax(sample, 'seed-1', 0);
  assert.ok(!spun.includes('{Halo|'), 'Spintax braces should be resolved');
  assert.ok(spun.includes('{{kecamatan}}'), 'Double curly geo variables must be preserved during spintax resolution');

  const finalStr = injectGeoVariables(spun, {
    wilayah: 'Jawa Barat',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Bandung',
    labelKotaKabupaten: 'Kota Bandung',
    kecamatan: 'Coblong'
  });
  assert.ok(finalStr.includes('Coblong'));
  assert.ok(finalStr.includes('Kota Bandung'));
});

test('L2 - Geo Hierarchy covers all 38 Indonesian Provinces with Kota, Kabupaten, & Kecamatan', () => {
  const allProvinces = getAllRegions();
  assert.equal(allProvinces.length, 38, 'Must include all 38 official provinces of Indonesia');

  const papuaBDTargets = resolveGeoTargets({
    wilayah: 'Papua Barat Daya',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Sorong'
  });
  assert.ok(papuaBDTargets.length >= 3);
  assert.equal(papuaBDTargets[0].wilayah, 'Papua Barat Daya');

  const acehTargets = resolveGeoTargets({
    wilayah: 'Aceh',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Banda Aceh'
  });
  assert.ok(acehTargets.length >= 4);
  assert.equal(acehTargets[0].labelKotaKabupaten, 'Kota Banda Aceh');
});

test('L2 - Auto-Language Detection (ID, EN, Mixed) & Automatic Nested Spintax + Auto-Template Wrapper', () => {
  const rawId =
    'Kami menyediakan layanan instalasi panel surya terbaik dan terpercaya untuk pelanggan rumah maupun gedung dengan biaya terjangkau serta bergaransi resmi.';
  const detId = detectArticleLanguage(rawId);
  assert.equal(detId.languageCode, 'id');

  const rawEn =
    'We provide the best and most trusted professional solar installation service for customers with affordable quality solutions.';
  const detEn = detectArticleLanguage(rawEn);
  assert.equal(detEn.languageCode, 'en');

  const spunId = autoSpinRawArticle(rawId, { topic: 'Jasa Panel Surya' });
  assert.ok(spunId.blocksCreated >= 5, 'Should automatically inject nested spintax blocks');
  assert.ok(spunId.spunArticleBody.includes('{{kecamatan}}'), 'Should inject regional context hooks');

  const wrappedTemplate = assembleAutoTemplate({
    spunBody: spunId.spunArticleBody,
    topic: 'Jasa Panel Surya',
    whatsappNumber: '6281234567890',
    targetUrl: 'https://solar.id'
  });
  assert.ok(wrappedTemplate.includes('wa-cta-top'), 'Auto-template must include Top WhatsApp CTA');
  assert.ok(wrappedTemplate.includes('wa-cta-bottom'), 'Auto-template must include Bottom WhatsApp CTA');
  assert.ok(wrappedTemplate.includes('{{PROJECT_IMAGES_BLOCK}}'), 'Auto-template must include project images placeholder');
  assert.ok(wrappedTemplate.includes('{{wa_url}}'), 'Auto-template must include WhatsApp CTA placeholder');
  assert.ok(wrappedTemplate.includes('{{target_url}}'), 'Auto-template must include URL hyperlink placeholder');

  // Verify short 1-paragraph raw article + auto-template passes Copyscape <= 14% across 5 sibling Kecamatan
  const bandungTargets = resolveGeoTargets({
    wilayah: 'Jawa Barat',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Bandung'
  }).slice(0, 5);
  const shortBatch = generateCopyscapeSafeBatch({
    masterSpintax: wrappedTemplate,
    geoTargets: bandungTargets,
    topic: 'Jasa Panel Surya',
    whatsappNumber: '6281234567890'
  });
  assert.equal(shortBatch.audit.allPassed, true, `Short raw article auto-spin must pass Copyscape <= 14%, got ${shortBatch.audit.maxOverlapPercent}%`);
  assert.ok(!shortBatch.articles[0].metaTitle.endsWith('Kot'), 'Meta title must not truncate mid-word');

  const capacity = calculateSafeArticleCapacity({
    spintaxTemplate: wrappedTemplate,
    projectImageCount: 99,
    requestedArticleCount: 15
  });
  assert.ok(capacity.recommendedSafeMaxArticles >= 20, 'Safe max articles should reflect sentence blocks + 99 images');
  assert.equal(capacity.status, 'AMAN_BEBAS_SAMPAH');
});

test('L2 - Project Multi-Image Pool (up to 99 images), Topic-Matched Image Titles, & Copyscape Gate', () => {
  const blueprint = buildMasterSpintaxBlueprint({
    topic: 'Jasa Instalasi Panel Surya Atap',
    category: 'energi',
    tone: 'profesional'
  });

  const targets = resolveGeoTargets({
    wilayah: 'Jawa Barat',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Bandung'
  });

  const ninetyNineImages = Array.from({ length: 99 }, (_, i) => ({
    slot_index: i + 1,
    image_url: `https://cdn.nusantaraseo.id/proj-a/img-${i + 1}.jpg`,
    custom_title_pattern: `{{topik}} — Dokumentasi #${i + 1} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`,
    custom_alt_pattern: `Foto {{topik}} #${i + 1} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`
  }));

  const batch = generateCopyscapeSafeBatch({
    masterSpintax: blueprint.masterSpintax,
    geoTargets: targets,
    topic: blueprint.topic,
    callToAction: blueprint.callToAction,
    projectImages: ninetyNineImages,
    imagesPerArticle: 2
  });

  assert.equal(batch.articles.length, targets.length);
  assert.equal(batch.audit.allPassed, true);
  assert.ok(batch.audit.maxOverlapPercent <= COPYSCAPE_SAFE_MAX_OVERLAP_PCT);

  // Verify each article receives 2 distinct rotated images from the 99-image pool with topic-matched title
  assert.equal(batch.articles[0].assignedImages.length, 2);
  assert.equal(batch.articles[0].assignedImages[0].slotIndex, 1);
  assert.equal(batch.articles[1].assignedImages[0].slotIndex, 3);
  assert.ok(batch.articles[0].assignedImages[0].title.includes('Jasa Instalasi Panel Surya Atap'));
  assert.equal(batch.articles[0].seoElementsVerify.hasImageWithTitle, true);
});

test('L3 & L5 - Project A (99 Images) vs Project B (99 Images) Persistence, Multi-Tenant Isolation, & Auto-Spin API', async () => {
  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  // 1. Health & Version 1.2.0 check
  const healthRes = await dispatch({ method: 'GET', url: '/api/v1/health' });
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.appIdentity, APP_IDENTITY);
  assert.equal(healthData.version, '1.4.0');
  assert.equal(healthData.maxImagesPerProject, 99);

  // 2. Save 99 images for Project A and 99 images for Project B independently
  const images99A = Array.from({ length: 99 }, (_, i) => `https://cdn.example.com/project-a/photo-${i + 1}.jpg`);
  const images99B = Array.from({ length: 99 }, (_, i) => `https://cdn.example.com/project-b/renov-${i + 1}.jpg`);

  const saveARes = await dispatch({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: {
      projectId: 'proj_a',
      name: 'Project A — 99 Solar Images',
      topic: 'Jasa Panel Surya',
      images: images99A
    }
  });
  assert.equal(saveARes.status, 200);
  const savedAData = await saveARes.json();
  assert.equal(savedAData.project.imageCount, 99);

  const saveBRes = await dispatch({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: {
      projectId: 'proj_b',
      name: 'Project B — 99 Renovasi Images',
      topic: 'Jasa Kontraktor Renovasi',
      images: images99B
    }
  });
  assert.equal(saveBRes.status, 200);
  const savedBData = await saveBRes.json();
  assert.equal(savedBData.project.imageCount, 99);

  // Verify Project A still has its own 99 images untouched by Project B
  const listProjRes = await dispatch({
    method: 'GET',
    url: '/api/v1/projects',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' }
  });
  const listProjData = await listProjRes.json();
  const foundA = listProjData.projects.find((p) => p.id === 'proj_a');
  const foundB = listProjData.projects.find((p) => p.id === 'proj_b');
  assert.equal(foundA.imageCount, 99);
  assert.equal(foundB.imageCount, 99);
  assert.ok(foundA.images[98].image_url.includes('/project-a/photo-99.jpg'));
  assert.ok(foundB.images[98].image_url.includes('/project-b/renov-99.jpg'));

  // 3. Reject > 99 images (100 images -> 400 Bad Request)
  const images100 = Array.from({ length: 100 }, (_, i) => `https://cdn.example.com/overflow-${i + 1}.jpg`);
  const overflowRes = await dispatch({
    method: 'POST',
    url: '/api/v1/projects',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: {
      projectId: 'proj_a',
      name: 'Overflow Test',
      topic: 'Jasa Panel Surya',
      images: images100
    }
  });
  assert.equal(overflowRes.status, 400);

  // 4. Auto-Spin API endpoint with raw article & anti-trash capacity recommendation
  const autoSpinRes = await dispatch({
    method: 'POST',
    url: '/api/v1/spintax/auto-spin',
    body: {
      topic: 'Jasa Waterproofing Atap Beton',
      rawMainArticle:
        'Kami memberikan layanan waterproofing terbaik dan profesional untuk mengatasi masalah kebocoran gedung dengan harga terjangkau dan kualitas bergaransi.',
      projectImageCount: 99,
      requestedArticleCount: 10
    }
  });
  assert.equal(autoSpinRes.status, 200);
  const autoSpinData = await autoSpinRes.json();
  assert.equal(autoSpinData.detectedLanguage.languageCode, 'id');
  assert.ok(autoSpinData.capacity.recommendedSafeMaxArticles >= 15);
});

test('L2 & L3 - Google Places Lead Finder: Official API Pagination, SSRF Guard, Email Lookup, Filter/Sort, CSV & RBAC', async () => {
  assert.equal(buildTextQuery('coffee shop', 'Depok'), 'coffee shop di Depok');

  // 1. Missing API key must return 503 PLACES_API_NOT_CONFIGURED
  await assert.rejects(
    () => searchPlaces({ keyword: 'coffee shop', location: 'Depok', apiKey: '' }),
    (err) => err.status === 503 && err.code === 'PLACES_API_NOT_CONFIGURED'
  );

  // 2. Mocked Google Places API (New) multi-page pagination + reviews + openingHours
  let callCount = 0;
  const mockPlacesFetch = async (_url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    if (!body.pageToken) {
      return {
        ok: true,
        async json() {
          return {
            places: [
              {
                id: 'plc_1',
                displayName: { text: 'Kopi Margonda Depok' },
                formattedAddress: 'Jl. Margonda Raya No. 10, Depok',
                nationalPhoneNumber: '021-777888',
                internationalPhoneNumber: '+62 21-777888',
                websiteUri: 'https://kopimargonda.example.com',
                rating: 4.8,
                userRatingCount: 520,
                businessStatus: 'OPERATIONAL',
                regularOpeningHours: { weekdayDescriptions: ['Senin: 08.00–22.00'] },
                currentOpeningHours: { openNow: true },
                reviews: [{ rating: 5, text: { text: 'Kopi enak dan nyaman' }, authorAttribution: { displayName: 'Andi' } }]
              }
            ],
            nextPageToken: 'page_2_tok'
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          places: [
            {
              id: 'plc_2',
              displayName: { text: '=CMD|Kopi Beji' },
              formattedAddress: 'Beji, Depok',
              rating: 4.2,
              userRatingCount: 90,
              businessStatus: 'OPERATIONAL'
            }
          ]
        };
      }
    };
  };

  const searchRes = await searchPlaces({
    keyword: 'coffee shop',
    location: 'Depok',
    apiKey: 'test-places-key',
    maxResults: 40,
    includeReviews: true,
    fetchImpl: mockPlacesFetch
  });
  assert.equal(callCount, 2);
  assert.equal(searchRes.totalResults, 2);
  assert.equal(searchRes.places[0].phone, '021-777888');
  assert.equal(searchRes.places[0].reviews.length, 1);
  assert.equal(searchRes.places[0].attribution, 'Data tempat: Google Maps');

  // 3. SSRF Guard blocks localhost & private IP ranges
  await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1:8080/admin', { resolveDns: false }));
  await assert.rejects(() => assertPublicHttpUrl('http://169.254.169.254/latest/meta-data', { resolveDns: false }));
  await assert.rejects(() => assertPublicHttpUrl('http://192.168.1.1/', { resolveDns: false }));

  // 4. Email extraction & robots.txt respect
  const extracted = extractEmails('<a href="mailto:Halo@KopiDepok.id">Email</a> <!-- ignore@sentry.io -->');
  assert.deepEqual(extracted, ['halo@kopidepok.id']);

  const mockSiteFetch = async (url) => {
    if (url.endsWith('/robots.txt')) return { ok: true, async text() { return 'User-agent: *\nDisallow: /private'; } };
    if (url.endsWith('/contact')) return { ok: true, async text() { return 'Hubungi kami di cs@kopimargonda.id'; } };
    return { ok: true, async text() { return '<html>Selamat datang</html>'; } };
  };
  const emailRes = await findEmailOnWebsite('https://kopimargonda.example.com/', {
    fetchImpl: mockSiteFetch,
    resolveDns: false
  });
  assert.equal(emailRes.email, 'cs@kopimargonda.id');
  assert.equal(emailRes.status, 'FOUND');

  // 5. Filter by Phone, Email, OpeningHours, OpenNow & CSV Formula Injection protection
  searchRes.places[0].email = emailRes.email;
  const strictFiltered = filterAndSortLeads(searchRes.places, {
    requirePhone: true,
    requireEmail: true,
    requireOpeningHours: true,
    openNowOnly: true
  });
  assert.equal(strictFiltered.length, 1);
  assert.equal(strictFiltered[0].name, 'Kopi Margonda Depok');

  const csvOut = leadsToCsv(searchRes.places, ['name', 'phone', 'email']);
  assert.ok(csvOut.includes(`"'=CMD|Kopi Beji"`), 'CSV export must neutralize formula injection');
  assert.ok(csvOut.includes('Sumber data tempat: Google Maps'));

  // 6. Server Endpoints: RBAC on /api/v1/leads/search, /api/v1/leads/filter, and /leads.html
  const { dispatch } = createAppServer({ dbPath: ':memory:' });
  const viewerLeadRes = await dispatch({
    method: 'POST',
    url: '/api/v1/leads/search',
    headers: { 'X-User-Id': 'usr_viewer_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: { keyword: 'coffee shop', location: 'Depok' }
  });
  assert.equal(viewerLeadRes.status, 403, 'Viewer role must not be allowed to trigger paid Places API search');

  const ownerNoKeyRes = await dispatch({
    method: 'POST',
    url: '/api/v1/leads/search',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: { keyword: 'coffee shop', location: 'Depok' }
  });
  assert.equal(ownerNoKeyRes.status, 503, 'Missing GOOGLE_PLACES_API_KEY must return 503');

  const filterCsvRes = await dispatch({
    method: 'POST',
    url: '/api/v1/leads/filter',
    body: {
      leads: searchRes.places,
      filters: { requirePhone: true, requireEmail: true },
      format: 'csv'
    }
  });
  assert.equal(filterCsvRes.status, 200);
  const csvBody = await filterCsvRes.text();
  assert.ok(csvBody.includes('Kopi Margonda Depok'));

  const leadsPageRes = await dispatch({ method: 'GET', url: '/leads.html' });
  assert.equal(leadsPageRes.status, 200);
  const leadsHtml = await leadsPageRes.text();
  assert.ok(leadsHtml.includes('Lead Finder'));
});

test('L2 & L3 - B2B Commodity Email Spintax, Multi-Sender Rotation, Random Drip (3-5m) vs Blast Mode, & Tenant Isolation', async () => {
  // 1. CRLF Header Injection Sanitization
  assert.equal(sanitizeHeaderValue('Offer\r\nBcc: evil@attacker.com'), 'Offer Bcc: evil@attacker.com');

  const tpl = getCommodityTemplate({ language: 'en', commodity: 'Indonesian Gayo Arabica Beans' });
  const japanRecipients = [
    { name: 'Shibuya Roast', email: 'buyer@shibuya.example.jp', cityArea: 'Tokyo' },
    { name: 'Kamo Coffee', email: 'beans@kamo.example.jp', cityArea: 'Kyoto' },
    { name: 'Kamo Duplicate', email: 'BEANS@kamo.example.jp', cityArea: 'Kyoto' }, // duplicate email must be skipped
    { name: 'Namba Espresso', email: 'sourcing@namba.example.jp', cityArea: 'Osaka' },
    { name: 'Bad Email', email: 'not-an-email', cityArea: 'Osaka' }
  ];
  const senders = [
    { name: 'Raka', email: 'export@nusantararoastery.id', providerType: 'SMTP Server' },
    { name: 'Sinta', email: 'b2b@kopiarabika.co.id', providerType: 'Gmail Workspace' }
  ];

  // 2. Random Drip Schedule (3 - 5 minutes random spacing)
  const dripResult = buildEmailOutreachQueue({
    recipients: japanRecipients,
    senders,
    subjectSpintax: tpl.subjectSpintax,
    bodySpintax: tpl.bodySpintax,
    commodity: 'Indonesian Gayo Arabica Beans',
    websiteUrl: 'https://nusantararoastery.id/katalog-ekspor',
    websiteLabel: 'Lihat Katalog Ekspor',
    imageUrl: 'https://nusantararoastery.id/img/gayo-beans.jpg',
    scheduleMode: 'drip_random',
    minDelayMinutes: 3,
    maxDelayMinutes: 5,
    startTimeIso: '2026-11-17T02:00:00.000Z',
    campaignSeed: 'jp-coffee-test'
  });

  assert.equal(dripResult.summary.totalQueued, 3, 'Duplicate and invalid emails must be filtered out');
  assert.equal(dripResult.summary.totalSkipped, 2);
  assert.equal(dripResult.summary.uniqueSendersUsed, 2, 'Round-robin must rotate across both sender addresses');
  assert.equal(dripResult.queueItems[0].senderEmail, 'export@nusantararoastery.id');
  assert.equal(dripResult.queueItems[1].senderEmail, 'b2b@kopiarabika.co.id');
  assert.ok(dripResult.queueItems[0].htmlBody.includes('<img src="https://nusantararoastery.id/img/gayo-beans.jpg"'), 'HTML email must include product image');
  assert.ok(dripResult.queueItems[0].htmlBody.includes('href="https://nusantararoastery.id/katalog-ekspor"'), 'HTML email must include website link');
  assert.ok(dripResult.queueItems[1].stepGapMinutes >= 3 && dripResult.queueItems[1].stepGapMinutes <= 5, 'Step gap must be randomly between 3 and 5 minutes');
  assert.ok(dripResult.queueItems[2].stepGapMinutes >= 3 && dripResult.queueItems[2].stepGapMinutes <= 5);
  assert.notEqual(dripResult.queueItems[0].subject, dripResult.queueItems[1].subject, 'Subjects must be spun uniquely per recipient');

  // 3. Blast Mode
  const blastResult = buildEmailOutreachQueue({
    recipients: japanRecipients,
    senders,
    subjectSpintax: tpl.subjectSpintax,
    bodySpintax: tpl.bodySpintax,
    scheduleMode: 'blast',
    startTimeIso: '2026-11-17T02:00:00.000Z'
  });
  assert.equal(blastResult.summary.scheduleMode, 'blast');
  assert.equal(blastResult.queueItems[1].status, 'READY_BLAST');
  assert.ok(blastResult.summary.totalEstimatedDurationMinutes < 0.1, 'Blast mode must schedule within seconds');

  // 4. Server Persistence, RBAC & Cross-Tenant Isolation (Anti-IDOR)
  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  const viewerRes = await dispatch({
    method: 'POST',
    url: '/api/v1/email-campaigns',
    headers: { 'X-User-Id': 'usr_viewer_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: { recipients: japanRecipients, senders }
  });
  assert.equal(viewerRes.status, 403, 'Viewer must be blocked from creating email campaigns');

  const createRes = await dispatch({
    method: 'POST',
    url: '/api/v1/email-campaigns',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: {
      recipients: japanRecipients,
      senders,
      commodity: 'Indonesian Gayo Arabica Beans',
      scheduleMode: 'drip_random',
      minDelayMinutes: 3,
      maxDelayMinutes: 5
    }
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(created.emailCampaignId.startsWith('ecmp_'));

  const idorRes = await dispatch({
    method: 'GET',
    url: `/api/v1/email-campaigns/${created.emailCampaignId}`,
    headers: { 'X-User-Id': 'usr_owner_b', 'X-Workspace-Id': 'wks_mitra' }
  });
  assert.equal(idorRes.status, 404, 'Cross-tenant read of email campaign must return 404');

  const pageRes = await dispatch({ method: 'GET', url: '/email-outreach.html' });
  assert.equal(pageRes.status, 200);
  const html = await pageRes.text();
  assert.ok(html.includes('Spintax Email'));
});

test('L2 & L3 - Custom WhatsApp Greeting, Sitemap XML Generator & GSC Submit Endpoint RBAC', async () => {
  const targets = resolveGeoTargets({
    wilayah: 'Jawa Barat',
    jenisDaerah: 'Kota',
    kotaKabupaten: 'Bandung'
  }).slice(0, 2);

  const blueprint = buildMasterSpintaxBlueprint({ topic: 'Jasa Kanopi' });
  const batch = generateCopyscapeSafeBatch({
    masterSpintax: blueprint.masterSpintax,
    geoTargets: targets,
    topic: 'Jasa Kanopi',
    whatsappNumber: '081234567890',
    whatsappGreeting: 'Halo Kak, mau tanya {{topik}} untuk Kecamatan {{kecamatan}} ({{label_kota_kabupaten}}).'
  });
  assert.ok(batch.articles[0].whatsappUrl.includes(encodeURIComponent('Halo Kak, mau tanya Jasa Kanopi untuk Kecamatan Coblong')));

  const xml = generateSitemapXml({
    siteUrl: 'https://www.domainanda.com/',
    slugs: batch.articles.map((a) => a.slug)
  });
  assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.includes(`https://www.domainanda.com/${batch.articles[0].slug}`));

  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  const sitemapRes = await dispatch({
    method: 'POST',
    url: '/api/v1/gsc/sitemap',
    body: { siteUrl: 'https://www.domainanda.com/', slugs: ['artikel-1', 'artikel-2'] }
  });
  assert.equal(sitemapRes.status, 200);
  const sitemapData = await sitemapRes.json();
  assert.equal(sitemapData.totalUrls, 3);

  const viewerGscRes = await dispatch({
    method: 'POST',
    url: '/api/v1/gsc/submit',
    headers: { 'X-User-Id': 'usr_viewer_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: { siteUrl: 'https://www.domainanda.com/', sitemapUrl: 'https://www.domainanda.com/sitemap.xml' }
  });
  assert.equal(viewerGscRes.status, 403, 'Viewer must be blocked from submitting to GSC');

  const ownerGscNoKey = await dispatch({
    method: 'POST',
    url: '/api/v1/gsc/submit',
    headers: { 'X-User-Id': 'usr_owner_a', 'X-Workspace-Id': 'wks_nusantara' },
    body: { siteUrl: 'https://www.domainanda.com/', sitemapUrl: 'https://www.domainanda.com/sitemap.xml' }
  });
  assert.equal(ownerGscNoKey.status, 503, 'Missing service-account-key.json must return 503');
});

test('L2 & L3 - SEO Tools: Competitor Backlink Spy & 4-Stage Clone Pipeline (Scrape -> List -> Auto-Fill -> Spintax Post)', async () => {
  const {
    analyzeCompetitorDomain,
    generateCloneSubmissionPlan
  } = require('../src/domain/competitorBacklinkEngine');

  // 1. Domain Backlink Profiling
  const profile = analyzeCompetitorDomain('https://kompetitor-jaya.co.id/layanan-utama');
  assert.equal(profile.competitorDomain, 'kompetitor-jaya.co.id');
  assert.ok(profile.metrics.estimatedTotalBacklinks > 100);
  assert.ok(profile.metrics.dofollowRatioPercent > 50);
  assert.ok(profile.curatedTargetWebsites.length >= 6);
  assert.ok(profile.curatedTargetWebsites[0].submissionUrl.startsWith('http'));

  // 2. Clone Submission Pipeline Plan
  const plan = generateCloneSubmissionPlan({
    competitorDomain: 'kompetitor-jaya.co.id',
    yourWebsiteUrl: 'https://wevo.biz.id',
    brandName: 'LocalSpin AI Wevo',
    topic: 'Jasa Pemasangan Solar Panel',
    selectedTargets: profile.curatedTargetWebsites.slice(0, 4)
  });

  assert.equal(plan.totalTargetsPrepared, 4);
  assert.equal(plan.autoFillProfile.brandName, 'LocalSpin AI Wevo');
  assert.ok(plan.autoFillProfile.contactEmail.includes('@wevo.biz.id'));
  assert.ok(plan.submissionTasks[0].autoFillData.websiteUrl === 'https://wevo.biz.id');
  assert.ok(plan.submissionTasks[0].readyToPostContent.spintaxBody.includes('{'));
  assert.ok(plan.submissionTasks[0].readyToPostContent.plainPreview.includes('https://wevo.biz.id'));

  // 3. API Endpoints
  const { createAppServer } = require('../src/server');
  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  const apiBacklinkRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/competitor-backlinks',
    body: { competitorUrl: 'kompetitor-jaya.co.id' }
  });
  assert.equal(apiBacklinkRes.status, 200);
  const backlinkData = await apiBacklinkRes.json();
  assert.equal(backlinkData.competitorDomain, 'kompetitor-jaya.co.id');

  const apiCloneRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/clone-pipeline',
    body: {
      competitorDomain: 'kompetitor-jaya.co.id',
      yourWebsiteUrl: 'https://wevo.biz.id',
      brandName: 'Wevo Solutions',
      topic: 'Jasa Panel Surya'
    }
  });
  assert.equal(apiCloneRes.status, 200);
  const cloneData = await apiCloneRes.json();
  assert.ok(cloneData.submissionTasks.length > 0);
});

test('L2 & L3 - SEO Tools Suite: Zombie Blog Hunter, Multi-Engine Indexing, Drip-Feed, SERP/Rank Tracking, & Free Utilities', async () => {
  const { createAppServer } = require('../src/server');
  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  // 1. Dead-Web & Website Zombie Hunter API (Linkmortem & Crawlora Engine)
  const zombieRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/dead-web-hunter',
    body: { keyword: 'jasa kanopi', platform: 'ALL', minDa: 25, limit: 6 }
  });
  assert.equal(zombieRes.status, 200);
  const zombieData = await zombieRes.json();
  assert.equal(zombieData.websites.length, 6);
  assert.ok(zombieData.websites[0].domainAuthority >= 20);
  assert.ok(zombieData.websites[0].deadwebStatus);
  assert.ok(zombieData.websites[0].waybackArchiveUrl.includes('web.archive.org'));

  // 1-B. Multi-Website Auto-Post Dispatcher (Instant, Fixed Drip, Random Anti-Footprint Drip + Atomic Sitemap Overwrite)
  const autoPostRes = await dispatch({
    method: 'POST',
    url: '/api/v1/autopost/dispatch',
    body: {
      slots: [
        { id: 1, name: 'WP Main', platform: 'WORDPRESS', targetUrl: 'https://wevo.biz.id/wp-json/wp/v2/posts', active: true },
        { id: 2, name: 'Blogger PBN', platform: 'BLOGGER', targetUrl: 'https://pbn.blogspot.com', active: true },
        { id: 3, name: 'Custom Webhook', platform: 'WEBHOOK', targetUrl: 'https://cms.wevo.biz.id/hook', active: true }
      ],
      articles: [
        { title: 'Jasa Pemasangan Kanopi Modern', slug: 'jasa-pemasangan-kanopi-modern', htmlContent: '<p>Konten artikel.</p>' }
      ],
      mode: 'drip_random',
      updateSitemap: true,
      triggerMassPing: true,
      triggerGsc: true,
      siteUrl: 'https://wevo.biz.id'
    }
  });
  assert.equal(autoPostRes.status, 200);
  const autoPostData = await autoPostRes.json();
  assert.equal(autoPostData.postMode, 'drip_random');
  assert.equal(autoPostData.totalSlotsDispatched, 3);
  assert.equal(autoPostData.sitemapUpdated, true);

  // 2. Multi-Engine Index Checker (Google, Bing, Yandex)
  const indexCheckRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/index-checker',
    body: {
      urls: ['https://wevo.biz.id', 'https://wevo.biz.id/layanan'],
      engine: 'yandex'
    }
  });
  assert.equal(indexCheckRes.status, 200);
  const indexCheckData = await indexCheckRes.json();
  assert.equal(indexCheckData.totalChecked, 2);
  assert.equal(indexCheckData.engine, 'yandex');
  assert.ok(indexCheckData.results[0].searchQueryUrl.includes('yandex.com'));

  // 3. Direct Indexing Submission (Google Indexing API + Yandex IndexNow Ping)
  const indexSubmitRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/indexing-service',
    body: {
      urls: ['https://wevo.biz.id/artikel/pasang-ac-jakarta'],
      engine: 'all'
    }
  });
  assert.equal(indexSubmitRes.status, 200);
  const indexSubmitData = await indexSubmitRes.json();
  assert.equal(indexSubmitData.totalSubmitted, 1);
  assert.equal(indexSubmitData.submissions[0].googleIndexingApi.status, 'SUBMITTED');
  assert.equal(indexSubmitData.submissions[0].yandexIndexNow.status, 'PINGED');

  // 4. Drip-Feed Indexing Scheduler
  const dripRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/drip-feed-scheduler',
    body: {
      urls: Array.from({ length: 25 }, (_, i) => `https://wevo.biz.id/page-${i + 1}`),
      batchSize: 10,
      intervalMinutes: 20
    }
  });
  assert.equal(dripRes.status, 200);
  const dripData = await dripRes.json();
  assert.equal(dripData.totalBatches, 3);
  assert.equal(dripData.batches[0].urls.length, 10);
  assert.equal(dripData.batches[2].urls.length, 5);

  // 5. Top 10 SERP Analyzer
  const serpRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/top10-serp',
    body: { keyword: 'service pompa air jogja' }
  });
  assert.equal(serpRes.status, 200);
  const serpData = await serpRes.json();
  assert.equal(serpData.top10Results.length, 10);
  assert.ok(serpData.averageTop10WordCount > 500);

  // 6. Rank Tracker
  const rankRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/rank-tracker',
    body: {
      domain: 'wevo.biz.id',
      keywords: ['jasa pasang canopy', 'harga borongan las']
    }
  });
  assert.equal(rankRes.status, 200);
  const rankData = await rankRes.json();
  assert.equal(rankData.totalKeywords, 2);
  assert.ok(rankData.rankings[0].currentPosition >= 1);

  // 7. Index Monitoring & Alert
  const monitorRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/index-monitoring',
    body: { domain: 'wevo.biz.id' }
  });
  assert.equal(monitorRes.status, 200);
  const monitorData = await monitorRes.json();
  assert.ok(monitorData.monitoredCount >= 5);

  // 8. Bulk Site Pages Checker (site:domain.com)
  const bulkRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/bulk-site-pages',
    body: { domain: 'wevo.biz.id', estimatedPages: 100 }
  });
  assert.equal(bulkRes.status, 200);
  const bulkData = await bulkRes.json();
  assert.ok(bulkData.totalIndexedPages > 0);
  assert.ok(bulkData.indexRatioPercent > 0);

  // 9. Free Tools: Redirect Chain, Noindex, 404, Sitemap XML
  const redirectRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/free/redirect-checker',
    body: { url: 'http://wevo.biz.id' }
  });
  assert.equal(redirectRes.status, 200);
  const redirectData = await redirectRes.json();
  assert.ok(redirectData.hops.length >= 1);

  const noindexRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/free/noindex-checker',
    body: {
      url: 'https://wevo.biz.id/test',
      htmlContent: '<html><head><meta name="robots" content="noindex, follow"></head></html>'
    }
  });
  assert.equal(noindexRes.status, 200);
  const noindexData = await noindexRes.json();
  assert.equal(noindexData.isIndexable, false);
  assert.equal(noindexData.metaRobotsFound, true);

  const err404Res = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/free/404-checker',
    body: { urls: ['https://wevo.biz.id/h1', 'https://wevo.biz.id/h2'] }
  });
  assert.equal(err404Res.status, 200);
  const err404Data = await err404Res.json();
  assert.equal(err404Data.totalChecked, 2);

  const sitemapRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/free/sitemap-extractor',
    body: { xml: '<urlset><url><loc>https://wevo.biz.id/home</loc></url><url><loc>https://wevo.biz.id/kontak</loc></url></urlset>' }
  });
  assert.equal(sitemapRes.status, 200);
  const sitemapData = await sitemapRes.json();
  assert.equal(sitemapData.totalUrlsExtracted, 2);
  assert.equal(sitemapData.urls[0], 'https://wevo.biz.id/home');
});

test('L2 & L3 - Backlink-Miner Suite: Broken Link Discovery, Competitor Mining, Guest Post Hunting, Scoring Formula & Outreach SOP', async () => {
  const { dispatch } = createAppServer();

  // Test full Backlink-Miner pipeline via POST /api/v1/seo-tools/backlink-miner
  const minerRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/backlink-miner',
    body: {
      target_domain: 'wevo.biz.id',
      competitor_domains: ['cmlabs.co', 'seosatu.com'],
      niche_keywords: ['seo tools indonesia', 'spintax generator'],
      mode: 'all',
      depth: 'standard',
      bahasa_output: 'Indonesia'
    }
  });

  assert.equal(minerRes.status, 200);
  const data = await minerRes.json();
  assert.equal(data.success, true);
  assert.equal(data.metadata.target_domain, 'wevo.biz.id');
  assert.equal(data.metadata.total_found, 50);

  // Verify Scoring & Priority formula: priority = (relevance * 0.5) + (authority_estimate * 0.3) + ((10 - difficulty) * 0.2)
  const first = data.json_array[0];
  const expectedPriority = Number(((first.relevance_score * 0.5) + (first.authority_estimate * 0.3) + ((10 - first.difficulty) * 0.2)).toFixed(2));
  assert.equal(first.priority, expectedPriority, 'Priority calculation must follow the exact formula');

  // Verify opportunity types
  const types = new Set(data.json_array.map(item => item.opportunity_type));
  assert.ok(types.has('broken-link'), 'Must contain broken-link opportunities');
  assert.ok(types.has('competitor-backlink'), 'Must contain competitor-backlink opportunities');
  assert.ok(types.has('guest-post'), 'Must contain guest-post opportunities');

  // Verify Formats 6A (table_view) and 6B (json_array)
  assert.ok(data.table_view.length > 0);
  assert.ok(data.json_array.length > 0);
  assert.ok(data.top_5_analysis.length === 5);
  assert.ok(data.outreach_sop_top_3.length === 3);
  assert.ok(data.outreach_sop_top_3[0].subject.length > 0);
  assert.ok(data.outreach_sop_top_3[0].email_pitch_body.includes('wevo.biz.id'));

  // Verify validation guard when target_domain is missing
  const invalidRes = await dispatch({
    method: 'POST',
    url: '/api/v1/seo-tools/backlink-miner',
    body: { target_domain: '' }
  });
  assert.equal(invalidRes.status, 400);
});

test('L2 & L3 - Clean [BAGIAN 01..09] Stripping, Configurable Image/WA/Link Layout, & Phone (tel:) + Email (mailto:) Hyperlinks', async () => {
  const { dispatch } = createAppServer({ dbPath: ':memory:' });

  const noisyArticle = `
[ BAGIAN 01 ]
# Jasa Penulisan Artikel SEO Profesional

Layanan penulisan konten berkualitas tinggi untuk bisnis lokal.

[ BAGIAN 06 ]

## Risiko dan Kesalahan Umum Saat Memilih Layanan
Kesalahan yang sering terjadi adalah memilih jasa hanya berdasarkan skema tarif termurah tanpa memeriksa orisinalitas.
`;

  const spinRes = await dispatch({
    method: 'POST',
    url: '/api/v1/spintax/auto-spin',
    body: {
      rawMainArticle: noisyArticle,
      topic: 'Jasa Penulisan Artikel',
      useGemini: false,
      autoTemplateEnabled: true,
      whatsappNumber: '6281234567890',
      whatsappLabel: 'Chat WA Admin',
      targetUrl: '0812-9988-7766',
      anchorText: 'Telepon Konsultan Langsung',
      phoneLinkNumber: '021-77889900',
      phoneLinkAnchor: 'Hubungi Kantor Pusat',
      emailLinkAddress: 'order@wevo.biz.id',
      emailLinkAnchor: 'Kirim Email Order',
      imagePosition: 'bottom',
      whatsappPosition: 'middle',
      linkPosition: 'top'
    }
  });

  assert.equal(spinRes.status, 200);
  const spinData = await spinRes.json();
  const master = spinData.masterSpintax;

  // 1. Verify NO [ BAGIAN 01 ] or BAGIAN 06 leaked into masterSpintax
  assert.ok(!/BAGIAN\s*0?[1-9]/i.test(master), 'All [ BAGIAN 01..09 ] markers must be stripped completely');

  // 2. Verify tel: and mailto: hyperlinks are generated cleanly
  assert.ok(master.includes('href="tel:+6281299887766"'), 'Primary phone targetUrl must convert to tel:+62...');
  assert.ok(master.includes('href="tel:+622177889900"'), 'Dedicated phoneLinkNumber must render tel: hyperlink');
  assert.ok(master.includes('href="mailto:order@wevo.biz.id"'), 'Dedicated emailLinkAddress must render mailto: hyperlink');

  // 3. Verify configurable positions: Link at top, WA in middle (no wa-cta-top / wa-cta-bottom), Image at bottom
  assert.ok(!master.includes('wa-cta-top'), 'whatsappPosition=middle must not render top WA box');
  assert.ok(!master.includes('wa-cta-bottom'), 'whatsappPosition=middle must not render bottom WA box');
  assert.ok(master.includes('wa-cta-middle'), 'whatsappPosition=middle must render middle WA box');

  const linkIdx = master.indexOf('mailto:order@wevo.biz.id');
  const waMidIdx = master.indexOf('wa-cta-middle');
  const imgIdx = master.indexOf('{{PROJECT_IMAGES_BLOCK}}');
  assert.ok(linkIdx > 0 && linkIdx < waMidIdx, 'linkPosition=top must appear before middle WA box');
  assert.ok(imgIdx > waMidIdx, 'imagePosition=bottom must appear after middle section');
});

test('L2 & L3 - Section 1B Mini-Prompt Keyword Research, Auto-Extraction of Semantic Keywords & Related Entities, and Checklist Flow', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');

  const appJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.js'), 'utf8');
  const regionsJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'regionsData.js'), 'utf8');
  const sandbox = { window: {}, document: { getElementById: () => null, querySelectorAll: () => [] }, navigator: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(regionsJs + '\n' + appJs, sandbox);

  const client = sandbox.LocalSpinClient;
  assert.equal(typeof client.buildKeywordResearchMiniPrompt, 'function');
  assert.equal(typeof client.parseKeywordResearchIntoChecklist, 'function');
  assert.equal(typeof client.suggestLocalKeywordsAndEntities, 'function');

  const miniPrompt = client.buildKeywordResearchMiniPrompt({
    primaryKeyword: 'Jasa Catering Prasmanan Kantor',
    mainArticleText: 'Layanan catering higienis bersertifikat halal MUI dengan menu nusantara harian dan prasmanan rapat korporat.',
    wilayah: 'Jawa Barat',
    daerah: 'Kota Depok'
  });
  assert.ok(miniPrompt.includes('[KEYWORD_KHUSUS]'));
  assert.ok(miniPrompt.includes('[SEMANTIC_KEYWORDS]'));
  assert.ok(miniPrompt.includes('[RELATED_ENTITIES]'));
  assert.ok(miniPrompt.includes('halal MUI'));

  const pastedChatbotReply = `
[KEYWORD_KHUSUS]
1. harga catering prasmanan kantor: Paket ekonomis hingga VIP untuk rapat perusahaan
2. paket catering harian karyawan
3. jasa catering acara korporat terdekat

[SEMANTIC_KEYWORDS]
- menu prasmanan higienis
- standar dapur sehat
- porsi seimbang bergizi

[RELATED_ENTITIES]
- Sertifikasi Halal MUI
- Tim Koki Profesional
- Kecamatan {{kecamatan}}
`;
  const parsed = client.parseKeywordResearchIntoChecklist(
    pastedChatbotReply,
    'Jasa Catering Prasmanan Kantor',
    'Layanan catering higienis'
  );
  assert.deepEqual(Array.from(parsed.secondary), [
    'harga catering prasmanan kantor',
    'paket catering harian karyawan',
    'jasa catering acara korporat terdekat'
  ]);
  assert.deepEqual(Array.from(parsed.semantic), [
    'menu prasmanan higienis',
    'standar dapur sehat',
    'porsi seimbang bergizi'
  ]);
  assert.deepEqual(Array.from(parsed.entities), [
    'Sertifikasi Halal MUI',
    'Tim Koki Profesional',
    'Kecamatan {{kecamatan}}'
  ]);

  // Verify dashboard.html exposes all 1B mini-prompt & checklist elements
  const { dispatch } = createAppServer({ dbPath: ':memory:' });
  const dashRes = await dispatch({ method: 'GET', url: '/dashboard.html' });
  assert.equal(dashRes.status, 200);
  const dashHtml = await dashRes.text();
  assert.ok(dashHtml.includes('id="btnGenKeywordMiniPrompt"'));
  assert.ok(dashHtml.includes('id="textareaPasteKeywordResearch"'));
  assert.ok(dashHtml.includes('id="btnParseKeywordResearch"'));
  assert.ok(dashHtml.includes('id="kwChecklistSecondary"'));
  assert.ok(dashHtml.includes('id="kwChecklistSemantic"'));
  assert.ok(dashHtml.includes('id="kwChecklistEntities"'));
  assert.ok(dashHtml.includes('id="btnSaveKeywordChecklist"'));
});
