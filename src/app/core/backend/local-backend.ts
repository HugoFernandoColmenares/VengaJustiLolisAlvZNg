import { signal } from '@angular/core';
import { AlreadyVotedError, Backend, PendingAccountError, canParticipate, contestPostId, voteId } from './backend';
import { AccountStatus, AppUser, Category, Post, UserAccount, Vote, VoteResult } from './models';
import { environment } from '../../../environments/environment';

const KEY = 'vjl-demo-db-v1';
interface Db {
  categories: Category[];
  votes: Record<string, Vote>;
  posts: Post[];
  users: UserAccount[];
  user: AppUser | null;
}

const year = environment.votingYear;
const seededAt = Date.UTC(2026, 0, 15);

const pendingUser = (uid: string, displayName: string, email: string): UserAccount => ({
  uid, email, displayName, photoURL: null, status: 'pending', createdAt: seededAt, approvedAt: null, approvedBy: null,
});

const seed = (): Db => ({
  user: null,
  votes: {
    '2026_admin-del-ano_user-kevin': { year: 2026, categoryId: 'admin-del-ano', uid: 'user-kevin', nominee: 'Feith Noir', createdAt: seededAt },
    '2026_admin-del-ano_user-ralex': { year: 2026, categoryId: 'admin-del-ano', uid: 'user-ralex', nominee: 'Feith Noir', createdAt: seededAt },
    '2026_admin-del-ano_user-yohane': { year: 2026, categoryId: 'admin-del-ano', uid: 'user-yohane', nominee: 'Ralex', createdAt: seededAt },
  },
  users: [
    { uid: 'demo-user', email: 'dragonscuro@gmail.com', displayName: 'Admin de prueba', photoURL: null, status: 'approved', createdAt: seededAt, approvedAt: seededAt, approvedBy: 'console' },
    pendingUser('user-kevin', 'Kevin', 'kevin@example.com'),
    pendingUser('user-ralex', 'Ralex', 'ralex@example.com'),
    pendingUser('user-yohane', 'Yohane', 'yohane@example.com'),
  ],
  categories: [
    { id: 'miembro-del-ano', year, title: 'Miembro del Año', description: 'El alma (o el caos) del chat.', nominees: ['Feith Noir', 'Kevin', 'Ralex', 'Migueru-san', 'Yohane'], open: true, order: 1 },
    { id: 'momento-destacado', year, title: 'Momento Destacado', description: 'Lo que nadie vio venir.', nominees: ['Propuesta 1', 'Propuesta 2', 'Propuesta 3'], open: true, order: 2 },
    { id: 'admin-del-ano', year, title: 'Admin del Año', description: 'Quien manejó el caos con maestría. Esta categoría ya cerró: se ven los resultados.', nominees: ['Feith Noir', 'Ralex', 'Rue'], open: false, order: 3 },
  ],
  posts: [
    {
      id: 'premios-2026', title: 'Premios VengaJusti 2026', authorUid: 'demo-user', authorName: 'Sistema',
      createdAt: Date.UTC(2026, 10, 1), tags: ['premios', 'votacion'], contestYear: 2026,
      body: 'Categorías y nominados de este año. Vota mientras la categoría siga abierta. Si ya cerró, aquí están los resultados.',
    },
    {
      id: 'premios-2025', title: 'Premios VengaJusti 2025', authorUid: 'demo-user', authorName: 'Sistema',
      createdAt: Date.UTC(2025, 11, 20), tags: ['premios', 'resultados'], contestYear: 2025,
      body: 'Resultados oficiales de 2025, con gráficos y la voz del pueblo. La votación de ese año ya cerró.',
    },
    {
      id: 'bienvenida', title: 'Modo demo activo', authorUid: 'demo', authorName: 'Sistema', createdAt: Date.UTC(2026, 9, 1), tags: ['demo'],
      body: 'Este post vive solo en tu navegador (localStorage). Cuando se configure Firebase, los posts y votos serán compartidos por todo el grupo.',
    },
  ],
});

