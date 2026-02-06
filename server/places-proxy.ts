import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/places/autocomplete', async (req, res) => {
  const input = req.query.input as string;

  if (!input || input.length < 3) {
    return res.json({ predictions: [] });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[PLACES] Google Maps API key not configured');
    return res.status(500).json({ error: 'API Google Maps non configurée' });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:pf&key=${GOOGLE_MAPS_API_KEY}&language=fr`
    );
    const data = await response.json();

    if (data.status === 'OK') {
      res.json({ predictions: data.predictions });
    } else if (data.status === 'ZERO_RESULTS') {
      res.json({ predictions: [] });
    } else {
      console.error('[PLACES] Autocomplete error:', data.status, data.error_message);
      res.status(500).json({ error: data.error_message || 'Erreur API Google' });
    }
  } catch (error) {
    console.error('[PLACES] Autocomplete fetch error:', error);
    res.status(500).json({ error: 'Erreur de connexion à l\'API Google' });
  }
});

app.get('/places/details', async (req, res) => {
  const placeId = req.query.place_id as string;

  if (!placeId) {
    return res.status(400).json({ error: 'place_id requis' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[PLACES] Google Maps API key not configured');
    return res.status(500).json({ error: 'API Google Maps non configurée' });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.status === 'OK' && data.result?.geometry?.location) {
      res.json({
        location: {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
        },
      });
    } else {
      console.error('[PLACES] Details error:', data.status, data.error_message);
      res.status(500).json({ error: data.error_message || 'Lieu non trouvé' });
    }
  } catch (error) {
    console.error('[PLACES] Details fetch error:', error);
    res.status(500).json({ error: 'Erreur de connexion à l\'API Google' });
  }
});

// Endpoint pour calculer la route et la distance
app.get('/places/directions', async (req, res) => {
  const origin = req.query.origin as string; // placeId ou "lat,lng"
  const destination = req.query.destination as string; // placeId ou "lat,lng"
  const waypoints = req.query.waypoints as string | undefined; // JSON array de placeIds ou "lat,lng"
  const travelMode = (req.query.travelMode as string) || 'driving';

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin et destination requis' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[PLACES] Google Maps API key not configured');
    return res.status(500).json({ error: 'API Google Maps non configurée' });
  }

  try {
    // Construire l'URL pour Directions API
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${GOOGLE_MAPS_API_KEY}&language=fr&region=pf`;
    
    // Ajouter waypoints si présents
    if (waypoints) {
      try {
        const waypointsArray = JSON.parse(waypoints) as string[];
        if (waypointsArray.length > 0) {
          const waypointsStr = waypointsArray.map(wp => `place_id:${wp}`).join('|');
          url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
        }
      } catch (e) {
        console.warn('[PLACES] Invalid waypoints format, ignoring');
      }
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      let totalDistance = 0; // en mètres
      let totalDuration = 0; // en secondes

      route.legs.forEach((leg: any) => {
        totalDistance += leg.distance?.value || 0;
        totalDuration += leg.duration?.value || 0;
      });

      const distanceKm = totalDistance / 1000;
      const durationMin = Math.round(totalDuration / 60);
      const durationText = durationMin < 60 
        ? `${durationMin} min` 
        : `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}min` : ''}`;

      res.json({
        distance: distanceKm,
        duration: durationText,
        distanceMeters: totalDistance,
        durationSeconds: totalDuration,
        polyline: route.overview_polyline?.points,
      });
    } else {
      console.error('[PLACES] Directions error:', data.status, data.error_message);
      res.status(500).json({ 
        error: data.error_message || 'Impossible de calculer l\'itinéraire',
        status: data.status 
      });
    }
  } catch (error) {
    console.error('[PLACES] Directions fetch error:', error);
    res.status(500).json({ error: 'Erreur de connexion à l\'API Google' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PLACES PROXY] Server running on port ${PORT}`);
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[PLACES PROXY] Warning: GOOGLE_MAPS_API_KEY not set');
  }
});
