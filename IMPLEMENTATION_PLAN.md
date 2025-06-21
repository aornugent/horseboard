# Implementation Plan: Dynamic Information Board MVP

This document breaks down the development of the Minimum Viable Product (MVP) into manageable tasks for each component.

## Phase 1: Core Backend & TV Display

**Goal:** Get a simple, hardcoded table displaying on the TV via the backend.

### Task 1.1: Backend - Basic Server Setup (Node.js/Express)
    - Initialize Node.js project (`npm init`).
    - Install Express.js.
    - Create a basic Express server (`server.js`).
    - Implement in-memory store for `displays` (e.g., a JavaScript object).
    - **Deliverable:** A running Express server.

### Task 1.2: Backend - `GET /display/{displayId}` Endpoint
    - Implement the endpoint to retrieve `tableData`.
    - Initially, use hardcoded data for a specific `displayId` in the in-memory store.
    - **Deliverable:** Endpoint that returns a JSON `tableData` object.

### Task 1.3: Google TV App - Basic Android Project & WebView
    - Create a new Android Studio project for Google TV.
    - Design a simple layout with a full-screen WebView.
    - Create a local HTML file (`table_display.html`) with basic table structure and CSS.
    - Include JavaScript in `table_display.html` to populate the table from a JS object.
    - **Deliverable:** TV app that loads and displays the local HTML with a sample static table.

### Task 1.4: Google TV App - Data Fetching & Rendering
    - Implement logic to call the backend `GET /display/{displayId}` endpoint (use a hardcoded `displayId` for now).
    - Pass the fetched JSON data to the WebView's JavaScript.
    - Update JavaScript in `table_display.html` to render the table based on the received data.
    - Implement basic polling (e.g., every 10 seconds).
    - **Deliverable:** TV app displays table data fetched from the backend.

## Phase 2: Mobile App Pairing & Basic Table Push

**Goal:** Pair the mobile app with the TV and send a basic table from mobile to TV.

### Task 2.1: Backend - `POST /pair` Endpoint
    - Implement the endpoint to simulate pairing.
    - For MVP, this might just involve the backend "recognizing" a display ID.
    - The TV app will need to generate and display a code. For now, we can assume a known code for testing.
    - **Deliverable:** `/pair` endpoint that mobile can call.

### Task 2.2: Backend - `PUT /display/{displayId}` Endpoint
    - Implement the endpoint to receive and store `tableData` from the mobile app.
    - Update the in-memory store with the data received.
    - **Deliverable:** `/display/{displayId}` endpoint that updates backend data.

### Task 2.3: Google TV App - Pairing Code Display
    - Generate a unique 6-digit random code on app launch.
    - Display this code clearly on the screen.
    - This code will serve as the `displayId`.
    - Modify data fetching to use this generated `displayId`.
    - **Deliverable:** TV app shows a pairing code and uses it for backend communication.

### Task 2.4: Mobile App - React Native Project Setup
    - Initialize a new React Native project.
    - Create basic navigation structure (Pairing Screen, Table Editor Screen).
    - **Deliverable:** A runnable React Native app with placeholder screens.

### Task 2.5: Mobile App - Pairing Screen UI & Logic
    - Create UI with an input field for the 6-digit code and a "Connect" button.
    - Implement logic to call the backend `POST /pair` endpoint.
    - On successful pairing, navigate to the Table Editor screen, passing the `displayId`.
    - **Deliverable:** Mobile app can "pair" with a `displayId`.

### Task 2.6: Mobile App - Basic Table Editor & Data Push
    - Create a very simple table view (maybe just display JSON for now).
    - Allow modification of some hardcoded initial table data.
    - Implement a "Send to TV" button that calls the backend `PUT /display/{displayId}` with the current table data.
    - **Deliverable:** Mobile app can send table data to the backend, which then updates the TV display.

## Phase 3: Mobile App - Table Interaction Features

**Goal:** Implement core table manipulation features in the mobile app.

### Task 3.1: Mobile App - Table Data Structure & State Management
    - Define how table data (headers, rows) will be managed in the app's state (e.g., using React Context or a state management library like Zustand or Redux Toolkit).
    - **Deliverable:** Clear data model for the table in the mobile app.

### Task 3.2: Mobile App - Grid-like Table Display
    - Implement a component to render the table data in a grid view.
    - Make cells tappable.
    - **Deliverable:** Table is displayed on the mobile app.

### Task 3.3: Mobile App - Edit Cell Functionality
    - On tapping a cell, show an input field/modal to edit its text content.
    - Update the app's state with the new cell value.
    - Automatically (or via a save button) push updates to the backend.
    - **Deliverable:** Users can edit cell content.

### Task 3.4: Mobile App - Add Row/Column Functionality
    - Add "+" buttons for adding new rows and columns.
    - Update app state and push changes to the backend.
    - **Deliverable:** Users can add rows and columns.

### Task 3.5: Mobile App - Sort Functionality
    - Implement logic to sort table data when a column header is tapped (A-Z, then Z-A).
    - Update app state and push changes to the backend.
    - **Deliverable:** Users can sort columns.

## Phase 4: TV Display Pagination Control

**Goal:** Allow the mobile app to control which part of a large table is shown on the TV.

### Task 4.1: Mobile App - Pagination UI for TV Display
    - Add UI elements (e.g., "Show Rows 1-10", "Show Rows 11-20") in a "Display Settings" area.
    - **Deliverable:** UI for selecting TV display page.

### Task 4.2: Mobile App - Slicing Data for TV
    - When a pagination option is selected, the mobile app should prepare a *slice* of the full table data.
    - This sliced data (along with full data for mobile editing) is sent to the backend. The `tableData` in `PUT /display/{displayId}` should reflect what the TV needs to show.
    *Alternative:* The mobile app could send the full data along with display parameters (e.g., `currentPage`, `rowsPerPage`), and the TV app itself does the slicing. For MVP, sending sliced data is simpler for the TV app. We will proceed with sending sliced data from mobile to backend for the TV.
    - **Deliverable:** Mobile app can prepare and send paginated data.

### Task 4.3: Backend - Store/Serve Paginated Data
    - The `PUT /display/{displayId}` endpoint will receive `tableData` that might be a slice.
    - The `GET /display/{displayId}` endpoint will return this (potentially sliced) data.
    - **Deliverable:** Backend handles and serves the (potentially sliced) table data.

### Task 4.4: Google TV App - Displaying Paginated Data
    - The TV app's WebView component should correctly render the (potentially partial) table data it receives. No complex pagination logic needed on TV side if mobile sends the correct slice.
    - **Deliverable:** TV displays the selected page of data.

## Phase 5: Refinements & Polish (MVP complete after this)

### Task 5.1: Basic Error Handling
    - Implement basic error handling and user feedback for common issues (e.g., network errors, invalid pairing code).
    - **Deliverable:** Improved robustness.

### Task 5.2: UI/UX Polish
    - Minor UI improvements for better usability on both mobile and TV.
    - Ensure clear instructions and feedback.
    - **Deliverable:** A more polished user experience.

### Task 5.3: Code Cleanup & READMEs
    - Refactor code for clarity and maintainability.
    - Ensure all components have adequate `README.md` files with setup and usage instructions.
    - **Deliverable:** Well-documented and clean codebase.

## Future Considerations (Post-MVP)
*   Real-time updates (WebSockets).
*   Persistent storage for the backend.
*   User accounts and authentication.
*   Advanced table features.
*   Deployment to app stores and serverless platforms.

This plan will be used to track progress and can be adjusted as needed.
