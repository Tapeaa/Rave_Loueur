# Processus Complet de Commande - Documentation Chauffeur

> **Note** : Cette documentation est une copie de référence pour l'app chauffeur.
> Voir la documentation complète dans `TAPEA-REACT/PROCESSUS_COMPLET.md`

## 📋 Fichiers Critiques Chauffeur

1. **`app/(chauffeur)/index.tsx`**
   - Gestion des commandes en attente
   - Acceptation de commande
   - Navigation vers `course-en-cours` avec `orderId`

2. **`app/(chauffeur)/course-en-cours.tsx`**
   - Mapping des statuts backend → frontend
   - Boutons d'action selon le statut
   - Suivi GPS chauffeur
   - Modals de paiement

3. **`app/index.tsx`**
   - Redirection vers `/(chauffeur)/login` si `appMode === 'chauffeur'`

4. **`app.config.js`**
   - Configuration `appMode: 'chauffeur'`
   - Scheme `tapea-chauffeur`

---

## 🔄 Flux des Statuts

1. **En Route** (`enroute`) → Bouton "J'arrive"
2. **Arrivé** (`arrived`) → Bouton "Démarrer la course"
3. **Course en Cours** (`inprogress`) → Bouton "Terminer la course"
4. **Terminé** (`completed`) → Bouton "Confirmer paiement"

---

**Voir `TAPEA-REACT/PROCESSUS_COMPLET.md` pour la documentation complète.**
