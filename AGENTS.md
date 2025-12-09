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

## Development Best Practices

These practices emerged from building Phase 1-2 and lead to better outcomes.

### Start Simple, Add Complexity Later

- **Prefer built-in tools** - Use `node:test` before reaching for Vitest/Jest
- **Minimal dependencies** - We needed only `supertest` for testing, not a full framework
- **Question every addition** - If Node.js can do it natively, don't add a package

### Build Tests Alongside Code

- **Write tests as you implement** - Not before (pure TDD is slow), not after (coverage gaps)
- **Run tests frequently** - After each new function, catch issues early
- **Fix failing tests immediately** - Don't accumulate test debt

### Keep Documentation in Sync

- **Update docs after implementation** - Specs drift from reality; reconcile regularly
- **Document what you actually built** - Not what you planned to build
- **Record deviations** - If implementation differs from spec, update the spec

### Review Spec vs Implementation

After completing a phase:
1. Re-read the technical specification
2. List discrepancies (missing endpoints, different formats, etc.)
3. Decide: fix the code or update the spec?
4. Add discovered issues to "Future Considerations"

### Separate MVP from Future Work

- **Don't gold-plate** - Ship working code, note improvements for later
- **Use a backlog** - `TECHNICAL_SPECIFICATION.md` Section 8 tracks post-MVP items
- **Prioritize ruthlessly** - Security/stability issues > nice-to-haves

### Commit Workflow

1. Implement a coherent chunk (one feature, one fix)
2. Run tests to verify
3. Write descriptive commit message (what + why)
4. Push frequently - don't accumulate large uncommitted changes

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

| File | Purpose |
|------|---------|
| `TECHNICAL_SPECIFICATION.md` | API contracts, data formats, future considerations |
| `IMPLEMENTATION_PLAN.md` | Phased tasks with completion status |
| `TEST_SUITE.md` | Testing strategy and patterns |
| `AGENTS.md` | This file - development guidelines |

Update these documents when making significant changes.

## Quick Commands

```bash
npm install           # Install dependencies
npm start             # Start server (port 3000)
npm run dev           # Start with auto-reload
npm test              # Run tests
```
