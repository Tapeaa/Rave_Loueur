import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
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
import { acceptRentalOrder, declineRentalOrder } from '@/lib/api';

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

  const generateContractHTML = () => {
    const suppRows = supplements.map((s) =>
      `<tr><td>${s.name}</td><td class="r">${formatPrice(s.total || s.pricePerDay)}</td></tr>`
    ).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#f8f9fa;padding:16px}
.page{background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,.08);padding:28px 24px;max-width:600px;margin:0 auto}
.header{text-align:center;border-bottom:2px solid #4ECC8B;padding-bottom:18px;margin-bottom:20px}
.logo{font-size:28px;font-weight:900;color:#4ECC8B;letter-spacing:2px}
.logo-sub{font-size:11px;color:#9CA3AF;letter-spacing:1px;margin-top:2px}
.doc-title{font-size:17px;font-weight:700;color:#1a1a1a;margin-top:12px}
.ref{font-size:11px;color:#6B7280;margin-top:4px}
.section{margin-top:18px}
.section-title{font-size:13px;font-weight:700;color:#4ECC8B;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #F3F4F6;padding-bottom:6px;margin-bottom:10px}
.party{background:#FAFAFA;border-radius:8px;padding:12px;margin-bottom:8px}
.party-label{font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.party-name{font-size:14px;font-weight:600;color:#1a1a1a}
.party-info{font-size:12px;color:#6B7280;margin-top:2px}
.vehicle-box{background:linear-gradient(135deg,#E8F8F0,#D1F2E3);border-radius:10px;padding:14px;text-align:center;margin-bottom:8px}
.vehicle-name{font-size:16px;font-weight:800;color:#1a1a1a}
.vehicle-cat{font-size:12px;color:#166534;margin-top:2px}
.vehicle-km{font-size:11px;color:#6B7280;margin-top:4px}
.info-grid{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.info-card{flex:1;min-width:45%;background:#F9FAFB;border:1px solid #F3F4F6;border-radius:8px;padding:10px}
.info-label{font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase}
.info-value{font-size:13px;font-weight:600;color:#1a1a1a;margin-top:2px}
table{width:100%;border-collapse:collapse;margin:8px 0}
table td{padding:6px 0;font-size:12px;border-bottom:1px solid #F3F4F6}
table .r{text-align:right;font-weight:600}
.total-row{background:#4ECC8B;border-radius:8px;padding:12px;display:flex;justify-content:space-between;margin:10px 0}
.total-label{font-size:14px;font-weight:700;color:#1a1a1a}
.total-val{font-size:16px;font-weight:800;color:#1a1a1a}
.article{font-size:12px;color:#374151;line-height:1.6;margin-bottom:6px}
ul{padding-left:16px;margin:6px 0}
li{font-size:12px;color:#374151;margin-bottom:3px;line-height:1.5}
.footer{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid #F3F4F6}
.footer-text{font-size:10px;color:#9CA3AF}
</style></head><body><div class="page">
<div class="header">
  <div class="logo">RAVE</div>
  <div class="logo-sub">LOCATION DE VÉHICULES — POLYNÉSIE FRANÇAISE</div>
  <div class="doc-title">Contrat de location de véhicule</div>
  <div class="ref">Réf. ${contractRef} — ${contractDate}</div>
</div>

<div class="section">
  <div class="section-title">Parties contractantes</div>
  <div class="party">
    <div class="party-label">Le loueur (professionnel)</div>
    <div class="party-name">${ownerName}</div>
    <div class="party-info">Location de véhicules — Plateforme RAVE</div>
  </div>
  <div class="party">
    <div class="party-label">Le locataire (client)</div>
    <div class="party-name">${clientName}</div>
    <div class="party-info">${clientPhone}${clientEmail ? ` — ${clientEmail}` : ''}${clientAge ? ` — ${clientAge} ans` : ''}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Véhicule</div>
  <div class="vehicle-box">
    <div class="vehicle-name">${vehicleTitle}</div>
    <div class="vehicle-cat">${vehicleCategory}</div>
    <div class="vehicle-km">Kilométrage inclus : ${km}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Période de location</div>
  <div class="info-grid">
    <div class="info-card"><div class="info-label">Début</div><div class="info-value">${formatDateFull(startDate)} à ${formatTime(startDate)}</div></div>
    <div class="info-card"><div class="info-label">Fin</div><div class="info-value">${formatDateFull(endDate)} à ${formatTime(endDate)}</div></div>
    <div class="info-card"><div class="info-label">Durée</div><div class="info-value">${days} jour${days > 1 ? 's' : ''}</div></div>
    <div class="info-card"><div class="info-label">Lieu de prise en charge</div><div class="info-value">${pickupLocation}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Conditions financières</div>
  <table>
    <tr><td>Tarif journalier</td><td class="r">${formatPrice(pricePerDay)}</td></tr>
    <tr><td>Location (${days} jour${days > 1 ? 's' : ''})</td><td class="r">${formatPrice(subtotal)}</td></tr>
    ${suppRows}
    <tr><td>Caution (restituée au retour)</td><td class="r">${deposit}</td></tr>
  </table>
  <div class="total-row">
    <span class="total-label">Montant total</span>
    <span class="total-val">${formatPrice(totalPrice)}</span>
  </div>
  <div class="article">Paiement directement auprès du loueur. Aucun paiement en ligne.</div>
</div>

<div class="section">
  <div class="section-title">Obligations du locataire</div>
  <ul>
    <li>Utiliser le véhicule conformément au Code de la route de Polynésie française</li>
    <li>Ne pas sous-louer ni prêter le véhicule à un tiers non déclaré</li>
    <li>Restituer le véhicule dans son état initial (usure normale acceptée)</li>
    <li>Signaler immédiatement tout sinistre, accident ou panne</li>
    <li>Être titulaire d'un permis de conduire en cours de validité</li>
  </ul>
</div>

<div class="section">
  <div class="section-title">Obligations du loueur</div>
  <ul>
    <li>Mettre à disposition un véhicule en bon état et conforme au descriptif</li>
    <li>Fournir les documents du véhicule (carte grise, assurance)</li>
    <li>Restituer la caution dans un délai raisonnable après le retour</li>
  </ul>
</div>

<div class="section">
  <div class="section-title">Assurance & responsabilité</div>
  <div class="article">Le véhicule est couvert par l'assurance du Professionnel. En cas de sinistre imputable au Client, une franchise pourra être retenue sur la caution.</div>
</div>

<div class="section">
  <div class="section-title">Annulation</div>
  <div class="article">Toute annulation doit être signalée dans les meilleurs délais. Les conditions et frais d'annulation sont définis par le Professionnel.</div>
</div>

<div class="section">
  <div class="section-title">Droit applicable</div>
  <div class="article">Contrat soumis au droit applicable en Polynésie française. Tout litige sera porté devant les juridictions compétentes de Papeete.</div>
</div>

<div class="footer">
  <div class="footer-text">RAVE — Plateforme de location de véhicules — Polynésie française</div>
  <div class="footer-text">Document généré le ${contractDate} — Réf. ${contractRef}</div>
</div>
</div></body></html>`;
  };

  const handleDownloadPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateContractHTML(), base64: false });
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
          <TouchableOpacity style={styles.contractBtn} onPress={() => setShowContract(true)} activeOpacity={0.8}>
            <Ionicons name="document-text" size={22} color="#4ECC8B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.contractBtnTitle}>Consulter le contrat</Text>
              <Text style={styles.contractBtnSub}>Réf. {contractRef}</Text>
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
          <WebView
            source={{ html: generateContractHTML() }}
            style={{ flex: 1 }}
            scalesPageToFit={true}
          />
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
