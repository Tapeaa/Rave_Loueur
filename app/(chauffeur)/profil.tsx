import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, ScrollView, Image, Modal, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/Text';
import { getDriverProfile, updateDriverProfile, SessionExpiredError, API_URL, type DriverProfile } from '@/lib/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { logoutDriver } from '@/lib/logout';
import { useState, useEffect, useRef } from 'react';
import { BRAND } from '@/constants/brand';
import { appAlert } from '@/components/AppAlert';

const SIGNATURE_FILE = `${FileSystem.documentDirectory}loueur_signature.txt`;

const signaturePadHTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%}
.btns{position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;padding:12px;background:#fff;border-top:1px solid #e5e7eb}
.btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.clear{background:#f3f4f6;color:#374151}.save{background:#4ECC8B;color:#0B1F14}
</style></head><body>
<canvas id="c"></canvas>
<div class="btns"><button class="btn clear" onclick="clearSig()">Effacer</button><button class="btn save" onclick="saveSig()">Valider</button></div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');let drawing=false,hasDrawn=false;
function resize(){c.width=window.innerWidth;c.height=window.innerHeight-70;ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#1a1a1a'}
resize();window.onresize=resize;
function pos(e){const r=c.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}
c.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)},{passive:false});
c.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;hasDrawn=true;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()},{passive:false});
c.addEventListener('touchend',()=>{drawing=false});
c.addEventListener('mousedown',e=>{drawing=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
c.addEventListener('mousemove',e=>{if(!drawing)return;hasDrawn=true;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
c.addEventListener('mouseup',()=>{drawing=false});
function clearSig(){ctx.clearRect(0,0,c.width,c.height);hasDrawn=false}
function saveSig(){if(!hasDrawn){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:'Veuillez signer avant de valider.'}));return}
const data=c.toDataURL('image/png');window.ReactNativeWebView.postMessage(JSON.stringify({type:'signature',data}))}
</script></body></html>`;

export default function ChauffeurProfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', defaultMeetingPoint: '' });
  const webviewRef = useRef<WebView>(null);

  useEffect(() => {
    loadProfile();
    loadSavedSignature();
  }, []);

  const loadSavedSignature = async () => {
    try {
      const info = await FileSystem.getInfoAsync(SIGNATURE_FILE);
      if (info.exists) {
        const sig = await FileSystem.readAsStringAsync(SIGNATURE_FILE);
        if (sig) setSavedSignature(sig);
      }
    } catch {}
  };

  const handleSignatureMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'signature') {
        setSavedSignature(msg.data);
        FileSystem.writeAsStringAsync(SIGNATURE_FILE, msg.data).catch(() => {});
        setShowSignaturePad(false);
        appAlert('Signature enregistrée', 'Votre signature sera automatiquement appliquée sur tous les contrats de location.');
      } else if (msg.type === 'error') {
        appAlert('Attention', msg.msg);
      }
    } catch {}
  };

  const handleDeleteSignature = () => {
    appAlert('Supprimer la signature', 'Êtes-vous sûr de vouloir supprimer votre signature par défaut ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          setSavedSignature(null);
          await FileSystem.deleteAsync(SIGNATURE_FILE, { idempotent: true });
        }
      },
    ]);
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getDriverProfile();
      setProfile(data);
      if (data) {
        setEditForm({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          phone: data.phone || '',
          defaultMeetingPoint: data.defaultMeetingPoint || '',
        });
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await logoutDriver();
        router.replace('/(chauffeur)/login');
        return;
      }
      console.warn('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditForm({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      defaultMeetingPoint: profile.defaultMeetingPoint || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    if (profile) {
      setEditForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        defaultMeetingPoint: profile.defaultMeetingPoint || '',
      });
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    const firstName = editForm.firstName.trim();
    const lastName = editForm.lastName.trim();
    const phone = editForm.phone.trim();
    const defaultMeetingPoint = editForm.defaultMeetingPoint.trim() || null;
    if (!firstName || !lastName) {
      appAlert('Champs requis', 'Prénom et nom sont obligatoires.');
      return;
    }
    if (!phone) {
      appAlert('Champs requis', 'Le téléphone est obligatoire.');
      return;
    }
    try {
      setSaving(true);
      const updated = await updateDriverProfile(profile.id, {
        firstName,
        lastName,
        phone,
        defaultMeetingPoint,
      });
      if (updated) {
        setProfile({
          ...profile,
          ...updated,
          firstName,
          lastName,
          phone,
          defaultMeetingPoint,
        });
        setEditing(false);
        appAlert('Profil mis à jour', 'Les changements sont aussi visibles sur le dashboard.');
      }
    } catch (error: any) {
      if (error instanceof SessionExpiredError) {
        await logoutDriver();
        router.replace('/(chauffeur)/login');
        return;
      }
      appAlert('Erreur', error?.message || 'Impossible de sauvegarder le profil.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!profile) return;
    setUploadingPhoto(true);
    try {
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const formData = new FormData();
      formData.append('image', {
        uri,
        name: filename,
        type: match ? `image/${match[1].toLowerCase()}` : 'image/jpeg',
      } as any);

      const response = await fetch(`${API_URL}/upload/driver-photo`, { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Erreur lors de l'envoi de la photo");
      }

      const updated = await updateDriverProfile(profile.id, { photoUrl: data.url });
      setProfile({ ...profile, ...(updated || {}), photoUrl: data.url });
      appAlert('Photo mise à jour', 'Les clients voient maintenant votre photo de profil.');
    } catch (error: any) {
      if (error instanceof SessionExpiredError) {
        await logoutDriver();
        router.replace('/(chauffeur)/login');
        return;
      }
      appAlert('Erreur', error?.message || "Impossible d'envoyer la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFrom = async (source: 'library' | 'camera') => {
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        appAlert(
          'Permission requise',
          source === 'camera'
            ? "Autorisez l'accès à l'appareil photo pour prendre une photo."
            : "Autorisez l'accès à vos photos pour choisir une photo de profil."
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch {
      appAlert('Erreur', "Impossible d'ouvrir la photo.");
    }
  };

  const removePhoto = async () => {
    if (!profile) return;
    try {
      setUploadingPhoto(true);
      await updateDriverProfile(profile.id, { photoUrl: null });
      setProfile({ ...profile, photoUrl: null });
    } catch (error: any) {
      appAlert('Erreur', error?.message || 'Impossible de retirer la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const choosePhoto = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Choisir dans la galerie', onPress: () => pickFrom('library') },
      { text: 'Prendre une photo', onPress: () => pickFrom('camera') },
    ];
    if (profile?.photoUrl) {
      buttons.push({ text: 'Retirer la photo', style: 'destructive', onPress: removePhoto });
    }
    buttons.push({ text: 'Annuler', style: 'cancel' });
    appAlert('Photo de profil', 'Elle est visible par les clients sur vos offres et locations.', buttons);
  };

  const handleLogout = async () => {
    await logoutDriver();
    router.replace('/(chauffeur)/login');
  };

  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Loueur RAVE';
  const initials = profile
    ? `${(profile.firstName || '').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase() || 'R'
    : 'R';

  const openContact = () => {
    appAlert(
      'Contactez nous',
      `Email : contact@rave-location.com\n\nTéléphone : +689 87 75 98 97`,
      [
        { text: 'Appeler', onPress: () => Linking.openURL('tel:+68987759897') },
        { text: 'Envoyer un email', onPress: () => Linking.openURL('mailto:contact@rave-location.com') },
        { text: 'Fermer', style: 'cancel' },
      ]
    );
  };

  const renderRow = (opts: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    sub?: string;
    onPress?: () => void;
    first?: boolean;
    right?: React.ReactNode;
  }) => (
    <TouchableOpacity
      key={opts.label}
      style={[styles.row, !opts.first && styles.rowDivider]}
      onPress={opts.onPress}
      disabled={!opts.onPress}
      activeOpacity={0.7}
      accessibilityRole={opts.onPress ? 'button' : undefined}
      accessibilityLabel={opts.label}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={opts.icon} size={19} color="#16A34A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{opts.label}</Text>
        {opts.sub ? <Text style={styles.rowSub} numberOfLines={2}>{opts.sub}</Text> : null}
      </View>
      {opts.right ?? (opts.onPress ? <Ionicons name="chevron-forward" size={18} color="#C4C7CC" /> : null)}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon profil</Text>
          {profile && !editing ? (
            <TouchableOpacity style={styles.headerBtn} onPress={startEditing} accessibilityLabel="Modifier mon profil">
              <Ionicons name="create-outline" size={20} color={INK} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.heroOverscroll} />
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={choosePhoto}
              disabled={!profile || uploadingPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Changer ma photo de profil"
            >
              <View style={styles.avatar}>
                {profile?.photoUrl ? (
                  <Image source={{ uri: profile.photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
                {uploadingPhoto ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={15} color={INK} />
              </View>
            </TouchableOpacity>
            <Text style={styles.heroName} numberOfLines={1}>{fullName}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: profile?.isActive ? '#16A34A' : '#DC2626' }]} />
                <Text style={styles.statusPillText}>{profile?.isActive ? 'Compte actif' : 'Compte inactif'}</Text>
              </View>
              {profile?.prestataireName ? (
                <Text style={styles.heroCompany} numberOfLines={1}>{profile.prestataireName}</Text>
              ) : null}
            </View>
            {profile ? (
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{profile.totalRides ?? 0}</Text>
                  <Text style={styles.heroStatLabel}>Locations</Text>
                </View>
                <View style={styles.heroStat}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.heroStatValue}>
                      {profile.averageRating ? profile.averageRating.toFixed(1) : '–'}
                    </Text>
                    {profile.averageRating ? <Ionicons name="star" size={15} color={INK} /> : null}
                  </View>
                  <Text style={styles.heroStatLabel}>Note moyenne</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.sheet}>
            {loading ? (
              <ActivityIndicator size="large" color="#4ECC8B" style={{ marginTop: 30 }} />
            ) : (
              <>
                {editing ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Modifier mon profil</Text>
                    <View style={{ gap: 10 }}>
                      <TextInput
                        style={styles.editInput}
                        value={editForm.firstName}
                        onChangeText={(v) => setEditForm((f) => ({ ...f, firstName: v }))}
                        placeholder="Prénom"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="words"
                      />
                      <TextInput
                        style={styles.editInput}
                        value={editForm.lastName}
                        onChangeText={(v) => setEditForm((f) => ({ ...f, lastName: v }))}
                        placeholder="Nom"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="words"
                      />
                      <TextInput
                        style={styles.editInput}
                        value={editForm.phone}
                        onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                        placeholder="Téléphone"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                      />
                      <TextInput
                        style={[styles.editInput, { minHeight: 72, textAlignVertical: 'top' }]}
                        value={editForm.defaultMeetingPoint}
                        onChangeText={(v) => setEditForm((f) => ({ ...f, defaultMeetingPoint: v }))}
                        placeholder="Lieu de RDV par défaut (ex. Parking Fare Ute)"
                        placeholderTextColor="#9CA3AF"
                        multiline
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <TouchableOpacity style={[styles.editBtn, styles.editBtnGhost]} onPress={cancelEditing} disabled={saving}>
                          <Text style={styles.editBtnGhostText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.editBtn, styles.editBtnPrimary]} onPress={saveProfile} disabled={saving}>
                          {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.editBtnPrimaryText}>Enregistrer</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Mes informations</Text>
                    {renderRow({ icon: 'call-outline', label: 'Téléphone', sub: profile?.phone || 'Non renseigné', first: true })}
                    {renderRow({
                      icon: 'location-outline',
                      label: 'Lieu de RDV par défaut',
                      sub: profile?.defaultMeetingPoint || 'Aucun lieu défini',
                      onPress: profile ? startEditing : undefined,
                    })}
                    {renderRow({
                      icon: 'car-outline',
                      label: 'Mon véhicule',
                      sub: showVehicleInfo
                        ? [profile?.vehicleModel && `Modèle : ${profile.vehicleModel}`, profile?.vehiclePlate && `Plaque : ${profile.vehiclePlate}`]
                            .filter(Boolean)
                            .join(' · ') || 'Aucune information disponible'
                        : undefined,
                      onPress: () => setShowVehicleInfo(!showVehicleInfo),
                      right: <Ionicons name={showVehicleInfo ? 'chevron-down' : 'chevron-forward'} size={18} color="#C4C7CC" />,
                    })}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Signature des contrats</Text>
                  <Text style={styles.sectionHint}>
                    Ajoutée automatiquement sur tous les contrats de location que vous acceptez.
                  </Text>
                  {savedSignature ? (
                    <>
                      <View style={styles.signatureBox}>
                        <Image source={{ uri: savedSignature }} style={{ width: '100%', height: 80 }} resizeMode="contain" />
                        <View style={styles.signatureBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                          <Text style={styles.signatureBadgeText}>Enregistrée</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity onPress={() => setShowSignaturePad(true)} style={styles.signatureEditBtn} activeOpacity={0.7}>
                          <Ionicons name="pencil-outline" size={16} color="#1a1a1a" />
                          <Text style={styles.signatureEditText}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDeleteSignature} style={styles.signatureDeleteBtn} activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity onPress={() => setShowSignaturePad(true)} style={styles.signatureAddBtn} activeOpacity={0.8}>
                      <Ionicons name="pencil" size={18} color={INK} />
                      <Text style={styles.signatureAddText}>Ajouter ma signature</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Mon compte</Text>
                  {renderRow({ icon: 'ribbon-outline', label: 'Abonnement', onPress: () => router.push('/(chauffeur)/abonnement'), first: true })}
                  {renderRow({ icon: 'wallet-outline', label: 'Mes gains', onPress: () => router.push('/(chauffeur)/gains') })}
                  {renderRow({ icon: 'document-text-outline', label: "Conditions d'annulation", onPress: () => router.push('/(chauffeur)/conditions-annulation') })}
                  {renderRow({ icon: 'mail-outline', label: 'Contactez-nous', onPress: openContact })}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Légal</Text>
                  {renderRow({ icon: 'shield-checkmark-outline', label: 'Politique de confidentialité', onPress: () => router.push('/(chauffeur)/confidentialite'), first: true })}
                  {renderRow({ icon: 'document-text-outline', label: 'CGS Pro', onPress: () => router.push('/(chauffeur)/conditions-utilisation') })}
                </View>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  accessibilityLabel="Se déconnecter"
                  accessibilityRole="button"
                >
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text style={styles.logoutText}>Se déconnecter</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

      {/* Modal Signature Pad */}
      <Modal visible={showSignaturePad} animationType="slide" statusBarTranslucent onRequestClose={() => setShowSignaturePad(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 36 : 20) + 8, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text variant="h2" style={{ fontSize: 18 }}>Votre signature</Text>
            <TouchableOpacity onPress={() => setShowSignaturePad(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 }}>
              <Ionicons name="close" size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
          <WebView
            ref={webviewRef}
            source={{ html: signaturePadHTML }}
            style={{ flex: 1 }}
            onMessage={handleSignatureMessage}
            scrollEnabled={false}
            bounces={false}
          />
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const HERO_BG = '#4ECC8B';
const INK = '#0B1F14';
const INK_SOFT = 'rgba(11,31,20,0.65)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HERO_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: HERO_BG,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  heroOverscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: HERO_BG },
  hero: { backgroundColor: HERO_BG, alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: INK,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: HERO_BG,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#4ECC8B', letterSpacing: 1 },
  heroName: { marginTop: 14, fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '800', color: INK },
  heroCompany: { fontSize: 13, fontWeight: '700', color: INK_SOFT, maxWidth: 200 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  heroStat: {
    flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 18, paddingVertical: 12,
  },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: INK },
  heroStatLabel: { fontSize: 12, fontWeight: '700', color: INK_SOFT, marginTop: 2 },

  sheet: {
    flexGrow: 1, backgroundColor: '#FFFFFF', marginTop: -24,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40,
  },
  section: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.2, marginBottom: 8 },
  sectionHint: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEF0F2' },
  rowIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  rowSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  editInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#FAFAFA',
  },
  editBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  editBtnGhost: { backgroundColor: '#F3F4F6' },
  editBtnGhostText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  editBtnPrimary: { backgroundColor: BRAND.green },
  editBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: INK },

  signatureBox: {
    backgroundColor: '#FAFAFA', borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#EEF0F2',
  },
  signatureBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F8F0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  signatureBadgeText: { fontSize: 11, fontWeight: '800', color: '#166534' },
  signatureEditBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 13,
  },
  signatureEditText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  signatureDeleteBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 14, paddingHorizontal: 18,
  },
  signatureAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#4ECC8B', borderRadius: 14, paddingVertical: 15,
  },
  signatureAddText: { color: INK, fontSize: 15, fontWeight: '800' },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 15,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
  },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
