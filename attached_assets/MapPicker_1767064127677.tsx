import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { GoogleMap } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

import pickupIcon from "@assets/Icone acpp  (3)_1764128777202.png";
import destinationIcon from "@assets/Icone acpp  (5)_1764128777201.png";
import stopIcon from "@assets/Icone acpp  (4)_1764128777202.png";

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
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 18 }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }, { lightness: 21 }]
  },
  {
    featureType: "all",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  }
];

export function MapPicker() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const fieldType = params.get("type") || "destination";
  const fieldId = params.get("id") || "";
  const returnTo = params.get("returnTo") || "/reservation";
  
  const [address, setAddress] = useState<string>("");
  const [placeId, setPlaceId] = useState<string>("");
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [currentCenter, setCurrentCenter] = useState(defaultCenter);
  const [isMoving, setIsMoving] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter({ lat: latitude, lng: longitude });
          setCurrentCenter({ lat: latitude, lng: longitude });
        },
        () => {
          setMapCenter(defaultCenter);
          setCurrentCenter(defaultCenter);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  const geocodePosition = useCallback((lat: number, lng: number) => {
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          setAddress(results[0].formatted_address);
          setPlaceId(results[0].place_id);
        } else {
          setAddress("");
          setPlaceId("");
        }
      });
    }
  }, []);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleCenterChanged = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) {
        setCurrentCenter({ lat: center.lat(), lng: center.lng() });
      }
    }
  }, []);

  const handleDragStart = useCallback(() => {
    setIsMoving(true);
    setAddress("");
    setPlaceId("");
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsMoving(false);
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) {
        const lat = center.lat();
        const lng = center.lng();
        setCurrentCenter({ lat, lng });
        geocodePosition(lat, lng);
      }
    }
  }, [geocodePosition]);

  const handleConfirm = () => {
    if (address && placeId) {
      const data = {
        lat: currentCenter.lat,
        lng: currentCenter.lng,
        address,
        placeId,
        fieldType,
        fieldId,
      };
      sessionStorage.setItem("mapPickerResult", JSON.stringify(data));
      setLocation(returnTo);
    }
  };

  const getTypeLabel = () => {
    switch (fieldType) {
      case "pickup": return "Sélectionnez votre point de départ";
      case "destination": return "Sélectionnez votre destination";
      case "stop": return "Sélectionnez un arrêt";
      default: return "Sélectionnez un point";
    }
  };

  const getTypeColor = () => {
    switch (fieldType) {
      case "pickup": return "text-green-500";
      case "destination": return "text-green-500";
      case "stop": return "text-red-400";
      default: return "text-[#5c5c5c]";
    }
  };

  const getMarkerIcon = () => {
    switch (fieldType) {
      case "pickup": return pickupIcon;
      case "destination": return destinationIcon;
      case "stop": return stopIcon;
      default: return destinationIcon;
    }
  };

  if (!isLoaded) {
    return (
      <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto animate-pulse">
            <img src={destinationIcon} alt="Loading" className="w-full h-full object-contain" />
          </div>
          <p className="text-[#5c5c5c] mt-2">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-white via-white/90 to-transparent pb-8" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(returnTo)}
            className="bg-white/90 shadow-md rounded-full flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#5c5c5c]" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${getTypeColor()} truncate`}>
              {getTypeLabel()}
            </p>
            <p className="text-xs text-[#8c8c8c] truncate">
              Déplacez la carte pour viser
            </p>
          </div>
        </div>
      </div>

      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={mapCenter}
          zoom={16}
          onLoad={handleMapLoad}
          onCenterChanged={handleCenterChanged}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
            styles: mapStyles,
          }}
        />
      </div>

      <div 
        className="absolute left-1/2 top-1/2 z-30 pointer-events-none"
        style={{ 
          transform: `translate(-50%, -100%) ${isMoving ? 'translateY(-10px)' : 'translateY(0)'}`,
          transition: 'transform 0.15s ease-out'
        }}
      >
        <img 
          src={getMarkerIcon()} 
          alt="Marker" 
          className="w-16 h-auto drop-shadow-lg"
          style={{
            filter: isMoving ? 'brightness(1.1)' : 'none'
          }}
        />
      </div>

      <div 
        className="absolute left-1/2 top-1/2 z-25 pointer-events-none"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div className="w-2 h-2 bg-black/20 rounded-full" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-[20px] shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="p-4 pb-12">
          {address && !isMoving ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-1 w-8 h-8 flex-shrink-0">
                  <img src={getMarkerIcon()} alt="" className="w-full h-auto" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[#8c8c8c] mb-1">Adresse sélectionnée</p>
                  <p className="text-[#343434] font-medium text-sm leading-tight">
                    {address}
                  </p>
                </div>
              </div>
              <Button
                className="w-full h-12 rounded-xl bg-[#343434] border-0 shadow-md text-white font-semibold hover:bg-[#222]"
                onClick={handleConfirm}
                data-testid="button-confirm-location"
              >
                <Check className="w-5 h-5 mr-2" />
                Confirmer cette adresse
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-10 h-10 mx-auto mb-2 opacity-40">
                <img src={getMarkerIcon()} alt="" className="w-full h-auto" />
              </div>
              <p className="text-[#8c8c8c] text-sm">
                {isMoving ? "Relâchez pour sélectionner ce point" : "Déplacez la carte pour choisir un point"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
