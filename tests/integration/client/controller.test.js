import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('Controller Client', () => {
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

  describe('Static file serving', () => {
    it('serves index.html at /controller', async () => {
      const res = await request(app)
        .get('/controller/')
        .expect(200)
        .expect('Content-Type', /html/);

      assert.ok(res.text.includes('<!DOCTYPE html>'), 'should be HTML document');
      assert.ok(res.text.includes('Board Controller'), 'should have page title');
      assert.ok(res.text.includes('code-inputs'), 'should have code input element');
      assert.ok(res.text.includes('editor-screen'), 'should have editor screen');
    });

    it('serves style.css at /controller/style.css', async () => {
      const res = await request(app)
        .get('/controller/style.css')
        .expect(200)
        .expect('Content-Type', /css/);

      assert.ok(res.text.includes('.code-digit'), 'should have code digit styles');
      assert.ok(res.text.includes('#editor-table'), 'should have table styles');
      assert.ok(res.text.includes('.btn-primary'), 'should have button styles');
    });

    it('serves app.js at /controller/app.js', async () => {
      const res = await request(app)
        .get('/controller/app.js')
        .expect(200)
        .expect('Content-Type', /javascript/);

      assert.ok(res.text.includes('handleConnect'), 'should have handleConnect function');
      assert.ok(res.text.includes('loadDisplayData'), 'should have loadDisplayData function');
      assert.ok(res.text.includes('renderBoard'), 'should have renderBoard function');
      assert.ok(res.text.includes('saveData'), 'should have saveData function');
    });

    it('serves manifest.json at /controller/manifest.json', async () => {
      const res = await request(app)
        .get('/controller/manifest.json')
        .expect(200)
        .expect('Content-Type', /json/);

      const manifest = JSON.parse(res.text);
      assert.strictEqual(manifest.name, 'Board Controller');
      assert.strictEqual(manifest.start_url, '/controller/');
      assert.strictEqual(manifest.display, 'standalone');
    });
  });

  describe('Controller pairing workflow', () => {
    it('pairs with display using 6-digit code', async () => {
      // TV creates display
      const displayRes = await request(app)
        .post('/api/displays')
        .expect(201);

      const { id: displayId, pairCode } = displayRes.body;
      assert.match(pairCode, /^\d{6}$/, 'pair code should be 6 digits');

      // Controller pairs using code
      const pairRes = await request(app)
        .post('/api/pair')
        .send({ code: pairCode })
        .expect(200);

      assert.strictEqual(pairRes.body.success, true);
      assert.strictEqual(pairRes.body.displayId, displayId);
    });

    it('rejects invalid pairing codes', async () => {
      // Try pairing with non-existent code
      const res = await request(app)
        .post('/api/pair')
        .send({ code: '000000' })
        .expect(404);

      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error.includes('Invalid'), 'should have error message');
    });

    it('rejects malformed pairing codes', async () => {
      // Too short
      await request(app)
        .post('/api/pair')
        .send({ code: '123' })
        .expect(400);

      // Non-numeric
      await request(app)
        .post('/api/pair')
        .send({ code: 'abcdef' })
        .expect(400);

      // Too long
      await request(app)
        .post('/api/pair')
        .send({ code: '1234567' })
        .expect(400);
    });
  });

  describe('Controller data workflow (domain format)', () => {
    let displayId;

    beforeEach(async () => {
      const displayRes = await request(app).post('/api/displays');
      displayId = displayRes.body.id;
    });

    it('fetches display data after pairing', async () => {
      const res = await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(200);

      assert.strictEqual(res.body.id, displayId);
      assert.ok(res.body.tableData, 'should have tableData');
      assert.ok(res.body.tableData.settings, 'should have settings');
    });

    it('saves domain format data', async () => {
      const tableData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
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
        .put(`/api/displays/${displayId}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);

      // Verify saved correctly
      const getRes = await request(app).get(`/api/displays/${displayId}`);
      assert.strictEqual(getRes.body.tableData.horses.length, 2);
      assert.strictEqual(getRes.body.tableData.feeds.length, 1);
    });

    it('handles reconnection to existing display', async () => {
      const tableData = {
        settings: {
          timezone: 'Australia/Sydney',
          timeMode: 'AUTO',
          overrideUntil: null,
          zoomLevel: 2,
          currentPage: 0,
        },
        horses: [{ id: 'h1', name: 'Thunder' }],
        feeds: [],
        diet: {},
      };

      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({ tableData });

      // Simulate reconnection
      const res = await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(200);

      assert.strictEqual(res.body.id, displayId);
      assert.strictEqual(res.body.tableData.horses.length, 1);
    });

    it('handles deleted display gracefully', async () => {
      await request(app)
        .delete(`/api/displays/${displayId}`)
        .expect(200);

      // Try to reconnect (should fail)
      await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(404);
    });
  });
});
