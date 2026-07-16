'use strict';
/**
 * server.js  —  ArenaIQ Stadium Operations Hub
 * =============================================
 * Entry point: wires middleware, mounts route modules, and starts the server.
 * All business logic lives in lib/ and routes/ for clean separation of concerns.
 *
 * Modules
 * -------
 *  lib/state.js       — simulationState, STADIUM_KNOWLEDGE, persistence
 *  lib/simulator.js   — tick engine, incident generator, SSE broadcast
 *  lib/nlp.js         — keyword-map local NLP fallback
 *  routes/auth.js     — POST /api/auth/staff, POST /api/auth/staff/logout
 *  routes/simulation.js — POST /api/simulation/state, POST /api/incidents/resolve, GET /api/live-data
 *  routes/chat.js     — POST /api/chat
 */

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const dotenv     = require('dotenv');
const path       = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── SECURITY MIDDLEWARE ────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://kit.fontawesome.com'],
      styleSrc:    ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"]
    }
  }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin))
      return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '20kb' }));

// General rate limit across all /api routes
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please slow down.' }
}));

// ─── STATIC FILES & ROOT ────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── GEMINI INIT ────────────────────────────────────────────────────────────

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini API initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini API:', err.message);
  }
} else {
  console.log('No GEMINI_API_KEY found. Operating in local simulation mode.');
}

// ─── INJECT genAI INTO MODULES THAT NEED IT ─────────────────────────────────

const simulator = require('./lib/simulator');
simulator.setGenAI(genAI);

const chatRoute = require('./routes/chat');
chatRoute.setGenAI(genAI);

// ─── ROUTE MOUNTS ────────────────────────────────────────────────────────────

const { router: authRouter }   = require('./routes/auth');
const simRouter                = require('./routes/simulation');

app.use('/api/auth',        authRouter);
app.use('/api/simulation',  simRouter);
app.use('/api/incidents',   simRouter);   // resolve shares the sim router
app.use('/api',             simRouter);   // catches /api/live-data
app.use('/api/chat',        chatRoute.router);

// ─── PERSISTENCE (server-run only, skip in Jest) ────────────────────────────

if (require.main === module) {
  const { loadPersistedState, persistState, PERSIST_INTERVAL_MS } = require('./lib/state');
  loadPersistedState();
  setInterval(persistState, PERSIST_INTERVAL_MS);
  process.on('SIGINT',  () => { persistState(); process.exit(0); });
  process.on('SIGTERM', () => { persistState(); process.exit(0); });

  app.listen(PORT, () => {
    console.log('==================================================');
    console.log(' ArenaIQ Stadium Operations Hub Server Running!');
    console.log(` Port:    http://localhost:${PORT}`);
    console.log(' Mode:    FIFA World Cup 2026 Live Telemetry');
    console.log('==================================================');
  });
}

// ─── TEST EXPORTS ────────────────────────────────────────────────────────────
// Export the same surface as the original monolith so existing tests pass
// without modification.

const { simulationState }                           = require('./lib/state');
const { isValidToken, activeTokens, generateToken } = require('./routes/auth');
const { runSimulationTick }                         = require('./lib/simulator');
const { handleLocalNLP }                            = require('./lib/nlp');

module.exports = { app, simulationState, isValidToken, activeTokens, generateToken, runSimulationTick, handleLocalNLP };
