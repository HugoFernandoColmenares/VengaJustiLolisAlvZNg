import { signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  Firestore, addDoc, collection, doc, getDoc, getDocs, getFirestore, orderBy, query, runTransaction, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { AlreadyVotedError, Backend, voteId } from './backend';
import { AppUser, Category, Post, VoteResult } from './models';
import { slug } from './local-backend';

type FirebaseConfig = Record<string, string>;

/**
 * Backend real: Firebase Auth (Google) + Firestore. Plan Spark (gratis).
 * Colecciones: categories, votes, tallies, posts, admins. Ver firestore.rules.
 */
export class FirebaseBackend implements Backend {
  readonly kind = 'firebase' as const;
  readonly user = signal<AppUser | null>(null);
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;

  constructor(config: FirebaseConfig) {
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    onAuthStateChanged(this.auth, async u => {
      if (!u) return this.user.set(null);
      const admin = await getDoc(doc(this.db, 'admins', u.uid)).catch(() => null);
      this.user.set({ uid: u.uid, displayName: u.displayName ?? 'Anónima', email: u.email, isAdmin: !!admin?.exists() });
    });
  }

  async signIn() { await signInWithPopup(this.auth, new GoogleAuthProvider()); }
  async signOut() { await signOut(this.auth); }
  async getIdToken(forceRefresh = false) {
    const current = this.auth.currentUser;
    if (!current) throw new Error('Inicia sesión primero.');
    return current.getIdToken(forceRefresh);
  }

  async listCategories(year: number) {
    const s = await getDocs(query(collection(this.db, 'categories'), where('year', '==', year)));
    return s.docs.map(d => ({ ...(d.data() as Omit<Category, 'id'>), id: d.data()['slug'] ?? d.id })).sort((a, b) => a.order - b.order);
  }
  async saveCategory(c: Omit<Category, 'id'> & { id?: string }) {
    const id = c.id || slug(c.title);
    // id de documento = `${year}_${slug}` para que la misma categoría exista en varios años.
    await setDoc(doc(this.db, 'categories', `${c.year}_${id}`), { ...c, slug: id, id: null });
  }

  async myVotes(year: number) {
    const u = this.user(); if (!u) return {};
    const s = await getDocs(query(collection(this.db, 'votes'), where('uid', '==', u.uid), where('year', '==', year)));
    return Object.fromEntries(s.docs.map(d => [d.data()['categoryId'], d.data()['nominee']]));
  }

  /** Crea el voto y suma el contador agregado en una transacción. Las reglas impiden duplicados. */
  async castVote(year: number, categoryId: string, nominee: string) {
    const u = this.user(); if (!u) throw new Error('Inicia sesión primero.');
    const vRef = doc(this.db, 'votes', voteId(year, categoryId, u.uid));
    const tRef = doc(this.db, 'tallies', `${year}_${categoryId}`);
    await runTransaction(this.db, async tx => {
      if ((await tx.get(vRef)).exists()) throw new AlreadyVotedError();
      const t = await tx.get(tRef);
      const counts = (t.data()?.['counts'] ?? {}) as Record<string, number>;
      tx.set(vRef, { year, categoryId, uid: u.uid, nominee, createdAt: serverTimestamp() });
      tx.set(tRef, { year, categoryId, counts: { ...counts, [nominee]: (counts[nominee] ?? 0) + 1 } });
    });
  }
  async tally(year: number, categoryId: string): Promise<VoteResult[]> {
    const t = await getDoc(doc(this.db, 'tallies', `${year}_${categoryId}`));
    const counts = (t.data()?.['counts'] ?? {}) as Record<string, number>;
    return Object.entries(counts).map(([name, votes]) => ({ name, votes })).sort((a, b) => b.votes - a.votes);
  }

  async listPosts() {
    const s = await getDocs(query(collection(this.db, 'posts'), orderBy('createdAt', 'desc')));
    return s.docs.map(d => ({ ...(d.data() as Omit<Post, 'id'>), id: d.id }));
  }
  async getPost(id: string) {
    const d = await getDoc(doc(this.db, 'posts', id));
    return d.exists() ? ({ ...(d.data() as Omit<Post, 'id'>), id: d.id }) : null;
  }
  async createPost(p: { title: string; body: string; tags: string[]; image?: string | null }) {
    const u = this.user(); if (!u) throw new Error('Inicia sesión primero.');
    const { image, ...rest } = p;
    const r = await addDoc(collection(this.db, 'posts'), {
      ...rest, authorUid: u.uid, authorName: u.displayName, createdAt: Date.now(),
      ...(image ? { image } : {}),
    });
    return r.id;
  }
}
