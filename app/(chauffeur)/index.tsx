import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import MenuBurger from '@/components/MenuBurger';
import { BookingCalendar } from '@/components/BookingCalendar';
import Reanimated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import {
  getDriverEarnings,
  getDriverSessionId,
  apiFetch,
  apiPatch,
  getDriverProfile,
  getSupportLastSeenId,
  setSupportLastSeenId,
  SessionExpiredError,
  getPendingRentalOrders,
  declineRentalOrder,
  secureStorage,
  getMyVehicles,
  type LoueurVehicle,
  API_URL,
} from '@/lib/api';

const LOUEUR_DASHBOARD_URL = `${(API_URL || 'https://backend-rave.onrender.com/api').replace(/\/api\/?$/, '')}/prestataire`;
import { getRentalLifecyclePhase, isRentalOrderLike } from '@/lib/rental-lifecycle';
import { hasPendingCancelRequest, isClosedOrderStatus } from '@/lib/order-status';
import { logoutDriver } from '@/lib/logout';
import { setDriverExternalId, addDriverTag, addDriverTags } from '@/lib/onesignal';
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
  isSocketConnected,
} from '@/lib/socket';
import type { Order } from '@/lib/types';
import { appAlert } from '@/components/AppAlert';

function formatCompactXpf(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (amount >= 10_000) return `${Math.round(amount / 1000)}k`;
  return amount.toLocaleString('fr-FR');
}

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

const TAHITI_TZ = 'Pacific/Tahiti';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Jour calendaire à Tahiti (YYYY-MM-DD), pour comparer « aujourd'hui » quel que soit le fuseau du téléphone. */
function tahitiYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TAHITI_TZ });
}

function rentalStart(order: Order): Date | null {
  return toDate((order.rideOption as any)?.startDate || order.scheduledTime);
}

function rentalEnd(order: Order): Date | null {
  return toDate((order.rideOption as any)?.endDate || order.rentalRawData?.endDate);
}

function formatHour(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TAHITI_TZ });
}

