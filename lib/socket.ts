import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import type { Order } from './types';
import { rentalOrderToDriverOrder, type RentalOrderApi } from './rentalOrders';

const API_URL = Constants.expoConfig?.extra?.apiUrl || '';

// Extract base URL for Socket.IO (remove /api suffix if present)
function getSocketIOUrl(): string {
  const baseUrl = API_URL.replace(/\/api\/?$/, ''); // Remove /api suffix
  // If baseUrl is empty or just a protocol, use default
  if (!baseUrl || baseUrl === 'http://' || baseUrl === 'https://') {
    return 'https://backend-rave.onrender.com';
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

/** Nouvelle demande de location RAVE (tous les loueurs en ligne pour l’instant) */
export function onNewRentalOrder(callback: (order: Order) => void): () => void {
  const s = getSocket();
  const handler = (payload: RentalOrderApi) => {
    try {
      callback(rentalOrderToDriverOrder(payload));
    } catch (e) {
      console.warn('[Socket] rental-order:new parse error', e);
    }
  };
  s.on('rental-order:new', handler);
  return () => s.off('rental-order:new', handler);
}

export function onRentalOrdersPending(callback: (orders: Order[]) => void): () => void {
  const s = getSocket();
  const handler = (list: RentalOrderApi[]) => {
    try {
      callback((Array.isArray(list) ? list : []).map(rentalOrderToDriverOrder));
    } catch (e) {
      console.warn('[Socket] rental-orders:pending parse error', e);
    }
  };
  s.on('rental-orders:pending', handler);
  return () => s.off('rental-orders:pending', handler);
}

export function onRentalOrderTaken(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on('rental-order:taken', callback);
  return () => s.off('rental-order:taken', callback);
}

export function onRentalOrderExpired(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on('rental-order:expired', callback);
  return () => s.off('rental-order:expired', callback);
}

export function onRentalOrderCancelled(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on('rental-order:cancelled', callback);
  return () => s.off('rental-order:cancelled', callback);
}

export interface CancelRequestData {
  orderId: string;
  reason: string;
  clientName: string;
  clientPhone: string;
  vehicleTitle: string;
  totalPrice: number;
  pickupLocation: string;
  scheduledTime: string | null;
}

export function onRentalOrderCancelRequest(callback: (data: CancelRequestData) => void): () => void {
  const s = getSocket();
  const handler = (data: any) => {
    console.log('[Socket] Cancel request received:', data.orderId || data);
    callback(data);
  };
  s.on('rental-order:cancel-request', handler);
  return () => s.off('rental-order:cancel-request', handler);
}

export function onRentalLifecycleChanged(
  callback: (data: { orderId: string; phase: string; updatedBy: string; order?: any }) => void
): () => void {
  const s = getSocket();
  const handler = (data: any) => {
    console.log('[Socket] Rental lifecycle changed:', data.orderId, data.phase);
    callback(data);
  };
  s.on('rental-order:lifecycle-changed', handler);
  return () => { s.off('rental-order:lifecycle-changed', handler); };
}

export function joinRentalOrderRoom(orderId: string): void {
  const s = getSocket();
  const join = () => {
    if (s.connected) {
      s.emit('rental-order:join', { orderId });
      console.log(`[Socket] Joined rental order room: ${orderId}`);
    }
  };
  addReconnectCallback(`rental-order-${orderId}`, join);
  if (s.connected) {
    join();
  } else {
    s.once('connect', join);
    s.connect();
  }
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


/** Rejoindre la room chat d'une commande (messagerie). */
export function joinOrderChatRoom(
  orderId: string,
  role: 'driver' | 'client' = 'driver',
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  const payload = { orderId, role, ...credentials };

  const joinRoom = () => {
    if (s.connected) {
      s.emit('ride:join', payload);
      console.log(`[Socket] Joined order chat room: ${orderId} as ${role}`);
    }
  };

  addReconnectCallback(`order-chat-${orderId}-${role}`, joinRoom);

  if (s.connected) {
    joinRoom();
  } else {
    s.once('connect', joinRoom);
    s.connect();
  }
}

/** @deprecated Utiliser joinOrderChatRoom */
export const joinRideRoom = joinOrderChatRoom;
