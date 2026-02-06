require('dotenv').config();
module.exports = {
  expo: {
    name: "RAVE Loueur",
    slug: "rave-loueur",
    scheme: "rave-loueur",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/TAXI (12).png",
    userInterfaceStyle: "light",
    ios: {
      bundleIdentifier: "com.rave.loueur",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Permissions de localisation
        NSLocationWhenInUseUsageDescription: "RAVE Loueur utilise votre position pour afficher la localisation de vos véhicules aux clients.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "RAVE Loueur utilise votre position en arrière-plan pour permettre aux clients de localiser vos véhicules.",
        // Permissions caméra et galerie (photo de profil)
        NSCameraUsageDescription: "RAVE Loueur utilise la caméra pour vous permettre de prendre des photos de vos véhicules.",
        NSPhotoLibraryUsageDescription: "RAVE Loueur accède à votre galerie pour vous permettre de choisir des photos.",
        NSPhotoLibraryAddUsageDescription: "RAVE Loueur peut enregistrer des photos dans votre galerie.",
        // Permissions microphone (appels)
        NSMicrophoneUsageDescription: "RAVE Loueur peut utiliser le microphone pour les appels avec les clients.",
        // Permissions contacts (optionnel)
        NSContactsUsageDescription: "RAVE Loueur peut accéder à vos contacts pour faciliter le partage d'informations.",
        // Mode arrière-plan
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
      },
      entitlements: {
        "com.apple.security.application-groups": [
          "group.com.rave.loueur.onesignal"
        ]
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
      },
    },
    android: {
      package: "com.rave.loueur",
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
      appMode: "loueur",
      // Configuration de l'URL API :
      // - Par défaut : utilise le backend Render RAVE (https://backend-rave.onrender.com/api)
      // - Pour utiliser le mock local : définir EXPO_PUBLIC_API_URL=http://192.168.99.38:5000/api dans .env
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://backend-rave.onrender.com/api",
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
          locationAlwaysAndWhenInUsePermission: "RAVE Loueur utilise votre position pour permettre aux clients de localiser vos véhicules.",
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
