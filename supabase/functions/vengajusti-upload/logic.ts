/**
 * Lógica pura de la Edge Function `vengajusti-upload`.
 * Sin Deno, sin red: la importa el handler y las pruebas de Vitest.
 */

export const FIREBASE_PROJECT_ID = 'vengajustilolisalvz';
export const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
export const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export const SUPABASE_PROJECT_URL = 'https://ebhxbmtmrayolmlkdsom.supabase.co';
export const STORAGE_BUCKET = 'vengajusti';
export const STORAGE_PUBLIC_BASE = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${STORAGE_BUCKET}`;

/** Un año, en segundos. Se manda como `cache-control: max-age=…` al subir. */
export const CACHE_CONTROL_SECONDS = 60 * 60 * 24 * 365;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
/** Tope del cuerpo HTTP, con margen para el multipart. */
export const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export const ALLOWED_ORIGINS = [
  'https://hugofernandocolmenares.github.io',
  'https://feithnoir.github.io',
  'http://localhost:4200',
] as const;

export const ALLOWED_FOLDERS = ['posts', 'categories', 'nominees'] as const;
export type ImageFolder = (typeof ALLOWED_FOLDERS)[number];

export const MIME_EXTENSION = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
} as const;
export type AllowedMime = keyof typeof MIME_EXTENSION;

const OBJECT_PATH =
  /^(posts|categories|nominees)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpe?g|png|avif)$/;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    vary: 'origin',
    'access-control-allow-methods': 'POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-max-age': '86400',
  };
  if (isAllowedOrigin(origin)) headers['access-control-allow-origin'] = origin as string;
  return headers;
}

/** Extrae el JWT de `Authorization: Bearer …`. Null si falta o no tiene forma de token. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (token.length < 20 || token.length > 8192) return null;
  return token;
}

export function normalizeMime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!base || base === 'application/octet-stream') return null;
  if (base === 'image/jpg' || base === 'image/pjpeg') return 'image/jpeg';
  if (base === 'image/x-png') return 'image/png';
  return base;
}

export function sniffImageMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i] ?? 0);
  return out;
}

export type ImageCheck =
  | { ok: true; mime: AllowedMime; ext: string }
  | { ok: false; status: 400 | 413 | 415; error: string; message: string };

/** Tamaño primero (413), después el tipo real del archivo (415). */
export function validateImage(bytes: Uint8Array, declaredType: string | null): ImageCheck {
  if (bytes.byteLength === 0) {
    return { ok: false, status: 400, error: 'empty_file', message: 'El archivo está vacío.' };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return {
      ok: false, status: 413, error: 'payload_too_large',
      message: 'La imagen supera el límite de 3 MB.',
    };
  }
  const sniffed = sniffImageMime(bytes);
  const declared = normalizeMime(declaredType);
  if (!sniffed || (declared && declared !== sniffed)) {
    return {
      ok: false, status: 415, error: 'unsupported_media_type',
      message: 'Formato no permitido. Usa WebP, JPEG, PNG o AVIF.',
    };
  }
  return { ok: true, mime: sniffed, ext: MIME_EXTENSION[sniffed] };
}

export function normalizeFolder(input: unknown): ImageFolder | null {
  if (input == null || input === '') return 'posts';
  if (typeof input !== 'string') return null;
  return (ALLOWED_FOLDERS as readonly string[]).includes(input) ? (input as ImageFolder) : null;
}

export function buildObjectPath(folder: string, id: string, ext: string): string | null {
  if (!(ALLOWED_FOLDERS as readonly string[]).includes(folder)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  if (!['webp', 'jpg', 'jpeg', 'png', 'avif'].includes(ext)) return null;
  return `${folder}/${id}.${ext}`;
}

export function publicObjectUrl(projectUrl: string, objectPath: string): string {
  const base = projectUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
}

/**
 * Acepta la ruta dentro del bucket (`posts/<uuid>.webp`) o la URL pública de este proyecto.
 * Rechaza `..`, otros orígenes y cualquier cosa que no sea un objeto generado por esta función.
 */
export function resolveObjectPath(input: string, projectUrl = SUPABASE_PROJECT_URL): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('\0')) return null;

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    let project: URL;
    try {
      url = new URL(trimmed);
      project = new URL(projectUrl);
    } catch {
      return null;
    }
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (url.origin !== project.origin || !url.pathname.startsWith(prefix)) return null;
    try { path = decodeURIComponent(url.pathname.slice(prefix.length)); } catch { return null; }
  }

  if (path.startsWith('/')) path = path.slice(1);
  if (path.includes('..') || path.includes('//') || path.includes('%') || path.includes('?')) return null;
  return OBJECT_PATH.test(path) ? path : null;
}

export function firestoreAdminUrl(uid: string): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`;
}

/** Headers para Storage. La service role JWT va en Authorization; una secret key nueva (`sb_secret_`) solo en `apikey`. */
export function storageAuthHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith('eyJ')) headers['authorization'] = `Bearer ${key}`;
  return headers;
}
