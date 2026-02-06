import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { ChevronDown, ArrowLeft } from "lucide-react";

const registerSchema = z.object({
  phone: z.string()
    .min(6, "Minimum 6 chiffres")
    .max(8, "Maximum 8 chiffres")
    .regex(/^\d+$/, "Uniquement des chiffres"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  password: z.string().min(6, "Minimum 6 caractères"),
  confirmPassword: z.string().min(1, "Confirmez le mot de passe"),
  acceptTerms: z.boolean().refine(val => val === true, "Vous devez accepter les conditions"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function AuthRegister() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { register: authRegister } = useAuth();
  
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      phone: "",
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const phone = `+689${data.phone.replace(/\s/g, "")}`;
      const result = await authRegister(phone, data.firstName, data.lastName, data.password);
      
      if (result.success) {
        toast({
          title: "Inscription réussie",
          description: `Bienvenue ${data.firstName} !`,
        });
        setLocation("/");
      } else {
        toast({
          title: "Erreur d'inscription",
          description: result.error || "Une erreur est survenue",
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
        <h1 className="text-3xl font-bold text-foreground mb-8">Créer un compte</h1>
        
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
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-lastname"
                        {...field}
                        placeholder="Votre nom"
                        className="h-12 rounded-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-firstname"
                        {...field}
                        placeholder="Votre prénom"
                        className="h-12 rounded-lg"
                      />
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
                        placeholder="Minimum 6 caractères"
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
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-confirm-password"
                        {...field}
                        type="password"
                        placeholder="Confirmez votre mot de passe"
                        className="h-12 rounded-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 pt-2">
                    <FormLabel className="text-sm leading-tight">
                      J'accepte les{" "}
                      <button
                        type="button"
                        className="text-[#F5C400] underline font-medium"
                        onClick={() => setLocation("/documents")}
                      >
                        conditions d'utilisation
                      </button>
                    </FormLabel>
                    <FormControl>
                      <Switch
                        data-testid="switch-terms"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="pt-4">
                <Button
                  data-testid="button-submit"
                  type="submit"
                  className="w-full bg-[#F5C400] text-black hover:bg-[#e0b400] font-semibold h-12 rounded-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Inscription..." : "S'inscrire"}
                </Button>
              </div>
            </form>
          </Form>
          
          <div className="text-center pb-8">
            <span className="text-muted-foreground text-sm">Déjà un compte ? </span>
            <button
              data-testid="link-login"
              onClick={() => setLocation("/auth/login")}
              className="text-sm font-medium text-[#F5C400] hover:underline"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
