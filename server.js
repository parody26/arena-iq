const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Google Gemini API Client if key is available
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini API initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Gemini API:', error.message);
  }
} else {
  console.log('No GEMINI_API_KEY found. Operating in local simulation mode.');
}

// STADIUM INFO DATA (used for AI prompt context and fallback matching)
const STADIUM_KNOWLEDGE = {
  name: "MetLife Stadium (FIFA 2026 Venue)",
  location: "East Rutherford, New Jersey",
  capacity: 82500,
  gates: {
    "Gate A": { location: "North-East", accessibility: "Wheelchair accessible, ramp, visual aid assistance desk", features: "Main Fan Zone, light rail shuttle drop-off" },
    "Gate B": { location: "North-West", accessibility: "Sensory room, elevator access, wheelchair pickup", features: "Sustainability pavilion, electric shuttle stand" },
    "Gate C": { location: "South-West", accessibility: "Wheelchair accessible ramp", features: "Rideshare drop-off zone, food trucks" },
    "Gate D": { location: "South-East", accessibility: "Elevator access", features: "VIP Entrance, team buses, media hub" }
  },
  facilities: {
    restrooms: "Located near sections 101, 109, 117, 128, 134, 143, 201, 215, 224, 243, 301, 319, 335, 344. All areas have wheelchair accessible stalls.",
    sensoryRooms: "Near Section 102 (Gate B entrance). Equipped with noise-canceling headphones, tactile toys, and calming lights.",
    firstAid: "First Aid Stations are located at Section 109, Section 131, Section 227, and Section 312.",
    concessions: [
      { name: "Green Pitch Concourse", locations: ["Sec 104", "Sec 128"], menu: "Vegan burgers, plant-based hotdogs, organic salads", features: "100% biodegradable packaging, local sourcing" },
      { name: "Jersey Classic Eats", locations: ["Sec 112", "Sec 140"], menu: "Pretzel dogs, standard hotdogs, local pizzas", features: "Refillable cup station" },
      { name: "World Flavors Express", locations: ["Sec 120", "Sec 205"], menu: "Halal gyros, Kosher hotdogs, Tacos, Sushi", features: "Multilingual digital menu boards" },
      { name: "Zero Waste Hydration", locations: ["Every Section Entrance"], menu: "Filtered water refills (free with souvenir cup)", features: "Eliminates single-use plastic bottles" }
    ],
    transportation: {
      lightRail: "NJ Transit Rail connects directly to Secaucus Junction. Trains depart every 6-10 minutes post-match.",
      shuttleBuses: "Eco-shuttles run continuously from Lot P and Lot K to Gate A and Gate B.",
      rideshare: "Designated pickup/dropoff zone is at Lot E (outside Gate C). Estimated rideshare surge window is 45 mins post-match."
    }
  }
};

