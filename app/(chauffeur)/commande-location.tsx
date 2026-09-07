import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { acceptRentalOrder, declineRentalOrder, apiFetch } from '@/lib/api';

const { width } = Dimensions.get('window');

const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} XPF`;

export default function CommandeLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    sessionId: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    clientAge: string;
    vehicleTitle: string;
    vehicleCategory: string;
    pickupLocation: string;
    destinationInfo: string;
    scheduledTime: string;
    totalPrice: string;
    pricePerDay: string;
    subtotal: string;
    supplementsTotal: string;
    deposit: string;
    km: string;
    days: string;
    startDate: string;
    endDate: string;
    supplements: string;
    createdAt: string;
    ownerName: string;
  }>();

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [contractHtml, setContractHtml] = useState<string | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [contractSignedVia, setContractSignedVia] = useState<string | null>(null);

  const orderId = params.orderId || '';
  const sessionId = params.sessionId || '';
  const clientName = params.clientName || 'Client';
  const clientPhone = params.clientPhone || '';
  const clientEmail = params.clientEmail || '';
  const clientAge = params.clientAge || '';
  const vehicleTitle = params.vehicleTitle || 'Véhicule';
  const vehicleCategory = params.vehicleCategory || '';
  const pickupLocation = params.pickupLocation || 'Non spécifié';
  const destinationInfo = params.destinationInfo || '';
  const totalPrice = parseInt(params.totalPrice || '0', 10);
  const pricePerDay = parseInt(params.pricePerDay || '0', 10);
  const subtotal = parseInt(params.subtotal || '0', 10);
  const supplementsTotal = parseInt(params.supplementsTotal || '0', 10);
  const deposit = params.deposit || '0 XPF';
  const km = params.km || 'Non spécifié';
  const days = parseInt(params.days || '1', 10);
  const startDate = params.startDate ? new Date(params.startDate) : new Date();
  const endDate = params.endDate ? new Date(params.endDate) : new Date();
  const createdAt = params.createdAt || new Date().toISOString();
  const ownerName = params.ownerName || 'Loueur RAVE';

  let supplements: { id: string; name: string; pricePerDay: number; total: number }[] = [];
  try {
    supplements = params.supplements ? JSON.parse(params.supplements) : [];
  } catch { supplements = []; }

  const formatDateFull = (d: Date) => {
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Pacific/Tahiti',
    });
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Pacific/Tahiti',
    });
  };

  const contractRef = `RAVE-${orderId.substring(0, 8).toUpperCase()}`;
  const contractDate = new Date(createdAt).toLocaleDateString('fr-FR', { timeZone: 'Pacific/Tahiti' });

  const loadSignedContract = useCallback(async (): Promise<string | null> => {
    if (!orderId || !sessionId) return null;
    setContractLoading(true);
    try {
      const data = await apiFetch<{
        html?: string;
        signed?: boolean;
        signedVia?: string | null;
      }>(`/api/orders/${orderId}/contract`, {
        headers: { 'X-Driver-Session': sessionId },
      });
      if (data?.html) {
        setContractHtml(data.html);
        setContractSigned(!!data.signed);
        setContractSignedVia(data.signedVia || null);
        return data.html;
      }
      return null;
    } catch (e: any) {
      console.warn('[Loueur] load contract failed:', e?.message || e);
      return null;
    } finally {
      setContractLoading(false);
    }
  }, [orderId, sessionId]);

  useEffect(() => {
    loadSignedContract();
  }, [loadSignedContract]);

  const openContract = async () => {
    if (!contractHtml && !contractLoading) {
      await loadSignedContract();
    }
    setShowContract(true);
  };

  const handleDownloadPDF = async () => {
    try {
      let html = contractHtml;
      if (!html) {
        html = await loadSignedContract();
      }
      if (!html) {
        Alert.alert('Erreur', 'Contrat signé indisponible. Réessayez.');
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Contrat de location RAVE' });
    } catch {
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    }
  };

  const handleAccept = async () => {
    if (!sessionId || !orderId) return;
    setIsAccepting(true);
    try {
      let loueurSig: string | null = null;
      try {
        const sigFile = `${FileSystem.documentDirectory}loueur_signature.txt`;
        const info = await FileSystem.getInfoAsync(sigFile);
        if (info.exists) loueurSig = await FileSystem.readAsStringAsync(sigFile);
      } catch {}
      await acceptRentalOrder(orderId, sessionId, loueurSig);
      setAccepted(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'accepter la demande.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Refuser la demande',
      'Êtes-vous sûr de vouloir refuser cette demande de location ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setIsDeclining(true);
            try {
              if (sessionId) await declineRentalOrder(orderId, sessionId);
            } catch {}
            setIsDeclining(false);
            safeBack(router);
          },
        },
      ]
    );
  };

  if (accepted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.successContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
            <Text style={styles.successTitle}>Réservation acceptée</Text>
            <Text style={styles.successSubtitle}>
              Le client {clientName} a été notifié.{'\n'}Réservation confirmée pour le{'\n'}{formatDateFull(startDate)}.
            </Text>
            <View style={styles.successInfoCard}>
              <Text style={styles.successInfoLabel}>{vehicleTitle}</Text>
              <Text style={styles.successInfoValue}>{days} jour{days > 1 ? 's' : ''} — {formatPrice(totalPrice)}</Text>
              <Text style={styles.successInfoSub}>Prise en charge : {pickupLocation}</Text>
            </View>
            <TouchableOpacity style={styles.successButton} onPress={() => router.replace('/(chauffeur)/' as any)}>
              <Ionicons name="home" size={18} color="#FFFFFF" />
              <Text style={styles.successButtonText}>Retour à l'accueil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.successSecondaryBtn} onPress={() => router.push('/(chauffeur)/courses' as any)}>
              <Text style={styles.successSecondaryText}>Voir mes locations</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router)} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demande de location</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.statusText}>En attente de votre réponse</Text>
          </View>
          <Text style={styles.dateText}>
            {new Date(createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Pacific/Tahiti' })}
          </Text>
        </View>

        {/* Vehicle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Véhicule demandé</Text>
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleIconWrap}>
              <Ionicons name="car-sport" size={32} color="#4ECC8B" />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>{vehicleTitle}</Text>
              {vehicleCategory ? <Text style={styles.vehicleCat}>{vehicleCategory}</Text> : null}
              <Text style={styles.vehicleKm}>Kilométrage inclus : {km}</Text>
            </View>
          </View>
        </View>

        {/* Client info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations du client</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={18} color="#6B7280" />
              <Text style={styles.infoValue}>{clientName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color="#6B7280" />
              <Text style={styles.infoValue}>{clientPhone || 'Non renseigné'}</Text>
            </View>
            {clientEmail ? (
              <View style={styles.infoRow}>
                <Ionicons name="mail" size={18} color="#6B7280" />
                <Text style={styles.infoValue}>{clientEmail}</Text>
              </View>
            ) : null}
            {clientAge ? (
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={18} color="#6B7280" />
                <Text style={styles.infoValue}>{clientAge} ans</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Rental period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Période de location</Text>
          <View style={styles.periodCard}>
            <View style={styles.periodRow}>
              <View style={styles.periodDotGreen} />
              <View style={styles.periodInfo}>
                <Text style={styles.periodLabel}>Début</Text>
                <Text style={styles.periodDate}>{formatDateFull(startDate)}</Text>
                <Text style={styles.periodTime}>à {formatTime(startDate)}</Text>
              </View>
            </View>
            <View style={styles.periodLine} />
            <View style={styles.periodRow}>
              <View style={styles.periodDotRed} />
              <View style={styles.periodInfo}>
                <Text style={styles.periodLabel}>Fin</Text>
                <Text style={styles.periodDate}>{formatDateFull(endDate)}</Text>
                <Text style={styles.periodTime}>à {formatTime(endDate)}</Text>
              </View>
            </View>
            <View style={styles.durationBadge}>
              <Ionicons name="time" size={16} color="#4ECC8B" />
              <Text style={styles.durationText}>{days} jour{days > 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color="#4ECC8B" />
            <Text style={styles.locationText}>{pickupLocation}</Text>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail du prix</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Tarif journalier</Text>
              <Text style={styles.priceValue}>{formatPrice(pricePerDay)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Location ({days} jour{days > 1 ? 's' : ''})</Text>
              <Text style={styles.priceValue}>{formatPrice(subtotal)}</Text>
            </View>
            {supplements.map((s, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.priceLabel}>{s.name}</Text>
                <Text style={styles.priceValue}>{formatPrice(s.total || s.pricePerDay)}</Text>
              </View>
            ))}
            {supplementsTotal > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Total suppléments</Text>
                <Text style={styles.priceValue}>{formatPrice(supplementsTotal)}</Text>
              </View>
            )}
            <View style={styles.priceSeparator} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Caution (restituée au retour)</Text>
              <Text style={styles.priceValue}>{deposit}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Montant total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalPrice)}</Text>
            </View>
            <Text style={styles.paymentNote}>Paiement directement auprès du loueur lors de la prise en charge</Text>
          </View>
        </View>

        {/* Contract */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contrat de location</Text>
          {contractSigned ? (
            <View style={styles.signedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#166534" />
              <Text style={styles.signedBadgeText}>
                Client a signé{contractSignedVia === 'yousign' ? ' (Yousign)' : ''}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.contractBtn} onPress={openContract} activeOpacity={0.8}>
            <Ionicons name="document-text" size={22} color="#4ECC8B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.contractBtnTitle}>
                {contractLoading ? 'Chargement du contrat…' : 'Consulter le contrat signé'}
              </Text>
              <Text style={styles.contractBtnSub}>Réf. {contractRef} — {contractDate}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadPDF} activeOpacity={0.8}>
            <Ionicons name="download" size={20} color="#FFFFFF" />
            <Text style={styles.downloadBtnText}>Télécharger le contrat PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.declineBtn, isDeclining && styles.btnDisabled]}
          onPress={handleDecline}
          disabled={isDeclining || isAccepting}
        >
          <Ionicons name="close" size={22} color="#DC2626" />
          <Text style={styles.declineBtnText}>Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptBtn, isAccepting && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={isAccepting || isDeclining}
        >
          <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          <Text style={styles.acceptBtnText}>
            {isAccepting ? 'Acceptation...' : 'Accepter la réservation'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contract Modal */}
      <Modal visible={showContract} animationType="slide" onRequestClose={() => setShowContract(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }} edges={['top']}>
          <View style={styles.contractHeader}>
            <TouchableOpacity onPress={() => setShowContract(false)} style={styles.contractCloseBtn}>
              <Ionicons name="close" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.contractHeaderTitle}>Contrat de location</Text>
            <TouchableOpacity onPress={handleDownloadPDF} style={styles.contractDownloadBtn}>
              <Ionicons name="download" size={22} color="#4ECC8B" />
            </TouchableOpacity>
          </View>
          {contractLoading && !contractHtml ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#4ECC8B" />
              <Text style={{ marginTop: 12, color: '#6B7280' }}>Chargement du contrat signé…</Text>
            </View>
          ) : contractHtml ? (
            <WebView
              source={{ html: contractHtml }}
              style={{ flex: 1 }}
              scalesPageToFit={true}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={{ textAlign: 'center', color: '#6B7280', marginBottom: 16 }}>
                Impossible de charger le contrat signé.
              </Text>
              <TouchableOpacity onPress={loadSignedContract} style={styles.downloadBtn}>
                <Text style={styles.downloadBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  scroll: { flex: 1 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#D1F2E3', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  dateText: { fontSize: 11, color: '#9CA3AF' },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F8F0', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#D1F2E3',
  },
  vehicleIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#D1F2E3', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  vehicleCat: { fontSize: 12, color: '#166534', marginTop: 2 },
  vehicleKm: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  infoCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  infoValue: { fontSize: 14, color: '#1a1a1a', marginLeft: 10, fontWeight: '500' },
  periodCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  periodRow: { flexDirection: 'row', alignItems: 'flex-start' },
  periodDotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E', marginTop: 4, marginRight: 10,
  },
  periodDotRed: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#EF4444', marginTop: 4, marginRight: 10,
  },
  periodLine: {
    width: 2, height: 16, backgroundColor: '#E5E7EB',
    marginLeft: 4, marginVertical: 3,
  },
  periodInfo: { flex: 1 },
  periodLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  periodDate: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 1 },
  periodTime: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE9FE', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    marginTop: 10,
  },
  durationText: { fontSize: 12, fontWeight: '600', color: '#7C3AED', marginLeft: 5 },
  locationRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingHorizontal: 2,
  },
  locationText: { fontSize: 13, color: '#374151', marginLeft: 6, fontWeight: '500', flex: 1 },
  priceCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  priceLabel: { fontSize: 13, color: '#6B7280', flex: 1 },
  priceValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  priceSeparator: {
    height: 1, backgroundColor: '#E5E7EB', marginVertical: 6,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#4ECC8B', borderRadius: 10, padding: 12,
    marginTop: 6,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  paymentNote: { fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'center' },
  contractBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F8F0', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#D1F2E3', gap: 10,
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  signedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  contractBtnTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  contractBtnSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 12,
    marginTop: 10, gap: 6,
  },
  downloadBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, gap: 5,
  },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#22C55E', borderRadius: 10,
    paddingVertical: 12, gap: 6,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  contractHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  contractCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  contractHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  contractDownloadBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8F8F0',
    justifyContent: 'center', alignItems: 'center',
  },
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIconWrap: { marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  successSubtitle: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    marginTop: 8, lineHeight: 20,
  },
  successInfoCard: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#F3F4F6',
    marginTop: 20, width: '100%', alignItems: 'center',
  },
  successInfoLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  successInfoValue: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  successInfoSub: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  successButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#22C55E', borderRadius: 12,
    paddingVertical: 14, width: '100%', marginTop: 24, gap: 6,
  },
  successButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  successSecondaryBtn: { marginTop: 14, paddingVertical: 8 },
  successSecondaryText: { fontSize: 14, fontWeight: '600', color: '#4ECC8B' },
});
