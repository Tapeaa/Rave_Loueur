import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Switch, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  Platform,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { MapView, Marker, isMapsAvailable } from '@/lib/maps';
import MenuBurger from '@/components/MenuBurger';
import { getDriverSessionId, removeDriverSessionId, apiFetch, apiPatch, getDriverProfile, getSupportLastSeenId, setSupportLastSeenId, SessionExpiredError } from '@/lib/api';
import { setDriverExternalId, addDriverTag } from '@/lib/onesignal';
import * as SecureStore from 'expo-secure-store';
import {
  connectSocket,
  joinDriverSession,
  updateDriverStatus,
  updateDriverStatusAsync,
  acceptOrder,
  onNewOrder,
  onPendingOrders,
  onOrderTaken,
  onOrderExpired,
  onRideCancelled,
  onOrderAcceptSuccess,
  onOrderBookedSuccess,  // ═══ RÉSERVATION À L'AVANCE ═══
  onReservationReminder,  // ═══ RÉSERVATION À L'AVANCE ═══
  onOrderAcceptError,
  disconnectSocket,
  isSocketConnected,
} from '@/lib/socket';
import type { Order } from '@/lib/types';

interface SupportMessage {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderType: 'admin' | 'client' | 'driver';
  senderId?: string | null;
}

const { width, height } = Dimensions.get('window');

const categories = [
  { id: 'commandes', label: 'Commandes', ionicon: 'receipt' as const, href: '/(chauffeur)/courses' },
  { id: 'messages', label: 'Messages', ionicon: 'chatbubbles' as const, href: '/(chauffeur)/messages' },
  { id: 'paiement', label: 'Gains', ionicon: 'wallet' as const, href: '/(chauffeur)/gains' },
  { id: 'contact', label: 'Profil', ionicon: 'person-circle' as const, href: '/(chauffeur)/profil' },
];