// GLOBAL SIMULATION STATE
let simulationState = {
  matchState: "Pre-match", // Pre-match, Kick-off, Half-time, Second-half, Post-match
  simulationSpeed: 1, // multiplier for tick frequency
  timestamp: new Date().toLocaleTimeString(),
  telemetry: {
    crowdDensity: 35, // overall % filled/density
    gateThroughput: { "Gate A": 140, "Gate B": 95, "Gate C": 110, "Gate D": 45 }, // fans/min
    queueWaitTimes: { "Gate A": 8, "Gate B": 12, "Gate C": 5, "Gate D": 2, "Concessions": 10, "Restrooms": 6 }, // mins
    energyUsage: { solarGeneration: 45, gridPower: 120, batteryStorage: 88, unit: "kW" }, // environmental
    waterFlow: { rate: 24, unit: "gal/min" },
    wasteBinCapacity: { zone1: 30, zone2: 25, zone3: 40, zone4: 15 } // % filled
  },
  incidents: [
    {
      id: "inc-1",
      timestamp: "08:15 AM",
      severity: "Medium",
      location: "Gate B Security Queues",
      description: "Elevated queue times (28 minutes) due to ticket scanner sync issue.",
      status: "Resolving",
      volunteerAssigned: "Volunteer Unit 08",
      genaiRecommendation: "Deploy Volunteer Unit 08 with manual QR scanner units to Gate B. Broadcast push notification to fans in zone 2 advising them to use Gate C where wait times are under 5 mins."
    }
  ],
  volunteers: [
    { id: "vol-01", name: "Volunteer Unit 01 (Info)", location: "Gate A", status: "Available" },
    { id: "vol-02", name: "Volunteer Unit 02 (Medical)", location: "Sec 109", status: "Available" },
    { id: "vol-03", name: "Volunteer Unit 03 (Logistics)", location: "Concourse Sec 120", status: "Available" },
    { id: "vol-04", name: "Volunteer Unit 04 (Accessibility)", location: "Gate B Elevator", status: "Available" },
    { id: "vol-05", name: "Volunteer Unit 05 (Sustainability)", location: "Section 104", status: "Available" },
    { id: "vol-08", name: "Volunteer Unit 08 (Info)", location: "Gate B Entrance", status: "Dispatched" }
  ],
  sseClients: []
};

