import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('Time Mode API', () => {
  let app;

  before(() => {
    app = createApp({ dbPath: ':memory:' });
  });

  beforeEach(() => {
    app.get('db').clear();
  });

  after(() => {
    app.get('db').close();
  });

  describe('GET /api/displays/:id/time-mode', () => {
    it('returns current time mode for display', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .get(`/api/displays/${created.body.id}/time-mode`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.mode, 'AUTO');
      assert.ok(['AM', 'PM'].includes(res.body.effectiveMode), 'should have effective mode');
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .get('/api/displays/nonexistent/time-mode')
        .expect(404);
    });
  });

  describe('PUT /api/displays/:id/time-mode', () => {
    it('sets time mode to AM with override', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'AM' })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.overrideUntil, 'should have override until');
      assert.ok(res.body.overrideUntil > Date.now(), 'override should be in future');

      // Verify it was saved
      const getRes = await request(app)
        .get(`/api/displays/${created.body.id}/time-mode`)
        .expect(200);

      assert.strictEqual(getRes.body.mode, 'AM');
      assert.strictEqual(getRes.body.effectiveMode, 'AM');
    });

    it('sets time mode to PM with override', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'PM' })
        .expect(200);

      assert.strictEqual(res.body.success, true);

      const getRes = await request(app)
        .get(`/api/displays/${created.body.id}/time-mode`)
        .expect(200);

      assert.strictEqual(getRes.body.mode, 'PM');
      assert.strictEqual(getRes.body.effectiveMode, 'PM');
    });

    it('clears override when set to AUTO', async () => {
      const created = await request(app).post('/api/displays');

      // First set an override
      await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'AM' });

      // Then clear it
      const res = await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'AUTO' })
        .expect(200);

      assert.strictEqual(res.body.success, true);

      const getRes = await request(app)
        .get(`/api/displays/${created.body.id}/time-mode`)
        .expect(200);

      assert.strictEqual(getRes.body.mode, 'AUTO');
      assert.strictEqual(getRes.body.overrideUntil, null);
    });

    it('returns 400 when mode is missing', async () => {
      const created = await request(app).post('/api/displays');

      await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid mode', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'INVALID' })
        .expect(400);

      assert.strictEqual(res.body.success, false);
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .put('/api/displays/nonexistent/time-mode')
        .send({ mode: 'AM' })
        .expect(404);
    });

    it('override expires after 1 hour', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .put(`/api/displays/${created.body.id}/time-mode`)
        .send({ mode: 'AM' });

      const overrideUntil = res.body.overrideUntil;
      const now = Date.now();

      // Should be approximately 1 hour in the future (allow 5 second margin)
      assert.ok(overrideUntil >= now + 3595000, 'should be at least 59:55 in future');
      assert.ok(overrideUntil <= now + 3605000, 'should be at most 1:00:05 in future');
    });
  });
});

describe('TimeModeService', () => {
  let app;
  let timeModeService;

  before(() => {
    app = createApp({ dbPath: ':memory:' });
    timeModeService = app.get('timeModeService');
  });

  beforeEach(() => {
    app.get('db').clear();
  });

  after(() => {
    app.get('db').close();
  });

  describe('getEffectiveTimeMode', () => {
    it('returns AM for morning hours (04:00-11:59)', () => {
      // Test various morning hours
      const morningDates = [
        new Date('2024-01-15T04:00:00'),
        new Date('2024-01-15T06:30:00'),
        new Date('2024-01-15T09:00:00'),
        new Date('2024-01-15T11:59:00')
      ];

      for (const date of morningDates) {
        const mode = timeModeService.getEffectiveTimeMode('UTC', date);
        assert.strictEqual(mode, 'AM', `${date.toISOString()} should be AM`);
      }
    });

    it('returns PM for afternoon/evening/night hours', () => {
      // Test various afternoon/evening hours
      const afternoonDates = [
        new Date('2024-01-15T12:00:00'),  // Noon
        new Date('2024-01-15T15:30:00'),  // Afternoon
        new Date('2024-01-15T20:00:00'),  // Evening
        new Date('2024-01-15T23:59:00'),  // Late night
        new Date('2024-01-15T00:00:00'),  // Midnight
        new Date('2024-01-15T03:59:00')   // Early morning
      ];

      for (const date of afternoonDates) {
        const mode = timeModeService.getEffectiveTimeMode('UTC', date);
        assert.strictEqual(mode, 'PM', `${date.toISOString()} should be PM`);
      }
    });

    it('handles timezone conversion correctly', () => {
      // When it's 6:00 AM in Sydney (UTC+11), it should be PM in UTC
      const sydneyMorning = new Date('2024-01-15T06:00:00+11:00');

      // In Sydney timezone, this is 6 AM (should be AM)
      const sydneyMode = timeModeService.getEffectiveTimeMode('Australia/Sydney', sydneyMorning);
      assert.strictEqual(sydneyMode, 'AM', 'Sydney 6 AM should be AM');

      // In UTC, this is 7 PM previous day (should be PM)
      const utcMode = timeModeService.getEffectiveTimeMode('UTC', sydneyMorning);
      assert.strictEqual(utcMode, 'PM', 'UTC 7 PM should be PM');
    });
  });

  describe('checkDisplayForExpiry', () => {
    it('resets expired override to AUTO', async () => {
      const displayService = app.get('displayService');
      const display = displayService.createDisplay();

      // Set an override that's already expired
      const expiredTime = Date.now() - 1000; // 1 second ago
      const tableData = {
        ...displayService.getDisplay(display.id).tableData,
        settings: {
          ...displayService.getDisplay(display.id).tableData.settings,
          timeMode: 'AM',
          overrideUntil: expiredTime
        }
      };

      displayService.db.updateDisplayData(display.id, tableData);

      // Check for expiry
      const wasExpired = timeModeService.checkDisplayForExpiry(display.id);
      assert.strictEqual(wasExpired, true, 'should detect expiry');

      // Verify it was reset
      const result = timeModeService.getCurrentMode(display.id);
      assert.strictEqual(result.mode, 'AUTO');
      assert.strictEqual(result.overrideUntil, null);
    });

    it('does not reset active override', async () => {
      const displayService = app.get('displayService');
      const display = displayService.createDisplay();

      // Set an override that's still active
      const futureTime = Date.now() + 3600000; // 1 hour from now
      const tableData = {
        ...displayService.getDisplay(display.id).tableData,
        settings: {
          ...displayService.getDisplay(display.id).tableData.settings,
          timeMode: 'PM',
          overrideUntil: futureTime
        }
      };

      displayService.db.updateDisplayData(display.id, tableData);

      // Check for expiry
      const wasExpired = timeModeService.checkDisplayForExpiry(display.id);
      assert.strictEqual(wasExpired, false, 'should not expire active override');

      // Verify it's still set
      const result = timeModeService.getCurrentMode(display.id);
      assert.strictEqual(result.mode, 'PM');
      assert.strictEqual(result.overrideUntil, futureTime);
    });
  });
});
