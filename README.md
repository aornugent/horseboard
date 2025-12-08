# Dynamic Information Board

A web-based system that transforms any large screen into a remotely-managed information board for displaying tabular data.

## Overview

Edit a table on your phone. See it instantly on your TV.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile Web    │────▶│     Backend     │◀────│    TV Web App   │
│      (PWA)      │     │  (Node/Express) │ SSE │  (Browser Tab)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Controller              API + SSE              Display
```

### How It Works

1. Open the display URL on your TV (in any browser)
2. A 6-digit pairing code appears on screen
3. Open the controller URL on your phone
4. Enter the code to connect
5. Edit your table - changes appear on the TV in real-time

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js, Express, SQLite |
| TV Display | HTML, CSS, JavaScript |
| Mobile Controller | Progressive Web App (PWA) |
| Real-time Updates | Server-Sent Events (SSE) |

## Project Structure

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
│       └── sqlite.js      # Database layer
├── client/
│   ├── display/           # TV display web app
│   └── controller/        # Mobile controller PWA
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- A TV with a web browser (Chrome recommended)
- A smartphone

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd horseboard

# Install dependencies
npm install

# Start the server
npm start
```

### Usage

1. **Start the server:**
   ```bash
   npm start
   ```
   Server runs at `http://localhost:3000`

2. **On your TV:**
   - Open `http://<your-server-ip>:3000/display` in a browser
   - Note the 6-digit code shown

3. **On your phone:**
   - Open `http://<your-server-ip>:3000/controller`
   - Enter the pairing code
   - Start editing your table

### Network Setup

- **Local development:** Use your machine's local IP (e.g., `192.168.1.100`)
- **Production:** Deploy to a public URL

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/displays` | Create new display session |
| POST | `/api/pair` | Pair controller with display |
| GET | `/api/displays/:id` | Get display data |
| PUT | `/api/displays/:id` | Update table data |
| GET | `/api/displays/:id/events` | SSE stream for real-time updates |

## Documentation

- [Technical Specification](./TECHNICAL_SPECIFICATION.md) - Detailed system design
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Development phases and tasks

## Development

```bash
# Run with auto-reload
npm run dev
```

## License

MIT
