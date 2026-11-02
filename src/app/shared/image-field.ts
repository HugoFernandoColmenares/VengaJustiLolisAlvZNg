import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { ImageFolder, httpsImageUrl } from '../core/data/image-optimize.data';
import { ImageUploadError, ImageUploadService } from '../core/services/media/image-upload.service';

/** Campo de subida con vista previa. En modo demo el input queda deshabilitado. */
@Component({
  selector: 'app-image-field',
  template: `
    <div class="field">
      <label [attr.for]="inputId">{{ label() }}</label>
      @if (shown(); as src) {
        <img class="preview" [src]="src" [alt]="'Vista previa: ' + label()">
      }
      <input [id]="inputId" type="file" accept="image/webp,image/jpeg,image/png,image/avif,.webp,.jpg,.jpeg,.png,.avif"
             [disabled]="!uploads.enabled || busy()" (change)="onFile($event)">
      @if (uploads.enabled) {
        <span class="hint">Se convierte a WebP (máx. 1920×1080, calidad 0.82). Límite 3 MB.</span>
        @if (url()) {
          <button class="btn" type="button" [disabled]="busy()" (click)="clear()">Quitar imagen</button>
        }
      } @else {
        <p class="notice">En modo demo no se pueden subir imágenes: hace falta Firebase para el token de admin.</p>
      }
      @if (busy()) { <p class="notice" role="status">Subiendo…</p> }
      @if (error()) { <p class="notice notice--error" role="alert">{{ error() }}</p> }
    </div>
  `,
  styles: `
    .preview { width: 100%; max-height: 18rem; object-fit: cover; border: var(--bw) solid #000; margin-bottom: .8rem; background: #fff; }
    input[type=file] { width: 100%; max-width: 100%; }
    .notice { overflow-wrap: anywhere; }
    .btn { margin-top: .8rem; }
  `,
})
export class ImageField {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly uploads = inject(ImageUploadService);
  readonly label = input.required<string>();
  readonly folder = input.required<ImageFolder>();
  readonly url = input('');
  readonly urlChange = output<string>();
  readonly busyChange = output<boolean>();

  protected readonly inputId = `img-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly localPreview = signal('');

  constructor() { this.destroyRef.onDestroy(() => this.revoke()); }

  protected shown(): string | null {
    return this.localPreview() || httpsImageUrl(this.url());
  }

  protected async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.uploads.enabled) return;
    this.error.set('');
    const local = URL.createObjectURL(file);
    this.localPreview.set(local);
    await this.run(async () => {
      try {
        const next = await this.uploads.upload(file, this.folder());
        const previous = this.url();
        this.urlChange.emit(next);
        if (previous && previous !== next) await this.uploads.remove(previous).catch(() => undefined);
      } catch (e) {
        this.error.set(e instanceof ImageUploadError ? e.message : 'No se pudo subir la imagen.');
      } finally {
        this.revoke();
      }
    });
  }

  protected async clear() {
    const previous = this.url();
    if (!previous) return;
    this.error.set('');
    await this.run(async () => {
      if (!this.uploads.enabled) {
        this.urlChange.emit('');
        return;
      }
      try {
        await this.uploads.remove(previous);
        this.urlChange.emit('');
      } catch (e) {
        this.error.set(e instanceof ImageUploadError ? e.message : 'No se pudo quitar la imagen.');
      }
    });
  }

  private async run(task: () => Promise<void>) {
    this.busy.set(true);
    this.busyChange.emit(true);
    try { await task(); }
    finally {
      this.busy.set(false);
      this.busyChange.emit(false);
    }
  }

  private revoke() {
    const local = this.localPreview();
    if (local) URL.revokeObjectURL(local);
    this.localPreview.set('');
  }
}
