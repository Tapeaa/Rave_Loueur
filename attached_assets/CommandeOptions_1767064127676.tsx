import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { GoogleMap, DirectionsRenderer, Marker } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Menu, MapPin, ChevronDown, Users, CreditCard, Banknote, Check, Plus, Loader2 } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PaymentMethod } from "@shared/schema";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";

import iconTaxiImmediat from "@assets/1_1764131703346.png";
import iconReservation from "@assets/2_1764131703346.png";
import iconTour from "@assets/3_1764131703346.png";

import iconCarte from "@assets/6_1764076802813.png";
import iconWallet from "@assets/9_1764076802813.png";
import iconCommande from "@assets/7_1764076802813.png";

import markerDepart from "@assets/Icone acpp  (3)_1764132915723.png";
import markerArrivee from "@assets/Icone acpp  (5)_1764132915723.png";
import markerStop from "@assets/Icone acpp  (4)_1764132915723.png";

function getCardIcon(brand: string) {
  switch (brand.toLowerCase()) {
    case "visa":
      return <SiVisa className="w-6 h-4 text-blue-600" />;
    case "mastercard":
      return <SiMastercard className="w-6 h-4 text-orange-500" />;
    case "amex":
      return <SiAmericanexpress className="w-6 h-4 text-blue-500" />;
    default:
      return <CreditCard className="w-5 h-5 text-muted-foreground" />;
  }
}

interface AddressField {
  id: string;
  value: string;
  placeId: string | null;
  type: "pickup" | "stop" | "destination";
}

interface RideOption {
  id: string;
  title: string;
  duration: string;
  capacity: string;
  price: number;
  priceLabel: string;
  pricePerKm: number;
  icon: string;
  selected?: boolean;
}

const rideOptions: RideOption[] = [
  {
    id: "immediate",
    title: "Taxi immédiat",
    duration: "10 - 20 min",
    capacity: "1 - 8",
    price: 2300,
    priceLabel: "Tarif jour",
    pricePerKm: 150,
    icon: iconTaxiImmediat,
  },
  {
    id: "reservation",
    title: "Réservation à l'avance",
    duration: "45 - 1h",
    capacity: "1 - 8",
    price: 2300,
    priceLabel: "Tarif jour",
    pricePerKm: 150,
    icon: iconReservation,
  },
  {
    id: "tour",
    title: "Tour de l'Île",
    duration: "45 - 1h",
    capacity: "4 - 8",
    price: 30000,
    priceLabel: "Tarif jour",
    pricePerKm: 0,
    icon: iconTour,
  },
];

