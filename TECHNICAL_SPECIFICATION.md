# Technical Specification: Horse Feed Management System

## 1. Overview

HorseBoard is a feed management system for equine care. It displays feeding schedules on a stable TV and allows editing via a mobile controller (PWA).

**Core experience:** Update feeding quantities on your phone, see them instantly on the stable TV.

**Domain Model:**
- **Columns** = Horses
- **Rows** = Feeds/Supplements
- **Cells** = Quantities (AM/PM values with units)

**Scoping:** One display = one stable. All horses, feeds, and diets belong to that display. Creating a new display starts a fresh stable with no shared data.

## 2. System Architecture

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

**Design principles:**
- TV is a "dumb renderer" - receives state, renders it
- Controller is the "command center" - all editing happens here
- Server owns business logic - ranking, time mode, note expiry

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

The `table_data` column stores a JSON blob:

```json
{
  "settings": {
    "timezone": "Australia/Sydney",
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

### 3.3 Field Definitions

#### Settings

| Field | Type | Description |
|-------|------|-------------|
| `timezone` | `string` | IANA timezone (e.g., "Australia/Sydney") |
| `timeMode` | `"AUTO" \| "AM" \| "PM"` | Current display mode |
| `overrideUntil` | `number \| null` | Unix timestamp when manual override expires |
| `zoomLevel` | `number` | Columns per page (1=10, 2=7, 3=5 horses) |
| `currentPage` | `number` | Pagination index (0-based) |

#### Feed

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., "f1") |
| `name` | `string` | Display name |
| `unit` | `string` | Unit of measure (scoop, ml, sachet, biscuit) |
| `rank` | `number` | Usage-based ranking (lower = more popular) |

#### Horse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., "h1") |
| `name` | `string` | Horse name |
| `note` | `string` | Optional note text |
| `noteExpiry` | `number \| null` | Unix timestamp when note auto-clears |
| `noteCreatedAt` | `number` | Unix timestamp when note was created |

#### Diet

Nested object keyed by horse ID, then feed ID:

```json
{
  "h1": {
    "f1": { "am": 0.5, "pm": 0.5 }
  }
}
```

**Value semantics:**
- `0` = Deliberate zero (horse gets none)
- `null` or missing key = Feed not assigned to horse
- Both calculate as 0 in reports

## 4. API Reference

### 4.1 Display Lifecycle

#### `POST /api/displays`

Create a new display (stable).

*Response (201):*
```json
{
  "id": "d_abc123def456",
  "pairCode": "847291"
}
```

#### `GET /api/displays/:id`

Retrieve display data.

*Response (200):*
```json
{
  "id": "d_abc123def456",
  "pairCode": "847291",
  "tableData": { /* see 3.2 */ },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### `PUT /api/displays/:id`

Update display data. This is the primary endpoint for all edits.

*Request:*
```json
{
  "tableData": { /* see 3.2 */ }
}
```

*Response (200):*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00.000Z"
}
```

**Server-side processing on save:**
1. Validate structure (settings, feeds, horses, diet)
2. Recalculate feed rankings based on usage
3. Clean up orphaned diet entries (if a feed was removed from `feeds[]`)
4. Broadcast update to SSE clients

#### `DELETE /api/displays/:id`

Remove a display and all its data.

*Response (200):*
```json
{
  "success": true
}
```

### 4.2 Pairing

#### `POST /api/pair`

Pair a controller with a display using the 6-digit code.

*Request:*
```json
{
  "code": "847291"
}
```

*Validation:* Code must be exactly 6 digits.

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

### 4.3 Server-Sent Events

#### `GET /api/displays/:id/events`

SSE endpoint for real-time updates.

*Headers:*
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

*Event types:*

| Event | Payload | When |
|-------|---------|------|
| `update` | Full `tableData` | Any data change |
| (comment) | `: keepalive` | Every 30 seconds |

*Example:*
```
data: {"settings":{...},"feeds":[...],"horses":[...],"diet":{...}}

: keepalive

data: {"settings":{...},"feeds":[...],"horses":[...],"diet":{...}}
```

### 4.4 Health Check

#### `GET /health`

*Response (200):*
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 5. Server Business Logic

### 5.1 Feed Ranking

On every `PUT /api/displays/:id`:

1. Count horses using each feed (where AM > 0 or PM > 0)
2. Sort feeds by usage count (descending)
3. Assign `rank` values (1 = most used)

Popular feeds appear first in the controller's "Add Feed" list.

### 5.2 Cascade Cleanup

On every `PUT /api/displays/:id`:

If a feed ID exists in `diet` but not in `feeds[]`, remove it from `diet`. This handles feed deletion without requiring a separate endpoint.

### 5.3 Time Mode (AM/PM)

**Auto detection** uses the display's configured timezone:
- 04:00 - 11:59 local time = AM
- 12:00 - 03:59 local time = PM

**Manual override:**
1. User sets `timeMode` to "AM" or "PM"
2. Set `overrideUntil` to current time + 1 hour
3. After expiry, server resets to "AUTO" on next check

Server checks override expiry every minute and broadcasts if changed.

### 5.4 Note Expiry

Server checks every hour (per display timezone):

```
for each horse:
  if noteExpiry != null AND noteExpiry < now:
    clear note and noteExpiry
    broadcast update
