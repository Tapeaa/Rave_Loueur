import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, Database } from "lucide-react";

export function Confidentialite() {
  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Confidentialité" showBackButton />

      <main className="px-4 mt-4">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#ffdf6d] flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-[#5c5c5c]" />
          </div>
          <p className="text-center text-[#5c5c5c] text-sm">
            Votre vie privée est notre priorité
          </p>
        </div>

        <div className="space-y-4">
          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Protection des données</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Vos informations personnelles sont protégées et cryptées. 
                    Nous utilisons les dernières technologies de sécurité pour 
                    garantir la confidentialité de vos données.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Utilisation des données</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Vos données sont uniquement utilisées pour améliorer votre 
                    expérience sur TĀPE'A. Nous ne vendons jamais vos informations 
                    à des tiers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffdf6d] flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-[#5c5c5c]" />
                </div>
                <div>
                  <h3 className="font-medium text-[#343434] mb-1">Stockage sécurisé</h3>
                  <p className="text-[#8c8c8c] text-sm">
                    Toutes les données sont stockées sur des serveurs sécurisés 
                    conformes aux normes internationales de protection des données.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-[#f6f6f6] rounded-[10px]">
          <h3 className="font-medium text-[#343434] mb-2">Vos droits</h3>
          <ul className="text-[#8c8c8c] text-sm space-y-2">
            <li>• Accès à vos données personnelles</li>
            <li>• Modification de vos informations</li>
            <li>• Suppression de votre compte</li>
            <li>• Portabilité de vos données</li>
          </ul>
        </div>

        <p className="text-center text-[#8c8c8c] text-sm mt-6">
          Pour toute question concernant vos données,
          <br />
          contactez-nous via le support.
        </p>
      </main>
    </div>
  );
}
