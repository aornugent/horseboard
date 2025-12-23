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
2. **On your TV:** Open `http://<server-ip>:3000/display` — note the 6-digit code
3. **On your phone:** Open `http://<server-ip>:3000/controller` — enter the code

## Development

```bash
npm run dev           # Start with auto-reload
npm test              # Run tests
npm run test:watch    # Watch mode
```

## Documentation

| Document | Contents |
|----------|----------|
| [Technical Specification](./TECHNICAL_SPECIFICATION.md) | API, data formats, business logic |
| [Implementation Plan](./IMPLEMENTATION_PLAN.md) | Pending tasks |
| [Agent Guidelines](./AGENTS.md) | Instructions for AI agents |

## License

MIT
