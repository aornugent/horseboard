# Agent Guidelines

Instructions for AI agents working on this codebase.

## Project Overview

This is a web-first Dynamic Information Board system. The core loop: mobile table editing that reflects instantly on a TV display.

**Architecture:**
- Single Node.js server serves everything
- TV display and mobile controller are both web apps
- Real-time updates via Server-Sent Events (SSE)
- SQLite for persistence

## Key Principles

1. **Simplicity first** - Vanilla JS where possible, minimal dependencies
2. **Single codebase** - Everything runs from one `npm start`
3. **Web standards** - Use native browser APIs (SSE, localStorage, fetch)
4. **Follow the plan** - See `IMPLEMENTATION_PLAN.md` for phases and tasks

## Project Structure

```
horseboard/
├── server/           # Node.js backend
│   ├── index.js      # Express entry point
│   ├── api/          # Route handlers + SSE
│   ├── services/     # Business logic
│   └── db/           # SQLite layer
├── client/
│   ├── display/      # TV web app
│   └── controller/   # Mobile PWA
└── package.json
```

## Component Guidelines

### Backend (`server/`)

- **Express.js** for routing and middleware
- **SQLite** via `better-sqlite3` for persistence
- **SSE** for real-time updates (not WebSockets)
- Keep route handlers thin, business logic in `services/`
- Use environment variables for configuration

### TV Display (`client/display/`)

- Single HTML file with embedded or linked CSS/JS
- No build step - runs directly in browser
- Connects to SSE endpoint for live updates
- Must handle connection loss gracefully

### Mobile Controller (`client/controller/`)

- PWA with manifest.json for installability
- No framework required (vanilla JS is fine)
- Debounce API calls on edits
- Store displayId in localStorage after pairing

## Coding Conventions

- Clear, descriptive names
- Comments for non-obvious logic
- Handle errors gracefully with user feedback
- Use async/await for asynchronous code
- Standard commit message format

## Documentation

- `TECHNICAL_SPECIFICATION.md` - API contracts, data formats
- `IMPLEMENTATION_PLAN.md` - Phased development tasks

Update these documents when making significant changes.
