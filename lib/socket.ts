import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import type { Order, LocationUpdate } from './types';

const API_URL = Constants.expoConfig?.extra?.apiUrl || '';

// Extract base URL for Socket.IO (remove /api suffix if present)
function getSocketIOUrl(): string {
  const baseUrl = API_URL.replace(/\/api\/?$/, ''); // Remove /api suffix
  // If baseUrl is empty or just a protocol, use default
  if (!baseUrl || baseUrl === 'http://' || baseUrl === 'https://') {
    return 'https://back-end-tapea.onrender.com';
  }
  return baseUrl;
}

const SOCKET_IO_URL = getSocketIOUrl();

let socket: Socket | null = null;

// Stockage des callbacks pour réinscription après reconnexion (avec clé unique pour éviter les doublons)
const reconnectCallbacks: Map<string, () => void> = new Map();

// Fonction pour réinscrire tous les listeners après reconnexion
function rejoinRoomsAfterReconnect() {
  reconnectCallbacks.forEach((callback, key) => {
    try {
      console.log(`[Socket] Re-executing reconnect callback: ${key}`);
      callback();
    } catch (error) {
      console.error(`[Socket] Error re-executing reconnect callback ${key}:`, error);
    }
  });
}

// Ajouter un callback de reconnexion avec une clé unique
function addReconnectCallback(key: string, callback: () => void) {
  reconnectCallbacks.set(key, callback);
}

// Supprimer un callback de reconnexion
function removeReconnectCallback(key: string) {
  reconnectCallbacks.delete(key);
}