// SIMULATION TICK LOOP
// Dynamically adjusts simulation telemetry metrics according to the match state
function runSimulationTick() {
  const state = simulationState.matchState;
  const tel = simulationState.telemetry;

  simulationState.timestamp = new Date().toLocaleTimeString();

  switch (state) {
    case "Pre-match":
      tel.crowdDensity = Math.min(85, tel.crowdDensity + Math.floor(Math.random() * 4) + 1);
      // High entry throughput
      tel.gateThroughput["Gate A"] = Math.floor(180 + Math.random() * 40);
      tel.gateThroughput["Gate B"] = Math.floor(150 + Math.random() * 30);
      tel.gateThroughput["Gate C"] = Math.floor(130 + Math.random() * 30);
      tel.gateThroughput["Gate D"] = Math.floor(60 + Math.random() * 20);
      // Wait times go up
      tel.queueWaitTimes["Gate A"] = Math.max(5, Math.floor(tel.gateThroughput["Gate A"] / 12));
      tel.queueWaitTimes["Gate B"] = Math.max(5, Math.floor(tel.gateThroughput["Gate B"] / 10));
      tel.queueWaitTimes["Gate C"] = Math.max(3, Math.floor(tel.gateThroughput["Gate C"] / 15));
      tel.queueWaitTimes["Gate D"] = Math.max(2, Math.floor(tel.gateThroughput["Gate D"] / 20));
      // Mid concessions and restrooms
      tel.queueWaitTimes["Concessions"] = Math.max(4, Math.floor(4 + Math.random() * 5));
      tel.queueWaitTimes["Restrooms"] = Math.max(3, Math.floor(2 + Math.random() * 4));
      // Energy
      tel.energyUsage.solarGeneration = Math.min(150, Math.floor(100 + Math.random() * 15));
      tel.energyUsage.gridPower = Math.floor(180 + Math.random() * 20);
      tel.energyUsage.batteryStorage = Math.max(10, tel.energyUsage.batteryStorage - 1);
      // Waste
      simulationState.volunteers.forEach(v => { if (Math.random() > 0.85 && v.status === "Available") v.location = ["Gate A", "Gate B", "Gate C", "Concourse Sec 104", "Concourse Sec 140"][Math.floor(Math.random() * 5)]; });
      break;

    case "Kick-off":
      tel.crowdDensity = Math.min(96, tel.crowdDensity + Math.floor(Math.random() * 2));
      // Gate entry slows down
      tel.gateThroughput["Gate A"] = Math.floor(30 + Math.random() * 15);
      tel.gateThroughput["Gate B"] = Math.floor(20 + Math.random() * 10);
      tel.gateThroughput["Gate C"] = Math.floor(25 + Math.random() * 10);
      tel.gateThroughput["Gate D"] = Math.floor(10 + Math.random() * 5);
      // Wait times drop
      tel.queueWaitTimes["Gate A"] = Math.max(2, tel.queueWaitTimes["Gate A"] - 2);
      tel.queueWaitTimes["Gate B"] = Math.max(2, tel.queueWaitTimes["Gate B"] - 2);
      tel.queueWaitTimes["Gate C"] = Math.max(1, tel.queueWaitTimes["Gate C"] - 1);
      tel.queueWaitTimes["Gate D"] = 1;
      // Concessions and restroom queues drop to near empty
      tel.queueWaitTimes["Concessions"] = Math.max(2, tel.queueWaitTimes["Concessions"] - 3);
      tel.queueWaitTimes["Restrooms"] = Math.max(1, tel.queueWaitTimes["Restrooms"] - 2);
      // Power spike due to stadium pitch lighting and broadcast gear
      tel.energyUsage.gridPower = Math.floor(320 + Math.random() * 30);
      break;

    case "Half-time":
      // Crowd inside is stable
      tel.crowdDensity = 95;
      // Gate entry is near 0
      Object.keys(tel.gateThroughput).forEach(k => tel.gateThroughput[k] = Math.floor(Math.random() * 5));
      Object.keys(tel.queueWaitTimes).forEach(k => { if (k.startsWith("Gate")) tel.queueWaitTimes[k] = 1; });
      // Massive spike in Concessions and Restrooms
      tel.queueWaitTimes["Concessions"] = Math.min(25, tel.queueWaitTimes["Concessions"] + Math.floor(Math.random() * 5) + 3);
      tel.queueWaitTimes["Restrooms"] = Math.min(18, tel.queueWaitTimes["Restrooms"] + Math.floor(Math.random() * 4) + 2);
      // High water flow rate and waste generation
      tel.waterFlow.rate = Math.floor(120 + Math.random() * 30);
      tel.wasteBinCapacity.zone1 = Math.min(100, tel.wasteBinCapacity.zone1 + Math.floor(Math.random() * 8));
      tel.wasteBinCapacity.zone2 = Math.min(100, tel.wasteBinCapacity.zone2 + Math.floor(Math.random() * 6));
      tel.wasteBinCapacity.zone3 = Math.min(100, tel.wasteBinCapacity.zone3 + Math.floor(Math.random() * 7));
      tel.wasteBinCapacity.zone4 = Math.min(100, tel.wasteBinCapacity.zone4 + Math.floor(Math.random() * 5));
      break;

    case "Second-half":
      tel.queueWaitTimes["Concessions"] = Math.max(3, tel.queueWaitTimes["Concessions"] - 4);
      tel.queueWaitTimes["Restrooms"] = Math.max(2, tel.queueWaitTimes["Restrooms"] - 3);
      tel.waterFlow.rate = Math.floor(35 + Math.random() * 10);
      break;

    case "Post-match":
      // Fans leaving
      tel.crowdDensity = Math.max(10, tel.crowdDensity - Math.floor(Math.random() * 6) - 2);
      // Outflow is high (reflected as 0 entry throughput, but queue wait times for transit are high)
      Object.keys(tel.gateThroughput).forEach(k => tel.gateThroughput[k] = 0);
      tel.queueWaitTimes["Gate A"] = 1;
      tel.queueWaitTimes["Gate B"] = 1;
      tel.queueWaitTimes["Gate C"] = 1;
      tel.queueWaitTimes["Gate D"] = 1;
      // Concessions closed or low
      tel.queueWaitTimes["Concessions"] = 1;
      // High transit queues (Metro & Bus)
      tel.queueWaitTimes["Concessions"] = 1; // wait, let's keep it separate or transit is handled in UI
      // Waste capacity spikes
      tel.wasteBinCapacity.zone1 = Math.min(100, tel.wasteBinCapacity.zone1 + Math.floor(Math.random() * 4));
      tel.wasteBinCapacity.zone2 = Math.min(100, tel.wasteBinCapacity.zone2 + Math.floor(Math.random() * 3));
      tel.wasteBinCapacity.zone3 = Math.min(100, tel.wasteBinCapacity.zone3 + Math.floor(Math.random() * 4));
      tel.wasteBinCapacity.zone4 = Math.min(100, tel.wasteBinCapacity.zone4 + Math.floor(Math.random() * 3));
      // Energy drops as pitch lights dim
      tel.energyUsage.gridPower = Math.max(80, tel.energyUsage.gridPower - 15);
      break;
  }

  // Trigger random incidents occasionally
  if (Math.random() > 0.90 && simulationState.incidents.filter(i => i.status !== "Resolved").length < 4) {
    generateRandomIncident();
  }

  // Broadcast to all SSE clients
  broadcastData();
}

