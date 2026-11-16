/**
 * Sur le web, force Dimensions / useWindowDimensions au format mobile 9:16
 * (évite les layouts "desktop" pendant les tests navigateur).
 */
import { Dimensions, Platform } from 'react-native';

const ASPECT = 9 / 16;
const MAX_WIDTH = 430;
const MIN_WIDTH = 390;

export function getWebPhoneMetrics() {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844, scale: 1, fontScale: 1 };
  }
  const pad = 24;
  const vw = Math.max(MIN_WIDTH, window.innerWidth - pad * 2);
  const vh = Math.max(700, window.innerHeight - pad * 2);
  let width = Math.min(MAX_WIDTH, vw);
  if (width < MIN_WIDTH) width = MIN_WIDTH;
  let height = width / ASPECT;
  if (height > vh) {
    height = vh;
    width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, height * ASPECT));
  }
  return {
    width: Math.round(width),
    height: Math.round(height),
    scale: 1,
    fontScale: 1,
  };
}

let patched = false;

export function patchWebDimensions() {
  if (Platform.OS !== 'web' || patched || typeof window === 'undefined') return;
  patched = true;

  const originalGet = Dimensions.get.bind(Dimensions);
  Dimensions.get = ((key: 'window' | 'screen') => {
    if (key === 'window' || key === 'screen') {
      return getWebPhoneMetrics();
    }
    return originalGet(key);
  }) as typeof Dimensions.get;

  const originalAdd = Dimensions.addEventListener.bind(Dimensions);
  Dimensions.addEventListener = ((type: any, handler: any) => {
    if (type !== 'change') {
      return originalAdd(type, handler);
    }
    const wrapped = () => {
      const phone = getWebPhoneMetrics();
      handler({ window: phone, screen: phone });
    };
    window.addEventListener('resize', wrapped);
    const sub = originalAdd(type, wrapped);
    return {
      remove: () => {
        window.removeEventListener('resize', wrapped);
        sub?.remove?.();
      },
    };
  }) as typeof Dimensions.addEventListener;
}

// Auto-apply dès l'import du module
patchWebDimensions();

