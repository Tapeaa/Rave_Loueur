import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { RentalStepperState } from '@/lib/rental-lifecycle';
import {
  RENTAL_STEP_LABELS_CLIENT,
  RENTAL_STEP_LABELS_LOUEUR,
} from '@/lib/rental-lifecycle';

const ACCENT = '#8B5CF6';

type Props = {
  state: RentalStepperState;
  variant: 'client' | 'loueur';
  compact?: boolean;
};

export function RentalLifecycleStepper({ state, variant, compact }: Props) {
  if (!state.show) return null;

  const labels =
    variant === 'loueur' ? RENTAL_STEP_LABELS_LOUEUR : RENTAL_STEP_LABELS_CLIENT;
  const n = labels.length;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {state.cancelled && (
        <Text variant="caption" style={styles.cancelBanner}>
          Location annulée ou refusée
        </Text>
      )}
      {state.allDone && !state.cancelled && (
        <Text variant="caption" style={styles.doneBanner}>
          Location terminée
        </Text>
      )}

      <View style={styles.trackRow}>
        {Array.from({ length: n }, (_, i) => {
          const done = state.doneMask[i];
          const current =
            state.currentStep === i && !state.cancelled && !state.allDone;
          const showSegment = i < n - 1;
          const segmentDone = state.doneMask[i];

          return (
            <View key={i} style={styles.trackItem}>
              <View style={styles.dotWrap}>
                <View
                  style={[
                    styles.dot,
                    done && styles.dotDone,
                    current && styles.dotCurrent,
                    state.cancelled && styles.dotMuted,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={compact ? 12 : 14} color="#fff" />
                  ) : (
                    <Text style={styles.dotNum}>{i + 1}</Text>
                  )}
                </View>
              </View>
              {showSegment && (
                <View
                  style={[
                    styles.segment,
                    segmentDone && styles.segmentDone,
                    state.cancelled && styles.segmentMuted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {!compact && (
        <View style={styles.labelsRow}>
          {labels.map((label, i) => {
            const current =
              state.currentStep === i && !state.cancelled && !state.allDone;
            return (
              <View key={i} style={styles.labelCell}>
                <Text
                  variant="caption"
                  numberOfLines={2}
                  style={[
                    styles.label,
                    current ? styles.labelCurrent : null,
                    state.cancelled ? styles.labelMuted : null,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  wrapCompact: {
    paddingVertical: 8,
    marginTop: 6,
  },
  cancelBanner: {
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  doneBanner: {
    color: '#22C55E',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  trackItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  dotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  dotCurrent: {
    borderColor: ACCENT,
    backgroundColor: '#fff',
  },
  dotMuted: {
    opacity: 0.45,
  },
  dotNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  segment: {
    flex: 1,
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    minWidth: 8,
  },
  segmentDone: {
    backgroundColor: ACCENT,
  },
  segmentMuted: {
    opacity: 0.35,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 0,
  },
  labelCell: {
    flex: 1,
    paddingHorizontal: 2,
  },
  label: {
    textAlign: 'center',
    fontSize: 10,
    color: '#6B7280',
  },
  labelCurrent: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  labelMuted: {
    opacity: 0.5,
  },
});
