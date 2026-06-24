/*
 * Purpose: Seed the REAL "RT 15 / RW 002 — Ds. Dander" tenant from its public blog and retire the dummy RTs.
 * Caller: docker exec -i jimpitan-api-1 node  (piped via stdin) or `node scripts/seed-dander.cjs`.
 * Deps: @prisma/client (generated), global fetch (Node >=18), DATABASE_URL + UPLOAD_STORAGE_PATH from container env.
 * MainFuncs: Creates the Dander RT + known-login admin (SUPER_ADMIN), imports all blog posts as content with cover
 *   images, then removes dummy content + deactivates dummy RTs + detaches the admin from them.
 * SideEffects: Writes content rows + cover image files to the upload volume; deletes dummy content; deactivates dummy RTs.
 *   Idempotent: content is upserted by (rtId, slug); covers skipped if present; dummy cleanup is repeatable.
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs/promises');
const path = require('node:path');
const prisma = new PrismaClient();

const RT_CODE = 'rt15-dander';
const RT_NAME = 'RT 15 / RW 002 — Ds. Dander';
const FEED_URL = 'https://guyubrukunrt15dander.blogspot.com/feeds/posts/default?alt=json&max-results=150';
const ADMIN_EMAIL = 'admin@jimpitan.local';
const ADMIN_NAME = 'Administrator RT 15 Dander';
// bcrypt(cost 12) hash of "RtkuDemo123"
const ADMIN_HASH = '$2b$12$EEdUcsTetKVimeUJjIivreM/yItMr.E6K87GpwpCA1iQywpnc64A2';
const DUMMY_CODES = ['rt-demo', 'rt-mawar', 'rt-melati'];
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_STORAGE_PATH || '/var/lib/jimpitan/uploads');
const BUCKET = process.env.UPLOAD_BUCKET || 'local-uploads';

const PERMISSION_KEYS = [
  'auth.session.manage','users.read','users.create','users.update','users.deactivate','users.roles.manage',
  'roles.read','roles.manage','permissions.read','residents.read','residents.create','residents.update','residents.delete',
  'residents.import','residents.export','houses.read','houses.manage','areas.read','areas.manage','schedules.read',
  'schedules.manage','schedules.assign','collections.read','collections.create','collections.update_own','collections.submit_own',
  'collections.validate','collections.reject','transactions.read','transactions.create','transactions.update','transactions.delete',
  'transactions.validate','transactions.post','approvals.read','approvals.decide','reports.public.read','reports.private.read',
  'reports.export','reports.publish','notifications.read','notifications.manage','telegram.bind','telegram.manage','audit.read',
  'settings.read','settings.update','backup.manage','monitoring.read','content.read','content.create','content.update',
  'content.publish','content.delete',
];

const NAMED_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', deg: '°', middot: '·', bull: '•' };

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeCp(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => safeCp(Number(n)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => (NAMED_ENTITIES[name.toLowerCase()] ?? m));
}
function safeCp(n) { try { return String.fromCodePoint(n); } catch { return ''; } }

function htmlToText(html) {
  if (!html) return '';
  let t = String(html);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<\s*br\s*\/?>/gi, '\n');
  t = t.replace(/<\s*li[^>]*>/gi, '\n• ');
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol|blockquote|section)\s*>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = decodeEntities(t);
  t = t.replace(/\r/g, '').replace(/ /g, ' ');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function slugFromLink(entry, title) {
  const alt = (entry.link || []).find((l) => l.rel === 'alternate');
  if (alt && alt.href) {
    const seg = alt.href.split('/').pop() || '';
    const base = seg.replace(/\.html?$/i, '').trim();
    if (base) return base.slice(0, 180);
  }
  return slugify(title);
}
function slugify(s) {
  const out = String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);
  return out || 'post';
}

function mapType(title, labels, imgCount, textLen) {
  const s = (title + ' ' + labels).toLowerCase();
  if (/pengumuman|undangan|himbauan|maklumat|pemberitahuan/.test(s)) return 'ANNOUNCEMENT';
  if (/galeri|dokumentasi|video|peta\b|foto/.test(s)) return 'GALLERY';
  if (/kerja bakti|gotong[ -]royong|renovasi|karya bakti|rapat|penanaman|serah terima|membersihkan|bersihkan|kebut|laksanakan|menerima bantuan|terima bantuan|pemasangan|kerja sama|sinergi/.test(s)) return 'ACTIVITY';
  if (imgCount >= 10 && textLen < 800) return 'GALLERY';
  return 'ARTICLE';
}

function firstImageUrl(html) {
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return null;
  let url = decodeEntities(m[1]);
  if (url.startsWith('//')) url = 'https:' + url;
  if (!/^https?:\/\//i.test(url)) return null;
  // Try to upscale common Blogger/Google thumbnail sizing to a card-friendly width.
  url = url.replace(/\/s\d{2,4}(-c)?\//, '/s1280/').replace(/=s\d{2,4}(-c)?(?=$|[?&])/, '=s1280').replace(/=w\d+-h\d+(-[a-z-]+)?/i, '=s1280');
  return url;
}

function deriveLocation(text) {
  const t = String(text);
  if (/Gang Mulyorejo/i.test(t)) return 'Gang Mulyorejo, Ds. Dander';
  if (/Lapangan Desa Dander/i.test(t)) return 'Lapangan Desa Dander';
  if (/Balai|Kantor Desa/i.test(t)) return 'Kantor/Balai Desa Dander';
  return 'RT 15, Ds. Dander';
}

function rng(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function fetchImageBuffer(url) {
  for (const candidate of [url, url.replace(/\/s1280\//, '/s640/').replace(/=s1280/, '=s640')]) {
    try {
      const res = await fetch(candidate, { redirect: 'follow' });
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('image/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1200) continue;
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
      return { buf, mime: ct.split(';')[0], ext };
    } catch { /* try next */ }
  }
  return null;
}

