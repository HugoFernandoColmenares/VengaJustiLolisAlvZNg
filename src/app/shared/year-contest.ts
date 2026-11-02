import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlreadyVotedError, BACKEND, PendingAccountError, canParticipate } from '../core/backend/backend';
import { VoteResult } from '../core/backend/models';
import { httpsImageUrl } from '../core/data/image-optimize.data';
import { BarChart } from './bar-chart';
import { PendingAccount } from './pending-account';

@Component({
  selector: 'app-year-contest',
  imports: [BarChart, RouterLink, PendingAccount],
  template: `
    <div class="stack">
      <p class="kicker">Un voto por categoría. Cuando cierra, aquí quedan los resultados.</p>

      @if (openCount() > 0 && !backend.user()) {
        <div class="card card__body center">
          <p>Para votar necesitas iniciar sesión{{ backend.kind === 'local' ? '' : ' con Google' }}.</p>
          <div class="actions">
            <button class="btn btn--pink" type="button" (click)="login()">
              {{ backend.kind === 'local' ? 'Entrar como admin de prueba' : 'Iniciar sesión con Google' }}
            </button>
            @if (backend.kind === 'local') {
              <button class="btn" type="button" (click)="loginPending()">Entrar como cuenta pendiente</button>
            }
          </div>
        </div>
      }

      @if (openCount() > 0 && backend.user() && !allowed()) {
        <app-pending-account [status]="backend.user()!.status" />
      }

      @if (data.isLoading()) { <p class="notice" role="status">Cargando categorías…</p> }
      @if (data.error()) { <p class="notice notice--error" role="alert">No se pudieron cargar las categorías.</p> }
      @if (message(); as m) { <p class="notice" [class.notice--error]="m.error" [class.notice--ok]="!m.error" role="status">{{ m.text }}</p> }

      @if (data.value(); as d) {
        @for (c of d.categories; track c.id) {
          <section class="card" [id]="c.id" [attr.aria-labelledby]="'c-' + c.id">
            <h2 class="card__head" [id]="'c-' + c.id">{{ c.title }}</h2>
            <div class="card__body">
              @if (cover(c.image); as src) { <img class="cover" [src]="src" [alt]="'Portada de ' + c.title"> }
              <p>{{ c.description }}</p>
              @if (!c.open) {
                <div class="winner">
                  <span class="winner__label">🏆 {{ tied(d.tallies[c.id]) ? 'Empate' : 'Resultado' }}</span>
                  <span class="winner__name">{{ winner(d.tallies[c.id]) }}</span>
                </div>
                <app-bar-chart [results]="d.tallies[c.id] ?? []" [label]="'Resultados de ' + c.title" />
              } @else if (d.mine[c.id]; as voted) {
                <p class="notice notice--ok">✅ Ya votaste por <strong>{{ voted }}</strong>.</p>
                <app-bar-chart [results]="d.tallies[c.id] ?? []" [label]="'Conteo parcial de ' + c.title" />
              } @else {
                <fieldset [disabled]="busy() || !allowed()">
                  <legend class="sr-only">Elige tu nominado para {{ c.title }}</legend>
                  <div class="options">
                    @for (n of c.nominees; track n) {
                      <label class="option">
                        <input type="radio" [name]="c.id" [value]="n" (change)="pick(c.id, n)" [checked]="picked()[c.id] === n">
                        @if (photo(c.nomineeImages, n); as src) { <img [src]="src" alt="" width="48" height="48"> }
                        <span>{{ n }}</span>
                      </label>
                    }
                  </div>
                  <button class="btn btn--yellow" type="button" [disabled]="!picked()[c.id] || !allowed()" (click)="vote(c.id)">Confirmar voto</button>
                </fieldset>
              }
            </div>
          </section>
        } @empty {
          <p class="notice">Todavía no hay categorías para {{ year() }}. Un admin debe crearlas en <a routerLink="/admin">Admin</a>.</p>
        }
      }
    </div>
  `,
  styles: `
    .center { text-align: center; }
    .actions { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
    fieldset { border: 0; padding: 0; margin: 0; }
    fieldset:disabled { opacity: .6; }
    fieldset:disabled .option { cursor: not-allowed; }
    .options { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); margin-bottom: 2rem; }
    .option { display: flex; align-items: center; gap: 1rem; border: var(--bw) solid #000; padding: 1rem 1.4rem; background: #fff; cursor: pointer; font-weight: 700; min-height: 4.8rem; overflow-wrap: anywhere; }
    .option:has(input:checked) { background: var(--c-yellow); box-shadow: var(--sh-sm); }
    .option input { width: 2rem; height: 2rem; accent-color: #000; flex: 0 0 auto; }
    .option img, .cover { object-fit: cover; border: 2px solid #000; }
    .option img { width: 4.8rem; height: 4.8rem; }
    .cover { width: 100%; max-height: 24rem; border-width: var(--bw); margin-bottom: 1.6rem; }
    .winner { display: flex; flex-direction: column; background: var(--c-yellow); border: var(--bw) solid #000; padding: 1.6rem 2rem; box-shadow: var(--sh-sm); margin-bottom: 1.6rem; }
    .winner__label { font-family: var(--f-retro); font-size: 2rem; }
    .winner__name { font-family: var(--f-display); font-size: clamp(2.4rem, 6vw, 4rem); line-height: 1.1; overflow-wrap: anywhere; }
    section { scroll-margin-top: 9rem; }
  `,
})
export class YearContest {
  readonly year = input.required<number>();
  protected readonly backend = inject(BACKEND);
  protected readonly picked = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly message = signal<{ text: string; error: boolean } | null>(null);
  protected readonly allowed = computed(() => canParticipate(this.backend.user()));

