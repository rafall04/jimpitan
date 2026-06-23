/**
 * Purpose: Unit tests for uploaded-image validation.
 * Caller: Vitest API suite.
 * Deps: image-validation domain.
 * MainFuncs: Verifies magic-byte acceptance, size cap, and declared-type contradiction handling.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { InvalidImageError, validateImageUpload } from './image-validation';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([0x00])]);

describe('validateImageUpload', () => {
  it('accepts a JPEG buffer', () => {
    expect(validateImageUpload({ buffer: JPEG, declaredMimeType: 'image/jpeg', maxBytes: 1000 })).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' });
  });

  it('accepts PNG and WEBP buffers', () => {
    expect(validateImageUpload({ buffer: PNG, declaredMimeType: 'image/png', maxBytes: 1000 }).extension).toBe('png');
    expect(validateImageUpload({ buffer: WEBP, declaredMimeType: 'image/webp', maxBytes: 1000 }).extension).toBe('webp');
  });

  it('tolerates the image/jpg alias for JPEG', () => {
    expect(validateImageUpload({ buffer: JPEG, declaredMimeType: 'image/jpg', maxBytes: 1000 }).mimeType).toBe('image/jpeg');
  });

  it('rejects non-image content', () => {
    expect(() => validateImageUpload({ buffer: Buffer.from('hello world'), declaredMimeType: 'text/plain', maxBytes: 1000 })).toThrow(InvalidImageError);
  });

  it('rejects uploads that exceed the size cap', () => {
    expect(() => validateImageUpload({ buffer: JPEG, declaredMimeType: 'image/jpeg', maxBytes: 2 })).toThrow(InvalidImageError);
  });

  it('rejects a declared type that contradicts the signature', () => {
    expect(() => validateImageUpload({ buffer: PNG, declaredMimeType: 'image/jpeg', maxBytes: 1000 })).toThrow(InvalidImageError);
  });
});
