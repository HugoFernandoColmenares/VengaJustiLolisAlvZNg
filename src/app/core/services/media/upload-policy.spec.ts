import { IMAGE_FOLDERS } from '../../data/image-optimize.data';
import {
  ALLOWED_FOLDERS, ALLOWED_ORIGINS, MAX_IMAGE_BYTES, STORAGE_PUBLIC_BASE,
  bearerToken, buildObjectPath, corsHeaders, firestoreAdminUrl, isAllowedOrigin,
  normalizeFolder, publicObjectUrl, resolveObjectPath, sniffImageMime, storageAuthHeaders, validateImage,
} from '../../../../../supabase/functions/vengajusti-upload/logic';

const UUID = '11111111-1111-4111-8111-111111111111';
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const avif = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);

describe('política de subida', () => {
  it('acepta solo los orígenes del sitio y de localhost', () => {
    for (const origin of ALLOWED_ORIGINS) expect(isAllowedOrigin(origin)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin('https://hugofernandocolmenares.github.io.evil.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost:4201')).toBe(false);
    expect(corsHeaders(ALLOWED_ORIGINS[0])['access-control-allow-origin']).toBe(ALLOWED_ORIGINS[0]);
    expect(corsHeaders('https://evil.test')['access-control-allow-origin']).toBeUndefined();
    expect(corsHeaders(ALLOWED_ORIGINS[2])['access-control-allow-methods']).toContain('OPTIONS');
  });

  it('valida tipo real y tamaño', () => {
    expect(validateImage(jpeg, 'image/jpeg')).toMatchObject({ ok: true, mime: 'image/jpeg', ext: 'jpg' });
    expect(validateImage(jpeg, 'image/jpg')).toMatchObject({ ok: true, mime: 'image/jpeg' });
    expect(validateImage(png, null)).toMatchObject({ ok: true, mime: 'image/png', ext: 'png' });
    expect(validateImage(webp, 'image/webp')).toMatchObject({ ok: true, ext: 'webp' });
    expect(validateImage(avif, 'image/avif')).toMatchObject({ ok: true, ext: 'avif' });
    expect(sniffImageMime(Uint8Array.from([1, 2, 3]))).toBeNull();

    const wrong = validateImage(png, 'image/jpeg');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.status).toBe(415);

    const empty = validateImage(new Uint8Array(), 'image/png');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.status).toBe(400);

    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(jpeg);
    const huge = validateImage(big, 'image/jpeg');
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.status).toBe(413);
  });

  it('arma y reconoce solo rutas del bucket', () => {
    expect(IMAGE_FOLDERS).toEqual([...ALLOWED_FOLDERS]);
    expect(normalizeFolder(null)).toBe('posts');
    expect(normalizeFolder('nominees')).toBe('nominees');
    expect(normalizeFolder('../posts')).toBeNull();
    expect(buildObjectPath('posts', UUID, 'webp')).toBe(`posts/${UUID}.webp`);
    expect(buildObjectPath('secret', UUID, 'webp')).toBeNull();

    const path = `categories/${UUID}.jpg`;
    expect(resolveObjectPath(path)).toBe(path);
    expect(resolveObjectPath(`${STORAGE_PUBLIC_BASE}/${path}`)).toBe(path);
    expect(resolveObjectPath(`${STORAGE_PUBLIC_BASE}/${path}?download`)).toBe(path);
    expect(resolveObjectPath(`https://evil.test/storage/v1/object/public/vengajusti/${path}`)).toBeNull();
    expect(resolveObjectPath(`posts/../categories/${UUID}.webp`)).toBeNull();
    expect(resolveObjectPath(`posts/${UUID}.webp/../../etc/passwd`)).toBeNull();
    expect(publicObjectUrl('https://ebhxbmtmrayolmlkdsom.supabase.co', path)).toBe(`${STORAGE_PUBLIC_BASE}/${path}`);
  });

  it('separa el token y la llave de Storage', () => {
    expect(bearerToken('Bearer abcdefghij1234567890')).toBe('abcdefghij1234567890');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(null)).toBeNull();
    const jwtHeaders = storageAuthHeaders('eyJhbGciOiJIUzI1NiJ9.e30.sig');
    const secretHeaders = storageAuthHeaders('sb_secret_xxx');
    expect(jwtHeaders['authorization']).toMatch(/^Bearer /);
    expect(secretHeaders['authorization']).toBeUndefined();
    expect(secretHeaders['apikey']).toBe('sb_secret_xxx');
    expect(firestoreAdminUrl('uid/ raro')).toContain('admins/uid%2F%20raro');
  });
});
