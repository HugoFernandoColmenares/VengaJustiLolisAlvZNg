# VengaJustiLolis Alv Z — Premios, votación y lore de la Grieta

Sitio oficial del grupo **VengaJustiLolis Alv Z**: un chat de WhatsApp que se volvió partida de rol y luego metaficción compartida. Reúne en un solo lugar:

- 🏆 **Premios VJL**: resultados 2025 con gráficos accesibles y "La voz del pueblo".
- 🗳️ **Votación anual**: un voto por persona, por categoría y por año.
- 📝 **Posts** del grupo (solo admins publican).
- 🌪️ **Lore**: la Grieta, Ralexa, Noira, el Big Onii-chan, las facciones y Ciudad Nueva McOndo.

Sitio publicado: https://hugofernandocolmenares.github.io/VengaJustiLolisAlvZNg/

## Orígenes
Este repo fusiona dos sitios anteriores de [FeithNoir](https://github.com/FeithNoir):
- Premios (de aquí se tomó el estilo cómic): [repo](https://github.com/FeithNoir/VengaJustiLolisAlvZAwards) · [sitio](https://feithnoir.github.io/VengaJustiLolisAlvZAwards/)
- Lore (de aquí se tomó el contenido): [repo](https://github.com/FeithNoir/vengajustilolisalvz) · [sitio](https://feithnoir.github.io/vengajustilolisalvz/)
 Los originales están intactos en [`legacy/`](legacy/).

## Stack
- **Angular 22** (standalone, signals, `resource()`, `@if/@for`, rutas lazy, zoneless) + SCSS
- **Firebase** (Firestore + Auth con Google, plan Spark gratis) detrás de una interfaz; sin credenciales funciona en **modo demo** con `localStorage`
- **Vitest** para pruebas · **GitHub Actions** + **GitHub Pages** para publicar
- Node **24** (Angular 22 requiere `^22.22.3`, `^24.15` o `>=26`)

## Correr en local
```bash
npm ci
npm start            # http://localhost:4200
npm test -- --watch=false
```

## Build
```bash
npm run build        # dist/vengajusti/browser (+ 404.html y .nojekyll para Pages)
npm run serve:dist   # http://localhost:4300/VengaJustiLolisAlvZNg/ (igual que en Pages)
```

## Firebase en local (`.env`)

La config web no va en el historial. Para apuntar el dev server a tu proyecto:

```bash
cp .env.example .env
# Completa FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
# FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID y FIREBASE_APP_ID.
npm run env:local    # node --env-file-if-exists=.env scripts/inject-firebase-env.mjs
npm start
```

`.env` está en `.gitignore` (`.env.example` sí se versiona, con valores vacíos). El script escribe en [`src/environments/environment.ts`](src/environments/environment.ts). **No commitees ese archivo con valores reales** después de correrlo: cuando termines de probar, vuelve a dejarlo vacío con `git restore src/environments/environment.ts`. Si no hay `.env` o falta `FIREBASE_API_KEY`, no toca nada y la app sigue en modo demo.

## Deploy
Cada push a `main` ejecuta `.github/workflows/deploy.yml` (tests → build → GitHub Pages).
Requisito único: **Settings → Pages → Source: GitHub Actions**. Los PR corren `ci.yml` sin desplegar.

## Configurar Firebase
1. Crea un proyecto en la consola de Firebase (plan Spark), activa Firestore y Authentication → Google, y agrega `hugofernandocolmenares.github.io` a los dominios autorizados.
2. Registra una app web y guarda los valores de su `firebaseConfig` como **secrets del repo** (`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`). El workflow de deploy los inyecta en el build. En tu PC usa `.env` y `npm run env:local` (ver arriba). [`src/environments/environment.ts`](src/environments/environment.ts) queda **vacío en el repo** y, sin `apiKey`, la app usa el modo demo. **No lo commitees con valores reales.**
3. `npx firebase-tools deploy --only firestore:rules,firestore:indexes`
4. Crea `admins/{tuUID}` en Firestore para tener permisos de admin.

Paso a paso completo en la [guía de arquitectura](docs/files/guia-arquitectura.md#crear-el-proyecto-firebase-paso-a-paso). No se suben secretos: la config web de Firebase no es secreta (la seguridad la dan [`firestore.rules`](firestore.rules)), pero igual se mantiene fuera del repo; `.env*` y archivos de *service account* están en `.gitignore`.

## Documentación
- [Auditoría de los sitios originales](docs/files/auditoria.md)
- [Lista de mejoras](docs/files/mejoras.md)
- [Guía de arquitectura](docs/files/guia-arquitectura.md) — stack, carpetas, BaaS, modelo de datos, reglas, deploy
- [Guía de diseño](docs/files/guia-diseno.md) — colores, tipografía, componentes, responsive, flujos
- [Capturas](docs/screenshots/) — `a-*`/`b-*` = sitios originales, `new-*` = app nueva (`-phone` 375 px, `-tablet` 768 px, `-desktop` 1440 px)

## Créditos
Desarrollado con ♥ y caos por **[FeithNoir](https://github.com/FeithNoir)**. Código bajo licencia MIT ([LICENSE](LICENSE)). Las imágenes de terceros enlazadas en los premios pertenecen a sus autores.
