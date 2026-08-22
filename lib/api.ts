import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Source unique : app.config.js (via Constants.expoConfig.extra)
// app.config.js lit process.env.EXPO_PUBLIC_API_URL au build time depuis EAS
export const API_URL = Constants.expoConfig?.extra?.apiUrl || '';

// Log l'URL API utilisée
if (API_URL) {
  if (__DEV__) {
    console.log(`[API] 🔧 Development mode - Using API URL: ${API_URL}`);
  } else {
    console.log(`[API] 🚀 Production mode - Using API URL: ${API_URL}`);
  }
} else {
  console.warn('[API] ⚠️  No API URL configured!');
}

const CLIENT_SESSION_KEY = 'clientSessionId';
const DRIVER_SESSION_KEY = 'driverSessionId';
const SUPPORT_LAST_SEEN_KEY = 'supportLastSeenId';
const DELETED_CONVERSATIONS_KEY = 'deletedConversationsMap';

// Helper pour détecter si on est sur le web
const isWeb = Platform.OS === 'web';

// Stockage sécurisé avec fallback localStorage pour le web
async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore errors
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignore errors
  }
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore errors
  }
}

export async function getClientSessionId(): Promise<string | null> {
  return secureGet(CLIENT_SESSION_KEY);
}

export async function setClientSessionId(sessionId: string): Promise<void> {
  return secureSet(CLIENT_SESSION_KEY, sessionId);
}

export async function removeClientSessionId(): Promise<void> {
  return secureDelete(CLIENT_SESSION_KEY);
}

export async function getDriverSessionId(): Promise<string | null> {
  return secureGet(DRIVER_SESSION_KEY);
}

export async function setDriverSessionId(sessionId: string): Promise<void> {
  return secureSet(DRIVER_SESSION_KEY, sessionId);
}

export async function removeDriverSessionId(): Promise<void> {
  return secureDelete(DRIVER_SESSION_KEY);
}

export async function getSupportLastSeenId(): Promise<string | null> {
  return secureGet(SUPPORT_LAST_SEEN_KEY);
}

export async function setSupportLastSeenId(messageId: string): Promise<void> {
  return secureSet(SUPPORT_LAST_SEEN_KEY, messageId);
}

export async function removeSupportLastSeenId(): Promise<void> {
  return secureDelete(SUPPORT_LAST_SEEN_KEY);
}

