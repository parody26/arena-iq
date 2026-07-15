/* ==========================================================================
   ARENAIQ FRONTEND JAVASCRIPT (SIDEBAR TABS EDITION - INTERACTIVE UPDATE)
   FIFA World Cup 2026 Stadium Operations & Fan Portal Logic
   Handles SSE Telemetry Streams, Tab Switching, Password Locks, Scoreboards,
   Written Directions lists, Event Streams, and Sustainability Charts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. SELECTORS & DOM ELEMENTS
  // ==========================================
  
  // Left Sidebar Tab Navigation
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const sidebarMatchBadge = document.getElementById('sidebar-match-badge');

  // Simulation Controls (Sidebar)
  const simTimeDisplay = document.getElementById('sim-time');
  const simStateSelect = document.getElementById('sim-state-select');
  const speedBtns = document.querySelectorAll('.speed-btn');
  const stadiumSelect = document.getElementById('stadium-select');

  // Dashboard Tab Elements
  const dbDensity = document.getElementById('db-density');
  const dbDensityBar = document.getElementById('db-density-bar');
  const dbDensitySub = document.getElementById('db-density-sub');
  const dbConcessionWait = document.getElementById('db-concession-wait');
  const dbConcessionBar = document.getElementById('db-concession-bar');
  const dbTransitWait = document.getElementById('db-transit-wait');
  const dbIncidents = document.getElementById('db-incidents');
  const dbIncidentsSub = document.getElementById('db-incidents-sub');
  const dbSolarRatio = document.getElementById('db-solar-ratio');
  const dbSolarBar = document.getElementById('db-solar-bar');
  const dbWasteAvg = document.getElementById('db-waste-avg');
  const dbWasteBar = document.getElementById('db-waste-bar');
  const dbWaterRate = document.getElementById('db-water-rate');
  const dbBottlesSaved = document.getElementById('db-bottles-saved');
  const scoreboardDigits = document.getElementById('scoreboard-digits');
  const scoreboardStatus = document.getElementById('scoreboard-status');
  const ecoDiningRecommendationPage = document.getElementById('eco-dining-recommendation-page');
  const dbEventStream = document.getElementById('db-event-stream');

  // Wayfinder Tab Elements
  const navStart = document.getElementById('nav-start');
  const navEnd = document.getElementById('nav-end');
  const btnRouteStd = document.getElementById('route-type-standard');
  const btnRouteAcc = document.getElementById('route-type-accessible');
  const stadiumSvg = document.getElementById('stadium-svg');
  const staffMarker = document.getElementById('dispatched-staff-marker');
  const routeDirectionsList = document.getElementById('route-directions-list');
  const routeDirectionsPlaceholder = document.getElementById('route-directions-placeholder');

  // Sustainability Tab Elements
  const diningRecommendation = document.getElementById('eco-dining-recommendation-page');
  const waitRail = document.getElementById('transit-wait-rail');
  const waitShuttle = document.getElementById('transit-wait-shuttle');
  const waitRideshare = document.getElementById('transit-wait-rideshare');

  // Staff Portal Login/Lock Elements
  const staffLockScreen = document.getElementById('staff-lock-screen');
  const staffUnlockedDashboard = document.getElementById('staff-unlocked-dashboard');
  const staffLoginForm = document.getElementById('staff-login-form');
  const staffPasswordInput = document.getElementById('staff-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnStaffLogout = document.getElementById('btn-staff-logout');

  // Operations Feeds (Unlocked Staff View)
  const incidentsFeed = document.getElementById('incidents-feed');
  const volunteerList = document.getElementById('volunteer-list');

  // Chatbot Elements
  const fanChatForm = document.getElementById('fan-chat-form');
  const fanChatInput = document.getElementById('fan-chat-input');
  const fanChatHistory = document.getElementById('fan-chat-history');
  const fanAiBadge = document.getElementById('chat-ai-badge');
  const fanSuggestBtns = document.querySelectorAll('.suggest-btn');

  const operatorChatForm = document.getElementById('operator-chat-form');
  const operatorChatInput = document.getElementById('operator-chat-input');
  const operatorChatHistory = document.getElementById('operator-chat-history');
  const operatorAiBadge = document.getElementById('operator-ai-badge');
  const operatorSuggestBtns = document.querySelectorAll('.suggest-op-btn');

  // ==========================================
  // 2. STATE CONFIGURATION
  // ==========================================
  let appState = {
    currentTab: 'dashboard',
    routeStart: 'gate-a',
    routeEnd: 'select',
    routeType: 'std', // std or acc
    stadium: 'metlife',
    staffLoggedIn: false,
    bottlesSavedCounter: 42930,
    chartsInitialized: false,
    loadedEventState: '',
    streamEvents: []
  };

  // Coordinates for staff dispatch marker points on the map
  const LOCATION_MAP_COORDS = {
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
  const ECO_DINING_PRESETS = {
    "Pre-match": "🌱 <strong>GenAI Pre-Match Dining Advisory:</strong> Heading into MetLife Arena early? Concession stalls at Section 104 & Section 128 (Green Pitch Concourse) are now serving plant-based meals in 100% compostable packaging. Hydration wait lines are currently empty.",
    "Kick-off": "⚽ <strong>GenAI Play-Time Dining Advisory:</strong> Match is underway! Concession lines are at their lowest. If you're feeling hungry, Jersey Classic Eats Sec 112 has quick-grab snacks in zero-plastic containers.",
    "Half-time": "🥤 <strong>GenAI Half-Time Congestion Advisory:</strong> Concourse traffic is heavy near Section 120. We suggest refilling water bottles at the hydration points outside Section 109, which currently has zero queues.",
    "Second-half": "🥗 <strong>GenAI Game-Time Dining Advisory:</strong> Sustainable concessions (Zero Waste Hydration Hubs) are fully stocked. Zero waiting time at World Flavors Section 205.",
    "Post-match": "🚉 <strong>GenAI Post-Match Directives:</strong> Transit lines are currently loading. Fans leaving Gates A and B are advised to grab eco-transit nj trains to avoid the Lot E rideshare surge wait time (35+ minutes)."
  };

  // Scoreboard updates by matchState
  const SCOREBOARD_PRESETS = {
    "Pre-match": { score: "0 - 0", status: "Pre-Match Warmups (USA vs ENG)" },
    "Kick-off": { score: "0 - 0", status: "1st Half - Live 18'" },
    "Half-time": { score: "1 - 0", status: "Half-Time Interval (USA leading)" },
    "Second-half": { score: "1 - 1", status: "2nd Half - Live 72'" },
    "Post-match": { score: "2 - 1", status: "Full Time - USA Win (Group Stage)" }
  };

  // Stream Event templates grouped by state to feed the timeline
  const STREAM_TIMELINE_PRESETS = {
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
  const WAYFINDING_DIRECTIONS = {
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
          "Enter through Gate B ADA access ramp.",
          "Head directly past the Accessibility Desk.",
          "The Quiet Sensory Room is 15 meters ahead on your left next to Section 102."
        ]
      },
      "restroom-117": {
        "std": [
          "Enter through Gate B scanners.",
          "Head right (clockwise) along the main concourse corridor.",
          "Restrooms are located on the outer wall near Section 117."
        ],
        "acc": [
          "Enter through Gate B ADA ramp.",
          "Follow the wheelchair assistance guides along the concourse corridor.",
          "Accessible family-friendly bathrooms are situated past Section 117 on your right."
        ]
      }
    },
    "gate-c": {
      "concessions-128": {
        "std": [
          "Enter through Gate C turnstiles.",
          "Turn right past the Rideshare drop-off info deck.",
          "Green Pitch Concourse concessions are located adjacent to Section 128."
        ],
        "acc": [
          "Enter through Gate C accessible gates.",
          "Proceed along the main step-free concourse path.",
          "Green Pitch Concourse stalls (ADA heights) are adjacent to Section 128."
        ]
      },
      "firstaid-109": {
        "std": [
          "Enter through Gate C turnstiles.",
          "Walk past the Food Trucks Plaza towards the inner loop.",
          "Follow the First Aid symbols to Section 109."
        ],
        "acc": [
          "Enter through Gate C accessible entrance.",
          "Take the Section 110 wheelchair ramp to the lower concourse level.",
          "The main First Aid and Medical desk is located next to Section 109."
        ]
      }
    }
  };

  // ==========================================
  // 3. INITIALIZE CHARTS (Chart.js)
  // ==========================================
  let gateChartInstance = null;
  let wasteChartInstance = null;
  let ecoChartInstance = null;

  function initializeCharts() {
    if (appState.chartsInitialized) return;
    
    const canvasGate = document.getElementById('chart-gate-waits');
    const canvasWaste = document.getElementById('chart-waste-levels');
    const canvasEco = document.getElementById('chart-eco-diversion');
    
    // Gate wait charts (Staff View)
    if (canvasGate && canvasWaste) {
      const ctxGate = canvasGate.getContext('2d');
      const ctxWaste = canvasWaste.getContext('2d');

      gateChartInstance = new Chart(ctxGate, {
        type: 'bar',
        data: {
          labels: ['Gate A', 'Gate B', 'Gate C', 'Gate D', 'Concessions', 'Restrooms'],
          datasets: [{
            label: 'Minutes Wait',
            data: [8, 12, 5, 2, 10, 6],
            backgroundColor: [
              'rgba(0, 176, 255, 0.4)',
              'rgba(0, 176, 255, 0.4)',
              'rgba(0, 176, 255, 0.4)',
              'rgba(0, 176, 255, 0.4)',
              'rgba(0, 230, 118, 0.4)',
              'rgba(255, 196, 0, 0.4)'
            ],
            borderColor: [
              '#00b0ff',
              '#00b0ff',
              '#00b0ff',
              '#00b0ff',
              '#00e676',
              '#ffc400'
            ],
            borderWidth: 1.5,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#8a99ad', font: { family: 'Orbitron', size: 9 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#c3d1e4', font: { family: 'Plus Jakarta Sans', size: 10, weight: 'bold' } }
            }
          }
        }
      });

      wasteChartInstance = new Chart(ctxWaste, {
        type: 'bar',
        data: {
          labels: ['Zone 1 (N)', 'Zone 2 (W)', 'Zone 3 (S)', 'Zone 4 (E)'],
          datasets: [{
            label: 'Waste Level %',
            data: [30, 25, 40, 15],
            backgroundColor: 'rgba(0, 230, 118, 0.2)',
            borderColor: '#00e676',
            borderWidth: 1.5,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#c3d1e4', font: { family: 'Plus Jakarta Sans', size: 9, weight: 'bold' } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#8a99ad', font: { family: 'Orbitron', size: 9 } },
              max: 100
            }
          }
        }
      });
    }

    // Eco Chart (Public Eco Tab - always loaded)
    if (canvasEco) {
      const ctxEco = canvasEco.getContext('2d');
      ecoChartInstance = new Chart(ctxEco, {
        type: 'doughnut',
        data: {
          labels: ['Recycled Diverted', 'Composted Waste', 'Landfill Trash'],
          datasets: [{
            data: [45, 35, 20],
            backgroundColor: [
              'rgba(0, 230, 118, 0.5)', // Recycled (Green)
              'rgba(0, 176, 255, 0.5)', // Compost (Blue)
              'rgba(255, 23, 68, 0.5)'   // Landfill (Red)
            ],
            borderColor: [
              '#00e676',
              '#00b0ff',
              '#ff1744'
            ],
            borderWidth: 1.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#c3d1e4',
                font: { family: 'Plus Jakarta Sans', size: 10, weight: 'bold' }
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    appState.chartsInitialized = true;
  }

  // ==========================================
  // 4. TAB NAVIGATION CONTROLLER
  // ==========================================
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    appState.currentTab = tabId;

    // Special handling for staff portal lock state
    if (tabId === 'staff-portal') {
      if (appState.staffLoggedIn) {
        staffLockScreen.classList.add('hidden');
        staffUnlockedDashboard.classList.remove('hidden');
        setTimeout(initializeCharts, 100);
      } else {
        staffLockScreen.classList.remove('hidden');
        staffUnlockedDashboard.classList.add('hidden');
        staffPasswordInput.focus();
      }
    }
  }

  // ==========================================
  // 5. STAFF PASSWORD VERIFICATION & LOGOUT
  // ==========================================
  
  staffLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPassword = staffPasswordInput.value;
    
    if (enteredPassword === 'fifa2026') {
      appState.staffLoggedIn = true;
      loginErrorMsg.classList.add('hidden');
      staffPasswordInput.value = '';
      
      staffLockScreen.classList.add('hidden');
      staffUnlockedDashboard.classList.remove('hidden');
      
      setTimeout(initializeCharts, 100);
    } else {
      loginErrorMsg.classList.remove('hidden');
      staffPasswordInput.classList.add('error-shake');
      setTimeout(() => staffPasswordInput.classList.remove('error-shake'), 400);
      staffPasswordInput.value = '';
      staffPasswordInput.focus();
    }
  });

  btnStaffLogout.addEventListener('click', () => {
    appState.staffLoggedIn = false;
    staffUnlockedDashboard.classList.add('hidden');
    staffLockScreen.classList.remove('hidden');
    loginErrorMsg.classList.add('hidden');
    staffPasswordInput.focus();
  });

  // ==========================================
  // 6. CONNECT TO SERVER LIVE TELEMETRY (SSE)
  // ==========================================
  let eventSource = null;

  function connectToLiveData() {
    eventSource = new EventSource('/api/live-data');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateTelemetryUI(data);
    };

    eventSource.onerror = (err) => {
      console.warn("SSE connection error. Retrying in 5 seconds...");
      eventSource.close();
      setTimeout(connectToLiveData, 5000);
    };
  }

  function updateTelemetryUI(data) {
    // 1. Live clocks & scoreboard updates
    simTimeDisplay.textContent = data.timestamp;
    sidebarMatchBadge.textContent = data.matchState;
    
    // Update scoreboard
    const scoreInfo = SCOREBOARD_PRESETS[data.matchState] || SCOREBOARD_PRESETS["Pre-match"];
    scoreboardDigits.textContent = scoreInfo.score;
    scoreboardStatus.textContent = scoreInfo.status;

    // Increment carbon savings counter tick
    appState.bottlesSavedCounter += Math.floor(Math.random() * 3) + 1;
    dbBottlesSaved.textContent = appState.bottlesSavedCounter.toLocaleString();

    // Event Stream timeline updater
    updateEventStream(data);

    // Sync match state dropdown select
    if (document.activeElement !== simStateSelect) {
      simStateSelect.value = data.matchState;
    }

    // Sync speed buttons
    speedBtns.forEach(btn => {
      if (Number(btn.dataset.speed) === data.simulationSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const tel = data.telemetry;

    // 2. Main Dashboard Panel Updates
    dbDensity.textContent = `${tel.crowdDensity}%`;
    dbDensityBar.style.width = `${tel.crowdDensity}%`;
    dbDensitySub.textContent = `${Math.floor(82500 * (tel.crowdDensity / 100))} / 82,500 seats filled`;

    const avgWait = tel.queueWaitTimes.Concessions;
    dbConcessionWait.textContent = `${avgWait} mins`;
    dbConcessionBar.style.width = `${(avgWait / 25) * 100}%`;

    dbTransitWait.textContent = `${tel.queueWaitTimes["Gate A"]} mins`;

    const activeIncidents = data.incidents.filter(i => i.status !== "Resolved");
    dbIncidents.textContent = activeIncidents.length;
    dbIncidentsSub.textContent = activeIncidents.length > 0 
      ? `${activeIncidents.length} security alerts pending`
      : "All stadium systems green";

    const solar = tel.energyUsage.solarGeneration;
    const grid = tel.energyUsage.gridPower;
    const solarRatio = ((solar / (solar + grid)) * 100).toFixed(1);
    dbSolarRatio.textContent = `${solarRatio}%`;
    dbSolarBar.style.width = `${solarRatio}%`;

    const wasteAvgValue = Math.floor((tel.wasteBinCapacity.zone1 + tel.wasteBinCapacity.zone2 + tel.wasteBinCapacity.zone3 + tel.wasteBinCapacity.zone4) / 4);
    dbWasteAvg.textContent = `${wasteAvgValue}%`;
    dbWasteBar.style.width = `${wasteAvgValue}%`;

    dbWaterRate.textContent = `${tel.waterFlow.rate} gal/min`;

    // Concession eco tip sync
    const ecoText = ECO_DINING_PRESETS[data.matchState] || ECO_DINING_PRESETS["Pre-match"];
    ecoDiningRecommendationPage.innerHTML = ecoText;

    // 3. Sustainability Tab UI Updates
    if (data.matchState === "Post-match") {
      waitRail.textContent = "12 mins";
      waitShuttle.textContent = "5 mins";
      waitRideshare.textContent = "38 mins";
      waitRideshare.className = "stat-value text-accent-red";
    } else {
      waitRail.textContent = `${tel.queueWaitTimes["Gate A"]} mins`;
      waitShuttle.textContent = `${Math.max(2, Math.floor(tel.queueWaitTimes["Gate B"] / 3))} mins`;
      waitRideshare.textContent = `${Math.max(5, tel.queueWaitTimes["Gate C"] * 2)} mins`;
      waitRideshare.className = waitRideshare.textContent.startsWith("1") || waitRideshare.textContent.startsWith("2")
        ? "stat-value text-accent-yellow" : "stat-value text-accent-green";
    }

    // Refresh Doughnut chart slightly to show live updates
    if (ecoChartInstance) {
      // Divert composition shift based on waste fill levels
      const recycledPct = Math.max(35, 55 - Math.floor(wasteAvgValue / 3));
      const compostPct = Math.max(25, 45 - Math.floor(wasteAvgValue / 4));
      const landfillPct = 100 - recycledPct - compostPct;
      
      ecoChartInstance.data.datasets[0].data = [recycledPct, compostPct, landfillPct];
      ecoChartInstance.update();
    }

    // 4. Staff Unlocked Views Updates
    if (appState.staffLoggedIn && appState.currentTab === 'staff-portal') {
      renderIncidents(data.incidents);
      renderVolunteers(data.volunteers);

      if (gateChartInstance && wasteChartInstance) {
        gateChartInstance.data.datasets[0].data = [
          tel.queueWaitTimes["Gate A"],
          tel.queueWaitTimes["Gate B"],
          tel.queueWaitTimes["Gate C"],
          tel.queueWaitTimes["Gate D"],
          tel.queueWaitTimes.Concessions,
          tel.queueWaitTimes.Restrooms
        ];
        gateChartInstance.update();

        wasteChartInstance.data.datasets[0].data = [
          tel.wasteBinCapacity.zone1,
          tel.wasteBinCapacity.zone2,
          tel.wasteBinCapacity.zone3,
          tel.wasteBinCapacity.zone4
        ];
        wasteChartInstance.data.datasets[0].backgroundColor = [
          tel.wasteBinCapacity.zone1 > 80 ? 'rgba(255, 23, 68, 0.4)' : tel.wasteBinCapacity.zone1 > 50 ? 'rgba(255, 196, 0, 0.4)' : 'rgba(0, 230, 118, 0.4)',
          tel.wasteBinCapacity.zone2 > 80 ? 'rgba(255, 23, 68, 0.4)' : tel.wasteBinCapacity.zone2 > 50 ? 'rgba(255, 196, 0, 0.4)' : 'rgba(0, 230, 118, 0.4)',
          tel.wasteBinCapacity.zone3 > 80 ? 'rgba(255, 23, 68, 0.4)' : tel.wasteBinCapacity.zone3 > 50 ? 'rgba(255, 196, 0, 0.4)' : 'rgba(0, 230, 118, 0.4)',
          tel.wasteBinCapacity.zone4 > 80 ? 'rgba(255, 23, 68, 0.4)' : tel.wasteBinCapacity.zone4 > 50 ? 'rgba(255, 196, 0, 0.4)' : 'rgba(0, 230, 118, 0.4)'
        ];
        wasteChartInstance.data.datasets[0].borderColor = [
          tel.wasteBinCapacity.zone1 > 80 ? '#ff1744' : tel.wasteBinCapacity.zone1 > 50 ? '#ffc400' : '#00e676',
          tel.wasteBinCapacity.zone2 > 80 ? '#ff1744' : tel.wasteBinCapacity.zone2 > 50 ? '#ffc400' : '#00e676',
          tel.wasteBinCapacity.zone3 > 80 ? '#ff1744' : tel.wasteBinCapacity.zone3 > 50 ? '#ffc400' : '#00e676',
          tel.wasteBinCapacity.zone4 > 80 ? '#ff1744' : tel.wasteBinCapacity.zone4 > 50 ? '#ffc400' : '#00e676'
        ];
        wasteChartInstance.update();
      }
    }

    // 5. Update Map Dispatch Markers
    const activeDispatches = data.incidents.find(i => i.status === "Resolving");
    if (activeDispatches && LOCATION_MAP_COORDS[activeDispatches.location]) {
      const coord = LOCATION_MAP_COORDS[activeDispatches.location];
      staffMarker.querySelector('.staff-pulse-circle').setAttribute('cx', coord.cx);
      staffMarker.querySelector('.staff-pulse-circle').setAttribute('cy', coord.cy);
      staffMarker.querySelector('.staff-inner-circle').setAttribute('cx', coord.cx);
      staffMarker.querySelector('.staff-inner-circle').setAttribute('cy', coord.cy);
      staffMarker.querySelector('.staff-icon').setAttribute('x', coord.cx);
      staffMarker.querySelector('.staff-icon').setAttribute('y', coord.cy + 3);
      staffMarker.classList.remove('hidden');
    } else {
      staffMarker.classList.add('hidden');
    }
  }

  // ==========================================
  // 6. LIVE EVENT STREAM TIMELINE GENERATOR
  // ==========================================

  function updateEventStream(data) {
    const currentState = data.matchState;
    
    // Only rebuild timeline if the matchState changes, to prevent resetting fan reading position
    if (appState.loadedEventState !== currentState) {
      appState.loadedEventState = currentState;
      appState.streamEvents = [...STREAM_TIMELINE_PRESETS[currentState]];
      
      renderEventStream();
    }

    // Randomly insert real-time alerts or game commentary into the rolling log occasionally
    if (Math.random() > 0.95 && appState.streamEvents.length < 8) {
      const liveHighlights = [
        { type: "match-event", text: "Match Update: Pulisic executes a nutmeg at the touchline, setting up a crossing opportunity!" },
        { type: "eco-event", text: "Sustainability Milestone: Section 128 compostable waste bin collection sorted successfully." },
        { type: "alert-event", text: "Operations Update: Staff elevator 3 reset. Fully operational for wheelchair routing." },
        { type: "match-event", text: "Match Highlight: Bellingham yellow-carded for a slide tackle on McKennie." }
      ];
      
      const newCommentary = liveHighlights[Math.floor(Math.random() * liveHighlights.length)];
      appState.streamEvents.unshift(newCommentary);
      
      // Keep list length under 7 items
      if (appState.streamEvents.length > 7) {
        appState.streamEvents.pop();
      }

      renderEventStream();
    }
  }

  function renderEventStream() {
    if (!dbEventStream) return;

    if (appState.streamEvents.length === 0) {
      dbEventStream.innerHTML = '<p class="no-stream-text">Listening for live stadium telemetry events...</p>';
      return;
    }

    let html = '';
    appState.streamEvents.forEach(evt => {
      let icon = '<i class="fa-solid fa-gamepad"></i>';
      if (evt.type === 'alert-event') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
      if (evt.type === 'eco-event') icon = '<i class="fa-solid fa-seedling"></i>';
      
      const eventTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      html += `
        <div class="stream-item ${evt.type}">
          <span class="stream-time">${eventTime}</span>
          <span class="stream-content">${icon} ${evt.text}</span>
        </div>
      `;
    });
    dbEventStream.innerHTML = html;
  }

  // ==========================================
  // 7. RENDER OPERATIONS INCIDENTS & STAFF
  // ==========================================

  function renderIncidents(incidents) {
    if (incidents.length === 0) {
      incidentsFeed.innerHTML = '<p class="no-incidents-text">Monitoring live sensor telemetry feeds for stadium incidents...</p>';
      return;
    }

    let html = '';
    incidents.forEach(inc => {
      const statusClass = `badge-${inc.status.toLowerCase()}`;
      const showAction = inc.status === "Pending";
      
      html += `
        <div class="incident-item severity-${inc.severity}">
          <div class="incident-meta">
            <span class="incident-loc"><i class="fa-solid fa-location-dot text-accent-red"></i> ${inc.location}</span>
            <span class="incident-time">${inc.timestamp}</span>
          </div>
          <div class="incident-desc">${inc.description}</div>
          
          <div class="incident-ai-rec-box">
            <p><strong><i class="fa-solid fa-robot"></i> ARENAIQ DECISION SUPPORT PLAN</strong>
            ${inc.genaiRecommendation}</p>
          </div>

          <div class="incident-actions">
            <span class="incident-badge ${statusClass}">${inc.status}</span>
            ${showAction 
              ? `<button class="resolve-btn" onclick="authorizeIncidentResponse('${inc.id}')"><i class="fa-solid fa-bolt"></i> Authorize AI Response</button>`
              : `<span class="assigned-staff-info"><i class="fa-solid fa-user-check text-accent-green"></i> Assigned: ${inc.volunteerAssigned}</span>`
            }
          </div>
        </div>
      `;
    });
    incidentsFeed.innerHTML = html;
  }

  // Window-level dispatch hook for incidents feed click
  window.authorizeIncidentResponse = function(incidentId) {
    fetch('/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log(`Dispatched response to incident: ${incidentId}`);
      } else {
        alert(data.message || "Failed to authorize response.");
      }
    })
    .catch(err => console.error("Error authorizing incident response:", err));
  };

  function renderVolunteers(volunteers) {
    let html = '';
    volunteers.forEach(v => {
      const statusClass = `status-${v.status}`;
      html += `
        <div class="volunteer-node">
          <div class="vol-name-group">
            <span class="vol-name">${v.name}</span>
            <span class="vol-loc"><i class="fa-solid fa-map-pin"></i> ${v.location}</span>
          </div>
          <span class="vol-status ${statusClass}">${v.status}</span>
        </div>
      `;
    });
    volunteerList.innerHTML = html;
  }

  // ==========================================
  // 8. SIMULATION STATE MESSAGING
  // ==========================================

  simStateSelect.addEventListener('change', (e) => {
    const matchState = e.target.value;
    fetch('/api/simulation/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchState })
    })
    .then(res => res.json())
    .catch(err => console.error("Error changing simulation state:", err));
  });

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = Number(btn.dataset.speed);
      fetch('/api/simulation/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationSpeed: speed })
      })
      .then(res => res.json())
      .catch(err => console.error("Error changing simulation speed:", err));
    });
  });

  stadiumSelect.addEventListener('change', (e) => {
    appState.stadium = e.target.value;
    alert(`Connected to live telemetry feed for ${e.target.options[e.target.selectedIndex].text}. Telemetry simulation calibrating...`);
  });

  // ==========================================
  // 9. WAYFINDING SVG MAP CONTROLLER (POINT LISTS)
  // ==========================================

  function drawRoute() {
    const start = navStart.value;
    const end = navEnd.value;
    const type = appState.routeType;

    // Reset paths
    const allPaths = stadiumSvg.querySelectorAll('.way-path');
    allPaths.forEach(p => p.classList.remove('active'));

    // Reset seating active highlights
    const allSeats = stadiumSvg.querySelectorAll('.seat-section');
    allSeats.forEach(s => s.classList.remove('active-target'));

    if (end === 'select') {
      routeDirectionsPlaceholder.classList.remove('hidden');
      routeDirectionsList.classList.add('hidden');
      routeDirectionsList.innerHTML = '';
      return;
    }

    // Retrieve written directions array
    let directionsSteps = [];
    
    if (WAYFINDING_DIRECTIONS[start] && WAYFINDING_DIRECTIONS[start][end]) {
      const routes = WAYFINDING_DIRECTIONS[start][end];
      directionsSteps = (Array.isArray(routes)) ? routes : routes[type];
    } else {
      // Dynamic friendly fallback directions generator
      const endLabel = navEnd.options[navEnd.selectedIndex].text;
      const startLabel = navStart.options[navStart.selectedIndex].text;
      
      if (type === 'acc') {
        directionsSteps = [
          `Clear security checks at your arrival node (${startLabel}).`,
          "Follow the glowing blue wheelchair icons along the flat ADA path.",
          `Take the nearest elevator to reach ${endLabel} seating area step-free.`,
          "Ask any nearby crew member wearing green vests if you need ramp escorts."
        ];
      } else {
        directionsSteps = [
          `Clear turnstiles at your arrival gate (${startLabel}).`,
          "Follow the green overhead directory signage along the concourse ring.",
          `Head straight to reach the entrance portal for ${endLabel}.`,
          "Present your digital ticket barcode to the usher at the portal gate."
        ];
      }
    }

    // Render list elements dynamically
    routeDirectionsPlaceholder.classList.add('hidden');
    routeDirectionsList.classList.remove('hidden');
    routeDirectionsList.innerHTML = '';

    directionsSteps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      routeDirectionsList.appendChild(li);
    });

    // Construct path lookup and highlight path in SVG
    let pathId = '';
    if (end === 'seat-104') {
      pathId = `path-gate-a-seat-104-${type}`;
      const seat104 = stadiumSvg.querySelector('.seat-section[data-section="104"]');
      if (seat104) seat104.classList.add('active-target');
    } else if (end === 'sensory-102') {
      pathId = 'path-gate-b-sensory-102';
      const seat102 = stadiumSvg.querySelector('.seat-section[data-section="102"]');
      if (seat102) seat102.classList.add('active-target');
    } else if (end === 'concessions-128') {
      pathId = 'path-gate-c-concessions-128';
      const seat128 = stadiumSvg.querySelector('.seat-section[data-section="128"]');
      if (seat128) seat128.classList.add('active-target');
    } else if (end === 'restroom-117') {
      pathId = 'path-gate-b-restroom-117';
    } else if (end === 'firstaid-109') {
      pathId = 'path-gate-c-firstaid-109';
    }

    const targetPath = stadiumSvg.getElementById(pathId);
    if (targetPath) {
      targetPath.classList.add('active');
    }
  }

  navStart.addEventListener('change', drawRoute);
  navEnd.addEventListener('change', drawRoute);

  btnRouteStd.addEventListener('click', () => {
    btnRouteStd.classList.add('active');
    btnRouteAcc.classList.remove('active');
    appState.routeType = 'std';
    drawRoute();
  });

  btnRouteAcc.addEventListener('click', () => {
    btnRouteAcc.classList.add('active');
    btnRouteStd.classList.remove('active');
    appState.routeType = 'acc';
    drawRoute();
  });

  // ==========================================
  // 10. CHATBOT CORE (MESSAGE PASSING)
  // ==========================================

  // Submit handler for Fan Concierge Chat
  fanChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = fanChatInput.value.trim();
    if (!query) return;

    appendMessage('user', query, fanChatHistory);
    fanChatInput.value = '';

    const typingEl = appendTypingIndicator(fanChatHistory);
    
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, userRole: 'fan' })
    })
    .then(res => res.json())
    .then(data => {
      typingEl.remove();
      appendMessage('bot', data.response, fanChatHistory, 'ArenaIQ Assistant');
      updateAiBadge(fanAiBadge, data.source);
    })
    .catch(err => {
      console.error(err);
      typingEl.remove();
      appendMessage('bot', "Apologies! My backend communications system is temporarily lagging. You can find general layout directories at Gates A and B.", fanChatHistory, 'ArenaIQ Assistant');
    });
  });

  // Submit handler for Operator Chat
  operatorChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = operatorChatInput.value.trim();
    if (!query) return;

    appendMessage('user', query, operatorChatHistory);
    operatorChatInput.value = '';

    const typingEl = appendTypingIndicator(operatorChatHistory);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, userRole: 'operator' })
    })
    .then(res => res.json())
    .then(data => {
      typingEl.remove();
      appendMessage('bot', data.response, operatorChatHistory, 'ArenaIQ Advisor');
      updateAiBadge(operatorAiBadge, data.source);
    })
    .catch(err => {
      console.error(err);
      typingEl.remove();
      appendMessage('bot', "Server advisory offline. Local fallback database failed to bind. Please check console logs.", operatorChatHistory, 'ArenaIQ Advisor');
    });
  });

  // Click handler for suggestion buttons
  fanSuggestBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fanChatInput.value = btn.textContent;
      fanChatForm.dispatchEvent(new Event('submit'));
    });
  });

  operatorSuggestBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      operatorChatInput.value = btn.textContent;
      operatorChatForm.dispatchEvent(new Event('submit'));
    });
  });

  function appendMessage(sender, text, historyContainer, botName = 'ArenaIQ') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.innerHTML = `
      <div class="message-meta">
        <span class="bot-name">${sender === 'user' ? 'You' : botName}</span>
        <span class="message-time">${timestamp}</span>
      </div>
      <div class="message-text">${text}</div>
    `;

    historyContainer.appendChild(msgDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
  }

  function appendTypingIndicator(historyContainer) {
    const indDiv = document.createElement('div');
    indDiv.className = 'chat-message bot';
    indDiv.innerHTML = `
      <div class="message-meta">
        <span class="bot-name">Thinking...</span>
      </div>
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    historyContainer.appendChild(indDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
    return indDiv;
  }

  function updateAiBadge(badgeEl, source) {
    if (source === 'gemini-ai') {
      badgeEl.textContent = 'Gemini 1.5 Flash';
      badgeEl.className = 'ai-badge gemini';
    } else {
      badgeEl.textContent = 'Local Engine (Sim)';
      badgeEl.className = 'ai-badge';
    }
  }

  // ==========================================
  // 11. INITIALIZATION
  // ==========================================
  connectToLiveData();
  
  // Initialize general app-level charts immediately (e.g. Eco Doughnut)
  setTimeout(initializeCharts, 200);
});
