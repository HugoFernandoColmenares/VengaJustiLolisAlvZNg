import { Component, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BACKEND } from '../core/backend/backend';
import { AccountStatus, Category } from '../core/backend/models';
import { httpsImageUrl } from '../core/data/image-optimize.data';
import { environment } from '../../environments/environment';
import { ImageField } from '../shared/image-field';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, ImageField],
  template: `
    <div class="container page stack">
      <h1 class="page-title">Panel admin</h1>
      @if (!backend.user()) {
        <div class="card card__body center"><p>Inicia sesión para continuar.</p>
          <div class="actions">
            <button class="btn btn--pink" type="button" (click)="backend.signIn()">
              {{ backend.kind === 'local' ? 'Entrar como admin de prueba' : 'Iniciar sesión con Google' }}
            </button>
            @if (backend.kind === 'local') {
              <button class="btn" type="button" (click)="backend.signInPending?.()">Entrar como cuenta pendiente</button>
            }
          </div>
        </div>
      } @else if (!backend.user()!.isAdmin) {
        <p class="notice notice--error">Tu cuenta no es admin. Pide que te agreguen en la colección <code>admins</code> desde la consola de Firebase.</p>
        <p class="center"><button class="btn" type="button" (click)="backend.signOut()">Cerrar sesión</button></p>
      } @else {
        @if (msg()) { <p class="notice notice--ok" role="status">{{ msg() }}</p> }
        @if (err()) { <p class="notice notice--error" role="alert">{{ err() }}</p> }

        <section class="stack" aria-labelledby="usuarios">
          <h2 id="usuarios" class="section-title">Usuarios</h2>
          <p class="hint">Quien entra con Google queda en pendiente. Aprueba, rechaza o revoca. Quien tiene doc en <code>admins</code> se trata como aprobada aunque aquí diga otra cosa.</p>
          @if (roster.isLoading()) { <p class="notice" role="status">Cargando cuentas…</p> }
          @if (roster.error()) { <p class="notice notice--error" role="alert">No se pudieron cargar las cuentas.</p> }
          <ul class="user-list">
            @for (u of roster.value() ?? []; track u.uid) {
              <li class="card card__body user">
                <p><strong>{{ u.displayName }}</strong>
                  @if (u.uid === backend.user()?.uid) { <span class="badge">Admin</span> }
                </p>
                <p>{{ u.email || 'Sin correo' }}</p>
                <p><span class="badge">{{ label(u.status) }}</span></p>
                <div class="actions">
                  <button class="btn btn--yellow" type="button" [disabled]="u.status === 'approved'" (click)="setStatus(u.uid, 'approved')">Aprobar</button>
                  <button class="btn btn--pink" type="button" [disabled]="u.status === 'rejected'" (click)="setStatus(u.uid, 'rejected')">Rechazar</button>
                  <button class="btn" type="button" [disabled]="u.status === 'pending'" (click)="setStatus(u.uid, 'pending')">Revocar</button>
                </div>
              </li>
            } @empty { @if (!roster.isLoading()) { <li class="notice">Todavía no hay cuentas. Aparecen cuando alguien inicia sesión con Google.</li> } }
          </ul>
        </section>

        <div class="grid grid--2">
          <form class="card card__body" (ngSubmit)="savePost()" #pf="ngForm">
            <h2 class="section-title">Nuevo post</h2>
            <div class="field"><label for="pt">Título</label><input id="pt" name="title" [(ngModel)]="post.title" required maxlength="140"></div>
            <div class="field"><label for="pb">Contenido</label><textarea id="pb" name="body" [(ngModel)]="post.body" required></textarea>
              <span class="hint">Texto plano; los saltos de línea se respetan.</span></div>
            <div class="field"><label for="pg">Etiquetas</label><input id="pg" name="tags" [(ngModel)]="post.tags" placeholder="lore, premios"></div>
            <div class="field">
              <label for="py">Año de premios (opcional)</label>
              <input id="py" name="pyear" type="number" min="2000" max="2100" [(ngModel)]="post.contestYear" placeholder="2026">
              <span class="hint">Si lo llenas, el post usa el id premios-AÑO, muestra las categorías de ese año y las rutas /votar y /premios/AÑO llegan ahí.</span>
            </div>
            <app-image-field label="Portada del post" folder="posts" [url]="post.image" (urlChange)="post.image = $event" (busyChange)="onBusy($event)" />
            <button class="btn btn--pink" type="submit" [disabled]="pf.invalid || uploads() > 0">Publicar</button>
          </form>
          <form class="card card__body" (ngSubmit)="saveCat()" #cf="ngForm">
            <h2 class="section-title">Categoría {{ year }}</h2>
            <div class="field"><label for="ct">Título</label><input id="ct" name="ctitle" [(ngModel)]="cat.title" required></div>
            <div class="field"><label for="cd">Descripción</label><input id="cd" name="cdesc" [(ngModel)]="cat.description"></div>
            <div class="field"><label for="cn">Nominados (uno por línea)</label><textarea id="cn" name="cnom" [(ngModel)]="cat.nominees" required></textarea></div>
            <app-image-field label="Portada de la categoría" folder="categories" [url]="cat.image" (urlChange)="cat.image = $event" (busyChange)="onBusy($event)" />
            @for (n of nomineeNames(); track n) {
              <app-image-field [label]="'Foto de ' + n" folder="nominees" [url]="cat.nomineeImages[n] || ''"
                               (urlChange)="setNomineeImage(n, $event)" (busyChange)="onBusy($event)" />
            }
            <div class="field"><label for="co">Orden</label><input id="co" type="number" name="corder" [(ngModel)]="cat.order"></div>
            <label class="check"><input type="checkbox" name="copen" [(ngModel)]="cat.open"> Votación abierta</label>
            <button class="btn btn--yellow" type="submit" [disabled]="cf.invalid || uploads() > 0">Guardar categoría</button>
          </form>
        </div>

        <section class="card card__body" aria-labelledby="cats">
          <h2 id="cats" class="section-title">Categorías {{ year }}</h2>
          <ul class="cat-list">
            @for (c of cats.value() ?? []; track c.id) {
              <li class="cat-row">
                <span><strong>{{ c.title }}</strong> · {{ c.open ? 'Abierta' : 'Cerrada' }}</span>
                <button class="btn" type="button" (click)="toggle(c)">{{ c.open ? 'Cerrar votación' : 'Abrir votación' }}</button>
              </li>
            } @empty { <li class="notice">Sin categorías para {{ year }}.</li> }
          </ul>
        </section>
        <p class="center"><button class="btn" type="button" (click)="backend.signOut()">Cerrar sesión</button></p>
      }
    </div>
  `,
  styles: `
    .center { text-align: center; }
    .hint { display: block; }
    .actions { display: flex; flex-wrap: wrap; gap: .8rem; }
    .center .actions { justify-content: center; }
    .user-list, .cat-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.2rem; }
    .user { display: flex; flex-direction: column; gap: .8rem; overflow-wrap: anywhere; }
    .user p { margin: 0; }
    .check { display: flex; align-items: center; gap: .8rem; font-weight: 700; margin: 0 0 1.6rem; }
    .cat-row { display: flex; flex-wrap: wrap; gap: .8rem 1.2rem; align-items: center; justify-content: space-between; }
  `,
})
export class AdminPage {
  protected readonly backend = inject(BACKEND);
  private readonly router = inject(Router);
  protected readonly year = environment.votingYear;
  protected readonly msg = signal('');
  protected readonly err = signal('');
  protected readonly uploads = signal(0);
  private readonly tick = signal(0);
  protected post = { title: '', body: '', tags: '', image: '', contestYear: null as number | null };
  protected cat = { title: '', description: '', nominees: '', order: 10, image: '', open: true, nomineeImages: {} as Record<string, string> };

