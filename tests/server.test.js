const request = require('supertest');
const http = require('http');
const { app, simulationState, isValidToken, activeTokens, generateToken, runSimulationTick, handleLocalNLP } = require('../server');

// ──────────────────────────────────────────────
// Helper: obtain a valid staff token
// ──────────────────────────────────────────────
async function getStaffToken() {
  const res = await request(app)
    .post('/api/auth/staff')
    .send({ password: 'fifa2026' });
  return res.body.token;
}

// ──────────────────────────────────────────────
// EXISTING TESTS (unchanged)
// ──────────────────────────────────────────────

describe('GET /', () => {
  it('serves the dashboard HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
  });
});

describe('POST /api/chat', () => {
  it('rejects a missing message with 400', async () => {
    const res = await request(app).post('/api/chat').send({ userRole: 'fan' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects an empty/whitespace-only message with 400', async () => {
    const res = await request(app).post('/api/chat').send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a message over 500 characters with 400', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('returns a grounded local-fallback answer for a valid fan question', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Where can I refill my water?', userRole: 'fan' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(typeof res.body.response).toBe('string');
    expect(res.body.response.length).toBeGreaterThan(0);
  });

  it('returns an operator-specific answer when userRole is operator', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'What is the current crowd density?', userRole: 'operator' });
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toContain('crowd density');
  });

  it('strips embedded HTML tags from the message before processing (XSS defense-in-depth)', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: '<script>alert(1)</script> hello', userRole: 'fan' });
    expect(res.status).toBe(200);
    // The route should not error out or reflect a raw <script> tag back
    expect(res.body.response).not.toMatch(/<script>/i);
  });
});

// ──────────────────────────────────────────────
// STAFF AUTH ENDPOINT
// ──────────────────────────────────────────────

describe('POST /api/auth/staff', () => {
  it('returns 401 for a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .send({ password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 when no password is provided', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .send({});
    expect(res.status).toBe(401);
  });

  it('returns 200 with a token for the correct password', async () => {
    const res = await request(app)
      .post('/api/auth/staff')
      .send({ password: 'fifa2026' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('issues different tokens on each login', async () => {
    const r1 = await request(app).post('/api/auth/staff').send({ password: 'fifa2026' });
    const r2 = await request(app).post('/api/auth/staff').send({ password: 'fifa2026' });
    expect(r1.body.token).not.toBe(r2.body.token);
  });
});

describe('POST /api/auth/staff/logout', () => {
  it('invalidates a valid token so it can no longer be used', async () => {
    const token = await getStaffToken();

    // Confirm token works before logout
    const before = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ matchState: 'Kick-off' });
    expect(before.status).toBe(200);

    // Logout
    await request(app)
      .post('/api/auth/staff/logout')
      .set('X-Staff-Token', token);

    // Confirm token no longer works after logout
    const after = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ matchState: 'Pre-match' });
    expect(after.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// PROTECTED ROUTE GUARD
// ──────────────────────────────────────────────

describe('Protected routes (authMiddleware)', () => {
  it('POST /api/simulation/state returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ matchState: 'Kick-off' });
    expect(res.status).toBe(401);
  });

  it('POST /api/simulation/state returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', 'not-a-real-token')
      .send({ matchState: 'Kick-off' });
    expect(res.status).toBe(401);
  });

  it('POST /api/simulation/state succeeds with a valid token', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ matchState: 'Half-time' });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('Half-time');
  });

  it('POST /api/incidents/resolve returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/incidents/resolve')
      .send({ incidentId: 'inc-1' });
    expect(res.status).toBe(401);
  });

  it('POST /api/incidents/resolve rejects an invalid matchState with 400 even with valid token', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ matchState: 'Overtime-Chaos' });
    expect(res.status).toBe(400);
  });

  it('POST /api/simulation/state accepts a valid simulationSpeed with valid token', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ simulationSpeed: 5 });
    expect(res.status).toBe(200);
    expect(res.body.speed).toBe(5);
  });

  it('POST /api/simulation/state rejects an out-of-range simulationSpeed with 400', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ simulationSpeed: 999 });
    expect(res.status).toBe(400);
  });

  it('POST /api/simulation/state rejects a negative simulationSpeed with 400', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/simulation/state')
      .set('X-Staff-Token', token)
      .send({ simulationSpeed: -5 });
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────
// INCIDENTS/RESOLVE (with auth)
// ──────────────────────────────────────────────

describe('POST /api/incidents/resolve (with auth)', () => {
  it('rejects a missing incidentId with 400', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/incidents/resolve')
      .set('X-Staff-Token', token)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an incidentId that does not exist', async () => {
    const token = await getStaffToken();
    const res = await request(app)
      .post('/api/incidents/resolve')
      .set('X-Staff-Token', token)
      .send({ incidentId: 'not-a-real-id' });
    expect(res.status).toBe(404);
  });

  it('resolves a real pending incident and assigns a volunteer', async () => {
    const token = await getStaffToken();

    // Seed a known pending incident directly via the exported state
    simulationState.incidents.unshift({
      id: 'test-inc-1',
      timestamp: '10:00 AM',
      severity: 'Low',
      location: 'Test Zone',
      description: 'Waste overflow detected at Smart Bin. (Test Zone)',
      status: 'Pending',
      volunteerAssigned: 'None',
      genaiRecommendation: 'Test recommendation.'
    });

    const res = await request(app)
      .post('/api/incidents/resolve')
      .set('X-Staff-Token', token)
      .send({ incidentId: 'test-inc-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.incident.status).toBe('Resolving');
    expect(res.body.incident.volunteerAssigned).not.toBe('None');
  });
});

// ──────────────────────────────────────────────
// SSE ENDPOINT
// ──────────────────────────────────────────────

describe('GET /api/live-data (SSE)', () => {
  // Spin up a real HTTP server so we can open a native connection and read
  // the first data chunk without supertest blocking on a keep-alive stream.
  let server;
  let port;

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('returns 200 with correct event-stream content-type and initial data chunk', (done) => {
    const req = http.get(`http://127.0.0.1:${port}/api/live-data`, (res) => {
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/event-stream/);

      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        // The server emits the initial state immediately; once we have the
        // first 'data: ' prefix we have confirmed the SSE protocol is working.
        if (buf.includes('data: ')) {
          req.destroy(); // close the connection so the test can finish
          done();
        }
      });
    });

    req.on('error', (err) => {
      // 'socket hang up' / ECONNRESET is expected when we destroy the socket
      if (err.code === 'ECONNRESET' || err.message === 'socket hang up') return;
      done(err);
    });
  }, 8000);
});