// Tick timer
let simulationInterval = setInterval(runSimulationTick, 3000);

// Re-configure timer when speed changes
function updateSimulationSpeed(speed) {
  simulationState.simulationSpeed = speed;
  clearInterval(simulationInterval);
  simulationInterval = setInterval(runSimulationTick, Math.max(300, 3000 / speed));
}

// DYNAMIC INCIDENT GENERATOR
function generateRandomIncident() {
  const locations = [
    { name: "Section 104 Eco-Stalls", zone: "zone1" },
    { name: "Gate C Food Trucks Plaza", zone: "zone3" },
    { name: "West Concourse Concessions", zone: "zone2" },
    { name: "Section 218 Accessibility Ramp", zone: "zone4" },
    { name: "Gate A Light Rail Station", zone: "zone1" }
  ];

  const templates = [
    {
      severity: "Low",
      description: "Waste overflow detected at Smart Bin.",
      advice: "Dispatch Sustainability Volunteer Unit to replace bags and route items to Sorting Hub B."
    },
    {
      severity: "Medium",
      description: "Liquid spill reported causing slip hazard.",
      advice: "Dispatch Maintenance Unit for urgent cleaning. Place yellow cone alert at location. Redirect nearby fans via app."
    },
    {
      severity: "Medium",
      description: "Accessibility elevator temporarily stopped between floors.",
      advice: "Dispatch Technical Crew. Alert Accessibility volunteer at closest gate. Update digital signage to redirect wheelchair users."
    },
    {
      severity: "High",
      description: "Crowd bottleneck forming near entry turnstiles.",
      advice: "Open auxiliary ticket lane 12. Direct volunteer staff to guide fans to Gate C. Send push alert in app for fans in zone."
    }
  ];

  const loc = locations[Math.floor(Math.random() * locations.length)];
  const temp = templates[Math.floor(Math.random() * templates.length)];
  const incidentId = `inc-${Date.now().toString().slice(-4)}`;

  const newIncident = {
    id: incidentId,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    severity: temp.severity,
    location: loc.name,
    description: `${temp.description} (${loc.name})`,
    status: "Pending",
    volunteerAssigned: "None",
    genaiRecommendation: temp.advice
  };

  // If incident is waste overflow, set corresponding zone capacity to 95%
  if (temp.description.includes("Waste overflow")) {
    simulationState.telemetry.wasteBinCapacity[loc.zone] = 98;
  }

  // Check if we can generate a real GenAI recommendation for this incident in background
  if (genAI) {
    generateGenAIRecommendation(newIncident);
  }

  simulationState.incidents.unshift(newIncident);
  console.log(`[SIMULATOR] New incident generated: ${newIncident.description}`);
}

// GENAI RECOMMENDATION FOR INCIDENT (BACKGROUND ASYNC)
async function generateGenAIRecommendation(incident) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Find incident and update recommendation
    const idx = simulationState.incidents.findIndex(i => i.id === incident.id);
    if (idx !== -1) {
      simulationState.incidents[idx].genaiRecommendation = text;
      broadcastData();
    }
  } catch (error) {
    console.error('Error generating GenAI recommendation:', error.message);
  }
}

