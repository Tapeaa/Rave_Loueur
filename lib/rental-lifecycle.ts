import type { Order, RentalLifecyclePhase } from '@/lib/types';

export function isRentalOrderLike(order: {
  orderSource?: string;
  rideOption?: { id?: string; isRentalOrder?: boolean; type?: string };
}): boolean {
  if (order.orderSource === 'rental') return true;
  const ro = order.rideOption;
  if (!ro) return false;
  return (
    ro.isRentalOrder === true ||
    ro.type === 'rental' ||
    ro.id === 'rental'
  );
}

/** Location arrêtée avant son terme (aucune étape ne reste à faire). */
const RENTAL_ENDED_STATUSES: string[] = ['cancelled', 'declined', 'expired', 'payment_failed'];

export function getRentalLifecyclePhase(order: Order): RentalLifecyclePhase | null {
  if (!isRentalOrderLike(order)) return null;
  const ro = order.rideOption as { rentalLifecyclePhase?: RentalLifecyclePhase };
  if (order.status === 'completed') return 'returned';
  if (RENTAL_ENDED_STATUSES.includes(order.status)) return null;
  if (order.status === 'pending') return 'awaiting_validation';
  const fromApi = ro.rentalLifecyclePhase;
  if (fromApi === 'with_client' || fromApi === 'returned') return fromApi;
  if (fromApi === 'vehicle_ready' || fromApi === 'awaiting_validation') return fromApi;
  return 'vehicle_ready';
}

/** Location acceptée et pas encore rendue : `vehicle_ready` et `with_client` forment une seule étape. */
export function isRentalInProgress(phase: RentalLifecyclePhase | null): boolean {
  return phase === 'vehicle_ready' || phase === 'with_client';
}

export const RENTAL_STEP_COUNT = 3;

export type RentalStepperState = {
  show: boolean;
  cancelled: boolean;
  allDone: boolean;
  /** index 0..2 = étape en cours ; null si terminé */
  currentStep: number | null;
  /** étapes entièrement franchies */
  doneMask: [boolean, boolean, boolean];
};

export function getRentalStepperState(order: Order): RentalStepperState {
  const empty: RentalStepperState = {
    show: false,
    cancelled: false,
    allDone: false,
    currentStep: null,
    doneMask: [false, false, false],
  };

  if (!isRentalOrderLike(order)) return empty;

  if (RENTAL_ENDED_STATUSES.includes(order.status)) {
    return { show: true, cancelled: true, allDone: false, currentStep: 0, doneMask: [false, false, false] };
  }

  if (order.status === 'completed') {
    return { show: true, cancelled: false, allDone: true, currentStep: null, doneMask: [true, true, true] };
  }

  const phase = getRentalLifecyclePhase(order);

  if (phase === 'awaiting_validation') {
    return { show: true, cancelled: false, allDone: false, currentStep: 0, doneMask: [false, false, false] };
  }

  if (isRentalInProgress(phase)) {
    return { show: true, cancelled: false, allDone: false, currentStep: 1, doneMask: [true, false, false] };
  }

  if (phase === 'returned') {
    return { show: true, cancelled: false, allDone: false, currentStep: 2, doneMask: [true, true, false] };
  }

  return empty;
}

export const RENTAL_STEP_LABELS_CLIENT = [
  'Validation loueur',
  'Location en cours',
  'Retour',
] as const;

export const RENTAL_STEP_LABELS_LOUEUR = [
  'À valider',
  'Location en cours',
  'Retour',
] as const;
