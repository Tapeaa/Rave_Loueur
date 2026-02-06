import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import logoImage from "@assets/APPLICATION MOBILE-6_1764074860081.png";
import { ChevronDown, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  phone: z.string()
    .min(6, "Minimum 6 chiffres")
    .max(8, "Maximum 8 chiffres")
    .regex(/^\d+$/, "Uniquement des chiffres"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function AuthLogin() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const phone = `+689${data.phone.replace(/\s/g, "")}`;
      const result = await login(phone, data.password);
      
      if (result.success) {
        toast({
          title: "Connexion réussie",
          description: `Bienvenue ${result.client?.firstName || ""}`,
        });
        setLocation("/");
      } else {
        toast({
          title: "Erreur de connexion",
          description: result.error || "Identifiants incorrects",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Button
          data-testid="button-back"
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/auth")}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col items-center px-6 pb-12">
        <div className="w-16 h-16 bg-[#1a472a] rounded-full flex items-center justify-center mb-4">
          <img src={logoImage} alt="TĀPE'A" className="w-10 h-10 object-contain" />
        </div>
        
        <h1 className="text-4xl font-black text-foreground tracking-tight mb-8">
          Connexion
        </h1>
        
        <div className="w-full max-w-xs space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <div className="flex items-center border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-1 px-3 py-3 bg-muted border-r">
                          <span className="text-sm font-medium">PF</span>
                          <span className="text-sm text-muted-foreground">+689</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-password"
                        {...field}
                        type="password"
                        placeholder="Votre mot de passe"
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
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </Form>
          
          <button
            data-testid="link-forgot-password"
            onClick={() => setLocation("/auth/forgot-password")}
            className="w-full text-center text-sm text-muted-foreground hover:underline"
          >
            Mot de passe oublié ?
          </button>
          
          <div className="pt-4 text-center">
            <span className="text-muted-foreground text-sm">Pas encore de compte ? </span>
            <button
              data-testid="link-register"
              onClick={() => setLocation("/auth/register")}
              className="text-sm font-medium text-[#F5C400] hover:underline"
            >
              S'inscrire
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
