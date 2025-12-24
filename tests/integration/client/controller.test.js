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

  describe('Controller table editing workflow', () => {
    let displayId;
    let pairCode;

    beforeEach(async () => {
      // Create and pair with a display
      const displayRes = await request(app)
        .post('/api/displays');

      displayId = displayRes.body.id;
      pairCode = displayRes.body.pairCode;
    });

    it('fetches display data after pairing', async () => {
      const res = await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(200);

      assert.strictEqual(res.body.id, displayId);
      assert.ok(res.body.tableData, 'should have tableData');
    });

    it('saves new table data', async () => {
      const tableData = {
        headers: ['Task', 'Owner', 'Status'],
        rows: [
          ['Buy groceries', 'Alice', 'To Do'],
          ['Walk the dog', 'Bob', 'Done']
        ],
        displaySettings: {
          startRow: 0,
          rowCount: 10
        }
      };

      const res = await request(app)
        .put(`/api/displays/${displayId}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);

      // Verify saved correctly
      const getRes = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.deepStrictEqual(getRes.body.tableData.headers, tableData.headers);
      assert.deepStrictEqual(getRes.body.tableData.rows, tableData.rows);
      assert.deepStrictEqual(getRes.body.tableData.displaySettings, tableData.displaySettings);
    });

    it('adds rows to existing table', async () => {
      // Initial data
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice']]
          }
        });

      // Add a row (simulating controller behavior)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice'], ['Bob']]
          }
        });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.strictEqual(res.body.tableData.rows.length, 2);
      assert.deepStrictEqual(res.body.tableData.rows[1], ['Bob']);
    });

    it('adds columns to existing table', async () => {
      // Initial data
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice']]
          }
        });

      // Add a column (simulating controller behavior)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name', 'Age'],
            rows: [['Alice', '30']]
          }
        });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.strictEqual(res.body.tableData.headers.length, 2);
      assert.deepStrictEqual(res.body.tableData.headers, ['Name', 'Age']);
    });

    it('deletes rows from table', async () => {
      // Initial data with multiple rows
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice'], ['Bob'], ['Charlie']]
          }
        });

      // Delete middle row (simulating controller behavior)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice'], ['Charlie']]
          }
        });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.strictEqual(res.body.tableData.rows.length, 2);
      assert.deepStrictEqual(res.body.tableData.rows, [['Alice'], ['Charlie']]);
    });

    it('deletes columns from table', async () => {
      // Initial data with multiple columns
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name', 'Age', 'City'],
            rows: [['Alice', '30', 'NYC']]
          }
        });

      // Delete middle column (simulating controller behavior)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name', 'City'],
            rows: [['Alice', 'NYC']]
          }
        });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.deepStrictEqual(res.body.tableData.headers, ['Name', 'City']);
      assert.deepStrictEqual(res.body.tableData.rows[0], ['Alice', 'NYC']);
    });

    it('updates display settings for TV pagination', async () => {
      const tableData = {
        headers: ['Item'],
        rows: Array.from({ length: 20 }, (_, i) => [`Item ${i + 1}`]),
        displaySettings: {
          startRow: 5,
          rowCount: 5
        }
      };

      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({ tableData });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.strictEqual(res.body.tableData.displaySettings.startRow, 5);
      assert.strictEqual(res.body.tableData.displaySettings.rowCount, 5);
    });
  });

  describe('Controller session persistence', () => {
    it('maintains data across multiple saves (simulating session)', async () => {
      const displayRes = await request(app)
        .post('/api/displays');

      const displayId = displayRes.body.id;

      // First save
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['A'],
            rows: [['1']]
          }
        });

      // Second save (edit)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['A', 'B'],
            rows: [['1', '2']]
          }
        });

      // Third save (add row)
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['A', 'B'],
            rows: [['1', '2'], ['3', '4']]
          }
        });

      // Verify final state
      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      assert.deepStrictEqual(res.body.tableData.headers, ['A', 'B']);
      assert.deepStrictEqual(res.body.tableData.rows, [['1', '2'], ['3', '4']]);
    });

    it('handles reconnection to existing display', async () => {
      // Create display and add data
      const displayRes = await request(app)
        .post('/api/displays');

      const displayId = displayRes.body.id;

      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Test'],
            rows: [['Data']]
          }
        });

      // Simulate reconnection (controller stored the ID)
      const res = await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(200);

      assert.strictEqual(res.body.id, displayId);
      assert.deepStrictEqual(res.body.tableData.headers, ['Test']);
    });

    it('handles deleted display gracefully', async () => {
      // Create and then delete display
      const displayRes = await request(app)
        .post('/api/displays');

      const displayId = displayRes.body.id;

      await request(app)
        .delete(`/api/displays/${displayId}`)
        .expect(200);

      // Try to reconnect (should fail)
      await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(404);
    });
  });

  describe('Controller sorting behavior', () => {
    let displayId;

    beforeEach(async () => {
      const displayRes = await request(app)
        .post('/api/displays');
      displayId = displayRes.body.id;
    });

    it('preserves sorted data order on save', async () => {
      // Save data in sorted order (controller sorted by name A-Z)
      const sortedData = {
        headers: ['Name', 'Age'],
        rows: [
          ['Alice', '30'],
          ['Bob', '25'],
          ['Charlie', '35']
        ]
      };

      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({ tableData: sortedData });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      // Order should be preserved
      assert.deepStrictEqual(res.body.tableData.rows[0][0], 'Alice');
      assert.deepStrictEqual(res.body.tableData.rows[1][0], 'Bob');
      assert.deepStrictEqual(res.body.tableData.rows[2][0], 'Charlie');
    });

    it('preserves reverse sorted data order on save', async () => {
      // Save data in reverse sorted order (controller sorted by name Z-A)
      const sortedData = {
        headers: ['Name', 'Age'],
        rows: [
          ['Charlie', '35'],
          ['Bob', '25'],
          ['Alice', '30']
        ]
      };

      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({ tableData: sortedData });

      const res = await request(app)
        .get(`/api/displays/${displayId}`);

      // Order should be preserved
      assert.deepStrictEqual(res.body.tableData.rows[0][0], 'Charlie');
      assert.deepStrictEqual(res.body.tableData.rows[1][0], 'Bob');
      assert.deepStrictEqual(res.body.tableData.rows[2][0], 'Alice');
    });
  });
});
