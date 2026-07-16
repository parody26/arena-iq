'use strict';
/**
 * lib/state.js
 * ============
 * Owns the shared simulation state, the STADIUM_KNOWLEDGE reference data,
 * and the lightweight JSON persistence layer (load on startup / save every 10s).
 *
 * Centralising state here means routes and the simulator only need one
 * well-known import — no more scattered module-level globals.
 */

const path = require('path');
const fs   = require('fs');

// ---------------------------------------------------------------------------
// STADIUM REFERENCE DATA
// ---------------------------------------------------------------------------
const STADIUM_KNOWLEDGE = {
  name: 'MetLife Stadium (FIFA 2026 Venue)',
  location: 'East Rutherford, New Jersey',
  capacity: 82500,
  gates: {
    'Gate A': { location: 'North-East', accessibility: 'Wheelchair accessible, ramp, visual aid assistance desk', features: 'Main Fan Zone, light rail shuttle drop-off' },
    'Gate B': { location: 'North-West', accessibility: 'Sensory room, elevator access, wheelchair pickup',        features: 'Sustainability pavilion, electric shuttle stand' },
    'Gate C': { location: 'South-West', accessibility: 'Wheelchair accessible ramp',                              features: 'Rideshare drop-off zone, food trucks' },
    'Gate D': { location: 'South-East', accessibility: 'Elevator access',                                          features: 'VIP Entrance, team buses, media hub' }
  },
  facilities: {
    restrooms: 'Located near sections 101, 109, 117, 128, 134, 143, 201, 215, 224, 243, 301, 319, 335, 344. All areas have wheelchair accessible stalls.',
    sensoryRooms: 'Near Section 102 (Gate B entrance). Equipped with noise-canceling headphones, tactile toys, and calming lights.',
    firstAid: 'First Aid Stations are located at Section 109, Section 131, Section 227, and Section 312.',
    concessions: [
      { name: 'Green Pitch Concourse',    locations: ['Sec 104', 'Sec 128'],      menu: 'Vegan burgers, plant-based hotdogs, organic salads',            features: '100% biodegradable packaging, local sourcing' },
      { name: 'Jersey Classic Eats',      locations: ['Sec 112', 'Sec 140'],      menu: 'Pretzel dogs, standard hotdogs, local pizzas',                  features: 'Refillable cup station' },
      { name: 'World Flavors Express',    locations: ['Sec 120', 'Sec 205'],      menu: 'Halal gyros, Kosher hotdogs, Tacos, Sushi',                     features: 'Multilingual digital menu boards' },
      { name: 'Zero Waste Hydration',     locations: ['Every Section Entrance'],  menu: 'Filtered water refills (free with souvenir cup)',               features: 'Eliminates single-use plastic bottles' }
    ],
    transportation: {
      lightRail:    'NJ Transit Rail connects directly to Secaucus Junction. Trains depart every 6-10 minutes post-match.',
      shuttleBuses: 'Eco-shuttles run continuously from Lot P and Lot K to Gate A and Gate B.',
      rideshare:    'Designated pickup/dropoff zone is at Lot E (outside Gate C). Estimated rideshare surge window is 45 mins post-match.'
    }
  }
};

// ---------------------------------------------------------------------------
// GLOBAL SIMULATION STATE
// ---------------------------------------------------------------------------
const simulationState = {
  matchState:      'Pre-match',   // Pre-match | Kick-off | Half-time | Second-half | Post-match
  simulationSpeed: 1,             // tick-rate multiplier
  stadiumId:       'metlife',     // active stadium (kept in sync with frontend selector)
  timestamp:       new Date().toLocaleTimeString(),
  telemetry: {
    crowdDensity:    35,
    gateThroughput:  { 'Gate A': 140, 'Gate B': 95, 'Gate C': 110, 'Gate D': 45 },
    queueWaitTimes:  { 'Gate A': 8, 'Gate B': 12, 'Gate C': 5, 'Gate D': 2, Concessions: 10, Restrooms: 6 },
    energyUsage:     { solarGeneration: 45, gridPower: 120, batteryStorage: 88, unit: 'kW' },
    waterFlow:       { rate: 24, unit: 'gal/min' },
    wasteBinCapacity:{ zone1: 30, zone2: 25, zone3: 40, zone4: 15 }
  },
  incidents: [
    {
      id: 'inc-1',
      timestamp: '08:15 AM',
      severity: 'Medium',
      location: 'Gate B Security Queues',
      description: 'Elevated queue times (28 minutes) due to ticket scanner sync issue.',
      status: 'Resolving',
      volunteerAssigned: 'Volunteer Unit 08',
      genaiRecommendation: 'Deploy Volunteer Unit 08 with manual QR scanner units to Gate B. Broadcast push notification to fans in zone 2 advising them to use Gate C where wait times are under 5 mins.'
    }
  ],
  volunteers: [
    { id: 'vol-01', name: 'Volunteer Unit 01 (Info)',           location: 'Gate A',                 status: 'Available'  },
    { id: 'vol-02', name: 'Volunteer Unit 02 (Medical)',        location: 'Sec 109',                status: 'Available'  },
    { id: 'vol-03', name: 'Volunteer Unit 03 (Logistics)',      location: 'Concourse Sec 120',      status: 'Available'  },
    { id: 'vol-04', name: 'Volunteer Unit 04 (Accessibility)',  location: 'Gate B Elevator',        status: 'Available'  },
    { id: 'vol-05', name: 'Volunteer Unit 05 (Sustainability)', location: 'Section 104',            status: 'Available'  },
    { id: 'vol-08', name: 'Volunteer Unit 08 (Info)',           location: 'Gate B Entrance',        status: 'Dispatched' }
  ],
  sseClients: []
};

// ---------------------------------------------------------------------------
// STATE PERSISTENCE  (best-effort JSON snapshot, no database required)
// ---------------------------------------------------------------------------
const STATE_FILE        = path.join(__dirname, '..', 'data', 'simulation-state.json');
const PERSIST_INTERVAL_MS = 10_000;

function loadPersistedState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      simulationState.matchState      = saved.matchState      ?? simulationState.matchState;
      simulationState.simulationSpeed = saved.simulationSpeed ?? simulationState.simulationSpeed;
      simulationState.stadiumId       = saved.stadiumId       ?? simulationState.stadiumId;
      simulationState.telemetry       = saved.telemetry       ?? simulationState.telemetry;
      simulationState.incidents       = saved.incidents       ?? simulationState.incidents;
      simulationState.volunteers      = saved.volunteers      ?? simulationState.volunteers;
      console.log(`Restored simulation state from ${STATE_FILE} (last saved ${saved.savedAt || 'unknown time'}).`);
    } else {
      console.log('No persisted state found — starting from default simulation state.');
    }
  } catch (err) {
    console.warn(`Could not load persisted state (${err.message}). Starting fresh.`);
  }
}

function persistState() {
  try {
    const { sseClients, ...persistable } = simulationState;
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...persistable, savedAt: new Date().toISOString() }, null, 2));
  } catch (err) {
    // Persistence is best-effort — degrade to in-memory, never crash.
    console.warn(`Could not persist simulation state (${err.message}).`);
  }
}

module.exports = { simulationState, STADIUM_KNOWLEDGE, loadPersistedState, persistState, STATE_FILE, PERSIST_INTERVAL_MS };
