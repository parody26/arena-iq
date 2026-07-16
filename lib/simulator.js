'use strict';
/**
 * lib/simulator.js
 * ================
 * Live telemetry simulation engine.
 * Owns: tick logic, incident generation, GenAI recommendations,
 * SSE broadcast, and the speed-control timer.
 */

const { simulationState } = require('./state');

let genAI = null; // injected by server.js after Gemini init

/** Allow server.js to hand us the initialized genAI client. */
function setGenAI(client) { genAI = client; }

// ---------------------------------------------------------------------------
// SSE BROADCAST
// ---------------------------------------------------------------------------

function buildStatePayload() {
  return {
    matchState:      simulationState.matchState,
    simulationSpeed: simulationState.simulationSpeed,
    stadiumId:       simulationState.stadiumId,
    timestamp:       simulationState.timestamp,
    telemetry:       simulationState.telemetry,
    incidents:       simulationState.incidents,
    volunteers:      simulationState.volunteers
  };
}

function broadcastData() {
  if (simulationState.sseClients.length === 0) return;
  const data = JSON.stringify(buildStatePayload());
  [...simulationState.sseClients].forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.warn(`Dropping a broken SSE client: ${err.message}`);
      simulationState.sseClients = simulationState.sseClients.filter(c => c !== client);
    }
  });
}

// ---------------------------------------------------------------------------
// GENAI ASYNC RECOMMENDATION
// ---------------------------------------------------------------------------

