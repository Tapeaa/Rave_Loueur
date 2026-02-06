import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, MessageCircle, MapPin, Clock } from "lucide-react";

export function Notifications() {
  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Notifications" showBackButton />

      <main className="px-4 mt-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#ffdf6d] flex items-center justify-center mb-4">
            <Bell className="w-10 h-10 text-[#5c5c5c]" />
          </div>
        </div>

        <Card className="bg-gradient-to-br from-[#fff9e6] to-[#fff4cc] rounded-[15px] border-0 shadow-sm mb-6">
          <CardContent className="p-5">
            <h2 className="font-semibold text-[#343434] text-lg mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#ffdf6d]" />
              Comment ça fonctionne ?
            </h2>
            <p className="text-[#5c5c5c] text-sm leading-relaxed">
              Lorsque vous effectuez une réservation, votre chauffeur vous contactera directement 
              par message pour confirmer les détails de votre course.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Messages du chauffeur</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Votre chauffeur vous enverra un message pour confirmer son arrivée et 
                    vous tenir informé de tout changement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Suivi en temps réel</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Suivez la progression de votre chauffeur directement depuis le site. 
                    Vous saurez exactement quand il arrivera à votre point de rendez-vous.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Mises à jour</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Recevez des notifications pour les confirmations de réservation, 
                    les rappels et les informations importantes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-[#8c8c8c] text-sm mt-8 px-4">
          Les notifications sont envoyées directement sur ce site.
          Assurez-vous de garder votre session ouverte pour les recevoir.
        </p>
      </main>
    </div>
  );
}