async function ensureAdminForRt(rt) {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { status: 'ACTIVE', deletedAt: null },
    create: { email: ADMIN_EMAIL, fullName: ADMIN_NAME, passwordHash: ADMIN_HASH, status: 'ACTIVE' },
  });
  const role = await prisma.role.upsert({
    where: { rtId_key: { rtId: rt.id, key: 'SUPER_ADMIN' } },
    update: { isSystem: true, deletedAt: null },
    create: { rtId: rt.id, key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full tenant administration role.', isSystem: true, createdById: admin.id, updatedById: admin.id },
  });
  const membership = await prisma.rtMembership.upsert({
    where: { rtId_userId: { rtId: rt.id, userId: admin.id } },
    update: { status: 'ACTIVE' },
    create: { rtId: rt.id, userId: admin.id, status: 'ACTIVE' },
  });
  await prisma.userRole.upsert({
    where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
    update: {},
    create: { membershipId: membership.id, roleId: role.id },
  });
  for (const key of PERMISSION_KEYS) {
    const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key, module: key.split('.')[0], description: `Allows ${key}.` } });
    await prisma.rolePermission.createMany({ data: [{ roleId: role.id, permissionId: permission.id }], skipDuplicates: true });
  }
  return admin;
}

async function attachCover(announcement, imgUrl, adminId) {
  const existing = await prisma.attachment.findFirst({ where: { announcementId: announcement.id, deletedAt: null, status: 'UPLOADED' } });
  if (existing) return 'skip';
  const img = await fetchImageBuffer(imgUrl);
  if (!img) return 'none';
  const objectKey = `announcements/${announcement.id}/cover.${img.ext}`;
  const full = path.join(UPLOAD_ROOT, objectKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, img.buf);
  await prisma.attachment.create({
    data: {
      rtId: announcement.rtId, announcementId: announcement.id, ownerType: 'ANNOUNCEMENT', ownerId: announcement.id,
      status: 'UPLOADED', bucket: BUCKET, objectKey, fileName: `cover.${img.ext}`, mimeType: img.mime, sizeBytes: BigInt(img.buf.length),
      metadata: { role: 'cover', sortOrder: 0 }, uploadedById: adminId, completedAt: new Date(),
    },
  });
  return 'created';
}

