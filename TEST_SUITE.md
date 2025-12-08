# Test Suite Proposal

This document outlines a simple but effective test suite covering all MVP phases of the Dynamic Information Board.

## Testing Philosophy

- **Simple over complex:** Minimal dependencies, easy to understand
- **Fast feedback:** Unit tests run in milliseconds
- **Realistic coverage:** Integration tests verify actual behavior
- **End-to-end confidence:** Critical user flows are validated

## Test Stack

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "supertest": "^6.3.0",
    "@testing-library/dom": "^9.0.0",
    "happy-dom": "^12.0.0",
    "playwright": "^1.40.0"
  }
}
```

| Tool | Purpose |
|------|---------|
| Vitest | Fast unit/integration test runner |
| Supertest | HTTP API testing |
| Testing Library | DOM testing for client code |
| Happy-DOM | Lightweight browser environment |
| Playwright | End-to-end browser testing |

## Project Test Structure

```
horseboard/
├── tests/
│   ├── unit/
│   │   ├── db/
│   │   │   └── sqlite.test.js
│   │   └── services/
│   │       └── display.test.js
│   ├── integration/
│   │   ├── api/
│   │   │   ├── displays.test.js
│   │   │   ├── pairing.test.js
│   │   │   └── sse.test.js
│   │   └── client/
│   │       ├── display.test.js
│   │       └── controller.test.js
│   ├── e2e/
│   │   ├── pairing.spec.js
│   │   └── editing.spec.js
│   └── helpers/
│       ├── db.js          # Test database utilities
│       └── fixtures.js    # Sample data
├── vitest.config.js
└── playwright.config.js
```

---

## Phase 1: Project Setup Tests

### 1.1 Express Server Tests

**File:** `tests/integration/server.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/index.js';

describe('Server Setup', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  it('serves static files for display client', async () => {
    const res = await request(app).get('/display/');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
  });

  it('serves static files for controller client', async () => {
    const res = await request(app).get('/controller/');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
  });
});
```

### 1.2 Database Layer Tests

**File:** `tests/unit/db/sqlite.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../../server/db/sqlite.js';
import fs from 'fs';

