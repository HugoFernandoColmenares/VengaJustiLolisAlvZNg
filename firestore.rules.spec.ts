import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const PROJECT = 'demo-vengajusti';
const CATEGORY = '2026_miembro-del-ano';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin1'), { name: 'Admin' });
    await setDoc(doc(db, `categories/${CATEGORY}`), {
      year: 2026,
      slug: 'miembro-del-ano',
      title: 'Miembro del Año',
      description: 'demo',
      nominees: ['Ana', 'Bob'],
      open: true,
      order: 1,
    });
    await setDoc(doc(db, 'users/aprobada'), profile('aprobada@example.com', 'Aprobada', 'approved'));
    await setDoc(doc(db, 'users/pendiente'), profile('pendiente@example.com', 'Pendiente', 'pending'));
  });
});

describe('users', () => {
  it('deja crear solo el propio doc en pending', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), profile('alice@example.com', 'Alice', 'pending')));
    await assertFails(setDoc(doc(alice, 'users/alice-2'), profile('alice@example.com', 'Alice', 'pending')));
    await assertFails(setDoc(doc(alice, 'users/alice'), profile('alice@example.com', 'Alice', 'approved')));
    await assertFails(setDoc(doc(alice, 'users/otra'), profile('alice@example.com', 'Alice', 'pending')));
  });

  it('niega el alta si el email no es el del token o sobra un campo', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com', picture: 'https://img.example/a.png' }).firestore();
    await assertFails(setDoc(doc(alice, 'users/alice'), profile('otra@example.com', 'Alice', 'pending')));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...profile('alice@example.com', 'Alice', 'pending'), isAdmin: true }));
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), {
      ...profile('alice@example.com', 'Alice', 'pending'),
      photoURL: 'https://img.example/a.png',
    }));
  });

  it('cada quien lee su doc; la lista y el doc ajeno solo los ve un admin', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await setDoc(doc(alice, 'users/alice'), profile('alice@example.com', 'Alice', 'pending'));
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
    await assertFails(getDoc(doc(alice, 'users/pendiente')));
    await assertFails(getDocs(collection(alice, 'users')));

    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, 'users')));
    await assertFails(getDoc(doc(anon, 'users/alice')));

    const admin = testEnv.authenticatedContext('admin1', { email: 'admin@example.com' }).firestore();
    await assertSucceeds(getDocs(collection(admin, 'users')));
    await assertSucceeds(getDoc(doc(admin, 'users/pendiente')));
  });

  it('el usuario no cambia su estado; el admin sí, y no otros campos', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await setDoc(doc(alice, 'users/alice'), profile('alice@example.com', 'Alice', 'pending'));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { status: 'approved', approvedAt: 2, approvedBy: 'alice' }));

    const admin = testEnv.authenticatedContext('admin1', { email: 'admin@example.com' }).firestore();
    await assertSucceeds(updateDoc(doc(admin, 'users/alice'), { status: 'approved', approvedAt: 2, approvedBy: 'admin1' }));
    await assertSucceeds(updateDoc(doc(admin, 'users/alice'), { status: 'rejected', approvedAt: null, approvedBy: 'admin1' }));
    await assertSucceeds(updateDoc(doc(admin, 'users/alice'), { status: 'pending', approvedAt: null, approvedBy: null }));
    await assertFails(updateDoc(doc(admin, 'users/alice'), { email: 'robada@example.com' }));
    await assertFails(updateDoc(doc(admin, 'users/alice'), { status: 'approved', approvedAt: 3, approvedBy: 'otra' }));
  });

  it('nadie escribe la colección admins desde el cliente', async () => {
    const admin = testEnv.authenticatedContext('admin1').firestore();
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await assertFails(setDoc(doc(admin, 'admins/alice'), { name: 'no' }));
    await assertFails(setDoc(doc(alice, 'admins/alice'), { name: 'no' }));
    await assertSucceeds(getDoc(doc(admin, 'admins/admin1')));
    await assertFails(getDoc(doc(alice, 'admins/admin1')));
  });
});

