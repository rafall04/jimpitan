/**
 * Purpose: Setup-progress card guiding a new RT to fill in its core data.
 * Caller: OverviewPage (dashboard home).
 * Deps: UI Card, tenant context, structure/finance/content list query hooks, lucide icons, next/link.
 * MainFuncs: Computes permitted setup steps + completion, shows progress, and supports dismissal.
 * SideEffects: Reads/writes localStorage dismissal flag; performs tenant-scoped API reads via query hooks.
 */
'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { useFinanceSummaryQuery } from '@/features/finance/hooks';
import { useAreasQuery, useHousesQuery, useResidentsQuery } from '@/features/structure/hooks';
import { useContentListQuery } from '@/features/content/hooks';
import { cn } from '@/lib/utils/cn';

const DISMISS_KEY = 'rtku:onboarding-dismissed';

type Step = {
  permission: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

export function OnboardingChecklist() {
  const { permissions } = useTenantContext();
  const can = (key: string) => permissions.has(key);

  const areas = useAreasQuery({ limit: 1 });
  const houses = useHousesQuery({ limit: 1 });
  const residents = useResidentsQuery({ limit: 1 });
  const summary = useFinanceSummaryQuery();
  const content = useContentListQuery({ limit: 1 });

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const cashMovement = summary.data ? Number(summary.data.totals.income) + Number(summary.data.totals.expense) : 0;

  const allSteps: Step[] = [
    {
      permission: 'areas.read',
      label: 'Tambah area/blok',
      hint: 'Bagi wilayah RT jadi area atau blok.',
      href: '/dashboard/areas',
      done: (areas.data?.total ?? 0) > 0,
    },
    {
      permission: 'houses.read',
      label: 'Daftarkan rumah',
      hint: 'Catat rumah pada tiap area.',
      href: '/dashboard/houses',
      done: (houses.data?.total ?? 0) > 0,
    },
    {
      permission: 'residents.read',
      label: 'Tambah warga',
      hint: 'Daftarkan warga penghuni rumah.',
      href: '/dashboard/residents',
      done: (residents.data?.total ?? 0) > 0,
    },
    {
      permission: 'transactions.read',
      label: 'Catat transaksi kas pertama',
      hint: 'Mulai pembukuan kas RT.',
      href: '/dashboard/finance/transactions',
      done: cashMovement > 0,
    },
    {
      permission: 'content.read',
      label: 'Terbitkan konten',
      hint: 'Bagikan pengumuman atau kegiatan.',
      href: '/dashboard/content',
      done: (content.data?.total ?? 0) > 0,
    },
  ];

  const steps = allSteps.filter((step) => can(step.permission));
  const completed = steps.filter((step) => step.done).length;

  if (dismissed || steps.length === 0 || completed === steps.length) {
    return null;
  }

  const percent = Math.round((completed / steps.length) * 100);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setDismissed(true);
  };

  return (
    <Card className="relative overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Sembunyikan daftar persiapan"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <CardHeader className="pb-3">
        <CardTitle>Lengkapi data RT</CardTitle>
        <p className="text-sm text-muted-foreground">Beberapa langkah singkat agar RTku siap dipakai.</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {completed} dari {steps.length} langkah selesai
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {steps.map((step) => (
          <Link
            key={step.permission}
            href={step.href}
            className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
          >
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className={cn('block text-sm font-medium', step.done && 'text-muted-foreground line-through')}>{step.label}</span>
              <span className="block text-xs text-muted-foreground">{step.hint}</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
