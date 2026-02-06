import { ArrowLeft, Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation, Link } from "wouter";

export function Contact() {
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
        <h1 className="text-lg font-semibold text-[#343434]">Contact</h1>
      </header>

      <div className="p-4 space-y-4 pb-8">
        <Card className="p-6 bg-gradient-to-br from-[#343434] to-[#1a1a1a]">
          <h2 className="text-white text-xl font-bold mb-2">Besoin d'aide ?</h2>
          <p className="text-white/70 text-sm mb-4">
            Notre équipe est disponible pour répondre à toutes vos questions.
          </p>
          <Link href="/support">
            <Button className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold">
              <MessageCircle className="w-4 h-4 mr-2" />
              Démarrer une conversation
            </Button>
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-4">Nous contacter</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ffdf6d] rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-[#343434]" />
              </div>
              <div>
                <p className="text-xs text-[#8c8c8c]">Téléphone</p>
                <p className="text-[#343434] font-medium">+689 40 50 60 70</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ffdf6d] rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#343434]" />
              </div>
              <div>
                <p className="text-xs text-[#8c8c8c]">Email</p>
                <p className="text-[#343434] font-medium">contact@tapea.pf</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#ffdf6d] rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#343434]" />
              </div>
              <div>
                <p className="text-xs text-[#8c8c8c]">Adresse</p>
                <p className="text-[#343434] font-medium">Papeete, Tahiti</p>
                <p className="text-[#8c8c8c] text-sm">Polynésie française</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Horaires d'ouverture</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#5c5c5c]" />
              <div>
                <p className="text-[#343434] font-medium">Support téléphonique</p>
                <p className="text-[#8c8c8c] text-sm">Lun - Ven : 8h00 - 18h00</p>
                <p className="text-[#8c8c8c] text-sm">Sam : 9h00 - 12h00</p>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-green-700 text-sm font-medium">
              Chat en ligne disponible 24h/24
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Réseaux sociaux</h3>
          <div className="flex gap-3">
            <Button variant="outline" size="icon" className="rounded-full">
              <span className="text-lg">f</span>
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <span className="text-lg">in</span>
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <span className="text-lg">ig</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
