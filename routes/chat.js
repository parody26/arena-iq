'use strict';
/**
 * routes/chat.js
 * ==============
 * POST /api/chat — GenAI fan concierge & operations advisor chatbot.
 * Falls back to the local keyword-map NLP engine when Gemini is unavailable.
 */

const express           = require('express');
const rateLimit         = require('express-rate-limit');
const router            = express.Router();
const { simulationState, STADIUM_KNOWLEDGE } = require('../lib/state');
const { handleLocalNLP }                      = require('../lib/nlp');

// Tighter limit on AI chat (costlier, most abuse-prone)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many chat requests. Please wait a moment before trying again.' }
});

let genAI = null;
function setGenAI(client) { genAI = client; }

router.post('/', chatLimiter, async (req, res) => {
  const { message, userRole } = req.body;
  const isOperator = userRole === 'operator';

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content required' });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: 'Message is too long (max 500 characters)' });
  }
  // Belt-and-suspenders server-side HTML strip (client also escapes)
  const message_clean = message.replace(/<[^>]*>/g, '').trim();

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      let systemPrompt = '';

      if (isOperator) {
        systemPrompt = `
          You are "ArenaIQ Operations Advisor", an advanced AI assistant built for the stadium operations team of MetLife Stadium for the FIFA World Cup 2026.
          You have access to current stadium configurations and rules:
          ${JSON.stringify(STADIUM_KNOWLEDGE)}

          Current telemetry metrics:
          ${JSON.stringify(simulationState.telemetry)}

          Active Incidents:
          ${JSON.stringify(simulationState.incidents.filter(i => i.status !== 'Resolved'))}

          Available Staff:
          ${JSON.stringify(simulationState.volunteers.filter(v => v.status === 'Available'))}

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

      const result       = await model.generateContent({
        contents:          [{ role: 'user', parts: [{ text: message_clean }] }],
        systemInstruction: systemPrompt
      });
      return res.json({ response: result.response.text(), source: 'gemini-ai' });
    } catch (err) {
      console.error('Gemini API call failed, falling back to local NLP:', err.message);
    }
  }

  const response = handleLocalNLP(message_clean, isOperator);
  res.json({ response, source: 'local-simulation-ai' });
});

module.exports = { router, setGenAI };