// SSE BROADCASTER
function broadcastData() {
  const data = JSON.stringify({
    matchState: simulationState.matchState,
    simulationSpeed: simulationState.simulationSpeed,
    timestamp: simulationState.timestamp,
    telemetry: simulationState.telemetry,
    incidents: simulationState.incidents,
    volunteers: simulationState.volunteers
  });

  simulationState.sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// SSE CONNECTION ENDPOINT
app.get('/api/live-data', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial data
  const data = JSON.stringify({
    matchState: simulationState.matchState,
    simulationSpeed: simulationState.simulationSpeed,
    timestamp: simulationState.timestamp,
    telemetry: simulationState.telemetry,
    incidents: simulationState.incidents,
    volunteers: simulationState.volunteers
  });
  res.write(`data: ${data}\n\n`);

  simulationState.sseClients.push(res);

  req.on('close', () => {
    simulationState.sseClients = simulationState.sseClients.filter(c => c !== res);
  });
});

// SIMULATION CONTROL API
app.post('/api/simulation/state', (req, res) => {
  const { matchState, simulationSpeed } = req.body;

  if (matchState) {
    simulationState.matchState = matchState;
    console.log(`[SIMULATOR] Match state changed to: ${matchState}`);
    
    // Trigger reset or adjust metrics immediately on transition
    if (matchState === "Pre-match") {
      simulationState.telemetry.crowdDensity = 35;
      simulationState.telemetry.wasteBinCapacity = { zone1: 20, zone2: 15, zone3: 25, zone4: 10 };
      simulationState.incidents = [];
    } else if (matchState === "Post-match") {
      simulationState.telemetry.crowdDensity = 90;
    }
  }

  if (simulationSpeed !== undefined) {
    updateSimulationSpeed(Number(simulationSpeed));
    console.log(`[SIMULATOR] Speed set to: ${simulationSpeed}x`);
  }

  runSimulationTick();
  res.json({ success: true, state: simulationState.matchState, speed: simulationState.simulationSpeed });
});

// INCIDENT RESOLUTION API
app.post('/api/incidents/resolve', (req, res) => {
  const { incidentId } = req.body;
  const incident = simulationState.incidents.find(i => i.id === incidentId);

  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  if (incident.status !== "Pending") {
    return res.json({ success: false, message: "Incident is already being processed or resolved" });
  }

  // Determine volunteer type to assign based on incident location and description
  let volunteerType = "Info";
  if (incident.description.toLowerCase().includes("waste") || incident.description.toLowerCase().includes("bin")) {
    volunteerType = "Sustainability";
  } else if (incident.description.toLowerCase().includes("spill") || incident.description.toLowerCase().includes("clean")) {
    volunteerType = "Logistics";
  } else if (incident.description.toLowerCase().includes("elevator") || incident.description.toLowerCase().includes("ramp") || incident.description.toLowerCase().includes("wheelchair")) {
    volunteerType = "Accessibility";
  } else if (incident.description.toLowerCase().includes("medical") || incident.description.toLowerCase().includes("heart") || incident.description.toLowerCase().includes("injured")) {
    volunteerType = "Medical";
  }

  // Find available volunteer of that type
  let volunteer = simulationState.volunteers.find(v => v.name.includes(volunteerType) && v.status === "Available");
  if (!volunteer) {
    // Grab any available volunteer
    volunteer = simulationState.volunteers.find(v => v.status === "Available");
  }

  if (volunteer) {
    volunteer.status = "Dispatched";
    volunteer.location = incident.location;
    incident.volunteerAssigned = volunteer.name;
  } else {
    incident.volunteerAssigned = "Emergency Response Crew (External)";
  }

  incident.status = "Resolving";
  broadcastData();

  // Simulate resolution completion after a period proportional to speed
  const resolveTime = Math.max(1000, 8000 / simulationState.simulationSpeed);
  setTimeout(() => {
    incident.status = "Resolved";
    if (volunteer) {
      volunteer.status = "Available";
    }
    
    // If it was waste overflow, clear the capacity metric
    if (incident.description.toLowerCase().includes("waste") || incident.description.toLowerCase().includes("bin")) {
      // Find matching zone and reduce capacity
      let zone = "zone1";
      if (incident.location.includes("Gate C") || incident.location.includes("Plaza")) zone = "zone3";
      else if (incident.location.includes("West")) zone = "zone2";
      else if (incident.location.includes("Section 218") || incident.location.includes("Ramp")) zone = "zone4";
      simulationState.telemetry.wasteBinCapacity[zone] = 15;
    }
    
    broadcastData();
    console.log(`[SIMULATOR] Incident ${incidentId} resolved by ${incident.volunteerAssigned}`);
  }, resolveTime);

  res.json({ success: true, incident });
});