function formatTodayLabel(): string {
  const label = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TAHITI_TZ,
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type AgendaKind = 'handover' | 'return' | 'late';

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
  const [decliningOrderId, setDecliningOrderId] = useState<string | null>(null);
  const [declinedOrderIds, setDeclinedOrderIds] = useState<Set<string>>(new Set());
  const declinedRef = useRef<Set<string>>(new Set());
  const [monthEarnings, setMonthEarnings] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDriverEarnings()
        .then((data) => {
          if (active && data) setMonthEarnings(data.earnings.month || 0);
        })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [driverOrders, setDriverOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<LoueurVehicle[] | null>(null);
  const [unreadClientMessages, setUnreadClientMessages] = useState(0);

  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [lastSeenSupportId, setLastSeenSupportId] = useState<string | null>(null);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
          
          const cguAcceptedInStorage = await secureStorage.getItem(`driver_${id}_cgu_accepted`);
          if (cguAcceptedInStorage !== 'true' && driver.cguAccepted !== true) {
            router.replace('/(chauffeur)/legal');
            return;
          }
        } else {
          const cguAcceptedInStorage = await secureStorage.getItem(`driver_${sid}_cgu_accepted`);
          if (cguAcceptedInStorage !== 'true') {
            router.replace('/(chauffeur)/legal');
            return;
          }
        }
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          await logoutDriver();
          router.replace('/(chauffeur)/login');
          return;
        }
        const cguAcceptedInStorage = await secureStorage.getItem(`driver_${sid}_cgu_accepted`);
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
          const savedOnlineStatus = await secureStorage.getItem(`driver_${sid}_isOnline`);
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
          const savedOnlineStatus = await secureStorage.getItem(`driver_${sid}_isOnline`);
          if (savedOnlineStatus === 'true') {
            setIsOnline(true);
            wasOnline = true;
          }
        }
      } else {
        setIsOnline(false);
      }

      try {
        connectSocket();
        if (!isTestSession) {
          joinDriverSession(sid);
          // Locations : toujours récupérer les demandes (indépendant du statut « en ligne » taxi)
          try {
            const rentals = await getPendingRentalOrders(sid);
            setPendingOrders(rentals.filter((o) => !declinedOrderIds.has(o.id)));
          } catch {}
          if (wasOnline) {
            setTimeout(() => {
              updateDriverStatusAsync(sid, true);
            }, 1000);
          }
        }
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('disconnected');
      }
    };
    init();
  }, []);

  useEffect(() => {
    addDriverTag('status', isOnline ? 'online' : 'offline');
  }, [isOnline]);

  // ═══ RÉSERVATIONS, FLOTTE, MESSAGES CLIENTS ═══
  const loadDriverOrders = useCallback(async () => {
    if (!sessionId) return;
    try {
      const orders = await apiFetch<Order[]>(`/api/driver/orders/${sessionId}`);
      setDriverOrders(Array.isArray(orders) ? orders : []);
    } catch {}
  }, [sessionId]);

  const loadVehicles = useCallback(async () => {
    try {
      setVehicles(await getMyVehicles());
    } catch {}
  }, []);

  const loadUnreadClientMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const convs = await apiFetch<{ unreadCount?: number }[]>('/api/messages/conversations/driver', {
        headers: { 'X-Driver-Session': sessionId },
      });
      setUnreadClientMessages(
        Array.isArray(convs) ? convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0) : 0
      );
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    loadDriverOrders();
    loadUnreadClientMessages();
    const interval = setInterval(() => {
      loadDriverOrders();
      loadUnreadClientMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionId, loadDriverOrders, loadUnreadClientMessages]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadDriverOrders();
      loadUnreadClientMessages();
    }, [loadVehicles, loadDriverOrders, loadUnreadClientMessages])
  );

  const dashboard = useMemo(() => {
    const today = tahitiYmd(new Date());
    const upcoming: Order[] = [];
    const withClient: Order[] = [];
    const agenda: { kind: AgendaKind; order: Order; at: Date | null }[] = [];

    for (const order of driverOrders) {
      if (!isRentalOrderLike(order) || isClosedOrderStatus(order.status)) continue;
      const phase = getRentalLifecyclePhase(order);
      const start = rentalStart(order);
      const notStarted = phase === 'vehicle_ready' && !!start && tahitiYmd(start) > today;
      if (notStarted) {
        upcoming.push(order);
      } else if (phase === 'vehicle_ready' || phase === 'with_client') {
        withClient.push(order);
        const end = rentalEnd(order);
        if (end) {
          const endYmd = tahitiYmd(end);
          if (endYmd < today) agenda.push({ kind: 'late', order, at: end });
          else if (endYmd === today) agenda.push({ kind: 'return', order, at: end });
        }
      }
    }

    const kindRank: Record<AgendaKind, number> = { late: 0, handover: 1, return: 2 };
    agenda.sort((a, b) =>
      kindRank[a.kind] - kindRank[b.kind] || (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)
    );
    upcoming.sort((a, b) => (rentalStart(a)?.getTime() ?? 0) - (rentalStart(b)?.getTime() ?? 0));

    return {
      agenda,
      upcoming,
      withClientCount: withClient.length,
      reservedCount: upcoming.length + agenda.filter((a) => a.kind === 'handover').length,
      cancelRequestCount: driverOrders.filter(hasPendingCancelRequest).length,
      refundPendingCount: driverOrders.filter((o) => (o.rideOption as any)?.refund?.status === 'pending').length,
    };
  }, [driverOrders]);

  const calendarOrders = useMemo(() => {
    const byId = new Map<string, Order>();
    for (const o of driverOrders) byId.set(o.id, o);
    for (const o of pendingOrders) if (!byId.has(o.id)) byId.set(o.id, o);
    return Array.from(byId.values());
  }, [driverOrders, pendingOrders]);

  const fleet = useMemo(() => {
    if (!vehicles) return null;
    const active = vehicles.filter((v) => v.isActive !== false);
    return {
      total: active.length,
      available: active.filter((v) => v.availableForRental).length,
    };
  }, [vehicles]);

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

  // ═══ SOCKET LISTENERS (locations : toujours actifs si session, hors isOnline taxi) ═══
  useEffect(() => {
    declinedRef.current = declinedOrderIds;
  }, [declinedOrderIds]);

  useEffect(() => {
    if (!sessionId) return;
    const isDeclined = (id: string) => declinedRef.current.has(id);

    const unsubNew = onNewRentalOrder((order) => {
      if (isDeclined(order.id) || order.status !== 'pending') return;
      if (!shouldShowRentalSocketOrder(order, prestataireId, driverId)) return;
      setPendingOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [...prev, order];
      });
    });
    const unsubPending = onRentalOrdersPending((orders) => {
      const filtered = orders.filter((o) => !isDeclined(o.id) && o.status === 'pending');
      setPendingOrders((prev) => {
        const newIds = new Set(filtered.map((o) => o.id));
        const existingValid = prev.filter((o) => !isDeclined(o.id) && !newIds.has(o.id) && o.status === 'pending' && o.orderSource === 'rental');
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
  }, [sessionId, prestataireId, driverId]);

  // ═══ POLLING demandes location (toujours si session) ═══
  useEffect(() => {
    if (!sessionId) {
      if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const list = await getPendingRentalOrders(sessionId);
        const declined = declinedRef.current;
        const filtered = list.filter((o) => !declined.has(o.id));
        setPendingOrders((prev) => {
          const newIds = new Set(filtered.map((o) => o.id));
          const kept = prev.filter((o) => !declined.has(o.id) && !newIds.has(o.id) && o.orderSource === 'rental' && o.status === 'pending');
          return Array.from(new Map([...filtered, ...kept].map((o) => [o.id, o])).values());
        });
      } catch {}
    };
    poll();
    pollingIntervalRef.current = setInterval(poll, 10000);
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [sessionId]);

  // ═══ SOCKET CONNECTION MONITOR ═══
  useEffect(() => {
    const check = setInterval(() => {
      const connected = isSocketConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (!connected && sessionId) {
        try { connectSocket(); joinDriverSession(sessionId); } catch {}
      }
    }, 10000);
    return () => clearInterval(check);
  }, [sessionId]);

  // ═══ HANDLERS ═══
  const handleToggleOnline = async (value: boolean) => {
    if (!sessionId) return;
    setIsOnline(value);
    addDriverTag('status', value ? 'online' : 'offline');
    try { await secureStorage.setItem(`driver_${sessionId}_isOnline`, value ? 'true' : 'false'); } catch {}
    try { await apiPatch(`/api/driver-sessions/${sessionId}/status`, { isOnline: value }); } catch {}
    updateDriverStatus(sessionId, value);
    // Ne plus vider les demandes location en passant « hors ligne » (legacy taxi)
  };

  const handleDeclineOrder = (orderId: string) => {
    const target = pendingOrders.find((o) => o.id === orderId);
    const paid = (target?.rideOption as any)?.payzenStatus === 'paid';
    const message = paid
      ? `Le client sera prévenu. Il a déjà payé par carte : vous devrez lui rembourser ${(target?.totalPrice || 0).toLocaleString('fr-FR')} XPF puis le confirmer dans Réservations.`
      : 'Le client sera prévenu que vous refusez sa location.';
    appAlert('Refuser la demande ?', message, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          if (!sessionId) return;
          setDecliningOrderId(orderId);
          try {
            await declineRentalOrder(orderId, sessionId);
            setDeclinedOrderIds((prev) => new Set(prev).add(orderId));
            setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
          } catch (error: any) {
            appAlert('Erreur', error?.message || 'Impossible de refuser la demande. Réessayez.');
          } finally {
            setDecliningOrderId(null);
          }
        },
      },
    ]);
  };

  const handleRefresh = async () => {
    if (!sessionId) return;
    setRefreshing(true);
    const loadPending = async () => {
      try {
        const list = await getPendingRentalOrders(sessionId);
        setPendingOrders(list.filter((o) => !declinedOrderIds.has(o.id)));
      } catch {}
    };
    const loadEarnings = async () => {
      try {
        const data = await getDriverEarnings();
        if (data) setMonthEarnings(data.earnings.month || 0);
      } catch {}
    };
    await Promise.all([
      loadPending(),
      loadDriverOrders(),
      loadVehicles(),
      loadUnreadClientMessages(),
      loadSupportMessages(),
      loadEarnings(),
    ]);
    setRefreshing(false);
  };

  const openOrderDetails = (orderId: string) => router.push(`/(chauffeur)/course-details/${orderId}`);

  const navigateToOrderDetail = (order: Order) => {
    const raw = order.rentalRawData;
    const ro = (order.rideOption || {}) as any;
    const payMethod = order.paymentMethod || raw?.paymentMethod || 'cash';
    const pzStatus = ro?.payzenStatus || raw?.payzenStatus || '';
    const pzLast4 = ro?.payzenCardLast4 || raw?.payzenCardLast4 || '';
    const pzTxUuid = ro?.payzenTransactionUuid || raw?.payzenTransactionUuid || '';
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
        paymentMethod: payMethod,
        payzenStatus: pzStatus,
        payzenCardLast4: pzLast4,
        payzenTransactionUuid: pzTxUuid,
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => setStatusBarStyle('light'), 0);
      return () => {
        clearTimeout(t);
        setStatusBarStyle('dark');
      };
    }, [])
  );

  // ═══ RENDER ═══
  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <MenuBurger variant="dark" />
          <Image source={require('@/assets/images/rave-header-logo-white.png')} style={s.logo} resizeMode="contain" />
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4ECC8B']} tintColor="#FFFFFF" />
          }
        >
          <View style={s.heroOverscroll} />
          <View style={s.hero}>
            <View style={s.heroTopRow}>
              <Text style={s.welcomeText}>{formatTodayLabel()}</Text>
              <View style={s.connectionRow}>
                <View style={[s.connDot, connectionStatus === 'connected' ? s.connGreen : s.connRed]} />
                <Text style={s.connText}>
                  {connectionStatus === 'connected'
                    ? 'En ligne'
                    : connectionStatus === 'connecting' ? 'Connexion…' : 'Hors ligne'}
                </Text>
              </View>
            </View>
            <View style={s.dashboardRow}>
              <Text style={[s.driverNameText, { flex: 1, marginTop: 0 }]} numberOfLines={1}>
                Bonjour, {driverName.split(' ')[0] || driverName}
              </Text>
              <TouchableOpacity
                style={s.dashboardBtn}
                onPress={() => Linking.openURL(LOUEUR_DASHBOARD_URL)}
                activeOpacity={0.8}
                accessibilityRole="link"
                accessibilityLabel="Ouvrir le dashboard loueur"
              >
                <Ionicons name="desktop-outline" size={14} color="#121212" />
                <Text style={s.dashboardBtnText}>Dashboard</Text>
              </TouchableOpacity>
            </View>

            <View style={s.heroBody}>
            <TouchableOpacity style={s.earningsBox} onPress={() => router.push('/(chauffeur)/gains')} activeOpacity={0.8}>
              <Text style={s.earningsLabel}>Gains du mois</Text>
              <Text style={s.earningsValue} numberOfLines={1}>
                {monthEarnings === null ? '–' : formatCompactXpf(monthEarnings)}
              </Text>
              <View style={s.earningsLink}>
                <Text style={s.earningsLinkText}>Voir le détail</Text>
                <View style={s.earningsArrow}>
                  <Ionicons name="arrow-forward" size={14} color="#121212" />
                </View>
              </View>
            </TouchableOpacity>

          <View style={s.statsCol}>
            {[
              { key: 'pending', icon: 'time-outline', color: '#FBBF24', value: String(pendingOrders.length), label: 'Demandes', route: null },
              { key: 'upcoming', icon: 'calendar-outline', color: '#60A5FA', value: String(dashboard.reservedCount), label: 'À venir', route: '/(chauffeur)/courses' },
              { key: 'active', icon: 'car-sport-outline', color: '#4ECC8B', value: String(dashboard.withClientCount), label: 'En cours', route: '/(chauffeur)/courses' },
            ].map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={s.statChip}
                activeOpacity={chip.route ? 0.7 : 1}
                disabled={!chip.route}
                onPress={() => chip.route && router.push(chip.route as any)}
              >
                <View style={[s.statChipIcon, { backgroundColor: chip.color + '26' }]}>
                  <Ionicons name={chip.icon as any} size={15} color={chip.color} />
                </View>
                <Text style={s.statChipLabel} numberOfLines={1}>{chip.label}</Text>
                <Text style={s.statChipValue}>{chip.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
            </View>
          </View>

          <View style={s.sheet}>

          {/* À traiter */}
          {(dashboard.cancelRequestCount > 0 || dashboard.refundPendingCount > 0 || unreadClientMessages > 0 || fleet?.total === 0) && (
            <View style={s.todoSection}>
              {dashboard.cancelRequestCount > 0 && (
                <TouchableOpacity style={[s.todoRow, s.todoWarn]} onPress={() => router.push('/(chauffeur)/courses')}>
                  <Ionicons name="alert-circle" size={20} color="#B45309" />
                  <Text style={[s.todoText, { color: '#92400E' }]}>
                    {dashboard.cancelRequestCount} demande{dashboard.cancelRequestCount > 1 ? 's' : ''} d'annulation à traiter
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#B45309" />
                </TouchableOpacity>
              )}
              {dashboard.refundPendingCount > 0 && (
                <TouchableOpacity style={[s.todoRow, s.todoDanger]} onPress={() => router.push('/(chauffeur)/courses')}>
                  <Ionicons name="return-down-back" size={20} color="#B91C1C" />
                  <Text style={[s.todoText, { color: '#991B1B' }]}>
                    {dashboard.refundPendingCount} remboursement{dashboard.refundPendingCount > 1 ? 's' : ''} à effectuer
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#B91C1C" />
                </TouchableOpacity>
              )}
              {unreadClientMessages > 0 && (
                <TouchableOpacity style={[s.todoRow, s.todoInfo]} onPress={() => router.push('/(chauffeur)/messages')}>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#1D4ED8" />
                  <Text style={[s.todoText, { color: '#1E3A8A' }]}>
                    {unreadClientMessages} message{unreadClientMessages > 1 ? 's' : ''} client non lu{unreadClientMessages > 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
                </TouchableOpacity>
              )}
              {fleet?.total === 0 && (
                <TouchableOpacity style={[s.todoRow, s.todoInfo]} onPress={() => router.push('/(chauffeur)/ajouter-vehicule')}>
                  <Ionicons name="add-circle" size={20} color="#1D4ED8" />
                  <Text style={[s.todoText, { color: '#1E3A8A' }]}>
                    Ajoutez votre premier véhicule pour recevoir des demandes
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#1D4ED8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Incoming Orders Band — visible même hors ligne taxi */}
          {pendingOrders.length > 0 && (
            <Reanimated.View
              style={s.incomingSection}
              entering={FadeInDown.duration(350)}
              exiting={FadeOutUp.duration(250)}
            >
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
                scrollEnabled={pendingOrders.length > 1}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.ordersBand}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + 12}
              >
                {pendingOrders.map((order) => {
                  const pickup = order.addresses?.find((a) => a.type === 'pickup');
                  const isDeclining = decliningOrderId === order.id;
                  const ro = (order.rideOption || {}) as any;
                  const isPaidOnline = ro?.payzenStatus === 'paid' || order.rentalRawData?.payzenStatus === 'paid';
                  const isCardUnpaid = !isPaidOnline && (order.paymentMethod === 'card' || order.rentalRawData?.paymentMethod === 'card');
                  const cancelRequested = ro?.cancelRequest?.status === 'pending';

                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={[s.orderCard, pendingOrders.length === 1 && { width: width - 40 }]}
                      activeOpacity={0.9}
                      onPress={() => navigateToOrderDetail(order)}
                    >
                      <View style={s.orderCardHeader}>
                        <View style={s.orderAvatar}>
                          <Text style={s.orderAvatarText}>{(order.clientName || 'C').trim().charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.orderClientName} numberOfLines={1}>{order.clientName || 'Client'}</Text>
                          <Text style={s.orderVehicle} numberOfLines={1}>{order.rideOption?.title || 'Location'}</Text>
                        </View>
                        <Text style={s.orderPrice}>{formatCompactXpf(order.totalPrice || 0)}</Text>
                      </View>

                      <View style={s.orderChips}>
                        {(() => {
                          const start = rentalStart(order);
                          const end = rentalEnd(order);
                          if (!start) return null;
                          const fmt = (d: Date) =>
                            d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TAHITI_TZ }).replace('.', '');
                          return (
                            <View style={[s.orderChip, { backgroundColor: '#F3F4F6' }]}>
                              <Ionicons name="calendar-outline" size={13} color="#374151" />
                              <Text style={[s.orderChipText, { color: '#374151' }]}>
                                {fmt(start)}{end ? ` → ${fmt(end)}` : ''}
                              </Text>
                            </View>
                          );
                        })()}
                        <View
                          style={[
                            s.orderChip,
                            { backgroundColor: isPaidOnline ? '#DCFCE7' : isCardUnpaid ? '#FEE2E2' : '#FEF3C7' },
                          ]}
                        >
                          <Ionicons
                            name={isPaidOnline ? 'checkmark-circle' : isCardUnpaid ? 'alert-circle' : 'cash-outline'}
                            size={13}
                            color={isPaidOnline ? '#166534' : isCardUnpaid ? '#991B1B' : '#92400E'}
                          />
                          <Text
                            style={[
                              s.orderChipText,
                              { color: isPaidOnline ? '#166534' : isCardUnpaid ? '#991B1B' : '#92400E' },
                            ]}
                          >
                            {isPaidOnline ? 'Payée par carte' : isCardUnpaid ? 'Carte non aboutie' : 'À encaisser'}
                          </Text>
                        </View>
                      </View>

                      {pickup?.value ? (
                        <View style={s.orderLocationRow}>
                          <Ionicons name="location-outline" size={15} color="#6B7280" />
                          <Text style={s.orderLocationText} numberOfLines={1}>{pickup.value}</Text>
                        </View>
                      ) : null}

                      {cancelRequested && (
                        <View style={s.cancelRequestBanner}>
                          <Ionicons name="alert-circle" size={14} color="#B45309" />
                          <Text style={s.cancelRequestText}>
                            Annulation demandée par le client — répondez à sa demande
                          </Text>
                        </View>
                      )}

                      <View style={s.orderActions}>
                        <TouchableOpacity
                          style={[s.declineBtn, isDeclining && s.btnDisabled]}
                          onPress={(e) => { e.stopPropagation(); handleDeclineOrder(order.id); }}
                          disabled={isDeclining}
                        >
                          <Ionicons name="close" size={18} color="#EF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.acceptBtn, (isDeclining || cancelRequested) && s.btnDisabled]}
                          onPress={(e) => { e.stopPropagation(); navigateToOrderDetail(order); }}
                          disabled={isDeclining || cancelRequested}
                        >
                          <Ionicons name="eye-outline" size={18} color="#1a1a1a" />
                          <Text style={s.acceptBtnText}>Examiner</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Reanimated.View>
          )}

          <Reanimated.View layout={LinearTransition.duration(350)} style={{ marginTop: 16 }}>
            <BookingCalendar
              orders={calendarOrders}
              onPressOrder={(order) => router.push(`/(chauffeur)/course-details/${order.id}`)}
            />
          </Reanimated.View>

          {/* Aujourd'hui */}
          <View style={s.blockSection}>
            <View style={s.blockHeader}>
              <Text style={s.sectionTitle}>Aujourd'hui</Text>
              {dashboard.agenda.length > 0 && (
                <Text style={s.blockCount}>{dashboard.agenda.length}</Text>
              )}
            </View>
            {dashboard.agenda.length === 0 ? (
              <View style={s.blockEmpty}>
                <Ionicons name="sunny-outline" size={18} color="#9CA3AF" />
                <Text style={s.blockEmptyText}>Aucune remise ni retour prévu aujourd'hui</Text>
              </View>
            ) : (
              dashboard.agenda.map(({ kind, order, at }, index) => {
                const meta = kind === 'late'
                  ? { icon: 'warning' as const, color: '#DC2626', bg: '#FEE2E2', label: 'Retour en retard' }
                  : kind === 'handover'
                    ? { icon: 'key' as const, color: '#2563EB', bg: '#DBEAFE', label: 'Remise du véhicule' }
                    : { icon: 'flag' as const, color: '#16A34A', bg: '#DCFCE7', label: 'Retour prévu' };
                const when = at
                  ? kind === 'late'
                    ? `prévu le ${at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: TAHITI_TZ })}`
                    : `à ${formatHour(at)}`
                  : '';
                return (
                  <TouchableOpacity
                    key={`${kind}-${order.id}`}
                    style={[s.agendaRow, index > 0 && s.agendaRowDivider]}
                    activeOpacity={0.85}
                    onPress={() => openOrderDetails(order.id)}
                  >
                    <View style={[s.agendaIcon, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.agendaKind, { color: meta.color }]}>
                        {meta.label}{when ? ` · ${when}` : ''}
                      </Text>
                      <Text style={s.agendaTitle} numberOfLines={1}>
                        {order.rideOption?.title || 'Véhicule'} — {order.clientName || 'Client'}
                      </Text>
                    </View>
                    {order.clientPhone ? (
                      <TouchableOpacity
                        style={s.agendaCall}
                        onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${order.clientPhone}`); }}
                      >
                        <Ionicons name="call" size={16} color="#22C55E" />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Prochaines locations */}
          {dashboard.upcoming.length > 0 && (
            <View style={s.blockSection}>
              <View style={s.blockHeader}>
                <Text style={s.sectionTitle}>Prochaines locations</Text>
                <TouchableOpacity onPress={() => router.push('/(chauffeur)/courses')}>
                  <Text style={s.blockLink}>Tout voir</Text>
                </TouchableOpacity>
              </View>
              {dashboard.upcoming.slice(0, 3).map((order, index) => {
                const start = rentalStart(order);
                const days = (order.rideOption as any)?.days;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={[s.agendaRow, index > 0 && s.agendaRowDivider]}
                    activeOpacity={0.85}
                    onPress={() => openOrderDetails(order.id)}
                  >
                    <View style={s.dateChip}>
                      <Text style={s.dateChipDay}>
                        {start ? start.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: TAHITI_TZ }) : '–'}
                      </Text>
                      <Text style={s.dateChipMonth}>
                        {start ? start.toLocaleDateString('fr-FR', { month: 'short', timeZone: TAHITI_TZ }).replace('.', '') : ''}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.agendaTitle} numberOfLines={1}>{order.rideOption?.title || 'Véhicule'}</Text>
                      <Text style={s.agendaSub} numberOfLines={1}>
                        {order.clientName || 'Client'}
                        {start ? ` · ${formatHour(start)}` : ''}
                        {days ? ` · ${days} jour${days > 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <Text style={s.upcomingPrice}>{formatCompactXpf(order.totalPrice || 0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Ma flotte */}
          {fleet && fleet.total > 0 && (
            <TouchableOpacity style={s.fleetCard} activeOpacity={0.85} onPress={() => router.push('/(chauffeur)/mes-vehicules')}>
              <View style={[s.agendaIcon, { backgroundColor: '#1a1a1a' }]}>
                <Ionicons name="car-sport" size={18} color="#4ECC8B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.agendaTitle}>Ma flotte</Text>
                <Text style={s.agendaSub}>
                  {fleet.total} véhicule{fleet.total > 1 ? 's' : ''} · {fleet.available} disponible{fleet.available > 1 ? 's' : ''} à la location
                </Text>
              </View>
              <TouchableOpacity
                style={s.fleetAddBtn}
                onPress={(e) => { e.stopPropagation(); router.push('/(chauffeur)/ajouter-vehicule'); }}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Quick Actions */}
          <View style={s.actionsSection}>
            <Text style={s.sectionTitle}>Accès rapide</Text>
            <View style={s.actionsGrid}>
              {([
                { label: 'Réservations', icon: 'receipt-outline', color: '#F59E0B', bg: '#FEF3C7', route: '/(chauffeur)/courses', badge: dashboard.cancelRequestCount + dashboard.refundPendingCount },
                { label: 'Messages', icon: 'chatbubbles-outline', color: '#3B82F6', bg: '#DBEAFE', route: '/(chauffeur)/messages', badge: unreadClientMessages + unreadSupportCount },
                { label: 'Véhicules', icon: 'car-sport-outline', color: '#1a1a1a', bg: '#E5E7EB', route: '/(chauffeur)/mes-vehicules', badge: 0 },
                { label: 'Gains', icon: 'wallet-outline', color: '#4ECC8B', bg: '#D1F2E3', route: '/(chauffeur)/gains', badge: 0 },
                { label: 'Abonnement', icon: 'ribbon-outline', color: '#8B5CF6', bg: '#EDE9FE', route: '/(chauffeur)/abonnement', badge: 0 },
                { label: 'Profil', icon: 'person-outline', color: '#6B7280', bg: '#F3F4F6', route: '/(chauffeur)/profil', badge: 0 },
              ] as const).map((a) => (
                <TouchableOpacity key={a.label} style={s.actionCard} onPress={() => router.push(a.route as any)}>
                  <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
                    <Ionicons name={a.icon} size={22} color={a.color} />
                    {a.badge > 0 && (
                      <View style={s.actionBadge}>
                        <Text style={s.actionBadgeText}>{a.badge > 9 ? '9+' : a.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
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
          </View>
        </ScrollView>
      </SafeAreaView>


    </View>
  );
}

const HERO_BG = '#121212';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: HERO_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: HERO_BG,
  },
  logo: { width: 72, height: 23, tintColor: '#FFFFFF' },
  headerSpacer: { width: 40, height: 40 },
  scrollContent: { flexGrow: 1 },

  // Hero
  heroOverscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: HERO_BG },
  hero: { backgroundColor: HERO_BG, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'capitalize' },
  driverNameText: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: '#FFFFFF', marginTop: 6, letterSpacing: -0.8 },
  connectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connGreen: { backgroundColor: '#4ECC8B' },
  connRed: { backgroundColor: '#EF4444' },
  connText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  heroBody: { flexDirection: 'row', alignItems: 'stretch', gap: 14, marginTop: 22 },
  earningsBox: { flex: 1, justifyContent: 'center' },
  earningsLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  earningsLinkText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  dashboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#4ECC8B', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    transform: [{ translateY: 4 }],
  },
  dashboardBtnText: { fontSize: 12, fontWeight: '800', color: '#121212' },
  earningsLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  earningsValueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  earningsValue: { fontSize: 36, fontWeight: '800', color: '#4ECC8B', letterSpacing: -1, marginTop: 2 },
  earningsArrow: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#4ECC8B',
    justifyContent: 'center', alignItems: 'center',
  },

  // Stats
  statsCol: { width: 148, gap: 8 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999,
    paddingVertical: 8, paddingLeft: 8, paddingRight: 10,
  },
  statChipIcon: {
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  statChipValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  statChipLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  // Feuille blanche
  sheet: {
    flexGrow: 1, backgroundColor: '#FFFFFF', marginTop: -24,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 40,
  },

  // À traiter
  todoSection: { marginHorizontal: 20, marginTop: 14, gap: 8 },
  todoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  todoWarn: { backgroundColor: '#FFFBEB' },
  todoDanger: { backgroundColor: '#FEF2F2' },
  todoInfo: { backgroundColor: '#EFF6FF' },
  todoText: { flex: 1, fontSize: 13, fontWeight: '700' },

  // Blocs agenda / prochaines locations / flotte
  blockSection: {
    marginHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  blockCount: {
    fontSize: 12, fontWeight: '800', color: '#16A34A',
    backgroundColor: '#E8F8F0', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  blockLink: { fontSize: 13, fontWeight: '700', color: '#4ECC8B' },
  blockEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  blockEmptyText: { fontSize: 13, color: '#9CA3AF' },
  agendaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
  },
  agendaRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF0F2' },
  agendaIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  agendaKind: { fontSize: 12, fontWeight: '700' },
  agendaTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 1 },
  agendaSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  agendaCall: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
  },
  dateChip: {
    width: 44, paddingVertical: 5, borderRadius: 12, backgroundColor: '#F0FBF5', alignItems: 'center',
  },
  dateChipDay: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', lineHeight: 19 },
  dateChipMonth: { fontSize: 10, fontWeight: '800', color: '#16A34A', textTransform: 'uppercase' },
  upcomingPrice: { fontSize: 13, fontWeight: '800', color: '#1a1a1a' },
  fleetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
  },
  fleetAddBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#4ECC8B',
    justifyContent: 'center', alignItems: 'center',
  },

  // Incoming Section
  incomingSection: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.2 },
  sectionCount: {
    fontSize: 12, fontWeight: '800', color: '#16A34A',
    backgroundColor: '#E8F8F0', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },

  ordersBand: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  orderCard: {
    width: CARD_WIDTH, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  orderCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#121212',
    justifyContent: 'center', alignItems: 'center',
  },
  orderAvatarText: { fontSize: 16, fontWeight: '800', color: '#4ECC8B' },
  orderVehicle: { fontSize: 13, color: '#6B7280', fontWeight: '500', marginTop: 1 },
  orderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  orderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  orderChipText: { fontSize: 12, fontWeight: '700' },
  orderTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  orderTypeText: { fontSize: 12, fontWeight: '700', color: '#4ECC8B' },
  orderPrice: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.3 },
  orderPaymentBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginBottom: 10,
  },
  orderPaymentBadgeText: { fontSize: 12, fontWeight: '700' },
  orderClientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  orderClientName: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  orderLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  orderLocationText: { fontSize: 13, color: '#6B7280', flex: 1 },
  orderDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  orderDateText: { fontSize: 13, color: '#4ECC8B', fontWeight: '600' },
  cancelRequestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
  },
  cancelRequestText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#B45309' },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  declineBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 14, backgroundColor: '#4ECC8B',
  },
  acceptBtnText: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  btnDisabled: { opacity: 0.5 },

  // Offline
  offlineBand: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 18,
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
  actionsSection: { marginTop: 22, paddingHorizontal: 20 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  actionCard: {
    width: (width - 60) / 3, backgroundColor: '#F7F7F8', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  actionBadge: {
    position: 'absolute', top: -5, right: -7,
    backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18,
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
  },
  actionBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // Support
  supportCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB',
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
});
