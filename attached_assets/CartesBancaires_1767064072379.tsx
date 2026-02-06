import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CreditCard, Plus, Trash2, Check, AlertCircle, Loader2, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import type { Order, PaymentMethod } from "@shared/schema";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { useLocation } from "wouter";

// Cache for stripe instance to avoid re-loading
let stripeInstanceCache: Promise<Stripe | null> | null = null;

function getCardIcon(brand: string) {
  switch (brand.toLowerCase()) {
    case "visa":
      return <SiVisa className="w-8 h-5 text-blue-600" />;
    case "mastercard":
      return <SiMastercard className="w-8 h-5 text-orange-500" />;
    case "amex":
      return <SiAmericanexpress className="w-8 h-5 text-blue-500" />;
    default:
      return <CreditCard className="w-6 h-6 text-muted-foreground" />;
  }
}

function AddCardForm({ clientId, onSuccess }: { clientId: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);

  // Debug: log stripe status
  useEffect(() => {
    console.log("[AddCardForm] Stripe status:", { stripe: !!stripe, elements: !!elements });
  }, [stripe, elements]);

  useEffect(() => {
    async function fetchSetupIntent() {
      try {
        console.log("[AddCardForm] Fetching setup intent for client:", clientId);
        const response = await apiRequest("POST", "/api/stripe/setup-intent", { clientId });
        const data = await response.json();
        console.log("[AddCardForm] Got clientSecret:", !!data.clientSecret);
        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error("Error fetching setup intent:", error);
        toast({
          title: "Erreur",
          description: "Impossible de préparer l'ajout de carte",
          variant: "destructive",
        });
      }
    }
    fetchSetupIntent();
  }, [clientId]);

  const handleSaveCard = async () => {
    console.log("[AddCardForm] handleSaveCard called");
    
    if (!stripe || !elements || !clientSecret) {
      console.log("[AddCardForm] Missing required:", { stripe: !!stripe, elements: !!elements, clientSecret: !!clientSecret });
      toast({
        title: "Erreur",
        description: "Le formulaire n'est pas prêt. Veuillez réessayer.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const cardElement = elements.getElement(CardElement);
      console.log("[AddCardForm] cardElement:", !!cardElement);
      if (!cardElement) {
        console.log("[AddCardForm] No card element found");
        toast({
          title: "Erreur",
          description: "Élément de carte non trouvé",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log("[AddCardForm] Calling confirmCardSetup...");
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      console.log("[AddCardForm] confirmCardSetup result:", { error, setupIntent });

      if (error) {
        console.error("[AddCardForm] Stripe error:", error);
        toast({
          title: "Erreur",
          description: error.message || "Échec de l'ajout de la carte",
          variant: "destructive",
        });
      } else if (setupIntent?.payment_method) {
        console.log("[AddCardForm] Saving payment method to backend...");
        await apiRequest("POST", "/api/stripe/payment-method", {
          clientId,
          paymentMethodId: setupIntent.payment_method,
          isDefault: false,
        });

        toast({
          title: "Carte ajoutée",
          description: "Votre carte a été enregistrée avec succès",
        });
        onSuccess();
      }
    } catch (error) {
      console.error("[AddCardForm] Error:", error);
      toast({
        title: "Erreur",
        description: "Échec de l'enregistrement de la carte",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Préparation du formulaire...</span>
      </div>
    );
  }

  // Show error if stripe is not loaded after a reasonable time
  if (!stripe) {
    return (
      <div className="space-y-4">
        <div className="stripe-card-element">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#343434",
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  lineHeight: "20px",
                  iconColor: "#343434",
                  "::placeholder": {
                    color: "#9ca3af",
                  },
                },
                invalid: {
                  color: "#ef4444",
                  iconColor: "#ef4444",
                },
              },
              hidePostalCode: true,
            }}
          />
        </div>
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Chargement de Stripe...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="stripe-card-element">
        <CardElement
          onReady={() => {
            console.log("[CardElement] Ready");
            setCardReady(true);
          }}
          onChange={(event) => {
            console.log("[CardElement] Change:", event.complete, event.error?.message);
          }}
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#343434",
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: "20px",
                iconColor: "#343434",
                "::placeholder": {
                  color: "#9ca3af",
                },
              },
              invalid: {
                color: "#ef4444",
                iconColor: "#ef4444",
              },
            },
            hidePostalCode: true,
            disableLink: true,
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleSaveCard}
        disabled={isLoading || !stripe || !elements || !cardReady}
        className="w-full flex items-center justify-center gap-2 bg-[#343434] text-white font-semibold rounded-[10px] py-4 px-6 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#222222] active:bg-[#111111] transition-colors min-h-[52px]"
        style={{ touchAction: 'manipulation' }}
        data-testid="button-save-card"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : !stripe || !elements || !cardReady ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Enregistrer la carte
          </>
        )}
      </button>
    </div>
  );
}