export async function getDeletedConversationsMap(): Promise<Record<string, number>> {
  const raw = await secureGet(DELETED_CONVERSATIONS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setDeletedConversationsMap(map: Record<string, number>): Promise<void> {
  return secureSet(DELETED_CONVERSATIONS_KEY, JSON.stringify(map));
}

export async function removeDeletedConversationsMap(): Promise<void> {
  return secureDelete(DELETED_CONVERSATIONS_KEY);
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  retry?: boolean;
  maxRetries?: number;
}

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  isServerError: boolean;

  constructor(message: string, status: number = 0, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
    this.isServerError = status >= 500;
  }
}

/**
 * Retry automatique pour les erreurs réseau
 * Ne retry PAS les erreurs d'authentification (4xx sauf 408, 429)
 */
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;
      
      // Ne retry que pour les erreurs réseau ou serveur (5xx)
      // Ne PAS retry les erreurs client (4xx) sauf 408 (timeout) et 429 (rate limit)
      const isRetryable = 
        (error instanceof ApiError && (
          error.isNetworkError || 
          (error.isServerError && error.status >= 500) ||
          (error.status === 408 || error.status === 429)
        )) ||
        (error instanceof Error && error.message.includes('network'));
      
      // Ne pas retry les erreurs d'authentification (401, 403) ou de validation (400)
      const isAuthError = error instanceof ApiError && 
        (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404);
      
      if (isAuthError || !isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Attendre avant de retry (exponential backoff)
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (__DEV__) {
        console.log(`[API] Retry attempt ${attempt + 1}/${maxRetries} for ${fetchFn.toString().substring(0, 50)}...`);
      }
    }
  }
  
  throw lastError || new Error('Unknown error');
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, retry = true, maxRetries = 3, ...fetchOptions } = options;
  
  // Désactiver le retry pour les endpoints d'authentification (les erreurs d'auth ne doivent pas être retentées)
  const isAuthEndpoint = endpoint.includes('/auth/') || endpoint.includes('/driver/login');
  const shouldRetry = retry && !isAuthEndpoint;
  
  if (!API_URL) {
    throw new ApiError(
      'Serveur non configuré. L\'application fonctionne en mode hors-ligne.',
      0,
      true
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const sessionId = await getClientSessionId();
    if (sessionId) {
      headers['Cookie'] = `clientSessionId=${sessionId}`;
    }
  }

  // Construire l'URL en évitant la duplication du préfixe /api
  let url: string;
  if (endpoint.startsWith('http')) {
    url = endpoint;
  } else {
    // Si l'endpoint commence par /api et API_URL se termine par /api, on retire /api de l'endpoint
    const normalizedEndpoint = endpoint.startsWith('/api') && API_URL.endsWith('/api')
      ? endpoint.replace(/^\/api/, '')
      : endpoint;
    url = `${API_URL}${normalizedEndpoint}`;
  }

  if (__DEV__) {
    console.log(`[API] Constructed URL: ${url} (from endpoint: ${endpoint}, API_URL: ${API_URL})`);
  }

  const performFetch = async (): Promise<T> => {
    let response: Response;
    
    // Timeout de 15 secondes pour éviter que l'app "freeze"
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (networkError: any) {
      clearTimeout(timeoutId);
      
      // Message d'erreur plus clair selon le type d'erreur
      if (networkError?.name === 'AbortError') {
        throw new ApiError(
          'Le serveur met trop de temps à répondre. Veuillez réessayer.',
          0,
          true
        );
      }
      
      throw new ApiError(
        'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
        0,
        true
      );
    }

    // Extraire le cookie de session de la réponse si disponible
    // Pour les routes d'authentification, on extrait le cookie même avec skipAuth
    const setCookieHeader = response.headers.get('set-cookie');
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/verify');
    const isDriverLogin = endpoint.includes('/driver/login');
    
    if (setCookieHeader && (!skipAuth || isAuthEndpoint || isDriverLogin)) {
      // Extraire clientSessionId pour les clients
      const clientSessionMatch = setCookieHeader.match(/clientSessionId=([^;]+)/);
      if (clientSessionMatch && clientSessionMatch[1]) {
        await setClientSessionId(clientSessionMatch[1]);
      }
      
      // Extraire driverSessionId pour les chauffeurs
      const driverSessionMatch = setCookieHeader.match(/driverSessionId=([^;]+)/);
      if (driverSessionMatch && driverSessionMatch[1]) {
        await setDriverSessionId(driverSessionMatch[1]);
      }
    }

    // Toujours essayer de parser le JSON, même en cas d'erreur
    let data: any = null;
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (isJson) {
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (parseError) {
        // Si le parsing JSON échoue, on continue avec data = null
        if (__DEV__) {
          console.warn(`[API] Failed to parse JSON response for ${endpoint}:`, parseError);
        }
      }
    }

    if (!response.ok) {
      if (__DEV__) {
        console.error(`[API] Error ${response.status} on ${endpoint}:`, data || 'No JSON response');
      }
      
      // Utiliser le message d'erreur du serveur si disponible
      let errorMessage = 'Une erreur est survenue';
      if (data) {
        errorMessage = data.error || data.message || data.errorMessage || errorMessage;
        if (data.details) {
          errorMessage += ` Détails: ${JSON.stringify(data.details)}`;
        }
      } else {
        // Messages d'erreur par défaut selon le code de statut
        switch (response.status) {
          case 400:
            errorMessage = 'Requête invalide. Vérifiez les données envoyées.';
            break;
          case 401:
            errorMessage = 'Code incorrect. Veuillez vérifier votre code d\'accès.';
            break;
          case 403:
            errorMessage = 'Accès refusé. Votre compte peut être désactivé.';
            break;
          case 404:
            errorMessage = 'Ressource non trouvée sur le serveur.';
            break;
          case 502:
            errorMessage = 'Le serveur backend est inaccessible. Vérifiez que le serveur est démarré et accessible.';
            break;
          case 503:
            errorMessage = 'Le serveur est temporairement indisponible. Réessayez dans quelques instants.';
            break;
          case 500:
            errorMessage = 'Erreur interne du serveur. Le serveur rencontre un problème technique.';
            break;
          default:
            errorMessage = `Erreur serveur (${response.status}). Réessayez plus tard.`;
        }
      }
      
      throw new ApiError(errorMessage, response.status, response.status === 0);
    }

    return data as T;
  };

  // Utiliser retry si activé (par défaut true, mais pas pour les endpoints d'auth)
  if (shouldRetry) {
    return fetchWithRetry(performFetch, maxRetries, 1000);
  }
  
  return performFetch();
}

