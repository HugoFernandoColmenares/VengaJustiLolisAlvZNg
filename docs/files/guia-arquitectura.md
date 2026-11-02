# Guía de arquitectura

## Stack
| Capa | Elección |
|---|---|
| Framework | Angular 22.2 (componentes standalone, signals, `resource()`, control flow `@if/@for`, rutas lazy, zoneless) |
| Estilos | SCSS: tokens globales en `src/styles.scss` + estilos por componente |
| Backend (BaaS) | Firebase: Firestore + Firebase Auth (Google), plan **Spark** (gratis) |
| Imágenes | Supabase Storage, bucket público `vengajusti` (Firebase Storage exige Blaze). Ver [imagenes-supabase.md](imagenes-supabase.md) |
| Modo sin credenciales | `LocalBackend` sobre `localStorage` |
| Pruebas | Vitest (builder `@angular/build:unit-test`) |
| Hosting | GitHub Pages en `/VengaJustiLolisAlvZNg/` con GitHub Actions |
| Node | 24 LTS (Angular 22 exige `^22.22.3 || ^24.15 || >=26`) |

## Estructura de carpetas
```
├─ .github/workflows/      deploy.yml (main → Pages) y ci.yml (PRs)
├─ docs/files/             auditoría, mejoras, guías
├─ docs/screenshots/       capturas antes (a-*, b-*) y después (new-*)
├─ legacy/awards/          sitio original de premios (HTML/CSS/JS)
├─ legacy/lore/            sitio original de lore (copia de FeithNoir/vengajustilolisalvz)
├─ public/                 favicon, og-image.png (se copian tal cual)
├─ scripts/                spa-404.mjs (crea 404.html y .nojekyll), serve-dist.mjs (sirve el build como Pages)
├─ supabase/               config.toml (verify_jwt = false) y functions/vengajusti-upload (subida de imágenes)
├─ src/environments/       environment.ts (config de Firebase VACÍA en el repo, se inyecta en el deploy + año de votación + URL de la función)
├─ src/app/
│  ├─ app.ts / app.routes.ts / app.config.ts
│  ├─ core/backend/        backend.ts (interfaz + token), local-backend.ts, firebase-backend.ts, backend.provider.ts, models.ts
│  ├─ core/data/           lore.data.ts, awards-2025.data.ts, image-optimize.data.ts (preset WebP)
│  ├─ core/services/media/ optimización en canvas y subida a la Edge Function
│  ├─ shared/              bar-chart.ts, image-field.ts, year-contest.ts (votación/resultados), pending-account.ts
│  └─ pages/               home, awards-2025 (se incrusta en el post 2025), lore, characters, posts, post-detail, admin, not-found
├─ firestore.rules · firestore.indexes.json · firebase.json
```

## Rutas
El menú solo tiene **Inicio**, **Posts** y **Lore**. Lore ya existía como página estática (`lore.data.ts`: sinopsis, cómo se juega, Ciudad Nueva McOndo). No se volvió una colección: ese texto es el canon del grupo, no se edita como un post. El elenco sigue en `/personajes`, enlazado desde Lore.

| Ruta | Contenido |
|---|---|
| `/` | Hero, intro 2025, accesos a los posts de premios |
| `/posts`, `/posts/:id` | Posts del grupo. Si el post tiene `contestYear`, muestra la votación o los resultados de ese año |
| `/posts/premios-2025` | Post del año 2025: resultados, gráficos y "La voz del pueblo" |
| `/posts/premios-2026` | Post del año en curso (`environment.votingYear`): categorías abiertas se votan; las cerradas muestran el conteo |
| `/votar` | Redirige a `/posts/premios-{votingYear}` |
| `/premios` y `/premios/:año` | Redirigen a `/posts/premios-:año` (`/premios` cae en 2025) |
| `/lore` | Sinopsis, gameplay, Ciudad Nueva McOndo |
| `/personajes` | Elenco y facciones (fuera del menú) |
| `/admin` | Posts, categorías y **Usuarios** (aprobar, rechazar, revocar) |
| `**` | 404 temático |

## ¿Por qué Firebase y no otra cosa?
Requisitos: gratis, sin servidor propio (GitHub Pages es estático), login sencillo para gente de un grupo de WhatsApp, reglas que garanticen "un voto por persona". Los datos y el login siguen en Firebase. Las imágenes no: Firebase Storage exige el plan Blaze, así que van a Supabase Storage ([imagenes-supabase.md](imagenes-supabase.md)). No se usa Supabase Auth.

