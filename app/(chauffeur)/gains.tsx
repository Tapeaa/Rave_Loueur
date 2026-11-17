import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { safeBack } from '@/lib/navigation';
import { useState, useEffect, useCallback } from 'react';
import {
  getDriverProfile,
  getDriverEarnings,
  SessionExpiredError,
  type DriverEarnings,
} from '@/lib/api';
import { logoutDriver } from '@/lib/logout';

const HERO_BG = '#121212';

function formatMonthLabel(): string {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Pacific/Tahiti' });
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
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await logoutDriver();
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

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => setStatusBarStyle('light'), 0);
      return () => {
        clearTimeout(t);
        setStatusBarStyle('dark');
      };
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatPrice = (amount: number) => `${Math.round(amount || 0).toLocaleString('fr-FR')} XPF`;

  const total = rentalTotalXpf || earnings.total || 0;
  const averageBasket = rentalCount > 0 ? Math.round(total / rentalCount) : 0;
  const upcoming = earnings.upcoming ?? 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => safeBack(router)}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes gains</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4ECC8B']} tintColor="#FFFFFF" />
          }
        >
          <View style={styles.heroOverscroll} />
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Gains de {formatMonthLabel()}</Text>
            {loading ? (
              <ActivityIndicator color="#4ECC8B" style={{ alignSelf: 'flex-start', marginVertical: 18 }} />
            ) : (
              <Text style={styles.heroAmount} numberOfLines={1}>
                {Math.round(earnings.month || 0).toLocaleString('fr-FR')}
                <Text style={styles.heroCurrency}> XPF</Text>
              </Text>
            )}

            <View style={styles.periodRow}>
              {[
                { key: 'today', label: "Aujourd'hui", value: earnings.today },
                { key: 'week', label: 'Cette semaine', value: earnings.week },
                { key: 'total', label: 'Depuis le début', value: total },
              ].map((p) => (
                <View key={p.key} style={styles.periodChip}>
                  <Text style={styles.periodLabel} numberOfLines={1}>{p.label}</Text>
                  <Text style={styles.periodValue} numberOfLines={1}>{formatPrice(p.value)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sheet}>
            {upcoming > 0 && (
              <View style={styles.upcomingRow}>
                <View style={styles.upcomingIcon}>
                  <Ionicons name="time-outline" size={18} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upcomingTitle}>À venir</Text>
                  <Text style={styles.upcomingHint}>Réservations confirmées, comptées au retour du véhicule</Text>
                </View>
                <Text style={styles.upcomingValue}>{formatPrice(upcoming)}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Statistiques</Text>
              <View style={styles.kpiRow}>
                <View style={styles.kpi}>
                  <View style={[styles.kpiIcon, { backgroundColor: '#E8F8F0' }]}>
                    <Ionicons name="car-sport-outline" size={18} color="#16A34A" />
                  </View>
                  <Text style={styles.kpiValue}>{rentalCount}</Text>
                  <Text style={styles.kpiLabel}>Location{rentalCount > 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                  <View style={[styles.kpiIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="star" size={17} color="#F59E0B" />
                  </View>
                  <Text style={styles.kpiValue}>{averageRating != null ? averageRating.toFixed(1) : '–'}</Text>
                  <Text style={styles.kpiLabel}>Note moyenne</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpi}>
                  <View style={[styles.kpiIcon, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="receipt-outline" size={17} color="#2563EB" />
                  </View>
                  <Text style={styles.kpiValue} numberOfLines={1}>
                    {averageBasket ? `${Math.round(averageBasket / 1000)}k` : '–'}
                  </Text>
                  <Text style={styles.kpiLabel}>Panier moyen</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détail</Text>
              {[
                { label: "Aujourd'hui", value: earnings.today },
                { label: 'Cette semaine', value: earnings.week },
                { label: 'Ce mois', value: earnings.month },
                { label: 'Total des locations', value: total, strong: true },
              ].map((row, index) => (
                <View key={row.label} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
                  <Text style={[styles.detailLabel, row.strong && styles.detailLabelStrong]}>{row.label}</Text>
                  <Text style={[styles.detailValue, row.strong && styles.detailValueStrong]}>{formatPrice(row.value)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
              <Text style={styles.infoText}>
                Avec PayZen / OSB configuré, le client peut payer en ligne par carte. Sinon, il règle chez vous à la
                prise du véhicule. Les montants correspondent aux locations enregistrées sur RAVE.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HERO_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: HERO_BG,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  heroOverscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: HERO_BG },
  hero: { backgroundColor: HERO_BG, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  heroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', textTransform: 'capitalize' },
  heroAmount: { fontSize: 46, fontWeight: '800', color: '#4ECC8B', letterSpacing: -1.5, marginTop: 4 },
  heroCurrency: { fontSize: 20, fontWeight: '700', color: 'rgba(78,204,139,0.7)', letterSpacing: 0 },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 22 },
  periodChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  periodLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  periodValue: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },

  sheet: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },

  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
  },
  upcomingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  upcomingHint: { fontSize: 12, color: '#A16207', marginTop: 1 },
  upcomingValue: { fontSize: 15, fontWeight: '800', color: '#92400E' },

  section: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.2, marginBottom: 14 },

  kpiRow: { flexDirection: 'row', alignItems: 'stretch' },
  kpi: { flex: 1, alignItems: 'center' },
  kpiDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 6 },
  kpiIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginTop: 8 },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginTop: 2 },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF0F2' },
  detailLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  detailLabelStrong: { color: '#1a1a1a', fontWeight: '800' },
  detailValue: { fontSize: 15, color: '#1a1a1a', fontWeight: '700' },
  detailValueStrong: { fontSize: 17, color: '#16A34A', fontWeight: '800' },

  infoRow: { flexDirection: 'row', gap: 8, paddingTop: 18 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#9CA3AF' },
});