/** Backend de demostración: todo en localStorage. `signIn` entra como admin aprobado; `signInPending` como cuenta en espera. */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  private db: Db = this.load();
  readonly user = signal<AppUser | null>(this.db.user);

  private load(): Db {
    const base = seed();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<Db>;
      const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
      const missingContests = base.posts.filter(p => p.contestYear != null && !posts.some(x => x.id === p.id));
      return {
        user: normalizeSession(parsed.user ?? null),
        votes: parsed.votes ?? {},
        categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : base.categories,
        posts: [...missingContests, ...posts],
        users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : base.users,
      };
    } catch { /* sin storage */ }
    return base;
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch { /* ignore */ } }

  async signIn() {
    const account = this.upsertUser({
      ...(this.db.users.find(u => u.uid === 'demo-user') ?? seed().users[0]),
      status: 'approved',
      approvedAt: seededAt,
      approvedBy: 'console',
    });
    this.setSession(toSession(account, true));
  }
  async signInPending() {
    const account = this.db.users.find(u => u.uid === 'user-kevin') ?? seed().users[1];
    this.upsertUser(account);
    this.setSession(toSession(account, false));
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
  async setCategoryOpen(y: number, id: string, open: boolean) {
    this.requireAdmin();
    const cat = this.db.categories.find(c => c.year === y && c.id === id);
    if (!cat) throw new Error('No existe esa categoría.');
    cat.open = open;
    this.save();
  }

  async myVotes(y: number) {
    const u = this.user(); if (!u) return {};
    return Object.fromEntries(Object.values(this.db.votes).filter(v => v.year === y && v.uid === u.uid).map(v => [v.categoryId, v.nominee]));
  }
  async castVote(y: number, categoryId: string, nominee: string) {
    const u = this.requireApproved();
    const id = voteId(y, categoryId, u.uid);
    if (this.db.votes[id]) throw new AlreadyVotedError();
    const cat = this.db.categories.find(c => c.id === categoryId && c.year === y);
    if (!cat?.open) throw new Error('Esta categoría ya cerró.');
    if (cat && !cat.nominees.includes(nominee)) throw new Error('Ese nominado no está en la categoría.');
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
  async createPost(p: { title: string; body: string; tags: string[]; image?: string | null; contestYear?: number | null }) {
    const u = this.requireAdmin();
    const { image, contestYear, ...rest } = p;
    if (contestYear != null) {
      if (!Number.isInteger(contestYear) || contestYear < 2000 || contestYear > 2100) throw new Error('Año de premios inválido.');
      const id = contestPostId(contestYear);
      const prev = this.db.posts.find(x => x.id === id);
      const next: Post = {
        ...rest, id, contestYear,
        authorUid: prev?.authorUid ?? u.uid,
        authorName: prev?.authorName ?? u.displayName,
        createdAt: prev?.createdAt ?? Date.now(),
        ...(image ? { image } : prev?.image ? { image: prev.image } : {}),
      };
      this.db.posts = [...this.db.posts.filter(x => x.id !== id), next];
      this.save();
      return id;
    }
    const id = `${slug(p.title)}-${Date.now().toString(36)}`;
    this.db.posts.push({ ...rest, ...(image ? { image } : {}), id, authorUid: u.uid, authorName: u.displayName, createdAt: Date.now() });
    this.save();
    return id;
  }

  async listUsers() {
    this.requireAdmin();
    return [...this.db.users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  }
  async setUserStatus(uid: string, status: AccountStatus) {
    const me = this.requireAdmin();
    const account = this.db.users.find(u => u.uid === uid);
    if (!account) throw new Error('Esa cuenta no existe.');
    account.status = status;
    account.approvedAt = status === 'approved' ? Date.now() : null;
    account.approvedBy = status === 'pending' ? null : me.uid;
    this.save();
    const session = this.user();
    if (session?.uid === uid) this.user.set(toSession(account, session.isAdmin));
  }

  private setSession(u: AppUser) { this.db.user = u; this.user.set(u); this.save(); }
  private upsertUser(account: UserAccount) {
    this.db.users = [...this.db.users.filter(u => u.uid !== account.uid), account];
    this.save();
    return account;
  }
  private requireUser() { const u = this.user(); if (!u) throw new Error('Inicia sesión primero.'); return u; }
  private requireApproved() {
    const u = this.requireUser();
    if (!canParticipate(u)) throw new PendingAccountError();
    return u;
  }
  private requireAdmin() { const u = this.requireUser(); if (!u.isAdmin) throw new Error('Solo admins.'); return u; }
}

function toSession(account: UserAccount, isAdmin: boolean): AppUser {
  return {
    uid: account.uid,
    displayName: account.displayName,
    email: account.email,
    photoURL: account.photoURL,
    isAdmin,
    status: isAdmin ? 'approved' : account.status,
  };
}

function normalizeSession(user: AppUser | null): AppUser | null {
  if (!user) return null;
  const isAdmin = !!user.isAdmin;
  const status = user.status ?? (isAdmin ? 'approved' : 'pending');
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    isAdmin,
    status: isAdmin ? 'approved' : status,
  };
}

export const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
