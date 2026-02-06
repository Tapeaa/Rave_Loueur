import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, MapPin, Clock, User, Car, CreditCard, CheckCircle, Navigation, Loader2, Banknote, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, useParams } from "wouter";
import { GoogleMap, DirectionsRenderer, Marker } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";

interface AddressField {
  id: string;
  value: string;
  placeId: string | null;
  type: "pickup" | "stop" | "destination";
  lat?: number;
  lng?: number;
}

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  averageRating: number | null;
}

interface ClientInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  averageRating: number | null;
}

interface Invoice {
  id: string;
  clientId: string;
  orderId: string;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  pdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  addresses: AddressField[];
  rideOption: {
    id: string;
    title: string;
    price: number;
    pricePerKm: number;
  };
  routeInfo?: { distance: number; duration: string };
  passengers: number;
  totalPrice: number;
  driverEarnings: number;
  paymentMethod: "cash" | "card";
  status: string;
  assignedDriverId: string | null;
  createdAt: string;
  driver?: DriverInfo | null;
  client?: ClientInfo | null;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
};

interface CourseDetailsProps {
  isChauffeur?: boolean;
}

function InvoiceDownloadButton({ orderId, invoice }: { orderId: string; invoice: Invoice | null | undefined }) {
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  
  const generateInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/stripe/generate-invoice/${orderId}`);
      return response.json();
    },
    onSuccess: (data) => {
      const pdfUrl = data.pdfUrl || data.invoice?.pdfUrl;
      if (pdfUrl) {
        setGeneratedPdfUrl(pdfUrl);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/stripe/invoice/order', orderId] });
    }
  });

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pdfUrl = invoice?.pdfUrl || generatedPdfUrl;

  if (pdfUrl) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <Button
          className="w-full bg-[#343434] hover:bg-[#222222] text-white font-medium"
          onClick={() => handleDownload(pdfUrl)}
          data-testid="button-download-invoice"
        >
          <Download className="w-4 h-4 mr-2" />
          Telecharger la facture
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <Button
        className="w-full bg-[#343434] hover:bg-[#222222] text-white font-medium"
        onClick={() => generateInvoiceMutation.mutate()}
        disabled={generateInvoiceMutation.isPending}
        data-testid="button-generate-invoice"
      >
        {generateInvoiceMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generation en cours...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Generer la facture
          </>
        )}
      </Button>
    </div>
  );
}

export function CourseDetails({ isChauffeur = false }: CourseDetailsProps) {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded } = useGoogleMaps();

  const { data: order, isLoading, error } = useQuery<Order | null>({
    queryKey: ['/api/orders', courseId],
    queryFn: getQueryFn<Order | null>({ on401: "returnNull" }),
    enabled: !!courseId,
  });

  const { data: invoice } = useQuery<Invoice | null>({
    queryKey: ['/api/stripe/invoice/order', courseId, isChauffeur ? 'driver' : 'client'],
    queryFn: getQueryFn<Invoice | null>({ on401: "returnNull" }),
    enabled: !!courseId && !isChauffeur,
    staleTime: 0,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (isLoaded && order && order.addresses.length >= 2) {
      const pickup = order.addresses.find(a => a.type === "pickup");
      const destination = order.addresses.find(a => a.type === "destination");
      
      if (pickup?.placeId && destination?.placeId) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
          {
            origin: { placeId: pickup.placeId },
            destination: { placeId: destination.placeId },
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

  if (isLoading) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#343434]" />
      </div>
    );
  }

  if (!order || error) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-[#f8f8f8] flex flex-col items-center justify-center p-6" style={{ height: "100dvh" }}>
        <div className="w-16 h-16 bg-[#ffdf6d]/20 rounded-full flex items-center justify-center mb-4">
          <Car className="w-8 h-8 text-[#8c8c8c]" />
        </div>
        <p className="text-[#343434] font-semibold text-center mb-2">Course non disponible</p>
        <p className="text-[#8c8c8c] text-sm text-center mb-6">
          Cette course n'existe pas ou a été supprimée
        </p>
        <Button 
          className="bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
          onClick={() => setLocation(isChauffeur ? "/chauffeur/courses" : "/commandes")}
          data-testid="button-go-back"
        >
          Retour aux courses
        </Button>
      </div>
    );
  }

  const backPath = isChauffeur ? "/chauffeur/courses" : "/commandes";
  
  const pickup = order.addresses.find(a => a.type === "pickup");
  const destination = order.addresses.find(a => a.type === "destination");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isCompleted = ["completed", "payment_confirmed"].includes(order.status);
  const isPaymentPending = order.status === "payment_pending";
  const isPaymentFailed = order.status === "payment_failed";
  const isCancelled = ["cancelled", "driver_cancelled", "client_cancelled"].includes(order.status);
  const isActiveRide = ["accepted", "driver_arrived", "in_progress", "payment_pending"].includes(order.status);

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
          onClick={() => setLocation(backPath)}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
        <h1 className="text-lg font-semibold text-[#343434]">Détails de la course</h1>
      </header>

      <div className="h-[200px] relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={12}
            center={{ lat: -17.5334, lng: -149.5667 }}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  polylineOptions: {
                    strokeColor: "#343434",
                    strokeWeight: 4,
                  },
                  suppressMarkers: true,
                }}
              />
            )}
            {directions?.routes[0]?.legs[0]?.start_location && (
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
              />
            )}
            {directions?.routes[0]?.legs[0]?.end_location && (
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
              />
            )}
          </GoogleMap>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-200 to-blue-100 flex items-center justify-center">
            <Navigation className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3 bg-white/95 rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between text-sm gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-700 font-medium text-xs truncate max-w-[80px]">
                {pickup?.value?.split(',')[0] || "Départ"}
              </span>
            </div>
            <div className="flex-1 flex items-center gap-1 justify-center">
              <div className="h-0.5 w-4 bg-[#343434]" />
              <span className="text-gray-500 text-xs whitespace-nowrap">
                {order.routeInfo?.distance ? `${order.routeInfo.distance.toFixed(1)} km` : "--"}
              </span>
              <div className="h-0.5 w-4 bg-[#343434]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-medium text-xs truncate max-w-[80px]">
                {destination?.value?.split(',')[0] || "Arrivée"}
              </span>
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <Badge className={isCompleted ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
            <CheckCircle className="w-3 h-3 mr-1" />
            {isCompleted ? "Course terminée" : "En cours"}
          </Badge>
          <span className="text-2xl font-bold text-[#343434]">
            {isChauffeur ? order.driverEarnings.toLocaleString() : order.totalPrice.toLocaleString()} XPF
          </span>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Itinéraire
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-[#8c8c8c]">Point de départ</p>
                <p className="text-[#343434] font-medium">{pickup?.value || "Non spécifié"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-[#8c8c8c]">Destination</p>
                <p className="text-[#343434] font-medium">{destination?.value || "Non spécifié"}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Informations du trajet
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[#8c8c8c]">Date</p>
              <p className="text-[#343434] font-medium">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Heure</p>
              <p className="text-[#343434] font-medium">{formatTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Distance</p>
              <p className="text-[#343434] font-medium">
                {order.routeInfo?.distance ? `${order.routeInfo.distance.toFixed(1)} km` : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Durée</p>
              <p className="text-[#343434] font-medium">{order.routeInfo?.duration || "--"}</p>
            </div>
          </div>
        </Card>

        {isChauffeur ? (
          <Card className="p-4">
            <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Client
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#ffdf6d] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#343434]" />
              </div>
              <div className="flex-1">
                <p className="text-[#343434] font-medium">
                  {order.client?.name || order.clientName}
                </p>
                <p className="text-xs text-[#8c8c8c]">
                  {order.client?.phone || order.clientPhone}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
                <Car className="w-4 h-4" />
                Type de course
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#343434] rounded-full flex items-center justify-center">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[#343434] font-medium">{order.rideOption.title}</p>
                  <p className="text-xs text-[#8c8c8c]">{order.passengers} passager(s)</p>
                </div>
              </div>
            </Card>
            
            {order.driver && (
              <Card className="p-4">
                <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Chauffeur
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#343434] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[#343434] font-medium">{order.driver.name}</p>
                    <p className="text-xs text-[#8c8c8c]">{order.driver.phone}</p>
                    {order.driver.vehicleModel && (
                      <p className="text-xs text-[#8c8c8c]">
                        {order.driver.vehicleModel}
                        {order.driver.vehicleColor && ` - ${order.driver.vehicleColor}`}
                        {order.driver.vehiclePlate && ` (${order.driver.vehiclePlate})`}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Paiement
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {order.paymentMethod === "card" ? (
                <CreditCard className="w-5 h-5 text-[#8c8c8c]" />
              ) : (
                <Banknote className="w-5 h-5 text-[#8c8c8c]" />
              )}
              <div>
                <p className="text-xs text-[#8c8c8c]">Mode de paiement</p>
                <p className="text-[#343434] font-medium">
                  {order.paymentMethod === "card" ? "Carte bancaire" : "Espèces"}
                </p>
              </div>
            </div>
            <Badge className={
              isCompleted ? "bg-green-100 text-green-700" : 
              isCancelled ? "bg-gray-100 text-gray-700" :
              isPaymentFailed ? "bg-red-100 text-red-700" :
              isPaymentPending ? "bg-orange-100 text-orange-700" :
              isActiveRide ? "bg-yellow-100 text-yellow-700" :
              "bg-gray-100 text-gray-600"
            }>
              {isCompleted ? "Payé" : 
               isCancelled ? "Annulée" :
               isPaymentFailed ? "Échec" :
               isPaymentPending ? "En attente" :
               isActiveRide ? "En cours" :
               "En attente"}
            </Badge>
          </div>
          
          {!isChauffeur && order.paymentMethod === "card" && isCompleted && (
            <InvoiceDownloadButton orderId={order.id} invoice={invoice} />
          )}
        </Card>

        {isActiveRide && (
          <Button 
            className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold mb-2"
            onClick={() => setLocation(isChauffeur ? "/chauffeur/course-en-cours" : "/course-en-cours")}
            data-testid="button-go-to-active-ride"
          >
            Retourner à la course en cours
          </Button>
        )}

        <Button 
          className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
          onClick={() => setLocation(isChauffeur ? "/chauffeur" : "/")}
          data-testid="button-new-course"
        >
          {isChauffeur ? "Retour à l'accueil" : "Nouvelle course"}
        </Button>
      </div>
    </div>
  );
}
