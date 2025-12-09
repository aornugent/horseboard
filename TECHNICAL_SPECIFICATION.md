# Technical Specification: Dynamic Information Board

## 1. Overview

This document outlines the technical details for the Minimum Viable Product (MVP) of a software service that transforms any large screen into a dynamic, remotely-managed information board optimized for displaying tabular data.

**Core user experience:** "Edit a table on my phone, and it instantly appears on my big screen."

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
| Backend | Node.js + Express | API, SSE, static file serving, SQLite |
| TV Display | Vanilla HTML/CSS/JS | Shows pairing code, renders table |
| Mobile Controller | PWA (HTML/CSS/JS) | Pairing, table editing |

## 3. Component Details

### 3.1 Backend Server

**Technology:** Node.js with Express.js

**Database:** SQLite (file-based persistence)

**Schema:**
```sql
CREATE TABLE displays (
  id TEXT PRIMARY KEY,
  pair_code TEXT UNIQUE,
  table_data TEXT,          -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**API Endpoints:**

#### `POST /api/displays`
Create a new display session.

*Request:* None (empty body)

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
  "tableData": {
    "headers": ["Task", "Owner", "Status"],
    "rows": [
      ["Buy milk", "Alice", "To Do"],
      ["Walk dog", "Bob", "Done"]
    ],
    "displaySettings": {
      "startRow": 0,
      "rowCount": 10
    }
  },
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
Update table data for a display.

*Request:*
```json
{
  "tableData": {
    "headers": ["Task", "Owner", "Status"],
    "rows": [
      ["Buy milk", "Alice", "To Do"],
      ["Walk dog", "Bob", "Done"],
      ["Mow lawn", "Charlie", "To Do"]
    ],
    "displaySettings": {
      "startRow": 0,
      "rowCount": 10
    }
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

*Response (400 - validation error):*
```json
{
  "success": false,
  "error": "Invalid table data format"
}
```

*Response (404):*
```json
{
  "success": false,
  "error": "Display not found"
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

*Response (404):*
```json
{
  "error": "Display not found"
}
```

#### `POST /api/pair`
Pair a mobile controller with a display using the 6-digit code.

*Request:*
```json
{
  "code": "847291"
}
```

*Validation:*
- `code` must be a string
- `code` must be exactly 6 digits (regex: `/^\d{6}$/`)

*Response (200 - Success):*
```json
{
  "success": true,
  "displayId": "d_abc123def456"
}
```

*Response (400 - validation error):*
```json
{
  "success": false,
  "error": "Code must be 6 digits"
}
```

*Response (404 - invalid code):*
```json
{
  "success": false,
  "error": "Invalid pairing code"
}
```

#### `GET /api/displays/:id/events`
Server-Sent Events endpoint for real-time updates.

*Headers:*
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

*Response:* SSE stream

```
data: {"tableData": {...}, "updatedAt": "2024-01-15T10:30:00.000Z"}

: keepalive

data: {"tableData": {...}, "updatedAt": "2024-01-15T10:35:00.000Z"}
```

*Behavior:*
- Sends current state immediately on connection
- Sends keepalive comment (`: keepalive\n\n`) every 30 seconds
- Broadcasts updates when `PUT /api/displays/:id` is called
- Connection stays open until client disconnects

*Response (404):*
```json
{
  "error": "Display not found"
}
```

#### `GET /health`
Health check endpoint.

*Response (200):*
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3.2 Input Validation

#### Table Data Validation

The `tableData` object must satisfy:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `headers` | `string[]` | Yes | Column headers (can be empty) |
| `rows` | `string[][]` | Yes | Row data (can be empty) |
| `displaySettings` | `object` | No | TV display settings |

Each row must be an array. Non-array rows are rejected.

#### Pair Code Validation

| Rule | Description |
|------|-------------|
| Type | Must be a string |
| Length | Exactly 6 characters |
| Format | Digits only (0-9) |

### 3.3 TV Display (Web App)

**URL:** `/display` or `/display/`

**Technology:** Vanilla HTML, CSS, JavaScript

**Behavior:**
1. On load, check localStorage for existing `displayId`
2. If none, call `POST /api/displays` to create new session
3. Display 6-digit pairing code prominently
4. Connect to SSE endpoint `/api/displays/:id/events`
5. When data arrives, render table and hide pairing code
6. Auto-reconnect SSE on disconnect

**UI States:**
- **Pairing:** Large centered 6-digit code with instructions
- **Connected (no data):** "Waiting for data..." message
- **Connected (with data):** Full-screen table display

### 3.4 Mobile Controller (PWA)

**URL:** `/controller` or `/controller/`

**Technology:** HTML, CSS, JavaScript (vanilla or lightweight framework)

**Screens:**

#### Pairing Screen
- 6-digit code input (individual boxes)
- "Connect" button
- Error feedback for invalid codes

#### Table Editor Screen
- Editable grid with headers and rows
- Tap cell to edit (inline or modal input)
- "Add Row" button at bottom
- "Add Column" button (or via menu)
- Column header tap toggles sort (A-Z → Z-A → unsorted)
- Pagination controls for large tables
- "TV View" section to select which rows display on TV
- Save button (or auto-save with debounce)

**PWA Features:**
- `manifest.json` for installability
- Service worker for basic offline caching
- App icons for home screen

## 4. Data Structures

### Table Data Format

```json
{
  "headers": ["Column1", "Column2", "Column3"],
  "rows": [
    ["value1a", "value1b", "value1c"],
    ["value2a", "value2b", "value2c"]
  ],
  "displaySettings": {
    "startRow": 0,
    "rowCount": 10,
    "sortColumn": null,
    "sortDirection": "asc"
  }
}
```

### SSE Message Format

Messages are sent as unnamed events with JSON data:

```
data: {"tableData": {...}, "updatedAt": "2024-01-15T10:30:00.000Z"}

```

Keepalive comments are sent every 30 seconds:

```
: keepalive

```

## 5. Data Flow

### Pairing Flow

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
   → Store displayId, navigate to editor
```

### Edit Flow

```
1. Mobile: User edits cell
   → PUT /api/displays/d_abc123 {tableData: {...}}
   ← {success: true, updatedAt: "..."}

2. Server: Broadcasts to SSE clients
   → SSE event to TV

3. TV: Receives SSE event
   → Re-renders table with new data
```

## 6. Configuration

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `./data/horseboard.db` | SQLite database path |

**Network Configuration:**
- TV and mobile must be able to reach the server
- For local development: use machine's local IP
- For production: deploy to public URL

## 7. Error Handling

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error (bad input) |
| 404 | Resource not found |
| 500 | Server error |

### Error Response Format

```json
{
  "error": "Human-readable error message"
}
```

Or for operations with success flag:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

## 8. Future Considerations

These are out of scope for MVP but inform design decisions:

### Post-MVP Improvements

| Item | Priority | Description |
|------|----------|-------------|
| Pair code expiration | Medium | Add `expires_at` column, auto-cleanup after 24h |
| Rate limiting | Medium | Prevent abuse on public endpoints |
| tableData size limit | Medium | Cap at ~1MB to prevent memory issues |
| Display cleanup | Low | Remove displays inactive for 30+ days |
| Pair code collision | Low | Replace recursive generation with loop |

### Future Features

- **User authentication:** Add login, associate displays with user accounts
- **Multiple displays:** One user manages multiple TV displays
- **Rich content:** Images, formatted text, multiple tables per display
- **Offline editing:** Queue changes when offline, sync when reconnected
- **Themes:** Customizable table styling and colors
- **Sharing:** Generate shareable links for view-only access
- **SSE authentication:** Validate display ownership before allowing subscription
