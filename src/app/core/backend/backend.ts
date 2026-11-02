import { InjectionToken, Signal } from '@angular/core';
import { AccountStatus, AppUser, Category, Post, UserAccount, VoteResult } from './models';

/**
 * Contrato del backend. La app solo habla con esta interfaz; hay dos
 * implementaciones: Firebase (producción) y Local (demo sin credenciales).
 */
export interface Backend {
  readonly kind: 'firebase' | 'local';
  readonly user: Signal<AppUser | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Solo modo demo: entra como una cuenta pendiente para probar la pantalla de aprobación. */
  signInPending?(): Promise<void>;
  /** ID token de Firebase. `forceRefresh` llama a `getIdToken(true)`. En modo demo lanza. */
  getIdToken(forceRefresh?: boolean): Promise<string>;

  listCategories(year: number): Promise<Category[]>;
  saveCategory(cat: Omit<Category, 'id'> & { id?: string }): Promise<void>;
  setCategoryOpen(year: number, id: string, open: boolean): Promise<void>;

  /** Mapa categoryId → nominado votado por el usuario actual. */
  myVotes(year: number): Promise<Record<string, string>>;
  castVote(year: number, categoryId: string, nominee: string): Promise<void>;
  tally(year: number, categoryId: string): Promise<VoteResult[]>;

  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(p: { title: string; body: string; tags: string[]; image?: string | null; contestYear?: number | null }): Promise<string>;

  /** Solo admins. Cada usuario puede leer el propio doc; la lista completa no. */
  listUsers(): Promise<UserAccount[]>;
  setUserStatus(uid: string, status: AccountStatus): Promise<void>;
}

export const BACKEND = new InjectionToken<Backend>('BACKEND');

export const voteId = (year: number, categoryId: string, uid: string) => `${year}_${categoryId}_${uid}`;

/** Id estable del post de premios de un año. Las rutas `/votar` y `/premios/:año` apuntan aquí. */
export const contestPostId = (year: number) => `premios-${year}`;

export function contestYearFromId(id: string): number | null {
  const match = /^premios-(\d{4})$/.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? year : null;
}

/** Admin o status `approved`. Pendiente y rechazada no votan. */
export function canParticipate(user: AppUser | null | undefined): boolean {
  return !!user && (user.isAdmin || user.status === 'approved');
}

export function fallbackContestPost(id: string, year: number): Post {
  const historical = year === 2025;
  return {
    id,
    title: `Premios VengaJusti ${year}`,
    body: historical
      ? 'Resultados oficiales de los Premios VJL 2025. Un admin puede publicar este post para sumar una presentación.'
      : 'Categorías y nominados de este año. Mientras la votación esté abierta se vota aquí; al cerrarla, quedan los resultados. Un admin puede publicar el texto oficial de este post.',
    authorUid: 'sistema',
    authorName: 'VengaJusti',
    createdAt: Date.UTC(year, 0, 1),
    tags: ['premios'],
    contestYear: year,
  };
}

export class AlreadyVotedError extends Error {
  constructor() { super('Ya votaste en esta categoría este año.'); }
}

export class PendingAccountError extends Error {
  constructor() { super('Tu cuenta está pendiente de aprobación.'); }
}
