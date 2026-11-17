import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import * as FileSystem from 'expo-file-system/legacy';
import {
  apiFetch,
  getDriverSessionId,
  postRentalOrderLifecycle,
  setRentalMeetingPoint,
  approveCancelRequest,
  rejectCancelRequest,
  markRefundDone,
} from '@/lib/api';
import {
  getRentalLifecyclePhase,
  getRentalStepperState,
  isRentalOrderLike,
} from '@/lib/rental-lifecycle';
import { RentalLifecycleStepper } from '@/components/RentalLifecycleStepper';
import {
  joinRentalOrderRoom,
  onRentalLifecycleChanged,
  onRentalOrderCancelRequest,
  onRentalOrderCancelled,
  onRentalOrderCancelRejected,
} from '@/lib/socket';
import type { Order } from '@/lib/types';
import { isUsableMediaUri, shareHtmlAsPdf, shareImage } from '@/lib/share-media';

const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'En attente', color: '#F59E0B', icon: 'time' },
  accepted: { label: 'Acceptée', color: '#3B82F6', icon: 'checkmark-circle' },
  booked: { label: 'Réservée', color: '#4ECC8B', icon: 'calendar' },
  in_progress: { label: 'En cours', color: '#10B981', icon: 'navigate' },
  completed: { label: 'Terminée', color: '#22C55E', icon: 'checkmark-done-circle' },
  cancelled: { label: 'Annulée', color: '#EF4444', icon: 'close-circle' },
  declined: { label: 'Refusée', color: '#EF4444', icon: 'hand-left' },
  expired: { label: 'Expirée', color: '#6B7280', icon: 'timer' },
  payment_pending: { label: 'En attente', color: '#F59E0B', icon: 'time' },
  payment_confirmed: { label: 'Confirmée', color: '#22C55E', icon: 'checkmark-circle' },
  payment_failed: { label: 'Échec', color: '#EF4444', icon: 'close-circle' },
};