  protected readonly roster = resource({
    params: () => ({ admin: !!this.backend.user()?.isAdmin, tick: this.tick() }),
    loader: ({ params }) => params.admin ? this.backend.listUsers() : Promise.resolve([]),
  });
  protected readonly cats = resource({
    params: () => ({ admin: !!this.backend.user()?.isAdmin, tick: this.tick(), year: this.year }),
    loader: ({ params }) => params.admin ? this.backend.listCategories(params.year) : Promise.resolve([]),
  });

  protected nomineeNames(): string[] {
    return this.cat.nominees.split('\n').map(n => n.trim()).filter(Boolean);
  }
  protected setNomineeImage(name: string, url: string) {
    const next = { ...this.cat.nomineeImages };
    if (url) next[name] = url;
    else delete next[name];
    this.cat.nomineeImages = next;
  }
  protected onBusy(active: boolean) { this.uploads.update(n => Math.max(0, n + (active ? 1 : -1))); }
  protected label(status: AccountStatus) {
    if (status === 'approved') return 'Aprobado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente';
  }

  protected async savePost() {
    this.err.set('');
    const image = httpsImageUrl(this.post.image);
    const contestYear = this.post.contestYear ? Number(this.post.contestYear) : null;
    try {
      const id = await this.backend.createPost({
        title: this.post.title.trim(), body: this.post.body.trim(),
        tags: this.post.tags.split(',').map(t => t.trim()).filter(Boolean),
        ...(image ? { image } : {}),
        ...(contestYear ? { contestYear } : {}),
      });
      this.router.navigate(['/posts', id]);
    } catch (e) {
      this.err.set((e as Error).message || 'No se pudo publicar.');
    }
  }
  protected async saveCat() {
    this.err.set('');
    const names = this.nomineeNames();
    const nomineeImages = names.flatMap(n => {
      const url = httpsImageUrl(this.cat.nomineeImages[n]);
      return url ? [{ name: n, image: url }] : [];
    });
    const image = httpsImageUrl(this.cat.image);
    try {
      await this.backend.saveCategory({
        year: this.year, title: this.cat.title.trim(), description: this.cat.description.trim(),
        open: this.cat.open, order: Number(this.cat.order) || 10, nominees: names,
        ...(image ? { image } : {}),
        ...(nomineeImages.length ? { nomineeImages } : {}),
      });
      this.msg.set(`Categoría "${this.cat.title}" guardada.`);
      this.cat = { title: '', description: '', nominees: '', order: 10, image: '', open: true, nomineeImages: {} };
      this.tick.update(n => n + 1);
    } catch (e) {
      this.err.set((e as Error).message || 'No se pudo guardar la categoría.');
    }
  }
  protected async toggle(cat: Category) {
    this.err.set('');
    try {
      await this.backend.setCategoryOpen(cat.year, cat.id, !cat.open);
      this.msg.set(cat.open ? `Se cerró "${cat.title}".` : `Se abrió "${cat.title}".`);
      this.tick.update(n => n + 1);
    } catch (e) {
      this.err.set((e as Error).message || 'No se pudo actualizar la categoría.');
    }
  }
  protected async setStatus(uid: string, status: AccountStatus) {
    this.err.set('');
    try {
      await this.backend.setUserStatus(uid, status);
      this.msg.set('Listo. El estado de la cuenta quedó actualizado.');
      this.tick.update(n => n + 1);
    } catch (e) {
      this.err.set((e as Error).message || 'No se pudo actualizar la cuenta.');
    }
  }
}