export async function apiPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  options: FetchOptions = {}
): Promise<T> {
  // Nettoyer le body pour enlever les valeurs undefined
  const cleanedBody = JSON.parse(JSON.stringify(body));
  
  if (__DEV__) {
    console.log(`[API] POST ${endpoint}`, cleanedBody);
  }
  
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(cleanedBody),
    ...options,
  });
}

export async function apiPatch<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  options: FetchOptions = {}
): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options,
  });
}

export async function apiDelete<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}

// ============================================
// FONCTIONS API SPÉCIFIQUES POUR LES COMMANDES
// ============================================

import type { Order } from './types';
import { rentalOrderToDriverOrder, type RentalOrderApi } from './rentalOrders';

/**
 * Récupère les détails d'une commande par son ID
 */
export interface OrderDetailsResponse extends Order {
  driver?: {
    id: string;
    name: string;
    vehicleModel: string | null;
    vehicleColor: string | null;
    vehiclePlate: string | null;
    averageRating: number | null;
  };
}

export async function getOrder(orderId: string): Promise<OrderDetailsResponse> {
  return apiFetch<OrderDetailsResponse>(`/api/orders/${orderId}`);
}

/**
 * Stockage du clientToken pour authentification Socket.IO
 */
const CLIENT_TOKEN_KEY = 'clientToken';
const CURRENT_ORDER_ID_KEY = 'currentOrderId';

export async function getClientToken(): Promise<string | null> {
  return secureGet(CLIENT_TOKEN_KEY);
}

export async function setClientToken(token: string): Promise<void> {
  return secureSet(CLIENT_TOKEN_KEY, token);
}

export async function removeClientToken(): Promise<void> {
  return secureDelete(CLIENT_TOKEN_KEY);
}

export async function getCurrentOrderId(): Promise<string | null> {
  return secureGet(CURRENT_ORDER_ID_KEY);
}

export async function setCurrentOrderId(orderId: string): Promise<void> {
  return secureSet(CURRENT_ORDER_ID_KEY, orderId);
}

export async function removeCurrentOrderId(): Promise<void> {
  return secureDelete(CURRENT_ORDER_ID_KEY);
}

// Cache pour les données de commande (en cas de perte de connexion)
const ORDER_CACHE_KEY = 'cachedOrder';
const ORDER_CACHE_TIMESTAMP_KEY = 'cachedOrderTimestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function cacheOrder(order: any): Promise<void> {
  try {
    await secureSet(ORDER_CACHE_KEY, JSON.stringify(order));
    await secureSet(ORDER_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to cache order:', error);
  }
}