describe('SQLite Database', () => {
  let db;
  const testDbPath = './test-db.sqlite';

  beforeEach(() => {
    db = new Database(testDbPath);
    db.initialize();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialize()', () => {
    it('creates displays table if not exists', () => {
      const tables = db.getTables();
      expect(tables).toContain('displays');
    });

    it('is idempotent (can run multiple times)', () => {
      expect(() => db.initialize()).not.toThrow();
      expect(() => db.initialize()).not.toThrow();
    });
  });

  describe('createDisplay()', () => {
    it('creates a display with id and pair code', () => {
      const display = db.createDisplay();
      expect(display.id).toBeDefined();
      expect(display.pairCode).toMatch(/^\d{6}$/);
    });

    it('generates unique pair codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const display = db.createDisplay();
        codes.add(display.pairCode);
      }
      expect(codes.size).toBe(100);
    });
  });

  describe('getDisplayById()', () => {
    it('returns display by id', () => {
      const created = db.createDisplay();
      const found = db.getDisplayById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.pairCode).toBe(created.pairCode);
    });

    it('returns null for non-existent id', () => {
      const found = db.getDisplayById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('getDisplayByPairCode()', () => {
    it('returns display by pair code', () => {
      const created = db.createDisplay();
      const found = db.getDisplayByPairCode(created.pairCode);
      expect(found.id).toBe(created.id);
    });

    it('returns null for invalid pair code', () => {
      const found = db.getDisplayByPairCode('000000');
      expect(found).toBeNull();
    });
  });

  describe('updateDisplayData()', () => {
    it('updates table data', () => {
      const display = db.createDisplay();
      const tableData = {
        headers: ['Task', 'Status'],
        rows: [['Buy milk', 'Done']]
      };

      db.updateDisplayData(display.id, tableData);

      const updated = db.getDisplayById(display.id);
      expect(updated.tableData).toEqual(tableData);
    });

    it('updates the updatedAt timestamp', async () => {
      const display = db.createDisplay();
      const originalTime = display.updatedAt;

      await new Promise(r => setTimeout(r, 10));

      db.updateDisplayData(display.id, { headers: [], rows: [] });

      const updated = db.getDisplayById(display.id);
      expect(updated.updatedAt).not.toBe(originalTime);
    });
  });

  describe('deleteDisplay()', () => {
    it('removes display from database', () => {
      const display = db.createDisplay();
      db.deleteDisplay(display.id);
      expect(db.getDisplayById(display.id)).toBeNull();
    });
  });
});
```

---

## Phase 2: Backend API Tests

### 2.1 Display CRUD API Tests

**File:** `tests/integration/api/displays.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../server/index.js';
import { resetTestDatabase } from '../../helpers/db.js';

describe('Display API', () => {
  let app;

  beforeAll(() => {
    app = createApp({ dbPath: ':memory:' });
  });

  beforeEach(() => {
    resetTestDatabase(app);
  });

  describe('POST /api/displays', () => {
    it('creates a new display', async () => {
      const res = await request(app)
        .post('/api/displays')
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.pairCode).toMatch(/^\d{6}$/);
    });

    it('returns unique ids for each display', async () => {
      const res1 = await request(app).post('/api/displays');
      const res2 = await request(app).post('/api/displays');

      expect(res1.body.id).not.toBe(res2.body.id);
    });
  });

  describe('GET /api/displays/:id', () => {
    it('returns display data', async () => {
      const created = await request(app).post('/api/displays');

      const res = await request(app)
        .get(`/api/displays/${created.body.id}`)
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
      expect(res.body.tableData).toBeDefined();
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .get('/api/displays/nonexistent')
        .expect(404);
    });
  });

  describe('PUT /api/displays/:id', () => {
    it('updates table data', async () => {
      const created = await request(app).post('/api/displays');
      const tableData = {
        headers: ['Name', 'Age'],
        rows: [['Alice', '30'], ['Bob', '25']]
      };

      const res = await request(app)
        .put(`/api/displays/${created.body.id}`)
        .send({ tableData })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify update persisted
      const fetched = await request(app).get(`/api/displays/${created.body.id}`);
      expect(fetched.body.tableData).toEqual(tableData);
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .put('/api/displays/nonexistent')
        .send({ tableData: {} })
        .expect(404);
    });

    it('validates tableData structure', async () => {
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
  });
});
```

### 2.2 Pairing API Tests

**File:** `tests/integration/api/pairing.test.js`

```javascript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../server/index.js';
import { resetTestDatabase } from '../../helpers/db.js';

describe('Pairing API', () => {
  let app;

  beforeAll(() => {
    app = createApp({ dbPath: ':memory:' });
  });

  beforeEach(() => {
    resetTestDatabase(app);
  });

  describe('POST /api/pair', () => {
    it('pairs controller with valid code', async () => {
      const display = await request(app).post('/api/displays');

      const res = await request(app)
        .post('/api/pair')
        .send({ code: display.body.pairCode })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.displayId).toBe(display.body.id);
    });

    it('returns 404 for invalid code', async () => {
      const res = await request(app)
        .post('/api/pair')
        .send({ code: '000000' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid/i);
    });

    it('validates code format', async () => {
      await request(app)
        .post('/api/pair')
        .send({ code: 'abc' })
        .expect(400);

      await request(app)
        .post('/api/pair')
        .send({ code: '' })
        .expect(400);

      await request(app)
        .post('/api/pair')
        .send({})
        .expect(400);
    });
  });
});
```

### 2.3 Server-Sent Events Tests

**File:** `tests/integration/api/sse.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../server/index.js';
import { resetTestDatabase } from '../../helpers/db.js';

describe('SSE API', () => {
  let app;
  let server;

  beforeAll((done) => {
    app = createApp({ dbPath: ':memory:' });
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    resetTestDatabase(app);
  });

  describe('GET /api/displays/:id/events', () => {
    it('returns SSE content type', async () => {
      const display = await request(app).post('/api/displays');

      const res = await request(server)
        .get(`/api/displays/${display.body.id}/events`)
        .set('Accept', 'text/event-stream')
        .expect('Content-Type', /text\/event-stream/)
        .expect(200)
        .timeout(1000)
        .catch(() => {}); // Timeout expected for SSE
    });

    it('receives update event when data changes', (done) => {
      let displayId;
      let eventSource;

      // Create display
      request(app)
        .post('/api/displays')
        .then((res) => {
          displayId = res.body.id;
          const port = server.address().port;

          // Connect to SSE
          const EventSource = require('eventsource');
          eventSource = new EventSource(
            `http://localhost:${port}/api/displays/${displayId}/events`
          );

          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            expect(data.tableData).toBeDefined();
            eventSource.close();
            done();
          };

          // Update display after connection established
          setTimeout(() => {
            request(app)
              .put(`/api/displays/${displayId}`)
              .send({ tableData: { headers: ['Test'], rows: [] } })
              .then(() => {});
          }, 100);
        });
    });

    it('returns 404 for non-existent display', async () => {
      await request(app)
        .get('/api/displays/nonexistent/events')
        .expect(404);
    });
  });
});
```

---

## Phase 3: TV Display Tests

### 3.1 Display Client Tests

**File:** `tests/integration/client/display.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'fs';

describe('TV Display Client', () => {
  let window;
  let document;
  let localStorage;

  beforeEach(() => {
    window = new Window();
    document = window.document;
    localStorage = window.localStorage;

    // Load display HTML
    const html = readFileSync('./client/display/index.html', 'utf-8');
    document.body.innerHTML = html;

    // Mock fetch
    window.fetch = vi.fn();
  });

  describe('Pairing Screen', () => {
    it('displays pairing code prominently', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'd_123', pairCode: '847291' })
      });

      // Trigger initialization
      await import('../../../client/display/app.js');

      const codeElement = document.querySelector('[data-testid="pair-code"]');
      expect(codeElement).toBeDefined();
      expect(codeElement.textContent).toBe('847291');
    });

    it('stores displayId in localStorage', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'd_123', pairCode: '847291' })
      });

      await import('../../../client/display/app.js');

      expect(localStorage.getItem('displayId')).toBe('d_123');
    });

    it('reuses existing displayId from localStorage', async () => {
      localStorage.setItem('displayId', 'd_existing');

      await import('../../../client/display/app.js');

      expect(window.fetch).not.toHaveBeenCalledWith('/api/displays', expect.any(Object));
    });
  });

  describe('Table Display', () => {
    it('renders table from data', () => {
      const tableData = {
        headers: ['Task', 'Owner', 'Status'],
        rows: [
          ['Buy milk', 'Alice', 'Done'],
          ['Walk dog', 'Bob', 'Pending']
        ]
      };

      // Call render function with test data
      const { renderTable } = require('../../../client/display/app.js');
      renderTable(tableData);

      const headers = document.querySelectorAll('th');
      expect(headers.length).toBe(3);
      expect(headers[0].textContent).toBe('Task');

      const rows = document.querySelectorAll('tbody tr');
      expect(rows.length).toBe(2);
    });

    it('shows empty state when no data', () => {
      const { renderTable } = require('../../../client/display/app.js');
      renderTable(null);

      const emptyState = document.querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeDefined();
    });

    it('handles pagination display settings', () => {
      const tableData = {
        headers: ['Item'],
        rows: Array(20).fill(['Row']),
        displaySettings: { startRow: 0, rowCount: 10 }
      };

      const { renderTable } = require('../../../client/display/app.js');
      renderTable(tableData);

      const rows = document.querySelectorAll('tbody tr');
      expect(rows.length).toBe(10);
    });
  });

  describe('SSE Connection', () => {
    it('connects to SSE endpoint after initialization', async () => {
      const mockEventSource = vi.fn();
      window.EventSource = mockEventSource;
      localStorage.setItem('displayId', 'd_123');

      await import('../../../client/display/app.js');

      expect(mockEventSource).toHaveBeenCalledWith('/api/displays/d_123/events');
    });

    it('updates display when receiving SSE message', async () => {
      // Test SSE message handling
      const { handleSSEMessage } = require('../../../client/display/app.js');

      const event = {
        data: JSON.stringify({
          tableData: { headers: ['New'], rows: [['Data']] }
        })
      };

      handleSSEMessage(event);

      const header = document.querySelector('th');
      expect(header.textContent).toBe('New');
    });
  });
});
```

---

## Phase 4: Mobile Controller Tests

### 4.1 Controller Client Tests

**File:** `tests/integration/client/controller.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Window } from 'happy-dom';
import { fireEvent, getByTestId, getByText } from '@testing-library/dom';
import { readFileSync } from 'fs';