describe('votos', () => {
  it('una cuenta aprobada vota una vez y suma el conteo', async () => {
    const db = testEnv.authenticatedContext('aprobada', { email: 'aprobada@example.com' }).firestore();
    await assertSucceeds(cast(db, 'aprobada', 'Ana'));
    await assertFails(cast(db, 'aprobada', 'Bob'));
    const tally = await getDoc(doc(db, 'tallies/2026_miembro-del-ano'));
    expect(tally.data()?.['counts']).toEqual({ Ana: 1 });
  });

  it('pendiente, rechazada y anónima no votan; un admin sin users/{uid} sí', async () => {
    const pending = testEnv.authenticatedContext('pendiente', { email: 'pendiente@example.com' }).firestore();
    await assertFails(cast(pending, 'pendiente', 'Ana'));

    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), 'users/pendiente'), { status: 'rejected', approvedAt: null, approvedBy: 'admin1' });
    });
    await assertFails(cast(pending, 'pendiente', 'Ana'));

    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anon, 'votes/2026_miembro-del-ano_anon'), {
      year: 2026, categoryId: 'miembro-del-ano', uid: 'anon', nominee: 'Ana', createdAt: 1,
    }));

    const admin = testEnv.authenticatedContext('admin1', { email: 'admin@example.com' }).firestore();
    await assertSucceeds(cast(admin, 'admin1', 'Bob'));
  });

  it('no acepta nominado ajeno ni categoría cerrada', async () => {
    const db = testEnv.authenticatedContext('aprobada', { email: 'aprobada@example.com' }).firestore();
    await assertFails(cast(db, 'aprobada', 'Nadie'));
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await updateDoc(doc(ctx.firestore(), `categories/${CATEGORY}`), { open: false });
    });
    await assertFails(cast(db, 'aprobada', 'Ana'));
  });

  it('el conteo público no se puede inventar sin el voto', async () => {
    const db = testEnv.authenticatedContext('aprobada', { email: 'aprobada@example.com' }).firestore();
    await assertFails(setDoc(doc(db, 'tallies/2026_miembro-del-ano'), { counts: { Ana: 1 } }));
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'categories/2026_miembro-del-ano')));
  });
});

describe('posts', () => {
  it('se leen en público y solo un admin los crea', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await assertFails(setDoc(doc(alice, 'posts/premios-2026'), post('alice')));
    const admin = testEnv.authenticatedContext('admin1', { email: 'admin@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(admin, 'posts/premios-2026'), { ...post('admin1'), contestYear: 2026 }));
    await assertSucceeds(getDoc(doc(anon, 'posts/premios-2026')));
    await assertFails(setDoc(doc(admin, 'posts/malo'), { ...post('admin1'), contestYear: '2026' }));
  });
});

function profile(email: string, displayName: string, status: 'pending' | 'approved' | 'rejected') {
  return {
    email,
    displayName,
    photoURL: null,
    status,
    createdAt: 1_700_000_000_000,
    approvedAt: status === 'approved' ? 1_700_000_000_000 : null,
    approvedBy: status === 'approved' ? 'admin1' : null,
  };
}

function post(authorUid: string) {
  return {
    title: 'Premios VengaJusti 2026',
    body: 'Categorías del año.',
    tags: ['premios'],
    authorUid,
    authorName: 'Admin',
    createdAt: 1_700_000_000_000,
  };
}

function cast(db: Firestore, uid: string, nominee: string) {
  const year = 2026;
  const categoryId = 'miembro-del-ano';
  const voteRef = doc(db, 'votes', `${year}_${categoryId}_${uid}`);
  const tallyRef = doc(db, 'tallies', `${year}_${categoryId}`);
  return runTransaction(db, async tx => {
    const tally = await tx.get(tallyRef);
    const counts = (tally.data()?.['counts'] ?? {}) as Record<string, number>;
    tx.set(voteRef, { year, categoryId, uid, nominee, createdAt: 1_700_000_000_000 });
    if (!tally.exists()) tx.set(tallyRef, { year, categoryId, counts: { [nominee]: 1 } });
    else tx.set(tallyRef, { year, categoryId, counts: { ...counts, [nominee]: (counts[nominee] ?? 0) + 1 } });
  });
}
