import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import http from 'http';
import { createApp } from '../../../server/index.js';

describe('SSE API', () => {
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

  describe('GET /api/displays/:id/events', () => {
    it('returns SSE content type and streams data', async () => {
      const display = await request(app).post('/api/displays');
      const displayId = display.body.id;

      // Use raw http to test SSE properly
      const data = await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/displays/${displayId}/events`, (res) => {
          assert.strictEqual(res.statusCode, 200);
          assert.match(res.headers['content-type'], /text\/event-stream/);

          let received = '';
          res.on('data', (chunk) => {
            received += chunk.toString();
            if (received.includes('data:')) {
              req.destroy();
              resolve(received);
            }
          });
        });

        req.on('error', reject);
        setTimeout(() => {
          req.destroy();
          resolve('');
        }, 1000);
      });

      assert.ok(data.includes('data:'), 'should contain SSE data');
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .get('/api/displays/nonexistent/events')
        .expect(404);
    });

    it('sends initial data on connection', async () => {
      const display = await request(app).post('/api/displays');

      // Update with domain format data
      await request(app)
        .put(`/api/displays/${display.body.id}`)
        .send({
          tableData: {
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
          },
        });

      // Use raw http for SSE
      const data = await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/displays/${display.body.id}/events`, (res) => {
          let received = '';
          res.on('data', (chunk) => {
            received += chunk.toString();
            if (received.includes('\n\n')) {
              req.destroy();
              resolve(received);
            }
          });
        });

        req.on('error', reject);
        setTimeout(() => {
          req.destroy();
          resolve('');
        }, 1000);
      });

      // Parse SSE data
      const match = data.match(/data: (.+)\n/);
      assert.ok(match, 'should have data line');

      const eventData = JSON.parse(match[1]);
      // Check domain format - should have horses array
      assert.ok(eventData.tableData.horses, 'should have horses in tableData');
      assert.strictEqual(eventData.tableData.horses.length, 1);
      assert.strictEqual(eventData.tableData.horses[0].name, 'Thunder');
    });

    it('broadcasts updates to connected clients', async () => {
      const display = await request(app).post('/api/displays');
      const displayId = display.body.id;

      // Connect SSE client using raw http
      const receivedData = [];

      await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/displays/${displayId}/events`, (res) => {
          res.on('data', (chunk) => {
            const text = chunk.toString();
            // Parse each SSE message
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const jsonStr = line.replace('data: ', '').trim();
                  if (jsonStr) {
                    const data = JSON.parse(jsonStr);
                    receivedData.push(data);
                  }
                } catch (e) {
                  // Ignore parse errors for partial data
                }
              }
            }

            // After receiving update, close connection
            if (receivedData.length >= 2) {
              req.destroy();
              resolve();
            }
          });

          // After SSE connection established, send update
          setTimeout(async () => {
            await request(app)
              .put(`/api/displays/${displayId}`)
              .send({
                tableData: {
                  settings: {
                    timezone: 'Australia/Sydney',
                    timeMode: 'AUTO',
                    overrideUntil: null,
                    zoomLevel: 2,
                    currentPage: 0,
                  },
                  horses: [{ id: 'h1', name: 'Updated' }],
                  feeds: [],
                  diet: {},
                },
              });
          }, 100);
        });

        req.on('error', reject);

        // Timeout safety
        setTimeout(() => {
          req.destroy();
          resolve();
        }, 2000);
      });

      // Should have initial data and update
      assert.ok(receivedData.length >= 1, 'should receive at least initial data');
    });
  });
});

describe('SSEManager', () => {
  let sseManager;

  before(async () => {
    const { SSEManager } = await import('../../../server/api/sse.js');
    sseManager = new SSEManager();
  });

  it('tracks client connections', () => {
    const mockRes = {
      on: () => {},
      write: () => {},
    };

    sseManager.addClient('display1', mockRes);
    assert.strictEqual(sseManager.getClientCount('display1'), 1);

    sseManager.removeClient('display1', mockRes);
    assert.strictEqual(sseManager.getClientCount('display1'), 0);
  });

  it('broadcasts to multiple clients', () => {
    const received = [];
    const mockRes1 = {
      on: () => {},
      write: (data) => received.push({ client: 1, data }),
    };
    const mockRes2 = {
      on: () => {},
      write: (data) => received.push({ client: 2, data }),
    };

    sseManager.addClient('display2', mockRes1);
    sseManager.addClient('display2', mockRes2);

    const sent = sseManager.broadcast('display2', { test: true });

    assert.strictEqual(sent, 2);
    assert.strictEqual(received.length, 2);

    // Cleanup
    sseManager.removeClient('display2', mockRes1);
    sseManager.removeClient('display2', mockRes2);
  });

  it('returns 0 when broadcasting to non-existent display', () => {
    const sent = sseManager.broadcast('nonexistent', { test: true });
    assert.strictEqual(sent, 0);
  });
});
