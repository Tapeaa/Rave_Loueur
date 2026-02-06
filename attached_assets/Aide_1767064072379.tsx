import { PageHeader } from "@/components/PageHeader";
import { MessageCircle, Mail, Phone, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function Aide() {
  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Centre d'aide" showBackButton />

      <main className="px-4">
        <Card className="bg-[#ffdf6d] rounded-[10px] border-0 shadow-none mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <HelpCircle className="w-8 h-8 text-[#5c5c5c]" />
              <h2 className="font-bold text-[#434343] text-xl">Comment pouvons-nous vous aider ?</h2>
            </div>
            <p className="text-[#5c5c5c] text-sm leading-relaxed">
              Notre équipe est disponible pour répondre à toutes vos questions concernant l'utilisation de l'application TĀPE'A.
            </p>
          </CardContent>
        </Card>

        <h3 className="font-semibold text-[#5c5c5c] text-lg mb-3">Questions fréquentes</h3>

        <div className="space-y-3 mb-6">
          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#434343] text-base mb-2">Comment réserver une course ?</h4>
              <p className="text-[#5c5c5c] text-sm leading-relaxed">
                Ouvrez l'application, entrez votre destination dans la barre de recherche, choisissez le type de véhicule souhaité et confirmez votre réservation.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#434343] text-base mb-2">Comment payer ma course ?</h4>
              <p className="text-[#5c5c5c] text-sm leading-relaxed">
                Vous pouvez payer en espèces directement au chauffeur ou ajouter une carte bancaire dans la section Wallet pour un paiement automatique.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#434343] text-base mb-2">Comment annuler une course ?</h4>
              <p className="text-[#5c5c5c] text-sm leading-relaxed">
                Rendez-vous dans la section "Commandes", sélectionnez la course en cours et appuyez sur "Annuler". Des frais peuvent s'appliquer selon le délai d'annulation.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <h4 className="font-semibold text-[#434343] text-base mb-2">Comment contacter mon chauffeur ?</h4>
              <p className="text-[#5c5c5c] text-sm leading-relaxed">
                Une fois votre course confirmée, vous pouvez appeler ou envoyer un message à votre chauffeur directement depuis l'application.
              </p>
            </CardContent>
          </Card>
        </div>

        <h3 className="font-semibold text-[#5c5c5c] text-lg mb-3">Nous contacter</h3>

        <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full bg-[#ffdf6d] text-[#5c5c5c] font-semibold h-12 rounded-[10px] hover:bg-[#ffd84f] flex items-center justify-center gap-3"
                data-testid="button-aide-message"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Envoyer un message</span>
              </Button>
              
              <Button 
                className="w-full bg-[#ffdf6d] text-[#5c5c5c] font-semibold h-12 rounded-[10px] hover:bg-[#ffd84f] flex items-center justify-center gap-3"
                data-testid="button-aide-mail"
              >
                <Mail className="w-5 h-5" />
                <span>Envoyer un email</span>
              </Button>
              
              <Button 
                className="w-full bg-[#343333] text-white font-semibold h-12 rounded-[10px] hover:bg-[#222222] flex items-center justify-center gap-3"
                data-testid="button-aide-phone"
              >
                <Phone className="w-5 h-5" />
                <span>Appeler le support</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[#8c8c8c] text-sm">
          Support disponible 7j/7 de 6h à 22h
        </p>
      </main>
    </div>
  );
}
