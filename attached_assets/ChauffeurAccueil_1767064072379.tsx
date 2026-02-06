import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { Menu, MessageCircle, MapPin, Power, Phone, Users, Briefcase, Package, Clock, X, Eye, Check, Bell, BellOff, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import { useGoogleMaps, GOOGLE_MAPS_API_KEY } from "@/hooks/useGoogleMaps";
import { 
  disconnectSocket, 
  joinDriverSessionAsync, 
  updateDriverStatus,
  acceptOrder,
  declineOrder,
  onNewOrder,
  onPendingOrders,
  onOrderTaken,
  onOrderExpired,
  onOrderAcceptSuccess,
  onOrderAcceptError,
  isSocketConnected,
  emitDriverLocation
} from "@/lib/socket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { 
  isPushSupported, 
  isStandalonePWA, 
  registerServiceWorker,
  subscribeToPush,
  isSubscribedToPush,
  getNotificationPermission
} from "@/lib/pushNotifications";
import type { Order } from "@shared/schema";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";
import userMarkerIcon from "@assets/Icone acpp _1764076202750.png";
import iconCommandes from "@assets/7_1764076802813.png";
import iconPaiement from "@assets/6_1764076802813.png";
import iconDocuments from "@assets/8_1764076802813.png";
import iconContact from "@assets/10_1764076802814.png";

const defaultCenter = {
  lat: -17.5334,
  lng: -149.5667,
};

const mapStyles = [
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#a3ccff" }, { lightness: 20 }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }, { lightness: 20 }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }, { lightness: 17 }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }]
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 18 }]
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 16 }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#e8f0e8" }, { lightness: 21 }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#c5e8c5" }, { lightness: 21 }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#f2f2f2" }, { lightness: 19 }]
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#fefefe" }, { lightness: 17 }, { weight: 1.2 }]
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "on" }, { color: "#ffffff" }, { lightness: 16 }]
  },
  {
    featureType: "all",
    elementType: "labels.text.fill",
    stylers: [{ saturation: 36 }, { color: "#666666" }, { lightness: 40 }]
  },
  {
    featureType: "all",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  }
];

const categories = [
  { id: "commandes", label: "Commandes", iconImage: iconCommandes, href: "/chauffeur/courses" },
  { id: "paiement", label: "Paiement", iconImage: iconPaiement, href: "/chauffeur/gains" },
  { id: "documents", label: "Documents", iconImage: iconDocuments, href: "/chauffeur/documents" },
  { id: "contact", label: "Contact", iconImage: iconContact, href: "/chauffeur/support" },
];

const menuItems = [
  { label: "Mon profil", href: "/chauffeur/profil" },
  { label: "Mes courses", href: "/chauffeur/courses" },
  { label: "Mes gains", href: "/chauffeur/gains" },
  { label: "Aide", href: "/chauffeur/aide" },
  { label: "Déconnexion", href: "/", isLogout: true },
];

interface MapComponentProps {
  showRoute?: boolean;
  routeOrigin?: string;
  routeDestination?: string;
  onRouteCalculated?: (result: google.maps.DirectionsResult) => void;
}

function MapComponent({ showRoute, routeOrigin, routeDestination, onRouteCalculated }: MapComponentProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    if (!permissionAsked) {
      setPermissionAsked(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            map.setCenter({ lat: latitude, lng: longitude });
            map.setZoom(15);
          },
          (error) => {
            console.log("Localisation refusée ou indisponible:", error.message);
            setUserLocation(defaultCenter);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      } else {
        setUserLocation(defaultCenter);
      }
    }
  }, [permissionAsked]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate route when showRoute is true
  useEffect(() => {
    if (isLoaded && showRoute && routeOrigin && routeDestination && map) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: routeOrigin,
          destination: routeDestination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            if (onRouteCalculated) {
              onRouteCalculated(result);
            }
            // Fit bounds to show the entire route
            const bounds = new google.maps.LatLngBounds();
            result.routes[0].legs[0].steps.forEach((step) => {
              bounds.extend(step.start_location);
              bounds.extend(step.end_location);
            });
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
          }
        }
      );
    } else if (!showRoute) {
      setDirections(null);
    }
  }, [isLoaded, showRoute, routeOrigin, routeDestination, map, onRouteCalculated]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center p-4">
        <MapPin className="w-16 h-16 text-blue-500 mb-4" />
        <p className="text-[#5c5c5c] text-sm text-center font-medium">
          Clé API Google Maps manquante
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center p-4">
        <MapPin className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-[#5c5c5c] text-sm text-center font-medium">
          Erreur lors du chargement de la carte
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#ffdf6d] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#5c5c5c] text-sm text-center font-medium">
          Chargement de la carte...
        </p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={userLocation || defaultCenter}
      zoom={14}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        styles: mapStyles,
      }}
    >
      {userLocation && !directions && (
        <Marker
          position={userLocation}
          icon={{
            url: userMarkerIcon,
            scaledSize: new google.maps.Size(50, 50),
            anchor: new google.maps.Point(25, 25),
          }}
        />
      )}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: "#ffdf6d",
              strokeWeight: 5,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}

