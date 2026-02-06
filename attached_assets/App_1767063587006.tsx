import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { Accueil } from "@/pages/Accueil";
import { Commandes } from "@/pages/Commandes";
import { Wallet } from "@/pages/Wallet";
import { Profil } from "@/pages/Profil";
import { Tarifs } from "@/pages/Tarifs";
import { Aide } from "@/pages/Aide";
import { Support } from "@/pages/Support";
import { InfoPerso } from "@/pages/InfoPerso";
import { Notifications } from "@/pages/Notifications";
import { Confidentialite } from "@/pages/Confidentialite";
import { Reservation } from "@/pages/Reservation";
import { MapPicker } from "@/pages/MapPicker";
import { CommandeOptions } from "@/pages/CommandeOptions";
import { CommandeDetails } from "@/pages/CommandeDetails";
import { CommandeSuccess } from "@/pages/CommandeSuccess";
import { Documents } from "@/pages/Documents";
import { Contact } from "@/pages/Contact";
import { ChauffeurLogin } from "@/pages/ChauffeurLogin";
import { ChauffeurAccueil } from "@/pages/ChauffeurAccueil";
import { ChauffeurProfil } from "@/pages/ChauffeurProfil";
import { ChauffeurCourses } from "@/pages/ChauffeurCourses";
import { ChauffeurGains } from "@/pages/ChauffeurGains";
import { ChauffeurAide } from "@/pages/ChauffeurAide";
import { ChauffeurSupport } from "@/pages/ChauffeurSupport";
import { ChauffeurDocuments } from "@/pages/ChauffeurDocuments";
import { CourseDetails } from "@/pages/CourseDetails";
import { CourseEnCours } from "@/pages/CourseEnCours";
import { ChauffeurCourseEnCours } from "@/pages/ChauffeurCourseEnCours";
import { CartesBancaires } from "@/pages/CartesBancaires";

import { AuthWelcome } from "@/pages/auth/AuthWelcome";
import { AuthLogin } from "@/pages/auth/AuthLogin";
import { AuthRegister } from "@/pages/auth/AuthRegister";
import { AuthVerify } from "@/pages/auth/AuthVerify";
import { AuthForgotPassword } from "@/pages/auth/AuthForgotPassword";
import { AuthResetPassword } from "@/pages/auth/AuthResetPassword";

function Router() {
  return (
    <Switch>
      {/* Auth pages - public */}
      <Route path="/auth" component={AuthWelcome} />
      <Route path="/auth/login" component={AuthLogin} />
      <Route path="/auth/register" component={AuthRegister} />
      <Route path="/auth/verify" component={AuthVerify} />
      <Route path="/auth/forgot-password" component={AuthForgotPassword} />
      <Route path="/auth/reset-password" component={AuthResetPassword} />
      
      {/* Public pages */}
      <Route path="/" component={Accueil} />
      <Route path="/tarifs" component={Tarifs} />
      <Route path="/aide" component={Aide} />
      <Route path="/support" component={Support} />
      <Route path="/documents" component={Documents} />
      <Route path="/contact" component={Contact} />
      
      {/* Protected client pages */}
      <Route path="/commandes">
        {() => <ProtectedRoute><Commandes /></ProtectedRoute>}
      </Route>
      <Route path="/wallet">
        {() => <ProtectedRoute><Wallet /></ProtectedRoute>}
      </Route>
      <Route path="/cartes-bancaires">
        {() => <ProtectedRoute><CartesBancaires /></ProtectedRoute>}
      </Route>
      <Route path="/profil">
        {() => <ProtectedRoute><Profil /></ProtectedRoute>}
      </Route>
      <Route path="/info-perso">
        {() => <ProtectedRoute><InfoPerso /></ProtectedRoute>}
      </Route>
      <Route path="/notifications">
        {() => <ProtectedRoute><Notifications /></ProtectedRoute>}
      </Route>
      <Route path="/confidentialite">
        {() => <ProtectedRoute><Confidentialite /></ProtectedRoute>}
      </Route>
      <Route path="/reservation">
        {() => <ProtectedRoute><Reservation /></ProtectedRoute>}
      </Route>
      <Route path="/map-picker">
        {() => <ProtectedRoute><MapPicker /></ProtectedRoute>}
      </Route>
      <Route path="/commande-options">
        {() => <ProtectedRoute><CommandeOptions /></ProtectedRoute>}
      </Route>
      <Route path="/commande-details">
        {() => <ProtectedRoute><CommandeDetails /></ProtectedRoute>}
      </Route>
      <Route path="/commande-success">
        {() => <ProtectedRoute><CommandeSuccess /></ProtectedRoute>}
      </Route>
      <Route path="/course-en-cours">
        {() => <ProtectedRoute><CourseEnCours /></ProtectedRoute>}
      </Route>
      <Route path="/course/:id">
        {() => <ProtectedRoute><CourseDetails isChauffeur={false} /></ProtectedRoute>}
      </Route>
      
      {/* Driver pages - separate auth */}
      <Route path="/chauffeur-login" component={ChauffeurLogin} />
      <Route path="/chauffeur" component={ChauffeurAccueil} />
      <Route path="/chauffeur/profil" component={ChauffeurProfil} />
      <Route path="/chauffeur/courses" component={ChauffeurCourses} />
      <Route path="/chauffeur/gains" component={ChauffeurGains} />
      <Route path="/chauffeur/aide" component={ChauffeurAide} />
      <Route path="/chauffeur/support" component={ChauffeurSupport} />
      <Route path="/chauffeur/documents" component={ChauffeurDocuments} />
      <Route path="/chauffeur/course/:id">
        {() => <CourseDetails isChauffeur={true} />}
      </Route>
      <Route path="/chauffeur/course-en-cours" component={ChauffeurCourseEnCours} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
