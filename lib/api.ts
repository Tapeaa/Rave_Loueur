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

import type { Order, AddressField, Supplement, RouteInfo } from './types';

export interface CreateOrderData {
  clientName: string;
  clientPhone: string;
  addresses: AddressField[];
  rideOption: {
    id: string;
    title: string;
    price: number;
    pricePerKm: number;
  };
  routeInfo?: RouteInfo;
  passengers: number;
  supplements: Supplement[];
  paymentMethod: 'cash' | 'card';
  selectedCardId?: string;
  totalPrice: number;
  driverEarnings: number;
  scheduledTime?: string | null;
  isAdvanceBooking: boolean;
}

export interface CreateOrderResponse {
  order: Order;
  clientToken: string;
}

/**
 * Crée une nouvelle commande
 */
export async function createOrder(orderData: CreateOrderData): Promise<CreateOrderResponse> {
  return apiPost<CreateOrderResponse>('/api/orders', orderData);
}

/**
 * Récupère la commande active du client
 */
export interface ActiveOrderResponse {
  hasActiveOrder: boolean;
  order?: Order;
  clientToken?: string;
}

export async function getActiveOrder(): Promise<ActiveOrderResponse> {
  return apiFetch<ActiveOrderResponse>('/api/orders/active/client');
}

/**
 * Récupère la commande active du chauffeur
 */
export interface ActiveDriverOrderResponse {
  hasActiveOrder: boolean;
  order?: Order;
}

export async function getActiveDriverOrder(sessionId: string): Promise<ActiveDriverOrderResponse> {
  return apiFetch<ActiveDriverOrderResponse>(`/api/orders/active/driver?sessionId=${encodeURIComponent(sessionId)}`);
}

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
 * Récupère la position GPS du chauffeur (polling backup si Socket.IO échoue)
 */
export interface DriverLocationResponse {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export async function getDriverLocation(orderId: string): Promise<DriverLocationResponse | null> {
  try {
    return await apiFetch<DriverLocationResponse>(`/api/orders/${orderId}/driver-location`);
  } catch (error) {
    // Si le chauffeur n'a pas encore envoyé sa position, retourner null
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
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

// ============ FRAIS DE SERVICE CONFIG ============

export async function getFraisServiceConfig(): Promise<{
  fraisServicePrestataire: number;
  commissionPrestataire: number;
  commissionSalarieTapea: number;
}> {
  try {
    const response = await apiFetch<{
      success: boolean;
      config: {
        fraisServicePrestataire: number;
        commissionPrestataire: number;
        commissionSalarieTapea: number;
      };
    }>('/api/frais-service-config', { skipAuth: true });
    
    return response.config || {
      fraisServicePrestataire: 15,
      commissionPrestataire: 0,
      commissionSalarieTapea: 0,
    };
  } catch (error) {
    console.warn('Failed to get frais service config, using defaults:', error);
    return {
      fraisServicePrestataire: 15,
      commissionPrestataire: 0,
      commissionSalarieTapea: 0,
    };
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
// FONCTIONS API POUR LES COMMISSIONS
// ============================================

export interface Commission {
  id: string;
  typeChauffeur: string;
  nomAffichage: string;
  pourcentageChauffeur: number;
  pourcentageCommission: number;
  description: string | null;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionsResponse {
  success: boolean;
  commissions: Commission[];
}

// Cache en mémoire pour les commissions
let commissionsCache: Commission[] | null = null;
let commissionsCacheTimestamp: number = 0;
const COMMISSIONS_CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Récupère les commissions depuis l'API
 */
export async function getCommissions(): Promise<Commission[]> {
  // Vérifier le cache
  const now = Date.now();
  if (commissionsCache && (now - commissionsCacheTimestamp) < COMMISSIONS_CACHE_DURATION) {
    return commissionsCache;
  }
  
  try {
    const response = await apiFetch<CommissionsResponse>('/api/commissions', { skipAuth: true });
    
    if (response.success && response.commissions) {
      commissionsCache = response.commissions;
      commissionsCacheTimestamp = now;
      return response.commissions;
    }
    
    // Retourner les commissions par défaut si la requête échoue
    return getDefaultCommissions();
  } catch (error) {
    console.warn('[API] Failed to fetch commissions, using defaults:', error);
    return getDefaultCommissions();
  }
}

/**
 * Récupère la commission pour un type de chauffeur spécifique
 */
export async function getCommissionForType(typeChauffeur: 'salarie' | 'patente'): Promise<Commission | null> {
  const commissions = await getCommissions();
  return commissions.find(c => c.typeChauffeur === typeChauffeur) || null;
}

/**
 * Calcule les gains du chauffeur après commission
 */
export function calculateDriverEarnings(totalPrice: number, commission: Commission): {
  driverEarnings: number;
  tapeaCommission: number;
} {
  const driverEarnings = Math.round(totalPrice * (commission.pourcentageChauffeur / 100));
  const tapeaCommission = totalPrice - driverEarnings;
  
  return {
    driverEarnings,
    tapeaCommission,
  };
}

/**
 * Commissions par défaut (fallback si API indisponible)
 * Note: Ces valeurs doivent correspondre à celles configurées dans le dashboard
 */
function getDefaultCommissions(): Commission[] {
  return [
    {
      id: 'default-salarie',
      typeChauffeur: 'salarie',
      nomAffichage: 'Chauffeur Salarié',
      pourcentageChauffeur: 34,
      pourcentageCommission: 66,
      description: 'Commission pour les chauffeurs salariés TAPEA',
      actif: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'default-patente',
      typeChauffeur: 'patente',
      nomAffichage: 'Chauffeur Patenté (Indépendant)',
      pourcentageChauffeur: 92,
      pourcentageCommission: 8,
      description: 'Commission pour les chauffeurs indépendants/patentés',
      actif: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

/**
 * Force le rafraîchissement du cache des commissions
 */
export function invalidateCommissionsCache(): void {
  commissionsCache = null;
  commissionsCacheTimestamp = 0;
}

// ============================================
// FONCTIONS API POUR LE PROFIL CHAUFFEUR
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