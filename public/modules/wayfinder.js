/**
 * public/modules/wayfinder.js
 * ===========================
 * Wayfinding SVG map pathing and step-by-step directions compiler.
 */

import { appState, WAYFINDING_DIRECTIONS } from './state.js';

export function drawRoute() {
  const navStart = document.getElementById('nav-start');
  const navEnd = document.getElementById('nav-end');
  const routeDirectionsPlaceholder = document.getElementById('route-directions-placeholder');
  const routeDirectionsList = document.getElementById('route-directions-list');
  const stadiumSvg = document.getElementById('stadium-svg');

  if (!navStart || !navEnd || !stadiumSvg) return;

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
