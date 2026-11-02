export interface VoteResult { name: string; votes: number }

/** Categoría con resultados cerrados (histórico, p. ej. 2025). */
export interface AwardCategoryResult {
  id: string; title: string; winner: string; description: string; tie?: boolean;
  flavor: string; image: string | null; results: VoteResult[];
}
export interface OpinionBlock { title: string; comments: string[] }

/** Foto de un nominado. Lista, no mapa: el nombre puede llevar puntos y Firestore no los acepta en claves. */
export interface NomineeImage { name: string; image: string }

/** Categoría votable de un año (colección `categories`). */
export interface Category {
  id: string; year: number; title: string; description: string; nominees: string[]; open: boolean; order: number;
  /** URL pública de la portada (Supabase Storage). */
  image?: string | null;
  /** Fotos opcionales. El voto sigue usando `nominees` (solo el nombre). */
  nomineeImages?: NomineeImage[];
}
/** Voto: id del documento = `${year}_${categoryId}_${uid}` → 1 voto por usuario/categoría/año. */
export interface Vote { year: number; categoryId: string; uid: string; nominee: string; createdAt: number }

export interface Post {
  id: string; title: string; body: string; authorUid: string; authorName: string; createdAt: number; tags: string[];
  /** URL pública de la portada (Supabase Storage). */
  image?: string | null;
  /**
   * Si viene, este post es el de premios de ese año: muestra la votación mientras
   * haya categorías abiertas y los resultados cuando se cierran.
   * El id estable es `premios-{año}` (rutas viejas redirigen ahí).
   */
  contestYear?: number | null;
}

export type AccountStatus = 'pending' | 'approved' | 'rejected';

/** Documento `users/{uid}`. El alta la hace el propio usuario; el estado solo lo cambia un admin. */
export interface UserAccount {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  status: AccountStatus;
  createdAt: number;
  approvedAt: number | null;
  approvedBy: string | null;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isAdmin: boolean;
  /** Quien tiene doc en `admins/{uid}` se trata como `approved`. */
  status: AccountStatus;
}
