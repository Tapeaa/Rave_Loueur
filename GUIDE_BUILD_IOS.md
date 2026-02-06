# 🚀 Guide Rapide : Development Build iOS

## ✅ Ce qui a été fait

1. ✅ **SecureStore corrigé** : Utilise maintenant localStorage sur le web et SecureStore sur mobile
2. ✅ **Configuration EAS mise à jour** : Prête pour les builds iOS
3. ✅ **Variables d'environnement configurées** : Dans `.env` et `eas.json`

## 📱 Étapes pour créer le Development Build iOS

### Étape 1 : Installer EAS CLI

Ouvrez PowerShell ou Terminal dans le dossier du projet et exécutez :

```bash
npm install -g eas-cli
```

### Étape 2 : Se connecter à Expo

```bash
eas login
```

Suivez les instructions pour vous connecter avec votre compte Expo (créez-en un sur [expo.dev](https://expo.dev) si nécessaire).

### Étape 3 : Configurer les secrets EAS (optionnel si déjà fait)

Les secrets peuvent être configurés via EAS ou via le fichier `.env` local. Pour les configurer dans EAS :

```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "AlzaSyD-zLCMASnWQjXCt2_ynYPWtpwchUAq8Pg" --type string
eas secret:create --scope project --name STRIPE_PUBLISHABLE_KEY --value "pk_test_51RIvU0QvpKGpw34yyGNgNUhEMCEGQZDLPHmA60CGUE8gN17b8HfMwQWCDbEPJjfFyKjJJpSEcgOvFI5PwP4Cr5vA001LQrjXVh" --type string
```

**Note** : Si vous avez déjà configuré ces secrets, vous pouvez ignorer cette étape.

### Étape 4 : Créer le Development Build

```bash
eas build --profile development --platform ios
```

Cette commande va :
- 📦 Construire votre application avec toutes les dépendances natives
- 🔧 Inclure le client de développement Expo
- ⏱️ Prendre environ 10-20 minutes
- 📱 Générer un lien de téléchargement pour installer sur votre iPhone

### Étape 5 : Installer sur votre iPhone

Une fois le build terminé, EAS vous donnera :
1. Un **QR code** à scanner avec votre iPhone
2. Un **lien de téléchargement** direct
3. Ou un fichier **.ipa** à transférer via TestFlight/Xcode

Scannez le QR code avec votre iPhone ou suivez les instructions à l'écran.

### Étape 6 : Lancer le serveur de développement

Une fois l'app installée sur votre iPhone, retournez dans votre terminal et lancez :

```bash
npm start
```

Puis, dans l'app sur votre iPhone :
1. L'app devrait se charger automatiquement
2. Ou scannez le QR code affiché dans le terminal
3. Votre code source se chargera dans l'app

## ⚠️ Prérequis Importants

### Compte Apple Developer

Pour installer sur un iPhone réel, vous avez besoin d'un **compte Apple Developer** (99$/an) si vous utilisez EAS Build. 

**Alternatives sans compte Apple Developer :**
- Utiliser **Expo Go** (limité aux modules compatibles)
- Créer un build local avec Xcode sur Mac
- Utiliser un simulateur iOS (nécessite Mac)

### Réseau WiFi

⚠️ **Important** : Votre iPhone et votre ordinateur doivent être sur le **même réseau WiFi** pour que le développement fonctionne.

## 🔍 Vérifier la configuration

Pour voir les secrets configurés :
```bash
eas secret:list
```

Pour voir les builds en cours :
```bash
eas build:list
```

## 📋 Configuration actuelle

- **Profile** : `development`
- **Platform** : iOS  
- **Bundle ID** : `com.tapea.app`
- **Project ID** : `b68a1d5a-a4cb-4b7a-8020-50a55355f5b4`

## 🐛 Dépannage

### Erreur "No Apple Developer account"
→ Créez un compte sur [developer.apple.com](https://developer.apple.com) ou utilisez Expo Go

### L'app ne se connecte pas au serveur
→ Vérifiez que iPhone et PC sont sur le même WiFi
→ Vérifiez que le port 8081 n'est pas bloqué

### Build échoue
→ Vérifiez les logs avec `eas build:view [BUILD_ID]`
→ Vérifiez que tous les secrets sont configurés

## 📞 Commandes utiles

```bash
# Se connecter à Expo
eas login

# Voir les builds
eas build:list

# Voir les secrets
eas secret:list

# Créer un build iOS
eas build --profile development --platform ios

# Voir les logs d'un build
eas build:view [BUILD_ID]

# Lancer le serveur de dev
npm start
```

## ✨ Une fois installé

Votre app fonctionnera comme une vraie application native avec :
- ✅ SecureStore (stockage sécurisé)
- ✅ Google Maps (cartes natives)
- ✅ Stripe (paiements)
- ✅ Toutes les fonctionnalités natives
- ✅ Hot reload pour le développement

Bonne chance ! 🎉
