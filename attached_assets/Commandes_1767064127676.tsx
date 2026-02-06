import { PageHeader } from "@/components/PageHeader";
import { Check, Car, MapPin, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getQueryFn } from "@/lib/queryClient";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  addresses: { id: string; value: string; type: "pickup" | "stop" | "destination" }[];
  totalPrice: number;
  status: string;
  createdAt: string;
  routeInfo?: { distance: number; duration: string };
}

const filterButtons = [
  { label: "En cours", value: "active", active: false },
  { label: "Terminée", value: "completed", active: true },
  { label: "Annulée", value: "cancelled", active: false },
];

export function Commandes() {
  const [showFullMap, setShowFullMap] = useState(false);
  const [activeFilter, setActiveFilter] = useState("completed");
  const [, setLocation] = useLocation();
  const { client, isAuthenticated } = useAuth();

  const { data: ordersData, isLoading } = useQuery<Order[] | null>({
    queryKey: ['/api/client/orders'],
    queryFn: getQueryFn<Order[] | null>({ on401: "returnNull" }),
    enabled: isAuthenticated,
  });
  
  const orders = ordersData ?? [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDestination = (order: Order) => {
    const dest = order.addresses.find(a => a.type === "destination");
    return dest?.value || "Destination inconnue";
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === "active") {
      return ["pending", "accepted", "driver_enroute", "driver_arrived", "in_progress", "payment_pending"].includes(order.status);
    } else if (activeFilter === "completed") {
      return ["completed", "payment_confirmed"].includes(order.status);
    } else if (activeFilter === "cancelled") {
      return ["cancelled", "expired", "payment_failed"].includes(order.status);
    }
    return true;
  });

  const lastOrder = orders.length > 0 ? orders[0] : null;

  const handleCourseClick = (orderId: string) => {
    setLocation(`/course/${orderId}`);
  };

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Mes commandes" />

      <main className="px-4">
        <div className="flex items-start justify-between mb-4 gap-2">
          <Badge className="bg-[#ffd84ede] text-[#222222] font-black text-2xl leading-[29px] h-[60px] px-4 rounded-[5px] hover:bg-[#ffd84ede] flex items-center gap-2">
            <Car className="w-6 h-6 text-[#434343]" />
            {orders.length}
            <span className="font-medium text-neutral-800 text-xl leading-[30px]">
              trajets
            </span>
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#F5C400]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Aucune commande pour le moment</p>
            <Button 
              className="mt-4 bg-[#F5C400] text-black hover:bg-[#e0b400]"
              onClick={() => setLocation("/reservation")}
            >
              Réserver une course
            </Button>
          </div>
        ) : (
          <>
            {lastOrder && (
              <section className="mb-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <span className="font-medium text-[#5c5c5c] text-base leading-[29px]">
                    Votre dernier trajet
                  </span>
                  <span className="font-medium text-[#5c5c5c] text-base leading-[29px]">
                    {formatDate(lastOrder.createdAt).split(',')[0]}
                  </span>
                </div>

                <Card 
                  className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none mb-6 cursor-pointer group overflow-visible"
                  onClick={() => setShowFullMap(!showFullMap)}
                  data-testid={`card-last-order-${lastOrder.id}`}
                >
                  <CardContent className="p-0 relative">
                    <div className={`relative transition-all duration-300 ${showFullMap ? 'h-[220px]' : 'h-[136px]'} rounded-[10px] overflow-hidden`}>
                      {GOOGLE_MAPS_API_KEY ? (
                        <img
                          className="w-full h-full object-cover"
                          alt="Trajet sur la carte"
                          src={`https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=roadmap&center=-17.5562,-149.5150&zoom=12&path=color:0x000000ff|weight:5|-17.5350,-149.5695|-17.5774,-149.4605&markers=color:0x2ecc71|label:A|-17.5350,-149.5695&markers=color:0xe74c3c|label:B|-17.5774,-149.4605&key=${GOOGLE_MAPS_API_KEY}`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-200 to-blue-100 flex items-center justify-center">
                          <MapPin className="w-8 h-8 text-blue-400" />
                        </div>
                      )}
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ffdf6d] to-[#ffd84f]" />
                      
                      <div className="absolute bottom-2 right-2 bg-white/90 rounded-full p-2 shadow-md group-hover:bg-[#ffdf6d] transition-colors">
                        <MapPin className="w-4 h-4 text-[#5c5c5c]" />
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 rounded-md px-3 py-1.5">
                        <span className="text-white text-xs font-medium">
                          {showFullMap ? 'Réduire' : 'Voir le trajet'}
                        </span>
                      </div>
                      
                      {showFullMap && (
                        <div className="absolute top-2 left-2 right-2 bg-white/95 rounded-lg p-3 shadow-lg">
                          <div className="flex items-center justify-between text-sm gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500" />
                              <span className="text-gray-700 font-medium truncate max-w-[80px]">
                                {lastOrder.addresses.find(a => a.type === "pickup")?.value.split(',')[0] || "Départ"}
                              </span>
                            </div>
                            <div className="flex-1 h-0.5 bg-black mx-2" />
                            <span className="text-gray-500 text-xs">
                              {lastOrder.routeInfo?.distance ? `${lastOrder.routeInfo.distance.toFixed(1)} KM` : "--"}
                            </span>
                            <div className="flex-1 h-0.5 bg-black mx-2" />
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700 font-medium truncate max-w-[80px]">
                                {getDestination(lastOrder).split(',')[0]}
                              </span>
                              <div className="w-3 h-3 rounded-full bg-red-500" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            <section>
              <div className="flex items-center gap-2 mb-4">
                {filterButtons.map((btn) => (
                  <Button
                    key={btn.value}
                    data-testid={`button-filter-${btn.value}`}
                    className={`h-8 px-3 rounded-full font-medium text-sm ${
                      activeFilter === btn.value
                        ? "bg-[#343434] text-white hover:bg-[#343434]"
                        : "bg-[#e8e8e8] text-[#343434] hover:bg-[#e8e8e8]"
                    }`}
                    onClick={() => setActiveFilter(btn.value)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {filteredOrders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucune commande dans cette catégorie</p>
                ) : (
                  filteredOrders.map((order) => (
                    <Card 
                      key={order.id} 
                      className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none cursor-pointer group overflow-visible"
                      onClick={() => handleCourseClick(order.id)}
                      data-testid={`card-order-${order.id}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#222222] text-base truncate">
                              {getDestination(order)}
                            </span>
                            {order.status === "completed" && (
                              <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5">
                                <Check className="w-3 h-3 mr-1" />
                                Terminée
                              </Badge>
                            )}
                          </div>
                          <p className="text-[#5c5c5c] text-sm">
                            {formatDate(order.createdAt)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>Prix: {order.totalPrice.toLocaleString()} XPF</span>
                            {order.routeInfo?.distance && (
                              <span>{order.routeInfo.distance.toFixed(1)} KM</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#F5C400] transition-colors" />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
