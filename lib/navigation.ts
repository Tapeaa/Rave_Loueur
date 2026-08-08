import type { Router } from 'expo-router';

/**
 * Retour sécurisé : évite l'erreur "GO_BACK was not handled"
 * quand l'écran a été ouvert via replace / deep link sans historique.
 */
export function safeBack(
  router: Pick<Router, 'canGoBack' | 'back' | 'replace'>,
  fallback: string = '/(chauffeur)',
) {
  try {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // ignore
  }
  router.replace(fallback as any);
}
