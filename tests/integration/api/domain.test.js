import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('Domain Data API', () => {
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

  /**
   * Helper to create a valid domain data payload
   */
  function createValidDomainData(overrides = {}) {
    return {
      settings: {
        timezone: 'Australia/Sydney',
        timeMode: 'AUTO',
        overrideUntil: null,
        zoomLevel: 2,
        currentPage: 0,
        ...overrides.settings
      },
      feeds: overrides.feeds || [],
      horses: overrides.horses || [],
      diet: overrides.diet || {}
    };
  }

  describe('Domain structure validation', () => {
    it('accepts valid empty domain data', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData();

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });

    it('accepts valid domain data with feeds and horses', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [
          { id: 'f1', name: 'Easisport', unit: 'scoop' },
          { id: 'f2', name: 'Bute', unit: 'sachet' }
        ],
        horses: [
          { id: 'h1', name: 'Spider' },
          { id: 'h2', name: 'Lightning' }
        ],
        diet: {
          h1: { f1: { am: 0.5, pm: 0.5 } },
          h2: { f1: { am: 1, pm: 1 }, f2: { am: 1, pm: 0 } }
        }
      });

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });

    it('rejects missing settings', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = {
        feeds: [],
        horses: [],
        diet: {}
      };

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects invalid timeMode', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        settings: { timeMode: 'INVALID' }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects invalid zoomLevel', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        settings: { zoomLevel: 5 }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects negative currentPage', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        settings: { currentPage: -1 }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects feed with missing id', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [{ name: 'Easisport', unit: 'scoop' }]
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects feed with empty name', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [{ id: 'f1', name: '', unit: 'scoop' }]
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects horse with missing id', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        horses: [{ name: 'Spider' }]
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('rejects horse with empty name', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        horses: [{ id: 'h1', name: '' }]
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });

    it('accepts horse with note and expiry', async () => {
      const created = await request(app).post('/api/displays');
      const now = Date.now();
      const tableData = createValidDomainData({
        horses: [{
          id: 'h1',
          name: 'Spider',
          note: 'Turn out early',
          noteExpiry: now + 86400000,
          noteCreatedAt: now
        }]
      });

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });

    it('rejects invalid diet entry (am not a number)', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [{ id: 'f1', name: 'Easisport', unit: 'scoop' }],
        horses: [{ id: 'h1', name: 'Spider' }],
        diet: {
          h1: { f1: { am: 'half', pm: 0.5 } }
        }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(400);
    });
  });

  describe('Feed ranking calculation', () => {
    it('calculates ranks based on usage count', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [
          { id: 'f1', name: 'Chaff', unit: 'scoop' },      // used by 1 horse
          { id: 'f2', name: 'Easisport', unit: 'scoop' },  // used by 2 horses
          { id: 'f3', name: 'Bute', unit: 'sachet' }       // used by 0 horses
        ],
        horses: [
          { id: 'h1', name: 'Spider' },
          { id: 'h2', name: 'Lightning' }
        ],
        diet: {
          h1: {
            f1: { am: 1, pm: 1 },
            f2: { am: 0.5, pm: 0.5 }
          },
          h2: {
            f2: { am: 1, pm: 1 }  // Only uses f2
          }
        }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      const feeds = fetched.body.tableData.feeds;

      // f2 used by 2 horses should be rank 1
      const f2 = feeds.find(f => f.id === 'f2');
      assert.strictEqual(f2.rank, 1, 'Easisport (used by 2) should be rank 1');

      // f1 used by 1 horse should be rank 2
      const f1 = feeds.find(f => f.id === 'f1');
      assert.strictEqual(f1.rank, 2, 'Chaff (used by 1) should be rank 2');

      // f3 used by 0 horses should be rank 3
      const f3 = feeds.find(f => f.id === 'f3');
      assert.strictEqual(f3.rank, 3, 'Bute (used by 0) should be rank 3');
    });

    it('only counts usage when AM or PM > 0', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [
          { id: 'f1', name: 'Feed1', unit: 'scoop' },
          { id: 'f2', name: 'Feed2', unit: 'scoop' }
        ],
        horses: [
          { id: 'h1', name: 'Horse1' }
        ],
        diet: {
          h1: {
            f1: { am: 0, pm: 0 },       // Zero usage - should not count
            f2: { am: 0.5, pm: 0 }      // Counts as used (am > 0)
          }
        }
      });

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      const feeds = fetched.body.tableData.feeds;

      const f2 = feeds.find(f => f.id === 'f2');
      const f1 = feeds.find(f => f.id === 'f1');

      assert.strictEqual(f2.rank, 1, 'Feed2 (used) should be rank 1');
      assert.strictEqual(f1.rank, 2, 'Feed1 (not used) should be rank 2');
    });

    it('assigns sequential ranks to empty feeds array', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = createValidDomainData({
        feeds: [],
        horses: [{ id: 'h1', name: 'Spider' }],
        diet: {}
      });

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });
  });

  describe('Cascade cleanup', () => {
    it('removes diet entries for deleted feeds', async () => {
      const created = await request(app).post('/api/displays');

      // First save with f1 and f2
      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({
          tableData: createValidDomainData({
            feeds: [
              { id: 'f1', name: 'Feed1', unit: 'scoop' },
              { id: 'f2', name: 'Feed2', unit: 'scoop' }
            ],
            horses: [{ id: 'h1', name: 'Horse1' }],
            diet: {
              h1: {
                f1: { am: 1, pm: 1 },
                f2: { am: 0.5, pm: 0.5 }
              }
            }
          })
        });

      // Now save without f2 (deleting it)
      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({
          tableData: createValidDomainData({
            feeds: [
              { id: 'f1', name: 'Feed1', unit: 'scoop' }
            ],
            horses: [{ id: 'h1', name: 'Horse1' }],
            diet: {
              h1: {
                f1: { am: 1, pm: 1 },
                f2: { am: 0.5, pm: 0.5 }  // This should be removed
              }
            }
          })
        });

      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      const diet = fetched.body.tableData.diet;

      assert.ok(diet.h1.f1, 'f1 diet entry should exist');
      assert.strictEqual(diet.h1.f2, undefined, 'f2 diet entry should be removed');
    });

    it('removes diet entries for deleted horses', async () => {
      const created = await request(app).post('/api/displays');

      // First save with h1 and h2
      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({
          tableData: createValidDomainData({
            feeds: [{ id: 'f1', name: 'Feed1', unit: 'scoop' }],
            horses: [
              { id: 'h1', name: 'Horse1' },
              { id: 'h2', name: 'Horse2' }
            ],
            diet: {
              h1: { f1: { am: 1, pm: 1 } },
              h2: { f1: { am: 0.5, pm: 0.5 } }
            }
          })
        });

      // Now save without h2 (deleting it)
      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({
          tableData: createValidDomainData({
            feeds: [{ id: 'f1', name: 'Feed1', unit: 'scoop' }],
            horses: [
              { id: 'h1', name: 'Horse1' }
            ],
            diet: {
              h1: { f1: { am: 1, pm: 1 } },
              h2: { f1: { am: 0.5, pm: 0.5 } }  // This should be removed
            }
          })
        });

      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      const diet = fetched.body.tableData.diet;

      assert.ok(diet.h1, 'h1 diet should exist');
      assert.strictEqual(diet.h2, undefined, 'h2 diet should be removed');
    });

    it('handles empty diet when all horses removed', async () => {
      const created = await request(app).post('/api/displays');

      await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({
          tableData: createValidDomainData({
            feeds: [{ id: 'f1', name: 'Feed1', unit: 'scoop' }],
            horses: [],
            diet: {
              h1: { f1: { am: 1, pm: 1 } }
            }
          })
        });

      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      const diet = fetched.body.tableData.diet;

      assert.deepStrictEqual(diet, {}, 'diet should be empty when no horses');
    });
  });

});
