/*
 * Purpose: Idempotent demo-data seed for an RTku deployment (run inside the api container).
 * Caller: docker exec -i jimpitan-api-1 node  (piped via stdin) or `node scripts/seed-demo.cjs`.
 * Deps: @prisma/client (generated), DATABASE_URL from the container env.
 * MainFuncs: Ensures RT + known-login admin + full SUPER_ADMIN permissions, then seeds areas/houses/residents/finance/content.
 * SideEffects: Writes demo rows to PostgreSQL. Re-running is safe (upserts + count guards).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RT_CODE = 'rt-demo';
const RT_NAME = 'RT 05 / RW 02 — Desa Makmur';
const ADMIN_EMAIL = 'admin@jimpitan.local';
const ADMIN_NAME = 'Administrator RT';
// bcrypt(cost 12) hash of "RtkuDemo123"
const ADMIN_HASH = '$2b$12$EEdUcsTetKVimeUJjIivreM/yItMr.E6K87GpwpCA1iQywpnc64A2';

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

const AREAS = [
  { code: 'A', name: 'Blok Anggrek', sortOrder: 1 },
  { code: 'B', name: 'Blok Bougenville', sortOrder: 2 },
  { code: 'C', name: 'Blok Cempaka', sortOrder: 3 },
];

const RESIDENT_NAMES = [
  'Budi Santoso','Siti Aminah','Agus Wijaya','Dewi Lestari','Eko Prasetyo','Rina Marlina','Joko Susilo','Sri Wahyuni',
  'Hendra Gunawan','Maya Sari','Bambang Iriawan','Nurul Hidayah','Slamet Riyadi','Yuni Astuti','Andi Kurniawan','Lia Permata',
];

const CONTENT = [
  { type: 'ACTIVITY', slug: 'kerja-bakti-senam-pagi', title: 'Kerja Bakti & Senam Pagi Bersama', location: 'Balai RT', event: '2026-06-29T06:30:00+07:00', excerpt: 'Minggu pagi ini kita bersih-bersih lingkungan dilanjut senam bersama. Yuk ramaikan!', body: 'Dalam rangka menjaga kebersihan dan kebugaran warga, RT 05 mengadakan kerja bakti dan senam pagi bersama.\n\nAyo bawa peralatan kebersihan masing-masing. Setelah kegiatan, panitia menyediakan kopi dan jajanan untuk seluruh warga yang hadir.' },
  { type: 'ACTIVITY', slug: 'posyandu-balita-lansia-juni', title: 'Posyandu Balita & Lansia Bulan Juni', location: 'Pos RW 02', event: '2026-06-18T08:00:00+07:00', excerpt: 'Pemeriksaan rutin & pembagian vitamin untuk balita dan lansia.', body: 'Posyandu bulan ini kembali digelar. Layanan meliputi penimbangan balita, pemeriksaan tekanan darah lansia, serta pembagian vitamin.\n\nMohon membawa buku KIA bagi yang memiliki balita.' },
  { type: 'ANNOUNCEMENT', slug: 'iuran-keamanan-juli', title: 'Iuran Keamanan Bulan Juli', excerpt: 'Mohon iuran keamanan disetor paling lambat tanggal 10 Juli.', body: 'Diberitahukan kepada seluruh warga, iuran keamanan bulan Juli sebesar Rp25.000 per kepala keluarga.\n\nIuran dapat disetorkan langsung ke Bendahara RT atau melalui petugas jimpitan setiap Jumat. Terima kasih atas kerja samanya.' },
  { type: 'ANNOUNCEMENT', slug: 'jadwal-sampah-berubah', title: 'Perubahan Jadwal Pengambilan Sampah', excerpt: 'Mulai Juli, pengambilan sampah jadi Senin & Kamis.', body: 'Mulai bulan Juli, jadwal pengambilan sampah berubah menjadi setiap hari Senin dan Kamis pagi.\n\nMohon sampah sudah dikeluarkan sebelum pukul 06.00. Sampah dipisahkan antara organik dan anorganik.' },
  { type: 'ARTICLE', slug: 'sejarah-singkat-rt-05', title: 'Sejarah Singkat RT 05 Desa Makmur', excerpt: 'Mengenal kembali asal-usul lingkungan tempat kita tinggal.', body: 'RT 05 berdiri sejak tahun 1998, bermula dari beberapa keluarga perintis yang membangun pemukiman di area persawahan.\n\nKini RT 05 telah berkembang menjadi lingkungan yang guyub dengan lebih dari 120 warga. Semangat gotong royong tetap menjadi nilai utama yang kita jaga bersama.' },
  { type: 'ARTICLE', slug: 'tips-hemat-listrik', title: 'Tips Hemat Listrik untuk Warga', excerpt: 'Langkah sederhana menekan tagihan listrik rumah tangga.', body: 'Beberapa kebiasaan kecil bisa menghemat tagihan listrik:\n\n1. Cabut charger saat tidak digunakan.\n2. Gunakan lampu LED hemat energi.\n3. Matikan peralatan elektronik yang stand-by.\n4. Manfaatkan cahaya alami di siang hari.\n\nSelain hemat, kita juga ikut menjaga lingkungan.' },
  { type: 'GALLERY', slug: 'dokumentasi-hut-ri-80', title: 'Dokumentasi HUT RI ke-80', excerpt: 'Kumpulan momen lomba & malam tirakatan warga.', body: 'Perayaan HUT Kemerdekaan tahun ini berlangsung meriah. Mulai dari lomba anak-anak, tarik tambang bapak-bapak, hingga malam tirakatan bersama.\n\nTerima kasih untuk seluruh warga yang telah berpartisipasi dan panitia yang bekerja keras.' },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const rt = await prisma.rt.upsert({
    where: { code: RT_CODE },
    update: { name: RT_NAME, isActive: true, deletedAt: null },
    create: { code: RT_CODE, name: RT_NAME, timezone: 'Asia/Jakarta', isActive: true },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: ADMIN_HASH, status: 'ACTIVE', deletedAt: null },
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

  const areaByCode = {};
  for (const area of AREAS) {
    const created = await prisma.area.upsert({
      where: { rtId_code: { rtId: rt.id, code: area.code } },
      update: { name: area.name, sortOrder: area.sortOrder, isActive: true },
      create: { rtId: rt.id, code: area.code, name: area.name, sortOrder: area.sortOrder, isActive: true, createdById: admin.id, updatedById: admin.id },
    });
    areaByCode[area.code] = created.id;
  }

  const houseNumbers = [];
  for (const code of ['A', 'B', 'C']) {
    for (let i = 1; i <= 4; i += 1) {
      houseNumbers.push({ code, number: `${code}-${String(i).padStart(2, '0')}` });
    }
  }
  const houseIds = [];
  for (const house of houseNumbers) {
    const created = await prisma.house.upsert({
      where: { rtId_houseNumber: { rtId: rt.id, houseNumber: house.number } },
      update: { status: 'OCCUPIED' },
      create: { rtId: rt.id, areaId: areaByCode[house.code], houseNumber: house.number, status: 'OCCUPIED', createdById: admin.id, updatedById: admin.id },
    });
    houseIds.push(created.id);
  }

  const residentCount = await prisma.resident.count({ where: { rtId: rt.id } });
  if (residentCount === 0) {
    for (let i = 0; i < RESIDENT_NAMES.length; i += 1) {
      await prisma.resident.create({
        data: {
          rtId: rt.id,
          houseId: houseIds[i % houseIds.length],
          fullName: RESIDENT_NAMES[i],
          phone: `08123${String(450000 + i).padStart(6, '0')}`,
          status: 'ACTIVE',
          defaultJimpitanAmount: 2000,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }
  }

  const cashAccount = await prisma.cashAccount.upsert({
    where: { rtId_key: { rtId: rt.id, key: 'main' } },
    update: { isActive: true },
    create: { rtId: rt.id, key: 'main', name: 'Kas Utama', currency: 'IDR', createdById: admin.id, updatedById: admin.id },
  });
  const catJimpitan = await prisma.transactionCategory.findFirst({ where: { rtId: rt.id, key: 'jimpitan', type: 'INCOME' } });
  const catIncomeOther = await prisma.transactionCategory.findFirst({ where: { rtId: rt.id, key: 'income-other', type: 'INCOME' } });
  const catExpense = await prisma.transactionCategory.findFirst({ where: { rtId: rt.id, key: 'expense-operational', type: 'EXPENSE' } });

  const txCount = await prisma.transaction.count({ where: { rtId: rt.id } });
  if (txCount === 0 && catJimpitan && catIncomeOther && catExpense) {
    const entries = [
      { cat: catJimpitan.id, type: 'INCOME', amount: 500000, desc: 'Setoran jimpitan minggu ke-1', date: daysAgo(28) },
      { cat: catJimpitan.id, type: 'INCOME', amount: 750000, desc: 'Setoran jimpitan minggu ke-2', date: daysAgo(21) },
      { cat: catIncomeOther.id, type: 'INCOME', amount: 1000000, desc: 'Sumbangan warga untuk kas RT', date: daysAgo(14) },
      { cat: catExpense.id, type: 'EXPENSE', amount: 300000, desc: 'Pembelian perlengkapan kebersihan', date: daysAgo(7) },
    ];
    let balance = 0;
    let seq = 0;
    for (const entry of entries) {
      seq += 1;
      const before = balance;
      const after = entry.type === 'INCOME' ? before + entry.amount : before - entry.amount;
      balance = after;
      const tx = await prisma.transaction.create({
        data: {
          rtId: rt.id, cashAccountId: cashAccount.id, categoryId: entry.cat, type: entry.type, status: 'POSTED',
          amount: entry.amount, description: entry.desc, transactionDate: entry.date,
          createdById: admin.id, postedById: admin.id, postedAt: entry.date,
        },
      });
      await prisma.cashLedger.create({
        data: {
          rtId: rt.id, cashAccountId: cashAccount.id, transactionId: tx.id, ledgerSequence: seq,
          entryType: entry.type === 'INCOME' ? 'INCREASE' : 'DECREASE', amount: entry.amount,
          balanceBefore: before, balanceAfter: after, ledgerDate: entry.date,
        },
      });
    }
    await prisma.cashAccount.update({ where: { id: cashAccount.id }, data: { currentBalance: balance, version: { increment: 1 } } });
  }

  const annCount = await prisma.announcement.count({ where: { rtId: rt.id } });
  if (annCount === 0) {
    for (let i = 0; i < CONTENT.length; i += 1) {
      const c = CONTENT[i];
      await prisma.announcement.create({
        data: {
          rtId: rt.id, type: c.type, title: c.title, slug: c.slug, excerpt: c.excerpt, body: c.body,
          status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: daysAgo(i * 2 + 1),
          eventStartAt: c.event ? new Date(c.event) : null, location: c.location ?? null,
          reactionCount: Math.floor(Math.random() * 40) + 3, viewCount: Math.floor(Math.random() * 200) + 20,
          createdById: admin.id, updatedById: admin.id,
        },
      });
    }
  }

  const EXTRA_RTS = [
    { code: 'rt-mawar', name: 'RT 02 / RW 01 — Mawar', posts: [
      { type: 'ACTIVITY', slug: 'lomba-masak-mawar', title: 'Lomba Masak Antar Warga', location: 'Lapangan RT 02', event: '2026-07-05T09:00:00+07:00', excerpt: 'Adu kreasi masakan rumahan antar ibu-ibu PKK.', body: 'Yuk meriahkan lomba masak antar warga RT 02! Pendaftaran ke Bu Ketua PKK paling lambat 1 Juli. Hadiah menarik menanti.' },
      { type: 'ANNOUNCEMENT', slug: 'rapat-warga-mawar', title: 'Rapat Warga Bulanan', excerpt: 'Rapat rutin membahas program kerja RT.', body: 'Rapat warga bulan ini diadakan Sabtu malam pukul 19.30 di Balai RT 02. Mohon kehadiran perwakilan tiap rumah.' },
      { type: 'GALLERY', slug: 'kerja-bakti-mawar', title: 'Galeri Kerja Bakti Mei', excerpt: 'Dokumentasi gotong royong warga RT 02.', body: 'Kumpulan foto kegiatan kerja bakti membersihkan selokan dan menata taman lingkungan RT 02.' },
    ] },
    { code: 'rt-melati', name: 'RT 08 / RW 03 — Melati', posts: [
      { type: 'ACTIVITY', slug: 'pengajian-rutin-melati', title: 'Pengajian Rutin Malam Jumat', location: 'Musala Al-Ikhlas', event: '2026-07-03T19:30:00+07:00', excerpt: 'Pengajian dan tahlil bersama warga.', body: 'Pengajian rutin malam Jumat kembali digelar di Musala Al-Ikhlas. Terbuka untuk seluruh warga RT 08.' },
      { type: 'ARTICLE', slug: 'profil-rt-melati', title: 'Mengenal RT 08 Melati', excerpt: 'Sekilas tentang warga dan lingkungan RT 08.', body: 'RT 08 dikenal dengan lingkungannya yang asri dan warganya yang aktif dalam berbagai kegiatan sosial dan keagamaan.' },
      { type: 'ANNOUNCEMENT', slug: 'jadwal-ronda-melati', title: 'Jadwal Ronda Malam Juli', excerpt: 'Pembagian jadwal ronda untuk keamanan lingkungan.', body: 'Jadwal ronda malam bulan Juli telah ditempel di pos kamling. Mohon dicek dan ditaati demi keamanan bersama.' },
    ] },
  ];
  for (const extra of EXTRA_RTS) {
    const extraRt = await prisma.rt.upsert({
      where: { code: extra.code },
      update: { name: extra.name, isActive: true, deletedAt: null },
      create: { code: extra.code, name: extra.name, timezone: 'Asia/Jakarta', isActive: true },
    });
    if ((await prisma.announcement.count({ where: { rtId: extraRt.id } })) === 0) {
      for (let i = 0; i < extra.posts.length; i += 1) {
        const post = extra.posts[i];
        await prisma.announcement.create({
          data: {
            rtId: extraRt.id, type: post.type, title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body,
            status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: daysAgo(i + 1),
            eventStartAt: post.event ? new Date(post.event) : null, location: post.location ?? null,
            reactionCount: Math.floor(Math.random() * 30) + 2, viewCount: Math.floor(Math.random() * 150) + 10,
            createdById: admin.id, updatedById: admin.id,
          },
        });
      }
    }
  }

  const counts = {
    areas: await prisma.area.count({ where: { rtId: rt.id } }),
    houses: await prisma.house.count({ where: { rtId: rt.id } }),
    residents: await prisma.resident.count({ where: { rtId: rt.id } }),
    transactions: await prisma.transaction.count({ where: { rtId: rt.id } }),
    content: await prisma.announcement.count({ where: { rtId: rt.id } }),
    rolePermissions: await prisma.rolePermission.count({ where: { roleId: role.id } }),
    totalActiveRts: await prisma.rt.count({ where: { isActive: true } }),
  };
  console.log('SEED OK', JSON.stringify({ rt: rt.code, admin: ADMIN_EMAIL, ...counts }));
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('SEED FAILED:', error && error.message ? error.message : error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
