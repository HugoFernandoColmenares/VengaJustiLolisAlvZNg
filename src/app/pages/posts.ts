import { Component, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BACKEND } from '../core/backend/backend';
import { httpsImageUrl } from '../core/data/image-optimize.data';

@Component({
  selector: 'app-posts',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="container page stack">
      <h1 class="page-title">Posts del grupo</h1>
      @if (backend.user()?.isAdmin) { <p class="center"><a class="btn btn--pink" routerLink="/admin">+ Nuevo post</a></p> }
      @if (posts.isLoading()) { <p class="notice" role="status">Cargando posts…</p> }
      @if (posts.error()) { <p class="notice notice--error" role="alert">No se pudieron cargar los posts.</p> }
      <ul class="list">
        @for (p of posts.value() ?? []; track p.id; let i = $index) {
          <li class="card" [class.tilt-l]="i % 2 === 0" [class.tilt-r]="i % 2 === 1">
            <a class="post" [routerLink]="['/posts', p.id]">
              @if (cover(p.image); as src) { <img class="thumb" [src]="src" alt=""> }
              <span class="meta">{{ p.createdAt | date: 'longDate' }} · {{ p.authorName }}</span>
              @if (p.contestYear) { <span class="badge">Premios {{ p.contestYear }}</span> }
              <h2>{{ p.title }}</h2>
              <p>{{ p.body.length > 180 ? p.body.slice(0, 180) + '…' : p.body }}</p>
              <span class="more">Leer más →</span>
            </a>
          </li>
        } @empty { @if (!posts.isLoading()) { <li class="notice">Aún no hay posts. ¡La Grieta está tranquila (por ahora)!</li> } }
      </ul>
    </div>
  `,
  styles: `
    .center { text-align: center; }
    .list { list-style: none; padding: 0; margin: 0 auto; max-width: 90rem; width: 100%; display: flex; flex-direction: column; gap: 3rem; }
    .post { display: block; padding: 2.4rem; color: inherit; text-decoration: none; }
    .thumb { width: 100%; max-height: 22rem; object-fit: cover; border: var(--bw) solid #000; margin-bottom: 1.6rem; }
    .post h2 { font-size: 3.2rem; margin: .4rem 0 1rem; }
    .meta { font-family: var(--f-retro); font-size: 1.9rem; color: var(--c-muted); }
    .more { font-family: var(--f-display); font-size: 2rem; color: var(--c-pink-ink); }
    .post:hover .more { text-decoration: underline; }
  `,
})
export class PostsPage {
  protected readonly backend = inject(BACKEND);
  protected readonly posts = resource({ loader: () => this.backend.listPosts() });
  protected cover(url: string | null | undefined) { return httpsImageUrl(url); }
}
