# Technical Specification: Horse Feed Management System

## 1. Overview

This document provides the technical reference for HorseBoard, a domain-specific feed management system that displays feeding schedules on a large screen (TV) and allows editing via a mobile controller (PWA).

**Core user experience:** "Update feeding quantities on my phone, see them instantly on the stable TV."

**Domain Model:**
- **Columns** = Horses
- **Rows** = Feeds/Supplements
- **Cells** = Structured quantities (AM/PM values with units)

The system supports real-time TV updates, structured data entry for accurate weekly consumption reporting, and time-based display modes.

## 2. System Architecture

The system uses a unified web-first architecture with three components served from a single Node.js server:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile Web    │────▶│     Backend     │◀────│    TV Web App   │
│      (PWA)      │     │  (Node/Express) │ SSE │  (Browser Tab)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Controller              API + SSE              Display
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| Backend | Node.js + Express | API, SSE, SQLite, business logic |
| TV Display | Vanilla HTML/CSS/JS | Renders feed grid, listens for updates |
| Mobile Controller | PWA (HTML/CSS/JS) | Pairing, editing, display control |

## 3. Data Architecture

### 3.1 Database Schema

**SQLite Database:** `./data/horseboard.db`

```sql
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE,
  table_data TEXT,          -- JSON blob (see 3.2)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 Table Data Structure

The `table_data` column stores a JSON blob with the following structure:

```json
{
  "settings": {
    "timeMode": "AUTO",
    "overrideUntil": null,
    "zoomLevel": 2,
    "currentPage": 0
  },
  "feeds": [
    { "id": "f1", "name": "Easisport", "unit": "scoop", "rank": 1 },
    { "id": "f2", "name": "Bute", "unit": "sachet", "rank": 2 }
  ],
  "horses": [
    {
      "id": "h1",
      "name": "Spider",
      "note": "Turn out early",
      "noteExpiry": 1735460000,
      "noteCreatedAt": 1735400000
    }
  ],
  "diet": {
    "h1": {
      "f1": { "am": 0.5, "pm": 0.5 },
      "f2": { "am": 1, "pm": 0 }
    }
  }
}
```

#### Settings Object

| Field | Type | Description |
|-------|------|-------------|
| `timeMode` | `"AUTO" \| "AM" \| "PM"` | Current display mode |
| `overrideUntil` | `number \| null` | Unix timestamp when override expires |
| `zoomLevel` | `number` | Determines columns per page (font size) |
| `currentPage` | `number` | Pagination index |

#### Feed Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., "f1") |
| `name` | `string` | Display name |
| `unit` | `string` | Unit of measure (scoop, ml, sachet, biscuit) |
| `rank` | `number` | Usage-based ranking (lower = more common) |

#### Horse Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., "h1") |
| `name` | `string` | Horse name |
| `note` | `string` | Optional note text |
| `noteExpiry` | `number \| null` | Unix timestamp when note auto-clears |
| `noteCreatedAt` | `number` | Unix timestamp when note was created |

#### Diet Object

Keyed by horse ID, then feed ID. Each entry contains AM/PM quantities:

```json
{
  "h1": {
    "f1": { "am": 0.5, "pm": 0.5 }
  }
}
```

**Value semantics:**
- `0` = Deliberate zero (horse gets none of this feed)
- `null` or missing = Feed not assigned to horse
- Both calculate as 0 in reports

## 4. API Reference

### 4.1 Display Management

#### `POST /api/displays`

Create a new display session.

*Request:* Empty body

*Response (201):*
```json
{
  "id": "d_abc123def456",
  "pairCode": "847291"
}
```

#### `GET /api/displays/:id`

Retrieve current display data.

*Response (200):*
```json
{
  "id": "d_abc123def456",
  "pairCode": "847291",
  "tableData": { /* see section 3.2 */ },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

*Response (404):*
```json
{
  "error": "Display not found"
}
```

#### `PUT /api/displays/:id`

Update display data.

*Request:*
```json
{
  "tableData": { /* see section 3.2 */ }
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

#### `DELETE /api/displays/:id`

Remove a display.

*Response (200):*
```json
{
  "success": true
}
```

### 4.2 Pairing

#### `POST /api/pair`

Pair a mobile controller with a display.

*Request:*
```json
{
  "code": "847291"
}
```

*Validation:*
- `code` must be a string of exactly 6 digits

*Response (200):*
```json
{
  "success": true,
  "displayId": "d_abc123def456"
}
```

*Response (404):*
```json
{
  "success": false,
  "error": "Invalid pairing code"
}
```

### 4.3 Domain Endpoints

#### `PUT /api/horses/:id/diet`

Update a horse's diet. Triggers feed ranking recalculation.

*Request:*
```json
{
  "diet": {
    "f1": { "am": 0.5, "pm": 0.5 },
    "f2": { "am": 1, "pm": 0 }
  }
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

*Side effect:* Recalculates feed usage counts and updates `rank` values.

#### `DELETE /api/feeds/:id`

Delete a feed from the master list.

*Response (200):*
```json
{
  "success": true
}
```

*Side effect:* Cascade-deletes all diet entries referencing this feed ID.

### 4.4 Settings

#### `PUT /api/settings/time-mode`

Set the time display mode.

*Request:*
```json
{
  "mode": "PM"
}
```

*Behavior:*
- If mode is "AM" or "PM", sets `overrideUntil` to current time + 1 hour
- After override expires, server auto-resets to "AUTO"

*Response (200):*
```json
{
  "success": true,
  "mode": "PM",
  "overrideUntil": 1735460000
}
```

#### `PUT /api/settings/zoom`

Adjust zoom level.

*Request:*
```json
{
  "level": 3
}
```

#### `PUT /api/settings/page`

Set current page.

*Request:*
```json
{
  "page": 1
}
```

### 4.5 Server-Sent Events

#### `GET /api/displays/:id/events`

SSE endpoint for real-time updates.

*Headers:*
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

*Event Types:*

| Event | Payload | When Sent |
|-------|---------|-----------|
| `state` | `{ timeMode, currentPage, zoomLevel }` | Settings changes |
| `data` | `{ feeds, horses, diet }` | Diet/horse/feed changes |
| `keepalive` | Comment only | Every 30 seconds |

*Example stream:*
```
event: state
data: {"timeMode":"AM","currentPage":0,"zoomLevel":2}

event: data
data: {"feeds":[...],"horses":[...],"diet":{...}}

: keepalive
```

### 4.6 Health Check

#### `GET /health`

*Response (200):*
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 5. Server Business Logic

### 5.1 Time Management (AM/PM)

**Auto Logic:** Server checks time every minute:
- 04:00 - 11:59 = AM
- 12:00 - 03:59 = PM

**Override Logic:**
1. User toggles to manual mode (e.g., "PM" at 8:00 AM)
2. Server sets `overrideUntil = now + 1 hour`
3. Server broadcasts "PM" state
4. After 1 hour, server auto-resets to "AUTO" and broadcasts update

### 5.2 Feed Ranking

When a diet is saved via `PUT /api/horses/:id/diet`:
1. Server recalculates usage count for all feeds
2. Usage count = number of horses using this feed (AM or PM > 0)
3. Feeds are sorted by usage count (descending)
4. `rank` values are updated accordingly

When sending the feed list to clients, sort by `rank` ascending so common feeds appear first.

### 5.3 Note Expiry

Server runs a check every hour:
```
for each horse:
  if horse.noteExpiry != null AND horse.noteExpiry < now:
    horse.note = ""
    horse.noteExpiry = null
    broadcast update
```

### 5.4 Pagination

Zoom level determines horses per page:

| Level | Horses/Page | Font Size |
|-------|-------------|-----------|
| 1 | 10 | Small |
| 2 | 7 | Medium |
| 3 | 5 | Large |

Total pages = ceil(horses.length / horsesPerPage)

## 6. TV Display Application

The TV is a "dumb renderer" that listens to SSE events and renders state.

### 6.1 Grid Layout

- **Columns:** Horses visible on current page
- **Rows:** All active feeds (feeds with at least one non-zero value)
- **Footer row:** Horse notes (spans column width)

### 6.2 Value Formatting

Client-side utility converts decimals to fractions:

| Value | Display |
|-------|---------|
| 0.25 | ¼ |
| 0.33 | ⅓ |
| 0.5 | ½ |
| 0.75 | ¾ |
| Other | Value + unit (e.g., "0.7ml") |
| 0 or null | Blank (preserve row height) |

### 6.3 Time Mode Display

- If current mode is "AM", only show AM values
- If current mode is "PM", only show PM values

### 6.4 URL

`/display` or `/display/`

### 6.5 Behavior

1. On load, check localStorage for existing `displayId`
2. If none, call `POST /api/displays` to create new session
3. Display 6-digit pairing code
4. Connect to SSE endpoint
5. When data arrives, render feed grid
6. Auto-reconnect SSE on disconnect

## 7. Mobile Controller Application

The mobile app is the "command center" for managing feed data.

### 7.1 Navigation

Tab-based navigation at top: **[Board] [Horses] [Feeds] [Reports]**

### 7.2 Board Tab (Home / Quick Edit)

**Layout:** Mirror of TV grid

**Cell Interaction:**
- Tap cell → Numeric keypad popover for quantity (current AM/PM based on toggle)
- Tap note → Text editor for horse note
- Tap horse name → Navigate to Horses tab detail

**Display Controls (sticky header/footer):**
- AM/PM toggle: [AM] [PM] [AUTO]
- Zoom: [-] [+]
- Pagination: [<] [Page X] [>]

### 7.3 Horses Tab (Deep Edit)

**Layout:** List of horse cards

**Horse Detail Modal:**
- Header: Horse name + "Clone Diet From [dropdown]"
- Notes field + expiry toggle (None, 24h, 48h)
- Visual warning if note has no expiry but createdAt > 24h ago

**Feed List in Modal:**
- Section 1 (Active): Feeds this horse has data for
- Section 2 (Add Feed): Remaining feeds from master list (faded)
- Both sections sorted by global popularity

**Input Row:** [Feed Name] | [AM Input] | [PM Input] | [Unit Label]
- Input type: `number` with `step="0.25"`
- Tapping inactive feed moves it to active section

### 7.4 Feeds Tab (Settings)

**Function:** Manage the master feed list

**Capabilities:**
- Create new feed
- Rename feed
- Delete feed (cascade-deletes all diet entries)
- Set unit (Scoop, ml, Biscuit, Sachet)

### 7.5 Reports Tab

**Function:** Weekly consumption calculation

**Logic:**
1. For each feed, sum all AM + PM values across all horses
2. Multiply by 7 (weekly)
3. Round to 2 decimal places

**Output:** Table with columns: Feed Name | Weekly Total | Unit

*Example:* "Easisport | 45.50 | Scoops"

### 7.6 URL

`/controller` or `/controller/`

### 7.7 PWA Features

- `manifest.json` for installability
- Service worker for offline asset caching
- App icons for home screen

## 8. Data Flow

### 8.1 Pairing Flow

```
1. TV opens /display
   → POST /api/displays
   ← {id: "d_abc123", pairCode: "847291"}
   → Display "847291" on screen
   → Connect to /api/displays/d_abc123/events (SSE)

2. Mobile opens /controller
   → User enters "847291"
   → POST /api/pair {code: "847291"}
   ← {success: true, displayId: "d_abc123"}
   → Store displayId, show Board tab
```

### 8.2 Edit Flow

```
1. Mobile: User edits Spider's Easisport PM quantity
   → PUT /api/horses/h1/diet {diet: {...}}
   ← {success: true}

2. Server: Recalculates feed ranks, broadcasts to SSE

3. TV: Receives SSE "data" event
   → Re-renders grid with updated values
```

### 8.3 Settings Change Flow

```
1. Mobile: User taps "PM" toggle
   → PUT /api/settings/time-mode {mode: "PM"}
   ← {success: true, overrideUntil: 1735460000}

2. Server: Broadcasts SSE "state" event

3. TV: Receives state event
   → Switches to show PM values only
```

## 9. Input Validation

### 9.1 Quantity Values

| Input | Stored As | Report Calculation |
|-------|-----------|-------------------|
| Empty field | `null` (key deleted) | 0 |
| 0 | `0` | 0 |
| 0.25, 0.5, 0.75 | Exact value | Exact value |
| Any number | Exact value | Exact value |

### 9.2 Pair Code

| Rule | Description |
|------|-------------|
| Type | String |
| Length | Exactly 6 characters |
| Format | Digits only (0-9) |

## 10. Configuration

### 10.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/horseboard.db` | SQLite database path |

### 10.2 Network Requirements

- TV and mobile must reach the server
- Local development: use machine's local IP
- Production: deploy to public URL

## 11. Error Handling

### 11.1 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error |
| 404 | Resource not found |
| 500 | Server error |

### 11.2 Error Response Format

```json
{
  "error": "Human-readable message"
}
```

Or with success flag:
```json
{
  "success": false,
  "error": "Human-readable message"
}
```

## 12. Concurrency

**Strategy:** Last Write Wins

Since editing is partitioned by horse ID, collisions are unlikely. Two users editing the same horse simultaneously results in the last save winning.

## 13. Implementation Constraints

- **No build step:** Vanilla JS with ES Modules
- **CSS:** Use CSS Grid for dynamic column/font sizing
- **SSE optimization:** Use typed events (`state` vs `data`) to minimize payload size

## 14. Future Considerations

These are out of scope for MVP but inform design decisions:

| Item | Priority | Description |
|------|----------|-------------|
| Pair code expiration | Medium | Auto-cleanup after 24h |
| Rate limiting | Medium | Prevent abuse on public endpoints |
| Data size limit | Medium | Cap table_data at ~1MB |
| Display cleanup | Low | Remove inactive displays after 30 days |
| User authentication | Future | Associate displays with user accounts |
| Multiple displays | Future | One user manages multiple TVs |
| Offline editing | Future | Queue changes, sync when reconnected |
| Inventory tracking | Future | Track feed stock levels |