| Opción | Pros | Contras |
|---|---|---|
| **Firebase (Firestore + Auth)** ✅ | Spark gratis sin tarjeta; Auth con Google en 5 min; reglas declarativas que validan el voto en el servidor; SDK web modular; cuota diaria (50 000 lecturas, 20 000 escrituras) sobra para un grupo | Vendor lock-in de Google; consultas limitadas |
| PocketBase | Open source, SQL | Necesita un servidor encendido 24/7 (no es gratis ni estático) |
| Appwrite Cloud | Free tier, Auth + DB | Proyectos gratis se pausan por inactividad; menos material en español |
| Cloudflare Workers + D1 | Muy generoso | Hay que programar y mantener la API y la autenticación a mano |

Conclusión: Firebase es la opción gratuita con menos piezas móviles para este caso.

## Capa de backend (desacoplada)
`src/app/core/backend/backend.ts` define la interfaz `Backend` y el token `BACKEND`. `provideBackend()`:
1. Si `environment.firebase.apiKey` tiene valor → importa **de forma diferida** `firebase-backend.ts` (chunk aparte de ~147 KB gzip que solo se descarga si hay config).
2. Si no → `LocalBackend` (todo en `localStorage`). "Entrar como admin de prueba" es admin aprobado; "Entrar como cuenta pendiente" entra como Kevin, que empieza en `pending`. La app muestra la barra "Modo demo".

Los componentes solo inyectan `BACKEND`; nunca importan Firebase.

## Modelo de datos (Firestore)
| Colección | Id del documento | Campos | Quién escribe |
|---|---|---|---|
| `admins` | `{uid}` | (vacío o `{ name }`) | Solo consola de Firebase |
| `users` | `{uid}` | `email, displayName, photoURL, status: pending\|approved\|rejected, createdAt, approvedAt, approvedBy` | El usuario crea el suyo en `pending`; solo un admin cambia `status`, `approvedAt` y `approvedBy` |
| `categories` | `{year}_{slug}` | `year:int, slug, title, description, nominees:string[], open:bool, order:int`, opcionales `image` (URL) y `nomineeImages: { name, image }[]` | Admins |
| `votes` | `{year}_{categoryId}_{uid}` | `year, categoryId, uid, nominee, createdAt` | Usuario aprobado (o admin), una vez. Índice compuesto `uid ASC, year ASC` |
| `tallies` | `{year}_{categoryId}` | `year, categoryId, counts: { [nominado]: int }` | En la misma transacción del voto (+1), solo si la cuenta puede votar |
| `posts` | auto, o `premios-{año}` | `title, body, tags[], authorUid, authorName, createdAt:number`, opcionales `image` (URL) y `contestYear:int` | Admins |

No hay colección de comentarios. La única escritura de una cuenta que todavía no está aprobada es crear su propio `users/{uid}` en `pending`. Votar (y el +1 del conteo) exige `approved` o ser admin.

**Cuentas que ya existen.** Al iniciar sesión, si no hay `users/{uid}`, la app lo crea en `pending`. Así las 3 cuentas actuales quedan pendientes en el próximo ingreso. Quien tiene documento en `admins/{uid}` se trata como aprobada aunque el doc de `users` diga otra cosa. Hoy el admin de la consola es `dragonscuro@gmail.com`, uid `KSYfIlDs4BXmIUyQq1r4zbIk3a52`. Ese doc no se crea desde la app.

**Post de premios.** El admin publica un post con el año (id fijo `premios-2026`, campo `contestYear`). Ese post lista las categorías de ese año: si `open` es true, la UI de voto; si es false, el resultado con el gráfico. 2025 no está en Firestore: el post `premios-2025` reutiliza el bloque estático de `awards-2025.data.ts` (ganadores, gráficos y la voz del pueblo).

**Por qué `tallies`:** los votos son privados (cada quien solo lee el suyo), pero los conteos son públicos. El voto y el +1 se escriben en una transacción; las reglas comprueban con `existsAfter/getAfter` que el +1 corresponde a un voto nuevo del mismo usuario.

## Reglas de seguridad (resumen de `firestore.rules`)
Estas reglas **no se despliegan** desde GitHub Actions ni desde este cambio. Hay que publicarlas a mano, contra `vengajustilolisalvz`, después de revisarlas:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

- **Un voto por usuario, categoría y año:** el id del voto debe ser exactamente `{year}_{categoryId}_{auth.uid}`; `create` solo si el documento no existe (Firestore trata una segunda escritura como `update`, que está prohibido). El voto no se puede editar ni borrar.
- El nominado debe estar en `categories/{year}_{categoryId}.nominees` y la categoría debe tener `open == true`.
- **Votar y sumar el conteo exige cuenta aprobada** (`users/{uid}.status == 'approved'`) **o admin**. Una cuenta pendiente o rechazada no escribe votos ni tallies.
- `tallies`: solo se puede sumar 1 al nominado del voto recién creado, en la misma transacción.
- `users`: cada quien crea solo su doc, con `status == 'pending'` y `approvedAt`/`approvedBy` en null, y el email tiene que coincidir con el token. No puede cambiar el estado. `get` del propio doc; `list` solo admins. El admin actualiza únicamente `status`, `approvedAt` y `approvedBy`.
- `categories` y `posts`: lectura pública; escritura solo si existe `admins/{auth.uid}`. En un post, `contestYear` si viene es un entero.
- `admins`: cada usuario autenticado lee solo su propio documento (la Edge Function de imágenes usa esa lectura con el ID token). No se escribe desde el cliente.
- Cualquier otra colección (comentarios incluidos) queda negada.

