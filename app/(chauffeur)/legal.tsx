import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { apiPatch, getDriverSessionId, getDriverProfile, removeDriverSessionId, SessionExpiredError } from '@/lib/api';
import type { Driver } from '@/lib/types';

// Composant Checkbox simple
const Checkbox = ({ checked, onValueChange }: { checked: boolean; onValueChange: (value: boolean) => void }) => (
  <TouchableOpacity
    onPress={() => onValueChange(!checked)}
    style={{
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: checked ? '#F5C400' : '#D1D5DB',
      borderRadius: 4,
      backgroundColor: checked ? '#F5C400' : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    }}
    accessibilityLabel={checked ? "Coché" : "Non coché"}
    accessibilityRole="checkbox"
    accessibilityState={{ checked }}
  >
    {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
  </TouchableOpacity>
);

// Versions des documents légaux
const LEGAL_VERSIONS = {
  CGU: '2026-01-21',
  PRIVACY_POLICY: '2026-01-21'
} as const;

export default function LegalScreen() {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const hasRedirectedRef = useRef(false);
  const isAcceptingRef = useRef(false); // Flag pour éviter les redirections pendant l'acceptation

  // Charger le profil du chauffeur
  useEffect(() => {
    const loadDriver = async () => {
      try {
        const driverProfile = await getDriverProfile();
        if (driverProfile) {
          setDriver(driverProfile as Driver);
        } else {
          // Si le profil ne peut pas être chargé, rediriger vers login
          console.log('[LEGAL] Could not load driver profile, redirecting to login');
          await removeDriverSessionId();
          router.replace('/(chauffeur)/login');
        }
      } catch (error) {
        // Si la session est expirée, rediriger vers login
        if (error instanceof SessionExpiredError) {
          console.log('[LEGAL] Session expired, redirecting to login');
          await removeDriverSessionId();
          router.replace('/(chauffeur)/login');
        } else {
          console.error('[LEGAL] Error loading driver profile:', error);
          // En cas d'autre erreur, aussi rediriger vers login pour éviter d'être coincé
          await removeDriverSessionId();
          router.replace('/(chauffeur)/login');
        }
      }
    };
    loadDriver();
  }, [router]);

  // Si le chauffeur a déjà accepté les CGU, rediriger vers l'accueil
  // Mais ne pas rediriger si on est en train d'accepter (pour éviter les doubles redirections)
  useEffect(() => {
    if (hasRedirectedRef.current || isAcceptingRef.current) return;
    
    if (driver && driver.cguAccepted === true) {
      console.log('[LEGAL] Driver has already accepted CGU, redirecting to home');
      hasRedirectedRef.current = true;
      router.replace('/(chauffeur)');
    }
  }, [driver, router]);

  const [acceptCGU, setAcceptCGU] = useState(false);
  const [readPrivacyPolicy, setReadPrivacyPolicy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAcceptCGU = async () => {
    if (!acceptCGU) {
      Alert.alert('Erreur', 'Vous devez accepter les Conditions d\'utilisation pour continuer');
      return;
    }

    if (!readPrivacyPolicy) {
      Alert.alert('Erreur', 'Vous devez confirmer avoir pris connaissance de la Politique de confidentialité');
      return;
    }

    if (!driver) {
      Alert.alert('Erreur', 'Impossible de récupérer votre profil. Veuillez réessayer.');
      return;
    }

    setIsLoading(true);
    isAcceptingRef.current = true; // Marquer qu'on est en train d'accepter

    try {
      // Sauvegarder les acceptations légales
      const legalData = {
        cguAccepted: true,
        cguAcceptedAt: new Date().toISOString(),
        cguVersion: LEGAL_VERSIONS.CGU,
        privacyPolicyRead: true,
        privacyPolicyReadAt: new Date().toISOString(),
        privacyPolicyVersion: LEGAL_VERSIONS.PRIVACY_POLICY
      };

      // Sauvegarder dans l'API backend
      try {
        const sessionId = await getDriverSessionId();
        if (sessionId) {
          await apiPatch(`/api/drivers/${driver.id}/legal`, legalData, {
            headers: { 'X-Driver-Session': sessionId }
          });
        }
        console.log('[LEGAL] Legal acceptances saved to API successfully');
      } catch (apiError) {
        console.warn('[LEGAL] Could not save to API:', apiError);
        // On continue quand même car on va stocker localement
      }

      // IMPORTANT: Stocker l'acceptation dans SecureStore pour éviter la boucle
      // Le backend ne retourne pas toujours cguAccepted dans le profil, donc on utilise ce stockage
      await SecureStore.setItemAsync(`driver_${driver.id}_cgu_accepted`, 'true');
      await SecureStore.setItemAsync(`driver_${driver.id}_cgu_accepted_at`, new Date().toISOString());
      console.log('[LEGAL] CGU acceptance stored in SecureStore');

      // Mettre à jour les données locales du chauffeur
      const updatedDriver: Driver = {
        ...driver,
        ...legalData
      };
      setDriver(updatedDriver);
      console.log('[LEGAL] Local driver data updated, cguAccepted:', updatedDriver.cguAccepted);

      // Attendre un peu avant de rediriger
      await new Promise(resolve => setTimeout(resolve, 200));

      // Rediriger vers le groupe (chauffeur) qui chargera automatiquement index
      console.log('[LEGAL] CGU accepted, redirecting to /(chauffeur) (which will load index)');
      hasRedirectedRef.current = true; // Marquer comme redirigé pour éviter les doubles redirections
      router.replace('/(chauffeur)');
    } catch (error) {
      console.error('[LEGAL] Error saving legal acceptances:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde');
      isAcceptingRef.current = false; // Réinitialiser le flag en cas d'erreur
    } finally {
      setIsLoading(false);
      // Ne pas réinitialiser isAcceptingRef ici car on a déjà redirigé
    }
  };

  const openCGU = () => {
    router.push('/(chauffeur)/conditions-utilisation');
  };

  const openPrivacyPolicy = () => {
    const url = 'https://tape-a.com/politique-de-confidentialite-tapea/';
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la page web');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={48} color="#F5C400" />
          </View>
          <Text variant="h1" style={styles.title}>Conditions légales</Text>
          <Text variant="body" style={styles.subtitle}>
            Avant de continuer, veuillez prendre connaissance de nos documents légaux
          </Text>
        </View>

        <View style={styles.content}>
          {/* Case CGU obligatoire */}
          <View style={styles.legalSection}>
            <View style={styles.checkboxContainer}>
              <Checkbox
                checked={acceptCGU}
                onValueChange={setAcceptCGU}
              />
              <View style={styles.checkboxText}>
                <Text variant="body" style={styles.checkboxLabel}>
                  J'accepte les Conditions d'utilisation (CGU)
                </Text>
                <TouchableOpacity 
                  onPress={openCGU}
                  accessibilityLabel="Lire les Conditions d'utilisation"
                  accessibilityRole="link"
                  accessibilityHint="Ouvre les Conditions d'utilisation dans l'application"
                >
                  <Text variant="caption" style={styles.link}>
                    Lire les CGU
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Case Politique de confidentialité */}
          <View style={styles.legalSection}>
            <View style={styles.checkboxContainer}>
              <Checkbox
                checked={readPrivacyPolicy}
                onValueChange={setReadPrivacyPolicy}
              />
              <View style={styles.checkboxText}>
                <Text variant="body" style={styles.checkboxLabel}>
                  J'ai pris connaissance de la Politique de confidentialité
                </Text>
                <TouchableOpacity 
                  onPress={openPrivacyPolicy}
                  accessibilityLabel="Lire la Politique de confidentialité"
                  accessibilityRole="link"
                  accessibilityHint="Ouvre la Politique de confidentialité dans le navigateur"
                >
                  <Text variant="caption" style={styles.link}>
                    Lire la Politique de confidentialité
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle" size={20} color="#6b7280" />
            <Text variant="caption" style={styles.infoText}>
              Ces informations sont nécessaires pour finaliser votre inscription et utiliser l'application.
            </Text>
          </View>

          <Button
            title="Finaliser mon inscription"
            onPress={handleAcceptCGU}
            loading={isLoading}
            disabled={!acceptCGU || !readPrivacyPolicy}
            fullWidth
            style={styles.button}
            accessibilityLabel="Finaliser mon inscription en acceptant les conditions légales"
            accessibilityRole="button"
            accessibilityHint="Valide l'acceptation des Conditions d'utilisation et de la Politique de confidentialité"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    marginTop: 8,
    marginBottom: 24,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5C40020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    lineHeight: 20,
  },
  content: {
    gap: 24,
  },
  legalSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxText: {
    flex: 1,
  },
  checkboxLabel: {
    marginBottom: 4,
    lineHeight: 20,
  },
  link: {
    color: '#F5C400',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    flex: 1,
    color: '#6b7280',
    lineHeight: 16,
  },
  button: {
    marginTop: 8,
  },
});
