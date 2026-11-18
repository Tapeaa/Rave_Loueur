import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { apiFetch, getDriverSessionId } from '@/lib/api';
import {
  DISPUTE_CATEGORIES,
  DISPUTE_OPENER_LABELS,
  DISPUTE_REASON_MIN,
  DISPUTE_STATUS_DISPLAY,
  DISPUTE_WINDOW_DAYS,
  disputeCategoryLabel,
  type DisputeCategory,
  type OrderDisputesResponse,
} from '@/lib/disputes';

function fmtDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Section « Signaler un problème » d'une location (litige traité par l'équipe RAVE). */
export function DisputeSection({ orderId, selfRole }: { orderId: string; selfRole: 'client' | 'driver' }) {
  const [data, setData] = useState<OrderDisputesResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authOptions = useCallback(async () => {
    const sessionId = await getDriverSessionId();
    return { skipAuth: true, retry: false, headers: sessionId ? { 'X-Driver-Session': sessionId } : undefined };
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<OrderDisputesResponse>(`/api/orders/${encodeURIComponent(orderId)}/disputes`, await authOptions()));
    } catch {
      setData(null);
    }
  }, [orderId, authOptions]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!category) {
      setError('Choisissez le type de problème.');
      return;
    }
    if (reason.trim().length < DISPUTE_REASON_MIN) {
      setError(`Décrivez le problème en quelques phrases (${DISPUTE_REASON_MIN} caractères minimum).`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/disputes`, {
        ...(await authOptions()),
        method: 'POST',
        body: JSON.stringify({ category, reason: reason.trim() }),
      });
      setFormOpen(false);
      setCategory(null);
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer le signalement.");
    } finally {
      setSending(false);
    }
  };

  if (!data || (data.disputes.length === 0 && !data.canOpen)) return null;

  return (
    <Card style={styles.wrap}>
      <Text style={styles.title}>Un problème avec cette location ?</Text>

      {data.disputes.map((d) => {
        const st = DISPUTE_STATUS_DISPLAY[d.status] || DISPUTE_STATUS_DISPLAY.open;
        const mine = d.openedBy === selfRole;
        return (
          <View key={d.id} style={[styles.item, { backgroundColor: st.bg }]}>
            <View style={styles.itemHeader}>
              <Text style={[styles.badge, { color: st.color }]}>{st.label}</Text>
              <Text style={styles.meta}>
                {mine ? 'Votre signalement' : `Signalé par ${DISPUTE_OPENER_LABELS[d.openedBy] || 'RAVE'}`} · {fmtDate(d.createdAt)}
              </Text>
            </View>
            <Text style={styles.category}>{disputeCategoryLabel(d.category)}</Text>
            <Text style={styles.reason}>{d.reason}</Text>
            {d.resolution ? (
              <View style={styles.resolution}>
                <Text style={styles.resolutionLabel}>Décision de RAVE</Text>
                <Text style={styles.reason}>{d.resolution}</Text>
              </View>
            ) : d.status === 'open' || d.status === 'in_review' ? (
              <Text style={styles.meta}>L'équipe RAVE va contacter les deux parties puis vous donner sa décision ici.</Text>
            ) : null}
          </View>
        );
      })}

      {data.canOpen && !formOpen && (
        <TouchableOpacity style={styles.openButton} onPress={() => setFormOpen(true)} activeOpacity={0.8}>
          <Ionicons name="flag-outline" size={18} color="#B45309" />
          <Text style={styles.openButtonText}>Signaler un problème</Text>
        </TouchableOpacity>
      )}
      {data.canOpen && !formOpen && (
        <Text style={styles.hint}>
          Dégâts, caution, véhicule non conforme… possible jusqu'à {DISPUTE_WINDOW_DAYS} jours après la fin de la location
          {data.deadline ? ` (jusqu'au ${fmtDate(data.deadline)})` : ''}.
        </Text>
      )}

      {formOpen && (
        <View style={styles.form}>
          <Text style={styles.label}>Type de problème</Text>
          <View style={styles.chips}>
            {DISPUTE_CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={active ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Que s'est-il passé ?</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={2000}
            placeholder="Décrivez le problème le plus précisément possible"
            placeholderTextColor="#9CA3AF"
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.formActions}>
            <TouchableOpacity
              onPress={() => {
                setFormOpen(false);
                setError(null);
              }}
              style={styles.cancelButton}
              disabled={sending}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[styles.submitButton, sending && { opacity: 0.6 }]} disabled={sending}>
              {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.submitText}>Envoyer à RAVE</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  item: { borderRadius: 12, padding: 12, gap: 4 },
  itemHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  badge: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 12, color: '#6B7280' },
  category: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reason: { fontSize: 14, color: '#374151', lineHeight: 20 },
  resolution: { marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D1D5DB', gap: 2 },
  resolutionLabel: { fontSize: 12, fontWeight: '700', color: '#047857' },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingVertical: 12,
  },
  openButtonText: { fontSize: 15, fontWeight: '600', color: '#B45309' },
  hint: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { borderColor: '#171717', backgroundColor: '#171717' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  error: { fontSize: 13, color: '#DC2626' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12, backgroundColor: '#F3F4F6' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  submitButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12, backgroundColor: '#171717' },
  submitText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
