# Mobile App - DynamicInfoBoardMobile (React Native)

This React Native application serves as the controller for the Dynamic Information Board service. It allows users to:
1.  Pair with a Google TV display client using a 6-digit code.
2.  Edit tabular data (headers and cells).
3.  Send this data to the backend to be displayed on the TV.

## Development Setup

### Prerequisites
*   **Node.js:** Ensure Node.js (LTS version recommended) is installed.
*   **npm or Yarn:** A JavaScript package manager.
*   **React Native Development Environment:**
    *   Follow the "React Native CLI Quickstart" instructions on the official React Native website: [reactnative.dev/docs/environment-setup](https://reactnative.dev/docs/environment-setup).
    *   This includes installing Android Studio (for Android SDK/emulator) and/or Xcode (for iOS simulator/device).
*   **Backend Server Running:** The backend server (`../backend/`) must be running and accessible from your mobile device/emulator.

### Project Setup
1.  **Navigate to the project directory:**
    ```bash
    cd mobile-app/DynamicInfoBoardMobile
    ```
    (Assuming you are in the root of the main repository).

2.  **Install Dependencies:**
    The `package.json` file lists the necessary dependencies.
    ```bash
    npm install
    # OR
    # yarn install
    ```

3.  **iOS Specific (if developing for iOS):**
    ```bash
    cd ios
    pod install
    cd ..
    ```

4.  **Configure Backend URL:**
    *   Open the screen files:
        *   `screens/PairingScreen.js`
        *   `screens/TableEditorScreen.js`
    *   Locate the `BACKEND_URL` constant (e.g., `const BACKEND_URL = 'http://10.0.2.2:3000';`).
    *   **Important:** Change `10.0.2.2:3000` to the correct IP address and port of your running backend server.
        *   For Android Emulator connecting to a backend on the same host: `http://10.0.2.2:3000` is usually correct.
        *   For iOS Simulator connecting to a backend on the same host: `http://localhost:3000` is usually correct.
        *   For physical devices: Use the actual network IP of the machine running the backend (e.g., `http://192.168.1.100:3000`).

### Running the App

1.  **Start Metro Bundler (usually done automatically by run commands, but can be run separately):**
    In the `mobile-app/DynamicInfoBoardMobile/` directory:
    ```bash
    npx react-native start
    ```
    Keep this terminal window open.

2.  **Run on Android:**
    (Ensure an Android emulator is running or a physical device is connected and configured for debugging)
    In a new terminal window, from `mobile-app/DynamicInfoBoardMobile/`:
    ```bash
    npx react-native run-android
    ```

3.  **Run on iOS:**
    (Ensure an iOS simulator is running or a physical device is connected and configured)
    In a new terminal window, from `mobile-app/DynamicInfoBoardMobile/`:
    ```bash
    npx react-native run-ios
    ```

## Project Structure (Key Files for MVP)

```
DynamicInfoBoardMobile/
├── screens/
│   ├── PairingScreen.js        # UI and logic for entering pairing code and connecting
│   └── TableEditorScreen.js    # UI and logic for editing table data and sending to TV
├── App.js                      # Main app component, sets up navigation
├── package.json                # Project dependencies and scripts
└── README.md                   # This file
```
Other standard React Native files and directories (`android/`, `ios/`, `node_modules/`, etc.) will be present.

## Core Functionality

### 1. Pairing Screen (`screens/PairingScreen.js`)
*   **UI:** Input field for a 6-digit pairing code, "Connect to TV" button.
*   **Logic:**
    *   Validates the input code format.
    *   Calls the `POST /pair` backend endpoint with the `displayId` (the code).
    *   On successful response from the backend, navigates to the `TableEditorScreen`, passing the `displayId`.
    *   Displays alerts for success or failure.

### 2. Table Editor Screen (`screens/TableEditorScreen.js`)
*   **UI:**
    *   Displays the `displayId` it's connected to.
    *   Shows a basic table structure with `TextInput` fields for headers and cells.
    *   "Send Data to TV" button.
*   **Logic:**
    *   Initializes with sample table data for the full dataset (`fullTableData`).
    *   Allows users to modify headers and cells in the full dataset.
    *   Includes pagination controls (`Previous`, `Next`) to select a specific page of data (a slice of `fullTableData`) to be sent to the TV.
    *   The "Send Page X to TV" button (dynamically labeled with the current page) calls the `PUT /display/{displayId}` backend endpoint. It sends only the data for the currently selected page (`tableData`).
    *   Displays alerts for success or failure of the data push.
    *   The "Send Page X to TV" button is enabled when changes are made to the table data or when the selected page for TV display changes.

## Backend Interaction
*   **Pairing:** `POST /pair` (from `PairingScreen.js`)
    *   Request Body: `{ "displayId": "USER_ENTERED_CODE" }`
*   **Update Data:** `PUT /display/{displayId}` (from `TableEditorScreen.js`)
    *   Request Body: `{ "tableData": { "headers": [...], "rows": [...] } }`

This README reflects the current state of the MVP, based on the manually scaffolded project structure. For a full React Native project, you would typically initialize using `npx react-native init`.
