import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAME_STATUS, INTRO_2025, INTRO_QUOTE, TAGLINE } from '../core/data/lore.data';
import { AWARDS_2025 } from '../core/data/awards-2025.data';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <div class="container hero__inner">
        <p class="badge">Premios · Lore · Caos nacido en WhatsApp</p>
        <h1 class="hero__title">VengaJustiLolis <span>Alv Z</span></h1>
        <p class="hero__tag">{{ tagline }}</p>
        <div class="hero__cta">
          <a class="btn btn--pink" [routerLink]="['/posts', 'premios-' + votingYear]">Votar Premios {{ votingYear }}</a>
          <a class="btn" routerLink="/posts/premios-2025">Ganadores 2025</a>
          <a class="btn btn--blue" routerLink="/lore">Entrar al lore</a>
        </div>
      </div>
    </section>

    <div class="container page stack">
      <article class="card tilt-r intro">
        <div class="card__body">
          <h2 class="section-title center intro__title">🌪️ El caos detrás de la Grieta (2025)</h2>
          @for (p of intro; track $index) { <p [innerHTML]="p"></p> }
          <blockquote class="highlight">"{{ quote }}"</blockquote>
        </div>
      </article>

      <section aria-labelledby="ganadores">
        <h2 id="ganadores" class="section-title center">🏆 Ganadores 2025</h2>
        <ul class="grid grid--3 winners">
          @for (c of awards; track c.id) {
            <li class="card winner">
              <a [routerLink]="['/posts', 'premios-2025']" [fragment]="c.id">
                <span class="winner__cat">{{ c.title }}</span>
                <span class="winner__name">{{ c.winner }}</span>
              </a>
            </li>
          }
        </ul>
      </section>

      <p class="notice status">🎮 {{ status }}</p>
    </div>
  `,
  styles: `
    .hero { background: var(--c-blue); border-bottom: var(--bw) solid #000; padding: 6rem 0 7rem;
      background-image: radial-gradient(rgba(0,0,0,.18) 1.5px, transparent 1.5px); background-size: 14px 14px; }
    .hero__inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2rem; }
    .hero__title { font-size: clamp(4.6rem, 13vw, 11rem); color: #fff; transform: rotate(-2deg);
      text-shadow: 5px 5px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000; }
    .hero__title span { color: var(--c-yellow); display: inline-block; }
    .hero__tag { font-family: var(--f-retro); line-height: 1.2; font-size: clamp(2rem, 4vw, 2.8rem); background: #fff; border: var(--bw) solid #000; padding: .4rem 1.6rem; box-shadow: var(--sh-sm); max-width: 60rem; }
    .hero__cta { display: flex; flex-wrap: wrap; gap: 1.6rem; justify-content: center; }
    .intro { max-width: 90rem; margin: 0 auto; }
    .intro__title { color: var(--c-pink-ink); }
    .winners { list-style: none; padding: 0; margin: 0; }
    .winner a { display: flex; flex-direction: column; padding: 2rem; text-decoration: none; color: inherit; height: 100%; transition: transform var(--bounce); }
    .winner:nth-child(3n+1) { background: var(--c-yellow); } .winner:nth-child(3n+2) { background: #fff; } .winner:nth-child(3n) { background: #FCE7F3; }
    .winner a:hover { transform: translate(-3px,-3px); }
    .winner__cat { font-family: var(--f-retro); font-size: 2rem; }
    .winner__name { font-family: var(--f-display); font-size: 3rem; line-height: 1.1; }
    .status { text-align: center; }
  `,
})
export class HomePage {
  protected readonly tagline = TAGLINE;
  protected readonly status = GAME_STATUS;
  protected readonly intro = INTRO_2025;
  protected readonly quote = INTRO_QUOTE;
  protected readonly awards = AWARDS_2025;
  protected readonly votingYear = environment.votingYear;
}
