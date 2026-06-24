/*
 * Purpose: Import the REAL RT 15 Dander cash book (Buku Kas) from the published PDF ledgers into finance.
 * Caller: docker exec -i jimpitan-api-1 node < scripts/seed-dander-kas.cjs  (or node scripts/seed-dander-kas.cjs).
 * Deps: @prisma/client, DATABASE_URL from the container env.
 * MainFuncs: Ensures the Kas Utama account + categories, then re-seeds every transaction (opening balance + the
 *   2025 monthly recap + the Jan–Apr 2026 daily ledgers) as POSTED transactions with an append-only cash ledger.
 * SideEffects: Replaces the Dander RT's transactions + cash ledger with the imported set; asserts the final balance.
 *   Idempotent: clears the RT's existing transactions/ledger first, then rebuilds (Dander has no other finance data).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RT_CODE = 'rt15-dander';
const ADMIN_EMAIL = 'admin@jimpitan.local';
const EXPECTED_FINAL = 1752000;

// Category catalogue: key -> { type, name }
const CATS = {
  'saldo-awal': { type: 'INCOME', name: 'Saldo Awal' },
  iuran: { type: 'INCOME', name: 'Iuran, Sewa Lapak & PKL' },
  surat: { type: 'INCOME', name: 'Layanan Surat Pengantar' },
  sumbangan: { type: 'INCOME', name: 'Sumbangan & Bantuan' },
  operasional: { type: 'EXPENSE', name: 'Operasional & Perlengkapan' },
  konsumsi: { type: 'EXPENSE', name: 'Konsumsi & Rapat' },
  kegiatan: { type: 'EXPENSE', name: 'Kegiatan & Kerja Bakti' },
};

// [date, description, IN|OUT, amount, categoryKey] — transcribed from the published Buku Kas PDFs (reconciled).
const TX = [
  ['2025-05-31', 'Saldo awal kas RT — akumulasi s.d. Mei 2025', 'IN', 281000, 'saldo-awal'],
  // Rekap Juni–Desember 2025 (ringkasan bulanan per pos)
  ['2025-06-30', 'Pendapatan PKL — rekap Juni 2025', 'IN', 190000, 'iuran'],
  ['2025-06-30', 'Iuran Kas Warga RT — rekap Juni 2025', 'IN', 245000, 'iuran'],
  ['2025-06-30', 'Surat pengantar warga — rekap Juni 2025', 'IN', 10000, 'surat'],
  ['2025-06-30', 'Pengeluaran operasional — rekap Juni 2025', 'OUT', 45000, 'operasional'],
  ['2025-07-31', 'Pendapatan PKL — rekap Juli 2025', 'IN', 140000, 'iuran'],
  ['2025-07-31', 'Iuran Kas Warga RT — rekap Juli 2025', 'IN', 180000, 'iuran'],
  ['2025-07-31', 'Surat pengantar warga — rekap Juli 2025', 'IN', 32000, 'surat'],
  ['2025-07-31', 'Pengeluaran operasional — rekap Juli 2025', 'OUT', 490000, 'operasional'],
  ['2025-08-31', 'Pendapatan PKL — rekap Agustus 2025', 'IN', 60000, 'iuran'],
  ['2025-08-31', 'Iuran Kas Warga RT — rekap Agustus 2025', 'IN', 250000, 'iuran'],
  ['2025-08-31', 'Surat pengantar warga — rekap Agustus 2025', 'IN', 5000, 'surat'],
  ['2025-08-31', 'Pengeluaran operasional — rekap Agustus 2025', 'OUT', 45000, 'operasional'],
  ['2025-09-30', 'Pendapatan PKL — rekap September 2025', 'IN', 45000, 'iuran'],
  ['2025-09-30', 'Iuran Kas Warga RT — rekap September 2025', 'IN', 170000, 'iuran'],
  ['2025-09-30', 'Surat pengantar warga — rekap September 2025', 'IN', 25000, 'surat'],
  ['2025-09-30', 'Pengeluaran operasional — rekap September 2025', 'OUT', 45000, 'operasional'],
  ['2025-10-31', 'Pendapatan PKL — rekap Oktober 2025', 'IN', 240000, 'iuran'],
  ['2025-10-31', 'Surat pengantar warga — rekap Oktober 2025', 'IN', 20000, 'surat'],
  ['2025-10-31', 'Pengeluaran operasional — rekap Oktober 2025', 'OUT', 1017000, 'operasional'],
  ['2025-11-30', 'Pendapatan PKL — rekap November 2025', 'IN', 210000, 'iuran'],
  ['2025-11-30', 'Surat pengantar warga — rekap November 2025', 'IN', 60000, 'surat'],
  ['2025-12-31', 'Pendapatan PKL — rekap Desember 2025', 'IN', 870000, 'iuran'],
  ['2025-12-31', 'Iuran Kas Warga RT — rekap Desember 2025', 'IN', 640000, 'iuran'],
  ['2025-12-31', 'Surat pengantar warga — rekap Desember 2025', 'IN', 60000, 'surat'],
  ['2025-12-31', 'Pengeluaran operasional — rekap Desember 2025', 'OUT', 420000, 'operasional'],
  // Buku Kas Januari 2026
  ['2026-01-01', 'Pendapatan sewa Lapak', 'IN', 450000, 'iuran'],
  ['2026-01-07', 'Iuran PKL', 'IN', 190000, 'iuran'],
  ['2026-01-08', 'Konsumsi Rapat warga RT', 'OUT', 50000, 'konsumsi'],
  ['2026-01-08', 'Iuran Warga RT. 015', 'IN', 70000, 'iuran'],
  ['2026-01-11', 'Sumbangan Kerja bakti Yonif TP 885 dari warga dan PKL', 'IN', 250000, 'sumbangan'],
  ['2026-01-11', 'Membeli Rokok, Lampu, Busi (mesin pemotong rumput)', 'OUT', 225000, 'operasional'],
  ['2026-01-14', 'Pemasangan Gorong-gorong Gg. Mulyorejo', 'OUT', 125000, 'kegiatan'],
  ['2026-01-14', 'Surat pengantar a.n. Indah Mustika Sari', 'IN', 20000, 'surat'],
  ['2026-01-20', 'Surat pengantar KK a.n. Nyamad', 'IN', 5000, 'surat'],
  ['2026-01-26', 'Membeli Maps Snelhecter plastik + Fotokopi', 'OUT', 25000, 'operasional'],
  ['2026-01-30', 'Surat pengantar SKTM a.n. Elsa Meilani', 'IN', 10000, 'surat'],
  ['2026-01-31', 'Membeli kabel CCTV', 'OUT', 40000, 'operasional'],
  // Buku Kas Februari 2026
  ['2026-02-01', 'Pendapatan sewa Lapak', 'IN', 450000, 'iuran'],
  ['2026-02-01', 'Iuran PKL', 'IN', 180000, 'iuran'],
  ['2026-02-06', 'Membeli lampu Philip 8 biji', 'OUT', 260000, 'operasional'],
  ['2026-02-07', 'Konsumsi Rapat warga RT', 'OUT', 70000, 'konsumsi'],
  ['2026-02-07', 'Iuran Warga RT. 015', 'IN', 190000, 'iuran'],
  ['2026-02-07', 'Membeli kabel dan Fiting lampu', 'OUT', 150000, 'operasional'],
  ['2026-02-10', 'Dana kebersihan tower dari Indosat', 'IN', 500000, 'sumbangan'],
  ['2026-02-13', 'Kerja bakti kebersihan makam Nolojoyo', 'OUT', 100000, 'kegiatan'],
  ['2026-02-15', 'Surat pengantar a.n. Septiani', 'IN', 5000, 'surat'],
  ['2026-02-16', 'Cetak Stiker RT. 15', 'OUT', 120000, 'operasional'],
  ['2026-02-17', 'Cetak Banner Ramadhan 2 buah', 'OUT', 64000, 'operasional'],
  ['2026-02-23', 'Surat pengantar KK a.n. Agus Joko', 'IN', 10000, 'surat'],
  ['2026-02-27', 'Kerja bakti di Lapangan Dander', 'OUT', 350000, 'kegiatan'],
  // Buku Kas Maret 2026
  ['2026-03-01', 'Pendapatan sewa Lapak', 'IN', 450000, 'iuran'],
  ['2026-03-01', 'Iuran PKL', 'IN', 10000, 'iuran'],
  ['2026-03-11', 'Surat pengantar keterangan usaha a.n. Handoko', 'IN', 10000, 'surat'],
  ['2026-03-15', '1 buah Lampu', 'OUT', 75000, 'operasional'],
  ['2026-03-15', 'Konsumsi bersih-bersih bambu', 'OUT', 100000, 'konsumsi'],
  ['2026-03-16', 'CCTV + Memory', 'OUT', 350000, 'operasional'],
  // Buku Kas April 2026
  ['2026-04-01', 'Pendapatan sewa Lapak', 'IN', 450000, 'iuran'],
  ['2026-04-01', 'Iuran PKL', 'IN', 265000, 'iuran'],
  ['2026-04-01', 'Surat pengantar SKCK a.n. Fandi Ahmad', 'IN', 5000, 'surat'],
  ['2026-04-01', 'Surat pengantar SKCK a.n. Adenaldo', 'IN', 5000, 'surat'],
  ['2026-04-03', 'CCTV + Memory', 'OUT', 350000, 'operasional'],
  ['2026-04-04', 'Iuran warga', 'IN', 200000, 'iuran'],
  ['2026-04-04', 'Konsumsi Halalbihalal RT. 15', 'OUT', 1200000, 'konsumsi'],
  ['2026-04-19', 'Surat pengantar KTP a.n. Nyaini', 'IN', 5000, 'surat'],
  ['2026-04-20', 'Surat pengantar Nikah a.n. Iin Yuliana', 'IN', 5000, 'surat'],
];

function atNoon(dateStr) {
  return new Date(`${dateStr}T12:00:00+07:00`);
}

async function main() {
  const rt = await prisma.rt.findUnique({ where: { code: RT_CODE } });
  if (!rt) throw new Error(`RT ${RT_CODE} not found — run seed-dander.cjs first.`);
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error('Admin user not found.');

  const account = await prisma.cashAccount.upsert({
    where: { rtId_key: { rtId: rt.id, key: 'main' } },
    update: { name: 'Kas Utama', isActive: true, deletedAt: null },
    create: { rtId: rt.id, key: 'main', name: 'Kas Utama', currency: 'IDR', createdById: admin.id, updatedById: admin.id },
  });

  const catId = {};
  for (const [key, def] of Object.entries(CATS)) {
    const c = await prisma.transactionCategory.upsert({
      where: { rtId_key_type: { rtId: rt.id, key, type: def.type } },
      update: { name: def.name, isActive: true, deletedAt: null },
      create: { rtId: rt.id, type: def.type, key, name: def.name, isActive: true, createdById: admin.id, updatedById: admin.id },
    });
    catId[key] = c.id;
  }

  // Clean re-seed of this RT's finance (Dander has no other transactions/ledger).
  await prisma.cashLedger.deleteMany({ where: { rtId: rt.id } });
  await prisma.transaction.deleteMany({ where: { rtId: rt.id } });

  let balance = 0;
  let seq = 0;
  for (const [dateStr, desc, dir, amount, cat] of TX) {
    const when = atNoon(dateStr);
    const isIn = dir === 'IN';
    const type = isIn ? 'INCOME' : 'EXPENSE';
    const before = balance;
    const after = isIn ? before + amount : before - amount;
    balance = after;
    seq += 1;
    const tx = await prisma.transaction.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, categoryId: catId[cat], type, status: 'POSTED',
        amount, description: desc, transactionDate: when,
        createdById: admin.id, postedById: admin.id, postedAt: when,
      },
    });
    await prisma.cashLedger.create({
      data: {
        rtId: rt.id, cashAccountId: account.id, transactionId: tx.id, ledgerSequence: seq,
        entryType: isIn ? 'INCREASE' : 'DECREASE', amount,
        balanceBefore: before, balanceAfter: after, ledgerDate: when,
      },
    });
  }

  await prisma.cashAccount.update({ where: { id: account.id }, data: { currentBalance: balance, version: { increment: 1 } } });

  const income = TX.filter((t) => t[2] === 'IN').reduce((s, t) => s + t[3], 0);
  const expense = TX.filter((t) => t[2] === 'OUT').reduce((s, t) => s + t[3], 0);
  const ok = balance === EXPECTED_FINAL;
  console.log(`${ok ? 'KAS DANDER OK' : 'KAS DANDER BALANCE MISMATCH'}`, JSON.stringify({
    rt: rt.code, transactions: TX.length, totalMasuk: income, totalKeluar: expense,
    saldoAkhir: balance, expected: EXPECTED_FINAL, reconciled: ok,
  }));
  if (!ok) throw new Error(`Balance ${balance} != expected ${EXPECTED_FINAL}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('KAS DANDER FAILED:', error && error.stack ? error.stack : error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
