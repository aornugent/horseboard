const firestore = require('../store/firestore');

/**
 * Handles the logic for a TV app polling for its data.
 * If the displayId is new, it initializes it with waiting data.
 * Otherwise, it returns existing data.
 * @param {string} displayId
 * @returns {Promise<Object>} The tableData for the display.
 */
async function getDisplayDataForTv(displayId) {
  let displayData = await firestore.getDisplayData(displayId);

  if (!displayData) {
    console.log(`New displayId ${displayId} registered from TV app poll. Initializing waiting data.`);
    const waitingData = {
      tableData: {
        headers: ["Status"],
        rows: [["Waiting for data from mobile app..."]]
      },
      lastUpdated: new Date().toISOString()
    };
    await firestore.setDisplayData(displayId, waitingData);
    return waitingData.tableData;
  }

  // If displayData exists, it means it has at least the 'waiting data' or actual data.
  // We also need to update a 'lastSeen' or similar timestamp if we want to track active TVs.
  // For now, just returning the tableData. The Firestore data model includes `lastUpdated`.
  // If we need a specific "last polled" timestamp, we'd add that to the setDisplayData call here.
  // For example: await firestore.setDisplayData(displayId, { lastPolled: new Date().toISOString() });

  console.log(`Data retrieved for displayId ${displayId} for TV.`);
  return displayData.tableData;
}

/**
 * Validates a displayId for pairing by the mobile app.
 * A displayId is considered valid if it exists in Firestore (meaning the TV has polled at least once).
 * @param {string} displayId
 * @returns {Promise<{exists: boolean, message: string}>}
 */
async function validatePairing(displayId) {
  const displayData = await firestore.getDisplayData(displayId);
  if (displayData) {
    console.log(`Pairing validation successful for displayId: ${displayId}`);
    return { exists: true, message: `Successfully connected to display ${displayId}. You can now send data.` };
  } else {
    console.warn(`Pairing validation failed for displayId: ${displayId}. Not found or TV not active.`);
    return { exists: false, message: `Display ID "${displayId}" not found. Please check the code on your TV and ensure it's connected to the internet.` };
  }
}

/**
 * Updates table data for a display.
 * @param {string} displayId
 * @param {Object} tableData
 * @returns {Promise<void>}
 */
async function updateDisplayData(displayId, tableData) {
  // Basic validation (could be expanded or moved to a validation layer)
  if (!tableData) {
    throw new Error("tableData is required.");
  }
  if (!tableData.headers || !Array.isArray(tableData.headers)) {
    throw new Error("tableData must include 'headers' as an array.");
  }
  if (!tableData.rows || !Array.isArray(tableData.rows)) {
    throw new Error("tableData must include 'rows' as an array.");
  }
  if (tableData.rows.some(row => !Array.isArray(row))) {
    throw new Error("Each item in 'rows' must be an array.");
  }

  const dataToStore = {
    tableData: tableData,
    lastUpdated: new Date().toISOString()
  };

  // Ensure the display document exists, even if it's just with waiting data.
  // This could happen if mobile tries to push data before TV has ever polled.
  let existingData = await firestore.getDisplayData(displayId);
  if (!existingData) {
      console.warn(`Display ${displayId} not previously known during PUT. It will be created with the new data.`);
  }

  await firestore.setDisplayData(displayId, dataToStore);
  console.log(`Data updated for display ${displayId}`);
}

module.exports = {
  getDisplayDataForTv,
  validatePairing,
  updateDisplayData
};
