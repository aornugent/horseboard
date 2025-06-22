# Implementation Plan

## Phase 1: Pilot Readiness (Critical Fixes)

This phase addresses the "Required Changes Before Pilot" to make the application stable enough for a friendly user pilot.

### 1. Backend: Implement Persistent Storage
    - **Goal:** Replace the in-memory `displays` object with a persistent data store to prevent data loss on server restart.
    - **Action:**
        - Choose a serverless database (e.g., Firebase Firestore or Supabase). For this plan, we'll assume **Firebase Firestore**.
        - Set up a Firebase project and configure Firestore.
        - Create `backend/src/store/firestore.js` (or similar name).
        - This module will contain all logic for interacting with Firestore:
            - `initializeDb()`: Connect to Firestore.
            - `getDisplay(displayId)`: Fetch display data.
            - `createDisplay(displayId, initialData)`: Create a new display document.
            - `updateDisplayData(displayId, newData)`: Update display data.
            - `getDisplayByPairCode(pairCode)`: Fetch display by pair code (requires creating an index in Firestore).
            - `updateDisplayPairCode(displayId, pairCode)`: Update pair code.
        - Modify `backend/server.js` (and later `displayService.js`) to use these Firestore functions instead of the in-memory `displays` object.
        - Ensure environment variables are used for Firebase credentials.

### 2. Configuration: Centralize and Externalize
    - **Goal:** Remove all hardcoded URLs and magic strings.
    - **Action:**
        - **Backend:**
            - Create a `.env` file in the `backend` directory.
            - Add `PORT`, Firebase configuration keys (from Firebase setup), and any other sensitive/configurable values.
            - Use a library like `dotenv` to load these variables in `server.js`.
            - Add `.env` to `backend/.gitignore`.
        - **Mobile App:**
            - Create `mobile-app/src/config.js`.
            - Define and export `BACKEND_URL`.
            - `export const BACKEND_URL = 'http://<YOUR_LOCAL_IP_OR_HOSTNAME>:3000'; // Update as needed`
            - Update `mobile-app/DynamicInfoBoardMobile/screens/PairingScreen.js` and `mobile-app/DynamicInfoBoardMobile/screens/TableEditorScreen.js` to import `BACKEND_URL` from `src/config.js`.
            - Provide clear instructions in a README or comments on how to set the `BACKEND_URL` for local development.

### 3. Backend: Basic Structural Refactor
    - **Goal:** Break up `server.js` into a standard Express structure for better maintainability.
    - **Action:**
        - Create the following directories in `backend/src/`: `api`, `services`, `store` (if not already created in step 1).
        - **`backend/src/api/routes.js`:**
            - Move all Express route definitions (`app.post('/pair'`, `app.post('/display/:displayId'`, `app.get('/display/:displayId'`, `app.get('/pair-status/:pairCode')`) here.
            - This file will export an Express router.
            - `server.js` will import and use this router (`app.use('/api', apiRoutes);`).
        - **`backend/src/services/displayService.js`:**
            - Move the business logic related to pairing and data updates here.
            - Functions like `handlePairingRequest`, `handleDisplayDataUpdate`, `getDisplayData`, `getPairingStatus`.
            - These functions will use the `firestore.js` module for data persistence.
            - Route handlers in `routes.js` will call functions from `displayService.js`.
        - **`backend/src/store/firestore.js`:** (As defined in step 1)
            - Contains all Firestore interaction logic.
        - **`backend/server.js` (main file):**
            - Will be significantly slimmed down.
            - Responsibilities:
                - Initialize Express app.
                - Load environment variables.
                - Initialize Firebase/DB connection (calling `initializeDb()` from `firestore.js`).
                - Mount the API routes.
                - Start the HTTP server.

