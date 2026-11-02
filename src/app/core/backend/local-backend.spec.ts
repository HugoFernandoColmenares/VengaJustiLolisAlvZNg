import { AlreadyVotedError } from './backend';
import { LocalBackend } from './local-backend';

describe('LocalBackend', () => {
  beforeEach(() => localStorage.clear());

  it('permite un solo voto por usuario, categoría y año', async () => {
    const b = new LocalBackend();
    await b.signIn();
    const [cat] = await b.listCategories(2026);
    await b.castVote(2026, cat.id, cat.nominees[0]);
    await expect(b.castVote(2026, cat.id, cat.nominees[1])).rejects.toBeInstanceOf(AlreadyVotedError);
    const tally = await b.tally(2026, cat.id);
    expect(tally[0]).toEqual({ name: cat.nominees[0], votes: 1 });
  });

  it('guarda la URL pública de la portada y de cada nominado', async () => {
    const b = new LocalBackend();
    await b.signIn();
    await b.saveCategory({
      year: 2026, title: 'Waifu del Año', description: 'Con foto', open: true, order: 4,
      nominees: ['Frieren', 'Furina'],
      image: 'https://ebhxbmtmrayolmlkdsom.supabase.co/storage/v1/object/public/vengajusti/categories/x.webp',
      nomineeImages: [{ name: 'Frieren', image: 'https://ebhxbmtmrayolmlkdsom.supabase.co/storage/v1/object/public/vengajusti/nominees/y.webp' }],
    });
    const cat = (await b.listCategories(2026)).find(c => c.id === 'waifu-del-ano');
    expect(cat?.image).toContain('/categories/x.webp');
    expect(cat?.nomineeImages?.[0]?.image).toContain('/nominees/y.webp');
    const postId = await b.createPost({ title: 'Con portada', body: 'hola', tags: [], image: 'https://cdn.example/p.webp' });
    expect((await b.getPost(postId))?.image).toBe('https://cdn.example/p.webp');
  });

  it('en modo demo no hay token de Firebase', async () => {
    const b = new LocalBackend();
    await expect(b.getIdToken()).rejects.toThrow(/demo/);
  });

  it('exige sesión para votar', async () => {
    const b = new LocalBackend();
    const [cat] = await b.listCategories(2026);
    await expect(b.castVote(2026, cat.id, 'x')).rejects.toThrow();
  });

  it('una cuenta pendiente o rechazada no vota; al aprobarla, sí', async () => {
    const b = new LocalBackend();
    await b.signInPending!();
    const [cat] = await b.listCategories(2026);
    await expect(b.castVote(2026, cat.id, cat.nominees[0])).rejects.toThrow(/pendiente/);
    await expect(b.listUsers()).rejects.toThrow(/admins/);
    await b.signOut();
    await b.signIn();
    await b.setUserStatus('user-kevin', 'rejected');
    await b.signOut();
    await b.signInPending!();
    await expect(b.castVote(2026, cat.id, cat.nominees[0])).rejects.toThrow(/pendiente/);
    await b.signOut();
    await b.signIn();
    await b.setUserStatus('user-kevin', 'approved');
    await b.signOut();
    await b.signInPending!();
    await b.castVote(2026, cat.id, cat.nominees[0]);
    expect((await b.myVotes(2026))[cat.id]).toBe(cat.nominees[0]);
  });

  it('el admin se trata como aprobado y el post de premios conserva el id del año', async () => {
    const b = new LocalBackend();
    await b.signIn();
    expect(b.user()?.status).toBe('approved');
    const id = await b.createPost({ title: 'Premios VengaJusti 2026', body: 'texto', tags: ['premios'], contestYear: 2026 });
    expect(id).toBe('premios-2026');
    const again = await b.createPost({ title: 'Actualizado', body: 'nuevo', tags: [], contestYear: 2026 });
    expect(again).toBe(id);
    expect((await b.getPost(id))?.title).toBe('Actualizado');
    expect((await b.listPosts()).filter(p => p.id === id)).toHaveLength(1);
    const names = (await b.listUsers()).map(u => u.displayName);
    expect(names).toContain('Kevin');
    await b.setUserStatus('user-ralex', 'approved');
    expect((await b.listUsers()).find(u => u.uid === 'user-ralex')?.approvedBy).toBe('demo-user');
  });
});
