import { useState, useEffect, useMemo, useRef } from 'react';
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
  Modal,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  getVehicleModels,
  getMyVehicles,
  addVehicle,
  type VehicleModel,
  type CreateVehicleData,
} from '@/lib/api';
import {
  TAHITI_VEHICLE_MODELS,
  mergeVehicleModels,
  listBrands,
  extractBrand,
} from '@/lib/vehicle-models-tahiti';
import { VehiclePhotosPicker } from '@/components/VehiclePhotosPicker';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Toutes',
  citadine: 'Citadine',
  berline: 'Berline',
  suv: 'SUV',
  pickup: 'Pick-up',
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
  .field { color: #4ECC8B; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  td { padding: 6px 8px; border: 1px solid #ddd; }
  td:first-child { font-weight: 600; width: 40%; background: #f9f9f9; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 45%; border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 12px; }
</style></head><body>
<h1>CONTRAT DE LOCATION DE VÉHICULE</h1>
<p class="header-sub">Via la plateforme RAVE</p>

<h2>Article 1 — Parties</h2>
<p><strong>Le Loueur :</strong> <span class="field">[Nom du loueur]</span>, ci-après dénommé « le Loueur ».</p>
<p><strong>Le Locataire :</strong> <span class="field">[Nom du client]</span>, ci-après dénommé « le Locataire ».</p>

<h2>Article 2 — Véhicule</h2>
<table>
  <tr><td>Modèle</td><td>${vehicleName}</td></tr>
  <tr><td>Immatriculation</td><td>${plate || '—'}</td></tr>
</table>

<h2>Article 3 — Durée et tarif</h2>
<table>
  <tr><td>Date de début</td><td class="field">[Date début]</td></tr>
  <tr><td>Date de fin</td><td class="field">[Date fin]</td></tr>
  <tr><td>Prix par jour</td><td>${pricePerDay || '—'} XPF</td></tr>
  <tr><td>Tarif longue durée (≥ 7 jours)</td><td class="field">[Si applicable]</td></tr>
  <tr><td>Caution</td><td class="field">[Montant caution]</td></tr>
</table>

<h2>Article 4 — Conditions d'utilisation</h2>
<p>Le Locataire s'engage à :</p>
<ul>
  <li>Utiliser le véhicule en bon père de famille, conformément au Code de la Route.</li>
  <li>Ne pas sous-louer le véhicule à un tiers.</li>
  <li>Ne pas utiliser le véhicule pour des activités illicites.</li>
  <li>Restituer le véhicule dans l'état dans lequel il l'a reçu (propreté, carburant, accessoires).</li>
  <li>Signaler immédiatement tout sinistre, accident ou panne au Loueur.</li>
</ul>

<h2>Article 5 — Assurance</h2>
<p>Le véhicule est couvert par l'assurance du Loueur. En cas de sinistre responsable, le Locataire prend en charge la franchise dont le montant sera précisé lors de la remise des clés.</p>

<h2>Article 6 — Restitution</h2>
<p>Le véhicule doit être restitué à la date et au lieu convenus. Tout retard non signalé entraîne une facturation au tarif journalier majoré de 50 %. En cas de non-restitution sous 48h, le Loueur se réserve le droit de porter plainte.</p>

<h2>Article 7 — Caution</h2>
<p>La caution est restituée dans un délai de 7 jours après la restitution du véhicule, sous réserve de l'absence de dégâts, d'amendes impayées ou de frais de nettoyage excessifs.</p>

<h2>Article 8 — Responsabilité</h2>
<p>Le Locataire est responsable du véhicule pendant toute la durée de la location. Les amendes, contraventions et infractions commises pendant la période de location sont à la charge exclusive du Locataire.</p>

<h2>Article 9 — Résiliation</h2>
<p>Chaque partie peut résilier le contrat avec un préavis de 24 heures. En cas de résiliation anticipée par le Locataire, les jours restants ne sont pas remboursés sauf accord contraire du Loueur.</p>

<h2>Article 10 — Litiges</h2>
<p>En cas de litige, les parties s'engagent à privilégier un règlement amiable. À défaut, le litige sera soumis aux juridictions compétentes.</p>

<div style="margin-top: 50px;">
  <div style="display: flex; justify-content: space-between;">
    <div style="width: 45%; text-align: center;">
      <p style="margin-bottom: 40px;">Le Loueur</p>
      <div style="border-top: 1px solid #333; padding-top: 8px;">Signature</div>
    </div>
    <div style="width: 45%; text-align: center;">
      <p style="margin-bottom: 40px;">Le Locataire</p>
      <div style="border-top: 1px solid #333; padding-top: 8px;">Signature</div>
    </div>
  </div>
</div>

<p style="text-align: center; color: #999; font-size: 10px; margin-top: 30px;">Contrat généré via RAVE — ${new Date().toLocaleDateString('fr-FR')}</p>
</body></html>`;
}

function getDefaultContractPlainText(vehicleName: string, plate: string, pricePerDay: string) {
  return `CONTRAT DE LOCATION DE VÉHICULE
Via la plateforme RAVE
──────────────────────────────────

Article 1 — Parties
Le Loueur : [Nom du loueur]
Le Locataire : [Nom du client]

Article 2 — Véhicule
Modèle : ${vehicleName}
Immatriculation : ${plate || '—'}

Article 3 — Durée et tarif
Date de début : [Date début]
Date de fin : [Date fin]
Prix par jour : ${pricePerDay || '—'} XPF
Tarif longue durée (≥ 7 jours) : [Si applicable]
Caution : [Montant caution]

Article 4 — Conditions d'utilisation
- Utiliser le véhicule conformément au Code de la Route.
- Ne pas sous-louer le véhicule à un tiers.
- Ne pas utiliser le véhicule pour des activités illicites.
- Restituer le véhicule dans l'état reçu (propreté, carburant).
- Signaler immédiatement tout sinistre au Loueur.

Article 5 — Assurance
Le véhicule est couvert par l'assurance du Loueur. En cas de sinistre responsable, le Locataire prend en charge la franchise.

Article 6 — Restitution
Restitution à la date et au lieu convenus. Retard non signalé = tarif majoré de 50 %. Non-restitution sous 48h = dépôt de plainte possible.

Article 7 — Caution
Restituée sous 7 jours après retour, sous réserve d'absence de dégâts.

Article 8 — Responsabilité
Le Locataire est responsable du véhicule pendant toute la durée. Amendes et infractions à sa charge.

Article 9 — Résiliation
Préavis 24h. Jours restants non remboursés sauf accord.

Article 10 — Litiges
Règlement amiable privilégié, sinon juridictions compétentes.

──────────────────────────────────
Contrat généré via RAVE — ${new Date().toLocaleDateString('fr-FR')}`;
}

type Step = 'select' | 'details';

export default function AjouterVehiculeScreen() {
  const MAX_VEHICLES = 5;
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [models, setModels] = useState<VehicleModel[]>([]);
  const [existingVehicles, setExistingVehicles] = useState<{ vehicleModelId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<Step>('select');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [plate, setPlate] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerDayLongTerm, setPricePerDayLongTerm] = useState('');
  const [availableForRental, setAvailableForRental] = useState(true);
  const [availableForDelivery, setAvailableForDelivery] = useState(false);
  const [availableForLongTerm, setAvailableForLongTerm] = useState(false);
  const [rentalContractMode, setRentalContractMode] = useState<'app_default' | 'custom'>('app_default');
  const [customContractText, setCustomContractText] = useState('');
  const [showContractPreview, setShowContractPreview] = useState(false);
  const [sharingContract, setSharingContract] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const modelList = Array.isArray(models) ? models : [];
  const existingCount = Array.isArray(existingVehicles) ? existingVehicles.length : 0;
  const limitReached = existingCount >= MAX_VEHICLES;

  const usedModelIds = useMemo(
    () => new Set((existingVehicles || []).map((v) => v.vehicleModelId).filter(Boolean)),
    [existingVehicles]
  );

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [md, vd] = await Promise.all([
        getVehicleModels().catch(() => []),
        getMyVehicles().catch(() => []),
      ]);
      const api = Array.isArray(md) ? md : [];
      setModels(mergeVehicleModels(api, TAHITI_VEHICLE_MODELS));
      setExistingVehicles(Array.isArray(vd) ? vd : []);
    } catch {
      setModels(TAHITI_VEHICLE_MODELS);
    } finally {
      setLoading(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of modelList) c[m.category || 'autre'] = (c[m.category || 'autre'] || 0) + 1;
    return c;
  }, [modelList]);

  const categories = useMemo(() => {
    const d = Object.keys(categoryCounts).sort((a, b) =>
      (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b)
    );
    return ['all', ...d];
  }, [categoryCounts]);

  const brands = useMemo(() => ['all', ...listBrands(modelList)], [modelList]);

  const filteredModels = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = modelList
      .filter((m) => selectedCategory === 'all' || (m.category || 'autre') === selectedCategory)
      .filter((m) => selectedBrand === 'all' || extractBrand(m.name) === selectedBrand)
      .filter((m) => !q || `${m.name} ${m.fuel} ${m.transmission} ${extractBrand(m.name)}`.toLowerCase().includes(q));
    if (q && list.length === 0 && (selectedCategory !== 'all' || selectedBrand !== 'all')) {
      list = modelList.filter((m) =>
        `${m.name} ${m.fuel} ${m.transmission} ${extractBrand(m.name)}`.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const d = (usedModelIds.has(a.id) ? 1 : 0) - (usedModelIds.has(b.id) ? 1 : 0);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'fr');
    });
  }, [modelList, searchTerm, selectedCategory, selectedBrand, usedModelIds]);

  const selectedModel = modelList.find((m) => m.id === selectedModelId) || null;

  const goToDetails = () => {
    if (!selectedModelId || !selectedModel) {
      Alert.alert('Sélection requise', 'Veuillez choisir un modèle de véhicule.');
      return;
    }
    if (limitReached) {
      Alert.alert('Limite atteinte', `Vous avez déjà ${MAX_VEHICLES} véhicules.`);
      return;
    }
    setStep('details');
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const goBackToSelect = () => {
    setStep('select');
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const handleShareDefaultContract = async () => {
    if (!selectedModel) return;
    setSharingContract(true);
    try {
      const html = getDefaultContractHtml(selectedModel.name, plate, pricePerDay);
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
          message: getDefaultContractPlainText(selectedModel.name, plate, pricePerDay),
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

  const handleSubmit = async () => {
    if (!selectedModelId || !selectedModel) return;
    if (!pricePerDay || isNaN(Number(pricePerDay)) || Number(pricePerDay) <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix par jour valide');
      return;
    }
    if (!availableForRental && !availableForDelivery && !availableForLongTerm) {
      Alert.alert('Erreur', 'Activez au moins un type de service');
      return;
    }
    if (rentalContractMode === 'custom' && customContractText.trim().length < 20) {
      Alert.alert('Erreur', 'Le contrat personnalisé doit contenir au moins quelques lignes.');
      return;
    }
    setSubmitting(true);
    try {
      const data: CreateVehicleData = {
        vehicleModelId: selectedModelId,
        vehicleModelName: selectedModel.name,
        vehicleModelCategory: selectedModel.category,
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
      };
      await addVehicle(data);
      Alert.alert('Véhicule créé', 'Votre véhicule a été ajouté avec succès.', [
        { text: 'OK', onPress: () => safeBack(router) },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || "Impossible d'ajouter le véhicule");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Header title="Ajouter un véhicule" onBack={() => safeBack(router)} />
        <View style={st.centered}><ActivityIndicator size="large" color="#4ECC8B" /></View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════ ÉTAPE 2 : DÉTAILS ═══════════════════════
  if (step === 'details' && selectedModel) {
    const contractText = getDefaultContractPlainText(selectedModel.name, plate, pricePerDay);

    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Header title="Détails du véhicule" onBack={goBackToSelect} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={st.scrollPad} showsVerticalScrollIndicator={false}>

          {/* Récap modèle */}
          <View style={st.recapCard}>
            <View style={st.recapIcon}>
              <Ionicons name="car-sport" size={28} color="#4ECC8B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.recapName}>{selectedModel.name}</Text>
              <Text style={st.recapMeta}>
                {CATEGORY_LABELS[selectedModel.category] || selectedModel.category} · {selectedModel.seats} places · {selectedModel.transmission === 'auto' ? 'Auto' : 'Manuelle'} · {selectedModel.fuel}
              </Text>
            </View>
            <TouchableOpacity onPress={goBackToSelect} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="create-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Immatriculation */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Immatriculation</Text>
            <View style={st.field}>
              <Ionicons name="document-text-outline" size={18} color="#9CA3AF" />
              <TextInput style={st.fieldInput} value={plate} onChangeText={setPlate} placeholder="Ex: 12345 P1" placeholderTextColor="#D1D5DB" autoCapitalize="characters" />
            </View>
          </View>

          {/* Prix */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Tarification</Text>
            <Text style={st.label}>Prix par jour (XPF) *</Text>
            <View style={st.field}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" />
              <TextInput style={st.fieldInput} value={pricePerDay} onChangeText={setPricePerDay} placeholder="Ex: 5500" placeholderTextColor="#D1D5DB" keyboardType="numeric" />
              <Text style={st.suffix}>XPF</Text>
            </View>
            <Text style={[st.label, { marginTop: 14 }]}>Prix longue durée / jour</Text>
            <View style={st.field}>
              <Ionicons name="trending-down-outline" size={18} color="#9CA3AF" />
              <TextInput style={st.fieldInput} value={pricePerDayLongTerm} onChangeText={setPricePerDayLongTerm} placeholder="Optionnel" placeholderTextColor="#D1D5DB" keyboardType="numeric" />
              <Text style={st.suffix}>XPF</Text>
            </View>
            <Text style={st.hint}>Prix réduit appliqué à partir de 7 jours de location</Text>
          </View>

          {/* Photos */}
          <View style={st.section}>
            <Text style={st.sectionTitle}>Photos du véhicule</Text>
            <VehiclePhotosPicker photos={photoUrls} onChange={setPhotoUrls} />
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

            {/* Option 1: Contrat par défaut */}
            <TouchableOpacity
              style={[st.contractCard, rentalContractMode === 'app_default' && st.contractCardOn]}
              onPress={() => setRentalContractMode('app_default')}
              activeOpacity={0.75}
            >
              <View style={[st.cardDot, rentalContractMode === 'app_default' && st.cardDotOn, { width: 20, height: 20, borderRadius: 10 }]}>
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
                  onPress={handleShareDefaultContract}
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

            {/* Option 2: Contrat personnalisé */}
            <TouchableOpacity
              style={[st.contractCard, rentalContractMode === 'custom' && st.contractCardOn]}
              onPress={() => setRentalContractMode('custom')}
              activeOpacity={0.75}
            >
              <View style={[st.cardDot, rentalContractMode === 'custom' && st.cardDotOn, { width: 20, height: 20, borderRadius: 10 }]}>
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
                  Rédigez ci-dessous les conditions de votre contrat. Ce texte sera envoyé au client lors de la réservation.
                </Text>
                <TextInput
                  style={st.customContractInput}
                  value={customContractText}
                  onChangeText={setCustomContractText}
                  placeholder={"Ex:\n\nCONTRAT DE LOCATION\n\nEntre le loueur [votre nom] et le locataire...\n\nArticle 1 — Objet\nLe loueur met à disposition le véhicule...\n\nArticle 2 — Durée\n...\n\nArticle 3 — Prix\n..."}
                  placeholderTextColor="#D1D5DB"
                  multiline
                  textAlignVertical="top"
                  scrollEnabled
                />
                <Text style={st.charCount}>
                  {customContractText.length} caractères
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
        </KeyboardAvoidingView>

        <View style={st.bottomBar}>
          <SafeAreaView edges={['bottom']}>
            <TouchableOpacity style={[st.mainBtn, st.mainBtnFull, submitting && st.mainBtnOff]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color="#1a1a1a" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#1a1a1a" />
                  <Text style={st.mainBtnTxt}>Créer le véhicule</Text>
                </>
              )}
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════ ÉTAPE 1 : SÉLECTION ═══════════════════════
  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Header title="Choisir un modèle" onBack={() => safeBack(router)} />

      <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={st.scrollPad} showsVerticalScrollIndicator={false}>
        {limitReached && (
          <View style={st.limitBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
            <Text style={st.limitText}>Limite atteinte : {existingCount}/{MAX_VEHICLES} véhicules.</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chips} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {categories.map((cat) => {
            const active = cat === selectedCategory;
            const count = cat === 'all' ? modelList.length : (categoryCounts[cat] || 0);
            return (
              <TouchableOpacity key={cat} style={[st.chip, active && st.chipOn]} onPress={() => setSelectedCategory(cat)} activeOpacity={0.75}>
                <Text style={[st.chipTxt, active && st.chipTxtOn]}>{CATEGORY_LABELS[cat] || cat} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={st.filterLabel}>Marque</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipsBrand} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {brands.map((brand) => {
            const active = brand === selectedBrand;
            const label = brand === 'all' ? 'Toutes' : brand;
            return (
              <TouchableOpacity
                key={brand}
                style={[st.chip, st.chipBrand, active && st.chipOn]}
                onPress={() => setSelectedBrand(brand)}
                activeOpacity={0.75}
              >
                <Text style={[st.chipTxt, active && st.chipTxtOn]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[st.field, { marginHorizontal: 16, marginBottom: 10 }]}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={st.fieldInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Rechercher (Toyota, Hilux, diesel...)"
            placeholderTextColor="#D1D5DB"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={st.resultCount}>
          {filteredModels.length} modèle{filteredModels.length > 1 ? 's' : ''}
        </Text>

        <View style={{ paddingHorizontal: 16 }}>
          {filteredModels.length === 0 ? (
            <Text style={st.empty}>Aucun modèle trouvé.</Text>
          ) : (
            filteredModels.map((model) => {
              const used = usedModelIds.has(model.id);
              const picked = selectedModelId === model.id;
              return (
                <TouchableOpacity key={model.id} style={[st.card, picked && st.cardOn]} onPress={() => setSelectedModelId(model.id)} activeOpacity={0.7}>
                  <View style={[st.cardDot, picked && st.cardDotOn]}>
                    {picked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={st.cardName}>{model.name}</Text>
                      {used && <Text style={st.usedBadge}>Déjà ajouté</Text>}
                    </View>
                    <Text style={st.cardMeta}>
                      {model.seats} pl · {model.transmission === 'auto' ? 'Auto' : 'Man.'} · {model.fuel}
                    </Text>
                  </View>
                  <Text style={st.cardCat}>{CATEGORY_LABELS[model.category] || model.category}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {selectedModel && !limitReached && (
        <View style={st.bottomBar}>
          <SafeAreaView edges={['bottom']}>
            <View style={st.bottomRecap}>
              <View style={{ flex: 1 }}>
                <Text style={st.bottomName}>{selectedModel.name}</Text>
                <Text style={st.bottomMeta}>{selectedModel.seats} places · {selectedModel.fuel}</Text>
              </View>
              <TouchableOpacity style={st.mainBtn} onPress={goToDetails} activeOpacity={0.85}>
                <Text style={st.mainBtnTxt}>Suivant</Text>
                <Ionicons name="arrow-forward" size={20} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollPad: { paddingBottom: 40 },

  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 12, borderRadius: 12, backgroundColor: '#D1F2E3', borderWidth: 1, borderColor: '#A8E6C8' },
  limitText: { flex: 1, fontSize: 13, color: '#166534', fontWeight: '600' },

  chips: { marginTop: 12, marginBottom: 4 },
  chipsBrand: { marginBottom: 10 },
  filterLabel: { marginTop: 4, marginBottom: 6, marginHorizontal: 16, fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  resultCount: { marginHorizontal: 16, marginBottom: 8, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  chip: { marginRight: 8, backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipBrand: { paddingVertical: 7 },
  chipOn: { backgroundColor: '#E8F8F0', borderColor: '#4ECC8B' },
  chipTxt: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  chipTxtOn: { color: '#166534' },

  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 48, gap: 10 },
  fieldInput: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500', paddingVertical: Platform.OS === 'ios' ? 0 : 8 },
  suffix: { fontSize: 13, color: '#9CA3AF', fontWeight: '700' },

  empty: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },

  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#F3F4F6', marginBottom: 8, backgroundColor: '#fff' },
  cardOn: { borderColor: '#4ECC8B', backgroundColor: '#E8F8F0' },
  cardDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cardDotOn: { borderColor: '#4ECC8B', backgroundColor: '#4ECC8B' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardCat: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase' },
  usedBadge: { fontSize: 10, color: '#166534', fontWeight: '700', backgroundColor: '#D1F2E3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 16, paddingTop: 12, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 10 } }) },
  bottomRecap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottomName: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  bottomMeta: { fontSize: 12, color: '#6B7280' },
  mainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4ECC8B', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
  mainBtnFull: { paddingHorizontal: 0, width: '100%' },
  mainBtnOff: { opacity: 0.6 },
  mainBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },

  recapCard: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#4ECC8B', gap: 14 },
  recapIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' },
  recapName: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  recapMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  section: { backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  switchDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F3F4F6' },

  contractCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: '#FAFAFA' },
  contractCardOn: { borderColor: '#4ECC8B', backgroundColor: '#E8F8F0' },
  contractTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  contractDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  contractPreviewBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  previewToggleText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  contractTextBox: { marginTop: 12, backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  contractPlainText: { fontSize: 12, color: '#374151', lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, backgroundColor: '#4ECC8B', paddingVertical: 10, borderRadius: 10 },
  downloadBtnTxt: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },

  customContractBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  customContractHint: { fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 18 },
  customContractInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 220,
    maxHeight: 400,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 6 },
});
