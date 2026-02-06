# TĀPE'A - Application Mobile React Native

## Overview
TĀPE'A est une application de taxi et VTC pour la Polynésie française, convertie d'une application web React vers React Native avec Expo.

## État actuel
- **Plateforme**: React Native + Expo SDK 54
- **Serveur**: Expo Dev Server sur port 5000
- **Status**: Application fonctionnelle avec écran d'accueil, authentification, et navigation

## Stack technique
- **Framework**: React Native avec Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Query (@tanstack/react-query)
- **Temps réel**: Socket.io-client
- **Stockage sécurisé**: expo-secure-store
- **Icônes**: @expo/vector-icons (Ionicons)
- **Paiement**: Stripe (à configurer)
- **Cartes**: Google Maps (à configurer)

## Structure du projet
```
app/
├── _layout.tsx           # Layout principal avec providers
├── index.tsx             # Redirection vers welcome
├── (auth)/               # Écrans d'authentification
│   ├── _layout.tsx
│   ├── welcome.tsx       # Page d'accueil
│   ├── login.tsx         # Connexion client
│   ├── register.tsx      # Inscription client
│   ├── verify.tsx        # Vérification OTP
│   ├── forgot-password.tsx
│   └── reset-password.tsx
├── (client)/             # Interface client
│   ├── _layout.tsx       # Navigation par onglets
│   ├── index.tsx         # Accueil client (options de course)
│   ├── commandes.tsx     # Historique des courses
│   ├── wallet.tsx        # Portefeuille
│   ├── profil.tsx        # Profil utilisateur
│   ├── itinerary.tsx     # Page itinéraire avec autocomplétion Google Places
│   ├── commande-options.tsx # Options de réservation
│   ├── cartes-bancaires.tsx # Gestion des cartes
│   ├── info-perso.tsx    # Informations personnelles
│   ├── tarifs.tsx        # Grille tarifaire
│   ├── aide.tsx          # FAQ et aide
│   └── support.tsx       # Contact support
└── (chauffeur)/          # Interface chauffeur
    ├── _layout.tsx
    ├── login.tsx         # Connexion chauffeur (code 6 chiffres)
    ├── index.tsx         # Tableau de bord chauffeur
    ├── active-ride.tsx   # Course en cours
    ├── history.tsx       # Historique des courses
    ├── earnings.tsx      # Revenus
    └── profile.tsx       # Profil chauffeur

components/ui/            # Composants réutilisables
├── Button.tsx
├── Input.tsx
├── Card.tsx
├── Text.tsx
└── PhoneInput.tsx

lib/                      # Utilitaires
├── types.ts              # Types et constantes (tarifs, options)
├── api.ts                # Fonctions API avec SecureStore
├── socket.ts             # Configuration Socket.io
├── queryClient.ts        # React Query client
├── AuthContext.tsx       # Contexte d'authentification
├── stripe.tsx            # Wrapper Stripe (fallback web)
├── stripe.native.tsx     # Stripe natif (Development Build)
├── maps.tsx              # Wrapper Maps (fallback web)
└── maps.native.tsx       # Maps natif (Development Build)
```

## Configuration
### Variables d'environnement
- `EXPO_PUBLIC_API_URL`: URL de l'API backend
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: Clé API Google Maps pour l'autocomplétion

### Codes de test
- **Client**: N'importe quel numéro +689
- **Chauffeur**: Code `111111`

## Tarification
- **Course immédiate/Réservation**: 2300 XPF base + 150 XPF/km
- **Tour de l'île**: 30000 XPF forfait
- **Commission chauffeur**: 80%
- **Suppléments**: Bagages (500 XPF), Équipements (300 XPF)

## À configurer
1. URL de l'API backend (EXPO_PUBLIC_API_URL)
2. Clés Stripe pour les paiements
3. Clé API Google Maps pour la géolocalisation
4. Notifications push (Firebase ou Expo Push)

