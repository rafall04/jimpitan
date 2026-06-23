/**
 * Purpose: Pure validation for uploaded images (mime allowlist, magic-byte sniff, size cap).
 * Caller: AttachmentsService before persisting an uploaded image.
 * Deps: None (operates on a Buffer).
 * MainFuncs: Confirms an uploaded buffer is a real, allowed, size-bounded image and resolves its canonical mime/extension.
 * SideEffects: None.
 */
export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageValidationInput {
  buffer: Buffer;
  declaredMimeType: string;
  maxBytes: number;
}

export interface ImageValidationResult {
  mimeType: AllowedImageMime;
  extension: 'jpg' | 'png' | 'webp';
}

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

type Signature = {
  mime: AllowedImageMime;
  ext: 'jpg' | 'png' | 'webp';
  test: (buffer: Buffer) => boolean;
};

const SIGNATURES: Signature[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

export function validateImageUpload(input: ImageValidationInput): ImageValidationResult {
  const { buffer, declaredMimeType, maxBytes } = input;
  if (!buffer || buffer.length === 0) {
    throw new InvalidImageError('Berkas yang diunggah kosong.');
  }
  if (buffer.length > maxBytes) {
    throw new InvalidImageError(`Ukuran gambar melebihi batas ${maxBytes} byte.`);
  }
  const match = SIGNATURES.find((signature) => signature.test(buffer));
  if (!match) {
    throw new InvalidImageError('Berkas bukan gambar yang didukung (JPEG, PNG, atau WEBP).');
  }
  const declared = declaredMimeType?.toLowerCase().trim();
  // Reject a declared content type that contradicts the sniffed signature (defense in depth).
  const declaredMatchesJpeg = match.mime === 'image/jpeg' && declared === 'image/jpg';
  if (declared && declared !== match.mime && !declaredMatchesJpeg) {
    throw new InvalidImageError('Tipe konten yang dideklarasikan tidak cocok dengan isi gambar.');
  }
  return { mimeType: match.mime, extension: match.ext };
}
