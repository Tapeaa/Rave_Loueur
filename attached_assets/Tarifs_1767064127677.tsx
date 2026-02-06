import { PageHeader } from "@/components/PageHeader";
import { ArrowRight, Check, Briefcase, Package, Dog, X, Clock, Car, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TarifPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function TarifPopup({ isOpen, onClose, title, children }: TarifPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[360px] rounded-[15px] p-0 overflow-hidden">
        <div className="bg-[#ffdf6d] p-4">
          <DialogHeader>
            <DialogTitle className="text-[#343434] font-bold text-lg">{title}</DialogTitle>
            <DialogDescription className="sr-only">Détails des tarifs</DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 bg-white">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Tarifs() {
  const [activePopup, setActivePopup] = useState<string | null>(null);

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Tarifs" showBackButton />

      <main className="px-4">
        <div className="bg-[#f6f6f6] rounded-[10px] py-3 px-4 mb-6 text-center">
          <p className="text-[#5c5c5c] text-base">
            <span className="font-medium">Grille tarifaire </span>
            <span className="font-extrabold text-[#343434]">TĀPE'A</span>
          </p>
        </div>

        <Card className="bg-[#f8f8f8] rounded-[10px] border-0 shadow-none mb-4">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="font-semibold text-[#5c5c5c] text-base">Prise en charge</span>
            <span className="font-bold text-[#343434] text-lg">1 000 F</span>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button 
            className="bg-[#ffdf6d] text-[#5c5c5c] font-semibold text-sm h-11 rounded-[10px] hover:bg-[#ffd84f] flex items-center justify-center gap-2"
            onClick={() => setActivePopup("jour")}
            data-testid="button-tarifs-jour"
          >
            Tarifs de jour
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button 
            className="bg-[#343434] text-white font-semibold text-sm h-11 rounded-[10px] hover:bg-[#222] flex items-center justify-center gap-2"
            onClick={() => setActivePopup("nuit")}
            data-testid="button-tarifs-nuit"
          >
            Tarifs de nuit
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <Button 
          className="w-full bg-[#fff4cc] text-[#5c5c5c] font-semibold text-sm h-11 rounded-[10px] hover:bg-[#ffecb3] flex items-center justify-between px-4 mb-4"
          onClick={() => setActivePopup("hauteur")}
          data-testid="button-majoration-hauteur"
        >
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4" />
            <span>Majoration hauteur</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <p className="font-semibold text-[#5c5c5c] text-sm mb-3">Suppléments</p>
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button 
            className="bg-[#f5f5f5] text-[#5c5c5c] font-medium text-xs h-10 rounded-[10px] hover:bg-gray-200 flex items-center justify-center gap-1.5"
            onClick={() => setActivePopup("bagages")}
            data-testid="button-bagages"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Bagages</span>
          </Button>
          <Button 
            className="bg-[#f5f5f5] text-[#5c5c5c] font-medium text-xs h-10 rounded-[10px] hover:bg-gray-200 flex items-center justify-center gap-1.5"
            onClick={() => setActivePopup("encombrant")}
            data-testid="button-encombrant"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Encombrant</span>
          </Button>
          <Button 
            className="bg-[#f5f5f5] text-[#5c5c5c] font-medium text-xs h-10 rounded-[10px] hover:bg-gray-200 flex items-center justify-center gap-1.5"
            onClick={() => setActivePopup("animaux")}
            data-testid="button-animaux"
          >
            <Dog className="w-3.5 h-3.5" />
            <span>Animaux</span>
          </Button>
        </div>

        <Button 
          className="w-full bg-[#fff4cc] text-[#5c5c5c] font-semibold text-sm h-11 rounded-[10px] hover:bg-[#ffecb3] flex items-center justify-between px-4 mb-3"
          onClick={() => setActivePopup("attente")}
          data-testid="button-attente"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Temps d'attente</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button 
          className="w-full bg-[#fff4cc] text-[#5c5c5c] font-semibold text-sm h-11 rounded-[10px] hover:bg-[#ffecb3] flex items-center justify-between px-4 mb-4"
          onClick={() => setActivePopup("vehicule")}
          data-testid="button-vehicule"
        >
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4" />
            <span>Taille du véhicule</span>
          </div>
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Card className="bg-[#343434] rounded-[10px] border-0 shadow-none mb-4">
          <CardContent className="p-3 flex items-center justify-center">
            <span className="font-semibold text-white text-base">+ 10% de frais TĀPE'A</span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-[#ffdf6d] to-[#ffd84f] rounded-[10px] border-0 shadow-none">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-[#343434] text-base flex items-center gap-2 mb-1">
                TĀPE'A <span className="font-black">PREMIUM</span>
              </h3>
              <p className="text-[#5c5c5c] text-xs leading-tight">
                Profitez d'avantages exclusifs et déplacez-vous en toute sérénité.
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-white" />
            </div>
          </CardContent>
        </Card>
      </main>

      <TarifPopup 
        isOpen={activePopup === "jour"} 
        onClose={() => setActivePopup(null)}
        title="Tarifs de jour (6h - 20h)"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Prix au kilomètre</span>
            <span className="font-bold text-[#343434]">150 F/km</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Minimum de course</span>
            <span className="font-bold text-[#343434]">1 500 F</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Prise en charge</span>
            <span className="font-bold text-[#343434]">1 000 F</span>
          </div>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "nuit"} 
        onClose={() => setActivePopup(null)}
        title="Tarifs de nuit (20h - 6h)"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Prix au kilomètre</span>
            <span className="font-bold text-[#343434]">200 F/km</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Minimum de course</span>
            <span className="font-bold text-[#343434]">2 000 F</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Prise en charge</span>
            <span className="font-bold text-[#343434]">1 500 F</span>
          </div>
          <p className="text-xs text-[#8c8c8c] mt-2">
            Majoration de 50% applicable entre 20h et 6h du matin.
          </p>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "hauteur"} 
        onClose={() => setActivePopup(null)}
        title="Majoration hauteur"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Zone colline (200-400m)</span>
            <span className="font-bold text-[#343434]">+20%</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Zone montagne (400m+)</span>
            <span className="font-bold text-[#343434]">+30%</span>
          </div>
          <p className="text-xs text-[#8c8c8c] mt-2">
            Majoration appliquée pour les trajets en altitude.
          </p>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "bagages"} 
        onClose={() => setActivePopup(null)}
        title="Supplément bagages"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Bagage cabine</span>
            <span className="font-bold text-[#343434]">Gratuit</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Valise standard</span>
            <span className="font-bold text-[#343434]">200 F</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Grande valise</span>
            <span className="font-bold text-[#343434]">400 F</span>
          </div>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "encombrant"} 
        onClose={() => setActivePopup(null)}
        title="Supplément encombrant"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Colis volumineux</span>
            <span className="font-bold text-[#343434]">500 F</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Objet très encombrant</span>
            <span className="font-bold text-[#343434]">1 000 F</span>
          </div>
          <p className="text-xs text-[#8c8c8c] mt-2">
            Selon disponibilité du véhicule adapté.
          </p>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "animaux"} 
        onClose={() => setActivePopup(null)}
        title="Supplément animaux"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Petit animal (cage)</span>
            <span className="font-bold text-[#343434]">300 F</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Animal moyen/grand</span>
            <span className="font-bold text-[#343434]">500 F</span>
          </div>
          <p className="text-xs text-[#8c8c8c] mt-2">
            Les animaux doivent être tenus en laisse ou en cage.
          </p>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "attente"} 
        onClose={() => setActivePopup(null)}
        title="Temps d'attente"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">5 premières minutes</span>
            <span className="font-bold text-[#343434]">Gratuit</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Par minute après</span>
            <span className="font-bold text-[#343434]">50 F/min</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Circulation dense</span>
            <span className="font-bold text-[#343434]">30 F/min</span>
          </div>
        </div>
      </TarifPopup>

      <TarifPopup 
        isOpen={activePopup === "vehicule"} 
        onClose={() => setActivePopup(null)}
        title="Taille du véhicule"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">Berline (4 places)</span>
            <span className="font-bold text-[#343434]">Standard</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-[#5c5c5c]">SUV (5 places)</span>
            <span className="font-bold text-[#343434]">+15%</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[#5c5c5c]">Van (7+ places)</span>
            <span className="font-bold text-[#343434]">+25%</span>
          </div>
        </div>
      </TarifPopup>
    </div>
  );
}
