# HorseBoard

A feed management system for equine care. Display feeding schedules on a stable TV, edit via mobile phone.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile Web    │────▶│     Backend     │◀────│    TV Web App   │
│      (PWA)      │     │  (Node/Express) │ SSE │  (Browser Tab)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Controller              API + SSE              Display
```

**Domain Model:**
- **Columns** = Horses
- **Rows** = Feeds/Supplements
- **Cells** = Quantities (AM/PM values with units)

```
                    Spider    Lightning   Thunder
                    ───────   ─────────   ───────
Easisport           ½ scoop   1 scoop     —
Bute                1 sachet  —           2 sachets
Chaff               2 scoops  1½ scoops   2 scoops

Notes               Turn out  —           Vet visit
                    early                 tomorrow
```

### Key Features

- Real-time TV updates via Server-Sent Events
- AM/PM time mode (auto-detects or manual override)
- Structured quantity input (not free text)
- Weekly consumption reports
- Notes with optional expiry

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1-4 | ✅ Complete | Core infrastructure (server, API, SSE, pairing) |
| Phase 5 | 🔲 Pending | Domain-specific data model |
| Phase 6 | 🔲 Pending | TV feed grid display |
| Phase 7 | 🔲 Pending | Mobile controller redesign |
| Phase 8 | 🔲 Pending | Polish & error handling |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js, Express, SQLite |
| TV Display | HTML, CSS, JavaScript (vanilla) |
| Mobile Controller | Progressive Web App (PWA) |
| Real-time Updates | Server-Sent Events (SSE) |
| Testing | Node.js test runner, Supertest |

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- A TV with a web browser
- A smartphone

### Installation

```bash
git clone <repository-url>
cd horseboard
npm install
npm test
npm start
```

### Usage

1. **Start the server:**
   ```bash
   npm start
   ```
   Server runs at `http://localhost:3000`

2. **On your TV:**
   - Open `http://<your-server-ip>:3000/display`
   - Note the 6-digit pairing code

3. **On your phone:**
   - Open `http://<your-server-ip>:3000/controller`
   - Enter the pairing code
   - Start managing feeds

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/displays` | Create new display session |
| POST | `/api/pair` | Pair controller with display |
| GET | `/api/displays/:id` | Get display data |
| PUT | `/api/displays/:id` | Update display data |
| DELETE | `/api/displays/:id` | Delete a display |
| GET | `/api/displays/:id/events` | SSE stream for real-time updates |
| GET | `/health` | Health check endpoint |

**Domain endpoints (pending):**
- `PUT /api/horses/:id/diet` - Update horse diet
- `DELETE /api/feeds/:id` - Delete feed (cascades)
- `PUT /api/settings/time-mode` - AM/PM toggle
- `PUT /api/settings/zoom` - Adjust display zoom
- `PUT /api/settings/page` - Change page

## Development

```bash
npm run dev           # Start with auto-reload
npm test              # Run tests
npm run test:watch    # Watch mode
```

## Testing

68 tests across unit and integration suites:

| Suite | Tests | Description |
|-------|-------|-------------|
| SQLite Database | 15 | CRUD operations, schema |
| Display API | 12 | Create, read, update, delete |
| Pairing API | 7 | Code validation, pairing |
| SSE API | 7 | Streaming, broadcasting |
| Controller Client | 19 | Pairing, editing, persistence |
| Display Client | 8 | Static files, SSE workflow |

## Documentation

- [Technical Specification](./TECHNICAL_SPECIFICATION.md) - API contracts, data formats, business logic
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Development phases and tasks
- [Agent Guidelines](./AGENTS.md) - Guidelines for AI agents

## License

MIT
