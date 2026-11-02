# Imágenes en Supabase Storage

Los admins pueden subir la portada de un post, la portada de una categoría y la foto de cada nominado. En Firestore solo se guarda la URL pública. El archivo vive en Supabase Storage.

## Por qué no Firebase Storage

El proyecto de Firebase está en el plan **Spark** (gratis, sin tarjeta). Firebase Storage no está incluido: para activarlo hay que pasar al plan **Blaze**, que pide un método de pago aunque el uso se quede en la cuota sin costo. Supabase Storage sí entra en el plan gratis del proyecto que ya existe.

Ese proyecto (`ebhxbmtmrayolmlkdsom`, https://ebhxbmtmrayolmlkdsom.supabase.co) es el de **feith-blog**. VengaJusti solo usa el bucket. No usa Supabase Auth, ni vincula a Firebase como third-party auth, ni lee las tablas de ese sitio.

## Límites

| Límite | Valor |
|---|---|
| Plan gratis de Supabase Storage | **1 GB** de archivos |
| Tope por archivo (bucket y función) | **3 MB** |
| Tipos | `image/webp`, `image/jpeg`, `image/png`, `image/avif` |
| Lo que termina guardado | WebP, máximo **1920×1080**, calidad **0.82** |

El navegador reescala y convierte antes de subir (`ImageOptimizeService`), así que una foto de celular casi nunca llega a 3 MB. 1 GB alcanza para miles de portadas de este tamaño. Si el bucket se llena, las subidas nuevas fallan y las URLs ya guardadas siguen abriendo.

## Arquitectura

```
Admin (Angular)
  │  canvas + createImageBitmap → WebP
  │  Authorization: Bearer <Firebase ID token>
  ▼
Edge Function  vengajusti-upload   (verify_jwt = false)
  │  1. Verifica el token con las claves públicas de Google (JWKS)
  │  2. Lee admins/{uid} por la REST de Firestore, con el mismo token
  │  3. Revisa tipo (bytes reales) y tamaño
  │  4. Escribe con SUPABASE_SERVICE_ROLE_KEY
  ▼
Bucket público  vengajusti / <posts|categories|nominees>/<uuid>.<ext>
  │
  ▼
Firestore guarda solo la URL
  https://ebhxbmtmrayolmlkdsom.supabase.co/storage/v1/object/public/vengajusti/...
```

La URL de la función está en `environment.imageUploadUrl`. No es un secreto: sin un ID token de un admin no escribe nada.

Carpetas:

| Carpeta | Qué es |
|---|---|
| `posts` | Portada del post (`posts.image`) |
| `categories` | Portada de la categoría (`categories.image`) |
| `nominees` | Foto de un nominado (`categories.nomineeImages`: lista `{ name, image }`) |

Los nominados siguen siendo una lista de textos. El voto compara el nombre, no la foto. `firestore.rules` no se tocó: un usuario ya puede leer su propio `admins/{uid}`, y las categorías y los posts aceptan campos extra.

En **modo demo** (sin `apiKey` de Firebase) el input queda deshabilitado y se muestra el aviso. No hay token que mandar.

## Despliegue de la función

Hay que desplegarla a mano, en el proyecto de feith-blog. Este repo no lo hace (el workflow de Pages no tiene credenciales de Supabase).

```bash
supabase functions deploy vengajusti-upload --no-verify-jwt --project-ref ebhxbmtmrayolmlkdsom
```

`--no-verify-jwt` es obligatorio. El gateway de Supabase, si verifica el JWT, rechaza el ID token de Firebase porque no lo firmó Supabase (la respuesta llega como 401 antes de entrar a la función). Lo mismo queda declarado en `supabase/config.toml`:

```toml
[functions.vengajusti-upload]
verify_jwt = false
```

Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en la función. No hay que pegar esa llave en el repo ni en el frontend. Si el proyecto ya migró a las llaves nuevas, la función también acepta `SUPABASE_SECRET_KEYS` (la entrada `default`) y la manda solo en el header `apikey`, que es lo que esas llaves exigen.

Archivo de la función: `supabase/functions/vengajusti-upload/index.ts`. La validación sin red está en `logic.ts`, cubierta por Vitest.

## Seguridad

- **Quién escribe.** El bucket no tiene políticas de Storage. Con la anon key no se puede subir ni borrar. El único escritor es el service role, y solo corre dentro de la función.
- **Quién llama a la función.** Se exige `Authorization: Bearer` con un ID token de Firebase. Se verifica contra el JWKS de Google (`securetoken@system.gserviceaccount.com`) con `jose`: algoritmo RS256, `aud` = `vengajustilolisalvz`, `iss` = `https://securetoken.google.com/vengajustilolisalvz`, y que no esté vencido (`exp`).
- **Quién es admin.** Con ese mismo token se lee `admins/{uid}` en Firestore. Las reglas ya dicen `allow read` si el uid del token es el id del documento. Si el documento no existe, Firestore responde 404 y la función devuelve **403**. Token ausente o inválido: **401**.
- **Qué se acepta.** Más de 3 MB → **413**. Tipo que no sea WebP, JPEG, PNG o AVIF, o un `Content-Type` que no coincide con los bytes → **415**. El nombre final lo pone la función (`<uuid>.<ext>`), no el cliente.
- **Borrar.** `DELETE` con `{ "path": "<ruta o URL pública>" }` también exige admin. La ruta tiene que ser `posts|categories|nominees/<uuid>.<ext>` de este bucket. No hay forma de salir de la carpeta con `..` ni de apuntar a otro proyecto.
- **CORS.** Solo `https://hugofernandocolmenares.github.io`, `https://feithnoir.github.io` y `http://localhost:4200`, incluido el `OPTIONS`.
- **Lectura.** El bucket es público: quien tenga la URL ve la imagen. Las rutas llevan un UUID, así que no se pueden enumerar. No subas nada que no pueda ver todo el grupo.
- **La llave.** `SUPABASE_SERVICE_ROLE_KEY` salta las políticas. No va en `environment.ts`, ni en el bundle, ni en un `.env` de este repo.

## Respuestas de error

| HTTP | `error` | Cuándo |
|---|---|---|
| 401 | `unauthorized` | Sin token, token vencido o Firebase lo rechaza |
| 403 | `forbidden` | El uid no tiene documento en `admins` |
| 403 | `forbidden_origin` | El `Origin` no está en la lista |
| 413 | `payload_too_large` | Más de 3 MB |
| 415 | `unsupported_media_type` | No es WebP, JPEG, PNG ni AVIF |
| 400 | `bad_request` / `bad_folder` / `bad_path` / `empty_file` | Falta el archivo, la carpeta no existe o la ruta del DELETE no es de este bucket |