describe('Mobile Controller Client', () => {
  let window;
  let document;
  let localStorage;

  beforeEach(() => {
    window = new Window();
    document = window.document;
    localStorage = window.localStorage;

    // Load controller HTML
    const html = readFileSync('./client/controller/index.html', 'utf-8');
    document.body.innerHTML = html;

    window.fetch = vi.fn();
  });

  describe('Pairing Screen', () => {
    it('shows 6-digit code input', () => {
      const inputs = document.querySelectorAll('[data-testid="code-digit"]');
      expect(inputs.length).toBe(6);
    });

    it('auto-focuses next digit on input', () => {
      const inputs = document.querySelectorAll('[data-testid="code-digit"]');

      fireEvent.input(inputs[0], { target: { value: '8' } });

      expect(document.activeElement).toBe(inputs[1]);
    });

    it('submits code when all digits entered', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, displayId: 'd_123' })
      });

      const inputs = document.querySelectorAll('[data-testid="code-digit"]');
      const code = '847291';

      code.split('').forEach((digit, i) => {
        fireEvent.input(inputs[i], { target: { value: digit } });
      });

      expect(window.fetch).toHaveBeenCalledWith('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '847291' })
      });
    });

    it('shows error for invalid code', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ success: false, error: 'Invalid pairing code' })
      });

      const connectBtn = document.querySelector('[data-testid="connect-btn"]');
      fireEvent.click(connectBtn);

      await new Promise(r => setTimeout(r, 100));

      const error = document.querySelector('[data-testid="error-message"]');
      expect(error.textContent).toMatch(/invalid/i);
    });

    it('stores displayId on successful pairing', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, displayId: 'd_123' })
      });

      const { handlePairing } = require('../../../client/controller/app.js');
      await handlePairing('847291');

      expect(localStorage.getItem('displayId')).toBe('d_123');
    });
  });

  describe('Table Editor', () => {
    beforeEach(() => {
      localStorage.setItem('displayId', 'd_123');

      // Mock successful data fetch
      window.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'd_123',
          tableData: {
            headers: ['Task', 'Status'],
            rows: [['Buy milk', 'Done']]
          }
        })
      });
    });

    it('loads and displays table data', async () => {
      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      const cells = document.querySelectorAll('[data-testid="cell"]');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('allows cell editing on tap', async () => {
      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      const cell = document.querySelector('[data-testid="cell"]');
      fireEvent.click(cell);

      const input = document.querySelector('[data-testid="cell-input"]');
      expect(input).toBeDefined();
      expect(document.activeElement).toBe(input);
    });

    it('adds row when add-row button clicked', async () => {
      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      const initialRows = document.querySelectorAll('tbody tr').length;

      const addRowBtn = document.querySelector('[data-testid="add-row"]');
      fireEvent.click(addRowBtn);

      const newRows = document.querySelectorAll('tbody tr').length;
      expect(newRows).toBe(initialRows + 1);
    });

    it('adds column when add-column button clicked', async () => {
      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      const initialCols = document.querySelectorAll('th').length;

      const addColBtn = document.querySelector('[data-testid="add-column"]');
      fireEvent.click(addColBtn);

      const newCols = document.querySelectorAll('th').length;
      expect(newCols).toBe(initialCols + 1);
    });

    it('sorts by column when header clicked', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tableData: {
            headers: ['Name'],
            rows: [['Charlie'], ['Alice'], ['Bob']]
          }
        })
      });

      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      const header = document.querySelector('th');
      fireEvent.click(header);

      const firstCell = document.querySelector('tbody tr td');
      expect(firstCell.textContent).toBe('Alice');
    });

    it('saves changes on save button click', async () => {
      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      window.fetch.mockClear();
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const saveBtn = document.querySelector('[data-testid="save-btn"]');
      fireEvent.click(saveBtn);

      expect(window.fetch).toHaveBeenCalledWith('/api/displays/d_123', expect.objectContaining({
        method: 'PUT'
      }));
    });

    it('debounces auto-save on cell changes', async () => {
      vi.useFakeTimers();

      const { loadTableData } = require('../../../client/controller/app.js');
      await loadTableData();

      window.fetch.mockClear();

      // Simulate rapid edits
      const cell = document.querySelector('[data-testid="cell"]');
      for (let i = 0; i < 5; i++) {
        fireEvent.input(cell, { target: { value: `change ${i}` } });
      }

      // Only one save should be queued
      vi.advanceTimersByTime(1000);
      expect(window.fetch).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('TV Pagination Control', () => {
    beforeEach(() => {
      localStorage.setItem('displayId', 'd_123');
    });

    it('shows TV view controls', async () => {
      const tvViewSection = document.querySelector('[data-testid="tv-view"]');
      expect(tvViewSection).toBeDefined();
    });

    it('allows selecting visible row range', async () => {
      const { setDisplayRange } = require('../../../client/controller/app.js');

      await setDisplayRange(0, 10);

      // Should include displaySettings in save
      expect(window.fetch).toHaveBeenCalledWith('/api/displays/d_123', expect.objectContaining({
        body: expect.stringContaining('displaySettings')
      }));
    });
  });
});
```

---

## Phase 5: PWA Tests

### 5.1 PWA Feature Tests

**File:** `tests/unit/pwa.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

