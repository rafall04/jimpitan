/**
 * Purpose: Responsive collection session card/list item for operational navigation.
 * Caller: Jimpitan dashboard and sessions page.
 * Deps: Next Link, Jimpitan status/progress widgets, and workflow helpers.
 * MainFuncs: Displays session route, mode, officer, totals, status, progress, and quick mobile link.
 * SideEffects: None.
 */
import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollectionStatusBadge } from './status-badge';
import { ProgressBar } from './progress';
import { formatCollectionMode } from '../workflow';
import type { CollectionSessionRecord } from '../types';

export function SessionCard({ collection, progressPercent }: { collection: CollectionSessionRecord; progressPercent?: number }) {
  const route = collection.route.areaCode ? `${collection.route.areaCode} - ${collection.route.areaName}` : 'All areas';
  const isBulk = collection.collectionMode === 'BULK_TOTAL';
  const percent = isBulk ? (Number(collection.totalAmount) > 0 ? 100 : 0) : progressPercent ?? Math.min(100, collection.itemCount * 10);

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/dashboard/jimpitan/sessions/${collection.id}`} className="text-base font-semibold hover:underline">
            {route}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(collection.collectionDate).toLocaleDateString()} - {collection.officer.fullName}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{formatCollectionMode(collection.collectionMode)}</p>
        </div>
        <CollectionStatusBadge status={collection.status} />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{isBulk ? 'Session total' : `${collection.itemCount} houses entered`}</span>
          <span>{percent}%</span>
        </div>
        <ProgressBar completed={percent} total={100} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Rp{Number(collection.totalAmount).toLocaleString('id-ID')}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/jimpitan/mobile/${collection.id}`}>
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Mobile
          </Link>
        </Button>
      </div>
    </article>
  );
}
