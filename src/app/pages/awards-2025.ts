import { Component } from '@angular/core';
import { AWARDS_2025, OPINIONS_2025 } from '../core/data/awards-2025.data';
import { BarChart } from '../shared/bar-chart';

const AVATAR = ['#FFCC00', '#00BFFF', '#EC4899', '#22C55E', '#CC65FE', '#FF9F40'];

@Component({
  selector: 'app-awards-2025',
  imports: [BarChart],
  template: `
    <div class="stack">
      <nav aria-label="Categorías 2025" class="jump">
        @for (c of awards; track c.id) { <a class="btn" [href]="'#' + c.id" (click)="go($event, c.id)">{{ c.title }}</a> }
      </nav>

      @for (c of awards; track c.id; let i = $index) {
        <section class="card cat" [class.tilt-l]="i % 2 === 0" [class.tilt-r]="i % 2 === 1" [id]="c.id" [attr.aria-labelledby]="c.id + '-t'">
          <h2 class="cat__hero" [id]="c.id + '-t'" [style.background-image]="bg(c.image, i)">{{ c.title }}</h2>
          <div class="card__body cat__body">
            <p class="flavor">{{ c.flavor }}</p>
            <div class="winner">
              <span class="winner__label">🏆 {{ c.tie ? 'Empate histórico' : 'Ganador indiscutible' }}</span>
              <span class="winner__name">{{ c.winner }}</span>
              <span>{{ c.description }}</span>
            </div>
            <app-bar-chart [results]="c.results" [label]="'Votos de ' + c.title" />
          </div>
        </section>
      }

      <section id="la-voz-del-pueblo" aria-labelledby="voz">
        <h2 id="voz" class="section-title center">🗣️ La voz del pueblo</h2>
        <div class="grid grid--2">
          @for (o of opinions; track o.title) {
            <div class="card">
              <h3 class="card__head">{{ o.title }}</h3>
              <ul class="bubbles">
                @for (c of o.comments; track $index; let j = $index) {
                  <li class="dialog" [class.reverse]="j % 2 === 1">
                    <span class="avatar" aria-hidden="true" [style.background]="avatar(j)">?</span>
                    <span class="bubble"><span class="sr-only">Anónimo: </span>{{ c }}</span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .jump { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
    .jump .btn { font-size: 1.7rem; min-height: 4.4rem; padding: .4rem 1.4rem; }
    .cat { overflow: hidden; scroll-margin-top: 9rem; }
    .cat__hero { padding: clamp(5rem, 13vw, 9rem) 2rem; background-size: cover; background-position: center; color: #fff;
      font-size: clamp(3rem, 9vw, 6rem); text-transform: uppercase; text-shadow: 3px 3px 0 #000, 0 0 10px rgba(0,0,0,.6);
      border-bottom: var(--bw) solid #000; word-break: break-word; }
    .cat__body { display: flex; flex-direction: column; gap: 2rem; }
    .flavor { font-family: var(--f-retro); font-size: 2.2rem; line-height: 1.3; margin: 0; }
    .winner { display: flex; flex-direction: column; background: var(--c-yellow); border: var(--bw) solid #000; padding: 1.6rem 2rem; box-shadow: var(--sh-sm); }
    .winner__label { font-family: var(--f-retro); font-size: 2rem; }
    .winner__name { font-family: var(--f-display); font-size: clamp(2.8rem, 6vw, 4rem); line-height: 1.1; }
    .bubbles { list-style: none; margin: 0; padding: 2.4rem; display: flex; flex-direction: column; gap: 2.4rem;
      background-image: linear-gradient(#eee .1rem, transparent .1rem); background-size: 100% 2.4rem; }
    .dialog { display: flex; gap: 1.5rem; align-items: flex-start; }
    .dialog.reverse { flex-direction: row-reverse; }
    .avatar { width: 4.4rem; height: 4.4rem; flex-shrink: 0; border-radius: 12px; border: var(--bw) solid #000; display: grid; place-items: center;
      font-family: var(--f-display); font-size: 2.2rem; color: #000; box-shadow: 3px 3px 0 #000; }
    .bubble { background: #fff; border: var(--bw) solid #000; padding: 1rem 1.6rem; border-radius: 15px; font-family: var(--f-retro);
      font-size: 2rem; line-height: 1.2; color: var(--c-text); box-shadow: 4px 4px 0 rgba(0,0,0,.1); word-break: break-word; }
  `,
})
export class Awards2025Page {
  protected readonly awards = AWARDS_2025;
  protected readonly opinions = OPINIONS_2025;
  protected bg(img: string | null, i: number) {
    const shade = 'linear-gradient(to right, rgba(0,0,0,.85), rgba(0,0,0,.25))';
    if (img) return `${shade}, url('${img}')`;
    const c = AVATAR[i % 6];
    const art = [
      `radial-gradient(circle at 80% 50%, ${c} 0 18%, transparent 19%), repeating-radial-gradient(circle at 80% 50%, ${c} 0 6px, #000 6px 9px)`,
      `repeating-linear-gradient(45deg, ${c} 0 20px, #000 20px 23px)`,
      `repeating-conic-gradient(from 0deg at 85% 50%, ${c} 0 10deg, #111 10deg 20deg)`,
      `repeating-radial-gradient(circle at 0 0, ${c} 0 10px, #000 10px 12px)`,
      `repeating-linear-gradient(-45deg, ${c} 0 12px, #fff 12px 14px, ${c} 14px 26px, #000 26px 29px)`,
      `linear-gradient(135deg, ${c} 25%, #000 25% 30%, ${c} 30% 55%, #000 55% 60%, ${c} 60%)`,
    ];
    return `${shade}, ${art[i % art.length]}`;
  }
  protected avatar(j: number) { return AVATAR[j % AVATAR.length]; }
  protected go(e: Event, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', `${location.pathname}#${id}`);
  }
}
