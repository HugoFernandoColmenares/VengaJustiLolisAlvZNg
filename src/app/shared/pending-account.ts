import { Component, inject, input } from '@angular/core';
import { BACKEND } from '../core/backend/backend';
import { AccountStatus } from '../core/backend/models';

@Component({
  selector: 'app-pending-account',
  template: `
    <section class="card pending" role="status" aria-labelledby="pendiente-titulo">
      <h2 id="pendiente-titulo" class="card__head">Tu cuenta está pendiente de aprobación</h2>
      <div class="card__body">
        <p>Un admin del grupo tiene que aceptarte antes de que puedas votar.</p>
        @if (status() === 'rejected') {
          <p>Tu solicitud fue rechazada. Si crees que es un error, escríbele a un admin.</p>
        }
        <p>Mientras tanto puedes leer los posts y el lore.</p>
        <button class="btn" type="button" (click)="backend.signOut()">Cerrar sesión</button>
      </div>
    </section>
  `,
  styles: `
    .pending { max-width: 72rem; margin: 0 auto; }
    .card__body { display: flex; flex-direction: column; gap: 1.2rem; align-items: flex-start; }
    p { margin: 0; }
  `,
})
export class PendingAccount {
  readonly status = input<AccountStatus>('pending');
  protected readonly backend = inject(BACKEND);
}
