const express = require('express');
const router = express.Router();
const displayService = require('../services/displayService');

// GET /display/{displayId} - Retrieve table data for a display (TV app polling)
router.get('/display/:displayId', async (req, res, next) => {
  try {
    const { displayId } = req.params;
    if (!displayId) {
      // This route structure ensures displayId is present, but good to be defensive
      return res.status(400).json({ message: "displayId parameter is required." });
    }
    const tableData = await displayService.getDisplayDataForTv(displayId);
    res.json(tableData);
  } catch (error) {
    console.error(`Error in GET /display/${req.params.displayId}:`, error.message);
    // Pass error to the global error handler in server.js
    // Check if error is because Firestore is not initialized
    if (error.message === 'Firestore not initialized') {
        return res.status(503).json({ message: "Service unavailable: Database not configured." });
    }
    next(error);
  }
});

// POST /pair - Validate a displayId for pairing by the mobile app
router.post('/pair', async (req, res, next) => {
  try {
    const { displayId } = req.body;
    if (!displayId) {
      return res.status(400).json({ message: "displayId is required in the request body for pairing." });
    }
    const result = await displayService.validatePairing(displayId);
    if (result.exists) {
      res.json({ message: result.message });
    } else {
      res.status(404).json({ message: result.message });
    }
  } catch (error) {
    console.error("Error in POST /pair:", error.message);
    if (error.message === 'Firestore not initialized') {
        return res.status(503).json({ message: "Service unavailable: Database not configured." });
    }
    next(error);
  }
});

// PUT /display/{displayId} - Update table data for a display (Mobile app pushing data)
router.put('/display/:displayId', async (req, res, next) => {
  try {
    const { displayId } = req.params;
    const { tableData } = req.body; // Assuming tableData is directly in body

    if (!displayId) {
      // Covered by route structure
      return res.status(400).json({ message: "displayId parameter is required." });
    }
    if (!tableData) {
      return res.status(400).json({ message: "tableData is required in the request body." });
    }

    // Validation of tableData structure is done in the service layer
    await displayService.updateDisplayData(displayId, tableData);
    res.json({ message: `Data for display ${displayId} updated successfully.` });
  } catch (error) {
    console.error(`Error in PUT /display/${req.params.displayId}:`, error.message);
    if (error.message === 'Firestore not initialized') {
        return res.status(503).json({ message: "Service unavailable: Database not configured." });
    }
    // If service layer threw a validation error
    if (error.message.includes("tableData must include") || error.message.includes("Each item in 'rows' must be an array")) {
        return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

module.exports = router;
