# Agent Guidelines

Instructions for AI agents working on this codebase.

## Project Overview

This is a web-first Dynamic Information Board system. The core loop: mobile table editing that reflects instantly on a TV display.

**Architecture:**
- Single Node.js server serves everything
- TV display and mobile controller are both web apps
- Real-time updates via Server-Sent Events (SSE)
- SQLite for persistence

**Current Status:**
- Phase 1-2: ✅ Complete (Backend with full test coverage)
- Phase 3-6: 🔲 Pending (Client apps)

## Key Principles

1. **Simplicity first** - Vanilla JS where possible, minimal dependencies
2. **Single codebase** - Everything runs from one `npm start`
3. **Web standards** - Use native browser APIs (SSE, localStorage, fetch)
4. **Test-driven** - Write tests alongside implementation
5. **Follow the plan** - See `IMPLEMENTATION_PLAN.md` for phases and tasks

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
├── tests/
│   ├── unit/         # Unit tests
│   └── integration/  # API tests
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

## Testing Guidelines

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
```

### Test Structure

- **Unit tests** go in `tests/unit/` - test individual modules
- **Integration tests** go in `tests/integration/` - test API endpoints
- Use Node.js built-in test runner (`node:test`)
- Use `supertest` for HTTP assertions

### Writing Tests

```javascript
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Feature', () => {
  it('should do something', () => {
    assert.strictEqual(actual, expected);
  });
});
```

### Test Patterns

- Use `:memory:` SQLite database for integration tests
- Clean database state in `beforeEach`
- Close connections in `after` hooks
- Test both success and error cases
- Test input validation

## Coding Conventions

- ES Modules (`import`/`export`)
- Clear, descriptive names
- Comments for non-obvious logic
- Handle errors gracefully with user feedback
- Use async/await for asynchronous code
- Standard commit message format

## Documentation

- `TECHNICAL_SPECIFICATION.md` - API contracts, data formats
- `IMPLEMENTATION_PLAN.md` - Phased development tasks
- `TEST_SUITE.md` - Testing strategy and examples

Update these documents when making significant changes.

## Quick Commands

```bash
npm install           # Install dependencies
npm start             # Start server (port 3000)
npm run dev           # Start with auto-reload
npm test              # Run tests
```
