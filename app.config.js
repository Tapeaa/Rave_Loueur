require('dotenv').config();
module.exports = {
  expo: {
    name: "TĀPE'A Chauffeur",
    slug: "tapea-chauffeur-v2",
    scheme: "tapea-chauffeur-v2",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/images/TAXI (12).png",
    userInterfaceStyle: "light",
    ios: {
      bundleIdentifier: "com.tapea.chauffeur.v2",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Permissions de localisation
        NSLocationWhenInUseUsageDescription: "TĀPE'A Chauffeur utilise votre position pour afficher votre localisation aux clients et calculer les trajets.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "TĀPE'A Chauffeur utilise votre position en arrière-plan pour permettre aux clients de suivre votre trajet en temps réel.",
        // Permissions caméra et galerie (photo de profil)
        NSCameraUsageDescription: "TĀPE'A Chauffeur utilise la caméra pour vous permettre de prendre une photo de profil.",
        NSPhotoLibraryUsageDescription: "TĀPE'A Chauffeur accède à votre galerie pour vous permettre de choisir une photo de profil.",
        NSPhotoLibraryAddUsageDescription: "TĀPE'A Chauffeur peut enregistrer des photos dans votre galerie.",
        // Permissions microphone (appels et notifications vocales)
        NSMicrophoneUsageDescription: "TĀPE'A Chauffeur peut utiliser le microphone pour les appels avec les clients.",
        // Permissions contacts (optionnel - partage de course)
        NSContactsUsageDescription: "TĀPE'A Chauffeur peut accéder à vos contacts pour faciliter le partage d'informations.",
        // Mode arrière-plan
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
      },
      entitlements: {
        "com.apple.security.application-groups": [
          "group.com.tapea.chauffeur.v2.onesignal"
        ]
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
      },
    },
    android: {
      package: "com.tapea.chauffeur.v2",
      adaptiveIcon: {
        foregroundImage: "./assets/images/TAXI (12).png",
        backgroundColor: "#F5C400",
      },
      notification: {
        icon: "./assets/images/TAXI (12).png",
        color: "#F5C400",
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
        },
      },
    },
    updates: {
      url: "https://u.expo.dev/d9251047-67be-4746-8828-7a29ca20a65c",
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      appMode: "chauffeur",
      // Configuration de l'URL API :
      // - Par défaut : utilise le backend Render (https://back-end-tapea.onrender.com/api)
      // - Pour utiliser le mock local : définir EXPO_PUBLIC_API_URL=http://192.168.99.38:5000/api dans .env
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://back-end-tapea.onrender.com/api",
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
      oneSignalAppId: "62d9a9ec-c62b-4aae-9cb3-e0d0c46ccfe8",
      eas: {
        projectId: "d9251047-67be-4746-8828-7a29ca20a65c",
      },
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#1a1a1a",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "TĀPE'A Chauffeur utilise votre position pour permettre aux clients de suivre votre trajet.",
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        "onesignal-expo-plugin",
        {
          mode: process.env.NODE_ENV === "production" ? "production" : "development",
          devTeam: "UG53K2J3SU",
        }
      ]
    ]
  }
};
