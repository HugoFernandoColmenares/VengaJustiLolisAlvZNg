import { Component, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BACKEND, AlreadyVotedError } from '../core/backend/backend';
import { httpsImageUrl } from '../core/data/image-optimize.data';
import { environment } from '../../environments/environment';
import { BarChart } from '../shared/bar-chart';

@Component({
  selector: 'app-vote',
  imports: [BarChart, RouterLink],
  template: `
    <div class="container page stack">
      <h1 class="page-title">Votación {{ year }}</h1>
      <p class="kicker">Un voto por categoría. Sin trampa (las reglas de Firestore no perdonan).</p>

      @if (!backend.user()) {
        <div class="card card__body center">
          <p>Para votar necesitas iniciar sesión{{ backend.kind === 'local' ? ' (en modo demo es un usuario de prueba)' : ' con Google' }}.</p>
          <button class="btn btn--pink" type="button" (click)="login()">Iniciar sesión</button>
        </div>
      }

      @if (data.isLoading()) { <p class="notice" role="status">Cargando categorías…</p> }
      @if (data.error()) { <p class="notice notice--error" role="alert">No se pudieron cargar las categorías.</p> }
      @if (message(); as m) { <p class="notice" [class.notice--error]="m.error" [class.notice--ok]="!m.error" role="status">{{ m.text }}</p> }

      @if (data.value(); as d) {
        @for (c of d.categories; track c.id) {
          <section class="card" [attr.aria-labelledby]="'c-' + c.id">
            <h2 class="card__head" [id]="'c-' + c.id">{{ c.title }}</h2>
            <div class="card__body">
              @if (cover(c.image); as src) { <img class="cover" [src]="src" [alt]="'Portada de ' + c.title"> }
              <p>{{ c.description }}</p>
              @if (d.mine[c.id]; as voted) {
                <p class="notice notice--ok">✅ Ya votaste por <strong>{{ voted }}</strong>.</p>
                <app-bar-chart [results]="d.tallies[c.id]" [label]="'Conteo parcial de ' + c.title" />
              } @else if (!c.open) {
                <p class="notice">Votación cerrada.</p>
              } @else {
                <fieldset [disabled]="!backend.user() || busy()">
                  <legend class="sr-only">Elige tu nominado para {{ c.title }}</legend>
                  <div class="options">
                    @for (n of c.nominees; track n) {
                      <label class="option"><input type="radio" [name]="c.id" [value]="n" (change)="pick(c.id, n)" [checked]="picked()[c.id] === n">@if (photo(c.nomineeImages, n); as src) { <img [src]="src" alt="" width="48" height="48"> }<span>{{ n }}</span></label>
                    }
                  </div>
                  <button class="btn btn--yellow" type="button" [disabled]="!picked()[c.id]" (click)="vote(c.id)">Confirmar voto</button>
                </fieldset>
              }
            </div>
          </section>
        } @empty {
          <p class="notice">Todavía no hay categorías abiertas para {{ year }}. Un admin debe crearlas en <a routerLink="/admin">Admin</a>.</p>
        }
      }
    </div>
  `,
  styles: `
    .center { text-align: center; }
    fieldset { border: 0; padding: 0; margin: 0; }
    .options { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr)); margin-bottom: 2rem; }
    .option { display: flex; align-items: center; gap: 1rem; border: var(--bw) solid #000; padding: 1rem 1.4rem; background: #fff; cursor: pointer; font-weight: 700; min-height: 4.8rem; }
    .option:has(input:checked) { background: var(--c-yellow); box-shadow: var(--sh-sm); transform: translate(-2px,-2px); }
    .option input { width: 2rem; height: 2rem; accent-color: #000; }
    .option img { width: 4.8rem; height: 4.8rem; object-fit: cover; border: 2px solid #000; }
    .cover { width: 100%; max-height: 24rem; object-fit: cover; border: var(--bw) solid #000; margin-bottom: 1.6rem; }
  `,
})
export class VotePage {
  protected readonly backend = inject(BACKEND);
  protected readonly year = environment.votingYear;
  protected readonly picked = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);

  protected readonly data = resource({
    params: () => ({ user: this.backend.user()?.uid ?? null }),
    loader: async () => {
      const categories = await this.backend.listCategories(this.year);
      const mine = await this.backend.myVotes(this.year);
      const tallies: Record<string, Awaited<ReturnType<typeof this.backend.tally>>> = {};
      await Promise.all(categories.filter(c => mine[c.id]).map(async c => (tallies[c.id] = await this.backend.tally(this.year, c.id))));
      return { categories, mine, tallies };
    },
  });

  protected cover(url: string | null | undefined) { return httpsImageUrl(url); }
  protected photo(images: { name: string; image: string }[] | undefined, name: string) {
    return httpsImageUrl(images?.find(item => item.name === name)?.image);
  }
  protected login() { this.backend.signIn().catch(e => this.message.set({ text: String(e?.message ?? e), error: true })); }
  protected pick(cat: string, n: string) { this.picked.update(p => ({ ...p, [cat]: n })); }
  protected async vote(cat: string) {
    const n = this.picked()[cat]; if (!n) return;
    this.busy.set(true); this.message.set(null);
    try {
      await this.backend.castVote(this.year, cat, n);
      this.message.set({ text: `¡Voto registrado por ${n}!`, error: false });
    } catch (e) {
      this.message.set({ text: e instanceof AlreadyVotedError ? e.message : 'No se pudo registrar el voto. ' + (e as Error).message, error: true });
    } finally { this.busy.set(false); this.data.reload(); }
  }
}
