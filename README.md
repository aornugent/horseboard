# HorseBoard

A feed management system for equine care. Show feeding schedules on a stable TV board, edit via mobile phone.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile Web    │────▶│     Backend     │◀────│    TV Web App   │
│      (PWA)      │     │  (Node/Express) │ SSE │  (Browser Tab)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Controller              API + SSE               Board
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
npm start
```

### Usage

1. **Start the server:** `npm start` (runs at `http://localhost:3000`)
2. **On your TV:** Open `http://<server-ip>:3000/board` — note the 6-digit code
3. **On your phone:** Open `http://<server-ip>:3000/controller` — enter the code

## Development

```bash
npm run dev           # Start with auto-reload
npm test              # Run tests
npm run test:watch    # Watch mode
```

## Deployment (Railway)

This app deploys to [Railway](https://railway.app) with zero configuration.

**Environment variables:**
- `PORT` — Set automatically by Railway
- `DB_PATH` — SQLite database path (default: `./data/horseboard.db`)

**Node version:** Pinned to Node 20 LTS via `package.json` engines field. Railway reads this automatically via Nixpacks.

**Persistent storage:** Mount a volume at `/app/data` for SQLite persistence.

**GitHub Actions:** CI runs tests on push/PR. Deploy workflow requires `RAILWAY_TOKEN` secret (create at Railway → Account Settings → Tokens).

## Documentation

| Document | Contents |
|----------|----------|
| [Technical Specification](./TECHNICAL_SPECIFICATION.md) | API, data formats, business logic |
| [Database Guide](./DATABASE.md) | Database administration, migrations, backups |
| [Agent Guidelines](./AGENTS.md) | Instructions for AI agents |

## License

MIT
