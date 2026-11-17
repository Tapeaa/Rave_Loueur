import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AlertButton,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#4ECC8B';
const RED = '#EF4444';
const AMBER = '#F59E0B';

type Tone = 'success' | 'error' | 'warning' | 'info';

type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  tone: Tone;
  cancelable: boolean;
  onDismiss?: () => void;
};

type AppAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
  tone?: Tone;
};

let nextId = 1;
const queue: DialogRequest[] = [];
let notify: (() => void) | null = null;

const ERROR_RE = /(erreur|impossible|échec|echec|invalide|refus|introuvable|expir)/i;
const SUCCESS_RE = /(merci|succès|succes|enregistr|envoy|confirm|bravo|félicitation|terminé|validé|ajouté|copié|supprimé)/i;

function inferTone(title: string, message: string | undefined, buttons: AlertButton[]): Tone {
  const text = `${title} ${message || ''}`;
  if (ERROR_RE.test(title)) return 'error';
  if (buttons.some((b) => b.style === 'destructive')) return 'warning';
  if (buttons.length > 1) return 'info';
  if (SUCCESS_RE.test(text)) return 'success';
  if (ERROR_RE.test(text)) return 'error';
  return 'info';
}

/** Remplaçant de `Alert.alert` : même signature, affiché avec la popup RAVE. */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AppAlertOptions
) {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  queue.push({
    id: nextId++,
    title,
    message,
    buttons: list,
    tone: options?.tone || inferTone(title, message, list),
    cancelable: options?.cancelable ?? list.length <= 1,
    onDismiss: options?.onDismiss,
  });
  notify?.();
}

const TONE: Record<Tone, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  success: { icon: 'checkmark', color: GREEN, bg: '#E8F8F0' },
  error: { icon: 'close', color: RED, bg: '#FEE2E2' },
  warning: { icon: 'alert', color: AMBER, bg: '#FEF3C7' },
  info: { icon: 'information', color: GREEN, bg: '#E8F8F0' },
};

export function AppDialogHost() {
  const [current, setCurrent] = useState<DialogRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const currentRef = useRef<DialogRequest | null>(null);

  useEffect(() => {
    const pump = () => {
      if (currentRef.current) return;
      const next = queue.shift();
      if (!next) return;
      currentRef.current = next;
      closing.current = false;
      setCurrent(next);
      setVisible(true);
    };
    notify = pump;
    pump();
    return () => {
      if (notify === pump) notify = null;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [visible, current?.id, anim]);

  const close = (after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      currentRef.current = null;
      setVisible(false);
      setCurrent(null);
      setTimeout(() => {
        after?.();
        notify?.();
      }, 30);
    });
  };

  if (!current) return null;

  const tone = TONE[current.tone];
  const buttons = current.buttons;
  const stacked = buttons.length > 2 || buttons.some((b) => (b.text || '').length > 16);
  const ordered = stacked
    ? [...buttons.filter((b) => b.style !== 'cancel'), ...buttons.filter((b) => b.style === 'cancel')]
    : [...buttons.filter((b) => b.style === 'cancel'), ...buttons.filter((b) => b.style !== 'cancel')];
  const primaryIndex = (() => {
    for (let i = ordered.length - 1; i >= 0; i--) if (ordered[i].style !== 'cancel') return i;
    return ordered.length - 1;
  })();

  const onBackdrop = () => {
    if (!current.cancelable) return;
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    close(() => {
      cancelBtn?.onPress?.();
      current.onDismiss?.();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onBackdrop}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
            <View style={[styles.iconInner, { backgroundColor: tone.color }]}>
              <Ionicons name={tone.icon} size={22} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {ordered.map((b, i) => {
              const destructive = b.style === 'destructive';
              const cancel = b.style === 'cancel';
              const primary = i === primaryIndex && !cancel;
              const bg = destructive ? RED : primary ? GREEN : '#F3F4F6';
              const fg = destructive || primary ? '#FFFFFF' : '#1a1a1a';
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  activeOpacity={0.85}
                  style={[styles.btn, !stacked && styles.btnRow, { backgroundColor: bg }]}
                  onPress={() => close(() => b.onPress?.())}
                >
                  <Text style={[styles.btnText, { color: fg }]} numberOfLines={1}>
                    {b.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    alignSelf: 'stretch',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  btn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnRow: {
    flex: 1,
  },
  btnText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
});
