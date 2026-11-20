/**
 * Local Business Lead Finder (v1.3.0)
 *
 * Mengambil data tempat usaha (mis. "coffee shop di Depok") melalui jalur RESMI:
 * Google Maps Platform — Places API (New) Text Search.
 *
 * Sengaja TIDAK melakukan scraping HTML halaman Google Maps / Google Review, karena:
 *  - melanggar Ketentuan Layanan Google Maps Platform,
 *  - dilindungi anti-bot/CAPTCHA (tidak boleh dibypass),
 *  - rapuh (struktur HTML berubah) dan berisiko IP/akun diblokir.
 *
 * Email TIDAK disediakan oleh Places API. Email diperoleh secara opsional dengan
 * membaca halaman publik WEBSITE MILIK USAHA itu sendiri (homepage/kontak),
 * menghormati robots.txt, dengan proteksi SSRF dan timeout.
 */

const dns = require('node:dns').promises;
const net = require('node:net');

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const MAX_PLACES_RESULTS = 60; // batas Text Search: 3 halaman x 20
const PAGE_SIZE = 20;

const BASE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours',
  'places.currentOpeningHours',
  'nextPageToken'
];

const REVIEW_FIELD = 'places.reviews';

const WEEKDAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function buildTextQuery(keyword, location) {
  const k = String(keyword || '').trim();
  const l = String(location || '').trim();
  return l ? `${k} di ${l}` : k;
}

