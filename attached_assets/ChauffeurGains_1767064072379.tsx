import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, Calendar, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

export function ChauffeurGains() {
  const [, setLocation] = useLocation();
  const [periode, setPeriode] = useState<"jour" | "semaine" | "mois">("semaine");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("chauffeurAuth");
    if (!isAuth) {
      setLocation("/chauffeur-login");
    } else {
      setIsAuthed(true);
    }
  }, [setLocation]);

  if (!isAuthed) {
    return (
      <div className="w-full max-w-[420px] mx-auto bg-white flex items-center justify-center" style={{ height: "100dvh" }}>
        <div className="w-8 h-8 border-4 border-[#ffdf6d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = {
    jour: { courses: 3, gains: 10500, bonus: 1000 },
    semaine: { courses: 18, gains: 68000, bonus: 5000 },
    mois: { courses: 72, gains: 285000, bonus: 20000 },
  };

  const currentStats = stats[periode];

  return (
    <div 
      className="relative w-full max-w-[420px] mx-auto bg-[#f8f8f8] overflow-auto"
      style={{ height: "100dvh" }}
    >
      <header 
        className="sticky top-0 z-20 bg-white flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/chauffeur")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#343434]" />
        </Button>
        <h1 className="text-lg font-semibold text-[#343434]">Mes gains</h1>
      </header>

      <div className="p-4 space-y-4 pb-8">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={periode === "jour" ? "default" : "outline"}
            className={periode === "jour" ? "bg-[#ffdf6d] text-[#343434] hover:bg-[#ffd84f]" : ""}
            onClick={() => setPeriode("jour")}
            data-testid="period-jour"
          >
            Aujourd'hui
          </Button>
          <Button
            size="sm"
            variant={periode === "semaine" ? "default" : "outline"}
            className={periode === "semaine" ? "bg-[#ffdf6d] text-[#343434] hover:bg-[#ffd84f]" : ""}
            onClick={() => setPeriode("semaine")}
            data-testid="period-semaine"
          >
            Cette semaine
          </Button>
          <Button
            size="sm"
            variant={periode === "mois" ? "default" : "outline"}
            className={periode === "mois" ? "bg-[#ffdf6d] text-[#343434] hover:bg-[#ffd84f]" : ""}
            onClick={() => setPeriode("mois")}
            data-testid="period-mois"
          >
            Ce mois
          </Button>
        </div>

        <Card className="p-6 bg-gradient-to-br from-[#343434] to-[#1a1a1a]">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-[#ffdf6d]" />
            <span className="text-white/70 text-sm">Total des gains</span>
          </div>
          <p className="text-white text-3xl font-bold">{currentStats.gains.toLocaleString()} XPF</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">+12% vs période précédente</span>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#5c5c5c]" />
              <span className="text-[#8c8c8c] text-xs">Courses</span>
            </div>
            <p className="text-[#343434] text-2xl font-bold">{currentStats.courses}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#5c5c5c]" />
              <span className="text-[#8c8c8c] text-xs">Bonus</span>
            </div>
            <p className="text-green-600 text-2xl font-bold">+{currentStats.bonus.toLocaleString()}</p>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold text-[#343434] mb-3">Détail des gains</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-[#5c5c5c]">Courses effectuées</span>
              <span className="text-[#343434] font-medium">{(currentStats.gains - currentStats.bonus).toLocaleString()} XPF</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-[#5c5c5c]">Bonus et primes</span>
              <span className="text-green-600 font-medium">+{currentStats.bonus.toLocaleString()} XPF</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[#343434] font-semibold">Total</span>
              <span className="text-[#343434] font-bold text-lg">{currentStats.gains.toLocaleString()} XPF</span>
            </div>
          </div>
        </Card>

        <Button 
          className="w-full bg-[#ffdf6d] hover:bg-[#ffd84f] text-[#343434] font-semibold"
          data-testid="button-withdraw"
        >
          Demander un retrait
        </Button>
      </div>
    </div>
  );
}
