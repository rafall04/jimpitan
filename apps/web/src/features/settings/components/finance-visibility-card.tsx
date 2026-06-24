/**
 * Purpose: Configure per-RT public kas (finance) visibility — public or token-only — with token + shareable link.
 * Caller: Settings page.
 * Deps: settings hooks, tenant context, UI Card/Button/Select, lucide icons, sonner.
 * MainFuncs: Switches PUBLIC/TOKEN mode, shows/copies the access token + public link, and regenerates the token.
 * SideEffects: Performs settings mutations and clipboard writes.
 */
'use client';

import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { useFinanceVisibilityMutations, useFinanceVisibilityQuery } from '../hooks';
import type { FinanceVisibilityMode } from '../types';

export function FinanceVisibilityCard() {
  const { activeTenant } = useTenantContext();
  const query = useFinanceVisibilityQuery();
  const mutations = useFinanceVisibilityMutations();
  const [draftMode, setDraftMode] = useState<FinanceVisibilityMode | null>(null);

  const current = query.data;
  const mode = draftMode ?? current?.mode ?? 'PUBLIC';
  const rtCode = activeTenant?.rtCode ?? '';
  const publicLink =
    typeof window !== 'undefined' && rtCode
      ? `${window.location.origin}/?rt=${encodeURIComponent(rtCode)}${current?.token ? `&token=${encodeURIComponent(current.token)}` : ''}`
      : '';

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success(`${label} disalin`)).catch(() => toast.error('Gagal menyalin'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          Visibilitas kas
        </CardTitle>
        <CardDescription>Atur siapa yang boleh melihat laporan kas RT di situs publik — sesuai kesepakatan warga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}
        {current ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="kas-mode">Mode</label>
              <Select id="kas-mode" value={mode} onChange={(event) => setDraftMode(event.target.value as FinanceVisibilityMode)}>
                <option value="PUBLIC">Publik — semua orang bisa melihat kas</option>
                <option value="TOKEN">Token — hanya yang punya tautan/token</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                {mode === 'PUBLIC' ? 'Saldo & laporan kas tampil terbuka di situs publik.' : 'Kas disembunyikan dari publik; hanya terbuka lewat tautan ber-token.'}
              </p>
            </div>

            {draftMode && draftMode !== current.mode ? (
              <div className="flex gap-2">
                <Button type="button" disabled={mutations.setMode.isPending} onClick={() => mutations.setMode.mutate(draftMode, { onSuccess: () => setDraftMode(null) })}>
                  {mutations.setMode.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDraftMode(null)}>Batal</Button>
              </div>
            ) : null}

            {current.mode === 'TOKEN' && current.token ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Token akses</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-sm">{current.token}</code>
                    <Button type="button" variant="outline" size="icon" aria-label="Salin token" onClick={() => copy(current.token ?? '', 'Token')}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Tautan kas (bagikan ke warga)</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{publicLink}</code>
                    <Button type="button" variant="outline" size="icon" aria-label="Salin tautan" onClick={() => copy(publicLink, 'Tautan')}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={mutations.regenerate.isPending} onClick={() => mutations.regenerate.mutate()}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {mutations.regenerate.isPending ? 'Membuat…' : 'Buat token baru'}
                </Button>
                <p className="text-xs text-muted-foreground">Membuat token baru akan menonaktifkan tautan lama.</p>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
