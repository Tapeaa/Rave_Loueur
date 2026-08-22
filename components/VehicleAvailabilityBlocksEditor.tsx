import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import {
  createVehicleAvailabilityBlock,
  deleteVehicleAvailabilityBlock,
  formatBlockRangeLabel,
  getVehicleAvailabilityBlocks,
  type AvailabilityBlock,
} from '@/lib/api';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

type Props = { vehicleId: string };

/**
 * Blocage rapide de dates (résas hors app) — section compacte.
 */
export function VehicleAvailabilityBlocksEditor({ vehicleId }: Props) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startYmd, setStartYmd] = useState(toYmd(new Date()));
  const [endYmd, setEndYmd] = useState(toYmd(new Date()));
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getVehicleAvailabilityBlocks(vehicleId);
      setBlocks(list);
    } catch (e: any) {
      console.warn('[AvailabilityBlocks]', e?.message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdd = async () => {
    if (endYmd < startYmd) {
      Alert.alert('Dates', 'La fin doit être après le début.');
      return;
    }
    try {
      setSaving(true);
      await createVehicleAvailabilityBlock(vehicleId, {
        startDate: startYmd,
        endDate: endYmd,
        reason: reason.trim() || undefined,
      });
      setReason('');
      await load();
      Alert.alert('Bloqué', 'Ces dates sont indisponibles pour les clients.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de bloquer les dates');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (block: AvailabilityBlock) => {
    Alert.alert(
      'Débloquer',
      `Retirer le blocage ${formatBlockRangeLabel(block.startDate, block.endDate)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicleAvailabilityBlock(vehicleId, block.id);
              await load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Suppression impossible');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Indisponibilités</Text>
      <Text style={styles.hint}>
        Bloquez des dates si vous avez une réservation hors RAVE. Le véhicule reste actif le reste
        du temps.
      </Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.dateLabel}>Du</Text>
          <Text style={styles.dateValue}>
            {fromYmd(startYmd).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
          <Text style={styles.dateLabel}>Au</Text>
          <Text style={styles.dateValue}>
            {fromYmd(endYmd).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={fromYmd(startYmd)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) {
              const y = toYmd(date);
              setStartYmd(y);
              if (endYmd < y) setEndYmd(y);
            }
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={fromYmd(endYmd)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={fromYmd(startYmd)}
          onChange={(_, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) setEndYmd(toYmd(date));
          }}
        />
      )}

      <TextInput
        style={styles.reason}
        placeholder="Motif (optionnel) — ex. Résa WhatsApp"
        placeholderTextColor="#9CA3AF"
        value={reason}
        onChangeText={setReason}
      />

      <TouchableOpacity
        style={[styles.addBtn, saving && { opacity: 0.6 }]}
        onPress={onAdd}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Bloquer ces dates</Text>
          </>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} color="#171717" />
      ) : blocks.length === 0 ? (
        <Text style={styles.empty}>Aucun blocage manuel pour l’instant.</Text>
      ) : (
        blocks.map((b) => (
          <View key={b.id} style={styles.blockRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockDates}>
                {formatBlockRangeLabel(b.startDate, b.endDate)}
              </Text>
              {b.reason ? <Text style={styles.blockReason}>{b.reason}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => onDelete(b)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 10,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#9A3412' },
  hint: { fontSize: 12, color: '#9A3412', lineHeight: 17, opacity: 0.85 },
  row: { flexDirection: 'row', gap: 10 },
  dateBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  dateLabel: { fontSize: 11, color: '#9A3412', fontWeight: '600', marginBottom: 2 },
  dateValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  reason: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
  },
  addBtn: {
    backgroundColor: '#171717',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { fontSize: 12, color: '#9A3412', opacity: 0.7 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 10,
  },
  blockDates: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  blockReason: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