### 4. State Management: Refactor the Mobile Editor (TableEditorScreen.js)
    - **Goal:** Simplify `TableEditorScreen.js` by separating data logic from UI rendering.
    - **Action:**
        - Choose a state management library. **Zustand** is recommended for its simplicity.
        - Install Zustand: `npm install zustand` or `yarn add zustand` in the `mobile-app/DynamicInfoBoardMobile` directory.
        - Create `mobile-app/src/store/tableStore.js` (or similar).
        - Define a Zustand store to manage:
            - `originalData`: The full dataset fetched from the backend.
            - `filteredData`: Data currently displayed in the table (after sorting/pagination).
            - `columns`: Table column definitions.
            - `currentPage`, `rowsPerPage`.
            - `sortColumn`, `sortDirection`.
            - `isLoading`, `error`.
        - Actions in the store:
            - `fetchInitialData(displayId)`: Fetches data from the backend and updates the store.
            - `setData(newData)`: Directly sets table data (e.g., after an edit).
            - `updateCell(rowIndex, columnId, value)`: Updates a specific cell. This action will also trigger a backend update.
            - `setSort(columnId)`: Handles sorting logic.
            - `setPage(pageNumber)`: Handles pagination.
            - `syncDataToBackend()`: Pushes the current `originalData` to the backend.
        - Refactor `mobile-app/DynamicInfoBoardMobile/screens/TableEditorScreen.js`:
            - Remove most `useState` hooks related to table data, pagination, and sorting.
            - Use the Zustand store (`useStore(state => state.data)`, `useStore(state => state.actions.updateCell)`).
            - UI components will now primarily read from the store and call store actions.
            - Logic for API calls (fetch, update) should be encapsulated within store actions.

### 5. Error Handling: Make it Graceful
    - **Goal:** Improve user experience by handling errors more gracefully.
    - **Action:**
        - **TV App (`google-tv-app/app/src/main/java/com/example/dynamictvapp/MainActivity.java`):**
            - In `fetchAndDisplayData` and `checkPairingStatus`:
                - `onFailure`: Instead of just logging, update the WebView to show a user-friendly full-screen error message (e.g., "Cannot connect to server. Retrying in X seconds...", "Invalid Display ID"). This can be done by loading a specific HTML string or a local error HTML file into the WebView.
                - `onResponse`: If the response is not OK, or if data is malformed, also display a clear error message in the WebView.
                - Implement a simple retry mechanism with backoff for network errors.
        - **Mobile App:**
            - For non-critical errors (e.g., a failed data sync that can be retried, minor validation issues), use a less intrusive feedback mechanism than `Alert`.
            - Consider implementing a Toast/Snackbar component (many React Native libraries offer this, or a simple custom one can be built).
            - `Alert` can still be used for critical errors that require user immediate attention (e.g., pairing failed, session expired).
            - Ensure API call error handling in the new Zustand store actions updates an `error` state in the store, which the UI can then react to.

## Phase 2: V1.0 Application (Core Features for Launch)

This phase addresses the "Engineering Requirements for a Viable V1.0 Application."

### 6. Real-Time Communication
    - **Goal:** Replace polling with a real-time solution for instant data updates on the TV.
    - **Action (Option 1: Leveraging Firestore Real-time):**
        - **Backend:** No significant change needed if Firestore is used, as updates are already pushed to it.
        - **TV App (`google-tv-app/app/src/main/java/com/example/dynamictvapp/MainActivity.java`):**
            - Modify `fetchAndDisplayData` to use Firestore's real-time listeners (`addSnapshotListener`).
            - When data changes in Firestore for the current `displayId`, the listener will be triggered, and the WebView will be updated automatically.
            - Handle listener detachment when the activity is destroyed or display ID changes.
    - **Action (Option 2: WebSockets with Socket.io):**
        - **Backend:**
            - Add `socket.io` to the backend.
            - Initialize Socket.io server and attach it to the HTTP server.
            - When data is updated via `displayService.js` (e.g., `updateDisplayData`), after successfully saving to Firestore, emit a WebSocket event to a room corresponding to the `displayId` (e.g., `io.to(displayId).emit('dataUpdate', newData)`).
        - **TV App (`google-tv-app/app/src/main/java/com/example/dynamictvapp/MainActivity.java`):**
            - Add a WebSocket client library for Java/Android.
            - Connect to the backend Socket.io server.
            - Join a room based on its `displayId` (`socket.emit('joinRoom', displayId)`).
            - Listen for `dataUpdate` events. On receiving an event, update the WebView with the new data.
            - Handle WebSocket connection/disconnection and errors.
        - **Mobile App:** (Optional for this feature, but could be used for bi-directional real-time if needed later)
            - Could also connect to Socket.io to receive real-time confirmations or updates if necessary.

