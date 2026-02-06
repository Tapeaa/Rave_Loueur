# Guide de Migration : Replit → Render

Ce guide vous accompagne étape par étape pour migrer votre backend TAPEA de Replit vers Render.

## 📋 Prérequis

- ✅ Code backend extrait et accessible (✅ Fait)
- ✅ Compte Render créé
- ✅ Accès aux variables d'environnement Replit
- ✅ Base de données Neon accessible (déjà externe, pas de changement nécessaire)

## 🔄 Étapes de Migration

### Étape 1 : Préparer le code

Le code est déjà dans `backend/TAPEA-APP-DESIGN-20-Frame-64296/`.

**Vérifications à faire :**
- ✅ Le code utilise `process.env.PORT` (compatible Render)
- ✅ Route `/health` existe (nécessaire pour Render)
- ✅ Scripts `build` et `start` dans package.json

### Étape 2 : Créer le repository Git (si nécessaire)

Si le backend n'est pas encore sur Git :

```bash
cd backend/TAPEA-APP-DESIGN-20-Frame-64296
git init
git add .
git commit -m "Initial commit - Backend TAPEA"
# Pousser vers GitHub/GitLab
```

**Option A : Repository séparé (recommandé)**
- Créer un nouveau repo GitHub pour le backend
- Garder frontend et backend séparés

**Option B : Monorepo**
- Le backend est dans un sous-dossier
- Render peut pointer vers le sous-dossier

### Étape 3 : Créer le service sur Render

1. **Aller sur https://render.com**
2. **Créer un compte** (gratuit)
3. **New +** → **Web Service**
4. **Connecter le repository**
   - Connecter votre compte GitHub/GitLab
   - Sélectionner le repository avec le backend

5. **Configuration du service :**
   ```
   Name: tapea-backend
   Region: Oregon (US West) ou le plus proche
   Branch: main (ou master)
   Root Directory: (laisser vide si à la racine, ou mettre le chemin si dans sous-dossier)
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Plan: Free (pour commencer)
   ```

6. **Variables d'environnement :**
   
   ⚠️ **IMPORTANT** : Copier toutes les variables depuis Replit
   
   | Variable | Source |
   |----------|--------|
   | `DATABASE_URL` | Replit Secrets |
   | `STRIPE_SECRET_KEY` | Replit Secrets |
   | `STRIPE_PUBLISHABLE_KEY` | Replit Secrets |
   | `SESSION_SECRET` | Replit Secrets |
   | `VAPID_PUBLIC_KEY` | Replit Secrets |
   | `VAPID_PRIVATE_KEY` | Replit Secrets |
   | `VAPID_SUBJECT` | Replit Secrets ou `mailto:tape-a.pf@gmail.com` |
   | `GOOGLE_MAPS_API_KEY` | Replit Secrets |
   | `NODE_ENV` | `production` |

7. **Cliquer sur "Create Web Service"**

### Étape 4 : Attendre le déploiement

- Render va :
  1. Cloner le repository
  2. Installer les dépendances (`npm install`)
  3. Builder le projet (`npm run build`)
  4. Démarrer le service (`npm start`)

- ⏱️ **Temps estimé** : 5-10 minutes

- 📊 **Suivre les logs** dans le Dashboard Render

### Étape 5 : Tester le nouveau backend

1. **Tester l'endpoint de santé :**
   ```
   https://tapea-backend.onrender.com/health
   ```
   Devrait retourner : `{"status":"ok","timestamp":...}`

2. **Tester un endpoint API :**
   ```
   https://tapea-backend.onrender.com/api/health
   ```
   (si disponible)

3. **Vérifier les logs** pour voir s'il y a des erreurs

### Étape 6 : Mettre à jour l'app React Native

**Dans `app.config.js` :**

Changer :
```javascript
apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://tapea-app-design-20-frame-64296-teriimanamorgan.replit.app/api",
```

Par :
```javascript
apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://tapea-backend.onrender.com/api",
```

**Ou créer/modifier `.env` :**
```
EXPO_PUBLIC_API_URL=https://tapea-backend.onrender.com/api
```

### Étape 7 : Tester l'app avec le nouveau backend

1. **Redémarrer l'app Expo**
2. **Tester les fonctionnalités principales :**
   - Authentification (login/register)
   - Création de commande
   - Socket.IO (temps réel)
   - Paiements Stripe

3. **Vérifier les logs** côté Render et côté app

### Étape 8 : Basculer complètement (optionnel)

Une fois que tout fonctionne bien :

1. **Option A : Garder Replit en backup**
   - Bonne idée pour les premiers jours
   - Facile de revenir en arrière si problème

2. **Option B : Arrêter Replit**
   - Une fois confiant que tout fonctionne
   - Économiser les ressources Replit

## ⚠️ Problèmes courants et solutions

### 1. Le service se met en veille (plan gratuit)

**Problème** : Après 15 min d'inactivité, le service Render se met en veille. Le premier appel prend ~30 secondes.

**Solution** :
- Utiliser un service de ping (UptimeRobot, cron-job.org) qui appelle `/health` toutes les 10 minutes
- Ou passer au plan Starter ($7/mois) pour éviter le spin down

### 2. Erreur de build

**Vérifier :**
- Les logs dans Render Dashboard
- Que toutes les dépendances sont dans `package.json`
- Que les scripts `build` et `start` fonctionnent

### 3. Erreur de connexion à la base de données

**Vérifier :**
- Que `DATABASE_URL` est correctement configuré
- Que la base de données Neon est accessible depuis Render
- Les logs pour voir l'erreur exacte

### 4. Socket.IO ne fonctionne pas

**Vérifier :**
- Que Socket.IO est bien démarré (logs)
- Que CORS est configuré correctement
- L'URL Socket.IO dans l'app React Native

### 5. Variables d'environnement manquantes

**Vérifier :**
- Que toutes les variables sont dans Render
- Que les noms correspondent exactement
- Redémarrer le service après modification

## 📊 Checklist de migration

- [ ] Code backend extrait et accessible
- [ ] Repository Git créé (si nécessaire)
- [ ] Service Render créé
- [ ] Toutes les variables d'environnement configurées
- [ ] Build réussi sur Render
- [ ] Endpoint `/health` fonctionne
- [ ] App React Native mise à jour avec la nouvelle URL
- [ ] Tests fonctionnels passés
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] (Optionnel) Replit arrêté

## 🎉 Une fois la migration terminée

- ✅ Backend hébergé sur Render
- ✅ Plus de dépendance à Replit
- ✅ Contrôle total sur le déploiement
- ✅ Déploiement automatique via Git
- ✅ Logs accessibles facilement

## 📞 Support

En cas de problème :
1. Vérifier les logs Render Dashboard
2. Vérifier que toutes les variables sont configurées
3. Tester l'endpoint `/health`
4. Vérifier la base de données Neon