// GENAI CHATBOT API (CONCIERGE)
app.post('/api/chat', async (req, res) => {
  const { message, userRole } = req.body;
  const isOperator = userRole === 'operator';

  if (!message) {
    return res.status(400).json({ error: "Message content required" });
  }

  // Check if Gemini is enabled and run
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      let systemPrompt = "";
      if (isOperator) {
        systemPrompt = `
          You are "ArenaIQ Operations Advisor", an advanced AI assistant built for the stadium operations team of MetLife Stadium for the FIFA World Cup 2026.
          You have access to current stadium configurations and rules:
          ${JSON.stringify(STADIUM_KNOWLEDGE)}
          
          Current telemetry metrics:
          ${JSON.stringify(simulationState.telemetry)}
          
          Active Incidents:
          ${JSON.stringify(simulationState.incidents.filter(i => i.status !== "Resolved"))}
          
          Available Staff:
          ${JSON.stringify(simulationState.volunteers.filter(v => v.status === "Available"))}
          
          Current Match State: ${simulationState.matchState}
          Current Time: ${new Date().toLocaleTimeString()}

          Answer questions from stadium managers, crew, or security. Be analytical, professional, and concise. Suggest dispatch assignments or mobile routing adjustments where relevant. Focus heavily on logistics, crowd flows, safety, sustainability, and accessibility.
        `;
      } else {
        systemPrompt = `
          You are "ArenaIQ Fan Concierge", a friendly, multilingual AI host at MetLife Stadium for the FIFA World Cup 2026.
          Stadium layout & accessibility info:
          ${JSON.stringify(STADIUM_KNOWLEDGE)}
          
          Current live waiting times:
          ${JSON.stringify(simulationState.telemetry.queueWaitTimes)}
          Current Crowd Density: ${simulationState.telemetry.crowdDensity}%
          Current Match State: ${simulationState.matchState}

          Help fans navigate, find food, bathrooms, sensory rooms, emergency desks, and local transport options.
          Be welcoming, direct, and concise (under 3-4 sentences). Emphasize accessibility and green options (recycling, refilling water).
          If they ask for directions to a seat, explain that they should find their Gate first, and list the nearest Gate.
          If they speak in another language, respond in that language.
        `;
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        systemInstruction: systemPrompt
      });

      const responseText = result.response.text();
      return res.json({ response: responseText, source: "gemini-ai" });

    } catch (error) {
      console.error("Gemini API call failed, falling back to local NLP:", error.message);
      // Fall through to local fallback
    }
  }

  // HIGH-FIDELITY LOCAL NLP ENGINE (FALLBACK)
  const response = handleLocalNLP(message, isOperator);
  res.json({ response, source: "local-simulation-ai" });
});