const TAHITI_REGION = {
  latitude: -17.5516,
  longitude: -149.5585,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

// Helper function
const formatPrice = (price: number) => {
  return `${price.toLocaleString('fr-FR')} XPF`;
};

// Helper function pour obtenir le tarif kilométrique selon l'heure de la commande
const getPricePerKmForOrder = (
  orderCreatedAt: string,
  tarifs: any[]
): { price: number; period: 'jour' | 'nuit' } => {
  if (!orderCreatedAt || !tarifs || tarifs.length === 0) {
    return { price: 150, period: 'jour' }; // Fallback
  }
  
  const orderDate = new Date(orderCreatedAt);
  const orderHour = orderDate.getHours();
  const orderMinutes = orderHour * 60 + orderDate.getMinutes();
  
  const kilometreTarifs = tarifs.filter(t => 
    t.typeTarif === 'kilometre_jour' || t.typeTarif === 'kilometre_nuit'
  );
  
  for (const tarif of kilometreTarifs) {
    if (tarif.heureDebut && tarif.heureFin) {
      const [debutH, debutM] = tarif.heureDebut.split(':').map(Number);
      const [finH, finM] = tarif.heureFin.split(':').map(Number);
      const debutMinutes = debutH * 60 + (debutM || 0);
      const finMinutes = finH * 60 + (finM || 0);
      
      let isInRange = false;
      if (debutMinutes <= finMinutes) {
        isInRange = orderMinutes >= debutMinutes && orderMinutes < finMinutes;
      } else {
        isInRange = orderMinutes >= debutMinutes || orderMinutes < finMinutes;
      }
      
      if (isInRange) {
        const period = tarif.typeTarif === 'kilometre_jour' ? 'jour' : 'nuit';
        return { price: tarif.prixXpf, period };
      }
    } else {
      if (tarif.typeTarif === 'kilometre_jour' && orderHour >= 6 && orderHour < 20) {
        return { price: tarif.prixXpf, period: 'jour' };
      }
      if (tarif.typeTarif === 'kilometre_nuit' && (orderHour >= 20 || orderHour < 6)) {
        return { price: tarif.prixXpf, period: 'nuit' };
      }
    }
  }
  
  // Fallback selon l'heure
  const isNight = orderHour >= 20 || orderHour < 6;
  const defaultPrice = isNight ? 260 : 150;
  return { price: defaultPrice, period: isNight ? 'nuit' : 'jour' };
};

// Helper function pour obtenir le prix de base (prise en charge)
const getBasePrice = (tarifs: any[]): number => {
  const priseEnCharge = tarifs.find(t => t.typeTarif === 'prise_en_charge');
  return priseEnCharge?.prixXpf || 1000;
};

export default function ChauffeurHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [decliningOrderId, setDecliningOrderId] = useState<string | null>(null);
  const [declinedOrderIds, setDeclinedOrderIds] = useState<Set<string>>(new Set());
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [tarifs, setTarifs] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<any>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [lastSeenSupportId, setLastSeenSupportId] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: States pour les popups
  // ═══════════════════════════════════════════════════════════════════════════
  const [bookingConfirmedOrder, setBookingConfirmedOrder] = useState<Order | null>(null);
  const [bookingStartReminder, setBookingStartReminder] = useState<{ order: Order; minutesUntilStart: number } | null>(null);

  // Polling interval et timeouts
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const sid = await getDriverSessionId();
      if (!sid) {
        console.log('[INDEX] No session found, redirecting to login');
        router.replace('/(chauffeur)/login');
        return;
      }
      
      // Vérifier les CGU avant de continuer
      // Si cguAccepted n'est pas explicitement true (null, undefined, ou false), rediriger vers legal
      // Vérifier d'abord dans AsyncStorage (pour éviter la boucle si le backend ne retourne pas cguAccepted)
      try {
        const driverProfile = await getDriverProfile();
        if (driverProfile) {
          const driver = driverProfile as any;
          const driverId = driver.id || driverProfile.id;
          if (driverId) {
            setDriverId(driverId);
            setDriverExternalId(driverId);
          }
          
          // Vérifier d'abord dans SecureStore
          const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${driverId}_cgu_accepted`);
          if (cguAcceptedInStorage === 'true') {
            console.log('[INDEX] CGU accepted (from SecureStore), continuing to home screen');
            // CGU acceptées, on continue
          } else if (driver.cguAccepted === true) {
            console.log('[INDEX] CGU accepted (from API), continuing to home screen');
            // CGU acceptées selon l'API, on continue
          } else {
            console.log('[INDEX] CGU not accepted (value:', driver.cguAccepted, ', storage:', cguAcceptedInStorage, '), redirecting to legal');
            router.replace('/(chauffeur)/legal');
            return;
          }
        } else {
          // Si on ne peut pas charger le profil, vérifier dans SecureStore avec le sessionId
          try {
            const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${sid}_cgu_accepted`);
            if (cguAcceptedInStorage !== 'true') {
              console.log('[INDEX] Could not load driver profile and no CGU in storage, redirecting to legal');
              router.replace('/(chauffeur)/legal');
              return;
            } else {
              console.log('[INDEX] CGU accepted (from SecureStore with sessionId), continuing');
            }
          } catch {
            console.log('[INDEX] Could not load driver profile, redirecting to legal');
            router.replace('/(chauffeur)/legal');
            return;
          }
        }
      } catch (error) {
        // Si c'est une erreur de session expirée (401), effacer la session et rediriger vers login
        if (error instanceof SessionExpiredError) {
          console.log('[INDEX] Session expired, clearing local session and redirecting to login');
          await removeDriverSessionId();
          router.replace('/(chauffeur)/login');
          return;
        }
        
        // En cas d'autre erreur, vérifier dans SecureStore
        try {
          const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${sid}_cgu_accepted`);
          if (cguAcceptedInStorage !== 'true') {
            console.log('[INDEX] Error checking CGU status, redirecting to legal:', error);
            router.replace('/(chauffeur)/legal');
            return;
          } else {
            console.log('[INDEX] Error checking CGU but found in storage, continuing');
          }
        } catch {
          console.log('[INDEX] Error checking CGU status, redirecting to legal:', error);
          router.replace('/(chauffeur)/legal');
          return;
        }
      }
      
      setSessionId(sid);

      const isTestSession = sid.startsWith('test-driver-session-');
      
      let wasOnline = false;
      if (!isTestSession) {
        try {
          const session = await apiFetch<{ isOnline: boolean }>(`/api/driver-sessions/${sid}`);
          // Récupérer le statut local sauvegardé
          const savedOnlineStatus = await SecureStore.getItemAsync(`driver_${sid}_isOnline`);
          const localWasOnline = savedOnlineStatus === 'true';
          
          // Si le serveur dit offline mais qu'on était en ligne localement, restaurer le statut
          if (!session.isOnline && localWasOnline) {
            console.log('[Chauffeur] Restoring online status from local storage');
            setIsOnline(true);
            wasOnline = true;
            // Renvoyer le statut au serveur
            try {
              await apiPatch(`/api/driver-sessions/${sid}/status`, { isOnline: true });
              console.log('[Chauffeur] ✅ Online status restored to server');
            } catch (e) {
              console.log('[Chauffeur] Failed to restore status to server');
            }
          } else {
            setIsOnline(session.isOnline);
            wasOnline = session.isOnline;
          }
        } catch (err) {
          // En cas d'erreur, vérifier le statut local
          const savedOnlineStatus = await SecureStore.getItemAsync(`driver_${sid}_isOnline`);
          if (savedOnlineStatus === 'true') {
            console.log('[Chauffeur] Using local online status (server unavailable)');
            setIsOnline(true);
            wasOnline = true;
          }
          console.log('Failed to fetch session status');
        }
        
        // Vérifier s'il y a une course active
        try {
          console.log('[Chauffeur] Checking for active order...');
          const activeOrderResult = await apiFetch<{ hasActiveOrder: boolean; order?: any }>(`/api/orders/active/driver?sessionId=${sid}`);
          if (activeOrderResult.hasActiveOrder && activeOrderResult.order) {
            console.log('[Chauffeur] ✅ Found active order, redirecting to course-en-cours:', activeOrderResult.order.id);
            router.replace({
              pathname: '/(chauffeur)/course-en-cours',
              params: { orderId: activeOrderResult.order.id }
            });
            return;
          } else {
            console.log('[Chauffeur] No active order found');
          }
        } catch (err) {
          console.log('[Chauffeur] Failed to check active order:', err);
        }
      } else {
        setIsOnline(false);
      }

      try {
        connectSocket();
        if (!isTestSession) {
          joinDriverSession(sid);
          if (wasOnline) {
            // Attendre un peu que Socket.IO se connecte avant d'envoyer le statut
            setTimeout(() => {
              console.log('[Chauffeur] Was online, resending status via socket (async)');
              updateDriverStatusAsync(sid, true).then(success => {
                console.log(`[Chauffeur] Initial status update: ${success ? 'SUCCESS' : 'FAILED'}`);
              });
            }, 1000); // Attendre 1 seconde pour laisser Socket.IO se connecter
            
            try {
              const orders = await apiFetch<any[]>('/api/orders/pending');
              if (orders && orders.length > 0) {
                const now = Date.now();
                const maxAge = 5 * 60 * 1000; // 5 minutes (aligné avec le backend)
                const validOrders = orders.filter(o => {
                  // Filtrer les commandes non-pending ou annulées/expirées
                  if (o.status && (o.status !== 'pending' || ['cancelled', 'expired'].includes(o.status))) return false;
                  // Filtrer les commandes trop anciennes
                  if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) return false;
                  // Ne pas afficher les commandes déjà déclinées
                  if (declinedOrderIds.has(o.id)) return false;
                  return true;
                });
                console.log(`[Chauffeur] Initial load: ${validOrders.length}/${orders.length} valid pending orders`);
                setPendingOrders(validOrders);
              }
            } catch (err) {
              console.log('[Chauffeur] Failed to fetch initial pending orders');
            }
          }
        }
        setConnectionStatus('connected');
      } catch (err) {
        console.log('Socket connection failed (test mode)');
        setConnectionStatus('disconnected');
      }
    };
    init();
    
    // Charger les tarifs
    const loadTarifs = async () => {
      try {
        const tarifsData = await apiFetch<any[]>('/api/tarifs');
        setTarifs(tarifsData || []);
      } catch (error) {
        console.error('[Chauffeur] Error loading tarifs:', error);
      }
    };
    loadTarifs();

    return () => {
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    addDriverTag('status', isOnline ? 'online' : 'offline');
  }, [isOnline]);

  const loadSupportMessages = useCallback(async () => {
    if (!sessionId) {
      setSupportMessages([]);
      return;
    }
    setIsLoadingSupport(true);
    try {
      const data = await apiFetch<{ messages: SupportMessage[] }>(
        '/api/messages/direct/driver',
        {
          headers: {
            'X-Driver-Session': sessionId,
          },
        }
      );
      setSupportMessages(data?.messages || []);
    } catch (error) {
      console.log('[Support] Error loading messages:', error);
      setSupportMessages([]);
    } finally {
      setIsLoadingSupport(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSupportMessages();
    const interval = setInterval(loadSupportMessages, 15000);
    return () => clearInterval(interval);
  }, [loadSupportMessages]);

  useEffect(() => {
    let isMounted = true;
    getSupportLastSeenId()
      .then((stored) => {
        if (isMounted) {
          setLastSeenSupportId(stored);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const unreadSupportCount = useMemo(
    () => supportMessages.filter((msg) => !msg.isRead && msg.senderType === 'admin').length,
    [supportMessages]
  );

  const latestSupportMessage = useMemo(
    () => supportMessages.find((msg) => msg.senderType === 'admin') || supportMessages[0],
    [supportMessages]
  );

  const latestAdminMessageId = useMemo(
    () => supportMessages.find((msg) => msg.senderType === 'admin')?.id ?? null,
    [supportMessages]
  );

  const shouldShowSupportCard = useMemo(() => {
    if (!latestAdminMessageId) return false;
    return latestAdminMessageId !== lastSeenSupportId;
  }, [latestAdminMessageId, lastSeenSupportId]);

  const handleOpenSupportMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      await apiFetch('/api/messages/direct/driver/read', {
        method: 'POST',
        headers: {
          'X-Driver-Session': sessionId,
        },
      });
      setSupportMessages((prev) =>
        prev.map((msg) =>
          msg.senderType === 'admin' ? { ...msg, isRead: true } : msg
        )
      );
      if (latestAdminMessageId) {
        await setSupportLastSeenId(latestAdminMessageId);
        setLastSeenSupportId(latestAdminMessageId);
      }
    } catch (error) {
      console.log('[Support] Error marking messages read:', error);
    } finally {
      router.push('/(chauffeur)/support-chat');
    }
  }, [router, sessionId, latestAdminMessageId]);

  // Location
  useEffect(() => {
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          const Location = require('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        } catch (e) {
          console.log('Location not available');
        }
      })();
    }
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!sessionId || !isOnline) return;

    const unsubNewOrder = onNewOrder((order) => {
      console.log('[Chauffeur] New order received:', order.id);
      // Ne pas ajouter si déjà déclinée, annulée ou expirée
      if (declinedOrderIds.has(order.id)) {
        console.log('[Chauffeur] Ignoring declined order:', order.id);
        return;
      }
      if (order.status && ['cancelled', 'expired'].includes(order.status)) {
        console.log('[Chauffeur] Ignoring cancelled/expired order:', order.id);
        return;
      }
      
      setPendingOrders(prev => {
        if (prev.some(o => o.id === order.id)) return prev;
        return [...prev, order];
      });
    });

    const unsubPendingOrders = onPendingOrders((orders) => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      const filteredOrders = orders.filter(o => {
        // Ne pas afficher les commandes déjà déclinées
        if (declinedOrderIds.has(o.id)) {
          console.log(`[Chauffeur] Filtering declined order: ${o.id}`);
          return false;
        }
        // Ne pas afficher les commandes annulées ou expirées
        if (o.status && ['cancelled', 'expired'].includes(o.status)) {
          console.log(`[Chauffeur] Filtering cancelled/expired order: ${o.id}, status: ${o.status}`);
          // Ajouter aussi à declinedOrderIds pour éviter qu'elle réapparaisse
          setDeclinedOrderIds(prev => new Set(prev).add(o.id));
          return false;
        }
        // Ne garder que les commandes en attente
        if (o.status && o.status !== 'pending') {
          console.log(`[Chauffeur] Filtering non-pending order: ${o.id}, status: ${o.status}`);
          return false;
        }
        // Filtrer les commandes trop anciennes
        if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) {
          console.log(`[Chauffeur] Filtering old order: ${o.id}`);
          return false;
        }
        return true;
      });
      console.log(`[Chauffeur] Reçu ${orders.length} commandes, ${filteredOrders.length} valides (après filtrage)`);
      
      // Mettre à jour la liste en fusionnant avec les commandes existantes (pour éviter de perdre celles qui viennent de ride:cancelled)
      setPendingOrders(prev => {
        // Créer un Set des IDs des nouvelles commandes filtrées
        const newOrderIds = new Set(filteredOrders.map(o => o.id));
        
        // Garder seulement les commandes existantes qui ne sont pas dans declinedOrderIds
        const existingValid = prev.filter(o => 
          !declinedOrderIds.has(o.id) && 
          !newOrderIds.has(o.id) && // Ne pas garder celles qui sont dans la nouvelle liste
          o.status === 'pending' &&
          (!o.status || !['cancelled', 'expired'].includes(o.status))
        );
        
        // Fusionner les commandes existantes valides avec les nouvelles
        const merged = [...existingValid, ...filteredOrders];
        
        // Dédupliquer par ID
        const unique = Array.from(new Map(merged.map(o => [o.id, o])).values());
        
        console.log(`[Chauffeur] Mise à jour liste: ${prev.length} → ${unique.length} commandes (${existingValid.length} existantes + ${filteredOrders.length} nouvelles)`);
        
        return unique;
      });
    });

    const unsubOrderTaken = onOrderTaken((data) => {
      console.log('[Chauffeur] Order taken:', data.orderId);
      setPendingOrders(prev => prev.filter(o => o.id !== data.orderId));
    });

    const unsubOrderExpired = onOrderExpired((data) => {
      console.log('[Chauffeur] Order expired:', data.orderId);
      setPendingOrders(prev => prev.filter(o => o.id !== data.orderId));
      // Ajouter à la liste des déclinées pour éviter qu'elle réapparaisse
      setDeclinedOrderIds(prev => new Set(prev).add(data.orderId));
    });

    const unsubRideCancelled = onRideCancelled((data) => {
      console.log('[Chauffeur] Ride cancelled:', data.orderId, 'by', data.cancelledBy, 'reason:', data.reason);
      
      // Ajouter immédiatement à la liste des commandes déclinées pour éviter qu'elle réapparaisse
      if (data.orderId) {
        setDeclinedOrderIds(prev => new Set(prev).add(data.orderId));
      }
      
      // Supprimer immédiatement la commande de la liste des commandes en attente
      setPendingOrders(prev => {
        const filtered = prev.filter(o => o.id !== data.orderId);
        if (filtered.length !== prev.length) {
          console.log(`[Chauffeur] ✅ Removed cancelled order from pending list: ${data.orderId} (${prev.length} → ${filtered.length})`);
        } else {
          console.log(`[Chauffeur] ⚠️ Cancelled order ${data.orderId} not found in current list (${prev.length} orders)`);
        }
        return filtered;
      });
    });

    const unsubAcceptSuccess = onOrderAcceptSuccess((data: any) => {
      console.log('[Chauffeur] Order accepted successfully:', data.order || data);
      if (acceptTimeoutRef.current) {
        clearTimeout(acceptTimeoutRef.current);
        acceptTimeoutRef.current = null;
      }
      setAcceptingOrderId(null);
      
      const orderId = data.order?.id || data.orderId || data.id;
      
      // ═══════════════════════════════════════════════════════════════════════════
      // RÉSERVATION À L'AVANCE: Ne pas rediriger, afficher popup de confirmation
      // ═══════════════════════════════════════════════════════════════════════════
      const isAdvanceBooking = data.isAdvanceBooking || data.order?.isAdvanceBooking;
      
      if (isAdvanceBooking) {
        console.log('[Chauffeur] ✅ Réservation à l\'avance acceptée, affichage popup confirmation');
        // Afficher un message de confirmation
        setBookingConfirmedOrder({
          ...data.order,
          id: orderId,
          scheduledTime: data.scheduledTime || data.order?.scheduledTime,
        });
        // Supprimer de la liste des commandes en attente
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      } else if (orderId) {
        // Course immédiate: rediriger vers course-en-cours
        router.push({
          pathname: '/(chauffeur)/course-en-cours',
          params: { orderId }
        });
      }
    });

    const unsubAcceptError = onOrderAcceptError((data: any) => {
      console.log('[Chauffeur] Order accept error:', data.message);
      if (acceptTimeoutRef.current) {
        clearTimeout(acceptTimeoutRef.current);
        acceptTimeoutRef.current = null;
      }
      setAcceptingOrderId(null);
      if (data.orderId) {
        setPendingOrders(prev => prev.filter(o => o.id !== data.orderId));
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // RÉSERVATION À L'AVANCE: Listener pour la confirmation de réservation
    // ═══════════════════════════════════════════════════════════════════════════
    const unsubBookedSuccess = onOrderBookedSuccess((data: any) => {
      console.log('[Chauffeur] ✅ Booking confirmed:', data.id || data.orderId);
      if (acceptTimeoutRef.current) {
        clearTimeout(acceptTimeoutRef.current);
        acceptTimeoutRef.current = null;
      }
      setAcceptingOrderId(null);
      
      const orderId = data.id || data.orderId;
      setBookingConfirmedOrder({
        ...data,
        id: orderId,
      });
      // Supprimer de la liste des commandes en attente
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // RÉSERVATION À L'AVANCE: Listener pour le rappel 30 min avant
    // ═══════════════════════════════════════════════════════════════════════════
    const unsubBookingReminder = onReservationReminder((data) => {
      console.log('[Chauffeur] 📅 Booking start reminder received:', data.order.id, 'in', data.minutesUntil, 'minutes');
      setBookingStartReminder({
        order: data.order,
        minutesUntilStart: data.minutesUntil,
      });
    });

    return () => {
      unsubNewOrder();
      unsubPendingOrders();
      unsubOrderTaken();
      unsubOrderExpired();
      unsubRideCancelled();
      unsubAcceptSuccess();
      unsubBookedSuccess();
      unsubAcceptError();
      unsubBookingReminder();
    };
  }, [sessionId, isOnline, declinedOrderIds]);

  // Polling
  useEffect(() => {
    if (!sessionId || !isOnline) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollPendingOrders = async () => {
      try {
        const orders = await apiFetch<any[]>('/api/orders/pending');
        if (orders && orders.length > 0) {
          const now = Date.now();
          const maxAge = 8 * 60 * 1000; // 8 minutes (plus que les 7m30 du client)
          const validOrders = orders.filter(o => {
            if (o.status && o.status !== 'pending') return false;
            if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) return false;
            if (declinedOrderIds.has(o.id)) return false;
            return true;
          });
          // Merge with existing orders to avoid losing orders during navigation
          setPendingOrders(prev => {
            const newOrderIds = new Set(validOrders.map(o => o.id));
            // Keep existing orders that are still valid (not taken, not expired, not declined)
            const existingValidOrders = prev.filter(o => {
              // If order is in the new list, it will be updated
              if (newOrderIds.has(o.id)) return false;
              // If order was declined, remove it
              if (declinedOrderIds.has(o.id)) return false;
              // If order is too old, remove it
              if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) return false;
              // Keep it (might be a pending order not yet returned by API)
              return true;
            });
            // Return new orders + existing valid orders not in new list
            return [...validOrders, ...existingValidOrders];
          });
        } else {
          // Don't clear completely - keep valid existing orders that haven't expired
          setPendingOrders(prev => {
            const now = Date.now();
            const maxAge = 8 * 60 * 1000;
            return prev.filter(o => {
              if (declinedOrderIds.has(o.id)) return false;
              if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) return false;
              return true;
            });
          });
        }
      } catch (err) {
        // Silencieux - keep existing orders on error
      }
    };

    pollPendingOrders();
    pollingIntervalRef.current = setInterval(pollPendingOrders, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [sessionId, isOnline, declinedOrderIds]);

  // Socket connection monitor
  useEffect(() => {
    const checkConnection = setInterval(() => {
      const connected = isSocketConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      
      if (!connected && isOnline && sessionId) {
        console.log('[Chauffeur] Socket déconnecté, reconnexion...');
        try {
          connectSocket();
          joinDriverSession(sessionId);
        } catch (err) {
          console.log('[Chauffeur] Reconnexion échouée');
        }
      }
    }, 10000);

    return () => clearInterval(checkConnection);
  }, [isOnline, sessionId]);

  const handleToggleOnline = async (value: boolean) => {
    if (!sessionId) return;
    
    setIsOnline(value);
    console.log(`[Chauffeur] ${value ? '🟢 Mode en ligne activé - Recherche de courses...' : '🔴 Mode hors ligne - Recherche arrêtée'}`);
    addDriverTag('status', value ? 'online' : 'offline');
    
    // Sauvegarder le statut localement pour persistance
    try {
      await SecureStore.setItemAsync(`driver_${sessionId}_isOnline`, value ? 'true' : 'false');
      console.log(`[Chauffeur] ✅ Online status saved locally: ${value}`);
    } catch (e) {
      console.log('[Chauffeur] Failed to save status locally');
    }
    
    try {
      await apiPatch(`/api/driver-sessions/${sessionId}/status`, { isOnline: value });
    } catch (err) {
      console.log('Failed to update status via API');
    }
    
    updateDriverStatus(sessionId, value);
    
    if (!value) {
      setPendingOrders([]);
    }
  };

  const handleAcceptOrder = (orderId: string) => {
    if (!sessionId || acceptingOrderId) return;
    
    setAcceptingOrderId(orderId);
    acceptOrder(orderId, sessionId);
    
    acceptTimeoutRef.current = setTimeout(() => {
      console.log('[Chauffeur] Accept timeout - resetting button');
      setAcceptingOrderId(null);
    }, 10000);
  };

  const handleDeclineOrder = (orderId: string) => {
    setDecliningOrderId(orderId);
    setTimeout(() => {
      setDeclinedOrderIds(prev => new Set(prev).add(orderId));
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      setDecliningOrderId(null);
    }, 300);
  };

  const handleRefresh = async () => {
    if (!sessionId || !isOnline) return;
    
    setRefreshing(true);
    try {
      const orders = await apiFetch<any[]>('/api/orders/pending');
      if (orders && orders.length > 0) {
        const now = Date.now();
        const maxAge = 8 * 60 * 1000; // 8 minutes
        const validOrders = orders.filter(o => {
          if (o.status && o.status !== 'pending') return false;
          if (o.createdAt && (now - new Date(o.createdAt).getTime()) > maxAge) return false;
          if (declinedOrderIds.has(o.id)) return false;
          return true;
        });
        setPendingOrders(validOrders);
      } else {
        setPendingOrders([]);
      }
    } catch (err) {
      console.log('Refresh failed');
    }
    setRefreshing(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const progress = contentOffset.x / (contentSize.width - layoutMeasurement.width);
    setScrollProgress(Math.max(0, Math.min(1, progress)));
  };

  const handleCategoryPress = (category: typeof categories[0]) => {
    setSelectedCategory(category.id);
    router.push(category.href as any);
    setTimeout(() => setSelectedCategory(null), 300);
  };

  const renderMap = () => {
    // Sur mobile avec react-native-maps disponible
    if (isMapsAvailable && MapView) {
      return (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={userLocation ? {
            ...userLocation,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          } : TAHITI_REGION}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {userLocation && Marker && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={24} color="#FFFFFF" />
              </View>
            </Marker>
          )}
        </MapView>
      );
    }

    // Fallback pour web ou si maps non disponible
    return (
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={64} color="#a3ccff" />
        <Text style={styles.mapPlaceholderText}>
          {Platform.OS === 'web' 
            ? 'Carte disponible sur mobile' 
            : 'En attente de courses...'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map Background */}
      <View style={styles.mapBackground}>
        {renderMap()}
      </View>

      {/* Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerContent}>
          <MenuBurger />

          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => router.push('/(chauffeur)/profil')}
            accessibilityLabel="Ouvrir le profil"
            accessibilityRole="button"
            accessibilityHint="Navigue vers la page de profil du chauffeur"
          >
            <Ionicons name="settings" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Category Bubbles */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryBubble,
                  isSelected ? styles.categoryBubbleSelected : styles.categoryBubbleDefault
                ]}
                onPress={() => handleCategoryPress(category)}
              >
                <View style={styles.categoryIconContainer}>
                  <Ionicons 
                    name={category.ionicon} 
                    size={24} 
                    color={isSelected ? '#FFFFFF' : '#F5C400'} 
                  />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected ? styles.categoryLabelSelected : styles.categoryLabelDefault
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {shouldShowSupportCard && (
        <View style={styles.supportMessageCardContainer}>
          <TouchableOpacity
            style={styles.supportMessageCard}
            onPress={handleOpenSupportMessages}
            activeOpacity={0.85}
          >
            <View style={styles.supportMessageIcon}>
              <Ionicons name="chatbubbles" size={22} color="#1a1a1a" />
            </View>
            <View style={styles.supportMessageContent}>
              <Text style={styles.supportMessageTitle}>Messages du support</Text>
              <Text style={styles.supportMessageSubtitle} numberOfLines={2}>
                {latestSupportMessage
                  ? latestSupportMessage.content
                  : isLoadingSupport
                  ? 'Chargement des messages...'
                  : 'Aucun message pour le moment'}
              </Text>
            </View>
            {unreadSupportCount > 0 && (
              <View style={styles.supportMessageBadge}>
                <Text style={styles.supportMessageBadgeText}>
                  {unreadSupportCount > 99 ? '99+' : unreadSupportCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Orders Panel (Middle area) */}
      {isOnline && pendingOrders.length > 0 && (
        <View style={styles.ordersPanel}>
          <ScrollView
            style={styles.ordersPanelScroll}
            contentContainerStyle={styles.ordersPanelContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh} 
                colors={['#F5C400']} 
              />
            }
          >
            <Text variant="label" style={styles.ordersTitle}>
              Commandes en attente ({pendingOrders.length})
            </Text>
            {pendingOrders.map((order) => {
              const pickup = order.addresses?.find((a) => a.type === 'pickup');
              const destination = order.addresses?.find((a) => a.type === 'destination');
              const isAccepting = acceptingOrderId === order.id;
              const isDeclining = decliningOrderId === order.id;

              return (
                <View key={order.id} style={styles.orderCardNew}>
                  {/* Top Section - Type & Price */}
                  <View style={styles.orderTopSection}>
                    <View style={styles.orderBadge}>
                      <Ionicons name="car" size={14} color="#1a1a1a" />
                      <Text style={styles.orderBadgeText}>
                        {order.rideOption?.title || 'Course immédiate'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedOrderForDetails(order)}
                        style={styles.infoButton}
                        accessibilityLabel="Voir les détails de la course"
                        accessibilityRole="button"
                        accessibilityHint="Affiche les informations détaillées de cette course"
                      >
                        <Ionicons name="information-circle" size={20} color="#22C55E" />
                      </TouchableOpacity>
                      <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>
                          {formatPrice(order.totalPrice || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Route Section */}
                  <View style={styles.routeSection}>
                    <View style={styles.routeTimeline}>
                      <View style={styles.routeDotGreen} />
                      <View style={styles.routeLineVertical} />
                      <View style={styles.routeDotRed} />
                    </View>
                    <View style={styles.routeAddresses}>
                      <Text style={styles.routeAddressText} numberOfLines={1}>
                        {pickup?.value || 'Adresse de départ'}
                      </Text>
                      <Text style={styles.routeAddressText} numberOfLines={1}>
                        {destination?.value || "Adresse d'arrivée"}
                      </Text>
                    </View>
                  </View>

                  {/* Actions Section */}
                  <View style={styles.orderActionsNew}>
                    <TouchableOpacity
                      style={[styles.declineButtonNew, isDeclining && styles.buttonDisabled]}
                      onPress={() => handleDeclineOrder(order.id)}
                      disabled={isDeclining || isAccepting}
                      accessibilityLabel="Décliner la course"
                      accessibilityRole="button"
                      accessibilityHint="Refuse cette course"
                      accessibilityState={{ disabled: isDeclining || isAccepting }}
                    >
                      <Ionicons name="close" size={18} color="#DC2626" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.messageButtonNew}
                      onPress={() => router.push({
                        pathname: '/(chauffeur)/chat',
                        params: { 
                          orderId: order.id, 
                          clientName: order.clientName || 'Client',
                          sessionId: sessionId || ''
                        }
                      })}
                      accessibilityLabel="Ouvrir la messagerie"
                      accessibilityRole="button"
                      accessibilityHint="Ouvre la conversation avec le client"
                    >
                      <Ionicons name="chatbubble-ellipses" size={18} color="#F5C400" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.acceptButtonNew, isAccepting && styles.buttonDisabled]}
                      onPress={() => handleAcceptOrder(order.id)}
                      disabled={isAccepting || isDeclining}
                      accessibilityLabel={isAccepting ? "Acceptation en cours" : "Accepter la course"}
                      accessibilityRole="button"
                      accessibilityHint="Accepte cette course et commence le service"
                      accessibilityState={{ disabled: isAccepting || isDeclining }}
                    >
                      <Text style={styles.acceptTextNew}>
                        {isAccepting ? 'Acceptation...' : 'Accepter'}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Connection Status - Above bottom panel */}
      <View style={styles.connectionIndicator}>
        <View style={styles.connectionBadge}>
          <View style={[
            styles.connectionDot,
            connectionStatus === 'connected' ? styles.connectionConnected :
            connectionStatus === 'connecting' ? styles.connectionConnecting :
            styles.connectionDisconnected
          ]} />
          <Text style={styles.connectionText}>
            {connectionStatus === 'connected' ? 'Connecté' :
             connectionStatus === 'connecting' ? 'Connexion...' :
             'Déconnecté'}
          </Text>
        </View>
      </View>

      {/* Order Details Modal */}
      <Modal
        visible={!!selectedOrderForDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedOrderForDetails(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrderForDetails && (
              <>
                <View style={styles.modalHeader}>
                  <Text variant="h2" style={styles.modalTitle}>Détails de la commande</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedOrderForDetails(null)}
                    style={styles.modalCloseButton}
                    accessibilityLabel="Fermer les détails"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={24} color="#1a1a1a" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                  {(() => {
                    const basePrice = getBasePrice(tarifs);
                    const distance = selectedOrderForDetails.routeInfo?.distance || 0;
                    const { price: pricePerKm, period: pricePeriod } = getPricePerKmForOrder(
                      selectedOrderForDetails.createdAt,
                      tarifs
                    );
                    const distancePrice = distance * pricePerKm;
                    const supplementsTotal = selectedOrderForDetails.supplements?.reduce(
                      (acc, s) => acc + (s.price * (s.quantity || 1)),
                      0
                    ) || 0;
                    const passengers = selectedOrderForDetails.passengers || 1;
                    const majorationPassagers = passengers >= 5 ? 500 : 0;
                    const waitingTime = selectedOrderForDetails.waitingTimeMinutes || 0;
                    const waitingFee = waitingTime > 5 ? (waitingTime - 5) * 42 : 0;
                    
                    // ═══════════════════════════════════════════════════════════════════════════
                    // RÉSERVATION À L'AVANCE: Calcul du temps restant avant la réservation
                    // ═══════════════════════════════════════════════════════════════════════════
                    const formatScheduledTime = (scheduledTime: string) => {
                      const date = new Date(scheduledTime);
                      const now = new Date();
                      const diffMs = date.getTime() - now.getTime();
                      const diffMins = Math.round(diffMs / 60000);
                      
                      const dateStr = date.toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        timeZone: 'Pacific/Tahiti'
                      });
                      const timeStr = date.toLocaleTimeString('fr-FR', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'Pacific/Tahiti'
                      });
                      
                      let timeUntilStr = '';
                      if (diffMins > 0) {
                        if (diffMins < 60) {
                          timeUntilStr = `(dans ${diffMins} min)`;
                        } else if (diffMins < 1440) {
                          const hours = Math.floor(diffMins / 60);
                          const mins = diffMins % 60;
                          timeUntilStr = `(dans ${hours}h${mins > 0 ? mins + 'min' : ''})`;
                        } else {
                          const days = Math.floor(diffMins / 1440);
                          timeUntilStr = `(dans ${days} jour${days > 1 ? 's' : ''})`;
                        }
                      }
                      
                      return { dateStr, timeStr, timeUntilStr };
                    };
                    
                    return (
                      <>
                        {/* ═══ RÉSERVATION À L'AVANCE: Affichage date/heure + temps restant ═══ */}
                        {selectedOrderForDetails.isAdvanceBooking && selectedOrderForDetails.scheduledTime && (
                          <View style={[styles.detailSection, styles.scheduledSection]}>
                            <View style={styles.scheduledHeader}>
                              <Ionicons name="calendar" size={24} color="#8B5CF6" />
                              <Text style={styles.scheduledTitle}>Réservation à l'avance</Text>
                            </View>
                            {(() => {
                              const { dateStr, timeStr, timeUntilStr } = formatScheduledTime(selectedOrderForDetails.scheduledTime);
                              return (
                                <View style={styles.scheduledContent}>
                                  <Text style={styles.scheduledDate}>{dateStr}</Text>
                                  <Text style={styles.scheduledTime}>à {timeStr}</Text>
                                  {timeUntilStr && (
                                    <Text style={styles.scheduledCountdown}>{timeUntilStr}</Text>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                        )}
                        
                        {/* Décomposition du prix */}
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>Décomposition du prix</Text>
                          
                          {/* Prise en charge */}
                          <View style={styles.priceDetailRow}>
                            <Text style={styles.priceDetailLabel}>Prise en charge</Text>
                            <Text style={styles.priceDetailValue}>{formatPrice(basePrice)}</Text>
                          </View>
                          
                          {/* Distance × tarif kilométrique */}
                          {distance > 0 && (
                            <View style={styles.priceDetailRow}>
                              <View style={styles.priceDetailLabelContainer}>
                                <Text style={styles.priceDetailLabel}>
                                  {distance.toFixed(2)} km × {pricePerKm} XPF/km ({pricePeriod})
                                </Text>
                              </View>
                              <Text style={styles.priceDetailValue}>{formatPrice(distancePrice)}</Text>
                            </View>
                          )}
                          
                          {/* Majoration passagers */}
                          {majorationPassagers > 0 && (
                            <View style={styles.priceDetailRow}>
                              <Text style={styles.priceDetailLabel}>Majoration passagers (≥5)</Text>
                              <Text style={styles.priceDetailValue}>{formatPrice(majorationPassagers)}</Text>
                            </View>
                          )}
                          
                          {/* Suppléments */}
                          {supplementsTotal > 0 && (
                            <View style={styles.priceDetailRow}>
                              <Text style={styles.priceDetailLabel}>Suppléments</Text>
                              <Text style={styles.priceDetailValue}>{formatPrice(supplementsTotal)}</Text>
                            </View>
                          )}
                          
                          {/* Temps d'attente */}
                          {waitingFee > 0 && (
                            <View style={styles.priceDetailRow}>
                              <Text style={styles.priceDetailLabel}>
                                Temps d'attente ({waitingTime} min)
                              </Text>
                              <Text style={styles.priceDetailValue}>{formatPrice(waitingFee)}</Text>
                            </View>
                          )}
                          
                          <View style={styles.priceDetailSeparator} />
                          
                          {/* Prix total */}
                          <View style={styles.priceDetailRowTotal}>
                            <Text style={styles.priceDetailLabelTotal}>Prix total</Text>
                            <Text style={styles.priceDetailValueTotal}>{formatPrice(selectedOrderForDetails.totalPrice || 0)}</Text>
                          </View>
                          
                          <Text style={styles.detailSubtext}>Vos gains: {formatPrice(selectedOrderForDetails.driverEarnings || 0)}</Text>
                        </View>

                        {/* Suppléments détaillés */}
                        {selectedOrderForDetails.supplements && selectedOrderForDetails.supplements.length > 0 && (
                          <View style={styles.detailSection}>
                            <Text style={styles.detailSectionTitle}>Détails des suppléments</Text>
                            {selectedOrderForDetails.supplements.map((supplement, index) => (
                              <View key={index} style={styles.supplementRow}>
                                <View style={styles.supplementInfo}>
                                  {supplement.icon && (
                                    <Ionicons name={supplement.icon as any} size={20} color="#22C55E" style={{ marginRight: 8 }} />
                                  )}
                                  <Text style={styles.supplementName}>{supplement.name}</Text>
                                  {supplement.quantity > 1 && (
                                    <Text style={styles.supplementQuantity}> × {supplement.quantity}</Text>
                                  )}
                                </View>
                                <Text style={styles.supplementPrice}>
                                  {formatPrice((supplement.price || 0) * (supplement.quantity || 1))}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Message du client */}
                        {selectedOrderForDetails.driverComment && (
                          <View style={styles.detailSection}>
                            <Text style={styles.detailSectionTitle}>Message du client</Text>
                            <View style={styles.messageBox}>
                              <Text style={styles.messageText}>{selectedOrderForDetails.driverComment}</Text>
                            </View>
                          </View>
                        )}

                        {/* Informations de course */}
                        <View style={styles.detailSection}>
                          <Text style={styles.detailSectionTitle}>Informations</Text>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Passagers:</Text>
                            <Text style={styles.infoValue}>{passengers}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Paiement:</Text>
                            <Text style={styles.infoValue}>
                              {selectedOrderForDetails.paymentMethod === 'card' ? 'Carte (TPE)' : 'Espèces'}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* RÉSERVATION À L'AVANCE: Modal de confirmation après acceptation */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!bookingConfirmedOrder}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBookingConfirmedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalContent}>
            <View style={styles.bookingSuccessIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
            <Text style={styles.bookingSuccessTitle}>Réservation acceptée !</Text>
            <Text style={styles.bookingSuccessSubtitle}>
              La course a été ajoutée à vos réservations
            </Text>
            
            {bookingConfirmedOrder?.scheduledTime && (
              <View style={styles.bookingScheduleInfo}>
                <Ionicons name="calendar" size={24} color="#8B5CF6" />
                <View style={styles.bookingScheduleText}>
                  <Text style={styles.bookingScheduleDate}>
                    {new Date(bookingConfirmedOrder.scheduledTime).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      timeZone: 'Pacific/Tahiti',
                    })}
                  </Text>
                  <Text style={styles.bookingScheduleTime}>
                    à {new Date(bookingConfirmedOrder.scheduledTime).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Pacific/Tahiti',
                    })}
                  </Text>
                </View>
              </View>
            )}
            
            <View style={styles.bookingClientInfo}>
              <Text style={styles.bookingClientName}>{bookingConfirmedOrder?.clientName}</Text>
              <Text style={styles.bookingClientAddress}>
                {bookingConfirmedOrder?.addresses?.find(a => a.type === 'pickup')?.value || 'Adresse de départ'}
              </Text>
            </View>
            
            <View style={styles.bookingButtonsRow}>
              <TouchableOpacity
                style={styles.bookingButtonSecondary}
                onPress={() => setBookingConfirmedOrder(null)}
                accessibilityLabel="Fermer"
                accessibilityRole="button"
                accessibilityHint="Ferme cette notification de réservation"
              >
                <Ionicons name="close" size={20} color="#6B7280" />
                <Text style={styles.bookingButtonSecondaryText}>Fermer</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.bookingButtonPrimary}
                onPress={() => {
                  setBookingConfirmedOrder(null);
                  router.push('/(chauffeur)/courses');
                }}
                accessibilityLabel="Voir mes courses"
                accessibilityRole="button"
                accessibilityHint="Navigue vers la page des courses"
              >
                <Ionicons name="list" size={20} color="#FFFFFF" />
                <Text style={styles.bookingButtonPrimaryText}>Mes courses</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* RÉSERVATION À L'AVANCE: Modal de rappel 30 min avant */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!bookingStartReminder}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}} // Ne pas fermer sans action
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalContent}>
            <View style={styles.bookingReminderIcon}>
              <Ionicons name="alarm" size={64} color="#F5C400" />
            </View>
            <Text style={styles.bookingReminderTitle}>Commencez votre course ?</Text>
            <Text style={styles.bookingReminderSubtitle}>
              Votre réservation commence dans {bookingStartReminder?.minutesUntilStart || 30} minutes
            </Text>
            
            {bookingStartReminder?.order && (
              <>
                <View style={styles.bookingScheduleInfo}>
                  <Ionicons name="calendar" size={24} color="#8B5CF6" />
                  <View style={styles.bookingScheduleText}>
                    <Text style={styles.bookingScheduleDate}>
                      {bookingStartReminder.order.scheduledTime && new Date(bookingStartReminder.order.scheduledTime).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'Pacific/Tahiti',
                      })}
                    </Text>
                    <Text style={styles.bookingScheduleTime}>
                      à {bookingStartReminder.order.scheduledTime && new Date(bookingStartReminder.order.scheduledTime).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Pacific/Tahiti',
                      })}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.bookingClientInfo}>
                  <Text style={styles.bookingClientName}>{bookingStartReminder.order.clientName}</Text>
                  <Text style={styles.bookingClientAddress}>
                    {bookingStartReminder.order.addresses?.find((a: any) => a.type === 'pickup')?.value || 'Adresse de départ'}
                  </Text>
                </View>
                
                <View style={styles.bookingPriceTag}>
                  <Text style={styles.bookingPriceText}>{formatPrice(bookingStartReminder.order.totalPrice || 0)}</Text>
                </View>
              </>
            )}
            
            <View style={styles.bookingButtonsRow}>
              <TouchableOpacity
                style={styles.bookingButtonSecondary}
                onPress={() => setBookingStartReminder(null)}
                accessibilityLabel="Plus tard"
                accessibilityRole="button"
                accessibilityHint="Ferme cette notification et la rappelle plus tard"
              >
                <Ionicons name="time" size={20} color="#6B7280" />
                <Text style={styles.bookingButtonSecondaryText}>Plus tard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.bookingButtonStart}
                onPress={async () => {
                  if (bookingStartReminder?.order?.id) {
                    try {
                      const response = await apiFetch(`/api/orders/${bookingStartReminder.order.id}/start-booking`, {
                        method: 'POST',
                        headers: {
                          'X-Driver-Session': sessionId || '',
                        },
                      });
                      setBookingStartReminder(null);
                      router.push({
                        pathname: '/(chauffeur)/course-en-cours',
                        params: { orderId: bookingStartReminder.order.id },
                      });
                    } catch (error) {
                      console.error('[Chauffeur] Error starting booking:', error);
                    }
                  }
                }}
                accessibilityLabel="Commencer la course"
                accessibilityRole="button"
                accessibilityHint="Démarre la course réservée et navigue vers l'écran de course en cours"
              >
                <Ionicons name="car" size={20} color="#FFFFFF" />
                <Text style={styles.bookingButtonPrimaryText}>Commencer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Panel - Status Toggle */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomPanelContent}>
          <View style={[
            styles.statusToggleCard,
            isOnline ? styles.statusToggleOnline : styles.statusToggleOffline
          ]}>
            <View style={styles.statusToggleContent}>
              <Ionicons 
                name="power" 
                size={28} 
                color={isOnline ? '#22C55E' : '#EF4444'} 
              />
              <View style={styles.statusTextContainer}>
                <Text style={[
                  styles.statusToggleText,
                  isOnline ? styles.statusTextOnline : styles.statusTextOffline
                ]}>
                  {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                </Text>
                <Text style={styles.statusSubtext}>
                  {isOnline 
                    ? pendingOrders.length > 0 
                      ? `${pendingOrders.length} course${pendingOrders.length > 1 ? 's' : ''} disponible${pendingOrders.length > 1 ? 's' : ''}`
                      : 'En attente de courses'
                    : 'Activez pour recevoir des courses'
                  }
                </Text>
              </View>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: '#e5e7eb', true: '#86efac' }}
              thumbColor={isOnline ? '#22C55E' : '#9ca3af'}
              ios_backgroundColor="#e5e7eb"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e8f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 14,
    color: '#5c5c5c',
    textAlign: 'center',
  },
  driverMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: {
    height: 58,
    width: 118,
    marginTop: 0,
  },
  supportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F5C400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  categoriesContainer: {
    position: 'absolute',
    top: 105,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  supportMessageCardContainer: {
    position: 'absolute',
    top: 175,
    left: 16,
    right: 16,
    zIndex: 9,
  },
  supportMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F5E3A4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  supportMessageIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportMessageContent: {
    flex: 1,
  },
  supportMessageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  supportMessageSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  supportMessageBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  supportMessageBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  categoryBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryBubbleDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryBubbleSelected: {
    backgroundColor: '#F5C400',
    shadowColor: '#F5C400',
    shadowOpacity: 0.3,
  },
  categoryIconContainer: {
    width: 22,
    height: 22,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  categoryLabelDefault: {
    color: '#343434',
  },
  categoryLabelSelected: {
    color: '#FFFFFF',
  },
  connectionIndicator: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionConnected: {
    backgroundColor: '#22C55E',
  },
  connectionConnecting: {
    backgroundColor: '#F5C400',
  },
  connectionDisconnected: {
    backgroundColor: '#EF4444',
  },
  connectionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  ordersPanel: {
    position: 'absolute',
    top: 200,
    left: 16,
    right: 16,
    maxHeight: height * 0.45,
    zIndex: 10,
  },
  ordersPanelScroll: {
    flex: 1,
  },
  ordersPanelContent: {
    paddingBottom: 16,
  },
  ordersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // New Order Card Design
  orderCardNew: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  orderTopSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5C400',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  priceTag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priceTagText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  routeSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  routeTimeline: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  routeLineVertical: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  routeAddresses: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  routeAddressText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  orderActionsNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  declineButtonNew: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonNew: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 22,
    gap: 8,
  },
  acceptTextNew: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    paddingHorizontal: 20,
  },
  detailSection: {
    marginTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  detailPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
  },
  detailSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  supplementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  supplementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  supplementName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  supplementQuantity: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  supplementPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  messageBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  // Price detail styles
  priceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceDetailLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  priceDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    flexShrink: 1,
  },
  priceDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  priceDetailSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  priceDetailRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceDetailLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  priceDetailValueTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
  },

  // Legacy styles (kept for compatibility)
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
  },
  addressContainer: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  addressLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 24,
    paddingVertical: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomPanelContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 20,
  },
  statusToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  statusToggleOnline: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  statusToggleOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statusToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTextContainer: {
    gap: 2,
  },
  statusToggleText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextOnline: {
    color: '#22C55E',
  },
  statusTextOffline: {
    color: '#EF4444',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Styles pour l'affichage de la date/heure
  // ═══════════════════════════════════════════════════════════════════════════
  scheduledSection: {
    backgroundColor: '#F5F3FF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  scheduledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  scheduledTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  scheduledContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  scheduledDate: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  scheduledTime: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B5CF6',
    marginTop: 4,
  },
  scheduledCountdown: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // RÉSERVATION À L'AVANCE: Styles pour les modals de réservation
  // ═══════════════════════════════════════════════════════════════════════════
  bookingModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  bookingSuccessIcon: {
    marginBottom: 16,
  },
  bookingReminderIcon: {
    marginBottom: 16,
  },
  bookingSuccessTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 8,
  },
  bookingReminderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  bookingSuccessSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  bookingReminderSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  bookingScheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
  },
  bookingScheduleText: {
    marginLeft: 16,
  },
  bookingScheduleDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  bookingScheduleTime: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B5CF6',
    marginTop: 2,
  },
  bookingClientInfo: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
  },
  bookingClientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  bookingClientAddress: {
    fontSize: 14,
    color: '#6B7280',
  },
  bookingPriceTag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 24,
  },
  bookingPriceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookingButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  bookingButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  bookingButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  bookingButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  bookingButtonStart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  bookingButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
