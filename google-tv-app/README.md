# Google TV App (Display Client)

This application is the display client for the Dynamic Information Board service. Its primary functions are to:
1.  Display a unique pairing code on launch.
2.  Once paired, render tabular data received from the backend in a WebView.

## Development Setup

### Prerequisites
*   **Android Studio:** Ensure you have the latest version of Android Studio installed. Download from [developer.android.com/studio](https://developer.android.com/studio).
*   **Android SDK:** Make sure you have the necessary Android SDKs installed, targeting Google TV platforms (e.g., Android TV API level appropriate for Google TV).
*   **Google TV Emulator or Physical Device:** For testing, set up a Google TV emulator in Android Studio or use a physical Google TV device.

### Project Setup
1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-url>/google-tv-app
    ```
2.  **Open in Android Studio:**
    *   Open Android Studio.
    *   Select "Open an Existing Project".
    *   Navigate to and select the `google-tv-app` directory.
3.  **Sync Gradle:** Allow Android Studio to sync the project with Gradle. This will download necessary dependencies.
4.  **Configure Emulator/Device:**
    *   If using an emulator, create a Google TV AVD (Android Virtual Device) through the AVD Manager in Android Studio.
    *   If using a physical device, enable Developer Options and USB Debugging, then connect it to your development machine.

### Building and Running
1.  Select your target emulator or device from the dropdown menu in Android Studio.
2.  Click the "Run" button (green play icon) or select "Run" > "Run 'app'" from the menu.

## Project Structure (Simplified)

```
google-tv-app/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/example/googletvapp/  # Package name
│   │   │   │   └── MainActivity.kt             # Main activity for pairing code & WebView
│   │   │   ├── res/
│   │   │   │   ├── layout/
│   │   │   │   │   └── activity_main.xml       # Layout for MainActivity
│   │   │   │   └── ... (other resources like drawables, values)
│   │   │   └── assets/
│   │   │       └── table_display.html          # Local HTML for table rendering
│   │   │       └── table_style.css             # CSS for the HTML table (optional)
│   │   │       └── table_script.js             # JavaScript for table population (optional)
│   ├── build.gradle                            # App-level Gradle build script
├── build.gradle                                # Project-level Gradle build script
└── README.md
```

*(This is a conceptual structure. The actual project will be created by Android Studio.)*

## Core Functionality

### 1. Pairing Code Display
*   `MainActivity.kt`:
    *   Generates a random 6-digit code upon creation.
    *   Displays this code prominently (e.g., using a `TextView` in `activity_main.xml`).
    *   This code acts as the `displayId` for backend communication.

### 2. Table Display
*   Once pairing is conceptually complete (or after a timeout/trigger for MVP), `MainActivity.kt` will load `table_display.html` into a full-screen `WebView`.
*   `table_display.html`:
    *   Contains basic HTML structure for a table (`<table>`, `<thead>`, `<tbody>`).
    *   Includes JavaScript functions to:
        *   Receive table data (as a JSON string) from `MainActivity.kt`.
        *   Parse the JSON.
        *   Dynamically populate the HTML table with headers and rows.
*   `MainActivity.kt` will:
    *   Periodically poll the backend endpoint `GET /display/{displayId}`.
    *   Pass the fetched JSON data to the JavaScript within the WebView.

## Backend Interaction
*   **Endpoint:** `GET /display/{displayId}`
*   **Polling Interval:** Approximately every 10 seconds for MVP.
*   **Data Format:** Expects JSON like:
    ```json
    {
      "lastUpdated": "YYYY-MM-DDTHH:mm:ssZ",
      "tableData": {
        "headers": ["Header1", "Header2"],
        "rows": [
          ["Data1A", "Data1B"],
          ["Data2A", "Data2B"]
        ]
      }
    }
    ```

This README will be updated as development progresses.
