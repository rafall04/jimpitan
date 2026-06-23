/**
 * Purpose: Create-content page (form only; images are added after the draft exists).
 * Caller: App Router /dashboard/content/new route.
 * Deps: content form + hooks + payload mapper, Next navigation, toast.
 * MainFuncs: Submits a new post (draft or published) and routes to its editor.
 * SideEffects: Performs a content create mutation.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { ContentForm } from '../components/content-form';
import { useContentMutations } from '../hooks';
import { toCreateContentPayload, type ContentFormValues } from '../schemas';

export function ContentCreatePage() {
  const router = useRouter();
  const mutations = useContentMutations();

  async function handleSubmit(values: ContentFormValues, options: { publish: boolean }) {
    try {
      const created = await mutations.create.mutateAsync(toCreateContentPayload(values, options.publish));
      router.push(`/dashboard/content/${created.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Gagal menyimpan konten.');
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/dashboard/content"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Kembali</Link>
        </Button>
        <h1 className="text-xl font-semibold">Buat konten</h1>
        <p className="text-sm text-muted-foreground">Simpan sebagai draf dulu, lalu tambahkan foto sebelum menerbitkan.</p>
      </div>
      <div className="rounded-lg border bg-card p-5">
        <ContentForm mode="create" isPending={mutations.create.isPending} onSubmit={handleSubmit} onCancel={() => router.push('/dashboard/content')} />
      </div>
    </main>
  );
}
