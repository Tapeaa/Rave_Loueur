/**
 * Tarifs dégressifs location (paliers cumulatifs, max 90 jours).
 * Option B : chaque tranche de jours est facturée à son prix/jour.
 * Au-delà du dernier palier (mais ≤ maxRentalDays) : dernier prix.
 */

export type PricingTier = {
  fromDay: number;
  toDay: number;
  pricePerDay: number;
};

export const MAX_RENTAL_DAYS_CAP = 90;

export function normalizePricingTiers(raw: unknown): PricingTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any) => ({
      fromDay: Math.floor(Number(t.fromDay)),
      toDay: Math.floor(Number(t.toDay)),
      pricePerDay: Math.round(Number(t.pricePerDay)),
    }))
    .filter((t) => t.fromDay > 0 && t.toDay >= t.fromDay && t.pricePerDay > 0);
}

/**
 * Valide paliers collés sans trou à partir du jour 1.
 * maxRentalDays ∈ [1, 90], dernier palier.toDay ≤ maxRentalDays.
 */
export function validatePricingTiers(
  tiersInput: unknown,
  maxRentalDaysInput: unknown
): { ok: true; tiers: PricingTier[]; maxRentalDays: number } | { ok: false; error: string } {
  const maxRentalDays = Math.floor(Number(maxRentalDaysInput ?? MAX_RENTAL_DAYS_CAP));
  if (!Number.isFinite(maxRentalDays) || maxRentalDays < 1 || maxRentalDays > MAX_RENTAL_DAYS_CAP) {
    return { ok: false, error: `La durée max de location doit être entre 1 et ${MAX_RENTAL_DAYS_CAP} jours` };
  }

  const tiers = normalizePricingTiers(tiersInput);
  if (tiers.length === 0) {
    return { ok: false, error: "Au moins un palier tarifaire est requis" };
  }

  tiers.sort((a, b) => a.fromDay - b.fromDay);

  if (tiers[0].fromDay !== 1) {
    return { ok: false, error: "Le premier palier doit commencer au jour 1" };
  }

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.toDay > maxRentalDays) {
      return { ok: false, error: `Le palier ${i + 1} dépasse la durée max (${maxRentalDays} jours)` };
    }
    if (i > 0) {
      const prev = tiers[i - 1];
      if (t.fromDay !== prev.toDay + 1) {
        return {
          ok: false,
          error: `Trou entre les paliers : après le jour ${prev.toDay}, le suivant doit commencer au jour ${prev.toDay + 1}`,
        };
      }
    }
  }

  return { ok: true, tiers, maxRentalDays };
}

export type PricingBreakdownLine = {
  fromDay: number;
  toDay: number;
  days: number;
  pricePerDay: number;
  subtotal: number;
};

/**
 * Calcul cumulatif option B pour `days` jours.
 * Si days > dernier palier et days ≤ maxRentalDays → reste au dernier prix.
 */
export function computeDigressiveRentalPrice(params: {
  days: number;
  tiers: PricingTier[];
  maxRentalDays: number;
  fallbackPricePerDay?: number;
}):
  | { ok: true; total: number; averagePerDay: number; breakdown: PricingBreakdownLine[] }
  | { ok: false; error: string } {
  const days = Math.max(1, Math.floor(Number(params.days) || 1));
  const maxRentalDays = Math.min(
    MAX_RENTAL_DAYS_CAP,
    Math.max(1, Math.floor(Number(params.maxRentalDays) || MAX_RENTAL_DAYS_CAP))
  );

  if (days > maxRentalDays) {
    return {
      ok: false,
      error: `Ce véhicule n'est louable que jusqu'à ${maxRentalDays} jour(s)`,
    };
  }

  let tiers = normalizePricingTiers(params.tiers);
  if (tiers.length === 0 && params.fallbackPricePerDay && params.fallbackPricePerDay > 0) {
    tiers = [{ fromDay: 1, toDay: maxRentalDays, pricePerDay: params.fallbackPricePerDay }];
  }
  if (tiers.length === 0) {
    return { ok: false, error: "Aucun tarif défini pour ce véhicule" };
  }

  tiers = [...tiers].sort((a, b) => a.fromDay - b.fromDay);
  const last = tiers[tiers.length - 1];
  const breakdown: PricingBreakdownLine[] = [];
  let total = 0;
  let day = 1;

  while (day <= days) {
    let tier = tiers.find((t) => day >= t.fromDay && day <= t.toDay);
    if (!tier) {
      // Au-delà du dernier palier défini → continuer au dernier prix
      if (day > last.toDay) {
        tier = { fromDay: last.toDay + 1, toDay: maxRentalDays, pricePerDay: last.pricePerDay };
      } else {
        return { ok: false, error: `Pas de tarif pour le jour ${day}` };
      }
    }

    const segmentEnd = Math.min(days, tier.toDay, maxRentalDays);
    const segmentDays = segmentEnd - day + 1;
    const subtotal = segmentDays * tier.pricePerDay;
    breakdown.push({
      fromDay: day,
      toDay: segmentEnd,
      days: segmentDays,
      pricePerDay: tier.pricePerDay,
      subtotal,
    });
    total += subtotal;
    day = segmentEnd + 1;
  }

  return {
    ok: true,
    total,
    averagePerDay: Math.round(total / days),
    breakdown,
  };
}

/** True si la durée franchit au moins un palier (détail à afficher au client). */
export function hasCrossedPricingTier(days: number, tiers: PricingTier[]): boolean {
  const normalized = normalizePricingTiers(tiers);
  if (normalized.length <= 1) return false;
  const sorted = [...normalized].sort((a, b) => a.fromDay - b.fromDay);
  const first = sorted[0];
  return Math.max(1, Math.floor(days)) > first.toDay;
}
