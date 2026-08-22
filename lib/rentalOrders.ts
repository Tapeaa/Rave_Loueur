/**
 * Commandes de location (app client RAVE) → format Order pour l’UI loueur.
 * Contrat API attendu : voir getPendingRentalOrders dans api.ts
 */
import type { Order, OrderStatus, AddressField, Supplement } from './types';

export interface RentalOrderApiVehicle {
  model?: string;
  year?: number;
  category?: string;
  categoryLabel?: string;
}

export interface RentalOrderApiClient {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  age?: number;
}

export interface RentalOrderApiRental {
  startDate?: string;
  endDate?: string;
  days?: number;
  pickupLocation?: string;
}

export interface RentalOrderApiPricing {
  pricePerDay?: number;
  subtotal?: number;
  supplementsTotal?: number;
  grandTotal?: number;
  deposit?: number;
  km?: number;
}

export interface RentalOrderApiSupplement {
  id?: string;
  name?: string;
  pricePerDay?: number;
  total?: number;
}

/** Payload renvoyé par GET /api/rental-orders/pending (aligné sur le POST client) */
export interface RentalOrderApi {
  id: string;
  type?: string;
  status?: string;
  vehicle?: RentalOrderApiVehicle;
  client?: RentalOrderApiClient;
  rental?: RentalOrderApiRental;
  pricing?: RentalOrderApiPricing;
  supplements?: RentalOrderApiSupplement[];
  owner?: { id?: string; name?: string };
  scheduledTime?: string | null;
  isAdvanceBooking?: boolean;
  createdAt?: string;
  expiresAt?: string;
  /** Routage backend : targeted (une annonce) vs broadcast (même modèle, contrat app) */
  rentalDispatch?: {
    mode?: 'targeted' | 'broadcast';
    vehicleModelId?: string;
    targetPrestataireId?: string;
    targetLoueurVehicleId?: string;
    contractType?: 'app_default' | 'custom';
    rentalDeclinedBy?: string[];
  };
}

export function isRentalDriverOrder(order: Order): boolean {
  return order.orderSource === 'rental' || order.rideOption?.id === 'rental';
}

export function rentalOrderToDriverOrder(r: RentalOrderApi): Order {
  const pickup = r.rental?.pickupLocation?.trim() || 'Lieu de retrait';
  const end = r.rental?.endDate ? new Date(r.rental.endDate) : null;
  const days = r.rental?.days ?? 1;
  const destinationLine = end
    ? `${days} jour(s) — retour le ${end.toLocaleDateString('fr-FR', { timeZone: 'Pacific/Tahiti' })}`
    : `Location ${days} jour(s)`;

  const addresses: AddressField[] = [
    {
      id: `${r.id}-pickup`,
      value: pickup,
      placeId: null,
      type: 'pickup',
    },
    {
      id: `${r.id}-dest`,
      value: destinationLine,
      placeId: null,
      type: 'destination',
    },
  ];

  const supplements: Supplement[] = (r.supplements || []).map((s, i) => ({
    id: s.id || `s-${i}`,
    name: s.name || 'Option',
    icon: 'bagages',
    price: s.total ?? s.pricePerDay ?? 0,
    quantity: 1,
  }));

  const vehicleLabel = [r.vehicle?.model, r.vehicle?.year?.toString()]
    .filter(Boolean)
    .join(' ');
  const title =
    vehicleLabel ||
    r.vehicle?.categoryLabel ||
    r.vehicle?.category ||
    'Demande de location';

  const grandTotal = r.pricing?.grandTotal ?? r.pricing?.subtotal ?? 0;
  const subtotal = r.pricing?.subtotal ?? grandTotal;

  const mappedStatus: OrderStatus =
    r.status === 'accepted' ? 'accepted' : 'pending';

  return {
    id: r.id,
    clientId: null,
    clientName: `${r.client?.firstName ?? ''} ${r.client?.lastName ?? ''}`.trim() || 'Client',
    clientPhone: r.client?.phone ?? '',
    addresses,
    rideOption: {
      id: 'rental',
      title,
      price: grandTotal,
      pricePerKm: 0,
      basePrice: subtotal,
      description: r.vehicle?.categoryLabel,
      isRentalOrder: true,
      type: 'rental',
    },
    passengers: 1,
    supplements,
    paymentMethod: 'cash',
    totalPrice: grandTotal,
    driverEarnings: grandTotal,
    scheduledTime: r.rental?.startDate ?? r.scheduledTime ?? null,
    isAdvanceBooking: r.isAdvanceBooking !== false,
    status: mappedStatus,
    assignedDriverId: null,
    clientRatingId: null,
    driverRatingId: null,
    createdAt: r.createdAt ?? new Date().toISOString(),
    expiresAt: r.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    orderSource: 'rental',
    estimatedDistance: undefined,
    estimatedDuration: undefined,
    rentalRawData: {
      clientEmail: r.client?.email,
      clientAge: r.client?.age,
      pricePerDay: r.pricing?.pricePerDay,
      endDate: r.rental?.endDate,
      deposit: r.pricing?.deposit != null ? `${r.pricing.deposit.toLocaleString('fr-FR')} XPF` : undefined,
      km: r.pricing?.km != null ? `${r.pricing.km} km / jour` : undefined,
      vehicleCategory: r.vehicle?.categoryLabel || r.vehicle?.category,
      ownerName: r.owner?.name,
      supplementsTotal: r.pricing?.supplementsTotal,
      subtotal: r.pricing?.subtotal,
      supplements: r.supplements?.map(s => ({
        id: s.id, name: s.name, pricePerDay: s.pricePerDay, total: s.total,
      })),
      rentalDispatch: r.rentalDispatch,
    },
  };
}
