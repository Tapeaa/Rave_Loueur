import { PageHeader } from "@/components/PageHeader";
import { CreditCard, Plus, ArrowUpRight, ArrowDownLeft, History, ChevronRight, Loader2, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Order, PaymentMethod, Invoice } from "@shared/schema";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { useAuth } from "@/lib/AuthContext";

function getCardIcon(brand: string) {
  switch (brand.toLowerCase()) {
    case "visa":
      return <SiVisa className="w-6 h-4 text-blue-600" />;
    case "mastercard":
      return <SiMastercard className="w-6 h-4 text-orange-500" />;
    case "amex":
      return <SiAmericanexpress className="w-6 h-4 text-blue-500" />;
    default:
      return <CreditCard className="w-5 h-5 text-muted-foreground" />;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Wallet() {
  const { client } = useAuth();
  const [, setLocation] = useLocation();
  const clientId = client?.id;

  const { data: activeOrderData } = useQuery<{ hasActiveOrder: boolean; order?: Order }>({
    queryKey: ['/api/orders/active/client'],
    refetchInterval: 3000,
  });

  const { data: paymentMethods = [], isLoading: methodsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/stripe/payment-methods", clientId],
    enabled: !!clientId,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/stripe/invoices", clientId],
    enabled: !!clientId,
  });

  const defaultCard = paymentMethods.find(m => m.isDefault) || paymentMethods[0];

  const transactions = invoices.slice(0, 4).map(invoice => ({
    id: invoice.id,
    type: "debit" as const,
    description: `Course - ${invoice.status === "paid" ? "Payée" : invoice.status === "pending" ? "En attente" : "Échouée"}`,
    amount: `-${invoice.amount.toLocaleString("fr-FR")} XPF`,
    date: formatDate(invoice.createdAt),
  }));

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Mon Wallet" />

      <main className="px-4">
        {activeOrderData?.hasActiveOrder && activeOrderData.order && (
          <button
            onClick={() => setLocation("/course-en-cours")}
            className="w-full mb-6 flex items-center gap-3 bg-[#ffdf6d] hover:bg-[#f5d55c] rounded-xl px-4 py-3 shadow-md transition-colors"
            data-testid="button-active-ride-wallet"
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

        <Card className="bg-gradient-to-br from-[#ffdf6d] to-[#ffd84f] rounded-[20px] border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-[#5c5c5c]" />
                <span className="font-medium text-[#5c5c5c]">Carte par défaut</span>
              </div>
              <span className="text-[#5c5c5c] text-sm">TĀPE'A</span>
            </div>
            
            {methodsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#5c5c5c]" />
              </div>
            ) : defaultCard ? (
              <div className="bg-white rounded-[12px] p-4 mb-4 shadow-md">
                <div className="flex items-center gap-3">
                  {getCardIcon(defaultCard.brand)}
                  <div>
                    <span className="font-bold text-[#343434] text-lg block">
                      **** {defaultCard.last4}
                    </span>
                    <span className="text-[#5c5c5c] text-sm">
                      Expire {String(defaultCard.expiryMonth).padStart(2, "0")}/{defaultCard.expiryYear}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/50 rounded-[12px] p-4 mb-4">
                <p className="text-[#5c5c5c] text-base">
                  Aucune carte enregistrée
                </p>
              </div>
            )}
            
            <Link href="/cartes-bancaires">
              <Button 
                className="w-full bg-white/90 text-[#5c5c5c] font-semibold rounded-[10px] hover:bg-white flex items-center justify-center gap-2"
                data-testid="button-manage-cards"
              >
                <CreditCard className="w-4 h-4" />
                {paymentMethods.length > 0 ? "Gérer mes cartes" : "Ajouter une carte"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="font-semibold text-[#343434] text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Factures récentes
          </h2>
          {invoices.length > 4 && (
            <Button variant="ghost" className="text-[#5c5c5c] text-sm" data-testid="button-view-all-invoices">
              Voir tout
            </Button>
          )}
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Aucune facture pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <Card key={transaction.id} className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100">
                      <ArrowUpRight className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#343434] text-base truncate">
                        {transaction.description}
                      </p>
                      <p className="text-[#5c5c5c] text-sm">{transaction.date}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-lg flex-shrink-0 text-red-500">
                    {transaction.amount}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Link href="/cartes-bancaires">
          <Card className="bg-[#ffe381] rounded-[10px] border-0 shadow-none mt-6 cursor-pointer hover-elevate">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#5c5c5c] text-base">
                  {paymentMethods.length > 0 ? "Gérer mes cartes bancaires" : "Ajouter une carte bancaire"}
                </p>
                <p className="text-[#5c5c5c] text-sm">
                  {paymentMethods.length > 0 
                    ? `${paymentMethods.length} carte${paymentMethods.length > 1 ? "s" : ""} enregistrée${paymentMethods.length > 1 ? "s" : ""}`
                    : "Pour les paiements automatiques"
                  }
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#5c5c5c] flex-shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </main>
    </div>
  );
}
