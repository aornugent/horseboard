# Agent Guidelines

Instructions for AI agents working on this codebase.

## Quick Orientation

- **What:** Horse feed management system (edit feeding schedules on phone, display on stable TV)
- **Domain:** Horses (columns) × Feeds (rows) = Quantities (AM/PM values)
- **Stack:** Vite + Preact + Signals (frontend), Node/Express (backend), SQLite (relational, 3NF)
- **Tasks:** See `IMPLEMENTATION_PLAN.md` for pending work
- **Reference:** See `TECHNICAL_SPECIFICATION.md` for API and data formats

## Domain Model (SQL Tables)

```
┌─────────────────────────────────────────────────────────────┐
│  horses              │  feeds                │  diet_entries│
├─────────────────────────────────────────────────────────────┤
│  id (PK)             │  id (PK)              │  id (PK)     │
│  name                │  name                 │  horse_id FK │
│  note                │  unit                 │  feed_id FK  │
│  note_expires_at     │  rank                 │  am_quantity │
│  created_at          │  created_at           │  pm_quantity │
│  updated_at          │  updated_at           │  created_at  │
│                      │                       │  updated_at  │
└─────────────────────────────────────────────────────────────┘
```

**Key concepts:**
- **Feed:** A supplement with a name and unit (scoop, ml, sachet, biscuit)
- **Horse:** An animal with optional notes (can have expiry)
- **Diet Entry:** The intersection - quantity of each feed per horse for AM and PM
- **Time Mode:** AUTO detects morning/afternoon; can be manually overridden

## Design Philosophy: Modern Equestrian Utility

### Aesthetic: "Calm Utility"

- Use high contrast and high comfort whitespace
- Avoid generic "Tech Blue"
- Color palettes:
  - **Morning Mist** (Off-white/Hunter Green) for AM
  - **Tack Room** (Dark Grey/Amber) for PM

### TV Display: Designed for Distance Reading

- **Vertical Swim Lanes:** Zebra-striped columns (not rows) to prevent reading errors
- **Zero Values:** Must be strictly blank (no dashes, no '0') to create recognizable "shape patterns" for diets
- **Monospace Numbers:** For alignment

### Mobile Controller: Designed for "Dirty Hands"

- **No System Keyboards:** Use a custom "Feed Pad" drawer for data entry
- **No Grids on Mobile:** Use Task-Based "Status Card" lists
- **Touch Targets:** Must be at least 48px

## Architecture

### 1. Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Vite + Preact + Signals | Fast builds, fine-grained reactivity |
| Backend | Node.js + Express | Business logic owner |
| Database | SQLite (3NF relational) | No JSON blobs, proper foreign keys |
| Validation | Zod | Shared schemas between client/server |
| Real-time | SSE | Instant updates, no polling |

### 2. Shared Logic (`src/shared/`)

All business logic and data schemas must live in `src/shared/` and be imported by both client and server:

```
src/shared/
├── schemas/          # Zod schemas (Horse, Feed, DietEntry)
├── time-mode.ts      # AM/PM calculation logic
├── fractions.ts      # Fraction formatting (0.5 → ½)
└── validation.ts     # Input validation utilities
```

**Why:** Single source of truth prevents drift between client and server logic.

### 3. State Management (Preact Signals)

- Use Signals for reactive state, not prop drilling
- UI reacts to fine-grained updates automatically
- Derived state via computed signals
- Global app state in dedicated signal stores

### 4. Database Pattern

- **No JSON blobs** - use normalized SQL tables
- **Foreign keys** enforce referential integrity
- **Atomic transactions** for multi-table writes
- **Timestamps** on all tables: `created_at`, `updated_at`

### 5. TV is Dumb, Controller is Smart

- **TV Display:** Pure renderer, listens to SSE, no editing logic
- **Controller:** Command center, all editing happens here
- **Server:** Business logic owner (time mode, feed ranking, note expiry)

### 6. Real-Time by Default

- SSE provides instant updates
- Settings changes (`state` events) are lightweight
- Data changes (`data` events) include full payload
- No polling, no refresh needed

## Development Practices

### Test-Driven

- Write tests alongside implementation
- Run `npm test` frequently
- Domain logic needs comprehensive test coverage

### Keep Documentation in Sync

After completing work:
1. Re-read the technical specification
2. Update the spec to match reality
3. Add discovered issues to "Future Considerations"

### Commit Workflow

1. Implement a coherent chunk
2. Run tests
3. Write descriptive commit message
4. Push - don't accumulate uncommitted changes

## Key Implementation Notes

### Value Semantics

| User Input | Stored Value | Report Calculation |
|------------|--------------|-------------------|
| Empty/clear | `NULL` | 0 |
| `0` | `0` | 0 |
| `0.5` | `0.5` | 0.5 |

### Fraction Display

TV displays fractions nicely (logic in `src/shared/fractions.ts`):
- 0.25 → ¼
- 0.5 → ½
- 0.75 → ¾
- Other decimals show as-is with unit

### Feed Ranking

Feeds are sorted by popularity (usage count across all horses):
1. Count horses using each feed (AM or PM > 0)
2. Sort descending by count
3. Update `rank` field
4. Common feeds appear first in "Add Feed" lists

### Time Mode

Logic in `src/shared/time-mode.ts`:
- AUTO: 04:00-11:59 = AM, 12:00-03:59 = PM
- Override: User forces AM/PM, expires after 1 hour
- Server broadcasts state change, TV updates immediately

## Quick Commands

```bash
npm install           # Install dependencies
npm run dev           # Start Vite dev server + backend
npm run build         # Production build
npm test              # Run tests
```

## Documentation Map

| File | Contents |
|------|----------|
| `README.md` | Project overview, setup |
| `TECHNICAL_SPECIFICATION.md` | API, data formats, business logic |
| `IMPLEMENTATION_PLAN.md` | Pending tasks |
