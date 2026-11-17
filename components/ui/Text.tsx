import { Text as RNText, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { ReactNode } from 'react';

interface TextProps {
  children: ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
  style?: StyleProp<TextStyle>;
  color?: string;
  numberOfLines?: number;
}

export function Text({
  children,
  variant = 'body',
  style,
  color,
  numberOfLines,
}: TextProps) {
  return (
    <RNText
      style={[styles[variant], color && { color }, lineHeightFor(variant, style), style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
}

// La lineHeight du variant est calée sur sa propre taille : une taille personnalisée sans lineHeight
// (ex. chiffre de 11 px dans une pastille de 20 px) serait décalée vers le bas et rognée.
function lineHeightFor(variant: keyof typeof styles, style: StyleProp<TextStyle>): TextStyle | null {
  const flat = StyleSheet.flatten(style);
  if (!flat?.fontSize || flat.lineHeight != null || flat.fontSize === styles[variant].fontSize) return null;
  return { lineHeight: Math.round(flat.fontSize * 1.3) };
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 34,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 30,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1a1a1a',
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6b7280',
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 20,
  },
});