function normalizePlace(place) {
  const regular = place.regularOpeningHours || {};
  const current = place.currentOpeningHours || {};
  const reviews = Array.isArray(place.reviews)
    ? place.reviews.slice(0, 5).map((r) => ({
        rating: r.rating ?? null,
        text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '',
        author: (r.authorAttribution && r.authorAttribution.displayName) || '',
        authorUri: (r.authorAttribution && r.authorAttribution.uri) || '',
        relativeTime: r.relativePublishTimeDescription || '',
        publishTime: r.publishTime || ''
      }))
    : [];

  return {
    placeId: place.id || '',
    name: (place.displayName && place.displayName.text) || '',
    category: (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || (place.types || [])[0] || '',
    address: place.formattedAddress || '',
    latitude: place.location ? place.location.latitude : null,
    longitude: place.location ? place.location.longitude : null,
    phone: place.nationalPhoneNumber || '',
    phoneInternational: place.internationalPhoneNumber || '',
    website: place.websiteUri || '',
    email: '',
    emailSource: '',
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
    priceLevel: place.priceLevel || '',
    businessStatus: place.businessStatus || '',
    openNow: typeof current.openNow === 'boolean' ? current.openNow : null,
    openingHours: Array.isArray(regular.weekdayDescriptions) ? regular.weekdayDescriptions : [],
    openingPeriods: Array.isArray(regular.periods) ? regular.periods : [],
    googleMapsUri: place.googleMapsUri || '',
    reviews,
    // Wajib ditampilkan bila menampilkan data Places (atribusi)
    attribution: 'Data tempat: Google Maps'
  };
}

/**
 * Text Search ke Places API (New) dengan paginasi hingga 60 hasil.
 * fetchImpl dapat diinjeksi untuk pengujian.
 */
async function searchPlaces({
  keyword,
  location,
  apiKey,
  maxResults = 60,
  includeReviews = false,
  languageCode = 'id',
  regionCode = 'ID',
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
}) {
  if (!apiKey) {
    const err = new Error(
      'Google Places API belum dikonfigurasi. Isi GOOGLE_PLACES_API_KEY di file .env server (jangan ditaruh di HTML/browser).'
    );
    err.status = 503;
    err.code = 'PLACES_API_NOT_CONFIGURED';
    throw err;
  }

  const textQuery = buildTextQuery(keyword, location);
  if (!keyword || String(keyword).trim().length < 2 || textQuery.length > 200) {
    const err = new Error('Kata kunci pencarian wajib diisi (2–200 karakter).');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const limit = Math.max(1, Math.min(MAX_PLACES_RESULTS, Number(maxResults) || 20));
  const fieldMask = [...BASE_FIELD_MASK, ...(includeReviews ? [REVIEW_FIELD] : [])].join(',');

  const results = [];
  const seen = new Set();
  let pageToken = '';
  let pagesFetched = 0;

  while (results.length < limit && pagesFetched < 3) {
    const body = {
      textQuery,
      languageCode,
      regionCode,
      pageSize: Math.min(PAGE_SIZE, limit - results.length)
    };
    if (pageToken) body.pageToken = pageToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp;
    try {
      resp = await fetchImpl(PLACES_TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (e) {
      const err = new Error('Gagal menghubungi Google Places API (timeout/jaringan).');
      err.status = 502;
      err.code = 'PLACES_API_UNREACHABLE';
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const err = new Error(`Google Places API menolak permintaan (HTTP ${resp.status}). Periksa API key, billing, dan pembatasan key.`);
      err.status = 502;
      err.code = 'PLACES_API_ERROR';
      throw err;
    }

    const data = await resp.json();
    pagesFetched++;
    for (const p of data.places || []) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      results.push(normalizePlace(p));
      if (results.length >= limit) break;
    }

    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  return {
    textQuery,
    totalResults: results.length,
    pagesFetched,
    reachedApiLimit: results.length >= MAX_PLACES_RESULTS,
    places: results
  };
}

function cleanLocationForSearch(rawLocation) {
  return String(rawLocation || 'Depok')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(Kecamatan|Kec\.|Kabupaten|Kab\.|Kota Administrasi|Kota|Provinsi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
}

function buildSearchKeywordsList(rawKeyword) {
  const kw = String(rawKeyword || 'Coffee Shop').trim();
  if (/coffee|kopi|cafe|kafe|roaster|warkop/i.test(kw)) {
    return ['cafe', 'kopi', 'coffee'];
  }
  if (/restoran|rumah makan|kuliner|resto|food/i.test(kw)) {
    return ['restaurant', 'rumah makan', 'kuliner'];
  }
  if (/klinik|dokter|apotek|kesehatan|dental|gigi/i.test(kw)) {
    return ['clinic', 'klinik', 'apotek'];
  }
  if (/bengkel|otomotif|motor|mobil|service/i.test(kw)) {
    return ['car_repair', 'bengkel', 'service'];
  }
  const parts = kw.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts.slice(0, 3) : [kw];
}

/**
 * Pencarian 100% Data Asli Google Maps via Serper.dev Places API
 * (Gratis 2.500 query di serper.dev tanpa kartu kredit & tanpa deposit Rp 500.000).
 */
async function searchPlacesSerper({
  keyword,
  location,
  apiKey,
  maxResults = 20,
  fetchImpl = global.fetch
} = {}) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    const err = new Error('SERPER_API_KEY belum diisi.');
    err.status = 400;
    err.code = 'SERPER_KEY_MISSING';
    throw err;
  }
  const cleanKw = String(keyword || 'Coffee Shop').split('/')[0].trim();
  const cleanLoc = String(location || 'Depok').trim();
  const textQuery = buildTextQuery(cleanKw, cleanLoc);
  const isJapan = /japan|jepang|tokyo|kyoto|osaka|fukuoka/i.test(cleanLoc);

  const resp = await fetchImpl('https://google.serper.dev/places', {
    method: 'POST',
    headers: {
      'X-API-KEY': cleanKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: `${cleanKw} ${cleanLoc}`,
      gl: isJapan ? 'jp' : 'id',
      hl: isJapan ? 'en' : 'id'
    }),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6500) : undefined
  });

  if (!resp.ok) {
    const err = new Error(`Serper Google Maps API menolak permintaan (HTTP ${resp.status}). Periksa API Key Serper.dev Anda.`);
    err.status = 502;
    err.code = 'SERPER_API_ERROR';
    throw err;
  }

  const data = await resp.json();
  const rawPlaces = Array.isArray(data.places) ? data.places : [];
  const limit = Math.max(1, Math.min(60, Number(maxResults) || 20));

  const places = rawPlaces.slice(0, limit).map((p, idx) => {
    const name = String(p.title || p.name || '').trim();
    const address = String(p.address || cleanLoc).trim();
    const phone = String(p.phoneNumber || p.phone || '').trim();
    const website = String(p.website || '').trim();
    const rating = p.rating !== undefined ? Number(p.rating) : null;
    const reviewCount = p.ratingCount !== undefined ? Number(p.ratingCount) : (p.reviewsCount || 0);
    const hours = p.openingHours
      ? (Array.isArray(p.openingHours) ? p.openingHours : Object.entries(p.openingHours).map(([k, v]) => `${k}: ${v}`))
      : [];
    const gmapsUrl = p.cid
      ? `https://www.google.com/maps?cid=${encodeURIComponent(p.cid)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;

    return {
      placeId: String(p.placeId || p.cid || `serper_${idx + 1}`),
      name,
      category: String(p.category || p.type || cleanKw),
      address,
      location: { latitude: p.latitude || null, longitude: p.longitude || null },
      phone,
      phoneInternational: phone,
      website,
      email: '',
      emailSource: '',
      rating,
      reviewCount,
      priceLevel: p.priceLevel || '',
      businessStatus: 'OPERATIONAL',
      openNow: null,
      openingHours: hours,
      todayHours: hours[0] || '',
      reviews: [],
      googleMapsUri: gmapsUrl,
      attribution: 'Data tempat: Google Maps (via Serper Places API)'
    };
  });

  return {
    textQuery,
    totalResults: places.length,
    pagesFetched: 1,
    reachedApiLimit: places.length >= limit,
    places
  };
}

/**
 * 100% Real POI Finder via OpenStreetMap Overpass BBox + Nominatim
 * (Hanya mengembalikan tempat asli yang benar-benar terdaftar di peta, TANPA data palsu/rekayasa).
 */
async function searchPlacesFreeOsm({
  keyword,
  location,
  maxResults = 25,
  fetchImpl = global.fetch
} = {}) {
  const cleanKw = String(keyword || 'Coffee Shop').trim();
  const rawLoc = String(location || 'Depok').trim();
  const shortLoc = cleanLocationForSearch(rawLoc) || 'Depok';
  const cityOnlyLoc = shortLoc.includes(',') ? shortLoc.split(',').slice(-2).join(',').trim() : shortLoc;
  const limit = Math.max(1, Math.min(60, Number(maxResults) || 25));
  const textQuery = buildTextQuery(cleanKw, rawLoc);
  const headers = {
    'User-Agent': 'LocalSpin-AI-SaaS/1.6 (https://wevo.biz.id)',
    Accept: 'application/json'
  };

  const results = [];
  const seenNames = new Set();

  const pushRealOsmItem = (item) => {
    if (results.length >= limit) return;
    const name = String(item.name || '').trim();
    if (!name || name.length < 2 || seenNames.has(name.toLowerCase())) return;
    seenNames.add(name.toLowerCase());
    const address = String(item.address || rawLoc).trim();
    const gmapsUrl = item.lat && item.lon
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${rawLoc}`)}`;

    results.push({
      placeId: item.placeId || `osm_${results.length + 1}`,
      name,
      category: item.category || cleanKw.split('/')[0].trim(),
      address,
      location: { latitude: item.lat || null, longitude: item.lon || null },
      phone: item.phone || '',
      phoneInternational: item.phone || '',
      website: item.website || '',
      email: item.email || '',
      emailSource: item.email ? 'osm_public_tag' : '',
      rating: null,
      reviewCount: 0,
      priceLevel: '',
      businessStatus: 'OPERATIONAL',
      openNow: null,
      openingHours: item.openingHours || [],
      todayHours: (item.openingHours && item.openingHours[0]) || '',
      reviews: [],
      googleMapsUri: gmapsUrl,
      attribution: 'Data tempat: OpenStreetMap Real POI (Klik Lihat Peta untuk Google Maps)'
    });
  };

  // 1. Geocode BBox + Parallel Nominatim POI Search
  const kwVariants = buildSearchKeywordsList(cleanKw);
  const queries = [];
  kwVariants.forEach((k) => {
    queries.push(`${k} ${shortLoc}`);
    if (cityOnlyLoc !== shortLoc) queries.push(`${k} ${cityOnlyLoc}`);
  });

  let bbox = null;
  try {
    const [geoRes, ...nomResponses] = await Promise.all([
      fetchImpl(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(shortLoc)}`, {
        headers,
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      ...queries.slice(0, 3).map((q) =>
        fetchImpl(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=${limit}&q=${encodeURIComponent(q)}`, {
          headers,
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
        })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
      )
    ]);

    if (Array.isArray(geoRes) && geoRes[0] && Array.isArray(geoRes[0].boundingbox)) {
      const [s, n, w, e] = geoRes[0].boundingbox.map(Number);
      bbox = { s, n, w, e };
    }

    for (const nomItems of nomResponses) {
      for (const n of nomItems || []) {
        const extra = n.extratags || {};
        const rawTitle = (n.name || (n.display_name || '').split(',')[0] || '').trim();
        if (!rawTitle || rawTitle.toLowerCase() === shortLoc.toLowerCase()) continue;
        pushRealOsmItem({
          placeId: `nom_${n.place_id}`,
          name: rawTitle,
          category: n.type ? n.type.replace(/_/g, ' ') : cleanKw.split('/')[0].trim(),
          address: n.display_name || rawLoc,
          lat: Number(n.lat),
          lon: Number(n.lon),
          phone: extra.phone || extra['contact:phone'] || extra['contact:whatsapp'] || '',
          email: extra.email || extra['contact:email'] || '',
          website: extra.website || extra['contact:website'] || extra.url || '',
          openingHours: extra.opening_hours ? [extra.opening_hours] : []
        });
      }
    }
  } catch (_) {}

  // 2. Fast Overpass BBox Query for Real POIs inside the District/City Bounding Box
  if (bbox && results.length < limit) {
    const isCoffee = /coffee|kopi|cafe|kafe|roaster|warkop/i.test(cleanKw);
    const isResto = /restoran|rumah makan|kuliner|resto|food/i.test(cleanKw);
    const safeWord = (cleanKw.split(/[\/,]/)[0] || 'Kopi').replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const bboxStr = `${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;
    const filterExpr = isCoffee
      ? `(nwr["amenity"="cafe"](${bboxStr});nwr["shop"="coffee"](${bboxStr});nwr["name"~"Kopi|Coffee|Cafe|Kafe|Roaster",i](${bboxStr}););`
      : isResto
        ? `(nwr["amenity"~"restaurant|fast_food|cafe"](${bboxStr}););`
        : `(nwr["name"~"${safeWord}",i](${bboxStr}););`;
    const ql = `[out:json][timeout:5];${filterExpr}out center ${limit};`;

    try {
      const ovResp = await fetchImpl('https://overpass.kumi.systems/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
        body: `data=${encodeURIComponent(ql)}`,
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4500) : undefined
      });
      if (ovResp.ok) {
        const ovData = await ovResp.json();
        for (const el of ovData.elements || []) {
          const t = el.tags || {};
          if (!t.name) continue;
          const addrParts = [
            t['addr:street'],
            t['addr:housenumber'],
            t['addr:suburb'] || t['addr:village'] || t['addr:district'],
            t['addr:city'] || shortLoc
          ].filter(Boolean);
          pushRealOsmItem({
            placeId: `ov_${el.id}`,
            name: t.name,
            category: t.amenity || t.shop || t.office || cleanKw.split('/')[0].trim(),
            address: addrParts.length ? addrParts.join(', ') : `${t.name}, ${rawLoc}`,
            lat: el.lat || (el.center && el.center.lat) || null,
            lon: el.lon || (el.center && el.center.lon) || null,
            phone: t.phone || t['contact:phone'] || t['contact:whatsapp'] || t['phone:mobile'] || '',
            email: t.email || t['contact:email'] || '',
            website: t.website || t['contact:website'] || t.url || '',
            openingHours: t.opening_hours ? [t.opening_hours] : []
          });
        }
      }
    } catch (_) {}
  }

  return {
    textQuery,
    totalResults: results.length,
    pagesFetched: 1,
    reachedApiLimit: results.length >= limit,
    places: results
  };
}

/* ------------------------- Email enrichment (website milik usaha) ------------------------- */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower === '::';
  }
  return true;
}

