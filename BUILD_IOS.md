# Guide pour créer un Development Build iOS

Ce guide explique comment créer et installer un development build sur votre iPhone pour tester l'application TĀPE'A.

## Prérequis

1. **Compte Expo** : Créez un compte sur [expo.dev](https://expo.dev) si vous n'en avez pas
2. **EAS CLI** : Installez EAS CLI globalement
3. **Apple Developer Account** (optionnel pour development build interne) : Pour installer sur un appareil réel sans compte développeur Apple, vous pouvez utiliser Expo Go, mais pour un development build avec toutes les fonctionnalités natives, vous aurez besoin d'un compte Apple Developer (99$/an)

## Étape 1 : Installer EAS CLI

```bash
npm install -g eas-cli
```

## Étape 2 : Se connecter à Expo

```bash
eas login
```

## Étape 3 : Configurer les variables d'environnement EAS

Les variables d'environnement doivent être configurées dans votre projet Expo. Vous pouvez les configurer via :

1. **Via EAS CLI** (recommandé pour les secrets) :
```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "AlzaSyD-zLCMASnWQjXCt2_ynYPWtpwchUAq8Pg"
eas secret:create --scope project --name STRIPE_PUBLISHABLE_KEY --value "pk_test_51RIvU0QvpKGpw34yyGNgNUhEMCEGQZDLPHmA60CGUE8gN17b8HfMwQWCDbEPJjfFyKjJJpSEcgOvFI5PwP4Cr5vA001LQrjXVh"
```

2. **Ou via le fichier .env local** (les variables seront lues lors du build)

## Étape 4 : Créer le Development Build iOS

```bash
eas build --profile development --platform ios
```

Cette commande va :
- Construire votre application avec toutes les dépendances natives
- Inclure le client de développement Expo
- Générer un fichier .ipa que vous pourrez installer sur votre iPhone

## Étape 5 : Installer sur votre iPhone

### Option A : Installation via TestFlight (avec compte Apple Developer)

1. Une fois le build terminé, vous recevrez un lien
2. Téléchargez le fichier .ipa
3. Transférez-le via TestFlight ou Xcode

### Option B : Installation directe (sans compte Apple Developer - méthode alternative)

Pour tester sans compte Apple Developer, vous pouvez utiliser **Expo Go** ou créer un build de développement local :

```bash
# Build local (nécessite Xcode sur Mac)
npx expo run:ios --device
```

### Option C : Installation via Expo Development Build (recommandé)

1. Une fois le build terminé, EAS vous donnera un lien QR code
2. Scannez le QR code avec votre iPhone
3. L'application s'installera directement

## Étape 6 : Lancer le serveur de développement

Une fois l'app installée sur votre iPhone :

```bash
npm start
```

Ensuite, dans l'app sur votre iPhone :
1. Scannez le QR code affiché dans le terminal
2. L'app se chargera avec votre code source

## Étape 7 : Se connecter au même réseau

⚠️ **Important** : Votre iPhone et votre ordinateur doivent être sur le même réseau WiFi pour que le développement fonctionne.

## Configuration actuelle

- **Profile** : `development`
- **Platform** : iOS
- **Bundle Identifier** : `com.tapea.app`
- **Project ID** : `b68a1d5a-a4cb-4b7a-8020-50a55355f5b4`

## Dépannage

### Erreur "No Apple Developer account"
Si vous n'avez pas de compte Apple Developer, vous pouvez :
- Utiliser Expo Go (limité aux modules compatibles Expo Go)
- Créer un build local avec Xcode (nécessite Mac)
- Utiliser un compte Apple Developer (recommandé pour production)

### Erreur de build
Vérifiez que toutes les variables d'environnement sont configurées :
```bash
eas secret:list
```

### L'app ne se connecte pas au serveur de dev
- Vérifiez que votre iPhone et votre ordinateur sont sur le même WiFi
- Vérifiez que le port 8081 n'est pas bloqué par un firewall
- Essayez de redémarrer le serveur Expo

## Commandes utiles

```bash
# Voir les builds en cours
eas build:list

# Voir les secrets configurés
eas secret:list

# Annuler un build
eas build:cancel [BUILD_ID]

# Voir les logs d'un build
eas build:view [BUILD_ID]
```
