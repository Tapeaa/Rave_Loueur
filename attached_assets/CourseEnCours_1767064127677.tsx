import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, MapPin, ArrowRight, X, Car, Clock, Check, CreditCard, Navigation, Loader2 } from "lucide-react";
import { GoogleMap, DirectionsRenderer, Marker, OverlayView } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "wouter";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";
import clientMarkerIcon from "@assets/Icone_acpp_-2_1766882961135.png";
import {
  connectSocket,
  joinClientSession,
  joinRideRoom,
  onRideStatusChanged,
  onPaymentStatus,
  onRideCancelled,
  cancelRide,
  emitClientLocation,
  onDriverLocationUpdate,
  calculateHeading,
  LocationUpdate,
  retryPayment,
  switchToCashPayment,
  onPaymentRetryReady,
  onPaymentSwitchedToCash
} from "@/lib/socket";
import driverCarIcon from "@assets/Icone_acpp_-2_copie_1766883461028.png";
import { ThankYouModal } from "@/components/ThankYouModal";
import { PaymentResultModal } from "@/components/PaymentResultModal";

const menuItems = [
  { label: "Accueil", href: "/" },
  { label: "Mon profil", href: "/profil" },
  { label: "Mes commandes", href: "/commandes" },
  { label: "Mon wallet", href: "/wallet" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Aide", href: "/aide" },
];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapStyles = [
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#a8d4e6" }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  }
];

interface CourseData {
  orderId: string;
  pickup: string;
  destination: string;
  totalPrice: number;
  distance: string;
  duration: string;
  driverName: string;
  driverVehicle: string;
  driverPlate: string;
  driverPhoto: string;
  passengers: number;
  luggage: number;
  scheduledDate: string;
  estimatedArrival: string;
}

export function CourseEnCours() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [driverToPickupDirections, setDriverToPickupDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [driverToDestinationDirections, setDriverToDestinationDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [rideStatus, setRideStatus] = useState<"enroute" | "arrived" | "inprogress" | "completed">("enroute");
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showPaymentResult, setShowPaymentResult] = useState(false);
  const [paymentResultData, setPaymentResultData] = useState<{
    status: "success" | "failed";
    amount: number;
    paymentMethod?: "card" | "cash";
    cardBrand?: string | null;
    cardLast4?: string | null;
    errorMessage?: string;
  } | null>(null);
  const [clientLocation, setClientLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [driverLocation, setDriverLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [driverETA, setDriverETA] = useState<string>("");
  const mapRef = useRef<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastRouteUpdateRef = useRef<number>(0);
  // Stable camera lock: prevents jumping by waiting for first valid driver location
  const hasInitialDriverLock = useRef(false);
  const lastDriverLocationRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [orderNotFound, setOrderNotFound] = useState(false);
  
  const { isLoaded } = useGoogleMaps();

  // Continuous GPS tracking for client - send location to driver
  // This now depends on courseData so it works when order is loaded via API
  useEffect(() => {
    if (!navigator.geolocation || !courseData) return;
    
    const orderId = courseData.orderId;
    const clientToken = sessionStorage.getItem("clientToken");
    
    console.log("[GPS] Starting location tracking for order:", orderId);
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setClientLocation(newLocation);
        
        // Emit location to server (relayed to driver)
        if (orderId && clientToken) {
          emitClientLocation(orderId, clientToken, newLocation.lat, newLocation.lng);
        }
      },
      (error) => {
        console.log("Geolocation error:", error);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
    
    watchIdRef.current = watchId;
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [courseData]);

  useEffect(() => {
    const initializeOrder = async () => {
      let orderId = sessionStorage.getItem("currentOrderId");
      let pickup = sessionStorage.getItem("orderPickup");
      let destination = sessionStorage.getItem("orderDestination");
      let total = sessionStorage.getItem("orderTotal");
      let driverName = sessionStorage.getItem("assignedDriverName");
      let distance = sessionStorage.getItem("orderDistance") || "10 KM";
      let clientToken = sessionStorage.getItem("clientToken");
      
      // Track order status for payment_pending detection
      let orderStatus: string | null = null;
      
      // If no sessionStorage data, fetch active order from API
      if (!orderId) {
        console.log("[CourseEnCours] No sessionStorage data, fetching active order from API...");
        try {
          const res = await fetch("/api/orders/active/client", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            console.log("[CourseEnCours] Active order API response:", data);
            if (data.hasActiveOrder && data.order) {
              const order = data.order;
              orderId = order.id;
              clientToken = data.clientToken || null;
              orderStatus = order.status;
              
              // Extract pickup and destination from addresses array
              pickup = order.addresses?.find((a: { type: string; value: string }) => a.type === "pickup")?.value || "";
              destination = order.addresses?.find((a: { type: string; value: string }) => a.type === "destination")?.value || "";
              total = String(order.totalPrice ?? 0);
              distance = String(order.routeInfo?.distance || "10 KM");
              driverName = order.driverName || "";
              
              // Persist to sessionStorage for future use
              sessionStorage.setItem("currentOrderId", orderId!);
              if (clientToken) sessionStorage.setItem("clientToken", clientToken);
              if (pickup) sessionStorage.setItem("orderPickup", pickup);
              if (destination) sessionStorage.setItem("orderDestination", destination);
              sessionStorage.setItem("orderTotal", total);
              sessionStorage.setItem("orderDistance", distance);
              if (driverName) sessionStorage.setItem("assignedDriverName", driverName);
              if (orderStatus) sessionStorage.setItem("orderStatus", orderStatus);
              
              // Map order status to ride status
              const statusMap: Record<string, "enroute" | "arrived" | "inprogress" | "completed"> = {
                "accepted": "enroute",
                "driver_arrived": "arrived",
                "in_progress": "inprogress",
                "payment_pending": "completed",
              };
              const mappedStatus = (orderStatus && statusMap[orderStatus]) || "enroute";
              setRideStatus(mappedStatus);
              sessionStorage.setItem("clientRideStatus", mappedStatus);
              
              console.log("[CourseEnCours] Order data populated from API:", orderId, "status:", orderStatus);
            } else {
              console.log("[CourseEnCours] No active order found in API response");
              setOrderNotFound(true);
              setIsLoadingOrder(false);
              return;
            }
          } else {
            console.log("[CourseEnCours] API request failed:", res.status);
            setOrderNotFound(true);
            setIsLoadingOrder(false);
            return;
          }
        } catch (err) {
          console.log("[CourseEnCours] Failed to fetch active order:", err);
          setOrderNotFound(true);
          setIsLoadingOrder(false);
          return;
        }
      }

      if (!orderId) {
        setOrderNotFound(true);
        setIsLoadingOrder(false);
        return;
      }

      // Set initial course data
      setCourseData({
        orderId: orderId,
        pickup: pickup || "Point de départ",
        destination: destination || "Destination",
        totalPrice: parseInt(total || "3950"),
        distance: distance,
        duration: "13 Min",
        driverName: driverName || "Chauffeur",
        driverVehicle: "",
        driverPlate: "",
        driverPhoto: "",
        passengers: 2,
        luggage: 1,
        scheduledDate: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        estimatedArrival: "5"
      });
      
      setIsLoadingOrder(false);

      // Fetch full order details including driver info AND current status
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const orderData = await res.json();
          console.log("[CourseEnCours] Fetched order data:", orderData);
          
          // Update driver info
          if (orderData.driver) {
            console.log("[CourseEnCours] Driver info:", orderData.driver);
            const vehicleParts = [
              orderData.driver.vehicleModel,
              orderData.driver.vehicleColor
            ].filter(Boolean);
            const vehicleStr = vehicleParts.join(' ').trim();
            
            setCourseData(prev => prev ? {
              ...prev,
              driverName: orderData.driver.name || prev.driverName,
              driverVehicle: vehicleStr || prev.driverVehicle,
              driverPlate: orderData.driver.vehiclePlate || prev.driverPlate,
            } : prev);
          } else {
            console.log("[CourseEnCours] No driver info in order data");
          }
          
          // Check current order status - show payment modal if payment_pending
          const currentStatus = orderData.status;
          console.log("[CourseEnCours] Current order status:", currentStatus);
          sessionStorage.setItem("orderStatus", currentStatus || "");
          
          if (currentStatus === "payment_confirmed") {
            console.log("[CourseEnCours] Order has payment_confirmed status - showing success modal");
            setRideStatus("completed");
            sessionStorage.setItem("clientRideStatus", "completed");
            setPaymentConfirmed(true);
            setShowPaymentConfirm(false);
            setPaymentResultData({
              status: "success",
              amount: orderData.totalPrice || parseInt(total || "0"),
              paymentMethod: orderData.paymentMethod === "card" ? "card" : "cash",
            });
            setShowPaymentResult(true);
          } else if (currentStatus === "payment_pending" || currentStatus === "payment_failed") {
            console.log("[CourseEnCours] Order has payment issue status - showing payment retry modal");
            setRideStatus("completed");
            sessionStorage.setItem("clientRideStatus", "completed");
            
            setShowPaymentConfirm(false);
            setPaymentResultData({
              status: "failed",
              amount: orderData.totalPrice || parseInt(total || "0"),
              paymentMethod: "card",
              errorMessage: "Le paiement précédent a échoué. Veuillez réessayer.",
            });
            setShowPaymentResult(true);
          } else if (currentStatus) {
            // Map order status to ride status
            const statusMap: Record<string, "enroute" | "arrived" | "inprogress" | "completed"> = {
              "accepted": "enroute",
              "driver_arrived": "arrived",
              "in_progress": "inprogress",
              "completed": "completed",
            };
            const mappedStatus = statusMap[currentStatus] || "enroute";
            setRideStatus(mappedStatus);
            sessionStorage.setItem("clientRideStatus", mappedStatus);
          }
        }
      } catch (err) {
        console.log("Failed to fetch order details:", err);
      }
    };
    
    initializeOrder();
  }, [setLocation]);

  // Set up socket connections and polling when courseData is available
  useEffect(() => {
    if (!courseData) return;
    
    const currentOrderId = courseData.orderId;
    const storedClientToken = sessionStorage.getItem("clientToken");
    const socket = connectSocket();
    
    // Register GPS listener IMMEDIATELY before joining rooms
    console.log("[GPS] Registering location listener for order:", currentOrderId);
    socket.on("location:driver", (data: LocationUpdate) => {
      console.log("[GPS] Driver location received via WebSocket:", data);
      if (data.orderId === currentOrderId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
        if (data.heading !== undefined) {
          setDriverHeading(data.heading);
        }
      }
    });
    
    joinClientSession(currentOrderId, storedClientToken || undefined);
    joinRideRoom(currentOrderId, 'client', { clientToken: storedClientToken || undefined });
    
    // HTTP polling backup - fetch driver location frequently at start, then less often
    let pollCount = 0;
    const pollDriverLocation = async () => {
      try {
        const res = await fetch(`/api/orders/${currentOrderId}/driver-location`);
        if (res.ok) {
          const data = await res.json();
          if (data.hasLocation) {
            console.log("[GPS] Driver location received via HTTP:", data);
            setDriverLocation({ lat: data.lat, lng: data.lng });
            setDriverHeading(data.heading || 0);
          } else {
            console.log("[GPS] No driver location available yet, polling count:", pollCount);
          }
        }
      } catch (err) {
        console.log("[GPS] HTTP polling error:", err);
      }
      pollCount++;
    };
    
    // Start polling immediately and every 500ms for first 20 attempts, then every 2 seconds
    pollDriverLocation();
    const fastPollInterval = setInterval(() => {
      if (pollCount < 20) {
        pollDriverLocation();
      }
    }, 500);
    
    const slowPollInterval = setInterval(pollDriverLocation, 2000);
    
    // HTTP polling backup for ride status - WebSocket often fails on mobile Safari
    let lastKnownStatus = sessionStorage.getItem("clientRideStatus") || "enroute";
    let lastServerStatus = "";
    let paymentHandled = false;
    const pollRideStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${currentOrderId}`, { credentials: "include" });
        if (res.ok) {
          const orderData = await res.json();
          const serverStatus = orderData.status;
          console.log("[STATUS POLL] Order status from server:", serverStatus, "current local:", lastKnownStatus, "paymentHandled:", paymentHandled);
          
          // Handle payment_confirmed status - order is fully completed and paid
          if (serverStatus === "payment_confirmed" && !paymentHandled) {
            console.log("[STATUS POLL] Payment confirmed detected - showing success modal");
            paymentHandled = true;
            lastServerStatus = serverStatus;
            setIsPaymentProcessing(false);
            setPaymentConfirmed(true);
            setShowPaymentConfirm(false);
            setPaymentResultData({
              status: "success",
              amount: orderData.totalPrice || 0,
              paymentMethod: orderData.paymentMethod === "card" ? "card" : "cash",
            });
            setShowPaymentResult(true);
            return;
          }
          
          // Handle payment failure statuses - check if server status changed even if mapped status same
          if ((serverStatus === "payment_pending" || serverStatus === "payment_failed") && 
              lastServerStatus !== serverStatus && !paymentHandled) {
            console.log("[STATUS POLL] Payment failure detected - showing retry modal");
            lastServerStatus = serverStatus;
            setRideStatus("completed");
            sessionStorage.setItem("clientRideStatus", "completed");
            setShowPaymentConfirm(false);
            setPaymentResultData({
              status: "failed",
              amount: orderData.totalPrice || 0,
              paymentMethod: "card",
              errorMessage: "Le paiement a échoué. Veuillez réessayer.",
            });
            setShowPaymentResult(true);
            return;
          }
          
          // Map order status to ride status
          const statusMap: Record<string, "enroute" | "arrived" | "inprogress" | "completed"> = {
            "accepted": "enroute",
            "driver_arrived": "arrived",
            "in_progress": "inprogress",
            "completed": "completed",
            "payment_pending": "completed",
            "payment_failed": "completed",
          };
          
          const mappedStatus = statusMap[serverStatus];
          if (mappedStatus && mappedStatus !== lastKnownStatus) {
            console.log("[STATUS POLL] Status changed from", lastKnownStatus, "to", mappedStatus);
            lastKnownStatus = mappedStatus;
            lastServerStatus = serverStatus;
            setRideStatus(mappedStatus);
            sessionStorage.setItem("clientRideStatus", mappedStatus);
            
            // Show payment confirmation when ride is completed
            if (mappedStatus === "completed") {
              setShowPaymentConfirm(true);
            }
          }
        }
      } catch (err) {
        console.log("[STATUS POLL] Error polling status:", err);
      }
    };
    
    // Poll ride status every 3 seconds as WebSocket backup
    const statusPollInterval = setInterval(pollRideStatus, 3000);
    // Also poll immediately after a short delay
    setTimeout(pollRideStatus, 1000);
    
    // Restore ride status from sessionStorage if available
    const storedRideStatus = sessionStorage.getItem("clientRideStatus");
    if (storedRideStatus && ["enroute", "arrived", "inprogress", "completed"].includes(storedRideStatus)) {
      setRideStatus(storedRideStatus as "enroute" | "arrived" | "inprogress" | "completed");
      if (storedRideStatus === "completed") {
        setShowPaymentConfirm(true);
      }
    }
    
    return () => {
      socket.off("location:driver");
      clearInterval(fastPollInterval);
      clearInterval(slowPollInterval);
      clearInterval(statusPollInterval);
    };
  }, [courseData]);

  // Listen for ride status updates from driver
  useEffect(() => {
    if (!courseData) return;
    
    const unsubStatus = onRideStatusChanged((data) => {
      if (data.orderId === courseData.orderId) {
        console.log("Ride status changed:", data.status);
        setRideStatus(data.status);
        sessionStorage.setItem("clientRideStatus", data.status);
        
        // Update driver name if available
        if (data.driverName) {
          setCourseData(prev => prev ? { ...prev, driverName: data.driverName } : prev);
        }
        
        // Show payment confirmation when ride is completed
        if (data.status === "completed") {
          setShowPaymentConfirm(true);
        }
      }
    });

    const unsubPayment = onPaymentStatus((data) => {
      if (data.orderId === courseData.orderId) {
        console.log("[DEBUG] Payment status received:", data);
        
        // Payment is being processed by Stripe
        if (data.status === "payment_processing") {
          setIsPaymentProcessing(true);
        }
        
        // Payment confirmed by driver - show success modal
        if (data.confirmed && data.status === "payment_confirmed") {
          setIsPaymentProcessing(false);
          setPaymentConfirmed(true);
          setPaymentResultData({
            status: "success",
            amount: data.amount || courseData.totalPrice,
            paymentMethod: (data.paymentMethod as "card" | "cash") || "cash",
            cardBrand: data.cardBrand,
            cardLast4: data.cardLast4,
          });
          setShowPaymentConfirm(false);
          setShowPaymentResult(true);
        }
        
        // Payment failed/rejected by driver - show failure modal
        if (data.status === "payment_failed") {
          setIsPaymentProcessing(false);
          setPaymentResultData({
            status: "failed",
            amount: courseData.totalPrice,
            paymentMethod: (data.paymentMethod as "card" | "cash") || "cash",
            errorMessage: data.errorMessage || "Le paiement n'a pas pu être effectué",
          });
          setShowPaymentConfirm(false);
          setShowPaymentResult(true);
        }
      }
    });
    
    // Listen for ride cancellation
    const unsubCancelled = onRideCancelled((data) => {
      if (data.orderId === courseData.orderId) {
        console.log("[DEBUG] Ride cancelled:", data);
        alert(`Course annulée: ${data.reason}`);
        sessionStorage.removeItem("currentOrderId");
        sessionStorage.removeItem("orderTotal");
        sessionStorage.removeItem("orderPickup");
        sessionStorage.removeItem("orderDestination");
        sessionStorage.removeItem("assignedDriverName");
        sessionStorage.removeItem("assignedDriverId");
        sessionStorage.removeItem("clientToken");
        sessionStorage.removeItem("clientRideStatus");
        setLocation("/");
      }
    });

    return () => {
      unsubStatus();
      unsubPayment();
      unsubCancelled();
    };
  }, [courseData, setLocation]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
    console.log("[GPS] Map loaded and ready");
  }, []);

  // Calculate route from pickup to destination (shown during ride in progress)
  useEffect(() => {
    if (isLoaded && courseData) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: courseData.pickup,
          destination: courseData.destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            // Only fit bounds during "inprogress" status, not when waiting for driver GPS
            // During "enroute", the 3rd person view will center on driver when GPS arrives
            if (mapRef.current && result.routes[0]?.bounds && rideStatus === "inprogress") {
              mapRef.current.fitBounds(result.routes[0].bounds, {
                top: 50,
                bottom: 200,
                left: 30,
                right: 30
              });
            }
          }
        }
      );
    }
  }, [isLoaded, courseData, rideStatus]);

  // Reset map tracking state when ride status changes
  useEffect(() => {
    // Reset lock on status transitions to allow new camera snap
    hasInitialDriverLock.current = false;
    lastDriverLocationRef.current = null;
    console.log("[GPS] Status changed to:", rideStatus, "- resetting camera lock");
  }, [rideStatus]);

  // Follow driver with stable 3rd person view - lock camera on first GPS fix
  useEffect(() => {
    if (!driverLocation || !mapRef.current || !isMapReady) return;
    // Follow driver during all active ride stages (not completed)
    if (rideStatus === "completed") return;
    
    // Calculate distance from last known position to dedupe and prevent jitter
    const lastPos = lastDriverLocationRef.current;
    let shouldUpdate = true;
    if (lastPos) {
      const dist = Math.sqrt(
        Math.pow((driverLocation.lat - lastPos.lat) * 111000, 2) + 
        Math.pow((driverLocation.lng - lastPos.lng) * 111000 * Math.cos(driverLocation.lat * Math.PI / 180), 2)
      );
      // Only update if moved more than 3 meters (prevents HTTP polling duplicates)
      shouldUpdate = dist > 3;
    }
    
    if (!shouldUpdate && hasInitialDriverLock.current) return;
    
    // Store new position
    lastDriverLocationRef.current = driverLocation;
    
    // First time camera lock: snap directly to driver at zoom 17
    if (!hasInitialDriverLock.current) {
      console.log("[GPS] INITIAL LOCK: Snapping camera directly to driver:", driverLocation);
      // Use setOptions to set center and zoom in one call - no animation, instant snap
      mapRef.current.setOptions({
        center: driverLocation,
        zoom: 17
      });
      hasInitialDriverLock.current = true;
      return;
    }
    
    // Subsequent updates: smooth follow with panTo
    console.log("[GPS] Following driver smoothly:", driverLocation);
    mapRef.current.panTo(driverLocation);
    
    // Ensure zoom stays at 17 if user didn't manually zoom
    const currentZoom = mapRef.current.getZoom();
    if (currentZoom && currentZoom < 15) {
      mapRef.current.setZoom(17);
    }
  }, [driverLocation, rideStatus, isMapReady]);

  // Calculate route from driver to pickup (don't fit bounds - keep 3rd person view on driver)
  useEffect(() => {
    if (!isLoaded || !courseData || !driverLocation) return;
    if (rideStatus !== "enroute" && rideStatus !== "arrived") return;
    
    // Throttle route updates to every 10 seconds to avoid API quota issues
    const now = Date.now();
    if (now - lastRouteUpdateRef.current < 10000) return;
    lastRouteUpdateRef.current = now;
    
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: driverLocation,
        destination: courseData.pickup,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDriverToPickupDirections(result);
          // Update ETA
          const leg = result.routes[0]?.legs[0];
          if (leg?.duration?.text) {
            setDriverETA(leg.duration.text);
            setCourseData(prev => prev ? { ...prev, estimatedArrival: leg.duration?.text || "5" } : prev);
          }
          // Don't call fitBounds here - keep the 3rd person view focused on driver
        }
      }
    );
  }, [isLoaded, courseData, driverLocation, rideStatus]);

  // Calculate route from driver to destination during inprogress
  useEffect(() => {
    if (!isLoaded || !courseData || !driverLocation) return;
    if (rideStatus !== "inprogress") return;
    
    // Throttle route updates to every 10 seconds
    const now = Date.now();
    if (now - lastRouteUpdateRef.current < 10000) return;
    lastRouteUpdateRef.current = now;
    
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: driverLocation,
        destination: courseData.destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDriverToDestinationDirections(result);
          // Update ETA to destination
          const leg = result.routes[0]?.legs[0];
          if (leg?.duration?.text) {
            setDriverETA(leg.duration.text);
          }
        }
      }
    );
  }, [isLoaded, courseData, driverLocation, rideStatus]);

  const handleCall = () => {
    window.location.href = "tel:+68987000000";
  };

  const handleMessage = () => {
    setLocation("/support");
  };

  const handleCancel = () => {
    if (confirm("Êtes-vous sûr de vouloir annuler cette course ?")) {
      if (courseData) {
        const clientToken = sessionStorage.getItem("clientToken") || undefined;
        cancelRide(courseData.orderId, 'client', "Annulé par le client", { clientToken });
      }
      // The socket handler will clean up sessionStorage and redirect
    }
  };

  const getRideStatusMessage = () => {
    switch (rideStatus) {
      case "enroute":
        return driverETA ? `Arrivée dans ${driverETA}` : "Votre chauffeur est en route";
      case "arrived":
        return "Votre chauffeur vous attend";
      case "inprogress":
        return "Course en cours";
      case "completed":
        return "Course terminée";
      default:
        return "En route";
    }
  };

  const getRideStatusIcon = () => {
    switch (rideStatus) {
      case "enroute":
        return <Car className="w-5 h-5 text-white" />;
      case "arrived":
        return <Clock className="w-5 h-5 text-white" />;
      case "inprogress":
        return <Navigation className="w-5 h-5 text-white" />;
      case "completed":
        return <Check className="w-5 h-5 text-white" />;
      default:
        return <Car className="w-5 h-5 text-white" />;
    }
  };

  // Show loading state while fetching order
  if (isLoadingOrder && !courseData) {
    return (
      <div className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#ffdf6d] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  // Show message and redirect if no active order found
  if (orderNotFound || !courseData) {
    return (
      <div className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-xl p-6 shadow-lg text-center max-w-sm">
          <Car className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#343434] mb-2">Aucune course en cours</h2>
          <p className="text-[#5c5c5c] text-sm mb-4">
            Vous n'avez pas de course active pour le moment.
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="w-full bg-[#ffdf6d] hover:bg-[#f5d55c] text-[#343434]"
            data-testid="button-return-home"
          >
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const truncateAddress = (address: string, maxLength: number = 25) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  return (
    <div 
      className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 overflow-hidden flex flex-col"
      style={{ height: '100dvh' }}
    >
      <header 
        className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-20"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button 
              size="icon" 
              className="bg-[#ffdf6d]/90 hover:bg-[#ffdf6d] rounded-full w-10 h-10"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5 text-[#343434]" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-gradient-to-b from-white to-gray-50/80 z-50 border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Menu de navigation</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-8">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="group relative w-full py-4 px-2 cursor-pointer transition-all duration-200"
                    onClick={() => setMenuOpen(false)}
                    data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="text-[#3a3a3a] font-light text-lg tracking-wide group-hover:text-[#1a1a1a] transition-colors">
                      {item.label}
                    </span>
                    <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-gray-200 via-gray-300 to-transparent opacity-60" />
                    <div className="absolute inset-0 bg-[#ffdf6d]/0 group-hover:bg-[#ffdf6d]/10 rounded-lg transition-colors duration-200" />
                  </div>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <img 
          src={logoImage} 
          alt="TĀPE'A" 
          className="h-[50px] w-auto object-contain"
        />

        <Button 
          size="icon" 
          className="bg-[#ffdf6d]/90 hover:bg-[#ffdf6d] rounded-full w-10 h-10"
          data-testid="button-navigate"
        >
          <MapPin className="w-5 h-5 text-[#343434]" />
        </Button>
      </header>


      <div className="flex-1 relative z-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={driverLocation || clientLocation || { lat: -17.5350, lng: -149.5695 }}
            zoom={driverLocation ? 17 : 13}
            onLoad={onMapLoad}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              styles: mapStyles,
            }}
          >
            {/* Show driver -> pickup route when driver position is available and en route */}
            {driverToPickupDirections && (rideStatus === "enroute" || rideStatus === "arrived") && (
              <DirectionsRenderer
                directions={driverToPickupDirections}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true, // Prevent route from forcing bounds change
                  polylineOptions: {
                    strokeColor: "#4285F4",
                    strokeWeight: 5,
                  },
                }}
              />
            )}
            {/* Show pickup -> destination route when waiting for driver GPS or during ride */}
            {directions && !driverToPickupDirections && (rideStatus === "enroute" || rideStatus === "arrived") && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  preserveViewport: true, // Prevent route from forcing bounds change
                  polylineOptions: {
                    strokeColor: "#ffdf6d",
                    strokeWeight: 5,
                    strokeOpacity: 0.6,
                  },
                }}
              />
            )}
            {/* Show driver -> destination route when ride is in progress (real-time) */}
            {driverToDestinationDirections && rideStatus === "inprogress" && (
              <DirectionsRenderer
                directions={driverToDestinationDirections}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: "#4285F4",
                    strokeWeight: 5,
                  },
                }}
              />
            )}
            {/* Fallback: Show static pickup -> destination route when driver location not yet available */}
            {directions && !driverToDestinationDirections && rideStatus === "inprogress" && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: "#ffdf6d",
                    strokeWeight: 5,
                  },
                }}
              />
            )}
            {/* Show pickup marker when driver is en route */}
            {courseData && (rideStatus === "enroute" || rideStatus === "arrived") && clientLocation && (
              <Marker
                position={clientLocation}
                icon={{
                  url: clientMarkerIcon,
                  scaledSize: new google.maps.Size(60, 60),
                  anchor: new google.maps.Point(30, 60),
                }}
                title="Point de prise en charge"
              />
            )}
            {clientLocation && rideStatus === "inprogress" && (
              <Marker
                position={clientLocation}
                icon={{
                  url: clientMarkerIcon,
                  scaledSize: new google.maps.Size(80, 80),
                  anchor: new google.maps.Point(40, 80),
                }}
                title="Votre position"
              />
            )}
            {driverLocation && rideStatus !== "completed" && (
              <OverlayView
                position={driverLocation}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div
                  style={{
                    transform: `translate(-50%, -50%) rotate(${driverHeading}deg)`,
                    transformOrigin: 'center center',
                    width: '50px',
                    height: '50px',
                  }}
                >
                  <img
                    src={driverCarIcon}
                    alt="Chauffeur"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </OverlayView>
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#ffdf6d] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

      </div>

      <div 
        className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="px-4 py-3">
          {showPaymentConfirm ? (
            <div className="text-center py-2">
              {paymentConfirmed ? (
                <>
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <p className="font-bold text-[#343434] text-sm">Merci pour votre course !</p>
                  <p className="text-xs text-[#8c8c8c]">Retour à l'accueil...</p>
                </>
              ) : isPaymentProcessing ? (
                <>
                  <div className="w-12 h-12 bg-[#ffdf6d] rounded-full flex items-center justify-center mx-auto mb-2">
                    <Loader2 className="w-6 h-6 text-[#343434] animate-spin" />
                  </div>
                  <p className="font-bold text-[#343434] text-sm mb-1">Traitement du paiement</p>
                  <p className="text-lg font-bold text-[#343434] mb-2">{courseData.totalPrice.toLocaleString()} XPF</p>
                  <p className="text-xs text-[#8c8c8c]">Veuillez patienter...</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <p className="font-bold text-[#343434] text-sm mb-1">Course terminée</p>
                  <p className="text-lg font-bold text-[#343434] mb-2">{courseData.totalPrice.toLocaleString()} XPF</p>
                  <p className="text-xs text-[#8c8c8c]">En attente de confirmation du paiement par le chauffeur...</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  rideStatus === "completed" ? "bg-green-500" :
                  rideStatus === "arrived" ? "bg-orange-500" :
                  rideStatus === "inprogress" ? "bg-blue-500" :
                  "bg-[#ffdf6d]"
                }`}>
                  {getRideStatusIcon()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[#343434] text-sm">{getRideStatusMessage()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`h-1.5 w-6 rounded-full ${rideStatus === "enroute" || rideStatus === "arrived" || rideStatus === "inprogress" || rideStatus === "completed" ? "bg-[#ffdf6d]" : "bg-gray-200"}`}></div>
                  <div className={`h-1.5 w-6 rounded-full ${rideStatus === "arrived" || rideStatus === "inprogress" || rideStatus === "completed" ? "bg-[#ffdf6d]" : "bg-gray-200"}`}></div>
                  <div className={`h-1.5 w-6 rounded-full ${rideStatus === "inprogress" || rideStatus === "completed" ? "bg-[#ffdf6d]" : "bg-gray-200"}`}></div>
                  <div className={`h-1.5 w-6 rounded-full ${rideStatus === "completed" ? "bg-green-500" : "bg-gray-200"}`}></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {courseData.driverPhoto ? (
                      <img src={courseData.driverPhoto} alt={courseData.driverName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{courseData.driverName.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#343434] text-sm">{courseData.driverName}</p>
                    {courseData.driverVehicle && (
                      <p className="text-xs text-[#8c8c8c]">{courseData.driverVehicle}</p>
                    )}
                    {courseData.driverPlate && (
                      <span className="bg-[#ffdf6d] text-[#343434] text-xs font-medium px-2 py-0.5 rounded-full">
                        {courseData.driverPlate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    className="bg-green-500 hover:bg-green-600 rounded-full"
                    onClick={handleCall}
                    data-testid="button-call-driver"
                  >
                    <Phone className="w-4 h-4 text-white" />
                  </Button>
                  <Button
                    size="icon"
                    className="bg-blue-500 hover:bg-blue-600 rounded-full"
                    onClick={handleMessage}
                    data-testid="button-message-driver"
                  >
                    <MessageSquare className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-[#8c8c8c]">Prix total</p>
                  <p className="font-bold text-[#343434]">{courseData.totalPrice.toLocaleString()} XPF</p>
                </div>
                <div>
                  <p className="text-xs text-[#8c8c8c]">Distance</p>
                  <p className="font-bold text-[#343434]">{courseData.distance}</p>
                </div>
              </div>

              {rideStatus !== "inprogress" && rideStatus !== "completed" && (
                <Button
                  variant="outline"
                  className="w-full mt-4 h-12 rounded-xl border border-[#ccc] text-[#8c8c8c] font-medium"
                  onClick={handleCancel}
                  data-testid="button-cancel-ride"
                >
                  Annuler
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ThankYouModal
        isOpen={showThankYou}
        onClose={() => {
          setShowThankYou(false);
          sessionStorage.removeItem("currentOrderId");
          sessionStorage.removeItem("orderTotal");
          sessionStorage.removeItem("orderPickup");
          sessionStorage.removeItem("orderDestination");
          sessionStorage.removeItem("assignedDriverName");
          sessionStorage.removeItem("assignedDriverId");
          sessionStorage.removeItem("clientToken");
          sessionStorage.removeItem("clientRideStatus");
          setLocation("/");
        }}
        orderPrice={courseData?.totalPrice || 0}
        isDriver={false}
      />

      {paymentResultData && (
        <PaymentResultModal
          isOpen={showPaymentResult}
          onClose={() => {
            setShowPaymentResult(false);
            if (paymentResultData.status === "success") {
              setShowThankYou(true);
            }
          }}
          status={paymentResultData.status}
          amount={paymentResultData.amount}
          paymentMethod={paymentResultData.paymentMethod}
          cardBrand={paymentResultData.cardBrand}
          cardLast4={paymentResultData.cardLast4}
          errorMessage={paymentResultData.errorMessage}
          onChangeCard={() => {
            setShowPaymentResult(false);
            setLocation("/cartes-bancaires?returnTo=course-en-cours");
          }}
          onRetryPayment={() => {
            const clientToken = sessionStorage.getItem("clientToken");
            const orderId = courseData?.orderId;
            if (orderId && clientToken) {
              retryPayment(orderId, clientToken);
              setShowPaymentResult(false);
              setShowPaymentConfirm(true);
            }
          }}
          onSwitchToCash={() => {
            const clientToken = sessionStorage.getItem("clientToken");
            const orderId = courseData?.orderId;
            if (orderId && clientToken) {
              switchToCashPayment(orderId, clientToken);
              setShowPaymentResult(false);
              setShowPaymentConfirm(true);
            }
          }}
          role="client"
        />
      )}
    </div>
  );
}
