import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { apiPost, setDriverSessionId, secureStorage } from '@/lib/api';
import { setDriverExternalId } from '@/lib/onesignal';

export default function ChauffeurLoginScreen() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const submittingRef = useRef(false);

  const handleCodeChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    setCode((prev) => {
      const next = [...prev];
      if (digits.length > 1) {
        digits.slice(0, 6 - index).split('').forEach((d, i) => {
          next[index + i] = d;
        });
      } else {
        next[index] = digits.slice(0, 1);
      }
      return next;
    });

    if (digits.length > 1) {
      const nextIndex = Math.min(index + digits.length, 5);
      requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
    } else if (digits && index < 5) {
      requestAnimationFrame(() => inputRefs.current[index + 1]?.focus());
    }
    if (error) setError('');
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = useCallback(async (overrideCode?: string) => {
    const fullCode = (overrideCode ?? code.join('')).replace(/\D/g, '');
    if (fullCode.length !== 6) {
      setError('Veuillez entrer le code à 6 chiffres');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;

    setIsLoading(true);
    setError('');

    try {
      // IMPORTANT : Envoyer les headers pour prouver que c'est la bonne version
      // Sur le web, ces en-têtes déclenchent un preflight CORS refusé par le backend
      // déjà déployé. Le serveur renvoie déjà requiresMenuBurger: true.
      const loginHeaders = Platform.OS === 'web'
        ? {}
        : {
            'X-App-Supports-Menu-Burger': 'true',
            'X-App-Version': '2.0.0',
          };
      
      console.log('[LOGIN] ✅ APP FINALE - Sending headers:', loginHeaders);
      console.log('[LOGIN] ✅ APP FINALE - MenuBurger component exists and will be displayed');
      
      const data = await apiPost<{
        success?: boolean;
        driver?: { 
          id: string; 
          firstName: string; 
          lastName: string;
          cguAccepted?: boolean;
          cguAcceptedAt?: string | null;
          cguVersion?: string | null;
          privacyPolicyRead?: boolean;
          privacyPolicyReadAt?: string | null;
          privacyPolicyVersion?: string | null;
        };
        session?: { id: string };
        error?: string;
        appVersion?: string;
        requiresMenuBurger?: boolean;
        requiresUpdate?: boolean;
      }>('/api/driver/login', { code: fullCode }, { 
        skipAuth: true, 
        retry: false,
        headers: loginHeaders
      });

      // Vérification de version : BLOQUER si requiresMenuBurger n'est PAS true
      // Cela force toutes les anciennes versions à être bloquées
      console.log('[LOGIN] Version check:', { 
        success: data.success, 
        requiresMenuBurger: data.requiresMenuBurger,
        appVersion: data.appVersion,
        requiresUpdate: data.requiresUpdate
      });
      
      // Si le backend demande une mise à jour (403 avec requiresUpdate)
      if (data.requiresUpdate || (data.success && data.requiresMenuBurger !== true)) {
        console.log('[LOGIN] ❌ App version outdated - blocking login');
        setError('Votre application est obsolète. Veuillez la mettre à jour pour continuer.');
        setIsLoading(false);
        await setDriverSessionId(''); // Clear any session
        return;
      }
      
      console.log('[LOGIN] ✅ App version OK - proceeding with login');

      if (data.success && data.driver && data.session) {
        await setDriverSessionId(data.session.id);
        setDriverExternalId(data.driver.id);
        await secureStorage.setItem('driverExternalId', data.driver.id);
        
        // Vérifier l'état des CGU pour le log
        console.log('[LOGIN] CGU status check:', {
          cguAccepted: data.driver.cguAccepted,
          type: typeof data.driver.cguAccepted,
          willRedirectToLegal: data.driver.cguAccepted !== true
        });
        
        // Attendre un peu pour que la session soit complètement sauvegardée
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Rediriger vers le groupe (chauffeur) qui chargera automatiquement index
        // Index vérifiera la session et les CGU et redirigera vers legal si cguAccepted !== true
        console.log('[LOGIN] Login successful, redirecting to /(chauffeur) (which will load index and check CGU)');
        router.replace('/(chauffeur)');
      } else {
        setError(data.error || 'Code invalide');
      }
    } catch (err: any) {
      console.error('Driver login error:', err);
      // Afficher un message d'erreur plus clair
      if (err instanceof Error) {
        const errorMessage = err.message || '';
        
        if (errorMessage.includes('401') || errorMessage.includes('Code incorrect') || errorMessage.includes('Code invalide')) {
          setError('Code incorrect. Veuillez vérifier votre code d\'accès.');
        } else if (errorMessage.includes('403') || errorMessage.includes('désactivé')) {
          setError('Votre compte loueur est désactivé. Contactez le support.');
        } else if (errorMessage.includes('502') || errorMessage.includes('backend est inaccessible')) {
          setError('Le serveur backend est inaccessible. Vérifiez que le serveur est démarré et que l\'URL API est correcte.');
        } else if (errorMessage.includes('503') || errorMessage.includes('indisponible')) {
          setError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.');
        } else if (errorMessage.includes('500') || errorMessage.includes('Erreur interne')) {
          setError('Erreur serveur. Le code peut être invalide ou le serveur rencontre un problème. Réessayez.');
        } else if (errorMessage.includes('network') || errorMessage.includes('connexion') || errorMessage.includes('contacter le serveur')) {
          setError('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
        } else {
          // Afficher le message d'erreur réel du serveur
          setError(errorMessage || 'Erreur lors de la connexion');
        }
      } else {
        setError('Code invalide ou erreur serveur');
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  }, [code, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/logolandingchauffeur.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.header}>
              <Text variant="h1">Accès Loueur</Text>
              <Text variant="body" style={styles.subtitle}>
                Entrez le code d’accès à 6 chiffres fourni par RAVE.
              </Text>
              <Text variant="caption" style={styles.hint}>
                Les comptes loueur sont créés uniquement par l’équipe RAVE. Vous ne pouvez pas vous inscrire seul.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    digit ? styles.codeInputFilled : null,
                    error ? styles.codeInputError : null,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? 6 : 1}
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  caretHidden={false}
                />
              ))}
            </View>

            {error ? (
              <Text variant="caption" style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <Button
              title="Se connecter"
              onPress={() => {
                Keyboard.dismiss();
                handleLogin();
              }}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              style={styles.loginButton}
              accessibilityLabel="Se connecter avec votre code à 6 chiffres"
              accessibilityRole="button"
              accessibilityHint="Connecte le loueur à son compte après avoir entré le code d'accès"
            />
          </View>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => router.push('/(auth)/cgu')}>
              <Text style={styles.legalText}>CGS Pro</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>·</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/confidentialite')}>
              <Text style={styles.legalText}>Confidentialité</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  logo: {
    width: 160,
    height: 44,
  },
  header: {
    marginBottom: 8,
  },
  form: {
    width: '100%',
  },
  subtitle: {
    color: '#6b7280',
    marginTop: 8,
  },
  hint: {
    color: '#9CA3AF',
    marginTop: 10,
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  legalText: {
    fontSize: 13,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  codeContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  codeInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 52,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  codeInputFilled: {
    borderColor: '#4ECC8B',
  },
  codeInputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
  },
});