export default function CourseDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractHTML, setContractHTML] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [loueurSignature, setLoueurSignature] = useState<string | null>(null);
  const [meetingDraft, setMeetingDraft] = useState('');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [cancelDecisionBusy, setCancelDecisionBusy] = useState<'approve' | 'reject' | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);

  useEffect(() => {
    const sigFile = `${FileSystem.documentDirectory}loueur_signature.txt`;
    console.log('[CONTRACT] Loading loueur signature from:', sigFile);
    FileSystem.getInfoAsync(sigFile).then(info => {
      console.log('[CONTRACT] Signature file exists:', info.exists);
      if (info.exists) {
        FileSystem.readAsStringAsync(sigFile).then(sig => {
          console.log('[CONTRACT] Signature loaded, length:', sig?.length || 0);
          if (sig) setLoueurSignature(sig);
        });
      }
    }).catch((e) => { console.log('[CONTRACT] Error loading signature:', e); });
  }, []);

  const loadOrder = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) {
      setError('ID de location manquant');
      setLoading(false);
      return;
    }

    try {
      const sessionId = await getDriverSessionId();
      const orderData = await apiFetch<Order>(`/api/orders/${id}`, {
        headers: {
          'X-Driver-Session': sessionId || '',
        },
      });
      setOrder(orderData);
      if (!opts?.silent) {
        const mp = (orderData.rideOption as any)?.meetingPoint;
        if (typeof mp === 'string') setMeetingDraft(mp);
      }
    } catch (err) {
      console.error('[CourseDetails] Error loading order:', err);
      if (!opts?.silent) setError('Impossible de charger les détails de la location');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!id || !order || !isRentalOrderLike(order)) return;
    joinRentalOrderRoom(id);
    const unsub = onRentalLifecycleChanged((data) => {
      if (data.orderId === id && data.order) {
        setOrder(data.order);
      }
    });
    return unsub;
  }, [id, order?.status]);

  useEffect(() => {
    if (!id) return;
    const refreshIfMine = (data: { orderId: string }) => {
      if (data.orderId === id) void loadOrder({ silent: true });
    };
    const unsubs = [
      onRentalOrderCancelRequest(refreshIfMine),
      onRentalOrderCancelled(refreshIfMine),
      onRentalOrderCancelRejected(refreshIfMine),
    ];
    return () => unsubs.forEach((u) => u());
  }, [id, loadOrder]);

  const decideCancelRequest = (kind: 'approve' | 'reject') => {
    if (!order) return;
    const run = async () => {
      const sessionId = await getDriverSessionId();
      if (!sessionId) {
        Alert.alert('Erreur', 'Session loueur introuvable.');
        return;
      }
      setCancelDecisionBusy(kind);
      try {
        if (kind === 'approve') await approveCancelRequest(order.id, sessionId);
        else await rejectCancelRequest(order.id, sessionId);
        await loadOrder({ silent: true });
        Alert.alert(
          kind === 'approve' ? 'Annulation validée' : 'Annulation refusée',
          kind === 'approve'
            ? (order.rideOption as any)?.payzenStatus === 'paid'
              ? "La location est annulée et le client a été prévenu. Remboursez-le, puis appuyez sur « J'ai remboursé »."
              : 'La location est annulée. Le client a été prévenu.'
            : 'La location est maintenue. Le client a été prévenu.'
        );
      } catch (err: any) {
        await loadOrder({ silent: true });
        Alert.alert('Erreur', String(err?.message || '').includes('409')
          ? 'Cette location est déjà annulée ou terminée.'
          : 'Impossible d\'enregistrer votre décision. Réessayez.');
      } finally {
        setCancelDecisionBusy(null);
      }
    };
    Alert.alert(
      kind === 'approve' ? 'Accepter l\'annulation ?' : 'Refuser l\'annulation ?',
      kind === 'approve' ? 'La location sera annulée.' : 'La location sera maintenue.',
      [
        { text: 'Retour', style: 'cancel' },
        { text: kind === 'approve' ? 'Accepter' : 'Refuser', style: kind === 'approve' ? 'destructive' : 'default', onPress: run },
      ]
    );
  };

  const confirmRefundDone = () => {
    if (!order) return;
    const amount = (order.rideOption as any)?.refund?.amount ?? order.totalPrice ?? 0;
    Alert.alert(
      'Confirmer le remboursement',
      `Confirmez-vous avoir remboursé ${formatPrice(amount)} à ${order.clientName || 'votre client'} ? Le client sera prévenu.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: "J'ai remboursé",
          onPress: async () => {
            const sessionId = await getDriverSessionId();
            if (!sessionId) return;
            setRefundBusy(true);
            try {
              await markRefundDone(order.id, sessionId);
              await loadOrder({ silent: true });
            } catch (err: any) {
              Alert.alert('Erreur', err?.message || "Impossible d'enregistrer le remboursement. Réessayez.");
            } finally {
              setRefundBusy(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return '0 XPF';
    return `${price.toLocaleString('fr-FR')} XPF`;
  };

  const buildContractHTML = () => {
    if (!order) return '';
    const rideOpt = order.rideOption as any;
    const rd = rideOpt?.rentalData || {
      vehicleName: rideOpt?.title || 'Véhicule',
      vehicleCategory: rideOpt?.categoryLabel || rideOpt?.category || '',
      days: rideOpt?.days || 0,
      pricePerDay: (rideOpt?.price || 0) / Math.max(1, rideOpt?.days || 1),
      startDate: rideOpt?.startDate,
      endDate: rideOpt?.endDate,
      pickupAddress: rideOpt?.pickupLocation,
    };
    const clientName = order.clientName || 'Client';
    const loueurName = (order as any).driverName || (order as any).driver?.name || 'Loueur';
    const signatureImg = rideOpt?.clientSignatureSvg || '';
    const loueurSigFromDb = rideOpt?.loueurSignatureSvg || '';
    const effectiveLoueurSig = loueurSigFromDb || loueurSignature || '';
    const signedAt = rideOpt?.clientSignedAt;
    const sigName = rideOpt?.clientSignatureName || clientName;
    const todayStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const signedDate = signedAt ? new Date(signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : todayStr;
    const signedTime = signedAt ? new Date(signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const totalPrice = order.totalPrice || 0;
    const pricePerDay = rd?.pricePerDay || 0;
    const days = rd?.days || 0;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>Contrat RAVE</title>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:20px;color:#1a1a1a;font-size:14px;line-height:1.6;margin:0}
.header{text-align:center;margin-bottom:24px;border-bottom:2px solid #171717;padding-bottom:16px}.header h1{font-size:20px;margin:0 0 4px;letter-spacing:1px}.header h2{font-size:14px;font-weight:400;color:#6B7280;margin:0 0 8px}.header .date{font-size:12px;color:#9CA3AF}.header .ref{font-size:11px;color:#9CA3AF;margin-top:4px}
h3{font-size:15px;margin-top:20px;margin-bottom:6px;color:#171717;border-bottom:1px solid #E5E7EB;padding-bottom:4px}p{margin:0 0 10px;color:#374151}
.details-box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px;margin:10px 0}table{width:100%;border-collapse:collapse}table td{padding:5px 0;font-size:13px}table td:first-child{color:#6B7280;width:45%}table td:last-child{font-weight:500;text-align:right}
.sig-section{margin-top:30px;border-top:2px solid #171717;padding-top:16px}
.sig-box{margin-bottom:20px;text-align:center}.sig-label{font-size:12px;color:#6B7280;margin-bottom:6px}.sig-name{font-size:14px;font-weight:600;margin-bottom:6px}
.sig-image{border:1px dashed #D1D5DB;border-radius:8px;padding:10px;min-height:60px;display:flex;align-items:center;justify-content:center;background:#FAFAFA}
.sig-image img{max-width:100%;max-height:100px;height:auto}.signed-info{font-size:11px;color:#22C55E;margin-top:4px}.pending{font-size:11px;color:#F59E0B;font-style:italic}
.footer{text-align:center;margin-top:30px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:10px;color:#9CA3AF}
</style></head><body>
<div class="header"><h1>CONTRAT DE LOCATION</h1><h2>DE VÉHICULE</h2><div class="date">En date du ${signedDate}</div><div class="ref">Réf. ${order.id.substring(0, 8).toUpperCase()}</div></div>
<h3>Article 1 - Objet</h3><p>Mise à disposition d'un véhicule de location par le loueur au locataire, via la plateforme RAVE.</p>
<h3>Article 2 - Réservation</h3><div class="details-box"><table>
<tr><td>Véhicule</td><td>${rd?.vehicleName || 'N/A'}</td></tr>
<tr><td>Catégorie</td><td style="text-transform:capitalize">${rd?.vehicleCategory || 'N/A'}</td></tr>
<tr><td>Prise en charge</td><td>${rd?.startDate ? new Date(rd.startDate).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : 'N/A'}</td></tr>
<tr><td>Retour</td><td>${rd?.endDate ? new Date(rd.endDate).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : 'N/A'}</td></tr>
<tr><td>Durée</td><td>${days} jour${days > 1 ? 's' : ''}</td></tr>
<tr><td>Tarif / jour</td><td>${pricePerDay.toLocaleString()} XPF</td></tr>
<tr><td>Montant total</td><td style="font-weight:700">${totalPrice.toLocaleString()} XPF</td></tr>
${rd?.pickupAddress ? `<tr><td>Adresse</td><td>${rd.pickupAddress}</td></tr>` : ''}
</table></div>
<h3>Article 3 - Conditions</h3><p>Le locataire s'engage à : être titulaire d'un permis valide, utiliser le véhicule avec soin, le restituer dans l'état reçu, respecter le code de la route, ne pas sous-louer.</p>
<h3>Article 4 - Paiement</h3><p>Prix : ${totalPrice.toLocaleString()} XPF pour ${days} jour${days > 1 ? 's' : ''} (${pricePerDay.toLocaleString()} XPF/jour).</p>
<h3>Article 5 - Assurance</h3><p>Véhicule couvert par l'assurance du loueur. Le locataire reste responsable des infractions.</p>
<div class="sig-section">
<div class="sig-box"><div class="sig-label">Le locataire</div><div class="sig-name">${sigName}</div>${signatureImg ? `<div class="sig-image"><img src="${signatureImg}" alt="Signature"/></div><div class="signed-info">✓ Signé le ${signedDate}${signedTime ? ' à ' + signedTime : ''}</div>` : `<div class="sig-image"><span class="pending">Non signé</span></div>`}</div>
<div class="sig-box"><div class="sig-label">Le loueur</div><div class="sig-name">${loueurName}</div>${effectiveLoueurSig ? `<div class="sig-image"><img src="${effectiveLoueurSig}" alt="Signature loueur"/></div><div class="signed-info">✓ Signé</div>` : `<div class="sig-image"><span class="pending">En attente</span></div>`}</div>
</div>
<div class="footer">Document généré par RAVE • Plateforme de location de véhicules</div>
</body></html>`;
  };

  const handleViewContract = async () => {
    try {
      if (id) {
        try {
          const sessionId = await getDriverSessionId();
          const data = await apiFetch<{ html?: string }>(`/api/orders/${id}/contract`, {
            headers: { 'X-Driver-Session': sessionId || '' },
          });
          if (data?.html) {
            setContractHTML(data.html);
            setShowContractModal(true);
            return;
          }
        } catch {
          // fallback local
        }
      }
      const html = buildContractHTML();
      if (html) {
        setContractHTML(html);
        setShowContractModal(true);
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir le contrat.");
    }
  };

  const handleShareContract = async () => {
    let html = contractHTML;
    if (!html && id) {
      try {
        const sessionId = await getDriverSessionId();
        const data = await apiFetch<{ html?: string }>(`/api/orders/${id}/contract`, {
          headers: { 'X-Driver-Session': sessionId || '' },
        });
        html = data?.html || '';
        if (html) setContractHTML(html);
      } catch {
        /* fallback */
      }
    }
    if (!html) html = buildContractHTML();
    if (!html) return;
    await shareHtmlAsPdf(html, 'Contrat RAVE');
  };

  const handleShareImage = async (uri: string, name: string) => {
    await shareImage(uri, name);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text variant="h2">Détails de la location</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECC8B" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text variant="h2">Détails de la location</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Location introuvable'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => safeBack(router)}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = statusLabels[order.status] || { label: order.status, color: '#6B7280', icon: 'help-circle' };

  const rentalLike = isRentalOrderLike(order);
  const rideOpt = order.rideOption as any;
  const rentalData = rideOpt?.rentalData || (rentalLike ? {
    vehicleName: rideOpt?.title || 'Véhicule',
    days: rideOpt?.days || 1,
    pricePerDay: (rideOpt?.price || 0) / Math.max(1, rideOpt?.days || 1),
    startDate: rideOpt?.startDate,
    endDate: rideOpt?.endDate,
    pickupAddress: rideOpt?.pickupLocation,
    options: order.supplements?.map((s: any) => ({
      name: s.name || s.id,
      pricePerDay: (s.price || 0) / Math.max(1, rideOpt?.days || 1),
    })) || [],
  } : null);
  const hasClientSignature = !!(
    rideOpt?.clientSignatureSvg ||
    rideOpt?.clientSignedAt ||
    rideOpt?.yousignSignatureRequestId ||
    rideOpt?.signedVia === 'yousign' ||
    rideOpt?.signedVia === 'drawn'
  );
  const rentalPhase = getRentalLifecyclePhase(order);
  const rentalStepperState = getRentalStepperState(order);
  const isClosed = ['completed', 'payment_confirmed', 'cancelled', 'declined', 'expired', 'payment_failed'].includes(order.status);
  const cancelRequest = rideOpt?.cancelRequest as
    | { status?: string; reason?: string; requestedAt?: string; resolvedAt?: string }
    | undefined;
  const cancelPending = cancelRequest?.status === 'pending' && !isClosed;
  const cancellation = rideOpt?.cancellation as { by?: string; approvedByDriver?: boolean; reason?: string; at?: string } | undefined;
  const statusTitle = cancelPending
    ? 'Annulation demandée'
    : order.status === 'cancelled'
      ? cancellation?.by === 'driver'
        ? 'Annulée par vous'
        : cancellation?.by === 'client'
          ? cancellation.approvedByDriver ? 'Annulée (demande du client acceptée)' : 'Annulée par le client'
          : 'Annulée'
      : !isClosed && hasClientSignature
        ? 'Contrat signé'
        : status.label;
  const statusColor = cancelPending ? '#D97706' : status.color;

  const saveMeetingPoint = async () => {
    const value = meetingDraft.trim();
    if (!value) {
      Alert.alert('Lieu requis', 'Indiquez le lieu de rendez-vous pour le client.');
      return;
    }
    try {
      setMeetingBusy(true);
      const res = await setRentalMeetingPoint(order.id, value);
      const confirmed =
        (res && typeof res.meetingPoint === 'string' && res.meetingPoint.trim()) || value;
      setOrder((prev) => {
        if (!prev) return prev;
        const prevRide = (prev.rideOption as any) || {};
        return {
          ...prev,
          rideOption: {
            ...prevRide,
            meetingPoint: confirmed,
            meetingPointSetAt: new Date().toISOString(),
            meetingPointSetBy: 'driver',
          },
        } as Order;
      });
      setMeetingDraft(confirmed);
      Alert.alert('RDV envoyé', 'Le client voit désormais ce lieu de rendez-vous.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d’enregistrer le lieu de RDV.');
    } finally {
      setMeetingBusy(false);
    }
  };

  const advanceRentalLifecycle = async (nextPhase: 'with_client' | 'returned') => {
    const sessionId = await getDriverSessionId();
    if (!sessionId) {
      Alert.alert('Erreur', 'Session loueur introuvable.');
      return;
    }
    setLifecycleBusy(true);
    try {
      await postRentalOrderLifecycle(order.id, sessionId, { phase: nextPhase });
      const orderData = await apiFetch<Order>(`/api/orders/${order.id}`, {
        headers: { 'X-Driver-Session': sessionId },
      });
      setOrder(orderData);
    } catch (err) {
      console.error('[CourseDetails] lifecycle:', err);
      Alert.alert(
        'Erreur',
        'Impossible de mettre à jour cette étape. Vérifiez que le serveur expose POST /api/rental-orders/.../lifecycle.'
      );
    } finally {
      setLifecycleBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h2">Détails de la location</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statut et Date */}
        <Card style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={cancelPending ? 'alert-circle' : 'key'} size={24} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusTitle}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.timeText}>à {formatTime(order.createdAt)}</Text>
        </Card>

        {cancelPending && (
          <Card style={styles.cancelCard}>
            <View style={styles.cancelCardHeader}>
              <Ionicons name="alert-circle" size={22} color="#B45309" />
              <Text style={styles.cancelCardTitle}>Le client demande l'annulation</Text>
            </View>
            {cancelRequest?.reason ? (
              <Text style={styles.cancelCardReason}>« {cancelRequest.reason} »</Text>
            ) : null}
            {cancelRequest?.requestedAt ? (
              <Text style={styles.cancelCardMeta}>
                Demandée le {formatDate(cancelRequest.requestedAt)} à {formatTime(cancelRequest.requestedAt)}
              </Text>
            ) : null}
            {rideOpt?.payzenStatus === 'paid' ? (
              <Text style={styles.cancelCardMeta}>Payée par carte : en cas d'acceptation, le remboursement est à traiter.</Text>
            ) : null}
            <View style={styles.cancelCardActions}>
              <TouchableOpacity
                style={[styles.cancelCardBtn, styles.cancelCardReject]}
                onPress={() => decideCancelRequest('reject')}
                disabled={!!cancelDecisionBusy}
              >
                {cancelDecisionBusy === 'reject'
                  ? <ActivityIndicator color="#1a1a1a" />
                  : <Text style={styles.cancelCardRejectText}>Refuser</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelCardBtn, styles.cancelCardApprove]}
                onPress={() => decideCancelRequest('approve')}
                disabled={!!cancelDecisionBusy}
              >
                {cancelDecisionBusy === 'approve'
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.cancelCardApproveText}>Accepter l'annulation</Text>}
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {rideOpt?.refund ? (
          <Card style={[styles.cancelCard, rideOpt.refund.status === 'done' && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <View style={styles.cancelCardHeader}>
              <Ionicons
                name={rideOpt.refund.status === 'done' ? 'checkmark-circle' : 'cash-outline'}
                size={22}
                color={rideOpt.refund.status === 'done' ? '#166534' : '#B45309'}
              />
              <Text style={[styles.cancelCardTitle, rideOpt.refund.status === 'done' && { color: '#166534' }]}>
                {rideOpt.refund.status === 'done'
                  ? `Remboursé : ${formatPrice(rideOpt.refund.amount)}`
                  : `Remboursement à effectuer : ${formatPrice(rideOpt.refund.amount)}`}
              </Text>
            </View>
            {rideOpt.refund.status === 'done' ? (
              rideOpt.refund.doneAt ? (
                <Text style={styles.cancelCardMeta}>
                  Confirmé le {formatDate(rideOpt.refund.doneAt)} à {formatTime(rideOpt.refund.doneAt)}
                </Text>
              ) : null
            ) : (
              <>
                <Text style={styles.cancelCardMeta}>
                  Le client a payé par carte et la location n'aura pas lieu. Remboursez-le, puis confirmez ici : il sera prévenu.
                </Text>
                <TouchableOpacity
                  style={[styles.cancelCardBtn, styles.cancelCardApprove, { marginTop: 10 }]}
                  onPress={confirmRefundDone}
                  disabled={refundBusy}
                >
                  {refundBusy
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.cancelCardApproveText}>J'ai remboursé</Text>}
                </TouchableOpacity>
              </>
            )}
          </Card>
        ) : null}

        {order.status === 'cancelled' && cancellation?.reason ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Motif d'annulation</Text>
            <Text style={styles.cancelCardReasonMuted}>{cancellation.reason}</Text>
          </Card>
        ) : null}

        {cancelRequest?.status === 'rejected' && !isClosed ? (
          <View style={styles.cancelRejectedNote}>
            <Ionicons name="information-circle" size={16} color="#6B7280" />
            <Text style={styles.cancelRejectedText}>Vous avez refusé une demande d'annulation : la location est maintenue.</Text>
          </View>
        ) : null}

        {rentalLike && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Suivi de la location</Text>
            <RentalLifecycleStepper state={rentalStepperState} variant="loueur" />
            {rentalPhase === 'vehicle_ready' &&
              !cancelPending &&
              (order.status === 'accepted' || order.status === 'booked') && (
                <TouchableOpacity
                  style={styles.lifecycleButton}
                  onPress={() => advanceRentalLifecycle('with_client')}
                  disabled={lifecycleBusy}
                >
                  {lifecycleBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="car-outline" size={20} color="#fff" />
                      <Text style={styles.lifecycleButtonText}>Véhicule remis au client</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            {rentalPhase === 'with_client' && (
              <TouchableOpacity
                style={[styles.lifecycleButton, styles.lifecycleButtonSecondary]}
                onPress={() => advanceRentalLifecycle('returned')}
                disabled={lifecycleBusy}
              >
                {lifecycleBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                    <Text style={styles.lifecycleButtonText}>Confirmer le retour du véhicule</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Card>
        )}

        {rentalData && (
          <>
            {/* Gains */}
            <Card style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Revenus pour cette location</Text>
              <Text style={styles.earningsValue}>{formatPrice(order.totalPrice)}</Text>
            </Card>

            {/* Client */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <View style={styles.clientInfo}>
                <View style={styles.clientAvatar}>
                  <Ionicons name="person" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>{order.clientName || 'Client RAVE'}</Text>
                  {order.clientPhone && (
                    <View style={styles.clientPhone}>
                      <Ionicons name="call-outline" size={14} color="#6B7280" />
                      <Text style={styles.clientPhoneText}>{order.clientPhone}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>

            {/* Véhicule demandé */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Véhicule demandé</Text>
              <View style={styles.serviceInfo}>
                <View style={[styles.serviceIcon, { backgroundColor: '#171717' }]}>
                  <Ionicons name="car-sport" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.serviceDetails}>
                  <Text style={styles.serviceName}>{rentalData.vehicleName || 'Véhicule'}</Text>
                  <Text style={styles.serviceDescription}>
                    Catégorie : {rentalData.vehicleCategory || 'Citadine'}
                  </Text>
                </View>
              </View>
              {rentalData.serviceType && rentalData.serviceType !== 'livraison' && (
                <View style={[styles.passengerInfo, { borderTopColor: '#F3F4F6' }]}>
                  <Ionicons 
                    name={rentalData.serviceType === 'longterme' ? 'time' : 'key'} 
                    size={20} color="#6B7280" 
                  />
                  <Text style={styles.passengerText}>
                    {rentalData.serviceType === 'longterme' ? 'Location longue durée' : 'Location'}
                  </Text>
                </View>
              )}
            </Card>

            {/* Période de location */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Période de location</Text>
              <View style={styles.rentalPeriodContainer}>
                <View style={styles.rentalPeriodItem}>
                  <View style={[styles.rentalPeriodDot, { backgroundColor: '#22C55E' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>Prise en charge</Text>
                    <Text style={styles.addressValue}>
                      {rentalData.startDate 
                        ? new Date(rentalData.startDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Non spécifié'}
                    </Text>
                    {rentalData.startTime && (
                      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>à {rentalData.startTime}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.rentalPeriodLine} />
                <View style={styles.rentalPeriodItem}>
                  <View style={[styles.rentalPeriodDot, { backgroundColor: '#EF4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>Retour</Text>
                    <Text style={styles.addressValue}>
                      {rentalData.endDate 
                        ? new Date(rentalData.endDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Non spécifié'}
                    </Text>
                    {rentalData.endTime && (
                      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>à {rentalData.endTime}</Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={[styles.tripInfo, { marginTop: 12 }]}>
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                <Text style={[styles.tripInfoText, { marginLeft: 8 }]}>
                  Durée : {rentalData.days} jour{rentalData.days > 1 ? 's' : ''}
                </Text>
              </View>
            </Card>

            {['accepted', 'booked', 'in_progress'].includes(order.status) && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Lieu de rendez-vous</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>
                  Visible par le client après acceptation. Vous pouvez envoyer un nouveau lieu à tout moment.
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: '#111',
                    marginBottom: 10,
                  }}
                  placeholder="Ex. Parking Fare Ute, Papeete"
                  placeholderTextColor="#9CA3AF"
                  value={meetingDraft}
                  onChangeText={setMeetingDraft}
                />
                <TouchableOpacity
                  onPress={saveMeetingPoint}
                  disabled={meetingBusy}
                  style={{
                    backgroundColor: '#171717',
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    opacity: meetingBusy ? 0.6 : 1,
                  }}
                >
                  {meetingBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {(rideOpt?.meetingPoint || '').trim()
                        ? 'Mettre à jour le RDV'
                        : 'Envoyer le RDV au client'}
                    </Text>
                  )}
                </TouchableOpacity>
              </Card>
            )}

            {/* Options de location */}
            {rentalData.options && rentalData.options.length > 0 && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Options</Text>
                {rentalData.options.map((opt: any, idx: number) => (
                  <View key={idx} style={styles.supplementRow}>
                    <View style={styles.supplementInfo}>
                      <Ionicons name="add-circle-outline" size={18} color="#6B7280" />
                      <Text style={styles.supplementName}>{opt.name}</Text>
                    </View>
                    <Text style={styles.supplementPrice}>
                      {formatPrice((opt.pricePerDay || 0) * (rentalData.days || 1))}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Récapitulatif financier location */}
            <Card style={styles.priceCard}>
              <Text style={styles.sectionTitle}>Récapitulatif</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {rentalData.vehicleName} × {rentalData.days}j
                </Text>
                <Text style={styles.priceValue}>
                  {formatPrice((rentalData.pricePerDay || 0) * (rentalData.days || 1))}
                </Text>
              </View>
              {rentalData.options && rentalData.options.length > 0 && rentalData.options.map((opt: any, idx: number) => (
                <View key={idx} style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{opt.name} × {rentalData.days}j</Text>
                  <Text style={styles.priceValue}>{formatPrice((opt.pricePerDay || 0) * (rentalData.days || 1))}</Text>
                </View>
              ))}
              {rideOpt?.tvaRegime === 'assujetti' && rideOpt?.priceHt != null ? (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Total HT</Text>
                    <Text style={styles.priceValue}>{formatPrice(Number(rideOpt.priceHt))}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>TVA ({rideOpt.tvaRate || 16} %)</Text>
                    <Text style={styles.priceValue}>{formatPrice(Number(rideOpt.priceTva || 0))}</Text>
                  </View>
                </>
              ) : null}
              <View style={styles.priceDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{rideOpt?.tvaRegime === 'assujetti' ? 'Total TTC' : 'Total'}</Text>
                <Text style={styles.totalValue}>{formatPrice(order.totalPrice)}</Text>
              </View>
            </Card>

            {/* Moyen de paiement */}
            {order.paymentMethod && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Paiement</Text>
                <View style={styles.infoRow}>
                  <Ionicons
                    name={(order.rideOption as any)?.payzenStatus === 'paid' ? 'checkmark-circle' : order.paymentMethod === 'card' ? 'alert-circle' : 'card-outline'}
                    size={20}
                    color={(order.rideOption as any)?.payzenStatus === 'paid' ? '#16A34A' : order.paymentMethod === 'card' ? '#DC2626' : '#6B7280'}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Moyen de paiement</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        (order.rideOption as any)?.payzenStatus === 'paid'
                          ? { color: '#16A34A', fontWeight: '700' }
                          : order.paymentMethod === 'card'
                            ? { color: '#DC2626', fontWeight: '700' }
                            : null,
                      ]}
                    >
                      {(order.rideOption as any)?.payzenStatus === 'paid'
                        ? 'Déjà payée par carte en ligne'
                        : order.paymentMethod === 'card'
                          ? 'Paiement carte non abouti — à encaisser'
                          : order.paymentMethod === 'cash'
                            ? 'À encaisser chez le loueur'
                            : order.paymentMethod === 'virement'
                              ? 'Virement bancaire'
                              : order.paymentMethod}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Contrat de location & signature */}
            <Card style={[styles.section, { borderWidth: 1, borderColor: hasClientSignature ? '#22C55E30' : '#F59E0B30' }]}>
              <Text style={styles.sectionTitle}>Contrat de location</Text>
              {hasClientSignature ? (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#15803D', marginLeft: 8 }}>
                      Contrat signé par le client
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>Signataire</Text>
                      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                        {rideOpt.clientSignatureName || order.clientName || 'Client'}
                      </Text>
                    </View>
                    {rideOpt.clientSignedAt && (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#6B7280' }}>Date</Text>
                          <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                            {new Date(rideOpt.clientSignedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#6B7280' }}>Heure</Text>
                          <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                            {new Date(rideOpt.clientSignedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>Votre signature</Text>
                      <Text style={{ fontSize: 13, color: rideOpt.loueurSignatureSvg ? '#15803D' : '#92400E', fontWeight: '500' }}>
                        {rideOpt.loueurSignatureSvg ? 'Apposée' : 'Non apposée'}
                      </Text>
                    </View>
                  </View>

                  {rideOpt.clientSignatureSvg && (
                    <View style={{ marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>Signature</Text>
                      <Image
                        source={{ uri: rideOpt.clientSignatureSvg }}
                        style={{ width: '100%', height: 80 }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ backgroundColor: '#E8F8F0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time" size={20} color="#F59E0B" />
                  <Text style={{ fontSize: 14, color: '#166534', marginLeft: 8, fontWeight: '500' }}>
                    En attente de signature du client
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#171717',
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 16,
                  gap: 8,
                }}
                onPress={handleViewContract}
              >
                <Ionicons name="document-text-outline" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
                  Voir le contrat
                </Text>
              </TouchableOpacity>
            </Card>

            {/* Documents du client */}
            {(isUsableMediaUri(rideOpt?.clientIdFront) || isUsableMediaUri(rideOpt?.clientIdBack)) && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Pièce d'identité du client</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {isUsableMediaUri(rideOpt.clientIdFront) && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>Recto</Text>
                      <TouchableOpacity onPress={() => handleShareImage(rideOpt.clientIdFront, 'identite-recto')} activeOpacity={0.8}>
                        <Image
                          source={{ uri: rideOpt.clientIdFront }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#F3F4F6' }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                  {isUsableMediaUri(rideOpt.clientIdBack) && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>Verso</Text>
                      <TouchableOpacity onPress={() => handleShareImage(rideOpt.clientIdBack, 'identite-verso')} activeOpacity={0.8}>
                        <Image
                          source={{ uri: rideOpt.clientIdBack }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#F3F4F6' }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {(isUsableMediaUri(rideOpt?.clientLicenseFront) || isUsableMediaUri(rideOpt?.clientLicenseBack)) && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Permis de conduire du client</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {isUsableMediaUri(rideOpt.clientLicenseFront) && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>Recto</Text>
                      <TouchableOpacity onPress={() => handleShareImage(rideOpt.clientLicenseFront, 'permis-recto')} activeOpacity={0.8}>
                        <Image
                          source={{ uri: rideOpt.clientLicenseFront }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#F3F4F6' }}
                          resizeMode="cover"
                        />
                        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 6 }}>
                          <Ionicons name="download-outline" size={16} color="#FFF" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                  {isUsableMediaUri(rideOpt.clientLicenseBack) && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>Verso</Text>
                      <TouchableOpacity onPress={() => handleShareImage(rideOpt.clientLicenseBack, 'permis-verso')} activeOpacity={0.8}>
                        <Image
                          source={{ uri: rideOpt.clientLicenseBack }}
                          style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#F3F4F6' }}
                          resizeMode="cover"
                        />
                        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, padding: 6 }}>
                          <Ionicons name="download-outline" size={16} color="#FFF" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* Informations */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <View style={styles.infoRow}>
                <Ionicons name="receipt-outline" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Référence</Text>
                  <Text style={styles.infoValue}>{order.id.substring(0, 8).toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Date de la demande</Text>
                  <Text style={styles.infoValue}>{formatDate(order.createdAt)} à {formatTime(order.createdAt)}</Text>
                </View>
              </View>
            </Card>

            {/* Bouton Messages */}
            <TouchableOpacity 
              style={styles.messagesButton}
              onPress={() => router.push({
                pathname: '/(chauffeur)/chat',
                params: {
                  orderId: order.id,
                  clientName: order.clientName || 'Client',
                },
              })}
            >
              <Ionicons name="chatbubbles-outline" size={22} color="#1a1a1a" />
              <Text style={styles.messagesButtonText}>Contacter le client</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modal Contrat de Location */}
      <Modal visible={showContractModal} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 45 : 55 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFFFFF' }}>
            <Text variant="h2" style={{ fontSize: 18 }}>Contrat de location</Text>
            <TouchableOpacity onPress={() => setShowContractModal(false)} style={{ padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 }}>
              <Ionicons name="close" size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: contractHTML }}
            style={{ flex: 1 }}
            scrollEnabled
            showsVerticalScrollIndicator
            scalesPageToFit={false}
          />
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FFFFFF' }}>
            <TouchableOpacity
              onPress={handleShareContract}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#171717', borderRadius: 12, paddingVertical: 14 }}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Télécharger / Partager</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cancelCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  cancelCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancelCardTitle: { fontSize: 16, fontWeight: '800', color: '#92400E', flex: 1 },
  cancelCardReason: { fontSize: 14, color: '#78350F', marginTop: 8, fontStyle: 'italic' },
  cancelCardReasonMuted: { fontSize: 14, color: '#374151' },
  cancelCardMeta: { fontSize: 12, color: '#B45309', marginTop: 6 },
  cancelCardActions: { flexDirection: 'column-reverse', gap: 10, marginTop: 14 },
  cancelCardBtn: {
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelCardReject: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
  cancelCardRejectText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cancelCardApprove: { backgroundColor: '#EF4444' },
  cancelCardApproveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  cancelRejectedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  cancelRejectedText: { fontSize: 13, color: '#4B5563', flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4ECC8B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  earningsCard: {
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#22C55E20',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '500',
    marginBottom: 12,
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#22C55E',
    marginBottom: 20,
    lineHeight: 40,
    minHeight: 45,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientDetails: {
    marginLeft: 16,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  clientPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  clientPhoneText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  lifecycleButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#171717',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  lifecycleButtonSecondary: {
    marginTop: 10,
    backgroundColor: '#15803D',
  },
  lifecycleButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  addressLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tripInfoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontWeight: '500',
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#D1F2E3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceDetails: {
    marginLeft: 14,
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  passengerText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
  },
  supplementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supplementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplementName: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 10,
  },
  supplementPrice: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  priceCard: {
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'right',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22C55E',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 14,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  messagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  messagesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 10,
  },
  bottomSpacer: {
    height: 24,
  },
  rentalPeriodContainer: {
    gap: 0,
  },
  rentalPeriodItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rentalPeriodDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  rentalPeriodLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E5E5',
    marginLeft: 5,
    marginVertical: 4,
  },
});
