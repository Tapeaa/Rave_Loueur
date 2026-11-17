import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { getMyVehicles, deleteVehicle, normalizeLoueurImageUrls, type LoueurVehicle } from '@/lib/api';
import { PricingTiersReadonly } from '@/components/PricingTiersReadonly';
import { appAlert } from '@/components/AppAlert';

const CATEGORY_LABELS: Record<string, string> = {
  citadine: 'Citadine',
  berline: 'Berline',
  suv: 'SUV',
  utilitaire: 'Utilitaire',
  premium: 'Premium',
  autre: 'Autres',
};

const FUEL_LABELS: Record<string, string> = {
  essence: 'Essence',
  diesel: 'Diesel',
  electrique: 'Électrique',
  hybride: 'Hybride',
};

const TRANSMISSION_LABELS: Record<string, string> = {
  auto: 'Automatique',
  manual: 'Manuelle',
};

/** Photo affichée entière, à ses proportions d'origine (jamais rognée). */
function VehicleCover({ uri, photoCount }: { uri: string; photoCount: number }) {
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (active && w > 0 && h > 0) setRatio(Math.min(Math.max(w / h, 0.75), 2.5));
      },
      () => {}
    );
    return () => { active = false; };
  }, [uri]);

  return (
    <View style={[styles.coverWrap, { aspectRatio: ratio }]}>
      <Image source={{ uri }} style={styles.coverImage} resizeMode="contain" />
      {photoCount > 1 && (
        <View style={styles.photoCountBadge}>
          <Ionicons name="images-outline" size={12} color="#fff" />
          <Text style={styles.photoCountText}>{photoCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function MesVehiculesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<LoueurVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await getMyVehicles();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('[MesVehicules] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadVehicles();
    }, [loadVehicles])
  );

  const handleDelete = (vehicle: LoueurVehicle) => {
    appAlert(
      'Supprimer le véhicule',
      `Voulez-vous vraiment supprimer ${vehicle.modelName || 'ce véhicule'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicle.id);
              setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
            } catch (error: any) {
              appAlert('Erreur', error.message || 'Impossible de supprimer le véhicule');
            }
          },
        },
      ]
    );
  };

  const renderVehicleCard = (vehicle: LoueurVehicle) => {
    const catLabel = CATEGORY_LABELS[vehicle.modelCategory || ''] || vehicle.modelCategory || '';
    const cover = normalizeLoueurImageUrls(vehicle)[0] || vehicle.modelImageUrl || null;
    const photoCount = normalizeLoueurImageUrls(vehicle).length;

    const missingCancellation = vehicle.cancellation ? !vehicle.cancellation.configured : false;
    const status = !vehicle.isActive
      ? { label: 'Inactif', bg: '#FEF2F2', color: '#EF4444' }
      : missingCancellation
        ? { label: 'Masqué', bg: '#FEF2F2', color: '#B91C1C' }
        : vehicle.availableForRental
        ? { label: 'Disponible', bg: '#ECFDF5', color: '#059669' }
        : { label: 'Masqué', bg: '#FEF3C7', color: '#B45309' };

    return (
      <View key={vehicle.id} style={styles.card}>
        {cover ? (
          <VehicleCover uri={cover} photoCount={photoCount} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="car-sport" size={40} color="#4ECC8B" />
          </View>
        )}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{vehicle.modelName || 'Véhicule'}</Text>
            {(vehicle.plate || catLabel) ? (
              <Text style={styles.cardPlate}>{vehicle.plate ? `${vehicle.plate} · ` : ''}{catLabel}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          {(vehicle.modelSeats || vehicle.modelFuel || vehicle.modelTransmission) ? (
            <View style={styles.cardSpecs}>
              {vehicle.modelSeats ? (
                <View style={styles.specItem}>
                  <Ionicons name="people-outline" size={14} color="#6B7280" />
                  <Text style={styles.specText}>{vehicle.modelSeats} places</Text>
                </View>
              ) : null}
              {vehicle.modelFuel ? (
                <View style={styles.specItem}>
                  <Ionicons name="flash-outline" size={14} color="#6B7280" />
                  <Text style={styles.specText}>{FUEL_LABELS[vehicle.modelFuel] || vehicle.modelFuel}</Text>
                </View>
              ) : null}
              {vehicle.modelTransmission ? (
                <View style={styles.specItem}>
                  <Ionicons name="cog-outline" size={14} color="#6B7280" />
                  <Text style={styles.specText}>{TRANSMISSION_LABELS[vehicle.modelTransmission] || vehicle.modelTransmission}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.cardPriceRow}>
            <View>
              <Text style={styles.priceLabel}>À partir de</Text>
              <Text style={styles.priceValue}>{vehicle.pricePerDay?.toLocaleString() || '—'} XPF/j</Text>
            </View>
            <View>
              <Text style={styles.priceLabel}>Max.</Text>
              <Text style={styles.priceValue}>{vehicle.maxRentalDays || 90} j</Text>
            </View>
          </View>

          <PricingTiersReadonly
            tiers={vehicle.pricingTiers}
            maxRentalDays={vehicle.maxRentalDays}
            pricePerDay={vehicle.pricePerDay}
          />

          {vehicle.paymentOnlineConfigured ? (
            <View style={styles.payChip}>
              <Ionicons
                name={vehicle.cardPaymentEnabled !== false ? 'card-outline' : 'cash-outline'}
                size={14}
                color={vehicle.cardPaymentEnabled !== false ? '#16A34A' : '#B45309'}
              />
              <Text style={[styles.payChipText, { color: vehicle.cardPaymentEnabled !== false ? '#16A34A' : '#B45309' }]}>
                {vehicle.cardPaymentEnabled !== false ? 'Carte acceptée' : 'Paiement sur place'}
              </Text>
            </View>
          ) : null}

          {vehicle.cancellation ? (
            <TouchableOpacity
              style={[styles.cancelRow, missingCancellation ? styles.cancelRowMissing : null]}
              onPress={() => router.push({ pathname: '/(chauffeur)/conditions-annulation', params: { vehicleId: vehicle.id } })}
              activeOpacity={0.75}
            >
              <Ionicons
                name={missingCancellation ? 'alert-circle' : 'document-text-outline'}
                size={18}
                color={missingCancellation ? '#B91C1C' : '#16A34A'}
              />
              <Text
                style={[styles.cancelRowText, { color: missingCancellation ? '#991B1B' : '#0B1F14' }]}
                numberOfLines={1}
              >
                {missingCancellation
                  ? "Conditions d'annulation à ajouter (masqué aux clients)"
                  : vehicle.cancellation.title}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={missingCancellation ? '#B91C1C' : '#9CA3AF'} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push({ pathname: '/(chauffeur)/modifier-vehicule', params: { id: vehicle.id } })}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#3B82F6" />
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: '#FDBA74' }]}
              onPress={() => router.push({ pathname: '/(chauffeur)/modifier-vehicule', params: { id: vehicle.id } })}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#EA580C" />
              <Text style={[styles.editBtnText, { color: '#EA580C' }]}>Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(vehicle)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router)} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Véhicules</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4ECC8B" />
        </View>
      ) : vehicles.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-sport-outline" size={56} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Aucun véhicule</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez votre premier véhicule pour commencer à recevoir des demandes de location.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVehicles(); }} tintColor="#4ECC8B" />
          }
        >
          {vehicles.map(renderVehicleCard)}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(chauffeur)/ajouter-vehicule')}
      >
        <Ionicons name="add" size={28} color="#1a1a1a" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  coverWrap: {
    width: '100%',
    backgroundColor: '#F3F4F6',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    width: '100%', height: 120,
    backgroundColor: '#E8F8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
    gap: 14,
  },
  photoCountBadge: {
    position: 'absolute', right: 10, bottom: 10,
    flexDirection: 'row', gap: 4,
    height: 24, borderRadius: 12,
    backgroundColor: 'rgba(26,26,26,0.75)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  photoCountText: {
    color: '#fff', fontSize: 12, fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  cardPlate: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10 },
  cardSpecs: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  cardPriceRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  priceLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  payChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
  },
  payChipText: { fontSize: 12, fontWeight: '700' },
  cancelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12,
    backgroundColor: '#F0FBF5',
  },
  cancelRowMissing: { backgroundColor: '#FEF2F2' },
  cancelRowText: { flex: 1, fontSize: 13, fontWeight: '700' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 14 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center', justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30, right: 20,
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#4ECC8B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4ECC8B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
