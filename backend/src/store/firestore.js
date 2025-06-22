const admin = require('firebase-admin');

// IMPORTANT: Firebase Admin SDK initialization
// This needs to be configured with your Firebase project credentials.
// Option 1: Service Account JSON file
// const serviceAccount = require('./path/to/your-service-account-key.json'); // You'll need to provide this
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Option 2: Google Application Credentials (often used in Cloud Functions, App Engine, etc.)
// If GOOGLE_APPLICATION_CREDENTIALS environment variable is set to the path of your service account key file,
// the SDK can automatically initialize.
// admin.initializeApp();

// For local development, ensure you have the service account key and point to it,
// or set up the GOOGLE_APPLICATION_CREDENTIALS environment variable.
// For now, we are proceeding with the assumption that initialization will be handled
// correctly in the deployment environment or via local setup by the user.
// If the app is run without proper initialization, Firestore operations will fail.

let db;
try {
  if (!admin.apps.length) {
    // Attempt to initialize with application default credentials
    // This works if GOOGLE_APPLICATION_CREDENTIALS env var is set
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized with Application Default Credentials.');
  } else {
    // Get the default app if already initialized
    admin.app();
    console.log('Firebase Admin SDK already initialized.');
  }
  db = admin.firestore();
  console.log('Firestore database instance obtained.');
} catch (error) {
  console.error('Firebase Admin SDK initialization failed:', error);
  console.error('Please ensure Firebase Admin SDK is correctly configured with credentials.');
  // Set db to null or a mock implementation if you want the app to run with warnings
  // For now, operations will fail if db is not initialized.
  db = null;
}

const DISPLAYS_COLLECTION = 'displays';

/**
 * Retrieves display data from Firestore.
 * @param {string} displayId The ID of the display.
 * @returns {Promise<Object|null>} The display data or null if not found.
 */
const getDisplayData = async (displayId) => {
  if (!db) {
    console.error('Firestore is not initialized. Cannot get display data.');
    throw new Error('Firestore not initialized');
  }
  try {
    const docRef = db.collection(DISPLAYS_COLLECTION).doc(displayId);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`No display document found for ID: ${displayId}`);
      return null;
    }
    console.log(`Display data retrieved for ID: ${displayId}`);
    return doc.data();
  } catch (error) {
    console.error(`Error getting display data for ${displayId}:`, error);
    throw error; // Re-throw to be handled by service layer
  }
};

/**
 * Sets or updates display data in Firestore.
 * @param {string} displayId The ID of the display.
 * @param {Object} data The data to store (e.g., { tableData: {...}, lastUpdated: ... }).
 * @returns {Promise<void>}
 */
const setDisplayData = async (displayId, data) => {
  if (!db) {
    console.error('Firestore is not initialized. Cannot set display data.');
    throw new Error('Firestore not initialized');
  }
  try {
    const docRef = db.collection(DISPLAYS_COLLECTION).doc(displayId);
    await docRef.set(data, { merge: true }); // Use merge to avoid overwriting other fields if any
    console.log(`Display data set for ID: ${displayId}`);
  } catch (error) {
    console.error(`Error setting display data for ${displayId}:`, error);
    throw error; // Re-throw to be handled by service layer
  }
};

module.exports = {
  getDisplayData,
  setDisplayData,
  // Export db instance if needed for more complex queries directly, though typically not recommended
  // _db: db
};