/**
 * Proteksi SSRF: hanya http/https, port standar, host publik.
 */
async function assertPublicHttpUrl(rawUrl, { resolveDns = true } = {}) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('URL website tidak valid.'), { code: 'INVALID_URL' });
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw Object.assign(new Error('Hanya URL http/https yang diizinkan.'), { code: 'BLOCKED_PROTOCOL' });
  }
  if (u.port && !['80', '443'].includes(u.port)) {
    throw Object.assign(new Error('Port non-standar diblokir.'), { code: 'BLOCKED_PORT' });
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw Object.assign(new Error('Host internal diblokir.'), { code: 'BLOCKED_HOST' });
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw Object.assign(new Error('IP privat diblokir.'), { code: 'BLOCKED_HOST' });
  } else if (resolveDns) {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      throw Object.assign(new Error('Host mengarah ke IP privat, diblokir.'), { code: 'BLOCKED_HOST' });
    }
  }
  return u;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;
const EMAIL_BLOCKLIST = /(\.(png|jpe?g|gif|webp|svg)$)|example\.|sentry|wixpress|@domain\.|yourname|noreply|no-reply/i;

function extractEmails(html) {
  const decoded = String(html || '')
    .replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@')
    .replace(/mailto:/gi, ' ');
  const found = new Set();
  for (const m of decoded.match(EMAIL_REGEX) || []) {
    const e = m.toLowerCase().replace(/\.$/, '');
    if (!EMAIL_BLOCKLIST.test(e)) found.add(e);
  }
  return [...found];
}

