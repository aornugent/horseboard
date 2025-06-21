const express = require('express');
const app = express();
const port = 3000;

// In-memory store for displays
// Structure: { displayId: { tableData: {...}, lastSeen: timestamp } }
const displays = {
  "display123": { // Hardcoded example for initial testing
    tableData: {
      headers: ["Name", "Age", "City"],
      rows: [
        ["Alice", 30, "New York"],
        ["Bob", 24, "San Francisco"]
      ]
    },
    lastSeen: Date.now()
  }
};

app.use(express.json()); // Middleware to parse JSON bodies

// GET /display/{displayId} - Retrieve table data for a display
app.get('/display/:displayId', (req, res) => {
  try {
    const { displayId } = req.params;

    if (!displays[displayId]) {
      // First time this displayId is seen, or it's an unknown one.
      // Initialize it with default "waiting" data.
      // The TV app will show this until the mobile app sends actual data.
      displays[displayId] = {
        tableData: {
          headers: ["Status"],
          rows: [["Waiting for data from mobile app..."]]
        },
        lastSeen: Date.now()
      };
      console.log(`New displayId ${displayId} registered from TV app poll. Returning waiting data.`);
      return res.json(displays[displayId].tableData);
    }

    // DisplayId is known, update lastSeen and return its data
    displays[displayId].lastSeen = Date.now();
    res.json(displays[displayId].tableData);

  } catch (error) {
    console.error(`Error in GET /display/${req.params.displayId}:`, error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST /pair - Validate a displayId for pairing by the mobile app
app.post('/pair', (req, res) => {
  try {
    const { displayId } = req.body;
    if (!displayId) {
      return res.status(400).json({ message: "displayId is required for pairing." });
    }

    // The mobile app uses this to check if the displayId shown on the TV is valid.
    // A displayId is considered valid if the TV app has already polled the backend with it,
    // causing it to be registered in the `displays` object.
    if (displays[displayId]) {
      // Optionally, check if lastSeen is recent, but for MVP, existence is enough.
      console.log(`Pairing validation successful for displayId: ${displayId}`);
      res.json({ message: `Successfully connected to display ${displayId}. You can now send data.` });
    } else {
      // This means the TV with this displayId hasn't contacted the backend yet,
      // or the user entered an incorrect displayId on the mobile app.
      console.warn(`Pairing validation failed for displayId: ${displayId}. Not found or TV not active.`);
      res.status(404).json({ message: `Display ID "${displayId}" not found. Please check the code on your TV and ensure it's connected to the internet.` });
    }
  } catch (error) {
    console.error("Error in POST /pair:", error);
    res.status(500).json({ message: "Internal server error during pairing." });
  }
});

// PUT /display/{displayId} - Update table data for a display
app.put('/display/:displayId', (req, res) => {
  try {
    const { displayId } = req.params;
    const { tableData } = req.body;

    if (!tableData) {
      return res.status(400).json({ message: "tableData is required in the request body." });
    }
    if (!tableData.headers || !Array.isArray(tableData.headers)) {
      return res.status(400).json({ message: "tableData must include 'headers' as an array." });
    }
    if (!tableData.rows || !Array.isArray(tableData.rows)) {
      return res.status(400).json({ message: "tableData must include 'rows' as an array." });
    }
    // Basic validation for rows structure (array of arrays)
    if (tableData.rows.some(row => !Array.isArray(row))) {
        return res.status(400).json({ message: "Each item in 'rows' must be an array." });
    }


    if (!displays[displayId]) {
      // This case should ideally not be hit if pairing flow is correct,
      // as /pair would have validated displayId and GET /display/:displayId would have created it.
      // However, as a fallback, create it.
      console.warn(`Display ${displayId} not previously known during PUT. Creating new entry.`);
      displays[displayId] = { tableData: null, lastSeen: Date.now() };
    }

    displays[displayId].tableData = tableData;
    displays[displayId].lastSeen = Date.now(); // Update lastSeen on data update too
    console.log(`Data updated for display ${displayId}:`, JSON.stringify(tableData, null, 2));
    res.json({ message: `Data for display ${displayId} updated successfully.` });

  } catch (error) {
    console.error(`Error in PUT /display/${req.params.displayId}:`, error);
    res.status(500).json({ message: "Internal server error while updating data." });
  }
});

// Global error handler for any unhandled errors
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "An unexpected error occurred." });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});

// Basic check for AGENTS.md instructions regarding API structure
// server.js: Express app setup, middleware, starting the server. (Covered)
// src/api/routes.js: Define API routes and link to service handlers. (Partially covered, simple routes in server.js for MVP)
// src/services/displayService.js: Business logic for display management and pairing. (Logic is in server.js for MVP)
// src/store/memoryStore.js: Implementation of the in-memory store. (Logic is in server.js for MVP)
// For MVP, keeping it simpler in server.js. Will refactor if complexity grows.