const mapStyles = [
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a3ccff" }, { lightness: 20 }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }, { lightness: 20 }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }, { lightness: 17 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 18 }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 16 }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e8f0e8" }, { lightness: 21 }] },
  { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

const menuItems = [
  { label: "Accueil", href: "/" },
  { label: "Mon profil", href: "/profil" },
  { label: "Mes commandes", href: "/commandes" },
  { label: "Mon wallet", href: "/wallet" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Aide", href: "/aide" },
];

const categoryTabs = [
  { id: "carte", label: "Carte", icon: iconCarte },
  { id: "wallet", label: "Porte feuille", icon: iconWallet },
  { id: "commande", label: "commande", icon: iconCommande },
];

export function CommandeOptions() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addresses, setAddresses] = useState<AddressField[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>("immediate");
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const { isLoaded } = useGoogleMaps();
  const { client } = useAuth();
  const { toast } = useToast();
  
  const { data: paymentMethods = [], isLoading: cardsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/stripe/payment-methods", client?.id],
    enabled: !!client?.id,
  });

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedCardId) {
      const defaultCard = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
      setSelectedCardId(defaultCard.id);
    }
  }, [paymentMethods, selectedCardId]);

  useEffect(() => {
    if (!client && paymentMethod === "card") {
      setPaymentMethod("cash");
      setSelectedCardId(null);
    }
  }, [client, paymentMethod]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchEnd - touchStart;
    
    if (diff > 50) {
      setPanelExpanded(false);
    } else if (diff < -50) {
      setPanelExpanded(true);
    }
    
    setTouchStart(null);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("reservationAddresses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAddresses(parsed);
      } catch (e) {
        console.error("Error parsing addresses:", e);
        setLocation("/reservation");
      }
    } else {
      setLocation("/reservation");
    }

    const savedRoute = sessionStorage.getItem("routeInfo");
    if (savedRoute) {
      try {
        setRouteInfo(JSON.parse(savedRoute));
      } catch (e) {
        console.error("Error parsing route info:", e);
      }
    }
  }, [setLocation]);

  const calculateRoute = useCallback(async () => {
    if (!isLoaded || !window.google || addresses.length < 2) return;

    const pickup = addresses.find(a => a.type === "pickup");
    const destination = addresses.find(a => a.type === "destination");
    const stops = addresses.filter(a => a.type === "stop");

    if (!pickup?.placeId || !destination?.placeId) return;

    const directionsService = new google.maps.DirectionsService();

    try {
      const result = await directionsService.route({
        origin: { placeId: pickup.placeId },
        destination: { placeId: destination.placeId },
        waypoints: stops
          .filter(s => s.placeId)
          .map(s => ({ location: { placeId: s.placeId! }, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
      });
      setDirections(result);

      if (result.routes[0]?.legs) {
        let totalDistance = 0;
        let totalDuration = 0;
        result.routes[0].legs.forEach(leg => {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        });
        const distanceKm = totalDistance / 1000;
        const durationMin = Math.round(totalDuration / 60);
        const info = {
          distance: distanceKm,
          duration: durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ''}`
        };
        setRouteInfo(info);
        sessionStorage.setItem("routeInfo", JSON.stringify(info));
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  }, [isLoaded, addresses]);

  useEffect(() => {
    if (isLoaded && addresses.length >= 2) {
      calculateRoute();
    }
  }, [isLoaded, addresses, calculateRoute]);

  const handleContinue = () => {
    if (paymentMethod === "card" && !selectedCardId) {
      toast({
        title: "Mode de paiement requis",
        description: "Veuillez sélectionner une carte ou choisir le paiement en espèces",
        variant: "destructive",
      });
      setShowPaymentSheet(true);
      return;
    }
    
    const selectedRide = rideOptions.find(o => o.id === selectedOption);
    const selectedCard = paymentMethods.find(m => m.id === selectedCardId);
    sessionStorage.setItem("selectedRideOption", JSON.stringify({
      ...selectedRide,
      routeInfo,
      paymentMethod,
      selectedCardId: paymentMethod === "card" ? selectedCardId : null,
      selectedCardLast4: paymentMethod === "card" && selectedCard ? selectedCard.last4 : null,
    }));
    setLocation("/commande-details");
  };

  const handleCancel = () => {
    setLocation("/reservation");
  };

  const pickup = addresses.find(a => a.type === "pickup");
  const destination = addresses.find(a => a.type === "destination");

  const truncateAddress = (address: string, maxLength: number = 22) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  const formatPrice = (price: number) => {
    if (price >= 10000) {
      return (price / 1000).toFixed(0) + ".000";
    }
    return price.toLocaleString("fr-FR");
  };

  return (
    <div 
      className="bg-white w-full max-w-[420px] mx-auto fixed inset-0 overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button 
              size="icon" 
              className="bg-transparent hover:bg-black/10 rounded-full w-10 h-10"
              data-testid="button-menu"
            >
              <Menu className="w-6 h-6 text-[#343434]" strokeWidth={2.5} />
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
          className="h-[55px] w-auto object-contain"
        />

        <div className="w-10" />
      </header>

      <div className="absolute z-10 px-3 left-0 right-0" style={{ top: 'calc(max(12px, env(safe-area-inset-top)) + 60px)' }}>
        <div className="space-y-2">
          <div className="bg-[#ffdf6d] rounded-full px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="bg-white text-[#343434] px-3 py-1 rounded-md text-xs font-bold">Départ</span>
            <span className="flex-1 text-sm text-[#343434] font-medium truncate">
              {pickup?.value ? truncateAddress(pickup.value) : "Adresse de départ"}
            </span>
            <button 
              className="text-[#343434]"
              onClick={() => setLocation("/reservation")}
              data-testid="button-edit-pickup"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button 
              className="bg-white rounded-md p-2"
              onClick={() => setLocation("/map-picker?type=pickup&returnTo=/commande-options")}
              data-testid="button-map-pickup"
            >
              <MapPin className="w-4 h-4 text-[#343434]" />
            </button>
          </div>

          <div className="bg-[#ffdf6d] rounded-full px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className="bg-white text-[#343434] px-3 py-1 rounded-md text-xs font-bold">Arrivée</span>
            <span className="flex-1 text-sm text-[#343434] font-medium truncate">
              {destination?.value ? truncateAddress(destination.value) : "Adresse d'arrivée"}
            </span>
            <button 
              className="text-[#343434]"
              onClick={() => setLocation("/reservation")}
              data-testid="button-edit-destination"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button 
              className="bg-white rounded-md p-2"
              onClick={() => setLocation("/map-picker?type=destination&returnTo=/commande-options")}
              data-testid="button-map-destination"
            >
              <MapPin className="w-4 h-4 text-[#343434]" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-0">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={{ lat: -17.5334, lng: -149.5667 }}
            zoom={12}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              styles: mapStyles,
              gestureHandling: "greedy",
            }}
          >
            {directions && (
              <>
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: true,
                    polylineOptions: {
                      strokeColor: "#ffdf6d",
                      strokeWeight: 5,
                      strokeOpacity: 0.9,
                    },
                  }}
                />
                {directions.routes[0]?.legs[0]?.start_location && (
                  <Marker
                    position={directions.routes[0].legs[0].start_location}
                    icon={{
                      url: markerDepart,
                      scaledSize: new google.maps.Size(40, 40),
                      anchor: new google.maps.Point(20, 40),
                    }}
                  />
                )}
                {directions.routes[0]?.legs[0]?.end_location && (
                  <Marker
                    position={directions.routes[0].legs[0].end_location}
                    icon={{
                      url: markerArrivee,
                      scaledSize: new google.maps.Size(40, 40),
                      anchor: new google.maps.Point(20, 40),
                    }}
                  />
                )}
              </>
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-blue-200 to-blue-300" />
        )}
      </div>

      <div 
        className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-3xl shadow-lg transition-all duration-300 ease-out"
        style={{ 
          height: panelExpanded ? '42%' : '200px'
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="flex justify-center pt-2 pb-1 cursor-pointer"
          onClick={() => setPanelExpanded(!panelExpanded)}
        >
          <div className="w-10 h-1 bg-[#343434]/40 rounded-full" />
        </div>

        <div className="px-4 space-y-0 overflow-y-auto" style={{ maxHeight: panelExpanded ? 'calc(42vh - 160px)' : '0', opacity: panelExpanded ? 1 : 0, transition: 'all 0.3s ease-out' }}>
          {rideOptions.map((option) => {
            const isSelected = selectedOption === option.id;

            return (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full px-3 py-2 flex items-center gap-3 transition-all rounded-xl ${
                  isSelected
                    ? "bg-[#ffdf6d]/50 shadow-md"
                    : "bg-transparent"
                }`}
                data-testid={`option-${option.id}`}
              >
                <div className="w-14 h-12 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img 
                    src={option.icon} 
                    alt={option.title}
                    className="w-16 h-16 object-contain"
                  />
                </div>

                <div className="flex-1 text-left">
                  <h3 className="font-bold text-[#343434] text-sm">
                    {option.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[#8c8c8c] text-xs">
                    <span>{option.duration}</span>
                    <span className="flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {option.capacity}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-bold text-sm ${isSelected ? "text-[#343434]" : "text-[#8c8c8c]"}`}>
                    {formatPrice(option.price)} XPF
                  </span>
                  <p className="text-[#a0a0a0] text-xs">{option.priceLabel}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Sheet open={showPaymentSheet} onOpenChange={setShowPaymentSheet}>
          <SheetTrigger asChild>
            <button className="px-4 py-2 flex items-center gap-2 text-[#343434] w-full hover-elevate rounded-lg">
              {paymentMethod === "card" ? (
                (() => {
                  const selectedCard = paymentMethods.find(m => m.id === selectedCardId);
                  return selectedCard ? getCardIcon(selectedCard.brand) : <CreditCard className="w-4 h-4 text-[#343434]" />;
                })()
              ) : (
                <Banknote className="w-4 h-4 text-[#343434]" />
              )}
              <span className="text-xs font-medium">
                {paymentMethod === "card" ? (
                  (() => {
                    const selectedCard = paymentMethods.find(m => m.id === selectedCardId);
                    return selectedCard ? `**** ${selectedCard.last4}` : "Carte bancaire";
                  })()
                ) : "Espèces"}
              </span>
              <ChevronDown className="w-3 h-3" />
              <span className="text-[10px] text-[#8c8c8c] ml-auto">à la fin du trajet</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto">
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Mode de paiement</SheetTitle>
              <SheetDescription>Choisissez comment vous souhaitez payer</SheetDescription>
            </SheetHeader>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setPaymentMethod("cash");
                  setShowPaymentSheet(false);
                }}
                className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
                  paymentMethod === "cash" 
                    ? "bg-[#ffdf6d]/30 border-2 border-[#ffdf6d]" 
                    : "bg-gray-50 border-2 border-transparent"
                }`}
                data-testid="payment-cash"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  paymentMethod === "cash" ? "bg-[#ffdf6d]" : "bg-gray-200"
                }`}>
                  <Banknote className="w-6 h-6 text-[#343434]" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-[#343434]">Espèces</p>
                  <p className="text-sm text-[#8c8c8c]">Payer en liquide au chauffeur</p>
                </div>
                {paymentMethod === "cash" && (
                  <Check className="w-5 h-5 text-green-600" />
                )}
              </button>
              
              <div className="border-t border-gray-100 pt-3">
                <p className="text-sm font-medium text-[#343434] mb-2 px-1">Cartes enregistrées</p>
                {!client ? (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-[#8c8c8c] mb-3">Connectez-vous pour payer par carte</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentSheet(false);
                        setLocation("/connexion");
                      }}
                      className="text-sm"
                      data-testid="button-login-redirect"
                    >
                      Se connecter
                    </Button>
                  </div>
                ) : cardsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-[#8c8c8c] mb-3">Aucune carte enregistrée</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPaymentSheet(false);
                        setLocation("/cartes-bancaires");
                      }}
                      className="text-sm"
                      data-testid="button-add-card-redirect"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter une carte
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          setPaymentMethod("card");
                          setSelectedCardId(method.id);
                          setShowPaymentSheet(false);
                        }}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                          paymentMethod === "card" && selectedCardId === method.id
                            ? "bg-[#ffdf6d]/30 border-2 border-[#ffdf6d]" 
                            : "bg-gray-50 border-2 border-transparent"
                        }`}
                        data-testid={`payment-card-${method.id}`}
                      >
                        <div className="flex-shrink-0">
                          {getCardIcon(method.brand)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-[#343434] text-sm">
                            **** {method.last4}
                          </p>
                          <p className="text-xs text-[#8c8c8c]">
                            Expire {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}
                          </p>
                        </div>
                        {method.isDefault && (
                          <span className="bg-[#343434] text-white text-[10px] px-2 py-0.5 rounded-full">
                            Par défaut
                          </span>
                        )}
                        {paymentMethod === "card" && selectedCardId === method.id && (
                          <Check className="w-5 h-5 text-green-600" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowPaymentSheet(false);
                        setLocation("/cartes-bancaires");
                      }}
                      className="w-full p-3 rounded-xl flex items-center gap-3 bg-gray-50 border-2 border-transparent hover-elevate"
                      data-testid="button-manage-cards"
                    >
                      <Plus className="w-5 h-5 text-[#8c8c8c]" />
                      <span className="text-sm text-[#8c8c8c]">Gérer mes cartes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="px-4 pb-3 space-y-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <Button
            className="w-full h-10 rounded-xl bg-[#ffdf6d] border-0 shadow-md text-[#343434] font-bold text-sm hover:bg-[#ffd84f] flex items-center justify-between px-4"
            onClick={handleContinue}
            data-testid="button-continue"
          >
            <span>Poursuivre ma commande</span>
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#343434" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
          </Button>
          
          <Button
            className="w-full h-10 rounded-xl bg-[#343434] text-white font-bold text-sm hover:bg-[#222]"
            onClick={handleCancel}
            data-testid="button-cancel"
          >
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
