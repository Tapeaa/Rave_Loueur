import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  getMyVehicles,
  updateVehicle,
  normalizeLoueurImageUrls,
  type LoueurVehicle,
} from '@/lib/api';
import { VehiclePhotosPicker } from '@/components/VehiclePhotosPicker';

const CATEGORY_LABELS: Record<string, string> = {
  citadine: 'Citadine',
  berline: 'Berline',
  suv: 'SUV',
  utilitaire: 'Utilitaire',
  premium: 'Premium',
  autre: 'Autres',
};

function getDefaultContractHtml(vehicleName: string, plate: string, pricePerDay: string) {
  return `
<html><head><meta charset="utf-8"/><style>
  body { font-family: Helvetica, Arial, sans-serif; padding: 30px; font-size: 13px; color: #222; line-height: 1.6; }
  h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 22px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .header-sub { text-align: center; color: #666; font-size: 12px; margin-bottom: 24px; }
  .field { color: #F5C400; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  td { padding: 6px 8px; border: 1px solid #ddd; }
  td:first-child { font-weight: 600; width: 40%; background: #f9f9f9; }
</style></head><body>
<h1>CONTRAT DE LOCATION DE VÉHICULE</h1>
<p class="header-sub">Via la plateforme RAVE</p>
<h2>Article 1 — Parties</h2>
<p><strong>Le Loueur :</strong> <span class="field">[Nom du loueur]</span></p>
<p><strong>Le Locataire :</strong> <span class="field">[Nom du client]</span></p>
<h2>Article 2 — Véhicule</h2>
<table><tr><td>Modèle</td><td>${vehicleName}</td></tr><tr><td>Immatriculation</td><td>${plate || '—'}</td></tr></table>
<h2>Article 3 — Durée et tarif</h2>
<table>
  <tr><td>Prix par jour</td><td>${pricePerDay || '—'} XPF</td></tr>
  <tr><td>Tarif longue durée (≥ 7 jours)</td><td class="field">[Si applicable]</td></tr>
  <tr><td>Caution</td><td class="field">[Montant caution]</td></tr>
</table>
<h2>Article 4 — Conditions d'utilisation</h2>
<ul>
  <li>Utiliser le véhicule conformément au Code de la Route.</li>
  <li>Ne pas sous-louer le véhicule à un tiers.</li>
  <li>Restituer le véhicule dans l'état reçu.</li>
  <li>Signaler immédiatement tout sinistre au Loueur.</li>
</ul>
<h2>Article 5 — Assurance</h2>
<p>Véhicule couvert par l'assurance du Loueur. Franchise à la charge du Locataire en cas de sinistre responsable.</p>
<h2>Article 6 — Restitution</h2>
<p>Retard non signalé = tarif majoré de 50 %. Non-restitution sous 48h = dépôt de plainte possible.</p>
<h2>Article 7 — Responsabilité</h2>
<p>Amendes et infractions à la charge du Locataire.</p>
<p style="text-align: center; color: #999; font-size: 10px; margin-top: 30px;">Contrat généré via RAVE — ${new Date().toLocaleDateString('fr-FR')}</p>
</body></html>`;
}

function getDefaultContractPlainText(vehicleName: string, plate: string, pricePerDay: string) {
  return `CONTRAT DE LOCATION DE VÉHICULE — RAVE
──────────────────────────────────
Véhicule : ${vehicleName}
Immatriculation : ${plate || '—'}
Prix / jour : ${pricePerDay || '—'} XPF

Conditions : utilisation conforme, pas de sous-location,
restitution dans l'état reçu, signalement sinistre immédiat.
Assurance loueur, franchise locataire si responsable.
Retard = +50 %. Non-restitution 48h = plainte.
──────────────────────────────────
Généré via RAVE — ${new Date().toLocaleDateString('fr-FR')}`;
}

