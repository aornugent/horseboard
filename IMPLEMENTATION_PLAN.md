# Implementation Plan

## Overview

This plan outlines the implementation of HorseBoard, a domain-specific feed management system for equine care. The system displays feeding schedules on a TV and allows editing via a mobile PWA.

### Project Structure

```
horseboard/
├── server/
│   ├── index.js           # Express server entry point
│   ├── api/
│   │   ├── routes.js      # API route definitions
│   │   └── sse.js         # Server-Sent Events handler
│   ├── services/
│   │   └── display.js     # Business logic
│   └── db/
│       └── sqlite.js      # SQLite database layer
├── client/
│   ├── display/           # TV display web app
│   │   ├── index.html
│   │   ├── style.css
│   │   └── app.js
│   └── controller/        # Mobile controller PWA
│       ├── index.html
│       ├── style.css
│       ├── app.js
│       ├── sw.js
│       └── manifest.json
├── tests/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── package.json
└── README.md
```

---

## Phase 1: Project Setup ✅ COMPLETE

### 1.1 Initialize Project Structure

**Tasks:**
- [x] Create directory structure
- [x] Initialize `package.json` with dependencies
- [x] Set up Express server
- [x] Configure static file serving

**Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

### 1.2 Database Layer

**Tasks:**
- [x] Create SQLite database schema
- [x] Implement CRUD operations for displays
- [x] Add auto-initialization on startup
- [x] Add unit tests (15 tests)

