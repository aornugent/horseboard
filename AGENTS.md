## 1. Documentation Map
**DO NOT** guess logic. Read the specific source of truth:

| Topic | Source of Truth |
| :--- | :--- |
| **User Flows & Auth** | `docs/USER_PATHS.md` |
| **Database Schema** | `src/server/db/migrations/001_schema.sql` |
| **Core Logic** | `TECHNICAL_SPECIFICATION.md` |

## 2. Hard Constraints
Violating these rules breaks the architecture.

1.  **Shared Kernel Pattern:** Business logic (validation, time calculation, fractions) **MUST** exist in `src/shared/`. Client and Server import from here.
2.  **Naming Convention:** `snake_case` strictly across DB, Types, and API JSON. **NO** camelCase conversion layers.
3.  **State Management:**
    *   **Use:** Preact Signals (`.value`).
    *   **Avoid:** React Hooks (`useState`, `useEffect`) for application state.
    *   **Pattern:** Use `createResourceStore` factory in `src/client/lib/engine.ts`.
4.  **Database Access:**
    *   **Use:** Repository pattern in `src/server/lib/engine.ts`.
    *   **Avoid:** Raw SQL in route handlers.
    *   **Avoid:** ORMs (Use `better-sqlite3` wrapper).
5.  **Authentication:**
    *   **Constraint:** All protected routes **MUST** use `requirePermission('view'|'edit'|'admin')`.
    *   **Constraint:** Do not modify `users`, `sessions`, `accounts`, `verifications` tables (Managed by Better Auth).
    *   **Constraint:** Controller tokens must use prefix `hb_` and be hashed (SHA-256).

## 3. Tech Stack & Directories
*   **Runtime:** Node.js 20+
*   **Database:** SQLite (WAL mode enabled)
*   **Frontend:** Preact, Vite, PWA
*   **Communication:** REST (Mutations) + SSE (Updates)

| Directory | Purpose |
| :--- | :--- |
| `src/shared` | **Universal Truth.** Zod schemas, types, pure functions. |
| `src/client` | **UI Only.** Signals, Views, Components. |
| `server` | **API Only.** Express routes, Repositories, SSE Logic. |
| `server/routes` | **Explicit.** One file per resource (e.g., `boards.ts`, `horses.ts`). |

## 4. Development Workflow
*   **Build/Run:** `npm run dev` (starts client + server concurrently).
*   **Test:**
    *   Unit: `npm test` (Fast, logic focus).
    *   E2E: `npm run test:e2e` (Playwright, full flow).
*   **Migrations:**
    *   Create `NNN_name.sql` in `src/server/db/migrations/`.
    *   Auto-applied on server start.

## 5. Visual Standards
*   **Zero Values:** Render as **blank string**. Never "0", never "-".
*   **Touch Targets:** Minimum **48px** for all interactive elements (Mobile-first).
*   **Themes:** Strictly use CSS variables defined in `src/client/styles/theme.css`.