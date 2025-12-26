# Agent Directives

## Objective

Synchronize horse feeding schedules between mobile controller and stable TV display in real-time.

**Domain:** Horses (columns) × Feeds (rows) = Quantities (AM/PM).

**References:** `TECHNICAL_SPECIFICATION.md` for contracts; `src/shared/` for logic.

---

## Rules

### 1. Shared Kernel

Business logic affecting data integrity MUST reside in `src/shared/`. Client imports `@shared/*`; server imports `../../shared/*`. One implementation, no drift.

- `resources.ts` — Zod schemas, validation
- `time-mode.ts` — AM/PM calculation
- `fractions.ts` — Quantity formatting

### 2. Signals State

Preact Signals only. No React hooks (useState/useEffect) for application state.

- Store factories: `src/client/lib/engine.ts`
- Singletons: `src/client/stores/index.ts`
- Components read `.value` directly

### 3. Dumb TV

TV Display (`src/client/views/Display.tsx`) is read-only. No store mutations, no API calls, no input handling. Data flow: SSE → Store → Signal → Render.

### 4. Third Normal Form

Schema in `src/server/db/migrations/001_initial_schema.sql`. No JSON blobs. Foreign keys with CASCADE. Composite key for junction table. Timestamps on all tables.

### 5. Repository Pattern

All DB access via `createRepository()` in `src/server/lib/engine.js`. Automatic camelCase↔snake_case mapping. No raw SQL in routes. No ORMs.

---

## Visual Constraints

- **Themes:** AM (Morning Mist), PM (Tack Room) — see `src/client/styles/theme.css`
- **Zero values:** Render blank. No "0", no dash, no placeholder.
- **Touch targets:** Minimum 48px
- **Swim lanes:** Columns alternate; rows do not.

---

## Verification

```bash
node --test tests/unit/*.test.js
node --test tests/integration/*.test.js
```

Tests must pass before commit.

---

## Prohibited

1. Business logic outside `src/shared/`
2. React hooks for app state
3. Editing logic in TV display
4. JSON columns in database
5. Raw SQL in route handlers
6. Rendering "0" or "-" for empty cells
7. Touch targets < 48px
8. ORMs
