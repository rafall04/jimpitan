/**
 * Purpose: Dashboard breadcrumb trail derived from the current path.
 * Caller: Topbar.
 * Deps: Next navigation + Link, lucide ChevronRight.
 * MainFuncs: Maps path segments to Indonesian labels with clickable ancestor links.
 * SideEffects: None.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  residents: 'Warga',
  houses: 'Rumah',
  areas: 'Area',
  jimpitan: 'Jimpitan',
  finance: 'Keuangan',
  accounts: 'Akun Kas',
  categories: 'Kategori',
  transactions: 'Transaksi',
  ledger: 'Buku Kas',
  approvals: 'Persetujuan',
  content: 'Konten',
  reports: 'Laporan',
  settings: 'Pengaturan',
  sessions: 'Sesi',
  mobile: 'Lapangan',
  new: 'Baru',
};

const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-|^\d+$/i;

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (ID_LIKE.test(segment)) return 'Detail';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return null;
  }
  const crumbs = segments.map((segment, index) => ({
    label: labelFor(segment),
    href: `/${segments.slice(0, index + 1).join('/')}`,
    last: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          {crumb.last ? (
            <span className="truncate font-semibold">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
