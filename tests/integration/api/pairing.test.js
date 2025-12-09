import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('Pairing API', () => {
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

  describe('POST /api/pair', () => {
    it('pairs controller with valid code', async () => {
      const display = await request(app).post('/api/displays');

      const res = await request(app)
        .post('/api/pair')
        .send({ code: display.body.pairCode })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.displayId, display.body.id);
    });

    it('returns 404 for invalid code', async () => {
      const res = await request(app)
        .post('/api/pair')
        .send({ code: '000000' })
        .expect(404);

      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /invalid/i);
    });

    it('returns 400 when code is missing', async () => {
      await request(app)
        .post('/api/pair')
        .send({})
        .expect(400);
    });

    it('returns 400 when code is empty', async () => {
      await request(app)
        .post('/api/pair')
        .send({ code: '' })
        .expect(400);
    });

    it('returns 400 when code is not a string', async () => {
      await request(app)
        .post('/api/pair')
        .send({ code: 123456 })
        .expect(400);
    });

    it('returns 400 when code is not 6 digits', async () => {
      await request(app)
        .post('/api/pair')
        .send({ code: '12345' })
        .expect(400);

      await request(app)
        .post('/api/pair')
        .send({ code: '1234567' })
        .expect(400);
    });

    it('returns 400 when code contains non-digits', async () => {
      await request(app)
        .post('/api/pair')
        .send({ code: 'abc123' })
        .expect(400);
    });
  });
});