async function main() {
  const rt = await prisma.rt.upsert({
    where: { code: RT_CODE },
    update: { name: RT_NAME, isActive: true, deletedAt: null },
    create: { code: RT_CODE, name: RT_NAME, timezone: 'Asia/Jakarta', isActive: true },
  });
  const admin = await ensureAdminForRt(rt);

  const feed = await (await fetch(FEED_URL)).json();
  const entries = (feed.feed.entry || []).slice().sort((a, b) => new Date(get(a, 'published')) - new Date(get(b, 'published')));
  function get(o, k) { return o && o[k] ? o[k]['$t'] : ''; }

  const usedSlugs = new Set();
  let covers = { created: 0, skip: 0, none: 0 };
  let imported = 0;

  for (const entry of entries) {
    const title = (get(entry, 'title') || '(Tanpa judul)').trim();
    const rawHtml = get(entry, 'content') || get(entry, 'summary') || '';
    const text = htmlToText(rawHtml);
    if (!text && !title) continue;
    const labels = (entry.category || []).map((c) => c.term).join(' ');
    const imgCount = (rawHtml.match(/<img/gi) || []).length;
    const type = mapType(title, labels, imgCount, text.length);
    const publishedAt = new Date(get(entry, 'published') || Date.now());

    let slug = slugFromLink(entry, title);
    while (usedSlugs.has(slug)) slug = `${slug}-2`.slice(0, 190);
    usedSlugs.add(slug);

    const excerpt = (text.replace(/\n+/g, ' ').slice(0, 250).trim() || title.slice(0, 250));
    const body = text || title;
    const isEvent = type === 'ACTIVITY';

    const ann = await prisma.announcement.upsert({
      where: { rtId_slug: { rtId: rt.id, slug } },
      update: {
        type, title: title.slice(0, 180), excerpt: excerpt.slice(0, 300), body,
        status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt,
        eventStartAt: isEvent ? publishedAt : null, location: isEvent ? deriveLocation(text) : null,
        updatedById: admin.id, deletedAt: null,
      },
      create: {
        rtId: rt.id, type, title: title.slice(0, 180), slug, excerpt: excerpt.slice(0, 300), body,
        status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt,
        eventStartAt: isEvent ? publishedAt : null, location: isEvent ? deriveLocation(text) : null,
        reactionCount: rng(2, 24), viewCount: rng(15, 180),
        createdById: admin.id, updatedById: admin.id,
      },
    });
    imported += 1;

    const imgUrl = firstImageUrl(rawHtml);
    if (imgUrl) {
      const r = await attachCover(ann, imgUrl, admin.id).catch(() => 'none');
      covers[r] = (covers[r] || 0) + 1;
    } else {
      covers.none += 1;
    }
  }

  // Retire dummy RTs: delete their content + detach the admin + deactivate (keeps FK integrity; no hard cascade).
  const dummy = { contentDeleted: 0, deactivated: 0, detached: 0 };
  for (const code of DUMMY_CODES) {
    const d = await prisma.rt.findUnique({ where: { code } });
    if (!d) continue;
    await prisma.postReaction.deleteMany({ where: { rtId: d.id } });
    await prisma.attachment.deleteMany({ where: { rtId: d.id, announcementId: { not: null } } });
    const del = await prisma.announcement.deleteMany({ where: { rtId: d.id } });
    dummy.contentDeleted += del.count;
    const mem = await prisma.rtMembership.findUnique({ where: { rtId_userId: { rtId: d.id, userId: admin.id } } });
    if (mem) {
      await prisma.userRole.deleteMany({ where: { membershipId: mem.id } });
      await prisma.rtMembership.delete({ where: { id: mem.id } });
      dummy.detached += 1;
    }
    await prisma.rt.update({ where: { id: d.id }, data: { isActive: false } });
    dummy.deactivated += 1;
  }

  const byType = {};
  for (const t of ['ANNOUNCEMENT', 'ACTIVITY', 'ARTICLE', 'GALLERY']) {
    byType[t] = await prisma.announcement.count({ where: { rtId: rt.id, type: t } });
  }
  console.log('SEED DANDER OK', JSON.stringify({
    rt: rt.code, name: rt.name, admin: ADMIN_EMAIL, imported, byType, covers, dummy,
    totalActiveRts: await prisma.rt.count({ where: { isActive: true } }),
  }));
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('SEED DANDER FAILED:', error && error.stack ? error.stack : error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
