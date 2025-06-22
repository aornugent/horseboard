// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/api/routes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// API Routes
app.use('/', apiRoutes); // Mount the API routes

// Global error handler for any unhandled errors from routes or middleware
app.use((err, req, res, next) => {
  console.error("Unhandled application error:", err);
  // Avoid sending stack trace to client in production
  // For now, sending the error message if available
  const errorMessage = err.message || "An unexpected internal server error occurred.";
  const statusCode = err.status || 500; // Use error status or default to 500

  res.status(statusCode).json({ message: errorMessage });
});

// Initialize Firestore (this is handled within firestore.js, but logging server readiness)
// The firestore.js module attempts to initialize on load.
// We should check if it was successful or provide a way to check health.
// For now, we assume it initializes or logs errors during its setup.

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
  // A simple check to see if Firestore might be available.
  // This is a bit of a hack; proper health check would be better.
  try {
    require('./src/store/firestore'); // This will log initialization status from firestore.js
  } catch (e) {
    // This catch might not be effective if errors happen inside module loading
    console.error("Error during server startup related to Firestore initialization:", e);
  }
});

// Ensure .gitkeep files are removed if they are no longer needed.
// This will be handled by deleting them directly if the user confirms.
// For now, the .gitkeep files in src/api, src/services, src/store can be removed
// as they now contain .js files.
// I will list them to confirm before suggesting deletion.
// (This is a mental note, will do this as a separate step if needed)
