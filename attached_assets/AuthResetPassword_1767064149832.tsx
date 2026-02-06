import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const resetSchema = z.object({
  code: z.string().length(6, "Code à 6 chiffres requis"),
  newPassword: z.string()
    .min(6, "Minimum 6 caractères")
    .regex(/[a-zA-Z]/, "Doit contenir au moins une lettre")
    .regex(/[0-9]/, "Doit contenir au moins un chiffre"),
  confirmPassword: z.string().min(6, "Confirmez le mot de passe"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

export function AuthResetPassword() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const { toast } = useToast();
  
  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("verificationPhone");
    if (!storedPhone) {
      setLocation("/auth/forgot-password");
      return;
    }
    setPhone(storedPhone);
  }, [setLocation]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace("+689", "");
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4");
  };

  const onSubmit = async (data: ResetForm) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: data.code,
          newPassword: data.newPassword,
        }),
      });
      const result = await res.json();
      
      if (result.success) {
        sessionStorage.removeItem("verificationPhone");
        sessionStorage.removeItem("verificationType");
        toast({
          title: "Mot de passe réinitialisé",
          description: "Vous pouvez maintenant vous connecter",
        });
        setLocation("/auth/login");
      } else {
        toast({
          title: "Erreur",
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
        body: JSON.stringify({ phone, type: "password_reset" }),
      });
      const data = await res.json();
      
      if (data.success) {
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
          onClick={() => setLocation("/auth/forgot-password")}
          className="text-black hover:bg-black/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col items-center px-6">
        <div className="w-full max-w-xs bg-white rounded-2xl p-6 shadow-lg mt-8">
          <h2 className="text-xl font-bold text-center mb-2">
            Vous êtes en train de réinitialiser votre mot de passe
          </h2>
          
          <p className="text-gray-500 text-center text-sm mb-6">
            Vous réinitialisez le mot de passe du +689 {formatPhone(phone)}
          </p>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Code de vérification</FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={field.value}
                          onChange={field.onChange}
                          data-testid="input-otp"
                        >
                          <InputOTPGroup className="gap-2">
                            <InputOTPSlot index={0} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                            <InputOTPSlot index={1} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                            <InputOTPSlot index={2} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                            <InputOTPSlot index={3} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                            <InputOTPSlot index={4} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                            <InputOTPSlot index={5} className="w-9 h-11 text-lg border-gray-300 rounded-lg" />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-password"
                        {...field}
                        type="password"
                        placeholder="Min 6 car., 1 lettre, 1 chiffre"
                        className="h-12 rounded-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-confirm-password"
                        {...field}
                        type="password"
                        placeholder="Mot de passe"
                        className="h-12 rounded-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                data-testid="button-submit"
                type="submit"
                className="w-full bg-[#F5C400] text-black hover:bg-[#e0b400] font-semibold h-12 rounded-full"
                disabled={isLoading}
              >
                {isLoading ? "Réinitialisation..." : "Réinitialiser"}
              </Button>
            </form>
          </Form>
          
          <Button
            data-testid="button-resend"
            onClick={handleResend}
            variant="ghost"
            className="w-full mt-2 text-gray-500"
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
