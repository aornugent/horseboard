// Centralized configuration for the mobile app

// IMPORTANT: Backend URL Configuration
// Replace this with your actual backend URL.
// For local development with a backend running on the same machine:
// - If using Android Emulator: 'http://10.0.2.2:PORT' (PORT is usually 3000 for the sample backend)
// - If using physical device on same Wi-Fi: 'http://<YOUR_MACHINE_LOCAL_IP>:PORT'
// - If backend is deployed: 'https://your-backend-service.com'

const BACKEND_URL = 'http://10.0.2.2:3000'; // Default for Android emulator

// Example for physical device (replace with your machine's actual IP on the local network)
// const BACKEND_URL = 'http://192.168.1.100:3000';

export { BACKEND_URL };
