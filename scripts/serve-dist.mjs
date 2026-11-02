// Sirve el build bajo /VengaJustiLolisAlvZNg/ igual que GitHub Pages (con fallback 404.html). Uso: npm run serve:dist
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const base = '/VengaJustiLolisAlvZNg/', root = 'dist/vengajusti/browser', port = Number(process.env.PORT ?? 4300);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' };
createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!url.startsWith(base)) { res.writeHead(302, { location: base }); return res.end(); }
  let rel = normalize(url.slice(base.length)).replace(/^(\.\.[/\\])+/, '') || 'index.html';
  if (rel === '.' || rel.endsWith('/')) rel = join(rel, 'index.html');
  const tryRead = async () => { try { return await readFile(join(root, rel)); } catch { rel = join(rel, 'index.html'); return readFile(join(root, rel)); } };
  try { const body = await tryRead(); res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404, { 'content-type': types['.html'] }); res.end(await readFile(join(root, '404.html'))); }
}).listen(port, () => console.log(`http://localhost:${port}${base}`));
