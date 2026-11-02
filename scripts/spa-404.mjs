// GitHub Pages no sabe de rutas SPA:
// - 404.html = index.html, para que cualquier ruta desconocida cargue la app (y muestre el 404 temático).
// - Copias de index.html en cada ruta estática (premios/2025/index.html, lore/index.html, …) para que
//   abrir o compartir esos enlaces responda 200 en vez de 404 (mejor para SEO y vistas previas).
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
const dir = 'dist/vengajusti/browser';
const staticRoutes = [
  'premios', 'premios/2025', 'premios/2026', 'votar', 'lore', 'personajes',
  'posts', 'posts/premios-2025', 'posts/premios-2026', 'admin',
];
copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
for (const r of staticRoutes) {
  mkdirSync(`${dir}/${r}`, { recursive: true });
  copyFileSync(`${dir}/index.html`, `${dir}/${r}/index.html`);
}
writeFileSync(`${dir}/.nojekyll`, '');
console.log(`404.html, .nojekyll y ${staticRoutes.length} rutas estáticas creadas`);
