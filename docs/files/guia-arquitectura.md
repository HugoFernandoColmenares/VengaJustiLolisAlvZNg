# Guía de arquitectura

## Stack
| Capa | Elección |
|---|---|
| Framework | Angular 22.2 (componentes standalone, signals, `resource()`, control flow `@if/@for`, rutas lazy, zoneless) |
| Estilos | SCSS: tokens globales en `src/styles.scss` + estilos por componente |
| Backend (BaaS) | Firebase: Firestore + Firebase Auth (Google), plan **Spark** (gratis) |
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
├─ src/environments/       environment.ts (config de Firebase VACÍA en el repo, se inyecta en el deploy + año de votación)
├─ src/app/
│  ├─ app.ts / app.routes.ts / app.config.ts
│  ├─ core/backend/        backend.ts (interfaz + token), local-backend.ts, firebase-backend.ts, backend.provider.ts, models.ts
│  ├─ core/data/           lore.data.ts (lore de B), awards-2025.data.ts (resultados de A)
│  ├─ shared/bar-chart.ts  gráfico de barras accesible
│  └─ pages/               home, awards-2025, vote, lore, characters, posts, post-detail, admin, not-found
├─ firestore.rules · firestore.indexes.json · firebase.json
```

## Rutas
| Ruta | Contenido |
|---|---|
| `/` | Hero, intro 2025, accesos a ganadores |
| `/premios/2025` | Resultados 2025, gráficos y "La voz del pueblo" |
| `/votar` | Votación del año `environment.votingYear` |
| `/lore` | Sinopsis, gameplay, Ciudad Nueva McOndo |
| `/personajes` | Elenco y facciones |
| `/posts`, `/posts/:id` | Posts del grupo |
| `/admin` | Crear posts y categorías (solo admins) |
| `**` | 404 temático |

## ¿Por qué Firebase y no otra cosa?
Requisitos: gratis, sin servidor propio (GitHub Pages es estático), login sencillo para gente de un grupo de WhatsApp, reglas que garanticen "un voto por persona", **sin Supabase**.

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
2. Si no → `LocalBackend` (todo en `localStorage`, el usuario demo es admin para poder probar todo). La app muestra la barra "Modo demo".

Los componentes solo inyectan `BACKEND`; nunca importan Firebase.

## Modelo de datos (Firestore)
| Colección | Id del documento | Campos | Quién escribe |
|---|---|---|---|
| `admins` | `{uid}` | (vacío o `{ name }`) | Solo consola de Firebase |
| `categories` | `{year}_{slug}` | `year:int, slug, title, description, nominees:string[], open:bool, order:int` | Admins |
| `votes` | `{year}_{categoryId}_{uid}` | `year, categoryId, uid, nominee, createdAt` | Cada usuario, una vez |
| `tallies` | `{year}_{categoryId}` | `year, categoryId, counts: { [nominado]: int }` | En la misma transacción del voto (+1) |
| `posts` | auto | `title, body, tags[], authorUid, authorName, createdAt:number` | Admins |

`users` no existe como colección: el perfil (nombre, email) viene de Firebase Auth y el rol admin de `admins/{uid}`.

**Por qué `tallies`:** los votos son privados (cada quien solo lee el suyo), pero los conteos son públicos. El voto y el +1 se escriben en una transacción; las reglas comprueban con `existsAfter/getAfter` que el +1 corresponde a un voto nuevo del mismo usuario.

## Reglas de seguridad (resumen de `firestore.rules`)
- **Un voto por usuario, categoría y año:** el id del voto debe ser exactamente `{year}_{categoryId}_{auth.uid}`; `create` solo si el documento no existe (Firestore trata una segunda escritura como `update`, que está prohibido). El voto no se puede editar ni borrar.
- El nominado debe estar en `categories/{year}_{categoryId}.nominees` y la categoría debe tener `open == true`.
- `tallies`: solo se puede sumar 1 al nominado del voto recién creado, en la misma transacción.
- `categories` y `posts`: lectura pública; escritura solo si existe `admins/{auth.uid}`.
- `admins`: no se escribe desde el cliente.

Probar las reglas: `npx firebase-tools emulators:start --only firestore` y apuntar la app al emulador (TODO: script dedicado).

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
8. Entra a la app, inicia sesión con Google una vez, y en **Authentication → Usuarios** copia tu UID. En **Firestore → Iniciar colección** crea `admins` con un documento cuyo id sea ese UID (campo opcional `name: "Feith Noir"`).
9. Ya como admin, ve a `/admin` y crea las categorías del año con sus nominados.
10. Commit + push a `main` → el workflow publica en Pages.

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
npm run build          # build de producción + 404.html
npm run serve:dist     # sirve el build en http://localhost:4300/VengaJustiLolisAlvZNg/
```
