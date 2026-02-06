import React, { forwardRef } from 'react';
import { View, Text } from 'react-native';

export const isMapsAvailable = false;

// Type générique pour accepter toutes les props de MapView
type MapViewFallbackProps = { 
  style?: any; 
  children?: React.ReactNode;
  [key: string]: any;
};

export const MapView = forwardRef<any, MapViewFallbackProps>(
  ({ style, children, ...props }, ref) => (
    <View 
      ref={ref as any}
      style={[style, { backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }]}
    >
      <Text style={{ color: '#6b7280', fontSize: 14 }}>Carte disponible sur mobile uniquement</Text>
      {children}
    </View>
  )
);

export const Marker = ({ children, ...props }: { children?: React.ReactNode; [key: string]: any }) => null;

export const Polyline = (props: Record<string, any>) => null;