function robotsDisallows(robotsTxt, pathName) {
  // Parser sederhana: hanya blok "User-agent: *"
  const lines = String(robotsTxt || '').split(/\r?\n/);
  let applies = false;
  const disallows = [];
  for (const raw of lines) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') applies = val === '*';
    else if (applies && key === 'disallow' && val) disallows.push(val);
  }
  return disallows.some((d) => pathName.startsWith(d));
}

async function fetchTextLimited(fetchImpl, url, timeoutMs, maxBytes = 600 * 1024) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'LocalSpinLeadBot/1.3 (+contact-page-email-lookup)', Accept: 'text/html,text/plain' },
      signal: controller.signal
    });
    if (!resp.ok) return '';
    const text = await resp.text();
    return text.slice(0, maxBytes);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cari email di homepage + halaman kontak website usaha.
 */
async function findEmailOnWebsite(website, { fetchImpl = globalThis.fetch, timeoutMs = 8000, resolveDns = true } = {}) {
  if (!website) return { email: '', emails: [], source: '', status: 'NO_WEBSITE' };
  let base;
  try {
    base = await assertPublicHttpUrl(website, { resolveDns });
  } catch (e) {
    return { email: '', emails: [], source: '', status: e.code || 'BLOCKED' };
  }

  const origin = base.origin;
  const robots = await fetchTextLimited(fetchImpl, `${origin}/robots.txt`, timeoutMs, 64 * 1024);
  const candidatePaths = [base.pathname || '/', '/contact', '/kontak', '/hubungi-kami', '/contact-us'];
  const tried = new Set();

  for (const p of candidatePaths) {
    if (tried.has(p)) continue;
    tried.add(p);
    if (robotsDisallows(robots, p)) continue;
    const html = await fetchTextLimited(fetchImpl, `${origin}${p}`, timeoutMs);
    const emails = extractEmails(html);
    if (emails.length) {
      return { email: emails[0], emails, source: `${origin}${p}`, status: 'FOUND' };
    }
  }
  return { email: '', emails: [], source: '', status: 'NOT_FOUND' };
}

