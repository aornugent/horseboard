# Technical Specification: Dynamic Information Board

## 1. Overview

This document outlines the technical details for the Minimum Viable Product (MVP) of a software service that transforms any large screen into a dynamic, remotely-managed information board, optimized for displaying tabular data. The MVP focuses on the core user loop: "I can easily edit a table on my phone, and it instantly appears, correctly formatted, on my big screen."

## 2. System Architecture

The system consists of three main components:

1.  **Google TV App (Display Client):** Displays a pairing code and then renders tabular data received from the backend.
2.  **Mobile App (Controller):** Allows users to pair with a Google TV app, edit table data, and control what is displayed on the TV.
3.  **Backend Server:** Facilitates communication between the mobile app and the Google TV app, storing and serving table data.

## 3. Component Details

### 3.1. Google TV App

*   **Platform:** Android (Google TV)
*   **Primary Language:** Kotlin (or Java, if preferred for simplicity in early stages)
*   **UI Rendering:**
    *   **Pairing Screen:** Native Android UI elements to display a 6-digit pairing code.
    *   **Display Screen:** A full-screen WebView loading a local HTML file (`table_display.html`). JavaScript within this HTML will be responsible for rendering the table data received from the backend.
*   **Data Handling:**
    *   Periodically polls (e.g., every 10 seconds) a backend endpoint (`GET /display/{displayId}`) to fetch the latest table data.
    *   Table data will be in JSON format.
*   **Key Features:**
    *   Generate and display a unique 6-digit pairing code upon launch.
    *   Once paired, switch to WebView to display the table.
    *   Render table data using HTML, CSS, and JavaScript.

### 3.2. Mobile App (Controller)

*   **Platform:** Cross-platform, with initial focus on general mobile phone interaction.
*   **Framework:** React Native
*   **UI:**
    *   **Pairing Screen:** Input field for the 6-digit code and a "Connect" button.
    *   **Table Editor:** A grid-like interface to view and edit table data.
*   **Functionality:**
    *   **Pairing:** Send the entered code to `POST /pair` on the backend.
    *   **Edit Cell:** Allow users to tap a cell and modify its text content.
    *   **Add Row/Column:** "+" buttons to append new rows or columns.
    *   **Sort:** Tapping a column header sorts data (A-Z on first tap, Z-A on second). The sorted data is sent to the backend.
    *   **Pagination (Mobile View):** Simple navigation (arrows) if the table is too large for the mobile screen.
    *   **Pagination (TV Display Control):** Allow the user to select a "page" or slice of rows/columns (e.g., "Show Rows 1-10", "Show Rows 11-20") to be displayed on the TV. When a selection is made, the mobile app sends only that specific slice of data to the backend via `PUT /display/{displayId}`.
*   **Data Handling:**
    *   Manages the table data locally.
    *   Sends the entire (or sliced, for TV display) `tableData` JSON object to the backend via `PUT /display/{displayId}` upon any change.

### 3.3. Backend Server

*   **Platform:** Node.js
*   **Framework:** Express.js
*   **Database:** In-memory JavaScript object/array (for MVP simplicity). This can be a simple dictionary where keys are `displayId`s.
    *   **Future Consideration:** Replaceable with Firebase Firestore/Vercel KV for persistence and scalability.