Pruebas con el emulador, sin tocar el proyecto real: `npm run test:rules` (`firestore.rules.spec.ts`, `@firebase/rules-unit-testing`, proyecto `demo-vengajusti`).

## Crear el proyecto Firebase (paso a paso)
1. Entra a https://console.firebase.google.com con tu cuenta de Google → **Agregar proyecto** → nombre `vengajusti` → puedes desactivar Google Analytics. El plan por defecto es **Spark** (gratis); no agregues tarjeta.
2. **Build → Firestore Database → Crear base de datos** → modo producción → región `southamerica-east1` (São Paulo) o `us-central1`.
3. **Build → Authentication → Comenzar → Método de acceso → Google → Habilitar** (elige el email de soporte).
4. **Authentication → Configuración → Dominios autorizados → Agregar dominio:** `hugofernandocolmenares.github.io` (y `localhost` ya viene).
5. **Configuración del proyecto (⚙️) → Tus apps → Web (`</>`)** → apodo `vengajusti-web` → *no* marques Firebase Hosting → copia el objeto `firebaseConfig`.
6. **No pegues la config en el repo.** Ve a GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret** y crea: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. El workflow `deploy.yml` ejecuta `scripts/inject-firebase-env.mjs`, que escribe esos valores en `src/environments/environment.ts` **solo dentro del runner** antes de `npm run build`; el archivo del repo se queda con valores vacíos. Luego relanza el workflow (**Actions → Deploy a GitHub Pages → Run workflow**).
   - La `apiKey` web de Firebase **no es un secreto** (termina dentro del JS público): la seguridad la dan las reglas de Firestore y Auth. Se deja fuera del repo para no atarla al historial, poder rotarla sin commits y evitar alertas de escáneres. Restringe la key en **Google Cloud Console → APIs y servicios → Credenciales** a los referers `https://hugofernandocolmenares.github.io/*` y `http://localhost:*`.
   - Para probar en tu PC: copia `.env.example` a `.env`, completa las variables y corre `npm run env:local && npm start`. Eso escribe `src/environments/environment.ts`; **no lo commitees con valores reales** (`git restore src/environments/environment.ts`).
   - **Nunca** subas archivos de *service account* (`*-firebase-adminsdk-*.json`, `serviceAccount*.json`) ni `.env*`: están en `.gitignore`. Esos sí son secretos.
7. Despliega reglas e índices desde tu PC:
   ```bash
   npx firebase-tools login
   npx firebase-tools use --add        # elige el proyecto
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```
8. En **Firestore → Iniciar colección** crea `admins` con el documento `KSYfIlDs4BXmIUyQq1r4zbIk3a52` (cuenta `dragonscuro@gmail.com`; campo opcional `name`). La app no escribe esa colección.
9. Ya como admin, ve a `/admin`: crea las categorías del año, publica el post de premios con el año (queda en `/posts/premios-2026`) y, en **Usuarios**, aprueba a quien corresponda. Las cuentas que ya existen entran en `pending` la primera vez que vuelven a iniciar sesión.
10. Commit + push a `main` → el workflow publica en Pages. **No** publica las reglas.

## Flujo de despliegue
1. `push` a `main` (o *Run workflow* manual) dispara `.github/workflows/deploy.yml`.
2. Node 24 → `npm ci` → `npm test` → `npm run build` (= `ng build` con `baseHref /VengaJustiLolisAlvZNg/` + `scripts/spa-404.mjs` que crea `404.html` y `.nojekyll`).
3. Se sube `dist/vengajusti/browser` como artefacto y `actions/deploy-pages` lo publica.
4. **Una sola vez:** en GitHub → Settings → Pages → *Build and deployment* → **Source: GitHub Actions**.

En los PR corre `ci.yml` (tests + build) sin desplegar.

## Comandos útiles
```bash
npm ci
npm start              # dev server en http://localhost:4200
npm test -- --watch=false
npm run test:rules     # emulador Firestore; no despliega reglas
npm run build          # build de producción + 404.html
npm run serve:dist     # sirve el build en http://localhost:4300/VengaJustiLolisAlvZNg/
```