export function getSocket(): Socket {
  if (!socket) {
    console.log(`[Socket] Initializing Socket.IO connection to: ${SOCKET_IO_URL}`);
    socket = io(SOCKET_IO_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Tentatives infinies
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Max 10 secondes entre tentatives
      timeout: 120000, // 120 secondes (2 minutes) - compatible avec le backend pingTimeout
      forceNew: false, // Réutiliser la connexion si possible
      // Configuration pour éviter les déconnexions fréquentes (compatible avec le backend)
      upgrade: true, // Permettre l'upgrade vers websocket
      rememberUpgrade: true, // Se souvenir de l'upgrade
    });

    // Gestion des événements de reconnexion
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      // Réinscrire tous les listeners après reconnexion
      rejoinRoomsAfterReconnect();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Le serveur a déconnecté, reconnecter manuellement
        socket?.connect();
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      // Réinscrire tous les listeners après reconnexion
      rejoinRoomsAfterReconnect();
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
    });

    socket.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
      // Essayer de reconnecter manuellement après un délai
      setTimeout(() => {
        if (socket && !socket.connected) {
          console.log('[Socket] Attempting manual reconnection...');
          socket.connect();
        }
      }, 5000);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      // Log more details for debugging
      if (error.message.includes('Invalid namespace')) {
        console.error(`[Socket] Invalid namespace error - URL used: ${SOCKET_IO_URL}`);
        console.error(`[Socket] API_URL was: ${API_URL}`);
      }
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export async function connectSocketAsync(): Promise<Socket> {
  const s = getSocket();

  if (s.connected) {
    return s;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 30000); // 30 secondes - plus long pour tolérer les connexions lentes

    s.once('connect', () => {
      clearTimeout(timeout);
      console.log('Socket connected successfully');
      resolve(s);
    });

    s.once('connect_error', (error) => {
      clearTimeout(timeout);
      console.error('Socket connection error:', error);
      reject(error);
    });

    s.connect();
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export async function joinDriverSessionAsync(sessionId: string): Promise<boolean> {
  try {
    const s = await connectSocketAsync();

    return new Promise((resolve) => {
      s.emit('driver:join', { sessionId }, (ack: { success: boolean }) => {
        if (ack?.success) {
          console.log('Joined driver session successfully:', sessionId);
          resolve(true);
        } else {
          console.warn('Join driver session failed:', sessionId);
          resolve(false);
        }
      });

      setTimeout(() => {
        console.log('Join session no ack, assuming success');
        resolve(true);
      }, 3000);
    });
  } catch (error) {
    console.error('Failed to join driver session:', error);
    return false;
  }
}

export function joinDriverSession(sessionId: string): void {
  const s = getSocket();
  
  const joinSession = () => {
    if (s.connected) {
      s.emit('driver:join', { sessionId });
      console.log(`[Socket] Driver joined session: ${sessionId}`);
    }
  };

  // Enregistrer le callback avec une clé unique pour éviter les doublons
  addReconnectCallback(`driver-session-${sessionId}`, joinSession);

  if (s.connected) {
    joinSession();
  } else {
    s.once('connect', joinSession);
    s.connect();
  }
}

export function updateDriverStatus(sessionId: string, isOnline: boolean): void {
  const s = getSocket();
  
  const emitStatus = () => {
    s.emit('driver:status', { sessionId, isOnline });
    console.log(`[Socket] Driver status updated: ${isOnline ? 'ONLINE' : 'OFFLINE'} for session ${sessionId}`);
  };
  
  if (s.connected) {
    emitStatus();
  } else {
    // Si pas connecté, connecter et envoyer le statut une fois connecté
    console.log('[Socket] Not connected, connecting to update status...');
    s.once('connect', () => {
      // Rejoindre la session d'abord
      s.emit('driver:join', { sessionId });
      // Puis mettre à jour le statut
      setTimeout(emitStatus, 100);
    });
    s.connect();
  }
}

// Version asynchrone qui garantit la connexion et le join avant d'envoyer le statut
export async function updateDriverStatusAsync(sessionId: string, isOnline: boolean): Promise<boolean> {
  try {
    const s = getSocket();
    
    // Si déjà connecté, envoyer directement
    if (s.connected) {
      s.emit('driver:status', { sessionId, isOnline });
      console.log(`[Socket] Driver status updated (async): ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      return true;
    }
    
    // Sinon, attendre la connexion
    try {
      await connectSocketAsync();
    } catch (error) {
      // Si la connexion échoue, essayer quand même d'envoyer le statut
      // Socket.IO va peut-être se reconnecter automatiquement
      console.warn('[Socket] Connection failed, but will try to send status anyway:', error);
    }
    
    // Attendre un peu que Socket.IO se connecte (si pas déjà connecté)
    let attempts = 0;
    const maxAttempts = 10; // 5 secondes max (10 * 500ms)
    while (!s.connected && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    if (!s.connected) {
      console.warn('[Socket] Socket not connected after waiting, status update may fail');
      // Essayer quand même d'envoyer - Socket.IO peut gérer ça
    }
    
    // Rejoindre la session (toujours le faire pour être sûr)
    await new Promise<void>((resolve) => {
      s.emit('driver:join', { sessionId }, (ack: { success: boolean }) => {
        console.log(`[Socket] Driver join ack: ${ack?.success}`);
        resolve();
      });
      // Timeout si pas de réponse
      setTimeout(resolve, 2000);
    });
    
    // Envoyer le statut
    s.emit('driver:status', { sessionId, isOnline });
    console.log(`[Socket] Driver status updated (async): ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    return true;
  } catch (error) {
    console.error('[Socket] Failed to update driver status async:', error);
    return false;
  }
}

export function acceptOrder(orderId: string, sessionId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('order:accept', { orderId, sessionId });
  }
}

export function declineOrder(orderId: string, sessionId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('order:decline', { orderId, sessionId });
  }
}

export function onNewOrder(callback: (order: Order) => void): () => void {
  const s = getSocket();
  s.on('order:new', callback);
  return () => s.off('order:new', callback);
}

export function onPendingOrders(callback: (orders: Order[]) => void): () => void {
  const s = getSocket();
  s.on('orders:pending', callback);
  return () => s.off('orders:pending', callback);
}

export function onOrderTaken(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on('order:taken', callback);
  return () => s.off('order:taken', callback);
}

export function onOrderExpired(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on('order:expired', callback);
  return () => s.off('order:expired', callback);
}

export function onOrderAcceptSuccess(callback: (order: Order) => void): () => void {
  const s = getSocket();
  s.on('order:accept:success', callback);
  return () => s.off('order:accept:success', callback);
}

// ═══════════════════════════════════════════════════════════════════════════
// RÉSERVATION À L'AVANCE: Listener pour la confirmation de réservation
// ═══════════════════════════════════════════════════════════════════════════
export function onOrderBookedSuccess(callback: (order: Order) => void): () => void {
  const s = getSocket();
  s.on('order:booked:success', callback);
  return () => s.off('order:booked:success', callback);
}

// RÉSERVATION À L'AVANCE: Listener pour le rappel 30 minutes avant
export function onReservationReminder(callback: (data: { 
  order: Order; 
  scheduledTime: string; 
  minutesUntil: number 
}) => void): () => void {
  const s = getSocket();
  s.on('reservation:reminder', callback);
  return () => s.off('reservation:reminder', callback);
}

export function onOrderAcceptError(callback: (data: { message: string }) => void): () => void {
  const s = getSocket();
  s.on('order:accept:error', callback);
  return () => s.off('order:accept:error', callback);
}

export function joinClientSession(orderId: string, clientToken?: string): void {
  const s = getSocket();
  
  const joinSession = () => {
    if (s.connected) {
      s.emit('client:join', { orderId, clientToken });
      console.log(`[Socket] Client joined session: ${orderId} with token: ${clientToken ? 'yes' : 'no'}`);
    }
  };

  // Enregistrer le callback avec une clé unique pour éviter les doublons
  addReconnectCallback(`client-session-${orderId}`, joinSession);

  if (s.connected) {
    joinSession();
  } else {
    s.once('connect', joinSession);
    s.connect();
  }
}

export function onClientJoinError(
  callback: (data: { message: string }) => void
): () => void {
  const s = getSocket();
  s.on('client:join:error', callback);
  return () => s.off('client:join:error', callback);
}

export function onDriverAssigned(
  callback: (data: {
    orderId: string;
    driverName: string;
    driverId: string;
    sessionId: string;
  }) => void
): () => void {
  const s = getSocket();
  s.on('order:driver:assigned', callback);
  return () => s.off('order:driver:assigned', callback);
}

export function updateRideStatus(
  orderId: string,
  sessionId: string,
  status: 'enroute' | 'arrived' | 'inprogress' | 'completed',
  waitingTimeMinutes?: number,
  driverArrivedAt?: string
): void {
  const s = getSocket();
  if (s.connected) {
    const payload: Record<string, unknown> = { orderId, sessionId, status };
    if (waitingTimeMinutes !== undefined) payload.waitingTimeMinutes = waitingTimeMinutes;
    if (driverArrivedAt) payload.driverArrivedAt = driverArrivedAt;
    console.log('[SOCKET] Emitting ride:status:update:', { orderId, status, driverArrivedAt: !!driverArrivedAt, connected: s.connected });
    s.emit('ride:status:update', payload);
  } else {
    console.warn('[SOCKET] Cannot emit ride:status:update - socket not connected');
  }
}

export function joinRideRoom(
  orderId: string,
  role: 'driver' | 'client' = 'driver',
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  const payload = { orderId, role, ...credentials };

  const joinRoom = () => {
    if (s.connected) {
      s.emit('ride:join', payload);
      console.log(`[Socket] Joined ride room: ${orderId} as ${role}`);
    }
  };

  // Enregistrer le callback avec une clé unique pour éviter les doublons
  addReconnectCallback(`ride-room-${orderId}-${role}`, joinRoom);

  if (s.connected) {
    joinRoom();
  } else {
    s.once('connect', joinRoom);
    s.connect();
  }
}

export function onRideStatusChanged(
  callback: (data: {
    orderId: string;
    status: 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'cancelled';
    orderStatus: string;
    driverName: string;
    statusTimestamp?: number;
    totalPrice?: number;
    driverEarnings?: number;
    waitingTimeMinutes?: number;
    driverArrivedAt?: string;
  }) => void
): () => void {
  const s = getSocket();
  s.on('ride:status:changed', callback);
  return () => s.off('ride:status:changed', callback);
}

export function confirmPayment(
  orderId: string,
  confirmed: boolean,
  role: 'driver' | 'client',
  credentials?: { sessionId?: string; clientToken?: string },
  paymentMethod?: 'card' | 'cash'
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('payment:confirm', { orderId, confirmed, role, paymentMethod, ...credentials });
  }
}

