const request = require('supertest');
const { app } = require('../server');

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

describe('POST /api/simulation/state', () => {
  it('rejects an invalid matchState with 400', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ matchState: 'Overtime-Chaos' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid matchState', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ matchState: 'Kick-off' });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('Kick-off');
  });

  it('rejects an out-of-range simulationSpeed with 400', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ simulationSpeed: 999 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative/zero simulationSpeed with 400', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ simulationSpeed: -5 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid simulationSpeed', async () => {
    const res = await request(app)
      .post('/api/simulation/state')
      .send({ simulationSpeed: 5 });
    expect(res.status).toBe(200);
    expect(res.body.speed).toBe(5);
  });
});

describe('POST /api/incidents/resolve', () => {
  it('rejects a missing incidentId with 400', async () => {
    const res = await request(app).post('/api/incidents/resolve').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for an incidentId that does not exist', async () => {
    const res = await request(app)
      .post('/api/incidents/resolve')
      .send({ incidentId: 'not-a-real-id' });
    expect(res.status).toBe(404);
  });

  it('resolves a real pending incident and assigns a volunteer', async () => {
    // Seed a known pending incident directly via the exported state
    const { simulationState } = require('../server');
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
      .send({ incidentId: 'test-inc-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.incident.status).toBe('Resolving');
    expect(res.body.incident.volunteerAssigned).not.toBe('None');
  });
});

describe('Security headers', () => {
  it('sets standard hardening headers via helmet', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers).toHaveProperty('content-security-policy');
  });
});
