import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BACKEND } from './core/backend/backend';

@Component({
  selector: 'app-root',
  host: { '(document:keydown.escape)': 'closeMenu()' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="btn btn--dark skip-link" href="#contenido" (click)="skipToContent($event)">Saltar al contenido</a>
    <header class="site-header">
      <a routerLink="/" class="logo" (click)="menuOpen.set(false)">VengaJustiLolis <span>Alv Z</span></a>
      <button class="menu-toggle" type="button" [attr.aria-expanded]="menuOpen()" aria-controls="menu-principal"
              (click)="menuOpen.update(v => !v)">
        <span aria-hidden="true">{{ menuOpen() ? '✕' : '☰' }}</span><span class="sr-only">Menú</span>
      </button>
      <nav id="menu-principal" class="nav" [class.is-open]="menuOpen()" aria-label="Principal">
        @for (l of links; track l.path) {
          <a class="btn" [routerLink]="l.path" routerLinkActive="is-active" ariaCurrentWhenActive="page"
             [routerLinkActiveOptions]="{ exact: l.path === '/' }" (click)="menuOpen.set(false)">{{ l.label }}</a>
        }
      </nav>
    </header>
    @if (backend.kind === 'local') {
      <p class="demo-bar" role="status">Modo demo: votos y posts se guardan solo en este navegador.</p>
    }
    @if (backend.user(); as u) {
      @if (!u.isAdmin && u.status !== 'approved') {
        <p class="pending-bar" role="status">Tu cuenta está pendiente de aprobación. Puedes leer; votar sigue bloqueado.</p>
      }
    }
    <main id="contenido" tabindex="-1"><router-outlet /></main>
    <footer class="site-footer">
      <p class="copyright">© {{ year }} VengaJustiLolis Alv Z</p>
      <p class="credits">Desarrollado con <span class="heart" aria-label="amor">♥</span> y caos por <a href="https://github.com/FeithNoir">FeithNoir</a></p>
      <p class="quote">"Pinches calenturientos, como los quiero"</p>
    </footer>
  `,
  styles: `
    .site-header { position: sticky; top: 0; z-index: 1000; background: var(--c-yellow); border-bottom: var(--bw) solid var(--c-ink);
      padding: 1rem 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    @media (min-width: 768px) { .site-header { padding: 1rem 2rem; } }
    .logo { text-decoration: none; font-family: var(--f-display); font-size: clamp(1.7rem, 4.6vw, 2.8rem); color: #fff; letter-spacing: .06rem;
      text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; transform: skew(-5deg) rotate(-2deg);
      transition: transform var(--bounce); line-height: .9; min-width: 0; }
    .logo:hover { transform: scale(1.05) skew(-5deg); }
    .logo span { color: var(--c-blue); }
    .menu-toggle { background: #000; color: var(--c-yellow); border: 0; min-width: 4.8rem; min-height: 4.8rem; font-size: 2.4rem; border-radius: 4px; cursor: pointer; }
    .nav { display: none; flex-direction: column; gap: 1.2rem; position: absolute; top: 100%; left: 0; right: 0; padding: 2rem;
      background: var(--c-yellow); border-bottom: var(--bw) solid #000; }
    .nav.is-open { display: flex; }
    .nav .btn { font-size: 1.9rem; padding: .6rem 1.6rem; }
    .nav .btn.is-active { background: var(--c-pink); color: #fff; text-shadow: 2px 2px 0 #000; }
    @media (min-width: 1024px) {
      .menu-toggle { display: none; }
      .nav { display: flex; flex-direction: row; position: static; padding: 0; background: none; border: 0; }
    }
    .demo-bar, .pending-bar { margin: 0; line-height: 1.2; text-align: center; font-family: var(--f-retro); font-size: 1.8rem; padding: .4rem 1rem; overflow-wrap: anywhere; }
    .demo-bar { background: #000; color: var(--c-yellow); }
    .pending-bar { background: var(--c-pink); color: #fff; text-shadow: 1px 1px 0 #000; }
    main { display: block; min-height: 60vh; outline: none; }
    .site-footer { margin-top: 8rem; background: var(--c-dark); color: #fff; padding: 6rem 2rem 3rem; text-align: center; border-top: var(--bw) solid #000; position: relative; }
    .site-footer::before { content: 'FINISH!'; position: absolute; top: -3.5rem; left: 50%; transform: translateX(-50%) rotate(-2deg);
      background: var(--c-pink); color: #fff; font-family: var(--f-display); font-size: 3rem; padding: .5rem 3rem; border: var(--bw) solid #000; box-shadow: 4px 4px 0 #000; }
    .copyright { font-family: var(--f-display); font-size: 2.5rem; }
    .credits { font-family: var(--f-retro); font-size: 1.9rem; color: #D1D5DB; }
    .credits a { color: var(--c-yellow); font-weight: 700; }
    .heart { color: var(--c-pink); display: inline-block; animation: beat 1.5s infinite; }
    @keyframes beat { 50% { transform: scale(1.3); } }
    .quote { font-style: italic; font-size: 1.5rem; color: #9CA3AF; max-width: 50rem; margin: 2rem auto 0; border-top: 1px solid #374151; padding-top: 1.5rem; }
  `,
})
export class App {
  protected readonly backend = inject(BACKEND);
  protected readonly menuOpen = signal(false);
  /** Con `<base href>` un enlace "#id" navegaría a la portada; enfocamos el <main> a mano. */
  protected skipToContent(ev: Event) {
    ev.preventDefault();
    const main = document.getElementById('contenido');
    main?.focus();
    main?.scrollIntoView();
  }
  protected closeMenu() {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    document.querySelector<HTMLElement>('.menu-toggle')?.focus();
  }
  protected readonly year = new Date().getFullYear();
  protected readonly links = [
    { path: '/', label: 'Inicio' },
    { path: '/posts', label: 'Posts' },
    { path: '/lore', label: 'Lore' },
  ];
}
