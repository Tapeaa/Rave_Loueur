// Push notification utilities for iOS PWA

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Check if running as standalone PWA (required for iOS)
export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

// Check if iOS device
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[SW] Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

// Get VAPID public key from server
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/push/vapid-public-key');
    if (!response.ok) {
      console.error('[PUSH] Failed to get VAPID key');
      return null;
    }
    const data = await response.json();
    return data.publicKey;
  } catch (error) {
    console.error('[PUSH] Error fetching VAPID key:', error);
    return null;
  }
}

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[PUSH] Notifications not supported');
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  console.log('[PUSH] Notification permission:', permission);
  return permission;
}

// Subscribe to push notifications (uses sessionId for authentication)
export async function subscribeToPush(sessionId: string): Promise<boolean> {
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    if (!registration.pushManager) {
      console.error('[PUSH] PushManager not available');
      return false;
    }
    
    // Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('[PUSH] Permission not granted');
      return false;
    }
    
    // Get VAPID public key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.error('[PUSH] No VAPID public key');
      return false;
    }
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    
    console.log('[PUSH] Subscribed:', subscription);
    
    // Send subscription to server (server validates sessionId and extracts driverId)
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        subscription: subscription.toJSON()
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[PUSH] Failed to save subscription on server:', error);
      return false;
    }
    
    console.log('[PUSH] Subscription saved on server');
    return true;
  } catch (error) {
    console.error('[PUSH] Subscription error:', error);
    return false;
  }
}

// Unsubscribe from push notifications (uses sessionId for authentication)
export async function unsubscribeFromPush(sessionId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
    
    // Remove from server (server validates sessionId)
    await fetch(`/api/push/subscribe/${sessionId}`, {
      method: 'DELETE'
    });
    
    console.log('[PUSH] Unsubscribed successfully');
    return true;
  } catch (error) {
    console.error('[PUSH] Unsubscribe error:', error);
    return false;
  }
}

// Check if currently subscribed
export async function isSubscribedToPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    return false;
  }
}

// Check push subscription status from server (uses sessionId for authentication)
export async function checkPushStatus(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/push/status/${sessionId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.subscribed;
  } catch (error) {
    return false;
  }
}

// Get notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
