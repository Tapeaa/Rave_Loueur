import { PageHeader } from "@/components/PageHeader";
import { UserProfileHeader } from "@/components/UserProfileHeader";
import { ChevronRight, User, CreditCard, Bell, Shield, LogOut, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/AuthContext";

interface ProfileMenuItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}

function ProfileMenuItem({ icon, label, href, onClick, variant = "default" }: ProfileMenuItemProps) {
  const content = (
    <Card className="bg-[#f6f6f6] rounded-[10px] border-0 shadow-none mb-2 hover-elevate">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${variant === "danger" ? "bg-red-100" : "bg-[#ffdf6d]"}`}>
            {icon}
          </div>
          <span className={`font-medium text-base ${variant === "danger" ? "text-red-600" : "text-[#5c5c5c]"}`}>
            {label}
          </span>
        </div>
        <ChevronRight className={`w-5 h-5 flex-shrink-0 ${variant === "danger" ? "text-red-600" : "text-[#5c5c5c]"}`} />
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button onClick={onClick} className="w-full text-left" data-testid={`button-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      {content}
    </button>
  );
}

export function Profil() {
  const { client, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="bg-white min-h-screen w-full max-w-[420px] mx-auto relative pb-8">
      <PageHeader title="Mon profil" />
      
      <div className="px-4">
        <UserProfileHeader 
          name={client?.firstName || "Client"}
          lastName={client?.lastName || ""}
          rating={5}
        />
      </div>

      <main className="px-4 mt-4">
        <div className="mb-6">
          <h2 className="font-semibold text-[#343434] text-lg mb-3">Mon compte</h2>
          
          <ProfileMenuItem 
            icon={<User className="w-5 h-5 text-[#5c5c5c]" />}
            label="Informations personnelles"
            href="/info-perso"
          />
          
          <ProfileMenuItem 
            icon={<CreditCard className="w-5 h-5 text-[#5c5c5c]" />}
            label="Moyens de paiement"
            href="/wallet"
          />
        </div>

        <div className="mb-6">
          <h2 className="font-semibold text-[#343434] text-lg mb-3">Paramètres</h2>
          
          <ProfileMenuItem 
            icon={<Bell className="w-5 h-5 text-[#5c5c5c]" />}
            label="Notifications"
            href="/notifications"
          />
          
          <ProfileMenuItem 
            icon={<Shield className="w-5 h-5 text-[#5c5c5c]" />}
            label="Confidentialité et sécurité"
            href="/confidentialite"
          />
        </div>

        <div className="mb-6">
          <h2 className="font-semibold text-[#343434] text-lg mb-3">Aide</h2>
          
          <ProfileMenuItem 
            icon={<HelpCircle className="w-5 h-5 text-[#5c5c5c]" />}
            label="Centre d'aide"
            href="/aide"
          />
        </div>

        <ProfileMenuItem 
          icon={<LogOut className="w-5 h-5 text-red-600" />}
          label="Déconnexion"
          variant="danger"
          onClick={handleLogout}
        />

        <p className="text-center text-[#8c8c8c] text-sm mt-6">
          Version 2.0.0
        </p>
      </main>
    </div>
  );
}
