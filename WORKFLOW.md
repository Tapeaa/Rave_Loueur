# Workflow de développement - TAPEA-REACT-chauffeur

## ⚠️ RÈGLE CRITIQUE : Ne JAMAIS travailler dans les worktrees temporaires

Cursor crée automatiquement des worktrees Git temporaires (dossiers comme `fci`, `gzm`, `wqd`, `pik`, `kal`) qui **changent à chaque session**. Les modifications faites dans ces dossiers temporaires **ne sont PAS synchronisées** avec les dossiers fixes et seront **perdues**.

## 📁 Dossiers fixes à utiliser

### Pour l'app chauffeur :
```
C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur
```

### Pour l'app client :
```
C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT
```

## ✅ Comment ouvrir le bon dossier dans Cursor

1. **Vérifier le chemin du workspace** : Dans Cursor, regardez la barre de titre ou `File > Preferences` pour voir le chemin actuel
2. **Si le chemin contient `.cursor\worktrees\` ou des noms étranges** (fci, gzm, wqd, pik, kal) :
   - **FERMEZ le workspace**
   - Utilisez `File > Open Folder` (ou `Ctrl+K Ctrl+O`)
   - Naviguez vers le dossier fixe : `C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur`
   - Cliquez sur "Sélectionner le dossier"

3. **Pour lancer l'app chauffeur** :
   ```powershell
   cd "C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur"
   npx expo start --clear --port 8082
   ```

4. **Pour lancer l'app client** :
   ```powershell
   cd "C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT"
   npx expo start --clear --port 8081
   ```

## 🔍 Comment vérifier que vous êtes dans le bon dossier

### Dans PowerShell :
```powershell
pwd
```

Le résultat doit être :
- Pour chauffeur : `C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur`
- Pour client : `C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT`

### Dans Cursor :
- Regardez la barre de titre en haut de la fenêtre
- Le chemin ne doit **PAS** contenir `.cursor\worktrees\` ou des noms temporaires

## 📝 Fichiers critiques

Assurez-vous que ces fichiers existent dans le dossier fixe :

- ✅ `app/index.tsx` : Redirige vers `/(chauffeur)/login` si `appMode === "chauffeur"`
- ✅ `app.config.js` : Contient `appMode: "chauffeur"` dans `extra`

## 🚨 En cas de doute

Si vous n'êtes pas sûr du dossier dans lequel vous travaillez :

1. **Fermez Cursor complètement**
2. **Ouvrez l'explorateur de fichiers Windows**
3. **Naviguez vers** `C:\Users\Planet Fenua\OneDrive\Bureau\App react github\TAPEA-REACT-chauffeur`
4. **Faites clic droit > "Ouvrir avec Cursor"** (ou utilisez `File > Open Folder` dans Cursor)

## 💡 Astuce

Ajoutez les dossiers fixes aux **favoris** dans l'explorateur de fichiers Windows pour y accéder rapidement.
