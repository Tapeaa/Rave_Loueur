import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Menu, MessageCircle, Briefcase, Package, Users, MapPin, X, Tag, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/AuthContext";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";

interface AddressField {
  id: string;
  value: string;
  placeId: string | null;
  type: "pickup" | "stop" | "destination";
}

interface RideOption {
  id: string;
  title: string;
  price: number;
  pricePerKm: number;
  routeInfo?: {
    distance: number;
    duration: string;
  };
  paymentMethod?: "cash" | "card";
}

interface Supplement {
  id: string;
  name: string;
  icon: "bagages" | "encombrants";
  price: number;
  quantity: number;
}

const menuItems = [
  { label: "Accueil", href: "/" },
  { label: "Mon profil", href: "/profil" },
  { label: "Mes commandes", href: "/commandes" },
  { label: "Mon wallet", href: "/wallet" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Aide", href: "/aide" },
];

export function CommandeDetails() {
  const [, setLocation] = useLocation();
  const { client } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addresses, setAddresses] = useState<AddressField[]>([]);
  const [passengers, setPassengers] = useState(1);
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([
    { id: "bagages", name: "Bagages volumineux", icon: "bagages", price: 300, quantity: 0 },
    { id: "encombrants", name: "Objets encombrants", icon: "encombrants", price: 500, quantity: 0 },
  ]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  
  const VALID_PROMO_CODE = "TEST95";
  const PROMO_DISCOUNT = 0.95;

  useEffect(() => {
    const saved = sessionStorage.getItem("reservationAddresses");
    if (saved) {
      try {
        setAddresses(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing addresses:", e);
        setLocation("/reservation");
      }
    } else {
      setLocation("/reservation");
    }

    const savedRide = sessionStorage.getItem("selectedRideOption");
    if (savedRide) {
      try {
        setSelectedRide(JSON.parse(savedRide));
      } catch (e) {
        console.error("Error parsing ride option:", e);
      }
    }
  }, [setLocation]);

  const pickup = addresses.find(a => a.type === "pickup");
  const destination = addresses.find(a => a.type === "destination");

  const truncateAddress = (address: string, maxLength: number = 35) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  const updateSupplementQuantity = (id: string, delta: number) => {
    setSupplements(prev => prev.map(s => {
      if (s.id === id) {
        const newQty = Math.max(0, Math.min(5, s.quantity + delta));
        return { ...s, quantity: newQty };
      }
      return s;
    }));
  };

  const getBasePrice = () => {
    if (!selectedRide) return 2300;
    return selectedRide.price;
  };

  const getDistancePrice = () => {
    if (!selectedRide?.routeInfo || !selectedRide.pricePerKm) return 0;
    return Math.round(selectedRide.routeInfo.distance * selectedRide.pricePerKm);
  };

  const getSupplementsTotal = () => {
    return supplements.reduce((acc, s) => acc + (s.price * s.quantity), 0);
  };

  const getSubtotal = () => {
    return getBasePrice() + getDistancePrice() + getSupplementsTotal();
  };
  
  const getDiscount = () => {
    if (promoApplied) {
      return Math.round(getSubtotal() * PROMO_DISCOUNT);
    }
    return 0;
  };
  
  const calculateTotal = () => {
    return getSubtotal() - getDiscount();
  };
  
  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === VALID_PROMO_CODE) {
      setPromoApplied(true);
      setPromoError("");
    } else {
      setPromoError("Code promo invalide");
      setPromoApplied(false);
    }
  };
  
  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoApplied(false);
    setPromoError("");
  };

  const handleValidate = async () => {
    setShowConfirmModal(true);
    setIsSearching(true);

    try {
      // Prepare order data for backend - use authenticated client data
      const orderData = {
        clientName: client ? `${client.firstName} ${client.lastName}` : "Client",
        clientPhone: client?.phone || "+689 00 00 00 00",
        addresses: addresses.map(addr => ({
          ...addr,
          lat: undefined,
          lng: undefined,
        })),
        rideOption: selectedRide ? {
          id: selectedRide.id,
          title: selectedRide.title,
          price: selectedRide.price,
          pricePerKm: selectedRide.pricePerKm,
        } : {
          id: "taxi-immediat",
          title: "Taxi immédiat",
          price: 2300,
          pricePerKm: 150,
        },
        routeInfo: selectedRide?.routeInfo,
        passengers,
        supplements: supplements.filter(s => s.quantity > 0),
        paymentMethod: selectedRide?.paymentMethod || "card", // Default to card to avoid cash fallback if possible
        totalPrice: calculateTotal(),
        driverEarnings: Math.round(calculateTotal() * 0.8),
        scheduledTime: selectedRide?.id === "reservation" ? sessionStorage.getItem("scheduledTime") : null,
        isAdvanceBooking: selectedRide?.id === "reservation",
      };

      // Send order to backend
      const response = await apiRequest("POST", "/api/orders", orderData);
      
      if (response.ok) {
        const result = await response.json();
        
        // Store order info for waiting page - real driver matching
        sessionStorage.setItem("currentOrderId", result.order.id);
        sessionStorage.setItem("orderTotal", calculateTotal().toString());
        sessionStorage.setItem("orderPickup", pickup?.value || "");
        sessionStorage.setItem("orderDestination", destination?.value || "");
        
        // Store the client token for secure authentication
        if (result.clientToken) {
          sessionStorage.setItem("clientToken", result.clientToken);
        }
        
        // Store payment method for later processing
        // The actual payment will be processed when the ride is completed
        if (orderData.paymentMethod === "card") {
          sessionStorage.setItem("paymentMethod", "card");
          sessionStorage.setItem("paymentStatus", "pending");
        } else {
          sessionStorage.setItem("paymentMethod", "cash");
          sessionStorage.setItem("paymentStatus", "cash");
        }
        
        // Navigate to waiting page - will wait for real driver via socket
        setShowConfirmModal(false);
        setIsSearching(false);
        sessionStorage.removeItem("reservationAddresses");
        sessionStorage.removeItem("selectedRideOption");
        sessionStorage.removeItem("routeInfo");
        setLocation("/commande-success");
      } else {
        throw new Error("Failed to create order");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      setShowConfirmModal(false);
      setShowErrorModal(true);
      setIsSearching(false);
    }
  };

  const handleCancelSearch = () => {
    setShowConfirmModal(false);
    setIsSearching(false);
  };

  const handleCancel = () => {
    setLocation("/commande-options");
  };

  return (
    <div 
      className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 overflow-hidden flex flex-col"
      style={{ height: '100dvh' }}
    >
      <header className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-10" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
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

        <Link href="/support">
          <Button 
            size="icon" 
            className="bg-[#ff6b6b] hover:bg-[#ff5252] rounded-full w-10 h-10"
            data-testid="button-support"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </Button>
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-48">
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h3 className="font-bold text-[#343434] text-sm mb-3">Votre trajet</h3>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="flex-1 text-sm text-[#343434]">
                {pickup?.value ? truncateAddress(pickup.value) : "Non défini"}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="flex-1 text-sm text-[#343434]">
                {destination?.value ? truncateAddress(destination.value) : "Non défini"}
              </span>
            </div>
          </div>

          {selectedRide?.routeInfo && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
              <span className="text-xs text-[#8c8c8c] bg-[#f6f6f6] px-2 py-1 rounded-full">
                {selectedRide.routeInfo.distance.toFixed(1)} km
              </span>
              <span className="text-xs text-[#8c8c8c] bg-[#f6f6f6] px-2 py-1 rounded-full">
                {selectedRide.routeInfo.duration}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#ffdf6d]" />
              <span className="font-bold text-[#343434] text-sm">Nombre de passagers</span>
            </div>
            <span className="text-2xl font-bold text-[#343434]">{passengers}</span>
          </div>
          
          <div className="relative">
            <div className="h-3 bg-gradient-to-r from-[#343434] via-[#ffdf6d] to-[#343434] rounded-full"></div>
            <Slider
              value={[passengers]}
              onValueChange={(value) => setPassengers(value[0])}
              min={1}
              max={8}
              step={1}
              className="absolute inset-0"
              data-testid="slider-passengers"
            />
          </div>
          
          <div className="flex justify-between mt-2 px-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <button
                key={num}
                onClick={() => setPassengers(num)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  passengers === num
                    ? "bg-[#ffdf6d] text-[#343434] shadow-md scale-110"
                    : "bg-[#f6f6f6] text-[#8c8c8c] hover:bg-[#e8e8e8]"
                }`}
                data-testid={`passenger-${num}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-[#ffdf6d]" />
            <span className="font-bold text-[#343434] text-sm">Code promo</span>
          </div>
          
          {promoApplied ? (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700 font-medium">
                  Code {VALID_PROMO_CODE} applique (-95%)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemovePromo}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                data-testid="button-remove-promo"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Entrez votre code"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoError("");
                }}
                className="flex-1"
                data-testid="input-promo-code"
              />
              <Button
                onClick={handleApplyPromo}
                className="bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-medium"
                disabled={!promoCode.trim()}
                data-testid="button-apply-promo"
              >
                Appliquer
              </Button>
            </div>
          )}
          
          {promoError && (
            <p className="text-red-500 text-xs mt-2">{promoError}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <p className="font-bold text-[#343434] text-sm mb-3">Supplements</p>
          
          <div className="space-y-3">
            {supplements.map((supplement) => (
              <div 
                key={supplement.id}
                className="flex items-center justify-between p-3 bg-[#f6f6f6] rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffdf6d]/30 flex items-center justify-center">
                    {supplement.icon === "bagages" && <Briefcase className="w-5 h-5 text-[#5c5c5c]" />}
                    {supplement.icon === "encombrants" && <Package className="w-5 h-5 text-[#5c5c5c]" />}
                  </div>
                  <div>
                    <span className="text-sm text-[#343434] font-medium">{supplement.name}</span>
                    <span className="text-xs text-[#8c8c8c] block">+{supplement.price} XPF/unité</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-full border-[#ccc]"
                    onClick={() => updateSupplementQuantity(supplement.id, -1)}
                    disabled={supplement.quantity === 0}
                    data-testid={`supplement-${supplement.id}-minus`}
                  >
                    <span className="text-lg font-bold">-</span>
                  </Button>
                  <span className="w-6 text-center font-bold text-[#343434]">{supplement.quantity}</span>
                  <Button
                    size="icon"
                    className="w-8 h-8 rounded-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434]"
                    onClick={() => updateSupplementQuantity(supplement.id, 1)}
                    disabled={supplement.quantity === 5}
                    data-testid={`supplement-${supplement.id}-plus`}
                  >
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#343434] rounded-2xl p-4">
          <h3 className="text-white font-bold text-sm mb-3">Détail du prix</h3>
          
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Prix de base</span>
              <span className="text-white">{getBasePrice().toLocaleString()} XPF</span>
            </div>
            
            {selectedRide?.routeInfo && selectedRide.pricePerKm > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/70">
                  Distance ({selectedRide.routeInfo.distance.toFixed(1)} km x {selectedRide.pricePerKm} XPF)
                </span>
                <span className="text-white">{getDistancePrice().toLocaleString()} XPF</span>
              </div>
            )}
            
            {getSupplementsTotal() > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Supplements</span>
                <span className="text-white">+{getSupplementsTotal().toLocaleString()} XPF</span>
              </div>
            )}
            
            {promoApplied && (
              <div className="flex justify-between text-sm">
                <span className="text-green-400">Reduction TEST95 (-95%)</span>
                <span className="text-green-400">-{getDiscount().toLocaleString()} XPF</span>
              </div>
            )}
          </div>
          
          <div className="border-t border-white/20 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">Total estime</span>
              <div className="text-right">
                {promoApplied && (
                  <span className="text-white/50 line-through text-sm mr-2">
                    {getSubtotal().toLocaleString()} XPF
                  </span>
                )}
                <span className="text-[#ffdf6d] font-bold text-xl">{calculateTotal().toLocaleString()} XPF</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-gray-100 p-4 pb-6 space-y-2 z-20">
        <Button
          className="w-full h-12 rounded-xl bg-[#ffdf6d] text-[#343434] font-bold text-sm hover:bg-[#ffd84f]"
          onClick={handleValidate}
          data-testid="button-validate"
        >
          Valider la course - {calculateTotal().toLocaleString()} XPF
        </Button>
        <Button
          variant="ghost"
          className="w-full h-10 rounded-xl text-[#8c8c8c] font-medium text-sm"
          onClick={handleCancel}
          data-testid="button-cancel"
        >
          Retour
        </Button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-[320px] w-full text-center">
            <h3 className="font-bold text-[#343434] text-lg mb-2">
              Recherche d'un chauffeur
            </h3>
            <p className="text-[#8c8c8c] text-sm mb-4">
              Nous recherchons le chauffeur le plus proche de vous...
            </p>
            
            <div className="my-6 relative">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 border-4 border-[#ffdf6d]/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#ffdf6d] rounded-full border-t-transparent animate-spin"></div>
                <img 
                  src={logoImage} 
                  alt="TĀPE'A" 
                  className="h-10 w-auto absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                />
              </div>
            </div>

            <p className="text-xs text-[#8c8c8c] mb-4">
              Vous recevrez un SMS dès qu'un chauffeur sera trouvé
            </p>
            
            <Button
              variant="outline"
              className="w-full h-10 rounded-xl border border-[#ccc] text-[#8c8c8c] font-medium text-sm"
              onClick={handleCancelSearch}
              data-testid="button-modal-cancel"
            >
              Annuler la recherche
            </Button>
          </div>
        </div>
      )}

      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-[320px] w-full text-center">
            <div className="my-4 flex justify-center">
              <div className="w-16 h-16 bg-[#ff6b6b]/20 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-[#ff6b6b]" />
              </div>
            </div>
            
            <h3 className="font-bold text-[#343434] text-lg mb-2">
              Aucun chauffeur disponible
            </h3>
            <p className="text-[#8c8c8c] text-sm mb-4">
              Nous sommes désolés, aucun chauffeur n'est disponible pour le moment. Veuillez réessayer dans quelques minutes.
            </p>
            
            <div className="space-y-2">
              <Button
                className="w-full h-10 rounded-xl bg-[#ffdf6d] text-[#343434] font-semibold text-sm"
                onClick={() => {
                  setShowErrorModal(false);
                  handleValidate();
                }}
                data-testid="button-retry"
              >
                Réessayer
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 rounded-xl text-[#8c8c8c] font-medium text-sm"
                onClick={() => {
                  setShowErrorModal(false);
                  setLocation("/");
                }}
                data-testid="button-error-cancel"
              >
                Retour à l'accueil
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
