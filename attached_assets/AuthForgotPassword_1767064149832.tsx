import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ArrowLeft } from "lucide-react";

const forgotSchema = z.object({
  phone: z.string()
    .min(6, "Minimum 6 chiffres")
    .max(8, "Maximum 8 chiffres")
    .regex(/^\d+$/, "Uniquement des chiffres"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export function AuthForgotPassword() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      phone: "",
    },
  });

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true);
    try {
      const phone = `+689${data.phone.replace(/\s/g, "")}`;
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      
      if (result.success) {
        sessionStorage.setItem("verificationPhone", phone);
        sessionStorage.setItem("verificationType", "password_reset");
        toast({
          title: "Code envoyé",
          description: "Un code de vérification a été envoyé",
        });
        setLocation("/auth/reset-password");
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Une erreur est survenue",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5C400] flex flex-col">
      <div className="p-4">
        <Button
          data-testid="button-back"
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/auth/login")}
          className="text-black hover:bg-black/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col items-center px-6">
        <div className="w-full max-w-xs bg-white rounded-2xl p-6 shadow-lg mt-8">
          <h2 className="text-xl font-bold text-center mb-2">
            Mot de passe oublié
          </h2>
          
          <p className="text-gray-500 text-center text-sm mb-6">
            Entrez votre numéro de téléphone pour recevoir un code de réinitialisation
          </p>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-1 px-3 py-3 bg-gray-50 border-r">
                          <span className="text-sm font-medium text-gray-700">PF</span>
                          <span className="text-sm text-gray-600">+689</span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                        <Input
                          data-testid="input-phone"
                          {...field}
                          type="tel"
                          inputMode="numeric"
                          placeholder="87 12 34 56"
                          className="border-0 focus-visible:ring-0"
                          maxLength={8}
                        />
                      </div>
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
                {isLoading ? "Envoi..." : "Envoyer le code"}
              </Button>
            </form>
          </Form>
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
