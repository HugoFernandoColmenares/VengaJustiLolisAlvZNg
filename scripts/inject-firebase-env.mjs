// Inyecta la config web de Firebase en el build SIN guardarla en el repo.
// Lee variables de entorno (en GitHub Actions vienen de los secrets del repo) y reescribe
// src/environments/environment.ts solo dentro del runner. Si no hay variables, no toca nada
// y la app queda en modo demo (localStorage).
import { readFileSync, writeFileSync } from 'node:fs';
const map = {
  apiKey: 'FIREBASE_API_KEY', authDomain: 'FIREBASE_AUTH_DOMAIN', projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET', messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID', appId: 'FIREBASE_APP_ID',
};
if (!process.env.FIREBASE_API_KEY) {
  console.log('Sin FIREBASE_API_KEY: build en modo demo (localStorage).');
  process.exit(0);
}
const file = 'src/environments/environment.ts';
let src = readFileSync(file, 'utf8');
for (const [key, env] of Object.entries(map)) {
  const value = (process.env[env] ?? '').replace(/[^A-Za-z0-9._:\/-]/g, '');
  src = src.replace(new RegExp(`${key}: '[^']*'`), `${key}: '${value}'`);
}
writeFileSync(file, src);
console.log('Config de Firebase inyectada desde variables de entorno (no se sube al repo).');
console.log('No commitees src/environments/environment.ts con estos valores: git restore src/environments/environment.ts');
