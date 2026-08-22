import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { getMyVehicles, deleteVehicle, normalizeLoueurImageUrls, type LoueurVehicle } from '@/lib/api';

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
    Alert.alert(
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
              Alert.alert('Erreur', error.message || 'Impossible de supprimer le véhicule');
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

    return (
      <View key={vehicle.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconBox}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cardThumb} />
            ) : (
              <Ionicons name="car-sport" size={28} color="#4ECC8B" />
            )}
            {photoCount > 1 && (
              <View style={styles.photoCountBadge}>
                <Text style={styles.photoCountText}>{photoCount}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{vehicle.modelName || 'Véhicule'}</Text>
            {(vehicle.plate || catLabel) ? (
              <Text style={styles.cardPlate}>{vehicle.plate ? `${vehicle.plate} · ` : ''}{catLabel}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, vehicle.isActive ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, vehicle.isActive ? styles.activeText : styles.inactiveText]}>
              {vehicle.isActive ? 'Actif' : 'Inactif'}
            </Text>
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
              <Text style={styles.priceLabel}>Prix / jour</Text>
              <Text style={styles.priceValue}>{vehicle.pricePerDay?.toLocaleString() || '—'} XPF</Text>
            </View>
            {vehicle.pricePerDayLongTerm ? (
              <View>
                <Text style={styles.priceLabel}>Longue durée</Text>
                <Text style={styles.priceValue}>{vehicle.pricePerDayLongTerm.toLocaleString()} XPF</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.servicesRow}>
            {vehicle.availableForRental && (
              <View style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>Location</Text>
              </View>
            )}
            {vehicle.availableForDelivery && (
              <View style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>Livraison</Text>
              </View>
            )}
            {vehicle.availableForLongTerm && (
              <View style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>Longue durée</Text>
              </View>
            )}
          </View>

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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
    gap: 14,
  },
  cardIconBox: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: '#E8F8F0',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  cardThumb: {
    width: 56, height: 56, borderRadius: 14,
  },
  photoCountBadge: {
    position: 'absolute', right: 2, bottom: 2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(26,26,26,0.75)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  photoCountText: {
    color: '#fff', fontSize: 10, fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: { backgroundColor: '#ECFDF5' },
  inactiveBadge: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 12, fontWeight: '700' },
  activeText: { color: '#059669' },
  inactiveText: { color: '#EF4444' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  cardPlate: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10 },
  cardSpecs: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  cardPriceRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  priceLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  servicesRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  serviceBadge: {
    backgroundColor: '#FEF9E7',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  serviceBadgeText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
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
