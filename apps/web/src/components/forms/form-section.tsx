/**
 * Purpose: Reusable form section layout foundation.
 * Caller: Future React Hook Form feature forms.
 * Deps: ReactNode.
 * MainFuncs: Groups form controls with accessible heading and optional description.
 * SideEffects: None.
 */
import type { ReactNode } from 'react';

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-labelledby={sectionId(title)}>
      <div>
        <h2 id={sectionId(title)} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
