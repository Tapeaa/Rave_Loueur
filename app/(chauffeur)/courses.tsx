import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import {
  apiFetch,
  getDriverSessionId,
  cancelRentalOrder,
  approveCancelRequest,
  rejectCancelRequest,
  getPendingRentalOrders,
  markRefundDone,
} from '@/lib/api';
import type { Order } from '@/lib/types';
import { getRentalStepperState, isRentalOrderLike, getRentalLifecyclePhase } from '@/lib/rental-lifecycle';
import { CLOSED_ORDER_STATUSES as CLOSED_STATUSES, getOrderStatusDisplay, hasPendingCancelRequest } from '@/lib/order-status';
import { RentalLifecycleStepper } from '@/components/RentalLifecycleStepper';
import { appAlert } from '@/components/AppAlert';

function activePriority(order: Order): number {
  if (hasPendingCancelRequest(order)) return 0;
  const phase = isRentalOrderLike(order) ? getRentalLifecyclePhase(order) : null;
  if (phase === 'with_client' || phase === 'vehicle_ready') return 1;
  return 2;
}

function orderStartTime(order: Order): number {
  const ro = order.rideOption as any;
  const raw = ro?.startDate || order.scheduledTime || order.createdAt;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function RentalPaymentChip({ order }: { order: Order }) {
  const paid = (order.rideOption as any)?.payzenStatus === 'paid';
  const cardUnpaid = !paid && order.paymentMethod === 'card';
  const color = paid ? '#166534' : cardUnpaid ? '#991B1B' : '#92400E';
  return (
    <View style={[styles.paymentChip, { backgroundColor: paid ? '#DCFCE7' : cardUnpaid ? '#FEE2E2' : '#FEF3C7' }]}>
      <Ionicons name={paid ? 'checkmark-circle' : cardUnpaid ? 'alert-circle' : 'cash-outline'} size={13} color={color} />
      <Text style={[styles.paymentChipText, { color }]}>
        {paid ? 'Payée par carte' : cardUnpaid ? 'Paiement carte non abouti' : 'À encaisser'}
      </Text>
    </View>
  );
}

export default function ChauffeurCoursesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'booked' | 'history'>('booked');
  const [focusTick, setFocusTick] = useState(0);
  const autoTabPendingRef = useRef(true);
  const [decidingOrder, setDecidingOrder] = useState<{ id: string; kind: 'approve' | 'reject' } | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);

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
    refetchInterval: 30000,
  });

  const { data: incomingOrders, refetch: refetchIncoming } = useQuery({
    queryKey: ['driver-incoming-orders', sessionId],
    queryFn: async () => (sessionId ? getPendingRentalOrders(sessionId) : []),
    enabled: !!sessionId,
    refetchInterval: 30000,
  });
  const incomingCount = (incomingOrders || []).filter((o) => o.status === 'pending').length;

  useFocusEffect(
    useCallback(() => {
      autoTabPendingRef.current = true;
      setFocusTick((t) => t + 1);
      if (sessionId) {
        void refetch();
        void refetchIncoming();
      }
    }, [sessionId, refetch, refetchIncoming])
  );

  const handleCancelDecision = (order: Order, kind: 'approve' | 'reject') => {
    const run = async () => {
      if (!sessionId) return;
      setDecidingOrder({ id: order.id, kind });
      try {
        if (kind === 'approve') await approveCancelRequest(order.id, sessionId);
        else await rejectCancelRequest(order.id, sessionId);
        await refetch();
        appAlert(
          kind === 'approve' ? 'Annulation validée' : 'Annulation refusée',
          kind === 'approve'
            ? (order.rideOption as any)?.payzenStatus === 'paid'
              ? "La location est annulée et le client a été prévenu. Remboursez-le, puis appuyez sur « J'ai remboursé » dans l'onglet Passées."
              : 'La location est annulée. Le client a été prévenu.'
            : 'La location est maintenue. Le client a été prévenu.'
        );
      } catch (err: any) {
        await refetch();
        appAlert('Erreur', String(err?.message || '').includes('409')
          ? 'Cette location est déjà annulée ou terminée.'
          : 'Impossible d\'enregistrer votre décision. Réessayez.');
      } finally {
        setDecidingOrder(null);
      }
    };
    appAlert(
      kind === 'approve' ? 'Accepter l\'annulation ?' : 'Refuser l\'annulation ?',
      kind === 'approve'
        ? `La location de ${order.clientName} sera annulée.`
        : `La location de ${order.clientName} sera maintenue.`,
      [
        { text: 'Retour', style: 'cancel' },
        { text: kind === 'approve' ? 'Accepter' : 'Refuser', style: kind === 'approve' ? 'destructive' : 'default', onPress: run },
      ]
    );
  };

  const renderCancelRequestBanner = (order: Order) => {
    if (!hasPendingCancelRequest(order)) return null;
    const req = (order.rideOption as any)?.cancelRequest || {};
    const busy = decidingOrder?.id === order.id;
    return (
      <View style={styles.cancelBanner}>
        <View style={styles.cancelBannerHeader}>
          <Ionicons name="alert-circle" size={18} color="#B45309" />
          <Text style={styles.cancelBannerTitle}>Le client demande l'annulation</Text>
        </View>
        {req.reason ? <Text style={styles.cancelBannerReason} numberOfLines={2}>« {req.reason} »</Text> : null}
        {req.requestedAt ? (
          <Text style={styles.cancelBannerMeta}>Demandée le {formatDate(req.requestedAt)}</Text>
        ) : null}
        <View style={styles.cancelBannerActions}>
          <TouchableOpacity
            style={[styles.cancelBannerBtn, styles.cancelBannerReject, busy && styles.cancelBookingButtonDisabled]}
            disabled={busy}
            onPress={(e) => { e.stopPropagation(); handleCancelDecision(order, 'reject'); }}
          >
            {busy && decidingOrder?.kind === 'reject'
              ? <ActivityIndicator size="small" color="#1a1a1a" />
              : <Text style={styles.cancelBannerRejectText}>Refuser</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBannerBtn, styles.cancelBannerApprove, busy && styles.cancelBookingButtonDisabled]}
            disabled={busy}
            onPress={(e) => { e.stopPropagation(); handleCancelDecision(order, 'approve'); }}
          >
            {busy && decidingOrder?.kind === 'approve'
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.cancelBannerApproveText}>Accepter l'annulation</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-FR')} XPF`;
  };

  // Une demande n'entre dans les réservations qu'une fois acceptée par le loueur
  const visibleOrders = (orders || []).filter((o) => {
    if (!isRentalOrderLike(o)) return false;
    if ((o.rideOption as any)?.refund) return true;
    const s = o.status as string;
    if (s === 'pending' || s === 'awaiting_payment' || s === 'payment_failed') return false;
    if (s === 'declined' || s === 'expired') return false;
    if (s === 'cancelled' && (o.rideOption as any)?.cancellation?.beforeAcceptance) return false;
    return true;
  });

  const bookedOrders = visibleOrders
    .filter((order) => !CLOSED_STATUSES.includes(order.status))
    .sort((a, b) => {
      const pa = activePriority(a);
      const pb = activePriority(b);
      if (pa !== pb) return pa - pb;
      return orderStartTime(a) - orderStartTime(b);
    });

  const sortedOrders = visibleOrders
    .filter((order) => CLOSED_STATUSES.includes(order.status))
    .sort((a, b) => {
      const ra = (a.rideOption as any)?.refund?.status === 'pending' ? 0 : 1;
      const rb = (b.rideOption as any)?.refund?.status === 'pending' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  useEffect(() => {
    if (!autoTabPendingRef.current || !orders) return;
    autoTabPendingRef.current = false;
    setSelectedTab(bookedOrders.length > 0 ? 'booked' : 'history');
  }, [focusTick, orders, bookedOrders.length]);

  const cancelRequestCount = bookedOrders.filter(hasPendingCancelRequest).length;
  const refundPendingCount = visibleOrders.filter((o) => (o.rideOption as any)?.refund?.status === 'pending').length;

  const handleRefundDone = (order: Order) => {
    const amount = (order.rideOption as any)?.refund?.amount ?? order.totalPrice ?? 0;
    appAlert(
      'Confirmer le remboursement',
      `Confirmez-vous avoir remboursé ${formatPrice(amount)} à ${order.clientName || 'votre client'} ? Le client sera prévenu.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: "J'ai remboursé",
          onPress: async () => {
            if (!sessionId) return;
            setRefundingOrderId(order.id);
            try {
              await markRefundDone(order.id, sessionId);
              await refetch();
            } catch (err: any) {
              appAlert('Erreur', err?.message || "Impossible d'enregistrer le remboursement. Réessayez.");
            } finally {
              setRefundingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const renderRefundCard = (order: Order) => {
    const refund = (order.rideOption as any)?.refund;
    if (!refund) return null;
    if (refund.status === 'done') {
      return (
        <View style={[styles.refundCard, styles.refundCardDone]}>
          <Ionicons name="checkmark-circle" size={16} color="#166534" />
          <Text style={[styles.refundTitle, { color: '#166534' }]}>
            Remboursé : {formatPrice(refund.amount || 0)}
          </Text>
        </View>
      );
    }
    const busy = refundingOrderId === order.id;
    return (
      <View style={styles.refundCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="cash-outline" size={16} color="#B45309" />
          <Text style={styles.refundTitle}>Remboursement à effectuer : {formatPrice(refund.amount || 0)}</Text>
        </View>
        <Text style={styles.refundHint}>
          Le client a payé par carte. Remboursez-le, puis confirmez ici.
        </Text>
        <TouchableOpacity
          style={[styles.refundBtn, busy && styles.cancelBookingButtonDisabled]}
          disabled={busy}
          onPress={(e) => { e.stopPropagation(); handleRefundDone(order); }}
        >
          {busy ? <ActivityIndicator size="small" color="#1a1a1a" /> : <Text style={styles.refundBtnText}>J'ai remboursé</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  // ═══ RÉSERVATION À L'AVANCE: Annuler une réservation ═══
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  
  const handleCancelBooking = async (orderId: string) => {
    appAlert(
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
              await cancelRentalOrder(orderId, sessionId, 'Annulation par le loueur');
              await refetch();
              appAlert('Location annulée', 'La location a été annulée avec succès.');
            } catch (error: any) {
              console.warn('[Courses] Error cancelling booking:', error);
              appAlert('Erreur', error?.message || 'Impossible d\'annuler la location. Veuillez réessayer.');
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
    const status = getOrderStatusDisplay(order);
    const ro = order.rideOption as any;

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

          <View style={styles.orderFooter}>
            <View>
              <Text variant="label">Location</Text>
              <Text variant="caption" style={styles.clientName}>
                {order.clientName}
              </Text>
              {!ro?.refund && <RentalPaymentChip order={order} />}
            </View>
            <View style={styles.priceContainer}>
              <Text variant="h3" style={styles.price}>
                {formatPrice(order.totalPrice)}
              </Text>
              <Text variant="caption" style={styles.earningsLabel}>
                Montant location
              </Text>
            </View>
          </View>
          {renderRefundCard(order)}
          {isRentalOrderLike(order) && !ro?.refund && (
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
    const ro = order.rideOption as any;
    const status = getOrderStatusDisplay(order);
    const cancelRequested = hasPendingCancelRequest(order);
    const phase = getRentalLifecyclePhase(order);
    const canCancel =
      !cancelRequested &&
      phase !== 'with_client' &&
      (order.status === 'booked' || order.status === 'accepted');

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(chauffeur)/course-details/${order.id}`)}
        activeOpacity={0.8}
      >
        <Card style={[styles.bookedCard, cancelRequested && styles.bookedCardAlert]}>
        <View style={styles.bookedHeader}>
          <View style={styles.bookedDateContainer}>
            <Ionicons name="car-sport" size={20} color="#4ECC8B" />
            <View style={styles.bookedDateText}>
              <Text style={styles.bookedDateLabel} numberOfLines={1}>{ro?.title || 'Véhicule'}</Text>
              <Text style={styles.bookedTimeLabel} numberOfLines={1}>
                {ro?.days || 0} jour{(ro?.days || 0) > 1 ? 's' : ''} — {ro?.startDate ? new Date(ro.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} → {ro?.endDate ? new Date(ro.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text variant="caption" style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.bookedContent}>
          <Text style={styles.bookedClientName}>{order.clientName}</Text>
          <RentalPaymentChip order={order} />
          {renderCancelRequestBanner(order)}
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
        <Text variant="h1" style={styles.headerTitle}>Réservations</Text>
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
            En cours ({bookedOrders.length})
          </Text>
          {cancelRequestCount > 0 ? (
            <View style={styles.tabAlertBadge}>
              <Text style={styles.tabAlertBadgeText}>{cancelRequestCount}</Text>
            </View>
          ) : null}
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
            Passées ({sortedOrders.length})
          </Text>
          {refundPendingCount > 0 ? (
            <View style={styles.tabAlertBadge}>
              <Text style={styles.tabAlertBadgeText}>{refundPendingCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {refundPendingCount > 0 ? (
        <TouchableOpacity style={styles.refundBanner} onPress={() => setSelectedTab('history')} activeOpacity={0.85}>
          <Ionicons name="cash-outline" size={18} color="#B45309" />
          <Text style={styles.refundBannerText}>
            {refundPendingCount} remboursement{refundPendingCount > 1 ? 's' : ''} à effectuer
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#B45309" />
        </TouchableOpacity>
      ) : null}

      {incomingCount > 0 ? (
        <TouchableOpacity style={styles.incomingBanner} onPress={() => router.replace('/(chauffeur)')} activeOpacity={0.85}>
          <Ionicons name="notifications" size={18} color="#1D4ED8" />
          <Text style={styles.incomingBannerText}>
            {incomingCount} demande{incomingCount > 1 ? 's' : ''} à accepter ou refuser sur l'accueil
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
        </TouchableOpacity>
      ) : null}

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
              {isLoading ? 'Chargement…' : 'Aucune réservation en cours'}
            </Text>
            <Text variant="body" style={styles.emptyText}>
              Les locations que vous avez acceptées apparaîtront ici jusqu'au retour du véhicule.
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
              Aucune réservation passée
            </Text>
            <Text variant="body" style={styles.emptyText}>
              Vos locations terminées ou annulées apparaîtront ici
            </Text>
          </View>
        )
      )}


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  incomingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  incomingBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
  bookedCardAlert: {
    borderColor: '#F59E0B',
  },
  refundBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A',
  },
  refundBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#B45309' },
  refundCard: {
    marginTop: 10, padding: 12, borderRadius: 12,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', gap: 6,
  },
  refundCardDone: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderColor: '#BBF7D0',
  },
  refundTitle: { fontSize: 13, fontWeight: '800', color: '#B45309', flexShrink: 1 },
  refundHint: { fontSize: 12, color: '#92400E' },
  refundBtn: {
    marginTop: 4, backgroundColor: '#4ECC8B', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  refundBtnText: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  cancelBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cancelBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', flex: 1 },
  cancelBannerReason: { fontSize: 13, color: '#78350F', marginTop: 6, fontStyle: 'italic' },
  cancelBannerMeta: { fontSize: 12, color: '#B45309', marginTop: 4 },
  cancelBannerActions: { flexDirection: 'column-reverse', gap: 8, marginTop: 10 },
  cancelBannerBtn: {
    width: '100%',
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelBannerReject: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
  cancelBannerRejectText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cancelBannerApprove: { backgroundColor: '#EF4444' },
  cancelBannerApproveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  tabAlertBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabAlertBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  paymentChipText: { fontSize: 11, fontWeight: '700' },
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
  bookedContent: {
    padding: 16,
  },
  bookedClientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
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
});
