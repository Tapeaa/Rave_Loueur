import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 5000;
const EXPO_PORT = 8081;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Middleware de logging pour toutes les requêtes (en premier)
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ============================================
// MOCK DATA - Serveur local pour développement
// ============================================

// Chauffeurs de test (codes d'accès)
const MOCK_DRIVERS: Record<string, {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  code: string;
  isActive: boolean;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
}> = {
  '111111': {
    id: 'driver-1',
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '+68987123456',
    code: '111111',
    isActive: true,
    vehicleModel: 'Toyota Prius',
    vehicleColor: 'Blanc',
    vehiclePlate: 'AB-123-CD',
  },
  '222222': {
    id: 'driver-2',
    firstName: 'Marie',
    lastName: 'Martin',
    phone: '+68987234567',
    code: '222222',
    isActive: true,
    vehicleModel: 'Nissan Leaf',
    vehicleColor: 'Rouge',
    vehiclePlate: 'EF-456-GH',
  },
  '123456': {
    id: 'driver-3',
    firstName: 'Pierre',
    lastName: 'Bernard',
    phone: '+68987345678',
    code: '123456',
    isActive: true,
    vehicleModel: 'Hyundai Ioniq',
    vehicleColor: 'Bleu',
    vehiclePlate: 'IJ-789-KL',
  },
};

// Sessions chauffeurs (en mémoire)
const driverSessions: Map<string, { id: string; driverId: string; driverName: string; createdAt: number }> = new Map();

// Générer un ID de session unique
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// ENDPOINTS MOCK - DOIT ÊTRE AVANT LE PROXY
// ============================================

// Connexion chauffeur
app.post('/api/driver/login', (req, res) => {
  console.log('[MOCK] ✅ POST /api/driver/login received:', req.body);
  try {
    const { code } = req.body;

    if (!code) {
      console.log('[MOCK] ❌ Missing code');
      return res.status(400).json({ error: 'Code requis' });
    }

    const codeStr = String(code);
    const driver = MOCK_DRIVERS[codeStr];

    if (!driver) {
      console.log(`[MOCK] ❌ Code ${codeStr} not found`);
      return res.status(401).json({ error: 'Code incorrect' });
    }

    if (!driver.isActive) {
      console.log(`[MOCK] ❌ Driver ${driver.id} is inactive`);
      return res.status(403).json({ error: 'Compte chauffeur désactivé' });
    }

    // Créer une session
    const sessionId = generateSessionId();
    driverSessions.set(sessionId, {
      id: sessionId,
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`.trim(),
      createdAt: Date.now(),
    });

    console.log(`[MOCK] ✅ Session created for driver ${driver.id}: ${sessionId}`);

    // Définir le cookie de session
    res.cookie('driverSessionId', sessionId, {
      httpOnly: true,
      secure: false, // En dev, on peut mettre false
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    console.log(`[MOCK] ✅ Sending success response for driver ${driver.firstName} ${driver.lastName}`);
    res.json({
      success: true,
      session: {
        id: sessionId,
      },
      driver: {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        vehicleModel: driver.vehicleModel,
        vehicleColor: driver.vehicleColor,
        vehiclePlate: driver.vehiclePlate,
      },
    });
  } catch (error) {
    console.error('[MOCK] ❌ Driver login error:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Register client (mock)
app.post('/api/auth/register', (req, res) => {
  console.log('[MOCK] ✅ POST /api/auth/register received:', req.body);
  try {
    const { phone, firstName, lastName, password } = req.body;

    if (!phone || !firstName || !lastName || !password) {
      console.log('[MOCK] ❌ Missing required fields');
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Générer un ID client de test
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sessionId = generateSessionId();

    console.log(`[MOCK] ✅ Client registered: ${firstName} ${lastName} (${phone})`);

    // Définir le cookie de session
    res.cookie('clientSessionId', sessionId, {
      httpOnly: true,
      secure: false, // En dev, on peut mettre false
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
    });

    res.json({
      success: true,
      client: {
        id: clientId,
        phone,
        firstName,
        lastName,
        isVerified: true,
      },
      session: {
        id: sessionId,
      },
    });
  } catch (error) {
    console.error('[MOCK] ❌ Register error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), mode: 'mock' });
});

// Endpoint de test pour vérifier que le serveur répond
app.get('/api/test', (_req, res) => {
  res.json({
    success: true,
    message: 'Serveur mock API fonctionnel',
    timestamp: Date.now(),
    availableEndpoints: [
      'POST /api/driver/login',
      'POST /api/auth/register',
      'GET /api/health',
      'GET /api/test',
      'GET /api/places/autocomplete',
      'GET /api/places/details',
    ],
  });
});

app.get('/api/places/autocomplete', async (req, res) => {
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

app.get('/api/places/details', async (req, res) => {
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

// Handler pour les routes API non trouvées (404) - après toutes les routes API définies
// IMPORTANT: Ce handler doit être APRÈS toutes les routes API mais AVANT le proxy
// Express 5 ne supporte pas /api/*, donc on utilise un middleware qui vérifie le chemin
app.use((req, res, next) => {
  // Si c'est une route API et que la réponse n'a pas encore été envoyée
  if (req.path.startsWith('/api/')) {
    // Attendre un peu pour voir si une route API a répondu
    // Si headersSent est false, c'est qu'aucune route n'a répondu
    if (!res.headersSent) {
      console.warn(`[SERVER] API route not found: ${req.method} ${req.path}`);
      return res.status(404).json({ error: 'Route API non trouvée' });
    }
    // Si headersSent est true, une route API a déjà répondu, ne rien faire
    return;
  }
  // Pour les routes non-API, continuer vers le proxy
  next();
});

// Proxy pour Expo - seulement pour les routes qui ne sont pas /api/*
const expoProxy = createProxyMiddleware({
  target: `http://localhost:${EXPO_PORT}`,
  changeOrigin: true,
  ws: true,
  logLevel: 'warn',
  pathFilter: (pathname) => !pathname.startsWith('/api'), // Ignorer /api/*
  onError: (err, req, res) => {
    console.error(`[SERVER] Proxy error for ${req.path}:`, err.message);
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Serveur Expo non disponible',
        message: 'Le serveur de développement Expo n\'est pas démarré. Lancez "npm start" dans un autre terminal.',
      });
    }
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`[SERVER] Proxying ${req.method} ${req.path} to Expo`);
  },
});

app.use('/', expoProxy);

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('[SERVER] Mock API Server Started');
  console.log('========================================');
  console.log(`[SERVER] Port: ${PORT}`);
  console.log(`[SERVER] API Base URL: http://localhost:${PORT}/api`);
  console.log(`[SERVER] Health Check: http://localhost:${PORT}/api/health`);
  console.log(`[SERVER] Test Endpoint: http://localhost:${PORT}/api/test`);
  console.log('\n[SERVER] Test Driver Codes:');
  console.log('  - 111111 (Jean Dupont)');
  console.log('  - 222222 (Marie Martin)');
  console.log('  - 123456 (Pierre Bernard)');
  console.log('\n[SERVER] Proxy Configuration:');
  console.log(`  - Non-API routes will proxy to Expo on port ${EXPO_PORT}`);
  console.log(`  - Make sure Expo is running: npm start`);
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('\n[SERVER] ⚠️  Warning: GOOGLE_MAPS_API_KEY not set');
    console.warn('[SERVER] Google Places endpoints will not work');
  } else {
    console.log('\n[SERVER] ✓ Google Places API ready');
  }
  console.log('========================================\n');
});
