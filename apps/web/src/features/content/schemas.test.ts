/**
 * Purpose: Unit tests for content form schema + payload mappers.
 * Caller: Vitest web suite.
 * Deps: content schema module.
 * MainFuncs: Verifies publish flag, activity-only event fields, nullable clearing, and event-range validation.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { contentFormSchema, toCreateContentPayload, toUpdateContentPayload, type ContentFormValues } from './schemas';

const base: ContentFormValues = {
  type: 'ANNOUNCEMENT',
  title: 'Kerja Bakti',
  body: 'Ayo ikut kerja bakti',
  excerpt: '',
  visibility: 'PUBLIC',
  eventStartAt: '',
  eventEndAt: '',
  location: '',
};

describe('toCreateContentPayload', () => {
  it('passes the publish flag and omits an empty excerpt', () => {
    const payload = toCreateContentPayload(base, true);
    expect(payload.publish).toBe(true);
    expect(payload.excerpt).toBeUndefined();
  });

  it('includes event fields only for ACTIVITY', () => {
    const activity = toCreateContentPayload({ ...base, type: 'ACTIVITY', eventStartAt: '2026-06-10T09:00', location: 'Balai RT' }, false);
    expect(activity.eventStartAt).toBeTruthy();
    expect(activity.location).toBe('Balai RT');

    const article = toCreateContentPayload({ ...base, type: 'ARTICLE', eventStartAt: '2026-06-10T09:00', location: 'Balai RT' }, false);
    expect(article.eventStartAt).toBeUndefined();
    expect(article.location).toBeUndefined();
  });
});

describe('toUpdateContentPayload', () => {
  it('clears nullable fields and nulls event fields for non-activity', () => {
    const payload = toUpdateContentPayload(base);
    expect(payload.excerpt).toBeNull();
    expect(payload.eventStartAt).toBeNull();
    expect(payload.location).toBeNull();
  });
});

describe('contentFormSchema', () => {
  it('accepts a valid announcement', () => {
    expect(contentFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an event that ends before it starts', () => {
    const result = contentFormSchema.safeParse({ ...base, type: 'ACTIVITY', eventStartAt: '2026-06-10T10:00', eventEndAt: '2026-06-10T09:00' });
    expect(result.success).toBe(false);
  });
});
