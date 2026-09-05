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
import { PricingTiersReadonly } from '@/components/PricingTiersReadonly';
import { VehicleAvailabilityBlocksEditor } from '@/components/VehicleAvailabilityBlocksEditor';
import {
  buildCustomRentalContractHtml,
  buildDefaultRentalContractHtml,
  CUSTOM_CONTRACT_HINT,
} from '@/lib/rental-contract-html';
import { WebView } from 'react-native-webview';

const CATEGORY_LABELS: Record<string, string> = {
  citadine: 'Citadine',
  berline: 'Berline',
  suv: 'SUV',
  utilitaire: 'Utilitaire',
  premium: 'Premium',
  autre: 'Autres',
};

function previewDefaultHtml(vehicleName: string, plate: string, pricePerDay: string) {
  return buildDefaultRentalContractHtml({
    ref: 'APERCU',
    contractDate: new Date().toLocaleDateString('fr-FR'),
    loueurName: '[Votre nom]',
    clientName: '[Nom du client]',
    vehicleName,
    vehicleMeta: plate ? `Immat. ${plate}` : undefined,
    startLabel: '[Date début]',
    endLabel: '[Date fin]',
    days: 3,
    pickupLocation: '[Lieu]',
    pricePerDayLabel: `${pricePerDay || '—'} XPF`,
    totalLabel: `${pricePerDay ? (Number(pricePerDay) * 3).toLocaleString('fr-FR') : '—'} XPF`,
    previewMode: true,
  });
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
  const [availableForRental, setAvailableForRental] = useState(true);
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
      setAvailableForRental(found.availableForRental);
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
      const html = previewDefaultHtml(vehicle.modelName || 'Véhicule', plate, pricePerDay);
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
          message: 'Contrat RAVE — ouvrez le PDF pour le détail formaté.',
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
    if (!availableForRental) {
      Alert.alert('Erreur', 'Activez la location pour publier ce véhicule');
      return;
    }

    setSubmitting(true);
    try {
      await updateVehicle(vehicle.id, {
        plate: plate.trim() || undefined,
        pricePerDay: Number(pricePerDay),
        availableForRental,
        availableForDelivery: false,
        availableForLongTerm: false,
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
        <View style={st.centered}><ActivityIndicator size="large" color="#4ECC8B" /></View>
      </SafeAreaView>
    );
  }

  if (!vehicle) return null;

  const contractPreviewHtml = previewDefaultHtml(vehicle.modelName || 'Véhicule', plate, pricePerDay);
  const catLabel = CATEGORY_LABELS[vehicle.modelCategory || ''] || vehicle.modelCategory || '';

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Header title="Modifier le véhicule" onBack={() => safeBack(router)} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={st.scrollPad} showsVerticalScrollIndicator={false}>

          {/* Récap modèle (non modifiable) */}
          <View style={st.recapCard}>
            <View style={st.recapIcon}>
              <Ionicons name="car-sport" size={28} color="#4ECC8B" />
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

          {/* Indisponibilités (résas hors app) */}
          <View style={st.section}>
            <VehicleAvailabilityBlocksEditor vehicleId={vehicle.id} />
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
            <Text style={st.label}>Prix de base / jour (XPF) *</Text>
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
            <PricingTiersReadonly
              tiers={vehicle?.pricingTiers}
              maxRentalDays={vehicle?.maxRentalDays}
              pricePerDay={Number(pricePerDay) || vehicle?.pricePerDay}
            />
          </View>

          {/* Services */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Services proposés</Text>
            <SwitchRow icon="car-outline" label="Location" desc="Le client récupère le véhicule" value={availableForRental} onChange={setAvailableForRental} />
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
                  <Text style={st.previewToggleText}>
                    {showContractPreview ? 'Masquer' : 'Voir le contrat (identique client)'}
                  </Text>
                </TouchableOpacity>

                {showContractPreview && (
                  <View style={[st.contractTextBox, { height: 320, padding: 0, overflow: 'hidden' }]}>
                    <WebView
                      originWhitelist={['*']}
                      source={{ html: contractPreviewHtml }}
                      style={{ flex: 1, backgroundColor: 'transparent' }}
                    />
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
                <Text style={st.contractDesc}>## titres verts · **gras** · - listes</Text>
              </View>
            </TouchableOpacity>

            {rentalContractMode === 'custom' && (
              <View style={st.customContractBox}>
                <Text style={st.customContractHint}>{CUSTOM_CONTRACT_HINT}</Text>
                <TextInput
                  style={st.customContractInput}
                  value={customContractText}
                  onChangeText={setCustomContractText}
                  placeholder={`## Article 1 — Parties\nLe Loueur : **Votre nom**\n\n## Article 2 — Conditions\n- Restituer le véhicule propre`}
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
                      const html = buildCustomRentalContractHtml({
                        ref: 'APERCU',
                        contractDate: new Date().toLocaleDateString('fr-FR'),
                        loueurName: 'Votre nom',
                        clientName: '[Client]',
                        vehicleName: vehicle?.modelName || 'Véhicule',
                        startLabel: '[Début]',
                        endLabel: '[Fin]',
                        days: 1,
                        pricePerDayLabel: `${pricePerDay || '—'} XPF`,
                        totalLabel: `${pricePerDay || '—'} XPF`,
                        customBody: customContractText,
                        isCustom: true,
                      });
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
                  <Text style={st.downloadBtnTxt}>Télécharger le PDF formaté</Text>
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
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#E5E7EB', true: '#A8E6C8' }} thumbColor={value ? '#4ECC8B' : '#9CA3AF'} />
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
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#4ECC8B', gap: 14,
  },
  recapIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center',
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
  contractCardOn: { borderColor: '#4ECC8B', backgroundColor: '#E8F8F0' },
  contractTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  contractDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  cardDotOn: { borderColor: '#4ECC8B', backgroundColor: '#4ECC8B' },

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
    gap: 8, marginTop: 12, backgroundColor: '#4ECC8B', paddingVertical: 10, borderRadius: 10,
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
    gap: 8, backgroundColor: '#4ECC8B', paddingVertical: 14,
    paddingHorizontal: 24, borderRadius: 14, width: '100%',
  },
  mainBtnOff: { opacity: 0.6 },
  mainBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
});
