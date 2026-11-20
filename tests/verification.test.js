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
