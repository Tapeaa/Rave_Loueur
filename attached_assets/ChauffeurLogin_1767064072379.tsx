import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";

export function ChauffeurLogin() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCodeChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 6);
    setCode(numericValue);
    setError("");
  };

  const formatCode = (value: string) => {
    if (value.length <= 3) return value;
    return `${value.slice(0, 3)} ${value.slice(3)}`;
  };

  const handleSubmit = async () => {
    if (code.length !== 6) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiRequest("POST", "/api/driver/login", { code });
      const data = await response.json();
      
      if (data.success && data.session) {
        sessionStorage.setItem("chauffeurAuth", "true");
        sessionStorage.setItem("driverSessionId", data.session.id);
        sessionStorage.setItem("driverId", data.driver.id);
        sessionStorage.setItem("driverInfo", JSON.stringify(data.driver));
        setLocation("/chauffeur");
      } else {
        setError(data.error || "Code incorrect");
        setCode("");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur de connexion";
      setError(errorMessage.includes("401") ? "Code incorrect. Veuillez réessayer." : errorMessage);
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6 && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ffdf6d] to-[#ffd84f] flex flex-col">
      <header className="flex items-center px-4 py-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full w-10 h-10"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-8">
          <img 
            src={logoImage} 
            alt="TAPE'A" 
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-12 h-12 bg-[#343434] rounded-full flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
          </div>

          <h1 className="text-[#343434] font-bold text-xl text-center mb-2">
            Espace Chauffeur
          </h1>
          <p className="text-[#8c8c8c] text-sm text-center mb-6">
            Entrez votre code d'accès chauffeur
          </p>

          <div className="mb-6">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formatCode(code)}
              onChange={(e) => handleCodeChange(e.target.value.replace(/\s/g, ""))}
              onKeyPress={handleKeyPress}
              placeholder="000 000"
              className="w-full text-center text-3xl font-bold tracking-[0.3em] py-4 border-2 border-gray-200 rounded-xl focus:border-[#ffdf6d] focus:outline-none transition-colors"
              maxLength={7}
              disabled={isLoading}
              data-testid="input-driver-code"
            />
            {error && (
              <p className="text-red-500 text-sm text-center mt-2" data-testid="text-error">
                {error}
              </p>
            )}
          </div>

          <Button
            className={`w-full h-12 rounded-xl font-bold text-base transition-all ${
              code.length === 6 && !isLoading
                ? "bg-[#343434] text-white hover:bg-[#222]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            onClick={handleSubmit}
            disabled={code.length !== 6 || isLoading}
            data-testid="button-submit"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Accéder"
            )}
          </Button>
        </div>

        <p className="text-[#343434]/60 text-xs text-center mt-6 px-4">
          Cet espace est réservé aux chauffeurs partenaires TAPE'A
        </p>
      </div>
    </div>
  );
}
