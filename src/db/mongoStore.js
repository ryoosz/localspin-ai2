const crypto = require('node:crypto');

let cachedClient = null;
let cachedUri = null;

function getMongoClientClass() {
  const { MongoClient } = require('mongodb');
  return MongoClient;
}

async function getMongoDb(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB_NAME || 'localspin_ai') {
  if (!uri) {
    throw new Error('MONGODB_URI belum dikonfigurasi.');
  }
  if (!cachedClient || cachedUri !== uri) {
    const MongoClient = getMongoClientClass();
    cachedClient = new MongoClient(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    });
    await cachedClient.connect();
    cachedUri = uri;
  }
  return cachedClient.db(dbName);
}

async function pingMongo(uri = process.env.MONGODB_URI) {
  if (!uri) return { configured: false, connected: false };
  try {
    const db = await getMongoDb(uri);
    await db.command({ ping: 1 });
    return { configured: true, connected: true, dbName: db.databaseName };
  } catch (err) {
    return { configured: true, connected: false, error: err.message };
  }
}

async function saveProjectToMongo(uri, payload) {
  const db = await getMongoDb(uri);
  const now = new Date().toISOString();
  const id = String(payload.projectId || `proj_${crypto.randomBytes(6).toString('hex')}`);
  const images = Array.isArray(payload.images) ? payload.images.slice(0, 99) : [];
  const doc = {
    id,
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    name: String(payload.name || 'Project Baru').trim(),
    topic: String(payload.topic || '').trim(),
    rawMainArticle: String(payload.rawMainArticle || ''),
    autoTemplateEnabled: payload.autoTemplateEnabled !== false,
    whatsappNumber: String(payload.whatsappNumber || '6281234567890'),
    whatsappLabel: String(payload.whatsappLabel || 'Chat WhatsApp Konsultan Sekarang'),
    targetUrl: String(payload.targetUrl || 'https://nusantaraseo.id/layanan-resmi'),
    anchorText: String(payload.anchorText || 'halaman layanan resmi kami'),
    imagesPerArticle: Number(payload.imagesPerArticle || 2),
    images: images.map((img, idx) =>
      typeof img === 'string'
        ? { slotIndex: idx + 1, imageUrl: img, customTitle: '', customAlt: '' }
        : {
            slotIndex: Number(img.slotIndex || idx + 1),
            imageUrl: String(img.imageUrl || img.url || ''),
            customTitle: String(img.customTitle || ''),
            customAlt: String(img.customAlt || '')
          }
    ),
    updatedAt: now
  };

  await db.collection('projects').updateOne(
    { id, workspaceId: payload.workspaceId },
    { $set: doc, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return { ...doc, imageCount: doc.images.length };
}

async function listProjectsFromMongo(uri, { workspaceId }) {
  const db = await getMongoDb(uri);
  const docs = await db
    .collection('projects')
    .find({ workspaceId }, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, imageCount: Array.isArray(d.images) ? d.images.length : 0 }));
}

async function getProjectFromMongo(uri, { workspaceId, projectId }) {
  const db = await getMongoDb(uri);
  const doc = await db.collection('projects').findOne({ id: projectId, workspaceId }, { projection: { _id: 0 } });
  if (!doc) return null;
  return { ...doc, imageCount: Array.isArray(doc.images) ? doc.images.length : 0 };
}

async function saveCampaignToMongo(uri, payload) {
  const db = await getMongoDb(uri);
  const campaignId = `cmp_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  const doc = {
    id: campaignId,
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    projectId: payload.projectId || null,
    topic: payload.topic,
    category: payload.category,
    wilayah: payload.wilayah,
    jenisDaerah: payload.jenisDaerah,
    kotaKabupaten: payload.kotaKabupaten,
    masterSpintax: payload.masterSpintax,
    batchResult: payload.batchResult,
    createdAt: now
  };
  await db.collection('campaigns').insertOne({ ...doc });
  return {
    campaignId,
    createdAt: now,
    articlesSaved: (payload.batchResult && Array.isArray(payload.batchResult.articles) ? payload.batchResult.articles.length : 0)
  };
}

async function getCampaignFromMongo(uri, { workspaceId, campaignId }) {
  const db = await getMongoDb(uri);
  const doc = await db.collection('campaigns').findOne({ id: campaignId, workspaceId }, { projection: { _id: 0 } });
  if (!doc) return null;
  return {
    campaign: doc,
    articles: (doc.batchResult && doc.batchResult.articles) || []
  };
}

async function saveEmailCampaignToMongo(uri, payload) {
  const db = await getMongoDb(uri);
  const emailCampaignId = `eml_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  const doc = {
    id: emailCampaignId,
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    commodity: payload.commodity,
    queueResult: payload.queueResult,
    createdAt: now
  };
  await db.collection('email_campaigns').insertOne({ ...doc });
  return {
    emailCampaignId,
    createdAt: now,
    totalQueued: (payload.queueResult && payload.queueResult.totalQueued) || 0
  };
}

async function getEmailCampaignFromMongo(uri, { workspaceId, emailCampaignId }) {
  const db = await getMongoDb(uri);
  const doc = await db.collection('email_campaigns').findOne({ id: emailCampaignId, workspaceId }, { projection: { _id: 0 } });
  if (!doc) return null;
  return {
    campaign: doc,
    items: (doc.queueResult && doc.queueResult.items) || []
  };
}

module.exports = {
  getMongoDb,
  pingMongo,
  saveProjectToMongo,
  listProjectsFromMongo,
  getProjectFromMongo,
  saveCampaignToMongo,
  getCampaignFromMongo,
  saveEmailCampaignToMongo,
  getEmailCampaignFromMongo
};
