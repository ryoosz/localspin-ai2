const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const MAX_IMAGES_PER_PROJECT = 99;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function createDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      plan_tier TEXT NOT NULL DEFAULT 'pro_local_seo',
      monthly_article_quota INTEGER NOT NULL DEFAULT 500,
      articles_used INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workspace_memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      topic TEXT NOT NULL,
      raw_main_article TEXT NOT NULL DEFAULT '',
      auto_template_enabled INTEGER NOT NULL DEFAULT 1,
      whatsapp_number TEXT NOT NULL DEFAULT '6281234567890',
      whatsapp_label TEXT NOT NULL DEFAULT 'Chat WhatsApp Konsultan Sekarang',
      target_url TEXT NOT NULL DEFAULT 'https://nusantaraseo.id/layanan-resmi',
      anchor_text TEXT NOT NULL DEFAULT 'halaman layanan resmi kami',
      images_per_article INTEGER NOT NULL DEFAULT 2,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL CHECK (slot_index >= 1 AND slot_index <= 99),
      image_url TEXT NOT NULL,
      custom_title_pattern TEXT NOT NULL DEFAULT '',
      custom_alt_pattern TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      created_by_user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      category TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      jenis_daerah TEXT NOT NULL,
      kota_kabupaten TEXT NOT NULL,
      master_spintax TEXT NOT NULL,
      average_uniqueness_pct REAL NOT NULL,
      max_overlap_pct REAL NOT NULL,
      copyscape_status TEXT NOT NULL,
      total_articles INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS generated_articles (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      jenis_daerah TEXT NOT NULL,
      kota_kabupaten TEXT NOT NULL,
      kecamatan TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      uniqueness_pct REAL NOT NULL,
      max_overlap_4_pct REAL NOT NULL,
      copyscape_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS email_campaigns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      commodity TEXT NOT NULL,
      schedule_mode TEXT NOT NULL,
      min_delay_minutes REAL NOT NULL,
      max_delay_minutes REAL NOT NULL,
      total_queued INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS email_queue_items (
      id TEXT PRIMARY KEY,
      email_campaign_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      sender_provider_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (email_campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_project_images_proj ON project_images(project_id, workspace_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_articles_workspace_campaign ON generated_articles(workspace_id, campaign_id);
  `);

  const now = new Date().toISOString();
  const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get('usr_owner_a');
  if (!existingUser) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, email, full_name, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertUser.run('usr_owner_a', 'founder@nusantaraseo.id', 'Raka Pratama', hashPassword('DemoPass#2026'), 'active', now);
    insertUser.run('usr_viewer_a', 'viewer@nusantaraseo.id', 'Sinta Maharani', hashPassword('DemoPass#2026'), 'active', now);
    insertUser.run('usr_owner_b', 'ceo@mitradigital.co.id', 'Budi Santoso', hashPassword('DemoPass#2026'), 'active', now);

    const insertWks = db.prepare(
      'INSERT INTO workspaces (id, name, owner_user_id, plan_tier, monthly_article_quota, articles_used, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertWks.run('wks_nusantara', 'Nusantara Local SEO Agency', 'usr_owner_a', 'pro_local_seo', 500, 0, 'active', now);
    insertWks.run('wks_mitra', 'Mitra Digital Mandiri', 'usr_owner_b', 'starter_trial', 25, 0, 'active', now);

    const insertMember = db.prepare(
      'INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertMember.run('mem_1', 'wks_nusantara', 'usr_owner_a', 'owner', 'active', now);
    insertMember.run('mem_2', 'wks_nusantara', 'usr_viewer_a', 'viewer', 'active', now);
    insertMember.run('mem_3', 'wks_mitra', 'usr_owner_b', 'owner', 'active', now);

    // Seed Default Project A & Project B with independent image libraries
    const insertProj = db.prepare(
      `INSERT INTO projects (
        id, workspace_id, name, topic, raw_main_article, auto_template_enabled,
        whatsapp_number, whatsapp_label, target_url, anchor_text, images_per_article, updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertProj.run(
      'proj_a',
      'wks_nusantara',
      'Project A — Solar Panel & Energi',
      'Jasa Instalasi Panel Surya & Audit Energi',
      'Layanan pemasangan sistem panel surya terbaik dan profesional untuk rumah maupun gedung komersial. Tim teknisi berpengalaman kami memberikan solusi hemat biaya listrik dengan kualitas komponen bergaransi resmi.',
      1,
      '6281234567890',
      'Chat WhatsApp Spesialis Panel Surya',
      'https://nusantaraseo.id/panel-surya',
      'katalog paket panel surya resmi',
      2,
      now,
      now
    );

    insertProj.run(
      'proj_b',
      'wks_nusantara',
      'Project B — Kontraktor Renovasi & Interior',
      'Jasa Kontraktor Renovasi Rumah & Bangunan',
      'Jasa kontraktor renovasi rumah terpercaya dengan rincian biaya transparan dan pengerjaan cepat tepat waktu. Teknisi dan tukang ahli kami siap menangani perbaikan atap, penambahan lantai, hingga desain interior terbaik.',
      1,
      '6281987654321',
      'Konsultasi WhatsApp Tim Arsitek & Sipil',
      'https://nusantaraseo.id/kontraktor-renovasi',
      'portofolio proyek renovasi bangunan',
      2,
      now,
      now
    );

    const insertImg = db.prepare(
      `INSERT INTO project_images (
        id, project_id, workspace_id, slot_index, image_url, custom_title_pattern, custom_alt_pattern, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const defaultSolarImages = [
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1000&q=80'
    ];
    defaultSolarImages.forEach((url, idx) => {
      insertImg.run(
        `img_pa_${idx + 1}`,
        'proj_a',
        'wks_nusantara',
        idx + 1,
        url,
        `{{topik}} - Referensi #${idx + 1} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`,
        `Dokumentasi {{topik}} #${idx + 1} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}})`,
        now
      );
    });

    const defaultRenovImages = [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1541888946425-d09bb18086f6?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1000&q=80'
    ];
    defaultRenovImages.forEach((url, idx) => {
      insertImg.run(
        `img_pb_${idx + 1}`,
        'proj_b',
        'wks_nusantara',
        idx + 1,
        url,
        `{{topik}} - Proyek #${idx + 1} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`,
        `Foto Proyek {{topik}} #${idx + 1} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}})`,
        now
      );
    });
  }

  return db;
}

/**
 * Server-side Authorization & Tenant Isolation Check
 */
function authorizeWorkspaceAction(db, { userId, workspaceId, requiredRoles = ['owner', 'admin', 'editor', 'viewer'] }) {
  if (!userId || !workspaceId) {
    return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Identitas pengguna dan workspace wajib disertakan.' };
  }

  const membership = db
    .prepare(
      `SELECT wm.role, wm.status, w.plan_tier, w.monthly_article_quota, w.articles_used, w.status as workspace_status
       FROM workspace_memberships wm
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = ? AND wm.workspace_id = ?`
    )
    .get(userId, workspaceId);

  if (!membership || membership.status !== 'active' || membership.workspace_status !== 'active') {
    return {
      allowed: false,
      status: 403,
      code: 'FORBIDDEN_TENANT_ACCESS',
      message: 'Akses ditolak: Anda bukan anggota aktif dari workspace ini (Isolasi Multi-Tenant).'
    };
  }

  if (!requiredRoles.includes(membership.role)) {
    return {
      allowed: false,
      status: 403,
      code: 'INSUFFICIENT_ROLE_PERMISSION',
      message: `Peran '${membership.role}' tidak memiliki izin untuk melakukan operasi ini.`
    };
  }

  return {
    allowed: true,
    membership
  };
}

/**
 * Save or update a Project and its up-to-99 Reference Images (isolated by project_id & workspace_id).
 */
function saveProjectAndImages(db, {
  workspaceId,
  userId,
  projectId,
  name,
  topic,
  rawMainArticle = '',
  autoTemplateEnabled = true,
  whatsappNumber = '6281234567890',
  whatsappLabel = 'Chat WhatsApp Konsultan Sekarang',
  targetUrl = 'https://nusantaraseo.id/layanan-resmi',
  anchorText = 'halaman layanan resmi kami',
  imagesPerArticle = 2,
  images = []
}) {
  const auth = authorizeWorkspaceAction(db, {
    userId,
    workspaceId,
    requiredRoles: ['owner', 'admin', 'editor']
  });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  if (!Array.isArray(images)) {
    images = [];
  }
  if (images.length > MAX_IMAGES_PER_PROJECT) {
    const err = new Error(`Batas maksimum gambar per project adalah ${MAX_IMAGES_PER_PROJECT} gambar (diterima: ${images.length}).`);
    err.status = 400;
    err.code = 'MAX_PROJECT_IMAGES_EXCEEDED';
    throw err;
  }

  const now = new Date().toISOString();
  const resolvedProjectId = projectId || `proj_${crypto.randomBytes(5).toString('hex')}`;

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const existing = db
      .prepare('SELECT id, workspace_id FROM projects WHERE id = ?')
      .get(resolvedProjectId);

    if (existing && existing.workspace_id !== workspaceId) {
      const err = new Error('Project milik workspace lain tidak dapat diakses atau diubah (Anti-IDOR).');
      err.status = 403;
      err.code = 'FORBIDDEN_PROJECT_ACCESS';
      throw err;
    }

    if (existing) {
      db.prepare(
        `UPDATE projects SET
          name = ?, topic = ?, raw_main_article = ?, auto_template_enabled = ?,
          whatsapp_number = ?, whatsapp_label = ?, target_url = ?, anchor_text = ?,
          images_per_article = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`
      ).run(
        String(name || 'Project Tanpa Nama').trim(),
        String(topic || 'Layanan Profesional').trim(),
        String(rawMainArticle || ''),
        autoTemplateEnabled ? 1 : 0,
        String(whatsappNumber || '6281234567890'),
        String(whatsappLabel || 'Chat WhatsApp Sekarang'),
        String(targetUrl || ''),
        String(anchorText || 'halaman resmi'),
        Math.max(1, Math.min(10, Number(imagesPerArticle) || 2)),
        now,
        resolvedProjectId,
        workspaceId
      );
    } else {
      db.prepare(
        `INSERT INTO projects (
          id, workspace_id, name, topic, raw_main_article, auto_template_enabled,
          whatsapp_number, whatsapp_label, target_url, anchor_text, images_per_article, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        resolvedProjectId,
        workspaceId,
        String(name || 'Project Baru').trim(),
        String(topic || 'Layanan Profesional').trim(),
        String(rawMainArticle || ''),
        autoTemplateEnabled ? 1 : 0,
        String(whatsappNumber || '6281234567890'),
        String(whatsappLabel || 'Chat WhatsApp Sekarang'),
        String(targetUrl || ''),
        String(anchorText || 'halaman resmi'),
        Math.max(1, Math.min(10, Number(imagesPerArticle) || 2)),
        now,
        now
      );
    }

    // Replace project image slots (1..99)
    db.prepare('DELETE FROM project_images WHERE project_id = ? AND workspace_id = ?').run(resolvedProjectId, workspaceId);

    const insertImg = db.prepare(
      `INSERT INTO project_images (
        id, project_id, workspace_id, slot_index, image_url, custom_title_pattern, custom_alt_pattern, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    images.forEach((imgItem, idx) => {
      const slot = idx + 1;
      const url = typeof imgItem === 'string' ? imgItem.trim() : String(imgItem.url || imgItem.imageUrl || '').trim();
      if (!url) return;
      const customTitle =
        (typeof imgItem === 'object' && imgItem.titlePattern) ||
        `{{topik}} - Referensi Gambar #${slot} Kecamatan {{kecamatan}}, {{label_kota_kabupaten}}`;
      const customAlt =
        (typeof imgItem === 'object' && imgItem.altPattern) ||
        `Dokumentasi {{topik}} #${slot} di Kecamatan {{kecamatan}}, {{label_kota_kabupaten}} ({{wilayah}})`;

      insertImg.run(
        `img_${crypto.randomBytes(6).toString('hex')}`,
        resolvedProjectId,
        workspaceId,
        slot,
        url,
        customTitle,
        customAlt,
        now
      );
    });

    db.exec('COMMIT;');
    return getProjectWithImages(db, { workspaceId, userId, projectId: resolvedProjectId });
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }
}

function getProjectWithImages(db, { workspaceId, userId, projectId }) {
  const auth = authorizeWorkspaceAction(db, { userId, workspaceId });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND workspace_id = ?')
    .get(projectId, workspaceId);

  if (!project) {
    const err = new Error('Project tidak ditemukan di workspace ini.');
    err.status = 404;
    err.code = 'PROJECT_NOT_FOUND';
    throw err;
  }

  const images = db
    .prepare('SELECT id, slot_index, image_url, custom_title_pattern, custom_alt_pattern FROM project_images WHERE project_id = ? AND workspace_id = ? ORDER BY slot_index ASC')
    .all(projectId, workspaceId);

  return {
    ...project,
    auto_template_enabled: Boolean(project.auto_template_enabled),
    imageCount: images.length,
    maxImagesAllowed: MAX_IMAGES_PER_PROJECT,
    images
  };
}

function listWorkspaceProjects(db, { workspaceId, userId }) {
  const auth = authorizeWorkspaceAction(db, { userId, workspaceId });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const projects = db
    .prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at ASC')
    .all(workspaceId);

  return projects.map((p) => {
    const images = db
      .prepare('SELECT id, slot_index, image_url, custom_title_pattern, custom_alt_pattern FROM project_images WHERE project_id = ? AND workspace_id = ? ORDER BY slot_index ASC')
      .all(p.id, workspaceId);
    return {
      ...p,
      auto_template_enabled: Boolean(p.auto_template_enabled),
      imageCount: images.length,
      maxImagesAllowed: MAX_IMAGES_PER_PROJECT,
      images
    };
  });
}

function saveCampaignTransaction(db, { workspaceId, userId, projectId = null, topic, category, wilayah, jenisDaerah, kotaKabupaten, masterSpintax, batchResult }) {
  const auth = authorizeWorkspaceAction(db, {
    userId,
    workspaceId,
    requiredRoles: ['owner', 'admin', 'editor']
  });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const countToCreate = batchResult.articles.length;
  const remainingQuota = auth.membership.monthly_article_quota - auth.membership.articles_used;
  if (countToCreate > remainingQuota) {
    const err = new Error(`Kuota artikel workspace tidak mencukupi (tersisa ${remainingQuota}, dibutuhkan ${countToCreate}).`);
    err.status = 402;
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }

  const campaignId = `cmp_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    db.prepare(
      `INSERT INTO campaigns (
        id, workspace_id, project_id, created_by_user_id, topic, category, wilayah, jenis_daerah,
        kota_kabupaten, master_spintax, average_uniqueness_pct, max_overlap_pct,
        copyscape_status, total_articles, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      campaignId,
      workspaceId,
      projectId,
      userId,
      topic,
      category,
      wilayah,
      jenisDaerah,
      kotaKabupaten,
      masterSpintax,
      batchResult.audit.averageUniquenessPercent,
      batchResult.audit.maxOverlapPercent,
      batchResult.audit.allPassed ? 'PASS_COPYSCAPE_THRESHOLD' : 'WARNING_OVERLAP',
      countToCreate,
      now
    );

    const insertArt = db.prepare(
      `INSERT INTO generated_articles (
        id, campaign_id, workspace_id, slug, wilayah, jenis_daerah, kota_kabupaten,
        kecamatan, title, content, word_count, uniqueness_pct, max_overlap_4_pct,
        copyscape_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const art of batchResult.articles) {
      const artId = `art_${crypto.randomBytes(6).toString('hex')}`;
      insertArt.run(
        artId,
        campaignId,
        workspaceId,
        art.slug,
        art.wilayah,
        art.jenisDaerah,
        art.kotaKabupaten,
        art.kecamatan,
        art.title,
        art.content,
        art.wordCount,
        art.uniquenessPercent,
        art.maxOverlap4Percent,
        art.copyscapeStatus,
        now
      );
    }

    db.prepare('UPDATE workspaces SET articles_used = articles_used + ? WHERE id = ?').run(countToCreate, workspaceId);

    db.prepare(
      `INSERT INTO audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `aud_${crypto.randomBytes(6).toString('hex')}`,
      workspaceId,
      userId,
      'campaign.generate_batch',
      'campaign',
      campaignId,
      JSON.stringify({
        projectId,
        topic,
        wilayah,
        jenisDaerah,
        kotaKabupaten,
        totalArticles: countToCreate,
        avgUniqueness: batchResult.audit.averageUniquenessPercent
      }),
      now
    );

    db.exec('COMMIT;');
    return { campaignId, createdAt: now };
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }
}

function getCampaignByIdScoped(db, { workspaceId, userId, campaignId }) {
  const auth = authorizeWorkspaceAction(db, {
    userId,
    workspaceId,
    requiredRoles: ['owner', 'admin', 'editor', 'viewer']
  });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const campaign = db
    .prepare('SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?')
    .get(campaignId, workspaceId);

  if (!campaign) {
    const err = new Error('Campaign tidak ditemukan atau berada di luar otorisasi workspace Anda (Anti-IDOR).');
    err.status = 404;
    err.code = 'RESOURCE_NOT_FOUND';
    throw err;
  }

  const articles = db
    .prepare('SELECT * FROM generated_articles WHERE campaign_id = ? AND workspace_id = ? ORDER BY kecamatan ASC')
    .all(campaignId, workspaceId);

  return { campaign, articles };
}

function saveEmailCampaignTransaction(db, { workspaceId, userId, commodity, queueResult }) {
  const auth = authorizeWorkspaceAction(db, {
    userId,
    workspaceId,
    requiredRoles: ['owner', 'admin', 'editor']
  });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const emailCampaignId = `ecmp_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    db.prepare(
      `INSERT INTO email_campaigns (
        id, workspace_id, created_by_user_id, commodity, schedule_mode,
        min_delay_minutes, max_delay_minutes, total_queued, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      emailCampaignId,
      workspaceId,
      userId,
      String(commodity || 'Commodity Trade Offer'),
      queueResult.summary.scheduleMode,
      queueResult.summary.minDelayMinutes,
      queueResult.summary.maxDelayMinutes,
      queueResult.summary.totalQueued,
      now
    );

    const insertItem = db.prepare(
      `INSERT INTO email_queue_items (
        id, email_campaign_id, workspace_id, recipient_name, recipient_email,
        sender_email, sender_provider_type, subject, body, scheduled_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of queueResult.queueItems) {
      insertItem.run(
        `eqi_${crypto.randomBytes(6).toString('hex')}`,
        emailCampaignId,
        workspaceId,
        item.recipientName,
        item.recipientEmail,
        item.senderEmail,
        item.senderProviderType,
        item.subject,
        item.body,
        item.scheduledAt,
        item.status,
        now
      );
    }

    db.prepare(
      `INSERT INTO audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `aud_${crypto.randomBytes(6).toString('hex')}`,
      workspaceId,
      userId,
      'email_campaign.schedule_batch',
      'email_campaign',
      emailCampaignId,
      JSON.stringify({
        commodity,
        scheduleMode: queueResult.summary.scheduleMode,
        totalQueued: queueResult.summary.totalQueued
      }),
      now
    );

    db.exec('COMMIT;');
    return { emailCampaignId, createdAt: now };
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }
}

function getEmailCampaignByIdScoped(db, { workspaceId, userId, emailCampaignId }) {
  const auth = authorizeWorkspaceAction(db, {
    userId,
    workspaceId,
    requiredRoles: ['owner', 'admin', 'editor', 'viewer']
  });
  if (!auth.allowed) {
    const err = new Error(auth.message);
    err.status = auth.status;
    err.code = auth.code;
    throw err;
  }

  const campaign = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ? AND workspace_id = ?')
    .get(emailCampaignId, workspaceId);

  if (!campaign) {
    const err = new Error('Email campaign tidak ditemukan atau berada di luar otorisasi workspace Anda (Anti-IDOR).');
    err.status = 404;
    err.code = 'RESOURCE_NOT_FOUND';
    throw err;
  }

  const items = db
    .prepare('SELECT * FROM email_queue_items WHERE email_campaign_id = ? AND workspace_id = ? ORDER BY scheduled_at ASC')
    .all(emailCampaignId, workspaceId);

  return { campaign, items };
}

module.exports = {
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
};
