'use strict';
/**
 * routes/simulation.js
 * ====================
 * Simulation control, incident management, and the SSE live-data stream.
 *
 * POST /api/simulation/state   — change match state / speed (auth required)
 * POST /api/incidents/resolve  — resolve a pending incident   (auth required)
 * GET  /api/live-data          — SSE stream of simulation state
 */

const express = require('express');
const router  = express.Router();

const { simulationState }                                          = require('../lib/state');
const { runSimulationTick, broadcastData, buildStatePayload,
        updateSimulationSpeed }                                     = require('../lib/simulator');
const { authMiddleware }                                            = require('./auth');

const VALID_MATCH_STATES = ['Pre-match', 'Kick-off', 'Half-time', 'Second-half', 'Post-match'];

// ---------------------------------------------------------------------------
// POST /api/simulation/state
// ---------------------------------------------------------------------------
router.post('/state', authMiddleware, (req, res) => {
  const { matchState, simulationSpeed, stadiumId } = req.body;

  if (matchState !== undefined && !VALID_MATCH_STATES.includes(matchState)) {
    return res.status(400).json({ error: `matchState must be one of: ${VALID_MATCH_STATES.join(', ')}` });
  }

  if (simulationSpeed !== undefined) {
    const speedNum = Number(simulationSpeed);
    if (!Number.isFinite(speedNum) || speedNum < 0.5 || speedNum > 20) {
      return res.status(400).json({ error: 'simulationSpeed must be a number between 0.5 and 20' });
    }
  }

  if (matchState) {
    simulationState.matchState = matchState;
    console.log(`[SIMULATOR] Match state changed to: ${matchState}`);
    if (matchState === 'Pre-match') {
      simulationState.telemetry.crowdDensity   = 35;
      simulationState.telemetry.wasteBinCapacity = { zone1: 20, zone2: 15, zone3: 25, zone4: 10 };
      simulationState.incidents = [];
    } else if (matchState === 'Post-match') {
      simulationState.telemetry.crowdDensity = 90;
    }
  }

  // Acknowledge which stadium is active in the frontend selector
  if (typeof stadiumId === 'string' && stadiumId.trim()) {
    simulationState.stadiumId = stadiumId.trim();
    console.log(`[SIMULATOR] Stadium set to: ${simulationState.stadiumId}`);
  }

  if (simulationSpeed !== undefined) {
    updateSimulationSpeed(Number(simulationSpeed));
    console.log(`[SIMULATOR] Speed set to: ${simulationSpeed}x`);
  }

  runSimulationTick();
  res.json({ success: true, state: simulationState.matchState, speed: simulationState.simulationSpeed, stadiumId: simulationState.stadiumId });
});

// ---------------------------------------------------------------------------
// POST /api/incidents/resolve
// ---------------------------------------------------------------------------
const INCIDENT_ID_RE = /^[a-z0-9-]+$/i; // alphanumeric + hyphens only

router.post('/resolve', authMiddleware, (req, res) => {
  const { incidentId } = req.body;

  if (typeof incidentId !== 'string' || !incidentId.trim() || incidentId.length > 50) {
    return res.status(400).json({ error: 'A valid incidentId string is required' });
  }
  // Guard against regex-injection or path-traversal characters
  if (!INCIDENT_ID_RE.test(incidentId)) {
    return res.status(400).json({ error: 'incidentId contains invalid characters' });
  }

  const incident = simulationState.incidents.find(i => i.id === incidentId);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  if (incident.status !== 'Pending') {
    return res.json({ success: false, message: 'Incident is already being processed or resolved' });
  }

  // Determine volunteer type from incident keywords
  const desc = incident.description.toLowerCase();
  let volunteerType = 'Info';
  if (desc.includes('waste') || desc.includes('bin'))                                      volunteerType = 'Sustainability';
  else if (desc.includes('spill') || desc.includes('clean'))                               volunteerType = 'Logistics';
  else if (desc.includes('elevator') || desc.includes('ramp') || desc.includes('wheelchair')) volunteerType = 'Accessibility';
  else if (desc.includes('medical') || desc.includes('heart') || desc.includes('injur'))   volunteerType = 'Medical';

  let volunteer = simulationState.volunteers.find(v => v.name.includes(volunteerType) && v.status === 'Available')
               || simulationState.volunteers.find(v => v.status === 'Available');

  if (volunteer) {
    volunteer.status   = 'Dispatched';
    volunteer.location = incident.location;
    incident.volunteerAssigned = volunteer.name;
  } else {
    incident.volunteerAssigned = 'Emergency Response Crew (External)';
  }

  incident.status = 'Resolving';
  broadcastData();

  const resolveTime = Math.max(1000, 8000 / simulationState.simulationSpeed);
  setTimeout(() => {
    incident.status = 'Resolved';
    if (volunteer) volunteer.status = 'Available';

    if (desc.includes('waste') || desc.includes('bin')) {
      let zone = 'zone1';
      if (incident.location.includes('Gate C') || incident.location.includes('Plaza')) zone = 'zone3';
      else if (incident.location.includes('West'))                                      zone = 'zone2';
      else if (incident.location.includes('Section 218') || incident.location.includes('Ramp')) zone = 'zone4';
      simulationState.telemetry.wasteBinCapacity[zone] = 15;
    }

    broadcastData();
    console.log(`[SIMULATOR] Incident ${incidentId} resolved by ${incident.volunteerAssigned}`);
  }, resolveTime);

  res.json({ success: true, incident });
});

// ---------------------------------------------------------------------------
// GET /api/live-data  (SSE)
// ---------------------------------------------------------------------------
router.get('/live-data', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':   'keep-alive'
  });

  res.write(`data: ${JSON.stringify(buildStatePayload())}\n\n`);
  simulationState.sseClients.push(res);

  res.on('error', (err) => {
    console.warn(`SSE client connection error: ${err.message}`);
    simulationState.sseClients = simulationState.sseClients.filter(c => c !== res);
  });
  req.on('close', () => {
    simulationState.sseClients = simulationState.sseClients.filter(c => c !== res);
  });
});

module.exports = router;