### 7. User Authentication and Authorization
    - **Goal:** Secure the application, allowing users to sign up, log in, and manage only their own displays.
    - **Action:**
        - **Choose an Authentication Provider:** Firebase Authentication is a strong candidate, integrating well with Firestore.
        - **Backend:**
            - Integrate Firebase Admin SDK for verifying user tokens.
            - Protect API endpoints: Create middleware that checks for a valid Firebase ID token in the `Authorization` header.
            - Modify Firestore rules to enforce per-user data access (e.g., a user can only read/write display documents where `userId === auth.uid`).
            - Update `displayService.js` and Firestore queries:
                - When creating a display, associate it with the authenticated `userId`.
                - All operations on displays must check that the `userId` from the token matches the `userId` associated with the display in Firestore.
        - **Mobile App:**
            - Add Firebase SDK for client-side authentication.
            - Implement Sign Up, Log In, and Log Out screens/flows.
            - Store the user's ID token securely and send it with API requests.
            - Manage application state based on authentication status (e.g., redirect to login if not authenticated).
            - User's displays list should be filtered based on their `userId`.

### 8. Automated Testing
    - **Goal:** Create a safety net to ensure code quality and prevent regressions.
    - **Action:**
        - **Backend (Jest):**
            - Install Jest and related packages (`jest`, `supertest` for API testing).
            - Write unit tests for `displayService.js` functions. Mock Firestore interactions.
            - Write integration tests for API routes in `routes.js` using `supertest` to simulate HTTP requests and verify responses.
            - Aim for good coverage of business logic and critical API endpoints.
        - **Mobile App (React Native Testing Library):**
            - Install `@testing-library/react-native` and Jest (usually comes with React Native).
            - Write component tests for key UI components (e.g., `TableEditorScreen`, `PairingScreen`, custom input components).
            - Test rendering, user interactions (button presses, text input), and state changes (mocking the Zustand store where necessary).

### 9. CI/CD Pipeline
    - **Goal:** Automate testing, building, and deployment.
    - **Action (GitHub Actions):**
        - Create workflow files in `.github/workflows/`.
        - **Backend CI/CD:**
            - Workflow triggered on push/merge to `main` (or `develop` branch).
            - Steps:
                - Checkout code.
                - Set up Node.js.
                - Install backend dependencies (`npm ci`).
                - Run backend tests (`npm test`).
                - (Optional) Build a Docker container.
                - Deploy to a hosting service (e.g., Google Cloud Run, AWS Elastic Beanstalk, Heroku). Store secrets (API keys, DB credentials) securely in GitHub Actions secrets.
        - **Mobile App CI:**
            - Workflow triggered on push/merge to `main`.
            - Steps:
                - Checkout code.
                - Set up Node.js and Java (for Android builds).
                - Install mobile app dependencies (`npm ci` in `mobile-app/DynamicInfoBoardMobile`).
                - Run mobile app tests (`npm test` in `mobile-app/DynamicInfoBoardMobile`).
                - (Optional) Build the Android APK/AAB and iOS app (requires more complex setup, especially for iOS, potentially using services like EAS Build or App Center).

## General Principles During Implementation

- **Incremental Changes:** Apply these changes step-by-step. Test thoroughly after each major refactor or feature addition.
- **Version Control:** Use Git for version control. Create feature branches for each significant piece of work (e.g., `feature/firestore-backend`, `refactor/mobile-state-management`).
- **Code Reviews:** (If applicable) Have code reviewed before merging to the main branch.
- **Documentation:** Update READMEs and add code comments where necessary, especially for new configurations, setup steps, or complex logic.
- **"Boy Scout Rule":** Leave the code cleaner than you found it. Address small issues and improve clarity as you work.

This plan provides a structured approach to evolving the MVP into a more robust and feature-rich application. Priorities might shift based on user feedback and business needs, but this forms a solid technical roadmap.