*   **API Endpoints:**
    *   **`POST /pair`**
        *   **Request Body:** `{ "code": "123456" }`
        *   **Functionality:**
            *   Checks if the `code` (displayId) exists in the in-memory store.
            *   If it exists and isn't already paired with a different mobile device, it can mark it as paired (e.g., store a generated `mobileId` or a simple flag). For MVP, simply acknowledging the displayId is active might be enough.
            *   Returns a success or failure response.
        *   **Response (Success):** `{ "status": "success", "displayId": "123456", "message": "Paired successfully" }`
        *   **Response (Failure):** `{ "status": "error", "message": "Invalid or already paired code" }` (Provide appropriate HTTP status codes, e.g., 200 OK, 400 Bad Request, 404 Not Found).
    *   **`PUT /display/{displayId}`**
        *   **Request Body:** The entire `tableData` JSON object.
            ```json
            // Example tableData
            {
              "headers": ["Task", "Owner", "Status"],
              "rows": [
                ["Buy milk", "Alice", "To Do"],
                ["Walk dog", "Bob", "Done"]
              ],
              "displaySettings": { // Optional: for TV pagination
                "pageInfo": "Rows 1-10" // Or more structured: { type: "rows", start: 0, count: 10 }
              }
            }
            ```
        *   **Functionality:**
            *   Validates `displayId`.
            *   Overwrites the `tableData` for the given `displayId` in the in-memory store.
            *   Updates a `lastUpdated` timestamp.
        *   **Response (Success):** `{ "status": "success", "message": "Display data updated" }`
        *   **Response (Failure):** `{ "status": "error", "message": "Error updating display data" }`
    *   **`GET /display/{displayId}`**
        *   **Functionality:**
            *   Validates `displayId`.
            *   Retrieves the current `tableData` for the given `displayId` from the in-memory store.
        *   **Response (Success):** The `tableData` JSON object.
            ```json
            {
              "lastUpdated": "2023-10-27T10:00:00Z",
              "tableData": {
                "headers": ["Task", "Owner", "Status"],
                "rows": [
                  ["Buy milk", "Alice", "To Do"],
                  ["Walk dog", "Bob", "Done"]
                ]
                // Potentially include displaySettings if TV app needs to be aware of pagination
              }
            }
            ```
        *   **Response (Not Found):** `{ "status": "error", "message": "Display not found" }` (HTTP 404)
        *   **Response (No Data):** Return an empty or default table structure if the display exists but has no data yet.
*   **Data Structure (In-memory example):**
    ```javascript
    // server.js or a dedicated store.js
    const displays = {
      "123456": { // displayId
        pairedMobileId: "some-mobile-device-uuid", // Or simply true/false
        lastUpdated: "2023-10-27T10:00:00Z",
        tableData: {
          headers: ["Task", "Owner", "Status"],
          rows: [
            ["Buy milk", "Alice", "To Do"],
            ["Walk dog", "Bob", "Done"]
          ]
        }
      }
    };
    ```

## 4. Data Flow Example (Pairing & Update)

1.  **Google TV App:** Starts, generates code "654321", displays it.
2.  **Mobile App:** User enters "654321", taps "Connect".
3.  **Mobile App -> Backend:** `POST /pair` with `{ "code": "654321" }`.
4.  **Backend:**
    *   Validates "654321". (For MVP with in-memory store, this means checking if a placeholder for "654321" should be created or if it's ready).
    *   Responds with success to Mobile App.
5.  **Mobile App:** User edits the table (e.g., adds a row "Mow lawn").
6.  **Mobile App -> Backend:** `PUT /display/654321` with the updated `tableData` JSON.
7.  **Backend:** Stores the new `tableData` for "654321".
8.  **Google TV App (polling):** `GET /display/654321`.
9.  **Backend -> Google TV App:** Returns the latest `tableData` (including "Mow lawn").
10. **Google TV App:** Renders the updated table in its WebView.

## 5. Future Considerations (Post-MVP)

*   **Persistence:** Migrate backend from in-memory to Firebase Firestore or Vercel KV.
*   **Authentication/Security:** Secure pairing, potentially user accounts.
*   **Real-time Updates:** Use WebSockets (e.g., Socket.io with Node.js, or Firebase Realtime Database/Firestore listeners) instead of polling for instant TV updates.
*   **Error Handling & Resilience:** More robust error handling across all components.
*   **Advanced Table Features:** Rich text editing, cell merging, multiple table support.
*   **Styling/Theming:** Allow users to customize table appearance.
*   **Offline Support:** For the mobile app.
*   **Deployment:**
    *   Google TV App: Google Play Store.
    *   Mobile App: Apple App Store, Google Play Store.
    *   Backend: Serverless platform (Firebase Functions, Vercel Serverless Functions, AWS Lambda).

This specification will be updated as the project progresses.
