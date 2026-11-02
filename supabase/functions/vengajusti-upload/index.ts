/**
 * Subida (y borrado) de imágenes de admins de VengaJusti al bucket público `vengajusti`.
 *
 * No usa Supabase Auth: el llamador manda un ID token de Firebase. Por eso se despliega
 * con verify_jwt = false (ver `supabase/config.toml`).
 *
 *   supabase functions deploy vengajusti-upload --no-verify-jwt --project-ref ebhxbmtmrayolmlkdsom
 *
 * Variables que inyecta Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (si el proyecto ya migró las llaves, también sirve SUPABASE_SECRET_KEYS.default).
 */
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6';
import {
  CACHE_CONTROL_SECONDS, FIREBASE_ISSUER, FIREBASE_PROJECT_ID, GOOGLE_JWKS_URL,
  MAX_REQUEST_BYTES, STORAGE_BUCKET, SUPABASE_PROJECT_URL,
  bearerToken, buildObjectPath, corsHeaders, firestoreAdminUrl, isAllowedOrigin,
  normalizeFolder, publicObjectUrl, resolveObjectPath, storageAuthHeaders, validateImage,
} from './logic.ts';

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

Deno.serve((req) => handle(req));

export async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return json(403, { error: 'forbidden_origin', message: 'Origen no permitido.' }, origin);
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json(405, { error: 'method_not_allowed', message: 'Usa POST o DELETE.' }, origin);
  }

  const token = bearerToken(req.headers.get('authorization'));
  if (!token) {
    return json(401, { error: 'unauthorized', message: 'Falta el token de Firebase (Authorization: Bearer).' }, origin);
  }

  let uid: string;
  try {
    uid = await verifyFirebaseUid(token);
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    const message = code === 'ERR_JWT_EXPIRED'
      ? 'El token expiró. Vuelve a iniciar sesión.'
      : 'Token de Firebase inválido.';
    return json(401, { error: 'unauthorized', message }, origin);
  }

  const admin = await isAdmin(uid, token);
  if (admin === 'unauthorized') {
    return json(401, { error: 'unauthorized', message: 'Firebase rechazó el token.' }, origin);
  }
  if (admin === 'no') {
    return json(403, { error: 'forbidden', message: 'Tu cuenta no es admin.' }, origin);
  }
  if (admin === 'error') {
    return json(502, { error: 'admin_check_failed', message: 'No se pudo confirmar el permiso de admin.' }, origin);
  }

  if (req.method === 'DELETE') return remove(req, origin);
  return upload(req, origin);
}

async function verifyFirebaseUid(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ['RS256'],
    clockTolerance: 30,
  });
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('uid');
  return payload.sub;
}

/** 200 en `admins/{uid}` (las reglas dejan leer el propio doc). 404 = autenticado, pero no admin. */
async function isAdmin(uid: string, token: string): Promise<'yes' | 'no' | 'unauthorized' | 'error'> {
  try {
    const res = await fetch(firestoreAdminUrl(uid), { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 200) return 'yes';
    if (res.status === 404 || res.status === 403) return 'no';
    if (res.status === 401) return 'unauthorized';
    return 'error';
  } catch {
    return 'error';
  }
}

async function upload(req: Request, origin: string | null): Promise<Response> {
  const declaredLength = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(413, { error: 'payload_too_large', message: 'La imagen supera el límite de 3 MB.' }, origin);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: 'bad_request', message: 'Se espera multipart con el campo file.' }, origin);
  }

  const folder = normalizeFolder(form.get('folder'));
  if (!folder) {
    return json(400, { error: 'bad_folder', message: 'La carpeta debe ser posts, categories o nominees.' }, origin);
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return json(400, { error: 'bad_request', message: 'Falta el archivo en el campo file.' }, origin);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const declared = file instanceof File ? file.type : null;
  const check = validateImage(bytes, declared);
  if (!check.ok) return json(check.status, { error: check.error, message: check.message }, origin);

  const objectPath = buildObjectPath(folder, crypto.randomUUID(), check.ext);
  if (!objectPath) return json(500, { error: 'upload_failed', message: 'No se pudo armar la ruta.' }, origin);

  let key: string;
  let projectUrl: string;
  try {
    key = serviceRoleKey();
    projectUrl = (Deno.env.get('SUPABASE_URL') ?? SUPABASE_PROJECT_URL).replace(/\/$/, '');
  } catch {
    return json(500, { error: 'upload_failed', message: 'Falta la configuración de Storage.' }, origin);
  }

  const target = `${projectUrl}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;
  let stored: Response;
  try {
    stored = await fetch(target, {
      method: 'POST',
      headers: {
        ...storageAuthHeaders(key),
        'content-type': check.mime,
        'cache-control': `max-age=${CACHE_CONTROL_SECONDS}`,
        'x-upsert': 'false',
      },
      body: bytes,
    });
  } catch (e) {
    console.error('storage upload', e instanceof Error ? e.message : 'error');
    return json(502, { error: 'upload_failed', message: 'No se pudo guardar la imagen.' }, origin);
  }
  if (!stored.ok) {
    console.error('storage upload status', stored.status);
    return json(502, { error: 'upload_failed', message: 'No se pudo guardar la imagen.' }, origin);
  }
  return json(200, { url: publicObjectUrl(projectUrl, objectPath) }, origin);
}

async function remove(req: Request, origin: string | null): Promise<Response> {
  const raw = await deletePathInput(req);
  if (!raw) return json(400, { error: 'bad_request', message: 'Falta path (ruta o URL pública).' }, origin);
  const objectPath = resolveObjectPath(raw);
  if (!objectPath) {
    return json(400, { error: 'bad_path', message: 'La ruta no pertenece a este bucket.' }, origin);
  }

  let key: string;
  let projectUrl: string;
  try {
    key = serviceRoleKey();
    projectUrl = (Deno.env.get('SUPABASE_URL') ?? SUPABASE_PROJECT_URL).replace(/\/$/, '');
  } catch {
    return json(500, { error: 'delete_failed', message: 'Falta la configuración de Storage.' }, origin);
  }

  try {
    const stored = await fetch(`${projectUrl}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`, {
      method: 'DELETE',
      headers: storageAuthHeaders(key),
    });
    if (!stored.ok && stored.status !== 404) {
      console.error('storage delete status', stored.status);
      return json(502, { error: 'delete_failed', message: 'No se pudo borrar la imagen.' }, origin);
    }
  } catch (e) {
    console.error('storage delete', e instanceof Error ? e.message : 'error');
    return json(502, { error: 'delete_failed', message: 'No se pudo borrar la imagen.' }, origin);
  }
  return json(200, { ok: true }, origin);
}

async function deletePathInput(req: Request): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('path');
  if (fromQuery) return fromQuery;
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return null;
  try {
    const body = await req.json() as { path?: unknown };
    return typeof body.path === 'string' ? body.path : null;
  } catch {
    return null;
  }
}

function serviceRoleKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed['default']) return parsed['default'];
  }
  throw new Error('missing_service_role');
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}
