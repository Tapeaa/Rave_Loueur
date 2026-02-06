import { useState, useEffect } from "react";
import { ArrowLeft, User, Phone, Mail, Car, FileText, Camera, UserCircle, ChevronRight, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DriverProfile {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  averageRating: number | null;
  totalRides: number;
}

interface ProfileData {
  nom: string;
  telephone: string;
  email: string;
  vehicule: string;
  immatriculation: string;
}

export function ChauffeurProfil() {
  const [, setLocation] = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [editData, setEditData] = useState<ProfileData>({
    nom: "",
    telephone: "",
    email: "",
    vehicule: "",
    immatriculation: ""
  });

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    const driverInfo = sessionStorage.getItem("driverInfo");
    
    if (!isAuth) {
      setLocation("/chauffeur-login");
    } else {
      setIsAuthed(true);
      if (driverInfo) {
        try {
          const info = JSON.parse(driverInfo);
          setDriverId(info.id);
        } catch (e) {
          console.error("Error parsing driver info:", e);
        }
      }
    }
  }, [setLocation]);

  const { data: profileData, isLoading } = useQuery<DriverProfile>({
    queryKey: ['/api/driver/profile', driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const sessionId = sessionStorage.getItem("driverSessionId");
      
      if (!sessionId) throw new Error("No session ID");
      
      const response = await fetch(`/api/driver/profile/${driverId}`, {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      if (!driverId) throw new Error("No driver ID");
      
      const sessionId = sessionStorage.getItem("driverSessionId");
      
      if (!sessionId) throw new Error("No session ID");
      
      const [firstName, ...lastNameParts] = data.nom?.split(" ") || ["", ""];
      const lastName = lastNameParts.join(" ");
      const [vehicleModel, vehicleColor] = data.vehicule?.split(" - ") || ["", ""];
      
      const response = await apiRequest("PATCH", `/api/driver/profile/${driverId}`, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        vehicleModel: vehicleModel || undefined,
        vehicleColor: vehicleColor || undefined,
        vehiclePlate: data.immatriculation || undefined,
      }, {
        "Authorization": `Bearer ${sessionId}`
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/profile', driverId] });
      
      const driverInfo = sessionStorage.getItem("driverInfo");
      if (driverInfo && data.driver) {
        const info = JSON.parse(driverInfo);
        sessionStorage.setItem("driverInfo", JSON.stringify({
          ...info,
          firstName: data.driver.firstName,
          lastName: data.driver.lastName,
          vehicleModel: data.driver.vehicleModel,
          vehicleColor: data.driver.vehicleColor,
          vehiclePlate: data.driver.vehiclePlate,
        }));
      }
      
      toast({
        title: "Profil mis à jour",
        description: "Vos modifications ont été enregistrées.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive",
      });
      console.error("Update error:", error);
    }
  });

  useEffect(() => {
    if (profileData) {
      const fullName = `${profileData.firstName} ${profileData.lastName}`.trim();
      const vehicleInfo = profileData.vehicleModel 
        ? `${profileData.vehicleModel}${profileData.vehicleColor ? ` - ${profileData.vehicleColor}` : ''}`
        : '';
      
      setEditData({
        nom: fullName,
        telephone: profileData.phone || "",
        email: "",
        vehicule: vehicleInfo,
        immatriculation: profileData.vehiclePlate || ""
      });
    }
  }, [profileData]);

  const handleSwitchToClient = () => {
    sessionStorage.removeItem("chauffeurAuth");
    sessionStorage.removeItem("driverSessionId");
    sessionStorage.removeItem("driverInfo");
    setLocation("/");
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profileData) {
      const fullName = `${profileData.firstName} ${profileData.lastName}`.trim();
      const vehicleInfo = profileData.vehicleModel 
        ? `${profileData.vehicleModel}${profileData.vehicleColor ? ` - ${profileData.vehicleColor}` : ''}`
        : '';
      
      setEditData({
        nom: fullName,
        telephone: profileData.phone || "",
        email: "",
        vehicule: vehicleInfo,
        immatriculation: profileData.vehiclePlate || ""
      });
    }
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    updateProfileMutation.mutate(editData);
  };

  if (!isAuthed || isLoading) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#ffdf6d]" />
      </div>
    );
  }

  const displayName = profileData 
    ? `${profileData.firstName} ${profileData.lastName}`.trim() 
    : "Chauffeur";
  
  const displayPhone = profileData?.phone || editData.telephone;
  const displayVehicle = profileData?.vehicleModel 
    ? `${profileData.vehicleModel}${profileData.vehicleColor ? ` - ${profileData.vehicleColor}` : ''}`
    : editData.vehicule;
  const displayPlate = profileData?.vehiclePlate || editData.immatriculation;

  return (
    <div 
      className="relative w-full max-w-[420px] mx-auto bg-[#f8f8f8] overflow-auto"
      style={{ height: "100dvh" }}
    >
      <header 
        className="sticky top-0 z-20 bg-white flex items-center justify-between px-4 py-3 shadow-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => isEditing ? handleCancelEdit() : setLocation("/chauffeur")}
            data-testid="button-back"
          >
            {isEditing ? <X className="w-5 h-5 text-[#343434]" /> : <ArrowLeft className="w-5 h-5 text-[#343434]" />}
          </Button>
          <h1 className="text-lg font-semibold text-[#343434]">
            {isEditing ? "Modifier mon profil" : "Mon profil"}
          </h1>
        </div>
        {isEditing && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSaveEdit}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5 text-green-600" />
            )}
          </Button>
        )}
      </header>

      <div className="p-4 space-y-4 pb-8">
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <div className="w-24 h-24 bg-[#343434] rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-white" />
            </div>
            <button 
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#ffdf6d] rounded-full flex items-center justify-center shadow-md"
              data-testid="button-change-photo"
            >
              <Camera className="w-4 h-4 text-[#343434]" />
            </button>
          </div>
          <h2 className="mt-3 text-xl font-bold text-[#343434]">{displayName || "Chauffeur TAPE'A"}</h2>
          <p className="text-[#8c8c8c] text-sm">
            {profileData?.totalRides ? `${profileData.totalRides} courses effectuées` : "Membre depuis 2024"}
          </p>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Informations personnelles</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#5c5c5c]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8c8c8c]">Nom complet</p>
                {isEditing ? (
                  <Input
                    value={editData.nom}
                    onChange={(e) => setEditData({ ...editData, nom: e.target.value })}
                    className="h-8 mt-1"
                    data-testid="input-nom"
                  />
                ) : (
                  <p className="text-[#343434] font-medium">{displayName || "Non renseigné"}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-[#5c5c5c]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8c8c8c]">Téléphone</p>
                <p className="text-[#343434] font-medium">{displayPhone || "Non renseigné"}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Mon véhicule</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-[#5c5c5c]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8c8c8c]">Véhicule</p>
                {isEditing ? (
                  <Input
                    value={editData.vehicule}
                    onChange={(e) => setEditData({ ...editData, vehicule: e.target.value })}
                    className="h-8 mt-1"
                    placeholder="Modèle - Couleur"
                    data-testid="input-vehicule"
                  />
                ) : (
                  <p className="text-[#343434] font-medium">{displayVehicle || "Non renseigné"}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#5c5c5c]" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#8c8c8c]">Immatriculation</p>
                {isEditing ? (
                  <Input
                    value={editData.immatriculation}
                    onChange={(e) => setEditData({ ...editData, immatriculation: e.target.value })}
                    className="h-8 mt-1"
                    data-testid="input-immatriculation"
                  />
                ) : (
                  <p className="text-[#343434] font-medium">{displayPlate || "Non renseigné"}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {!isEditing && (
          <>
            <Button 
              className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
              onClick={handleStartEdit}
              data-testid="button-edit-profile"
            >
              Modifier mon profil
            </Button>

            <Card 
              className="mt-4 bg-[#343434] cursor-pointer hover-elevate"
              onClick={handleSwitchToClient}
              data-testid="button-switch-to-client"
            >
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#ffdf6d]">
                    <UserCircle className="w-5 h-5 text-[#343434]" />
                  </div>
                  <div>
                    <span className="font-medium text-base text-white">
                      Mode client
                    </span>
                    <p className="text-xs text-gray-400">Revenir à l'interface client</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 flex-shrink-0 text-white" />
              </div>
            </Card>
          </>
        )}

        {isEditing && (
          <div className="flex gap-3">
            <Button 
              variant="outline"
              className="flex-1"
              onClick={handleCancelEdit}
              disabled={updateProfileMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Annuler
            </Button>
            <Button 
              className="flex-1 bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
              onClick={handleSaveEdit}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-changes"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
