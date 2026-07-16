/**
 * public/modules/chat.js
 * ======================
 * Chatbot interface functions, message appenders, and suggestion bindings.
 */

import { escapeHTML } from './state.js';

export function appendMessage(sender, text, historyContainer, botName = 'ArenaIQ') {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${sender}`;

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  msgDiv.innerHTML = `
    <div class="message-meta">
      <span class="bot-name">${escapeHTML(sender === 'user' ? 'You' : botName)}</span>
      <span class="message-time">${escapeHTML(timestamp)}</span>
    </div>
    <div class="message-text">${escapeHTML(text)}</div>
  `;

  historyContainer.appendChild(msgDiv);
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

export function appendTypingIndicator(historyContainer) {
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

export function updateAiBadge(badgeEl, source) {
  if (!badgeEl) return;
  if (source === 'gemini-ai') {
    badgeEl.textContent = 'Gemini 1.5 Flash';
    badgeEl.className = 'ai-badge gemini';
  } else {
    badgeEl.textContent = 'Local Engine (Sim)';
    badgeEl.className = 'ai-badge';
  }
}
