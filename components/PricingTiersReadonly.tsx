import { View, StyleSheet, Text as RNText } from 'react-native';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import type { PricingTier } from '@/lib/rental-pricing';
import { normalizePricingTiers } from '@/lib/rental-pricing';

type Props = {
  tiers?: PricingTier[] | null;
  maxRentalDays?: number | null;
  pricePerDay?: number | null;
};

/** Affichage lecture seule des paliers + renvoi dashboard pour modification. */
export function PricingTiersReadonly({ tiers, maxRentalDays, pricePerDay }: Props) {
  const maxDays = Math.min(90, Math.max(1, Number(maxRentalDays) || 90));
  let list = normalizePricingTiers(tiers);
  if (list.length === 0 && pricePerDay && pricePerDay > 0) {
    list = [{ fromDay: 1, toDay: maxDays, pricePerDay }];
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Tarification dégressive</Text>
      <Text style={styles.meta}>Durée max. de location : {maxDays} jours</Text>
      {list.length === 0 ? (
        <Text style={styles.empty}>Aucun palier défini</Text>
      ) : (
        list.map((t, i) => (
          <View key={`${t.fromDay}-${t.toDay}-${i}`} style={styles.row}>
            <RNText style={styles.rowLabel}>
              Jours {t.fromDay}–{t.toDay}
            </RNText>
            <RNText style={styles.rowValue}>{t.pricePerDay.toLocaleString('fr-FR')} XPF/j</RNText>
          </View>
        ))
      )}
      <Text style={styles.hint}>
        Pour modifier les paliers, veuillez vous connecter au dashboard web.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: BRAND.greenSoft,
    borderWidth: 1,
    borderColor: BRAND.greenMuted,
    gap: 6,
  },
  title: { fontSize: 15, fontWeight: '700', color: BRAND.black },
  meta: { fontSize: 12, color: BRAND.muted, marginBottom: 4 },
  empty: { fontSize: 13, color: BRAND.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: '#374151' },
  rowValue: { fontSize: 13, fontWeight: '700', color: BRAND.green },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
