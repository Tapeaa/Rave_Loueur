# Guide de Démarrage Rapide

## Problème : Erreur 502 lors de la connexion chauffeur

L'erreur 502 signifie que le serveur mock API n'est pas démarré ou n'est pas accessible.

## Solution Simple

### Étape 1 : Démarrer le serveur mock API

Ouvrez un terminal et exécutez :

```bash
npm run server
```

Vous devriez voir :
```
========================================
[SERVER] Mock API Server Started
========================================
[SERVER] Port: 5000
...
```

### Étape 2 : Démarrer Expo (dans un autre terminal)

Ouvrez un **nouveau terminal** et exécutez :

```bash
npm start
```

### Étape 3 : OU utiliser la commande qui démarre les deux

```bash
npm run dev
```

Cette commande démarre automatiquement les deux serveurs.

## Vérification

1. Vérifiez que le serveur mock répond : Ouvrez `http://localhost:5000/api/health` dans votre navigateur
2. Vérifiez que l'app utilise la bonne URL : Dans les logs Expo, vous devriez voir `[API] Using API URL: http://192.168.99.38:5000/api`
3. Testez la connexion avec le code `111111`

## Codes de test

- **111111** - Jean Dupont
- **222222** - Marie Martin  
- **123456** - Pierre Bernard

## Si ça ne marche toujours pas

1. Vérifiez que votre IP locale est toujours `192.168.99.38` (exécutez `ipconfig` et cherchez "IPv4")
2. Si votre IP a changé, modifiez `app.config.js` ligne 71 avec votre nouvelle IP
3. Redémarrez l'app Expo après avoir modifié `app.config.js`
4. Vérifiez que votre iPhone et votre ordinateur sont sur le même réseau Wi-Fi
