import { signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  DocumentData, Firestore, addDoc, collection, doc, getDoc, getDocs, getFirestore, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { AlreadyVotedError, Backend, PendingAccountError, canParticipate, contestPostId, voteId } from './backend';
import { AccountStatus, AppUser, Category, Post, UserAccount, VoteResult } from './models';
import { slug } from './local-backend';

type FirebaseConfig = Record<string, string>;

/**
 * Backend real: Firebase Auth (Google) + Firestore. Plan Spark (gratis).
 * Colecciones: users, categories, votes, tallies, posts, admins. Ver firestore.rules.
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
      const isAdmin = !!admin?.exists();
      const account = await this.ensureAccount(u.uid, u.email ?? null, u.displayName ?? 'Sin nombre', u.photoURL ?? null);
      this.user.set({
        uid: u.uid,
        displayName: account.displayName,
        email: account.email,
        photoURL: account.photoURL,
        isAdmin,
        status: isAdmin ? 'approved' : account.status,
      });
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
  async setCategoryOpen(year: number, id: string, open: boolean) {
    if (!this.user()?.isAdmin) throw new Error('Solo admins.');
    await updateDoc(doc(this.db, 'categories', `${year}_${id}`), { open });
  }

  async myVotes(year: number) {
    const u = this.user(); if (!u) return {};
    const s = await getDocs(query(collection(this.db, 'votes'), where('uid', '==', u.uid), where('year', '==', year)));
    return Object.fromEntries(s.docs.map(d => [d.data()['categoryId'], d.data()['nominee']]));
  }

  /** Crea el voto y suma el contador agregado en una transacción. Las reglas impiden duplicados. */
  async castVote(year: number, categoryId: string, nominee: string) {
    const u = this.user();
    if (!u) throw new Error('Inicia sesión primero.');
    if (!canParticipate(u)) throw new PendingAccountError();
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
  async createPost(p: { title: string; body: string; tags: string[]; image?: string | null; contestYear?: number | null }) {
    const u = this.user(); if (!u?.isAdmin) throw new Error('Solo admins.');
    const { image, contestYear, ...rest } = p;
    if (contestYear != null) {
      if (!Number.isInteger(contestYear) || contestYear < 2000 || contestYear > 2100) throw new Error('Año de premios inválido.');
      const id = contestPostId(contestYear);
      const ref = doc(this.db, 'posts', id);
      const prev = await getDoc(ref);
      const prevData = prev.data();
      const prevImage = typeof prevData?.['image'] === 'string' ? prevData['image'] : null;
      await setDoc(ref, {
        ...rest,
        contestYear,
        authorUid: typeof prevData?.['authorUid'] === 'string' ? prevData['authorUid'] : u.uid,
        authorName: typeof prevData?.['authorName'] === 'string' ? prevData['authorName'] : u.displayName,
        createdAt: typeof prevData?.['createdAt'] === 'number' ? prevData['createdAt'] : Date.now(),
        ...(image ? { image } : prevImage ? { image: prevImage } : {}),
      });
      return id;
    }
    const r = await addDoc(collection(this.db, 'posts'), {
      ...rest, authorUid: u.uid, authorName: u.displayName, createdAt: Date.now(),
      ...(image ? { image } : {}),
    });
    return r.id;
  }

  async listUsers() {
    if (!this.user()?.isAdmin) throw new Error('Solo admins.');
    const s = await getDocs(collection(this.db, 'users'));
    return s.docs.map(d => asAccount(d.id, d.data())).sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  }
  async setUserStatus(uid: string, status: AccountStatus) {
    const me = this.user();
    if (!me?.isAdmin) throw new Error('Solo admins.');
    await updateDoc(doc(this.db, 'users', uid), {
      status,
      approvedAt: status === 'approved' ? Date.now() : null,
      approvedBy: status === 'pending' ? null : me.uid,
    });
    if (me.uid === uid) {
      this.user.set({ ...me, status: 'approved' });
    }
  }

  /**
   * Crea `users/{uid}` en `pending` si no existe. Si las reglas todavía no están
   * publicadas, la escritura falla y la sesión queda pendiente (los admins siguen aprobados).
   */
  private async ensureAccount(uid: string, email: string | null, displayName: string, photoURL: string | null): Promise<UserAccount> {
    const draft: UserAccount = {
      uid,
      email,
      displayName: displayName.slice(0, 80) || 'Sin nombre',
      photoURL,
      status: 'pending',
      createdAt: Date.now(),
      approvedAt: null,
      approvedBy: null,
    };
    const ref = doc(this.db, 'users', uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        try { await setDoc(ref, accountData(draft)); } catch { /* carrera o reglas aún no publicadas */ }
        const again = await getDoc(ref);
        return again.exists() ? asAccount(uid, again.data()) : draft;
      }
      return asAccount(uid, snap.data());
    } catch {
      return draft;
    }
  }
}

function accountData(account: UserAccount) {
  return {
    email: account.email,
    displayName: account.displayName,
    photoURL: account.photoURL,
    status: 'pending' as const,
    createdAt: account.createdAt,
    approvedAt: null,
    approvedBy: null,
  };
}

function asAccount(uid: string, data: DocumentData): UserAccount {
  const status = data['status'];
  return {
    uid,
    email: typeof data['email'] === 'string' ? data['email'] : null,
    displayName: typeof data['displayName'] === 'string' && data['displayName'] ? data['displayName'] : 'Sin nombre',
    photoURL: typeof data['photoURL'] === 'string' ? data['photoURL'] : null,
    status: status === 'approved' || status === 'rejected' || status === 'pending' ? status : 'pending',
    createdAt: typeof data['createdAt'] === 'number' ? data['createdAt'] : 0,
    approvedAt: typeof data['approvedAt'] === 'number' ? data['approvedAt'] : null,
    approvedBy: typeof data['approvedBy'] === 'string' ? data['approvedBy'] : null,
  };
}