**Schema:**
```sql
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE,
  table_data TEXT,  -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 2: Backend API ✅ COMPLETE

### 2.1 Core API Endpoints

**Tasks:**
- [x] `POST /api/displays` - Create new display
- [x] `POST /api/pair` - Pair controller with display
- [x] `GET /api/displays/:id` - Get display data
- [x] `PUT /api/displays/:id` - Update table data
- [x] `DELETE /api/displays/:id` - Remove display
- [x] Add integration tests (19 tests)

### 2.2 Server-Sent Events (SSE)

**Tasks:**
- [x] `GET /api/displays/:id/events` - SSE endpoint
- [x] Implement client connection tracking
- [x] Broadcast updates when data changes
- [x] Add integration tests (7 tests)

---

## Phase 3: TV Display (Web App) ✅ COMPLETE

### 3.1 Pairing Screen

**Tasks:**
- [x] Create HTML/CSS layout
- [x] On load: call `POST /api/displays`
- [x] Display 6-digit code prominently
- [x] Store display ID in localStorage

### 3.2 Table Display Screen

**Tasks:**
- [x] Connect to SSE endpoint after pairing
- [x] Render table from JSON data
- [x] Handle empty state gracefully
- [x] Auto-scale table to fit screen
- [x] Support pagination display

---

## Phase 4: Mobile Controller (PWA) ✅ COMPLETE

### 4.1 Pairing Screen

**Tasks:**
- [x] Create code input UI (6 digit boxes)
- [x] Call `POST /api/pair` with entered code
- [x] Store display ID on successful pair
- [x] Navigate to editor on success

### 4.2 Table Editor

**Tasks:**
- [x] Fetch current table data on load
- [x] Render editable table grid
- [x] Tap cell to edit
- [x] Add row/column functionality
- [x] Delete row/column with confirmation
- [x] Save changes via API

### 4.3 PWA Features

**Tasks:**
- [x] Create `manifest.json` with app metadata
- [x] Add service worker for caching
- [x] Add "Add to Home Screen" prompt
- [x] Configure app icons

---

## Phase 5: Domain-Specific Data Model 🔲 PENDING

### 5.1 Migrate Data Schema

**Tasks:**
- [ ] Update `table_data` structure to domain model:
  ```json
  {
    "settings": { "timeMode", "overrideUntil", "zoomLevel", "currentPage" },
    "feeds": [{ "id", "name", "unit", "rank" }],
    "horses": [{ "id", "name", "note", "noteExpiry", "noteCreatedAt" }],
    "diet": { "horseId": { "feedId": { "am", "pm" } } }
  }
  ```
- [ ] Add migration logic for existing displays (if any)
- [ ] Update validation in API layer

### 5.2 Domain API Endpoints

**Tasks:**
- [ ] `PUT /api/horses/:id/diet` - Update horse diet with rank recalculation
- [ ] `DELETE /api/feeds/:id` - Delete feed with cascade
- [ ] `PUT /api/settings/time-mode` - AM/PM toggle with override
- [ ] `PUT /api/settings/zoom` - Adjust zoom level
- [ ] `PUT /api/settings/page` - Change page
- [ ] Add integration tests

### 5.3 Server Business Logic

**Tasks:**
- [ ] Implement feed ranking algorithm (usage-based)
- [ ] Add time management (AM/PM auto-detection)
- [ ] Add manual override with 1-hour timeout
- [ ] Implement note expiry cron job (hourly check)

---

## Phase 6: TV Feed Grid Display 🔲 PENDING

### 6.1 Grid Layout

**Tasks:**
- [ ] Refactor display to CSS Grid layout
- [ ] Implement dynamic column sizing based on zoom level
- [ ] Show horses as columns, feeds as rows
- [ ] Add notes footer row

### 6.2 Value Formatting

**Tasks:**
- [ ] Create fraction conversion utility (0.5 → ½)
- [ ] Handle AM/PM mode display
- [ ] Show blank for 0/null values (preserve row height)

### 6.3 Optimized SSE

**Tasks:**
- [ ] Split SSE into event types: `state` and `data`
- [ ] Handle state changes (page/zoom/time) with minimal payload
- [ ] Handle data changes (diet/horses/feeds) with full payload

---

## Phase 7: Mobile Controller Redesign 🔲 PENDING

### 7.1 Tab Navigation

**Tasks:**
- [ ] Implement tab bar: [Board] [Horses] [Feeds] [Reports]
- [ ] Persist current tab in session

### 7.2 Board Tab (Quick Edit)

**Tasks:**
- [ ] Mirror TV grid layout
- [ ] Tap cell → numeric keypad popover
- [ ] Tap note → text editor
- [ ] Tap horse name → navigate to Horses tab
- [ ] Add display controls (AM/PM toggle, zoom, pagination)

### 7.3 Horses Tab (Deep Edit)

**Tasks:**
- [ ] Create horse list view (card layout)
- [ ] Build Horse Detail modal:
  - [ ] Clone diet dropdown
  - [ ] Notes field with expiry toggle
  - [ ] Stale note warning (>24h without expiry)
  - [ ] Active feeds section
  - [ ] Add feed section (faded)
- [ ] Implement numeric input with step="0.25"

### 7.4 Feeds Tab (Settings)

**Tasks:**
- [ ] Create/rename/delete feeds
- [ ] Set unit (Scoop, ml, Biscuit, Sachet)
- [ ] Cascade delete confirmation

### 7.5 Reports Tab

**Tasks:**
- [ ] Calculate weekly consumption per feed
- [ ] Display table: Feed | Weekly Total | Unit
- [ ] Round values to 2 decimal places

---

## Phase 8: Polish & Error Handling 🔲 PENDING

### 8.1 Error States

**Tasks:**
- [ ] TV: "Connection lost" overlay with retry
- [ ] TV: "Waiting for data" state
- [ ] Mobile: Network error notifications
- [ ] Mobile: Sync status indicator

### 8.2 UX Improvements

**Tasks:**
- [ ] TV: Smooth transitions between states
- [ ] TV: Auto-reconnect SSE on disconnect
- [ ] Mobile: Optimistic UI updates
- [ ] Mobile: Debounce saves

---

## Implementation Order

| Step | Task | Complexity | Status |
|------|------|------------|--------|
| 1 | Project setup + Express server | Low | ✅ Done |
| 2 | SQLite database layer | Low | ✅ Done |
| 3 | API routes (CRUD) | Medium | ✅ Done |
| 4 | SSE implementation | Medium | ✅ Done |
| 5 | TV display - pairing screen | Low | ✅ Done |
| 6 | TV display - table rendering | Medium | ✅ Done |
| 7 | Mobile - pairing screen | Low | ✅ Done |
| 8 | Mobile - table editor | High | ✅ Done |
| 9 | PWA manifest + service worker | Low | ✅ Done |
| 10 | Domain data model migration | Medium | Pending |
| 11 | Domain API endpoints | Medium | Pending |
| 12 | Server business logic | Medium | Pending |
| 13 | TV feed grid display | Medium | Pending |
| 14 | Mobile tab navigation | Low | Pending |
| 15 | Mobile Board tab | Medium | Pending |
| 16 | Mobile Horses tab | High | Pending |
| 17 | Mobile Feeds tab | Low | Pending |
| 18 | Mobile Reports tab | Low | Pending |
| 19 | Error handling & polish | Medium | Pending |

---

## Testing

### Automated Tests (68 tests, all passing)

```bash
npm test
```

| Suite | Tests | Description |
|-------|-------|-------------|
| SQLite Database | 15 | CRUD operations, schema, uniqueness |
| Display API | 12 | Create, read, update, delete endpoints |
| Pairing API | 7 | Code validation, pairing flow |
| SSE API | 7 | Streaming, broadcasting, connection handling |
| Controller Client | 19 | Pairing, editing, sorting, session persistence |
| Display Client | 8 | Static files, SSE workflow, pairing integration |

### Domain-Specific Tests (To Be Added)

| Suite | Description |
|-------|-------------|
| Feed Ranking | Usage-based rank calculation |
| Time Management | AM/PM auto-detection, override logic |
| Note Expiry | Hourly cleanup, broadcast on delete |
| Diet CRUD | Horse diet operations, cascade delete |
| Reports | Weekly consumption calculation |

### Manual Testing Flow

1. [ ] Start server: `npm start`
2. [ ] Open `/display` on TV browser
3. [ ] Open `/controller` on phone
4. [ ] Enter pairing code
5. [ ] Add horses and feeds
6. [ ] Set diet quantities (AM/PM)
7. [ ] Verify TV updates in real-time
8. [ ] Test AM/PM toggle
9. [ ] Test zoom and pagination
10. [ ] Verify reports calculate correctly

---

## Success Criteria

MVP is complete when:

- [ ] TV displays feed grid with horse columns
- [ ] Mobile can edit diet quantities per horse
- [ ] AM/PM mode switches automatically based on time
- [ ] Notes can be added with optional expiry
- [ ] Reports show weekly consumption per feed
- [ ] Data persists across server restarts
- [ ] Works on actual TV browser + mobile phone
