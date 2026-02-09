import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { apiFetch, getDriverSessionId } from '@/lib/api';
import type { Order } from '@/lib/types';

const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'En attente', color: '#F59E0B', icon: 'time' },
  accepted: { label: 'Acceptée', color: '#3B82F6', icon: 'checkmark-circle' },
  booked: { label: 'Réservée', color: '#8B5CF6', icon: 'calendar' },  // ═══ RÉSERVATION À L'AVANCE ═══
  driver_enroute: { label: 'En route vers client', color: '#3B82F6', icon: 'car' },
  driver_arrived: { label: 'Arrivé chez client', color: '#8B5CF6', icon: 'location' },
  in_progress: { label: 'Course en cours', color: '#10B981', icon: 'navigate' },
  completed: { label: 'Terminée', color: '#22C55E', icon: 'checkmark-done-circle' },
  cancelled: { label: 'Annulée', color: '#EF4444', icon: 'close-circle' },
  expired: { label: 'Expirée', color: '#6B7280', icon: 'timer' },
  payment_pending: { label: 'Paiement en attente', color: '#F59E0B', icon: 'card' },
  payment_confirmed: { label: 'Payée', color: '#22C55E', icon: 'checkmark-circle' },
  payment_failed: { label: 'Paiement échoué', color: '#EF4444', icon: 'card' },
};

