import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, TouchableOpacity, Modal, StyleSheet, Linking, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { onRentalOrderCancelRequest, type CancelRequestData } from '@/lib/socket';
import { approveCancelRequest, rejectCancelRequest, getDriverSessionId } from '@/lib/api';

export default function ChauffeurLayout() {
  const router = useRouter();
  const [cancelRequest, setCancelRequest] = useState<CancelRequestData | null>(null);
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const unsub = onRentalOrderCancelRequest((data) => {
      console.log('[Layout] Cancel request popup triggered for order:', data.orderId);
      setCancelRequest(data);
      setShowCancelPopup(true);
    });
    return () => { unsub(); };
  }, []);

  const getSessionId = useCallback(async () => {
    try {
      return await getDriverSessionId() || '';
    } catch { return ''; }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!cancelRequest) return;
    setProcessing(true);
    try {
      const sessionId = await getSessionId();
      await approveCancelRequest(cancelRequest.orderId, sessionId);
      setShowCancelPopup(false);
      setCancelRequest(null);
      Alert.alert('Annulation validée', 'La commande a été annulée.');
    } catch (err) {
      console.error('[Layout] Error approving cancel:', err);
      Alert.alert('Erreur', 'Impossible de valider l\'annulation.');
    } finally {
      setProcessing(false);
    }
  }, [cancelRequest, getSessionId]);

  const handleReject = useCallback(async () => {
    if (!cancelRequest) return;
    setProcessing(true);
    try {
      const sessionId = await getSessionId();
      await rejectCancelRequest(cancelRequest.orderId, sessionId);
      setShowCancelPopup(false);
      setCancelRequest(null);
      Alert.alert('Annulation refusée', 'Le client a été notifié que sa demande est refusée.');
    } catch (err) {
      console.error('[Layout] Error rejecting cancel:', err);
      Alert.alert('Erreur', 'Impossible de refuser l\'annulation.');
    } finally {
      setProcessing(false);
    }
  }, [cancelRequest, getSessionId]);

  const handleCall = useCallback(() => {
    if (!cancelRequest?.clientPhone) {
      Alert.alert('Erreur', 'Numéro de téléphone indisponible.');
      return;
    }
    Linking.openURL(`tel:${cancelRequest.clientPhone}`);
  }, [cancelRequest]);

  const handleMessage = useCallback(() => {
    setShowCancelPopup(false);
    router.push('/(chauffeur)/messages');
  }, [router]);

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
        <Stack.Screen name="messages" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="course-details/[id]" />
        <Stack.Screen name="commande-location" />
        <Stack.Screen name="support-chat" />
        <Stack.Screen name="mes-vehicules" />
        <Stack.Screen name="ajouter-vehicule" />
        <Stack.Screen name="modifier-vehicule" />
      </Stack>

      <Modal visible={showCancelPopup} transparent animationType="slide" onRequestClose={() => setShowCancelPopup(false)}>
        <View style={s.overlay}>
          <View style={s.popup}>
            <View style={s.iconWrap}>
              <Ionicons name="alert-circle" size={44} color="#F59E0B" />
            </View>
            <Text style={s.title}>Demande d'annulation</Text>
            <Text style={s.subtitle}>Un client souhaite annuler sa réservation</Text>

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
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Ionicons name="cash" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Montant</Text>
                <Text style={[s.detailValue, { color: '#EF4444', fontWeight: '800' }]}>
                  {cancelRequest?.totalPrice ? `${cancelRequest.totalPrice.toLocaleString()} XPF` : '-'}
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Ionicons name="location" size={16} color="#6B7280" />
                <Text style={s.detailLabel}>Lieu</Text>
                <Text style={s.detailValue} numberOfLines={1}>{cancelRequest?.pickupLocation || '-'}</Text>
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
                style={[s.actionBtn, s.rejectBtn]}
                onPress={handleReject}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="close" size={18} color="#FFF" />
                    <Text style={s.actionBtnText}>Refuser</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.approveBtn]}
                onPress={handleApprove}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={s.actionBtnText}>Valider</Text>
                  </>
                )}
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
    flexDirection: 'row', gap: 12, marginTop: 12, width: '100%',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 12,
  },
  rejectBtn: { backgroundColor: '#EF4444' },
  approveBtn: { backgroundColor: '#22C55E' },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
