import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { Menu, MessageCircle, Search, Map, MapPin, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useQuery } from "@tanstack/react-query";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";
import userMarkerIcon from "@assets/Icone acpp _1764076202750.png";
import iconTarifs from "@assets/9_1764076802813.png";
import iconCommandes from "@assets/7_1764076802813.png";
import iconPaiement from "@assets/6_1764076802813.png";
import iconDocuments from "@assets/8_1764076802813.png";
import iconContact from "@assets/10_1764076802814.png";
import type { Order } from "@shared/schema";

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
  { id: "tarifs", label: "Tarifs", iconImage: iconTarifs, href: "/tarifs" },
  { id: "commandes", label: "Commandes", iconImage: iconCommandes, href: "/commandes" },
  { id: "paiement", label: "Paiement", iconImage: iconPaiement, href: "/wallet" },
  { id: "documents", label: "Documents", iconImage: iconDocuments, href: "/documents" },
  { id: "contact", label: "Contact", iconImage: iconContact, href: "/contact" },
];

const menuItems = [
  { label: "Mon profil", href: "/profil" },
  { label: "Mes commandes", href: "/commandes" },
  { label: "Mon wallet", href: "/wallet" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Aide", href: "/aide" },
  { label: "Chauffeur", href: "/chauffeur-login" },
];

function MapComponent() {
  const { isLoaded, loadError } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    console.log("Google Maps loaded successfully");
    
    // Demander la localisation seulement si non demandé
    if (!permissionAsked) {
      setPermissionAsked(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            map.setCenter({ lat: latitude, lng: longitude });
            map.setZoom(15);
            console.log("Localisation obtenue:", latitude, longitude);
          },
          (error) => {
            console.log("Localisation refusée ou indisponible:", error.message);
            // Fallback: utiliser la position par défaut avec le marker personnalisé
            setUserLocation(defaultCenter);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      } else {
        // Si pas de geolocation, utiliser position par défaut
        setUserLocation(defaultCenter);
      }
    }
  }, [permissionAsked]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center p-4">
        <MapPin className="w-16 h-16 text-blue-500 mb-4" />
        <p className="text-[#5c5c5c] text-sm text-center font-medium">
          Clé API Google Maps manquante
        </p>
        <p className="text-[#8c8c8c] text-xs text-center mt-2">
          Configurez VITE_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }

  if (loadError) {
    console.error("Google Maps load error:", loadError);
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center p-4">
        <MapPin className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-[#5c5c5c] text-sm text-center font-medium">
          Erreur de chargement
        </p>
        <p className="text-[#8c8c8c] text-xs text-center mt-2 max-w-[200px]">
          {loadError.message || "Vérifiez votre clé API et la facturation Google Cloud"}
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300 flex flex-col items-center justify-center">
        <div className="animate-pulse">
          <MapPin className="w-16 h-16 text-blue-500" />
        </div>
        <p className="text-[#5c5c5c] text-sm mt-4">Chargement de la carte...</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={userLocation || defaultCenter}
      zoom={userLocation ? 15 : 13}
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
      {userLocation && (
        <Marker 
          position={userLocation}
          icon={{
            url: userMarkerIcon,
            scaledSize: new google.maps.Size(90, 90),
            anchor: new google.maps.Point(45, 90),
          }}
          title="Votre position"
        />
      )}
    </GoogleMap>
  );
}

