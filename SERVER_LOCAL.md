# Serveurs Locaux

Ce projet utilise **deux serveurs distincts** pour le développement :

## Les deux serveurs

1. **Serveur Expo** (port 8081) : Serveur de développement React Native
   - Géré par `expo start` ou `npm start`
   - Nécessaire pour charger l'application sur mobile/web
   - Gère le hot reload et le bundling

2. **Serveur Mock API** (port 5000) : Serveur backend mock
   - Géré par `npm run server`
   - Simule les endpoints API du backend
   - Gère les routes `/api/*`

## Démarrage rapide

### Option 1 : Démarrer les deux serveurs en même temps (recommandé)

```bash
npm run dev
```

Cette commande démarre automatiquement les deux serveurs en parallèle.

### Option 2 : Démarrer séparément (deux terminaux)

**Terminal 1 - Serveur Expo :**
```bash
npm start
```

**Terminal 2 - Serveur Mock API :**
```bash
npm run server
```

## Configuration

L'URL API est configurée dans `app.config.js` pour pointer vers le serveur mock local :

- **Pour mobile (iPhone/Android)** : `http://192.168.99.38:5000/api` (utilise votre IP locale)
- **Pour web** : `http://localhost:5000/api`

Si votre IP locale change, modifiez `app.config.js` ligne 71.

## Codes de test chauffeur

Le serveur mock inclut les codes de test suivants :

- **111111** - Jean Dupont (Toyota Prius, Blanc, AB-123-CD)
- **222222** - Marie Martin (Nissan Leaf, Rouge, EF-456-GH)
- **123456** - Pierre Bernard (Hyundai Ioniq, Bleu, IJ-789-KL)

## Endpoints disponibles

- `POST /api/driver/login` - Connexion chauffeur avec code
- `GET /api/health` - Health check du serveur mock
- `GET /api/test` - Test de connectivité (liste tous les endpoints)
- `GET /api/places/autocomplete` - Autocomplete Google Places
- `GET /api/places/details` - Détails d'un lieu Google Places

## Dépannage

### L'app ne peut pas se connecter au serveur Expo

1. Vérifiez que le serveur Expo est démarré : `npm start`
2. Vérifiez que votre iPhone et votre ordinateur sont sur le même réseau Wi-Fi
3. Vérifiez que le firewall Windows n'bloque pas le port 8081
4. Vérifiez votre IP locale avec `ipconfig` et mettez à jour `app.config.js` si nécessaire

### Le serveur mock ne répond pas

1. Vérifiez que le serveur mock est démarré : `npm run server`
2. Testez l'endpoint de santé : `http://localhost:5000/api/health`
3. Vérifiez les logs du serveur pour voir les erreurs

### Erreur 502 ou "Serveur backend inaccessible"

1. Vérifiez que les deux serveurs sont démarrés
2. Vérifiez que l'URL API dans `app.config.js` correspond à votre IP locale
3. Redémarrez l'app Expo après avoir modifié `app.config.js`

## Notes

- Les sessions sont stockées en mémoire (perdues au redémarrage)
- Les cookies de session sont gérés automatiquement
- Le serveur utilise CORS pour permettre les requêtes depuis l'app mobile
- Le serveur mock proxy les routes non-API vers le serveur Expo
- Si le serveur Expo n'est pas démarré, le proxy retournera une erreur 503 claire
