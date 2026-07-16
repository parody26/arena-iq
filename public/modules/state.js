/**
 * public/modules/state.js
 * =======================
 * Shared application state and static config presets for wayfinding & scoreboards.
 */

export const appState = {
  currentTab: 'dashboard',
  routeStart: 'gate-a',
  routeEnd: 'select',
  routeType: 'std', // std or acc
  stadium: 'metlife',
  staffLoggedIn: false,
  staffToken: null,  // in-memory only, never persisted to localStorage
  bottlesSavedCounter: 42930,
  chartsInitialized: false,
  loadedEventState: '',
  streamEvents: []
};

// Coordinates for staff dispatch marker points on the map
export const LOCATION_MAP_COORDS = {
  "Gate A": { cx: 380, cy: 90 },
  "Gate B": { cx: 120, cy: 90 },
  "Gate C": { cx: 120, cy: 310 },
  "Gate D": { cx: 380, cy: 310 },
  "Section 104 Eco-Stalls": { cx: 355, cy: 160 },
  "Gate B Security Queues": { cx: 120, cy: 90 },
  "Gate B Entrance": { cx: 120, cy: 90 },
  "Gate C Food Trucks Plaza": { cx: 145, cy: 240 },
  "West Concourse Concessions": { cx: 145, cy: 200 },
  "Section 218 Accessibility Ramp": { cx: 210, cy: 305 },
  "Gate A Light Rail Station": { cx: 380, cy: 90 }
};

// Eco Dining presets by matchState
export const ECO_DINING_PRESETS = {
  "Pre-match": "🌱 <strong>GenAI Pre-Match Dining Advisory:</strong> Heading into MetLife Arena early? Concession stalls at Section 104 & Section 128 (Green Pitch Concourse) are now serving plant-based meals in 100% compostable packaging. Hydration wait lines are currently empty.",
  "Kick-off": "⚽ <strong>GenAI Play-Time Dining Advisory:</strong> Match is underway! Concession lines are at their lowest. If you're feeling hungry, Jersey Classic Eats Sec 112 has quick-grab snacks in zero-plastic containers.",
  "Half-time": "🥤 <strong>GenAI Half-Time Congestion Advisory:</strong> Concourse traffic is heavy near Section 120. We suggest refilling water bottles at the hydration points outside Section 109, which currently has zero queues.",
  "Second-half": "🥗 <strong>GenAI Game-Time Dining Advisory:</strong> Sustainable concessions (Zero Waste Hydration Hubs) are fully stocked. Zero waiting time at World Flavors Section 205.",
  "Post-match": "🚉 <strong>GenAI Post-Match Directives:</strong> Transit lines are currently loading. Fans leaving Gates A and B are advised to grab eco-transit nj trains to avoid the Lot E rideshare surge wait time (35+ minutes)."
};

// Scoreboard updates by matchState
export const SCOREBOARD_PRESETS = {
  "Pre-match": { score: "0 - 0", status: "Pre-Match Warmups (USA vs ENG)" },
  "Kick-off": { score: "0 - 0", status: "1st Half - Live 18'" },
  "Half-time": { score: "1 - 0", status: "Half-Time Interval (USA leading)" },
  "Second-half": { score: "1 - 1", status: "2nd Half - Live 72'" },
  "Post-match": { score: "2 - 1", status: "Full Time - USA Win (Group Stage)" }
};

// Stream Event templates grouped by state to feed the timeline
export const STREAM_TIMELINE_PRESETS = {
  "Pre-match": [
    { type: "alert-event", text: "Welcome to MetLife Stadium! Pre-match security gates are open. Clear bags only." },
    { type: "eco-event", text: "Zero-waste hydration hubs initialized. Scan your souvenir cup for eco points!" },
    { type: "match-event", text: "Team lineups announced: USA starts Pulisic, Balogun, McKennie. ENG starts Kane, Saka, Bellingham." }
  ],
  "Kick-off": [
    { type: "match-event", text: "01' - Kickoff! USA vs England is officially underway." },
    { type: "eco-event", text: "Utility check: Stadium is currently drawing 38% power from the local solar array grid." },
    { type: "match-event", text: "15' - High intensity play! McKennie fires a volley wide from a Pulisic corner." }
  ],
  "Half-time": [
    { type: "match-event", text: "45' - Halftime whistle! USA leads England 1-0 thanks to McKennie's header." },
    { type: "eco-event", text: "Concourse alert: Green Concourse Section 104 has compostable cup recycling bins ready." },
    { type: "alert-event", text: "Transit alert: Light Rail trains are ready for boarding immediately post-match at Gate A." }
  ],
  "Second-half": [
    { type: "match-event", text: "46' - Second half gets underway. England makes no substitutions." },
    { type: "match-event", text: "68' - GOAL! Harry Kane equalizes with a powerful header. USA 1 - 1 England." },
    { type: "alert-event", text: "Gate C crowd bottleneck detected. Staff redirecting oncoming fans to Gate B." }
  ],
  "Post-match": [
    { type: "match-event", text: "88' - GOAL! Folarin Balogun scores! USA leads 2-1!" },
    { type: "match-event", text: "90+4' - Full Time! USA secures a historic 2 - 1 victory over England!" },
    { type: "eco-event", text: "Green Goal! Over 42,900 single-use plastic bottles were saved during today's match." }
  ]
};

// Predefined point-by-point wayfinding directions
export const WAYFINDING_DIRECTIONS = {
  "gate-a": {
    "seat-104": {
      "std": [
        "Pass through the Gate A electronic security scanners.",
        "Walk past the main World Cup Fan Plaza and head right.",
        "Follow signs towards Section 101-110 concourse loop.",
        "Enter the seating bowl at the Section 104 portal on your left."
      ],
      "acc": [
        "Pass through Gate A and request wheelchair aid if needed at the assistance desk.",
        "Head left to the Level 1 Elevator Core.",
        "Take Elevator A up to the Concourse level.",
        "Use the step-free corridor directly to Section 104 ADA seating deck."
      ]
    }
  },
  "gate-b": {
    "sensory-102": {
      "std": [
        "Enter through Gate B scanners.",
        "Walk past the MetLife Sustainability Pavilion.",
        "The Quiet Sensory Room is directly ahead, next to Section 102."
      ],
      "acc": [
        "Enter through Gate B accessible queue lane.",
        "Head straight to the Sensory Room entry at Section 102 (no steps, direct entrance)."
      ]
    }
  },
  "gate-c": {
    "concessions-128": {
      "std": [
        "Enter through Gate C security turnstiles.",
        "Head left, past the Rideshare Lot shuttle drop-offs.",
        "Green Pitch Concourse concession stall is located at Section 128."
      ],
      "acc": [
        "Pass Gate C security checkpoints.",
        "Use the accessible ramp on the South concourse leading straight to Section 128."
      ]
    },
    "firstaid-109": {
      "std": [
        "Enter Gate C checkpoints.",
        "Walk past the South Concourse concession blocks.",
        "First Aid station is next to Section 109."
      ],
      "acc": [
        "Enter through Gate C accessible entrance.",
        "Take the Section 110 wheelchair ramp to the lower concourse level.",
        "The main First Aid and Medical desk is located next to Section 109."
      ]
    }
  }
};

/**
 * Escapes HTML characters to prevent XSS injection.
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
