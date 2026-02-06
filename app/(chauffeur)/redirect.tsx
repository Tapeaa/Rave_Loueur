import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { getDriverProfile } from '@/lib/api';
import type { Driver } from '@/lib/types';

/**
 * Composant de redirection qui vérifie l'état de connexion et les CGU
 * et redirige vers la page appropriée
 */
export default function ChauffeurRedirect() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    const checkAndRedirect = async () => {
      try {
        const driverProfile = await getDriverProfile();
        
        if (!driverProfile) {
          // Pas de session, rediriger vers login
          console.log('[REDIRECT] No driver profile, redirecting to login');
          hasRedirectedRef.current = true;
          router.push('/(chauffeur)/login');
          setIsLoading(false);
          return;
        }

        const driver = driverProfile as Driver;
        console.log('[REDIRECT] Driver profile found, cguAccepted:', driver.cguAccepted);
        
        // Vérifier si les CGU sont acceptées
        if (driver.cguAccepted === false) {
          // CGU non acceptées, rediriger vers la page légale
          console.log('[REDIRECT] CGU not accepted, redirecting to legal');
          hasRedirectedRef.current = true;
          router.push('/(chauffeur)/legal');
        } else {
          // CGU acceptées ou undefined, rediriger vers l'accueil
          console.log('[REDIRECT] CGU accepted or undefined, redirecting to index');
          hasRedirectedRef.current = true;
          // Utiliser router.push au lieu de replace pour forcer la navigation
          router.push('/(chauffeur)');
        }
      } catch (error) {
        console.error('[REDIRECT] Error checking driver profile:', error);
        // En cas d'erreur, rediriger vers login
        hasRedirectedRef.current = true;
        router.push('/(chauffeur)/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAndRedirect();
  }, [router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F5C400" />
      </View>
    );
  }

  return null;
}
