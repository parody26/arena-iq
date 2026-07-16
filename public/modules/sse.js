/**
 * public/modules/sse.js
 * =====================
 * Server-Sent Events listener and telemetry UI synchronizer.
 */

import { appState, ECO_DINING_PRESETS, SCOREBOARD_PRESETS, STREAM_TIMELINE_PRESETS, LOCATION_MAP_COORDS, escapeHTML } from './state.js';
import { initializeCharts, gateChartInstance, wasteChartInstance, ecoChartInstance, updateAccessibleTables } from './charts.js';

let eventSource = null;

export function connectToLiveData() {
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
  const simTimeDisplay = document.getElementById('sim-time');
  const sidebarMatchBadge = document.getElementById('sidebar-match-badge');
  const scoreboardDigits = document.getElementById('scoreboard-digits');
  const scoreboardStatus = document.getElementById('scoreboard-status');
  const dbBottlesSaved = document.getElementById('db-bottles-saved');
  const simStateSelect = document.getElementById('sim-state-select');
  const stadiumSelect = document.getElementById('stadium-select');
  const speedBtns = document.querySelectorAll('.speed-btn');

  // Main Metrics Selectors
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
  const ecoDiningRecommendationPage = document.getElementById('eco-dining-recommendation-page');

  // Transit selectors
  const waitRail = document.getElementById('transit-wait-rail');
  const waitShuttle = document.getElementById('transit-wait-shuttle');
  const waitRideshare = document.getElementById('transit-wait-rideshare');
  const staffMarker = document.getElementById('dispatched-staff-marker');

  // 1. Live clocks & scoreboard updates
  if (simTimeDisplay) simTimeDisplay.textContent = data.timestamp;
  if (sidebarMatchBadge) sidebarMatchBadge.textContent = data.matchState;
  
  // Update scoreboard
  const scoreInfo = SCOREBOARD_PRESETS[data.matchState] || SCOREBOARD_PRESETS["Pre-match"];
  if (scoreboardDigits) scoreboardDigits.textContent = scoreInfo.score;
  if (scoreboardStatus) scoreboardStatus.textContent = scoreInfo.status;

  // Increment carbon savings counter tick
  appState.bottlesSavedCounter += Math.floor(Math.random() * 3) + 1;
  if (dbBottlesSaved) dbBottlesSaved.textContent = appState.bottlesSavedCounter.toLocaleString();

  // Event Stream timeline updater
  updateEventStream(data);

  // Sync match state dropdown select
  if (simStateSelect && document.activeElement !== simStateSelect) {
    simStateSelect.value = data.matchState;
  }

  // Sync stadium select dropdown
  if (stadiumSelect && data.stadiumId && document.activeElement !== stadiumSelect) {
    stadiumSelect.value = data.stadiumId;
    appState.stadium = data.stadiumId;
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
  if (dbDensity) dbDensity.textContent = `${tel.crowdDensity}%`;
  if (dbDensityBar) dbDensityBar.style.width = `${tel.crowdDensity}%`;
  if (dbDensitySub) dbDensitySub.textContent = `${Math.floor(82500 * (tel.crowdDensity / 100))} / 82,500 seats filled`;

  const avgWait = tel.queueWaitTimes.Concessions;
  if (dbConcessionWait) dbConcessionWait.textContent = `${avgWait} mins`;
  if (dbConcessionBar) dbConcessionBar.style.width = `${(avgWait / 25) * 100}%`;

  if (dbTransitWait) dbTransitWait.textContent = `${tel.queueWaitTimes["Gate A"]} mins`;

  const activeIncidents = data.incidents.filter(i => i.status !== "Resolved");
  if (dbIncidents) dbIncidents.textContent = activeIncidents.length;
  if (dbIncidentsSub) {
    dbIncidentsSub.textContent = activeIncidents.length > 0 
      ? `${activeIncidents.length} security alerts pending`
      : "All stadium systems green";
  }

  const solar = tel.energyUsage.solarGeneration;
  const grid = tel.energyUsage.gridPower;
  const solarRatio = ((solar / (solar + grid)) * 100).toFixed(1);
  if (dbSolarRatio) dbSolarRatio.textContent = `${solarRatio}%`;
  if (dbSolarBar) dbSolarBar.style.width = `${solarRatio}%`;

  const wasteAvgValue = Math.floor((tel.wasteBinCapacity.zone1 + tel.wasteBinCapacity.zone2 + tel.wasteBinCapacity.zone3 + tel.wasteBinCapacity.zone4) / 4);
  if (dbWasteAvg) dbWasteAvg.textContent = `${wasteAvgValue}%`;
  if (dbWasteBar) dbWasteBar.style.width = `${wasteAvgValue}%`;

  if (dbWaterRate) dbWaterRate.textContent = `${tel.waterFlow.rate} gal/min`;

  // Concession eco tip sync
  const ecoText = ECO_DINING_PRESETS[data.matchState] || ECO_DINING_PRESETS["Pre-match"];
  if (ecoDiningRecommendationPage) ecoDiningRecommendationPage.innerHTML = ecoText;

  // 3. Sustainability Tab UI Updates
  if (waitRail && waitShuttle && waitRideshare) {
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
  }

  // Refresh Doughnut chart slightly to show live updates
  if (ecoChartInstance) {
    const recycledPct = Math.max(35, 55 - Math.floor(wasteAvgValue / 3));
    const compostPct = Math.max(25, 45 - Math.floor(wasteAvgValue / 4));
    const landfillPct = 100 - recycledPct - compostPct;
    
    ecoChartInstance.data.datasets[0].data = [recycledPct, compostPct, landfillPct];
    ecoChartInstance.update();
  }

  // Update screen-reader accessible charts tables
  updateAccessibleTables(tel);

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
  if (staffMarker) {
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
}

function updateEventStream(data) {
  const currentState = data.matchState;
  
  if (appState.loadedEventState !== currentState) {
    appState.loadedEventState = currentState;
    appState.streamEvents = [...STREAM_TIMELINE_PRESETS[currentState]];
    renderEventStream();
  }

  if (Math.random() > 0.95 && appState.streamEvents.length < 8) {
    const liveHighlights = [
      { type: "match-event", text: "Match Update: Pulisic executes a nutmeg at the touchline, setting up a crossing opportunity!" },
      { type: "eco-event", text: "Sustainability Milestone: Section 128 compostable waste bin collection sorted successfully." },
      { type: "alert-event", text: "Operations Update: Staff elevator 3 reset. Fully operational for wheelchair routing." },
      { type: "match-event", text: "Match Highlight: Bellingham yellow-carded for a slide tackle on McKennie." }
    ];
    
    const newCommentary = liveHighlights[Math.floor(Math.random() * liveHighlights.length)];
    appState.streamEvents.unshift(newCommentary);
    
    if (appState.streamEvents.length > 7) {
      appState.streamEvents.pop();
    }
    renderEventStream();
  }
}

function renderEventStream() {
  const dbEventStream = document.getElementById('db-event-stream');
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
        <span class="stream-content">${icon} ${escapeHTML(evt.text)}</span>
      </div>
    `;
  });
  dbEventStream.innerHTML = html;
}

function renderIncidents(incidents) {
  const incidentsFeed = document.getElementById('incidents-feed');
  if (!incidentsFeed) return;

  if (incidents.length === 0) {
    incidentsFeed.innerHTML = '<p class="no-incidents-text">Monitoring live sensor telemetry feeds for stadium incidents...</p>';
    return;
  }

  let html = '';
  incidents.forEach(inc => {
    const statusClass = `badge-${inc.status.toLowerCase()}`;
    const showAction = inc.status === "Pending";
    const severityLabel = `Severity: ${inc.severity}`;

    html += `
      <div class="incident-item severity-${escapeHTML(inc.severity)}">
        <div class="incident-meta">
          <span class="incident-loc"><i class="fa-solid fa-location-dot text-accent-red" aria-hidden="true"></i> ${escapeHTML(inc.location)}</span>
          <span class="incident-time">${escapeHTML(inc.timestamp)}</span>
        </div>
        <div class="incident-desc">${escapeHTML(inc.description)}</div>
        <span class="incident-severity-badge" aria-label="${escapeHTML(severityLabel)}"><span class="sr-only">${escapeHTML(severityLabel)} — </span>${escapeHTML(inc.severity)}</span>

        <div class="incident-ai-rec-box">
          <p><strong><i class="fa-solid fa-robot" aria-hidden="true"></i> ARENAIQ DECISION SUPPORT PLAN</strong>
          ${escapeHTML(inc.genaiRecommendation)}</p>
        </div>

        <div class="incident-actions">
          <span class="incident-badge ${statusClass}">${escapeHTML(inc.status)}</span>
          ${showAction
            ? `<button class="resolve-btn" onclick="authorizeIncidentResponse('${escapeHTML(inc.id)}')" aria-label="Authorize AI response for incident at ${escapeHTML(inc.location)}"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Authorize AI Response</button>`
            : `<span class="assigned-staff-info"><i class="fa-solid fa-user-check text-accent-green" aria-hidden="true"></i> Assigned: ${escapeHTML(inc.volunteerAssigned)}</span>`
          }
        </div>
      </div>
    `;
  });
  incidentsFeed.innerHTML = html;
}

function renderVolunteers(volunteers) {
  const volunteerList = document.getElementById('volunteer-list');
  if (!volunteerList) return;

  let html = '';
  volunteers.forEach(v => {
    const statusClass = `status-${v.status}`;
    const srStatus = v.status === 'Available' ? 'Available' : v.status === 'Dispatched' ? 'Currently dispatched' : v.status;
    html += `
      <div class="volunteer-node">
        <div class="vol-name-group">
          <span class="vol-name">${escapeHTML(v.name)}</span>
          <span class="vol-loc"><i class="fa-solid fa-map-pin" aria-hidden="true"></i> ${escapeHTML(v.location)}</span>
        </div>
        <span class="vol-status ${statusClass}" aria-label="Status: ${escapeHTML(srStatus)}">${escapeHTML(v.status)}<span class="sr-only"> — ${escapeHTML(srStatus)}</span></span>
      </div>
    `;
  });
  volunteerList.innerHTML = html;
}

// Window-level dispatch hook for incidents feed click (since HTML strings use inline onclick)
window.authorizeIncidentResponse = function(incidentId) {
  fetch('/api/incidents/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Staff-Token': appState.staffToken || ''
    },
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
