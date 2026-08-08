import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  getDriverProfile,
  getDriverEarnings,
  apiFetch,
  getDriverSessionId,
  removeDriverSessionId,
  SessionExpiredError,
  type DriverEarnings,
} from '@/lib/api';
import type { Order } from '@/lib/types';

function isRentalOrder(order: Order): boolean {
  const ro = order.rideOption as any;
  return ro?.type === 'rental' || !!ro?.isRentalOrder;
}

export default function ChauffeurGainsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<DriverEarnings>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
  });
  const [rentalCount, setRentalCount] = useState(0);
  const [rentalTotalXpf, setRentalTotalXpf] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const profile = await getDriverProfile();
      if (profile) {
        setAverageRating(profile.averageRating ?? null);
      }

      const earningsData = await getDriverEarnings();
      if (earningsData) {
        setEarnings(earningsData.earnings);
        setAverageRating(earningsData.stats.averageRating ?? profile?.averageRating ?? null);
        setRentalCount(
          (earningsData.stats as any).totalLocations ??
            (earningsData.stats as any).completedRentals ??
            earningsData.stats.totalRides ??
            0
        );
        setRentalTotalXpf(earningsData.earnings.total || 0);
      }

      // Agrégats location : commandes terminées / payées
      const sessionId = await getDriverSessionId();
      if (sessionId) {
        try {
          const orders = await apiFetch<Order[]>(`/api/driver/orders/${sessionId}`);
          const completedRentals = (orders || []).filter((o) => {
            if (!isRentalOrder(o)) return false;
            return (
              o.status === 'completed' ||
              o.status === 'payment_confirmed' ||
              o.status === 'payment_pending'
            );
          });
          const count = completedRentals.length;
          const sum = completedRentals.reduce(
            (acc, o) => acc + (o.totalPrice || o.driverEarnings || 0),
            0
          );
          if (count > 0 || sum > 0) {
            setRentalCount(count);
            setRentalTotalXpf(sum);
            if (!earningsData && sum > 0) {
              setEarnings((prev) => ({ ...prev, total: sum }));
            }
          }
        } catch {
          // garder les agrégats issus de getDriverEarnings
        }
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await removeDriverSessionId();
        router.replace('/(chauffeur)/login');
        return;
      }
      console.warn('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => safeBack(router)}>
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
            <View style={styles.neonWrapper}>
              <Card style={styles.totalCard}>
                <RNText style={styles.totalLabel}>Gains du jour</RNText>
                <RNText style={styles.totalAmount}>{formatPrice(earnings.today)}</RNText>
              </Card>
            </View>

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

            <Card style={styles.totalEarningsCard}>
              <View style={styles.totalEarningsRow}>
                <View>
                  <Text style={styles.totalEarningsLabel}>Total locations</Text>
                  <Text style={styles.totalEarningsSubLabel}>
                    {rentalCount} location{rentalCount > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.totalEarningsValue}>
                  {formatPrice(rentalTotalXpf || earnings.total)}
                </Text>
              </View>
            </Card>

            <Card style={styles.paymentInfoCard}>
              <View style={styles.commissionHeader}>
                <Ionicons name="cash-outline" size={24} color="#22c55e" />
                <Text style={styles.commissionTitle}>Paiement</Text>
              </View>
              <Text style={styles.paymentInfoText}>
                Les locations sont payées en espèces directement par le locataire.
                Les montants ci-dessus correspondent aux locations enregistrées sur RAVE.
              </Text>
            </Card>

            <Card style={styles.statsCard}>
              <View style={styles.statsHeader}>
                <Ionicons name="stats-chart" size={20} color="#F5C400" />
                <Text style={styles.statsTitle}>Statistiques location</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{rentalCount}</Text>
                  <Text style={styles.statsItemLabel}>Locations</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>
                    {formatPrice(rentalTotalXpf || earnings.total)}
                  </Text>
                  <Text style={styles.statsItemLabel}>Total XPF</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{formatRating(averageRating)}</Text>
                  <Text style={styles.statsItemLabel}>Note moyenne</Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={styles.statsItemValue}>{formatPrice(earnings.month)}</Text>
                  <Text style={styles.statsItemLabel}>Ce mois</Text>
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
  neonWrapper: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#F5C400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
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
  paymentInfoCard: {
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
    marginBottom: 12,
  },
  commissionTitle: {
    color: '#22c55e',
    fontSize: 18,
    fontWeight: '600',
  },
  paymentInfoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  statsItemLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
});
