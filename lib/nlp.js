'use strict';
/**
 * lib/nlp.js
 * ==========
 * High-fidelity local NLP fallback engine for the ArenaIQ chatbot.
 *
 * EFFICIENCY DESIGN: instead of a flat if/includes chain (O(n) per message),
 * we build two keyword→handler lookup Maps at module load time so each
 * incoming message only costs one .split() + one Map.get() per token — O(k)
 * where k = number of tokens in the message, not number of rules.
 */

const { simulationState } = require('./state');

// ---------------------------------------------------------------------------
// HANDLER FACTORY HELPERS  (called lazily at match-time so they always see
// the *current* simulation state, not a snapshot taken at module load).
// ---------------------------------------------------------------------------

const fanHandlers = {
  greeting()  {
    return 'Hello! Welcome to MetLife Stadium for the FIFA World Cup 2026. How can I help you navigate the arena today?';
  },
  gate(msg) {
    const wt = simulationState.telemetry.queueWaitTimes;
    if (msg.includes(' a') || msg.includes('gate a')) return `Gate A is located in the North-East corner. It features the main Fan Zone. Current security queue wait time: ${wt['Gate A']} minutes.`;
    if (msg.includes(' b') || msg.includes('gate b')) return `Gate B is in the North-West corner. It hosts the Sustainability Pavilion and our Sensory Room access. Queue time: ${wt['Gate B']} minutes.`;
    if (msg.includes(' c') || msg.includes('gate c')) return `Gate C is on the South-West side. It connects directly to the Rideshare Zone in Lot E. Queue time: ${wt['Gate C']} minutes.`;
    if (msg.includes(' d') || msg.includes('gate d')) return `Gate D is the South-East entrance, primarily for VIPs, media, and hospitality packages. Queue time: ${wt['Gate D']} minutes.`;
    return `MetLife Stadium has four main entrances: Gate A (North-East), Gate B (North-West, sensory accessible), Gate C (South-West, rideshare drop-off), and Gate D (South-East, VIP/Media). Gate D currently has the shortest lines (${wt['Gate D']} min wait).`;
  },
  accessibility() {
    return 'All gates have wheelchair access. Gate B has direct access to the main elevator core and the Accessibility Assistance Desk. Standard wayfinding can be toggled to \'Accessible Route\' on your dynamic map to view step-free paths, elevators, and ramps.';
  },
  sensory() {
    return 'Our sensory-inclusive quiet room is located at Section 102 (just inside Gate B). You can borrow noise-canceling headphones, weighted lap pads, and sensory bags at the Accessibility Desk nearby.';
  },
  food(msg) {
    if (msg.includes('vegan') || msg.includes('vegetarian') || msg.includes('sustain') || msg.includes('green')) {
      return "You can find delicious sustainable food options at the 'Green Pitch Concourse' (located at Sections 104 and 128), offering 100% plant-based burgers, dogs, and local salads in compostable bowls.";
    }
    return "We offer diverse options! Check out 'Jersey Classic Eats' (Sec 112, 140) for local favorites, 'World Flavors Express' (Sec 120, 205) for Halal, Kosher, and Sushi. To reduce plastic waste, use our free water refill stations at any section entrance with a souvenir cup!";
  },
  water() {
    return 'Free chilled water hydration stations are located at every section entrance. Bring your souvenir cup or any reusable bottle (under 20oz, plastic only) to refill for free and support our zero-waste tournament initiative.';
  },
  transit(msg) {
    if (msg.includes('train') || msg.includes('rail') || msg.includes('nj transit')) {
      return 'NJ Transit trains connect MetLife Stadium to Secaucus Junction. Trains run every 6-10 minutes after the match. Follow signs to the rail terminal outside Gate A.';
    }
    if (msg.includes('rideshare') || msg.includes('uber') || msg.includes('lyft')) {
      return 'Rideshare pickups (Uber/Lyft) are strictly zone-restricted to Lot E outside Gate C. To avoid surge times, check out our Eco-Shuttle bus or light rail stations near Gate A.';
    }
    return 'Eco-shuttles run continuously between parking lots (Lot P and K) and Gates A & B. For New York City connections, follow the signs to the Light Rail terminal outside Gate A. Estimated transit queues are visible on the Transit tab.';
  },
  medical() {
    return 'For medical assistance, visit the nearest First Aid Station at Sections 109, 131, 227, or 312. Or report to any volunteer/staff member immediately. If this is a life-threatening emergency, please contact 911 or speak to stadium security.';
  }
};

