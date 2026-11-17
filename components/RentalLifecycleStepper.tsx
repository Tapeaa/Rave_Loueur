import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { RentalStepperState } from '@/lib/rental-lifecycle';
import {
  RENTAL_STEP_LABELS_CLIENT,
  RENTAL_STEP_LABELS_LOUEUR,
} from '@/lib/rental-lifecycle';

const ACCENT = '#4ECC8B';

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
  const dotSize = compact ? 22 : 26;

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

      <View style={styles.row}>
        {labels.map((label, i) => {
          const done = state.doneMask[i];
          const current = state.currentStep === i && !state.cancelled && !state.allDone;
          const leftDone = i > 0 && state.doneMask[i - 1];
          const rightDone = done;

          return (
            <View key={i} style={styles.step}>
              <View style={[styles.track, { height: dotSize }]}>
                <View
                  style={[
                    styles.line,
                    i === 0 && styles.lineHidden,
                    leftDone && styles.lineDone,
                    state.cancelled && styles.lineMuted,
                  ]}
                />
                <View
                  style={[
                    styles.dot,
                    { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                    done && styles.dotDone,
                    current && styles.dotCurrent,
                    state.cancelled && styles.dotMuted,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={compact ? 12 : 14} color="#fff" />
                  ) : (
                    <Text style={current ? StyleSheet.flatten([styles.dotNum, styles.dotNumCurrent]) : styles.dotNum}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.line,
                    i === n - 1 && styles.lineHidden,
                    rightDone && styles.lineDone,
                    state.cancelled && styles.lineMuted,
                  ]}
                />
              </View>
              {!compact && (
                <Text
                  variant="caption"
                  numberOfLines={2}
                  style={StyleSheet.flatten([
                    styles.label,
                    done && styles.labelDone,
                    current && styles.labelCurrent,
                    state.cancelled && styles.labelMuted,
                  ])}
                >
                  {label}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  lineHidden: {
    backgroundColor: 'transparent',
  },
  lineDone: {
    backgroundColor: ACCENT,
  },
  lineMuted: {
    opacity: 0.35,
  },
  dot: {
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
  dotNumCurrent: {
    color: ACCENT,
  },
  label: {
    marginTop: 8,
    paddingHorizontal: 2,
    textAlign: 'center',
    fontSize: 11,
    color: '#6B7280',
  },
  labelCurrent: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  labelDone: {
    color: '#374151',
  },
  labelMuted: {
    opacity: 0.5,
  },
});