async function enrichLeadsWithEmails(leads, { fetchImpl = globalThis.fetch, concurrency = 4, resolveDns = true, maxSites = 60 } = {}) {
  const list = leads.slice();
  const targets = list.filter((l) => l.website).slice(0, maxSites);
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const lead = targets[cursor++];
      const r = await findEmailOnWebsite(lead.website, { fetchImpl, resolveDns });
      lead.email = r.email;
      lead.emailSource = r.source;
      lead.emailStatus = r.status;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, 8)) }, worker));
  return list;
}

/* ------------------------------ Filter, sort, export ------------------------------ */

function filterAndSortLeads(leads, {
  requirePhone = false,
  requireEmail = false,
  requireWebsite = false,
  requireOpeningHours = false,
  openNowOnly = false,
  operationalOnly = true,
  minRating = 0,
  minReviews = 0,
  nameContains = '',
  sortBy = 'rating_desc'
} = {}) {
  const needle = String(nameContains || '').trim().toLowerCase();
  const filtered = leads.filter((l) => {
    if (requirePhone && !l.phone) return false;
    if (requireEmail && !l.email) return false;
    if (requireWebsite && !l.website) return false;
    if (requireOpeningHours && !(l.openingHours && l.openingHours.length)) return false;
    if (openNowOnly && l.openNow !== true) return false;
    if (operationalOnly && l.businessStatus && l.businessStatus !== 'OPERATIONAL') return false;
    if (minRating && (l.rating || 0) < Number(minRating)) return false;
    if (minReviews && (l.reviewCount || 0) < Number(minReviews)) return false;
    if (needle && !l.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const sorters = {
    rating_desc: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount,
    reviews_desc: (a, b) => b.reviewCount - a.reviewCount,
    name_asc: (a, b) => a.name.localeCompare(b.name, 'id'),
    completeness_desc: (a, b) => leadCompleteness(b) - leadCompleteness(a)
  };
  return filtered.sort(sorters[sortBy] || sorters.rating_desc);
}

function leadCompleteness(l) {
  return [l.phone, l.email, l.website, l.openingHours && l.openingHours.length, l.rating].filter(Boolean).length;
}

const EXPORT_COLUMNS = {
  name: 'Nama Tempat',
  category: 'Kategori',
  address: 'Alamat',
  phone: 'Telepon',
  phoneInternational: 'Telepon (Internasional)',
  email: 'Email',
  website: 'Website',
  openingHours: 'Jam Buka',
  openNow: 'Buka Sekarang',
  rating: 'Rating',
  reviewCount: 'Jumlah Ulasan',
  priceLevel: 'Tingkat Harga',
  businessStatus: 'Status Usaha',
  latitude: 'Latitude',
  longitude: 'Longitude',
  googleMapsUri: 'Link Google Maps',
  placeId: 'Place ID'
};

function leadsToCsv(leads, columns = Object.keys(EXPORT_COLUMNS)) {
  const cols = columns.filter((c) => EXPORT_COLUMNS[c]);
  const esc = (v) => {
    let s = Array.isArray(v) ? v.join(' | ') : v === null || v === undefined ? '' : String(v);
    s = s.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // cegah CSV/Formula injection di Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = cols.map((c) => esc(EXPORT_COLUMNS[c])).join(',');
  const rows = leads.map((l) => cols.map((c) => esc(c === 'openNow' ? (l.openNow === null ? '' : l.openNow ? 'Ya' : 'Tidak') : l[c])).join(','));
  const footerCells = cols.map((_, idx) => (idx === 0 ? esc('Sumber data tempat: Google Maps') : '""')).join(',');
  return [header, ...rows, footerCells].join('\r\n');
}

module.exports = {
  PLACES_TEXT_SEARCH_URL,
  MAX_PLACES_RESULTS,
  EXPORT_COLUMNS,
  WEEKDAY_ID,
  buildTextQuery,
  normalizePlace,
  searchPlaces,
  searchPlacesSerper,
  searchPlacesFreeOsm,
  isPrivateIp,
  assertPublicHttpUrl,
  extractEmails,
  robotsDisallows,
  findEmailOnWebsite,
  enrichLeadsWithEmails,
  filterAndSortLeads,
  leadCompleteness,
  leadsToCsv
};
