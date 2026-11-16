import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { getWebPhoneMetrics, patchWebDimensions } from '@/lib/patch-web-dimensions';

patchWebDimensions();

type Props = ViewProps & { children: ReactNode };

/** Cadre téléphone 9:16 — no-op hors web */
export function WebMobileFrame({ children, style, ...rest }: Props) {
  const [size, setSize] = useState(getWebPhoneMetrics);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onResize = () => setSize(getWebPhoneMetrics());
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={[{ flex: 1 }, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View
        style={[
          styles.phone,
          { width: size.width, height: size.height },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0b',
  },
  phone: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    position: 'relative',
  },
});
