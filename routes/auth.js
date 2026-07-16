'use strict';
/**
 * routes/auth.js
 * ==============
 * Staff authentication endpoints.
 * POST /api/auth/staff        — exchange password for a session token
 * POST /api/auth/staff/logout — invalidate token immediately
 */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'fifa2026';
const TOKEN_TTL_MS   = 4 * 60 * 60 * 1000; // 4-hour session

// Shared token store (in-memory; intentionally lightweight for hackathon demo).
// Replace with express-session + Redis for production.
const activeTokens = new Map(); // token → expiry timestamp

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidToken(token) {
  if (!token || !activeTokens.has(token)) return false;
  if (Date.now() > activeTokens.get(token)) {
    activeTokens.delete(token);
    return false;
  }
  return true;
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const parts = cookies[i].split('=');
    if (parts[0].trim() === name) {
      return decodeURIComponent(parts[1].trim());
    }
  }
  return null;
}

/** Express middleware — guards privileged mutation endpoints. */
function authMiddleware(req, res, next) {
  const token = req.headers['x-staff-token'] || getCookie(req, 'staff_token');
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized. Valid staff token required.' });
  }
  next();
}

// Staff login
router.post('/staff', (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string' || password !== STAFF_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = generateToken();
  activeTokens.set(token, Date.now() + TOKEN_TTL_MS);

  // Set secure HTTP-only cookie
  res.cookie('staff_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS
  });

  return res.json({ token });
});

// Staff logout
router.post('/staff/logout', (req, res) => {
  const token = req.headers['x-staff-token'] || getCookie(req, 'staff_token');
  if (token) activeTokens.delete(token);
  res.clearCookie('staff_token');
  return res.json({ success: true });
});

module.exports = { router, activeTokens, generateToken, isValidToken, authMiddleware };
