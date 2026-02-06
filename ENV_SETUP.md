# Configuration des Variables d'Environnement

Ce document explique comment configurer les variables d'environnement pour l'application TĀPE'A.

## Variables d'Environnement Frontend (Application Expo)

Les variables d'environnement pour l'application Expo sont stockées dans le fichier `.env` à la racine du projet.

### Variables configurées

- `EXPO_PUBLIC_API_URL` : URL de l'API backend
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` : Clé publique Stripe (pour les paiements)
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` : Clé API Google Maps (pour la géolocalisation)
- `STRIPE_PUBLISHABLE_KEY` : Clé Stripe pour app.config.js
- `GOOGLE_MAPS_API_KEY` : Clé Google Maps pour app.config.js

### Important

- Le fichier `.env` est ignoré par Git (ne sera jamais commité)
- Les variables préfixées par `EXPO_PUBLIC_` sont accessibles dans le code client
- Ne jamais exposer de secrets côté client (clés secrètes, mots de passe, etc.)

## Variables d'Environnement Backend (Serveur Replit)

Les variables suivantes doivent être configurées **uniquement sur le serveur backend** (Replit) dans les Secrets de l'environnement :

### Variables de Base de Données

```
DATABASE_URL=postgresql://neondb_owner:password@host:5432/neondb?sslmode=require
PGDATABASE=neondb
PGHOST=ep-small-mode-ae28kulc.c-2.us-east-2.aws.neon.tech
PGPORT=5432
PGUSER=neondb_owner
PGPASSWORD=npg_SFo8ZLhb3UXx
```

### Variables Stripe

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_... (optionnel, utilisé côté client)
```

### Variables de Session

```
SESSION_SECRET=g8iwrZJqhRsChCUSiwwACCg2MOe8brHOEFAV4afbhiwqkdz06tbTmCotMkEUTu67r8KK+tlofESlefgwwM3jyg==
```

### Variables Push Notifications (VAPID)

```
VAPID_PRIVATE_KEY=BC5tp6BbnMhV8qs_WuwelAjYSiZlp4b0vysPO0EuauHrWL5Pn7fagzsbAYW7vQn8WTNDwHGu eUf4gNzj4Oi51f4
VAPID_SUBJECT=mailto:tape-a.pf@gmail.com
```

### Variables Google Maps (pour le backend)

```
GOOGLE_MAPS_API_KEY=AlzaSyD-zLCMASnWQjXCt2_ynYPWtpwchUAq8Pg
```

## Comment configurer sur Replit

1. Allez dans votre projet Replit
2. Ouvrez le panneau "Secrets" (🔒) dans la barre latérale
3. Ajoutez chaque variable d'environnement avec sa valeur
4. Redémarrez le serveur pour que les changements prennent effet

## Notes de Sécurité

⚠️ **IMPORTANT** : Ne jamais commiter les secrets dans Git
- Les secrets backend ne doivent jamais être dans le fichier `.env` du projet frontend
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez toujours des variables d'environnement pour les secrets
- En production, utilisez les clés Stripe LIVE au lieu des clés TEST
