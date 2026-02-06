import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { ArrowLeft, Copy, Check } from "lucide-react";

export function AuthVerify() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [verificationType, setVerificationType] = useState<string>("registration");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { verify } = useAuth();

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("verificationPhone");
    const storedType = sessionStorage.getItem("verificationType");
    const storedDevCode = sessionStorage.getItem("devCode");
    
    console.log("[DEBUG] AuthVerify - Phone:", storedPhone, "Type:", storedType, "DevCode:", storedDevCode);
    
    if (!storedPhone) {
      setLocation("/auth");
      return;
    }
    setPhone(storedPhone);
    if (storedType) setVerificationType(storedType);
    if (storedDevCode) {
      console.log("[DEBUG] Setting devCode:", storedDevCode);
      setDevCode(storedDevCode);
    }
  }, [setLocation]);

  const copyDevCode = () => {
    if (devCode) {
      navigator.clipboard.writeText(devCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace("+689", "");
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    
    setIsLoading(true);
    try {
      const result = await verify(phone, code, verificationType);
      
      if (result.success) {
        sessionStorage.removeItem("verificationPhone");
        sessionStorage.removeItem("verificationType");
        sessionStorage.removeItem("devCode");
        toast({
          title: "Vérification réussie",
          description: `Bienvenue ${result.client?.firstName || ""}`,
        });
        setLocation("/");
      } else {
        toast({
          title: "Erreur de vérification",
          description: result.error || "Code invalide ou expiré",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, type: verificationType }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.devCode) {
          sessionStorage.setItem("devCode", data.devCode);
          setDevCode(data.devCode);
        }
        toast({
          title: "Code envoyé",
          description: "Un nouveau code a été envoyé",
        });
      } else {
        toast({
          title: "Erreur",
          description: data.error || "Impossible d'envoyer le code",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5C400] flex flex-col">
      <div className="p-4">
        <Button
          data-testid="button-back"
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/auth")}
          className="text-black hover:bg-black/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col items-center px-6">
        <div className="w-full max-w-xs bg-white rounded-2xl p-6 shadow-lg mt-8">
          <h2 className="text-xl font-bold text-center mb-2">
            {verificationType === "password_reset" 
              ? "Saisir le code d'authentification du numéro"
              : "Rentrez votre code d'authentification du numéro"
            }
          </h2>
          
          <p className="text-gray-500 text-center text-sm mb-6">
            Message envoyée au {formatPhone(phone)}
          </p>
          
          <div className="flex justify-center mb-6">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              data-testid="input-otp"
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
                <InputOTPSlot index={1} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
                <InputOTPSlot index={2} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
                <InputOTPSlot index={3} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
                <InputOTPSlot index={4} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
                <InputOTPSlot index={5} className="w-10 h-12 text-lg border-gray-300 rounded-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          
          <p className="text-gray-400 text-center text-xs mb-4">
            Saisir le code de sécurité à 6 chiffres
          </p>
          
          {devCode && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700 font-medium mb-1">Mode développement</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-lg font-mono font-bold text-amber-900">{devCode}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyDevCode}
                  className="h-8 px-2"
                  data-testid="button-copy-code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
          
          <Button
            data-testid="button-verify"
            onClick={handleVerify}
            className="w-full bg-[#F5C400] text-black hover:bg-[#e0b400] font-semibold h-12 rounded-full mb-3"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? "Vérification..." : "Confirmer votre code"}
          </Button>
          
          <Button
            data-testid="button-resend"
            onClick={handleResend}
            variant="outline"
            className="w-full border-black text-black hover:bg-gray-50 font-semibold h-12 rounded-full"
          >
            Renvoyer le code
          </Button>
        </div>
        
        <button
          data-testid="link-help"
          className="mt-6 text-sm text-gray-700 underline"
          onClick={() => setLocation("/aide")}
        >
          Besoin d'aide ?
        </button>
      </div>
    </div>
  );
}