function CardsList() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showAddCard, setShowAddCard] = useState(false);
  const { client, isLoading: authLoading } = useAuth();
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  
  const clientId = client?.id;
  
  // Check if we came from payment failure modal (returnTo parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get('returnTo');
  const hasReturnToRide = returnTo === 'course-en-cours';

  const { data: activeOrderData } = useQuery<{ hasActiveOrder: boolean; order?: Order }>({
    queryKey: ['/api/orders/active/client'],
    refetchInterval: 3000,
  });
  
  // Show return button if: we have returnTo param (from payment failure modal), OR we have active order data
  // hasReturnToRide allows immediate button display before query completes
  const shouldShowReturnButton = hasReturnToRide || (activeOrderData?.hasActiveOrder && activeOrderData.order);

  // Fetch Stripe publishable key from backend and initialize Stripe
  useEffect(() => {
    async function initStripe() {
      if (stripeInstanceCache) {
        setStripePromise(stripeInstanceCache);
        return;
      }
      try {
        const response = await fetch("/api/stripe/publishable-key");
        if (response.ok) {
          const data = await response.json();
          if (data.publishableKey) {
            stripeInstanceCache = loadStripe(data.publishableKey);
            setStripePromise(stripeInstanceCache);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Stripe key:", error);
      }
    }
    initStripe();
  }, []);

  const { data: paymentMethods = [], isLoading, refetch } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/stripe/payment-methods", clientId],
    enabled: !!clientId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (methodId: string) => {
      const response = await fetch(`/api/stripe/payment-method/${methodId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!response.ok) throw new Error("Delete failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/payment-methods", clientId] });
      toast({
        title: "Carte supprimée",
        description: "Votre carte a été retirée",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la carte",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (methodId: string) => {
      const response = await apiRequest("POST", `/api/stripe/payment-method/${methodId}/default`, { clientId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/payment-methods", clientId] });
      toast({
        title: "Carte par défaut",
        description: "Cette carte sera utilisée pour les paiements",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de définir la carte par défaut",
        variant: "destructive",
      });
    },
  });

  if (!clientId) {
    return (
      <div className="space-y-4">
        {shouldShowReturnButton && (
          <button
            onClick={() => setLocation("/course-en-cours")}
            className="w-full flex items-center gap-3 bg-[#ffdf6d] hover:bg-[#f5d55c] rounded-xl px-4 py-3 shadow-md transition-colors mb-2"
            data-testid="button-active-ride-cards"
          >
            <div className="bg-white/80 rounded-full p-2">
              <Car className="w-5 h-5 text-[#343434]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[#343434] font-semibold text-sm">Course en cours</p>
              <p className="text-[#5c5c5c] text-xs">Revenir au suivi de la course</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#343434]" />
          </button>
        )}
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Veuillez vous connecter pour gérer vos cartes
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="space-y-4">
        {shouldShowReturnButton && (
          <button
            onClick={() => setLocation("/course-en-cours")}
            className="w-full flex items-center gap-3 bg-[#ffdf6d] hover:bg-[#f5d55c] rounded-xl px-4 py-3 shadow-md transition-colors mb-2"
            data-testid="button-active-ride-cards"
          >
            <div className="bg-white/80 rounded-full p-2">
              <Car className="w-5 h-5 text-[#343434]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[#343434] font-semibold text-sm">Course en cours</p>
              <p className="text-[#5c5c5c] text-xs">Revenir au suivi de la course</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#343434]" />
          </button>
        )}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shouldShowReturnButton && (
        <button
          onClick={() => setLocation("/course-en-cours")}
          className="w-full flex items-center gap-3 bg-[#ffdf6d] hover:bg-[#f5d55c] rounded-xl px-4 py-3 shadow-md transition-colors mb-2"
          data-testid="button-active-ride-cards"
        >
          <div className="bg-white/80 rounded-full p-2">
            <Car className="w-5 h-5 text-[#343434]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[#343434] font-semibold text-sm">Course en cours</p>
            <p className="text-[#5c5c5c] text-xs">Revenir au suivi de la course</p>
          </div>
          <ArrowRight className="w-5 h-5 text-[#343434]" />
        </button>
      )}

      {paymentMethods.length === 0 && !showAddCard ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CreditCard className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Aucune carte enregistrée
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <Card 
              key={method.id} 
              className={`rounded-[10px] border-0 shadow-none ${
                method.isDefault ? "bg-[#ffe381]" : "bg-[#f6f6f6]"
              }`}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getCardIcon(method.brand)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#343434] text-base">
                      **** **** **** {method.last4}
                    </p>
                    <p className="text-[#5c5c5c] text-sm">
                      Expire {String(method.expiryMonth).padStart(2, "0")}/{method.expiryYear}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="bg-[#343434] text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                      Par défaut
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!method.isDefault ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDefaultMutation.mutate(method.id)}
                      disabled={setDefaultMutation.isPending}
                      className="text-xs px-3 bg-white border-[#343434] text-[#343434]"
                      data-testid={`button-set-default-${method.id}`}
                    >
                      {setDefaultMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Par défaut
                        </>
                      )}
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(method.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-500"
                    data-testid={`button-delete-card-${method.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAddCard ? (
        <Card className="bg-white rounded-[10px] border shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-[#343434] mb-4">Nouvelle carte</h3>
            {!stripePromise ? (
              <div className="flex flex-col items-center py-4">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-sm text-red-500">Configuration Stripe manquante</p>
              </div>
            ) : (
              <Elements stripe={stripePromise}>
                <AddCardForm 
                  clientId={clientId} 
                  onSuccess={() => {
                    setShowAddCard(false);
                    refetch();
                  }} 
                />
              </Elements>
            )}
            <Button
              variant="ghost"
              className="w-full mt-2 text-[#5c5c5c]"
              onClick={() => setShowAddCard(false)}
              data-testid="button-cancel-add-card"
            >
              Annuler
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowAddCard(true)}
          className="w-full bg-[#343434] text-white font-semibold rounded-[10px] hover:bg-[#222222]"
          data-testid="button-add-card"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une carte
        </Button>
      )}
    </div>
  );
}

export function CartesBancaires() {
  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Mes cartes" />

      <main className="px-4">
        <CardsList />
      </main>
    </div>
  );
}
