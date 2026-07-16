/**
 * public/app.js
 * =============
 * Main entry point of the modular ArenaIQ frontend.
 * Loads other components dynamically using ES6 imports.
 */

import { appState } from './modules/state.js';
import { initializeCharts } from './modules/charts.js';
import { drawRoute } from './modules/wayfinder.js';
import { appendMessage, appendTypingIndicator, updateAiBadge } from './modules/chat.js';
import { connectToLiveData } from './modules/sse.js';

document.addEventListener('DOMContentLoaded', () => {

  // Left Sidebar Tab Navigation Elements
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Staff Portal Elements
  const staffLockScreen = document.getElementById('staff-lock-screen');
  const staffUnlockedDashboard = document.getElementById('staff-unlocked-dashboard');
  const staffLoginForm = document.getElementById('staff-login-form');
  const staffPasswordInput = document.getElementById('staff-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnStaffLogout = document.getElementById('btn-staff-logout');

  // Simulation Controls Elements
  const simStateSelect = document.getElementById('sim-state-select');
  const speedBtns = document.querySelectorAll('.speed-btn');
  const stadiumSelect = document.getElementById('stadium-select');

  // Wayfinding Elements
  const navStart = document.getElementById('nav-start');
  const navEnd = document.getElementById('nav-end');
  const btnRouteStd = document.getElementById('route-type-standard');
  const btnRouteAcc = document.getElementById('route-type-accessible');

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
  // 1. TAB NAVIGATION CONTROLLER
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
        if (staffPasswordInput) staffPasswordInput.focus();
      }
    }
  }

  // ==========================================
  // 2. STAFF PASSWORD VERIFICATION & LOGOUT
  // ==========================================
  
  if (staffLoginForm) {
    staffLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredPassword = staffPasswordInput.value;
      staffPasswordInput.value = '';

      try {
        const res = await fetch('/api/auth/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: enteredPassword })
        });

        if (res.ok) {
          const data = await res.json();
          appState.staffLoggedIn = true;
          appState.staffToken = data.token;
          loginErrorMsg.classList.add('hidden');

          staffLockScreen.classList.add('hidden');
          staffUnlockedDashboard.classList.remove('hidden');

          setTimeout(initializeCharts, 100);
        } else {
          loginErrorMsg.classList.remove('hidden');
          staffPasswordInput.classList.add('error-shake');
          setTimeout(() => staffPasswordInput.classList.remove('error-shake'), 400);
          staffPasswordInput.focus();
        }
      } catch (err) {
        console.error('Login request failed:', err);
        loginErrorMsg.classList.remove('hidden');
        staffPasswordInput.focus();
      }
    });
  }

  if (btnStaffLogout) {
    btnStaffLogout.addEventListener('click', async () => {
      if (appState.staffToken) {
        try {
          await fetch('/api/auth/staff/logout', {
            method: 'POST',
            headers: { 'X-Staff-Token': appState.staffToken }
          });
        } catch (err) {
          console.warn('Logout request failed (token will expire naturally):', err);
        }
      }
      appState.staffLoggedIn = false;
      appState.staffToken = null;
      staffUnlockedDashboard.classList.add('hidden');
      staffLockScreen.classList.remove('hidden');
      loginErrorMsg.classList.add('hidden');
      staffPasswordInput.focus();
    });
  }

  // ==========================================
  // 3. KEYBOARD FOCUS TRAP FOR STAFF LOGIN
  // ==========================================
  if (staffLockScreen) {
    staffLockScreen.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      
      const focusable = Array.from(
        staffLockScreen.querySelectorAll(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.disabled && el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  // ==========================================
  // 4. SIMULATION CONTROL TRIGGERS
  // ==========================================
  
  if (simStateSelect) {
    simStateSelect.addEventListener('change', (e) => {
      const matchState = e.target.value;
      fetch('/api/simulation/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-Token': appState.staffToken || ''
        },
        body: JSON.stringify({ matchState })
      })
      .then(res => res.json())
      .catch(err => console.error("Error changing simulation state:", err));
    });
  }

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = Number(btn.dataset.speed);
      fetch('/api/simulation/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-Token': appState.staffToken || ''
        },
        body: JSON.stringify({ simulationSpeed: speed })
      })
      .then(res => res.json())
      .catch(err => console.error("Error changing simulation speed:", err));
    });
  });

  if (stadiumSelect) {
    stadiumSelect.addEventListener('change', (e) => {
      appState.stadium = e.target.value;
      alert(`Connected to live telemetry feed for ${e.target.options[e.target.selectedIndex].text}. Telemetry simulation calibrating...`);
      
      if (appState.staffLoggedIn && appState.staffToken) {
        fetch('/api/simulation/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Staff-Token': appState.staffToken
          },
          body: JSON.stringify({ stadiumId: appState.stadium })
        })
        .then(res => res.json())
        .catch(err => console.error("Error changing stadium selection:", err));
      }
    });
  }

  // ==========================================
  // 5. WAYFINDING LISTENERS
  // ==========================================
  
  if (navStart) navStart.addEventListener('change', drawRoute);
  if (navEnd) navEnd.addEventListener('change', drawRoute);

  if (btnRouteStd) {
    btnRouteStd.addEventListener('click', () => {
      btnRouteStd.classList.add('active');
      btnRouteAcc.classList.remove('active');
      appState.routeType = 'std';
      drawRoute();
    });
  }

  if (btnRouteAcc) {
    btnRouteAcc.addEventListener('click', () => {
      btnRouteAcc.classList.add('active');
      btnRouteStd.classList.remove('active');
      appState.routeType = 'acc';
      drawRoute();
    });
  }

  // ==========================================
  // 6. CHATBOT CORE FORM LISTENERS
  // ==========================================

  if (fanChatForm) {
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
  }

  if (operatorChatForm) {
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
  }

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

  // ==========================================
  // 7. INITIALIZATION
  // ==========================================
  connectToLiveData();
  setTimeout(initializeCharts, 200);
});