const operatorHandlers = {
  incident() {
    const active = simulationState.incidents.filter(i => i.status !== 'Resolved');
    if (active.length === 0) return 'All systems clear. No outstanding incidents are pending operations response.';
    return `There are currently ${active.length} active incident(s). The most critical is: "${active[0].description}" at ${active[0].location}. Recommended action: ${active[0].genaiRecommendation}`;
  },
  crowd() {
    const wt = simulationState.telemetry.queueWaitTimes;
    return `Crowd density is at ${simulationState.telemetry.crowdDensity}%. Gate entry queues: Gate A (${wt['Gate A']}m), Gate B (${wt['Gate B']}m), Gate C (${wt['Gate C']}m), Gate D (${wt['Gate D']}m). Recommended action: Keep Gate D open for VIP/Media bypass to reduce Gate A bottleneck.`;
  },
  volunteer() {
    const avail = simulationState.volunteers.filter(v => v.status === 'Available').length;
    const dispatched = simulationState.volunteers.filter(v => v.status !== 'Available').map(v => v.name).join(', ') || 'None';
    return `We have ${avail} volunteer units available out of ${simulationState.volunteers.length} total. Dispatched units: ${dispatched}. You can click the 'Authorize Response' button next to pending incidents to auto-dispatch them.`;
  },
  energy() {
    const { solarGeneration: sol, gridPower: grid, batteryStorage } = simulationState.telemetry.energyUsage;
    const bins = simulationState.telemetry.wasteBinCapacity;
    return `Sustainability update: Solar array producing ${sol}kW. Grid consumption: ${grid}kW. Battery bank capacity: ${batteryStorage}%. Smart waste bin capacity: Zone 1 (${bins.zone1}%), Zone 2 (${bins.zone2}%), Zone 3 (${bins.zone3}%), Zone 4 (${bins.zone4}%). Action item: Dispatch waste crews if any zone exceeds 85%.`;
  }
};

// ---------------------------------------------------------------------------
// KEYWORD → HANDLER  LOOKUP MAPS  (built once at module load, O(1) per token)
// ---------------------------------------------------------------------------

