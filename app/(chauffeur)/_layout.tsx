import { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, TouchableOpacity, Modal, StyleSheet, Linking, Alert, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import {
  onRentalOrderCancelRequest,
  onRentalOrderCancelled,
  onRentalOrderCancelRejected,
  onSocketConnected,
  type CancelRequestData,
} from '@/lib/socket';
import {
  approveCancelRequest,
  rejectCancelRequest,
  getDriverSessionId,
  fetchPendingCancelRequests,
} from '@/lib/api';

const RESYNC_INTERVAL_MS = 45000;

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Pacific/Tahiti' });
}

export default function ChauffeurLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<CancelRequestData[]>([]);
  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const cancelRequest = queue[0] ?? null;

  const refreshOrderLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
    queryClient.invalidateQueries({ queryKey: ['driver-cancel-requests'] });
  }, [queryClient]);

  const removeFromQueue = useCallback((orderId: string) => {
    setQueue((prev) => prev.filter((r) => r.orderId !== orderId));
  }, []);

  const resync = useCallback(async () => {
    let sessionId = '';
    try {
      sessionId = (await getDriverSessionId()) || '';
    } catch {
      return;
    }
    if (!sessionId) return;
    try {
      const pending = await fetchPendingCancelRequests(sessionId);
      const pendingIds = new Set(pending.map((p) => p.orderId));
      setQueue((prev) => {
        const kept = prev.filter((r) => pendingIds.has(r.orderId));
        const keptIds = new Set(kept.map((r) => r.orderId));
        const fresh = pending.filter((p) => !keptIds.has(p.orderId) && !dismissedRef.current.has(p.orderId));
        return [...kept, ...fresh];
      });
      queryClient.setQueryData(['driver-cancel-requests'], pending);
    } catch (e) {
      console.warn('[Layout] cancel requests resync failed:', (e as Error)?.message || e);
    }
  }, [queryClient]);

  useEffect(() => {
    void resync();
    const unsubRequest = onRentalOrderCancelRequest((data) => {
      dismissedRef.current.delete(data.orderId);
      setQueue((prev) => (prev.some((r) => r.orderId === data.orderId) ? prev : [...prev, data]));
      refreshOrderLists();
    });
    const unsubCancelled = onRentalOrderCancelled((data) => {
      removeFromQueue(data.orderId);
      refreshOrderLists();
      const info = data as any;
      if (info?.expired) {
        const refundLine = info.refund
          ? `\n\nLe client avait payé par carte : remboursez-lui ${Math.round(info.refund.amount || 0).toLocaleString('fr-FR')} XPF puis confirmez-le dans Réservations.`
          : '';
        Alert.alert(
          'Demande expirée',
          `La demande de ${info.clientName || 'votre client'} pour ${info.vehicleTitle || 'votre véhicule'} a expiré sans réponse.${refundLine}`,
          info.refund
            ? [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Voir Réservations', onPress: () => router.push('/(chauffeur)/courses') },
              ]
            : [{ text: 'OK' }]
        );
      }
    });
    const unsubRejected = onRentalOrderCancelRejected((data) => {
      removeFromQueue(data.orderId);
      refreshOrderLists();
    });
    const unsubConnect = onSocketConnected(() => { void resync(); });
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resync();
    });
    const interval = setInterval(() => { void resync(); }, RESYNC_INTERVAL_MS);
    return () => {
      unsubRequest();
      unsubCancelled();
      unsubRejected();
      unsubConnect();
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [resync, refreshOrderLists, removeFromQueue, router]);

  const runDecision = useCallback(async (kind: 'approve' | 'reject') => {
    if (!cancelRequest || processing) return;
    setProcessing(kind);
    try {
      const sessionId = (await getDriverSessionId()) || '';
      if (kind === 'approve') {
        await approveCancelRequest(cancelRequest.orderId, sessionId);
      } else {
        await rejectCancelRequest(cancelRequest.orderId, sessionId);
      }
      removeFromQueue(cancelRequest.orderId);
      refreshOrderLists();
      if (kind === 'approve' && cancelRequest.paid) {
        Alert.alert(
          'Annulation validée',
          `La location est annulée et le client a été prévenu.\n\nRemboursez-lui ${(cancelRequest.totalPrice || 0).toLocaleString('fr-FR')} XPF, puis appuyez sur « J'ai remboursé » dans Réservations.`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Voir Réservations', onPress: () => router.push('/(chauffeur)/courses') },
          ]
        );
        return;
      }
      Alert.alert(
        kind === 'approve' ? 'Annulation validée' : 'Annulation refusée',
        kind === 'approve'
          ? 'La location est annulée. Le client a été prévenu.'
          : 'La location est maintenue. Le client a été prévenu.'
      );
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('409') || msg.includes('déjà')) {
        removeFromQueue(cancelRequest.orderId);
        refreshOrderLists();
        Alert.alert('Déjà traitée', 'Cette location est déjà annulée ou terminée.');
      } else {
        console.warn('[Layout] cancel decision failed:', msg);
        Alert.alert('Erreur', 'Impossible d\'enregistrer votre décision. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setProcessing(null);
    }
  }, [cancelRequest, processing, removeFromQueue, refreshOrderLists, router]);

  const handleLater = useCallback(() => {
    if (!cancelRequest) return;
    dismissedRef.current.add(cancelRequest.orderId);
    removeFromQueue(cancelRequest.orderId);
  }, [cancelRequest, removeFromQueue]);

  const handleOpenOrder = useCallback(() => {
    if (!cancelRequest) return;
    const id = cancelRequest.orderId;
    dismissedRef.current.add(id);
    removeFromQueue(id);
    router.push(`/(chauffeur)/course-details/${id}`);
  }, [cancelRequest, removeFromQueue, router]);

  const handleCall = useCallback(() => {
    if (!cancelRequest?.clientPhone) {
      Alert.alert('Erreur', 'Numéro de téléphone indisponible.');
      return;
    }
    Linking.openURL(`tel:${cancelRequest.clientPhone}`);
  }, [cancelRequest]);

  const handleMessage = useCallback(() => {
    if (cancelRequest) dismissedRef.current.add(cancelRequest.orderId);
    if (cancelRequest) removeFromQueue(cancelRequest.orderId);
    router.push('/(chauffeur)/messages');
  }, [cancelRequest, removeFromQueue, router]);

  const period = cancelRequest
    ? [formatShortDate(cancelRequest.startDate), formatShortDate(cancelRequest.endDate)].filter(Boolean).join(' → ')
    : '';
  const paymentLabel = cancelRequest?.paid
    ? 'Payée par carte — à rembourser si vous validez'
    : cancelRequest?.paymentMethod === 'card'
      ? 'Carte (paiement non confirmé)'
      : 'À encaisser sur place';

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Accueil' }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="redirect" options={{ headerShown: false }} />
        <Stack.Screen name="courses" />
        <Stack.Screen name="gains" />
        <Stack.Screen name="profil" />
        <Stack.Screen name="abonnement" />
        <Stack.Screen name="conditions-utilisation" />
        <Stack.Screen name="confidentialite" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="course-details/[id]" />
        <Stack.Screen name="commande-location" />
        <Stack.Screen name="support-chat" />
        <Stack.Screen name="mes-vehicules" />
        <Stack.Screen name="ajouter-vehicule" />
        <Stack.Screen name="modifier-vehicule" />
      </Stack>

      <Modal visible={!!cancelRequest} transparent animationType="slide" onRequestClose={handleLater}>
        <View style={s.overlay}>
          <View style={s.popup}>
            <View style={s.iconWrap}>
              <Ionicons name="alert-circle" size={44} color="#F59E0B" />
            </View>
            <Text style={s.title}>Demande d'annulation</Text>
            <Text style={s.subtitle}>
              {cancelRequest?.clientName || 'Un client'} souhaite annuler sa location. Votre réponse lui sera envoyée immédiatement.
            </Text>
            {queue.length > 1 ? (
              <Text style={s.queueHint}>{queue.length - 1} autre{queue.length > 2 ? 's' : ''} demande{queue.length > 2 ? 's' : ''} en attente</Text>
            ) : null}

            <View style={s.detailCard}>
              <View style={s.detailRow}>
                <Ionicons name="person" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Client</Text>
                <Text style={s.detailValue}>{cancelRequest?.clientName || '-'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Ionicons name="car-sport" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Véhicule</Text>
                <Text style={s.detailValue}>{cancelRequest?.vehicleTitle || '-'}</Text>
              </View>
              {period ? (
                <>
                  <View style={s.divider} />
                  <View style={s.detailRow}>
                    <Ionicons name="calendar" size={16} color="#6B7280" />
                    <Text style={s.detailLabel}>Période</Text>
                    <Text style={s.detailValue}>{period}</Text>
                  </View>
                </>
              ) : null}
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Ionicons name="cash" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Montant</Text>
                <Text style={[s.detailValue, { fontWeight: '800' }]}>
                  {cancelRequest?.totalPrice ? `${cancelRequest.totalPrice.toLocaleString('fr-FR')} XPF` : '-'}
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Ionicons name="card" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Paiement</Text>
                <Text style={s.detailValue} numberOfLines={2}>{paymentLabel}</Text>
              </View>
              {cancelRequest?.reason ? (
                <>
                  <View style={s.divider} />
                  <View style={s.detailRow}>
                    <Ionicons name="chatbubble-ellipses" size={16} color="#6B7280" />
                    <Text style={s.detailLabel}>Motif</Text>
                    <Text style={s.detailValue} numberOfLines={2}>{cancelRequest.reason}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={s.contactRow}>
              <TouchableOpacity style={s.contactBtn} onPress={handleCall}>
                <Ionicons name="call" size={20} color="#22C55E" />
                <Text style={s.contactBtnText}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.contactBtn} onPress={handleMessage}>
                <Ionicons name="chatbubble" size={20} color="#3B82F6" />
                <Text style={[s.contactBtnText, { color: '#3B82F6' }]}>Message</Text>
              </TouchableOpacity>
            </View>

            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.rejectBtn, processing && s.btnDisabled]}
                onPress={() => runDecision('reject')}
                disabled={!!processing}
              >
                {processing === 'reject' ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="close" size={18} color="#FFF" />
                    <Text style={s.actionBtnText}>Refuser</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.approveBtn, processing && s.btnDisabled]}
                onPress={() => runDecision('approve')}
                disabled={!!processing}
              >
                {processing === 'approve' ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={s.actionBtnText}>Accepter l'annulation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.secondaryRow}>
              <TouchableOpacity onPress={handleOpenOrder} disabled={!!processing} style={s.secondaryBtn}>
                <Text style={s.secondaryText}>Voir la location</Text>
              </TouchableOpacity>
              <Text style={s.secondarySep}>·</Text>
              <TouchableOpacity onPress={handleLater} disabled={!!processing} style={s.secondaryBtn}>
                <Text style={s.secondaryText}>Décider plus tard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  popup: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#D1F2E3', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  detailCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    width: '100%', borderWidth: 1, borderColor: '#F3F4F6',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  detailLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', width: 70 },
  detailValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '600', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  contactRow: {
    flexDirection: 'row', gap: 12, marginTop: 16, width: '100%',
  },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  contactBtnText: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  actionRow: {
    flexDirection: 'column-reverse', gap: 10, marginTop: 12, width: '100%',
  },
  actionBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  rejectBtn: { backgroundColor: '#EF4444' },
  approveBtn: { backgroundColor: '#22C55E' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  queueHint: { fontSize: 12, fontWeight: '700', color: '#B45309', marginBottom: 10 },
  secondaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6,
  },
  secondaryBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  secondaryText: { fontSize: 14, fontWeight: '600', color: '#6B7280', textDecorationLine: 'underline' },
  secondarySep: { color: '#9CA3AF' },
});
