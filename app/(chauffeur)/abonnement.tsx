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

    const meta = isActive
      ? { icon: 'checkmark-circle' as const, badge: 'Actif', badgeColor: '#16A34A',
          title: (info.plan && plans[info.plan]?.label) || 'Formule RAVE',
          text: 'Vos véhicules sont visibles et vous pouvez accepter des locations.' }
      : info.waitingFirstVehicle
        ? { icon: 'car-sport' as const, badge: 'En attente', badgeColor: '#D97706',
            title: 'Ajoutez votre premier véhicule',
            text: 'Votre essai gratuit de 30 jours démarre dès que votre premier véhicule est publié.' }
        : status === 'trial'
          ? { icon: 'gift' as const, badge: 'Essai gratuit', badgeColor: '#16A34A',
              title: info.daysRemaining != null
                ? `${info.daysRemaining} jour${info.daysRemaining > 1 ? 's' : ''} restant${info.daysRemaining > 1 ? 's' : ''}`
                : 'Essai en cours',
              text: info.endsAt
                ? `Abonnez-vous avant le ${formatDate(info.endsAt)} pour rester en ligne sans interruption.`
                : 'Abonnez-vous pour rester en ligne sans interruption.' }
          : isPending
            ? { icon: 'time' as const, badge: 'Paiement en attente', badgeColor: '#D97706',
                title: 'Paiement non confirmé',
                text: info.access
                  ? 'Votre essai reste actif en attendant la confirmation.'
                  : 'Finalisez le paiement pour réactiver votre compte.' }
            : status === 'grace'
              ? { icon: 'alert-circle' as const, badge: 'Délai de grâce', badgeColor: '#D97706',
                  title: 'Abonnement expiré',
                  text: info.graceDaysRemaining != null
                    ? `Vos véhicules restent visibles encore ${info.graceDaysRemaining} jour${info.graceDaysRemaining > 1 ? 's' : ''}.`
                    : 'Abonnez-vous pour éviter le masquage de vos véhicules.' }
              : status === 'expired'
                ? { icon: 'close-circle' as const, badge: 'Expiré', badgeColor: '#DC2626',
                    title: 'Véhicules masqués',
                    text: 'Abonnez-vous pour remettre vos véhicules en ligne immédiatement.' }
                : { icon: 'ribbon' as const, badge: 'Aucun abonnement', badgeColor: '#374151',
                    title: 'Passez en ligne',
                    text: 'Choisissez une formule pour publier vos véhicules et recevoir des locations.' };

    return (
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <View style={[styles.heroBadgeDot, { backgroundColor: meta.badgeColor }]} />
          <Text style={styles.heroBadgeText}>{meta.badge}</Text>
        </View>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{meta.title}</Text>
            {isActive && info.amount != null ? (
              <Text style={styles.heroAmount}>{formatXpf(info.amount)}</Text>
            ) : null}
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name={meta.icon} size={30} color={INK} />
          </View>
        </View>
        <Text style={styles.heroText}>{meta.text}</Text>
        {isActive && info.endsAt ? (
          <View style={styles.heroPill}>
            <Ionicons name="refresh" size={14} color={INK} />
            <Text style={styles.heroPillText}>Renouvelé automatiquement le {formatDate(info.endsAt)}</Text>
          </View>
        ) : null}
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
        {key === 'semiannual' && savingsPercent > 0 ? (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Économisez {savingsPercent}%</Text>
          </View>
        ) : null}
        <View style={styles.planTop}>
          <View style={[styles.radio, isSel && styles.radioSelected]}>
            {isSel ? <Ionicons name="checkmark" size={14} color={INK} /> : null}
          </View>
          <Text style={styles.planName}>{def.label}</Text>
        </View>
        <View style={styles.planPriceRow}>
          <Text style={styles.planPrice}>{def.amountXpf.toLocaleString('fr-FR')}</Text>
          <Text style={styles.planCurrency}> XPF</Text>
        </View>
        <Text style={styles.planDesc}>
          {key === 'semiannual' ? `Soit ${formatXpf(perMonth)} / mois · ` : ''}
          {def.days} jours, renouvelé automatiquement
        </Text>
      </TouchableOpacity>
    );
  };

  const showPlans = !!info && !isActive && (monthly || semiannual);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abonnement</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading && !info ? (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <ActivityIndicator style={{ marginTop: 40 }} color="#4ECC8B" />
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1, backgroundColor: '#FFFFFF' }}
              contentContainerStyle={{ flexGrow: 1 }}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={INK} />}
            >
              <View style={styles.heroOverscroll} />
              {renderStatusCard()}

              <View style={[styles.sheet, showPlans && { paddingBottom: 190 }]}>
                {justActivated ? (
                  <View style={styles.thanks}>
                    <Ionicons name="sparkles" size={18} color="#166534" />
                    <Text style={styles.thanksText}>Merci ! Votre paiement est validé et votre abonnement est actif.</Text>
                  </View>
                ) : null}

                {showPlans ? (
                  <>
                    <Text style={styles.sectionTitle}>Choisissez votre formule</Text>
                    <View style={styles.plansRow}>
                      {renderPlan('monthly')}
                      {renderPlan('semiannual')}
                    </View>
                  </>
                ) : null}

                <Text style={[styles.sectionTitle, { marginTop: showPlans ? 26 : 8 }]}>Inclus dans RAVE</Text>
                {[
                  { icon: 'eye-outline' as const, title: 'Visibilité totale', text: 'Vos véhicules visibles par tous les clients RAVE' },
                  { icon: 'infinite-outline' as const, title: 'Sans limite', text: 'Demandes de location illimitées' },
                  { icon: 'shield-checkmark-outline' as const, title: 'Sans engagement', text: 'Résiliable à tout moment auprès du support' },
                ].map((b, index) => (
                  <View key={b.title} style={[styles.benefitRow, index > 0 && styles.benefitDivider]}>
                    <View style={styles.benefitIcon}>
                      <Ionicons name={b.icon} size={18} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.benefitTitle}>{b.title}</Text>
                      <Text style={styles.benefitText}>{b.text}</Text>
                    </View>
                  </View>
                ))}

                {isActive ? (
                  <TouchableOpacity style={styles.supportLink} onPress={() => router.push('/(chauffeur)/support-chat')}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1a1a1a" />
                    <Text style={styles.supportLinkText}>Changer de formule ou résilier</Text>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}

                {error && !showPlans ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
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
                    <ActivityIndicator color={INK} />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={16} color={INK} />
                      <Text style={styles.payBtnText}>
                        {isPending ? 'Reprendre le paiement' : 'Payer'} · {formatXpf(selectedPlan.amountXpf)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.footerNote}>
                  Paiement sécurisé par Stripe. Revenez ensuite dans l’app : l’abonnement s’active automatiquement.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const HERO_BG = '#4ECC8B';
const INK = '#0B1F14';
const INK_SOFT = 'rgba(11,31,20,0.65)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HERO_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: HERO_BG,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  heroOverscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: HERO_BG },
  hero: { backgroundColor: HERO_BG, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 4 },
  heroBadgeText: { fontSize: 12, fontWeight: '800', color: INK },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: INK, letterSpacing: -0.6 },
  heroAmount: { fontSize: 15, fontWeight: '700', color: INK_SOFT, marginTop: 2 },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroText: { marginTop: 10, fontSize: 14, lineHeight: 20, color: INK_SOFT, fontWeight: '500' },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  heroPillText: { fontSize: 12, fontWeight: '700', color: INK },

  sheet: {
    flexGrow: 1, backgroundColor: '#FFFFFF', marginTop: -24,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
  },

  thanks: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F8F0', borderRadius: 14, padding: 12, marginBottom: 18,
  },
  thanksText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#166534' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.2, marginBottom: 12 },
  plansRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  planCard: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 20,
    padding: 14, paddingTop: 16, backgroundColor: '#FFFFFF',
  },
  planCardSelected: { borderColor: '#4ECC8B', backgroundColor: '#F0FBF5' },
  saveBadge: {
    position: 'absolute', top: -11, right: 12,
    backgroundColor: INK, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  saveBadgeText: { fontSize: 11, fontWeight: '800', color: '#4ECC8B' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#4ECC8B', backgroundColor: '#4ECC8B' },
  planName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  planPrice: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  planCurrency: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 3 },
  planDesc: { marginTop: 6, fontSize: 12, lineHeight: 16, color: '#6B7280' },

  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  benefitDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF0F2' },
  benefitIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  benefitTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  benefitText: { fontSize: 13, color: '#6B7280', marginTop: 1 },

  supportLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    backgroundColor: '#F7F7F8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15,
  },
  supportLinkText: { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '700' },

  errorText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', textAlign: 'center', marginBottom: 10 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB',
  },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4ECC8B', borderRadius: 16, height: 56,
  },
  payBtnText: { color: INK, fontSize: 16, fontWeight: '800' },
  footerNote: { marginTop: 10, fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16 },
});
