import { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { View, StyleSheet, ActivityIndicator, Image, Animated, Platform, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { Asset } from 'expo-asset';
import * as SecureStore from 'expo-secure-store';

import { Text } from '@/components/ui/Text';
import { AuthProvider } from '@/lib/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { StripeProvider, isStripeAvailable } from '@/lib/stripe';
import { NetworkStatus } from '@/components/NetworkStatus';
import DriverMessageNotification from '@/components/MessageNotification';
import { initializeOneSignal, setDriverExternalId } from '@/lib/onesignal';
import { getDriverProfile, getDriverSessionId } from '@/lib/api';
import { connectSocket, joinDriverSession } from '@/lib/socket';

SplashScreen.preventAutoHideAsync();

const stripePublishableKey = Constants.expoConfig?.extra?.stripePublishableKey || '';

const StripeProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isStripeAvailable && StripeProvider) {
    return (
      <StripeProvider
        publishableKey={stripePublishableKey}
        merchantIdentifier="merchant.com.tapea"
      >
        {children}
      </StripeProvider>
    );
  }
  return <View style={{ flex: 1 }}>{children}</View>;
};

// Vidéo splash screen - même que l'app client (0129(1) (1).mp4)
const SPLASH_VIDEO = require('@/assets/images/splash-opening.mp4');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Images à précharger (chauffeur-app)
const allAppImages = [
  require('@/assets/images/logo.png'),
  require('@/assets/images/logolandingchauffeur.png'),
  require('@/assets/images/icon.png'),
  require('@/assets/images/icon-tarifs.png'),
  require('@/assets/images/icon-commandes.png'),
  require('@/assets/images/icon-documents.png'),
  require('@/assets/images/icon-contact.png'),
  require('@/assets/images/icon-paiement.png'),
  require('@/assets/images/icon-reservation.png'),
  require('@/assets/images/icon-taxi-immediat.png'),
  require('@/assets/images/icon-tour.png'),
  require('@/assets/images/Iconeacpp(1).gif'),
  require('@/assets/images/Icone_acpp_(5)_1764132915723_1767064460978.png'),
  require('@/assets/images/Icone_acpp__1764076202750_1767064460978.png'),
  require('@/assets/images/Icone_acpp_(2)_1764128496499_1767064468618.png'),
  require('@/assets/images/stopppp.gif'),
  require('@/assets/images/lestop.png'),
  require('@/assets/images/user-marker.png'),
  require('@/assets/images/voiture.png'),
  require('@/assets/images/taxi.png'),
  require('@/assets/images/1_1764131703346_1767064437791.png'),
  require('@/assets/images/2_1764131703346_1767064437791.png'),
  require('@/assets/images/3_1764131703346_1767064437791.png'),
  require('@/assets/images/1_1764131264721_1767064437791.png'),
  require('@/assets/images/2_1764131264721_1767064437791.png'),
  require('@/assets/images/3_1764131264721_1767064437791.png'),
  require('@/assets/images/6_1764076802813_1767064437791.png'),
  require('@/assets/images/7_1764076802813_1767064437791.png'),
  require('@/assets/images/8_1764076802813_1767064437791.png'),
  require('@/assets/images/9_1764076802813_1767064437791.png'),
  require('@/assets/images/10_1764076802814_1767064437791.png'),
  require('@/assets/images/calendar.png'),
  require('@/assets/images/discount.png'),
  require('@/assets/images/island.png'),
  require('@/assets/images/APPLICATION_MOBILE-3_1764074134063_1767064437792.png'),
  require('@/assets/images/APPLICATION_MOBILE-6_1764074860081_1767064437792.png'),
];

async function preloadSplashVideo(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(SPLASH_VIDEO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    console.log('[Preload] ✅ Vidéo splash chargée:', uri ? 'OK' : 'pas d\'URI');
    return uri;
  } catch (e) {
    console.warn('[Preload] Erreur vidéo splash:', e);
    return null;
  }
}

