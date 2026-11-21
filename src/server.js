const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { Readable } = require('node:stream');
const { getAllRegions, resolveGeoTargets } = require('./domain/regions');
const {
  buildMasterSpintaxBlueprint,
  countSpintaxPermutations,
  generateSitemapXml
} = require('./domain/spintaxEngine');
const {
  detectArticleLanguage,
  autoSpinRawArticle,
  assembleAutoTemplate,
  calculateSafeArticleCapacity
} = require('./domain/autoSpinLanguageEngine');
const {
  collectGeminiKeySlots,
  spinArticleWithGeminiPool
} = require('./domain/geminiClient');
const {
  compareTwoArticles,
  evaluateBatchUniqueness,
  generateCopyscapeSafeBatch
} = require('./domain/copyscapeVerifier');
const {
  searchPlaces,
  searchPlacesSerper,
  searchPlacesFreeOsm,
  enrichLeadsWithEmails,
  filterAndSortLeads,
  leadsToCsv
} = require('./domain/placesLeadFinder');
const {
  getCommodityTemplate,
  buildEmailOutreachQueue
} = require('./domain/emailOutreachEngine');
const {
  PING_SERVICES_LIST,
  executeMassPing
} = require('./domain/massPingEngine');
const {
  analyzeCompetitorDomain,
  generateCloneSubmissionPlan
} = require('./domain/competitorBacklinkEngine');
const {
  ZOMBIE_PLATFORMS,
  huntZombieBlogs,
  checkSearchEngineIndex,
  submitIndexingService,
  scheduleDripFeedIndexing,
  analyzeTop10Serp,
  trackRankKeywords,
  monitorIndexAlerts,
  checkBulkSitePages,
  inspectRedirectChain,
  checkNoindexMeta,
  check404Errors,
  extractSitemapUrlsFromXml
} = require('./domain/seoToolsProEngine');
const {
  MAX_IMAGES_PER_PROJECT,
  createDatabase,
  authorizeWorkspaceAction,
  saveProjectAndImages,
  getProjectWithImages,
  listWorkspaceProjects,
  saveCampaignTransaction,
  getCampaignByIdScoped,
  saveEmailCampaignTransaction,
  getEmailCampaignByIdScoped
} = require('./db/database');
const {
  pingMongo,
  saveProjectToMongo,
  listProjectsFromMongo,
  getProjectFromMongo,
  saveCampaignToMongo,
  getCampaignFromMongo,
  saveEmailCampaignToMongo,
  getEmailCampaignFromMongo
} = require('./db/mongoStore');

const APP_IDENTITY = 'LocalSpin-AI-SaaS';
const APP_VERSION = '1.4.0';

function sendJson(res, status, payload, requestId) {
  const body = JSON.stringify({ ...payload, requestId });
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-App-Identity': `${APP_IDENTITY}/${APP_VERSION}`,
    'X-Request-Id': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function parseJsonBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(Object.assign(new Error('Ukuran payload melebihi batas maksimum 512KB.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }));
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Format JSON tidak valid.'), { status: 400, code: 'INVALID_JSON' }));
      }
    });
    req.on('error', reject);
  });
}