export function onPaymentStatus(
  callback: (data: {
    orderId: string;
    status: string;
    confirmed: boolean;
    driverConfirmed?: boolean;
    clientConfirmed?: boolean;
    amount?: number;
    paymentMethod?: string;
    cardBrand?: string | null;
    cardLast4?: string | null;
    errorMessage?: string;
  }) => void
): () => void {
  const s = getSocket();
  s.on('payment:status', callback);
  return () => s.off('payment:status', callback);
}

export function retryPayment(orderId: string, clientToken: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('payment:retry', { orderId, clientToken });
  }
}

export function switchToCashPayment(orderId: string, clientToken: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('payment:switch-cash', { orderId, clientToken });
    console.log(`[Socket] payment:switch-cash emitted for order ${orderId}`);
  }
}

export function onPaymentRetryReady(
  callback: (data: {
    orderId: string;
    message: string;
  }) => void
): () => void {
  const s = getSocket();
  s.on('payment:retry:ready', callback);
  return () => s.off('payment:retry:ready', callback);
}

export function onPaymentSwitchedToCash(
  callback: (data: {
    orderId: string;
    amount: number;
    message: string;
  }) => void
): () => void {
  const s = getSocket();
  s.on('payment:switched-to-cash', callback);
  return () => s.off('payment:switched-to-cash', callback);
}

