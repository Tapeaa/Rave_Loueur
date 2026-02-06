import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, MapPin, Navigation, Check, X, CreditCard, Loader2 } from "lucide-react";
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
import clientMarkerIcon from "@assets/Icone_acpp_-2_1766883400696.png";
import driverCarIcon from "@assets/Icone_acpp_-2_copie_1766883461028.png";
import type { Order } from "@shared/schema";
import { 
  connectSocket, 
  joinDriverSession,
  joinRideRoom, 
  updateRideStatus, 
  onPaymentStatus,
  onRideCancelled,
  confirmPayment,
  cancelRide,
  emitDriverLocation,
  onClientLocationUpdate,
  calculateHeading
} from "@/lib/socket";
import { ThankYouModal } from "@/components/ThankYouModal";
import { PaymentResultModal } from "@/components/PaymentResultModal";

const menuItems = [
  { label: "Accueil", href: "/chauffeur" },
  { label: "Mon profil", href: "/chauffeur/profil" },
  { label: "Mes courses", href: "/chauffeur/courses" },
  { label: "Mes gains", href: "/chauffeur/gains" },
  { label: "Aide", href: "/chauffeur/aide" },
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
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  }
];

export function ChauffeurCourseEnCours() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [driverToPickupDirections, setDriverToPickupDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [driverToDestinationDirections, setDriverToDestinationDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [courseStep, setCourseStep] = useState<"enroute" | "arrived" | "inprogress" | "completed">("enroute");
  const [isLoading, setIsLoading] = useState(true);
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
  const [isMapReady, setIsMapReady] = useState(false);
  const prevLocationRef = useRef<google.maps.LatLngLiteral | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastRouteUpdateRef = useRef<number>(0);
  const hasInitialDriverLock = useRef(false);
  
  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    const initializeOrder = async () => {
      const storedOrder = sessionStorage.getItem("acceptedOrder");
      const sessionId = sessionStorage.getItem("driverSessionId");
      const storedCourseStep = sessionStorage.getItem("courseStep");
      
      if (storedOrder && sessionId) {
        try {
          const parsedOrder = JSON.parse(storedOrder);
          setOrder(parsedOrder);
          setIsLoading(false);
          
          // Restore course step from sessionStorage if available
          if (storedCourseStep && ["enroute", "arrived", "inprogress", "completed"].includes(storedCourseStep)) {
            setCourseStep(storedCourseStep as "enroute" | "arrived" | "inprogress" | "completed");
          }
          
          // Connect socket, join driver session (to register socketId), then join ride room
          connectSocket();
          joinDriverSession(sessionId);
          joinRideRoom(parsedOrder.id, 'driver', { sessionId });
          
          // Only send initial enroute status if no previous step was stored
          // This prevents resetting the ride status on page reload
          if (!storedCourseStep) {
            updateRideStatus(parsedOrder.id, sessionId, "enroute");
            sessionStorage.setItem("courseStep", "enroute");
          }
          
          // Always fetch fresh order status to detect payment_pending
          try {
            const freshRes = await fetch(`/api/orders/${parsedOrder.id}`);
            if (freshRes.ok) {
              const freshOrder = await freshRes.json();
              console.log("[ChauffeurCourseEnCours] Fresh order status:", freshOrder.status);
              
              if (freshOrder.status === "payment_pending") {
                console.log("[ChauffeurCourseEnCours] Order has payment_pending - showing payment modal");
                setCourseStep("completed");
                sessionStorage.setItem("courseStep", "completed");
                setShowPaymentConfirm(false);
                setPaymentResultData({
                  status: "failed",
                  amount: freshOrder.totalPrice || 0,
                  paymentMethod: "card",
                  errorMessage: "Le paiement précédent a échoué. Veuillez réessayer ou attendre le client.",
                });
                setShowPaymentResult(true);
              } else if (storedCourseStep === "completed" && freshOrder.status !== "payment_pending") {
                // Course was completed but status is not payment_pending - show payment confirm
                setShowPaymentConfirm(true);
              }
              
              // Update order with fresh data
              setOrder(freshOrder);
              sessionStorage.setItem("acceptedOrder", JSON.stringify(freshOrder));
            }
          } catch (fetchErr) {
            console.log("[ChauffeurCourseEnCours] Failed to fetch fresh status:", fetchErr);
            // If we can't fetch, fall back to stored state
            if (storedCourseStep === "completed") {
              setShowPaymentConfirm(true);
            }
          }
        } catch (e) {
          console.error("Error parsing order:", e);
          setLocation("/chauffeur");
        }
      } else if (sessionId) {
        // No stored order but have session - try to fetch active order from API
        console.log("[ChauffeurCourseEnCours] No sessionStorage order, fetching from API...");
        try {
          const res = await fetch(`/api/orders/active/driver?sessionId=${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            console.log("[ChauffeurCourseEnCours] Active order API response:", data);
            if (data.hasActiveOrder && data.order) {
              const fetchedOrder = data.order;
              setOrder(fetchedOrder);
              setIsLoading(false);
              
              // Store in sessionStorage for future use
              sessionStorage.setItem("acceptedOrder", JSON.stringify(fetchedOrder));
              
              // Map order status to course step
              const statusMap: Record<string, "enroute" | "arrived" | "inprogress" | "completed"> = {
                "accepted": "enroute",
                "driver_arrived": "arrived",
                "in_progress": "inprogress",
                "payment_pending": "completed",
              };
              const mappedStep = (fetchedOrder.status && statusMap[fetchedOrder.status]) || "enroute";
              setCourseStep(mappedStep);
              sessionStorage.setItem("courseStep", mappedStep);
              
              // Connect socket and join rooms
              connectSocket();
              joinDriverSession(sessionId);
              joinRideRoom(fetchedOrder.id, 'driver', { sessionId });
              
              // If order is in payment_pending status, show payment failed modal
              if (fetchedOrder.status === "payment_pending") {
                console.log("[ChauffeurCourseEnCours] Order has payment_pending status - showing payment modal");
                setShowPaymentConfirm(false);
                setPaymentResultData({
                  status: "failed",
                  amount: fetchedOrder.totalPrice || 0,
                  paymentMethod: "card",
                  errorMessage: "Le paiement précédent a échoué. Veuillez réessayer ou attendre le client.",
                });
                setShowPaymentResult(true);
              } else if (mappedStep === "completed") {
                setShowPaymentConfirm(true);
              }
              
              console.log("[ChauffeurCourseEnCours] Order loaded from API, status:", fetchedOrder.status);
            } else {
              console.log("[ChauffeurCourseEnCours] No active order found");
              setLocation("/chauffeur");
            }
          } else {
            console.log("[ChauffeurCourseEnCours] API request failed");
            setLocation("/chauffeur");
          }
        } catch (err) {
          console.error("[ChauffeurCourseEnCours] Failed to fetch active order:", err);
          setLocation("/chauffeur");
        }
      } else {
        setLocation("/chauffeur");
      }
    };
    
    initializeOrder();
  }, [setLocation]);

  // Listen for payment confirmation status and ride cancellation
  useEffect(() => {
    if (!order) return;
    
    const unsubPayment = onPaymentStatus((data) => {
      if (data.orderId === order.id) {
        console.log("[DEBUG] Payment status received:", data);
        setIsPaymentProcessing(false);
        
        // Payment confirmed - show success modal then thank you modal
        if (data.confirmed && data.status === "payment_confirmed") {
          setPaymentConfirmed(true);
          setPaymentResultData({
            status: "success",
            amount: data.amount || order.totalPrice,
            paymentMethod: (data.paymentMethod as "card" | "cash") || "cash",
            cardBrand: data.cardBrand,
            cardLast4: data.cardLast4,
          });
          setShowPaymentConfirm(false);
          setShowPaymentResult(true);
        }
        
        // Payment failed/rejected - show failure modal
        if (data.status === "payment_failed") {
          setPaymentResultData({
            status: "failed",
            amount: order.totalPrice,
            paymentMethod: (data.paymentMethod as "card" | "cash") || "cash",
            errorMessage: data.errorMessage || "Le paiement n'a pas pu être effectué",
          });
          setShowPaymentConfirm(false);
          setShowPaymentResult(true);
        }
      }
    });
    
    // Listen for ride cancellation (by client)
    const unsubCancelled = onRideCancelled((data) => {
      if (data.orderId === order.id) {
        console.log("[DEBUG] Ride cancelled:", data);
        alert(`Course annulée: ${data.reason}`);
        sessionStorage.removeItem("acceptedOrder");
        sessionStorage.removeItem("courseStep");
        setLocation("/chauffeur");
      }
    });

    return () => {
      unsubPayment();
      unsubCancelled();
    };
  }, [order, setLocation]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    console.log("[MAP] Driver map loaded");
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  // Camera following effect - follow driver position (3rd person view)
  useEffect(() => {
    console.log("[CAMERA] Effect running - mapRef:", !!mapRef.current, "driverLocation:", driverLocation, "isMapReady:", isMapReady, "courseStep:", courseStep);
    
    if (!mapRef.current || !driverLocation || !isMapReady) {
      console.log("[CAMERA] Early return - missing:", !mapRef.current ? "map" : "", !driverLocation ? "location" : "", !isMapReady ? "ready" : "");
      return;
    }
    if (courseStep === "completed") return;
    
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
  }, [driverLocation, courseStep, isMapReady]);

  // Calculate route from driver to pickup (when en route or arrived)
  useEffect(() => {
    if (!isLoaded || !order || !driverLocation) return;
    if (courseStep !== "enroute" && courseStep !== "arrived") return;
    
    // Throttle route updates to every 10 seconds
    const now = Date.now();
    if (now - lastRouteUpdateRef.current < 10000) return;
    lastRouteUpdateRef.current = now;
    
    const pickup = order.addresses.find(a => a.type === "pickup");
    if (!pickup?.value) return;
    
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: driverLocation,
        destination: pickup.value,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDriverToPickupDirections(result);
        }
      }
    );
  }, [isLoaded, order, driverLocation, courseStep]);

  // Calculate route from driver to destination (when in progress)
  useEffect(() => {
    if (!isLoaded || !order || !driverLocation) return;
    if (courseStep !== "inprogress") return;
    
    // Throttle route updates to every 10 seconds
    const now = Date.now();
    if (now - lastRouteUpdateRef.current < 10000) return;
    lastRouteUpdateRef.current = now;
    
    const destination = order.addresses.find(a => a.type === "destination");
    if (!destination?.value) return;
    
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: driverLocation,
        destination: destination.value,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDriverToDestinationDirections(result);
        }
      }
    );
  }, [isLoaded, order, driverLocation, courseStep]);

  useEffect(() => {
    if (isLoaded && order) {
      const pickup = order.addresses.find(a => a.type === "pickup");
      const destination = order.addresses.find(a => a.type === "destination");
      
      if (pickup?.value && destination?.value) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: pickup.value,
            destination: destination.value,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              setDirections(result);
            }
          }
        );
      }
    }
  }, [isLoaded, order]);

  // Real-time GPS tracking for driver - send location to client
  useEffect(() => {
    if (!order || courseStep === "completed") return;
    
    const sessionId = sessionStorage.getItem("driverSessionId");
    if (!sessionId || !navigator.geolocation) return;
    
    // Get immediate position first (faster than waiting for watchPosition)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log("[GPS] Immediate position obtained:", newLocation.lat, newLocation.lng);
        prevLocationRef.current = newLocation;
        setDriverLocation(newLocation);
        
        // Emit immediately
        emitDriverLocation(
          order.id,
          sessionId,
          newLocation.lat,
          newLocation.lng,
          0,
          position.coords.speed || undefined
        );
      },
      (error) => console.log("[GPS] Immediate position error:", error.message),
      { enableHighAccuracy: true, timeout: 5000 }
    );
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        // Calculate heading from previous position
        let heading = driverHeading;
        if (prevLocationRef.current) {
          const newHeading = calculateHeading(
            prevLocationRef.current.lat,
            prevLocationRef.current.lng,
            newLocation.lat,
            newLocation.lng
          );
          // Only update heading if we moved significantly (avoid jitter)
          const distance = Math.sqrt(
            Math.pow(newLocation.lat - prevLocationRef.current.lat, 2) +
            Math.pow(newLocation.lng - prevLocationRef.current.lng, 2)
          );
          if (distance > 0.00005) { // ~5 meters
            heading = newHeading;
            setDriverHeading(heading);
          }
        }
        prevLocationRef.current = newLocation;
        setDriverLocation(newLocation);
        
        // Emit location to server (relayed to client)
        console.log("[GPS] Emitting driver location:", newLocation.lat, newLocation.lng, "heading:", heading);
        emitDriverLocation(
          order.id,
          sessionId,
          newLocation.lat,
          newLocation.lng,
          heading,
          position.coords.speed || undefined
        );
      },
      (error) => {
        console.log("[GPS] Geolocation error:", error.message);
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
    
    watchIdRef.current = watchId;
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [order, courseStep, driverHeading]);

  // Listen for client location updates
  useEffect(() => {
    if (!order) return;
    
    const unsubClientLocation = onClientLocationUpdate((data) => {
      if (data.orderId === order.id) {
        setClientLocation({ lat: data.lat, lng: data.lng });
      }
    });
    
    return () => {
      unsubClientLocation();
    };
  }, [order]);

  const handleCall = () => {
    if (order) {
      window.location.href = `tel:${order.clientPhone}`;
    }
  };

  const handleMessage = () => {
    setLocation("/chauffeur/support");
  };

  const handleArrivedAtPickup = () => {
    const sessionId = sessionStorage.getItem("driverSessionId");
    if (order && sessionId) {
      updateRideStatus(order.id, sessionId, "arrived");
      setCourseStep("arrived");
      sessionStorage.setItem("courseStep", "arrived");
    }
  };

  const handleStartRide = () => {
    const sessionId = sessionStorage.getItem("driverSessionId");
    if (order && sessionId) {
      updateRideStatus(order.id, sessionId, "inprogress");
      setCourseStep("inprogress");
      sessionStorage.setItem("courseStep", "inprogress");
    }
  };

  const handleCompleteRide = () => {
    const sessionId = sessionStorage.getItem("driverSessionId");
    if (order && sessionId) {
      updateRideStatus(order.id, sessionId, "completed");
      setCourseStep("completed");
      sessionStorage.setItem("courseStep", "completed");
      setShowPaymentConfirm(true);
    }
  };

  const handleConfirmPayment = (confirmed: boolean) => {
    if (order) {
      setIsPaymentProcessing(true);
      const sessionId = sessionStorage.getItem("driverSessionId");
      confirmPayment(order.id, confirmed, 'driver', { sessionId: sessionId || undefined });
    }
  };

  const handleCancelRide = () => {
    if (confirm("Êtes-vous sûr de vouloir annuler cette course ?")) {
      if (order) {
        const sessionId = sessionStorage.getItem("driverSessionId");
        cancelRide(order.id, 'driver', "Annulé par le chauffeur", { sessionId: sessionId || undefined });
      }
      // The socket handler will clean up sessionStorage and redirect
    }
  };

  const getPickupAddress = () => {
    return order?.addresses.find(a => a.type === "pickup")?.value || "Point de départ";
  };

  const getDestinationAddress = () => {
    return order?.addresses.find(a => a.type === "destination")?.value || "Destination";
  };

  const truncateAddress = (address: string, maxLength: number = 25) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  if (isLoading || !order) {
    return (
      <div className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#ffdf6d] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8c8c8c]">Chargement de la course...</p>
        </div>
      </div>
    );
  }

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
          <Navigation className="w-5 h-5 text-[#343434]" />
        </Button>
      </header>


      <div className="flex-1 relative z-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={driverLocation || { lat: -17.5350, lng: -149.5695 }}
            zoom={driverLocation ? 17 : 13}
            onLoad={onMapLoad}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              styles: mapStyles,
            }}
          >
            {/* Show driver -> pickup route when en route or arrived */}
            {driverToPickupDirections && (courseStep === "enroute" || courseStep === "arrived") && (
              <DirectionsRenderer
                directions={driverToPickupDirections}
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
            {/* Fallback: Show static pickup -> destination route when no driver location yet */}
            {directions && !driverToPickupDirections && (courseStep === "enroute" || courseStep === "arrived") && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: "#ffdf6d",
                    strokeWeight: 5,
                    strokeOpacity: 0.6,
                  },
                }}
              />
            )}
            {/* Show driver -> destination route when in progress */}
            {driverToDestinationDirections && courseStep === "inprogress" && (
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
            {/* Fallback: Show static route when no driver location yet during in progress */}
            {directions && !driverToDestinationDirections && courseStep === "inprogress" && (
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
            {/* Show client location marker */}
            {clientLocation && courseStep !== "completed" && (
              <Marker
                position={clientLocation}
                icon={{
                  url: clientMarkerIcon,
                  scaledSize: new google.maps.Size(60, 60),
                  anchor: new google.maps.Point(30, 60),
                }}
                title="Position du client"
              />
            )}
            {/* Show driver vehicle icon with rotation */}
            {driverLocation && courseStep !== "completed" && (
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
                    alt="Ma position"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </OverlayView>
            )}
            {/* Show pickup marker when en route */}
            {order && (courseStep === "enroute" || courseStep === "arrived") && directions?.routes[0]?.legs[0]?.start_location && (
              <Marker
                position={directions.routes[0].legs[0].start_location}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#22c55e",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 3,
                }}
                title="Point de prise en charge"
              />
            )}
            {/* Show destination marker when in progress */}
            {order && courseStep === "inprogress" && directions?.routes[0]?.legs[0]?.end_location && (
              <Marker
                position={directions.routes[0].legs[0].end_location}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 3,
                }}
                title="Destination"
              />
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                <span className="text-sm font-bold text-gray-500">{order.clientName.charAt(0)}</span>
              </div>
              <div>
                <p className="font-bold text-[#343434] text-sm">{order.clientName}</p>
                <p className="text-xs text-[#8c8c8c]">{order.passengers} passager(s)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="icon"
                className="bg-green-500 hover:bg-green-600 rounded-full"
                onClick={handleCall}
                data-testid="button-call-client"
              >
                <Phone className="w-4 h-4 text-white" />
              </Button>
              <Button
                size="icon"
                className="bg-blue-500 hover:bg-blue-600 rounded-full"
                onClick={handleMessage}
                data-testid="button-message-client"
              >
                <MessageSquare className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>

          <div className="bg-[#343434] rounded-xl p-2 mb-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-white/70">Total</p>
              <p className="text-sm font-bold text-white">{order.totalPrice.toLocaleString()} XPF</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/70">Gain</p>
              <p className="text-sm font-bold text-[#ffdf6d]">{order.driverEarnings.toLocaleString()} XPF</p>
            </div>
          </div>

          {courseStep === "completed" && showPaymentConfirm ? (
            <div className="text-center py-2">
              {paymentConfirmed ? (
                <>
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <p className="font-bold text-[#343434] text-sm">Paiement confirmé !</p>
                  <p className="text-xs text-[#8c8c8c]">Retour à l'accueil...</p>
                </>
              ) : isPaymentProcessing ? (
                <>
                  <div className="w-12 h-12 bg-[#ffdf6d] rounded-full flex items-center justify-center mx-auto mb-2">
                    <Loader2 className="w-6 h-6 text-[#343434] animate-spin" />
                  </div>
                  <p className="font-bold text-[#343434] text-sm">Traitement du paiement...</p>
                  <p className="text-xs text-[#8c8c8c]">Veuillez patienter</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-[#343434] text-sm mb-2">Paiement de {order.totalPrice.toLocaleString()} XPF reçu ?</p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-10 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl text-sm"
                      onClick={() => handleConfirmPayment(true)}
                      data-testid="button-confirm-payment"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Confirmer
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl border border-red-200 text-red-500 text-sm"
                      onClick={() => handleConfirmPayment(false)}
                      data-testid="button-reject-payment"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Refuser
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {courseStep === "enroute" && (
                <Button
                  className="w-full h-10 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl text-sm"
                  onClick={handleArrivedAtPickup}
                  data-testid="button-arrived"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Je suis arrivé
                </Button>
              )}

              {courseStep === "arrived" && (
                <Button
                  className="w-full h-10 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl text-sm"
                  onClick={handleStartRide}
                  data-testid="button-start-ride"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Démarrer la course
                </Button>
              )}

              {courseStep === "inprogress" && (
                <Button
                  className="w-full h-10 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl text-sm"
                  onClick={handleCompleteRide}
                  data-testid="button-complete-ride"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Terminer la course
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full h-10 rounded-xl border border-red-200 text-red-500 text-sm"
                onClick={handleCancelRide}
                data-testid="button-cancel-ride"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          )}
        </div>
      </div>

      <ThankYouModal
        isOpen={showThankYou}
        onClose={() => {
          setShowThankYou(false);
          sessionStorage.removeItem("acceptedOrder");
          sessionStorage.removeItem("courseStep");
          setLocation("/chauffeur");
        }}
        orderPrice={order?.totalPrice || 0}
        isDriver={true}
        driverEarnings={order?.driverEarnings || 0}
      />

      {paymentResultData && (
        <PaymentResultModal
          isOpen={showPaymentResult}
          onClose={() => {
            setShowPaymentResult(false);
            if (paymentResultData.status === "success") {
              setShowThankYou(true);
            } else {
              setShowPaymentConfirm(true);
            }
          }}
          status={paymentResultData.status}
          amount={paymentResultData.amount}
          paymentMethod={paymentResultData.paymentMethod}
          cardBrand={paymentResultData.cardBrand}
          cardLast4={paymentResultData.cardLast4}
          errorMessage={paymentResultData.errorMessage}
          role="driver"
          onDriverRetryPayment={() => {
            setShowPaymentResult(false);
            setIsPaymentProcessing(true);
            const sessionId = sessionStorage.getItem("driverSessionId");
            if (order) {
              confirmPayment(order.id, true, 'driver', { sessionId: sessionId || undefined });
            }
          }}
          onDriverWaitForClient={() => {
            setShowPaymentResult(false);
            setShowPaymentConfirm(true);
          }}
        />
      )}
    </div>
  );
}
