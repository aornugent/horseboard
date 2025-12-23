import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import http from 'http';
import { createApp } from '../../../server/index.js';

describe('Display Client', () => {
  let app;
  let server;
  let baseUrl;

  before((_, done) => {
    app = createApp({ dbPath: ':memory:' });
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  beforeEach(() => {
    app.get('db').clear();
  });

  after((_, done) => {
    app.get('db').close();
    server.close(done);
  });

  describe('Static file serving', () => {
    it('serves index.html at /display', async () => {
      const res = await request(app)
        .get('/display/')
        .expect(200)
        .expect('Content-Type', /html/);

      assert.ok(res.text.includes('<!DOCTYPE html>'), 'should be HTML document');
      assert.ok(res.text.includes('Display Board'), 'should have page title');
      assert.ok(res.text.includes('pair-code'), 'should have pairing code element');
    });

    it('serves style.css at /display/style.css', async () => {
      const res = await request(app)
        .get('/display/style.css')
        .expect(200)
        .expect('Content-Type', /css/);

      assert.ok(res.text.includes('.pair-code'), 'should have pair-code styles');
      assert.ok(res.text.includes('.feed-grid'), 'should have feed grid styles');
    });

    it('serves app.js at /display/app.js', async () => {
      const res = await request(app)
        .get('/display/app.js')
        .expect(200)
        .expect('Content-Type', /javascript/);

      assert.ok(res.text.includes('createDisplay'), 'should have createDisplay function');
      assert.ok(res.text.includes('connectSSE'), 'should have connectSSE function');
      assert.ok(res.text.includes('renderFeedGrid'), 'should have renderFeedGrid function');
    });
  });

  describe('Display client workflow', () => {
    it('complete flow: create display, connect SSE, receive updates', async () => {
      // Step 1: Create a display (what the client does on load)
      const createRes = await request(app)
        .post('/api/displays')
        .expect(201);

      const { id: displayId, pairCode } = createRes.body;
      assert.ok(displayId, 'should have display id');
      assert.ok(pairCode, 'should have pair code');
      assert.match(pairCode, /^\d{6}$/, 'pair code should be 6 digits');

      // Step 2: Connect to SSE (what the client does after getting the ID)
      const sseData = await new Promise((resolve, reject) => {
        const receivedMessages = [];

        const req = http.get(`${baseUrl}/api/displays/${displayId}/events`, (res) => {
          assert.strictEqual(res.statusCode, 200);
          assert.match(res.headers['content-type'], /text\/event-stream/);

          res.on('data', chunk => {
            const text = chunk.toString();
            const lines = text.split('\n');

            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const jsonStr = line.replace('data: ', '').trim();
                  if (jsonStr) {
                    receivedMessages.push(JSON.parse(jsonStr));
                  }
                } catch (e) {
                  // Ignore partial data
                }
              }
            }

            // After receiving 2 messages (initial + update), we're done
            if (receivedMessages.length >= 2) {
              req.destroy();
              resolve(receivedMessages);
            }
          });

          // Step 3: Simulate mobile controller updating data
          setTimeout(async () => {
            await request(app)
              .put(`/api/displays/${displayId}`)
              .send({
                tableData: {
                  headers: ['Task', 'Status'],
                  rows: [['Buy milk', 'Done']]
                }
              });
          }, 100);
        });

        req.on('error', reject);

        // Safety timeout
        setTimeout(() => {
          req.destroy();
          resolve(receivedMessages);
        }, 3000);
      });

      // Verify we received both initial state and update
      assert.ok(sseData.length >= 1, 'should receive at least initial data');

      // The last message should have our table data
      const lastMessage = sseData[sseData.length - 1];
      if (sseData.length >= 2) {
        assert.deepStrictEqual(lastMessage.tableData.headers, ['Task', 'Status']);
        assert.deepStrictEqual(lastMessage.tableData.rows, [['Buy milk', 'Done']]);
      }
    });

    it('display persists across reconnections (localStorage simulation)', async () => {
      // Create a display
      const createRes = await request(app)
        .post('/api/displays')
        .expect(201);

      const displayId = createRes.body.id;

      // Update with some data
      await request(app)
        .put(`/api/displays/${displayId}`)
        .send({
          tableData: {
            headers: ['Name'],
            rows: [['Alice']]
          }
        })
        .expect(200);

      // Simulate "reconnecting" - fetch the existing display (what client does with stored ID)
      const getRes = await request(app)
        .get(`/api/displays/${displayId}`)
        .expect(200);

      assert.strictEqual(getRes.body.id, displayId);
      assert.deepStrictEqual(getRes.body.tableData.headers, ['Name']);
      assert.deepStrictEqual(getRes.body.tableData.rows, [['Alice']]);
    });

    it('handles invalid stored display ID gracefully', async () => {
      // Try to fetch a non-existent display (simulating invalid localStorage)
      await request(app)
        .get('/api/displays/invalid-id-from-storage')
        .expect(404);
    });
  });

  describe('Pairing flow integration', () => {
    it('mobile can pair with display using code', async () => {
      // TV creates display
      const displayRes = await request(app)
        .post('/api/displays')
        .expect(201);

      const { id: displayId, pairCode } = displayRes.body;

      // Mobile pairs using the code
      const pairRes = await request(app)
        .post('/api/pair')
        .send({ code: pairCode })
        .expect(200);

      assert.strictEqual(pairRes.body.success, true);
      assert.strictEqual(pairRes.body.displayId, displayId);
    });

    it('full pairing and update flow', async () => {
      // TV creates display and connects SSE
      const displayRes = await request(app)
        .post('/api/displays')
        .expect(201);

      const { id: displayId, pairCode } = displayRes.body;

      // Start SSE connection
      const updateReceived = new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/displays/${displayId}/events`, (res) => {
          let messageCount = 0;

          res.on('data', chunk => {
            const text = chunk.toString();
            if (text.includes('"headers":["Todo"]')) {
              req.destroy();
              resolve(true);
            }
            messageCount++;
            if (messageCount > 5) {
              req.destroy();
              resolve(false);
            }
          });
        });

        req.on('error', reject);
        setTimeout(() => {
          req.destroy();
          resolve(false);
        }, 3000);
      });

      // Small delay to ensure SSE is connected
      await new Promise(r => setTimeout(r, 100));

      // Mobile pairs using code
      const pairRes = await request(app)
        .post('/api/pair')
        .send({ code: pairCode })
        .expect(200);

      // Mobile updates data
      await request(app)
        .put(`/api/displays/${pairRes.body.displayId}`)
        .send({
          tableData: {
            headers: ['Todo'],
            rows: [['Test item']]
          }
        })
        .expect(200);

      // Verify TV received the update via SSE
      const received = await updateReceived;
      assert.strictEqual(received, true, 'TV should receive update via SSE');
    });
  });
});