async function generateGenAIRecommendation(incident) {
  const GENAI_TIMEOUT_MS = 10_000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('GenAI recommendation timed out after 10s')), GENAI_TIMEOUT_MS)
  );

  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      You are the ArenaIQ Operations Decision Support AI for the FIFA World Cup 2026.
      A new stadium operations incident has occurred:
      ID: ${incident.id}
      Severity: ${incident.severity}
      Location: ${incident.location}
      Description: ${incident.description}
      Current Stadium State: ${simulationState.matchState}

      Provide a concise (2-3 sentences), highly actionable operational response plan.
      Identify which volunteer/staff unit should be dispatched (e.g. Info, Medical, Logistics, Accessibility, Sustainability) and what digital systems to update (e.g. mobile app routing, gate signage).
      Be direct, professional, and specific to the FIFA stadium context.
    `;

    const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
    const text   = result.response.text().trim();

    const idx = simulationState.incidents.findIndex(i => i.id === incident.id);
    if (idx !== -1) {
      simulationState.incidents[idx].genaiRecommendation = text;
      broadcastData();
    }
  } catch (err) {
    console.error('GenAI recommendation error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// RANDOM INCIDENT GENERATOR
// ---------------------------------------------------------------------------

function generateRandomIncident() {
  const locations = [
    { name: 'Section 104 Eco-Stalls',        zone: 'zone1' },
    { name: 'Gate C Food Trucks Plaza',       zone: 'zone3' },
    { name: 'West Concourse Concessions',     zone: 'zone2' },
    { name: 'Section 218 Accessibility Ramp', zone: 'zone4' },
    { name: 'Gate A Light Rail Station',      zone: 'zone1' }
  ];

  const templates = [
    { severity: 'Low',    description: 'Waste overflow detected at Smart Bin.',                   advice: 'Dispatch Sustainability Volunteer Unit to replace bags and route items to Sorting Hub B.' },
    { severity: 'Medium', description: 'Liquid spill reported causing slip hazard.',              advice: 'Dispatch Maintenance Unit for urgent cleaning. Place yellow cone alert at location. Redirect nearby fans via app.' },
    { severity: 'Medium', description: 'Accessibility elevator temporarily stopped between floors.', advice: 'Dispatch Technical Crew. Alert Accessibility volunteer at closest gate. Update digital signage to redirect wheelchair users.' },
    { severity: 'High',   description: 'Crowd bottleneck forming near entry turnstiles.',         advice: 'Open auxiliary ticket lane 12. Direct volunteer staff to guide fans to Gate C. Send push alert in app for fans in zone.' }
  ];

  const loc  = locations[Math.floor(Math.random() * locations.length)];
  const temp = templates[Math.floor(Math.random() * templates.length)];

  const newIncident = {
    id:                  `inc-${Date.now().toString().slice(-4)}`,
    timestamp:           new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    severity:            temp.severity,
    location:            loc.name,
    description:         `${temp.description} (${loc.name})`,
    status:              'Pending',
    volunteerAssigned:   'None',
    genaiRecommendation: temp.advice
  };

  if (temp.description.includes('Waste overflow')) {
    simulationState.telemetry.wasteBinCapacity[loc.zone] = 98;
  }

  if (genAI) generateGenAIRecommendation(newIncident);

  simulationState.incidents.unshift(newIncident);
  console.log(`[SIMULATOR] New incident generated: ${newIncident.description}`);
}

// ---------------------------------------------------------------------------
// SIMULATION TICK
// ---------------------------------------------------------------------------

function runSimulationTick() {
  const state = simulationState.matchState;
  const tel   = simulationState.telemetry;

  simulationState.timestamp = new Date().toLocaleTimeString();

  switch (state) {
    case 'Pre-match':
      tel.crowdDensity = Math.min(85, tel.crowdDensity + Math.floor(Math.random() * 4) + 1);
      tel.gateThroughput['Gate A'] = Math.floor(180 + Math.random() * 40);
      tel.gateThroughput['Gate B'] = Math.floor(150 + Math.random() * 30);
      tel.gateThroughput['Gate C'] = Math.floor(130 + Math.random() * 30);
      tel.gateThroughput['Gate D'] = Math.floor(60  + Math.random() * 20);
      tel.queueWaitTimes['Gate A'] = Math.max(5, Math.floor(tel.gateThroughput['Gate A'] / 12));
      tel.queueWaitTimes['Gate B'] = Math.max(5, Math.floor(tel.gateThroughput['Gate B'] / 10));
      tel.queueWaitTimes['Gate C'] = Math.max(3, Math.floor(tel.gateThroughput['Gate C'] / 15));
      tel.queueWaitTimes['Gate D'] = Math.max(2, Math.floor(tel.gateThroughput['Gate D'] / 20));
      tel.queueWaitTimes.Concessions = Math.max(4, Math.floor(4 + Math.random() * 5));
      tel.queueWaitTimes.Restrooms   = Math.max(3, Math.floor(2 + Math.random() * 4));
      tel.energyUsage.solarGeneration = Math.min(150, Math.floor(100 + Math.random() * 15));
      tel.energyUsage.gridPower       = Math.floor(180 + Math.random() * 20);
      tel.energyUsage.batteryStorage  = Math.max(10, tel.energyUsage.batteryStorage - 1);
      simulationState.volunteers.forEach(v => {
        if (Math.random() > 0.85 && v.status === 'Available')
          v.location = ['Gate A', 'Gate B', 'Gate C', 'Concourse Sec 104', 'Concourse Sec 140'][Math.floor(Math.random() * 5)];
      });
      break;

    case 'Kick-off':
      tel.crowdDensity = Math.min(96, tel.crowdDensity + Math.floor(Math.random() * 2));
      tel.gateThroughput['Gate A'] = Math.floor(30 + Math.random() * 15);
      tel.gateThroughput['Gate B'] = Math.floor(20 + Math.random() * 10);
      tel.gateThroughput['Gate C'] = Math.floor(25 + Math.random() * 10);
      tel.gateThroughput['Gate D'] = Math.floor(10 + Math.random() * 5);
      tel.queueWaitTimes['Gate A'] = Math.max(2, tel.queueWaitTimes['Gate A'] - 2);
      tel.queueWaitTimes['Gate B'] = Math.max(2, tel.queueWaitTimes['Gate B'] - 2);
      tel.queueWaitTimes['Gate C'] = Math.max(1, tel.queueWaitTimes['Gate C'] - 1);
      tel.queueWaitTimes['Gate D'] = 1;
      tel.queueWaitTimes.Concessions = Math.max(2, tel.queueWaitTimes.Concessions - 3);
      tel.queueWaitTimes.Restrooms   = Math.max(1, tel.queueWaitTimes.Restrooms   - 2);
      tel.energyUsage.gridPower = Math.floor(320 + Math.random() * 30);
      break;

    case 'Half-time':
      tel.crowdDensity = 95;
      Object.keys(tel.gateThroughput).forEach(k => { tel.gateThroughput[k] = Math.floor(Math.random() * 5); });
      Object.keys(tel.queueWaitTimes).forEach(k => { if (k.startsWith('Gate')) tel.queueWaitTimes[k] = 1; });
      tel.queueWaitTimes.Concessions = Math.min(25, tel.queueWaitTimes.Concessions + Math.floor(Math.random() * 5) + 3);
      tel.queueWaitTimes.Restrooms   = Math.min(18, tel.queueWaitTimes.Restrooms   + Math.floor(Math.random() * 4) + 2);
      tel.waterFlow.rate = Math.floor(120 + Math.random() * 30);
      tel.wasteBinCapacity.zone1 = Math.min(100, tel.wasteBinCapacity.zone1 + Math.floor(Math.random() * 8));
      tel.wasteBinCapacity.zone2 = Math.min(100, tel.wasteBinCapacity.zone2 + Math.floor(Math.random() * 6));
      tel.wasteBinCapacity.zone3 = Math.min(100, tel.wasteBinCapacity.zone3 + Math.floor(Math.random() * 7));
      tel.wasteBinCapacity.zone4 = Math.min(100, tel.wasteBinCapacity.zone4 + Math.floor(Math.random() * 5));
      break;

    case 'Second-half':
      tel.queueWaitTimes.Concessions = Math.max(3, tel.queueWaitTimes.Concessions - 4);
      tel.queueWaitTimes.Restrooms   = Math.max(2, tel.queueWaitTimes.Restrooms   - 3);
      tel.waterFlow.rate = Math.floor(35 + Math.random() * 10);
      break;

    case 'Post-match':
      tel.crowdDensity = Math.max(10, tel.crowdDensity - Math.floor(Math.random() * 6) - 2);
      Object.keys(tel.gateThroughput).forEach(k => { tel.gateThroughput[k] = 0; });
      ['Gate A', 'Gate B', 'Gate C', 'Gate D'].forEach(g => { tel.queueWaitTimes[g] = 1; });
      tel.queueWaitTimes.Concessions = 1;
      tel.queueWaitTimes.Restrooms   = Math.max(2, tel.queueWaitTimes.Restrooms - 1);
      tel.wasteBinCapacity.zone1 = Math.min(100, tel.wasteBinCapacity.zone1 + Math.floor(Math.random() * 4));
      tel.wasteBinCapacity.zone2 = Math.min(100, tel.wasteBinCapacity.zone2 + Math.floor(Math.random() * 3));
      tel.wasteBinCapacity.zone3 = Math.min(100, tel.wasteBinCapacity.zone3 + Math.floor(Math.random() * 4));
      tel.wasteBinCapacity.zone4 = Math.min(100, tel.wasteBinCapacity.zone4 + Math.floor(Math.random() * 3));
      tel.energyUsage.gridPower = Math.max(80, tel.energyUsage.gridPower - 15);
      break;
  }

  if (Math.random() > 0.90 && simulationState.incidents.filter(i => i.status !== 'Resolved').length < 4) {
    generateRandomIncident();
  }

  broadcastData();
}

function runSimulationTickGated() {
  if (simulationState.sseClients.length === 0) return;
  runSimulationTick();
}

let simulationInterval = setInterval(runSimulationTickGated, 3000);

function updateSimulationSpeed(speed) {
  simulationState.simulationSpeed = speed;
  clearInterval(simulationInterval);
  simulationInterval = setInterval(runSimulationTickGated, Math.max(300, 3000 / speed));
}

module.exports = { runSimulationTick, runSimulationTickGated, broadcastData, buildStatePayload, updateSimulationSpeed, setGenAI };
