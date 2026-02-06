import { Redirect } from 'expo-router';
import Constants from 'expo-constants';

export default function AppIndex() {
  // FORCER le mode chauffeur - cette app est UNIQUEMENT pour les chauffeurs
  const appMode = Constants.expoConfig?.extra?.appMode || 'chauffeur';
  
  console.log('[INDEX] appMode détecté:', appMode);
  console.log('[INDEX] FORCÉ: mode chauffeur - Redirecting to /(chauffeur)');
  
  // Rediriger vers le groupe (chauffeur) qui chargera automatiquement index
  return <Redirect href="/(chauffeur)" />;
}
