import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui/Text';
import { uploadVehiclePhoto } from '@/lib/api';

const MAX_PHOTOS = 8;

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
};

export function VehiclePhotosPicker({ photos, onChange, max = MAX_PHOTOS }: Props) {
  const [uploading, setUploading] = useState(false);

  const canAdd = photos.length < max;

  const addFromUri = async (uri: string) => {
    setUploading(true);
    try {
      const url = await uploadVehiclePhoto(uri);
      onChange([...photos, url].slice(0, max));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'envoyer la photo");
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie pour ajouter des photos.");
      return;
    }

    const remaining = max - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.55,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets.slice(0, remaining)) {
        const url = await uploadVehiclePhoto(asset.uri);
        uploaded.push(url);
      }
      onChange([...photos, ...uploaded].slice(0, max));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'envoyer les photos");
    } finally {
      setUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la caméra pour photographier le véhicule.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.55,
      allowsEditing: true,
      aspect: [4, 3],
      exif: false,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await addFromUri(result.assets[0].uri);
    }
  };

  const handleAdd = () => {
    if (!canAdd || uploading) return;
    Alert.alert('Photo du véhicule', 'Comment souhaitez-vous ajouter la photo ?', [
      { text: 'Appareil photo', onPress: () => takePhoto() },
      { text: 'Galerie', onPress: () => pickFromLibrary() },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const removeAt = (index: number) => {
    Alert.alert('Supprimer la photo', 'Retirer cette photo du véhicule ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => onChange(photos.filter((_, i) => i !== index)),
      },
    ]);
  };

  const setAsCover = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  };

  return (
    <View>
      <Text style={styles.hint}>
        Ajoutez jusqu’à {max} photos. La première sert de photo principale.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.thumbWrap}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setAsCover(index)} onLongPress={() => removeAt(index)}>
              <Image source={{ uri }} style={styles.thumb} />
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeTxt}>Principale</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeAt(index)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {canAdd && (
          <TouchableOpacity
            style={[styles.addTile, uploading && styles.addTileOff]}
            onPress={handleAdd}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#F5C400" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={26} color="#9CA3AF" />
                <Text style={styles.addTxt}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {photos.length > 1 && (
        <Text style={styles.tip}>Appuyez sur une photo pour en faire la principale</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 17,
  },
  tip: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  thumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'visible',
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(26,26,26,0.75)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverBadgeTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 3 },
    }),
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileOff: { opacity: 0.6 },
  addTxt: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
});