/** @type {Map<string, (msg: string) => string>} */
const FAN_MAP = new Map([
  // greeting
  ['hello',       (msg) => fanHandlers.greeting()],
  ['hi',          (msg) => fanHandlers.greeting()],
  ['hey',         (msg) => fanHandlers.greeting()],
  // gate / entry
  ['gate',        (msg) => fanHandlers.gate(msg)],
  ['entry',       (msg) => fanHandlers.gate(msg)],
  ['entrance',    (msg) => fanHandlers.gate(msg)],
  // accessibility
  ['wheelchair',  (msg) => fanHandlers.accessibility()],
  ['accessible',  (msg) => fanHandlers.accessibility()],
  ['accessibility',(msg) => fanHandlers.accessibility()],
  ['handicap',    (msg) => fanHandlers.accessibility()],
  ['ramp',        (msg) => fanHandlers.accessibility()],
  ['elevator',    (msg) => fanHandlers.accessibility()],
  // sensory
  ['sensory',     (msg) => fanHandlers.sensory()],
  ['quiet',       (msg) => fanHandlers.sensory()],
  ['autism',      (msg) => fanHandlers.sensory()],
  ['calm',        (msg) => fanHandlers.sensory()],
  // food
  ['food',        (msg) => fanHandlers.food(msg)],
  ['eat',         (msg) => fanHandlers.food(msg)],
  ['drink',       (msg) => fanHandlers.food(msg)],
  ['concession',  (msg) => fanHandlers.food(msg)],
  ['vegan',       (msg) => fanHandlers.food(msg)],
  ['vegetarian',  (msg) => fanHandlers.food(msg)],
  // water
  ['water',       (msg) => fanHandlers.water()],
  ['refill',      (msg) => fanHandlers.water()],
  ['hydration',   (msg) => fanHandlers.water()],
  // transit
  ['transit',     (msg) => fanHandlers.transit(msg)],
  ['train',       (msg) => fanHandlers.transit(msg)],
  ['bus',         (msg) => fanHandlers.transit(msg)],
  ['rail',        (msg) => fanHandlers.transit(msg)],
  ['shuttle',     (msg) => fanHandlers.transit(msg)],
  ['rideshare',   (msg) => fanHandlers.transit(msg)],
  ['taxi',        (msg) => fanHandlers.transit(msg)],
  ['uber',        (msg) => fanHandlers.transit(msg)],
  ['lyft',        (msg) => fanHandlers.transit(msg)],
  // medical
  ['medical',     (msg) => fanHandlers.medical()],
  ['first',       (msg) => fanHandlers.medical()],   // 'first aid'
  ['hurt',        (msg) => fanHandlers.medical()],
  ['emergency',   (msg) => fanHandlers.medical()]
]);

/** @type {Map<string, (msg: string) => string>} */
const OPERATOR_MAP = new Map([
  ['incident',     (msg) => operatorHandlers.incident()],
  ['alert',        (msg) => operatorHandlers.incident()],
  ['crowd',        (msg) => operatorHandlers.crowd()],
  ['density',      (msg) => operatorHandlers.crowd()],
  ['gate',         (msg) => operatorHandlers.crowd()],
  ['volunteer',    (msg) => operatorHandlers.volunteer()],
  ['staff',        (msg) => operatorHandlers.volunteer()],
  ['dispatch',     (msg) => operatorHandlers.volunteer()],
  ['energy',       (msg) => operatorHandlers.energy()],
  ['solar',        (msg) => operatorHandlers.energy()],
  ['sustainability',(msg) => operatorHandlers.energy()],
  ['waste',        (msg) => operatorHandlers.energy()]
]);

// ---------------------------------------------------------------------------
// MAIN EXPORT
// ---------------------------------------------------------------------------

/**
 * handleLocalNLP
 * Tokenises the message and does a single Map lookup per token.
 * First matching token wins (priority follows insertion order in the Map).
 *
 * @param {string}  message    - pre-cleaned (no HTML tags), original casing OK
 * @param {boolean} isOperator - true for staff portal, false for fan chat
 * @returns {string} response text
 */
function handleLocalNLP(message, isOperator) {
  const msg    = message.toLowerCase();
  const lookup = isOperator ? OPERATOR_MAP : FAN_MAP;

  for (const [key, handler] of lookup) {
    if (msg.includes(key)) {
      return handler(msg);
    }
  }

  // Default fallback
  return isOperator
    ? 'I am the ArenaIQ Operations Advisor. I can help you monitor live crowd stats, track incidents, manage dispatch schedules, and analyze sustainability metrics. Ask me about \'incidents\', \'crowd levels\', \'staff availability\', or \'sustainability\'.'
    : 'I\'m the ArenaIQ Fan Concierge. I can guide you on gate wait times, accessibility services (wheelchair routes and sensory rooms), local sustainable food options, and light rail/rideshare details. Try asking: \'Which gate has sensory rooms?\', \'Where can I refill my water?\', or \'How do I get to the light rail train?\'';
}

module.exports = { handleLocalNLP, FAN_MAP, OPERATOR_MAP };
