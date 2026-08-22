import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, ScrollView, Image, Modal, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '@/lib/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { removeDriverSessionId, getDriverProfile, updateDriverProfile, SessionExpiredError, type DriverProfile } from '@/lib/api';
import { removeExternalId, addDriverTag } from '@/lib/onesignal';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { disconnectSocket } from '@/lib/socket';
import { useState, useEffect, useRef } from 'react';
import { BRAND } from '@/constants/brand';

const SIGNATURE_FILE = `${FileSystem.documentDirectory}loueur_signature.txt`;

const signaturePadHTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%}
.btns{position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;padding:12px;background:#fff;border-top:1px solid #e5e7eb}
.btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.clear{background:#f3f4f6;color:#374151}.save{background:#171717;color:#fff}
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
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });
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
        Alert.alert('Signature enregistrée', 'Votre signature sera automatiquement appliquée sur tous les contrats de location.');
      } else if (msg.type === 'error') {
        Alert.alert('Attention', msg.msg);
      }
    } catch {}
  };

  const handleDeleteSignature = () => {
    Alert.alert('Supprimer la signature', 'Êtes-vous sûr de vouloir supprimer votre signature par défaut ?', [
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
        });
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await removeDriverSessionId();
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
      });
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    const firstName = editForm.firstName.trim();
    const lastName = editForm.lastName.trim();
    const phone = editForm.phone.trim();
    if (!firstName || !lastName) {
      Alert.alert('Champs requis', 'Prénom et nom sont obligatoires.');
      return;
    }
    if (!phone) {
      Alert.alert('Champs requis', 'Le téléphone est obligatoire.');
      return;
    }
    try {
      setSaving(true);
      const updated = await updateDriverProfile(profile.id, { firstName, lastName, phone });
      if (updated) {
        setProfile({ ...profile, ...updated, firstName, lastName, phone });
        setEditing(false);
        Alert.alert('Profil mis à jour', 'Les changements sont aussi visibles sur le dashboard.');
      }
    } catch (error: any) {
      if (error instanceof SessionExpiredError) {
        await removeDriverSessionId();
        router.replace('/(chauffeur)/login');
        return;
      }
      Alert.alert('Erreur', error?.message || 'Impossible de sauvegarder le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    addDriverTag('status', 'offline');
    removeExternalId();
    await SecureStore.deleteItemAsync('driverExternalId');
    await removeDriverSessionId();
    disconnectSocket();
    router.replace('/(chauffeur)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => safeBack(router)}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h1">Profil Loueur</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#4ECC8B" style={{ marginTop: 40 }} />
        ) : (
          <>
            <Card style={styles.profileCard}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color={BRAND.green} />
              </View>
              {editing ? (
                <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
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
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[styles.editBtn, styles.editBtnGhost]}
                      onPress={cancelEditing}
                      disabled={saving}
                    >
                      <Text style={styles.editBtnGhostText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editBtn, styles.editBtnPrimary]}
                      onPress={saveProfile}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.editBtnPrimaryText}>Enregistrer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text variant="h3">
                    {profile ? `${profile.firstName} ${profile.lastName}` : 'Loueur RAVE'}
                  </Text>
                  <Text variant="caption" style={{ color: profile?.isActive ? '#22c55e' : '#ef4444' }}>
                    {profile?.isActive ? 'Actif' : 'Inactif'}
                  </Text>
                  {profile?.phone ? (
                    <Text variant="caption" style={{ color: '#6b7280', marginTop: 4 }}>
                      {profile.phone}
                    </Text>
                  ) : null}
                  {profile?.prestataireName ? (
                    <Text variant="caption" style={{ color: '#6b7280', marginTop: 6 }}>
                      {profile.prestataireName}
                    </Text>
                  ) : null}
                  {profile ? (
                    <TouchableOpacity style={styles.modifyLink} onPress={startEditing} activeOpacity={0.7}>
                      <Ionicons name="create-outline" size={16} color={BRAND.green} />
                      <Text style={styles.modifyLinkText}>Modifier mon profil</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </Card>
            
            {/* Statistiques */}
            {profile && (
              <Card style={styles.statsCard}>
                <Text variant="label" style={styles.sectionTitle}>Statistiques</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{profile.totalRides}</Text>
                    <Text style={styles.statLabel}>Locations</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile.averageRating ? profile.averageRating.toFixed(1) : '-'}
                    </Text>
                    <Text style={styles.statLabel}>Note</Text>
                  </View>
                </View>
              </Card>
            )}

            {/* ═══ SIGNATURE PAR DÉFAUT ═══ */}
            <Card style={[styles.statsCard, { borderWidth: 1, borderColor: savedSignature ? '#22C55E30' : '#F59E0B30' }]}>
              <Text variant="label" style={styles.sectionTitle}>Signature pour les contrats</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 18 }}>
                Cette signature sera automatiquement ajoutée sur tous les contrats de location que vous acceptez.
              </Text>

              {savedSignature ? (
                <View>
                  <View style={{ backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Image source={{ uri: savedSignature }} style={{ width: '100%', height: 80 }} resizeMode="contain" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                    <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '600' }}>Signature enregistrée</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => setShowSignaturePad(true)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#374151" />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteSignature}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowSignaturePad(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#171717', borderRadius: 12, paddingVertical: 14 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Ajouter ma signature</Text>
                </TouchableOpacity>
              )}
            </Card>

            <View style={styles.menuContainer}>
              <View>
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => setShowVehicleInfo(!showVehicleInfo)}
                  accessibilityLabel="Mon véhicule"
                  accessibilityRole="button"
                  accessibilityHint={showVehicleInfo ? "Masque les informations du véhicule" : "Affiche les informations du véhicule"}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name="car-outline" size={22} color="#1a1a1a" />
                  </View>
                  <Text variant="body">Mon véhicule</Text>
                  <Ionicons 
                    name={showVehicleInfo ? "chevron-down" : "chevron-forward"} 
                    size={20} 
                    color="#6b7280" 
                  />
                </TouchableOpacity>
                {showVehicleInfo && profile && (
                  <View style={styles.vehicleInfoContainer}>
                    {profile.vehicleModel ? (
                      <Text style={styles.vehicleInfoText}>
                        Modèle : {profile.vehicleModel}
                      </Text>
                    ) : null}
                    {profile.vehiclePlate ? (
                      <Text style={styles.vehicleInfoText}>
                        Plaque : {profile.vehiclePlate}
                      </Text>
                    ) : null}
                    {!profile.vehicleModel && !profile.vehiclePlate && (
                      <Text style={styles.vehicleInfoText}>
                        Aucune information disponible
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  Alert.alert(
                    'Contactez nous',
                    `Email : contact@rave-location.com\n\nTéléphone : +689 87 75 98 97`,
                    [
                      {
                        text: 'Appeler',
                        onPress: () => Linking.openURL('tel:+68987759897'),
                      },
                      {
                        text: 'Envoyer un email',
                        onPress: () => Linking.openURL('mailto:contact@rave-location.com'),
                      },
                      { text: 'Fermer', style: 'cancel' },
                    ]
                  );
                }}
                accessibilityLabel="Contactez nous par email ou téléphone"
                accessibilityRole="button"
                accessibilityHint="Ouvre un menu avec les options pour appeler ou envoyer un email"
              >
                <View style={styles.menuIcon}>
                  <Ionicons name="mail-outline" size={22} color="#1a1a1a" />
                </View>
                <Text variant="body">Contactez nous</Text>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Section Légal */}
            <View style={styles.legalSection}>
              <Text variant="label" style={styles.legalSectionTitle}>Légal</Text>
              <TouchableOpacity 
                style={styles.legalMenuItem}
                onPress={() => {
                  const url = 'https://rave-location.com/politique-de-confidentialite/';
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Erreur', 'Impossible d\'ouvrir la page web');
                  });
                }}
                activeOpacity={0.7}
                accessibilityLabel="Politique de confidentialité"
                accessibilityRole="link"
                accessibilityHint="Ouvre la politique de confidentialité dans le navigateur"
              >
                <View style={styles.legalMenuIcon}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#5c5c5c" />
                </View>
                <Text variant="body" style={styles.legalMenuText}>Politique de confidentialité</Text>
                <Ionicons name="chevron-forward" size={20} color="#5c5c5c" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.legalMenuItem}
                onPress={() => router.push('/(chauffeur)/conditions-utilisation')}
                activeOpacity={0.7}
                accessibilityLabel="Conditions d'utilisation"
                accessibilityRole="button"
                accessibilityHint="Affiche les conditions d'utilisation de l'application"
              >
                <View style={styles.legalMenuIcon}>
                  <Ionicons name="document-text-outline" size={20} color="#5c5c5c" />
                </View>
                <Text variant="body" style={styles.legalMenuText}>Conditions d'utilisation</Text>
                <Ionicons name="chevron-forward" size={20} color="#5c5c5c" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
              accessibilityLabel="Se déconnecter"
              accessibilityRole="button"
              accessibilityHint="Déconnecte le chauffeur et retourne à l'écran de connexion"
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text variant="body" style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modal Signature Pad */}
      <Modal visible={showSignaturePad} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 45 : 55 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text variant="h2" style={{ fontSize: 18 }}>Votre signature</Text>
            <TouchableOpacity onPress={() => setShowSignaturePad(false)} style={{ padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 }}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },
  editInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#FAFAFA',
  },
  editBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnGhost: {
    backgroundColor: '#F3F4F6',
  },
  editBtnGhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  editBtnPrimary: {
    backgroundColor: BRAND.green,
  },
  editBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modifyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
  },
  modifyLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.green,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1F2E3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  menuContainer: {
    gap: 8,
    marginBottom: 24,
  },
  legalSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  legalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#343434',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  legalMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffdf6d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  legalMenuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#5c5c5c',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  vehicleInfoContainer: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  vehicleInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
  },
});