export function Accueil() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const showPubSection = false;

  const { data: activeOrderData } = useQuery<{ hasActiveOrder: boolean; order?: Order; clientToken?: string }>({
    queryKey: ['/api/orders/active/client'],
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (activeOrderData?.hasActiveOrder && activeOrderData.order) {
      const order = activeOrderData.order;
      
      // Store order data in sessionStorage for ride tracking pages
      sessionStorage.setItem("currentOrderId", order.id);
      if (activeOrderData.clientToken) {
        sessionStorage.setItem("clientToken", activeOrderData.clientToken);
      }
      const pickup = order.addresses?.find(a => a.type === "pickup")?.value || "";
      const destination = order.addresses?.find(a => a.type === "destination")?.value || "";
      sessionStorage.setItem("orderPickup", pickup);
      sessionStorage.setItem("orderDestination", destination);
      sessionStorage.setItem("orderTotal", String(order.totalPrice ?? 0));
      sessionStorage.setItem("orderDistance", String(order.routeInfo?.distance || ""));
      sessionStorage.setItem("orderStatus", order.status || "");
      // No redirect - payment banner is shown directly on homepage
    } else if (activeOrderData && !activeOrderData.hasActiveOrder) {
      // No active order for this authenticated user - clear stale sessionStorage
      // This prevents "phantom orders" from appearing
      console.log("[Accueil] No active order - clearing stale sessionStorage");
      sessionStorage.removeItem("currentOrderId");
      sessionStorage.removeItem("clientToken");
      sessionStorage.removeItem("orderPickup");
      sessionStorage.removeItem("orderDestination");
      sessionStorage.removeItem("orderTotal");
      sessionStorage.removeItem("orderDistance");
      sessionStorage.removeItem("orderStatus");
      sessionStorage.removeItem("clientRideStatus");
    }
  }, [activeOrderData]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? scrollLeft / maxScroll : 0;
      setScrollProgress(progress);
    }
  };

  const handleCategoryClick = (category: typeof categories[0]) => {
    setSelectedCategory(category.id);
    setLocation(category.href);
  };

  return (
    <div 
      className="bg-white w-full max-w-[420px] mx-auto fixed inset-0 overflow-hidden"
      style={{ 
        overscrollBehavior: 'none',
        touchAction: 'none',
        height: '100dvh',
        maxHeight: '100dvh'
      }}
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
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>
                Menu de navigation
              </SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-8">
              {menuItems.map((item, index) => (
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

        <div className="flex-1 flex justify-center">
          <img 
            src={logoImage} 
            alt="TĀPE'A" 
            className="h-[75px] w-auto object-contain drop-shadow-md"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
          />
        </div>

        <Link href="/support">
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
        <MapComponent />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10" style={{ touchAction: 'manipulation' }}>
        {showPubSection && (
          <div 
            className="mx-3 mb-2 rounded-xl overflow-hidden"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
          >
            <div 
              className="relative h-[70px] bg-cover bg-center"
              style={{
                backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.3)), url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&auto=format&fit=crop&q=60')",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <div>
                  <p className="text-white font-bold text-xs leading-tight">
                    OÙ VOUS VOULEZ
                  </p>
                  <p className="text-white font-bold text-xs leading-tight">
                    QUAND VOUS VOULEZ
                  </p>
                  <p className="text-[#ffdf6d] font-semibold text-[9px] mt-0.5">
                    NEED A DRIVER?
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="bg-black rounded px-2 py-0.5 flex items-center gap-1">
                    <span className="text-white text-[5px]">GET IT ON</span>
                    <span className="text-white text-[7px] font-semibold">Google Play</span>
                  </div>
                  <div className="bg-black rounded px-2 py-0.5 flex items-center gap-1">
                    <span className="text-white text-[5px]">Download on the</span>
                    <span className="text-white text-[7px] font-semibold">App Store</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white px-4 py-3 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {/* CRITICAL: Only show "Course en cours" banner for PAYMENT ISSUES with card payments */}
          {activeOrderData?.hasActiveOrder && activeOrderData.order && 
           activeOrderData.order.paymentMethod === "card" &&
           (activeOrderData.order.status === "payment_pending" || activeOrderData.order.status === "payment_failed") && (
            <button
              onClick={() => setLocation("/cartes-bancaires")}
              className="w-full mb-3 flex items-center gap-3 bg-[#ff6b6b] hover:bg-[#ff5252] rounded-xl px-4 py-3 shadow-md transition-colors"
              data-testid="button-payment-issue"
            >
              <div className="bg-white/80 rounded-full p-2">
                <Car className="w-5 h-5 text-[#343434]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-semibold text-sm">Paiement requis</p>
                <p className="text-white/80 text-xs">
                  {activeOrderData.order.status === "payment_pending" && "Veuillez finaliser le paiement"}
                  {activeOrderData.order.status === "payment_failed" && "Le paiement a échoué - réessayez"}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setLocation("/reservation")}
              className="flex-1 flex items-center gap-3 bg-[#f6f6f6] rounded-full px-4 py-3 shadow-sm cursor-pointer hover:bg-[#efefef] transition-colors"
              data-testid="button-reservation"
            >
              <Search className="w-5 h-5 text-[#5c5c5c]" />
              <span className="flex-1 text-left text-[#8c8c8c] text-sm font-medium">
                Où allez-vous ?
              </span>
            </button>
            <button
              onClick={() => setLocation("/map-picker?type=destination&returnTo=/reservation")}
              className="bg-[#ffdf6d] hover:bg-[#ffd84f] rounded-xl w-12 h-12 flex items-center justify-center shadow-md transition-colors"
              data-testid="button-map-picker"
            >
              <Map className="w-5 h-5 text-[#5c5c5c]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
