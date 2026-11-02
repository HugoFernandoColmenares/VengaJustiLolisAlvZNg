import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { environment } from '../environments/environment';

const contestRedirect = (year: string, fragment: string | null) => {
  if (!/^\d{4}$/.test(year)) return '/posts';
  return inject(Router).createUrlTree(['/posts', `premios-${year}`], { fragment: fragment ?? undefined });
};

export const routes: Routes = [
  { path: '', title: 'VengaJustiLolis Alv Z — Premios, lore y caos de la Grieta', loadComponent: () => import('./pages/home').then(m => m.HomePage) },
  { path: 'premios', pathMatch: 'full', redirectTo: 'posts/premios-2025' },
  { path: 'premios/:year', redirectTo: ({ params, fragment }) => contestRedirect(String(params['year'] ?? ''), fragment) },
  { path: 'votar', pathMatch: 'full', redirectTo: ({ fragment }) => contestRedirect(String(environment.votingYear), fragment) },
  { path: 'lore', title: 'La Grieta — Lore de VengaJustiLolis', loadComponent: () => import('./pages/lore').then(m => m.LorePage) },
  { path: 'personajes', title: 'Personajes y facciones — VengaJustiLolis', loadComponent: () => import('./pages/characters').then(m => m.CharactersPage) },
  { path: 'posts', title: 'Posts — VengaJustiLolis', loadComponent: () => import('./pages/posts').then(m => m.PostsPage) },
  { path: 'posts/:id', title: 'Post — VengaJustiLolis', loadComponent: () => import('./pages/post-detail').then(m => m.PostDetailPage) },
  { path: 'admin', title: 'Admin — VengaJustiLolis', loadComponent: () => import('./pages/admin').then(m => m.AdminPage) },
  { path: '**', title: 'Te perdiste en la Grieta', loadComponent: () => import('./pages/not-found').then(m => m.NotFoundPage) },
];
