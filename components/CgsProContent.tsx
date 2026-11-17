import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';

export function CgsProContent() {
  return (
    <>
      <Text variant="h1" style={styles.mainTitle}>
        Conditions Générales d'Abonnement et de Services Pro (B2B) — RAVE Partner
      </Text>
      <Text variant="caption" style={styles.version}>Dernière mise à jour : Novembre 2026</Text>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>1. Mentions légales et objet du contrat</Text>
        <Text variant="body" style={styles.text}>
          Le présent contrat (ci-après les « CGS Pro ») est conclu entre :
        </Text>
        <Text variant="body" style={styles.listItem}>
          • L'Éditeur : L'Entreprise Individuelle (EI) Tape'a, immatriculée en Polynésie française sous le N° Tahiti F11193, dont le siège social est situé Résidence Hinaraurea, joignable par email à teriimana@tape-a.com et par téléphone au +64 210 910 407 (ci-après « RAVE » ou « l'Éditeur »).
        </Text>
        <Text variant="body" style={styles.listItem}>
          • Le Professionnel : Toute personne physique ou morale exerçant une activité professionnelle de location de véhicules en Polynésie française et créant un compte Loueur sur le Dashboard RAVE (ci-après « le Loueur »).
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Objet : </Text>
          Les présentes CGS Pro définissent les conditions dans lesquelles RAVE met à la disposition du Loueur, sous forme de logiciel en tant que service (SaaS), une interface de gestion de flotte, un outil de génération et de signature électronique de contrats, une passerelle d'intégration de paiement et un référencement sur l'application mobile client RAVE.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>2. Prérequis légaux et garanties du Loueur (clause essentielle)</Text>
        <Text variant="body" style={styles.text}>
          L'accès au Dashboard RAVE est strictement réservé aux professionnels légalement établis. En activant son compte, le Loueur certifie sur l'honneur et garantit pendant toute la durée de son abonnement :
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>1. Immatriculation et licence : </Text>
          Disposer d'un Numéro Tahiti actif (ISPF / RCS) et détenir toutes les licences, patentes et autorisations administratives exigées par la réglementation de la Polynésie française pour l'exercice de l'activité de location de véhicules sans chauffeur.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>2. Assurance professionnelle obligatoire : </Text>
          Avoir souscrit, pour chaque véhicule publié sur RAVE, une police d'assurance professionnelle couvrant expressément l'activité de « location de véhicules sans chauffeur à titre onéreux ». Le Loueur s'interdit formellement de publier un véhicule couvert par une simple assurance de particulier.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>3. Conformité mécanique : </Text>
          Proposer uniquement des véhicules en parfait état de fonctionnement, d'entretien et de sécurité, à jour de leur contrôle technique réglementaire.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>4. Obligations fiscales et sociales : </Text>
          Assumer seul l'intégralité de ses déclarations fiscales (TVA, impôt sur les transactions, CPS) relatives aux revenus générés par ses locations.
        </Text>
        <Text variant="body" style={styles.text}>
          RAVE se réserve le droit de demander à tout moment les justificatifs correspondants (extrait K-bis / avis ISPF, attestations d'assurance pro) et de suspendre immédiatement tout compte non conforme.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>3. Fonctionnement des outils techniques (contrats, signature électronique et OSB)</Text>
        <Text variant="body" style={styles.subTitle}>3.1 Élaboration des contrats de location via le Dashboard</Text>
        <Text variant="body" style={styles.text}>
          Le Dashboard RAVE fournit au Loueur un éditeur technique lui permettant de créer, personnaliser et générer ses propres contrats de location et états des lieux au format PDF.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Responsabilité exclusive de rédaction : </Text>
          Le Loueur est le seul auteur et responsable juridique du contenu de ses contrats de location (clauses, franchises, conditions d'âge, pénalités, cautions).
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Absence de conseil juridique : </Text>
          Les trames ou variables informatiques proposées par RAVE le sont à titre purement technique. Il appartient au Loueur de faire valider son modèle de contrat par son assureur ou son conseil juridique.{' '}
          <Text style={styles.bold}>
            L'EI Tape'a décline toute responsabilité en cas d'inopposabilité d'une clause du contrat du Loueur face à un client ou une compagnie d'assurance lors d'un sinistre.
          </Text>
        </Text>

        <Text variant="body" style={styles.subTitle}>3.2 Signature électronique RAVE</Text>
        <Text variant="body" style={styles.text}>
          Les contrats générés sur RAVE sont signés électroniquement dans l'application : le Locataire lit le contrat, accepte la mention « lu et approuvé » et trace sa signature à l'écran. RAVE enregistre l'horodatage serveur, l'adresse IP, l'appareil et l'empreinte numérique (SHA-256) du contrat, afin de garantir l'intégrité du document et l'identification du signataire. La signature du Loueur, enregistrée dans son profil, est apposée sur le contrat lorsqu'il accepte la réservation.
        </Text>
        <Text variant="body" style={styles.text}>
          Le Loueur mandate techniquement RAVE pour recueillir la signature du Locataire sur les documents de réservation. L'archivage probant et la conservation des contrats signés sur le long terme restent sous la responsabilité du Loueur, qui doit télécharger et sauvegarder ses copies.
        </Text>

        <Text variant="body" style={styles.subTitle}>3.3 Intégration bancaire indépendante (PayZen / OSB)</Text>
        <Text variant="body" style={styles.text}>
          Le Loueur a la faculté de connecter son propre compte marchand PayZen / OSB (ou tout autre prestataire compatible) sur son Dashboard RAVE via ses clés API personnelles.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Encaissement direct : </Text>
          Les paiements effectués par les Locataires via l'application RAVE sont crédités directement sur le compte bancaire du Loueur, sans jamais transiter par les comptes de l'EI Tape'a.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Absence de commission : </Text>
          RAVE ne prélève aucune commission sur le chiffre d'affaires des locations du Loueur.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Litiges bancaires : </Text>
          Le Loueur assume seul les frais bancaires OSB, les risques de fraude à la carte bancaire, les impayés, les rétrofacturations (chargebacks), la gestion des cautions (pré-autorisations) et les éventuels remboursements clients.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>4. Conditions financières : essai gratuit et abonnement SaaS</Text>
        <Text variant="body" style={styles.subTitle}>4.1 Période d'essai d'un (1) mois</Text>
        <Text variant="body" style={styles.text}>
          Tout nouveau Loueur validé bénéficie d'une période d'essai gratuite de trente (30) jours calendaires à compter de l'ouverture de son compte Pro, lui donnant accès aux fonctionnalités du Dashboard et à la publication de ses véhicules sur l'application RAVE.
        </Text>

        <Text variant="body" style={styles.subTitle}>4.2 Tarif et paiement de l'abonnement mensuel</Text>
        <Text variant="body" style={styles.listItem}>
          • Au terme de la période d'essai de 30 jours, le maintien du service est soumis au paiement d'un abonnement mensuel fixe (selon le palier tarifaire sélectionné par le Loueur sur son Dashboard).
        </Text>
        <Text variant="body" style={styles.listItem}>
          • L'abonnement est payable d'avance, mensuellement, par prélèvement automatique sur carte bancaire ou virement récurrent.
        </Text>
        <Text variant="body" style={styles.listItem}>
          • Chaque mois d'abonnement entamé est dû dans son intégralité et n'est pas remboursable.
        </Text>

        <Text variant="body" style={styles.subTitle}>4.3 Défaut de paiement</Text>
        <Text variant="body" style={styles.text}>
          En cas d'échec de paiement ou de non-règlement de l'abonnement à l'échéance :
        </Text>
        <Text variant="body" style={styles.listItem}>
          • L'accès au Dashboard Pro sera restreint et les véhicules du Loueur seront automatiquement masqués du catalogue public de l'application RAVE après un délai de grâce de cinq (5) jours suivant une notification par email
        </Text>
        <Text variant="body" style={styles.listItem}>
          • Les réservations déjà confirmées avant la suspension devront toutefois être honorées par le Loueur
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>5. Résiliation de l'abonnement</Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Par le Loueur : </Text>
          L'abonnement est sans engagement de durée. Le Loueur peut résilier son abonnement à tout moment depuis son Dashboard ou par email à teriimana@tape-a.com avant la date de renouvellement mensuel. La résiliation prendra effet à la fin de la période mensuelle en cours.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>Par RAVE : </Text>
          L'EI Tape'a se réserve le droit de résilier ou suspendre de plein droit, sans préavis ni indemnité, le compte d'un Loueur en cas :
        </Text>
        <Text variant="body" style={styles.listItem}>• De défaut d'assurance professionnelle ou de licence légale de location</Text>
        <Text variant="body" style={styles.listItem}>• De plaintes répétées et avérées de Locataires (véhicules dangereux, escroquerie à la caution, comportement abusif)</Text>
        <Text variant="body" style={styles.listItem}>• De tentative de contournement technique ou d'atteinte à la sécurité de la plateforme</Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>6. Limitation de responsabilité et garantie d'indemnisation (Hold Harmless)</Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>1. Plafond de responsabilité : </Text>
          L'EI Tape'a est soumise à une obligation de moyens pour la fourniture de sa plateforme logicielle. En tout état de cause, si la responsabilité de l'EI Tape'a devait être retenue pour un dommage technique direct, le montant total des indemnités ne pourra jamais excéder le montant des abonnements effectivement payés par le Loueur au cours des trois (3) derniers mois précédant l'incident.
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>2. Exclusions : </Text>
          RAVE ne pourra jamais être tenue responsable des pertes de chiffre d'affaires, vols de véhicules, dégradations, accidents corporels ou matériels, impayés de clients, ou pannes des services tiers (serveurs cloud, passerelle PayZen/OSB).
        </Text>
        <Text variant="body" style={styles.text}>
          <Text style={styles.bold}>3. Garantie d'indemnisation : </Text>
          Le Loueur s'engage à garantir et à indemniser l'EI Tape'a contre toute réclamation, plainte, action en justice ou condamnation financière (y compris les frais d'avocat) engagée par un Locataire, un assureur ou une administration publique du fait d'un manquement du Loueur à ses obligations légales, contractuelles ou d'assurance.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>7. Protection des données (sous-traitance RGPD)</Text>
        <Text variant="body" style={styles.text}>
          Dans le cadre de l'utilisation du Dashboard, le Loueur a accès aux données personnelles et documents (permis de conduire, identité) des Locataires.
        </Text>
        <Text variant="body" style={styles.listItem}>
          • Le Loueur agit en qualité de Responsable de traitement pour les données nécessaires à ses contrats de location et s'engage à respecter strictement la loi « Informatique et Libertés » et le RGPD.
        </Text>
        <Text variant="body" style={styles.listItem}>
          • Il s'interdit d'utiliser les coordonnées ou documents des Locataires à d'autres fins que l'exécution du contrat de location concerné, ou de les divulguer à des tiers non autorisés.
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="h2" style={styles.sectionTitle}>8. Droit applicable et juridiction compétente</Text>
        <Text variant="body" style={styles.text}>
          Les présentes CGS Pro sont régies exclusivement par le{' '}
          <Text style={styles.bold}>droit applicable en Polynésie française</Text>.
        </Text>
        <Text variant="body" style={styles.text}>
          En cas de différend relatif à la validité, l'interprétation ou l'exécution du présent contrat entre l'EI Tape'a et le Loueur, et à défaut d'accord amiable dans un délai de trente (30) jours,{' '}
          <Text style={styles.bold}>compétence exclusive est attribuée au Tribunal Mixte de Commerce de Papeete</Text>.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mainTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  version: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 24,
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
  bold: {
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listItem: {
    marginLeft: 16,
    marginBottom: 6,
    color: '#4b5563',
    lineHeight: 22,
  },
});
