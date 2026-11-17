import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import {
  getDriverSubscription,
  subscribeLoueurPlan,
  SessionExpiredError,
  type LoueurSubscriptionInfo,
} from '@/lib/api';
import { logoutDriver } from '@/lib/logout';

type PlanKey = 'monthly' | 'semiannual';

const formatXpf = (n: number) => `${n.toLocaleString('fr-FR')} XPF`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AbonnementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [info, setInfo] = useState<LoueurSubscriptionInfo | null>(null);
  const [selected, setSelected] = useState<PlanKey>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const data = await getDriverSubscription();
      const prev = prevStatusRef.current;
      setInfo(data);
      setError(null);
      if (data.status === 'active') {
        if (prev && prev !== 'active') setJustActivated(true);
        stopPoll();
      }
      prevStatusRef.current = data.status;
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await logoutDriver();
        router.replace('/(chauffeur)/login');
        return;
      }
      if (!opts?.silent) setError('Impossible de charger votre abonnement. Tirez vers le bas pour réessayer.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [router, stopPoll]);

  const startPoll = useCallback(() => {
    stopPoll();
    let ticks = 0;
    pollRef.current = setInterval(() => {
      ticks += 1;
      if (ticks > 40) {
        stopPoll();
        return;
      }
      load({ silent: true });
    }, 3000);
  }, [load, stopPoll]);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load({ silent: true });
    });
    return () => {
      sub.remove();
      stopPoll();
    };
  }, [load, stopPoll]);

  const plans = info?.plans || {};
  const monthly = plans.monthly;
  const semiannual = plans.semiannual;

  useEffect(() => {
    if (info?.plan === 'semiannual' && semiannual) setSelected('semiannual');
  }, [info?.plan, semiannual]);

  const status = info?.status || 'none';
  const isActive = status === 'active';
  const isPending = status === 'pending';
  const selectedPlan = plans[selected];

  const savingsPercent =
    monthly && semiannual && semiannual.days > 0 && monthly.days > 0
      ? Math.round(
          (1 - (semiannual.amountXpf / semiannual.days) / (monthly.amountXpf / monthly.days)) * 100
        )
      : 0;

  const handlePay = async () => {
    if (!selectedPlan || paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await subscribeLoueurPlan(selected);
      setInfo(res);
      prevStatusRef.current = res.status;
      const url = res.paymentUrl;
      if (!url) throw new Error('Lien de paiement indisponible. Réessayez dans un instant.');
      startPoll();
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      if (e instanceof SessionExpiredError) {
        await logoutDriver();
        router.replace('/(chauffeur)/login');
        return;
      }
      const msg = String(e?.message || '');
      setError(msg.replace(/^\d{3}:\s*/, '') || 'Le paiement n’a pas pu démarrer. Réessayez.');
      load({ silent: true });
    } finally {
      setPaying(false);
    }
  };

  const renderStatusCard = () => {
    if (!info) return null;

    if (isActive) {
      return (
        <View style={[styles.hero, styles.heroActive]}>
          <View style={styles.heroIconActive}>
            <Ionicons name="checkmark" size={26} color="#059669" />
          </View>
          <Text style={styles.heroTitleLight}>Abonnement actif</Text>
          <Text style={styles.heroSubLight}>
            {(info.plan && plans[info.plan]?.label) || 'Formule RAVE'}
            {info.amount != null ? ` · ${formatXpf(info.amount)}` : ''}
          </Text>
          {info.endsAt ? (
            <View style={styles.heroPill}>
              <Ionicons name="refresh" size={14} color="#065F46" />
              <Text style={styles.heroPillText}>Renouvellement automatique le {formatDate(info.endsAt)}</Text>
            </View>
          ) : null}
          <Text style={styles.heroNoteLight}>
            Vous n’avez rien à faire : vos véhicules sont visibles et vous pouvez accepter des locations.
          </Text>
        </View>
      );
    }

    const meta =
      info.waitingFirstVehicle
        ? { icon: 'car-sport-outline' as const, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A',
            title: 'Ajoutez votre premier véhicule',
            text: 'Votre essai gratuit de 30 jours démarre dès que votre premier véhicule est publié. Vous pouvez aussi vous abonner dès maintenant.' }
        : status === 'trial'
          ? { icon: 'gift-outline' as const, color: '#047857', bg: '#ECFDF5', border: '#A7F3D0',
              title: info.daysRemaining != null
                ? `Essai gratuit · ${info.daysRemaining} jour${info.daysRemaining > 1 ? 's' : ''} restant${info.daysRemaining > 1 ? 's' : ''}`
                : 'Essai gratuit en cours',
              text: info.endsAt
                ? `Abonnez-vous avant le ${formatDate(info.endsAt)} pour garder vos véhicules en ligne sans interruption.`
                : 'Abonnez-vous pour garder vos véhicules en ligne sans interruption.' }
          : isPending
            ? { icon: 'time-outline' as const, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A',
                title: 'Paiement en attente',
                text: info.access
                  ? 'Votre paiement n’est pas encore confirmé. Votre essai reste actif en attendant.'
                  : 'Votre paiement n’est pas encore confirmé. Finalisez-le pour réactiver votre compte.' }
            : status === 'grace'
              ? { icon: 'alert-circle-outline' as const, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A',
                  title: 'Abonnement expiré — délai de grâce',
                  text: info.graceDaysRemaining != null
                    ? `Vos véhicules restent visibles encore ${info.graceDaysRemaining} jour${info.graceDaysRemaining > 1 ? 's' : ''}. Abonnez-vous pour éviter leur masquage.`
                    : 'Abonnez-vous pour éviter le masquage de vos véhicules.' }
              : status === 'expired'
                ? { icon: 'close-circle-outline' as const, color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA',
                    title: 'Abonnement expiré',
                    text: 'Vos véhicules sont masqués du catalogue. Abonnez-vous pour les remettre en ligne immédiatement.' }
                : { icon: 'ribbon-outline' as const, color: '#374151', bg: '#F9FAFB', border: '#E5E7EB',
                    title: 'Aucun abonnement',
                    text: 'Choisissez une formule pour publier vos véhicules et recevoir des locations.' };

    return (
      <View style={[styles.hero, { backgroundColor: meta.bg, borderColor: meta.border, borderWidth: 1 }]}>
        <View style={styles.heroRow}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
          <Text style={[styles.heroTitle, { color: meta.color }]}>{meta.title}</Text>
        </View>
        <Text style={styles.heroText}>{meta.text}</Text>
      </View>
    );
  };

  const renderPlan = (key: PlanKey) => {
    const def = plans[key];
    if (!def) return null;
    const isSel = selected === key;
    const perMonth = def.days > 0 ? Math.round((def.amountXpf / def.days) * 30) : def.amountXpf;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.planCard, isSel && styles.planCardSelected]}
        activeOpacity={0.85}
        disabled={paying}
        onPress={() => setSelected(key)}
      >
        <View style={[styles.radio, isSel && styles.radioSelected]}>
          {isSel ? <View style={styles.radioDot} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.planNameRow}>
            <Text style={styles.planName}>{def.label}</Text>
            {key === 'semiannual' && savingsPercent > 0 ? (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>-{savingsPercent}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.planDesc}>
            {key === 'semiannual' ? `Soit ${formatXpf(perMonth)} / mois · ` : ''}
            {def.days} jours, renouvelé automatiquement
          </Text>
        </View>
        <Text style={styles.planPrice}>{formatXpf(def.amountXpf)}</Text>
      </TouchableOpacity>
    );
  };

  const showPlans = !!info && !isActive && (monthly || semiannual);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement RAVE</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !info ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#171717" />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, showPlans && { paddingBottom: 170 }]}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} />}
          >
            {justActivated ? (
              <View style={styles.thanks}>
                <Ionicons name="sparkles" size={18} color="#065F46" />
                <Text style={styles.thanksText}>Merci ! Votre paiement est validé et votre abonnement est actif.</Text>
              </View>
            ) : null}

            {renderStatusCard()}

            {showPlans ? (
              <>
                <Text style={styles.sectionTitle}>Choisissez votre formule</Text>
                {renderPlan('monthly')}
                {renderPlan('semiannual')}

                <View style={styles.benefits}>
                  {[
                    'Vos véhicules visibles par tous les clients RAVE',
                    'Demandes de location illimitées',
                    'Résiliable à tout moment auprès du support',
                  ].map((b) => (
                    <View key={b} style={styles.benefitRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ECC8B" />
                      <Text style={styles.benefitText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {isActive ? (
              <TouchableOpacity style={styles.supportLink} onPress={() => router.push('/(chauffeur)/support-chat')}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#6B7280" />
                <Text style={styles.supportLinkText}>Changer de formule ou résilier : contacter le support</Text>
              </TouchableOpacity>
            ) : null}

            {error && !showPlans ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          {showPlans && selectedPlan ? (
            <View style={styles.footer}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.payBtn, paying && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={paying}
                onPress={handlePay}
              >
                {paying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={16} color="#fff" />
                    <Text style={styles.payBtnText}>
                      {isPending ? 'Reprendre le paiement' : 'Payer'} · {formatXpf(selectedPlan.amountXpf)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.footerNote}>
                Paiement sécurisé par Stripe. Revenez ensuite dans l’app : votre abonnement s’active automatiquement.
              </Text>
            </View>
          ) : null}
        </>
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  content: { padding: 20, paddingBottom: 40 },

  thanks: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#D1FAE5', borderRadius: 12, padding: 12, marginBottom: 14,
  },
  thanksText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#065F46' },

  hero: { borderRadius: 18, padding: 18, marginBottom: 24 },
  heroActive: { backgroundColor: '#059669', alignItems: 'center', paddingVertical: 26 },
  heroIconActive: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitleLight: { fontSize: 22, fontWeight: '900', color: '#fff' },
  heroSubLight: { marginTop: 4, fontSize: 14, color: '#D1FAE5', fontWeight: '600' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  heroPillText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  heroNoteLight: { marginTop: 14, fontSize: 13, color: '#ECFDF5', textAlign: 'center', lineHeight: 19 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  heroText: { marginTop: 8, fontSize: 13, color: '#4B5563', lineHeight: 19 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, marginBottom: 12, backgroundColor: '#fff',
  },
  planCardSelected: { borderColor: '#171717', backgroundColor: '#fff' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#171717' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#171717' },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 16, fontWeight: '800', color: '#111' },
  saveBadge: { backgroundColor: '#4ECC8B', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  planDesc: { marginTop: 3, fontSize: 12, color: '#6B7280' },
  planPrice: { fontSize: 16, fontWeight: '800', color: '#111' },

  benefits: { marginTop: 8, gap: 8 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { fontSize: 13, color: '#374151' },

  supportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  supportLinkText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', textAlign: 'center', marginBottom: 10 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#171717', borderRadius: 14, height: 54,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  footerNote: { marginTop: 10, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
});
