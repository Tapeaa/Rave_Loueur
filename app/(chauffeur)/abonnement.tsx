import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
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

export default function AbonnementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [info, setInfo] = useState<LoueurSubscriptionInfo | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDriverSubscription();
      setInfo(data);
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        await removeDriverSessionId();
        router.replace('/(chauffeur)/login');
        return;
      }
      Alert.alert('Erreur', 'Impossible de charger l’abonnement');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubscribe = (plan: 'monthly' | 'semiannual', label: string, amount: number) => {
    Alert.alert(
      `Abonnement ${label}`,
      `Confirmer le paiement de ${amount.toLocaleString('fr-FR')} XPF ?\n\nLa période sera activée immédiatement. Réglez ce montant auprès de RAVE.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setSubscribing(plan);
              const sessionId = await getDriverSessionId();
              if (!sessionId) throw new SessionExpiredError();
              const res = await subscribeLoueurPlan(plan);
              Alert.alert('Abonnement activé', res.message || 'Votre abonnement est en cours.');
              await load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Échec de l’activation');
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
    status === 'active'
      ? 'Abonnement en cours'
      : status === 'expired'
        ? 'Abonnement expiré'
        : 'Aucun abonnement';
  const statusColor =
    status === 'active' ? '#22C55E' : status === 'expired' ? '#EF4444' : '#6B7280';

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
              {status === 'active' && info?.daysRemaining != null ? (
                <Text style={styles.statusMeta}>
                  Renouvellement dans {info.daysRemaining} jour
                  {info.daysRemaining > 1 ? 's' : ''}
                  {info.endsAt
                    ? ` (le ${new Date(info.endsAt).toLocaleDateString('fr-FR')})`
                    : ''}
                </Text>
              ) : null}
              {info?.plan ? (
                <Text style={styles.statusMeta}>
                  Formule : {info.plan === 'semiannual' ? '6 mois' : 'Mensuel'}
                  {info.amount != null
                    ? ` · ${info.amount.toLocaleString('fr-FR')} XPF`
                    : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choisir une formule</Text>
          <Text style={styles.hint}>
            Accès plateforme loueur. Paiement hors app auprès de RAVE — la période démarre à la
            confirmation.
          </Text>

          <TouchableOpacity
            style={styles.planCard}
            activeOpacity={0.85}
            disabled={!!subscribing}
            onPress={() => onSubscribe('monthly', 'mensuel', 5000)}
          >
            <View style={styles.planTop}>
              <Text style={styles.planName}>Mensuel</Text>
              {subscribing === 'monthly' ? (
                <ActivityIndicator color="#171717" />
              ) : (
                <Text style={styles.planPrice}>5 000 XPF</Text>
              )}
            </View>
            <Text style={styles.planDesc}>30 jours d’accès · renouvelable</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardHighlight]}
            activeOpacity={0.85}
            disabled={!!subscribing}
            onPress={() => onSubscribe('semiannual', '6 mois', 30000)}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Économie</Text>
            </View>
            <View style={styles.planTop}>
              <Text style={styles.planName}>6 mois</Text>
              {subscribing === 'semiannual' ? (
                <ActivityIndicator color="#171717" />
              ) : (
                <Text style={styles.planPrice}>30 000 XPF</Text>
              )}
            </View>
            <Text style={styles.planDesc}>180 jours · 5 000 XPF / mois équivalent</Text>
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
});
