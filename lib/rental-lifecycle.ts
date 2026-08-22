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

export function getRentalLifecyclePhase(order: Order): RentalLifecyclePhase | null {
  if (!isRentalOrderLike(order)) return null;
  const ro = order.rideOption as { rentalLifecyclePhase?: RentalLifecyclePhase };
  if (order.status === 'completed') return 'returned';
  if (order.status === 'pending') return 'awaiting_validation';
  const fromApi = ro.rentalLifecyclePhase;
  if (fromApi === 'with_client' || fromApi === 'returned') return fromApi;
  if (fromApi === 'vehicle_ready' || fromApi === 'awaiting_validation') return fromApi;
  return 'vehicle_ready';
}

export type RentalStepperState = {
  show: boolean;
  cancelled: boolean;
  allDone: boolean;
  currentStep: number | null;
  doneMask: [boolean, boolean, boolean, boolean];
};

export function getRentalStepperState(order: Order): RentalStepperState {
  const empty: RentalStepperState = {
    show: false,
    cancelled: false,
    allDone: false,
    currentStep: null,
    doneMask: [false, false, false, false],
  };

  if (!isRentalOrderLike(order)) return empty;

  if (order.status === 'cancelled' || order.status === 'declined') {
    return {
      show: true,
      cancelled: true,
      allDone: false,
      currentStep: 0,
      doneMask: [false, false, false, false],
    };
  }

  if (order.status === 'completed') {
    return {
      show: true,
      cancelled: false,
      allDone: true,
      currentStep: null,
      doneMask: [true, true, true, true],
    };
  }

  const phase = getRentalLifecyclePhase(order);

  if (phase === 'awaiting_validation') {
    return {
      show: true,
      cancelled: false,
      allDone: false,
      currentStep: 0,
      doneMask: [false, false, false, false],
    };
  }

  if (phase === 'vehicle_ready') {
    return {
      show: true,
      cancelled: false,
      allDone: false,
      currentStep: 1,
      doneMask: [true, false, false, false],
    };
  }

  if (phase === 'with_client') {
    return {
      show: true,
      cancelled: false,
      allDone: false,
      currentStep: 2,
      doneMask: [true, true, false, false],
    };
  }

  if (phase === 'returned') {
    return {
      show: true,
      cancelled: false,
      allDone: false,
      currentStep: 3,
      doneMask: [true, true, true, false],
    };
  }

  return empty;
}

export const RENTAL_STEP_LABELS_CLIENT = [
  'Validation loueur',
  'Préparation',
  'Avec vous',
  'Retour',
] as const;

export const RENTAL_STEP_LABELS_LOUEUR = [
  'À valider',
  'Validée',
  'Remis client',
  'Retour',
] as const;
