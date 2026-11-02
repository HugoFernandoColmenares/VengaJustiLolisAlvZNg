import { signal } from '@angular/core';
import { AlreadyVotedError, Backend, voteId } from './backend';
import { AppUser, Category, Post, Vote, VoteResult } from './models';
import { environment } from '../../../environments/environment';

const KEY = 'vjl-demo-db-v1';
interface Db { categories: Category[]; votes: Record<string, Vote>; posts: Post[]; user: AppUser | null }

const year = environment.votingYear;
const seed = (): Db => ({
  user: null,
  votes: {},
  categories: [
    { id: 'miembro-del-ano', year, title: 'Miembro del Año', description: 'El alma (o el caos) del chat.', nominees: ['Feith Noir', 'Kevin', 'Ralex', 'Migueru-san', 'Yohane'], open: true, order: 1 },
    { id: 'momento-destacado', year, title: 'Momento Destacado', description: 'Lo que nadie vio venir.', nominees: ['Propuesta 1', 'Propuesta 2', 'Propuesta 3'], open: true, order: 2 },
    { id: 'admin-del-ano', year, title: 'Admin del Año', description: 'Quien manejó el caos con maestría.', nominees: ['Feith Noir', 'Ralex', 'Rue'], open: true, order: 3 },
  ],
  posts: [
    {
      id: 'bienvenida', title: 'Modo demo activo', authorUid: 'demo', authorName: 'Sistema', createdAt: Date.now(), tags: ['demo'],
      body: 'Este post vive solo en tu navegador (localStorage). Cuando se configure Firebase, los posts y votos serán compartidos por todo el grupo.',
    },
  ],
});

/** Backend de demostración: todo en localStorage. El usuario demo es admin para poder probar todo. */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  private db: Db = this.load();
  readonly user = signal<AppUser | null>(this.db.user);

  private load(): Db {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Db; } catch { /* sin storage */ }
    return seed();
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch { /* ignore */ } }

  async signIn() {
    const u: AppUser = { uid: 'demo-user', displayName: 'Loli de prueba', email: null, isAdmin: true };
    this.db.user = u; this.user.set(u); this.save();
  }
  async signOut() { this.db.user = null; this.user.set(null); this.save(); }
  async getIdToken(): Promise<string> { throw new Error('Modo demo: no hay token de Firebase.'); }

  async listCategories(y: number) { return this.db.categories.filter(c => c.year === y).sort((a, b) => a.order - b.order); }
  async saveCategory(c: Omit<Category, 'id'> & { id?: string }) {
    this.requireAdmin();
    const id = c.id || slug(c.title);
    this.db.categories = [...this.db.categories.filter(x => !(x.id === id && x.year === c.year)), { ...c, id }];
    this.save();
  }

  async myVotes(y: number) {
    const u = this.user(); if (!u) return {};
    return Object.fromEntries(Object.values(this.db.votes).filter(v => v.year === y && v.uid === u.uid).map(v => [v.categoryId, v.nominee]));
  }
  async castVote(y: number, categoryId: string, nominee: string) {
    const u = this.requireUser();
    const id = voteId(y, categoryId, u.uid);
    if (this.db.votes[id]) throw new AlreadyVotedError();
    this.db.votes[id] = { year: y, categoryId, uid: u.uid, nominee, createdAt: Date.now() };
    this.save();
  }
  async tally(y: number, categoryId: string): Promise<VoteResult[]> {
    const cat = this.db.categories.find(c => c.id === categoryId && c.year === y);
    const counts = new Map((cat?.nominees ?? []).map(n => [n, 0]));
    Object.values(this.db.votes).filter(v => v.year === y && v.categoryId === categoryId).forEach(v => counts.set(v.nominee, (counts.get(v.nominee) ?? 0) + 1));
    return [...counts].map(([name, votes]) => ({ name, votes })).sort((a, b) => b.votes - a.votes);
  }

  async listPosts() { return [...this.db.posts].sort((a, b) => b.createdAt - a.createdAt); }
  async getPost(id: string) { return this.db.posts.find(p => p.id === id) ?? null; }
  async createPost(p: { title: string; body: string; tags: string[]; image?: string | null }) {
    const u = this.requireAdmin();
    const id = `${slug(p.title)}-${Date.now().toString(36)}`;
    const { image, ...rest } = p;
    this.db.posts.push({ ...rest, ...(image ? { image } : {}), id, authorUid: u.uid, authorName: u.displayName, createdAt: Date.now() });
    this.save();
    return id;
  }

  private requireUser() { const u = this.user(); if (!u) throw new Error('Inicia sesión primero.'); return u; }
  private requireAdmin() { const u = this.requireUser(); if (!u.isAdmin) throw new Error('Solo admins.'); return u; }
}

export const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
