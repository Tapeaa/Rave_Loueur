import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { safeBack } from '@/lib/navigation';
import { Text } from '@/components/ui/Text';
import { appAlert } from '@/components/AppAlert';
import { getMyVehicles, saveCancellationPolicy, type LoueurVehicle } from '@/lib/api';

const GREEN = '#4ECC8B';
const INK = '#0B1F14';

type PresetId = 'flexible' | 'moderee' | 'stricte' | 'custom';

const PRESETS: { id: Exclude<PresetId, 'custom'>; label: string; title: string; desc: string }[] = [
  {
    id: 'flexible',
    label: 'Flexible',
    title: 'Annulation flexible',
    desc:
      "Annulation gratuite jusqu'à 24 h avant le début de la location : remboursement intégral.\n" +
      "Moins de 24 h avant le début : 50 % du montant est conservé.\n" +
      'Non-présentation le jour du départ : aucun remboursement.',
  },
  {
    id: 'moderee',
    label: 'Modérée',
    title: 'Annulation modérée',
    desc:
      "Annulation gratuite jusqu'à 72 h avant le début de la location : remboursement intégral.\n" +
      'Entre 72 h et 24 h avant le début : remboursement de 50 %.\n' +
      'Moins de 24 h avant le début ou non-présentation : aucun remboursement.',
  },
  {
    id: 'stricte',
    label: 'Stricte',
    title: 'Annulation stricte',
    desc:
      "Annulation gratuite jusqu'à 7 jours avant le début de la location : remboursement intégral.\n" +
      'Entre 7 jours et 72 h avant le début : remboursement de 50 %.\n' +
      'Moins de 72 h avant le début ou non-présentation : aucun remboursement.',
  },
];

const TITLE_MIN = 3;
const TITLE_MAX = 80;
const DESC_MIN = 20;
const DESC_MAX = 2000;

function detectPreset(title: string, desc: string): PresetId {
  const match = PRESETS.find((p) => p.title === title.trim() && p.desc === desc.trim());
  return match ? match.id : 'custom';
}

