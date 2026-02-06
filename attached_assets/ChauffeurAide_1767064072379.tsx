import { useEffect, useState } from "react";
import { ArrowLeft, HelpCircle, FileText, Phone, MessageCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation, Link } from "wouter";

const helpItems = [
  {
    icon: FileText,
    title: "Guide du chauffeur",
    description: "Conseils et bonnes pratiques",
  },
  {
    icon: HelpCircle,
    title: "FAQ Chauffeurs",
    description: "Questions fréquemment posées",
  },
  {
    icon: Phone,
    title: "Assistance téléphonique",
    description: "Disponible 24h/24",
  },
  {
    icon: MessageCircle,
    title: "Chat avec le support",
    description: "Réponse rapide garantie",
    href: "/chauffeur/support",
  },
];

const faqItems = [
  {
    question: "Comment recevoir plus de courses ?",
    answer: "Restez actif aux heures de pointe et maintenez une bonne note client."
  },
  {
    question: "Quand sont effectués les paiements ?",
    answer: "Les paiements sont effectués chaque semaine, le lundi."
  },
  {
    question: "Comment contester une course ?",
    answer: "Contactez le support via le chat dans les 24h suivant la course."
  },
];

export function ChauffeurAide() {
  const [, setLocation] = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);

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
        <h1 className="text-lg font-semibold text-[#343434]">Aide</h1>
      </header>

      <div className="p-4 space-y-4 pb-8">
        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Comment pouvons-nous vous aider ?</h3>
          <div className="space-y-2">
            {helpItems.map((item, index) => {
              const Icon = item.icon;
              const content = (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-[#f8f8f8] rounded-lg cursor-pointer hover:bg-[#f0f0f0] transition-colors"
                  data-testid={`help-item-${index}`}
                >
                  <div className="w-10 h-10 bg-[#ffdf6d] rounded-full flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#343434]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[#343434] font-medium">{item.title}</p>
                    <p className="text-[#8c8c8c] text-sm">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#8c8c8c]" />
                </div>
              );
              
              if (item.href) {
                return <Link key={index} href={item.href}>{content}</Link>;
              }
              return content;
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Questions fréquentes</h3>
          <div className="space-y-3">
            {faqItems.map((faq, index) => (
              <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                <p className="text-[#343434] font-medium mb-1">{faq.question}</p>
                <p className="text-[#8c8c8c] text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 bg-[#343434]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#ffdf6d] rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-[#343434]" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">Urgence chauffeur</p>
              <p className="text-white/70 text-sm">Ligne directe 24h/24</p>
            </div>
          </div>
          <Button 
            className="w-full mt-4 bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
            data-testid="button-call-emergency"
          >
            Appeler maintenant
          </Button>
        </Card>
      </div>
    </div>
  );
}