describe('PWA Configuration', () => {
  let manifest;

  beforeEach(() => {
    manifest = JSON.parse(
      readFileSync('./client/controller/manifest.json', 'utf-8')
    );
  });

  describe('manifest.json', () => {
    it('has required fields for installability', () => {
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBe('standalone');
      expect(manifest.icons).toBeDefined();
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('has icons of required sizes', () => {
      const sizes = manifest.icons.map(i => i.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });

    it('has theme and background colors', () => {
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
    });
  });
});
```

### 5.2 Service Worker Tests

**File:** `tests/unit/service-worker.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Service Worker', () => {
  let sw;
  let caches;
  let fetchEvent;

  beforeEach(() => {
    caches = {
      open: vi.fn().mockResolvedValue({
        put: vi.fn(),
        match: vi.fn()
      }),
      match: vi.fn()
    };

    global.caches = caches;
    global.self = { addEventListener: vi.fn() };

    sw = require('../../../client/controller/sw.js');
  });

  describe('install event', () => {
    it('caches essential assets', async () => {
      const installHandler = global.self.addEventListener.mock.calls
        .find(c => c[0] === 'install')[1];

      const event = {
        waitUntil: vi.fn()
      };

      await installHandler(event);
      expect(caches.open).toHaveBeenCalled();
    });
  });

  describe('fetch event', () => {
    it('returns cached response when available', async () => {
      const cachedResponse = { ok: true };
      caches.match.mockResolvedValue(cachedResponse);

      const fetchHandler = global.self.addEventListener.mock.calls
        .find(c => c[0] === 'fetch')[1];

      const event = {
        request: { url: '/controller/app.js' },
        respondWith: vi.fn()
      };

      await fetchHandler(event);
      expect(event.respondWith).toHaveBeenCalled();
    });
  });
});
```

---

## Phase 6: End-to-End Tests

### 6.1 Pairing Flow E2E Test

**File:** `tests/e2e/pairing.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Pairing Flow', () => {
  test('complete pairing between TV and mobile', async ({ browser }) => {
    // Open TV display
    const tvContext = await browser.newContext();
    const tvPage = await tvContext.newPage();
    await tvPage.goto('/display');

    // Wait for pair code to appear
    const pairCode = await tvPage.locator('[data-testid="pair-code"]').textContent();
    expect(pairCode).toMatch(/^\d{6}$/);

    // Open mobile controller
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 } // iPhone SE
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('/controller');

    // Enter pair code
    const digits = pairCode.split('');
    for (let i = 0; i < 6; i++) {
      await mobilePage.locator(`[data-testid="code-digit"]:nth-child(${i + 1})`).fill(digits[i]);
    }

    // Click connect
    await mobilePage.locator('[data-testid="connect-btn"]').click();

    // Verify navigation to editor
    await expect(mobilePage.locator('[data-testid="table-editor"]')).toBeVisible();

    // Clean up
    await tvContext.close();
    await mobileContext.close();
  });

  test('shows error for invalid pair code', async ({ page }) => {
    await page.goto('/controller');

    // Enter invalid code
    for (let i = 0; i < 6; i++) {
      await page.locator(`[data-testid="code-digit"]:nth-child(${i + 1})`).fill('0');
    }

    await page.locator('[data-testid="connect-btn"]').click();

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid/i);
  });
});
```

### 6.2 Editing Flow E2E Test

**File:** `tests/e2e/editing.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Real-time Editing', () => {
  test.beforeEach(async ({ browser }) => {
    // Set up paired session
  });

  test('TV updates when mobile edits cell', async ({ browser }) => {
    // Create paired session
    const tvContext = await browser.newContext();
    const tvPage = await tvContext.newPage();
    await tvPage.goto('/display');

    const pairCode = await tvPage.locator('[data-testid="pair-code"]').textContent();

    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 }
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('/controller');

    // Pair devices
    const digits = pairCode.split('');
    for (let i = 0; i < 6; i++) {
      await mobilePage.locator(`[data-testid="code-digit"]:nth-child(${i + 1})`).fill(digits[i]);
    }
    await mobilePage.locator('[data-testid="connect-btn"]').click();

    // Add data on mobile
    await mobilePage.locator('[data-testid="add-row"]').click();
    await mobilePage.locator('[data-testid="cell"]:first-child').click();
    await mobilePage.locator('[data-testid="cell-input"]').fill('Test Task');
    await mobilePage.locator('[data-testid="save-btn"]').click();

    // Verify TV shows update (real-time via SSE)
    await expect(tvPage.locator('td')).toContainText('Test Task');

    await tvContext.close();
    await mobileContext.close();
  });

  test('data persists after page refresh', async ({ browser }) => {
    // Setup paired session and add data
    const tvContext = await browser.newContext();
    const tvPage = await tvContext.newPage();
    await tvPage.goto('/display');

    const pairCode = await tvPage.locator('[data-testid="pair-code"]').textContent();

    const mobileContext = await browser.newContext();
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('/controller');

    // Pair and add data
    const digits = pairCode.split('');
    for (let i = 0; i < 6; i++) {
      await mobilePage.locator(`[data-testid="code-digit"]:nth-child(${i + 1})`).fill(digits[i]);
    }
    await mobilePage.locator('[data-testid="connect-btn"]').click();
    await mobilePage.locator('[data-testid="add-row"]').click();
    await mobilePage.locator('[data-testid="cell"]:first-child').fill('Persistent Data');
    await mobilePage.locator('[data-testid="save-btn"]').click();

    // Refresh TV
    await tvPage.reload();

    // Data should still be there
    await expect(tvPage.locator('td')).toContainText('Persistent Data');

    await tvContext.close();
    await mobileContext.close();
  });

  test('mobile can sort table by column', async ({ browser }) => {
    // Setup with data
    const mobileContext = await browser.newContext();
    const mobilePage = await mobileContext.newPage();

    // Pre-seed data via API for this test
    await mobilePage.request.post('/api/displays', {});

    // Test sorting...
    await mobileContext.close();
  });
});
```

### 6.3 Error Handling E2E Tests

**File:** `tests/e2e/error-handling.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('TV shows reconnecting overlay when connection lost', async ({ page, context }) => {
    await page.goto('/display');

    // Wait for initial connection
    await expect(page.locator('[data-testid="pair-code"]')).toBeVisible();

    // Simulate network offline
    await context.setOffline(true);

    // Should show reconnecting state
    await expect(page.locator('[data-testid="reconnecting-overlay"]')).toBeVisible();

    // Restore network
    await context.setOffline(false);

    // Should reconnect
    await expect(page.locator('[data-testid="reconnecting-overlay"]')).not.toBeVisible();
  });

  test('mobile shows network error toast', async ({ page, context }) => {
    // Setup paired session first
    await page.goto('/controller');
    // ... pair ...

    // Go offline
    await context.setOffline(true);

    // Try to save
    await page.locator('[data-testid="save-btn"]').click();

    // Should show error toast
    await expect(page.locator('[data-testid="error-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-toast"]')).toContainText(/network/i);
  });
});
```

---

## Test Configuration Files

### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js', 'client/**/*.js'],
      exclude: ['**/*.test.js', '**/node_modules/**']
    },
    setupFiles: ['./tests/helpers/setup.js']
  }
});
```

