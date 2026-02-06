import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { X, Navigation } from "lucide-react";
import { 
  connectSocket, 
  joinClientSession, 
  onDriverAssigned, 
  disconnectSocket 
} from "@/lib/socket";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";

export function CommandeSuccess() {
  const [, setLocation] = useLocation();
  const [pickup, setPickup] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const storedOrderId = sessionStorage.getItem("currentOrderId");
    const storedPickup = sessionStorage.getItem("orderPickup");
    const storedDestination = sessionStorage.getItem("orderDestination");
    
    if (!storedOrderId) {
      setLocation("/");
      return;
    }
    
    setPickup(storedPickup || "");
    setDestination(storedDestination || "");

    // Connect socket and join order room with client token for authentication
    const storedClientToken = sessionStorage.getItem("clientToken");
    connectSocket();
    joinClientSession(storedOrderId, storedClientToken || undefined);

    // Listen for driver assignment via WebSocket
    const unsubDriverAssigned = onDriverAssigned((data) => {
      console.log("Driver assigned via WebSocket:", data);
      if (data.orderId === storedOrderId) {
        sessionStorage.setItem("assignedDriverName", data.driverName);
        sessionStorage.setItem("assignedDriverId", data.driverId);
        setLocation("/course-en-cours");
      }
    });

    // HTTP polling fallback for mobile browsers that may lose WebSocket connection
    let isRedirecting = false;
    
    const checkOrderStatus = async () => {
      if (isRedirecting) return; // Prevent duplicate redirects
      
      try {
        // Use active/client endpoint which returns enriched order with driver info
        const response = await fetch('/api/orders/active/client', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          // If order is accepted and has driver, redirect to course-en-cours
          if (data.hasActiveOrder && data.order && 
              (data.order.status === "accepted" || data.order.status === "driver_arrived" || 
               data.order.status === "in_progress")) {
            isRedirecting = true;
            console.log("Driver assigned via HTTP polling:", data.order);
            
            // Clear polling interval before redirect
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            // Store driver info from order
            if (data.order.driverName) {
              sessionStorage.setItem("assignedDriverName", data.order.driverName);
            }
            if (data.order.assignedDriverId) {
              sessionStorage.setItem("assignedDriverId", data.order.assignedDriverId);
            }
            // Store client token if returned
            if (data.clientToken) {
              sessionStorage.setItem("clientToken", data.clientToken);
            }
            
            setLocation("/course-en-cours");
          }
        }
      } catch (error) {
        console.error("Error checking order status:", error);
      }
    };

    // Poll every 3 seconds as backup
    pollingIntervalRef.current = setInterval(checkOrderStatus, 3000);

    return () => {
      unsubDriverAssigned();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [setLocation]);

  const handleCancel = () => {
    sessionStorage.removeItem("currentOrderId");
    sessionStorage.removeItem("orderTotal");
    sessionStorage.removeItem("orderPickup");
    sessionStorage.removeItem("orderDestination");
    sessionStorage.removeItem("clientToken"); // Clean up client token
    disconnectSocket();
    setLocation("/");
  };

  const truncateAddress = (address: string, maxLength: number = 30) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + "...";
  };

  return (
      <div 
        className="bg-[#f8f8f8] w-full max-w-[420px] mx-auto fixed inset-0 overflow-hidden flex flex-col"
        style={{ height: '100dvh' }}
      >
        <header 
          className="bg-white px-4 py-3 flex items-center justify-center shadow-sm"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <img 
            src={logoImage} 
            alt="TĀPE'A" 
            className="h-[50px] w-auto object-contain"
          />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto relative mb-6">
              <div className="absolute inset-0 border-4 border-[#ffdf6d]/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#ffdf6d] rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Navigation className="w-10 h-10 text-[#343434]" />
              </div>
            </div>

            <h1 className="text-xl font-bold text-[#343434] mb-2">
              Recherche d'un chauffeur
            </h1>
            <p className="text-[#8c8c8c] text-sm">
              Nous recherchons le chauffeur le plus proche...
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 w-full mb-8">
            <h3 className="font-semibold text-[#343434] text-sm mb-3">Votre trajet</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                <span className="text-sm text-[#343434]">{truncateAddress(pickup)}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                <span className="text-sm text-[#343434]">{truncateAddress(destination)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#8c8c8c] text-center mb-6">
            Vous recevrez une notification dès qu'un chauffeur acceptera votre course
          </p>

          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border border-[#ccc] text-[#8c8c8c] font-medium"
            onClick={handleCancel}
            data-testid="button-cancel-search"
          >
            <X className="w-4 h-4 mr-2" />
            Annuler la recherche
          </Button>
        </main>
      </div>
  );
}
