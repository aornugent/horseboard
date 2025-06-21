const express = require('express');
const app = express();
const port = 3000;

// In-memory store for displays
// Structure: { displayId: { tableData: {...} } }
const displays = {
  "display123": { // Hardcoded example for initial testing
    tableData: {
      headers: ["Name", "Age", "City"],
      rows: [
        ["Alice", 30, "New York"],
        ["Bob", 24, "San Francisco"]
      ]
    }
  }
};

app.use(express.json()); // Middleware to parse JSON bodies

// GET /display/{displayId} - Retrieve table data for a display
app.get('/display/:displayId', (req, res) => {
  const { displayId } = req.params;
  const displayData = displays[displayId];

  if (displayData) {
    res.json(displayData.tableData);
  } else {
    // If displayId not found, return a default empty table structure
    // This helps the TV app to not break if it polls for a new/uninitialized displayId
    res.status(404).json({
      headers: ["Status"],
      rows: [["Display Not Found or No Data Yet"]]
    });
  }
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

// POST /pair - Simulate pairing
// For MVP, this just checks if a displayId is provided in the body.
// In a real app, it might validate the code, associate it with a user, etc.
app.post('/pair', (req, res) => {
  const { displayId } = req.body;
  if (!displayId) {
    return res.status(400).json({ message: "displayId is required for pairing." });
  }

  // For MVP, we don't strictly need to do anything with the displayId here,
  // as the TV app will generate its own and start polling.
  // This endpoint is more for the mobile app to "confirm" a displayId exists or is valid.
  // We can check if it's in our "displays" store as a basic validation.
  if (displays[displayId]) {
    res.json({ message: `Pairing successful with display ${displayId}. Display already known.` });
  } else {
    // If the displayId is not known, we could choose to:
    // 1. Reject pairing: res.status(404).json({ message: "Display ID not found." });
    // 2. Or, accept it and perhaps pre-initialize it:
    //    displays[displayId] = { tableData: { headers: ["Info"], rows: [["Awaiting data from mobile app..."]] }};
    //    res.json({ message: `Pairing successful with new display ${displayId}. Awaiting initial data.` });
    // For now, let's go with option 2, as the TV app will create its own ID and start polling.
    // The mobile app uses /pair to "connect" to an ID shown on TV.
    // So, if the TV shows an ID, it should ideally be known to the backend via the TV's first poll,
    // or the TV should register itself.
    // Let's assume the TV has already made itself known or will soon.
    // A simple success for now if displayId is provided.
    console.log(`Pairing request for displayId: ${displayId}`);
    res.json({ message: `Pairing request for ${displayId} acknowledged. Ensure TV is active with this ID.` });
  }
});

// PUT /display/{displayId} - Update table data for a display
app.put('/display/:displayId', (req, res) => {
  const { displayId } = req.params;
  const { tableData } = req.body;

  if (!tableData) {
    return res.status(400).json({ message: "tableData is required in the request body." });
  }
  if (!tableData.headers || !tableData.rows) {
    return res.status(400).json({ message: "tableData must include 'headers' and 'rows'."});
  }

  if (!displays[displayId]) {
    console.log(`Display ${displayId} not previously known. Creating new entry.`);
    // Optionally, you could choose to only allow updates to existing displays.
    // For this MVP, we'll allow creating/updating.
  }

  displays[displayId] = { tableData: tableData };
  console.log(`Data updated for display ${displayId}:`, JSON.stringify(tableData, null, 2));
  res.json({ message: `Data for display ${displayId} updated successfully.` });
});
