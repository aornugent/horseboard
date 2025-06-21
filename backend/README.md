# Backend Server (Node.js/Express)

This backend server, built with Node.js and Express.js, acts as the intermediary between the Google TV display client and the mobile controller app. For the MVP, it uses an in-memory data store.

## Core Responsibilities
1.  Facilitate pairing between the mobile app and a Google TV display.
2.  Store and serve table data for displays.
3.  Receive table data updates from the mobile app.

## Development Setup

### Prerequisites
*   **Node.js:** Ensure Node.js (LTS version recommended) is installed. Download from [nodejs.org](https://nodejs.org/).
*   **npm:** A JavaScript package manager, included with Node.js.

### Project Setup
1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
    Key dependencies (as per `package.json`):
    *   `express`: Web framework.
    *   `cors` (if you added it for different origin testing, though not strictly in current `package.json` unless `npm install express` added it as a sub-dependency or if it was there before). The current `package.json` lists `express` as the primary direct dependency installed by the agent.

### Running the Server
*   **Development Mode (with auto-restart if nodemon is installed and configured):**
    The current `package.json` includes `nodemon` as a dev dependency and a `dev` script:
    ```bash
    npm run dev
    ```
*   **Basic Start:**
    ```bash
    npm start
    ```
    (Uses the `start` script: `"start": "node server.js"`)

The server will run on `http://localhost:3000` by default.

## Project Structure (Current MVP)

```
backend/
├── src/                # Placeholder, not strictly used in current simple server.js
│   ├── api/
│   │   └── .gitkeep
│   ├── services/
│   │   └── .gitkeep
│   └── store/
│       └── .gitkeep
├── .gitignore
├── package.json
├── package-lock.json
├── server.js           # Main server entry point, Express app setup, and all API logic for MVP
└── README.md
```
The `AGENTS.md` file suggests a more elaborate structure (`src/api/routes.js`, etc.), but for the current MVP, all logic resides in `server.js`.

## API Endpoints

All request and response bodies are in JSON format.

### 1. `POST /pair`
*   **Purpose:** Used by the mobile app to validate a `displayId` shown on the TV.
*   **Request Body:**
    ```json
    { "displayId": "123456" }
    ```
*   **Functionality:** Checks if the `displayId` is known to the backend (i.e., if the TV app with this ID has already made a `GET /display/:displayId` request).
*   **Responses:**
    *   **200 OK (Success):**
        ```json
        { "message": "Successfully connected to display 123456. You can now send data." }
        ```
    *   **400 Bad Request (Missing `displayId`):**
        ```json
        { "message": "displayId is required for pairing." }
        ```
    *   **404 Not Found (Unknown `displayId`):**
        ```json
        { "message": "Display ID \"123456\" not found. Please check the code on your TV and ensure it's connected to the internet." }
        ```
    *   **500 Internal Server Error:**
        ```json
        { "message": "Internal server error during pairing." }
        ```

### 2. `PUT /display/{displayId}`
*   **Purpose:** Used by the mobile app to send new or updated table data to a specific display.
*   **URL Parameter:** `displayId` (e.g., `123456`) - The ID of the target display.
*   **Request Body:**
    ```json
    {
      "tableData": {
        "headers": ["Column 1", "Column 2"],
        "rows": [
          ["Data A1", "Data B1"],
          ["Data A2", "Data B2"]
        ]
      }
    }
    ```
*   **Functionality:** Stores or updates the `tableData` for the specified `displayId` in the in-memory store. Also updates the `lastSeen` timestamp for this display. If the `displayId` is not known, it will be created.
*   **Responses:**
    *   **200 OK (Success):**
        ```json
        { "message": "Data for display 123456 updated successfully." }
        ```
    *   **400 Bad Request (Invalid Data):**
        *   `{ "message": "tableData is required in the request body." }`
        *   `{ "message": "tableData must include 'headers' as an array." }`
        *   `{ "message": "tableData must include 'rows' as an array." }`
        *   `{ "message": "Each item in 'rows' must be an array." }`
    *   **500 Internal Server Error:**
        ```json
        { "message": "Internal server error while updating data." }
        ```

### 3. `GET /display/{displayId}`
*   **Purpose:** Used by the Google TV app to poll for table data.
*   **URL Parameter:** `displayId` (e.g., `123456`) - The ID generated and displayed by the TV app.
*   **Functionality:**
    *   Retrieves the current `tableData` for the given `displayId`.
    *   If the `displayId` is polled for the first time, it is registered in the backend with default "Waiting for data..." content, and this content is returned.
    *   Updates the `lastSeen` timestamp for the display on each call.
*   **Responses:**
    *   **200 OK (Existing Display with Data):**
        ```json
        {
          "headers": ["Name", "Age"],
          "rows": [["Alice", 30]]
        }
        ```
    *   **200 OK (New Display ID or Display Awaiting Data):**
        ```json
        {
          "headers": ["Status"],
          "rows": [["Waiting for data from mobile app..."]]
        }
        ```
    *   **500 Internal Server Error:**
        ```json
        { "message": "Internal server error." }
        ```

## In-Memory Data Store (in `server.js`)

A simple JavaScript object (`displays`) in `server.js` is used to store display data and their last active time for the MVP.

**Structure of the `displays` object:**
```javascript
const displays = {
  // "displayId" (e.g., a 6-digit code generated by TV app) is the key
  "123456": { // Example displayId
    tableData: {
      headers: ["Header1", "Header2"],
      rows: [["Row1Cell1", "Row1Cell2"]]
    },
    lastSeen: 1678886400000 // Timestamp of the last interaction
  },
  // Hardcoded example for initial backend testing:
  "display123": {
    tableData: {
      headers: ["Name", "Age", "City"],
      rows: [
        ["Alice", 30, "New York"],
        ["Bob", 24, "San Francisco"]
      ]
    },
    lastSeen: Date.now() // Timestamp
  }
  // More displays can be added dynamically by GET (from TV) or PUT (from mobile) requests.
};
```

## Future Enhancements (Post-MVP)
*   **Database Integration:** Replace in-memory store with a persistent database.
*   **Real-time Communication:** Implement WebSockets for instant updates to the TV.
*   **Refactor to `src/` structure:** Move API logic, services, and store management to separate files under `src/` as complexity grows.

This README reflects the current state of the MVP.
