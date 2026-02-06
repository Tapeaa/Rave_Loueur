# Plan d'Implémentation - Logique Métier Complète

## Vue d'ensemble

Ce document décrit le plan d'implémentation pour intégrer la logique métier complète de l'application web Tape-a dans l'application React Native existante.

## Analyse des Gaps

### 1. Flux de Commande (Order Creation)

**État actuel :**
- `app/(client)/commande-options.tsx` : Interface basique sans calcul de distance réel
- `app/(client)/ride/recherche-chauffeur.tsx` : Mocké, ne crée pas réellement de commande

**Manque :**
- Calcul de distance avec Google Maps Directions API
- Création de commande via `POST /api/orders`
- Gestion du `clientToken` retourné par l'API
- Support des arrêts intermédiaires (stops)
- Gestion des réservations à l'avance (`scheduledTime`, `isAdvanceBooking`)

### 2. Socket.IO - Événements Client

**État actuel :**
- `lib/socket.ts` : Structure de base présente mais incomplète

**Manque :**
- `joinClientSession(orderId, clientToken)` avec validation du token
- Écoute `order:driver:assigned` pour notification d'assignation
- Écoute `ride:status:changed` pour mise à jour des statuts
- Écoute `payment:status` pour gestion du paiement
- Écoute `payment:retry:ready` et `payment:switched-to-cash`
- Écoute `ride:cancelled` pour gestion des annulations
- Écoute `location:driver` pour suivi GPS en temps réel
- Émission `location:client:update` pour envoyer position client au chauffeur

### 3. Flux de Course en Cours

**État actuel :**
- `app/(client)/ride/course-en-cours.tsx` : Interface statique mockée

**Manque :**
- Intégration Socket.IO complète
- Suivi GPS en temps réel du chauffeur
- Affichage de la carte avec directions
- Gestion des statuts (enroute → arrived → inprogress → completed)
- Gestion du paiement (confirmation, retry, switch to cash)
- Modals de paiement (PaymentResultModal, ThankYouModal)
- Récupération de la commande active via `GET /api/orders/active/client`

### 4. Recherche Chauffeur

**État actuel :**
- `app/(client)/ride/recherche-chauffeur.tsx` : Mocké avec timeout fixe

**Manque :**
- Création réelle de commande via API
- Stockage du `clientToken` dans SecureStore/sessionStorage
- Écoute Socket.IO pour `order:driver:assigned`
- Gestion des timeouts (60 secondes)
- Gestion de l'expiration (`order:expired`)
- Redirection vers `course-en-cours` avec données réelles

### 5. Paiement

**État actuel :**
- `app/(client)/wallet.tsx` : Affichage basique
- `app/(client)/cartes-bancaires.tsx` : Ajout de carte fonctionnel

**Manque :**
- Intégration complète avec événements Socket.IO
- Gestion des erreurs de paiement (3D Secure, carte refusée)
- Retry de paiement après mise à jour de carte
- Switch to cash payment
- Affichage des résultats de paiement

### 6. Interface Chauffeur

**État actuel :**
- `app/(chauffeur)/index.tsx` : Structure de base

**Manque :**
- Réception des commandes via Socket.IO (`order:new`, `orders:pending`)
- Accept/Decline de commandes
- Mise à jour du statut de course (`ride:status:update`)
- Suivi GPS continu (`location:driver:update`)
- Confirmation de paiement (`payment:confirm`)

## Plan d'Implémentation

### Phase 1 : API et Types

#### 1.1 Mettre à jour `lib/api.ts`
- Ajouter fonction `createOrder(orderData)` pour `POST /api/orders`
- Ajouter fonction `getActiveOrder()` pour `GET /api/orders/active/client`
- Ajouter fonction `getOrder(orderId)` pour `GET /api/orders/:id`
- Ajouter fonction `getDriverLocation(orderId)` pour `GET /api/orders/:id/driver-location` (polling backup)

#### 1.2 Mettre à jour `lib/types.ts`
- Vérifier que tous les types correspondent au schéma backend
- Ajouter type `ClientToken` si nécessaire
- Vérifier `OrderStatus` correspond aux statuts backend

### Phase 2 : Socket.IO Client

#### 2.1 Compléter `lib/socket.ts`
- Implémenter `joinClientSession(orderId, clientToken)` avec gestion d'erreur
- Ajouter tous les listeners manquants :
  - `onDriverAssigned`
  - `onRideStatusChanged`
  - `onPaymentStatus`
  - `onPaymentRetryReady`
  - `onPaymentSwitchedToCash`
  - `onRideCancelled`
  - `onDriverLocationUpdate`
  - `onOrderExpired`
- Implémenter `emitClientLocation` pour envoyer position client
- Implémenter `retryPayment` et `switchToCashPayment`

### Phase 3 : Commande Options

#### 3.1 Améliorer `app/(client)/commande-options.tsx`
- Intégrer Google Maps Directions API pour calculer distance réelle
- Ajouter support des arrêts intermédiaires (stops)
- Ajouter sélection de carte si `paymentMethod === 'card'`
- Calculer `routeInfo` (distance, duration) avant de continuer
- Gérer les réservations à l'avance (date/heure picker)

### Phase 4 : Recherche Chauffeur

