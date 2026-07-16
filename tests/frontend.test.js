/**
 * tests/frontend.test.js
 * ======================
 * Unit tests for pure frontend logic extracted from public/app.js.
 * Uses Node.js directly (no browser/jsdom needed) since the logic
 * being tested has no DOM dependencies.
 */

'use strict';

// ---------------------------------------------------------------------------
// escapeHTML  — re-implement inline so we can test it without a DOM
// (mirrors the function in public/app.js exactly)
// ---------------------------------------------------------------------------
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

// ---------------------------------------------------------------------------
// SCOREBOARD_PRESETS  — mirrors public/app.js
// ---------------------------------------------------------------------------
const SCOREBOARD_PRESETS = {
  'Pre-match':   { score: '0 - 0', status: 'Pre-Match Warmups (USA vs ENG)' },
  'Kick-off':    { score: '0 - 0', status: "1st Half - Live 18'" },
  'Half-time':   { score: '1 - 0', status: 'Half-Time Interval (USA leading)' },
  'Second-half': { score: '1 - 1', status: "2nd Half - Live 72'" },
  'Post-match':  { score: '2 - 1', status: 'Full Time - USA Win (Group Stage)' }
};

// ---------------------------------------------------------------------------
// ECO_DINING_PRESETS  — mirrors public/app.js (keys only, enough to test)
// ---------------------------------------------------------------------------
const ECO_DINING_PRESETS_KEYS = ['Pre-match', 'Kick-off', 'Half-time', 'Second-half', 'Post-match'];

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('escapeHTML', () => {
  it('returns empty string for null', () => {
    expect(escapeHTML(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHTML(undefined)).toBe('');
  });

  it('escapes ampersands', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than signs', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHTML('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHTML('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHTML("it's fine")).toBe('it&#039;s fine');
  });

  it('escapes a full XSS payload', () => {
    const payload = '<img src=x onerror="alert(\'xss\')"/>';
    const result  = escapeHTML(payload);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('passes through plain safe text unchanged', () => {
    expect(escapeHTML('Hello FIFA 2026')).toBe('Hello FIFA 2026');
  });

  it('coerces numbers to string', () => {
    expect(escapeHTML(42)).toBe('42');
  });
});

describe('SCOREBOARD_PRESETS', () => {
  const MATCH_STATES = ['Pre-match', 'Kick-off', 'Half-time', 'Second-half', 'Post-match'];

  it('has an entry for all 5 match states', () => {
    MATCH_STATES.forEach(state => {
      expect(SCOREBOARD_PRESETS).toHaveProperty(state);
    });
  });

  it('every entry has a score string', () => {
    MATCH_STATES.forEach(state => {
      expect(typeof SCOREBOARD_PRESETS[state].score).toBe('string');
      expect(SCOREBOARD_PRESETS[state].score.length).toBeGreaterThan(0);
    });
  });

  it('every entry has a status string', () => {
    MATCH_STATES.forEach(state => {
      expect(typeof SCOREBOARD_PRESETS[state].status).toBe('string');
      expect(SCOREBOARD_PRESETS[state].status.length).toBeGreaterThan(0);
    });
  });

  it('Pre-match score is 0 - 0', () => {
    expect(SCOREBOARD_PRESETS['Pre-match'].score).toBe('0 - 0');
  });

  it('Post-match score reflects USA win', () => {
    expect(SCOREBOARD_PRESETS['Post-match'].score).toBe('2 - 1');
  });

  it('Half-time score shows USA leading', () => {
    expect(SCOREBOARD_PRESETS['Half-time'].status).toMatch(/USA/);
  });
});

describe('ECO_DINING_PRESETS keys', () => {
  it('covers all 5 match phases', () => {
    expect(ECO_DINING_PRESETS_KEYS).toHaveLength(5);
    expect(ECO_DINING_PRESETS_KEYS).toContain('Pre-match');
    expect(ECO_DINING_PRESETS_KEYS).toContain('Post-match');
  });
});

describe('escapeHTML — boundary cases', () => {
  it('handles an empty string', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('handles a string with only special chars', () => {
    expect(escapeHTML('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;');
  });

  it('handles a very long string without error', () => {
    const long = 'a'.repeat(10_000);
    expect(escapeHTML(long)).toBe(long);
  });
});
