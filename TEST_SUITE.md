# Test Suite

This document describes the implemented test suite for the Dynamic Information Board.

## Testing Philosophy

- **Simple over complex:** Minimal dependencies, easy to understand
- **Fast feedback:** Tests run in under 3 seconds
- **Node.js native:** Uses built-in test runner, no extra frameworks

## Test Stack

```json
{
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

| Tool | Purpose |
|------|---------|
| `node:test` | Built-in Node.js test runner |
| `node:assert` | Built-in assertion library |
| Supertest | HTTP API testing |

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
```

## Test Structure

```
tests/
├── unit/
│   └── db/
│       └── sqlite.test.js      # Database layer tests (15 tests)
└── integration/
    └── api/
        ├── displays.test.js    # Display CRUD tests (12 tests)
        ├── pairing.test.js     # Pairing flow tests (7 tests)
        └── sse.test.js         # SSE streaming tests (7 tests)
```

## Test Coverage

### Unit Tests: Database Layer (15 tests)

| Test | Description |
|------|-------------|
| `initialize()` | Creates displays table, is idempotent |
| `createDisplay()` | Generates unique IDs and pair codes |
| `getDisplayById()` | Retrieves display, returns null for missing |
| `getDisplayByPairCode()` | Finds display by code |
| `updateDisplayData()` | Updates table data, returns false for missing |
| `deleteDisplay()` | Removes display, returns false for missing |
| `clear()` | Removes all displays |

### Integration Tests: Display API (12 tests)

| Endpoint | Tests |
|----------|-------|
| `POST /api/displays` | Creates display, returns unique IDs |
| `GET /api/displays/:id` | Returns data, 404 for missing |
| `PUT /api/displays/:id` | Updates data, validates input, 404 for missing |
| `DELETE /api/displays/:id` | Removes display, 404 for missing |

### Integration Tests: Pairing API (7 tests)

| Test | Description |
|------|-------------|
| Valid code | Pairs successfully, returns displayId |
| Invalid code | Returns 404 with error message |
| Missing code | Returns 400 |
| Empty code | Returns 400 |
| Non-string code | Returns 400 |
| Wrong length | Returns 400 |
| Non-digit code | Returns 400 |

### Integration Tests: SSE API (7 tests)

| Test | Description |
|------|-------------|
| Content type | Returns `text/event-stream` |
| 404 for missing | Returns 404 for non-existent display |
| Initial data | Sends current state on connection |
| Broadcasts | Sends updates to connected clients |
| SSEManager | Tracks connections, broadcasts to multiple clients |

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Feature', () => {
  before(() => {
    // Setup once before all tests
  });

  beforeEach(() => {
    // Setup before each test
  });

  after(() => {
    // Cleanup after all tests
  });

  it('should do something', () => {
    assert.strictEqual(actual, expected);
  });
});
```

### API Test Pattern

```javascript
import request from 'supertest';
import { createApp } from '../../../server/index.js';

describe('API', () => {
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

  it('creates resource', async () => {
    const res = await request(app)
      .post('/api/resource')
      .send({ data: 'value' })
      .expect(201);

    assert.ok(res.body.id);
  });
});
```

## Test Results

```
# tests 41
# suites 18
# pass 41
# fail 0
# duration_ms ~2800
```

## Future Tests (Phase 3+)

When implementing client apps, add:

- **Client unit tests** - DOM rendering, event handlers
- **E2E tests** - Full pairing and editing flows with Playwright

These can be added when the client code is implemented.
