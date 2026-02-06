import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, MapPin, Navigation, X, Map } from "lucide-react";
import { Autocomplete } from "@react-google-maps/api";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

interface AddressField {
  id: string;
  value: string;
  placeId: string | null;
  type: "pickup" | "stop" | "destination";
}

export function Reservation() {
  const [, setLocation] = useLocation();
  
  const getInitialAddresses = (): AddressField[] => {
    const saved = sessionStorage.getItem("reservationAddresses");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved addresses:", e);
      }
    }
    return [
      { id: "pickup", value: "", placeId: null, type: "pickup" },
      { id: "destination", value: "", placeId: null, type: "destination" },
    ];
  };
  
  const [addresses, setAddresses] = useState<AddressField[]>(getInitialAddresses);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const autocompleteRefs = useRef<{ [key: string]: google.maps.places.Autocomplete | null }>({});

  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    sessionStorage.setItem("reservationAddresses", JSON.stringify(addresses));
  }, [addresses]);

  useEffect(() => {
    const savedResult = sessionStorage.getItem("mapPickerResult");
    if (savedResult) {
      try {
        const data = JSON.parse(savedResult);
        const { address, placeId, fieldType, fieldId } = data;
        
        setAddresses(prev => {
          let updated;
          if (fieldId && prev.find(a => a.id === fieldId)) {
            updated = prev.map(a => 
              a.id === fieldId ? { ...a, value: address, placeId } : a
            );
          } else {
            updated = prev.map(a => 
              a.type === fieldType ? { ...a, value: address, placeId } : a
            );
          }
          return updated;
        });
        
        sessionStorage.removeItem("mapPickerResult");
      } catch (e) {
        console.error("Error parsing map picker result:", e);
      }
    }
  }, []);

  const addStop = () => {
    const stopCount = addresses.filter(a => a.type === "stop").length;
    if (stopCount >= 3) return;
    
    const newStop: AddressField = {
      id: `stop-${Date.now()}`,
      value: "",
      placeId: null,
      type: "stop",
    };
    
    const destinationIndex = addresses.findIndex(a => a.type === "destination");
    const newAddresses = [...addresses];
    newAddresses.splice(destinationIndex, 0, newStop);
    setAddresses(newAddresses);
  };

  const removeStop = (id: string) => {
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const updateAddress = (id: string, value: string, placeId: string | null = null) => {
    setAddresses(prev => prev.map(a => 
      a.id === id ? { ...a, value, placeId } : a
    ));
  };

  const handlePlaceSelect = (id: string) => {
    const autocomplete = autocompleteRefs.current[id];
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.formatted_address && place.place_id) {
        updateAddress(id, place.formatted_address, place.place_id);
      }
    }
  };

  const openMapPicker = (address: AddressField) => {
    const params = new URLSearchParams({
      type: address.type,
      id: address.id,
      returnTo: "/reservation",
    });
    setLocation(`/map-picker?${params.toString()}`);
  };

  const canSubmit = () => {
    const pickup = addresses.find(a => a.type === "pickup");
    const destination = addresses.find(a => a.type === "destination");
    return pickup?.placeId && destination?.placeId;
  };

  const getFieldLabel = (type: string, index?: number) => {
    switch (type) {
      case "pickup": return "Adresse de départ";
      case "destination": return "Adresse d'arrivée";
      case "stop": return `Arrêt ${index}`;
      default: return "";
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "pickup": return <Navigation className="w-5 h-5 text-green-500" />;
      case "destination": return <MapPin className="w-5 h-5 text-red-500" />;
      case "stop": return <div className="w-3 h-3 rounded-full bg-[#ffdf6d] border-2 border-[#5c5c5c]" />;
      default: return null;
    }
  };

  const stopCount = addresses.filter(a => a.type === "stop").length;

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative">
      <div className="sticky top-0 z-20 bg-white" style={{ paddingTop: 'max(0px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            className="text-[#5c5c5c]"
            data-testid="button-back"
          >
            <X className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-[#343434] text-lg">Votre trajet</h1>
          {stopCount < 3 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={addStop}
              className="text-[#5c5c5c]"
              data-testid="button-add-stop"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
          {stopCount >= 3 && <div className="w-9" />}
        </div>
      </div>

      <main className="px-4 py-4 pb-32">
        <div className="relative">
          <div className="absolute left-[17px] top-[40px] bottom-[40px] w-0.5 bg-gradient-to-b from-green-500 via-[#ffdf6d] to-red-500 z-0" />
          
          <div className="space-y-3 relative z-10">
            {addresses.map((address, index) => {
              const stopIndex = address.type === "stop" 
                ? addresses.filter((a, i) => a.type === "stop" && i < index).length + 1 
                : undefined;
              
              return (
                <div key={address.id} className="flex items-start gap-3">
                  <div className="w-[34px] h-[34px] flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 flex-shrink-0 mt-5">
                    {getFieldIcon(address.type)}
                  </div>
                  
                  <div className="flex-1">
                    <label className="text-xs text-[#8c8c8c] mb-1 block">
                      {getFieldLabel(address.type, stopIndex)}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        {isLoaded ? (
                          <Autocomplete
                            onLoad={(autocomplete) => {
                              autocompleteRefs.current[address.id] = autocomplete;
                            }}
                            onPlaceChanged={() => handlePlaceSelect(address.id)}
                            options={{
                              componentRestrictions: { country: "pf" },
                              types: ["geocode", "establishment"],
                            }}
                          >
                            <Input
                              type="text"
                              placeholder={
                                address.type === "pickup" 
                                  ? "D'où partez-vous ?" 
                                  : address.type === "destination"
                                  ? "Où allez-vous ?"
                                  : "Ajouter un arrêt"
                              }
                              value={address.value}
                              onChange={(e) => updateAddress(address.id, e.target.value)}
                              onFocus={() => setFocusedField(address.id)}
                              onBlur={() => setFocusedField(null)}
                              className={`w-full border-0 bg-[#f6f6f6] rounded-lg px-3 py-3 text-[#343434] placeholder:text-[#aaa] focus-visible:ring-2 focus-visible:ring-[#ffdf6d] ${
                                address.placeId ? "bg-green-50" : ""
                              }`}
                              data-testid={`input-${address.type}${stopIndex ? `-${stopIndex}` : ""}`}
                            />
                          </Autocomplete>
                        ) : (
                          <Input
                            type="text"
                            placeholder="Chargement..."
                            disabled
                            className="w-full border-0 bg-[#f6f6f6] rounded-lg px-3 py-3"
                          />
                        )}
                      </div>
                      
                      <button
                        onClick={() => openMapPicker(address)}
                        className="bg-[#ffdf6d] hover:bg-[#ffd84f] rounded-lg w-11 h-11 flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
                        data-testid={`button-map-${address.type}${stopIndex ? `-${stopIndex}` : ""}`}
                      >
                        <Map className="w-5 h-5 text-[#5c5c5c]" />
                      </button>
                      
                      {address.type === "stop" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStop(address.id)}
                          className="text-[#8c8c8c] hover:text-red-500 flex-shrink-0"
                          data-testid={`button-remove-stop-${stopIndex}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {stopCount < 3 && (
          <button
            onClick={addStop}
            className="mt-4 flex items-center gap-2 text-[#5c5c5c] text-sm hover:text-[#343434] transition-colors"
            data-testid="button-add-stop-inline"
          >
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-[#8c8c8c] flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </div>
            <span>Ajouter un arrêt</span>
          </button>
        )}

        <div className="mt-6 p-4 bg-[#f8f8f8] rounded-xl">
          <h3 className="font-semibold text-[#343434] text-sm mb-3">Récapitulatif du trajet</h3>
          <div className="space-y-2">
            {addresses.map((address, index) => {
              if (!address.value) return null;
              const stopIndex = address.type === "stop" 
                ? addresses.filter((a, i) => a.type === "stop" && i < index).length + 1 
                : undefined;
              return (
                <div key={address.id} className="flex items-start gap-2 min-w-0">
                  <div className="mt-1 flex-shrink-0">
                    {address.type === "pickup" && <div className="w-2 h-2 rounded-full bg-green-500" />}
                    {address.type === "stop" && <div className="w-2 h-2 rounded-full bg-[#ffdf6d]" />}
                    {address.type === "destination" && <div className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs text-[#8c8c8c]">
                      {getFieldLabel(address.type, stopIndex)}
                    </p>
                    <p className="text-sm text-[#343434] font-medium truncate max-w-full">
                      {address.value}
                    </p>
                  </div>
                  {address.placeId && (
                    <div className="text-green-500 text-xs flex-shrink-0">Validé</div>
                  )}
                </div>
              );
            })}
            {!addresses.some(a => a.value) && (
              <p className="text-[#8c8c8c] text-sm text-center py-2">
                Aucune adresse sélectionnée
              </p>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-gray-100 p-4 pb-8 z-20">
        <Button
          className={`w-full h-12 rounded-xl font-semibold text-base ${
            canSubmit()
              ? "bg-[#343434] text-white hover:bg-[#222]"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!canSubmit()}
          onClick={() => {
            if (canSubmit()) {
              setLocation("/commande-options");
            }
          }}
          data-testid="button-commander"
        >
          Commandez mon chauffeur
        </Button>
        <p className="text-center text-xs text-[#8c8c8c] mt-2">
          Sélectionnez votre départ et destination pour continuer
        </p>
      </div>
    </div>
  );
}