#### 4.1 Réimplémenter `app/(client)/ride/recherche-chauffeur.tsx`
- Créer la commande via `POST /api/orders` avec toutes les données
- Stocker `clientToken` retourné dans SecureStore/sessionStorage
- Joindre la session Socket.IO avec `joinClientSession(orderId, clientToken)`
- Écouter `order:driver:assigned` pour redirection automatique
- Écouter `order:expired` pour gestion timeout
- Afficher animation de recherche avec timer
- Gérer l'annulation (supprimer commande si possible)

### Phase 5 : Course en Cours

#### 5.1 Réimplémenter `app/(client)/ride/course-en-cours.tsx`
- Récupérer commande active au chargement (`getActiveOrder()`)
- Si pas de commande active, récupérer depuis sessionStorage ou params
- Joindre session Socket.IO avec `clientToken`
- Écouter tous les événements Socket.IO pertinents
- Implémenter suivi GPS client (envoyer position au chauffeur)
- Implémenter suivi GPS chauffeur (recevoir et afficher position)
- Afficher carte avec directions et markers
- Gérer les statuts de course et affichage correspondant
- Implémenter gestion du paiement :
  - Modal de confirmation
  - Gestion erreurs (retry, switch to cash)
  - Modal de résultat (succès/échec)
  - Modal de remerciement
- Gérer l'annulation de course
- Redirection après completion

### Phase 6 : Interface Chauffeur

#### 6.1 Améliorer `app/(chauffeur)/index.tsx`
- Joindre session Socket.IO au chargement
- Écouter `order:new` et `orders:pending` pour nouvelles commandes
- Afficher liste des commandes en attente
- Implémenter accept/decline avec feedback
- Redirection vers `course-en-cours` après acceptation

#### 6.2 Améliorer `app/(chauffeur)/course-en-cours.tsx`
- Joindre session Socket.IO et room de course
- Implémenter suivi GPS continu (toutes les 2-3 secondes)
- Mettre à jour statut de course (`enroute` → `arrived` → `inprogress` → `completed`)
- Afficher carte avec directions vers pickup puis destination
- Implémenter confirmation de paiement
- Gérer l'annulation

### Phase 7 : Composants UI

#### 7.1 Créer `components/PaymentResultModal.tsx`
- Afficher résultat de paiement (succès/échec)
- Afficher détails (montant, méthode, carte si applicable)
- Boutons : Retry, Switch to Cash, OK

#### 7.2 Créer `components/ThankYouModal.tsx`
- Afficher message de remerciement après course
- Bouton pour retourner à l'accueil

#### 7.3 Améliorer gestion des erreurs
- Messages d'erreur clairs pour toutes les opérations
- Retry automatique pour erreurs réseau
- Feedback visuel pour toutes les actions

### Phase 8 : Tests et Polish

#### 8.1 Tests de flux complets
- Test création commande → recherche chauffeur → assignation → course → paiement
- Test réservation à l'avance
- Test annulation (client et chauffeur)
- Test erreurs de paiement et retry
- Test switch to cash

#### 8.2 Optimisations
- Optimiser fréquence d'envoi GPS (2-3 secondes)
- Gérer reconnexion Socket.IO
- Gérer perte de connexion réseau
- Cache des données de commande

## Fichiers à Modifier/Créer

### Fichiers à Modifier
1. `lib/api.ts` - Ajouter fonctions API manquantes
2. `lib/socket.ts` - Compléter événements Socket.IO
3. `app/(client)/commande-options.tsx` - Calcul distance, réservations
4. `app/(client)/ride/recherche-chauffeur.tsx` - Création commande réelle
5. `app/(client)/ride/course-en-cours.tsx` - Flux complet avec Socket.IO
6. `app/(chauffeur)/index.tsx` - Réception commandes
7. `app/(chauffeur)/course-en-cours.tsx` - Gestion course chauffeur

### Fichiers à Créer
1. `components/PaymentResultModal.tsx` - Modal résultat paiement
2. `components/ThankYouModal.tsx` - Modal remerciement
3. `lib/geolocation.ts` - Helpers pour géolocalisation (si nécessaire)

## Ordre de Priorité

1. **Critique** : Phase 1, 2, 4, 5 (flux de commande complet)
2. **Important** : Phase 3, 6 (améliorations UX)
3. **Nice to have** : Phase 7, 8 (polish et optimisations)

## Notes Techniques

### Client Token
- Le `clientToken` est généré par le backend lors de la création de commande
- Il doit être stocké dans SecureStore (ou sessionStorage pour web)
- Il est requis pour toutes les opérations Socket.IO côté client
- Il expire avec la commande (60 secondes si non acceptée)

### Gestion des Statuts
- Les statuts de course doivent être synchronisés entre client et chauffeur
- Utiliser Socket.IO pour les mises à jour en temps réel
- HTTP polling comme fallback si Socket.IO échoue

### Géolocalisation
- Demander permissions au bon moment
- Gérer les erreurs de permission gracieusement
- Optimiser la fréquence d'envoi pour économiser la batterie

### Paiement
- Le paiement est confirmé uniquement par le chauffeur
- Le client peut retry si échec (après mise à jour de carte)
- Le client peut switch to cash si problème avec carte
- Gérer 3D Secure si nécessaire (nécessite interaction client)
