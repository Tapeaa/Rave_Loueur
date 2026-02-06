import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { 
  getCommissions, 
  getDriverProfile, 
  getDriverEarnings,
  invalidateCommissionsCache, 
  type Commission,
  type DriverEarnings,
  type DriverStats
} from '@/lib/api';

export default function ChauffeurGainsScreen() {
  const router = useRouter();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverType, setDriverType] = useState<'salarie' | 'patente'>('patente');
  const [driverName, setDriverName] = useState<string>('');
  const [earnings, setEarnings] = useState<DriverEarnings>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
  });
  const [stats, setStats] = useState<DriverStats>({
    totalRides: 0,
    totalKm: 0,
    averageRating: null,
    allTimeRides: 0,
  });

  const loadData = useCallback(async () => {
    try {
      // Charger le profil du chauffeur
      const profile = await getDriverProfile();
      if (profile) {
        setDriverType(profile.typeChauffeur || 'patente');
        setDriverName(`${profile.firstName} ${profile.lastName}`);
      }
      
      // Charger les gains et statistiques
      const earningsData = await getDriverEarnings();
      if (earningsData) {
        setEarnings(earningsData.earnings);
        setStats(earningsData.stats);
      }
      
      // Charger les commissions
      invalidateCommissionsCache();
      const commissionsData = await getCommissions();
      setCommissions(commissionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' XPF';
  };

  const formatRating = (rating: number | null) => {
    if (rating === null || rating === undefined) return '-';
    return rating.toFixed(1) + ' ⭐';
  };

  // Get current driver's commission
  const myCommission = commissions.find(c => c.typeChauffeur === driverType);
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h1">Mes gains</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F5C400']} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5C400" />
            <Text style={styles.loadingText}>Chargement des gains...</Text>
          </View>
        ) : (
          <>
            {/* Gains du jour avec effet néon */}
            <View style={styles.neonWrapper}>
              <Card style={styles.totalCard}>
                <RNText style={styles.totalLabel}>Gains du jour</RNText>
                <RNText style={styles.totalAmount}>{formatPrice(earnings.today)}</RNText>
              </Card>
            </View>
            
            {/* Gains semaine/mois */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                <Text style={styles.statLabel}>Cette semaine</Text>
                <Text style={styles.statValue}>{formatPrice(earnings.week)}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Ionicons name="calendar" size={20} color="#6b7280" />
                <Text style={styles.statLabel}>Ce mois</Text>
                <Text style={styles.statValue}>{formatPrice(earnings.month)}</Text>
              </Card>
            </View>

            {/* Gains totaux */}
            <Card style={styles.totalEarningsCard}>
              <View style={styles.totalEarningsRow}>
                <View>
                  <Text style={styles.totalEarningsLabel}>Gains totaux</Text>
                  <Text style={styles.totalEarningsSubLabel}>Depuis le début</Text>
                </View>
                <Text style={styles.totalEarningsValue}>{formatPrice(earnings.total)}</Text>
              </View>
            </Card>
            
            {/* Ma commission */}
            <Card style={styles.commissionCard}>
              <View style={styles.commissionHeader}>
                <Ionicons name="cash-outline" size={24} color="#22c55e" />
                <Text style={styles.commissionTitle}>Ma commission</Text>
              </View>
              
              {myCommission ? (
                <>
                  <View style={styles.commissionBadge}>
                    <Text style={styles.commissionType}>{myCommission.nomAffichage}</Text>
                  </View>
                  
                  <View style={styles.commissionRates}>
                    <View style={styles.rateBox}>
                      <RNText style={styles.rateValueGreen}>{Math.round(myCommission.pourcentageChauffeur)}%</RNText>
                      <RNText style={styles.rateLabel}>Mes gains</RNText>
                    </View>
                    <View style={styles.rateSeparator} />
                    <View style={styles.rateBox}>
                      <RNText style={styles.rateValueRed}>{Math.round(myCommission.pourcentageCommission)}%</RNText>
                      <RNText style={styles.rateLabel}>TAPEA</RNText>
                    </View>
                  </View>
                  
                  <View style={styles.exampleBox}>
                    <View style={styles.exampleRow}>
                      <Text style={styles.exampleLabel}>Exemple : Course à 5 000 XPF</Text>
                      <Text style={styles.exampleValue}>
                        → {formatPrice(Math.round(5000 * myCommission.pourcentageChauffeur / 100))}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noCommission}>Commission non disponible</Text>
              )}
            </Card>
            
            {/* Statistiques */}
            <Card style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Ionicons name="stats-chart" size={20} color="#F5C400" />
                <Text style={styles.statsTitle}>Statistiques</Text>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{stats.totalRides}</Text>
                  <Text style={styles.statsItemLabel}>Courses payées</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{stats.totalKm} km</Text>
                  <Text style={styles.statsItemLabel}>Parcourus</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{formatRating(stats.averageRating)}</Text>
                  <Text style={styles.statsItemLabel}>Note moyenne</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{stats.allTimeRides}</Text>
                  <Text style={styles.statsItemLabel}>Courses totales</Text>
                </View>
              </View>
            </Card>
            
            <View style={{ height: 30 }} />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  
  // Neon wrapper for subtle glow effect
  neonWrapper: {
    marginBottom: 16,
    borderRadius: 20,
    // Subtle neon glow
    shadowColor: '#F5C400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // Total card
  totalCard: {
    backgroundColor: '#F5C400',
    alignItems: 'center',
    padding: 28,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFE566',
  },
  totalLabel: {
    fontSize: 14,
    color: '#1a1a1a',
    opacity: 0.8,
    marginBottom: 8,
    fontWeight: '400',
  },
  totalAmount: {
    fontSize: 34,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  
  // Total earnings
  totalEarningsCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  totalEarningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalEarningsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
  },
  totalEarningsSubLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  totalEarningsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  
  // Commission card
  commissionCard: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 16,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  commissionTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '600',
  },
  commissionBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  commissionType: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 14,
  },
  commissionRates: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  rateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  rateValueGreen: {
    fontSize: 32,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 6,
  },
  rateValueRed: {
    fontSize: 32,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 6,
  },
  rateLabel: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  rateSeparator: {
    width: 1,
    height: 50,
    backgroundColor: '#d1d5db',
    marginHorizontal: 16,
  },
  exampleBox: {
    backgroundColor: '#fef3c7',
    padding: 14,
    borderRadius: 10,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exampleLabel: {
    fontSize: 13,
    color: '#92400e',
    flex: 1,
  },
  exampleValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  noCommission: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 20,
  },
  
  // Stats card
  statsCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statsItem: {
    width: '50%',
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statsItemValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statsItemLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  
});