  protected readonly data = resource({
    params: () => ({
      year: this.year(),
      uid: this.backend.user()?.uid ?? null,
      status: this.backend.user()?.status ?? null,
      admin: this.backend.user()?.isAdmin ?? false,
    }),
    loader: async ({ params }) => {
      const categories = await this.backend.listCategories(params.year);
      const mine = await this.backend.myVotes(params.year);
      const tallies: Record<string, VoteResult[]> = {};
      await Promise.all(categories.map(async c => {
        if (!c.open || mine[c.id]) tallies[c.id] = await this.backend.tally(params.year, c.id);
      }));
      return { categories, mine, tallies };
    },
  });

  protected readonly openCount = computed(() => this.data.value()?.categories.filter(c => c.open).length ?? 0);

  protected cover(url: string | null | undefined) { return httpsImageUrl(url); }
  protected photo(images: { name: string; image: string }[] | undefined, name: string) {
    return httpsImageUrl(images?.find(item => item.name === name)?.image);
  }
  protected winner(results: VoteResult[] | undefined) {
    const top = results?.filter(r => r.votes > 0) ?? [];
    if (!top.length) return 'Sin votos todavía';
    const best = top[0].votes;
    return top.filter(r => r.votes === best).map(r => r.name).join(', ');
  }
  protected tied(results: VoteResult[] | undefined) {
    const names = this.winner(results);
    return names.includes(', ');
  }
  protected login() { this.backend.signIn().catch(e => this.message.set({ text: String(e?.message ?? e), error: true })); }
  protected loginPending() {
    const enter = this.backend.signInPending;
    if (!enter) return;
    enter.call(this.backend).catch(e => this.message.set({ text: String(e?.message ?? e), error: true }));
  }
  protected pick(cat: string, n: string) { this.picked.update(p => ({ ...p, [cat]: n })); }
  protected async vote(cat: string) {
    const n = this.picked()[cat]; if (!n || !this.allowed()) return;
    this.busy.set(true); this.message.set(null);
    try {
      await this.backend.castVote(this.year(), cat, n);
      this.message.set({ text: `¡Voto registrado por ${n}!`, error: false });
    } catch (e) {
      const text = e instanceof AlreadyVotedError || e instanceof PendingAccountError
        ? e.message
        : 'No se pudo registrar el voto. ' + (e as Error).message;
      this.message.set({ text, error: true });
    } finally { this.busy.set(false); this.data.reload(); }
  }
}
