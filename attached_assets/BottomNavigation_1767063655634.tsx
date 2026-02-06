import { Home, ClipboardList, Wallet, User } from "lucide-react";
import { useLocation, Link } from "wouter";

const navItems = [
  { path: "/", label: "Accueil", icon: Home },
  { path: "/commandes", label: "Commande", icon: ClipboardList },
  { path: "/wallet", label: "Wallet", icon: Wallet },
  { path: "/profil", label: "Profil", icon: User },
];

export function BottomNavigation() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 z-50">
      <div className="max-w-[420px] mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <div className="flex flex-col items-center gap-1 px-4 py-2 cursor-pointer">
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "text-[#ffd84f]" : "text-[#b8b8b8]"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    isActive ? "text-[#ffd84f]" : "text-[#b8b8b8]"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex justify-center pt-2">
        <div className="w-[89px] h-1 bg-black rounded-full" />
      </div>
    </nav>
  );
}
