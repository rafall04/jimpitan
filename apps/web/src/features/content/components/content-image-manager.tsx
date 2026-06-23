/**
 * Purpose: Cover + gallery image manager for a content post.
 * Caller: Content edit page.
 * Deps: content image hooks + mutations, image src helper, ApiError, sonner, lucide icons.
 * MainFuncs: Uploads/replaces the cover, adds/removes gallery images, and previews them.
 * SideEffects: Performs image upload/delete mutations and shows toasts.
 */
'use client';

import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { contentImageSrc } from '../format';
import { useContentImagesQuery, useContentMutations } from '../hooks';
import type { ContentImageRef } from '../types';

export function ContentImageManager({ postId, canEdit }: { postId: string; canEdit: boolean }) {
  const imagesQuery = useContentImagesQuery(postId);
  const mutations = useContentMutations(postId);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const images = imagesQuery.data ?? [];
  const cover = images.find((image) => image.role === 'cover') ?? null;
  const gallery = images.filter((image) => image.role === 'gallery');
  const busy = mutations.uploadCover.isPending || mutations.uploadGalleryImage.isPending || mutations.removeImage.isPending;

  async function handleCover(file: File | undefined) {
    if (!file) return;
    try {
      await mutations.uploadCover.mutateAsync({ id: postId, file });
    } catch (error) {
      toast.error(messageFromError(error));
    }
  }

  async function handleGallery(file: File | undefined) {
    if (!file) return;
    try {
      await mutations.uploadGalleryImage.mutateAsync({ id: postId, file });
    } catch (error) {
      toast.error(messageFromError(error));
    }
  }

  async function handleRemove(image: ContentImageRef) {
    try {
      await mutations.removeImage.mutateAsync({ id: postId, attachmentId: image.id });
    } catch (error) {
      toast.error(messageFromError(error));
    }
  }

  return (
    <section className="space-y-5 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Foto</h2>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Foto sampul</p>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={contentImageSrc(cover.url)} alt="Foto sampul" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Belum ada</span>
            )}
          </div>
          {canEdit ? (
            <div>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void handleCover(file); }} />
              <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={busy}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {cover ? 'Ganti sampul' : 'Unggah sampul'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Galeri ({gallery.length})</p>
          {canEdit ? (
            <div>
              <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void handleGallery(file); }} />
              <Button type="button" variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()} disabled={busy}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                Tambah foto
              </Button>
            </div>
          ) : null}
        </div>
        {gallery.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada foto galeri.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gallery.map((image) => (
              <li key={image.id} className="group relative overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contentImageSrc(image.url)} alt={image.fileName} className="aspect-square w-full object-cover" />
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void handleRemove(image)}
                    disabled={busy}
                    className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-destructive opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Hapus ${image.fileName}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function messageFromError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Operasi gambar gagal.';
}
