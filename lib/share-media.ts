import { Alert, Platform, Share } from 'react-native';

function getFileSystem(): any {
  try {
    return require('expo-file-system/legacy');
  } catch {
    return require('expo-file-system');
  }
}

function encodingBase64(FileSystem: any) {
  return FileSystem.EncodingType?.Base64 ?? FileSystem.EncodingType?.base64 ?? 'base64';
}

export function isEphemeralLocalUri(uri?: string | null): boolean {
  if (!uri) return true;
  return (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph://') ||
    uri.includes('/ImagePicker/') ||
    uri.includes('/Caches/ImagePicker/')
  );
}

export function isUsableMediaUri(uri?: string | null): boolean {
  if (!uri) return false;
  if (isEphemeralLocalUri(uri)) return false;
  return uri.startsWith('https://') || uri.startsWith('http://') || uri.startsWith('data:');
}

/** Prépare une URI file:// partageable depuis https / data: / file: */
export async function materializeImageForShare(
  uri: string,
  fileName: string
): Promise<string> {
  const FileSystem = getFileSystem();
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) throw new Error('Stockage local indisponible');

  const safe = fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const dest = `${baseDir}${safe}-${Date.now()}.jpg`;
  const encoding = encodingBase64(FileSystem);

  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    const download = await FileSystem.downloadAsync(uri, dest);
    if (!download?.uri || (download.status != null && download.status !== 200)) {
      throw new Error(`Téléchargement impossible (${download?.status || '?'})`);
    }
    return download.uri.startsWith('file://') || !download.uri.startsWith('/')
      ? download.uri
      : `file://${download.uri}`;
  }

  if (uri.startsWith('data:')) {
    const base64 = uri.replace(/^data:image\/\w+;base64,/, '');
    await FileSystem.writeAsStringAsync(dest, base64, { encoding });
    return dest.startsWith('file://') ? dest : `file://${dest}`;
  }

  // file:// — lire puis réécrire dans le cache
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding });
  await FileSystem.writeAsStringAsync(dest, base64, { encoding });
  return dest.startsWith('file://') ? dest : `file://${dest}`;
}

export async function shareImage(uri: string, name: string): Promise<void> {
  if (!uri) {
    Alert.alert('Erreur', 'Image introuvable.');
    return;
  }
  if (isEphemeralLocalUri(uri)) {
    Alert.alert(
      'Document indisponible',
      "Ce permis n'est plus accessible (fichier temporaire). Demandez au client de refaire une réservation — les nouvelles photos sont stockées en ligne."
    );
    return;
  }

  try {
    const fileUri = await materializeImageForShare(uri, name);
    const Sharing = require('expo-sharing');

    // iOS : expo-sharing d'abord (évite ALAssetsLibraryErrorDomain avec Share.share)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
        dialogTitle: name,
      });
      return;
    }

    if (Platform.OS === 'ios') {
      await Share.share({ url: fileUri, title: name });
      return;
    }

    Alert.alert('Indisponible', "Le partage n'est pas disponible sur cet appareil.");
  } catch (err: any) {
    console.error('[Share] Error:', err);
    Alert.alert(
      'Impossible d’enregistrer',
      err?.message || 'Impossible d’enregistrer ou de partager cette image. Réessayez.'
    );
  }
}

export async function shareHtmlAsPdf(html: string, title = 'Contrat RAVE'): Promise<void> {
  try {
    const Print = require('expo-print');
    const Sharing = require('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: title,
      });
      return;
    }
    if (Platform.OS === 'ios') {
      await Share.share({ url: uri, title });
      return;
    }
    Alert.alert('Indisponible', "Le partage n'est pas disponible sur cet appareil.");
  } catch (err) {
    console.error('[Share] Contract error:', err);
    Alert.alert('Erreur', 'Impossible d’enregistrer le contrat. Réessayez.');
  }
}
