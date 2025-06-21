# Backend Server (Node.js/Express)

This backend server, built with Node.js and Express.js, acts as the intermediary between the Google TV display client and the mobile controller app. For the MVP, it uses an in-memory data store.

## Core Responsibilities
1.  Facilitate pairing between the mobile app and a Google TV display.
2.  Store and serve table data for displays.
3.  Receive table data updates from the mobile app.

## Development Setup

### Prerequisites
*   **Node.js:** Ensure Node.js (LTS version recommended) is installed. Download from [nodejs.org](https://nodejs.org/).
*   **npm or Yarn:** A JavaScript package manager. npm is included with Node.js.

### Project Setup
1.  **Clone the repository (if not done already):**
    ```bash
    git clone <repository-url>
    cd <repository-url>/backend
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
    Key dependencies to be listed in `package.json`:
    *   `express`: Web framework.
    *   `cors`: To enable Cross-Origin Resource Sharing (if TV/mobile app run on different origins during dev).
    *   `nodemon` (dev dependency): For automatically restarting the server during development.

### Running the Server
*   **Development Mode (with auto-restart):**
    ```bash
    npm run dev
    ```
    (Requires a `dev` script in `package.json`, e.g., `"dev": "nodemon server.js"`)
*   **Production Mode (or basic start):**
    ```bash
    npm start
    ```
    (Requires a `start` script in `package.json`, e.g., `"start": "node server.js"`)

The server will typically run on `http://localhost:3000` (or a configured port).

## Project Structure

```
backend/
├── src/
│   ├── api/
│   │   └── routes.js       # Defines API routes (e.g., /pair, /display/:displayId)
│   ├── services/
│   │   └── displayService.js # Logic for managing display data and pairing
│   └── store/
│       └── memoryStore.js  # In-memory data store implementation
├── .env.example        # Example environment variables (e.g., PORT)
├── .gitignore
├── package.json
├── server.js           # Main server entry point, Express app setup
└── README.md
```

## API Endpoints

Described in detail in the main `TECHNICAL_SPECIFICATION.md`.

### 1. `POST /pair`
*   **Request Body:** `{ "code": "123456" }`
*   **Functionality:** Validates the pairing code (`displayId`). For MVP, this might involve checking if the code format is valid and initializing a placeholder for it in the in-memory store if it's the first time it's seen.
*   **Response:** Success or error message.

### 2. `PUT /display/{displayId}`
*   **Request Body:** `{ "tableData": { ... } }`
*   **Functionality:** Overwrites the `tableData` for the given `displayId` in the in-memory store. Updates `lastUpdated` timestamp.
*   **Response:** Success or error message.

### 3. `GET /display/{displayId}`
*   **Functionality:** Retrieves the current `tableData` for the given `displayId`.
*   **Response:** The `tableData` JSON object or an error if not found.

## In-Memory Data Store (`src/store/memoryStore.js`)

A simple JavaScript object will be used to store display data for the MVP.

**Example Structure:**
```javascript
const displays = {
  // "displayId" is the key
  "123456": {
    pairedMobileId: null, // Can be updated upon successful pairing
    lastUpdated: "2023-10-28T12:00:00Z",
    tableData: {
      headers: ["Default Header"],
      rows: [["Default Cell"]]
    }
  }
};

// Functions to interact with this store:
// getDisplay(displayId)
// updateDisplay(displayId, data)
// initDisplay(displayId) // Potentially used by /pair
```

## Future Enhancements (Post-MVP)
*   **Database Integration:** Replace in-memory store with a persistent database (e.g., Firestore, Vercel KV, PostgreSQL, MongoDB).
*   **Real-time Communication:** Implement WebSockets (e.g., using Socket.io) for instant updates to the TV client, eliminating polling.
*   **Authentication & Authorization:** More robust security for pairing and data modification.
*   **Scalability:** Refactor for serverless deployment or containerization.

This README will be updated as development progresses.
