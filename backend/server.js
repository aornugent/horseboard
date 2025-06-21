// Main entry point for the Node.js Express backend server

const express = require('express');
const cors = require('cors'); // Import cors

// TODO: Import routes from src/api/routes.js
// TODO: Initialize in-memory store from src/store/memoryStore.js

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes and origins
app.use(express.json()); // To parse JSON request bodies

// --- In-memory store (simple example, move to src/store/memoryStore.js) ---
const displays = {
  "000000": { // Default display for initial testing
    pairedMobileId: null,
    lastUpdated: new Date().toISOString(),
    tableData: {
      headers: ["Welcome", "To"],
      rows: [
        ["Dynamic", "Display!"],
        ["Edit on mobile", "See here soon."]
      ]
    }
  }
};

// --- API Endpoints (move to src/api/routes.js and use src/services/displayService.js) ---

// POST /pair
app.post('/pair', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ status: "error", message: "Invalid pairing code format. Must be 6 digits." });
  }

  // For MVP: If code doesn't exist, initialize it. If it does, it's considered "pairable".
  if (!displays[code]) {
    displays[code] = {
      pairedMobileId: "tempMobileId", // Simulate pairing
      lastUpdated: new Date().toISOString(),
      tableData: { headers: ["New Table"], rows: [["Waiting for data..."]] }
    };
    console.log(`New display initialized and paired: ${code}`);
    return res.status(201).json({ status: "success", displayId: code, message: "Display initialized and paired." });
  }

  // Here, you might check if it's already paired with a *different* mobileId in a more robust system.
  displays[code].pairedMobileId = "tempMobileId"; // Simulate re-pairing or initial pairing
  console.log(`Display paired: ${code}`);
  return res.status(200).json({ status: "success", displayId: code, message: "Paired successfully." });
});

// PUT /display/{displayId}
app.put('/display/:displayId', (req, res) => {
  const { displayId } = req.params;
  const { tableData } = req.body;

  if (!displays[displayId]) {
    return res.status(404).json({ status: "error", message: "Display not found." });
  }
  if (!tableData) {
    return res.status(400).json({ status: "error", message: "tableData is required." });
  }

  displays[displayId].tableData = tableData;
  displays[displayId].lastUpdated = new Date().toISOString();
  console.log(`Display data updated for: ${displayId}`);
  // console.log(JSON.stringify(displays[displayId].tableData, null, 2));
  return res.status(200).json({ status: "success", message: "Display data updated." });
});

// GET /display/{displayId}
app.get('/display/:displayId', (req, res) => {
  const { displayId } = req.params;

  if (!displays[displayId]) {
    // To allow TV app to start even if mobile hasn't paired yet,
    // create a default display if a 6-digit code is requested and not found.
    if (/^\d{6}$/.test(displayId)) {
        displays[displayId] = {
            pairedMobileId: null,
            lastUpdated: new Date().toISOString(),
            tableData: { headers: ["Waiting for Mobile App"], rows: [["Pair using code:", displayId]]}
        };
        console.log(`New display placeholder created on GET: ${displayId}`);
        return res.status(200).json(displays[displayId]);
    }
    return res.status(404).json({ status: "error", message: "Display not found." });
  }

  console.log(`Display data fetched for: ${displayId}`);
  return res.status(200).json(displays[displayId]);
});


// --- Root endpoint for basic server check ---
app.get('/', (req, res) => {
  res.send('Dynamic Information Board Backend is running!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log("Current displays loaded in memory:");
  console.log(JSON.stringify(displays, null, 2));
});

// TODO: Graceful shutdown
// TODO: Proper logging
// TODO: Split into modules (routes, services, store) as per planned structure