function createAppServer({ dbPath = ':memory:' } = {}) {
  const db = createDatabase(dbPath);
  const previewDir = path.join(__dirname, '..', 'preview');

  const requestHandler = async (req, res) => {
    const requestId = `req_${crypto.randomBytes(6).toString('hex')}`;
    const urlObj = new URL(req.url, `http://${(req.headers && req.headers.host) || 'localhost'}`);
    const pathname = urlObj.pathname;
    const headers = req.headers || {};

    try {
      // 1. Health & Application Identity Gate (04_VERIFICATION_PROTOCOL.md)
      if (req.method === 'GET' && pathname === '/api/v1/health') {
        const useMongo = Boolean(process.env.MONGODB_URI);
        const mongoStatus = useMongo ? await pingMongo() : { configured: false, connected: false };
        const geminiPool = collectGeminiKeySlots(process.env);
        return sendJson(
          res,
          200,
          {
            status: 'healthy',
            appIdentity: APP_IDENTITY,
            version: APP_VERSION,
            maxImagesPerProject: MAX_IMAGES_PER_PROJECT,
            database: useMongo ? { mode: 'mongodb_atlas', ...mongoStatus } : { mode: 'sqlite', connected: true },
            features: [
              'nested_spintax_engine',
              'auto_language_detection_id_en_mixed',
              'project_image_library_up_to_99',
              'auto_template_header_url_cta_wrapper',
              'anti_trash_capacity_recommendation',
              'indonesian_geo_hierarchy_wilayah_kota_kabupaten_kecamatan',
              'copyscape_4gram_5gram_shingle_verifier',
              'google_places_lead_finder',
              'website_contact_email_enrichment',
              'spintax_b2b_email_outreach_and_random_drip_scheduler',
              'gemini_5_slot_free_api_rotation'
            ],
            integrations: {
              mongodbAtlasConfigured: useMongo,
              geminiAiConfigured: geminiPool.totalConfigured > 0,
              geminiSlotsConfigured: geminiPool.totalConfigured,
              geminiMaxSlots: geminiPool.maxSlots,
              copyscapeApiConfigured: Boolean(process.env.COPYSCAPE_API_KEY && process.env.COPYSCAPE_USERNAME),
              googlePlacesApiConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
              smtpConfigured: Boolean(process.env.SMTP_HOST)
            },
            serverTimeUtc: new Date().toISOString()
          },
          requestId
        );
      }

      // 2. Regions Hierarchy API
      if (req.method === 'GET' && pathname === '/api/v1/regions') {
        return sendJson(res, 200, { regions: getAllRegions() }, requestId);
      }

      // 3. List Projects (with up to 99 images per project)
      if (req.method === 'GET' && pathname === '/api/v1/projects') {
        const userId = headers['x-user-id'] || urlObj.searchParams.get('userId') || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || urlObj.searchParams.get('workspaceId') || 'wks_nusantara';
        const projects = process.env.MONGODB_URI
          ? await listProjectsFromMongo(process.env.MONGODB_URI, { workspaceId })
          : listWorkspaceProjects(db, { workspaceId, userId });
        return sendJson(res, 200, { workspaceId, maxImagesPerProject: MAX_IMAGES_PER_PROJECT, projects }, requestId);
      }

      // 4. Create or Update Project & Save up to 99 Reference Images
      if (req.method === 'POST' && pathname === '/api/v1/projects') {
        const body = await parseJsonBody(req);
        const userId = headers['x-user-id'] || body.userId || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || body.workspaceId || 'wks_nusantara';

        const projectPayload = {
          workspaceId,
          userId,
          projectId: body.projectId,
          name: body.name,
          topic: body.topic,
          rawMainArticle: body.rawMainArticle,
          autoTemplateEnabled: body.autoTemplateEnabled !== false,
          whatsappNumber: body.whatsappNumber,
          whatsappLabel: body.whatsappLabel,
          targetUrl: body.targetUrl,
          anchorText: body.anchorText,
          imagesPerArticle: body.imagesPerArticle,
          images: body.images || []
        };

        const savedProject = process.env.MONGODB_URI
          ? await (async () => {
              const auth = authorizeWorkspaceAction(db, { userId, workspaceId, requiredRoles: ['owner', 'admin', 'editor'] });
              if (!auth.allowed) {
                const err = new Error(auth.message);
                err.status = auth.status;
                err.code = auth.code;
                throw err;
              }
              return saveProjectToMongo(process.env.MONGODB_URI, projectPayload);
            })()
          : saveProjectAndImages(db, projectPayload);

        return sendJson(res, 200, { project: savedProject }, requestId);
      }

      // 5. Auto-Detect Language + Spin Raw Main Article (Gemini 5-Slot Pool + Local Fallback) + Assemble Auto-Template
      if (req.method === 'POST' && pathname === '/api/v1/spintax/auto-spin') {
        const body = await parseJsonBody(req);
        const rawMainArticle = String(body.rawMainArticle || '').trim();
        const topic = String(body.topic || 'Layanan Profesional').trim();
        const clientKeys = Array.isArray(body.geminiApiKeys) ? body.geminiApiKeys.slice(0, 5) : [];

        const spunResult = autoSpinRawArticle(rawMainArticle, {
          topic,
          forceLanguage: body.forceLanguage || 'auto'
        });

        let finalSpunBody = spunResult.spunArticleBody;
        let engineUsed = 'local-spintax-engine';
        let geminiSlotUsed = null;
        let geminiAttempts = [];

        if (body.useGemini !== false && rawMainArticle) {
          const geminiRes = await spinArticleWithGeminiPool({
            rawArticle: rawMainArticle,
            topic,
            detectedLanguage: spunResult.detectedLanguage.languageCode,
            clientKeys
          });
          geminiAttempts = geminiRes.attempts || [];
          if (geminiRes.ok && geminiRes.spunArticleBody) {
            finalSpunBody = geminiRes.spunArticleBody;
            engineUsed = geminiRes.model;
            geminiSlotUsed = geminiRes.usedSlot;
          }
        }

        const masterSpintax =
          body.autoTemplateEnabled !== false
            ? assembleAutoTemplate({
                spunBody: finalSpunBody || buildMasterSpintaxBlueprint({ topic }).masterSpintax,
                topic,
                callToAction: body.callToAction,
                whatsappNumber: body.whatsappNumber,
                whatsappLabel: body.whatsappLabel,
                targetUrl: body.targetUrl,
                anchorText: body.anchorText,
                linkRel: body.linkRel,
                enableBoldKeywords: body.enableBoldKeywords !== false,
                enableUnderlineBenefits: body.enableUnderlineBenefits !== false,
                enableImageBlock: body.enableImageBlock !== false,
                enableHyperlink: body.enableHyperlink !== false,
                enableWhatsappCta: body.enableWhatsappCta !== false,
                enableFaqSchema: body.enableFaqSchema !== false,
                imagesPerArticle: body.imagesPerArticle || 2
              })
            : spunResult.spunArticleBody;

        const capacity = calculateSafeArticleCapacity({
          spintaxTemplate: masterSpintax,
          projectImageCount: body.projectImageCount || 3,
          requestedArticleCount: body.requestedArticleCount || 5
        });

        return sendJson(
          res,
          200,
          {
            detectedLanguage: spunResult.detectedLanguage,
            blocksCreated: spunResult.blocksCreated,
            engineUsed,
            geminiSlotUsed,
            geminiAttempts,
            spunArticleBody: finalSpunBody,
            masterSpintax,
            capacity
          },
          requestId
        );
      }

      // 6. Generate Master AI Spintax Blueprint
      if (req.method === 'POST' && pathname === '/api/v1/spintax/blueprint') {
        const body = await parseJsonBody(req);
        const topic = String(body.topic || '').trim();
        if (!topic || topic.length < 3 || topic.length > 160) {
          return sendJson(
            res,
            400,
            {
              code: 'VALIDATION_ERROR',
              message: 'Topik artikel wajib diisi (antara 3 hingga 160 karakter).'
            },
            requestId
          );
        }

        const blueprint = buildMasterSpintaxBlueprint({
          topic,
          category: body.category || 'jasa-lokal',
          tone: body.tone || 'profesional',
          callToAction: body.callToAction,
          whatsappNumber: body.whatsappNumber,
          whatsappLabel: body.whatsappLabel,
          targetUrl: body.targetUrl,
          anchorText: body.anchorText,
          linkRel: body.linkRel,
          imageUrl: body.imageUrl,
          imageAltSpintax: body.imageAltSpintax,
          enableBoldKeywords: body.enableBoldKeywords !== false,
          enableUnderlineBenefits: body.enableUnderlineBenefits !== false,
          enableImageBlock: body.enableImageBlock !== false,
          enableHyperlink: body.enableHyperlink !== false,
          enableWhatsappCta: body.enableWhatsappCta !== false,
          enableFaqSchema: body.enableFaqSchema !== false
        });

        const capacity = calculateSafeArticleCapacity({
          spintaxTemplate: blueprint.masterSpintax,
          projectImageCount: body.projectImageCount || 3,
          requestedArticleCount: body.requestedArticleCount || 5
        });

        return sendJson(res, 200, { blueprint, capacity }, requestId);
      }

      // 7. Generate Geo-Targeted Batch + Project Images (up to 99) + Auto-Verify Copyscape
      if (req.method === 'POST' && pathname === '/api/v1/campaigns/generate') {
        const body = await parseJsonBody(req);
        const userId = headers['x-user-id'] || body.userId || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || body.workspaceId || 'wks_nusantara';

        const topic = String(body.topic || '').trim();
        const wilayah = String(body.wilayah || '').trim();
        const jenisDaerah = String(body.jenisDaerah || '').trim();
        const kotaKabupaten = String(body.kotaKabupaten || '').trim();
        const kecamatanList = Array.isArray(body.kecamatanList) ? body.kecamatanList : [];

        if (!topic || topic.length < 3) {
          return sendJson(
            res,
            400,
            { code: 'VALIDATION_ERROR', message: 'Topik artikel wajib diisi (minimal 3 karakter).' },
            requestId
          );
        }
        if (!wilayah || !kotaKabupaten) {
          return sendJson(
            res,
            400,
            { code: 'VALIDATION_ERROR', message: 'Target Wilayah (Provinsi) dan Kota/Kabupaten wajib dipilih.' },
            requestId
          );
        }

        const geoTargets = resolveGeoTargets({
          wilayah,
          jenisDaerah,
          kotaKabupaten,
          kecamatanList
        });

        if (geoTargets.length === 0) {
          return sendJson(
            res,
            400,
            { code: 'EMPTY_GEO_TARGETS', message: 'Tidak ada target kecamatan yang ditemukan untuk kombinasi daerah tersebut.' },
            requestId
          );
        }

        // Load project images if projectId is specified
        let projectImages = Array.isArray(body.projectImages) ? body.projectImages : [];
        let imagesPerArticle = body.imagesPerArticle || 2;
        if (body.projectId && projectImages.length === 0) {
          try {
            const proj = getProjectWithImages(db, { workspaceId, userId, projectId: body.projectId });
            projectImages = proj.images;
            imagesPerArticle = body.imagesPerArticle || proj.images_per_article || 2;
          } catch {
            // Fallback to body images
          }
        }

        let masterSpintax = body.masterSpintax ? String(body.masterSpintax).trim() : '';
        if (!masterSpintax || masterSpintax.length <= 40) {
          if (body.rawMainArticle && String(body.rawMainArticle).trim().length > 20) {
            const spun = autoSpinRawArticle(body.rawMainArticle, { topic });
            masterSpintax = assembleAutoTemplate({
              spunBody: spun.spunArticleBody,
              topic,
              callToAction: body.callToAction,
              whatsappNumber: body.whatsappNumber,
              whatsappLabel: body.whatsappLabel,
              targetUrl: body.targetUrl,
              anchorText: body.anchorText,
              linkRel: body.linkRel,
              enableImageBlock: body.enableImageBlock !== false,
              enableHyperlink: body.enableHyperlink !== false,
              enableWhatsappCta: body.enableWhatsappCta !== false,
              enableFaqSchema: body.enableFaqSchema !== false,
              imagesPerArticle
            });
          } else {
            masterSpintax = buildMasterSpintaxBlueprint({
              topic,
              category: body.category || 'jasa-lokal',
              tone: body.tone || 'profesional',
              callToAction: body.callToAction,
              whatsappNumber: body.whatsappNumber,
              whatsappLabel: body.whatsappLabel,
              targetUrl: body.targetUrl,
              anchorText: body.anchorText,
              linkRel: body.linkRel,
              imageUrl: body.imageUrl,
              imageAltSpintax: body.imageAltSpintax,
              enableBoldKeywords: body.enableBoldKeywords !== false,
              enableUnderlineBenefits: body.enableUnderlineBenefits !== false,
              enableImageBlock: body.enableImageBlock !== false,
              enableHyperlink: body.enableHyperlink !== false,
              enableWhatsappCta: body.enableWhatsappCta !== false,
              enableFaqSchema: body.enableFaqSchema !== false
            }).masterSpintax;
          }
        }

        const permutationStats = countSpintaxPermutations(masterSpintax);

        const batchResult = generateCopyscapeSafeBatch({
          masterSpintax,
          geoTargets,
          topic,
          callToAction: body.callToAction,
          whatsappNumber: body.whatsappNumber,
          whatsappGreeting: body.whatsappGreeting,
          targetUrl: body.targetUrl,
          imageUrl: body.imageUrl,
          projectImages,
          imagesPerArticle,
          maxArticlesToGenerate: body.maxArticlesToGenerate,
          enableFaqSchema: body.enableFaqSchema !== false,
          campaignSeed: `${workspaceId}::${topic}::${Date.now()}`
        });

        const capacity = calculateSafeArticleCapacity({
          spintaxTemplate: masterSpintax,
          projectImageCount: projectImages.length || 1,
          requestedArticleCount: batchResult.articles.length
        });

        const campaignPayload = {
          workspaceId,
          userId,
          projectId: body.projectId || null,
          topic,
          category: body.category || 'jasa-lokal',
          wilayah,
          jenisDaerah: geoTargets[0].jenisDaerah,
          kotaKabupaten: geoTargets[0].kotaKabupaten,
          masterSpintax,
          batchResult
        };
        const saved = process.env.MONGODB_URI
          ? await saveCampaignToMongo(process.env.MONGODB_URI, campaignPayload)
          : saveCampaignTransaction(db, campaignPayload);

        return sendJson(
          res,
          201,
          {
            campaignId: saved.campaignId,
            workspaceId,
            projectId: body.projectId || null,
            topic,
            permutationStats,
            capacity,
            audit: batchResult.audit,
            articles: batchResult.articles
          },
          requestId
        );
      }

      // 8. Get Campaign Details (Tenant-Isolated)
      if (req.method === 'GET' && pathname.startsWith('/api/v1/campaigns/')) {
        const campaignId = pathname.replace('/api/v1/campaigns/', '').trim();
        const userId = headers['x-user-id'] || urlObj.searchParams.get('userId') || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || urlObj.searchParams.get('workspaceId') || 'wks_nusantara';

        const result = process.env.MONGODB_URI
          ? await getCampaignFromMongo(process.env.MONGODB_URI, { workspaceId, campaignId })
          : getCampaignByIdScoped(db, { workspaceId, userId, campaignId });
        if (!result) return sendJson(res, 404, { error: 'Campaign tidak ditemukan.' }, requestId);
        return sendJson(res, 200, result, requestId);
      }

      // 9. List Campaigns for Workspace
      if (req.method === 'GET' && pathname === '/api/v1/campaigns') {
        const userId = headers['x-user-id'] || urlObj.searchParams.get('userId') || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || urlObj.searchParams.get('workspaceId') || 'wks_nusantara';

        const auth = authorizeWorkspaceAction(db, { userId, workspaceId });
        if (!auth.allowed) {
          return sendJson(res, auth.status, { code: auth.code, message: auth.message }, requestId);
        }

        const campaigns = db
          .prepare('SELECT id, project_id, topic, wilayah, jenis_daerah, kota_kabupaten, average_uniqueness_pct, max_overlap_pct, copyscape_status, total_articles, created_at FROM campaigns WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50')
          .all(workspaceId);

        return sendJson(res, 200, { workspaceId, campaigns, membership: auth.membership }, requestId);
      }

      // 10. Standalone Copyscape & Shingle Comparison Endpoint
      if (req.method === 'POST' && pathname === '/api/v1/copyscape/verify') {
        const body = await parseJsonBody(req);
        if (Array.isArray(body.articles)) {
          const audit = evaluateBatchUniqueness(body.articles);
          return sendJson(res, 200, { audit }, requestId);
        }
        const cmp = compareTwoArticles(body.textA || '', body.textB || '');
        return sendJson(res, 200, { comparison: cmp }, requestId);
      }

      // 10B. Lead Finder (Google Places API (New) + Website Contact Email Enrichment)
      if (req.method === 'POST' && pathname === '/api/v1/leads/search') {
        const body = await parseJsonBody(req);
        const userId = headers['x-user-id'] || body.userId || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || body.workspaceId || 'wks_nusantara';

        const auth = authorizeWorkspaceAction(db, {
          userId,
          workspaceId,
          requiredRoles: ['owner', 'admin', 'editor']
        });
        if (!auth.allowed) {
          return sendJson(res, auth.status, { code: auth.code, message: auth.message }, requestId);
        }

        const clientPlacesKey = String(body.googlePlacesApiKey || '').trim();
        const clientSerperKey = String(body.serperApiKey || process.env.SERPER_API_KEY || '').trim();
        const effectivePlacesKey = clientPlacesKey || process.env.GOOGLE_PLACES_API_KEY;
        const useSerper = Boolean(clientSerperKey) && !effectivePlacesKey;
        const useFreeOsm = !effectivePlacesKey && !useSerper && (body.provider === 'free_osm' || body.allowFreeFallback);

        const searchResult = useSerper
          ? await searchPlacesSerper({
              keyword: body.keyword,
              location: body.location,
              apiKey: clientSerperKey,
              maxResults: body.maxResults || 20
            })
          : useFreeOsm
            ? await searchPlacesFreeOsm({
                keyword: body.keyword,
                location: body.location,
                maxResults: body.maxResults || 20
              })
            : await searchPlaces({
                keyword: body.keyword,
                location: body.location,
                apiKey: effectivePlacesKey,
                maxResults: body.maxResults || 20,
                includeReviews: Boolean(body.includeReviews)
              });

        let leads = searchResult.places;
        if (body.enrichEmail && leads.length > 0) {
          const sliceToEnrich = leads.slice(0, 6);
          const enrichedTop = await enrichLeadsWithEmails(sliceToEnrich, { timeoutMs: 2500 });
          leads = [...enrichedTop, ...leads.slice(6)];
        }

        const filtered = filterAndSortLeads(leads, body.filters || {});
        return sendJson(
          res,
          200,
          {
            textQuery: searchResult.textQuery,
            providerUsed: useSerper ? 'serper_google_maps' : useFreeOsm ? 'free_osm_real_poi' : 'google_places_api',
            totalFetched: searchResult.totalResults,
            totalFiltered: filtered.length,
            pagesFetched: searchResult.pagesFetched,
            reachedApiLimit: searchResult.reachedApiLimit,
            attribution: useSerper
              ? 'Data tempat: Google Maps (via Serper Places API)'
              : useFreeOsm
                ? 'Data tempat: OpenStreetMap Real POI (100% Lokasi Asli)'
                : 'Data tempat: Google Maps',
            leads: filtered
          },
          requestId
        );
      }

      // 10C. Filter, Sort & Export Leads (JSON or CSV)
      if (req.method === 'POST' && pathname === '/api/v1/leads/filter') {
        const body = await parseJsonBody(req);
        const rawLeads = Array.isArray(body.leads) ? body.leads : [];
        const filtered = filterAndSortLeads(rawLeads, body.filters || {});

        if (body.format === 'csv') {
          const csv = leadsToCsv(filtered, Array.isArray(body.columns) ? body.columns : undefined);
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="leads-google-maps.csv"',
            'X-App-Identity': `${APP_IDENTITY}/${APP_VERSION}`,
            'X-Request-Id': requestId
          });
          res.end(csv);
          return;
        }

        return sendJson(
          res,
          200,
          {
            totalInput: rawLeads.length,
            totalFiltered: filtered.length,
            attribution: 'Data tempat: Google Maps',
            leads: filtered
          },
          requestId
        );
      }

      // 10D. B2B Commodity Email Outreach Preview & Schedule Queue
      if (req.method === 'POST' && pathname === '/api/v1/email-campaigns/preview') {
        const body = await parseJsonBody(req);
        const tpl = getCommodityTemplate({
          language: body.language || 'en',
          commodity: body.commodity || 'Indonesian Specialty Arabica Green Beans'
        });

        const queueResult = buildEmailOutreachQueue({
          recipients: body.recipients || [],
          senders: body.senders || [],
          subjectSpintax: body.subjectSpintax || tpl.subjectSpintax,
          bodySpintax: body.bodySpintax || tpl.bodySpintax,
          commodity: body.commodity || 'Indonesian Specialty Arabica Green Beans',
          companyName: body.companyName || 'Nusantara Commodity Export',
          senderWhatsapp: body.senderWhatsapp || '+62 812-3456-7890',
          websiteUrl: body.websiteUrl,
          websiteLabel: body.websiteLabel,
          imageUrl: body.imageUrl,
          imageCaption: body.imageCaption,
          scheduleMode: body.scheduleMode === 'blast' ? 'blast' : 'drip_random',
          minDelayMinutes: body.minDelayMinutes ?? 3,
          maxDelayMinutes: body.maxDelayMinutes ?? 5,
          senderRotation: body.senderRotation || 'round_robin',
          includeUnsubscribe: body.includeUnsubscribe !== false,
          startTimeIso: body.startTimeIso || null
        });

        return sendJson(res, 200, queueResult, requestId);
      }

      // 10E. Save & Schedule B2B Email Campaign (Tenant-Isolated & RBAC)
      if (req.method === 'POST' && pathname === '/api/v1/email-campaigns') {
        const body = await parseJsonBody(req);
        const userId = headers['x-user-id'] || body.userId || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || body.workspaceId || 'wks_nusantara';

        const tpl = getCommodityTemplate({
          language: body.language || 'en',
          commodity: body.commodity || 'Indonesian Specialty Arabica Green Beans'
        });

        const queueResult = buildEmailOutreachQueue({
          recipients: body.recipients || [],
          senders: body.senders || [],
          subjectSpintax: body.subjectSpintax || tpl.subjectSpintax,
          bodySpintax: body.bodySpintax || tpl.bodySpintax,
          commodity: body.commodity || 'Indonesian Specialty Arabica Green Beans',
          companyName: body.companyName || 'Nusantara Commodity Export',
          senderWhatsapp: body.senderWhatsapp || '+62 812-3456-7890',
          websiteUrl: body.websiteUrl,
          websiteLabel: body.websiteLabel,
          imageUrl: body.imageUrl,
          imageCaption: body.imageCaption,
          scheduleMode: body.scheduleMode === 'blast' ? 'blast' : 'drip_random',
          minDelayMinutes: body.minDelayMinutes ?? 3,
          maxDelayMinutes: body.maxDelayMinutes ?? 5,
          senderRotation: body.senderRotation || 'round_robin',
          includeUnsubscribe: body.includeUnsubscribe !== false,
          startTimeIso: body.startTimeIso || null
        });

        const emailPayload = {
          workspaceId,
          userId,
          commodity: body.commodity || 'Indonesian Specialty Arabica Green Beans',
          queueResult
        };
        const saved = process.env.MONGODB_URI
          ? await saveEmailCampaignToMongo(process.env.MONGODB_URI, emailPayload)
          : saveEmailCampaignTransaction(db, emailPayload);

        return sendJson(
          res,
          201,
          {
            emailCampaignId: saved.emailCampaignId,
            workspaceId,
            ...queueResult
          },
          requestId
        );
      }

      // 10F. Get Email Campaign Details (Tenant-Isolated Anti-IDOR)
      if (req.method === 'GET' && pathname.startsWith('/api/v1/email-campaigns/')) {
        const emailCampaignId = pathname.replace('/api/v1/email-campaigns/', '').trim();
        const userId = headers['x-user-id'] || urlObj.searchParams.get('userId') || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || urlObj.searchParams.get('workspaceId') || 'wks_nusantara';

        const result = process.env.MONGODB_URI
          ? await getEmailCampaignFromMongo(process.env.MONGODB_URI, { workspaceId, emailCampaignId })
          : getEmailCampaignByIdScoped(db, { workspaceId, userId, emailCampaignId });
        if (!result) return sendJson(res, 404, { error: 'Email campaign tidak ditemukan.' }, requestId);
        return sendJson(res, 200, result, requestId);
      }

      // 10G. Generate Sitemap XML
      if (req.method === 'POST' && pathname === '/api/v1/gsc/sitemap') {
        const body = await parseJsonBody(req);
        const xml = generateSitemapXml({
          siteUrl: body.siteUrl || 'https://www.domainanda.com/',
          slugs: Array.isArray(body.slugs) ? body.slugs : []
        });
        if (body.format === 'xml') {
          res.writeHead(200, {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': 'attachment; filename="sitemap.xml"',
            'X-App-Identity': `${APP_IDENTITY}/${APP_VERSION}`,
            'X-Request-Id': requestId
          });
          res.end(xml);
          return;
        }
        return sendJson(res, 200, { sitemapXml: xml, totalUrls: 1 + (Array.isArray(body.slugs) ? body.slugs.length : 0) }, requestId);
      }

      // 10H. Submit Site & Sitemap to Google Search Console via ops/gsc_automation.py
      if (req.method === 'POST' && pathname === '/api/v1/gsc/submit') {
        const body = await parseJsonBody(req);
        const userId = headers['x-user-id'] || body.userId || 'usr_owner_a';
        const workspaceId = headers['x-workspace-id'] || body.workspaceId || 'wks_nusantara';

        const auth = authorizeWorkspaceAction(db, {
          userId,
          workspaceId,
          requiredRoles: ['owner', 'admin', 'editor']
        });
        if (!auth.allowed) {
          return sendJson(res, auth.status, { code: auth.code, message: auth.message }, requestId);
        }

        const rawSites = Array.isArray(body.sites) && body.sites.length > 0
          ? body.sites.slice(0, 5)
          : [{ siteUrl: body.siteUrl, sitemapUrl: body.sitemapUrl }];

        const validSites = rawSites
          .map((s) => ({
            siteUrl: String((s && s.siteUrl) || '').trim(),
            sitemapUrl: String((s && s.sitemapUrl) || '').trim()
          }))
          .filter((s) => s.siteUrl && s.sitemapUrl);

        if (validSites.length === 0) {
          return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'Minimal 1 pasang SITE_URL dan SITEMAP_URL wajib diisi (maksimal 5 website).' }, requestId);
        }

        const keyFile = process.env.GSC_SERVICE_ACCOUNT_FILE || path.join(__dirname, '..', 'ops', 'service-account-key.json');
        if (!fs.existsSync(keyFile)) {
          return sendJson(
            res,
            503,
            {
              code: 'GSC_KEY_NOT_CONFIGURED',
              sitesCount: validSites.length,
              sites: validSites,
              message: `File service-account-key.json belum ditemukan di server untuk ${validSites.length} website (${validSites.map((s) => s.siteUrl).join(', ')}). Unduh sitemap.xml & gsc_automation.py untuk dijalankan atau letakkan file kunci JSON Anda di folder ops/.`
            },
            requestId
          );
        }

        const scriptPath = path.join(__dirname, '..', 'ops', 'gsc_automation.py');
        const results = [];
        for (const item of validSites) {
          const execResult = await new Promise((resolve) => {
            execFile('python', [scriptPath, '--key-file', keyFile, '--site-url', item.siteUrl, '--sitemap-url', item.sitemapUrl], { timeout: 20000 }, (error, stdout, stderr) => {
              resolve({ siteUrl: item.siteUrl, sitemapUrl: item.sitemapUrl, ok: !error, stdout: String(stdout || ''), stderr: String(stderr || '') });
            });
          });
          results.push(execResult);
        }
        const allOk = results.every((r) => r.ok);

        return sendJson(
          res,
          allOk ? 200 : 502,
          {
            code: allOk ? 'GSC_SUBMITTED' : 'GSC_EXEC_ERROR',
            sitesCount: results.length,
            results,
            message: allOk
              ? `Berhasil mendaftarkan properti & mengirim sitemap untuk ${results.length} website ke Google Search Console.`
              : 'Sebagian atau seluruh eksekusi gsc_automation.py gagal.'
          },
          requestId
        );
      }

      // 10I. Mass Ping / Bulk URL & Backlink Indexing Tool
      if (req.method === 'POST' && pathname === '/api/v1/gsc/mass-ping') {
        const body = await parseJsonBody(req);
        const pingResult = await executeMassPing({
          urls: body.urls || [],
          blogTitle: body.blogTitle || 'LocalSpin AI SEO Publisher',
          liveNetwork: Boolean(body.liveNetwork)
        });
        return sendJson(
          res,
          200,
          {
            message: `Berhasil melakukan Mass Ping untuk ${pingResult.totalUrls} URL ke ${pingResult.totalServices} Search Engine Indexing Endpoints (${pingResult.totalPingsSent} total sinyal ping).`,
            ...pingResult
          },
          requestId
        );
      }

      // 10J. SEO Tools: Competitor Backlink Analysis
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/competitor-backlinks') {
        const body = await parseJsonBody(req);
        const competitorUrl = body.competitorUrl || body.domain || '';
        if (!competitorUrl.trim()) {
          return sendJson(res, 400, { error: 'Parameter competitorUrl wajib diisi.' }, requestId);
        }
        const result = analyzeCompetitorDomain(competitorUrl);
        return sendJson(res, 200, { message: 'Analisis profil backlink kompetitor selesai.', ...result }, requestId);
      }

      // 10K. SEO Tools: Competitor Backlink Clone Pipeline (Scrape -> List -> Auto-Fill -> Post with Spintax)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/clone-pipeline') {
        const body = await parseJsonBody(req);
        const plan = generateCloneSubmissionPlan({
          competitorDomain: body.competitorDomain || '',
          yourWebsiteUrl: body.yourWebsiteUrl || 'https://wevo.biz.id',
          brandName: body.brandName || 'LocalSpin AI Solutions',
          topic: body.topic || 'Jasa Layanan Profesional',
          selectedTargets: body.selectedTargets || []
        });
        return sendJson(res, 200, { message: 'Rencana alur kloning backlink kompetitor siap.', ...plan }, requestId);
      }

      // 10L. SEO Tools: Zombie Blog Hunter (Expired Web 2.0 with High Authority)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/zombie-hunter') {
        const body = await parseJsonBody(req);
        const result = huntZombieBlogs({
          keyword: body.keyword || 'panel surya',
          platform: body.platform || 'BLOGSPOT',
          minDa: Number(body.minDa) || 20,
          limit: Number(body.limit) || 8
        });
        return sendJson(res, 200, { message: 'Pencarian blog zombie berotoritas selesai.', ...result }, requestId);
      }

      // 10M. SEO Tools: Multi-Engine Index Checker (Google, Bing, Yandex)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/index-checker') {
        const body = await parseJsonBody(req);
        const urls = Array.isArray(body.urls) ? body.urls : (body.urls ? String(body.urls).split(/[\r\n]+/) : ['https://wevo.biz.id']);
        const engine = body.engine || 'google';
        const checked = checkSearchEngineIndex({ urls, engine });
        return sendJson(res, 200, {
          engine,
          totalChecked: checked.length,
          indexedCount: checked.filter(c => c.isIndexed).length,
          results: checked
        }, requestId);
      }

      // 10N. SEO Tools: Direct Indexing Service (Google Indexing API & Yandex/Bing IndexNow Ping)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/indexing-service') {
        const body = await parseJsonBody(req);
        const urls = Array.isArray(body.urls) ? body.urls : (body.urls ? String(body.urls).split(/[\r\n]+/) : ['https://wevo.biz.id']);
        const engine = body.engine || 'all';
        const result = submitIndexingService({
          urls,
          engine,
          notificationType: body.notificationType || 'URL_UPDATED'
        });
        return sendJson(res, 200, result, requestId);
      }

      // 10O. SEO Tools: Drip Feed Indexing Scheduler
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/drip-feed-scheduler') {
        const body = await parseJsonBody(req);
        const urls = Array.isArray(body.urls) ? body.urls : (body.urls ? String(body.urls).split(/[\r\n]+/) : []);
        const schedule = scheduleDripFeedIndexing({
          urls,
          batchSize: Number(body.batchSize) || 10,
          intervalMinutes: Number(body.intervalMinutes) || 30,
          startTimeIso: body.startTimeIso || null
        });
        return sendJson(res, 200, { message: 'Antrean drip-feed indexing berhasil dijadwalkan.', ...schedule }, requestId);
      }

      // 10P. SEO Tools: SERP & Top 10 Analyzer
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/top10-serp') {
        const body = await parseJsonBody(req);
        const keyword = body.keyword || 'jasa pasang kanopi';
        const analysis = analyzeTop10Serp({ keyword });
        return sendJson(res, 200, { message: 'Analisis Top 10 SERP selesai.', ...analysis }, requestId);
      }

      // 10Q. SEO Tools: Rank Tracker
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/rank-tracker') {
        const body = await parseJsonBody(req);
        const domain = body.domain || 'wevo.biz.id';
        const keywords = Array.isArray(body.keywords) ? body.keywords : ['jasa pasang kanopi', 'tukang las terdekat'];
        const tracker = trackRankKeywords({ domain, keywords });
        return sendJson(res, 200, { message: 'Pelacakan ranking kata kunci berhasil diperbarui.', ...tracker }, requestId);
      }

      // 10R. SEO Tools: Index Monitoring & Alert
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/index-monitoring') {
        const body = await parseJsonBody(req);
        const domain = body.domain || 'wevo.biz.id';
        const urls = Array.isArray(body.urls) ? body.urls : [];
        const monitor = monitorIndexAlerts({ domain, urls });
        return sendJson(res, 200, { message: 'Pemeriksaan status monitoring dan alert selesai.', ...monitor }, requestId);
      }

      // 10S. SEO Tools: Bulk Site Pages (site:domain.com)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/bulk-site-pages') {
        const body = await parseJsonBody(req);
        const domain = body.domain || 'wevo.biz.id';
        const estimatedPages = Number(body.estimatedPages) || 50;
        const bulk = checkBulkSitePages({ domain, estimatedPages });
        return sendJson(res, 200, { message: 'Pemeriksaan bulk indeks site: berhasil.', ...bulk }, requestId);
      }

      // 10T. Free Tool: Redirect Chain Checker (301, 302, 307)
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/free/redirect-checker') {
        const body = await parseJsonBody(req);
        const targetUrl = body.url || body.targetUrl || 'http://wevo.biz.id';
        const chain = inspectRedirectChain(targetUrl);
        return sendJson(res, 200, { message: 'Pemeriksaan redirect chain selesai.', ...chain }, requestId);
      }

      // 10U. Free Tool: Noindex & Robots Meta Checker
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/free/noindex-checker') {
        const body = await parseJsonBody(req);
        const targetUrl = body.url || 'https://wevo.biz.id';
        const htmlContent = body.htmlContent || '';
        const headersMeta = body.headers || {};
        const check = checkNoindexMeta({ url: targetUrl, htmlContent, headers: headersMeta });
        return sendJson(res, 200, { message: 'Pemeriksaan status noindex selesai.', ...check }, requestId);
      }

      // 10V. Free Tool: 404 Error Checker
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/free/404-checker') {
        const body = await parseJsonBody(req);
        const urls = Array.isArray(body.urls) ? body.urls : (body.urls ? String(body.urls).split(/[\r\n]+/) : ['https://wevo.biz.id/halaman-aktif', 'https://wevo.biz.id/halaman-lama-404']);
        const check = check404Errors({ urls });
        return sendJson(res, 200, { message: 'Pemeriksaan broken link 404 selesai.', ...check }, requestId);
      }

      // 10W. Free Tool: Sitemap XML Extractor
      if (req.method === 'POST' && pathname === '/api/v1/seo-tools/free/sitemap-extractor') {
        const body = await parseJsonBody(req);
        const xml = body.xml || body.sitemapXml || '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://wevo.biz.id/</loc></url><url><loc>https://wevo.biz.id/layanan</loc></url></urlset>';
        const extracted = extractSitemapUrlsFromXml(xml);
        return sendJson(res, 200, { message: 'Ekstraksi URL dari sitemap XML berhasil.', ...extracted }, requestId);
      }

      // 11. Serve Static HTML Preview Files (DPES v1.3 HTML Visual Handoff)
      let relPath = pathname === '/' ? '/index.html' : pathname.replace(/^\/preview/, '');
      if (relPath === '' || relPath === '/') relPath = '/index.html';
      const safeRelPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
      let fullFilePath = path.join(previewDir, safeRelPath);

      // Support serving from preview/ or directly from project root
      if (!fs.existsSync(fullFilePath) || !fs.statSync(fullFilePath).isFile()) {
        const rootPath = path.join(__dirname, '..', safeRelPath);
        if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
          fullFilePath = rootPath;
        }
      }

      if (fullFilePath.startsWith(previewDir) && fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).isFile()) {
        const ext = path.extname(fullFilePath).toLowerCase();
        const mimeMap = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, {
          'Content-Type': mimeMap[ext] || 'text/plain; charset=utf-8',
          'X-App-Identity': `${APP_IDENTITY}/${APP_VERSION}`
        });
        res.end(fs.readFileSync(fullFilePath));
        return;
      }

      return sendJson(
        res,
        404,
        { code: 'NOT_FOUND', message: `Route ${pathname} tidak ditemukan pada ${APP_IDENTITY}.` },
        requestId
      );
    } catch (err) {
      const status = err.status || 500;
      const code = err.code || 'INTERNAL_ERROR';
      const safeMessage = status === 500 ? 'Terjadi kesalahan internal pada server.' : err.message;
      return sendJson(res, status, { code, message: safeMessage }, requestId);
    }
  };

  const server = http.createServer(requestHandler);

  async function dispatch({ method = 'GET', url = '/', headers = {}, body = null } = {}) {
    const normalizedHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }
    const payloadStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const reqStream = Readable.from(payloadStr ? [Buffer.from(payloadStr, 'utf8')] : []);
    reqStream.method = method;
    reqStream.url = url;
    reqStream.headers = normalizedHeaders;

    return new Promise((resolve) => {
      let resStatus = 200;
      let resHeaders = {};
      const chunks = [];
      const resMock = {
        writeHead(status, hdrs = {}) {
          resStatus = status;
          for (const [hk, hv] of Object.entries(hdrs)) {
            resHeaders[hk.toLowerCase()] = hv;
          }
        },
        end(data) {
          if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8'));
          const textBody = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: resStatus,
            headers: {
              get(name) {
                return resHeaders[String(name).toLowerCase()] || null;
              }
            },
            async text() {
              return textBody;
            },
            async json() {
              return JSON.parse(textBody);
            }
          });
        }
      };
      requestHandler(reqStream, resMock);
    });
  }

  return { server, db, dispatch };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3456);
  const host = process.env.HOST || '0.0.0.0';
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'localspin.sqlite');
  const { server } = createAppServer({ dbPath });
  server.listen(port, host, () => {
    console.log(`[${APP_IDENTITY} v${APP_VERSION}] Server aktif di http://${host}:${port}`);
  });
}

module.exports = {
  APP_IDENTITY,
  APP_VERSION,
  createAppServer
};
