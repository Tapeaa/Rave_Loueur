import { useState } from "react";
import { Menu, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription,
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Link } from "wouter";

const menuItems = [
  { label: "Accueil", href: "/" },
  { label: "Mon profil", href: "/profil" },
  { label: "Mes commandes", href: "/commandes" },
  { label: "Mon wallet", href: "/wallet" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Aide", href: "/aide" },
];

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  rightAction?: React.ReactNode;
}

export function PageHeader({ title, showBackButton = false, rightAction }: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center gap-4 px-4 py-4 pt-12 bg-white">
      {showBackButton ? (
        <Link href="/">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            data-testid="button-back"
          >
            <ArrowLeft className="w-6 h-6 text-[#5c5c5c]" />
          </Button>
        </Link>
      ) : (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button 
              size="icon" 
              className="bg-[#ffdf6d] hover:bg-[#ffd84f] rounded-full w-10 h-10"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5 text-[#5c5c5c]" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-gradient-to-b from-white to-gray-50/80 z-50 border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>
                Menu de navigation
              </SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-1 mt-8">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div
                    className="group relative w-full py-4 px-2 cursor-pointer transition-all duration-200"
                    onClick={() => setMenuOpen(false)}
                    data-testid={`menu-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="text-[#3a3a3a] font-light text-lg tracking-wide group-hover:text-[#1a1a1a] transition-colors">
                      {item.label}
                    </span>
                    <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-gray-200 via-gray-300 to-transparent opacity-60" />
                    <div className="absolute inset-0 bg-[#ffdf6d]/0 group-hover:bg-[#ffdf6d]/10 rounded-lg transition-colors duration-200" />
                  </div>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      )}
      <h1 className="font-bold text-[#393939] text-2xl flex-1">{title}</h1>
      {rightAction && <div className="ml-auto">{rightAction}</div>}
    </header>
  );
}
