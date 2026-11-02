import { Injectable, inject } from '@angular/core';
import { BACKEND } from '../../backend/backend';
import { IMAGE_UPLOAD_MAX_BYTES, ImageFolder } from '../../data/image-optimize.data';
import { environment } from '../../../../environments/environment';
import { ImageOptimizeService } from './image-optimize.service';

export class ImageUploadError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ImageUploadError'; }
}

interface ErrorBody { error?: string; message?: string }

/**
 * Optimiza en el navegador y sube el WebP a la Edge Function.
 * El ID token sale de Firebase (`getIdToken`); la función confirma que el uid es admin.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly optimize = inject(ImageOptimizeService);
  private readonly backend = inject(BACKEND);

  /** En modo demo no hay token de Firebase ni forma de autorizar la función. */
  get enabled(): boolean { return this.backend.kind === 'firebase'; }

  async upload(file: File, folder: ImageFolder): Promise<string> {
    if (!this.enabled) throw new ImageUploadError(0, 'En modo demo no se pueden subir imágenes.');
    const optimized = await this.optimize.optimize(file);
    if (optimized.blob.size > IMAGE_UPLOAD_MAX_BYTES) {
      throw new ImageUploadError(413, 'La imagen sigue pesando más de 3 MB después de optimizarla.');
    }
    const body = new FormData();
    body.append('file', new File([optimized.blob], optimized.fileName, { type: optimized.mimeType }));
    body.append('folder', folder);
    const data = await this.request<{ url?: string }>('POST', body);
    if (!data.url) throw new ImageUploadError(502, 'La función no devolvió la URL.');
    return data.url;
  }

  /** Borra un objeto propio. Si ya no está (404), la referencia se puede soltar igual. */
  async remove(urlOrPath: string): Promise<void> {
    if (!this.enabled || !urlOrPath) return;
    try {
      await this.request('DELETE', JSON.stringify({ path: urlOrPath }), 'application/json');
    } catch (e) {
      if (e instanceof ImageUploadError && e.status === 404) return;
      throw e;
    }
  }

  private async request<T>(method: 'POST' | 'DELETE', body: BodyInit, contentType?: string): Promise<T> {
    const send = async (forceRefresh: boolean) => {
      const token = await this.backend.getIdToken(forceRefresh);
      const headers = new Headers({ authorization: `Bearer ${token}` });
      if (contentType) headers.set('content-type', contentType);
      return fetch(environment.imageUploadUrl, { method, headers, body });
    };
    let res = await send(false);
    if (res.status === 401) res = await send(true);
    if (!res.ok) throw new ImageUploadError(res.status, await messageOf(res));
    return res.json() as Promise<T>;
  }
}

async function messageOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as ErrorBody | null;
  if (body?.message) return body.message;
  if (res.status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.';
  if (res.status === 403) return 'Tu cuenta no es admin.';
  if (res.status === 413) return 'La imagen supera el límite de 3 MB.';
  if (res.status === 415) return 'Formato no permitido. Usa WebP, JPEG, PNG o AVIF.';
  return 'No se pudo completar la operación con la imagen.';
}
