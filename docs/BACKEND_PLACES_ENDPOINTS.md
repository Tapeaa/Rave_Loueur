# Endpoints Google Places pour le Backend

Ajoutez ce code dans votre fichier `server/routes.ts` pour activer l'autocomplétion des adresses dans l'application mobile.

## Code à ajouter

```typescript
// ============================================
// GOOGLE PLACES API - Endpoints pour l'autocomplétion d'adresses
// Ajoutez ce code dans la fonction registerRoutes()
// ============================================

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// Endpoint pour l'autocomplétion des adresses
app.get("/api/places/autocomplete", async (req, res) => {
  const input = req.query.input as string;
  
  if (!input || input.length < 3) {
    return res.json({ predictions: [] });
  }
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[PLACES] Google Maps API key not configured");
    return res.status(500).json({ error: "API Google Maps non configurée" });
  }
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:pf&key=${GOOGLE_MAPS_API_KEY}&language=fr`
    );
    const data = await response.json();
    
    if (data.status === "OK") {
      res.json({ predictions: data.predictions });
    } else if (data.status === "ZERO_RESULTS") {
      res.json({ predictions: [] });
    } else {
      console.error("[PLACES] Autocomplete error:", data.status, data.error_message);
      res.status(500).json({ error: data.error_message || "Erreur API Google" });
    }
  } catch (error) {
    console.error("[PLACES] Autocomplete fetch error:", error);
    res.status(500).json({ error: "Erreur de connexion à l'API Google" });
  }
});

// Endpoint pour récupérer les détails d'un lieu (coordonnées)
app.get("/api/places/details", async (req, res) => {
  const placeId = req.query.place_id as string;
  
  if (!placeId) {
    return res.status(400).json({ error: "place_id requis" });
  }
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[PLACES] Google Maps API key not configured");
    return res.status(500).json({ error: "API Google Maps non configurée" });
  }
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === "OK" && data.result?.geometry?.location) {
      res.json({
        location: {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
        }
      });
    } else {
      console.error("[PLACES] Details error:", data.status, data.error_message);
      res.status(500).json({ error: data.error_message || "Lieu non trouvé" });
    }
  } catch (error) {
    console.error("[PLACES] Details fetch error:", error);
    res.status(500).json({ error: "Erreur de connexion à l'API Google" });
  }
});
```

## Instructions d'installation

1. **Ouvrez votre projet backend** (le serveur Express.js)

2. **Ajoutez le code ci-dessus** dans la fonction `registerRoutes()` de votre fichier `server/routes.ts`

3. **Vérifiez que la variable d'environnement** `GOOGLE_MAPS_API_KEY` est bien configurée dans les secrets de votre backend

4. **Redémarrez le serveur** pour appliquer les changements

## Configuration Google Cloud

Pour que ces endpoints fonctionnent, vous devez activer les APIs suivantes dans votre console Google Cloud :

1. **Places API** - Pour l'autocomplétion des adresses
2. **Geocoding API** - Pour la conversion adresse/coordonnées (optionnel)

### Restrictions de la clé API (recommandé)

Dans la console Google Cloud, restreignez votre clé API :
- **Restrictions d'application** : Adresses IP (ajoutez l'IP de votre serveur Replit)
- **Restrictions d'API** : Places API uniquement

## Test

Une fois les endpoints ajoutés, testez avec :

```bash
# Test autocomplete
curl "https://votre-backend.replit.app/api/places/autocomplete?input=Papeete"

# Test details
curl "https://votre-backend.replit.app/api/places/details?place_id=ChIJ..."
```
