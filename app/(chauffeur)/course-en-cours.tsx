import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Alert, Platform, Modal, Image, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RatingModal } from '@/components/RatingModal';
import { InRideOrderNotification } from '@/components/InRideOrderNotification';
import { MapView, Marker, Polyline, isMapsAvailable } from '@/lib/maps';
import { DriverCarIcon } from '@/components/DriverCarIcon';
import Constants from 'expo-constants';
import {
  connectSocketAsync,
  joinRideRoom,
  updateRideStatus,
  confirmPayment,
  onRideStatusChanged,
  onRideCancelled,
  onClientLocationUpdate,
  emitDriverLocation,
  calculateHeading,
  cancelRide,
  getSocket,
  onNewOrder,
  acceptOrder,
  declineOrder,
  onOrderTaken,
  joinDriverSession,
  updateDriverStatus,
} from '@/lib/socket';
import { getDriverSessionId, getActiveDriverOrder, getOrder, ApiError, apiPatch, apiFetch, apiPost, getFraisServiceConfig } from '@/lib/api';
import * as Location from 'expo-location';
import type { Order, LocationUpdate } from '@/lib/types';
import { useTarifs, isNightRate, getCurrentRatePerKm } from '@/lib/tarifs';

const TAHITI_REGION = {
  latitude: -17.6509,
  longitude: -149.4260,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

// Icône de départ (GIF) - chargement au niveau module pour bundling correct
const DEPART_ICON = require('@/assets/images/Iconeacpp(1).gif');

// Clé API Google Maps
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

// Log pour debug - FORCE l'affichage au chargement du module
console.log('[CHAUFFEUR COURSE] ===== INITIALIZATION =====');
console.log('[CHAUFFEUR COURSE] Google Maps API Key loaded:', {
  hasKey: !!GOOGLE_MAPS_API_KEY,
  keyLength: GOOGLE_MAPS_API_KEY?.length || 0,
  fromConfig: !!Constants.expoConfig?.extra?.googleMapsApiKey,
  configValue: Constants.expoConfig?.extra?.googleMapsApiKey?.substring(0, 10) + '...' || 'undefined'
});
console.log('[CHAUFFEUR COURSE] Maps availability:', {
  isMapsAvailable,
  hasMapView: !!MapView,
  MapViewType: MapView ? MapView.constructor.name : 'undefined',
  Platform: Platform.OS,
});
console.log('[CHAUFFEUR COURSE] ========================');

// Fonction pour décoder une polyline Google Maps (copiée exactement de l'app client)
const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coordinates.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5,
    });
  }

  return coordinates;
};

export default function ChauffeurCourseEnCoursScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending'>('enroute');
  
  // Hook pour récupérer les tarifs dynamiques depuis le back-office
  // En mode preview, utiliser directement les valeurs par défaut pour éviter les crashes
  const { tarifs: tarifsData, loading: tarifsLoading } = useTarifs();

  // Utiliser les tarifs chargés ou les valeurs par défaut
  const tarifs = tarifsData || {
    priseEnCharge: 1000,
    tarifJourKm: 130,
    tarifNuitKm: 260,
    minuteArret: 42,
    heureDebutJour: 6,
    heureFinJour: 20,
    supplements: [],
    lastUpdated: Date.now(),
  };
  const waitingRate = tarifs.minuteArret || 42;
  
  // State pour les frais de service configurables
  const [fraisServicePercent, setFraisServicePercent] = useState(15);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [clientLocation, setClientLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [orderNotFound, setOrderNotFound] = useState(false);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    status: 'success' | 'failed';
    amount: number;
    paymentMethod?: 'card' | 'cash';
    cardBrand?: string | null;
    cardLast4?: string | null;
    errorMessage?: string;
    waitingTimeMinutes?: number | null;
    paidStopsCost?: number;
    supplements?: Array<{ nom?: string; name?: string; prixXpf?: number; price?: number; quantity?: number }>;
  } | null>(null);
  const [showPaymentResult, setShowPaymentResult] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const paymentFlowTriggeredRef = useRef(false);
  const [navigationMode, setNavigationMode] = useState(false); // Mode navigation/itinéraire
  const [showAddressesModal, setShowAddressesModal] = useState(false); // Modal pour afficher les adresses
  const [showPriceDetailsModal, setShowPriceDetailsModal] = useState(false); // Modal détails de tarification
  
  // États pour l'arrêt payant
  const [showPaidStopModal, setShowPaidStopModal] = useState(false);
  const [paidStopDisplaySeconds, setPaidStopDisplaySeconds] = useState(0); // Temps affiché (accumulé + actuel)
  const [paidStopTotalCost, setPaidStopTotalCost] = useState(0);
  const paidStopAnimationRef = useRef<number | null>(null); // requestAnimationFrame pour un timer fluide
  const paidStopAccumulatedRef = useRef(0); // Temps accumulé des arrêts précédents (ref pour éviter stale closures)
  const paidStopStartTimeRef = useRef<number | null>(null); // Timestamp du début de l'arrêt actuel
  const paidStopsPersistedCostRef = useRef(0); // Coût total des arrêts déjà persistés au serveur
  
  // Timer d'attente avant le démarrage (arrived)
  const [waitingDisplaySeconds, setWaitingDisplaySeconds] = useState(0);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWaitingPrice = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 5) return 0;
    return (mins - 5) * 42;
  };
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingStartAtRef = useRef<number | null>(null);
  const basePriceRef = useRef<number | null>(null); // Prix de base de la commande (avant arrêts payants)
  
  // États pour les notifications de nouvelles courses pendant la course
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const declinedOrdersRef = useRef<Set<string>>(new Set()); // IDs des commandes refusées par ce chauffeur
  
  // Route coordinates for Polyline
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [driverRouteCoordinates, setDriverRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [driverEta, setDriverEta] = useState<string | null>(null);
  const [userMovedMap, setUserMovedMap] = useState(false);
  const [initialCenterDone, setInitialCenterDone] = useState(false);
  const recenterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inprogressCenteredRef = useRef(false);
  const previousRideStatusRef = useRef<'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending'>('enroute');

  const mapRef = useRef<any>(null);
  const locationWatchId = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const lastRideStatusRef = useRef<string | null>(null); // Pour suivre les changements de statut

  // Récupérer la config des frais de service
  useEffect(() => {
    getFraisServiceConfig().then(config => {
      setFraisServicePercent(config.fraisServicePrestataire);
      console.log('[Chauffeur Course] Frais de service chargés:', config.fraisServicePrestataire + '%');
    });
  }, []);

  // Récupérer la session et la commande active
  useEffect(() => {
    let mounted = true;

    const fetchOrder = async () => {
      setIsLoadingOrder(true);
      try {
        const sid = await getDriverSessionId();
        if (!sid) {
          router.replace('/(chauffeur)/login');
          return;
        }
        setSessionId(sid);

        let orderId: string | null = null;

        // Si orderId est fourni en paramètre, l'utiliser directement
        if (params.orderId) {
          orderId = params.orderId;
          console.log('[Chauffeur Course] Using orderId from params:', orderId);
        } else {
          // Sinon, chercher la commande active
          console.log('[Chauffeur Course] No orderId in params, fetching active order...');
          const activeOrderResponse = await getActiveDriverOrder(sid);
          if (activeOrderResponse.hasActiveOrder && activeOrderResponse.order) {
            orderId = activeOrderResponse.order.id;
            console.log('[Chauffeur Course] Found active order:', orderId);
          }
        }

        if (orderId) {
          const orderDetails = await getOrder(orderId);
          if (!mounted) return;
          console.log('[Chauffeur Course] Order loaded:', orderDetails.id, 'Status:', orderDetails.status);
          setOrder(orderDetails);
          
          // Stocker le prix de base initial (seulement la première fois)
          // On essaie de récupérer le prix initial depuis rideOption si disponible (persistance backend)
          // Sinon on utilise le totalPrice actuel
          if (basePriceRef.current === null) {
            const initialPrice = (orderDetails.rideOption as any)?.initialTotalPrice;
            basePriceRef.current = initialPrice !== undefined ? initialPrice : orderDetails.totalPrice;
            console.log('[Chauffeur Course] Base price stored:', basePriceRef.current, initialPrice !== undefined ? '(from rideOption)' : '(from totalPrice)');
          }
          
          // Mapper le statut de la commande au statut de course
          const statusMap: Record<string, 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending'> = {
            accepted: 'enroute',
            driver_enroute: 'enroute',
            driver_arrived: 'arrived',
            in_progress: 'inprogress',
            completed: 'completed',
            payment_pending: 'payment_pending',
            payment_confirmed: 'completed',
          };
          const mappedStatus = (orderDetails.status && statusMap[orderDetails.status]) || 'enroute';
          setRideStatus(mappedStatus);
          
          console.log('[Chauffeur Course] Mapped status:', orderDetails.status, '->', mappedStatus);
          
          // Si le statut est "arrived", initialiser le timer avec driverArrivedAt de l'API
          if (mappedStatus === 'arrived') {
            console.log('[Chauffeur Course] 🔍 Order driverArrivedAt:', orderDetails.driverArrivedAt);
            if (orderDetails.driverArrivedAt) {
              const arrivedAt = new Date(orderDetails.driverArrivedAt).getTime();
              waitingStartAtRef.current = arrivedAt;
              const elapsedSeconds = Math.floor((Date.now() - arrivedAt) / 1000);
              setWaitingDisplaySeconds(elapsedSeconds > 0 ? elapsedSeconds : 0);
              console.log('[Chauffeur Course] ✅ Timer initialized from API:', {
                arrivedAt: new Date(arrivedAt).toISOString(),
                elapsedSeconds
              });
            } else {
              // Fallback: utiliser l'heure actuelle si driverArrivedAt n'est pas disponible
              waitingStartAtRef.current = Date.now();
              setWaitingDisplaySeconds(0);
              console.log('[Chauffeur Course] ⚠️ No driverArrivedAt, starting timer from now');
            }
          }

          // Restaurer le coût des arrêts payants depuis rideOption si disponible
          const persistedPaidStops = (orderDetails.rideOption as any)?.paidStopsCost || 0;
          if (persistedPaidStops > 0) {
            setPaidStopTotalCost(persistedPaidStops);
            // On estime le temps accumulé (42 XPF/min)
            paidStopAccumulatedRef.current = Math.floor(persistedPaidStops / 42) * 60;
            console.log('[Chauffeur Course] Restored paid stops cost:', persistedPaidStops);
          }

          // Connecter Socket.IO et joindre les rooms
          try {
            await connectSocketAsync();
            // Rejoindre la room de la course
            joinRideRoom(orderDetails.id, 'driver', { sessionId: sid });
            console.log('[Chauffeur Course] Joined ride room:', orderDetails.id);
            
            // Rejoindre aussi la session chauffeur et rester en ligne pour recevoir les nouvelles commandes
            joinDriverSession(sid);
            updateDriverStatus(sid, true);
            console.log('[Chauffeur Course] Joined drivers:online room to receive new orders');
          } catch (socketError) {
            console.error('Socket connection failed:', socketError);
            Alert.alert('Erreur', 'Impossible de se connecter au serveur en temps réel.');
          }
        } else {
          console.warn('[Chauffeur Course] No order found');
          setOrderNotFound(true);
        }
      } catch (err) {
        console.error('Failed to fetch active order:', err);
        if (!mounted) return;
        Alert.alert('Erreur', `Impossible de charger la commande: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
        setOrderNotFound(true);
      } finally {
        setIsLoadingOrder(false);
      }
    };

    fetchOrder();

    return () => {
      mounted = false;
      if (locationWatchId.current) {
        locationWatchId.current.remove();
      }
    };
  }, [params.orderId]);

  // Suivi GPS du chauffeur
  useEffect(() => {
    if (!order || !sessionId) return;

    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission de localisation refusée', 'Veuillez activer la localisation pour le suivi GPS.');
        return;
      }

      locationWatchId.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High, // Haute précision pour un suivi fluide
          timeInterval: 1500, // Mise à jour toutes les 1.5 secondes
          distanceInterval: 5, // Ou si déplacé de 5 mètres (plus réactif)
        },
        (newLocation) => {
          const { latitude, longitude, heading, speed } = newLocation.coords;
          
          // Calculer le heading si non disponible
          let calculatedHeading = heading || 0;
          if (lastLocationRef.current && !heading) {
            calculatedHeading = calculateHeading(
              lastLocationRef.current.lat,
              lastLocationRef.current.lng,
              latitude,
              longitude
            );
          }

          setDriverLocation({ latitude, longitude, heading: calculatedHeading });
          
          // Envoyer la position au serveur via Socket.IO
          emitDriverLocation(order.id, sessionId, latitude, longitude, calculatedHeading, speed || undefined);

          // Mettre à jour la caméra de la carte pour suivre le chauffeur
          if (mapRef.current) {
            if (navigationMode) {
              // Mode navigation : caméra 3D qui suit automatiquement avec pitch et heading
              mapRef.current.animateCamera({
                center: { latitude, longitude },
                heading: calculatedHeading,
                pitch: 60, // Vue inclinée pour un effet navigation
                altitude: 200, // Hauteur de vue
                zoom: 17, // Zoom rapproché
              }, { duration: 500 }); // Animation plus rapide pour suivre le mouvement
            } else {
              // Mode normal : vue classique
              mapRef.current.animateCamera({
                center: { latitude, longitude },
                heading: calculatedHeading,
                pitch: 45,
                zoom: 15,
              }, { duration: 1000 });
            }
          }

          lastLocationRef.current = { lat: latitude, lng: longitude, timestamp: Date.now() };
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationWatchId.current) {
        locationWatchId.current.remove();
      }
    };
  }, [order?.id, sessionId]);

  // Écouter les mises à jour de position du client
  useEffect(() => {
    if (!order) return;

    const unsubscribe = onClientLocationUpdate((data: LocationUpdate) => {
      if (data.orderId === order.id) {
        setClientLocation({ latitude: data.lat, longitude: data.lng });
      }
    });

    return () => unsubscribe();
  }, [order?.id]);

  // Écouter les nouvelles commandes pendant la course
  useEffect(() => {
    if (!sessionId) return;

    console.log('[InRide] Setting up new order listener');
    
    // Écouter les nouvelles commandes
    const unsubNewOrder = onNewOrder((newOrder: Order) => {
      console.log('[InRide] New order received:', newOrder.id);
      
      // Ne pas afficher si c'est la commande actuelle ou une commande refusée
      if (newOrder.id === order?.id || declinedOrdersRef.current.has(newOrder.id)) {
        console.log('[InRide] Ignoring order (current or declined)');
        return;
      }
      
      // Ajouter à la liste des notifications
      setIncomingOrders(prev => {
        // Éviter les doublons
        if (prev.some(o => o.id === newOrder.id)) return prev;
        return [...prev, newOrder];
      });
    });

    // Écouter quand une commande est prise par un autre chauffeur
    const unsubOrderTaken = onOrderTaken((data: { orderId: string }) => {
      console.log('[InRide] Order taken by another driver:', data.orderId);
      // Retirer de la liste des notifications
      setIncomingOrders(prev => prev.filter(o => o.id !== data.orderId));
    });

    return () => {
      unsubNewOrder();
      unsubOrderTaken();
    };
  }, [sessionId, order?.id]);

  // Activer/désactiver le mode navigation selon le statut
  useEffect(() => {
    // Activer le mode navigation quand la course est en cours (inprogress)
    if (rideStatus === 'inprogress') {
      setNavigationMode(true);
    } else {
      // Désactiver le mode navigation pour les autres statuts
      setNavigationMode(false);
    }
  }, [rideStatus]);

  // Écouter les changements de statut
  useEffect(() => {
    if (!order) return;

    // Mapping des statuts backend vers statuts UI
    const mapBackendStatusToUI = (backendStatus: string): 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending' | null => {
      const statusMapping: Record<string, 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending'> = {
        'enroute': 'enroute',
        'arrived': 'arrived',
        'inprogress': 'inprogress',
        'completed': 'completed',
        'payment_pending': 'payment_pending',
        // Statuts backend
        'accepted': 'enroute',
        'driver_enroute': 'enroute',
        'driver_arrived': 'arrived',
        'in_progress': 'inprogress',
        'payment_confirmed': 'completed',
      };
      return statusMapping[backendStatus] || null;
    };

    const unsubscribe = onRideStatusChanged((data) => {
      if (data.orderId === order.id) {
        console.log('[Chauffeur Course] Status changed via socket:', data.status, '-> orderStatus:', data.orderStatus);
        
        // ✅ Gérer l'annulation par le client
        if (data.status === 'cancelled' || data.orderStatus === 'cancelled') {
          Alert.alert(
            'Course annulée',
            'Le client a annulé la course.',
            [{ text: 'OK', onPress: () => router.replace('/(chauffeur)') }]
          );
          return;
        }
        
        // Mapper le statut reçu vers un statut UI valide
        const mappedStatus = mapBackendStatusToUI(data.status) || mapBackendStatusToUI(data.orderStatus);
        if (mappedStatus) {
          console.log('[Chauffeur Course] Mapped status:', data.status, '->', mappedStatus);
          const previousStatus = previousRideStatusRef.current;
          previousRideStatusRef.current = mappedStatus;
          setRideStatus(mappedStatus);
          
          // Mettre à jour l'ordre avec les nouvelles données (prix, heure d'arrivée)
          setOrder(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              totalPrice: data.totalPrice !== undefined ? data.totalPrice : prev.totalPrice,
              driverEarnings: data.driverEarnings !== undefined ? data.driverEarnings : prev.driverEarnings,
              driverArrivedAt: data.driverArrivedAt !== undefined ? data.driverArrivedAt : prev.driverArrivedAt,
              waitingTimeMinutes: data.waitingTimeMinutes !== undefined ? data.waitingTimeMinutes : prev.waitingTimeMinutes,
            };
          });
          
          // ═══════════════════════════════════════════════════════════════════════════
          // FRAIS DE SERVICE OFFERTS: Si le prix a été réduit (salarié TAPEA), mettre à jour le prix de base
          // ═══════════════════════════════════════════════════════════════════════════
          if ((data as any).fraisServiceOfferts && data.totalPrice !== undefined) {
            console.log('[Chauffeur Course] 🎁 Frais de service offerts - Mise à jour du prix de base:', basePriceRef.current, '->', data.totalPrice);
            basePriceRef.current = data.totalPrice;
          }
          
          if (mappedStatus === 'arrived') {
            console.log('[CHAUFFEUR] 📥 Received arrived confirmation from backend:', {
              driverArrivedAt: data.driverArrivedAt,
              statusTimestamp: data.statusTimestamp
            });
            const arrivedAt = data.driverArrivedAt ? new Date(data.driverArrivedAt).getTime() : (data.statusTimestamp ?? Date.now());
            
            // Ne mettre à jour que si on n'a pas déjà un temps d'arrivée
            // OU si celui du serveur est explicitement fourni (source de vérité)
            if (!waitingStartAtRef.current || data.driverArrivedAt) {
              // Si on a déjà un temps d'arrivée local et que le serveur en envoie un nouveau,
              // on ne le remplace que si la différence est significative (> 5s)
              // pour éviter les micro-sauts du timer
              const currentArrivedAt = waitingStartAtRef.current;
              if (!currentArrivedAt || Math.abs(currentArrivedAt - arrivedAt) > 5000 || data.driverArrivedAt) {
                waitingStartAtRef.current = arrivedAt;
                const elapsedSeconds = Math.floor((Date.now() - arrivedAt) / 1000);
                setWaitingDisplaySeconds(elapsedSeconds > 0 ? elapsedSeconds : 0);
                console.log('[CHAUFFEUR] ⏱️ Timer synchronized:', {
                  arrivedAt: new Date(arrivedAt).toISOString(),
                  elapsedSeconds
                });
              }
            }
          }

          if (mappedStatus === 'completed' || mappedStatus === 'payment_pending') {
            setShowPaymentConfirm(true);
            paymentFlowTriggeredRef.current = true;
          }
        } else {
          console.warn('[Chauffeur Course] Unknown status received:', data.status, data.orderStatus);
        }
      }
    });

    return () => unsubscribe();
  }, [order?.id]);

  // Écouter les statuts de paiement - DÉSACTIVÉ car le paiement TPE est confirmé localement
  // Le chauffeur confirme manuellement le paiement, pas besoin d'attendre une réponse serveur
  // useEffect(() => {
  //   if (!order) return;
  //   const unsubscribe = onPaymentStatus((data) => { ... });
  //   return () => unsubscribe();
  // }, [order?.id]);

  // Écouter les annulations
  useEffect(() => {
    if (!order) return;

    const unsubscribe = onRideCancelled((data) => {
      if (data.orderId === order.id) {
        Alert.alert('Course annulée', `La course a été annulée par ${data.cancelledBy === 'client' ? 'le client' : 'vous'}.`);
        router.replace('/(chauffeur)');
      }
    });

    return () => unsubscribe();
  }, [order?.id]);

  // Fonction pour calculer la route principale (pickup -> destination avec stops) - COPIÉE EXACTEMENT DE L'APP CLIENT
  const calculateRouteAsync = async () => {
    console.log('[Chauffeur Course] 🚀 calculateRouteAsync called', {
      hasOrder: !!order,
      hasApiKey: !!GOOGLE_MAPS_API_KEY,
      apiKeyLength: GOOGLE_MAPS_API_KEY?.length || 0,
      orderId: order?.id,
      fromConfig: !!Constants.expoConfig?.extra?.googleMapsApiKey
    });

    if (!order) {
      console.log('[Chauffeur Course] ❌ No order, aborting route calculation');
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.log('[Chauffeur Course] ❌ No Google Maps API Key, aborting route calculation');
      console.log('[Chauffeur Course] 💡 Make sure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set in .env file');
      return;
    }

    const pickup = order.addresses.find((a) => a.type === 'pickup');
    const destination = order.addresses.find((a) => a.type === 'destination');
    const stops = order.addresses.filter((a) => a.type === 'stop');

    console.log('[Chauffeur Course] 📍 Addresses found:', {
      hasPickup: !!pickup,
      hasDestination: !!destination,
      stopsCount: stops.length,
      pickupCoords: pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
      destinationCoords: destination ? { lat: destination.lat, lng: destination.lng } : null
    });

    if (!pickup || !destination || !pickup.lat || !pickup.lng || !destination.lat || !destination.lng) {
      console.log('[Chauffeur Course] ❌ Missing coordinates for route calculation');
      return;
    }

    try {
      let origin = `${pickup.lat},${pickup.lng}`;
      let destinationParam = `${destination.lat},${destination.lng}`;

      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destinationParam)}&mode=driving&key=${GOOGLE_MAPS_API_KEY}&language=fr&region=pf`;

      // Ajouter waypoints si présents
      if (stops.length > 0) {
        const waypoints = stops
          .map((stop) => {
            if (stop.lat && stop.lng) return `${stop.lat},${stop.lng}`;
            return null;
          })
          .filter((w): w is string => !!w);

        if (waypoints.length > 0) {
          url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
        }
      }

      console.log('[Chauffeur Course] 🗺️ Fetching route from Google Maps API...');
      const response = await fetch(url);
      const data = await response.json();

      console.log('[Chauffeur Course] 📍 API Response:', {
        status: data.status,
        routesCount: data.routes?.length || 0,
        hasPolyline: !!data.routes?.[0]?.overview_polyline?.points,
        polylineLength: data.routes?.[0]?.overview_polyline?.points?.length || 0
      });

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const polyline = route.overview_polyline?.points;

        if (polyline) {
          console.log('[Chauffeur Course] ✅ Polyline found, decoding...', { polylineLength: polyline.length });
          const coordinates = decodePolyline(polyline);
          console.log('[Chauffeur Course] ✅ Route decoded successfully:', { coordinatesCount: coordinates.length, firstCoord: coordinates[0], lastCoord: coordinates[coordinates.length - 1] });
          setRouteCoordinates(coordinates);
          // NE PAS centrer ici - le centrage est géré par le useEffect dédié
        } else {
          // Fallback : ligne droite
          console.log('[Chauffeur Course] ⚠️ No polyline found, using straight line fallback');
          setRouteCoordinates([
            { latitude: pickup.lat, longitude: pickup.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ]);
        }
      } else {
        // Fallback : ligne droite en cas d'erreur
        console.log('[Chauffeur Course] ❌ API error:', data.status, data.error_message);
        setRouteCoordinates([
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: destination.lat, longitude: destination.lng },
        ]);
      }
    } catch (error) {
      console.error('[Chauffeur Course] Error calculating route:', error);
      // Fallback : ligne droite
      const pickup = order.addresses.find((a) => a.type === 'pickup');
      const destination = order.addresses.find((a) => a.type === 'destination');
      if (pickup?.lat && pickup?.lng && destination?.lat && destination?.lng) {
        setRouteCoordinates([
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: destination.lat, longitude: destination.lng },
        ]);
      }
    }
  };

  // Fonction pour calculer la route du chauffeur jusqu'au point de départ
  const calculateDriverRouteAsync = async () => {
    if (!driverLocation || !order || !GOOGLE_MAPS_API_KEY) {
      return;
    }

    const pickup = order.addresses.find((a) => a.type === 'pickup');
    if (!pickup || !pickup.lat || !pickup.lng) {
      return;
    }

    try {
      const origin = `${driverLocation.latitude},${driverLocation.longitude}`;
      const destinationParam = `${pickup.lat},${pickup.lng}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destinationParam)}&mode=driving&key=${GOOGLE_MAPS_API_KEY}&language=fr&region=pf`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const polyline = route.overview_polyline?.points;

        if (polyline) {
          const coordinates = decodePolyline(polyline);
          setDriverRouteCoordinates(coordinates);

          // Calculer la durée estimée
          if (route.legs && route.legs.length > 0) {
            const duration = route.legs[0].duration?.text || null;
            setDriverEta(duration);
          }
        } else {
          // Fallback : ligne droite
          setDriverRouteCoordinates([
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
            { latitude: pickup.lat, longitude: pickup.lng },
          ]);
          setDriverEta(null);
        }
      } else {
        // Fallback : ligne droite
        setDriverRouteCoordinates([
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: pickup.lat, longitude: pickup.lng },
        ]);
        setDriverEta(null);
      }
    } catch (error) {
      console.error('[Chauffeur Course] Error calculating driver route:', error);
      // Fallback : ligne droite
      const pickup = order.addresses.find((a) => a.type === 'pickup');
      if (pickup && pickup.lat && pickup.lng) {
        setDriverRouteCoordinates([
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: pickup.lat, longitude: pickup.lng },
        ]);
        setDriverEta(null);
      }
    }
  };


  // Calculer la route principale (pickup -> destination) quand on a la commande OU quand le statut change
  useEffect(() => {
    if (order && order.addresses && order.addresses.length > 0) {
      console.log('[Chauffeur Course] Order or status changed, recalculating route...', { orderId: order.id, status: rideStatus });
      calculateRouteAsync();
    }
  }, [order?.id, order?.addresses, rideStatus]);

  // Calculer la route du chauffeur jusqu'au pickup quand en route
  useEffect(() => {
    if (rideStatus === 'enroute' && driverLocation && order) {
      calculateDriverRouteAsync();
    } else {
      setDriverRouteCoordinates([]);
      setDriverEta(null);
    }
  }, [rideStatus, driverLocation, order]);

  // Gérer le mouvement de la carte par l'utilisateur
  const handleMapPanDrag = () => {
    setUserMovedMap(true);
    
    // Annuler le timeout précédent s'il existe
    if (recenterTimeoutRef.current) {
      clearTimeout(recenterTimeoutRef.current);
    }
    
    // Réinitialiser userMovedMap après 6 secondes d'inactivité
    recenterTimeoutRef.current = setTimeout(() => {
      console.log('[Chauffeur Course] Auto-recentering after 6s');
      setUserMovedMap(false);
      if (rideStatus === 'enroute' || rideStatus === 'arrived') {
        centerOnDriver(true);
      }
    }, 6000);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (rideStatus === 'arrived' && order?.driverArrivedAt) {
      const ts = new Date(order.driverArrivedAt).getTime();
      if (isNaN(ts)) {
        setWaitingDisplaySeconds(0);
        return;
      }
      const arrivedAt = ts;
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.floor((now - arrivedAt) / 1000);
        setWaitingDisplaySeconds(diff > 0 ? diff : 0);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setWaitingDisplaySeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [rideStatus, order?.driverArrivedAt]);

  // Nettoyer le timer au démontage
  useEffect(() => {
    return () => {
      if (recenterTimeoutRef.current) {
        clearTimeout(recenterTimeoutRef.current);
      }
    };
  }, []);

  // Fonction pour centrer la carte sur le chauffeur
  const centerOnDriver = (animated = true) => {
    if (!mapRef.current || !driverLocation?.latitude || !driverLocation?.longitude) return;
    
    // En mode navigation, on suit automatiquement avec followsUserLocation
    if (navigationMode) {
      return;
    }
    
    // Offset pour que le chauffeur apparaisse dans la partie supérieure de la carte
    const latOffset = 0.0025;
    
    // Zoom différent selon le statut
    const zoom = rideStatus === 'enroute' ? 10 : 14;
    const delta = rideStatus === 'enroute' ? 0.04 : 0.015;
    
    if (typeof mapRef.current.animateToRegion === 'function') {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude - latOffset,
          longitude: driverLocation.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        animated ? 1000 : 0
      );
    } else if (typeof mapRef.current.animateCamera === 'function') {
      mapRef.current.animateCamera({
        center: {
          latitude: driverLocation.latitude - latOffset,
          longitude: driverLocation.longitude,
        },
        zoom: zoom,
      }, { duration: animated ? 1000 : 0 });
    }
  };

  // Centrer initialement sur le chauffeur
  useEffect(() => {
    if (initialCenterDone) return;
    if (!mapRef.current) return;
    
    // Attendre d'avoir la position du chauffeur
    if (driverLocation?.latitude && driverLocation?.longitude) {
      console.log('[Chauffeur Course] Initial center on driver');
      centerOnDriver(false);
      setInitialCenterDone(true);
    }
  }, [driverLocation, initialCenterDone]);

  // Recentrer UNIQUEMENT quand le statut change (pas à chaque update de position)
  useEffect(() => {
    // Ne recentrer que si le statut a VRAIMENT changé
    if (lastRideStatusRef.current === rideStatus) return;
    lastRideStatusRef.current = rideStatus;
    
    // Ne pas recentrer si l'utilisateur a bougé la carte
    if (userMovedMap) return;
    
    console.log('[Chauffeur Course] Status changed to:', rideStatus, '- recentering');
    
    if (rideStatus === 'enroute' || rideStatus === 'arrived') {
      centerOnDriver(true);
    }
  }, [rideStatus, driverLocation, userMovedMap]);

  // Centrer le trajet UNE SEULE FOIS quand on passe en mode "inprogress"
  useEffect(() => {
    // Ne centrer qu'une fois et si l'utilisateur n'a pas bougé la carte
    if (inprogressCenteredRef.current) return;
    if (userMovedMap) return;
    if (rideStatus !== 'inprogress') return;
    if (!mapRef.current || routeCoordinates.length === 0) return;

    console.log('[Chauffeur Course] Centering on route (inprogress - ONE TIME)');
    inprogressCenteredRef.current = true;
    
    const pickupCoords = order?.addresses?.find((a) => a.type === 'pickup');
    const destinationCoords = order?.addresses?.find((a) => a.type === 'destination');
    
    if (pickupCoords && destinationCoords && pickupCoords.lat && pickupCoords.lng && destinationCoords.lat && destinationCoords.lng) {
      if (typeof mapRef.current.fitToCoordinates === 'function') {
        mapRef.current.fitToCoordinates(routeCoordinates, {
          edgePadding: {
            top: 80,
            right: 40,
            bottom: 260,
            left: 40,
          },
          animated: true,
        });
      } else {
        const bounds = {
          minLat: Math.min(...routeCoordinates.map((c) => c.latitude)),
          maxLat: Math.max(...routeCoordinates.map((c) => c.latitude)),
          minLng: Math.min(...routeCoordinates.map((c) => c.longitude)),
          maxLng: Math.max(...routeCoordinates.map((c) => c.longitude)),
        };

        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;
        const latDelta = Math.max((bounds.maxLat - bounds.minLat) * 1.5, 0.01);
        const lngDelta = Math.max((bounds.maxLng - bounds.minLng) * 1.5, 0.01);
        const adjustedCenterLat = centerLat - latDelta * 0.18;

        if (typeof mapRef.current.animateToRegion === 'function') {
          mapRef.current.animateToRegion(
            {
              latitude: adjustedCenterLat,
              longitude: centerLng,
              latitudeDelta: latDelta,
              longitudeDelta: lngDelta,
            },
            1000
          );
        }
      }
    }
  }, [rideStatus, routeCoordinates, order, userMovedMap]);

  const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} XPF`;

  const handleCall = () => {
    if (order?.clientPhone) {
      // S'assurer que le numéro a le format correct (avec + si nécessaire)
      const phoneNumber = order.clientPhone.startsWith('+') 
        ? order.clientPhone 
        : `+${order.clientPhone}`;
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const handleMessage = () => {
    if (order?.id) {
      // Réinitialiser le compteur de messages non lus quand on ouvre le chat
      setUnreadMessagesCount(0);
      // Ouvrir le chat intégré
      router.push({
        pathname: '/(chauffeur)/chat',
        params: {
          orderId: order.id,
          clientName: order.clientName || 'Client',
        },
      });
    }
  };

  // Fonction pour récupérer le nombre de messages non lus du client
  const fetchUnreadMessagesCount = async () => {
    if (!order?.id || !sessionId) return;
    
    try {
      const messages = await apiFetch<any[]>(`/api/messages/order/${order.id}/driver`, {
        headers: {
          'X-Driver-Session': sessionId,
        },
      });
      // Compter les messages non lus envoyés par le client
      const unreadCount = messages?.filter(
        (msg: any) => msg.senderType === 'client' && !msg.isRead
      ).length || 0;
      setUnreadMessagesCount(unreadCount);
    } catch (error) {
      // Ne pas logger les erreurs 401 (session manquante) pour éviter le spam
      if (error instanceof ApiError && error.status === 401) {
        return; // Session non disponible, ignorer silencieusement
      }
      console.error('[Chauffeur CourseEnCours] Error fetching unread messages:', error);
    }
  };

  // Vérifier les messages non lus périodiquement
  useEffect(() => {
    if (!order?.id) return;

    // Vérifier immédiatement
    fetchUnreadMessagesCount();

    // Vérifier toutes les 10 secondes (réduire la fréquence pour moins de logs)
    const interval = setInterval(() => {
      fetchUnreadMessagesCount();
    }, 10000);

    return () => clearInterval(interval);
  }, [order?.id, sessionId]);

  // Écouter les nouveaux messages via socket
  useEffect(() => {
    if (!order?.id) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      // Si c'est un message du client et non lu, incrémenter le compteur
      if (data.senderType === 'client' && !data.isRead) {
        setUnreadMessagesCount(prev => prev + 1);
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [order?.id]);

  // Fonction robuste pour mettre à jour le statut (Socket + HTTP fallback)
  const updateStatusRobust = async (
    newStatus: 'enroute' | 'arrived' | 'inprogress' | 'completed',
    localStatus: 'enroute' | 'arrived' | 'inprogress' | 'completed' | 'payment_pending',
    waitingTimeMinutes?: number,
    driverArrivedAt?: string
  ) => {
    if (!order || !sessionId) return;
    
    setRideStatus(localStatus);
    updateRideStatus(order.id, sessionId, newStatus, waitingTimeMinutes, driverArrivedAt);
    
    try {
      const statusToBackend: Record<string, string> = {
        'arrived': 'driver_arrived',
        'inprogress': 'in_progress',
        'completed': 'completed',
      };
      const backendStatus = statusToBackend[newStatus] || newStatus;
      const body: Record<string, unknown> = { status: backendStatus, driverSessionId: sessionId };
      if (driverArrivedAt) body.driverArrivedAt = driverArrivedAt;
      await apiPatch(`/api/orders/${order.id}/status`, body);
      console.log('[Chauffeur] ✅ Status updated to', backendStatus, 'via HTTP');
    } catch (error) {
      console.log('[Chauffeur] HTTP status update failed, socket should have worked');
    }
  };

  const handleArrivedAtPickup = () => {
    try {
      if (!order?.id || !sessionId) return;
      const arrivedAtIso = new Date().toISOString();
      waitingStartAtRef.current = Date.now();
      const orderId = order.id;
      // Déferrer les mises à jour d'état pour éviter un crash synchrone
      requestAnimationFrame(() => {
        try {
          setOrder((prev) => prev ? { ...prev, driverArrivedAt: arrivedAtIso } : prev);
          setRideStatus('arrived');
          updateRideStatus(orderId, sessionId, 'arrived', undefined, arrivedAtIso);
          const body: Record<string, unknown> = {
            status: 'driver_arrived',
            driverSessionId: sessionId,
            driverArrivedAt: arrivedAtIso,
          };
          apiPatch(`/api/orders/${orderId}/status`, body).catch(() => {});
        } catch (e) {
          console.error('[CHAUFFEUR] Error in arrived handler:', e);
        }
      });
    } catch (e) {
      console.error('[CHAUFFEUR] handleArrivedAtPickup error:', e);
    }
  };

  const handleStartRide = () => {
    const waitingMinutes = order?.driverArrivedAt
      ? Math.floor((Date.now() - new Date(order.driverArrivedAt).getTime()) / 60000)
      : (waitingStartAtRef.current ? Math.floor((Date.now() - waitingStartAtRef.current) / 60000) : 0);
    
    // Envoyer le temps d'attente au serveur pour mise à jour du prix
    if (order?.id && waitingMinutes >= 0) {
      apiPost(`/api/orders/${order.id}/waiting-time`, { waitingTimeMinutes: waitingMinutes })
        .then((response: any) => {
          console.log('[Chauffeur] ✅ Waiting time updated on start ride:', response);
          if (response.totalPrice) {
            setOrder(prev => prev ? { ...prev, totalPrice: response.totalPrice, driverEarnings: response.driverEarnings } : prev);
          }
        })
        .catch(err => console.error('[Chauffeur] Error updating waiting time:', err));
    }

    updateStatusRobust('inprogress', 'inprogress', waitingMinutes);
    // Activer le mode navigation/itinéraire qui suit automatiquement le chauffeur
    setNavigationMode(true);
  };

  const handleCompleteRide = async () => {
    updateStatusRobust('completed', 'completed');
    // Récupérer l'ordre frais pour avoir le prix à jour avec les frais d'attente
    try {
      if (order?.id) {
        const freshOrder = await getOrder(order.id);
        if (freshOrder) {
          setOrder(freshOrder);
        }
      }
    } catch (error) {
      console.error('[Chauffeur] Error fetching fresh order before payment modal:', error);
    }
    setShowPaymentConfirm(true);
    paymentFlowTriggeredRef.current = true;
  };

  // ========== GESTION DE L'ARRÊT PAYANT ==========
  const PAID_STOP_RATE = 42; // 42 XPF par minute


  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ STABLE v1.0 - ARRÊT PAYANT CHAUFFEUR - NE PAS MODIFIER SANS DEMANDE
  // Cette fonction gère le démarrage d'un arrêt payant pendant la course.
  // - Timer basé sur requestAnimationFrame (plus fiable que setInterval)
  // - Calcul: 42 XPF par minute COMPLÈTE
  // - Accumulation du temps entre plusieurs arrêts via paidStopAccumulatedRef
  // - Synchronisation avec le client via Socket.IO (paid:stop:started)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleStartPaidStop = () => {
    const accumulated = paidStopAccumulatedRef.current;
    console.log('[PAID_STOP] Starting paid stop, accumulated:', accumulated, 'seconds');
    
    const now = Date.now();
    paidStopStartTimeRef.current = now;
    setShowPaidStopModal(true);
    
    // Notifier le client que l'arrêt payant a commencé
    if (order?.id && sessionId) {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('paid:stop:started', {
          orderId: order.id,
          sessionId: sessionId,
          startTime: now,
          accumulatedSeconds: accumulated,
        });
        console.log('[PAID_STOP] Notified client that paid stop started');
      }
    }
    
    // Démarrer le timer basé sur le temps réel (plus fiable que setInterval)
    const updateTimer = () => {
      const startTime = paidStopStartTimeRef.current;
      if (!startTime) return;
      
      const currentTime = Date.now();
      const elapsedMs = currentTime - startTime;
      const currentSeconds = Math.floor(elapsedMs / 1000);
      const totalSeconds = paidStopAccumulatedRef.current + currentSeconds;
      
      setPaidStopDisplaySeconds(totalSeconds);
      
      // Calculer le coût (42 XPF par minute complète)
      const minutes = Math.floor(totalSeconds / 60);
      setPaidStopTotalCost(minutes * PAID_STOP_RATE);
      
      // Continuer l'animation
      paidStopAnimationRef.current = requestAnimationFrame(updateTimer);
    };
    
    // Afficher immédiatement le temps accumulé
    setPaidStopDisplaySeconds(accumulated);
    setPaidStopTotalCost(Math.floor(accumulated / 60) * PAID_STOP_RATE);
    
    // Démarrer le timer
    paidStopAnimationRef.current = requestAnimationFrame(updateTimer);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚠️ STABLE v1.0 - REPRISE DE COURSE (FIN ARRÊT PAYANT) - NE PAS MODIFIER
  // Cette fonction gère la fin d'un arrêt payant.
  // - LOGIQUE CRITIQUE: Calcul basé sur le TEMPS TOTAL ACCUMULÉ
  // - previousMinutesBilled vs totalMinutesBilled pour éviter double facturation
  // - Envoie paid:stop:ended au client avec totalCost
  // - Persiste le coût via API /api/orders/:id/paid-stop
  // ═══════════════════════════════════════════════════════════════════════════
  const handleResumeCourse = async () => {
    console.log('[PAID_STOP] Resuming course');
    
    // Arrêter le timer
    if (paidStopAnimationRef.current) {
      cancelAnimationFrame(paidStopAnimationRef.current);
      paidStopAnimationRef.current = null;
    }
    
    // Calculer le temps écoulé pour cet arrêt
    let thisStopSeconds = 0;
    const startTime = paidStopStartTimeRef.current;
    if (startTime) {
      thisStopSeconds = Math.floor((Date.now() - startTime) / 1000);
    }
    
    // Minutes déjà facturées AVANT cet arrêt
    const previousMinutesBilled = Math.floor(paidStopAccumulatedRef.current / 60);
    const previousCostBilled = previousMinutesBilled * PAID_STOP_RATE;
    
    // Mettre à jour le temps accumulé total (dans la ref)
    const newAccumulated = paidStopAccumulatedRef.current + thisStopSeconds;
    paidStopAccumulatedRef.current = newAccumulated;
    
    // Mettre à jour l'affichage
    setPaidStopDisplaySeconds(newAccumulated);
    
    // Minutes totales APRÈS cet arrêt
    const totalMinutesBilled = Math.floor(newAccumulated / 60);
    const totalCostBilled = totalMinutesBilled * PAID_STOP_RATE;
    
    // Coût NOUVELLES minutes à facturer = total - déjà facturé
    const newMinutesToBill = totalMinutesBilled - previousMinutesBilled;
    const thisStopCost = newMinutesToBill * PAID_STOP_RATE;
    
    console.log('[PAID_STOP] This stop:', thisStopSeconds, 'seconds');
    console.log('[PAID_STOP] Previous billed:', previousMinutesBilled, 'min =', previousCostBilled, 'XPF');
    console.log('[PAID_STOP] Total now:', totalMinutesBilled, 'min =', totalCostBilled, 'XPF');
    console.log('[PAID_STOP] NEW minutes to bill:', newMinutesToBill, 'min =', thisStopCost, 'XPF');
    console.log('[PAID_STOP] Total accumulated:', newAccumulated, 'seconds');
    
    // TOUJOURS notifier le client que l'arrêt est terminé (même si coût = 0)
    if (order?.id && sessionId) {
      try {
        // Émettre via Socket.IO pour notifier le client en temps réel
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('paid:stop:ended', {
            orderId: order.id,
            sessionId: sessionId,
            cost: thisStopCost,
            durationMinutes: newMinutesToBill,
            newAccumulatedSeconds: newAccumulated,
            // Envoyer aussi le coût total pour que le client puisse vérifier
            totalCost: totalCostBilled,
          });
          console.log('[PAID_STOP] Sent paid stop ended to client via Socket.IO');
        }
        
        // Appeler l'API pour persister le coût seulement si > 0
        if (thisStopCost > 0) {
          await apiPost(`/api/orders/${order.id}/paid-stop`, {
            cost: thisStopCost,
            durationMinutes: newMinutesToBill,
            sessionId: sessionId,
          });
          // Garder trace du coût total persisté
          paidStopsPersistedCostRef.current += thisStopCost;
          console.log('[PAID_STOP] Paid stop cost persisted to server, total persisted:', paidStopsPersistedCostRef.current);
        }
      } catch (error) {
        console.error('[PAID_STOP] Error sending paid stop ended:', error);
        // Continuer même si l'envoi échoue - mais ne pas compter comme persisté
      }
    }
    
    // Fermer le modal (mais garder le temps accumulé pour le prochain arrêt)
    setShowPaidStopModal(false);
    paidStopStartTimeRef.current = null;
    // NE PAS réinitialiser paidStopAccumulatedRef ni paidStopDisplaySeconds
  };

  // Nettoyer le timer et notifier le client si le composant est démonté pendant un arrêt
  useEffect(() => {
    return () => {
      if (paidStopAnimationRef.current) {
        cancelAnimationFrame(paidStopAnimationRef.current);
      }
      
      // Si un arrêt était en cours, notifier le client qu'il est terminé
      // Cela évite que le client reste bloqué avec le popup ouvert
      if (paidStopStartTimeRef.current && order?.id && sessionId) {
        const thisStopSeconds = Math.floor((Date.now() - paidStopStartTimeRef.current) / 1000);
        const newAccumulated = paidStopAccumulatedRef.current + thisStopSeconds;
        const thisStopMinutes = Math.floor(thisStopSeconds / 60);
        const thisStopCost = thisStopMinutes * 42; // PAID_STOP_RATE
        
        console.log('[PAID_STOP] Component unmounting during active stop, notifying client');
        
        const socket = getSocket();
        if (socket.connected) {
          socket.emit('paid:stop:ended', {
            orderId: order.id,
            sessionId: sessionId,
            cost: thisStopCost,
            durationMinutes: thisStopMinutes,
            newAccumulatedSeconds: newAccumulated,
          });
        }
      }
    };
  }, [order?.id, sessionId]);
  
  // Au chargement, vérifier s'il y a un arrêt payant actif sur le serveur
  useEffect(() => {
    if (!order?.id) return;
    
    const checkActivePaidStop = async () => {
      try {
        const response = await apiFetch<{ active: boolean; startTime?: number; accumulatedSeconds?: number }>(
          `/api/orders/${order.id}/paid-stop/status`
        );
        
        if (response.active && response.startTime !== undefined && response.accumulatedSeconds !== undefined) {
          console.log('[PAID_STOP] Found active paid stop on load, resuming:', response);
          
          // Restaurer l'état
          paidStopAccumulatedRef.current = response.accumulatedSeconds;
          paidStopStartTimeRef.current = response.startTime;
          setShowPaidStopModal(true);
          
          // Démarrer le timer
          const updateTimer = () => {
            const startTime = paidStopStartTimeRef.current;
            if (!startTime) return;
            
            const currentTime = Date.now();
            const elapsedMs = currentTime - startTime;
            const currentSeconds = Math.floor(elapsedMs / 1000);
            const totalSeconds = paidStopAccumulatedRef.current + currentSeconds;
            
            setPaidStopDisplaySeconds(totalSeconds);
            setPaidStopTotalCost(Math.floor(totalSeconds / 60) * 42);
            
            paidStopAnimationRef.current = requestAnimationFrame(updateTimer);
          };
          
          paidStopAnimationRef.current = requestAnimationFrame(updateTimer);
        }
      } catch (error) {
        console.log('[PAID_STOP] No active paid stop or error checking:', error);
      }
    };
    
    checkActivePaidStop();
  }, [order?.id]);

  // Debug: Log de l'état de la map au render (uniquement en dev)
  // IMPORTANT: Toujours appeler useEffect, mais mettre la condition à l'intérieur
  // pour respecter les règles des hooks React
  useEffect(() => {
    if (__DEV__) {
      console.log('[CHAUFFEUR COURSE] Render - Map state:', {
        isMapsAvailable,
        hasMapView: !!MapView,
        hasDriverLocation: !!driverLocation,
        hasOrder: !!order,
        Platform: Platform.OS,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, order]);

  // Formater le temps d'arrêt
  const formatPaidStopTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // NOTE: Le timer d'attente est géré par le useEffect plus haut (ligne ~785)
  // qui utilise order?.driverArrivedAt pour synchroniser avec le serveur
  // NE PAS DUPLIQUER ce timer ici pour éviter les conflits

  const handleConfirmPayment = async (confirmed: boolean, paymentType: 'card' | 'cash' = 'card') => {
    if (!order || !sessionId) return;
    
    // Récupérer la commande fraîche pour avoir les données à jour (notamment waitingTimeMinutes)
    try {
      const freshOrder = await getOrder(order.id);
      console.log('[Chauffeur Payment] Fresh order data:', {
        id: freshOrder.id,
        totalPrice: freshOrder.totalPrice,
        waitingTimeMinutes: freshOrder.waitingTimeMinutes,
      });
      
      // Calculer le prix correct localement (prix de base + attente + arrêts payants)
      // Car le backend peut avoir un bug qui écrase le totalPrice au lieu de l'ajouter
      const basePrice = basePriceRef.current ?? order.totalPrice;
      const waitingMinutes = freshOrder.waitingTimeMinutes || 0;
      const waitingFee = Math.max(0, waitingMinutes - 5) * 42;
      const paidStopsCost = paidStopsPersistedCostRef.current;
      const correctTotalPrice = basePrice + waitingFee + paidStopsCost;
      
      console.log('[Chauffeur Payment] Price calculation:', {
        basePrice,
        waitingMinutes,
        waitingFee,
        paidStopsCost,
        correctTotalPrice,
        serverTotalPrice: freshOrder?.totalPrice,
      });
      
      if (freshOrder) {
        setOrder(freshOrder);
        
        // Pour le TPE, on confirme directement sans attendre le serveur
        // Le serveur est notifié mais on ne bloque pas l'UI
        setShowPaymentConfirm(false);
        setPaymentResult({
          status: 'success',
          // Utiliser le prix calculé localement (plus fiable)
          amount: correctTotalPrice,
          paymentMethod: paymentType,
          waitingTimeMinutes: freshOrder.waitingTimeMinutes,
          paidStopsCost: paidStopsCost,
          supplements: freshOrder.supplements || [],
        });
        console.log('[Chauffeur Payment] PaymentResult created with waitingTimeMinutes:', freshOrder.waitingTimeMinutes, 'amount:', correctTotalPrice, 'supplements:', freshOrder.supplements);
        setShowPaymentResult(true);
      } else {
        // Fallback si la récupération échoue
        const basePrice = basePriceRef.current ?? order.totalPrice;
        const waitingMinutes = order.waitingTimeMinutes || 0;
        const waitingFee = Math.max(0, waitingMinutes - 5) * 42;
        const paidStopsCost = paidStopsPersistedCostRef.current;
        const correctTotalPrice = basePrice + waitingFee + paidStopsCost;

        setShowPaymentConfirm(false);
        setPaymentResult({
          status: 'success',
          amount: correctTotalPrice,
          paymentMethod: paymentType,
          waitingTimeMinutes: waitingMinutes,
          paidStopsCost: paidStopsCost,
          supplements: order.supplements || [],
        });
        setShowPaymentResult(true);
      }
    } catch (error) {
      console.error('Error fetching fresh order:', error);
      // Fallback si la récupération échoue
      const basePrice = basePriceRef.current ?? order.totalPrice;
      const waitingMinutes = order.waitingTimeMinutes || 0;
      const waitingFee = Math.max(0, waitingMinutes - 5) * 42;
      const paidStopsCost = paidStopsPersistedCostRef.current;
      const correctTotalPrice = basePrice + waitingFee + paidStopsCost;
      
      setShowPaymentConfirm(false);
      setPaymentResult({
        status: 'success',
        amount: correctTotalPrice,
        paymentMethod: paymentType,
        waitingTimeMinutes: waitingMinutes,
        paidStopsCost: paidStopsCost,
        supplements: order.supplements || [],
      });
      setShowPaymentResult(true);
    }
    
    // Notifier le serveur en arrière-plan (non bloquant) - envoyer le type de paiement choisi
    confirmPayment(order.id, confirmed, 'driver', { sessionId }, paymentType);
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Annuler la course',
      'Êtes-vous sûr de vouloir annuler cette course ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: () => {
            if (order && sessionId) {
              cancelRide(order.id, 'driver', 'Chauffeur a annulé', { sessionId });
              router.replace('/(chauffeur)');
            }
          },
        },
      ]
    );
  };

  const handleFinishRide = () => {
    // Fermer tous les modals
    setShowPaymentConfirm(false);
    setShowPaymentResult(false);
    setShowThankYou(false);
    setShowRatingModal(false);
    setPaymentResult(null);
    setIsPaymentProcessing(false);
    paymentFlowTriggeredRef.current = false;
    
    // Nettoyer les données
    if (locationWatchId.current) {
      locationWatchId.current.remove();
      locationWatchId.current = null;
    }
    
    // Naviguer vers l'accueil
    router.replace('/(chauffeur)');
  };

  useEffect(() => {
    if (rideStatus !== 'completed' && rideStatus !== 'payment_pending') return;
    if (paymentFlowTriggeredRef.current) {
      // Assurer que le popup reste disponible si la fin arrive très vite
      if (!showPaymentConfirm && !showPaymentResult && !showRatingModal) {
        setShowPaymentConfirm(true);
      }
      return;
    }
    setShowPaymentConfirm(true);
    paymentFlowTriggeredRef.current = true;
  }, [rideStatus, showPaymentConfirm, showPaymentResult, showRatingModal]);

  // Afficher le modal de notation après le paiement
  const handleShowRating = () => {
    setShowPaymentResult(false);
    setShowRatingModal(true);
  };

  // Soumettre la note du client
  const handleSubmitRating = async (score: number, comment?: string) => {
    if (!order || !sessionId) {
      console.log('[Rating] Missing order or sessionId:', { hasOrder: !!order, hasSession: !!sessionId });
      return;
    }
    try {
      const API_URL = Constants.expoConfig?.extra?.apiUrl || '';
      // Éviter la duplication de /api si l'URL se termine déjà par /api
      const endpoint = `/api/orders/${order.id}/rate-client`;
      const url = API_URL.endsWith('/api') 
        ? `${API_URL}${endpoint.replace(/^\/api/, '')}` 
        : `${API_URL}${endpoint}`;
      console.log('[Rating] Submitting rating to:', url, { score, comment, sessionId: sessionId.substring(0, 8) + '...' });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, score, comment }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Rating] Error response:', data);
      } else {
        console.log('[Rating] ✅ Successfully submitted rating:', data);
      }
    } catch (error) {
      console.error('[Rating] Error submitting rating:', error);
    }
  };

  // Accepter une nouvelle commande pendant la course
  const handleAcceptIncomingOrder = async (orderId: string) => {
    if (!sessionId) return;
    
    console.log('[InRide] Accepting order:', orderId);
    
    try {
      // Accepter via socket
      acceptOrder(orderId, sessionId);
      
      // Retirer de la liste des notifications
      setIncomingOrders(prev => prev.filter(o => o.id !== orderId));
      
      // Afficher une confirmation
      Alert.alert(
        'Course acceptée',
        'La course a été ajoutée à votre file d\'attente. Vous pourrez la commencer depuis "Commandes" une fois cette course terminée.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[InRide] Error accepting order:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter la course. Veuillez réessayer.');
    }
  };

  // Refuser une nouvelle commande pendant la course
  const handleDeclineIncomingOrder = (orderId: string) => {
    if (!sessionId) return;
    
    console.log('[InRide] Declining order:', orderId);
    
    // Marquer comme refusée pour ce chauffeur
    declinedOrdersRef.current.add(orderId);
    
    // Informer le serveur (optionnel - la commande reste disponible pour les autres)
    declineOrder(orderId, sessionId);
    
    // Retirer de la liste des notifications
    setIncomingOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const getStatusText = () => {
    switch (rideStatus) {
      case 'enroute':
        return 'En route vers le client';
      case 'arrived':
        return 'Vous êtes arrivé';
      case 'inprogress':
        return 'Course en cours';
      case 'completed':
      case 'payment_pending':
        return 'Course terminée - Paiement en attente';
      default:
        // Fallback: retourner le dernier statut connu ou un message générique
        console.log('[Chauffeur Course] getStatusText fallback for:', rideStatus);
        return 'Course en cours...';
    }
  };

  const getStatusColor = () => {
    switch (rideStatus) {
      case 'enroute':
        return '#3B82F6';
      case 'arrived':
        return '#22C55E';
      case 'inprogress':
        return '#F5C400';
      case 'completed':
      case 'payment_pending':
        return '#22C55E';
      default:
        return '#6b7280';
    }
  };

  if (isLoadingOrder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C400" />
          <Text style={styles.loadingText}>Chargement de la course...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (orderNotFound || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Ionicons name="car-outline" size={64} color="#9CA3AF" />
          <Text style={styles.loadingText}>Aucune course active trouvée.</Text>
          <Button title="Retour à l'accueil" onPress={() => router.replace('/(chauffeur)')} />
        </View>
      </SafeAreaView>
    );
  }

  const pickupCoords = order.addresses.find((a) => a.type === 'pickup');
  const destinationCoords = order.addresses.find((a) => a.type === 'destination');
  const stopAddresses = order.addresses.filter((a) => a.type === 'stop');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Notifications de nouvelles courses pendant la course */}
      {incomingOrders.length > 0 && (
        <InRideOrderNotification
          orders={incomingOrders}
          onAccept={handleAcceptIncomingOrder}
          onDecline={handleDeclineIncomingOrder}
          maxImmediateOrders={2}
          currentActiveOrders={1} // La course actuelle compte comme 1
        />
      )}
      
      {/* Timer d'attente synchronisé en haut */}
      {rideStatus === 'arrived' && (
        <View style={styles.topTimerContainer}>
          <View style={styles.topTimerBubble}>
            <Text style={styles.topTimerLabel}>TEMPS D'ATTENTE</Text>
            <View style={styles.topTimerRow}>
              <Text style={[styles.topTimerValue, waitingDisplaySeconds >= 300 ? { color: '#F5C400' } : {}]}>
                {formatTimer(waitingDisplaySeconds)}
              </Text>
              {waitingDisplaySeconds >= 300 && (
                <Text style={styles.topTimerPrice}>
                  +{getWaitingPrice(waitingDisplaySeconds)} XPF
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
      <View style={styles.mapContainer}>
        {isMapsAvailable && MapView ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: driverLocation?.latitude || pickupCoords?.lat || -17.5399,
              longitude: driverLocation?.longitude || pickupCoords?.lng || -149.5686,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={navigationMode}
            showsMyLocationButton={false}
            showsCompass={false}
            followsUserLocation={navigationMode && rideStatus === 'inprogress' && !userMovedMap}
            userLocationPriority="high"
            userLocationUpdateInterval={1000}
            provider={Platform.OS === 'android' ? 'google' : undefined}
            onPanDrag={handleMapPanDrag}
            onTouchStart={handleMapPanDrag}
            onRegionChangeComplete={handleMapPanDrag}
          >
            {/* Tracé du trajet - Ligne jaune avec ligne noire au centre */}
            {routeCoordinates.length > 0 ? (
              <>
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="rgba(245, 196, 0, 0.75)"
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={true}
                />
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#1A1A1A"
                  strokeWidth={1}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={true}
                />
              </>
            ) : (
              // Fallback : ligne droite si pas de route calculée mais qu'on a les coordonnées
              pickupCoords && destinationCoords && pickupCoords.lat && pickupCoords.lng && destinationCoords.lat && destinationCoords.lng && (
                <>
                  <Polyline
                    coordinates={[
                      { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                      { latitude: destinationCoords.lat, longitude: destinationCoords.lng },
                    ]}
                    strokeColor="rgba(245, 196, 0, 0.75)"
                    strokeWidth={6}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={true}
                  />
                  <Polyline
                    coordinates={[
                      { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                      { latitude: destinationCoords.lat, longitude: destinationCoords.lng },
                    ]}
                    strokeColor="#1A1A1A"
                    strokeWidth={1}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={true}
                  />
                </>
              )
            )}

            {/* Tracé en pointillés du chauffeur jusqu'au point de départ - UNIQUEMENT si le chauffeur est en route */}
            {rideStatus === 'enroute' && driverLocation && driverRouteCoordinates.length > 0 && (
              <>
                <Polyline
                  coordinates={driverRouteCoordinates}
                  strokeColor="#000000"
                  strokeWidth={2}
                  lineDashPattern={[8, 4]}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={true}
                  tracksViewChanges={false}
                />
                {/* Timer d'arrivée au milieu du tracé */}
                {driverEta && driverRouteCoordinates.length > 0 && (
                  <Marker
                    coordinate={driverRouteCoordinates[Math.floor(driverRouteCoordinates.length / 2)]}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                  >
                    <View style={styles.etaContainer}>
                      <Text style={styles.etaText}>{driverEta}</Text>
                    </View>
                  </Marker>
                )}
              </>
            )}
            {/* Fallback: ligne droite si pas de route calculée mais qu'on a les coordonnées - UNIQUEMENT si en route */}
            {rideStatus === 'enroute' && driverLocation && driverRouteCoordinates.length === 0 && pickupCoords && pickupCoords.lat && pickupCoords.lng && (
              <Polyline
                coordinates={[
                  { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                  { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
                ]}
                strokeColor="#000000"
                strokeWidth={2}
                lineDashPattern={[8, 4]}
                lineCap="round"
                lineJoin="round"
                geodesic={true}
                tracksViewChanges={false}
              />
            )}

            {/* Chauffeur - Caché quand la course est en cours (inprogress) */}
            {(() => {
              if (!driverLocation || !driverLocation.latitude || !driverLocation.longitude || rideStatus === 'inprogress') {
                return null;
              }
              
              // Calculer la rotation : l'icône pointe vers le haut (Nord = 0°) dans le fichier image
              // Le heading est calculé où 0° = Nord
              // Si l'icône est perpendiculaire au trajet, il faut ajouter 90° pour l'aligner
              const rotation = (driverLocation.heading || 0) + 90;
              
              return (
                <Marker
                  coordinate={{ 
                    latitude: driverLocation.latitude, 
                    longitude: driverLocation.longitude 
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  zIndex={999}
                  tappable={false}
                  flat={true}
                  title={undefined}
                  description={undefined}
                >
                  <DriverCarIcon 
                    size={48} 
                    rotation={rotation} 
                  />
                </Marker>
              );
            })()}

            {/* Position du client en temps réel */}
            {clientLocation && (
              <Marker coordinate={clientLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={1}>
                <View style={styles.clientMarker}>
                  <View style={styles.clientMarkerInner} />
                </View>
              </Marker>
            )}

            {/* Marqueur de départ - Iconeacpp(1).gif via expo-image (meilleur support GIF) */}
            {pickupCoords && pickupCoords.lat !== undefined && pickupCoords.lat !== null && pickupCoords.lng !== undefined && pickupCoords.lng !== null && (
              <Marker
                coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={1}
              >
                <View style={styles.markerContainer}>
                  <ExpoImage
                    source={DEPART_ICON}
                    style={styles.markerIconDepart}
                    contentFit="contain"
                  />
                  <View style={styles.markerLabelBlackDepart}>
                    <Text style={styles.markerLabelTextWhite}>Départ</Text>
                  </View>
                </View>
              </Marker>
            )}

            {/* Marqueurs d'arrêts */}
            {stopAddresses.map((stop, index) =>
              (stop.lat !== undefined && stop.lng !== undefined) ? (
                <Marker
                  key={stop.id || `stop-${index}`}
                  coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
                  anchor={{ x: 0.5, y: 1 }}
                  zIndex={2}
                >
                  <View style={styles.markerContainer}>
                    <Image
                      source={require('@/assets/images/stopppp.gif')}
                      style={styles.markerIconStop}
                    />
                  </View>
                </Marker>
              ) : null
            )}

            {/* Marqueur d'arrivée */}
            {destinationCoords && destinationCoords.lat !== undefined && destinationCoords.lat !== null && destinationCoords.lng !== undefined && destinationCoords.lng !== null && (
              <Marker
                coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={1}
              >
                <View style={styles.markerContainer}>
                  <Image
                    source={require('@/assets/images/Icone_acpp_(5)_1764132915723_1767064460978.png')}
                    style={styles.markerIcon}
                  />
                  <View style={styles.markerLabelBlack}>
                    <Text style={styles.markerLabelTextWhite}>Arrivée</Text>
                  </View>
                </View>
              </Marker>
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={64} color="#a3ccff" />
            <Text style={styles.mapPlaceholderText}>
              {Platform.OS === 'web'
                ? 'Carte disponible sur mobile uniquement'
                : `Carte non disponible`}
            </Text>
          </View>
        )}
      </View>

      {/* Bulle "Arrêt payant" avec effet néon - seulement visible quand la course est en cours */}
      {rideStatus === 'inprogress' && !showPaidStopModal && (
        <TouchableOpacity 
          style={styles.paidStopBubbleContainer}
          onPress={handleStartPaidStop}
          activeOpacity={0.8}
        >
          <View style={styles.paidStopBubble}>
            <View style={styles.paidStopBubbleGlow} />
            <Ionicons name="pause-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.paidStopBubbleText}>Arrêt payant</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(), marginBottom: 12, borderRadius: 12 }]}>
          <Ionicons
            name={rideStatus === 'arrived' ? 'checkmark-circle' : 'car'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={[styles.statusText, { fontSize: 14 }]}>{getStatusText()}</Text>
          <TouchableOpacity 
            style={styles.infoBubble}
            onPress={() => setShowAddressesModal(true)}
          >
            <Ionicons name="information-circle" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Card style={{ ...styles.clientCard, padding: 12 }}>
          <View style={styles.clientHeader}>
            <View style={[styles.clientAvatar, { width: 64, height: 64, borderRadius: 32, overflow: 'hidden' }]}>
              {(order.client?.photoUrl || order.clientPhotoUrl) ? (
                <Image 
                  source={{ uri: order.client?.photoUrl || order.clientPhotoUrl || '' }} 
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              ) : (
                <Ionicons name="person" size={36} color="#F5C400" />
              )}
            </View>
            <View style={[styles.clientInfo, { marginLeft: 16 }]}>
              <Text variant="h2" style={{ fontSize: 20 }}>{order.clientName}</Text>
              <Text variant="body" style={{ color: '#6b7280', marginTop: 2 }}>{order.clientPhone}</Text>
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity style={[styles.contactButton, { width: 48, height: 48, borderRadius: 24 }]} onPress={handleCall}>
                <Ionicons name="call" size={22} color="#22C55E" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactButton, { width: 48, height: 48, borderRadius: 24 }]} onPress={handleMessage}>
                <View style={styles.messageButtonContainer}>
                  <Ionicons name="chatbubble" size={22} color="#3B82F6" />
                  {unreadMessagesCount > 0 && (
                    <View style={styles.messageBadge}>
                      <Text style={styles.messageBadgeText}>
                        {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <View style={styles.footer}>
          {rideStatus === 'enroute' && (
            <View style={styles.footerRow}>
              <Button title="Arrivé au client" onPress={handleArrivedAtPickup} style={{ flex: 2 }} />
              <Button
                title="Annuler"
                variant="outline"
                onPress={handleCancelRide}
                style={{ ...styles.cancelButton, flex: 1, marginTop: 0 }}
              />
            </View>
          )}
          {rideStatus === 'arrived' && (
            <View style={styles.footerRow}>
              <Button title="Démarrer la course" onPress={handleStartRide} style={{ flex: 2 }} />
              <Button
                title="Annuler"
                variant="outline"
                onPress={handleCancelRide}
                style={{ ...styles.cancelButton, flex: 1, marginTop: 0 }}
              />
            </View>
          )}
          {rideStatus === 'inprogress' && (
            <View style={styles.footerRow}>
              <Button title="Terminer la course" onPress={handleCompleteRide} style={{ flex: 2 }} />
              <Button
                title="Annuler"
                variant="outline"
                onPress={handleCancelRide}
                style={{ ...styles.cancelButton, flex: 1, marginTop: 0 }}
              />
            </View>
          )}
          {(rideStatus === 'completed' || rideStatus === 'payment_pending') && (
            <View style={styles.paymentActions}>
              <Button
                title="Confirmer paiement"
                onPress={() => handleConfirmPayment(true)}
                fullWidth
                disabled={isPaymentProcessing}
              />
              {isPaymentProcessing && (
                <ActivityIndicator size="small" color="#F5C400" style={styles.processingIndicator} />
              )}
            </View>
          )}
        </View>
      </View>

      {/* Modal de confirmation de paiement */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPaymentConfirm}
        onRequestClose={() => setShowPaymentConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentIconCircle}>
              <Ionicons name="card-outline" size={40} color="#F5C400" />
            </View>
            <Text style={styles.paymentModalTitle}>Confirmer le paiement</Text>
            <Text style={styles.paymentModalSubtitle}>
              {order.paymentMethod === 'cash' 
                ? 'Le client a choisi de payer en espèces'
                : 'Comment le client a-t-il payé ?'}
            </Text>
            
            {/* Prix stylé avec détail des frais d'attente et arrêts */}
            <View style={styles.priceContainer}>
              <Text style={styles.priceCurrency}>Montant à encaisser</Text>
              <Text style={styles.priceValue}>
                {(order.totalPrice || 0).toLocaleString('fr-FR')} XPF
              </Text>
              
              <View style={styles.waitingFeeDetail}>
                {order.waitingTimeMinutes && order.waitingTimeMinutes > 5 && (
                  <Text style={styles.waitingTimeInfo}>
                    Dont attente: {order.waitingTimeMinutes - 5} min × {waitingRate} XPF = {((order.waitingTimeMinutes - 5) * waitingRate).toLocaleString('fr-FR')} XPF
                  </Text>
                )}
                {((order.rideOption as any)?.paidStopsCost || 0) > 0 && (
                  <Text style={[styles.waitingTimeInfo, { color: '#EF4444', marginTop: 4 }]}>
                    Dont arrêts payants: {(order.rideOption as any).paidStopsCost.toLocaleString('fr-FR')} XPF
                  </Text>
                )}
              </View>
            </View>
            
            {/* Boutons de confirmation - adaptés selon le mode de paiement choisi par le client */}
            <View style={styles.paymentConfirmButtons}>
              {order.paymentMethod === 'cash' ? (
                <>
                  {/* Si le client a choisi espèces, proposer espèces en premier */}
                  <TouchableOpacity
                    style={styles.confirmPaymentButton}
                    onPress={() => handleConfirmPayment(true, 'cash')}
                    disabled={isPaymentProcessing}
                  >
                    <Ionicons name="cash" size={24} color="#FFFFFF" />
                    <Text style={styles.confirmPaymentButtonText}>Payer en espèces</Text>
                  </TouchableOpacity>
                  
                  {/* Option alternative : payer en carte */}
                  <TouchableOpacity
                    style={styles.cashPaymentButton}
                    onPress={() => handleConfirmPayment(true, 'card')}
                    disabled={isPaymentProcessing}
                  >
                    <Ionicons name="card" size={24} color="#FFFFFF" />
                    <Text style={styles.confirmPaymentButtonText}>Payer en carte</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Si le client a choisi carte, proposer carte en premier */}
                  <TouchableOpacity
                    style={styles.confirmPaymentButton}
                    onPress={() => handleConfirmPayment(true, 'card')}
                    disabled={isPaymentProcessing}
                  >
                    <Ionicons name="card" size={24} color="#FFFFFF" />
                    <Text style={styles.confirmPaymentButtonText}>Paiement par carte</Text>
                  </TouchableOpacity>
                  
                  {/* Paiement en espèces (erreur de carte) */}
                  <TouchableOpacity
                    style={styles.cashPaymentButton}
                    onPress={() => handleConfirmPayment(true, 'cash')}
                    disabled={isPaymentProcessing}
                  >
                    <Ionicons name="cash" size={24} color="#FFFFFF" />
                    <View style={styles.cashButtonTextContainer}>
                      <Text style={styles.confirmPaymentButtonText}>Paiement en espèces</Text>
                      <Text style={styles.cashSubtext}>dû à erreur de carte</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity
                style={styles.cancelPaymentButton}
                onPress={() => setShowPaymentConfirm(false)}
              >
                <Text style={styles.cancelPaymentButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal détails de tarification - Copié de l'app client */}
      <Modal
        visible={showPriceDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPriceDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.priceDetailsModalContent}>
            <View style={styles.priceDetailsModalHeader}>
              <Text variant="h2" style={styles.priceDetailsModalTitle}>
                Détails de la tarification
              </Text>
              <TouchableOpacity
                onPress={() => setShowPriceDetailsModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.priceDetailsContent}>
              {(() => {
                if (!order) return null;
                
                // Tour de l'île: prix fixe simple
                const isTourType = order.rideOption?.id === 'tour';
                const TOUR_FIXED_PRICE = 30000;
                
                if (isTourType) {
                  return (
                    <>
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="compass" size={16} color="#22C55E" />
                          </View>
                          <Text style={styles.priceDetailLabel}>Tour de l'île (forfait)</Text>
                        </View>
                        <Text style={styles.priceDetailValue}>{formatPrice(TOUR_FIXED_PRICE)}</Text>
                      </View>
                      
                      <View style={styles.priceDetailSeparator} />
                      
                      <View style={[styles.priceDetailRow, { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8 }]}>
                        <Text style={[styles.priceDetailLabel, { fontWeight: '700', color: '#22C55E' }]}>Total</Text>
                        <Text style={[styles.priceDetailValue, { fontWeight: '700', color: '#22C55E', fontSize: 18 }]}>{formatPrice(TOUR_FIXED_PRICE)}</Text>
                      </View>
                    </>
                  );
                }
                
                // Utiliser les tarifs dynamiques depuis le back-office
                const priseEnCharge = tarifs?.priseEnCharge ?? 1000;
                const tarifJour = tarifs?.tarifJourKm ?? 130;
                const tarifNuit = tarifs?.tarifNuitKm ?? 260;
                const heureDebutJour = tarifs?.heureDebutJour ?? 6;
                const heureFinJour = tarifs?.heureFinJour ?? 20;
                
                // Déterminer si c'est tarif jour ou nuit selon la date de la commande
                // Pour les réservations à l'avance, utiliser scheduledTime, sinon createdAt
                let orderDate: Date;
                if (order.isAdvanceBooking && order.scheduledTime) {
                  orderDate = new Date(order.scheduledTime);
                  console.log('[Chauffeur Course] Modal - Réservation à l\'avance, date utilisée:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                } else if (order.createdAt) {
                  orderDate = new Date(order.createdAt);
                  console.log('[Chauffeur Course] Modal - Course immédiate, date utilisée:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                } else {
                  orderDate = new Date();
                  console.log('[Chauffeur Course] Modal - Aucune date disponible, utilisation date actuelle:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                }
                const isNight = isNightRate(orderDate, tarifs ?? undefined);
                const kmPrice = isNight ? tarifNuit : tarifJour;
                console.log('[Chauffeur Course] Modal - Calcul tarif:', {
                  orderDate: orderDate.toISOString(),
                  hour: orderDate.getHours(),
                  isNight,
                  kmPrice,
                  tarifJour,
                  tarifNuit,
                  hasTarifs: !!tarifs,
                });
                
                // Distance
                let distanceKm = 0;
                if (order.routeInfo?.distance) {
                  distanceKm = parseFloat(String(order.routeInfo.distance));
                }
                const distancePrice = distanceKm > 0 ? Math.round(distanceKm * kmPrice) : 0;
                
                // Suppléments
                const orderSupplements = order.supplements || [];
                const supplementsTotal = orderSupplements.reduce((sum: number, supp: any) => {
                  return sum + (supp.prixXpf || supp.price || 0) * (supp.quantity || 1);
                }, 0);
                
                // Majoration passagers (500 XPF si >= 5 passagers)
                const passengers = order.passengers || 1;
                const majorationPassagers = passengers >= 5 ? 500 : 0;
                
                // Frais d'attente (5 min gratuites, puis 42 XPF/min)
                const waitingMinutes = order.waitingTimeMinutes || 0;
                const waitingFee = waitingMinutes > 5 ? (waitingMinutes - 5) * waitingRate : 0;
                
                // Arrêts payants (temps accumulé pendant la course)
                const paidStopsMinutes = Math.floor(paidStopAccumulatedRef.current / 60);
                const paidStopsFee = paidStopsPersistedCostRef.current;
                
                return (
                  <>
                    {/* Prise en charge */}
                    <View style={styles.priceDetailRow}>
                      <View style={styles.priceDetailRowLeft}>
                        <View style={styles.priceDetailIconContainer}>
                          <Ionicons name="car" size={16} color="#22C55E" />
                        </View>
                        <Text style={styles.priceDetailLabel}>Prise en charge</Text>
                      </View>
                      <Text style={styles.priceDetailValue}>{formatPrice(priseEnCharge)}</Text>
                    </View>
                    
                    {/* Distance */}
                    <View style={styles.priceDetailRow}>
                      <View style={styles.priceDetailRowLeft}>
                        <View style={styles.priceDetailIconContainer}>
                          <Ionicons name="map" size={16} color="#22C55E" />
                        </View>
                        <View style={styles.priceDetailLabelContainer}>
                          <Text style={styles.priceDetailLabel}>
                            Distance × tarif km {isNight ? '(Nuit)' : '(Jour)'}
                          </Text>
                          {distanceKm > 0 && (
                            <Text style={styles.priceDetailSubLabel}>
                              {distanceKm.toFixed(2)} km × {kmPrice} XPF
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.priceDetailValue}>
                        {distanceKm > 0 ? formatPrice(distancePrice) : '-'}
                      </Text>
                    </View>
                    
                    {/* Suppléments - Afficher chaque supplément individuellement */}
                    {orderSupplements.length > 0 && orderSupplements.map((supp: any, index: number) => {
                      const suppPrice = (supp.prixXpf || supp.price || 0) * (supp.quantity || 1);
                      const suppName = supp.nom || supp.name || 'Supplément';
                      return (
                        <View key={index} style={styles.priceDetailRow}>
                          <View style={styles.priceDetailRowLeft}>
                            <View style={styles.priceDetailIconContainer}>
                              <Ionicons name="add-circle" size={16} color="#F59E0B" />
                            </View>
                            <View style={styles.priceDetailLabelContainer}>
                              <Text style={styles.priceDetailLabel}>{suppName}</Text>
                              {(supp.quantity || 1) > 1 && (
                                <Text style={styles.priceDetailSubLabel}>
                                  {supp.quantity} × {supp.prixXpf || supp.price} XPF
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text style={[styles.priceDetailValue, { color: '#F59E0B' }]}>{formatPrice(suppPrice)}</Text>
                        </View>
                      );
                    })}
                    
                    {/* Majoration passagers (≥5 passagers) */}
                    {majorationPassagers > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="people" size={16} color="#F59E0B" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>+5 passagers ou plus</Text>
                            <Text style={styles.priceDetailSubLabel}>
                              {passengers} passagers
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.priceDetailValue, { color: '#F59E0B' }]}>{formatPrice(majorationPassagers)}</Text>
                      </View>
                    )}
                    
                    {/* Temps d'attente */}
                    {waitingFee > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="time" size={16} color="#22C55E" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>
                              Temps d'attente ({waitingMinutes} min)
                            </Text>
                            <Text style={styles.priceDetailSubLabel}>
                              {waitingMinutes - 5} min × {waitingRate} XPF (5 min gratuites)
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.priceDetailValue}>{formatPrice(waitingFee)}</Text>
                      </View>
                    )}
                    
                    {/* Arrêts payants */}
                    {paidStopsFee > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="pause-circle" size={16} color="#EF4444" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>
                              Arrêts payants ({paidStopsMinutes} min)
                            </Text>
                            <Text style={styles.priceDetailSubLabel}>
                              42 XPF/min
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.priceDetailValue, { color: '#EF4444' }]}>
                          {formatPrice(paidStopsFee)}
                        </Text>
                      </View>
                    )}
                    
                    {/* Frais de service (% configurable) - TOUJOURS AFFICHER */}
                    <View style={styles.priceDetailRow}>
                      <View style={styles.priceDetailRowLeft}>
                        <View style={styles.priceDetailIconContainer}>
                          <Ionicons 
                            name={(order.rideOption as any)?.fraisServiceOfferts ? "gift" : "pricetag"} 
                            size={16} 
                            color={(order.rideOption as any)?.fraisServiceOfferts ? "#22C55E" : "#3B82F6"} 
                          />
                        </View>
                        <View style={styles.priceDetailLabelContainer}>
                          <Text style={styles.priceDetailLabel}>Frais de service ({fraisServicePercent}%)</Text>
                          {(order.rideOption as any)?.fraisServiceOfferts && (
                            <Text style={[styles.priceDetailSubLabel, { color: '#22C55E', fontWeight: '600' }]}>
                              Offerts au client
                            </Text>
                          )}
                        </View>
                      </View>
                      {(order.rideOption as any)?.fraisServiceOfferts ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.priceDetailValue, { 
                            textDecorationLine: 'line-through', 
                            color: '#9CA3AF',
                            marginRight: 8
                          }]}>
                            {formatPrice(Math.round((priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee) * fraisServicePercent / 100))}
                          </Text>
                          <Text style={[styles.priceDetailValue, { color: '#22C55E', fontWeight: '700' }]}>
                            Offert
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.priceDetailValue, { color: '#3B82F6' }]}>
                          {formatPrice(Math.round((priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee) * fraisServicePercent / 100))}
                        </Text>
                      )}
                    </View>
                    
                    {/* Séparateur */}
                    <View style={styles.priceDetailSeparator} />
                    
                    {/* Total TTC */}
                    <View style={styles.priceDetailRowTotal}>
                      <Text style={styles.priceDetailLabelTotal}>Total TTC</Text>
                      <Text style={styles.priceDetailValueTotal}>
                        {formatPrice(
                          priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee + 
                          ((order.rideOption as any)?.fraisServiceOfferts ? 0 : Math.round((priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee) * fraisServicePercent / 100))
                        )}
                      </Text>
                    </View>
                    
                    {/* Gains chauffeur */}
                    <View style={styles.priceDetailRowEarnings}>
                      <Text style={styles.priceDetailLabelEarnings}>
                        {(order.rideOption as any)?.fraisServiceOfferts ? 'Vos gains' : 'Vos gains (hors frais service)'}
                      </Text>
                      <Text style={styles.priceDetailValueEarnings}>
                        {formatPrice(priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee)}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de résultat de paiement - Affiche le succès et retour à l'accueil */}
      {paymentResult && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={showPaymentResult}
          onRequestClose={handleFinishRide}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModalContent}>
              {paymentResult.status === 'success' ? (
                <>
                  {/* Icône de succès */}
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                  </View>
                  <Text style={styles.successTitle}>Paiement validé !</Text>
                  
                  {/* Détail du prix avec majoration si applicable */}
                  {(() => {
                    const waitingTime = paymentResult.waitingTimeMinutes;
                    const hasWaitingTime = waitingTime !== null && waitingTime !== undefined;
                    const waitingFee = hasWaitingTime && waitingTime > 5 ? (waitingTime - 5) * 42 : 0;
                    const paidStopsCost = paymentResult.paidStopsCost || 0;
                    
                    // Calculer le total des suppléments
                    const supplements = paymentResult.supplements || [];
                    const supplementsTotal = supplements.reduce((sum: number, supp: any) => {
                      return sum + Number(supp.prixXpf || supp.price || 0) * Number(supp.quantity || 1);
                    }, 0);
                    
                    // Majoration passagers (500 XPF si >= 5 passagers)
                    const passengers = order?.passengers || 1;
                    const majorationPassagers = passengers >= 5 ? 500 : 0;
                    
                    // Calculer les frais de service (% configurable)
                    const rideOpt = order?.rideOption as any;
                    const fraisOfferts = rideOpt?.fraisServiceOfferts === true;
                    
                    // Calculer le subtotal (prix sans frais de service)
                    // Le montant total inclut les frais de service si non offerts
                    const subtotal = fraisOfferts 
                      ? paymentResult.amount  // Si offerts, le montant est déjà le subtotal
                      : Math.round(paymentResult.amount / (1 + fraisServicePercent / 100));  // Sinon, on retire les frais
                    
                    const fraisServiceAmount = fraisOfferts ? 0 : (paymentResult.amount - subtotal);
                    
                    // Le prix de base = subtotal - attente - arrêts - suppléments - majoration passagers
                    const rawBasePrice = subtotal - waitingFee - paidStopsCost - supplementsTotal - majorationPassagers;
                    const basePrice = isNaN(rawBasePrice) || rawBasePrice < 0 ? subtotal : rawBasePrice;
                    
                    console.log('[Chauffeur Payment Modal] Rendering payment result:', {
                      waitingTimeMinutes: waitingTime,
                      amount: paymentResult.amount,
                      hasWaitingTime,
                      waitingFee,
                      basePrice,
                      paidStopsCost,
                      supplementsTotal,
                      supplements,
                      fraisServiceAmount,
                      fraisOfferts,
                    });
                    
                    return (
                      <View style={styles.priceBreakdownContainer}>
                        <View style={styles.priceBreakdown}>
                          {/* Prix de base (Prise en charge + KM) */}
                          <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Prix de base</Text>
                            <Text style={styles.priceValue}>
                              {basePrice.toLocaleString('fr-FR')} XPF
                            </Text>
                          </View>

                          {/* Suppléments individuels */}
                          {supplements.map((supp: any, index: number) => {
                            const suppPrice = Number(supp.prixXpf || supp.price || 0) * Number(supp.quantity || 1);
                            const suppName = String(supp.nom || supp.name || 'Supplément');
                            return (
                              <View key={index} style={styles.priceRow}>
                                <View style={styles.waitingRow}>
                                  <Ionicons name="add-circle-outline" size={16} color="#F59E0B" />
                                  <Text style={[styles.waitingLabel, { color: '#92400E' }]}>
                                    {suppName}
                                  </Text>
                                </View>
                                <Text style={[styles.waitingFee, { color: '#F59E0B' }]}>
                                  +{suppPrice.toLocaleString('fr-FR')} XPF
                                </Text>
                              </View>
                            );
                          })}

                          {/* Majoration passagers (≥5 passagers) */}
                          {majorationPassagers > 0 && (
                            <View style={styles.priceRow}>
                              <View style={styles.waitingRow}>
                                <Ionicons name="people-outline" size={16} color="#F59E0B" />
                                <Text style={[styles.waitingLabel, { color: '#92400E' }]}>
                                  +5 passagers ({passengers})
                                </Text>
                              </View>
                              <Text style={[styles.waitingFee, { color: '#F59E0B' }]}>
                                +{majorationPassagers.toLocaleString('fr-FR')} XPF
                              </Text>
                            </View>
                          )}

                          {/* Majoration d'attente (Point A) */}
                          {waitingFee > 0 && (
                            <View style={styles.priceRow}>
                              <View style={styles.waitingRow}>
                                <Ionicons name="time-outline" size={16} color="#F59E0B" />
                                <Text style={styles.waitingLabel}>
                                  Majoration d'attente ({waitingTime! - 5} min)
                                </Text>
                              </View>
                              <Text style={styles.waitingFee}>
                                +{waitingFee.toLocaleString('fr-FR')} XPF
                              </Text>
                            </View>
                          )}

                          {/* Arrêts payants (Point B) */}
                          {paidStopsCost > 0 && (
                            <View style={styles.priceRow}>
                              <View style={styles.waitingRow}>
                                <Ionicons name="pause-circle-outline" size={16} color="#EF4444" />
                                <Text style={[styles.waitingLabel, { color: '#EF4444' }]}>
                                  Arrêts payants
                                </Text>
                              </View>
                              <Text style={[styles.waitingFee, { color: '#EF4444' }]}>
                                +{paidStopsCost.toLocaleString('fr-FR')} XPF
                              </Text>
                            </View>
                          )}

                          {/* Frais de service (% configurable) */}
                          {(() => {
                            const rideOpt = order?.rideOption as any;
                            const fraisOfferts = rideOpt?.fraisServiceOfferts === true;
                            const initialPrice = rideOpt?.initialTotalPrice;
                            
                            // Calculer les frais de service
                            let fraisService = 0;
                            if (fraisOfferts && initialPrice && initialPrice > paymentResult.amount) {
                              fraisService = initialPrice - paymentResult.amount;
                            } else if (!fraisOfferts) {
                              const subtotalEstime = Math.round(paymentResult.amount / (1 + fraisServicePercent / 100));
                              fraisService = paymentResult.amount - subtotalEstime;
                            }
                            
                            if (fraisService > 0 || fraisOfferts) {
                              if (fraisOfferts && fraisService === 0) {
                                fraisService = Math.round(paymentResult.amount * fraisServicePercent / 100);
                              }
                              
                              return (
                                <View style={styles.priceRow}>
                                  <View style={styles.waitingRow}>
                                    <Ionicons 
                                      name={fraisOfferts ? "gift-outline" : "pricetag-outline"} 
                                      size={16} 
                                      color={fraisOfferts ? "#22C55E" : "#3B82F6"} 
                                    />
                                    <View>
                                      <Text style={[styles.waitingLabel, { color: fraisOfferts ? '#22C55E' : '#3B82F6' }]}>
                                        Frais de service ({fraisServicePercent}%)
                                      </Text>
                                      {fraisOfferts && (
                                        <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>
                                          Offerts au client
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                  {fraisOfferts ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={[styles.waitingFee, { 
                                        textDecorationLine: 'line-through', 
                                        color: '#9CA3AF',
                                        marginRight: 6
                                      }]}>
                                        {fraisService.toLocaleString('fr-FR')} XPF
                                      </Text>
                                      <Text style={[styles.waitingFee, { color: '#22C55E', fontWeight: '700' }]}>
                                        Offert
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text style={[styles.waitingFee, { color: '#3B82F6' }]}>
                                      +{fraisService.toLocaleString('fr-FR')} XPF
                                    </Text>
                                  )}
                                </View>
                              );
                            }
                            return null;
                          })()}

                          <View style={styles.totalDivider} />
                          
                          {/* Montant Total */}
                          <View style={styles.priceRow}>
                            <Text style={styles.totalLabel}>Montant total</Text>
                            <Text style={styles.totalAmount}>
                              {paymentResult.amount.toLocaleString('fr-FR')} XPF
                            </Text>
                          </View>
                        </View>

                        {/* Infos supplémentaires en bas du bloc */}
                        <Text style={styles.waitingTimeInfo}>
                          {hasWaitingTime ? `Temps d'attente total: ${waitingTime} min` : ''}
                          {hasWaitingTime && paidStopsCost > 0 ? ' • ' : ''}
                          {paidStopsCost > 0 ? `Arrêts inclus` : ''}
                        </Text>
                      </View>
                    );
                  })()}
                  
                  <View style={styles.paymentMethodBadge}>
                    <Ionicons 
                      name={paymentResult.paymentMethod === 'card' ? 'card' : 'cash'} 
                      size={18} 
                      color="#22C55E" 
                    />
                    <Text style={styles.paymentMethodText}>
                      {paymentResult.paymentMethod === 'card' ? 'Carte bancaire' : 'Espèces'}
                    </Text>
                  </View>
                  
                  <Text style={styles.successSubtext}>
                    Course terminée avec succès
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.returnHomeButton}
                    onPress={handleShowRating}
                  >
                    <Ionicons name="star" size={22} color="#1a1a1a" />
                    <Text style={styles.returnHomeButtonText}>Continuer</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.errorIconCircle}>
                    <Ionicons name="close" size={48} color="#FFFFFF" />
                  </View>
                  <Text style={styles.errorTitle}>Échec du paiement</Text>
                  <Text style={styles.errorText}>
                    {paymentResult.errorMessage || 'Une erreur est survenue.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setShowPaymentResult(false);
                      setShowPaymentConfirm(true);
                    }}
                  >
                    <Text style={styles.retryButtonText}>Réessayer</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de remerciement (gardé comme fallback) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showThankYou}
        onRequestClose={handleFinishRide}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Course terminée !</Text>
            <Text style={styles.successSubtext}>
              Merci pour votre service.
            </Text>
            <TouchableOpacity
              style={styles.returnHomeButton}
              onPress={handleShowRating}
            >
              <Ionicons name="star" size={22} color="#1a1a1a" />
              <Text style={styles.returnHomeButtonText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DES ADRESSES ET TARIFICATION */}
      <Modal
        visible={showAddressesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddressesModal(false)}
      >
        <View style={styles.addressesModalOverlay}>
          <View style={styles.addressesModalContent}>
            <View style={styles.addressesModalHeader}>
              <Text variant="h2" style={styles.addressesModalTitle}>
                Détails de la course
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddressesModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Section Adresses */}
            <Text style={styles.sectionTitle}>📍 Adresses du trajet</Text>
            <View style={styles.addressesContent}>
              {/* Départ */}
              <View style={[styles.addressRow, { borderLeftColor: '#22C55E' }]}>
                <View style={[styles.addressDot, { backgroundColor: '#22C55E' }]} />
                <View style={styles.addressTextContainer}>
                  <Text variant="label" style={styles.addressLabel}>Départ</Text>
                  <Text variant="body" style={styles.addressText}>
                    {pickupCoords?.value || 'Adresse de départ'}
                  </Text>
                </View>
              </View>

              {/* Arrêts intermédiaires */}
              {stopAddresses.map((stop, index) => (
                <View key={stop.id} style={[styles.addressRow, { borderLeftColor: '#F5C400' }]}>
                  <View style={[styles.addressDot, { backgroundColor: '#F5C400' }]} />
                  <View style={styles.addressTextContainer}>
                    <Text variant="label" style={styles.addressLabel}>
                      Arrêt {index + 1}
                    </Text>
                    <Text variant="body" style={styles.addressText}>
                      {stop.value}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Destination */}
              <View style={[styles.addressRow, { borderLeftColor: '#EF4444' }]}>
                <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
                <View style={styles.addressTextContainer}>
                  <Text variant="label" style={styles.addressLabel}>Destination</Text>
                  <Text variant="body" style={styles.addressText}>
                    {destinationCoords?.value || 'Adresse de destination'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Section Tarification */}
            <Text style={styles.sectionTitle}>💰 Détails de la tarification</Text>
            <View style={styles.priceDetailsContent}>
              {(() => {
                if (!order) return null;
                
                // Tour de l'île: prix fixe simple
                const isTourType2 = order.rideOption?.id === 'tour';
                const TOUR_FIXED_PRICE2 = 30000;
                
                if (isTourType2) {
                  return (
                    <>
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="compass" size={16} color="#22C55E" />
                          </View>
                          <Text style={styles.priceDetailLabel}>Tour de l'île (forfait)</Text>
                        </View>
                        <Text style={styles.priceDetailValue}>{formatPrice(TOUR_FIXED_PRICE2)}</Text>
                      </View>
                      
                      <View style={styles.priceDetailSeparator} />
                      
                      <View style={[styles.priceDetailRow, { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8 }]}>
                        <Text style={[styles.priceDetailLabel, { fontWeight: '700', color: '#22C55E' }]}>Total</Text>
                        <Text style={[styles.priceDetailValue, { fontWeight: '700', color: '#22C55E', fontSize: 18 }]}>{formatPrice(TOUR_FIXED_PRICE2)}</Text>
                      </View>
                    </>
                  );
                }
                
                // Utiliser les tarifs dynamiques depuis le back-office
                const priseEnCharge = tarifs?.priseEnCharge ?? 1000;
                const tarifJour = tarifs?.tarifJourKm ?? 130;
                const tarifNuit = tarifs?.tarifNuitKm ?? 260;
                const heureDebutJour = tarifs?.heureDebutJour ?? 6;
                const heureFinJour = tarifs?.heureFinJour ?? 20;
                
                // Déterminer si c'est tarif jour ou nuit selon la date de la commande
                // Pour les réservations à l'avance, utiliser scheduledTime, sinon createdAt
                let orderDate: Date;
                if (order.isAdvanceBooking && order.scheduledTime) {
                  orderDate = new Date(order.scheduledTime);
                  console.log('[Chauffeur Course] Modal - Réservation à l\'avance, date utilisée:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                } else if (order.createdAt) {
                  orderDate = new Date(order.createdAt);
                  console.log('[Chauffeur Course] Modal - Course immédiate, date utilisée:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                } else {
                  orderDate = new Date();
                  console.log('[Chauffeur Course] Modal - Aucune date disponible, utilisation date actuelle:', orderDate.toISOString(), 'Heure:', orderDate.getHours());
                }
                const isNight = isNightRate(orderDate, tarifs ?? undefined);
                const kmPrice = isNight ? tarifNuit : tarifJour;
                console.log('[Chauffeur Course] Modal - Calcul tarif:', {
                  orderDate: orderDate.toISOString(),
                  hour: orderDate.getHours(),
                  isNight,
                  kmPrice,
                  tarifJour,
                  tarifNuit,
                  hasTarifs: !!tarifs,
                });
                
                // Distance
                let distanceKm = 0;
                if (order.routeInfo?.distance) {
                  distanceKm = parseFloat(String(order.routeInfo.distance));
                }
                const distancePrice = distanceKm > 0 ? Math.round(distanceKm * kmPrice) : 0;
                
                // Suppléments
                const orderSupplements = order.supplements || [];
                const supplementsTotal = orderSupplements.reduce((sum: number, supp: any) => {
                  return sum + (supp.prixXpf || supp.price || 0) * (supp.quantity || 1);
                }, 0);
                
                // Majoration passagers (500 XPF si >= 5 passagers)
                const passengers = order.passengers || 1;
                const majorationPassagers = passengers >= 5 ? 500 : 0;
                
                // Frais d'attente
                const waitingMinutes = order.waitingTimeMinutes || 0;
                const waitingFee = waitingMinutes > 5 ? (waitingMinutes - 5) * waitingRate : 0;
                
                // Arrêts payants
                const paidStopsFee = paidStopsPersistedCostRef.current;
                
                return (
                  <>
                    {/* Prise en charge */}
                    <View style={styles.priceDetailRow}>
                      <View style={styles.priceDetailRowLeft}>
                        <View style={styles.priceDetailIconContainer}>
                          <Ionicons name="car" size={16} color="#22C55E" />
                        </View>
                        <Text style={styles.priceDetailLabel}>Prise en charge</Text>
                      </View>
                      <Text style={styles.priceDetailValue}>{formatPrice(priseEnCharge)}</Text>
                    </View>
                    
                    {/* Distance */}
                    {distanceKm > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="map" size={16} color="#22C55E" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>
                              Distance {isNight ? '(Tarif nuit)' : '(Tarif jour)'}
                            </Text>
                            <Text style={styles.priceDetailSubLabel}>
                              {distanceKm.toFixed(2)} km × {kmPrice} XPF
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.priceDetailValue}>{formatPrice(distancePrice)}</Text>
                      </View>
                    )}
                    
                    {/* Suppléments - Afficher chaque supplément individuellement */}
                    {orderSupplements.length > 0 && orderSupplements.map((supp: any, index: number) => {
                      const suppPrice = (supp.prixXpf || supp.price || 0) * (supp.quantity || 1);
                      const suppName = supp.nom || supp.name || 'Supplément';
                      return (
                        <View key={`supp-${index}`} style={styles.priceDetailRow}>
                          <View style={styles.priceDetailRowLeft}>
                            <View style={styles.priceDetailIconContainer}>
                              <Ionicons name="add-circle" size={16} color="#F59E0B" />
                            </View>
                            <View style={styles.priceDetailLabelContainer}>
                              <Text style={styles.priceDetailLabel}>{suppName}</Text>
                              {(supp.quantity || 1) > 1 && (
                                <Text style={styles.priceDetailSubLabel}>
                                  {supp.quantity} × {supp.prixXpf || supp.price} XPF
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text style={[styles.priceDetailValue, { color: '#F59E0B' }]}>{formatPrice(suppPrice)}</Text>
                        </View>
                      );
                    })}
                    
                    {/* Majoration passagers (≥5 passagers) */}
                    {majorationPassagers > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="people" size={16} color="#F59E0B" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>+5 passagers ou plus</Text>
                            <Text style={styles.priceDetailSubLabel}>
                              {passengers} passagers
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.priceDetailValue, { color: '#F59E0B' }]}>{formatPrice(majorationPassagers)}</Text>
                      </View>
                    )}
                    
                    {/* Temps d'attente */}
                    {waitingFee > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="time" size={16} color="#F5C400" />
                          </View>
                          <View style={styles.priceDetailLabelContainer}>
                            <Text style={styles.priceDetailLabel}>Attente ({waitingMinutes} min)</Text>
                            <Text style={styles.priceDetailSubLabel}>
                              {waitingMinutes - 5} min × {waitingRate} XPF
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.priceDetailValue}>{formatPrice(waitingFee)}</Text>
                      </View>
                    )}
                    
                    {/* Arrêts payants */}
                    {paidStopsFee > 0 && (
                      <View style={styles.priceDetailRow}>
                        <View style={styles.priceDetailRowLeft}>
                          <View style={styles.priceDetailIconContainer}>
                            <Ionicons name="pause-circle" size={16} color="#EF4444" />
                          </View>
                          <Text style={styles.priceDetailLabel}>Arrêts payants</Text>
                        </View>
                        <Text style={[styles.priceDetailValue, { color: '#EF4444' }]}>
                          {formatPrice(paidStopsFee)}
                        </Text>
                      </View>
                    )}
                    
                    {/* Frais de service (% configurable) */}
                    <View style={styles.priceDetailRow}>
                      <View style={styles.priceDetailRowLeft}>
                        <View style={styles.priceDetailIconContainer}>
                          <Ionicons 
                            name={(order.rideOption as any)?.fraisServiceOfferts ? "gift" : "pricetag"} 
                            size={16} 
                            color={(order.rideOption as any)?.fraisServiceOfferts ? "#22C55E" : "#3B82F6"} 
                          />
                        </View>
                        <View style={styles.priceDetailLabelContainer}>
                          <Text style={styles.priceDetailLabel}>Frais de service ({fraisServicePercent}%)</Text>
                          {(order.rideOption as any)?.fraisServiceOfferts && (
                            <Text style={[styles.priceDetailSubLabel, { color: '#22C55E', fontWeight: '600' }]}>
                              Offerts au client
                            </Text>
                          )}
                        </View>
                      </View>
                      {(order.rideOption as any)?.fraisServiceOfferts ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.priceDetailValue, { 
                            textDecorationLine: 'line-through', 
                            color: '#9CA3AF',
                            marginRight: 8
                          }]}>
                            {formatPrice(Math.round((priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee) * fraisServicePercent / 100))}
                          </Text>
                          <Text style={[styles.priceDetailValue, { color: '#22C55E', fontWeight: '700' }]}>
                            Offert
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.priceDetailValue, { color: '#3B82F6' }]}>
                          {formatPrice(Math.round((priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee) * fraisServicePercent / 100))}
                        </Text>
                      )}
                    </View>
                    
                    {/* Séparateur */}
                    <View style={styles.priceDetailSeparator} />
                    
                    {/* Total TTC = calculé à partir des composants */}
                    {(() => {
                      const fraisOfferts = (order.rideOption as any)?.fraisServiceOfferts === true;
                      const subtotal = priseEnCharge + distancePrice + supplementsTotal + majorationPassagers + waitingFee + paidStopsFee;
                      const fraisService = fraisOfferts ? 0 : Math.round(subtotal * fraisServicePercent / 100);
                      const calculatedTotal = subtotal + fraisService;
                      const calculatedEarnings = subtotal; // Gains chauffeur = subtotal (hors frais service)
                      return (
                        <>
                          <View style={styles.priceDetailRowTotal}>
                            <Text style={styles.priceDetailLabelTotal}>Total TTC</Text>
                            <Text style={styles.priceDetailValueTotal}>
                              {formatPrice(calculatedTotal)}
                            </Text>
                          </View>
                          
                          {/* Gains chauffeur */}
                          <View style={styles.priceDetailRowEarnings}>
                            <Text style={styles.priceDetailLabelEarnings}>
                              💵 {fraisOfferts ? 'Vos gains' : 'Vos gains (hors frais service)'}
                            </Text>
                            <Text style={styles.priceDetailValueEarnings}>
                              {formatPrice(calculatedEarnings)}
                            </Text>
                          </View>
                        </>
                      );
                    })()}
                  </>
                );
              })()}
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL ARRÊT PAYANT */}
      <Modal
        visible={showPaidStopModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // Empêcher la fermeture avec le bouton retour
      >
        <View style={styles.paidStopModalOverlay}>
          <View style={styles.paidStopModalContent}>
            {/* Header avec effet néon */}
            <View style={styles.paidStopModalHeader}>
              <View style={styles.paidStopModalIconCircle}>
                <Ionicons name="pause" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.paidStopModalTitle}>Arrêt en cours</Text>
              <Text style={styles.paidStopModalSubtitle}>Le compteur tourne...</Text>
            </View>

            {/* Timer */}
            <View style={styles.paidStopTimerContainer}>
              <Text style={styles.paidStopTimerLabel}>Durée totale des arrêts</Text>
              <Text style={styles.paidStopTimerValue}>{formatPaidStopTime(paidStopDisplaySeconds)}</Text>
            </View>

            {/* Prix */}
            <View style={styles.paidStopCostContainer}>
              <Text style={styles.paidStopCostLabel}>Coût total des arrêts</Text>
              <Text style={styles.paidStopCostValue}>{paidStopTotalCost.toLocaleString()} XPF</Text>
              <Text style={styles.paidStopCostRate}>42 XPF / minute</Text>
            </View>

            {/* Bouton reprendre */}
            <TouchableOpacity
              style={styles.paidStopResumeButton}
              onPress={handleResumeCourse}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={24} color="#FFFFFF" />
              <Text style={styles.paidStopResumeButtonText}>Reprendre la course</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE NOTATION DU CLIENT */}
      <RatingModal
        visible={showRatingModal}
        clientName={order?.clientName || 'le client'}
        onSubmit={handleSubmitRating}
        onSkip={handleFinishRide}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 10,
  },
  clientMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  clientMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32, // Réduit car le footer est maintenant à l'intérieur
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginLeft: 12,
  },
  infoBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  clientCard: {
    padding: 16,
    marginBottom: 16,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButtonContainer: {
    position: 'relative',
    width: 20,
    height: 20,
  },
  messageBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  messageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  tripCard: {
    padding: 16,
    marginBottom: 16,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tripLine: {
    width: 2,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginVertical: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  tripAddress: {
    flex: 1,
  },
  priceCard: {
    padding: 16,
    flexDirection: 'column',
    gap: 8,
  },
  priceText: {
    color: '#F5C400',
    fontSize: 24,
    fontWeight: 'bold',
  },
  earningsText: {
    color: '#6b7280',
    marginTop: 4,
  },
  footer: {
    paddingTop: 16,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'transparent',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // Styles pour la bulle "Arrêt payant" avec effet néon
  paidStopBubbleContainer: {
    position: 'absolute',
    bottom: 725, // Positionné au-dessus de la section blanche
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  paidStopBubble: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    // Effet néon avec ombres multiples
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
    // Bordure lumineuse
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  paidStopBubbleGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 29,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  paidStopBubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Styles pour le modal d'arrêt payant
  paidStopModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paidStopModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    // Effet néon rouge autour du modal
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  paidStopModalHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  paidStopModalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    // Effet néon
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  paidStopModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  paidStopModalSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  paidStopTimerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#262626',
    borderRadius: 16,
    width: '100%',
    minHeight: 110,
  },
  paidStopTimerLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paidStopTimerValue: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 52,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  paidStopCostContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#064E3B',
    borderRadius: 16,
    width: '100%',
    minHeight: 120,
    // Effet néon vert
    borderWidth: 1,
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  paidStopCostLabel: {
    fontSize: 12,
    color: '#86EFAC',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paidStopCostValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#22C55E',
    marginBottom: 8,
    lineHeight: 40,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  paidStopCostRate: {
    fontSize: 12,
    color: '#86EFAC',
  },
  paidStopResumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 12,
    // Effet néon vert
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  paidStopResumeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paymentActions: {
    gap: 8,
  },
  processingIndicator: {
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
  },
  modalIcon: {
    marginBottom: 15,
  },
  modalTitle: {
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 10,
    color: '#6b7280',
  },
  modalSubtext: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#9ca3af',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
  },
  // Styles pour les marqueurs de carte
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerIcon: {
    width: 40,
    height: 40,
  },
  pickupMarkerContainer: {
    alignItems: 'center',
  },
  pickupMarkerIcon: {
    width: 36,
    height: 36,
  },
  destinationMarkerContainer: {
    alignItems: 'center',
  },
  destinationMarkerIcon: {
    width: 36,
    height: 36,
  },
  destinationMarkerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  markerLabel: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  markerLabelDestination: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  markerLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  stopMarkerContainer: {
    alignItems: 'center',
  },
  stopMarkerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stopMarkerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Styles pour les options de paiement
  paymentOptionsContainer: {
    width: '100%',
    gap: 12,
    marginTop: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  paymentOptionCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  paymentOptionCash: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  paymentOptionCancel: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  paymentOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentOptionSubtext: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  // Styles pour le modal de paiement simplifié
  paymentModalContent: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    width: '90%',
    maxWidth: 360,
  },
  paymentIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentModalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
  },
  priceCurrency: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  waitingFeeDetail: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  waitingTimeInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  topTimerContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  topTimerBubble: {
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 196, 0, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  topTimerLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  topTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topTimerValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  topTimerPrice: {
    color: '#F5C400',
    fontSize: 14,
    fontWeight: '700',
  },
  arrivedWaitingCard: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  arrivedWaitingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrivedWaitingTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  arrivedWaitingRow: {
    gap: 4,
  },
  arrivedWaitingTimer: {
    color: '#F5C400',
    fontSize: 14,
    fontWeight: '700',
  },
  arrivedWaitingSubtext: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F5C400',
    textAlign: 'center',
    lineHeight: 36,
  },
  paymentConfirmButtons: {
    width: '100%',
    gap: 12,
    marginTop: 12,
  },
  confirmPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
  },
  confirmPaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cashPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 10,
  },
  cashButtonTextContainer: {
    alignItems: 'flex-start',
  },
  cashSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cancelPaymentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelPaymentButtonText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
  // Styles pour le modal de succès
  successModalContent: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    width: '90%',
    maxWidth: 360,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  successPriceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 60,
    paddingVertical: 8,
  },
  successPriceCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  successPriceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#22C55E',
    textAlign: 'center',
    lineHeight: 40,
  },
  successSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 8,
  },
  paymentMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 8,
  },
  paymentMethodText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
  returnHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5C400',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  returnHomeButtonText: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '700',
  },
  // Styles pour le modal d'erreur
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  priceBreakdownContainer: {
    width: '100%',
    marginBottom: 16,
  },
  priceBreakdown: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  priceValueSmall: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '500',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitingLabel: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
  },
  waitingFee: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#FCD34D',
    marginVertical: 8,
  },
  totalLabel: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '700',
  },
  // Styles pour les bulles avec icône info
  dotContainer: {
    width: 28,
    height: 28,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  infoIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  tripAddressLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  // Styles pour le modal des adresses
  addressesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  addressesModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 40,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  addressesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  addressesModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressesContent: {
    gap: 24,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  addressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 2,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
  },
  // Styles pour les markers (copiés de l'app client)
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  markerIcon: {
    width: 60,
    height: 60,
  },
  markerIconDepart: {
    width: 72,
    height: 72,
  },
  markerIconStop: {
    width: 40,
    height: 40,
  },
  markerLabelBlack: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
  },
  markerLabelBlackDepart: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
  },
  markerLabelTextWhite: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  etaContainer: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  etaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Styles pour la bulle info prix
  priceWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIconButton: {
    padding: 4,
  },
  // Styles pour le modal de détails de prix
  priceDetailsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  priceDetailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  priceDetailsModalTitle: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '700',
  },
  priceDetailsContent: {
    gap: 12,
  },
  priceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  priceDetailRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  priceDetailIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceDetailLabelContainer: {
    flex: 1,
    gap: 2,
  },
  priceDetailLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  priceDetailSubLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  priceDetailValue: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
  priceDetailSeparator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  priceDetailRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#22C55E',
    borderRadius: 12,
  },
  priceDetailLabelTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  priceDetailValueTotal: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  priceDetailRowEarnings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  priceDetailLabelEarnings: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
  },
  priceDetailValueEarnings: {
    color: '#F5C400',
    fontSize: 16,
    fontWeight: '700',
  },
});
