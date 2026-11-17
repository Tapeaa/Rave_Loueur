import type { Order } from '@/lib/types';
import { getRentalLifecyclePhase, isRentalOrderLike } from '@/lib/rental-lifecycle';

export type StatusDisplay = { label: string; color: string; icon: string };

export const CLOSED_ORDER_STATUSES = [
  'completed',
  'payment_confirmed',
  'cancelled',
  'declined',
  'expired',
  'payment_failed',
];

export function isClosedOrderStatus(status: string | undefined | null): boolean {
  return !!status && CLOSED_ORDER_STATUSES.includes(status);
}

const STATUS_LABELS: Record<string, StatusDisplay> = {
  pending: { label: 'À valider', color: '#F59E0B', icon: 'time' },
  accepted: { label: 'Validée', color: '#3B82F6', icon: 'checkmark-circle' },
  booked: { label: 'Réservée', color: '#4ECC8B', icon: 'calendar' },
  in_progress: { label: 'En cours', color: '#10B981', icon: 'navigate' },
  completed: { label: 'Terminée', color: '#22C55E', icon: 'checkmark-done-circle' },
  cancelled: { label: 'Annulée', color: '#EF4444', icon: 'close-circle' },
  declined: { label: 'Refusée', color: '#EF4444', icon: 'hand-left' },
  expired: { label: 'Expirée', color: '#6B7280', icon: 'timer' },
  payment_pending: { label: 'En attente', color: '#F59E0B', icon: 'time' },
  payment_confirmed: { label: 'Confirmée', color: '#22C55E', icon: 'checkmark-circle' },
  payment_failed: { label: 'Échec paiement', color: '#EF4444', icon: 'close-circle' },
};

export function hasPendingCancelRequest(order: Order): boolean {
  return (order.rideOption as any)?.cancelRequest?.status === 'pending' && !isClosedOrderStatus(order.status);
}

/** Statut affiché au loueur : même libellé dans la liste et dans le détail. */
export function getOrderStatusDisplay(order: Order): StatusDisplay {
  const ro = order.rideOption as any;
  if (hasPendingCancelRequest(order)) return { label: 'Annulation demandée', color: '#D97706', icon: 'alert-circle' };
  if (order.status === 'cancelled') {
    const by = ro?.cancellation?.by;
    if (by === 'client') {
      return {
        label: ro?.cancellation?.approvedByDriver ? 'Annulée (demande client)' : 'Annulée par le client',
        color: '#EF4444',
        icon: 'close-circle',
      };
    }
    if (by === 'driver') return { label: 'Annulée par vous', color: '#EF4444', icon: 'close-circle' };
    if (by === 'system') return { label: 'Expirée', color: '#6B7280', icon: 'timer' };
    return STATUS_LABELS.cancelled;
  }
  if (isRentalOrderLike(order) && !isClosedOrderStatus(order.status)) {
    const phase = getRentalLifecyclePhase(order);
    if (phase === 'awaiting_validation') return { label: 'À valider', color: '#F59E0B', icon: 'time' };
    if (phase === 'vehicle_ready' || phase === 'with_client') {
      return { label: 'Location en cours', color: '#10B981', icon: 'car-sport' };
    }
    if (phase === 'returned') return { label: 'Véhicule rendu', color: '#22C55E', icon: 'checkmark-done-circle' };
  }
  return STATUS_LABELS[order.status] || { label: order.status, color: '#6B7280', icon: 'help-circle' };
}