### playwright.config.js

```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 2,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### tests/helpers/setup.js

```javascript
import { beforeEach, afterEach } from 'vitest';

// Global test setup
beforeEach(() => {
  // Reset any global state
});

afterEach(() => {
  // Cleanup
});
```

### tests/helpers/db.js

```javascript
export function resetTestDatabase(app) {
  // Access the database instance and reset
  const db = app.get('db');
  if (db) {
    db.exec('DELETE FROM displays');
  }
}

export function seedTestData(app, data) {
  const db = app.get('db');
  // Insert test data
}
```

### tests/helpers/fixtures.js

```javascript
export const sampleTableData = {
  headers: ['Task', 'Owner', 'Status'],
  rows: [
    ['Buy milk', 'Alice', 'Done'],
    ['Walk dog', 'Bob', 'Pending'],
    ['Clean house', 'Charlie', 'In Progress']
  ],
  displaySettings: {
    startRow: 0,
    rowCount: 10
  }
};

export const emptyTableData = {
  headers: [],
  rows: [],
  displaySettings: {
    startRow: 0,
    rowCount: 10
  }
};

export const largeTableData = {
  headers: ['ID', 'Name', 'Value'],
  rows: Array.from({ length: 100 }, (_, i) => [
    String(i + 1),
    `Item ${i + 1}`,
    String(Math.random() * 100)
  ]),
  displaySettings: {
    startRow: 0,
    rowCount: 10
  }
};
```

---

## NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

---

## Test Coverage Goals

| Layer | Target Coverage | Priority |
|-------|-----------------|----------|
| Database Layer | 90%+ | High |
| API Endpoints | 85%+ | High |
| Display Client | 70%+ | Medium |
| Controller Client | 75%+ | High |
| PWA Features | 60%+ | Low |
| E2E Critical Paths | 100% | High |

---

## Running Tests

```bash
# Run all unit/integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run end-to-end tests
npm run test:e2e

