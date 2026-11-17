import Constants from 'expo-constants';

const ONESIGNAL_APP_ID =
  Constants.expoConfig?.extra?.oneSignalAppId || 'e36c17b6-38b3-48a4-bc95-72502a18aa2b';

let OneSignalModule: any = null;
let isInitialized = false;
let moduleLoadAttempted = false;
let pendingExternalId: string | null = null;
let pendingTags: Record<string, string> = {};
let lastColdStartClickNotification: any = null;
const clickSubscribers = new Set<(notification: any) => void>();
let nativeListenersRegistered = false;

function areNativeModulesAvailable(): boolean {
  try {
    const { NativeModules } = require('react-native');
    return NativeModules.OneSignal !== undefined && NativeModules.OneSignal !== null;
  } catch {
    return false;
  }
}

function getOneSignal() {
  if (OneSignalModule) return OneSignalModule;
  if (moduleLoadAttempted) return null;

  moduleLoadAttempted = true;

  if (!areNativeModulesAvailable()) {
    console.log('[OneSignal] Native modules not available (Expo Go / Web) - skipping');
    return null;
  }

  try {
    const { OneSignal } = require('react-native-onesignal');
    OneSignalModule = OneSignal;
    return OneSignal;
  } catch (error) {
    console.log('[OneSignal] Failed to load module:', error);
    return null;
  }
}

function registerNativeListenersOnce(OneSignal: any) {
  if (nativeListenersRegistered) return;
  nativeListenersRegistered = true;

  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      const notif = event?.notification;
      const type = notif?.additionalData?.type;
      // Les messages de chat ont déjà leur bannière verte in-app quand l'app est ouverte
      if (type === 'new_message') {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      notif?.display?.();
    });

    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const notif = event?.notification;
      if (!notif) return;
      if (clickSubscribers.size === 0) {
        lastColdStartClickNotification = notif;
        return;
      }
      clickSubscribers.forEach((cb) => {
        try {
          cb(notif);
        } catch (err) {
          console.log('[OneSignal] Click handler error:', err);
        }
      });
    });
  } catch (error) {
    console.log('[OneSignal] Error registering native listeners:', error);
  }
}

/**
 * Initialise OneSignal et applique tout login/tag demandé pendant le splash.
 */
export function initializeOneSignal() {
  const OneSignal = getOneSignal();
  if (!OneSignal) return;

  if (!isInitialized) {
    try {
      OneSignal.initialize(ONESIGNAL_APP_ID);
      isInitialized = true;
      registerNativeListenersOnce(OneSignal);
      OneSignal.Notifications.requestPermission(true);
      console.log('[OneSignal] ✅ Initialized with App ID:', ONESIGNAL_APP_ID);
    } catch (error) {
      console.log('[OneSignal] Initialization error:', error);
      return;
    }
  }

  if (pendingExternalId) {
    const id = pendingExternalId;
    pendingExternalId = null;
    try {
      OneSignal.login(id);
      console.log('[OneSignal] Applied deferred external ID:', id);
    } catch (error) {
      console.log('[OneSignal] Error applying deferred external ID:', error);
    }
  }

  if (Object.keys(pendingTags).length > 0) {
    const tags = { ...pendingTags };
    pendingTags = {};
    try {
      OneSignal.User.addTags(tags);
    } catch {}
  }
}

/**
 * Lie l'appareil au loueur connecté (external_id OneSignal).
 * S'assure que OneSignal est bien initialisé avant d'appeler `login()`.
 */
export function setDriverExternalId(driverId: string) {
  if (!driverId) return;
  const OneSignal = getOneSignal();
  if (!OneSignal) return;

  if (!isInitialized) {
    pendingExternalId = driverId;
    initializeOneSignal();
    return;
  }

  try {
    OneSignal.login(driverId);
    console.log('[OneSignal] Set external user ID:', driverId);
  } catch (error) {
    console.log('[OneSignal] Error setting external ID:', error);
  }
}

export function removeExternalId() {
  pendingExternalId = null;
  const OneSignal = getOneSignal();
  if (!OneSignal || !isInitialized) return;

  try {
    OneSignal.logout();
    console.log('[OneSignal] Removed external user ID');
  } catch (error) {
    console.log('[OneSignal] Error removing external ID:', error);
  }
}

export function addDriverTag(key: string, value: string) {
  const OneSignal = getOneSignal();
  if (!OneSignal) return;
  if (!isInitialized) {
    pendingTags[key] = value;
    initializeOneSignal();
    return;
  }
  try {
    OneSignal.User.addTag(key, value);
  } catch (error) {
    console.log('[OneSignal] Error adding tag:', error);
  }
}

export function addDriverTags(tags: Record<string, string>) {
  const OneSignal = getOneSignal();
  if (!OneSignal) return;
  if (!isInitialized) {
    pendingTags = { ...pendingTags, ...tags };
    initializeOneSignal();
    return;
  }
  try {
    OneSignal.User.addTags(tags);
  } catch (error) {
    console.log('[OneSignal] Error adding tags:', error);
  }
}

export function onNotificationReceived(callback: (notification: any) => void): () => void {
  const OneSignal = getOneSignal();
  if (!OneSignal) return () => {};
  if (!isInitialized) initializeOneSignal();

  const handler = (event: any) => callback(event?.notification);
  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', handler);
    return () => {
      try {
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handler);
      } catch {}
    };
  } catch {
    return () => {};
  }
}

/**
 * Écoute les clics sur une notification push (retourne la fonction de désabonnement).
 */
export function onNotificationClicked(callback: (notification: any) => void): () => void {
  const OneSignal = getOneSignal();
  if (!OneSignal) return () => {};
  if (!isInitialized) initializeOneSignal();

  clickSubscribers.add(callback);
  if (lastColdStartClickNotification) {
    const notif = lastColdStartClickNotification;
    lastColdStartClickNotification = null;
    setTimeout(() => {
      try {
        callback(notif);
      } catch {}
    }, 100);
  }

  return () => {
    clickSubscribers.delete(callback);
  };
}

export async function getSubscriptionId(): Promise<string | null> {
  const OneSignal = getOneSignal();
  if (!OneSignal || !isInitialized) return null;

  try {
    return OneSignal.User.pushSubscription.getPushSubscriptionId();
  } catch {
    return null;
  }
}

export function areNotificationsEnabled(): boolean {
  const OneSignal = getOneSignal();
  if (!OneSignal || !isInitialized) return false;

  try {
    return OneSignal.User.pushSubscription.getOptedIn();
  } catch {
    return false;
  }
}

export function isOneSignalAvailable(): boolean {
  return getOneSignal() !== null;
}

export default {
  initializeOneSignal,
  setDriverExternalId,
  removeExternalId,
  addDriverTag,
  addDriverTags,
  onNotificationReceived,
  onNotificationClicked,
  getSubscriptionId,
  areNotificationsEnabled,
  isOneSignalAvailable,
};
