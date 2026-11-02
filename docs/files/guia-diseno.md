# Guía de diseño — "Cómic de la Grieta"

Sistema derivado del sitio de premios original (A). Fuente de verdad: variables CSS en `src/styles.scss`.

## Principios
1. **Viñeta de cómic:** todo bloque importante es una tarjeta blanca con borde negro de 3 px y sombra dura (sin desenfoque).
2. **Caos controlado:** inclinaciones leves (±0,6°) alternadas, nunca aleatorias, y solo desde 768 px.
3. **El dato manda:** en premios, el ganador va en caja amarilla antes que el gráfico.
4. **Legible primero:** contraste AA en todo texto; el color decorativo nunca carga texto pequeño.

## Color
| Token | Hex | Uso |
|---|---|---|
| `--c-yellow` | `#FFCC00` | Header, caja de ganador, botón de confirmación, citas destacadas |
| `--c-blue` | `#00BFFF` | Hero, cabeceras de tarjeta, foco (`:focus-visible`) |
| `--c-pink` | `#EC4899` | CTA principal, ruta activa, subrayado de títulos, "FINISH!" |
| `--c-green` `--c-purple` `--c-orange` | `#22C55E` `#CC65FE` `#FF9F40` | Series de gráficos, acentos de personajes y facciones |
| `--c-pink-ink` | `#BE185D` | Texto rosa sobre claro (5,9:1) |
| `--c-blue-ink` | `#0369A1` | Enlaces y texto azul sobre claro (5,9:1) |
| `--c-page` | `#FEFCE8` | Fondo con trama *halftone* (puntos 1 px cada 20 px) |
| `--c-text` / `--c-muted` | `#1F2937` / `#4B5563` | Texto principal / secundario (≥7:1 y ≥7:1 sobre blanco) |
| `--c-dark` | `#111827` | Footer |

Reglas: texto blanco sobre azul/rosa solo en tamaños de título y siempre con `text-shadow` negro de 2–3 px (efecto contorno). Amarillo nunca como color de texto sobre blanco.

## Tipografía
| Rol | Fuente | Tamaños |
|---|---|---|
| Display (h1–h4, botones, logo) | **Bangers** | h1 de página `clamp(3.4rem, 8vw, 6rem)`; hero `clamp(4.6rem, 13vw, 11rem)`; h2 `clamp(2.8rem, 5vw, 4rem)` |
| Cuerpo | **Outfit** 400/700 | 1,7 rem (17 px), interlineado 1,6 |
| Retro/chat (burbujas, metadatos, avisos, conteos) | **VT323** | 1,8–2,2 rem, interlineado 1,2–1,25 |

`html { font-size: 62.5% }` ⇒ 1 rem = 10 px. Mayúsculas solo vía Bangers (ya es mayúscula) o en cabeceras de tarjeta.

## Espaciado y forma
Escala `--s-1…--s-8`: 4, 8, 12, 16, 24, 32, 48, 64 px. Contenedor máx. 1200 px con 16 px laterales; texto largo máx. 900 px.
Borde `--bw: 3px`. Sombras: `--sh-sm` 3/3, `--sh` 6/6, `--sh-lg` 10/10 (hover).

## Componentes
| Componente | Clase | Notas |
|---|---|---|
| Botón | `.btn` + `--yellow/--pink/--blue/--dark` | Alto mínimo 44 px. Hover: sube 2 px y crece la sombra. Active: se "hunde" sin sombra. Disabled: 55 % opacidad sin sombra |
| Tarjeta | `.card`, `.card__head`, `.card__body` | Cabecera azul por defecto; rosa (gameplay) y verde (locaciones) como variantes |
| Caja de ganador | `.winner` (premios) | Amarillo + sombra pequeña; etiqueta VT323 + nombre Bangers |
| Gráfico de barras | `<app-bar-chart>` | Lista ordenada; barra con borde negro, color por posición; animación de crecimiento (se apaga con movimiento reducido) |
| Burbuja de diálogo | `.dialog`, `.bubble`, `.avatar` | Alterna izquierda/derecha; avatar "?" anónimo con color fijo por posición |
| Avatar de personaje | `.char__avatar` | Círculo 96 px con inicial y color del personaje (hasta tener arte) |
| Aviso | `.notice`, `--ok`, `--error` | Borde punteado, VT323; usar `role="status"` o `role="alert"` |
| Opción de voto | `.option` | Radio nativo dentro de `<label>`; seleccionado = amarillo + sombra |
| Campo | `.field` | Label Bangers, input con borde de 3 px y sombra interior |
| Badge | `.badge` | Etiquetas/tags |

## Estados
- **Foco:** contorno azul `#00BFFF` de 4 px con 3 px de separación en todo elemento interactivo.
- **Activo (ruta):** botón rosa con texto blanco contorneado + `aria-current="page"`.
- **Cargando / vacío / error:** `.notice` con texto explícito ("Cargando…", "Aún no hay posts…", "No se pudieron cargar…").
- **Modo demo:** barra negra con texto amarillo bajo el header.

## Responsive
| Rango | Reglas |
|---|---|
| < 768 px | Una columna, sin inclinaciones, menú hamburguesa (≥48 px), CTA apilados |
| 768–1023 px | Rejillas de 2 columnas, inclinaciones activas, aún menú hamburguesa |
| ≥ 1024 px | Menú horizontal (Inicio, Posts, Lore) |
| ≥ 1100 px | Personajes en 4 columnas, ganadores en 3 |
Nunca debe existir scroll horizontal (verificado con Playwright a 360/768/1366/1920).

## Flujos UX
**Votar (dentro del post del año)**
1. Inicio → "Votar Premios 2026" → `/posts/premios-2026`. `/votar` redirige al mismo post.
2. Sin sesión: tarjeta para entrar (Google en producción; en demo, admin de prueba o cuenta pendiente).
3. Cuenta pendiente o rechazada: pantalla "Tu cuenta está pendiente de aprobación". Puede leer el post; no vota.
4. Por categoría abierta: elegir un nominado (radio) → "Confirmar voto" (deshabilitado hasta elegir).
5. Éxito: aviso verde "¡Voto registrado por X!" y la tarjeta cambia a "Ya votaste por X" + conteo parcial.
6. Si ya había votado: aviso rojo "Ya votaste en esta categoría este año." El voto no se puede cambiar.
7. Categoría cerrada: caja amarilla con el resultado y el gráfico. No pide sesión.

**Posts**
1. `/posts`: lista cronológica (más nuevo primero) con fecha en formato es-CO, autor, extracto y "Leer más". El post de premios lleva la etiqueta "Premios {año}".
2. `/posts/:id`: artículo con saltos de línea respetados, etiquetas y, si tiene año, la votación o los resultados.
3. Admin: botón "+ Nuevo post" → `/admin`. Título ≤140, contenido, etiquetas, año de premios opcional y portada. Al publicar navega al post.

**Admin de categorías y usuarios**
`/admin` → **Usuarios** (aprobar, rechazar, revocar) y "Categoría 2026": título, descripción, nominados (uno por línea), orden y si la votación sigue abierta. Cada categoría del año tiene un botón para abrirla o cerrarla.
