import React, { forwardRef } from 'react';
// Ce fichier ne devrait être chargé que sur les plateformes natives
// Si vous voyez cette erreur sur le web, c'est que le bundler charge ce fichier par erreur
// Utilisez maps.web.tsx ou maps.tsx à la place
import RNMapView, { 
  Marker as RNMarker, 
  Polyline as RNPolyline,
  MapViewProps, 
  MapMarkerProps,
  PolylineProps 
} from 'react-native-maps';

export const isMapsAvailable = true;

export const MapView = forwardRef<any, Partial<MapViewProps> & { style?: any; children?: React.ReactNode }>(
  ({ style, children, ...props }, ref) => {
    return (
      <RNMapView ref={ref} style={style} {...props}>
        {children}
      </RNMapView>
    );
  }
);

export const Marker = ({ children, ...props }: MapMarkerProps & { children?: React.ReactNode }) => {
  return <RNMarker {...props}>{children}</RNMarker>;
};

export const Polyline = (props: PolylineProps) => {
  return <RNPolyline {...props} />;
};