export async function getCachedOrder(): Promise<any | null> {
  try {
    const cachedData = await secureGet(ORDER_CACHE_KEY);
    const timestamp = await secureGet(ORDER_CACHE_TIMESTAMP_KEY);
    
    if (!cachedData || !timestamp) {
      return null;
    }
    
    const cacheAge = Date.now() - parseInt(timestamp, 10);
    if (cacheAge > CACHE_DURATION) {
      // Cache expiré, nettoyer
      await clearCachedOrder();
      return null;
    }
    
    return JSON.parse(cachedData);
  } catch (error) {
    console.warn('Failed to get cached order:', error);
    return null;
  }
}

export async function clearCachedOrder(): Promise<void> {
  try {
    await secureDelete(ORDER_CACHE_KEY);
    await secureDelete(ORDER_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('Failed to clear cached order:', error);
  }
}

/**
 * Annule une commande via HTTP (fallback si Socket.IO échoue)
 */
export interface CancelOrderResponse {
  success: boolean;
  message: string;
  order?: Order;
  error?: string;
}

export async function cancelOrderHttp(
  orderId: string, 
  role: 'client' | 'driver', 
  reason?: string,
  options?: { clientToken?: string; driverSessionId?: string }
): Promise<CancelOrderResponse> {
  try {
    return await apiPost<CancelOrderResponse>(`/api/orders/${orderId}/cancel`, {
      role,
      reason: reason || 'Annulation par l\'utilisateur',
      clientToken: options?.clientToken,
      driverSessionId: options?.driverSessionId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        success: false,
        message: error.message,
        error: error.message,
      };
    }
    return {
      success: false,
      message: 'Erreur lors de l\'annulation',
      error: 'Erreur inconnue',
    };
  }
}

// ============================================
// FONCTIONS API POUR LE PROFIL LOUEUR
// ============================================

export interface DriverProfile {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  typeChauffeur: 'salarie' | 'patente';
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  isActive: boolean;
  averageRating: number | null;
  totalRides: number;
  prestataireId?: string | null;
  prestataireName?: string | null;
  cguAccepted?: boolean;
  cguAcceptedAt?: string | null;
  cguVersion?: string | null;
  privacyPolicyRead?: boolean;
  privacyPolicyReadAt?: string | null;
  privacyPolicyVersion?: string | null;
  createdAt: string;
}

export interface DriverProfileResponse {
  success: boolean;
  driver: DriverProfile;
}

/**
 * Erreur spécifique pour session invalide/expirée
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session invalide ou expirée') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Récupère le profil complet du chauffeur connecté
 * @throws SessionExpiredError si la session est invalide (401)
 */
export async function getDriverProfile(): Promise<DriverProfile | null> {
  try {
    const sessionId = await getDriverSessionId();
    if (!sessionId) {
      console.warn('[API] No driver session found');
      return null;
    }
    
    const response = await apiFetch<DriverProfileResponse>(`/api/driver/profile`, {
      headers: {
        'X-Driver-Session': sessionId,
      },
    });
    
    if (response.success && response.driver) {
      return response.driver;
    }
    
    return null;
  } catch (error) {
    // Si c'est une erreur 401, c'est une session expirée - on lance une erreur spécifique
    if (error instanceof ApiError && error.status === 401) {
      console.warn('[API] Session expired or invalid (401)');
      throw new SessionExpiredError();
    }
    console.warn('[API] Failed to fetch driver profile:', error);
    return null;
  }
}

export type UpdateDriverProfilePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
};

