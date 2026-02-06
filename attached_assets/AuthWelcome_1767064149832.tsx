import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";

export function AuthWelcome() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-20 h-20 bg-[#1a472a] rounded-full flex items-center justify-center mb-6">
          <img src={logoImage} alt="TĀPE'A" className="w-12 h-12 object-contain" />
        </div>
        
        <h1 className="text-5xl font-black text-foreground tracking-tight mb-4">
          TĀPE'A
        </h1>
        
        <p className="text-muted-foreground text-center mb-12">
          Votre application de transport
        </p>
        
        <div className="w-full max-w-xs space-y-4">
          <Button
            data-testid="button-login"
            className="w-full bg-[#F5C400] text-black hover:bg-[#e0b400] font-semibold h-12 rounded-full"
            onClick={() => setLocation("/auth/login")}
          >
            Se connecter
          </Button>
          
          <Button
            data-testid="button-register"
            variant="outline"
            className="w-full font-semibold h-12 rounded-full"
            onClick={() => setLocation("/auth/register")}
          >
            Créer un compte
          </Button>
        </div>
      </div>
    </div>
  );
}