export default function CourseDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tarifs, setTarifs] = useState<any[]>([]);
  const [startingBooking, setStartingBooking] = useState(false);  // ═══ RÉSERVATION À L'AVANCE ═══
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setError('ID de course manquant');
        setLoading(false);
        return;
      }

      try {
        const sessionId = await getDriverSessionId();
        // Charger les tarifs en parallèle
        const [orderData, tarifsData] = await Promise.all([
          apiFetch<Order>(`/api/orders/${id}`, {
            headers: {
              'X-Driver-Session': sessionId || '',
            },
          }),
          apiFetch<any[]>(`/api/tarifs`).catch(() => []) // Si erreur, retourner tableau vide
        ]);
        
        setOrder(orderData);
        setTarifs(tarifsData || []);
      } catch (err) {
        console.error('[CourseDetails] Error loading order:', err);
        setError('Impossible de charger les détails de la course');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Démarrer une course réservée
  // ═══════════════════════════════════════════════════════════════════════════
  const handleStartBooking = async () => {
    if (!order || startingBooking) return;
    
    setStartingBooking(true);
    try {
      const sessionId = await getDriverSessionId();
      await apiFetch(`/api/orders/${order.id}/start-booking`, {
        method: 'POST',
        headers: {
          'X-Driver-Session': sessionId || '',
        },
      });
      
      router.push({
        pathname: '/(chauffeur)/course-en-cours',
        params: { orderId: order.id },
      });
    } catch (err) {
      console.error('[CourseDetails] Error starting booking:', err);
      // On pourrait afficher une alerte ici
    } finally {
      setStartingBooking(false);
    }
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

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}min` : ''}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Fonction pour obtenir le tarif kilométrique selon l'heure de la commande
  const getPricePerKmForOrder = (orderCreatedAt: string): { price: number; period: 'jour' | 'nuit' } => {
    if (!orderCreatedAt) {
      // Fallback : utiliser rideOption.pricePerKm ou défaut
      const fallbackPrice = order?.rideOption?.pricePerKm || 150;
      return { price: fallbackPrice, period: 'jour' };
    }
    
    const orderDate = new Date(orderCreatedAt);
    const orderHour = orderDate.getHours();
    const orderMinutes = orderHour * 60 + orderDate.getMinutes();
    
    // Chercher le tarif kilométrique approprié
    // kilometre_jour : généralement 6h-18h (150 XPF)
    // kilometre_nuit : généralement 18h-6h (260 XPF)
    const kilometreTarifs = tarifs.filter(t => 
      t.typeTarif === 'kilometre_jour' || t.typeTarif === 'kilometre_nuit'
    );
    
    // Trouver le tarif qui correspond à l'heure de la commande
    for (const tarif of kilometreTarifs) {
      if (tarif.heureDebut && tarif.heureFin) {
        // Parser les heures (format HH:MM)
        const [debutH, debutM] = tarif.heureDebut.split(':').map(Number);
        const [finH, finM] = tarif.heureFin.split(':').map(Number);
        const debutMinutes = debutH * 60 + (debutM || 0);
        const finMinutes = finH * 60 + (finM || 0);
        
        // Gérer le cas où la plage horaire traverse minuit (ex: 18h-6h)
        let isInRange = false;
        if (debutMinutes <= finMinutes) {
          // Plage normale (ex: 6h-18h)
          isInRange = orderMinutes >= debutMinutes && orderMinutes < finMinutes;
        } else {
          // Plage qui traverse minuit (ex: 18h-6h)
          isInRange = orderMinutes >= debutMinutes || orderMinutes < finMinutes;
        }
        
        if (isInRange) {
          const period = tarif.typeTarif === 'kilometre_jour' ? 'jour' : 'nuit';
          console.log(`[CourseDetails] Tarif trouvé: ${tarif.typeTarif} (${tarif.heureDebut}-${tarif.heureFin}) = ${tarif.prixXpf} XPF pour commande à ${orderHour}h${orderDate.getMinutes()}`);
          return { price: tarif.prixXpf, period };
        }
      } else {
        // Si pas de plage horaire, utiliser le type pour déterminer
        // Par défaut : jour = 6h-18h, nuit = 18h-6h
        if (tarif.typeTarif === 'kilometre_jour' && orderHour >= 6 && orderHour < 18) {
          console.log(`[CourseDetails] Tarif jour trouvé (sans plage): ${tarif.prixXpf} XPF`);
          return { price: tarif.prixXpf, period: 'jour' };
        }
        if (tarif.typeTarif === 'kilometre_nuit' && (orderHour >= 18 || orderHour < 6)) {
          console.log(`[CourseDetails] Tarif nuit trouvé (sans plage): ${tarif.prixXpf} XPF`);
          return { price: tarif.prixXpf, period: 'nuit' };
        }
      }
    }
    
    // Fallback : utiliser rideOption.pricePerKm ou défaut selon l'heure
    const isNight = orderHour >= 18 || orderHour < 6;
    const fallbackPrice = order?.rideOption?.pricePerKm || (isNight ? 260 : 150);
    console.log(`[CourseDetails] Aucun tarif trouvé, utilisation du fallback: ${fallbackPrice} XPF`);
    return { price: fallbackPrice, period: isNight ? 'nuit' : 'jour' };
  };

  // Fonction pour obtenir la prise en charge (toujours 1000 XPF)
  const getBasePrice = (): number => {
    // Chercher le tarif de prise en charge
    const priseEnCharge = tarifs.find(t => t.typeTarif === 'prise_en_charge');
    if (priseEnCharge) {
      return priseEnCharge.prixXpf;
    }
    // Défaut : 1000 XPF
    return 1000;
  };

  // Télécharger le contrat de location en HTML (partageable/imprimable en PDF)
  const handleDownloadContract = async () => {
    if (!order) return;
    setIsDownloadingPdf(true);
    try {
      let FileSystem: any;
      let Sharing: any;
      try { FileSystem = require('expo-file-system/legacy'); } catch { FileSystem = require('expo-file-system'); }
      Sharing = require('expo-sharing');

      const rideOpt = order.rideOption as any;
      const rd = rideOpt?.rentalData;
      const clientName = order.clientName || 'Client';
      const loueurName = (order as any).driverName || 'Loueur';
      const signatureSvg = rideOpt?.clientSignatureSvg || '';
      const signedAt = rideOpt?.clientSignedAt;
      const sigName = rideOpt?.clientSignatureName || clientName;
      const todayStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      const signedDate = signedAt ? new Date(signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : todayStr;
      const signedTime = signedAt ? new Date(signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const totalPrice = order.totalPrice || 0;
      const pricePerDay = rd?.pricePerDay || 0;
      const days = rd?.days || 0;

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrat RAVE</title>
<style>
@page{size:A4;margin:20mm}body{font-family:Helvetica,Arial,sans-serif;padding:40px;color:#1a1a1a;font-size:13px;line-height:1.6;max-width:800px;margin:0 auto}
.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #171717;padding-bottom:20px}.header h1{font-size:22px;margin:0 0 4px;letter-spacing:1px}.header h2{font-size:16px;font-weight:400;color:#6B7280;margin:0 0 12px}.header .date{font-size:12px;color:#9CA3AF}.header .ref{font-size:11px;color:#9CA3AF;margin-top:4px}
h3{font-size:14px;margin-top:24px;margin-bottom:8px;color:#171717;border-bottom:1px solid #E5E7EB;padding-bottom:4px}p{margin:0 0 12px;color:#374151}
.details-box{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:12px 0}table{width:100%;border-collapse:collapse}table td{padding:6px 0}table td:first-child{color:#6B7280;width:45%}table td:last-child{font-weight:500;text-align:right}
.signatures{display:flex;justify-content:space-between;margin-top:40px;border-top:2px solid #171717;padding-top:20px}.sig-box{width:45%;text-align:center}.sig-label{font-size:12px;color:#6B7280;margin-bottom:8px}.sig-name{font-size:14px;font-weight:600;margin-bottom:8px}
.sig-image{border:1px dashed #D1D5DB;border-radius:8px;padding:10px;min-height:80px;display:flex;align-items:center;justify-content:center;background:#FAFAFA}.sig-image svg{max-width:100%;height:auto}.signed-info{font-size:10px;color:#22C55E;margin-top:6px}.pending{font-size:11px;color:#F59E0B;font-style:italic}
.footer{text-align:center;margin-top:40px;padding-top:16px;border-top:1px solid #E5E7EB;font-size:10px;color:#9CA3AF}
.print-hint{text-align:center;padding:12px;background:#EFF6FF;border-radius:8px;margin-bottom:20px;font-size:11px;color:#1D4ED8}@media print{.print-hint{display:none}}
</style></head><body>
<div class="print-hint">Pour enregistrer en PDF : Partager → Imprimer → Enregistrer en PDF</div>
<div class="header"><h1>CONTRAT DE LOCATION</h1><h2>DE VÉHICULE</h2><div class="date">En date du ${signedDate}</div><div class="ref">Réf. ${order.id.substring(0, 8).toUpperCase()}</div></div>
<h3>Article 1 - Objet du contrat</h3><p>Le présent contrat a pour objet la mise à disposition d'un véhicule de location par le loueur au locataire, via la plateforme RAVE.</p>
<h3>Article 2 - Détails de la réservation</h3><div class="details-box"><table>
<tr><td>Véhicule</td><td>${rd?.vehicleName || 'N/A'}</td></tr>
<tr><td>Catégorie</td><td style="text-transform:capitalize">${rd?.vehicleCategory || 'N/A'}</td></tr>
<tr><td>Prise en charge</td><td>${rd?.startDate ? new Date(rd.startDate).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : 'N/A'}</td></tr>
<tr><td>Retour</td><td>${rd?.endDate ? new Date(rd.endDate).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : 'N/A'}</td></tr>
<tr><td>Durée</td><td>${days} jour${days > 1 ? 's' : ''}</td></tr>
<tr><td>Montant total</td><td style="font-weight:700">${totalPrice.toLocaleString()} XPF</td></tr>
${rd?.pickupAddress ? `<tr><td>Adresse de livraison</td><td>${rd.pickupAddress}</td></tr>` : ''}
</table></div>
<h3>Article 3 - Conditions de location</h3><p>Le locataire s'engage à :<br>• Être titulaire d'un permis de conduire valide<br>• Utiliser le véhicule avec soin et prudence<br>• Restituer le véhicule dans l'état où il l'a reçu<br>• Respecter le code de la route en vigueur<br>• Ne pas sous-louer le véhicule à un tiers</p>
<h3>Article 4 - Tarification et paiement</h3><p>Le prix de la location est de ${totalPrice.toLocaleString()} XPF pour ${days} jour${days > 1 ? 's' : ''}, soit ${pricePerDay.toLocaleString()} XPF par jour.</p>
<h3>Article 5 - Assurance</h3><p>Le véhicule est couvert par l'assurance du loueur. Le locataire reste responsable de toute infraction commise pendant la durée de la location.</p>
<h3>Article 6 - État des lieux</h3><p>Un état des lieux sera effectué au moment de la prise en charge et de la restitution du véhicule.</p>
<h3>Article 7 - Annulation</h3><p>Les conditions d'annulation sont définies par la politique de la plateforme RAVE.</p>
<div class="signatures"><div class="sig-box"><div class="sig-label">Le locataire</div><div class="sig-name">${sigName}</div>${signatureSvg ? `<div class="sig-image">${signatureSvg}</div><div class="signed-info">✓ Signé le ${signedDate}${signedTime ? ' à ' + signedTime : ''}</div>` : `<div class="sig-image"><span class="pending">Non signé</span></div>`}</div>
<div class="sig-box"><div class="sig-label">Le loueur</div><div class="sig-name">${loueurName}</div><div class="sig-image"><span class="pending">En attente</span></div></div></div>
<div class="footer">Document généré par RAVE • Plateforme de location de véhicules</div>
</body></html>`;

      const ref = order.id.substring(0, 8).toUpperCase();
      const fileUri = `${FileSystem.documentDirectory}contrat-location-${ref}.html`;
      await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/html', dialogTitle: 'Contrat de location RAVE' });
      } else {
        Alert.alert('Contrat généré', 'Le partage n\'est pas disponible sur cet appareil.');
      }
    } catch (err: any) {
      console.error('[PDF] Error:', err);
      Alert.alert('Erreur', 'Impossible de générer le contrat.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text variant="h2">Détails de la course</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C400" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text variant="h2">Détails de la course</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>{error || 'Course introuvable'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = statusLabels[order.status] || { label: order.status, color: '#6B7280', icon: 'help-circle' };
  const pickup = order.addresses.find((a) => a.type === 'pickup');
  const destination = order.addresses.find((a) => a.type === 'destination');
  const stops = order.addresses.filter((a) => a.type === 'stop');

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Vérifier si c'est une réservation
  // ═══════════════════════════════════════════════════════════════════════════
  const isBooked = order.status === 'booked';

  // Calcul des gains chauffeur (80% du prix total par exemple)
  const driverEarnings = order.driverEarnings || Math.round(order.totalPrice * 0.8);
  const commission = order.totalPrice - driverEarnings;

  // ═══ DÉTECTION COMMANDE DE LOCATION ═══
  const isRentalOrder = (order.rideOption as any)?.isRentalOrder === true;
  const rentalData = (order.rideOption as any)?.rentalData;
  const rideOpt = order.rideOption as any;
  const hasClientSignature = !!rideOpt?.clientSignatureSvg;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h2">{isRentalOrder ? 'Détails de la location' : 'Détails de la course'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statut et Date */}
        <Card style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
            <Ionicons name={isRentalOrder ? 'key' : (status.icon as any)} size={24} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {isRentalOrder ? (hasClientSignature ? 'Contrat signé' : status.label) : status.label}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.timeText}>à {formatTime(order.createdAt)}</Text>
        </Card>

        {isRentalOrder && rentalData ? (
          <>
            {/* ═══ CONTENU SPÉCIFIQUE LOCATION ═══ */}

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
              {rentalData.serviceType && (
                <View style={[styles.passengerInfo, { borderTopColor: '#F3F4F6' }]}>
                  <Ionicons 
                    name={rentalData.serviceType === 'livraison' ? 'navigate' : rentalData.serviceType === 'longterme' ? 'time' : 'key'} 
                    size={20} color="#6B7280" 
                  />
                  <Text style={styles.passengerText}>
                    {rentalData.serviceType === 'livraison' ? 'Avec livraison' : 
                     rentalData.serviceType === 'longterme' ? 'Location longue durée' : 
                     'Location standard'}
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

            {/* Adresse de livraison si applicable */}
            {rentalData.pickupAddress && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Adresse de livraison</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Ionicons name="location" size={20} color="#22C55E" style={{ marginTop: 2 }} />
                  <Text style={[styles.addressValue, { marginLeft: 10, flex: 1 }]}>
                    {rentalData.pickupAddress}
                  </Text>
                </View>
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
              <View style={styles.priceDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(order.totalPrice)}</Text>
              </View>
            </Card>

            {/* Moyen de paiement */}
            {order.paymentMethod && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Paiement</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="card-outline" size={20} color="#6B7280" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Moyen de paiement</Text>
                    <Text style={styles.infoValue}>
                      {order.paymentMethod === 'card' ? 'Carte bancaire (TPE)' : 
                       order.paymentMethod === 'cash' ? 'Espèces' :
                       order.paymentMethod === 'virement' ? 'Virement bancaire' : order.paymentMethod}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* ═══ CONTRAT DE LOCATION & SIGNATURE ═══ */}
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
                  </View>
                </View>
              ) : (
                <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="time" size={20} color="#F59E0B" />
                  <Text style={{ fontSize: 14, color: '#92400E', marginLeft: 8, fontWeight: '500' }}>
                    En attente de signature du client
                  </Text>
                </View>
              )}

              {/* ═══ BOUTON TÉLÉCHARGER LE CONTRAT ═══ */}
              {hasClientSignature && (
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
                  onPress={handleDownloadContract}
                  disabled={isDownloadingPdf}
                >
                  {isDownloadingPdf ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                  )}
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
                    {isDownloadingPdf ? 'Génération...' : 'Télécharger le contrat'}
                  </Text>
                </TouchableOpacity>
              )}
            </Card>

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
        ) : (
          <>
            {/* ═══ CONTENU TAXI CLASSIQUE ═══ */}

            {/* Gains */}
            <Card style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>
                {isBooked ? 'Gains estimés pour cette réservation' : 'Vos gains pour cette course'}
              </Text>
              <Text style={styles.earningsValue}>{formatPrice(driverEarnings)}</Text>
              <View style={styles.earningsDetails}>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsDetailLabel}>
                    {isBooked ? 'Prix estimé client' : 'Prix client'}
                  </Text>
                  <Text style={styles.earningsDetailValue}>{formatPrice(order.totalPrice)}</Text>
                </View>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsDetailLabel}>Commission TAPEA</Text>
                  <Text style={styles.earningsDetailValue}>-{formatPrice(commission)}</Text>
                </View>
              </View>
            </Card>

            {/* Client */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Client</Text>
              <View style={styles.clientInfo}>
                <View style={styles.clientAvatar}>
                  <Ionicons name="person" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>{order.clientName || 'Client TAPEA'}</Text>
                  {order.clientPhone && (
                    <View style={styles.clientPhone}>
                      <Ionicons name="call-outline" size={14} color="#6B7280" />
                      <Text style={styles.clientPhoneText}>{order.clientPhone}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>

            {/* Trajet */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Trajet effectué</Text>
              
              <View style={styles.addressContainer}>
                {/* Départ */}
                <View style={styles.addressRow}>
                  <View style={styles.addressIconContainer}>
                    <View style={[styles.addressDot, { backgroundColor: '#22C55E' }]} />
                  </View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Prise en charge</Text>
                    <Text style={styles.addressValue}>{pickup?.value || 'Non spécifié'}</Text>
                  </View>
                </View>

                {/* Ligne de connexion */}
                <View style={styles.connectionLine} />

                {/* Arrêts intermédiaires */}
                {stops.map((stop, index) => (
                  <View key={`stop-${index}`}>
                    <View style={styles.addressRow}>
                      <View style={styles.addressIconContainer}>
                        <View style={[styles.addressDot, { backgroundColor: '#F59E0B' }]}>
                          <Text style={styles.stopNumber}>{index + 1}</Text>
                        </View>
                      </View>
                      <View style={styles.addressContent}>
                        <Text style={styles.addressLabel}>Arrêt {index + 1}</Text>
                        <Text style={styles.addressValue}>{stop.value || 'Non spécifié'}</Text>
                      </View>
                    </View>
                    <View style={styles.connectionLine} />
                  </View>
                ))}

                {/* Arrivée */}
                <View style={styles.addressRow}>
                  <View style={styles.addressIconContainer}>
                    <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                  </View>
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>Destination</Text>
                    <Text style={styles.addressValue}>{destination?.value || 'Non spécifié'}</Text>
                  </View>
                </View>
              </View>

              {/* Infos trajet */}
              <View style={styles.tripInfo}>
                <View style={styles.tripInfoItem}>
                  <Ionicons name="time-outline" size={20} color="#6B7280" />
                  <Text style={styles.tripInfoText}>
                    {order.estimatedDuration ? formatDuration(order.estimatedDuration) : 'N/A'}
                  </Text>
                </View>
                <View style={styles.tripInfoDivider} />
                <View style={styles.tripInfoItem}>
                  <Ionicons name="navigate-outline" size={20} color="#6B7280" />
                  <Text style={styles.tripInfoText}>
                    {order.estimatedDistance ? formatDistance(order.estimatedDistance) : 'N/A'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Type de service */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Service effectué</Text>
              <View style={styles.serviceInfo}>
                <View style={styles.serviceIcon}>
                  <Ionicons name="car" size={24} color="#F5C400" />
                </View>
                <View style={styles.serviceDetails}>
                  <Text style={styles.serviceName}>{order.rideOption.title}</Text>
                  <Text style={styles.serviceDescription}>
                    {order.rideOption.description || 'Service de transport TAPEA'}
                  </Text>
                </View>
              </View>
              
              {order.passengers && (
                <View style={styles.passengerInfo}>
                  <Ionicons name="people-outline" size={20} color="#6B7280" />
                  <Text style={styles.passengerText}>
                    {order.passengers} passager{order.passengers > 1 ? 's' : ''} transporté{order.passengers > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Card>

            {/* Options et suppléments */}
            {order.supplements && order.supplements.length > 0 && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Options facturées</Text>
                {order.supplements.map((supplement, index) => (
                  <View key={index} style={styles.supplementRow}>
                    <View style={styles.supplementInfo}>
                      <Ionicons name="add-circle-outline" size={18} color="#6B7280" />
                      <Text style={styles.supplementName}>{supplement.name}</Text>
                    </View>
                    <Text style={styles.supplementPrice}>
                      +{formatPrice(supplement.price * (supplement.quantity || 1))}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Récapitulatif financier */}
            <Card style={styles.priceCard}>
              <Text style={styles.sectionTitle}>Récapitulatif</Text>
              
              {/* Calcul de la décomposition du prix */}
              {(() => {
                // Prise en charge (toujours 1000 XPF depuis les tarifs)
                const basePrice = getBasePrice();
                
                // Distance × tarif kilométrique selon l'heure de la commande
                const distance = order.routeInfo?.distance ? parseFloat(String(order.routeInfo.distance)) : 0;
                const { price: pricePerKm, period: pricePeriod } = getPricePerKmForOrder(order.createdAt);
                const distancePrice = distance * pricePerKm;
                
                // Suppléments
                const supplementsTotal = order.supplements?.reduce((acc, s) => acc + (s.price * (s.quantity || 1)), 0) || 0;
                
                // Majoration passagers (500 XPF si >= 5 passagers)
                const passengers = order.passengers || 1;
                const majorationPassagers = passengers >= 5 ? 500 : 0;
                
                const isBookedLocal = order.status === 'booked';
                
                // Temps d'attente (42 XPF par minute après 5 min gratuites) - seulement si course commencée
                const waitingTime = isBookedLocal ? 0 : (order.waitingTimeMinutes || 0);
                const waitingFee = isBookedLocal ? 0 : (waitingTime > 5 ? (waitingTime - 5) * 42 : 0);
                
                // Prix calculé
                const calculatedBase = basePrice + distancePrice + supplementsTotal + majorationPassagers + waitingFee;
                
                // Arrêts payants
                const totalPrice = order.totalPrice || 0;
                const paidStopsFee = isBookedLocal ? 0 : Math.max(0, totalPrice - calculatedBase);
                
                return (
                  <>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Prise en charge</Text>
                      <Text style={styles.priceValue}>{formatPrice(basePrice)}</Text>
                    </View>
                    
                    {distance > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>
                          {distance.toFixed(1)} km × {formatPrice(pricePerKm)} ({pricePeriod})
                        </Text>
                        <View style={styles.priceValueContainer}>
                          <Text style={styles.priceValue}>{formatPrice(distancePrice)}</Text>
                        </View>
                      </View>
                    )}
                    
                    {majorationPassagers > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Majoration passagers (≥5)</Text>
                        <Text style={styles.priceValue}>{formatPrice(majorationPassagers)}</Text>
                      </View>
                    )}
                    
                    {supplementsTotal > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Suppléments</Text>
                        <Text style={styles.priceValue}>{formatPrice(supplementsTotal)}</Text>
                      </View>
                    )}
                    
                    {!isBookedLocal && waitingFee > 0 && (
                      <View style={styles.priceRow}>
                        <View style={styles.priceLabelContainer}>
                          <Ionicons name="time-outline" size={16} color="#F59E0B" style={styles.waitingIcon} />
                          <View style={styles.priceLabelTextContainer}>
                            <Text style={styles.priceLabel}>
                              Temps d'attente ({waitingTime - 5} min)
                            </Text>
                            <Text style={styles.priceSubLabel}>
                              42 XPF/min après 5 min gratuites
                            </Text>
                          </View>
                        </View>
                        <View style={styles.priceValueContainer}>
                          <Text style={[styles.priceValue, styles.waitingFee]}>+{formatPrice(waitingFee)}</Text>
                        </View>
                      </View>
                    )}
                    
                    {!isBookedLocal && paidStopsFee > 0 && (
                      <View style={styles.priceRow}>
                        <View style={styles.priceLabelContainer}>
                          <Ionicons name="pause-circle" size={16} color="#EF4444" style={styles.waitingIcon} />
                          <View style={styles.priceLabelTextContainer}>
                            <Text style={styles.priceLabel}>
                              Arrêts payants
                            </Text>
                            <Text style={styles.priceSubLabel}>
                              42 XPF/min pendant la course
                            </Text>
                          </View>
                        </View>
                        <View style={styles.priceValueContainer}>
                          <Text style={[styles.priceValue, { color: '#EF4444' }]}>+{formatPrice(paidStopsFee)}</Text>
                        </View>
                      </View>
                    )}
                    
                    <View style={styles.priceDivider} />
                    
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>
                        {isBookedLocal ? 'Prix estimé' : 'Total client'}
                      </Text>
                      <Text style={styles.priceValue}>{formatPrice(order.totalPrice)}</Text>
                    </View>
                    
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Commission TAPEA</Text>
                      <Text style={[styles.priceValue, { color: '#EF4444' }]}>-{formatPrice(commission)}</Text>
                    </View>
                    
                    <View style={styles.priceDivider} />
                    
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>
                        {isBookedLocal ? 'Gains estimés' : 'Vos gains nets'}
                      </Text>
                      <Text style={styles.totalValue}>{formatPrice(driverEarnings)}</Text>
                    </View>
                  </>
                );
              })()}
            </Card>

            {/* Informations supplémentaires */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="receipt-outline" size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Référence course</Text>
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
              
              {order.completedAt && (
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#6B7280" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Fin de course</Text>
                    <Text style={styles.infoValue}>{formatDate(order.completedAt)} à {formatTime(order.completedAt)}</Text>
                  </View>
                </View>
              )}

              {order.paymentMethod && (
                <View style={styles.infoRow}>
                  <Ionicons name="card-outline" size={20} color="#6B7280" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Paiement reçu</Text>
                    <Text style={styles.infoValue}>
                      {order.paymentMethod === 'card' ? 'Par carte (TPE)' : 
                       order.paymentMethod === 'cash' ? 'En espèces' : order.paymentMethod}
                    </Text>
                  </View>
                </View>
              )}
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
              <Text style={styles.messagesButtonText}>Voir les messages</Text>
            </TouchableOpacity>

            {/* RÉSERVATION À L'AVANCE: Bouton pour démarrer la course */}
            {order.status === 'booked' && (
              <TouchableOpacity
                style={[styles.startBookingButton, startingBooking && styles.startBookingButtonDisabled]}
                onPress={() => {
                  Alert.alert(
                    'Commencer la course',
                    'Êtes-vous sûr de vouloir commencer cette course réservée maintenant ?',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Commencer', onPress: handleStartBooking },
                    ]
                  );
                }}
                disabled={startingBooking}
              >
                {startingBooking ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="car" size={22} color="#FFFFFF" />
                    <Text style={styles.startBookingButtonText}>Commencer la course</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#F5C400',
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
  earningsDetails: {
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#22C55E20',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  earningsDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  earningsDetailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
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
  addressContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconContainer: {
    width: 24,
    alignItems: 'center',
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumber: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  connectionLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E5E5',
    marginLeft: 11,
    marginVertical: 4,
  },
  addressContent: {
    flex: 1,
    marginLeft: 12,
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
  tripInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripInfoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontWeight: '500',
  },
  tripInfoDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 20,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
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
  priceLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  priceLabelTextContainer: {
    flex: 1,
  },
  priceSubLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 14,
  },
  waitingIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  waitingFee: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  priceValueContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
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
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Styles pour le bouton de démarrage
  // ═══════════════════════════════════════════════════════════════════════════
  startBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startBookingButtonDisabled: {
    opacity: 0.7,
  },
  startBookingButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  bottomSpacer: {
    height: 24,
  },
  // ═══ STYLES LOCATION ═══
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
