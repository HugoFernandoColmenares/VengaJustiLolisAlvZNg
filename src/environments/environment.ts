/**
 * Configuración web de Firebase: DEJAR VACÍA EN EL REPO.
 * En el deploy, GitHub Actions la rellena desde los secrets del repo (scripts/inject-firebase-env.mjs).
 * Si `apiKey` está vacío, la app usa el backend local (localStorage) como modo demo.
 * Para probar Firebase en tu PC: copia `.env.example` a `.env`, completa las variables y corre
 * `npm run env:local`. NO hagas commit del archivo modificado
 * (`git restore src/environments/environment.ts`).
 * Ver docs/files/guia-arquitectura.md → "Crear el proyecto Firebase".
 */
export const environment = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  /** Año de la votación abierta actualmente. */
  votingYear: 2026,
  /**
   * Edge Function pública de subida. No es un secreto: solo el service role (dentro de la función) escribe.
   * Ver docs/files/imagenes-supabase.md.
   */
  imageUploadUrl: 'https://ebhxbmtmrayolmlkdsom.supabase.co/functions/v1/vengajusti-upload',
};
