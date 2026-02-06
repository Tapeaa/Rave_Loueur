import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';

export default function ConditionsUtilisationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text variant="h2" style={styles.title}>Conditions d'utilisation</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text variant="h1" style={styles.mainTitle}>Conditions Générales d'Utilisation — TAPEA</Text>
        <Text variant="caption" style={styles.version}>Date d'entrée en vigueur : 21 janvier 2026</Text>

        <Text variant="body" style={styles.intro}>
          Les présentes Conditions Générales d'Utilisation (les "CGU") régissent l'accès et l'utilisation de l'application mobile TAPEA (la "Plateforme"), disponible sur iOS et Android, ainsi que les services associés.
        </Text>

        <Text variant="body" style={styles.intro}>
          En créant un compte, en accédant à la Plateforme ou en l'utilisant, vous acceptez sans réserve les présentes CGU.
        </Text>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>1) Éditeur de la Plateforme</Text>
          <Text variant="body" style={styles.text}>
            La Plateforme est éditée par :{'\n'}
            Entreprise Individuelle (EI) – SIRET 92457387600019{'\n'}
            Adresse : Résidence Hinaraurea, FAAA, Tahiti, Polynésie française{'\n'}
            Email : Tapea.pf@gmail.com{'\n'}
            Téléphone : +689 87 75 98 97{'\n'}
            Site : Tape-a.com
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>2) Définitions</Text>
          <Text variant="body" style={styles.text}>
            "Plateforme" : application TAPEA et services numériques associés.{'\n\n'}
            "Passager" : utilisateur réservant une course via TAPEA.{'\n\n'}
            "Conducteur" : chauffeur de taxi utilisant TAPEA pour accepter/réaliser une course (lorsqu'une interface conducteur existe).{'\n\n'}
            "Course" : prestation de transport réalisée par un Conducteur au bénéfice d'un Passager.{'\n\n'}
            "Prix" / "Tarif" : montant total dû au titre d'une Course, incluant, le cas échéant, suppléments et frais.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>3) Objet et rôle de TAPEA</Text>
          <Text variant="body" style={styles.text}>
            TAPEA est une plateforme de mise en relation entre Passagers et Conducteurs de taxi. Elle permet notamment :
          </Text>
          <Text variant="body" style={styles.listItem}>• la demande de courses immédiates ou à l'avance (si disponible),</Text>
          <Text variant="body" style={styles.listItem}>• le suivi en temps réel de la course,</Text>
          <Text variant="body" style={styles.listItem}>• le paiement sécurisé (notamment via Stripe).</Text>
          <Text variant="body" style={styles.text}>
            Sauf mention contraire, TAPEA n'est pas un transporteur : la prestation de transport est réalisée par le Conducteur, sous sa responsabilité et selon la réglementation applicable.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>4) Conditions d'accès et création de compte</Text>
          <Text variant="body" style={styles.subTitle}>4.1 Éligibilité</Text>
          <Text variant="body" style={styles.text}>
            Pour utiliser TAPEA, vous devez :
          </Text>
          <Text variant="body" style={styles.listItem}>• être majeur et capable juridiquement,</Text>
          <Text variant="body" style={styles.listItem}>• fournir des informations exactes, à jour et complètes,</Text>
          <Text variant="body" style={styles.listItem}>• utiliser la Plateforme conformément aux présentes CGU et à la loi.</Text>

          <Text variant="body" style={styles.subTitle}>4.2 Compte et sécurité</Text>
          <Text variant="body" style={styles.text}>
            Vous êtes responsable de :
          </Text>
          <Text variant="body" style={styles.listItem}>• la confidentialité de vos identifiants,</Text>
          <Text variant="body" style={styles.listItem}>• toute activité effectuée via votre compte,</Text>
          <Text variant="body" style={styles.listItem}>• la mise à jour de vos informations.</Text>
          <Text variant="body" style={styles.text}>
            En cas d'utilisation non autorisée ou de suspicion de fraude, vous devez contacter immédiatement : Tapea.pf@gmail.com
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>5) Utilisation de la Plateforme — Obligations des utilisateurs</Text>
          <Text variant="body" style={styles.subTitle}>5.1 Obligations des Passagers</Text>
          <Text variant="body" style={styles.text}>
            Le Passager s'engage à :
          </Text>
          <Text variant="body" style={styles.listItem}>• respecter les Conducteurs et les autres passagers,</Text>
          <Text variant="body" style={styles.listItem}>• indiquer un point de prise en charge et une destination exploitables,</Text>
          <Text variant="body" style={styles.listItem}>• ne pas utiliser la Plateforme pour des activités illégales ou dangereuses,</Text>
          <Text variant="body" style={styles.listItem}>• respecter les règles de sécurité (ceinture, comportement, etc.),</Text>
          <Text variant="body" style={styles.listItem}>• ne pas détériorer le véhicule, ne pas provoquer de nuisances, et signaler tout incident.</Text>

          <Text variant="body" style={styles.subTitle}>5.2 Obligations des Conducteurs (si applicable)</Text>
          <Text variant="body" style={styles.text}>
            Le Conducteur s'engage à :
          </Text>
          <Text variant="body" style={styles.listItem}>• détenir un permis de conduire valide et toute autorisation/qualification requise pour exercer,</Text>
          <Text variant="body" style={styles.listItem}>• respecter le code de la route et la réglementation locale,</Text>
          <Text variant="body" style={styles.listItem}>• maintenir le véhicule en bon état (sécurité, entretien, propreté),</Text>
          <Text variant="body" style={styles.listItem}>• traiter les Passagers avec respect, sans discrimination,</Text>
          <Text variant="body" style={styles.listItem}>• disposer des assurances obligatoires applicables à son activité,</Text>
          <Text variant="body" style={styles.listItem}>• assurer une prise en charge conforme aux informations de la Course.</Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>6) Réservation, acceptation et déroulement des courses</Text>
          <Text variant="body" style={styles.text}>
            Le Passager effectue une demande de Course via la Plateforme.{'\n\n'}
            La Course peut être proposée à un ou plusieurs Conducteurs.{'\n\n'}
            Une Course est considérée comme acceptée lorsqu'un Conducteur confirme sa prise en charge via la Plateforme.{'\n\n'}
            Le Passager doit être présent au point de prise en charge au moment convenu, sous réserve des tolérances/temps d'attente éventuellement appliqués.{'\n\n'}
            TAPEA peut proposer des fonctionnalités de suivi, messagerie ou appel (selon disponibilité), destinées à faciliter la prise en charge.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>7) Tarifs, suppléments et paiement</Text>
          <Text variant="body" style={styles.subTitle}>7.1 Affichage des tarifs</Text>
          <Text variant="body" style={styles.text}>
            Les tarifs sont affichés avant confirmation lorsque la Plateforme permet une estimation préalable. Le montant final peut varier selon des éléments d'exécution (trajet réel, temps d'attente, arrêts, suppléments, modifications).
          </Text>

          <Text variant="body" style={styles.subTitle}>7.2 Suppléments</Text>
          <Text variant="body" style={styles.text}>
            Les suppléments (ex. bagages, animaux, demandes spécifiques, options particulières) sont, lorsqu'ils existent, clairement indiqués. Les arrêts payants et temps d'attente peuvent être facturés au tarif en vigueur.
          </Text>

          <Text variant="body" style={styles.subTitle}>7.3 Paiement</Text>
          <Text variant="body" style={styles.text}>
            Le paiement est généralement déclenché à la fin de la Course.{'\n\n'}
            Les paiements par carte sont traités via Stripe (prestataire de paiement).{'\n\n'}
            En cas d'échec de paiement, TAPEA peut suspendre temporairement l'accès au service jusqu'à régularisation.{'\n\n'}
            TAPEA se réserve la possibilité d'ajouter d'autres moyens de paiement (ex. espèces) si cela est activé dans l'app et autorisé localement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>8) Annulations et remboursements (version sans frais)</Text>
          <Text variant="body" style={styles.subTitle}>8.1 Annulation par le Passager</Text>
          <Text variant="body" style={styles.text}>
            Le Passager peut annuler une demande de Course tant que celle-ci n'est pas terminée. En cas d'annulation, la Plateforme met fin au processus de mise en relation et/ou de suivi de la Course.
          </Text>

          <Text variant="body" style={styles.subTitle}>8.2 Annulation par le Conducteur</Text>
          <Text variant="body" style={styles.text}>
            Un Conducteur peut annuler une Course avant la prise en charge. Dans ce cas, la Plateforme peut proposer la Course à un autre Conducteur ou annuler la demande.
          </Text>

          <Text variant="body" style={styles.subTitle}>8.3 Paiements et ajustements</Text>
          <Text variant="body" style={styles.text}>
            Si un paiement a été initié, le montant final correspond à la Course telle qu'exécutée (trajet effectivement réalisé, temps d'attente, options éventuelles). En cas d'anomalie, l'utilisateur peut contacter le support à Tapea.pf@gmail.com
          </Text>

          <Text variant="body" style={styles.subTitle}>8.4 Demandes de remboursement / contestations</Text>
          <Text variant="body" style={styles.text}>
            Toute contestation (trajet, tarif, incident) doit être signalée dans un délai raisonnable en précisant la date et l'heure de la Course. TAPEA analysera la demande au regard des éléments disponibles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>9) Sécurité, incidents et assurance</Text>
          <Text variant="body" style={styles.text}>
            Les Conducteurs peuvent faire l'objet de vérifications (selon les processus disponibles).{'\n\n'}
            Le Passager peut signaler un incident via la Plateforme (si fonctionnalité disponible) ou par email.{'\n\n'}
            Les courses sont réalisées par des Conducteurs soumis à leurs propres obligations professionnelles, notamment en matière d'assurance et de sécurité.{'\n\n'}
            En cas d'urgence, contactez les services d'urgence compétents.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>10) Comportements interdits</Text>
          <Text variant="body" style={styles.text}>
            Il est strictement interdit de :
          </Text>
          <Text variant="body" style={styles.listItem}>• utiliser la Plateforme à des fins illégales, frauduleuses ou nuisibles,</Text>
          <Text variant="body" style={styles.listItem}>• harceler, menacer, discriminer, ou adopter tout comportement violent,</Text>
          <Text variant="body" style={styles.listItem}>• porter atteinte à la sécurité des personnes ou des biens,</Text>
          <Text variant="body" style={styles.listItem}>• tenter de contourner le paiement via la Plateforme,</Text>
          <Text variant="body" style={styles.listItem}>• perturber le fonctionnement (attaque, injection, scraping abusif, reverse engineering, etc.),</Text>
          <Text variant="body" style={styles.listItem}>• créer de faux comptes ou usurper l'identité d'autrui.</Text>
          <Text variant="body" style={styles.text}>
            TAPEA se réserve le droit de suspendre ou supprimer tout compte en cas de violation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>11) Données personnelles</Text>
          <Text variant="body" style={styles.text}>
            Le traitement des données personnelles est décrit dans la Politique de Confidentialité disponible sur : Tape-a.com (page "Politique de confidentialité").{'\n\n'}
            L'utilisation de certaines fonctionnalités (notamment la géolocalisation) peut être nécessaire pour le bon fonctionnement du service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>12) Responsabilités et limitations</Text>
          <Text variant="body" style={styles.subTitle}>12.1 Responsabilité de TAPEA (Plateforme)</Text>
          <Text variant="body" style={styles.text}>
            TAPEA met en œuvre des moyens raisonnables pour assurer le fonctionnement de la Plateforme. Toutefois, TAPEA ne garantit pas :
          </Text>
          <Text variant="body" style={styles.listItem}>• l'absence d'interruptions, de bugs, ou d'indisponibilités,</Text>
          <Text variant="body" style={styles.listItem}>• la disponibilité permanente de Conducteurs,</Text>
          <Text variant="body" style={styles.listItem}>• la réalisation d'une Course dans un délai déterminé.</Text>
          <Text variant="body" style={styles.text}>
            TAPEA n'est pas responsable :
          </Text>
          <Text variant="body" style={styles.listItem}>• des retards liés aux conditions de circulation, météo, incidents,</Text>
          <Text variant="body" style={styles.listItem}>• des objets oubliés dans les véhicules,</Text>
          <Text variant="body" style={styles.listItem}>• des comportements ou manquements des Conducteurs ou Passagers,</Text>
          <Text variant="body" style={styles.listItem}>• des problèmes techniques indépendants de sa volonté (réseaux, OS, stores, etc.).</Text>

          <Text variant="body" style={styles.subTitle}>12.2 Responsabilité des utilisateurs</Text>
          <Text variant="body" style={styles.text}>
            Chaque utilisateur est responsable de ses actes et du respect des lois. Le Conducteur demeure responsable de la prestation de transport et de sa conformité réglementaire.
          </Text>

          <Text variant="body" style={styles.subTitle}>12.3 Force majeure</Text>
          <Text variant="body" style={styles.text}>
            Aucune partie ne sera responsable d'un manquement dû à un événement de force majeure (catastrophes, pannes majeures, actes administratifs, etc.).
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>13) Propriété intellectuelle</Text>
          <Text variant="body" style={styles.text}>
            TAPEA, la marque, le logo, l'interface, les textes, éléments graphiques et logiciels associés sont protégés. Toute reproduction, extraction, modification ou exploitation non autorisée est interdite.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>14) Suspension, résiliation et suppression de compte</Text>
          <Text variant="body" style={styles.text}>
            TAPEA peut suspendre ou résilier l'accès à la Plateforme, notamment en cas :
          </Text>
          <Text variant="body" style={styles.listItem}>• de violation des CGU,</Text>
          <Text variant="body" style={styles.listItem}>• de fraude ou tentative de fraude,</Text>
          <Text variant="body" style={styles.listItem}>• de risque pour la sécurité des utilisateurs ou du service.</Text>
          <Text variant="body" style={styles.text}>
            L'utilisateur peut demander la suppression de son compte via Tapea.pf@gmail.com, sous réserve des obligations légales de conservation (ex. comptabilité, litiges).
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>15) Modifications des CGU</Text>
          <Text variant="body" style={styles.text}>
            TAPEA peut modifier les présentes CGU afin de refléter des évolutions légales, techniques ou fonctionnelles. La version applicable est celle publiée sur le site et/ou dans l'application, avec sa date d'entrée en vigueur.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>16) Droit applicable et juridiction</Text>
          <Text variant="body" style={styles.text}>
            Les présentes CGU sont régies par le droit applicable en Polynésie française.{'\n\n'}
            En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, les juridictions compétentes seront celles déterminées par les règles de procédure applicables.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>17) Contact</Text>
          <Text variant="body" style={styles.text}>
            Pour toute question relative aux CGU :{'\n'}
            Email : Tapea.pf@gmail.com{'\n\n'}
            Téléphone : +689 87 75 98 97
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  mainTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  version: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 24,
  },
  intro: {
    lineHeight: 22,
    marginBottom: 16,
    color: '#4b5563',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    color: '#374151',
  },
  text: {
    lineHeight: 22,
    marginBottom: 12,
    color: '#4b5563',
  },
  listItem: {
    marginLeft: 16,
    marginBottom: 6,
    color: '#4b5563',
    lineHeight: 22,
  },
});