export function cancelRide(
  orderId: string,
  role: 'driver' | 'client',
  reason?: string,
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('ride:cancel', { orderId, role, reason, ...credentials });
  }
}

export function onRideCancelled(
  callback: (data: {
    orderId: string;
    cancelledBy: 'driver' | 'client';
    reason: string;
  }) => void
): () => void {
  const s = getSocket();
  
  // Wrapper pour ajouter des logs
  const wrappedCallback = (data: {
    orderId: string;
    cancelledBy: 'driver' | 'client';
    reason: string;
  }) => {
    console.log('[Socket] ride:cancelled event received:', data);
    callback(data);
  };
  
  s.on('ride:cancelled', wrappedCallback);
  console.log('[Socket] onRideCancelled listener registered');
  
  return () => {
    s.off('ride:cancelled', wrappedCallback);
    console.log('[Socket] onRideCancelled listener unregistered');
  };
}

export function emitDriverLocation(
  orderId: string,
  sessionId: string,
  lat: number,
  lng: number,
  heading?: number,
  speed?: number
): void {
  const s = getSocket();
  if (s.connected) {
    console.log('[SOCKET] Emitting driver location:', { orderId, lat, lng, heading, connected: s.connected });
    s.emit('location:driver:update', {
      orderId,
      sessionId,
      lat,
      lng,
      heading,
      speed,
      timestamp: Date.now(),
    });
  } else {
    console.warn('[SOCKET] Cannot emit driver location - socket not connected');
  }
}

export function emitClientLocation(
  orderId: string,
  clientToken: string,
  lat: number,
  lng: number
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('location:client:update', {
      orderId,
      clientToken,
      lat,
      lng,
      timestamp: Date.now(),
    });
  }
}

export function onDriverLocationUpdate(callback: (data: LocationUpdate) => void): () => void {
  const s = getSocket();
  s.on('location:driver', callback);
  return () => s.off('location:driver', callback);
}

export function onClientLocationUpdate(callback: (data: LocationUpdate) => void): () => void {
  const s = getSocket();
  s.on('location:client', callback);
  return () => s.off('location:client', callback);
}

// ═══════════════════════════════════════════════════════════════════════════
// RÉSERVATION À L'AVANCE: Listener pour le rappel de démarrage de réservation
// ═══════════════════════════════════════════════════════════════════════════
export function onBookingStartReminder(
  callback: (data: {
    orderId: string;
    order: Order;
    scheduledTime: string;
    minutesUntilStart: number;
    timestamp: number;
  }) => void
): () => void {
  const s = getSocket();
  const handler = (data: any) => {
    console.log('[Socket] Booking start reminder received:', data.orderId);
    callback(data);
  };
  s.on('booking:start:reminder', handler);
  return () => s.off('booking:start:reminder', handler);
}

export function calculateHeading(
  prevLat: number,
  prevLng: number,
  currLat: number,
  currLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(currLng - prevLng);
  const lat1 = toRad(prevLat);
  const lat2 = toRad(currLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
