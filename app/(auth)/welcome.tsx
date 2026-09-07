import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.centerContent}>
          <View style={styles.logoCircle}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Accès Loueur</Text>
          <Text style={styles.subtitle}>
            Votre code d’accès à 6 chiffres est fourni par RAVE. Les comptes loueur sont créés uniquement par l’équipe RAVE — il n’y a pas d’inscription autonome.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <Button
            title="Entrer mon code d’accès"
            onPress={() => router.replace('/(chauffeur)/login')}
            fullWidth
          />
          <TouchableOpacity
            onPress={() => router.push('/(auth)/cgu')}
            style={styles.legalLink}
          >
            <Text style={styles.legalText}>Conditions générales d’utilisation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Linking.openURL('https://rave-location.com/politique-de-confidentialite/').catch(() => {});
            }}
            style={styles.legalLink}
          >
            <Text style={styles.legalText}>Politique de confidentialité</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 48,
  },
  centerContent: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a472a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonsContainer: {
    gap: 12,
    maxWidth: 320,
    alignSelf: 'center',
    width: '100%',
  },
  legalLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  legalText: {
    fontSize: 13,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
});