export default function ConditionsAnnulationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const focusVehicleId = typeof params.vehicleId === 'string' ? params.vehicleId : undefined;

  const [vehicles, setVehicles] = useState<LoueurVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [preset, setPreset] = useState<PresetId>('moderee');
  const [title, setTitle] = useState(PRESETS[1].title);
  const [desc, setDesc] = useState(PRESETS[1].desc);
  const [applyAll, setApplyAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await getMyVehicles();
      const list = Array.isArray(data) ? data : [];
      setVehicles(list);
      if (!initialized) {
        const focus = focusVehicleId ? list.find((v) => v.id === focusVehicleId) : undefined;
        const source = focus?.cancellation?.configured
          ? focus
          : list.find((v) => v.cancellation?.configured);
        if (source?.cancellation) {
          setTitle(source.cancellation.title);
          setDesc(source.cancellation.desc);
          setPreset(detectPreset(source.cancellation.title, source.cancellation.desc));
        }
        if (focus) {
          setApplyAll(false);
          setSelected([focus.id]);
        }
        setInitialized(true);
      }
    } catch (error: any) {
      appAlert('Erreur', error?.message || 'Impossible de charger vos véhicules');
    } finally {
      setLoading(false);
    }
  }, [focusVehicleId, initialized]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const missingCount = useMemo(
    () => vehicles.filter((v) => v.cancellation && !v.cancellation.configured).length,
    [vehicles],
  );

  const choosePreset = (id: PresetId) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      setTitle(p.title);
      setDesc(p.desc);
    }
  };

  const toggleVehicle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const titleOk = title.trim().length >= TITLE_MIN && title.trim().length <= TITLE_MAX;
  const descOk = desc.trim().length >= DESC_MIN && desc.trim().length <= DESC_MAX;
  const targetOk = applyAll ? vehicles.length > 0 : selected.length > 0;
  const canSave = titleOk && descOk && targetOk && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await saveCancellationPolicy(title.trim(), desc.trim(), applyAll ? 'all' : selected);
      await load();
      appAlert(
        'Conditions publiées',
        `Vos conditions d'annulation sont appliquées à ${res.updated} véhicule${res.updated > 1 ? 's' : ''}. Les clients les verront avant de réserver et dans chaque commande.`,
      );
    } catch (error: any) {
      appAlert('Erreur', error?.message || "Impossible d'enregistrer les conditions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router)} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'annulation</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {missingCount > 0 ? (
              <View style={[styles.banner, styles.bannerDanger]}>
                <Ionicons name="eye-off" size={20} color="#B91C1C" />
                <Text style={[styles.bannerText, { color: '#991B1B' }]}>
                  {missingCount} véhicule{missingCount > 1 ? 's sont masqués' : ' est masqué'} aux clients tant que vos conditions d'annulation ne sont pas prêtes.
                </Text>
              </View>
            ) : vehicles.length > 0 ? (
              <View style={[styles.banner, styles.bannerOk]}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={[styles.bannerText, { color: INK }]}>
                  Tous vos véhicules ont des conditions d'annulation : ils sont visibles par les clients.
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>1. Choisissez un modèle</Text>
            <View style={styles.presetRow}>
              {[...PRESETS.map((p) => ({ id: p.id as PresetId, label: p.label })), { id: 'custom' as PresetId, label: 'Personnalisée' }].map((p) => {
                const active = preset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetChip, active ? styles.presetChipActive : null]}
                    onPress={() => choosePreset(p.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, active ? styles.presetChipTextActive : null]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>2. Rédigez vos conditions</Text>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Titre</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={(t) => { setTitle(t); setPreset('custom'); }}
                placeholder="Ex. Annulation modérée"
                placeholderTextColor="#9CA3AF"
                maxLength={TITLE_MAX}
              />
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Conditions détaillées</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={desc}
                onChangeText={(t) => { setDesc(t); setPreset('custom'); }}
                placeholder="Délais, pourcentage remboursé, cas de non-présentation…"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                maxLength={DESC_MAX}
              />
              <Text style={[styles.counter, descOk ? null : styles.counterError]}>
                {desc.trim().length < DESC_MIN
                  ? `Encore ${DESC_MIN - desc.trim().length} caractères minimum`
                  : `${desc.trim().length} / ${DESC_MAX}`}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>3. Appliquer à</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.radioRow} onPress={() => setApplyAll(true)} activeOpacity={0.8}>
                <Ionicons name={applyAll ? 'radio-button-on' : 'radio-button-off'} size={22} color={applyAll ? GREEN : '#9CA3AF'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioTitle}>Tous mes véhicules</Text>
                  <Text style={styles.radioSub}>Les mêmes conditions pour toute votre flotte ({vehicles.length})</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.radioRow} onPress={() => setApplyAll(false)} activeOpacity={0.8}>
                <Ionicons name={!applyAll ? 'radio-button-on' : 'radio-button-off'} size={22} color={!applyAll ? GREEN : '#9CA3AF'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.radioTitle}>Certains véhicules</Text>
                  <Text style={styles.radioSub}>Choisissez les véhicules concernés</Text>
                </View>
              </TouchableOpacity>

              {vehicles.map((v) => {
                const configured = v.cancellation?.configured === true;
                const checked = applyAll || selected.includes(v.id);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vehicleRow, applyAll ? styles.vehicleRowDisabled : null]}
                    onPress={() => !applyAll && toggleVehicle(v.id)}
                    activeOpacity={applyAll ? 1 : 0.7}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? GREEN : '#9CA3AF'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicleName} numberOfLines={1}>{v.modelName || 'Véhicule'}</Text>
                      {configured && v.cancellation?.title ? (
                        <Text style={styles.vehicleSub} numberOfLines={1}>{v.cancellation.title}</Text>
                      ) : v.plate ? (
                        <Text style={styles.vehicleSub} numberOfLines={1}>{v.plate}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.badge, configured ? styles.badgeOk : styles.badgeMissing]}>
                      <Text style={[styles.badgeText, { color: configured ? '#16A34A' : '#B91C1C' }]}>
                        {configured ? 'Prêt' : 'À faire'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {vehicles.length === 0 ? (
                <Text style={styles.radioSub}>Ajoutez d'abord un véhicule.</Text>
              ) : null}
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
              <Text style={styles.infoText}>
                Les clients voient ces conditions avant de payer, et elles restent jointes à chaque commande telles qu'acceptées au moment de la réservation.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, canSave ? null : styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#1a1a1a" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {applyAll
                    ? 'Appliquer à tous mes véhicules'
                    : `Appliquer à ${selected.length} véhicule${selected.length > 1 ? 's' : ''}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, marginBottom: 18,
  },
  bannerDanger: { backgroundColor: '#FEF2F2' },
  bannerOk: { backgroundColor: '#E8F8F0' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 10, marginTop: 4,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  presetChip: {
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  presetChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  presetChipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  presetChipTextActive: { color: '#1a1a1a' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1a1a1a', backgroundColor: '#F9FAFB',
  },
  textarea: { minHeight: 150, lineHeight: 21 },
  counter: { fontSize: 12, color: '#9CA3AF', marginTop: 6, textAlign: 'right' },
  counterError: { color: '#B91C1C' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  radioTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  radioSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  vehicleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingLeft: 10, marginTop: 4,
  },
  vehicleRowDisabled: { opacity: 0.55 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  vehicleSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeOk: { backgroundColor: '#E8F8F0' },
  badgeMissing: { backgroundColor: '#FEF2F2' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  infoBox: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  infoText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 17 },
  footer: {
    padding: 16, paddingBottom: 24,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    height: 54, borderRadius: 16, backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
});
