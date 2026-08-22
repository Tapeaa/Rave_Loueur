import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Switch, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import MenuBurger from '@/components/MenuBurger';
import {
  getDriverSessionId,
  removeDriverSessionId,
  apiFetch,
  apiPatch,
  getDriverProfile,
  getSupportLastSeenId,
  setSupportLastSeenId,
  SessionExpiredError,
  getPendingRentalOrders,
  acceptRentalOrder,
  declineRentalOrder,
} from '@/lib/api';
import { setDriverExternalId, addDriverTag, addDriverTags } from '@/lib/onesignal';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import {
  connectSocket,
  joinDriverSession,
  updateDriverStatus,
  updateDriverStatusAsync,
  onNewRentalOrder,
  onRentalOrdersPending,
  onRentalOrderTaken,
  onRentalOrderExpired,
  onRentalOrderCancelled,
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

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.78;

const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} XPF`;

/** Filtre socket : annonces ciblées (mauvais prestataire) + refus en diffusion */
function shouldShowRentalSocketOrder(
  order: Order,
  prestataireId: string | null | undefined,
  driverId: string | null | undefined,
): boolean {
  const d = order.rentalRawData?.rentalDispatch;
  if (!d?.mode) return true;
  if (d.mode === 'targeted') {
    if (!prestataireId) return true;
    return prestataireId === d.targetPrestataireId;
  }
  if (d.mode === 'broadcast' && driverId && d.rentalDeclinedBy?.includes(driverId)) {
    return false;
  }
  return true;
}

export default function ChauffeurHomeScreen() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [prestataireId, setPrestataireId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState('Loueur');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [decliningOrderId, setDecliningOrderId] = useState<string | null>(null);
  const [declinedOrderIds, setDeclinedOrderIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [bookingConfirmedOrder, setBookingConfirmedOrder] = useState<Order | null>(null);
  const [acceptedCount, setAcceptedCount] = useState<number>(0);

  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [lastSeenSupportId, setLastSeenSupportId] = useState<string | null>(null);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the online indicator
  useEffect(() => {
    if (isOnline) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  // ═══ SESSION INIT + CGU CHECK ═══
  useEffect(() => {
    const init = async () => {
      const sid = await getDriverSessionId();
      if (!sid) {
        router.replace('/(chauffeur)/login');
        return;
      }
      
      try {
        const driverProfile = await getDriverProfile();
        if (driverProfile) {
          const driver = driverProfile as any;
          const id = driver.id || driverProfile.id;
          if (id) {
            setDriverId(id);
            setDriverExternalId(id);
            addDriverTags({ rave_loueur: 'true', rental_broadcast: 'all' });
          }
          if (driver.prestataireId) {
            setPrestataireId(driver.prestataireId);
          }
          if (driver.firstName || driver.lastName) {
            setDriverName(`${driver.firstName || ''} ${driver.lastName || ''}`.trim());
          }
          
          const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${id}_cgu_accepted`);
          if (cguAcceptedInStorage !== 'true' && driver.cguAccepted !== true) {
            router.replace('/(chauffeur)/legal');
            return;
          }
        } else {
          const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${sid}_cgu_accepted`);
          if (cguAcceptedInStorage !== 'true') {
            router.replace('/(chauffeur)/legal');
            return;
          }
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          await removeDriverSessionId();
          router.replace('/(chauffeur)/login');
          return;
        }
        const cguAcceptedInStorage = await SecureStore.getItemAsync(`driver_${sid}_cgu_accepted`);
        if (cguAcceptedInStorage !== 'true') {
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
          const savedOnlineStatus = await SecureStore.getItemAsync(`driver_${sid}_isOnline`);
          const localWasOnline = savedOnlineStatus === 'true';
          
          if (!session.isOnline && localWasOnline) {
            setIsOnline(true);
            wasOnline = true;
            try { await apiPatch(`/api/driver-sessions/${sid}/status`, { isOnline: true }); } catch {}
          } else {
            setIsOnline(session.isOnline);
            wasOnline = session.isOnline;
          }
        } catch {
          const savedOnlineStatus = await SecureStore.getItemAsync(`driver_${sid}_isOnline`);
          if (savedOnlineStatus === 'true') {
            setIsOnline(true);
            wasOnline = true;
          }
        }
        
        try {
          const activeOrderResult = await apiFetch<{ hasActiveOrder: boolean; order?: any }>(`/api/orders/active/driver?sessionId=${sid}`);
          if (activeOrderResult.hasActiveOrder && activeOrderResult.order) {
            const activeRo = activeOrderResult.order.rideOption as any;
            if (activeRo?.type === 'rental' || activeRo?.isRentalOrder) {
              // push (pas replace) pour garder un historique et éviter l'erreur GO_BACK
              router.push({ pathname: '/(chauffeur)/course-details/[id]' as any, params: { id: activeOrderResult.order.id } });
              return;
            }
          }
        } catch {}
      } else {
        setIsOnline(false);
      }

      try {
        connectSocket();
        if (!isTestSession) {
          joinDriverSession(sid);
          if (wasOnline) {
            setTimeout(() => {
              updateDriverStatusAsync(sid, true);
            }, 1000);
            try {
              const rentals = await getPendingRentalOrders(sid);
              setPendingOrders(rentals.filter((o) => !declinedOrderIds.has(o.id)));
            } catch {}
          }
        }
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    init();
    return () => { disconnectSocket(); };
  }, []);

  useEffect(() => {
    addDriverTag('status', isOnline ? 'online' : 'offline');
  }, [isOnline]);

  // ═══ ACCEPTED ORDERS COUNT ═══
  useEffect(() => {
    if (!sessionId) return;
    const loadAccepted = async () => {
      try {
        const orders = await apiFetch<Order[]>(`/api/driver/orders/${sessionId}`);
        const accepted = (orders || []).filter(o => o.status === 'accepted' || o.status === 'booked');
        setAcceptedCount(accepted.length);
      } catch {}
    };
    loadAccepted();
    const interval = setInterval(loadAccepted, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // ═══ SUPPORT MESSAGES ═══
  const loadSupportMessages = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingSupport(true);
    try {
      const data = await apiFetch<{ messages: SupportMessage[] }>('/api/messages/direct/driver', {
        headers: { 'X-Driver-Session': sessionId },
      });
      setSupportMessages(data?.messages || []);
    } catch {
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
    getSupportLastSeenId().then((stored) => { if (isMounted) setLastSeenSupportId(stored); }).catch(() => {});
    return () => { isMounted = false; };
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
        headers: { 'X-Driver-Session': sessionId },
      });
      setSupportMessages((prev) => prev.map((msg) => msg.senderType === 'admin' ? { ...msg, isRead: true } : msg));
      if (latestAdminMessageId) {
        await setSupportLastSeenId(latestAdminMessageId);
        setLastSeenSupportId(latestAdminMessageId);
      }
    } catch {}
    router.push('/(chauffeur)/support-chat');
  }, [router, sessionId, latestAdminMessageId]);

  // ═══ SOCKET LISTENERS ═══
  useEffect(() => {
    if (!sessionId || !isOnline) return;

    const unsubNew = onNewRentalOrder((order) => {
      if (declinedOrderIds.has(order.id) || order.status !== 'pending') return;
      if (!shouldShowRentalSocketOrder(order, prestataireId, driverId)) return;
      setPendingOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [...prev, order];
      });
    });
    const unsubPending = onRentalOrdersPending((orders) => {
      const filtered = orders.filter((o) => !declinedOrderIds.has(o.id) && o.status === 'pending');
      setPendingOrders((prev) => {
        const newIds = new Set(filtered.map((o) => o.id));
        const existingValid = prev.filter((o) => !declinedOrderIds.has(o.id) && !newIds.has(o.id) && o.status === 'pending' && o.orderSource === 'rental');
        const merged = [...existingValid, ...filtered];
        return Array.from(new Map(merged.map((o) => [o.id, o])).values());
      });
    });
    const unsubTaken = onRentalOrderTaken((data) => {
      setPendingOrders((prev) => prev.filter((o) => o.id !== data.orderId));
    });
    const unsubExpired = onRentalOrderExpired((data) => {
      setDeclinedOrderIds((prev) => new Set(prev).add(data.orderId));
      setPendingOrders((prev) => prev.filter((o) => o.id !== data.orderId));
    });
    const unsubCancelled = onRentalOrderCancelled((data) => {
      setDeclinedOrderIds((prev) => new Set(prev).add(data.orderId));
      setPendingOrders((prev) => prev.filter((o) => o.id !== data.orderId));
    });
    return () => { unsubNew(); unsubPending(); unsubTaken(); unsubExpired(); unsubCancelled(); };
  }, [sessionId, isOnline, declinedOrderIds, prestataireId, driverId]);

  // ═══ POLLING ═══
  useEffect(() => {
    if (!sessionId || !isOnline) {
      if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const list = await getPendingRentalOrders(sessionId);
        const filtered = list.filter((o) => !declinedOrderIds.has(o.id));
        setPendingOrders((prev) => {
          const newIds = new Set(filtered.map((o) => o.id));
          const kept = prev.filter((o) => !declinedOrderIds.has(o.id) && !newIds.has(o.id) && o.orderSource === 'rental' && o.status === 'pending');
          return Array.from(new Map([...filtered, ...kept].map((o) => [o.id, o])).values());
        });
      } catch {}
    };
    poll();
    pollingIntervalRef.current = setInterval(poll, 10000);
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [sessionId, isOnline, declinedOrderIds]);

  // ═══ SOCKET CONNECTION MONITOR ═══
  useEffect(() => {
    const check = setInterval(() => {
      const connected = isSocketConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (!connected && isOnline && sessionId) {
        try { connectSocket(); joinDriverSession(sessionId); } catch {}
      }
    }, 10000);
    return () => clearInterval(check);
  }, [isOnline, sessionId]);

  // ═══ HANDLERS ═══
  const handleToggleOnline = async (value: boolean) => {
    if (!sessionId) return;
    setIsOnline(value);
    addDriverTag('status', value ? 'online' : 'offline');
    try { await SecureStore.setItemAsync(`driver_${sessionId}_isOnline`, value ? 'true' : 'false'); } catch {}
    try { await apiPatch(`/api/driver-sessions/${sessionId}/status`, { isOnline: value }); } catch {}
    updateDriverStatus(sessionId, value);
    if (!value) setPendingOrders([]);
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!sessionId || acceptingOrderId) return;
    const localOrder = pendingOrders.find((o) => o.id === orderId);
    setAcceptingOrderId(orderId);
    acceptTimeoutRef.current = setTimeout(() => setAcceptingOrderId(null), 15000);
    try {
      let loueurSig: string | null = null;
      try {
        const sigFile = `${FileSystem.documentDirectory}loueur_signature.txt`;
        console.log('[ACCEPT] Checking signature file:', sigFile);
        const info = await FileSystem.getInfoAsync(sigFile);
        console.log('[ACCEPT] Signature file exists:', info.exists);
        if (info.exists) {
          loueurSig = await FileSystem.readAsStringAsync(sigFile);
          console.log('[ACCEPT] Signature loaded, length:', loueurSig?.length || 0);
        }
      } catch (e) {
        console.log('[ACCEPT] Error reading signature:', e);
      }
      console.log('[ACCEPT] Sending accept with signature:', !!loueurSig);
      await acceptRentalOrder(orderId, sessionId, loueurSig);
      if (acceptTimeoutRef.current) { clearTimeout(acceptTimeoutRef.current); acceptTimeoutRef.current = null; }
      setAcceptingOrderId(null);
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (localOrder) setBookingConfirmedOrder(localOrder);
      setAcceptedCount(prev => prev + 1);
    } catch {
      if (acceptTimeoutRef.current) { clearTimeout(acceptTimeoutRef.current); acceptTimeoutRef.current = null; }
      setAcceptingOrderId(null);
      Alert.alert('Erreur', "Impossible d'accepter la demande.");
    }
  };

  const handleDeclineOrder = async (orderId: string) => {
    setDecliningOrderId(orderId);
    try { if (sessionId) await declineRentalOrder(orderId, sessionId); } catch {}
    setTimeout(() => {
      setDeclinedOrderIds((prev) => new Set(prev).add(orderId));
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      setDecliningOrderId(null);
    }, 200);
  };

  const handleRefresh = async () => {
    if (!sessionId || !isOnline) return;
    setRefreshing(true);
    try {
      const list = await getPendingRentalOrders(sessionId);
      setPendingOrders(list.filter((o) => !declinedOrderIds.has(o.id)));
    } catch {}
    setRefreshing(false);
  };

  const navigateToOrderDetail = (order: Order) => {
    const raw = order.rentalRawData;
    router.push({
      pathname: '/(chauffeur)/commande-location',
      params: {
        orderId: order.id,
        sessionId: sessionId || '',
        clientName: order.clientName || 'Client',
        clientPhone: order.clientPhone || '',
        clientEmail: raw?.clientEmail || '',
        clientAge: raw?.clientAge?.toString() || '',
        vehicleTitle: order.rideOption?.title || 'Véhicule',
        vehicleCategory: raw?.vehicleCategory || order.rideOption?.description || '',
        pickupLocation: order.addresses?.find(a => a.type === 'pickup')?.value || '',
        destinationInfo: order.addresses?.find(a => a.type === 'destination')?.value || '',
        scheduledTime: order.scheduledTime || '',
        totalPrice: (order.totalPrice || 0).toString(),
        pricePerDay: (raw?.pricePerDay || 0).toString(),
        subtotal: (raw?.subtotal || order.rideOption?.basePrice || 0).toString(),
        supplementsTotal: (raw?.supplementsTotal || 0).toString(),
        deposit: raw?.deposit || '0 XPF',
        km: raw?.km || 'Non spécifié',
        days: order.addresses?.find(a => a.type === 'destination')?.value?.match(/(\d+)\s*jour/)?.[1] || '1',
        startDate: order.scheduledTime || '',
        endDate: raw?.endDate || '',
        supplements: JSON.stringify(raw?.supplements || []),
        createdAt: order.createdAt || '',
        ownerName: raw?.ownerName || 'Loueur RAVE',
      },
    });
  };

  // ═══ RENDER ═══
  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <MenuBurger />
          <Image source={require('@/assets/images/logo.png')} style={s.logo} resizeMode="contain" />
          <TouchableOpacity style={s.settingsBtn} onPress={() => router.push('/(chauffeur)/profil')}>
            <Ionicons name="settings-outline" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4ECC8B']} />}
        >
          {/* Welcome + Status Card */}
          <View style={s.statusCard}>
            <View style={s.statusLeft}>
              <Text style={s.welcomeText}>Bonjour,</Text>
              <Text style={s.driverNameText}>{driverName}</Text>
              <View style={s.connectionRow}>
                <View style={[s.connDot, connectionStatus === 'connected' ? s.connGreen : s.connRed]} />
                <Text style={s.connText}>
                  {connectionStatus === 'connected' ? 'Connecté' : connectionStatus === 'connecting' ? 'Connexion...' : 'Déconnecté'}
                </Text>
              </View>
            </View>
            <View style={s.statusRight}>
              <Animated.View style={[s.statusIndicator, isOnline ? s.statusOn : s.statusOff, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="power" size={28} color={isOnline ? '#22C55E' : '#9CA3AF'} />
              </Animated.View>
              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
                trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                thumbColor={isOnline ? '#22C55E' : '#9CA3AF'}
                ios_backgroundColor="#E5E7EB"
                style={{ marginTop: 8 }}
              />
              <Text style={[s.statusLabel, isOnline ? { color: '#22C55E' } : { color: '#9CA3AF' }]}>
                {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: '#D1F2E3' }]}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={s.statNumber}>{pendingOrders.length}</Text>
              <Text style={s.statLabel}>En attente</Text>
            </View>
            <TouchableOpacity style={s.statCard} onPress={() => router.push('/(chauffeur)/courses')}>
              <View style={[s.statIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#22C55E" />
              </View>
              <Text style={s.statNumber}>{acceptedCount}</Text>
              <Text style={s.statLabel}>Acceptées</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => router.push('/(chauffeur)/gains')}>
              <View style={[s.statIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="wallet-outline" size={20} color="#4ECC8B" />
              </View>
              <Text style={s.statNumber}>-</Text>
              <Text style={s.statLabel}>Gains</Text>
            </TouchableOpacity>
          </View>

          {/* Incoming Orders Band */}
          {isOnline && pendingOrders.length > 0 && (
            <View style={s.incomingSection}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <View style={s.liveIndicator}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>LIVE</Text>
                  </View>
                  <Text style={s.sectionTitle}>Demandes entrantes</Text>
                </View>
                <Text style={s.sectionCount}>{pendingOrders.length}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.ordersBand}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + 12}
              >
                {pendingOrders.map((order) => {
                  const pickup = order.addresses?.find((a) => a.type === 'pickup');
                  const isAccepting = acceptingOrderId === order.id;
                  const isDeclining = decliningOrderId === order.id;

                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={s.orderCard}
                      activeOpacity={0.9}
                      onPress={() => navigateToOrderDetail(order)}
                    >
                      <View style={s.orderCardHeader}>
                        <View style={s.orderTypeBadge}>
                          <Ionicons name="car-sport" size={14} color="#4ECC8B" />
                          <Text style={s.orderTypeText}>{order.rideOption?.title || 'Location'}</Text>
                        </View>
                        <Text style={s.orderPrice}>{formatPrice(order.totalPrice || 0)}</Text>
                      </View>

                      <View style={s.orderClientRow}>
                        <Ionicons name="person" size={14} color="#6B7280" />
                        <Text style={s.orderClientName} numberOfLines={1}>{order.clientName || 'Client'}</Text>
                      </View>

                      <View style={s.orderLocationRow}>
                        <Ionicons name="location" size={14} color="#22C55E" />
                        <Text style={s.orderLocationText} numberOfLines={1}>{pickup?.value || 'Lieu de prise en charge'}</Text>
                      </View>

                      {order.scheduledTime && (
                        <View style={s.orderDateRow}>
                          <Ionicons name="calendar" size={14} color="#4ECC8B" />
                          <Text style={s.orderDateText}>
                            {new Date(order.scheduledTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Pacific/Tahiti' })}
                          </Text>
                        </View>
                      )}

                      <View style={s.orderActions}>
                        <TouchableOpacity
                          style={[s.declineBtn, isDeclining && s.btnDisabled]}
                          onPress={(e) => { e.stopPropagation(); handleDeclineOrder(order.id); }}
                          disabled={isDeclining || isAccepting}
                        >
                          <Ionicons name="close" size={18} color="#EF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.detailsBtn}
                          onPress={(e) => { e.stopPropagation(); navigateToOrderDetail(order); }}
                        >
                          <Ionicons name="eye-outline" size={16} color="#4ECC8B" />
                          <Text style={s.detailsBtnText}>Détails</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.acceptBtn, isAccepting && s.btnDisabled]}
                          onPress={(e) => { e.stopPropagation(); handleAcceptOrder(order.id); }}
                          disabled={isAccepting || isDeclining}
                        >
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          <Text style={s.acceptBtnText}>{isAccepting ? '...' : 'Accepter'}</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Empty state when online but no orders */}
          {isOnline && pendingOrders.length === 0 && (
            <View style={s.emptyBand}>
              <View style={s.emptyIcon}>
                <Ionicons name="hourglass-outline" size={32} color="#D1D5DB" />
              </View>
              <Text style={s.emptyTitle}>Aucune demande pour le moment</Text>
              <Text style={s.emptySubtitle}>Les nouvelles demandes de location apparaîtront ici en temps réel</Text>
            </View>
          )}

          {/* Offline state */}
          {!isOnline && (
            <View style={s.offlineBand}>
              <View style={s.offlineIcon}>
                <Ionicons name="moon-outline" size={32} color="#9CA3AF" />
              </View>
              <Text style={s.offlineTitle}>Vous êtes hors ligne</Text>
              <Text style={s.offlineSubtitle}>Activez votre statut pour recevoir les demandes de location des clients</Text>
            </View>
          )}

          {/* Quick Actions */}
          <View style={s.actionsSection}>
            <Text style={s.sectionTitle}>Accès rapide</Text>
            <View style={s.actionsGrid}>
              <TouchableOpacity style={s.actionCard} onPress={() => router.push('/(chauffeur)/courses')}>
                <View style={[s.actionIcon, { backgroundColor: '#D1F2E3' }]}>
                  <Ionicons name="receipt-outline" size={22} color="#F59E0B" />
                </View>
                <Text style={s.actionLabel}>Mes locations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={() => router.push('/(chauffeur)/messages')}>
                <View style={[s.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="chatbubbles-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={s.actionLabel}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={() => router.push('/(chauffeur)/gains')}>
                <View style={[s.actionIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="wallet-outline" size={22} color="#4ECC8B" />
                </View>
                <Text style={s.actionLabel}>Gains</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={() => router.push('/(chauffeur)/profil')}>
                <View style={[s.actionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="person-outline" size={22} color="#6B7280" />
                </View>
                <Text style={s.actionLabel}>Profil</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Support Messages */}
          {shouldShowSupportCard && (
            <TouchableOpacity style={s.supportCard} onPress={handleOpenSupportMessages} activeOpacity={0.85}>
              <View style={s.supportIconWrap}>
                <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                {unreadSupportCount > 0 && (
                  <View style={s.supportBadge}>
                    <Text style={s.supportBadgeText}>{unreadSupportCount > 99 ? '99+' : unreadSupportCount}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.supportTitle}>Message du support</Text>
                <Text style={s.supportPreview} numberOfLines={2}>
                  {latestSupportMessage?.content || 'Aucun message'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Booking Confirmed Modal */}
      <Modal visible={!!bookingConfirmedOrder} transparent animationType="slide" onRequestClose={() => setBookingConfirmedOrder(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalSuccessIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
            </View>
            <Text style={s.modalTitle}>Réservation acceptée !</Text>
            <Text style={s.modalSubtitle}>La demande de location a été enregistrée sur votre compte</Text>
            
            {bookingConfirmedOrder && (
              <View style={s.modalInfoCard}>
                <View style={s.modalInfoRow}>
                  <Ionicons name="person" size={16} color="#6B7280" />
                  <Text style={s.modalInfoText}>{bookingConfirmedOrder.clientName}</Text>
                </View>
                <View style={s.modalInfoRow}>
                  <Ionicons name="location" size={16} color="#22C55E" />
                  <Text style={s.modalInfoText} numberOfLines={1}>
                    {bookingConfirmedOrder.addresses?.find(a => a.type === 'pickup')?.value || 'Lieu de prise en charge'}
                  </Text>
                </View>
                <View style={s.modalPriceRow}>
                  <Text style={s.modalPriceLabel}>Total</Text>
                  <Text style={s.modalPriceValue}>{formatPrice(bookingConfirmedOrder.totalPrice || 0)}</Text>
                </View>
              </View>
            )}

            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalBtnSecondary} onPress={() => setBookingConfirmedOrder(null)}>
                <Text style={s.modalBtnSecondaryText}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnPrimary} onPress={() => { setBookingConfirmedOrder(null); router.push('/(chauffeur)/courses'); }}>
                <Ionicons name="list" size={18} color="#FFFFFF" />
                <Text style={s.modalBtnPrimaryText}>Mes locations</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  logo: { width: 100, height: 36 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { paddingBottom: 40 },

  // Status Card
  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 16,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  statusLeft: { flex: 1 },
  welcomeText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  driverNameText: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  connectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  connGreen: { backgroundColor: '#22C55E' },
  connRed: { backgroundColor: '#EF4444' },
  connText: { fontSize: 12, color: '#6B7280' },
  statusRight: { alignItems: 'center' },
  statusIndicator: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  statusOn: { backgroundColor: '#DCFCE7' },
  statusOff: { backgroundColor: '#F3F4F6' },
  statusLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 1 },

  // Stats
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  // Incoming Section
  incomingSection: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  sectionCount: {
    fontSize: 14, fontWeight: '700', color: '#4ECC8B',
    backgroundColor: '#D1F2E3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },

  ordersBand: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  orderCard: {
    width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  orderCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  orderTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  orderTypeText: { fontSize: 12, fontWeight: '700', color: '#4ECC8B' },
  orderPrice: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  orderClientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  orderClientName: { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  orderLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  orderLocationText: { fontSize: 13, color: '#6B7280', flex: 1 },
  orderDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  orderDateText: { fontSize: 13, color: '#4ECC8B', fontWeight: '600' },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  declineBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },
  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, height: 38, borderRadius: 12,
    backgroundColor: '#D1F2E3',
  },
  detailsBtnText: { fontSize: 12, fontWeight: '700', color: '#166534' },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 38, borderRadius: 12, backgroundColor: '#22C55E',
  },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },

  // Empty / Offline
  emptyBand: {
    marginHorizontal: 16, marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  offlineBand: {
    marginHorizontal: 16, marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  offlineIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  offlineTitle: { fontSize: 16, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  offlineSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  // Actions Section
  actionsSection: { marginTop: 28, paddingHorizontal: 16 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  actionCard: {
    width: (width - 42) / 2, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },

  // Support
  supportCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 20, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  supportIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center',
  },
  supportBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, paddingHorizontal: 4, alignItems: 'center',
  },
  supportBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  supportTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  supportPreview: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40, alignItems: 'center',
  },
  modalSuccessIcon: { marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  modalInfoCard: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, gap: 10, marginBottom: 24,
  },
  modalInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalInfoText: { fontSize: 14, color: '#374151', flex: 1 },
  modalPriceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, marginTop: 4,
  },
  modalPriceLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  modalPriceValue: { fontSize: 18, fontWeight: '800', color: '#4ECC8B' },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 14,
  },
  modalBtnSecondaryText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1a1a1a', paddingVertical: 14, borderRadius: 14,
  },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
