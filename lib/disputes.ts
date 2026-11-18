/** Copie de backend-RAVE/shared/disputes.ts (catégories et libellés des litiges). */

export const DISPUTE_WINDOW_DAYS = 14;
export const DISPUTE_REASON_MIN = 10;

export const DISPUTE_CATEGORIES = [
  { id: 'damage', label: 'Dégâts sur le véhicule' },
  { id: 'deposit', label: 'Caution non rendue ou retenue' },
  { id: 'vehicle_not_compliant', label: 'Véhicule non conforme' },
  { id: 'no_show', label: 'Absence au rendez-vous' },
  { id: 'extra_fees', label: 'Frais contestés' },
  { id: 'other', label: 'Autre' },
] as const;

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number]['id'];

export function disputeCategoryLabel(value: string | null | undefined): string {
  return DISPUTE_CATEGORIES.find((c) => c.id === value)?.label || 'Autre';
}

export const DISPUTE_STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Transmis à RAVE', color: '#B45309', bg: '#FFFBEB' },
  in_review: { label: "En cours d'examen", color: '#1D4ED8', bg: '#EFF6FF' },
  resolved: { label: 'Résolu', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Non retenu', color: '#374151', bg: '#F3F4F6' },
};

export const DISPUTE_OPENER_LABELS: Record<string, string> = {
  client: 'le client',
  driver: 'le loueur',
  admin: "l'équipe RAVE",
};

export type OrderDispute = {
  id: string;
  orderId: string;
  openedBy: string;
  category: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type OrderDisputesResponse = {
  success: boolean;
  disputes: OrderDispute[];
  canOpen: boolean;
  blockedReason: string | null;
  deadline: string | null;
};
