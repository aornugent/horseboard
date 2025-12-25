import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('Display API', () => {
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

  describe('POST /api/displays', () => {
    it('creates a new display', async () => {
      const res = await request(app)
        .post('/api/displays')
        .expect(201);

      assert.ok(res.body.id, 'should have id');
      assert.ok(res.body.pairCode, 'should have pairCode');
      assert.match(res.body.pairCode, /^\d{6}$/, 'pairCode should be 6 digits');
    });

    it('returns unique ids for each display', async () => {
      const res1 = await request(app).post('/api/displays');
      const res2 = await request(app).post('/api/displays');

      assert.notStrictEqual(res1.body.id, res2.body.id);
    });
  });

  describe('GET /api/displays/:id', () => {
    it('returns display data with domain structure', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .get(`/api/displays/${created.body.id}`)
        .expect(200);

      assert.strictEqual(res.body.id, created.body.id);
      assert.ok(res.body.tableData, 'should have tableData');
      assert.ok(res.body.tableData.settings, 'should have settings');
      assert.strictEqual(res.body.tableData.settings.timeMode, 'AUTO', 'should have timeMode');
      assert.ok(Array.isArray(res.body.tableData.feeds), 'feeds should be array');
      assert.ok(Array.isArray(res.body.tableData.horses), 'horses should be array');
      assert.ok(typeof res.body.tableData.diet === 'object', 'diet should be object');
    });

    it('returns 404 for non-existent display', async () => {
      const res = await request(app)
        .get('/api/displays/nonexistent')
        .expect(404);

      assert.ok(res.body.error, 'should have error message');
    });
  });

  describe('PUT /api/displays/:id', () => {
    it('updates table data with domain format', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = {
        settings: {
          timezone: 'America/New_York',
          timeMode: 'AM',
          overrideUntil: null,
          zoomLevel: 1,
          currentPage: 0,
        },
        horses: [
          { id: 'h1', name: 'Thunder' },
          { id: 'h2', name: 'Lightning' },
        ],
        feeds: [
          { id: 'f1', name: 'Hay', unit: 'scoop' },
        ],
        diet: {
          h1: { f1: { am: 2, pm: 1 } },
        },
      };

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.updatedAt, 'should have updatedAt');

      // Verify update persisted
      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      assert.strictEqual(fetched.body.tableData.settings.timezone, 'America/New_York');
      assert.strictEqual(fetched.body.tableData.horses.length, 2);
      assert.strictEqual(fetched.body.tableData.feeds.length, 1);
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .put('/api/displays/nonexistent')
        .send({
          tableData: {
            settings: {
              timezone: 'UTC',
              timeMode: 'AUTO',
              overrideUntil: null,
              zoomLevel: 2,
              currentPage: 0,
            },
            horses: [],
            feeds: [],
            diet: {},
          },
        })
        .expect(404);
    });

    it('returns 400 when tableData is missing', async () => {
      const created = await request(app).post('/api/displays');

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({})
        .expect(400);
    });

    it('validates tableData structure - rejects non-object', async () => {
      const created = await request(app).post('/api/displays');

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData: 'invalid' })
        .expect(400);
    });
  });

  describe('DELETE /api/displays/:id', () => {
    it('removes display', async () => {
      const created = await request(app).post('/api/displays');

      await request(app)
        .delete(`/api/displays/${created.body.id}`)
        .expect(200);

      await request(app)
        .get(`/api/displays/${created.body.id}`)
        .expect(404);
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .delete('/api/displays/nonexistent')
        .expect(404);
    });
  });
});