export default function ModifierVehiculeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [vehicle, setVehicle] = useState<LoueurVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [plate, setPlate] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerDayLongTerm, setPricePerDayLongTerm] = useState('');
  const [availableForRental, setAvailableForRental] = useState(true);
  const [availableForDelivery, setAvailableForDelivery] = useState(false);
  const [availableForLongTerm, setAvailableForLongTerm] = useState(false);
  const [rentalContractMode, setRentalContractMode] = useState<'app_default' | 'custom'>('app_default');
  const [isActive, setIsActive] = useState(true);
  const [customContractText, setCustomContractText] = useState('');
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [sharingContract, setSharingContract] = useState(false);
  const [sharingCustomContract, setSharingCustomContract] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    loadVehicle();
  }, [id]);

  const loadVehicle = async () => {
    try {
      const all = await getMyVehicles();
      const found = all.find((v) => v.id === id);
      if (!found) {
        Alert.alert('Erreur', 'Véhicule introuvable', [{ text: 'OK', onPress: () => safeBack(router) }]);
        return;
      }
      setVehicle(found);
      setPlate(found.plate || '');
      setPricePerDay(found.pricePerDay?.toString() || '');
      setPricePerDayLongTerm(found.pricePerDayLongTerm?.toString() || '');
      setAvailableForRental(found.availableForRental);
      setAvailableForDelivery(found.availableForDelivery);
      setAvailableForLongTerm(found.availableForLongTerm);
      setRentalContractMode(found.rentalContractMode || 'app_default');
      setCustomContractText(found.customContractText || '');
      setIsActive(found.isActive);
      setPhotoUrls(normalizeLoueurImageUrls(found));
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de charger le véhicule');
    } finally {
      setLoading(false);
    }
  };

  const handleShareContract = async () => {
    if (!vehicle) return;
    setSharingContract(true);
    try {
      const html = getDefaultContractHtml(vehicle.modelName || 'Véhicule', plate, pricePerDay);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Contrat de location RAVE',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Share.share({
          title: 'Contrat de location RAVE',
          message: getDefaultContractPlainText(vehicle.modelName || 'Véhicule', plate, pricePerDay),
        });
      }
    } catch (e: any) {
      if (e?.message !== 'User cancelled') {
        Alert.alert('Erreur', 'Impossible de partager le contrat.');
      }
    } finally {
      setSharingContract(false);
    }
  };

  const handleSave = async () => {
    if (!vehicle) return;
    if (!pricePerDay || isNaN(Number(pricePerDay)) || Number(pricePerDay) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix par jour valide');
      return;
    }
    if (!availableForRental && !availableForDelivery && !availableForLongTerm) {
      Alert.alert('Erreur', 'Activez au moins un type de service');
      return;
    }

    setSubmitting(true);
    try {
      await updateVehicle(vehicle.id, {
        plate: plate.trim() || undefined,
        pricePerDay: Number(pricePerDay),
        pricePerDayLongTerm: pricePerDayLongTerm ? Number(pricePerDayLongTerm) : undefined,
        availableForRental,
        availableForDelivery,
        availableForLongTerm,
        customImageUrl: photoUrls[0],
        customImageUrls: photoUrls,
        rentalContractMode,
        customContractText: rentalContractMode === 'custom' ? customContractText.trim() : undefined,
        isActive,
      });
      Alert.alert('Modifications enregistrées', 'Votre véhicule a été mis à jour.', [
        { text: 'OK', onPress: () => safeBack(router) },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de modifier le véhicule');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Header title="Modifier le véhicule" onBack={() => safeBack(router)} />
        <View style={st.centered}><ActivityIndicator size="large" color="#F5C400" /></View>
      </SafeAreaView>
    );
  }

  if (!vehicle) return null;

  const contractText = getDefaultContractPlainText(vehicle.modelName || 'Véhicule', plate, pricePerDay);
  const catLabel = CATEGORY_LABELS[vehicle.modelCategory || ''] || vehicle.modelCategory || '';

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Header title="Modifier le véhicule" onBack={() => safeBack(router)} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={st.scrollPad} showsVerticalScrollIndicator={false}>

          {/* Récap modèle (non modifiable) */}
          <View style={st.recapCard}>
            <View style={st.recapIcon}>
              <Ionicons name="car-sport" size={28} color="#F5C400" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.recapName}>{vehicle.modelName || 'Véhicule'}</Text>
              <Text style={st.recapMeta}>
                {catLabel}{vehicle.modelSeats ? ` · ${vehicle.modelSeats} places` : ''}
                {vehicle.modelTransmission ? ` · ${vehicle.modelTransmission === 'auto' ? 'Auto' : 'Manuelle'}` : ''}
                {vehicle.modelFuel ? ` · ${vehicle.modelFuel}` : ''}
              </Text>
            </View>
          </View>

          {/* Statut actif/inactif */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Statut</Text>
            <SwitchRow
              icon="power-outline"
              label="Véhicule actif"
              desc="Visible par les clients quand actif"
              value={isActive}
              onChange={setIsActive}
            />
          </View>

          {/* Photos */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Photos du véhicule</Text>
            <VehiclePhotosPicker photos={photoUrls} onChange={setPhotoUrls} />
          </View>

          {/* Immatriculation */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Immatriculation</Text>
            <View style={st.field}>
              <Ionicons name="document-text-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={st.fieldInput}
                value={plate}
                onChangeText={setPlate}
                placeholder="Ex: 12345 P1"
                placeholderTextColor="#D1D5DB"
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Tarification */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Tarification</Text>
            <Text style={st.label}>Prix par jour (XPF) *</Text>
            <View style={st.field}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={st.fieldInput}
                value={pricePerDay}
                onChangeText={setPricePerDay}
                placeholder="Ex: 5500"
                placeholderTextColor="#D1D5DB"
                keyboardType="numeric"
              />
              <Text style={st.suffix}>XPF</Text>
            </View>
            <Text style={[st.label, { marginTop: 14 }]}>Prix longue durée / jour</Text>
            <View style={st.field}>
              <Ionicons name="trending-down-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={st.fieldInput}
                value={pricePerDayLongTerm}
                onChangeText={setPricePerDayLongTerm}
                placeholder="Optionnel"
                placeholderTextColor="#D1D5DB"
                keyboardType="numeric"
              />
              <Text style={st.suffix}>XPF</Text>
            </View>
            <Text style={st.hint}>Prix réduit appliqué à partir de 7 jours de location</Text>
          </View>

          {/* Services */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Services proposés</Text>
            <SwitchRow icon="car-outline" label="Location" desc="Le client récupère le véhicule" value={availableForRental} onChange={setAvailableForRental} />
            <View style={st.divider} />
            <SwitchRow icon="navigate-outline" label="Livraison" desc="Vous livrez au client" value={availableForDelivery} onChange={setAvailableForDelivery} />
            <View style={st.divider} />
            <SwitchRow icon="calendar-outline" label="Longue durée" desc="7 jours ou plus" value={availableForLongTerm} onChange={setAvailableForLongTerm} />
          </View>

          {/* Contrat */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Type de contrat</Text>

            <TouchableOpacity
              style={[st.contractCard, rentalContractMode === 'app_default' && st.contractCardOn]}
              onPress={() => setRentalContractMode('app_default')}
              activeOpacity={0.75}
            >
              <View style={[st.cardDot, rentalContractMode === 'app_default' && st.cardDotOn]}>
                {rentalContractMode === 'app_default' && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.contractTitle}>Contrat RAVE (par défaut)</Text>
                <Text style={st.contractDesc}>Contrat standard, compatible diffusion multi-loueurs</Text>
              </View>
            </TouchableOpacity>

            {rentalContractMode === 'app_default' && (
              <View style={st.contractPreviewBox}>
                <TouchableOpacity style={st.previewToggle} onPress={() => setShowContractPreview(!showContractPreview)}>
                  <Ionicons name={showContractPreview ? 'chevron-up' : 'eye-outline'} size={18} color="#6B7280" />
                  <Text style={st.previewToggleText}>{showContractPreview ? 'Masquer' : 'Voir le contrat'}</Text>
                </TouchableOpacity>

                {showContractPreview && (
                  <View style={st.contractTextBox}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                      <Text style={st.contractPlainText}>{contractText}</Text>
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  style={st.downloadBtn}
                  onPress={handleShareContract}
                  disabled={sharingContract}
                  activeOpacity={0.75}
                >
                  {sharingContract
                    ? <ActivityIndicator size="small" color="#1a1a1a" />
                    : <Ionicons name="download-outline" size={18} color="#1a1a1a" />
                  }
                  <Text style={st.downloadBtnTxt}>Télécharger le PDF</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[st.contractCard, rentalContractMode === 'custom' && st.contractCardOn]}
              onPress={() => setRentalContractMode('custom')}
              activeOpacity={0.75}
            >
              <View style={[st.cardDot, rentalContractMode === 'custom' && st.cardDotOn]}>
                {rentalContractMode === 'custom' && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.contractTitle}>Contrat personnalisé</Text>
                <Text style={st.contractDesc}>Rédigez vos propres conditions</Text>
              </View>
            </TouchableOpacity>

            {rentalContractMode === 'custom' && (
              <View style={st.customContractBox}>
                <Text style={st.customContractHint}>
                  Rédigez votre contrat personnalisé ci-dessous. Il sera présenté au client lors de la réservation.
                </Text>
                <TextInput
                  style={st.customContractInput}
                  value={customContractText}
                  onChangeText={setCustomContractText}
                  placeholder={`CONTRAT DE LOCATION — ${vehicle?.modelName || 'Véhicule'}\n\nArticle 1 — Parties\nLe Loueur : [Votre nom]\nLe Locataire : [Nom du client]\n\nArticle 2 — Véhicule\nModèle : ${vehicle?.modelName || ''}\nImmatriculation : ${plate || '[Plaque]'}\n\nArticle 3 — Tarif\nPrix par jour : ${pricePerDay || '—'} XPF\n\nArticle 4 — Conditions\n...`}
                  placeholderTextColor="#C4C4C4"
                  multiline
                  textAlignVertical="top"
                  scrollEnabled
                />
                <Text style={st.customContractCounter}>
                  {customContractText.length} caractère{customContractText.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={st.downloadBtn}
                  onPress={async () => {
                    if (!customContractText.trim()) {
                      Alert.alert('Contrat vide', 'Rédigez votre contrat avant de le télécharger.');
                      return;
                    }
                    setSharingCustomContract(true);
                    try {
                      const escaped = customContractText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
                      const html = `<html><head><meta charset="utf-8"/><style>body{font-family:Helvetica,Arial,sans-serif;padding:30px;font-size:13px;color:#222;line-height:1.7}</style></head><body>${escaped}<p style="text-align:center;color:#999;font-size:10px;margin-top:30px">Contrat personnalisé — RAVE — ${new Date().toLocaleDateString('fr-FR')}</p></body></html>`;
                      const { uri } = await Print.printToFileAsync({ html, base64: false });
                      const canShare = await Sharing.isAvailableAsync();
                      if (canShare) {
                        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Contrat personnalisé' });
                      } else {
                        await Share.share({ title: 'Contrat personnalisé', message: customContractText });
                      }
                    } catch (e: any) {
                      if (e?.message !== 'User cancelled') Alert.alert('Erreur', 'Impossible de partager.');
                    } finally {
                      setSharingCustomContract(false);
                    }
                  }}
                  disabled={sharingCustomContract}
                  activeOpacity={0.75}
                >
                  {sharingCustomContract
                    ? <ActivityIndicator size="small" color="#1a1a1a" />
                    : <Ionicons name="download-outline" size={18} color="#1a1a1a" />
                  }
                  <Text style={st.downloadBtnTxt}>Télécharger le PDF</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={st.bottomBar}>
        <SafeAreaView edges={['bottom']}>
          <TouchableOpacity
            style={[st.mainBtn, submitting && st.mainBtnOff]}
            onPress={handleSave}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? <ActivityIndicator color="#1a1a1a" /> : (
              <>
                <Ionicons name="save-outline" size={22} color="#1a1a1a" />
                <Text style={st.mainBtnTxt}>Enregistrer les modifications</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={st.header}>
      <TouchableOpacity style={st.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
      </TouchableOpacity>
      <Text style={st.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function SwitchRow({ icon, label, desc, value, onChange }: { icon: string; label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.switchRow}>
      <Ionicons name={icon as any} size={20} color="#1a1a1a" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={st.switchLabel}>{label}</Text>
        <Text style={st.switchDesc}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#E5E7EB', true: '#FDE68A' }} thumbColor={value ? '#F5C400' : '#9CA3AF'} />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollPad: { paddingBottom: 40 },

  recapCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#F5C400', gap: 14,
  },
  recapIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center',
  },
  recapName: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  recapMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  section: {
    backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },

  field: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 14, height: 48, gap: 10,
  },
  fieldInput: {
    flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },
  suffix: { fontSize: 13, color: '#9CA3AF', fontWeight: '700' },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  switchDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F3F4F6' },

  contractCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, marginBottom: 10, backgroundColor: '#FAFAFA',
  },
  contractCardOn: { borderColor: '#F5C400', backgroundColor: '#FFFBEB' },
  contractTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  contractDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  cardDotOn: { borderColor: '#F5C400', backgroundColor: '#F5C400' },

  contractPreviewBox: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  previewToggleText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  contractTextBox: {
    marginTop: 12, backgroundColor: '#fff', borderRadius: 8,
    padding: 14, borderWidth: 1, borderColor: '#E5E7EB',
  },
  contractPlainText: {
    fontSize: 12, color: '#374151', lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12, backgroundColor: '#F5C400', paddingVertical: 10, borderRadius: 10,
  },
  downloadBtnTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },

  customContractBox: {
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  customContractHint: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  customContractInput: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
    padding: 14, fontSize: 13, color: '#1a1a1a', lineHeight: 20, minHeight: 250, maxHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top' as const,
  },
  customContractCounter: { fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'right' as const },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingHorizontal: 16, paddingTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 10 },
    }),
  },
  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F5C400', paddingVertical: 14,
    paddingHorizontal: 24, borderRadius: 14, width: '100%',
  },
  mainBtnOff: { opacity: 0.6 },
  mainBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
});
