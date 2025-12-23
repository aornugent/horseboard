# Agent Guidelines

Instructions for AI agents working on this codebase.

## Quick Orientation

- **What:** Horse feed management system (edit feeding schedules on phone, display on stable TV)
- **Domain:** Horses (columns) × Feeds (rows) = Quantities (AM/PM values)
- **Stack:** Node.js, Express, SQLite, SSE, vanilla JS
- **Status:** See `IMPLEMENTATION_PLAN.md` for current phase
- **API:** See `TECHNICAL_SPECIFICATION.md` for endpoints and data formats

## Domain Model

```
Horses (columns)     Spider    Lightning   Thunder
                     ───────   ─────────   ───────
Feeds (rows)
  Easisport          ½ scoop   1 scoop     —
  Bute               1 sachet  —           2 sachets
  Chaff              2 scoops  1½ scoops   2 scoops

Notes (footer)       Turn out  —           Vet visit
                     early                 tomorrow
```

**Key concepts:**
- **Feed:** A supplement with a name and unit (scoop, ml, sachet, biscuit)
- **Horse:** An animal with optional notes (can have expiry)
- **Diet:** The intersection - quantity of each feed per horse for AM and PM
- **Time Mode:** AUTO detects morning/afternoon; can be manually overridden

## Design Principles

### 1. Domain-First Data

Data is structured around the domain model, not generic tables:
- Feeds have units and usage-based ranking
- Horses have notes with optional expiry
- Diet entries are typed (AM/PM quantities, not free text)
- Reports calculate weekly consumption automatically

### 2. Simplicity First

- Vanilla JS, no build step, ES Modules
- Minimal dependencies - question every package
- CSS Grid for layout (not heavy frameworks)
- Single SQLite database with JSON blob storage

### 3. TV is Dumb, Controller is Smart

- **TV Display:** Pure renderer, listens to SSE, no editing logic
- **Controller:** Command center, all editing happens here
- **Server:** Business logic owner (time mode, feed ranking, note expiry)

### 4. Real-Time by Default

- SSE provides instant updates
- Settings changes (`state` events) are lightweight
- Data changes (`data` events) include full payload
- No polling, no refresh needed

### 5. Test-Driven

- Write tests alongside implementation
- Run `npm test` frequently
- Fix failing tests immediately
- Domain logic needs comprehensive test coverage

## Development Practices

### Start Simple, Add Complexity Later

- Prefer built-in tools (`node:test`) over frameworks
- If Node can do it, don't add a package
- We test with just `supertest`

### Build Tests Alongside Code

- Write tests as you implement
- Test success cases, error cases, and edge cases
- Domain logic (ranking, time mode, expiry) needs thorough testing

### Keep Documentation in Sync

After completing work:
1. Re-read the technical specification
2. List discrepancies (missing endpoints, different formats)
3. Update the spec to match reality
4. Add discovered issues to "Future Considerations"

### Commit Workflow

1. Implement a coherent chunk
2. Run tests
3. Write descriptive commit message
4. Push - don't accumulate uncommitted changes

## Key Implementation Notes

### Value Semantics

| User Input | Stored Value | Report Calculation |
|------------|--------------|-------------------|
| Empty/clear | `null` (key deleted) | 0 |
| `0` | `0` | 0 |
| `0.5` | `0.5` | 0.5 |

### Fraction Display

TV displays fractions nicely:
- 0.25 → ¼
- 0.5 → ½
- 0.75 → ¾
- Other decimals show as-is with unit

### Feed Ranking

Feeds are sorted by popularity (usage count across all horses). When implementing:
1. Count horses using each feed (AM or PM > 0)
2. Sort descending by count
3. Update `rank` field
4. Common feeds appear first in "Add Feed" lists

### Time Mode

- AUTO: 04:00-11:59 = AM, 12:00-03:59 = PM
- Override: User forces AM/PM, expires after 1 hour
- Server broadcasts state change, TV updates immediately

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Patterns:**
- Use `:memory:` SQLite for integration tests
- Clean state in `beforeEach`, close connections in `after`
- Test success cases, error cases, and input validation

## Quick Commands

```bash
npm install           # Install dependencies
npm start             # Start server (port 3000)
npm run dev           # Start with auto-reload
npm test              # Run tests
```

## Documentation Map

| File | Read For |
|------|----------|
| `README.md` | Project overview, setup, current status |
| `TECHNICAL_SPECIFICATION.md` | API contracts, data formats, business logic |
| `IMPLEMENTATION_PLAN.md` | Phased tasks, what's done, what's next |
| `TEST_SUITE.md` | Test structure and patterns |