// ──────────────────────────────────────────────
// SIMULATION TICK STATE MACHINE
// ──────────────────────────────────────────────

describe('runSimulationTick state machine', () => {
  // Reset to known baseline before each tick test
  beforeEach(() => {
    simulationState.telemetry.crowdDensity = 40;
    simulationState.telemetry.queueWaitTimes = {
      'Gate A': 8, 'Gate B': 10, 'Gate C': 6, 'Gate D': 3,
      Concessions: 8, Restrooms: 5
    };
    simulationState.telemetry.energyUsage = { solarGeneration: 45, gridPower: 120, batteryStorage: 88, unit: 'kW' };
    simulationState.telemetry.waterFlow = { rate: 24, unit: 'gal/min' };
    simulationState.telemetry.wasteBinCapacity = { zone1: 30, zone2: 25, zone3: 40, zone4: 15 };
    simulationState.sseClients = []; // suppress broadcast attempts
  });

  it('Pre-match: increases crowd density over time', () => {
    simulationState.matchState = 'Pre-match';
    simulationState.telemetry.crowdDensity = 40;
    runSimulationTick();
    expect(simulationState.telemetry.crowdDensity).toBeGreaterThan(40);
  });

  it('Pre-match: sets high gate throughput values', () => {
    simulationState.matchState = 'Pre-match';
    runSimulationTick();
    expect(simulationState.telemetry.gateThroughput['Gate A']).toBeGreaterThanOrEqual(180);
  });

  it('Kick-off: gate throughput drops to low entry values', () => {
    simulationState.matchState = 'Kick-off';
    runSimulationTick();
    expect(simulationState.telemetry.gateThroughput['Gate A']).toBeLessThan(60);
  });

  it('Half-time: crowd density is fixed at 95%', () => {
    simulationState.matchState = 'Half-time';
    runSimulationTick();
    expect(simulationState.telemetry.crowdDensity).toBe(95);
  });

  it('Half-time: concession queue wait time increases', () => {
    simulationState.matchState = 'Half-time';
    simulationState.telemetry.queueWaitTimes.Concessions = 5;
    runSimulationTick();
    expect(simulationState.telemetry.queueWaitTimes.Concessions).toBeGreaterThan(5);
  });

  it('Second-half: concession wait time decreases from Half-time peak', () => {
    simulationState.matchState = 'Second-half';
    simulationState.telemetry.queueWaitTimes.Concessions = 20;
    runSimulationTick();
    expect(simulationState.telemetry.queueWaitTimes.Concessions).toBeLessThan(20);
  });

  it('Post-match: crowd density decreases as fans leave', () => {
    simulationState.matchState = 'Post-match';
    simulationState.telemetry.crowdDensity = 90;
    runSimulationTick();
    expect(simulationState.telemetry.crowdDensity).toBeLessThan(90);
  });

  it('Post-match: gate throughput drops to 0 (fans leaving, not entering)', () => {
    simulationState.matchState = 'Post-match';
    runSimulationTick();
    Object.values(simulationState.telemetry.gateThroughput).forEach(v => {
      expect(v).toBe(0);
    });
  });

  it('timestamp is updated on each tick', () => {
    simulationState.matchState = 'Pre-match';
    const before = simulationState.timestamp;
    // Ensure some ms pass so the locale string can differ
    runSimulationTick();
    // Timestamp is set to toLocaleTimeString(), so it should be a non-empty string
    expect(typeof simulationState.timestamp).toBe('string');
    expect(simulationState.timestamp.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────
// LOCAL NLP — FAN INTENTS
// ──────────────────────────────────────────────

describe('Local NLP — fan intents', () => {
  const fanPost = (msg) =>
    request(app).post('/api/chat').send({ message: msg, userRole: 'fan' });

  it('wheelchair query returns accessible route info', async () => {
    const res = await fanPost('I am in a wheelchair, how do I get in?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/wheelchair|accessible|elevator|ramp/);
  });

  it('sensory room query returns quiet room location', async () => {
    const res = await fanPost('Is there a quiet sensory room?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/sensory|quiet|section 102/);
  });

  it('food query returns concession info', async () => {
    const res = await fanPost('Where can I eat?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/eat|concession|food|jersey|flavors/);
  });

  it('vegan food query returns green pitch concourse info', async () => {
    const res = await fanPost('Are there vegan food options?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/vegan|plant|green pitch/);
  });

  it('water/refill query returns hydration station info', async () => {
    const res = await fanPost('Where can I refill my water bottle?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/water|refill|hydration/);
  });

  it('transit query returns transport options', async () => {
    const res = await fanPost('How do I get to the train station?');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/rail|transit|shuttle|train|gate a/);
  });

  it('medical query returns first aid location', async () => {
    const res = await fanPost('I need first aid help');
    expect(res.status).toBe(200);
    expect(res.body.response.toLowerCase()).toMatch(/first aid|section 109|medical|emergency/);
  });

  it('responses never reflect a raw <script> tag', async () => {
    const res = await fanPost('<script>alert(1)</script> where is gate A?');
    expect(res.status).toBe(200);
    expect(res.body.response).not.toMatch(/<script>/i);
  });
});

// ──────────────────────────────────────────────
// LOCAL NLP — OPERATOR INTENTS
// ──────────────────────────────────────────────
// These call handleLocalNLP directly to avoid the rate-limiter (15 req/min)
// which can be exhausted by prior chat tests running in the same Jest run.

describe('Local NLP — operator intents', () => {
  it('incident query returns active incident summary', () => {
    simulationState.incidents = [{
      id: 'op-test-1', timestamp: '09:00 AM', severity: 'High',
      location: 'Gate A', description: 'Crowd bottleneck forming.',
      status: 'Pending', volunteerAssigned: 'None',
      genaiRecommendation: 'Open auxiliary lane.'
    }];
    const response = handleLocalNLP('Show me all current incidents', true);
    expect(typeof response).toBe('string');
    expect(response.toLowerCase()).toMatch(/incident/);
  });

  it('crowd/density query returns gate and density data', () => {
    const response = handleLocalNLP('What is the crowd density right now?', true);
    expect(typeof response).toBe('string');
    expect(response.toLowerCase()).toMatch(/crowd density/);
  });

  it('volunteer/staff query returns volunteer count', () => {
    const response = handleLocalNLP('How many volunteers are available?', true);
    expect(typeof response).toBe('string');
    expect(response.toLowerCase()).toMatch(/volunteer/);
  });

  it('energy/sustainability query returns solar and grid info', () => {
    const response = handleLocalNLP('What is our solar energy status?', true);
    expect(typeof response).toBe('string');
    expect(response.toLowerCase()).toMatch(/solar/);
  });
});

// ──────────────────────────────────────────────
// SECURITY HEADERS
// ──────────────────────────────────────────────

describe('Security headers', () => {
  it('sets standard hardening headers via helmet', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers).toHaveProperty('content-security-policy');
  });
});

// ──────────────────────────────────────────────
// TOKEN INTERNALS
// ──────────────────────────────────────────────

describe('isValidToken / activeTokens internals', () => {
  it('returns false for an unknown token', () => {
    expect(isValidToken('garbage-token')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidToken(undefined)).toBe(false);
  });

  it('returns true for a freshly generated and registered token', () => {
    const token = generateToken();
    activeTokens.set(token, Date.now() + 60000);
    expect(isValidToken(token)).toBe(true);
    activeTokens.delete(token); // cleanup
  });

  it('returns false for an expired token and removes it from the map', () => {
    const token = generateToken();
    activeTokens.set(token, Date.now() - 1); // already expired
    expect(isValidToken(token)).toBe(false);
    expect(activeTokens.has(token)).toBe(false); // auto-pruned
  });
});
