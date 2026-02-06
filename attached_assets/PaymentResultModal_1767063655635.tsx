import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, CreditCard, Banknote, RefreshCw, Clock } from "lucide-react";

interface PaymentResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: "success" | "failed";
  amount: number;
  paymentMethod?: "card" | "cash";
  cardBrand?: string | null;
  cardLast4?: string | null;
  errorMessage?: string;
  onChangeCard?: () => void;
  onRetryPayment?: () => void;
  onSwitchToCash?: () => void;
  onDriverRetryPayment?: () => void;
  onDriverWaitForClient?: () => void;
  role: "client" | "driver";
}

const cardBrandIcons: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function PaymentResultModal({
  isOpen,
  onClose,
  status,
  amount,
  paymentMethod = "cash",
  cardBrand,
  cardLast4,
  errorMessage,
  onChangeCard,
  onRetryPayment,
  onSwitchToCash,
  onDriverRetryPayment,
  onDriverWaitForClient,
  role,
}: PaymentResultModalProps) {
  const isSuccess = status === "success";
  const brandName = cardBrand ? cardBrandIcons[cardBrand.toLowerCase()] || cardBrand : "";
  
  const getDriverErrorMessage = () => {
    return "Le paiement par carte du client a échoué. Vous pouvez relancer le paiement ou attendre que le client règle le problème.";
  };

  const canClose = isSuccess || role === "driver";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && canClose) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-[340px] rounded-2xl p-0 overflow-hidden" onPointerDownOutside={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }} onEscapeKeyDown={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }}>
        <div className={`p-6 ${isSuccess ? "bg-green-50" : "bg-red-50"}`}>
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isSuccess ? "bg-green-500" : "bg-red-500"
              }`}
            >
              {isSuccess ? (
                <Check className="w-8 h-8 text-white" />
              ) : (
                <X className="w-8 h-8 text-white" />
              )}
            </div>

            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg font-bold text-[#343434]">
                {isSuccess ? "Paiement validé" : "Paiement refusé"}
              </DialogTitle>
              <DialogDescription className="text-sm text-[#666666]">
                {isSuccess
                  ? role === "client"
                    ? "Merci pour votre course !"
                    : "Le paiement a été effectué avec succès"
                  : role === "driver"
                    ? getDriverErrorMessage()
                    : errorMessage || "Le paiement n'a pas pu être effectué"}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-[#8c8c8c]">Montant</span>
            <span className="text-lg font-bold text-[#343434]">
              {amount.toLocaleString()} XPF
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-[#8c8c8c]">Mode de paiement</span>
            <div className="flex items-center gap-2">
              {paymentMethod === "card" ? (
                <>
                  <CreditCard className="w-4 h-4 text-[#343434]" />
                  <span className="text-sm font-medium text-[#343434]">
                    {cardLast4 ? `${brandName} •••• ${cardLast4}` : "Carte bancaire"}
                  </span>
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4 text-[#343434]" />
                  <span className="text-sm font-medium text-[#343434]">Espèces</span>
                </>
              )}
            </div>
          </div>

          {isSuccess ? (
            <Button
              onClick={onClose}
              className="w-full h-12 bg-[#ffdf6d] hover:bg-[#f5d55c] text-[#343434] font-medium rounded-xl"
              data-testid="button-payment-close"
            >
              Continuer
            </Button>
          ) : (
            <div className="space-y-3">
              {role === "client" && onRetryPayment && (
                <Button
                  onClick={onRetryPayment}
                  className="w-full h-12 bg-[#ffdf6d] hover:bg-[#f5d55c] text-[#343434] font-medium rounded-xl"
                  data-testid="button-retry-payment"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Réessayer le paiement
                </Button>
              )}
              {role === "client" && onChangeCard && (
                <Button
                  onClick={onChangeCard}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-gray-200"
                  data-testid="button-change-card"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Changer de carte
                </Button>
              )}
              {role === "client" && onSwitchToCash && (
                <Button
                  onClick={onSwitchToCash}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-gray-200"
                  data-testid="button-switch-cash"
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  Payer en espèces
                </Button>
              )}
              {role === "driver" && onDriverRetryPayment && (
                <Button
                  onClick={onDriverRetryPayment}
                  className="w-full h-12 bg-[#ffdf6d] hover:bg-[#f5d55c] text-[#343434] font-medium rounded-xl"
                  data-testid="button-driver-retry-payment"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Relancer le paiement
                </Button>
              )}
              {role === "driver" && onDriverWaitForClient && (
                <Button
                  onClick={onDriverWaitForClient}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-gray-200"
                  data-testid="button-driver-wait"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Attendre le client
                </Button>
              )}
              {role === "driver" && (
                <Button
                  onClick={onClose}
                  variant="ghost"
                  className="w-full h-12 rounded-xl text-[#8c8c8c]"
                  data-testid="button-payment-close-failure"
                >
                  Fermer
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
