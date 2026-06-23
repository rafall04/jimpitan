/**
 * Purpose: Unit tests for content slug generation.
 * Caller: Vitest API suite.
 * Deps: slug util.
 * MainFuncs: Verifies normalization, diacritic stripping, fallback, and tenant-unique suffixing.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { ensureUniqueSlug, slugify } from './slug.util';

describe('slugify', () => {
  it('normalizes a title into an ascii slug', () => {
    expect(slugify('Kerja Bakti RT 05!')).toBe('kerja-bakti-rt-05');
  });

  it('strips diacritics and collapses separators', () => {
    expect(slugify('  Hálo   Dúnia  ')).toBe('halo-dunia');
  });

  it('falls back to a default when nothing remains', () => {
    expect(slugify('!!!')).toBe('postingan');
  });
});

describe('ensureUniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    const slug = await ensureUniqueSlug('Rapat Warga', async () => false);
    expect(slug).toBe('rapat-warga');
  });

  it('appends the next free numeric suffix when taken', async () => {
    const taken = new Set(['rapat-warga', 'rapat-warga-2']);
    const slug = await ensureUniqueSlug('Rapat Warga', async (candidate) => taken.has(candidate));
    expect(slug).toBe('rapat-warga-3');
  });
});
