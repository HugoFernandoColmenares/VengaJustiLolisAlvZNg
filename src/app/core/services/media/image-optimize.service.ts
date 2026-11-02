import { Injectable } from '@angular/core';
import {
  IMAGE_OPTIMIZE_PRESETS, ImageOptimizePresetId, OptimizedImage, fitWithin, webpFileName,
} from '../../data/image-optimize.data';

/**
 * Pasa la imagen por canvas y la entrega en WebP.
 * `createImageBitmap` decodifica (y aplica la orientación EXIF); el lienzo reescala.
 */
@Injectable({ providedIn: 'root' })
export class ImageOptimizeService {
  async optimize(
    file: Blob,
    presetId: ImageOptimizePresetId = 'default',
    fileName?: string,
  ): Promise<OptimizedImage> {
    const preset = IMAGE_OPTIMIZE_PRESETS[presetId];
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, preset.maxWidth, preset.maxHeight);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('El navegador no pudo preparar el lienzo.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('No se pudo convertir la imagen a WebP.'));
        }, preset.mimeType, preset.quality);
      });
      const sourceName = fileName ?? (file instanceof File ? file.name : 'imagen');
      return {
        blob, fileName: webpFileName(sourceName), mimeType: preset.mimeType, width, height,
        originalBytes: file.size,
      };
    } finally {
      bitmap.close();
    }
  }
}
