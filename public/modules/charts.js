/**
 * public/modules/charts.js
 * ========================
 * Chart.js initialization, updater, and accessibility table updates.
 */

import { appState } from './state.js';

export let gateChartInstance = null;
export let wasteChartInstance = null;
export let ecoChartInstance = null;

export function initializeCharts() {
  if (appState.chartsInitialized) return;
  
  const canvasGate = document.getElementById('chart-gate-waits');
  const canvasWaste = document.getElementById('chart-waste-levels');
  const canvasEco = document.getElementById('chart-eco-diversion');
  
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

/**
 * Updates the screen-reader accessible tables with the latest live data.
 */
export function updateAccessibleTables(tel) {
  // Update Gate Wait Times table
  const gateTbody = document.getElementById('chart-gate-waits-tbody');
  if (gateTbody) {
    gateTbody.innerHTML = `
      <tr><td>Gate A</td><td>${tel.queueWaitTimes["Gate A"]} mins</td></tr>
      <tr><td>Gate B</td><td>${tel.queueWaitTimes["Gate B"]} mins</td></tr>
      <tr><td>Gate C</td><td>${tel.queueWaitTimes["Gate C"]} mins</td></tr>
      <tr><td>Gate D</td><td>${tel.queueWaitTimes["Gate D"]} mins</td></tr>
      <tr><td>Concessions</td><td>${tel.queueWaitTimes.Concessions} mins</td></tr>
      <tr><td>Restrooms</td><td>${tel.queueWaitTimes.Restrooms} mins</td></tr>
    `;
  }

  // Update Waste Levels table
  const wasteTbody = document.getElementById('chart-waste-levels-tbody');
  if (wasteTbody) {
    wasteTbody.innerHTML = `
      <tr><td>Zone 1</td><td>${tel.wasteBinCapacity.zone1}%</td></tr>
      <tr><td>Zone 2</td><td>${tel.wasteBinCapacity.zone2}%</td></tr>
      <tr><td>Zone 3</td><td>${tel.wasteBinCapacity.zone3}%</td></tr>
      <tr><td>Zone 4</td><td>${tel.wasteBinCapacity.zone4}%</td></tr>
    `;
  }
}
