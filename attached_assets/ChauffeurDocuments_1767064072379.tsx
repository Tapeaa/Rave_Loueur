import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Download, Eye, CheckCircle, AlertCircle, Clock, Car, Shield, CreditCard, Wrench, User, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface DocumentItem {
  id: number;
  title: string;
  description: string;
  date: string;
  status: "valid" | "expiring" | "expired";
  expiry: string | null;
  icon: LucideIcon;
  category: "conducteur" | "vehicule";
}

const vehicleInfo = {
  marque: "Toyota",
  modele: "Corolla",
  couleur: "Blanc",
  annee: 2022,
  plaque: "123 ABC 987",
  numeroSerie: "JTDKN3DU5A0123456"
};

const driverInfo = {
  nom: "Jean Dupont",
  numeroPermis: "PF-2019-123456",
  categoriePermis: "B",
  dateNaissance: "15/06/1985"
};

const documents: DocumentItem[] = [
  {
    id: 1,
    title: "Permis de conduire",
    description: `Catégorie ${driverInfo.categoriePermis} - N° ${driverInfo.numeroPermis}`,
    date: "15/03/2024",
    status: "valid",
    expiry: "15/03/2029",
    icon: User,
    category: "conducteur"
  },
  {
    id: 2,
    title: "Carte d'identité nationale",
    description: "Pièce d'identité officielle",
    date: "01/02/2024",
    status: "valid",
    expiry: "01/02/2034",
    icon: CreditCard,
    category: "conducteur"
  },
  {
    id: 3,
    title: "Carte grise du véhicule",
    description: `${vehicleInfo.marque} ${vehicleInfo.modele} - ${vehicleInfo.plaque}`,
    date: "01/06/2024",
    status: "valid",
    expiry: null,
    icon: Car,
    category: "vehicule"
  },
  {
    id: 4,
    title: "Attestation d'assurance",
    description: "Assurance tous risques professionnelle",
    date: "01/01/2024",
    status: "expiring",
    expiry: "31/12/2024",
    icon: Shield,
    category: "vehicule"
  },
  {
    id: 5,
    title: "Contrôle technique",
    description: "Visite technique périodique",
    date: "20/09/2024",
    status: "valid",
    expiry: "20/09/2026",
    icon: Wrench,
    category: "vehicule"
  },
  {
    id: 6,
    title: "Extrait de casier judiciaire",
    description: "Bulletin n°3 - Casier vierge",
    date: "01/01/2024",
    status: "valid",
    expiry: "01/01/2025",
    icon: FileText,
    category: "conducteur"
  },
];

export function ChauffeurDocuments() {
  const [, setLocation] = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "conducteur" | "vehicule">("all");

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    if (!isAuth) {
      setLocation("/chauffeur-login");
    } else {
      setIsAuthed(true);
    }
  }, [setLocation]);

  if (!isAuthed) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="w-8 h-8 border-4 border-[#ffdf6d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valide
          </Badge>
        );
      case "expiring":
        return (
          <Badge className="bg-orange-100 text-orange-700">
            <Clock className="w-3 h-3 mr-1" />
            Expire bientôt
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Expiré
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredDocuments = activeTab === "all" 
    ? documents 
    : documents.filter(doc => doc.category === activeTab);

  const validCount = documents.filter(d => d.status === "valid").length;
  const expiringCount = documents.filter(d => d.status === "expiring").length;

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
        <h1 className="text-lg font-semibold text-[#343434]">Mes documents</h1>
      </header>

      <div className="p-4 space-y-4 pb-8">
        <div className="flex gap-2">
          <Card className="flex-1 p-3 bg-green-50 border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-lg font-bold text-green-700">{validCount}</p>
                <p className="text-xs text-green-600">Valides</p>
              </div>
            </div>
          </Card>
          <Card className="flex-1 p-3 bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-lg font-bold text-orange-700">{expiringCount}</p>
                <p className="text-xs text-orange-600">Expirent bientôt</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4" data-testid="vehicle-info-card">
          <h3 className="font-semibold text-[#343434] mb-3 flex items-center gap-2">
            <Car className="w-4 h-4" />
            Mon véhicule
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#8c8c8c]">Marque / Modèle</p>
              <p className="text-[#343434] font-medium">{vehicleInfo.marque} {vehicleInfo.modele}</p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Couleur</p>
              <p className="text-[#343434] font-medium">{vehicleInfo.couleur}</p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Année</p>
              <p className="text-[#343434] font-medium">{vehicleInfo.annee}</p>
            </div>
            <div>
              <p className="text-xs text-[#8c8c8c]">Plaque d'immatriculation</p>
              <p className="text-[#343434] font-bold text-lg">{vehicleInfo.plaque}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-[#8c8c8c]">N° de série (VIN)</p>
            <p className="text-[#343434] font-mono text-sm">{vehicleInfo.numeroSerie}</p>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            className={activeTab === "all" ? "bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434]" : ""}
            onClick={() => setActiveTab("all")}
            data-testid="filter-all"
          >
            Tous
          </Button>
          <Button
            variant={activeTab === "conducteur" ? "default" : "outline"}
            className={activeTab === "conducteur" ? "bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434]" : ""}
            onClick={() => setActiveTab("conducteur")}
            data-testid="filter-driver"
          >
            <User className="w-4 h-4 mr-1" />
            Conducteur
          </Button>
          <Button
            variant={activeTab === "vehicule" ? "default" : "outline"}
            className={activeTab === "vehicule" ? "bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434]" : ""}
            onClick={() => setActiveTab("vehicule")}
            data-testid="filter-vehicle"
          >
            <Car className="w-4 h-4 mr-1" />
            Véhicule
          </Button>
        </div>

        {filteredDocuments.map((doc) => {
          const DocIcon = doc.icon;
          return (
            <Card key={doc.id} className="p-4" data-testid={`document-${doc.id}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  doc.status === "valid" ? "bg-green-100" : 
                  doc.status === "expiring" ? "bg-orange-100" : "bg-red-100"
                }`}>
                  <DocIcon className={`w-5 h-5 ${
                    doc.status === "valid" ? "text-green-600" : 
                    doc.status === "expiring" ? "text-orange-600" : "text-red-600"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[#343434] font-medium">{doc.title}</p>
                      <p className="text-[#8c8c8c] text-sm">{doc.description}</p>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#8c8c8c] flex-wrap">
                    <span>Ajouté le {doc.date}</span>
                    {doc.expiry && (
                      <span className={doc.status === "expiring" ? "text-orange-600 font-medium" : ""}>
                        Expire le {doc.expiry}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="w-4 h-4 mr-1" />
                      Voir
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Download className="w-4 h-4 mr-1" />
                      Mettre à jour
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        <Card className="p-4 bg-[#ffdf6d]/20 border-[#ffdf6d]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#343434] flex-shrink-0 mt-0.5" />
            <p className="text-[#343434] text-sm">
              Gardez tous vos documents à jour pour continuer à recevoir des courses. 
              Les documents expirés peuvent entraîner la suspension temporaire de votre compte.
            </p>
          </div>
        </Card>

        <Button 
          className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
          data-testid="button-add-document"
        >
          Ajouter un document
        </Button>
      </div>
    </div>
  );
}
