# Agent Instructions and Guidelines

This document provides instructions and guidelines for AI agents interacting with this codebase.

## General Principles

1.  **Understand the Goal:** The primary goal is to build a "Dynamic Information Board" system as outlined in `TECHNICAL_SPECIFICATION.md` and the initial product vision. The MVP focuses on the core loop: mobile table editing reflecting on a Google TV.
2.  **Follow the Plan:** Adhere to the steps outlined in `IMPLEMENTATION_PLAN.md`. If changes are needed, update the plan first.
3.  **Incremental Development:** Implement features incrementally. Test and verify each part where possible.
4.  **Clarity and Simplicity (MVP Focus):** For the MVP, prioritize the simplest solutions that meet the requirements. Avoid over-engineering.
5.  **Modularity:** Keep components (`google-tv-app`, `mobile-app`, `backend`) decoupled as much as possible, interacting through defined APIs.
6.  **READMEs are Key:** Ensure `README.md` files in each component's directory are kept up-to-date with setup, build, and run instructions.

## Component-Specific Notes

### Backend (`backend/`)
*   **Technology:** Node.js with Express.js.
*   **Data Store (MVP):** In-memory JavaScript object. See `backend/server.js` for the initial structure and `TECHNICAL_SPECIFICATION.md` for details.
*   **API Endpoints:** Implement endpoints as specified in `TECHNICAL_SPECIFICATION.md`.
*   **Dependency Management:** Uses `package.json`. If `npm install` issues persist with the automated tools, note this for manual intervention. Ensure `.gitignore` correctly excludes `node_modules`.
*   **Code Structure:** Aim to separate concerns:
    *   `server.js`: Express app setup, middleware, starting the server.
    *   `src/api/routes.js`: Define API routes and link to service handlers.
    *   `src/services/displayService.js`: Business logic for display management and pairing.
    *   `src/store/memoryStore.js`: Implementation of the in-memory store.

### Mobile App (`mobile-app/`)
*   **Technology:** React Native.
*   **Focus:** Pairing, table editing, and controlling TV display pagination.
*   **State Management:** For MVP, simple React state (`useState`, `useReducer`) or React Context is likely sufficient.
*   **Project Initialization:** The current scaffold is basic. A full React Native project would be initialized using `npx react-native init`.
*   **UI:** Keep UI functional and straightforward for MVP.

### Google TV App (`google-tv-app/`)
*   **Technology:** Android (Kotlin/Java) with WebView for table rendering.
*   **Focus:** Displaying pairing code and rendering table data from the backend via WebView.
*   **WebView Content:** The table will be rendered using local HTML (`assets/table_display.html`), CSS, and JavaScript. Data is passed from native Android code to the WebView's JavaScript.
*   **Polling:** The TV app will poll the backend `GET /display/{displayId}` endpoint.

## Coding Conventions (General)

*   **Comments:** Add comments to explain complex logic or non-obvious decisions.
*   **Naming:** Use clear and descriptive names for variables, functions, and files.
*   **Error Handling:** Implement basic error handling, especially for API interactions.
*   **Commit Messages:** Follow standard conventions: short subject line (max 50 chars), blank line, then a more detailed body if necessary.

## Tooling & Environment

*   Be aware of the limitations or specific behaviors of the provided tools (e.g., `run_in_bash_session` behavior with `cd` or `npm install`). Adapt strategies if necessary (like using `--prefix` for npm, though that also failed in one instance).
*   If a tool consistently fails, report it or try to find a workaround if possible, clearly documenting the issue.

## Future Work (Post-MVP)

*   Remember the future considerations outlined in `TECHNICAL_SPECIFICATION.md` (e.g., persistent database, real-time updates, authentication). MVP code should be clean enough to facilitate these future enhancements but not prematurely implement them.

This document can be updated by agents if new conventions or important guidelines emerge.
