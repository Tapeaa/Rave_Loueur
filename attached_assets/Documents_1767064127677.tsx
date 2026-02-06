import { ArrowLeft, FileText, Download, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

const documents = [
  {
    id: 1,
    title: "Conditions générales d'utilisation",
    description: "CGU de la plateforme TĀPE'A",
    date: "01/01/2024",
    status: "accepted"
  },
  {
    id: 2,
    title: "Politique de confidentialité",
    description: "Protection de vos données personnelles",
    date: "01/01/2024",
    status: "accepted"
  },
  {
    id: 3,
    title: "Grille tarifaire",
    description: "Tarifs en vigueur pour les courses",
    date: "15/11/2024",
    status: "info"
  },
  {
    id: 4,
    title: "Guide utilisateur",
    description: "Comment utiliser l'application",
    date: "01/06/2024",
    status: "info"
  },
];

export function Documents() {
  const [, setLocation] = useLocation();

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
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
        <h1 className="text-lg font-semibold text-[#343434]">Documents</h1>
      </header>

      <div className="p-4 space-y-3 pb-8">
        <p className="text-[#8c8c8c] text-sm mb-4">
          Retrouvez ici tous les documents légaux et informations importantes.
        </p>

        {documents.map((doc) => (
          <Card key={doc.id} className="p-4" data-testid={`document-${doc.id}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#f0f0f0] rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-[#5c5c5c]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[#343434] font-medium">{doc.title}</p>
                    <p className="text-[#8c8c8c] text-sm">{doc.description}</p>
                  </div>
                  {doc.status === "accepted" && (
                    <Badge className="bg-green-100 text-green-700 flex-shrink-0">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Accepté
                    </Badge>
                  )}
                </div>
                <p className="text-[#8c8c8c] text-xs mt-2">Mis à jour le {doc.date}</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Eye className="w-4 h-4 mr-1" />
                    Voir
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Download className="w-4 h-4 mr-1" />
                    Télécharger
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
