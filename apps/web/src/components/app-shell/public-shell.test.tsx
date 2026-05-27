/**
 * Purpose: Render smoke tests for the unauthenticated public shell.
 * Caller: Vitest test runner.
 * Deps: React DOM server and PublicShell.
 * MainFuncs: Verifies mobile-visible public navigation and Indonesian shell copy.
 * SideEffects: None.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicShell } from './public-shell';

describe('PublicShell', () => {
  it('keeps public report navigation available on mobile without hidden links', () => {
    const html = renderToStaticMarkup(
      <PublicShell>
        <main id="main-content">Konten</main>
      </PublicShell>,
    );

    expect(html).toContain('Laporan');
    expect(html).toContain('Bulanan');
    expect(html).toContain('Pengumuman');
    expect(html).not.toContain('hidden sm:inline-flex');
  });
});
