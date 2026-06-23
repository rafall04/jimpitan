/**
 * Purpose: Unit tests for public content URL/type mapping.
 * Caller: Vitest web suite.
 * Deps: public content api maps.
 * MainFuncs: Verifies path-to-type resolution and labels for every known category.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { PUBLIC_CONTENT_TYPES, contentTypeFromPath, publicContentTypeLabel } from './api';

describe('contentTypeFromPath', () => {
  it('maps Indonesian category paths to content types', () => {
    expect(contentTypeFromPath('kegiatan')).toBe('ACTIVITY');
    expect(contentTypeFromPath('pengumuman')).toBe('ANNOUNCEMENT');
    expect(contentTypeFromPath('artikel')).toBe('ARTICLE');
    expect(contentTypeFromPath('galeri')).toBe('GALLERY');
  });

  it('returns null for an unknown path', () => {
    expect(contentTypeFromPath('tidak-ada')).toBeNull();
  });

  it('provides a label for every known category', () => {
    for (const entry of PUBLIC_CONTENT_TYPES) {
      expect(publicContentTypeLabel(entry.path)).toBe(entry.label);
    }
  });
});