## Design System
### Couleurs principales
- **Jaune primaire**: `#F5C400` (boutons principaux)
- **Jaune clair**: `#ffdf6d` (icônes menu, catégories sélectionnées)
- **Vert foncé**: `#1a472a` (cercle logo)
- **Rouge support**: `#ff6b6b` (bouton support)
- **Texte foncé**: `#343434`
- **Texte gris**: `#5c5c5c`
- **Fond carte**: `#f6f6f6`

### Composants
- **Boutons**: `borderRadius: 9999` (rounded-full), hauteur 48px
- **Cards**: `borderRadius: 10` ou 12, fond #f6f6f6
- **Logo**: Dans cercle vert foncé (#1a472a)
- **Catégories**: Bulles horizontales scrollables, fond sombre transparent

## Notes importantes

### Mode Expo Go vs Development Build
- **Expo Go**: Mode actuel, permet de tester l'app sans compiler de build natif
- Les fonctionnalités natives (Maps, Stripe) nécessitent un **Development Build** via EAS
- Les wrappers `lib/stripe.tsx` et `lib/maps.tsx` fournissent des fallbacks gracieux pour Expo Go

### Pour activer Maps et Stripe (nécessite Development Build)
1. Installer expo-dev-client: `npx expo install expo-dev-client`
2. Créer un build de développement: `eas build --profile development --platform ios/android`
3. Installer le build sur votre appareil et scanner le QR code

## Dernières modifications
- 30/12/2025: Page itinéraire avec saisie d'adresses
  - Nouvelle page itinerary.tsx accessible depuis "Où allez-vous ?"
  - Saisie manuelle des adresses de départ et d'arrivée
  - Possibilité d'ajouter jusqu'à 3 arrêts intermédiaires
  - Timeline visuelle avec points colorés (vert = départ, jaune = arrêts, rouge = arrivée)
  - Transmission des données d'itinéraire vers commande-options
  - Prêt pour autocomplétion via backend proxy (endpoints /places/autocomplete et /places/details)
- 30/12/2025: Amélioration gestion des erreurs API
  - Nouvelle classe ApiError avec status, isNetworkError, isServerError
  - Vérification Content-Type avant parsing JSON (évite "JSON Parse error")
  - Messages d'erreur clairs en français pour les utilisateurs
  - Mode hors-ligne gracieux si API_URL non configurée
- 30/12/2025: Correction build EAS
  - Ajout NPM_CONFIG_LEGACY_PEER_DEPS dans eas.json pour résoudre conflits npm
  - Désactivation newArchEnabled (incompatible avec certains modules natifs)
  - Suppression plugin react-native-maps (clés API restent dans ios/android config)
  - Node version fixée à 20.18.0 pour builds EAS
- 30/12/2025: Configuration Development Build
  - Installation expo-dev-client
  - Configuration EAS avec projectId valide (b68a1d5a-a4cb-4b7a-8020-50a55355f5b4)
  - Création fichiers platform-specific (.native.tsx) pour Maps et Stripe
  - Metro sélectionne automatiquement le bon fichier selon la plateforme
  - Web = fallbacks, Mobile natif = vrais modules
- 30/12/2025: Restauration du mode Expo Go
  - Création de wrappers lib/stripe.tsx et lib/maps.tsx
  - Imports conditionnels pour éviter les erreurs de bundling web
  - Configuration eas.json pour builds futurs
- 30/12/2025: Design fidèle à l'application web originale
  - Écran Welcome avec cercle vert + logo + titre
  - Écran Login avec préfixe PF +689
  - Écran Client avec header, catégories, carte placeholder
  - Écran Chauffeur avec toggle online/offline
  - Écran Profil avec menu items jaune/gris
  - Boutons rounded-full avec couleurs exactes
- Conversion complète vers React Native/Expo
- Structure de navigation avec Expo Router
- Composants UI adaptés pour mobile
- Intégration Socket.io pour temps réel
- Écrans client et chauffeur complets