```

### 5.5 Pagination

| Zoom Level | Horses/Page | Use Case |
|------------|-------------|----------|
| 1 | 10 | Many horses, small text |
| 2 | 7 | Default |
| 3 | 5 | Few horses, large text |

Total pages = `ceil(horses.length / horsesPerPage)`

## 6. TV Display

### 6.1 Grid Layout

- **Header row:** Horse names
- **Body rows:** One per feed (showing AM or PM value based on time mode)
- **Footer row:** Horse notes

Only show feeds that have at least one non-zero value across all horses.

### 6.2 Value Formatting

| Decimal | Display |
|---------|---------|
| 0.25 | ¼ |
| 0.33 | ⅓ |
| 0.5 | ½ |
| 0.75 | ¾ |
| Other | Value + unit (e.g., "0.7 ml") |
| 0 or null | Blank |

### 6.3 Behavior

1. Check localStorage for `displayId`
2. If none, `POST /api/displays` to create session
3. Show pairing code until data arrives
4. Connect to SSE, render grid on updates
5. Auto-reconnect on disconnect

**URL:** `/display`

## 7. Mobile Controller

### 7.1 Navigation

Tab bar: **[Board] [Horses] [Feeds] [Reports]**

### 7.2 Board Tab

Mirror of TV grid with editing:

- Tap cell → Numeric keypad for quantity
- Tap horse name → Open horse detail
- Tap note → Edit note text

**Controls:**
- AM/PM/AUTO toggle
- Zoom: [-] [+]
- Page: [<] [Page X of Y] [>]

### 7.3 Horses Tab

List of horse cards. Tapping opens detail modal:

- **Header:** Name + "Clone Diet From" dropdown
- **Notes:** Text field + expiry (None, 24h, 48h)
- **Warning:** Highlight if note >24h old without expiry
- **Feeds:** Active feeds (editable) + inactive feeds (tap to add)

Feed input: `[Name] [AM] [PM] [Unit]` with `step="0.25"`

### 7.4 Feeds Tab

Manage master feed list:
- Create, rename, delete feeds
- Set unit (Scoop, ml, Biscuit, Sachet)
- Delete confirmation (cascades to diet)

### 7.5 Reports Tab

Weekly consumption per feed:

1. Sum all AM + PM values across horses
2. Multiply by 7
3. Round to 2 decimal places

| Feed | Weekly | Unit |
|------|--------|------|
| Easisport | 45.50 | scoops |
| Bute | 14.00 | sachets |

**URL:** `/controller`

## 8. Data Flow

### 8.1 Pairing

```
TV: POST /api/displays → receives displayId + pairCode
TV: Shows "847291" on screen
TV: Connects to /api/displays/:id/events

Mobile: User enters "847291"
Mobile: POST /api/pair {code} → receives displayId
Mobile: Stores displayId, loads data
```

### 8.2 Editing

```
Mobile: User changes Spider's Easisport to 0.5
Mobile: PUT /api/displays/:id {tableData: {...}}

Server: Validates, recalculates ranks
Server: Broadcasts to SSE clients

TV: Receives update, re-renders grid
```

## 9. Validation

### 9.1 Quantities

| Input | Stored | Report Value |
|-------|--------|--------------|
| Empty | Key deleted | 0 |
| 0 | `0` | 0 |
| 0.5 | `0.5` | 0.5 |

### 9.2 Pair Code

- String, exactly 6 digits, 0-9 only

### 9.3 Table Data

Required structure:
- `settings` object with `timezone`, `timeMode`, `zoomLevel`, `currentPage`
- `feeds` array of feed objects
- `horses` array of horse objects
- `diet` object

## 10. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/horseboard.db` | Database path |

## 11. Error Handling

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT, DELETE) |
| 201 | Created (POST) |
| 400 | Validation error |
| 404 | Not found |
| 500 | Server error |

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

### 11.1 Client-Side Error Handling

**TV Display:**
- SSE connection failures trigger "Connection Lost" overlay
- Exponential backoff reconnection: 1s, 2s, 4s, 8s... up to 30s max
- Max 10 reconnection attempts before showing manual "Retry Now" button
- Overlay auto-hides when connection restores

**Mobile Controller:**
- Network failures show toast notifications
- Specific messages for different error types (network, not found, server error)
- Sync status indicator shows: Ready, Unsaved, Saving, Saved, Error
- Failed saves don't clear unsaved state (can be retried)

### 11.2 Save Optimization

- Saves are debounced by 500ms to prevent excessive requests during rapid edits
- Status shows "Saving" while request in flight
- Status updates to "Saved" for 3 seconds after successful save
- Multiple changes within 500ms window are batched into single save

## 12. Concurrency

**Strategy:** Last Write Wins

MVP supports one controller per display. If multiple controllers edit simultaneously, the last save wins. This is acceptable because:
- Edits are usually to different horses
- Conflicts are rare in practice

## 13. Constraints

- **No build step:** Vanilla JS, ES Modules
- **CSS Grid:** For dynamic column sizing
- **Denormalized:** Single JSON blob per display (simpler than normalized tables for MVP)

## 14. Future Considerations

| Feature | Description |
|---------|-------------|
| Multiple controllers | Granular endpoints (`PUT /displays/:id/horses/:horseId/diet`) to reduce conflicts |
| Historical tracking | Store feeding logs for accurate consumption reports over time |
| Offline editing | Queue changes locally, sync when reconnected |
| Inventory tracking | Track feed stock levels, alert when low |
| User authentication | Associate displays with user accounts |
| Pair code expiration | Auto-cleanup codes after 24h |