export function ChauffeurAccueil() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Order notification state
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    // Initialize from sessionStorage for persistent active ride detection
    return sessionStorage.getItem("driverSessionId");
  });
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  // Check for active ride
  const { data: activeOrderData } = useQuery<{ hasActiveOrder: boolean; order?: Order }>({
    queryKey: ['/api/orders/active/driver', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/active/driver?sessionId=${sessionId}`);
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 5000,
  });

  // Store active ride in sessionStorage for later access
  useEffect(() => {
    if (activeOrderData?.hasActiveOrder && activeOrderData.order) {
      sessionStorage.setItem("acceptedOrder", JSON.stringify(activeOrderData.order));
    } else if (activeOrderData && !activeOrderData.hasActiveOrder) {
      // No active order for this authenticated driver - clear stale sessionStorage
      // This prevents "phantom orders" from appearing
      console.log("[ChauffeurAccueil] No active order for authenticated driver - clearing stale sessionStorage");
      sessionStorage.removeItem("acceptedOrder");
      sessionStorage.removeItem("courseStep");
    }
  }, [activeOrderData]);

  // Derive current order from pendingOrders array with bounds checking
  const safeIndex = Math.min(currentOrderIndex, Math.max(0, pendingOrders.length - 1));
  const currentOrder = pendingOrders.length > 0 ? pendingOrders[safeIndex] : null;

  // Navigate between pending orders
  const goToNextOrder = useCallback(() => {
    if (pendingOrders.length > 1) {
      setCurrentOrderIndex(prev => (prev + 1) % pendingOrders.length);
      setShowRoutePreview(false);
    }
  }, [pendingOrders.length]);

  const goToPreviousOrder = useCallback(() => {
    if (pendingOrders.length > 1) {
      setCurrentOrderIndex(prev => prev === 0 ? pendingOrders.length - 1 : prev - 1);
      setShowRoutePreview(false);
    }
  }, [pendingOrders.length]);

  // Get driver info from session storage
  const getDriverInfo = useCallback(() => {
    try {
      const driverInfoStr = sessionStorage.getItem("driverInfo");
      if (driverInfoStr) {
        return JSON.parse(driverInfoStr);
      }
    } catch (e) {
      console.error("Failed to parse driver info:", e);
    }
    return null;
  }, []);

  // Retry connection handler
  const retryConnection = useCallback(async () => {
    setConnectionError(null);
    setIsSessionReady(false);
    
    try {
      const existingSessionId = sessionStorage.getItem("driverSessionId");
      let sessionIdToUse: string = existingSessionId || "";
      
      // If no existing session, create one with real driver info
      if (!sessionIdToUse) {
        const driverInfo = getDriverInfo();
        const driverId = driverInfo?.id || "driver-001";
        const driverName = driverInfo ? `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim() : "Chauffeur";
        
        const response = await apiRequest("POST", "/api/driver-sessions", {
          driverId,
          driverName
        });
        
        if (!response.ok) {
          throw new Error("Failed to create driver session");
        }
        
        const data = await response.json();
        sessionIdToUse = data.session.id as string;
        sessionStorage.setItem("driverSessionId", sessionIdToUse);
        // Also store driverId for persistent order history access
        if (driverId && driverId !== "driver-001") {
          sessionStorage.setItem("driverId", driverId);
        }
      }
      
      setSessionId(sessionIdToUse);
      
      // Try to join socket session
      const joined = await joinDriverSessionAsync(sessionIdToUse);
      
      if (joined) {
        setIsSessionReady(true);
        console.log("Driver session connected:", sessionIdToUse);
      } else {
        setConnectionError("Connexion impossible. Appuyez pour réessayer.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionError("Erreur de connexion. Appuyez pour réessayer.");
    }
  }, [getDriverInfo]);

  // Initialize driver session and socket connection
  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    if (!isAuth) {
      setLocation("/chauffeur-login");
      return;
    }

    let mounted = true;

    const initSession = async () => {
      try {
        setConnectionError(null);
        
        // Try to reuse existing session from sessionStorage
        const existingSessionId = sessionStorage.getItem("driverSessionId");
        let sessionIdToUse: string = existingSessionId || "";
        
        // If no existing session, create a new one via REST API with real driver info
        if (!sessionIdToUse) {
          const driverInfoStr = sessionStorage.getItem("driverInfo");
          let driverId = "driver-001";
          let driverName = "Chauffeur";
          
          if (driverInfoStr) {
            try {
              const driverInfo = JSON.parse(driverInfoStr);
              driverId = driverInfo.id || "driver-001";
              driverName = `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim() || "Chauffeur";
            } catch (e) {
              console.error("Failed to parse driver info:", e);
            }
          }
          
          const response = await apiRequest("POST", "/api/driver-sessions", {
            driverId,
            driverName
          });
          
          if (!response.ok) {
            throw new Error("Failed to create driver session");
          }
          
          const data = await response.json();
          sessionIdToUse = data.session.id as string;
          sessionStorage.setItem("driverSessionId", sessionIdToUse);
          // Also store driverId for persistent order history access
          if (driverId && driverId !== "driver-001") {
            sessionStorage.setItem("driverId", driverId);
          }
        }
        
        if (!mounted) return;
        
        setSessionId(sessionIdToUse);
        
        // Now connect socket and join session (awaiting connection)
        const joined = await joinDriverSessionAsync(sessionIdToUse);
        
        if (!mounted) return;
        
        if (joined) {
          setIsSessionReady(true);
          console.log("Driver session fully initialized:", sessionIdToUse);
        } else {
          // Session expired or invalid, create a new one with real driver info
          const driverInfoStr = sessionStorage.getItem("driverInfo");
          let retryDriverId = "driver-001";
          let retryDriverName = "Chauffeur";
          
          if (driverInfoStr) {
            try {
              const driverInfo = JSON.parse(driverInfoStr);
              retryDriverId = driverInfo.id || "driver-001";
              retryDriverName = `${driverInfo.firstName || ''} ${driverInfo.lastName || ''}`.trim() || "Chauffeur";
            } catch (e) {
              console.error("Failed to parse driver info:", e);
            }
          }
          
          const response = await apiRequest("POST", "/api/driver-sessions", {
            driverId: retryDriverId,
            driverName: retryDriverName
          });
          
          if (response.ok) {
            const data = await response.json();
            const newSessionId = data.session.id;
            sessionStorage.setItem("driverSessionId", newSessionId);
            // Also store driverId for persistent order history access
            if (retryDriverId && retryDriverId !== "driver-001") {
              sessionStorage.setItem("driverId", retryDriverId);
            }
            setSessionId(newSessionId);
            
            const retryJoin = await joinDriverSessionAsync(newSessionId);
            if (retryJoin) {
              setIsSessionReady(true);
              console.log("Driver session created and connected:", newSessionId);
            } else {
              setConnectionError("Connexion impossible. Appuyez pour réessayer.");
            }
          } else {
            setConnectionError("Connexion impossible. Appuyez pour réessayer.");
          }
        }
      } catch (error) {
        console.error("Error initializing driver session:", error);
        if (mounted) {
          setConnectionError("Erreur de connexion. Appuyez pour réessayer.");
        }
      }
    };

    initSession();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [setLocation]);

  // Socket event listeners
  useEffect(() => {
    if (!sessionId || !isSessionReady) return;

    const unsubNewOrder = onNewOrder((order) => {
      console.log("New order received:", order);
      setPendingOrders(prev => {
        // Check if order already exists to prevent duplicates
        if (prev.some(o => o.id === order.id)) {
          return prev;
        }
        return [...prev, order];
      });
    });

    const unsubPendingOrders = onPendingOrders((orders) => {
      console.log("Pending orders received:", orders);
      setPendingOrders(orders);
      setCurrentOrderIndex(0);
    });

    const unsubOrderTaken = onOrderTaken(({ orderId }) => {
      console.log("Order taken by another driver:", orderId);
      setPendingOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === orderId);
        const filtered = prev.filter(o => o.id !== orderId);
        
        // Adjust index using functional update to capture latest state
        if (orderIndex !== -1) {
          setCurrentOrderIndex(currentIdx => {
            if (orderIndex < currentIdx) {
              return Math.max(0, currentIdx - 1);
            } else if (orderIndex === currentIdx && currentIdx >= filtered.length) {
              return Math.max(0, filtered.length - 1);
            }
            return currentIdx;
          });
        }
        return filtered;
      });
      setShowRoutePreview(false);
    });

    const unsubOrderExpired = onOrderExpired(({ orderId }) => {
      console.log("Order expired:", orderId);
      setPendingOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === orderId);
        const filtered = prev.filter(o => o.id !== orderId);
        
        // Adjust index using functional update to capture latest state
        if (orderIndex !== -1) {
          setCurrentOrderIndex(currentIdx => {
            if (orderIndex < currentIdx) {
              return Math.max(0, currentIdx - 1);
            } else if (orderIndex === currentIdx && currentIdx >= filtered.length) {
              return Math.max(0, filtered.length - 1);
            }
            return currentIdx;
          });
        }
        return filtered;
      });
      setShowRoutePreview(false);
    });

    const unsubAcceptSuccess = onOrderAcceptSuccess((order) => {
      console.log("Order accepted successfully:", order);
      setIsAccepting(false);
      setPendingOrders([]);
      setCurrentOrderIndex(0);
      setShowRoutePreview(false);
      // Store accepted order for course-en-cours page
      sessionStorage.setItem("acceptedOrder", JSON.stringify(order));
      // Navigate to course en cours
      setLocation("/chauffeur/course-en-cours");
    });

    const unsubAcceptError = onOrderAcceptError(({ message }) => {
      console.error("Order accept error:", message);
      setIsAccepting(false);
      alert(message);
    });

    return () => {
      unsubNewOrder();
      unsubPendingOrders();
      unsubOrderTaken();
      unsubOrderExpired();
      unsubAcceptSuccess();
      unsubAcceptError();
    };
  }, [sessionId, isSessionReady, setLocation]);

  // Update driver online status when toggle changes
  useEffect(() => {
    if (sessionId && isSessionReady) {
      updateDriverStatus(sessionId, isActive);
      console.log("Driver status updated:", isActive ? "online" : "offline");
    }
  }, [isActive, sessionId, isSessionReady]);

  // Initialize push notifications support check
  useEffect(() => {
    const checkPushSupport = async () => {
      // Check if push is supported and if we're in standalone PWA mode
      const supported = isPushSupported();
      const standalone = isStandalonePWA();
      const permission = getNotificationPermission();
      
      console.log("[PUSH] Support check - supported:", supported, "standalone:", standalone, "permission:", permission);
      
      // Push only works when installed as PWA on iOS
      setPushSupported(supported && standalone);
      
      // Register service worker
      if (supported) {
        await registerServiceWorker();
      }
      
      // Check if already subscribed
      if (supported && standalone) {
        const subscribed = await isSubscribedToPush();
        setPushSubscribed(subscribed);
        
        // Show prompt if not subscribed yet and permission not denied
        if (!subscribed && permission !== 'denied') {
          setShowPushPrompt(true);
        }
      }
    };
    
    checkPushSupport();
  }, []);

  // Handle push notification subscription
  const handleEnablePush = async () => {
    if (!sessionId) return;
    
    setPushLoading(true);
    try {
      // Use sessionId for authenticated subscription (server extracts driverId from session)
      const success = await subscribeToPush(sessionId);
      if (success) {
        setPushSubscribed(true);
        setShowPushPrompt(false);
        console.log("[PUSH] Successfully subscribed to notifications");
      } else {
        console.error("[PUSH] Failed to subscribe");
        alert("Impossible d'activer les notifications. Vérifiez que vous avez ajouté l'application sur votre écran d'accueil.");
      }
    } catch (error) {
      console.error("[PUSH] Error subscribing:", error);
    } finally {
      setPushLoading(false);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      setScrollProgress(progress);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("chauffeurAuth");
    sessionStorage.removeItem("driverSessionId");
    disconnectSocket();
    setMenuOpen(false);
    setLocation("/");
  };

  const handleMenuClick = (item: typeof menuItems[0]) => {
    if (item.isLogout) {
      handleLogout();
    } else {
      setMenuOpen(false);
    }
  };

  const handleCategoryClick = (category: typeof categories[0]) => {
    setSelectedCategory(category.id);
    setLocation(category.href);
  };

  const handleAcceptOrder = () => {
    if (currentOrder && sessionId) {
      setIsAccepting(true);
      const orderId = currentOrder.id;
      const sid = sessionId;
      
      // Accept order first, then send GPS position after a short delay
      acceptOrder(orderId, sid);
      
      // Get GPS position and send after acceptance is processed
      setTimeout(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              emitDriverLocation(
                orderId,
                sid,
                position.coords.latitude,
                position.coords.longitude,
                0,
                position.coords.speed || undefined
              );
              console.log("[GPS] Sent immediate position after order accept");
            },
            () => {
              console.log("[GPS] Could not get immediate position");
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        }
      }, 200); // Small delay to ensure order is accepted first
    }
  };

  const handleDeclineOrder = () => {
    if (currentOrder && sessionId) {
      const orderIdToDecline = currentOrder.id;
      declineOrder(orderIdToDecline, sessionId);
      
      // Remove current order and adjust index using functional update
      setPendingOrders(prev => {
        const orderIndex = prev.findIndex(o => o.id === orderIdToDecline);
        const filtered = prev.filter(o => o.id !== orderIdToDecline);
        
        // Adjust index using functional update to capture latest state
        if (orderIndex !== -1 && filtered.length > 0) {
          setCurrentOrderIndex(currentIdx => {
            if (orderIndex < currentIdx) {
              return currentIdx - 1;
            } else if (currentIdx >= filtered.length) {
              return filtered.length - 1;
            }
            return currentIdx;
          });
        } else if (filtered.length === 0) {
          setCurrentOrderIndex(0);
        }
        return filtered;
      });
      setShowRoutePreview(false);
    }
  };

  const handleCallClient = () => {
    if (currentOrder) {
      window.location.href = `tel:${currentOrder.clientPhone}`;
    }
  };

  const getPickupAddress = () => {
    if (!currentOrder) return "";
    const pickup = currentOrder.addresses.find(a => a.type === "pickup");
    return pickup?.value || "";
  };

  const getDestinationAddress = () => {
    if (!currentOrder) return "";
    const destination = currentOrder.addresses.find(a => a.type === "destination");
    return destination?.value || "";
  };

  const formatScheduledTime = (time: string | null) => {
    if (!time) return null;
    try {
      const date = new Date(time);
      return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return time;
    }
  };

  return (
    <div 
      className="relative w-full max-w-[420px] mx-auto bg-white overflow-hidden"
      style={{ height: "100dvh" }}
    >
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button 
              size="icon" 
              className="bg-[#ffdf6d]/90 hover:bg-[#ffdf6d] rounded-full w-10 h-10 shadow-md"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5 text-[#343434]" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-gradient-to-b from-white to-gray-50/80 z-50 border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu Chauffeur</SheetTitle>
              <SheetDescription>
                Menu de navigation chauffeur
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-3 mt-4 mb-6 px-2">
              <div className="w-12 h-12 bg-[#343434] rounded-full flex items-center justify-center">
                <Power className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[#343434] font-bold">Mode Chauffeur</p>
                <p className={`text-sm ${isActive ? 'text-green-500' : 'text-[#8c8c8c]'}`}>
                  {isActive ? 'En service' : 'Hors service'}
                </p>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.isLogout ? "/" : item.href}>
                  <div
                    className={`group relative w-full py-4 px-2 cursor-pointer transition-all duration-200 ${item.isLogout ? 'mt-4' : ''}`}
                    onClick={() => handleMenuClick(item)}
                    data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className={`font-light text-lg tracking-wide transition-colors ${item.isLogout ? 'text-red-500 group-hover:text-red-600' : 'text-[#3a3a3a] group-hover:text-[#1a1a1a]'}`}>
                      {item.label}
                    </span>
                    <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-gray-200 via-gray-300 to-transparent opacity-60" />
                    <div className={`absolute inset-0 rounded-lg transition-colors duration-200 ${item.isLogout ? 'bg-red-500/0 group-hover:bg-red-500/10' : 'bg-[#ffdf6d]/0 group-hover:bg-[#ffdf6d]/10'}`} />
                  </div>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex justify-center">
          <img 
            src={logoImage} 
            alt="TĀPE'A" 
            className="h-[75px] w-auto object-contain drop-shadow-md"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
          />
        </div>

        <Link href="/chauffeur/support">
          <Button 
            size="icon" 
            className="bg-[#ff6b6b] hover:bg-[#ff5252] rounded-full w-10 h-10 shadow-md"
            data-testid="button-support"
            title="Contacter le support"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </Button>
        </Link>
      </header>

      <div className="absolute top-20 left-0 right-0 z-10">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide touch-pan-x px-4"
          style={{ marginLeft: '-8px', marginRight: '-8px', paddingLeft: '20px', paddingRight: '20px' }}
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border-0 shadow-md transition-colors ${
                  isSelected 
                    ? "text-[#5c5c5c]" 
                    : "text-white"
                }`}
                style={{
                  backgroundColor: isSelected 
                    ? "rgba(255, 223, 109, 1)" 
                    : "rgba(0, 0, 0, 0.40)"
                }}
                onClick={() => handleCategoryClick(category)}
                data-testid={`button-category-${category.id}`}
              >
                <img 
                  src={category.iconImage} 
                  alt={category.label}
                  className="w-6 h-6 object-contain"
                />
                <span className={`font-medium text-sm ${isSelected ? "text-[#5c5c5c]" : "text-white"}`}>{category.label}</span>
              </button>
            );
          })}
        </div>
        <div className="relative h-1 mx-12 mt-1">
          <div className="absolute inset-0 bg-black/10 rounded-full" />
          <div 
            className="absolute top-0 left-0 h-full bg-black/30 rounded-full transition-all duration-150"
            style={{ 
              width: '30%',
              left: `${scrollProgress * 70}%`
            }}
          />
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        <MapComponent 
          showRoute={showRoutePreview}
          routeOrigin={getPickupAddress()}
          routeDestination={getDestinationAddress()}
        />
      </div>

      {/* Connection error banner with retry */}
      {connectionError && (
        <button
          onClick={retryConnection}
          className="absolute top-20 left-4 right-4 z-40 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg hover-elevate active-elevate-2"
          data-testid="button-retry-connection"
        >
          <p className="text-sm text-center">{connectionError}</p>
        </button>
      )}

      {/* Order notification popup */}
      {currentOrder && isActive && (
        <div className="absolute inset-x-0 top-32 bottom-24 z-30 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm bg-white shadow-2xl rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#ffdf6d] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[#343434]" />
                </div>
                <div>
                  <p className="font-bold text-[#343434]">Nouvelle course</p>
                  {pendingOrders.length > 1 && (
                    <p className="text-xs text-[#5c5c5c]">
                      Course {safeIndex + 1}/{pendingOrders.length}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {pendingOrders.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8"
                      onClick={goToPreviousOrder}
                      data-testid="button-prev-order"
                    >
                      <span className="text-[#343434] text-lg">&lt;</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8"
                      onClick={goToNextOrder}
                      data-testid="button-next-order"
                    >
                      <span className="text-[#343434] text-lg">&gt;</span>
                    </Button>
                  </>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8"
                  onClick={handleDeclineOrder}
                  data-testid="button-close-order"
                >
                  <X className="w-4 h-4 text-[#343434]" />
                </Button>
              </div>
            </div>

            {/* Order details */}
            <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
              {/* Client info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#5c5c5c]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#343434]">{currentOrder.clientName}</p>
                    <p className="text-xs text-[#8c8c8c]">{currentOrder.passengers} passager(s)</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  className="bg-green-500 hover:bg-green-600 rounded-full"
                  onClick={handleCallClient}
                  data-testid="button-call-client"
                >
                  <Phone className="w-4 h-4 text-white" />
                </Button>
              </div>

              {/* Scheduled time if advance booking */}
              {currentOrder.isAdvanceBooking && currentOrder.scheduledTime && (
                <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-sm text-blue-700">
                    Réservation: {formatScheduledTime(currentOrder.scheduledTime)}
                  </p>
                </div>
              )}

              {/* Route */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                  <p className="text-sm text-[#343434] flex-1">{getPickupAddress()}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                  <p className="text-sm text-[#343434] flex-1">{getDestinationAddress()}</p>
                </div>
              </div>

              {/* Distance & duration */}
              {currentOrder.routeInfo && (
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentOrder.routeInfo.distance.toFixed(1)} km
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {currentOrder.routeInfo.duration}
                  </Badge>
                </div>
              )}

              {/* Supplements */}
              {currentOrder.supplements.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#8c8c8c]">Suppléments</p>
                  <div className="flex flex-wrap gap-2">
                    {currentOrder.supplements.map((supp) => (
                      <Badge key={supp.id} variant="outline" className="text-xs">
                        {supp.icon === "bagages" && <Briefcase className="w-3 h-3 mr-1" />}
                        {supp.icon === "encombrants" && <Package className="w-3 h-3 mr-1" />}
                        {supp.name} x{supp.quantity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Price breakdown */}
              <div className="bg-[#343434] rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Prix total</span>
                  <span className="text-white font-medium">{currentOrder.totalPrice.toLocaleString()} XPF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Votre gain</span>
                  <span className="text-[#ffdf6d] font-bold">{currentOrder.driverEarnings.toLocaleString()} XPF</span>
                </div>
              </div>

              {/* View route button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowRoutePreview(!showRoutePreview)}
                data-testid="button-view-route"
              >
                <Eye className="w-4 h-4 mr-2" />
                {showRoutePreview ? "Masquer le trajet" : "Visualiser le trajet"}
              </Button>
            </div>

            {/* Action buttons */}
            <div className="p-4 pt-0 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-500 hover:bg-red-50"
                onClick={handleDeclineOrder}
                disabled={isAccepting}
                data-testid="button-decline-order"
              >
                Refuser
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                onClick={handleAcceptOrder}
                disabled={isAccepting}
                data-testid="button-accept-order"
              >
                {isAccepting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accepter
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-white px-4 py-5 pb-6 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Active ride banner */}
          {activeOrderData?.hasActiveOrder && activeOrderData.order && (
            <button
              onClick={() => setLocation("/chauffeur/course-en-cours")}
              className="w-full mb-4 flex items-center gap-3 bg-[#ffdf6d] hover:bg-[#f5d55c] rounded-xl px-4 py-3 shadow-md transition-colors"
              data-testid="button-active-ride"
            >
              <div className="bg-white/80 rounded-full p-2">
                <Car className="w-5 h-5 text-[#343434]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[#343434] font-semibold text-sm">Course en cours</p>
                <p className="text-[#5c5c5c] text-xs">
                  {activeOrderData.order.status === "accepted" && "En route vers le client"}
                  {activeOrderData.order.status === "driver_arrived" && "Vous êtes arrivé"}
                  {activeOrderData.order.status === "in_progress" && "Course en cours"}
                  {activeOrderData.order.status === "payment_pending" && "Paiement en attente"}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#343434]" />
            </button>
          )}
          
          {/* Push notification prompt for iOS PWA */}
          {showPushPrompt && pushSupported && !pushSubscribed && (
            <div className="mb-4 p-3 bg-[#fff8e1] rounded-xl border border-[#ffdf6d]/30">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#ffdf6d] rounded-full flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-[#343434]" />
                  </div>
                  <div>
                    <p className="text-[#343434] font-medium text-sm">Activer les notifications</p>
                    <p className="text-[#8c8c8c] text-xs">Recevez une alerte pour chaque nouvelle course</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  disabled={pushLoading}
                  className="bg-[#ffdf6d] hover:bg-[#ffd94d] text-[#343434] flex-shrink-0"
                  data-testid="button-enable-push"
                >
                  {pushLoading ? (
                    <div className="w-4 h-4 border-2 border-[#343434] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Activer"
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Push subscribed indicator */}
          {pushSubscribed && (
            <div className="mb-4 p-2 bg-green-50 rounded-lg flex items-center gap-2">
              <Bell className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Notifications activées</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <Power className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-[#343434] font-bold text-base">
                  {isActive ? 'Vous êtes en service' : 'Vous êtes hors service'}
                </p>
                <p className="text-[#8c8c8c] text-sm">
                  {isActive ? 'Prêt à recevoir des courses' : 'Activez pour recevoir des courses'}
                </p>
              </div>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              className="data-[state=checked]:bg-green-500"
              data-testid="switch-active"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
