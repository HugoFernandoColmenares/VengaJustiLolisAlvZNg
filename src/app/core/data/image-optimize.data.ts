/**
 * Preset de optimización en el navegador (adaptado de FeithNoir/feith-blog).
 * El archivo se reescala para caber en 1920×1080, sin agrandar, y se reencoda a WebP.
 */

export interface ImageOptimizePreset {
  maxWidth: number;
  maxHeight: number;
  /** 0 a 1. Se pasa tal cual a `canvas.toBlob`. */
  quality: number;
  mimeType: 'image/webp';
  extension: 'webp';
}

export const IMAGE_OPTIMIZE_PRESETS = {
  /** Portada de post o categoría, y foto de nominado. */
  default: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.82,
    mimeType: 'image/webp',
    extension: 'webp',
  },
} as const satisfies Record<string, ImageOptimizePreset>;

export type ImageOptimizePresetId = keyof typeof IMAGE_OPTIMIZE_PRESETS;

export interface OptimizedImage {
  blob: Blob;
  fileName: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  originalBytes: number;
}

/** Carpetas que acepta la Edge Function. */
export type ImageFolder = 'posts' | 'categories' | 'nominees';

export const IMAGE_FOLDERS: readonly ImageFolder[] = ['posts', 'categories', 'nominees'];

/** Mismo tope que el bucket y la función (3 MB). */
export const IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

/** Encaja el rectángulo en el máximo, conservando la proporción y sin agrandar. */
export function fitWithin(
  width: number, height: number, maxWidth: number, maxHeight: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function webpFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || 'imagen'}.webp`;
}

/** Solo https. La vista previa local usa `blob:` aparte. */
export function httpsImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
