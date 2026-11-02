# Lista de mejoras accionables

Derivada de [auditoria.md](auditoria.md). Cada ítem indica qué se hizo en la app Angular o qué falta.

## Hechas en esta fusión
1. **Un solo sitio**: premios + votación + posts + lore en una app Angular 22 con el estilo cómic de A.
2. **Sin scroll horizontal en móvil**: las inclinaciones de tarjetas solo se aplican desde 768 px y son fijas (no aleatorias).
3. **Contraste AA**: texto de burbujas en gris oscuro sobre blanco; variantes "tinta" de rosa (`#BE185D`) y azul (`#0369A1`) para texto.
4. **Gráficos accesibles**: componente `app-bar-chart` en HTML/CSS (lista `<ol>` con nombre y votos legibles por lector de pantalla). Se eliminaron Chart.js y chart.xkcd (≈250 KB menos).
5. **SEO y compartir en WhatsApp**: `meta description`, Open Graph, Twitter Card, `og-image.png` propia, favicon SVG, `theme-color`, título por ruta.
6. **Fuera Tailwind CDN y placeholders**: avatares de personajes con su inicial y color en CSS.
7. **Ganador destacado**: caja amarilla con sombra dura, etiqueta "Ganador indiscutible / Empate histórico".
8. **Navegación accesible**: menú con `aria-expanded`/`aria-controls`, `aria-current="page"`, enlace "Saltar al contenido", foco visible azul de 4 px, botones ≥44 px.
9. **Movimiento reducido**: `prefers-reduced-motion` desactiva animaciones, rebotes, smooth scroll e inclinaciones.
10. **Fuentes**: una sola petición (Bangers, Outfit, VT323) con `preconnect` y `display=swap`.
11. **Imagen caducable** de "Admin del Año" reemplazada por un patrón propio.
12. **Rutas lazy** con 404 temático ("te tragó la Grieta") y `404.html` para GitHub Pages.
13. **Votación y posts** detrás de una interfaz `Backend` (Firebase o modo demo con localStorage).
14. **Localismos**: "móvil" → "celular" en el lore.

## Aplicadas en la ronda de UI/UX del 28-oct-2026
15. **Cero imágenes hotlinkeadas**: las 6 cabeceras de categorías de 2025 (Twitter, TheGamer, Wallpapercave, Alphacoders, GameRant y la URL firmada de DeviantArt) se reemplazaron por arte cómic en CSS distinto por categoría (tramas, rayos, círculos). La URL con token también se borró de `legacy/awards/main.js`. Un test (`awards-2025.data.spec.ts`) falla si vuelve a aparecer una URL externa, `wixmp`, `token=` o `placeholder.com`. (A2, A12, B1)
16. **Deep links con 200**: el build genera `index.html` en cada ruta estática (`/premios/2025`, `/lore`, `/votar`, …) además de `404.html`, así que abrir o compartir esos enlaces ya no responde 404 (mejor vista previa en WhatsApp y SEO). (A11, B7)
17. **Metadatos completos para compartir**: `og:site_name`, `og:locale`, tamaño y `alt` de `og:image`, `twitter:title/description/image`; título de portada descriptivo.
18. **Teclado**: `Esc` cierra el menú móvil y devuelve el foco al botón; "Saltar al contenido" enfoca el `<main>` (con `<base href>` el `#ancla` llevaba a la portada). (A9)
19. **Verificado con Playwright + axe-core** en 320/375/768/1024/1440 px y 8 rutas: 0 px de scroll horizontal, 0 violaciones WCAG 2 A/AA de axe, 0 errores de consola, ninguna petición a dominios de terceros salvo Google Fonts. Capturas `new-*-phone/tablet/desktop.png`.
20. **Credenciales fuera del repo**: `environment.ts` con valores vacíos; la config de Firebase se inyecta en el deploy desde secrets de GitHub Actions (`scripts/inject-firebase-env.mjs`); `.gitignore` cubre `.env*`, *service accounts*, `.pem`/`.key`.

## Nav, premios dentro de posts y aprobación (esta rama)
21. **Menú de tres ítems**: Inicio, Posts y Lore. Lore sigue siendo la página estática de la Grieta; Personajes sale del menú y se entra desde Lore.
22. **Premios por año, dentro de un post.** `/votar` y `/premios/:año` redirigen a `/posts/premios-{año}`. 2026 vota o muestra resultados según `open`. 2025 reutiliza el bloque de resultados que ya estaba.
23. **Aprobación manual.** Google crea `users/{uid}` en `pending`. Pendiente y rechazada ven la pantalla de espera y no votan. El admin aprueba, rechaza o revoca en `/admin`. Quien está en `admins/{uid}` cuenta como aprobada.
24. **Reglas de Firestore** cubren `users` y exigen cuenta aprobada para votar. Se prueban con el emulador (`npm run test:rules`). No se despliegan al proyecto real desde CI.

## Pendientes (TODO)
- [ ] Crear el proyecto Firebase, guardar su config como secrets del repo (no en `environment.ts`) y desplegar `firestore.rules` (ver [guia-arquitectura.md](guia-arquitectura.md)). *Requiere la conexión a Firebase.*
- [ ] Agregar los UID de los admins en la colección `admins` desde la consola. *Requiere Firebase.*
- [ ] Crear las categorías reales de la votación 2026 desde `/admin` (las del modo demo son de ejemplo). *Requiere Firebase.*
- [ ] Subir arte propio (o con permiso) a `public/img/` para las cabeceras de categorías y poner la ruta en `awards-2025.data.ts`. *Ya no hay hotlinks (hoy es arte CSS); falta el arte original de Hugo.*
- [ ] Ilustraciones reales de personajes (hoy son iniciales en círculos de color). *Requiere arte original.*
- [ ] Prerender/SSG de páginas estáticas para SEO sin JavaScript. *Pospuesto: conviene hacerlo junto con la conexión a Firebase para no prerenderizar datos del modo demo; mientras tanto cada ruta responde 200 con sus metadatos base.*
- [ ] Lighthouse + axe en CI. *axe ya se corrió localmente (0 violaciones); falta automatizarlo en el workflow.*
- [ ] Revisar con el grupo los textos de lore para pasar el resto de expresiones de España a español latino. *Es contenido del grupo: se dejó tal cual salvo "móvil" → "celular".*
- [x] Activar GitHub Pages con "Source: GitHub Actions" en la configuración del repo (el sitio ya está publicado).
