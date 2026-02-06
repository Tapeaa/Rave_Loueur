#!/bin/bash
# Script pour préparer et créer un development build iOS

echo "🚀 Préparation du Development Build iOS pour TĀPE'A"
echo ""

# Vérifier si EAS CLI est installé
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI n'est pas installé"
    echo "📦 Installation de EAS CLI..."
    npm install -g eas-cli
    echo "✅ EAS CLI installé"
else
    echo "✅ EAS CLI est déjà installé"
fi

echo ""
echo "🔐 Vérification de la connexion Expo..."
eas whoami || {
    echo "📝 Connexion à Expo requise"
    eas login
}

echo ""
echo "📋 Configuration des secrets EAS..."
echo "Les secrets suivants seront configurés (vous pouvez les annuler si déjà configurés) :"
echo ""

# Configuration des secrets (vous pouvez annuler si déjà configurés)
read -p "Configurer GOOGLE_MAPS_API_KEY? (o/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "AlzaSyD-zLCMASnWQjXCt2_ynYPWtpwchUAq8Pg" --type string
fi

read -p "Configurer STRIPE_PUBLISHABLE_KEY? (o/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    eas secret:create --scope project --name STRIPE_PUBLISHABLE_KEY --value "pk_test_51RIvU0QvpKGpw34yyGNgNUhEMCEGQZDLPHmA60CGUE8gN17b8HfMwQWCDbEPJjfFyKjJJpSEcgOvFI5PwP4Cr5vA001LQrjXVh" --type string
fi

echo ""
echo "🏗️  Création du development build iOS..."
echo "Cette opération peut prendre 10-20 minutes..."
eas build --profile development --platform ios

echo ""
echo "✅ Build terminé !"
echo "📱 Suivez les instructions à l'écran pour installer l'app sur votre iPhone"
echo ""
echo "💡 Une fois l'app installée, lancez 'npm start' et scannez le QR code dans l'app"
