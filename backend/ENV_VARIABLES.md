# Variables d'environnement nécessaires pour le Backend TAPEA

Liste complète des variables d'environnement nécessaires pour faire fonctionner le backend sur Render.

## 🔑 Variables obligatoires

### Base de données PostgreSQL (Neon)

```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

**Exemple** (à remplacer par vos vraies valeurs) :
```
DATABASE_URL=postgresql://neondb_owner:password@ep-small-mode-ae28kulc.c-2.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
```

**Où trouver** : Replit Secrets → `DATABASE_URL`

---

### Stripe

```
STRIPE_SECRET_KEY=sk_live_... ou sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_live_... ou pk_test_...
```

**Où trouver** :
- Replit Secrets → `STRIPE_SECRET_KEY`
- Replit Secrets → `STRIPE_PUBLISHABLE_KEY`

**Note** : En production, utiliser les clés `live_`, en développement les clés `test_`

---

### Sessions (Express)

```
SESSION_SECRET=votre_secret_session_très_long_et_aléatoire
```

**Où trouver** : Replit Secrets → `SESSION_SECRET`

**Génération** (si besoin d'un nouveau) :
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

### Push Notifications (VAPID)

```
VAPID_PUBLIC_KEY=votre_clé_publique_vapid
VAPID_PRIVATE_KEY=votre_clé_privée_vapid
VAPID_SUBJECT=mailto:tape-a.pf@gmail.com
```

**Où trouver** :
- Replit Secrets → `VAPID_PUBLIC_KEY`
- Replit Secrets → `VAPID_PRIVATE_KEY`
- Replit Secrets → `VAPID_SUBJECT` (ou utiliser `mailto:tape-a.pf@gmail.com`)

---

### Google Maps API

```
GOOGLE_MAPS_API_KEY=votre_clé_api_google_maps
```

**Où trouver** : Replit Secrets → `GOOGLE_MAPS_API_KEY`

---

## ⚙️ Variables optionnelles

### Node.js Environment

```
NODE_ENV=production
```

**Valeur recommandée** : `production` pour Render

---

### Port (géré automatiquement par Render)

```
PORT=10000
```

**Note** : Render définit automatiquement `PORT`, pas besoin de le configurer manuellement. Le code utilise `process.env.PORT || '5000'` donc c'est compatible.

---

## 📝 Checklist pour Render

Copiez ces variables depuis Replit vers Render :

- [ ] `DATABASE_URL`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `SESSION_SECRET`
- [ ] `VAPID_PUBLIC_KEY`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `VAPID_SUBJECT`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `NODE_ENV` (optionnel, mettre `production`)

---

## 🔒 Sécurité

⚠️ **IMPORTANT** :

- ✅ Ne jamais commiter ces valeurs dans Git
- ✅ Utiliser les variables d'environnement Render
- ✅ Vérifier que `.env` est dans `.gitignore`
- ✅ Ne pas partager ces valeurs publiquement
- ✅ Utiliser des secrets différents pour dev/prod si possible

---

## 🧪 Test des variables

Une fois configurées sur Render, vous pouvez tester si elles sont bien chargées en vérifiant les logs du service. Le backend devrait démarrer sans erreur si toutes les variables obligatoires sont présentes.
