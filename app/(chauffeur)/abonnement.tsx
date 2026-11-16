import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
  getDriverSessionId,
  getDriverSubscription,
  subscribeLoueurPlan,
  SessionExpiredError,
  removeDriverSessionId,
  type LoueurSubscriptionInfo,
} from '@/lib/api';

type PlanKey = 'monthly' | 'semiannual';

const FALLBACK_PLANS = {
  monthly: { id: 'monthly' as const, label: 'Mensuel', amountXpf: 5000, days: 30 },
  semiannual: { id: 'semiannual' as const, label: '6 mois', amountXpf: 30000, days: 180 },
};

export default function AbonnementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [info, setInfo] = useState<LoueurSubscriptionInfo | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setInfo(data);
      if (data.status === 'active') stopPoll();
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await removeDriverSessionId();
        router.replace('/(chauffeur)/login');
        return;
      }
      if (!opts?.silent) Alert.alert('Erreur', 'Impossible de charger l’abonnement');
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
      if (state === 'active') load();
    });
    return () => {
      sub.remove();
      stopPoll();
    };
  }, [load, stopPoll]);

  const openPayment = async (url?: string | null) => {
    if (!url) return;
    startPoll();
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('Paiement', 'Impossible d’ouvrir le lien Stripe.');
      return;
    }
    await Linking.openURL(url);
  };

  const plans = {
    monthly: info?.plans?.monthly || FALLBACK_PLANS.monthly,
    semiannual: info?.plans?.semiannual || FALLBACK_PLANS.semiannual,
  };

  const onSubscribe = (plan: PlanKey) => {
    const def = plans[plan];
    Alert.alert(
      `Abonnement ${def.label}`,
      `Payer ${def.amountXpf.toLocaleString('fr-FR')} XPF via Stripe ?\n\nDès que le paiement est validé, l’accès à l’app est activé automatiquement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Payer',
          onPress: async () => {
            try {
              setSubscribing(plan);
              const sessionId = await getDriverSessionId();
              if (!sessionId) throw new SessionExpiredError();
              const res = await subscribeLoueurPlan(plan);
              setInfo(res);
              await openPayment(res.paymentUrl || info?.paymentUrl);
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Échec du paiement');
            } finally {
              setSubscribing(null);
            }
          },
        },
      ]
    );
  };

  const status = info?.status || 'none';
  const statusLabel =
    status === 'trial'
      ? 'Essai gratuit 30 jours'
      : status === 'active'
      ? 'Abonnement en cours'
      : status === 'pending'
        ? info?.access
          ? 'Demande en attente — essai encore actif'
          : 'En attente de validation RAVE'
        : status === 'grace'
          ? 'Délai de grâce (5 jours)'
        : status === 'expired'
          ? 'Abonnement expiré — hors catalogue'
          : 'Aucun abonnement';
  const statusColor =
    status === 'active' || status === 'trial'
      ? '#22C55E'
      : status === 'pending' || status === 'grace'
        ? '#F59E0B'
        : status === 'expired'
          ? '#EF4444'
          : '#6B7280';

  const planLabel =
    info?.plan === 'semiannual'
      ? plans.semiannual.label
      : info?.plan === 'monthly'
        ? plans.monthly.label
        : info?.plan || null;

  const monthlyEq =
    plans.semiannual.days > 0
      ? Math.round(plans.semiannual.amountXpf / (plans.semiannual.days / 30))
      : plans.semiannual.amountXpf;

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
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <View style={[styles.statusCard, { borderColor: statusColor + '55' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              {(status === 'active' || status === 'trial') && info?.daysRemaining != null ? (
                <Text style={styles.statusMeta}>
                  {status === 'trial' ? 'Fin d’essai' : 'Renouvellement'} dans {info.daysRemaining} jour
                  {info.daysRemaining > 1 ? 's' : ''}
                  {info.endsAt
                    ? ` (le ${new Date(info.endsAt).toLocaleDateString('fr-FR')})`
                    : ''}
                </Text>
              ) : null}
              {status === 'grace' && info?.graceDaysRemaining != null ? (
                <Text style={styles.statusMeta}>
                  Catalogue encore visible {info.graceDaysRemaining} jour
                  {info.graceDaysRemaining > 1 ? 's' : ''}. Ensuite vos véhicules sont masqués.
                </Text>
              ) : null}
              {status === 'pending' ? (
                <Text style={styles.statusMeta}>
                  {info?.access
                    ? 'Votre essai reste actif. Finalisez le paiement Stripe : l’abonnement s’active instantanément.'
                    : 'Finalisez le paiement Stripe pour réactiver l’accès (véhicules / acceptation).'}
                </Text>
              ) : null}
              {status === 'expired' ? (
                <Text style={styles.statusMeta}>
                  Vos véhicules sont masqués du catalogue public. Choisissez une formule ci-dessous.
                </Text>
              ) : null}
              {planLabel ? (
                <Text style={styles.statusMeta}>
                  Formule : {planLabel}
                  {info?.amount != null
                    ? ` · ${info.amount.toLocaleString('fr-FR')} XPF`
                    : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choisir une formule</Text>
          <Text style={styles.hint}>
            Essai 30 jours à l’ouverture du compte. Ensuite paiement Stripe : l’accès s’active
            dès confirmation du paiement. Après expiration : 5 jours de grâce, puis masquage du
            catalogue.
          </Text>

          {info?.paymentUrl && status !== 'active' ? (
            <TouchableOpacity
              style={styles.payNow}
              activeOpacity={0.85}
              onPress={() => openPayment(info.paymentUrl)}
            >
              <Text style={styles.payNowText}>Payer maintenant avec Stripe</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.planCard}
            activeOpacity={0.85}
            disabled={!!subscribing}
            onPress={() => onSubscribe('monthly')}
          >
            <View style={styles.planTop}>
              <Text style={styles.planName}>{plans.monthly.label}</Text>
              {subscribing === 'monthly' ? (
                <ActivityIndicator color="#171717" />
              ) : (
                <Text style={styles.planPrice}>
                  {plans.monthly.amountXpf.toLocaleString('fr-FR')} XPF
                </Text>
              )}
            </View>
            <Text style={styles.planDesc}>
              {plans.monthly.days} jours d’accès · renouvelable
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardHighlight]}
            activeOpacity={0.85}
            disabled={!!subscribing}
            onPress={() => onSubscribe('semiannual')}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Économie</Text>
            </View>
            <View style={styles.planTop}>
              <Text style={styles.planName}>{plans.semiannual.label}</Text>
              {subscribing === 'semiannual' ? (
                <ActivityIndicator color="#171717" />
              ) : (
                <Text style={styles.planPrice}>
                  {plans.semiannual.amountXpf.toLocaleString('fr-FR')} XPF
                </Text>
              )}
            </View>
            <Text style={styles.planDesc}>
              {plans.semiannual.days} jours · {monthlyEq.toLocaleString('fr-FR')} XPF / mois équivalent
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  content: { padding: 20, paddingBottom: 40 },
  statusCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FAFAFA',
    marginBottom: 28,
    alignItems: 'flex-start',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  statusLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
  statusMeta: { marginTop: 4, fontSize: 13, color: '#6B7280', lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 },
  hint: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  planCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  planCardHighlight: { borderColor: '#171717', backgroundColor: '#FAFAFA' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#171717',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: { fontSize: 18, fontWeight: '800', color: '#111' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#111' },
  planDesc: { marginTop: 6, fontSize: 13, color: '#6B7280' },
  payNow: {
    backgroundColor: '#635BFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  payNowText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