// LOCAL NLP ENGINE IMPLEMENTATION
function handleLocalNLP(message, isOperator) {
  const msg = message.toLowerCase();

  if (isOperator) {
    if (msg.includes("incident") || msg.includes("alert")) {
      const active = simulationState.incidents.filter(i => i.status !== "Resolved");
      if (active.length === 0) {
        return "All systems clear. No outstanding incidents are pending operations response.";
      }
      return `There are currently ${active.length} active incident(s). The most critical is: "${active[0].description}" at ${active[0].location}. Recommended action: ${active[0].genaiRecommendation}`;
    }
    if (msg.includes("crowd") || msg.includes("density") || msg.includes("gate")) {
      return `Crowd density is at ${simulationState.telemetry.crowdDensity}%. Gate entry queues: Gate A (${simulationState.telemetry.queueWaitTimes["Gate A"]}m), Gate B (${simulationState.telemetry.queueWaitTimes["Gate B"]}m), Gate C (${simulationState.telemetry.queueWaitTimes["Gate C"]}m), Gate D (${simulationState.telemetry.queueWaitTimes["Gate D"]}m). Recommended action: Keep Gate D open for VIP/Media bypass to reduce Gate A bottleneck.`;
    }
    if (msg.includes("volunteer") || msg.includes("staff") || msg.includes("dispatch")) {
      const avail = simulationState.volunteers.filter(v => v.status === "Available").length;
      return `We have ${avail} volunteer units available out of ${simulationState.volunteers.length} total. Dispatched units: ${simulationState.volunteers.filter(v => v.status !== "Available").map(v => v.name).join(', ') || 'None'}. You can click the 'Authorize Response' button next to pending incidents to auto-dispatch them.`;
    }
    if (msg.includes("energy") || msg.includes("solar") || msg.includes("sustainability") || msg.includes("waste")) {
      const sol = simulationState.telemetry.energyUsage.solarGeneration;
      const grid = simulationState.telemetry.energyUsage.gridPower;
      const bins = simulationState.telemetry.wasteBinCapacity;
      return `Sustainability update: Solar array producing ${sol}kW. Grid consumption: ${grid}kW. Battery bank capacity: ${simulationState.telemetry.energyUsage.batteryStorage}%. Smart waste bin capacity: Zone 1 (${bins.zone1}%), Zone 2 (${bins.zone2}%), Zone 3 (${bins.zone3}%), Zone 4 (${bins.zone4}%). Action item: Dispatch waste crews if any zone exceeds 85%.`;
    }
    return "I am the ArenaIQ Operations Advisor. I can help you monitor live crowd stats, track incidents, manage dispatch schedules, and analyze sustainability metrics. Ask me about 'incidents', 'crowd levels', 'staff availability', or 'sustainability'.";
  } else {
    // FAN PORTAL FALLBACK RESPONSES
    if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
      return "Hello! Welcome to MetLife Stadium for the FIFA World Cup 2026. How can I help you navigate the arena today?";
    }
    if (msg.includes("gate") || msg.includes("entry") || msg.includes("entrance")) {
      if (msg.includes("a")) return "Gate A is located in the North-East corner. It features the main Fan Zone. Current security queue wait time: " + simulationState.telemetry.queueWaitTimes["Gate A"] + " minutes.";
      if (msg.includes("b")) return "Gate B is in the North-West corner. It hosts the Sustainability Pavilion and our Sensory Room access. Queue time: " + simulationState.telemetry.queueWaitTimes["Gate B"] + " minutes.";
      if (msg.includes("c")) return "Gate C is on the South-West side. It connects directly to the Rideshare Zone in Lot E. Queue time: " + simulationState.telemetry.queueWaitTimes["Gate C"] + " minutes.";
      if (msg.includes("d")) return "Gate D is the South-East entrance, primarily for VIPs, media, and hospitality packages. Queue time: " + simulationState.telemetry.queueWaitTimes["Gate D"] + " minutes.";
      return "MetLife Stadium has four main entrances: Gate A (North-East), Gate B (North-West, sensory accessible), Gate C (South-West, rideshare drop-off), and Gate D (South-East, VIP/Media). Gate D currently has the shortest lines (" + simulationState.telemetry.queueWaitTimes["Gate D"] + " min wait).";
    }
    if (msg.includes("wheelchair") || msg.includes("accessible") || msg.includes("accessibility") || msg.includes("handicap") || msg.includes("ramp") || msg.includes("elevator")) {
      return "All gates have wheelchair access. Gate B has direct access to the main elevator core and the Accessibility Assistance Desk. Standard wayfinding can be toggled to 'Accessible Route' on your dynamic map to view step-free paths, elevators, and ramps.";
    }
    if (msg.includes("sensory") || msg.includes("quiet") || msg.includes("autism") || msg.includes("calm")) {
      return "Our sensory-inclusive quiet room is located at Section 102 (just inside Gate B). You can borrow noise-canceling headphones, weighted lap pads, and sensory bags at the Accessibility Desk nearby.";
    }
    if (msg.includes("food") || msg.includes("eat") || msg.includes("drink") || msg.includes("concession") || msg.includes("vegan") || msg.includes("vegetarian")) {
      if (msg.includes("vegan") || msg.includes("vegetarian") || msg.includes("sustain") || msg.includes("green")) {
        return "You can find delicious sustainable food options at the 'Green Pitch Concourse' (located at Sections 104 and 128), offering 100% plant-based burgers, dogs, and local salads in compostable bowls.";
      }
      return "We offer diverse options! Check out 'Jersey Classic Eats' (Sec 112, 140) for local favorites, 'World Flavors Express' (Sec 120, 205) for Halal, Kosher, and Sushi. To reduce plastic waste, use our free water refill stations at any section entrance with a souvenir cup!";
    }
    if (msg.includes("water") || msg.includes("refill") || msg.includes("hydration")) {
      return "Free chilled water hydration stations are located at every section entrance. Bring your souvenir cup or any reusable bottle (under 20oz, plastic only) to refill for free and support our zero-waste tournament initiative.";
    }
    if (msg.includes("transit") || msg.includes("train") || msg.includes("bus") || msg.includes("rail") || msg.includes("shuttle") || msg.includes("rideshare") || msg.includes("taxi")) {
      if (msg.includes("train") || msg.includes("rail") || msg.includes("nj transit")) {
        return "NJ Transit trains connect MetLife Stadium to Secaucus Junction. Trains run every 6-10 minutes after the match. Follow signs to the rail terminal outside Gate A.";
      }
      if (msg.includes("rideshare") || msg.includes("uber") || msg.includes("lyft")) {
        return "Rideshare pickups (Uber/Lyft) are strictly zone-restricted to Lot E outside Gate C. To avoid surge times, check out our Eco-Shuttle bus or light rail stations near Gate A.";
      }
      return "Eco-shuttles run continuously between parking lots (Lot P and K) and Gates A & B. For New York City connections, follow the signs to the Light Rail terminal outside Gate A. Estimated transit queues are visible on the Transit tab.";
    }
    if (msg.includes("medical") || msg.includes("first aid") || msg.includes("hurt") || msg.includes("emergency")) {
      return "For medical assistance, visit the nearest First Aid Station at Sections 109, 131, 227, or 312. Or report to any volunteer/staff member immediately. If this is an life-threatening emergency, please contact 911 or speak to stadium security.";
    }
    return "I'm the ArenaIQ Fan Concierge. I can guide you on gate wait times, accessibility services (wheelchair routes and sensory rooms), local sustainable food options, and light rail/rideshare details. Try asking: 'Which gate has sensory rooms?', 'Where can I refill my water?', or 'How do I get to the light rail train?'";
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` ArenaIQ Stadium Operations Hub Server Running!`);
  console.log(` Port:    http://localhost:${PORT}`);
  console.log(` Mode:    FIFA World Cup 2026 Live Telemetry`);
  console.log(`==================================================`);
});
