import { IMAGE_OPTIMIZE_PRESETS, IMAGE_UPLOAD_MAX_BYTES, fitWithin, webpFileName } from './image-optimize.data';
import { MAX_IMAGE_BYTES } from '../../../../supabase/functions/vengajusti-upload/logic';

describe('optimización de imágenes', () => {
  const preset = IMAGE_OPTIMIZE_PRESETS.default;

  it('usa el preset de feith-blog: 1920×1080, calidad 0.82, WebP', () => {
    expect(preset).toEqual({ maxWidth: 1920, maxHeight: 1080, quality: 0.82, mimeType: 'image/webp', extension: 'webp' });
    expect(IMAGE_UPLOAD_MAX_BYTES).toBe(MAX_IMAGE_BYTES);
  });

  it('encaja sin recortar ni agrandar', () => {
    expect(fitWithin(4000, 3000, preset.maxWidth, preset.maxHeight)).toEqual({ width: 1440, height: 1080 });
    expect(fitWithin(800, 600, preset.maxWidth, preset.maxHeight)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(100, 5000, preset.maxWidth, preset.maxHeight)).toEqual({ width: 22, height: 1080 });
  });

  it('renombra a .webp', () => {
    expect(webpFileName('Foto linda.PNG')).toBe('Foto-linda.webp');
    expect(webpFileName('ya.webp')).toBe('ya.webp');
  });
});
