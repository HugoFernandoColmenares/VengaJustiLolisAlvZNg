import { Component, effect, inject, input, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BACKEND, contestYearFromId, fallbackContestPost } from '../core/backend/backend';
import { httpsImageUrl } from '../core/data/image-optimize.data';
import { Awards2025Page } from './awards-2025';
import { YearContest } from '../shared/year-contest';

@Component({
  selector: 'app-post-detail',
  imports: [RouterLink, DatePipe, Awards2025Page, YearContest],
  template: `
    <div class="container page stack">
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
        @if (p.contestYear === 2025) {
          <app-awards-2025 />
        } @else if (p.contestYear) {
          <app-year-contest [year]="p.contestYear" />
        }
      } @else { <p class="notice notice--error">Este post se lo tragó la Grieta.</p> }
    </div>
  `,
  styles: `
    .art { max-width: 80rem; margin: 2rem auto 0; }
    .cover { width: 100%; max-height: 36rem; object-fit: cover; border: var(--bw) solid #000; margin-bottom: 1.6rem; }
    h1 { font-size: clamp(3.2rem, 7vw, 5rem); margin-bottom: 2rem; overflow-wrap: anywhere; }
    .meta { font-family: var(--f-retro); font-size: 2rem; color: var(--c-muted); }
    .body { white-space: pre-line; font-size: 1.8rem; }
    .tags { display: flex; gap: .8rem; flex-wrap: wrap; margin-top: 2rem; }
  `,
})
export class PostDetailPage {
  private readonly backend = inject(BACKEND);
  private readonly route = inject(ActivatedRoute);
  readonly id = input.required<string>();
  protected readonly post = resource({
    params: () => this.id(),
    loader: async ({ params }) => {
      const found = await this.backend.getPost(params);
      if (found) return found;
      const year = contestYearFromId(params);
      return year == null ? null : fallbackContestPost(params, year);
    },
  });
  protected cover(url: string | null | undefined) { return httpsImageUrl(url); }

  constructor() {
    effect(() => {
      const ready = this.post.value();
      const fragment = this.route.snapshot.fragment;
      if (!ready || !fragment) return;
      const timer = setTimeout(() => document.getElementById(fragment)?.scrollIntoView(), 0);
      return () => clearTimeout(timer);
    });
  }
}
