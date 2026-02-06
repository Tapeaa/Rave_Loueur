import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Phone, Mail, Loader2, Check, X, Pencil } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function InfoPerso() {
  const { client, isLoading, refreshClient } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  useEffect(() => {
    if (client) {
      setEditData({
        firstName: client.firstName || "",
        lastName: client.lastName || "",
        email: (client as any).email || "",
      });
    }
  }, [client]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      const response = await apiRequest("PATCH", "/api/client/profile", {
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        email: data.email || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      refreshClient();
      toast({
        title: "Profil mis a jour",
        description: "Vos modifications ont ete enregistrees.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le profil.",
        variant: "destructive",
      });
      console.error("Update error:", error);
    }
  });

  const handleSave = () => {
    updateProfileMutation.mutate(editData);
  };

  const handleCancel = () => {
    if (client) {
      setEditData({
        firstName: client.firstName || "",
        lastName: client.lastName || "",
        email: (client as any).email || "",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F5C400]" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader 
        title={isEditing ? "Modifier mes infos" : "Informations personnelles"} 
        showBackButton 
        rightAction={
          isEditing ? (
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={updateProfileMutation.isPending}
                data-testid="button-cancel-edit"
              >
                <X className="w-5 h-5 text-[#343434]" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 text-green-600" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-profile"
            >
              <Pencil className="w-5 h-5 text-[#343434]" />
            </Button>
          )
        }
      />

      <main className="px-4 mt-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-[#ffdf6d] flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-[#5c5c5c]" />
          </div>
          <p className="text-sm text-[#8c8c8c]">Photo de profil</p>
        </div>

        <div className="space-y-4">
          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <User className="w-4 h-4 text-[#ffdf6d]" />
                <span className="text-xs text-[#8c8c8c] uppercase tracking-wide">Prenom</span>
              </div>
              {isEditing ? (
                <Input
                  value={editData.firstName}
                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  className="mt-1 ml-7 bg-white"
                  placeholder="Votre prenom"
                  data-testid="input-firstname"
                />
              ) : (
                <p className="text-[#343434] font-medium text-lg ml-7" data-testid="text-firstname">
                  {client?.firstName || "Non renseigne"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <User className="w-4 h-4 text-[#ffdf6d]" />
                <span className="text-xs text-[#8c8c8c] uppercase tracking-wide">Nom</span>
              </div>
              {isEditing ? (
                <Input
                  value={editData.lastName}
                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  className="mt-1 ml-7 bg-white"
                  placeholder="Votre nom"
                  data-testid="input-lastname"
                />
              ) : (
                <p className="text-[#343434] font-medium text-lg ml-7" data-testid="text-lastname">
                  {client?.lastName || "Non renseigne"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <Phone className="w-4 h-4 text-[#ffdf6d]" />
                <span className="text-xs text-[#8c8c8c] uppercase tracking-wide">Telephone</span>
              </div>
              <p className="text-[#343434] font-medium text-lg ml-7" data-testid="text-phone">
                {client?.phone || "Non renseigne"}
              </p>
              {isEditing && (
                <p className="text-xs text-[#8c8c8c] ml-7 mt-1">
                  Le numero ne peut pas etre modifie
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <Mail className="w-4 h-4 text-[#ffdf6d]" />
                <span className="text-xs text-[#8c8c8c] uppercase tracking-wide">Email</span>
              </div>
              {isEditing ? (
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="mt-1 ml-7 bg-white"
                  placeholder="votre@email.com"
                  data-testid="input-email"
                />
              ) : (
                <p className="text-[#343434] font-medium text-lg ml-7" data-testid="text-email">
                  {(client as any)?.email || "Non renseigne"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {!isEditing && (
          <Button
            className="w-full mt-6 bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
            onClick={() => setIsEditing(true)}
            data-testid="button-edit-profile-main"
          >
            Modifier mes informations
          </Button>
        )}

        {isEditing && (
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
              disabled={updateProfileMutation.isPending}
            >
              Annuler
            </Button>
            <Button 
              className="flex-1 bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