/** Met à jour le profil loueur (sync aussi le dashboard raison sociale). */
export async function updateDriverProfile(
  driverId: string,
  payload: UpdateDriverProfilePayload
): Promise<DriverProfile | null> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) {
    throw new SessionExpiredError();
  }

  const response = await apiFetch<{ success: boolean; driver: DriverProfile; error?: string }>(
    `/api/driver/profile/${driverId}`,
    {
      method: 'PATCH',
      headers: {
        'X-Driver-Session': sessionId,
        Authorization: `Bearer ${sessionId}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.success && response.driver) {
    return response.driver;
  }
  throw new Error(response.error || 'Impossible de mettre à jour le profil');
}

// ============================================
// FONCTIONS API POUR LES GAINS DU CHAUFFEUR
// ============================================

export interface DriverEarnings {
  today: number;
  week: number;
  month: number;
  total: number;
}

export interface DriverStats {
  totalRides: number;
  totalKm: number;
  averageRating: number | null;
  allTimeRides: number;
  totalLocations?: number;
  completedRentals?: number;
}

export interface DriverEarningsResponse {
  success: boolean;
  earnings: DriverEarnings;
  stats: DriverStats;
  orders: any[];
}

/**
 * Récupère les statistiques de gains du chauffeur
 */
export async function getDriverEarnings(): Promise<DriverEarningsResponse | null> {
  try {
    const sessionId = await getDriverSessionId();
    if (!sessionId) {
      console.warn('[API] No driver session found');
      return null;
    }
    
    const response = await apiFetch<DriverEarningsResponse>(`/api/driver/earnings/${sessionId}`);
    
    if (response.success) {
      return response;
    }
    
    return null;
  } catch (error) {
    console.warn('[API] Failed to fetch driver earnings:', error);
    return null;
  }
}

// ============================================
// DEMANDES DE LOCATION RAVE (app client)
// Backend : GET/POST /api/rental-orders/... avec X-Driver-Session
// ============================================

function normalizePendingRentalPayload(data: unknown): RentalOrderApi[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as RentalOrderApi[];
  if (typeof data === 'object' && data !== null && 'orders' in data) {
    const o = (data as { orders?: RentalOrderApi[] }).orders;
    return Array.isArray(o) ? o : [];
  }
  return [];
}

/**
 * Demandes en attente pour tous les loueurs connectés (filtre par véhicule = évolution backend).
 */
export async function getPendingRentalOrders(sessionId: string): Promise<Order[]> {
  const raw = await apiFetch<unknown>('/api/rental-orders/pending', {
    headers: {
      'X-Driver-Session': sessionId,
    },
  });
  if (__DEV__) {
    console.log('[Loueur][DEBUG] /api/rental-orders/pending RAW:', JSON.stringify(raw).substring(0, 500));
  }
  const list = normalizePendingRentalPayload(raw);
  if (__DEV__) {
    console.log(`[Loueur][DEBUG] Normalized list: ${list.length} items`, list.map(r => ({ id: r.id, status: r.status, type: r.type })));
  }
  const now = Date.now();
  const maxAge = 45 * 24 * 60 * 60 * 1000;
  return list
    .filter((r) => {
      if (!r?.id) return false;
      const st = (r.status || 'pending').toLowerCase();
      if (st !== 'pending') {
        if (__DEV__) console.log(`[Loueur][DEBUG] Filtered out ${r.id}: status=${st}`);
        return false;
      }
      if (r.createdAt && now - new Date(r.createdAt).getTime() > maxAge) {
        if (__DEV__) console.log(`[Loueur][DEBUG] Filtered out ${r.id}: too old`);
        return false;
      }
      return true;
    })
    .map(rentalOrderToDriverOrder);
}

export async function acceptRentalOrder(orderId: string, sessionId: string, loueurSignature?: string | null): Promise<void> {
  await apiPost(`/api/rental-orders/${encodeURIComponent(orderId)}/accept`, {
    sessionId,
    ...(loueurSignature ? { loueurSignature } : {}),
  }, {
    headers: {
      'X-Driver-Session': sessionId,
    },
  });
}

export async function declineRentalOrder(orderId: string, sessionId: string): Promise<void> {
  await apiPost(`/api/rental-orders/${encodeURIComponent(orderId)}/decline`, {
    sessionId,
  }, {
    headers: {
      'X-Driver-Session': sessionId,
    },
  });
}

export async function cancelRentalOrder(orderId: string, sessionId: string, reason?: string): Promise<void> {
  await apiPost(`/api/rental-orders/${encodeURIComponent(orderId)}/cancel`, {
    sessionId,
    role: 'driver',
    reason: reason || 'Annulation par le loueur',
  }, {
    headers: {
      'X-Driver-Session': sessionId,
    },
  });
}

/** Avance la phase location (remise au client, retour). Backend : POST .../lifecycle */
export async function postRentalOrderLifecycle(
  orderId: string,
  sessionId: string,
  body: { phase: 'with_client' | 'returned' }
): Promise<unknown> {
  return apiPost<unknown>(
    `/api/rental-orders/${encodeURIComponent(orderId)}/lifecycle`,
    { ...body, sessionId },
    { headers: { 'X-Driver-Session': sessionId } }
  );
}

export async function approveCancelRequest(orderId: string, sessionId: string, reason?: string): Promise<void> {
  await apiPost(`/api/rental-orders/${encodeURIComponent(orderId)}/cancel-approve`, {
    sessionId,
    reason: reason || 'Annulation validée par le loueur',
  }, {
    headers: { 'X-Driver-Session': sessionId },
  });
}

export async function rejectCancelRequest(orderId: string, sessionId: string, reason?: string): Promise<void> {
  await apiPost(`/api/rental-orders/${encodeURIComponent(orderId)}/cancel-reject`, {
    sessionId,
    reason: reason || 'Le loueur a refusé l\'annulation',
  }, {
    headers: { 'X-Driver-Session': sessionId },
  });
}

// ============================================
// GESTION DES VÉHICULES DU LOUEUR
// ============================================

export interface VehicleModel {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  description: string | null;
  seats: number;
  transmission: string;
  fuel: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoueurVehicle {
  id: string;
  vehicleModelId: string;
  plate: string | null;
  pricePerDay: number;
  pricePerDayLongTerm: number | null;
  availableForRental: boolean;
  availableForDelivery: boolean;
  availableForLongTerm: boolean;
  customImageUrl: string | null;
  customImageUrls?: string[] | null;
  rentalContractMode?: 'app_default' | 'custom';
  customContractText?: string | null;
  isActive: boolean;
  createdAt: string;
  modelName: string | null;
  modelCategory: string | null;
  modelImageUrl: string | null;
  modelSeats: number | null;
  modelTransmission: string | null;
  modelFuel: string | null;
}

export interface CreateVehicleData {
  vehicleModelId: string;
  vehicleModelName?: string;
  vehicleModelCategory?: string;
  plate?: string;
  pricePerDay: number;
  pricePerDayLongTerm?: number;
  availableForRental?: boolean;
  availableForDelivery?: boolean;
  availableForLongTerm?: boolean;
  customImageUrl?: string;
  customImageUrls?: string[];
  rentalContractMode?: 'app_default' | 'custom';
  customContractText?: string;
}

function isVehicleModelLike(v: unknown): v is VehicleModel {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string';
}

function normalizeVehicleModelsPayload(raw: unknown): VehicleModel[] {
  if (Array.isArray(raw)) {
    return raw.filter(isVehicleModelLike) as VehicleModel[];
  }

  if (!raw || typeof raw !== 'object') return [];

  const root = raw as Record<string, unknown>;

  const directCandidates = [
    root.models,
    root.vehicleModels,
    root.data,
    root.items,
    root.results,
    root.payload,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      const filtered = candidate.filter(isVehicleModelLike) as VehicleModel[];
      if (filtered.length > 0) return filtered;
    }
  }

  // Fallback robuste: chercher un tableau de modèles dans les objets imbriqués.
  const stack: unknown[] = Object.values(root);
  let guard = 0;
  while (stack.length > 0 && guard < 200) {
    guard += 1;
    const current = stack.pop();
    if (!current) continue;

    if (Array.isArray(current)) {
      const filtered = current.filter(isVehicleModelLike) as VehicleModel[];
      if (filtered.length > 0) return filtered;
      for (const item of current) {
        if (item && typeof item === 'object') stack.push(item);
      }
      continue;
    }

    if (typeof current === 'object') {
      stack.push(...Object.values(current as Record<string, unknown>));
    }
  }

  return [];
}

export async function getVehicleModels(): Promise<VehicleModel[]> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) throw new ApiError('Session requise', 401);
  const raw = await apiFetch<unknown>('/api/driver/vehicle-models', {
    headers: { 'X-Driver-Session': sessionId },
  });
  return normalizeVehicleModelsPayload(raw);
}

function normalizeLoueurVehiclesPayload(raw: unknown): LoueurVehicle[] {
  if (Array.isArray(raw)) return raw as LoueurVehicle[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.vehicles)) return o.vehicles as LoueurVehicle[];
    if (Array.isArray(o.data)) return o.data as LoueurVehicle[];
    if (Array.isArray(o.items)) return o.items as LoueurVehicle[];
  }
  return [];
}

export async function getMyVehicles(): Promise<LoueurVehicle[]> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) throw new ApiError('Session requise', 401);
  const raw = await apiFetch<unknown>('/api/driver/vehicles', {
    headers: { 'X-Driver-Session': sessionId },
  });
  return normalizeLoueurVehiclesPayload(raw);
}

export async function addVehicle(data: CreateVehicleData): Promise<LoueurVehicle> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) throw new ApiError('Session requise', 401);
  return apiPost<LoueurVehicle>('/api/driver/vehicles', data as Record<string, unknown>, {
    headers: { 'X-Driver-Session': sessionId },
  });
}

/** Upload une photo véhicule vers Cloudinary via le backend (route /api/upload déjà en prod) */
export async function uploadVehiclePhoto(localUri: string): Promise<string> {
  if (!API_URL) throw new ApiError('Serveur non configuré', 0, true);

  const sessionId = await getDriverSessionId();
  const formData = new FormData();
  const rawName = localUri.split('/').pop() || `vehicle-${Date.now()}.jpg`;
  const filename = rawName.includes('.') ? rawName.replace(/\s/g, '_') : `${rawName}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'heic' || ext === 'heif' ? 'image/heic' :
    'image/jpeg';

  // Champ folder lu par POST /api/upload
  formData.append('folder', 'rave/vehicles');
  formData.append('image', {
    uri: localUri,
    name: filename.endsWith('.heic') || filename.endsWith('.heif')
      ? filename.replace(/\.hei[cf]$/i, '.jpg')
      : filename,
    type: mime === 'image/heic' ? 'image/jpeg' : mime,
  } as any);

  // API_URL se termine déjà par /api → même pattern que l'app client
  const url = `${API_URL}/upload`;

  if (__DEV__) {
    console.log('[PHOTO UPLOAD] Uploading vehicle photo to:', url);
  }

  const headers: Record<string, string> = {};
  if (sessionId) headers['X-Driver-Session'] = sessionId;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  const rawText = await response.text();
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (__DEV__) {
    console.log('[PHOTO UPLOAD] Status:', response.status, 'Body:', rawText.slice(0, 200));
  }

  if (!response.ok || !data?.url) {
    throw new ApiError(
      data?.error || data?.message || "Impossible d'envoyer la photo",
      response.status
    );
  }

  return data.url as string;
}

export function normalizeLoueurImageUrls(vehicle: Pick<LoueurVehicle, 'customImageUrl' | 'customImageUrls'>): string[] {
  const urls = Array.isArray(vehicle.customImageUrls)
    ? vehicle.customImageUrls.filter((u): u is string => typeof u === 'string' && !!u.trim())
    : [];
  if (urls.length === 0 && vehicle.customImageUrl) return [vehicle.customImageUrl];
  return Array.from(new Set(urls));
}

export async function updateVehicle(vehicleId: string, data: Partial<CreateVehicleData & { isActive: boolean }>): Promise<LoueurVehicle> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) throw new ApiError('Session requise', 401);
  return apiFetch<LoueurVehicle>(`/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'X-Driver-Session': sessionId },
  });
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const sessionId = await getDriverSessionId();
  if (!sessionId) throw new ApiError('Session requise', 401);
  await apiFetch(`/api/driver/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'DELETE',
    headers: { 'X-Driver-Session': sessionId },
  });
}