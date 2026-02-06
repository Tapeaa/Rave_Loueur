import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { removeDriverSessionId, getDriverProfile, type DriverProfile } from '@/lib/api';
import { removeExternalId, addDriverTag } from '@/lib/onesignal';
import * as SecureStore from 'expo-secure-store';
import { disconnectSocket } from '@/lib/socket';
import { useState, useEffect } from 'react';

export default function ChauffeurProfilScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getDriverProfile();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    addDriverTag('status', 'offline');
    removeExternalId();
    await SecureStore.deleteItemAsync('driverExternalId');
    await removeDriverSessionId();
    disconnectSocket();
    router.replace('/(chauffeur)/login');
  };

  const getTypeLabel = (type: string, prestataireName?: string | null) => {
    switch (type) {
      case 'salarie':
        // Si le chauffeur est lié à un prestataire, afficher le nom du prestataire
        return prestataireName ? `Salarié ${prestataireName}` : 'Salarié';
      case 'patente':
        return 'Patenté (Indépendant)';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'salarie' ? '#3b82f6' : '#f59e0b';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h1">Profil Chauffeur</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#F5C400" style={{ marginTop: 40 }} />
        ) : (
          <>
            <Card style={styles.profileCard}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#F5C400" />
              </View>
              <Text variant="h3">
                {profile ? `${profile.firstName} ${profile.lastName}` : "Chauffeur TĀPE'A"}
              </Text>
              <Text variant="caption" style={{ color: profile?.isActive ? '#22c55e' : '#ef4444' }}>
                {profile?.isActive ? 'Actif' : 'Inactif'}
              </Text>
              
              {/* Type de chauffeur */}
              {profile && (
                <View style={[styles.typeBadge, { backgroundColor: getTypeColor(profile.typeChauffeur) + '20', borderColor: getTypeColor(profile.typeChauffeur) }]}>
                  <Ionicons 
                    name={profile.typeChauffeur === 'salarie' ? 'people' : 'briefcase'} 
                    size={16} 
                    color={getTypeColor(profile.typeChauffeur)} 
                  />
                  <Text style={[styles.typeText, { color: getTypeColor(profile.typeChauffeur) }]}>
                    {getTypeLabel(profile.typeChauffeur, profile.prestataireName)}
                  </Text>
                </View>
              )}
            </Card>
            
            {/* Statistiques */}
            {profile && (
              <Card style={styles.statsCard}>
                <Text variant="label" style={styles.sectionTitle}>Statistiques</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{profile.totalRides}</Text>
                    <Text style={styles.statLabel}>Courses</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile.averageRating ? profile.averageRating.toFixed(1) : '-'}
                    </Text>
                    <Text style={styles.statLabel}>Note</Text>
                  </View>
                </View>
              </Card>
            )}

            <View style={styles.menuContainer}>
              <View>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => setShowVehicleInfo(!showVehicleInfo)}
                  accessibilityLabel="Mon véhicule"
                  accessibilityRole="button"
                  accessibilityHint={showVehicleInfo ? "Masque les informations du véhicule" : "Affiche les informations du véhicule"}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name="car-outline" size={22} color="#1a1a1a" />
                  </View>
                  <Text variant="body">Mon véhicule</Text>
                  <Ionicons 
                    name={showVehicleInfo ? "chevron-down" : "chevron-forward"} 
                    size={20} 
                    color="#6b7280" 
                  />
                </TouchableOpacity>
                {showVehicleInfo && profile && (
                  <View style={styles.vehicleInfoContainer}>
                    {profile.vehicleModel ? (
                      <Text style={styles.vehicleInfoText}>
                        Modèle : {profile.vehicleModel}
                      </Text>
                    ) : null}
                    {profile.vehiclePlate ? (
                      <Text style={styles.vehicleInfoText}>
                        Plaque : {profile.vehiclePlate}
                      </Text>
                    ) : null}
                    {!profile.vehicleModel && !profile.vehiclePlate && (
                      <Text style={styles.vehicleInfoText}>
                        Aucune information disponible
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  Alert.alert(
                    'Contactez nous',
                    `Email : tapea.pf@gmail.com\n\nTéléphone : +689 87 75 98 97`,
                    [
                      {
                        text: 'Appeler',
                        onPress: () => Linking.openURL('tel:+68987759897'),
                      },
                      {
                        text: 'Envoyer un email',
                        onPress: () => Linking.openURL('mailto:tapea.pf@gmail.com'),
                      },
                      { text: 'Fermer', style: 'cancel' },
                    ]
                  );
                }}
                accessibilityLabel="Contactez nous par email ou téléphone"
                accessibilityRole="button"
                accessibilityHint="Ouvre un menu avec les options pour appeler ou envoyer un email"
              >
                <View style={styles.menuIcon}>
                  <Ionicons name="mail-outline" size={22} color="#1a1a1a" />
                </View>
                <Text variant="body">Contactez nous</Text>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Section Légal */}
            <View style={styles.legalSection}>
              <Text variant="label" style={styles.legalSectionTitle}>Légal</Text>
              <TouchableOpacity 
                style={styles.legalMenuItem}
                onPress={() => {
                  const url = 'https://tape-a.com/politique-de-confidentialite-tapea/';
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Erreur', 'Impossible d\'ouvrir la page web');
                  });
                }}
                activeOpacity={0.7}
                accessibilityLabel="Politique de confidentialité"
                accessibilityRole="link"
                accessibilityHint="Ouvre la politique de confidentialité dans le navigateur"
              >
                <View style={styles.legalMenuIcon}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#5c5c5c" />
                </View>
                <Text variant="body" style={styles.legalMenuText}>Politique de confidentialité</Text>
                <Ionicons name="chevron-forward" size={20} color="#5c5c5c" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.legalMenuItem}
                onPress={() => router.push('/(chauffeur)/conditions-utilisation')}
                activeOpacity={0.7}
                accessibilityLabel="Conditions d'utilisation"
                accessibilityRole="button"
                accessibilityHint="Affiche les conditions d'utilisation de l'application"
              >
                <View style={styles.legalMenuIcon}>
                  <Ionicons name="document-text-outline" size={20} color="#5c5c5c" />
                </View>
                <Text variant="body" style={styles.legalMenuText}>Conditions d'utilisation</Text>
                <Ionicons name="chevron-forward" size={20} color="#5c5c5c" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
              accessibilityLabel="Se déconnecter"
              accessibilityRole="button"
              accessibilityHint="Déconnecte le chauffeur et retourne à l'écran de connexion"
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text variant="body" style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  menuContainer: {
    gap: 8,
    marginBottom: 24,
  },
  legalSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  legalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#343434',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  legalMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffdf6d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  legalMenuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#5c5c5c',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  vehicleInfoContainer: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  vehicleInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
  },
});
