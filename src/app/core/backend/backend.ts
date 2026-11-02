import { InjectionToken, Signal } from '@angular/core';
import { AppUser, Category, Post, VoteResult } from './models';

/**
 * Contrato del backend. La app solo habla con esta interfaz; hay dos
 * implementaciones: Firebase (producción) y Local (demo sin credenciales).
 */
export interface Backend {
  readonly kind: 'firebase' | 'local';
  readonly user: Signal<AppUser | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** ID token de Firebase. `forceRefresh` llama a `getIdToken(true)`. En modo demo lanza. */
  getIdToken(forceRefresh?: boolean): Promise<string>;

  listCategories(year: number): Promise<Category[]>;
  saveCategory(cat: Omit<Category, 'id'> & { id?: string }): Promise<void>;

  /** Mapa categoryId → nominado votado por el usuario actual. */
  myVotes(year: number): Promise<Record<string, string>>;
  castVote(year: number, categoryId: string, nominee: string): Promise<void>;
  tally(year: number, categoryId: string): Promise<VoteResult[]>;

  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(p: { title: string; body: string; tags: string[]; image?: string | null }): Promise<string>;
}

export const BACKEND = new InjectionToken<Backend>('BACKEND');

export const voteId = (year: number, categoryId: string, uid: string) => `${year}_${categoryId}_${uid}`;

export class AlreadyVotedError extends Error {
  constructor() { super('Ya votaste en esta categoría este año.'); }
}
