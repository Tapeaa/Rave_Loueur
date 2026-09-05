import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { apiFetch, getDriverSessionId, cancelRentalOrder } from '@/lib/api';
import type { Order } from '@/lib/types';
import { getRentalStepperState, isRentalOrderLike } from '@/lib/rental-lifecycle';
import { RentalLifecycleStepper } from '@/components/RentalLifecycleStepper';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: '#F59E0B' },
  accepted: { label: 'Acceptée', color: '#3B82F6' },
  booked: { label: 'Réservée', color: '#4ECC8B' },
  in_progress: { label: 'En cours', color: '#10B981' },
  completed: { label: 'Terminée', color: '#22C55E' },
  cancelled: { label: 'Annulée', color: '#EF4444' },
  declined: { label: 'Refusée', color: '#EF4444' },
  expired: { label: 'Expirée', color: '#6B7280' },
  payment_pending: { label: 'En attente', color: '#F59E0B' },
  payment_confirmed: { label: 'Confirmée', color: '#22C55E' },
  payment_failed: { label: 'Échec', color: '#EF4444' },
};

export default function ChauffeurCoursesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'booked' | 'history'>('history');
  const [startingBookingId, setStartingBookingId] = useState<string | null>(null);
  const [confirmStartModal, setConfirmStartModal] = useState<Order | null>(null);

  // Récupérer le sessionId au chargement
  useEffect(() => {
    getDriverSessionId().then((id) => {
      if (id) setSessionId(id);
    });
  }, []);

  const { data: orders, refetch, isLoading } = useQuery({
    queryKey: ['driver-orders', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      return apiFetch<Order[]>(`/api/driver/orders/${sessionId}`);
    },
    enabled: !!sessionId,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    const currentSessionId = await getDriverSessionId();
    setSessionId(currentSessionId);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Formatage de la date de réservation
  // ═══════════════════════════════════════════════════════════════════════════
  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Pacific/Tahiti',
    });
  };

  const formatScheduledTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Pacific/Tahiti',
    });
  };

  const getTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 0) return 'Maintenant';
    if (diffMins < 60) return `Dans ${diffMins} min`;
    if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `Dans ${hours}h`;
    }
    const days = Math.floor(diffMins / 1440);
    return `Dans ${days} jour${days > 1 ? 's' : ''}`;
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-FR')} XPF`;
  };

  // ═══ RÉSERVATION À L'AVANCE: Filtrer les courses réservées ═══
  const isScheduledOrder = (order: Order) => Boolean(order.scheduledTime) || order.status === 'booked' || order.status === 'accepted';

  const bookedOrders = (orders || [])
    .filter((order) => isScheduledOrder(order))
    .sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === 'accepted') return 0;
        if (status === 'booked') return 0;
        if (status === 'payment_confirmed' || status === 'completed') return 1;
        return 2;
      };
      
      const priorityA = getPriority(a.status);
      const priorityB = getPriority(b.status);
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Si même priorité, trier par date (plus proche/récent en premier)
      const timeA = a.scheduledTime ? new Date(a.scheduledTime).getTime() : 0;
      const timeB = b.scheduledTime ? new Date(b.scheduledTime).getTime() : 0;
      return timeA - timeB;
    });

  // Filtrer pour ne montrer que les courses terminées ou annulées
  const completedOrCancelledOrders = (orders || []).filter(
    (order) =>
      !isScheduledOrder(order) &&
      (
        order.status === 'completed' ||
        order.status === 'payment_confirmed' ||
        order.status === 'cancelled' ||
        order.status === 'expired' ||
        order.status === 'payment_failed'
      )
  );

  // Trier par date (plus récentes en premier)
  const sortedOrders = [...completedOrCancelledOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // ═══ RÉSERVATION À L'AVANCE: Démarrer une réservation ═══
  const handleStartBooking = async (order: Order) => {
    if (!sessionId || startingBookingId) return;
    router.push({ pathname: '/(chauffeur)/course-details/[id]' as any, params: { id: order.id } });
    setConfirmStartModal(null);
  };

  // ═══ RÉSERVATION À L'AVANCE: Annuler une réservation ═══
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  
  const handleCancelBooking = async (orderId: string) => {
    Alert.alert(
      'Annuler la location',
      'Êtes-vous sûr de vouloir annuler cette location ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            if (!sessionId) return;
            setCancellingOrderId(orderId);
            try {
              // Try rental-order cancel first, fallback to generic cancel
              try {
                await cancelRentalOrder(orderId, sessionId, 'Annulation par le loueur');
              } catch {
                await apiFetch(`/api/orders/${orderId}/cancel`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Driver-Session': sessionId,
                  },
                  body: JSON.stringify({ 
                    reason: 'Annulation par le loueur', 
                    role: 'driver',
                    driverSessionId: sessionId
                  }),
                });
              }
              await refetch();
              Alert.alert('Location annulée', 'La location a été annulée avec succès.');
            } catch (error) {
              console.error('[Courses] Error cancelling booking:', error);
              Alert.alert('Erreur', 'Impossible d\'annuler la location. Veuillez réessayer.');
            } finally {
              setCancellingOrderId(null);
            }
          },
        },
      ]
    );
  };

  // ═══ Rendu d'une course de l'historique ═══
  const renderHistoryOrder = ({ item: order }: { item: Order }) => {
    const status = statusLabels[order.status] || { label: order.status, color: '#6B7280' };
    const pickup = order.addresses.find((a) => a.type === 'pickup');
    const destination = order.addresses.find((a) => a.type === 'destination');
    const ro = order.rideOption as any;
    const isRental = ro?.type === 'rental' || ro?.isRentalOrder;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(chauffeur)/course-details/${order.id}`)}
        activeOpacity={0.8}
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text variant="caption" style={styles.orderDate} numberOfLines={1}>
              {formatDate(order.createdAt)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Text variant="caption" style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
                {status.label}
              </Text>
            </View>
          </View>

          {isRental ? (
            <View style={styles.addressContainer}>
              <View style={styles.addressRow}>
                <Ionicons name="car-sport" size={16} color="#4ECC8B" />
                <Text variant="body" numberOfLines={1} style={styles.addressText}>
                  {ro?.title || 'Véhicule'}
                </Text>
              </View>
              {ro?.days && (
                <Text variant="caption" style={{ color: '#6B7280', marginLeft: 24 }}>
                  {ro.days} jour{ro.days > 1 ? 's' : ''} — {ro?.startDate ? new Date(ro.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} → {ro?.endDate ? new Date(ro.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.addressContainer}>
              <View style={styles.addressRow}>
                <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                <Text variant="body" numberOfLines={1} style={styles.addressText}>
                  {pickup?.value || 'Adresse de départ'}
                </Text>
              </View>
              <View style={styles.addressLine} />
              <View style={styles.addressRow}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <Text variant="body" numberOfLines={1} style={styles.addressText}>
                  {destination?.value || 'Adresse d\'arrivée'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.orderFooter}>
            <View>
              <Text variant="label">{isRental ? 'Location' : order.rideOption.title}</Text>
              <Text variant="caption" style={styles.clientName}>
                {order.clientName}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text variant="h3" style={styles.price}>
                {formatPrice(order.driverEarnings)}
              </Text>
              <Text variant="caption" style={styles.earningsLabel}>
                Vos gains
              </Text>
            </View>
          </View>
          {isRentalOrderLike(order) && (
            <RentalLifecycleStepper
              state={getRentalStepperState(order)}
              variant="loueur"
              compact
            />
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Rendu d'une course réservée
  // ═══════════════════════════════════════════════════════════════════════════
  const renderBookedOrder = ({ item: order }: { item: Order }) => {
    const pickup = order.addresses.find((a) => a.type === 'pickup');
    const destination = order.addresses.find((a) => a.type === 'destination');
    const ro = order.rideOption as any;
    const isRental = ro?.type === 'rental' || ro?.isRentalOrder;
    const status = statusLabels[order.status] || { label: order.status, color: '#6B7280' };
    const isStarting = startingBookingId === order.id;
    const canCancel = order.status === 'booked' || order.status === 'accepted' || order.status === 'pending';
    const canStart = order.status === 'booked';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(chauffeur)/course-details/${order.id}`)}
        activeOpacity={0.8}
      >
        <Card style={styles.bookedCard}>
        <View style={styles.bookedHeader}>
          <View style={styles.bookedDateContainer}>
            <Ionicons name={isRental ? "car-sport" : "calendar"} size={20} color="#4ECC8B" />
            <View style={styles.bookedDateText}>
              {isRental ? (
                <>
                  <Text style={styles.bookedDateLabel} numberOfLines={1}>{ro?.title || 'Véhicule'}</Text>
                  <Text style={styles.bookedTimeLabel} numberOfLines={1}>
                    {ro?.days || 0} jour{(ro?.days || 0) > 1 ? 's' : ''} — {ro?.startDate ? new Date(ro.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} → {ro?.endDate ? new Date(ro.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.bookedDateLabel} numberOfLines={1}>
                    {order.scheduledTime ? formatScheduledDate(order.scheduledTime) : 'Date non définie'}
                  </Text>
                  <Text style={styles.bookedTimeLabel} numberOfLines={1}>
                    à {order.scheduledTime ? formatScheduledTime(order.scheduledTime) : '--:--'}
                  </Text>
                </>
              )}
            </View>
          </View>
          {canStart ? (
            <View style={styles.bookedCountdown}>
              <Text style={styles.bookedCountdownText} numberOfLines={1}>
                {order.scheduledTime ? getTimeUntil(order.scheduledTime) : (isRental ? 'En attente' : '')}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Text variant="caption" style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
                {status.label}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bookedContent}>
          <Text style={styles.bookedClientName}>{order.clientName}</Text>
          
          {!isRental && (
          <View style={styles.bookedAddresses}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
              <Text variant="body" numberOfLines={1} style={styles.addressText}>
                {pickup?.value || 'Adresse de départ'}
              </Text>
            </View>
            <View style={styles.addressLine} />
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
              <Text variant="body" numberOfLines={1} style={styles.addressText}>
                {destination?.value || 'Adresse d\'arrivée'}
              </Text>
            </View>
          </View>
          )}
          {isRentalOrderLike(order) && (
            <RentalLifecycleStepper
              state={getRentalStepperState(order)}
              variant="loueur"
              compact
            />
          )}
        </View>

        <View style={styles.bookedFooter}>
          <View style={styles.bookedPriceTag}>
            <Text style={styles.bookedPriceText}>{formatPrice(order.totalPrice)}</Text>
          </View>
          
          {canCancel && (
            <View style={styles.bookedActions}>
              <TouchableOpacity
                style={[styles.cancelBookingButton, cancellingOrderId === order.id && styles.cancelBookingButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleCancelBooking(order.id);
                }}
                disabled={cancellingOrderId === order.id}
              >
                <Ionicons name="close-circle" size={16} color="#EF4444" />
              </TouchableOpacity>
              
              {canStart && (
                <TouchableOpacity
                  style={[styles.startBookingButton, isStarting && styles.startBookingButtonDisabled]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setConfirmStartModal(order);
                  }}
                  disabled={isStarting}
                >
                  <Ionicons name="car" size={18} color="#FFFFFF" />
                  <Text style={styles.startBookingButtonText}>
                    {isStarting ? 'Démarrage...' : 'Commencer'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h1" style={styles.headerTitle}>Mes locations</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ═══ RÉSERVATION À L'AVANCE: Onglets ═══ */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'booked' && styles.tabActive]}
          onPress={() => setSelectedTab('booked')}
        >
          <Ionicons 
            name="calendar" 
            size={18} 
            color={selectedTab === 'booked' ? '#4ECC8B' : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'booked' && styles.tabTextActive]}>
            Réservées ({bookedOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'history' && styles.tabActive]}
          onPress={() => setSelectedTab('history')}
        >
          <Ionicons 
            name="time" 
            size={18} 
            color={selectedTab === 'history' ? '#4ECC8B' : '#6B7280'} 
          />
          <Text style={[styles.tabText, selectedTab === 'history' && styles.tabTextActive]}>
            Historique ({sortedOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Contenu selon l'onglet sélectionné ═══ */}
      {selectedTab === 'booked' ? (
        bookedOrders.length > 0 ? (
          <FlatList
            data={bookedOrders}
            renderItem={renderBookedOrder}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4ECC8B']} />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#e5e7eb" />
            <Text variant="h3" style={styles.emptyTitle}>
              Aucune réservation
            </Text>
            <Text variant="body" style={styles.emptyText}>
              Vos locations réservées apparaîtront ici
            </Text>
          </View>
        )
      ) : (
        sortedOrders.length > 0 ? (
          <FlatList
            data={sortedOrders}
            renderItem={renderHistoryOrder}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4ECC8B']} />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={64} color="#e5e7eb" />
            <Text variant="h3" style={styles.emptyTitle}>
              Aucune location
            </Text>
            <Text variant="body" style={styles.emptyText}>
              Vos locations terminées et annulées apparaîtront ici
            </Text>
          </View>
        )
      )}

      {/* ═══ RÉSERVATION À L'AVANCE: Modal de confirmation ═══ */}
      <Modal
        visible={!!confirmStartModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setConfirmStartModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Ionicons name="help-circle" size={48} color="#4ECC8B" style={{ marginBottom: 16 }} />
            <Text style={styles.confirmModalTitle}>Commencer cette location ?</Text>
            <Text style={styles.confirmModalSubtitle}>
              Vous allez ouvrir les détails de la location pour {confirmStartModal?.clientName}
            </Text>
            
            {confirmStartModal?.scheduledTime && (
              <View style={styles.confirmModalInfo}>
                <Text style={styles.confirmModalInfoText}>
                  Réservée pour le {formatScheduledDate(confirmStartModal.scheduledTime)} à {formatScheduledTime(confirmStartModal.scheduledTime)}
                </Text>
              </View>
            )}
            
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmModalButtonCancel}
                onPress={() => setConfirmStartModal(null)}
              >
                <Text style={styles.confirmModalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmModalButtonConfirm}
                onPress={() => confirmStartModal && handleStartBooking(confirmStartModal)}
              >
                <Ionicons name="car" size={18} color="#FFFFFF" />
                <Text style={styles.confirmModalButtonConfirmText}>Commencer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  orderCard: {
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  orderDate: {
    color: '#6b7280',
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
    maxWidth: '48%',
  },
  statusText: {
    fontWeight: '600',
    fontSize: 11,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  addressLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 2,
  },
  addressText: {
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  clientName: {
    color: '#6b7280',
    marginTop: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#22C55E',
  },
  earningsLabel: {
    color: '#6b7280',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Styles pour les onglets et les cartes de réservation
  // ═══════════════════════════════════════════════════════════════════════════
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#F5F3FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#4ECC8B',
  },
  bookedCard: {
    padding: 0,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4ECC8B',
  },
  bookedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  bookedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  bookedDateText: {
    flex: 1,
    minWidth: 0,
  },
  bookedDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  bookedTimeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4ECC8B',
  },
  bookedCountdown: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
    maxWidth: '42%',
  },
  bookedCountdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookedContent: {
    padding: 16,
  },
  bookedClientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  bookedAddresses: {
    marginBottom: 0,
  },
  bookedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#FAFAFA',
  },
  bookedPriceTag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bookedPriceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBookingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBookingButtonDisabled: {
    opacity: 0.6,
  },
  startBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  startBookingButtonDisabled: {
    opacity: 0.6,
  },
  startBookingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  confirmModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  confirmModalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmModalInfo: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  confirmModalInfoText: {
    fontSize: 14,
    color: '#4ECC8B',
    textAlign: 'center',
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalButtonCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmModalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmModalButtonConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  confirmModalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
