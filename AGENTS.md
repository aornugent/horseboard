# Agent Directives

System prompt for AI agents operating on this codebase.

## Project Objective

Synchronize horse feeding schedules between a mobile controller and a stable TV display in real-time.

**Domain model:** Horses (columns) x Feeds (rows) = Quantities (AM/PM amounts).

**Canonical references:**
- `TECHNICAL_SPECIFICATION.md` - API contracts, data dictionary, behavioral rules
- `src/shared/` - Source of truth for validation and business logic

---

## Mandatory Rules

### 1. Shared Kernel Rule

**All business logic affecting data integrity MUST reside in `src/shared/`.**

```
src/shared/
├── resources.ts    # Zod schemas, RESOURCES config (validation)
├── time-mode.ts    # AM/PM calculation (getEffectiveTimeMode)
├── fractions.ts    # Quantity formatting (formatQuantity)
```

**Violations:**
- Writing validation logic in a component → FORBIDDEN
- Writing time mode logic in server only → FORBIDDEN
- Duplicating schema definitions → FORBIDDEN

**Rationale:** The client imports `@shared/*`; the server imports `../../shared/*`. Identical code executes in both environments. Logic drift is impossible when there is only one implementation.

### 2. Signals-Only State Rule

**Use Preact Signals for all reactive state. Never use React hooks (useState, useEffect) for application state.**

**Pattern (observed in `src/client/lib/engine.ts`):**
```typescript
// CORRECT: Signal-based store
const items = signal<T[]>([]);
const byId = computed(() => new Map(items.value.map(i => [i.id, i])));

// FORBIDDEN: Hook-based state
const [items, setItems] = useState<T[]>([]);
```

**Store architecture:**
1. Store factories in `src/client/lib/engine.ts` create typed stores
2. Singleton stores instantiated in `src/client/stores/index.ts`
3. Components import signals directly from stores
4. Components read `.value` from signals; Preact auto-subscribes

**Rationale:** Fine-grained reactivity. Components re-render only when their specific signal dependencies change, not on any state update.

### 3. Dumb TV Rule

**The TV Display is a passive renderer. It MUST NOT contain editing logic.**

**Observed contract (from `src/client/views/Display.tsx`):**
```typescript
<SwimLaneGrid
  horses={horses}
  feeds={feeds}
  timeMode={effectiveTimeMode}
  isEditable={false}  // ALWAYS false for TV
/>
```

**Permitted operations:**
- Read signals
- Render data
- Apply themes based on `effectiveTimeMode`

**Forbidden operations:**
- Modify stores
- Call API endpoints
- Handle user input for data modification

**Data flow:** `SSE Event → Store Update → Signal Change → TV Re-renders`

### 4. Third Normal Form Rule

**The database schema MUST maintain 3NF. No JSON blobs. No denormalization.**

**Observed structure (from `src/server/db/migrations/001_initial_schema.sql`):**
```
displays  →  horses   →  diet_entries  ←  feeds
   1:N          1:N                            N:1
```

**Enforced constraints:**
- Primary keys: UUID format (`{prefix}_{16hex}`)
- Foreign keys: `ON DELETE CASCADE`
- Composite key for junction table: `diet_entries(horse_id, feed_id)`
- Timestamps: `created_at`, `updated_at` on all tables

**Forbidden patterns:**
- Storing arrays as JSON columns
- Storing nested objects as JSON columns
- Redundant data across tables
- Missing foreign key constraints

### 5. Repository Pattern Rule

**Database access MUST go through the repository abstraction in `src/server/lib/engine.js`.**

**Required usage:**
```javascript
const repo = createRepository(db, 'horses');
const horse = repo.getById(id);           // Returns camelCase API format
const horses = repo.getByParent(displayId);
repo.create(data, parentId);
repo.update(data, id);
repo.delete(id);
```

**Column mapping is automatic:**
- API format: `camelCase` (e.g., `displayId`, `noteExpiry`)
- DB format: `snake_case` (e.g., `display_id`, `note_expiry`)

**Forbidden:**
- Raw SQL in route handlers
- Direct `db.prepare()` calls outside engine.js
- ORM usage (Sequelize, Prisma, TypeORM)

---

## Visual Design Constraints

### Theme System

Two themes defined in `src/client/styles/theme.css`:

| Theme | Name | Background | Text | Accent |
|-------|------|------------|------|--------|
| AM | Morning Mist | `#f8f9fa` | `#2d4a3e` | Hunter Green |
| PM | Tack Room | `#2c2c2e` | `#f5a623` | Amber |

Theme transitions use 3-second ease for calming effect.

### Zero Values

Zero and null quantities MUST render as blank cells. No dashes. No "0" text. No placeholders.

**Rationale:** Creates recognizable "shape patterns" for diets when viewed from distance.

### Touch Targets

All interactive elements MUST be minimum 48px. Defined in theme.css:
```css
button { min-height: 48px; }
```

### Swim Lane Grid

Columns (horses) alternate background colors. Rows do not.

```css
.swim-lane-alt { background: var(--color-swim-lane-alt); }
```

---

## Code Organization

```
src/
├── client/
│   ├── lib/engine.ts      # Store factories (Signal-based)
│   ├── stores/index.ts    # Singleton store instances
│   ├── services/sse.ts    # SSE client (hydrates stores)
│   ├── views/             # Page components
│   └── components/        # Reusable UI components
├── server/
│   ├── lib/engine.js      # Repository factories, SSE manager
│   └── db/migrations/     # SQL schema definitions
└── shared/
    ├── resources.ts       # Zod schemas, RESOURCES config
    ├── time-mode.ts       # Time mode calculation
    └── fractions.ts       # Quantity formatting
```

---

## Verification Commands

```bash
node --test tests/unit/*.test.js         # Shared kernel tests
node --test tests/integration/*.test.js  # Database tests
timeout 3 node server/index.js           # Server startup check
```

All tests MUST pass before committing.

---

## Prohibited Actions

1. **Do not** write business logic outside `src/shared/`
2. **Do not** use React hooks for application state
3. **Do not** add editing capabilities to the TV display
4. **Do not** store JSON blobs in the database
5. **Do not** bypass the repository abstraction
6. **Do not** render "0" or "-" for empty values
7. **Do not** create touch targets smaller than 48px
8. **Do not** use ORMs
