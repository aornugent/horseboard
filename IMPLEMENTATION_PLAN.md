# Implementation Plan

## Overview

This plan outlines the implementation of the Dynamic Information Board MVP using a web-first architecture.

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
│       └── manifest.json  # PWA manifest
├── package.json
└── README.md
```

---

## Phase 1: Project Setup

### 1.1 Initialize Project Structure

**Tasks:**
- [ ] Create directory structure
- [ ] Initialize `package.json` with dependencies
- [ ] Set up Express server
- [ ] Configure static file serving

**Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

**Files to create:**
- `server/index.js` - Express app initialization
- `package.json` - Project configuration

### 1.2 Database Layer

**Tasks:**
- [ ] Create SQLite database schema
- [ ] Implement CRUD operations for displays
- [ ] Add auto-initialization on startup

**Schema:**
```sql
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE,
  table_data TEXT,  -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Files to create:**
- `server/db/sqlite.js` - Database operations

---

## Phase 2: Backend API

### 2.1 Core API Endpoints

**Tasks:**
- [ ] `POST /api/displays` - Create new display (generates ID + pair code)
- [ ] `POST /api/pair` - Pair controller with display using code
- [ ] `GET /api/displays/:id` - Get display data
- [ ] `PUT /api/displays/:id` - Update table data
- [ ] `DELETE /api/displays/:id` - Remove display

**Files to create:**
- `server/api/routes.js` - Route definitions
- `server/services/display.js` - Business logic

### 2.2 Server-Sent Events (SSE)

**Tasks:**
- [ ] `GET /api/displays/:id/events` - SSE endpoint for real-time updates
- [ ] Implement client connection tracking
- [ ] Broadcast updates when data changes

**How SSE works:**
```
TV connects to /api/displays/ABC123/events
  ↓
Server keeps connection open
  ↓
Mobile updates data via PUT /api/displays/ABC123
  ↓
Server broadcasts to all SSE clients for ABC123
  ↓
TV receives update instantly
```

**Files to create:**
- `server/api/sse.js` - SSE connection manager

---

## Phase 3: TV Display (Web App)

### 3.1 Pairing Screen

**Tasks:**
- [ ] Create minimal HTML/CSS layout
- [ ] On load: call `POST /api/displays` to get pair code
- [ ] Display 6-digit code prominently
- [ ] Store display ID in localStorage

**UI:**
```
┌─────────────────────────────────┐
│                                 │
│     Enter this code on your     │
│           mobile device         │
│                                 │
│          ┌─────────┐            │
│          │ 847291  │            │
│          └─────────┘            │
│                                 │
│     yourapp.com                 │
│                                 │
└─────────────────────────────────┘
```

### 3.2 Table Display Screen

**Tasks:**
- [ ] Connect to SSE endpoint after pairing
- [ ] Render table from JSON data
- [ ] Handle empty state gracefully
- [ ] Auto-scale table to fit screen
- [ ] Support pagination display (show "Page X of Y")

**Files to create:**
- `client/display/index.html`
- `client/display/style.css`
- `client/display/app.js`

---

## Phase 4: Mobile Controller (PWA)

### 4.1 Pairing Screen

**Tasks:**
- [ ] Create code input UI (6 digit boxes)
- [ ] Call `POST /api/pair` with entered code
- [ ] Store display ID on successful pair
- [ ] Navigate to editor on success

**UI:**
```
┌─────────────────────┐
│                     │
│  Enter the code     │
│  shown on your TV   │
│                     │
│  ┌─┬─┬─┬─┬─┬─┐      │
│  │8│4│7│2│9│1│      │
│  └─┴─┴─┴─┴─┴─┘      │
│                     │
│  [ Connect ]        │
│                     │
└─────────────────────┘
```

### 4.2 Table Editor

**Tasks:**
- [ ] Fetch current table data on load
- [ ] Render editable table grid
- [ ] Tap cell to edit (inline or modal)
- [ ] Add row button (bottom)
- [ ] Add column button (right side)
- [ ] Delete row/column (swipe or long-press)
- [ ] Column header tap to sort (A-Z / Z-A toggle)
- [ ] Save changes → `PUT /api/displays/:id`

**UI:**
```
┌─────────────────────────────┐
│  ← Your Board        [Save] │
├─────────────────────────────┤
│  Task    │ Owner  │ Status  │
├──────────┼────────┼─────────┤
│  Buy milk│ Alice  │ To Do   │
│  Walk dog│ Bob    │ Done    │
│  [+ Add Row]                │
├─────────────────────────────┤
│  Page 1 of 3   < 1 2 3 >    │
└─────────────────────────────┘
```

### 4.3 TV Pagination Control

**Tasks:**
- [ ] Show "TV View" toggle/section
- [ ] Allow selecting which rows to display on TV
- [ ] Send display slice with update

**Files to create:**
- `client/controller/index.html`
- `client/controller/style.css`
- `client/controller/app.js`
- `client/controller/manifest.json`

---

## Phase 5: PWA Features

### 5.1 Make Controller Installable

**Tasks:**
- [ ] Create `manifest.json` with app metadata
- [ ] Add service worker for basic caching
- [ ] Add "Add to Home Screen" prompt
- [ ] Configure app icons

**manifest.json:**
```json
{
  "name": "Board Controller",
  "short_name": "Board",
  "start_url": "/controller/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4a90d9",
  "icons": [...]
}
```

---

## Phase 6: Polish & Error Handling

### 6.1 Error States

**Tasks:**
- [ ] TV: "Connection lost" overlay with retry
- [ ] TV: "Waiting for data" state
- [ ] Mobile: Network error toast notifications
- [ ] Mobile: Invalid pairing code feedback
- [ ] Mobile: Sync status indicator

### 6.2 UX Improvements

**Tasks:**
- [ ] TV: Smooth transitions between states
- [ ] TV: Auto-reconnect SSE on disconnect
- [ ] Mobile: Optimistic UI updates
- [ ] Mobile: Pull-to-refresh
- [ ] Mobile: Debounce saves (don't save on every keystroke)

---

## Implementation Order

| Step | Task | Complexity |
|------|------|------------|
| 1 | Project setup + Express server | Low |
| 2 | SQLite database layer | Low |
| 3 | API routes (CRUD) | Medium |
| 4 | SSE implementation | Medium |
| 5 | TV display - pairing screen | Low |
| 6 | TV display - table rendering | Medium |
| 7 | Mobile - pairing screen | Low |
| 8 | Mobile - table editor | High |
| 9 | Mobile - sorting & pagination | Medium |
| 10 | PWA manifest + service worker | Low |
| 11 | Error handling & polish | Medium |

---

## Testing Checklist

### Manual Testing Flow

1. [ ] Open `localhost:3000/display` in browser (simulating TV)
2. [ ] Verify 6-digit code appears
3. [ ] Open `localhost:3000/controller` on phone/second browser
4. [ ] Enter pairing code
5. [ ] Verify pairing succeeds and editor loads
6. [ ] Add a row of data
7. [ ] Verify TV updates in real-time (no refresh)
8. [ ] Edit a cell
9. [ ] Verify TV updates
10. [ ] Test sorting by clicking column header
11. [ ] Refresh TV page - verify data persists
12. [ ] Restart server - verify data persists (SQLite)

---

## Success Criteria

MVP is complete when:

- [ ] TV shows pairing code on first load
- [ ] Mobile can pair using the code
- [ ] Mobile can edit table data (add/edit/delete rows)
- [ ] TV updates in real-time when mobile saves
- [ ] Data persists across server restarts
- [ ] Works on actual TV browser + mobile phone browser
