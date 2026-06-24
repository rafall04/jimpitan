/**
 * Purpose: Tenant settings page — RT profile + public kas visibility.
 * Caller: App Router /dashboard/settings route.
 * Deps: tenant context, finance visibility card, UI Card.
 * MainFuncs: Shows the active RT profile and the kas visibility control.
 * SideEffects: None directly (child card performs mutations).
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { FinanceVisibilityCard } from '../components/finance-visibility-card';

export function SettingsPage() {
  const { activeTenant } = useTenantContext();

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur tampilan publik RT dan akses kas sesuai kesepakatan warga.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profil RT</CardTitle>
          <CardDescription>Informasi RT yang sedang aktif.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex items-center justify-between border-b py-2">
            <span className="text-muted-foreground">Nama</span>
            <span className="font-medium">{activeTenant?.rtName ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Kode</span>
            <span className="font-medium">{activeTenant?.rtCode ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      <FinanceVisibilityCard />
    </main>
  );
}
