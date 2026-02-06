import { useState, useEffect } from "react";
import { ArrowLeft, Clock, CheckCircle, XCircle, Car, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  addresses: { id: string; value: string; type: "pickup" | "stop" | "destination" }[];
  totalPrice: number;
  driverEarnings: number;
  status: string;
  createdAt: string;
  routeInfo?: { distance: number; duration: string };
}

export function ChauffeurCourses() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [isAuthed, setIsAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    // Use sessionId which now checks both memory AND database on server
    const storedSessionId = sessionStorage.getItem("driverSessionId");
    
    if (!isAuth) {
      setLocation("/chauffeur-login");
    } else {
      setIsAuthed(true);
      setSessionId(storedSessionId);
    }
  }, [setLocation]);

  const { data: ordersData, isLoading } = useQuery<Order[] | null>({
    queryKey: ['/api/driver/orders', sessionId],
    queryFn: getQueryFn<Order[] | null>({ on401: "returnNull" }),
    enabled: isAuthed && !!sessionId,
    staleTime: 0,
    gcTime: 0, // Don't cache at all
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Sort orders by createdAt descending (newest first)
  const orders = (ordersData ?? []).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filteredOrders = orders.filter(order => {
    if (filter === "all") return true;
    if (filter === "completed") {
      return ["completed", "payment_confirmed"].includes(order.status);
    }
    if (filter === "cancelled") {
      return ["cancelled", "expired", "payment_failed"].includes(order.status);
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getPickup = (order: Order) => {
    const pickup = order.addresses.find(a => a.type === "pickup");
    return pickup?.value || "Départ inconnu";
  };

  const getDestination = (order: Order) => {
    const dest = order.addresses.find(a => a.type === "destination");
    return dest?.value || "Destination inconnue";
  };

  const isCompleted = (status: string) => {
    return ["completed", "payment_confirmed"].includes(status);
  };

  if (!isAuthed) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="w-8 h-8 border-4 border-[#ffdf6d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="relative w-full max-w-[420px] mx-auto bg-[#f8f8f8] overflow-auto"
      style={{ height: "100dvh" }}
    >
      <header 
        className="sticky top-0 z-20 bg-white flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/chauffeur")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
        <h1 className="text-lg font-semibold text-[#343434]">Mes courses</h1>
      </header>

      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            className={filter === "all" ? "bg-[#343434] text-white" : ""}
            onClick={() => setFilter("all")}
            data-testid="filter-all"
          >
            Toutes
          </Button>
          <Button
            size="sm"
            variant={filter === "completed" ? "default" : "outline"}
            className={filter === "completed" ? "bg-[#343434] text-white" : ""}
            onClick={() => setFilter("completed")}
            data-testid="filter-completed"
          >
            Terminées
          </Button>
          <Button
            size="sm"
            variant={filter === "cancelled" ? "default" : "outline"}
            className={filter === "cancelled" ? "bg-[#343434] text-white" : ""}
            onClick={() => setFilter("cancelled")}
            data-testid="filter-cancelled"
          >
            Annulées
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#343434]" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Aucune course pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredOrders.map((order) => (
              <Card 
                key={order.id} 
                className={`p-4 ${isCompleted(order.status) ? "cursor-pointer hover-elevate" : ""}`}
                onClick={() => isCompleted(order.status) && setLocation(`/chauffeur/course/${order.id}`)}
                data-testid={`course-${order.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8c8c8c]" />
                    <span className="text-sm text-[#8c8c8c]">{formatDate(order.createdAt)} à {formatTime(order.createdAt)}</span>
                  </div>
                  <Badge 
                    variant={isCompleted(order.status) ? "default" : "destructive"}
                    className={isCompleted(order.status) ? "bg-green-100 text-green-700" : ""}
                  >
                    {isCompleted(order.status) ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Terminée</>
                    ) : (
                      <><XCircle className="w-3 h-3 mr-1" /> Annulée</>
                    )}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-[#8c8c8c]">Départ</p>
                      <p className="text-[#343434] font-medium text-sm">{getPickup(order)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                    <div>
                      <p className="text-xs text-[#8c8c8c]">Arrivée</p>
                      <p className="text-[#343434] font-medium text-sm">{getDestination(order)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-[#8c8c8c] text-sm">Gains</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#343434] font-bold text-lg">{order.driverEarnings.toLocaleString()} XPF</span>
                    {isCompleted(order.status) && (
                      <span className="text-xs text-green-600 font-medium">Voir détails</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
