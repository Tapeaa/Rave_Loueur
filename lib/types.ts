export interface Client {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isVerified: boolean;
  walletBalance: number;
  averageRating: number | null;
  totalRides: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  phone: string;
  code: string;
  password?: string | null;
  firstName: string;
  lastName: string;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  isActive: boolean;
  averageRating: number | null;
  totalRides: number;
  cguAccepted?: boolean;
  cguAcceptedAt?: string | null;
  cguVersion?: string | null;
  privacyPolicyRead?: boolean;
  privacyPolicyReadAt?: string | null;
  privacyPolicyVersion?: string | null;
  createdAt: string;
}

export interface DriverSession {
  id: string;
  driverId: string;
  driverName: string;
  isOnline: boolean;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface ClientSession {
  id: string;
  clientId: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AddressField {
  id: string;
  value: string;
  placeId: string | null;
  type: 'pickup' | 'stop' | 'destination';
  lat?: number;
  lng?: number;
}

export interface RideOption {
  id: string;
  title: string;
  duration: string;
  capacity: string;
  basePrice: number;
  pricePerKm: number;
}

export interface Supplement {
  id: string;
  name: string;
  icon: 'bagages' | 'encombrants';
  price: number;
  quantity: number;
}

export interface RouteInfo {
  distance: number;
  duration: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'booked'        // ═══ RÉSERVATION À L'AVANCE: Course réservée, en attente du démarrage ═══
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'driver_enroute'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'payment_failed';

export interface Order {
  id: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  clientPhotoUrl?: string | null;
  // Enriched client info from API
  client?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    photoUrl?: string | null;
    averageRating?: number | null;
  };
  addresses: AddressField[];
  rideOption: {
    id: string;
    title: string;
    price: number;
    pricePerKm: number;
    basePrice: number;
    description?: string;
  };
  routeInfo?: RouteInfo;
  passengers: number;
  supplements: Supplement[];
  paymentMethod: 'cash' | 'card';
  totalPrice: number;
  driverEarnings: number;
  waitingTimeMinutes?: number | null;
  driverArrivedAt?: string | null;
  driverComment?: string | null; // Message du client pour le chauffeur
  scheduledTime: string | null;
  isAdvanceBooking: boolean;
  status: OrderStatus;
  assignedDriverId: string | null;
  clientRatingId: string | null;
  driverRatingId: string | null;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  estimatedDuration?: number;  // en minutes
  estimatedDistance?: number;  // en mètres
  driverName?: string;
}

export interface PaymentMethod {
  id: string;
  clientId: string;
  stripePaymentMethodId: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  orderId: string;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  pdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface WalletTransaction {
  id: string;
  clientId: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  description: string;
  orderId: string | null;
  createdAt: string;
}

export interface LocationUpdate {
  orderId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export const RIDE_OPTIONS: RideOption[] = [
  {
    id: 'immediate',
    title: 'Taxi immédiat',
    duration: '10 - 20 min',
    capacity: '1 - 8 passagers',
    basePrice: 2300,
    pricePerKm: 150,
  },
  {
    id: 'reservation',
    title: 'Réservation à l\'avance',
    duration: '45 - 1h',
    capacity: '1 - 8 passagers',
    basePrice: 2300,
    pricePerKm: 150,
  },
  {
    id: 'tour',
    title: 'Tour de l\'Île',
    duration: '45 - 1h',
    capacity: '4 - 8 passagers',
    basePrice: 30000,
    pricePerKm: 0,
  },
];

export const SUPPLEMENTS = [
  { id: 'bagages', name: 'Bagages', icon: 'bagages' as const, price: 100 },
  { id: 'encombrants', name: 'Encombrants', icon: 'encombrants' as const, price: 200 },
];

export function calculatePrice(
  rideOption: RideOption,
  distanceKm: number,
  supplements: Supplement[]
): { totalPrice: number; driverEarnings: number } {
  const basePrice = rideOption.basePrice;
  const distancePrice = distanceKm * rideOption.pricePerKm;
  const supplementsTotal = supplements.reduce(
    (sum, s) => sum + s.price * s.quantity,
    0
  );

  const totalPrice = basePrice + distancePrice + supplementsTotal;
  const driverEarnings = Math.round(totalPrice * 0.8);

  return { totalPrice, driverEarnings };
}
