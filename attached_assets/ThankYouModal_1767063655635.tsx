import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Car } from "lucide-react";

interface ThankYouModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderPrice: number;
  isDriver?: boolean;
  driverEarnings?: number;
}

export function ThankYouModal({ 
  isOpen, 
  onClose, 
  orderPrice, 
  isDriver = false,
  driverEarnings = 0
}: ThankYouModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[340px] rounded-2xl p-6 text-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-[#343434] mb-1">
              Merci !
            </h2>
            <p className="text-[#8c8c8c] text-sm">
              Au plaisir de vous revoir
            </p>
          </div>

          <div className="w-full bg-[#f6f6f6] rounded-xl p-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Car className="w-5 h-5 text-[#5c5c5c]" />
              <span className="text-[#5c5c5c] text-sm font-medium">
                {isDriver ? "Récapitulatif de la course" : "Votre course"}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8c8c8c] text-sm">Prix total</span>
                <span className="font-bold text-[#343434]">
                  {orderPrice.toLocaleString()} XPF
                </span>
              </div>
              
              {isDriver && driverEarnings > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-[#8c8c8c] text-sm">Vos gains</span>
                  <span className="font-bold text-green-600">
                    {driverEarnings.toLocaleString()} XPF
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full h-12 bg-[#343434] hover:bg-[#222222] text-white font-medium rounded-xl"
            onClick={onClose}
            data-testid="button-close-thank-you"
          >
            Continuer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