# Run E2E with visual UI
npm run test:e2e:ui

# Run all tests
npm run test:all
```

---

## Test Matrix by Phase

| Phase | Test Type | Files | Key Tests |
|-------|-----------|-------|-----------|
| 1 | Unit, Integration | `sqlite.test.js`, `server.test.js` | DB init, CRUD, static serving |
| 2 | Integration | `displays.test.js`, `pairing.test.js`, `sse.test.js` | All API endpoints, SSE events |
| 3 | Integration | `display.test.js` | Pairing screen, table render, SSE handling |
| 4 | Integration | `controller.test.js` | Code input, table editing, sorting, save |
| 5 | Unit | `pwa.test.js`, `service-worker.test.js` | Manifest, caching |
| 6 | E2E | `pairing.spec.js`, `editing.spec.js`, `error-handling.spec.js` | Full user flows, error states |

---

## Summary

This test suite provides:

1. **Fast feedback loop** - Unit tests run in <1 second
2. **API confidence** - Integration tests verify endpoint behavior
3. **Client coverage** - DOM tests ensure UI works correctly
4. **User journey validation** - E2E tests cover critical flows
5. **Low maintenance** - Simple tools, minimal mocking
6. **Progressive testing** - Tests can be added as each phase is built

Total estimated test files: **15**
Total estimated test cases: **~80-100**
