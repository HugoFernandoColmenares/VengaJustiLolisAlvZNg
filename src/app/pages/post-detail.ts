import { Component, inject, input, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BACKEND } from '../core/backend/backend';
import { httpsImageUrl } from '../core/data/image-optimize.data';

@Component({
  selector: 'app-post-detail',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="container page">
      <p><a routerLink="/posts">← Volver a posts</a></p>
      @if (post.isLoading()) { <p class="notice" role="status">Cargando…</p> }
      @else if (post.value(); as p) {
        <article class="card card__body art">
          @if (cover(p.image); as src) { <img class="cover" [src]="src" [alt]="'Portada: ' + p.title"> }
          <p class="meta">{{ p.createdAt | date: 'longDate' }} · {{ p.authorName }}</p>
          <h1>{{ p.title }}</h1>
          <div class="body">{{ p.body }}</div>
          @if (p.tags.length) { <p class="tags">@for (t of p.tags; track t) { <span class="badge">#{{ t }}</span> }</p> }
        </article>
      } @else { <p class="notice notice--error">Este post se lo tragó la Grieta.</p> }
    </div>
  `,
  styles: `
    .art { max-width: 80rem; margin: 2rem auto 0; }
    .cover { width: 100%; max-height: 36rem; object-fit: cover; border: var(--bw) solid #000; margin-bottom: 1.6rem; }
    h1 { font-size: clamp(3.2rem, 7vw, 5rem); margin-bottom: 2rem; }
    .meta { font-family: var(--f-retro); font-size: 2rem; color: var(--c-muted); }
    .body { white-space: pre-line; font-size: 1.8rem; }
    .tags { display: flex; gap: .8rem; flex-wrap: wrap; margin-top: 2rem; }
  `,
})
export class PostDetailPage {
  private readonly backend = inject(BACKEND);
  readonly id = input.required<string>();
  protected readonly post = resource({ params: () => this.id(), loader: ({ params }) => this.backend.getPost(params) });
  protected cover(url: string | null | undefined) { return httpsImageUrl(url); }
}
