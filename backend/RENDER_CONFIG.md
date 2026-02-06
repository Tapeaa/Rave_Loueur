# Configuration Render pour le Backend TAPEA

Ce guide explique comment déployer le backend TAPEA sur Render.

## Vue d'ensemble

Le backend utilise :
- **Express** + **TypeScript**
- **Socket.IO** pour le temps réel
- **PostgreSQL** (Neon) pour la base de données
- **Stripe** pour les paiements
- **Web Push** pour les notifications

## Variables d'environnement nécessaires

### Base de données (PostgreSQL - Neon)
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Stripe
```
STRIPE_SECRET_KEY=sk_live_... ou sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_... ou pk_test_...
```

### Sessions
```
SESSION_SECRET=votre_secret_session_très_long_et_aléatoire
```

### Push Notifications (VAPID)
```
VAPID_PUBLIC_KEY=votre_clé_publique_vapid
VAPID_PRIVATE_KEY=votre_clé_privée_vapid
VAPID_SUBJECT=mailto:tape-a.pf@gmail.com
```

### Google Maps
```
GOOGLE_MAPS_API_KEY=votre_clé_api_google_maps
```

### Node.js (optionnel)
```
NODE_ENV=production
```

## Configuration Render

### Option 1 : Via l'interface Render (Recommandé)

1. **Créer un compte Render**
   - Aller sur https://render.com
   - Créer un compte (gratuit pour commencer)

2. **Créer un nouveau Web Service**
   - Cliquer sur "New +" → "Web Service"
   - Connecter votre repository GitHub (ou déployer depuis un repo Git)

3. **Configuration du service**
   - **Name** : `tapea-backend` (ou votre nom)
   - **Region** : `Oregon (US West)` ou plus proche de vous
   - **Branch** : `main` ou `master`
   - **Root Directory** : `backend/TAPEA-APP-DESIGN-20-Frame-64296` (si le backend est dans un sous-dossier)
   - **Runtime** : `Node`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Plan** : `Free` pour commencer

4. **Variables d'environnement**
   - Cliquer sur "Environment"
   - Ajouter toutes les variables listées ci-dessus
   - ⚠️ **IMPORTANT** : Utiliser les mêmes valeurs que sur Replit

5. **Déployer**
   - Cliquer sur "Create Web Service"
   - Render va build et déployer automatiquement
   - Notez l'URL générée : `https://tapea-backend.onrender.com`

### Option 2 : Via render.yaml (Configuration as Code)

Créer un fichier `render.yaml` à la racine du projet backend :

```yaml
services:
  - type: web
    name: tapea-backend
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false  # À définir manuellement dans l'interface
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: STRIPE_PUBLISHABLE_KEY
        sync: false
      - key: SESSION_SECRET
        sync: false
      - key: VAPID_PUBLIC_KEY
        sync: false
      - key: VAPID_PRIVATE_KEY
        sync: false
      - key: VAPID_SUBJECT
        value: mailto:tape-a.pf@gmail.com
      - key: GOOGLE_MAPS_API_KEY
        sync: false
```

## Configuration post-déploiement

### 1. Mettre à jour l'app React Native

Dans `app.config.js` :

```javascript
apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://tapea-backend.onrender.com/api",
```

Ou créer un fichier `.env` :

```
EXPO_PUBLIC_API_URL=https://tapea-backend.onrender.com/api
```

### 2. Vérifier le déploiement

1. Tester l'endpoint de santé :
   ```
   https://tapea-backend.onrender.com/health
   ```
   Devrait retourner : `{"status":"ok","timestamp":...}`

2. Vérifier les logs dans Render Dashboard

## Notes importantes

### ⚠️ Limitations du plan gratuit Render

- **Spin down après 15 minutes d'inactivité**
  - Le service se met en veille après 15 min sans requêtes
  - Le premier appel après veille prend ~30 secondes (cold start)
  - Solution : Utiliser un service de ping (UptimeRobot, etc.) pour garder le service actif

- **Limite de 750 heures/mois**
  - Suffisant pour un service avec spin down
  - Si besoin de 24/7, passer au plan Starter ($7/mois)

### 🔒 Sécurité

- Ne jamais commiter les secrets dans Git
- Utiliser les variables d'environnement Render
- S'assurer que le `.env` est dans `.gitignore`

### 📊 Monitoring

- Les logs sont disponibles dans le Dashboard Render
- Surveiller les erreurs et la performance
- Configurer des alertes si nécessaire

## Migration depuis Replit

1. **Sauvegarder les variables d'environnement Replit**
   - Noter toutes les valeurs actuelles
   - Les copier dans Render

2. **Tester le nouveau backend**
   - Vérifier que tout fonctionne sur Render
   - Tester avec votre app React Native

3. **Basculer progressivement**
   - Option A : Changer directement l'URL dans l'app
   - Option B : Garder Replit en backup pendant quelques jours

4. **Arrêter Replit** (optionnel)
   - Une fois que tout fonctionne sur Render
   - Vous pouvez arrêter le service Replit

## Support

En cas de problème :
1. Vérifier les logs dans Render Dashboard
2. Vérifier que toutes les variables d'environnement sont configurées
3. Vérifier que la base de données Neon est accessible
4. Tester l'endpoint `/health`