async function preloadAllImages(onProgress: (loaded: number, total: number) => void): Promise<void> {
  const total = allAppImages.length;
  let loaded = 0;
  const batchSize = 5;
  for (let i = 0; i < allAppImages.length; i += batchSize) {
    const batch = allAppImages.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (imageSource) => {
        try {
          await Asset.fromModule(imageSource).downloadAsync();
        } catch {
          // ignorer les images manquantes
        }
        loaded++;
        onProgress(loaded, total);
      })
    );
  }
  console.log(`[Preload] ✅ ${loaded}/${total} images chargées!`);
}

function LoadingScreen({
  progress,
  loadedCount,
  totalCount,
  videoUri,
}: {
  progress: number;
  loadedCount: number;
  totalCount: number;
  videoUri: string | null;
}) {
  const videoSource = videoUri ? { uri: videoUri } : SPLASH_VIDEO;

  return (
    <View style={styles.loadingContainer}>
      <StatusBar style="light" />
      {Platform.OS !== 'web' ? (
        <Video
          source={videoSource}
          style={styles.splashVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping={false}
          isMuted
          useNativeControls={false}
          usePoster={false}
        />
      ) : (
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.fallbackLogo}
          resizeMode="contain"
        />
      )}
      <View style={styles.progressOverlay}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: `${Math.min(100, progress)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {progress < 100 ? `Chargement... ${loadedCount}/${totalCount}` : 'Prêt !'}
        </Text>
        {progress < 100 && (
          <ActivityIndicator size="small" color="#F5C400" style={styles.spinner} />
        )}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(allAppImages.length);

  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    async function prepareApp() {
      try {
        console.log('[Preload] Début du préchargement complet...');

        const uri = await preloadSplashVideo();
        setVideoUri(uri);

        await new Promise((resolve) => setTimeout(resolve, 50));
        await SplashScreen.hideAsync();

        await preloadAllImages((loaded, total) => {
          setLoadedCount(loaded);
          setTotalCount(total);
          setLoadingProgress(Math.round((loaded / total) * 100));
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          initializeOneSignal();
          console.log('[App] OneSignal initialized successfully');
        } catch (error) {
          console.log('[App] OneSignal initialization error:', error);
        }

        const initSocketAndSession = async () => {
          try {
            const sessionId = await getDriverSessionId();
            if (sessionId) {
              connectSocket();
              joinDriverSession(sessionId);
              console.log('[App] Socket connected and driver session joined');
            }
          } catch (error) {
            console.log('[App] Socket initialization error:', error);
          }
        };
        await initSocketAndSession();

        getDriverProfile()
          .then((driver) => {
            if (driver?.id) {
              setDriverExternalId(driver.id);
              SecureStore.setItemAsync('driverExternalId', driver.id).catch(() => {});
            }
          })
          .catch(() => {});

        SecureStore.getItemAsync('driverExternalId')
          .then((storedId) => {
            if (storedId) setDriverExternalId(storedId);
          })
          .catch(() => {});

        console.log('[Preload] ✅ Toutes les ressources sont prêtes!');
      } catch (e) {
        console.warn('[Preload] Erreur:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepareApp();
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) await SplashScreen.hideAsync();
  }, [appIsReady]);

  if (!fontsLoaded || !appIsReady) {
    return (
      <LoadingScreen
        progress={loadingProgress}
        loadedCount={loadedCount}
        totalCount={totalCount}
        videoUri={videoUri}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <StripeProviderWrapper>
          <AuthProvider>
            <NetworkStatus />
            <DriverMessageNotification />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(chauffeur)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="dark" />
          </AuthProvider>
        </StripeProviderWrapper>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  splashVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fallbackLogo: {
    width: 180,
    height: 80,
    alignSelf: 'center',
    marginTop: '40%',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  progressTrack: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F5C400',
    borderRadius: 3,
  },
  progressText: {
    marginTop: 16,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  spinner: {
    marginTop: 24,
  },
});
