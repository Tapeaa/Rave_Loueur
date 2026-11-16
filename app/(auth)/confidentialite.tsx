import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';

export default function ConfidentialiteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h2" style={styles.title}>Confidentialité</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text variant="h1" style={styles.mainTitle}>Politique de confidentialité — Application RAVE</Text>
        <Text variant="caption" style={styles.version}>Dernière mise à jour : Novembre 2026</Text>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>1. Responsable du traitement</Text>
          <Text variant="body" style={styles.text}>
            La présente Politique de Confidentialité détaille la manière dont vos données personnelles sont collectées, utilisées et protégées lorsque vous utilisez l'application mobile et la plateforme RAVE.
          </Text>
          <Text variant="body" style={styles.text}>
            Le Responsable du traitement des données est :
          </Text>
          <Text variant="body" style={styles.listItem}>• Entreprise : Entreprise Individuelle (EI) Tape'a (exploitant l'application RAVE)</Text>
          <Text variant="body" style={styles.listItem}>• N° Tahiti : F11193</Text>
          <Text variant="body" style={styles.listItem}>• Siège social : Résidence Hinaraurea, Polynésie française</Text>
          <Text variant="body" style={styles.listItem}>• Email de contact (DPO / Confidentialité) : teriimana@tape-a.com</Text>
          <Text variant="body" style={styles.listItem}>• Téléphone : +64 210 910 407</Text>
          <Text variant="body" style={styles.text}>
            <Text style={styles.bold}>Note sur le rôle des Loueurs : </Text>
            Lorsqu'une réservation est effectuée, le Loueur professionnel sélectionné reçoit les données nécessaires à l'établissement du contrat de location et agit lui-même en qualité de Responsable de traitement indépendant pour ses propres obligations légales et d'assurance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>2. Données collectées et permissions de l'appareil</Text>
          <Text variant="body" style={styles.text}>
            Dans le respect du principe de minimisation (RGPD), RAVE collecte uniquement les données strictement nécessaires au fonctionnement du service :
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Données d'identité et de contact : nom, prénom, adresse e-mail, numéro de téléphone, adresse postale.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Documents justificatifs (Locataires) : photographie ou scan du permis de conduire et d'une pièce d'identité, nécessaires à la vérification par le Loueur et à l'assurance du véhicule.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Données professionnelles (Loueurs) : dénomination sociale, N° Tahiti, attestations d'assurance professionnelle, coordonnées de facturation.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Données de réservation et de contrat : dates et lieux de prise en charge/retour, véhicule choisi, photos d'état des lieux (départ/retour), historique des messages échangés dans l'application, contrat signé électroniquement.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Données de transaction (sans stockage bancaire) : statut du paiement (validé/refusé) et références de transaction.{' '}
            <Text style={styles.bold}>RAVE ne collecte et ne stocke jamais vos numéros de carte bancaire</Text>
            {' '} : les transactions en ligne sont traitées directement et exclusivement par la passerelle bancaire sécurisée PayZen / OSB du Loueur.
          </Text>
          <Text variant="body" style={styles.subTitle}>Données techniques et permissions mobiles</Text>
          <Text variant="body" style={styles.listItem}>
            • Appareil photo et galerie photo : accès sollicité uniquement avec votre accord pour vous permettre de photographier votre permis de conduire ou de réaliser les photos d'état des lieux du véhicule.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Notifications push et journaux techniques : jetons de notification (pour le suivi de vos réservations), adresse IP et journaux d'erreurs techniques pour assurer la sécurité de l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>3. Finalités et bases légales du traitement</Text>
          <Text variant="body" style={styles.text}>
            Vos données personnelles sont traitées sur les bases légales suivantes :
          </Text>
          <Text variant="body" style={styles.subTitle}>1. Exécution du contrat et des réservations (CGU)</Text>
          <Text variant="body" style={styles.listItem}>• Créer et gérer votre compte Utilisateur (Locataire ou Loueur)</Text>
          <Text variant="body" style={styles.listItem}>• Transmettre votre dossier de réservation au Loueur concerné</Text>
          <Text variant="body" style={styles.listItem}>• Générer automatiquement le contrat de location et l'état des lieux</Text>
          <Text variant="body" style={styles.listItem}>• Permettre la signature électronique certifiée du contrat et le paiement de la réservation</Text>
          <Text variant="body" style={styles.subTitle}>2. Intérêt légitime et sécurité</Text>
          <Text variant="body" style={styles.listItem}>• Assurer la messagerie interne entre Locataire et Loueur</Text>
          <Text variant="body" style={styles.listItem}>• Prévenir la fraude documentaire et sécuriser l'accès à la plateforme</Text>
          <Text variant="body" style={styles.listItem}>• Assurer le support technique et la maintenance de l'application</Text>
          <Text variant="body" style={styles.subTitle}>3. Obligations légales</Text>
          <Text variant="body" style={styles.listItem}>
            • Répondre aux obligations comptables, fiscales et aux éventuelles réquisitions des autorités compétentes en Polynésie française
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>4. Destinataires des données et sous-traitants</Text>
          <Text variant="body" style={styles.text}>
            <Text style={styles.bold}>Vos données personnelles ne sont jamais vendues, louées ou cédées à des tiers à des fins publicitaires.</Text>
            {' '}Elles sont uniquement partagées avec :
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Le Loueur professionnel concerné : uniquement lorsque vous effectuez une demande de réservation auprès de lui, afin qu'il puisse valider votre permis, assurer le véhicule et exécuter la location.
          </Text>
          <Text variant="body" style={styles.text}>
            Nos prestataires techniques certifiés (sous-traitants) :
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Yousign : opérateur européen certifié de signature électronique (pour la signature sécurisée des contrats de location et états des lieux).
          </Text>
          <Text variant="body" style={styles.listItem}>
            • PayZen / OSB : opérateur monétique en Polynésie française (lorsque vous réglez en ligne auprès d'un Loueur équipé).
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Hébergeurs Cloud et base de données : pour le stockage chiffré des données de l'application et l'envoi des notifications push.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>5. Durée de conservation des données</Text>
          <Text variant="body" style={styles.text}>
            Vos données sont conservées uniquement pour la durée nécessaire aux finalités pour lesquelles elles ont été collectées :
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Données du compte actif : conservées tant que votre compte utilisateur demeure actif sur RAVE.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Pièces justificatives (permis de conduire / identité) : conservées uniquement pendant la durée nécessaire à la vérification et au suivi de vos locations, ou jusqu'à leur suppression par vos soins dans votre profil.
          </Text>
          <Text variant="body" style={styles.listItem}>
            • Contrats de location signés et facturation : conservés en archivage intermédiaire pendant la durée légale applicable en matière commerciale et d'assurance (jusqu'à 5 ans pour les contrats et 10 ans pour les pièces comptables) afin de couvrir d'éventuels litiges ou sinistres.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>6. Suppression de compte et exercice de vos droits (RGPD)</Text>
          <Text variant="body" style={styles.text}>
            Conformément à la loi « Informatique et Libertés » modifiée et au Règlement Général sur la Protection des Données (RGPD) applicable en Polynésie française, vous disposez des droits suivants sur vos données :{' '}
            <Text style={styles.bold}>droit d'accès, de rectification, d'effacement (droit à l'oubli), de limitation du traitement, de portabilité et d'opposition.</Text>
          </Text>
          <Text variant="body" style={styles.subTitle}>Comment supprimer votre compte et vos données</Text>
          <Text variant="body" style={styles.text}>
            <Text style={styles.bold}>1. Directement depuis l'application (immédiat) : </Text>
            Vous pouvez demander la suppression définitive de votre compte et de vos pièces justificatives à tout moment en vous rendant dans Profil {'>'} Paramètres {'>'} Supprimer mon compte. Vos données personnelles actives seront alors effacées ou anonymisées (sous réserve des contrats déjà signés devant être conservés légalement).
          </Text>
          <Text variant="body" style={styles.text}>
            <Text style={styles.bold}>2. Par e-mail : </Text>
            Vous pouvez exercer l'ensemble de vos droits à tout moment en écrivant à teriimana@tape-a.com. Une réponse vous sera apportée dans un délai maximal de 30 jours.
          </Text>
          <Text variant="body" style={styles.text}>
            Vous disposez également du droit d'introduire une réclamation auprès de l'autorité de contrôle compétente (la CNIL — www.cnil.fr).
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>7. Sécurité des données</Text>
          <Text variant="body" style={styles.text}>
            L'EI Tape'a met en œuvre des mesures de sécurité techniques et organisationnelles rigoureuses pour protéger vos données contre tout accès non autorisé, perte ou altération :
          </Text>
          <Text variant="body" style={styles.listItem}>• Chiffrement des communications et transferts de données (protocole HTTPS / TLS)</Text>
          <Text variant="body" style={styles.listItem}>• Stockage sécurisé à accès restreint pour les pièces justificatives (permis de conduire)</Text>
          <Text variant="body" style={styles.listItem}>• Authentification sécurisée des comptes et recours à des prestataires certifiés (Yousign, OSB)</Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>8. Modifications de la Politique de Confidentialité</Text>
          <Text variant="body" style={styles.text}>
            RAVE se réserve le droit de faire évoluer la présente Politique de Confidentialité afin de se conformer aux évolutions légales ou techniques. En cas de modification substantielle, vous en serez informé directement via une notification dans l'application.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginRight: 12,
  },
  title: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  mainTitle: { marginBottom: 8 },
  version: { color: '#6b7280', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
  subTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  text: { color: '#374151', lineHeight: 22, marginBottom: 8 },
  bold: { fontWeight: '700', color: '#1a1a1a' },
  listItem: { color: '#374151', lineHeight: 22, marginLeft: 4, marginBottom: 4 },
});
