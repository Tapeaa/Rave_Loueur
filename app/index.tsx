import { Redirect } from 'expo-router';
import Constants from 'expo-constants';

export default function AppIndex() {
  // App Loueur : login par code 6 chiffres (groupe Expo encore nommé chauffeur)
  const appMode = Constants.expoConfig?.extra?.appMode || 'chauffeur';
  
  console.log('[INDEX] appMode détecté:', appMode);
  console.log('[INDEX] App Loueur — Redirecting to /(chauffeur)');
  
  // Rediriger vers le groupe (chauffeur) qui chargera automatiquement index
  return <Redirect href="/(chauffeur)" />;
}
