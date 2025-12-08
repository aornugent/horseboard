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

*Response:*
```json
{
  "id": "d_abc123",
  "pairCode": "847291"
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

*Response (Success):*
```json
{
  "success": true,
  "displayId": "d_abc123"
}
```

*Response (Failure - 404):*
```json
{
  "success": false,
  "error": "Invalid pairing code"
}
```

#### `GET /api/displays/:id`
Retrieve current display data.

*Response:*
```json
{
  "id": "d_abc123",
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
  "updatedAt": "2024-01-15T10:30:00Z"
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

*Response:*
```json
{
  "success": true,
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### `GET /api/displays/:id/events`
Server-Sent Events endpoint for real-time updates.

*Response:* SSE stream

```
event: update
data: {"tableData": {...}, "updatedAt": "..."}

event: update
data: {"tableData": {...}, "updatedAt": "..."}
```

### 3.2 TV Display (Web App)

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

### 3.3 Mobile Controller (PWA)

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

### SSE Event Format

```json
{
  "type": "update",
  "tableData": { ... },
  "updatedAt": "2024-01-15T10:30:00Z"
}
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

## 7. Future Considerations

These are out of scope for MVP but inform design decisions:

- **User authentication:** Add login, associate displays with user accounts
- **Multiple displays:** One user manages multiple TV displays
- **Rich content:** Images, formatted text, multiple tables per display
- **Offline editing:** Queue changes when offline, sync when reconnected
- **Themes:** Customizable table styling and colors
- **Sharing:** Generate shareable links for view-only access
