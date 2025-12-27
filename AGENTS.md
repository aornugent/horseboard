# Agent Directives

## Objective

Synchronize horse feeding schedules between mobile controller and stable board in real-time.

**Domain:** Horses (columns) x Feeds (rows) = Quantities (AM/PM).

**References:** `TECHNICAL_SPECIFICATION.md` for contracts; `src/shared/` for logic.

---

## Rules

### 1. Shared Kernel

Business logic affecting data integrity MUST reside in `src/shared/`. Client imports `@shared/*`; server imports `../../shared/*`. One implementation, no drift.

- `resources.ts` — Zod schemas, validation
- `time-mode.ts` — AM/PM calculation
- `fractions.ts` — Quantity formatting

### 2. Naming: Board, Not Display

The domain model uses "Board" (stable boards), not "Display". A board shows feeding schedules; a controller manages them. Update naming accordingly:

- Types: `Board`, `board_id`
- Files: `Board.tsx`, not `Display.tsx`
- Routes: `/api/boards/:board_id`

### 3. snake_case Everywhere

All identifiers use snake_case across the entire stack:

- Database columns: `horse_id`, `created_at`
- TypeScript types: `{ horse_id: string; created_at: string }`
- Zod schemas: `z.object({ horse_id: z.string() })`
- API payloads: `{ "horse_id": "h_abc123" }`

There is no conversion layer. Names match exactly between database, types, and wire format. This eliminates mapping code entirely.

### 4. Signals State

Preact Signals only. No React hooks (useState/useEffect) for application state.

- Store factory: `src/client/lib/engine.ts` — single generic `createResourceStore`
- Singletons: `src/client/stores/index.ts`
- Components read `.value` directly

### 5. Read-Only Board

The Board view (`src/client/views/Board.tsx`) is read-only. No store mutations, no API calls, no input handling. Data flow: SSE -> Store -> Signal -> Render.

### 6. Explicit Server Routes

Routes are defined explicitly in individual files, one per resource:

- `src/server/routes/boards.ts`
- `src/server/routes/horses.ts`
- `src/server/routes/feeds.ts`
- `src/server/routes/diet.ts`

Each file exports an Express Router with standard REST endpoints. No dynamic route generation.

### 7. Centralized API Service

Client-side API calls go through `src/client/services/api.ts`. Components never contain inline fetch calls. The service module handles:

- Request/response formatting
- Error handling
- Store hydration after responses

### 8. Third Normal Form

Schema in `src/server/db/migrations/001_initial_schema.sql`. No JSON blobs. Foreign keys with CASCADE. Composite key for junction table. Timestamps on all tables.

### 9. Repository Pattern

All DB access via repository functions in `src/server/lib/engine.ts`. No raw SQL in routes. No ORMs.

---

## Visual Constraints

- **Themes:** AM (Morning Mist), PM (Tack Room) — see `src/client/styles/theme.css`
- **Zero values:** Render blank. No "0", no dash, no placeholder.
- **Touch targets:** Minimum 48px
- **Swim lanes:** Columns alternate; rows do not.

---

## Testing

```bash
node --test tests/unit/*.test.js
node --test tests/integration/*.test.js
```

Tests must pass before commit. Keep tests lean but cover critical paths. Prefer E2E tests for user workflows, unit tests for shared logic.

---

## Prohibited

1. Business logic outside `src/shared/`
2. React hooks for app state
3. Editing logic in Board view
4. JSON columns in database
5. Raw SQL in route handlers
6. Rendering "0" or "-" for empty cells
7. Touch targets < 48px
8. ORMs
9. Column mapping configuration objects (e.g., `columns: { horseId: 'horse_id' }`)
10. camelCase in type definitions, schemas, or API payloads
11. Dynamic route generation via `mountResource`
12. Inline fetch calls in view components
13. Multiple store factory functions with duplicated logic
