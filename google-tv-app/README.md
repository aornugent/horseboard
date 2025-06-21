# Google TV App (Display Client)

This Android application is the display client for the Dynamic Information Board service. Its primary functions are to:
1.  Display a unique 6-digit pairing code on launch.
2.  Periodically fetch and render tabular data received from the backend in a WebView.

## Development Setup

### Prerequisites
*   **Android Studio:** Ensure you have the latest version of Android Studio installed. Download from [developer.android.com/studio](https://developer.android.com/studio).
*   **Android SDK:** Make sure you have the necessary Android SDKs installed, targeting Google TV platforms (e.g., Android TV API level appropriate for Google TV).
*   **Google TV Emulator or Physical Device:** For testing, set up a Google TV emulator in Android Studio or use a physical Google TV device.

### Project Setup
1.  **Clone the repository (if not done already):**
    ```bash
    git clone <repository-url>
    cd <repository-url>/google-tv-app
    ```
    (Note: The Java code and HTML file are within `app/src/main/` but the project is typically opened from the `google-tv-app` root or `google-tv-app/app` depending on Android Studio's project view).
2.  **Open in Android Studio:**
    *   Open Android Studio.
    *   Select "Open an Existing Project".
    *   Navigate to and select the `google-tv-app` directory (or the `app` subdirectory if that's how your project is structured for Android Studio).
3.  **Dependencies and Permissions:**
    *   **OkHttp:** Ensure the OkHttp client library is included as a dependency. Add the following to your `app/build.gradle` file if not present:
        ```gradle
        dependencies {
            implementation("com.squareup.okhttp3:okhttp:4.9.3") // Use the latest version
        }
        ```
    *   **Internet Permission:** Ensure your `app/src/main/AndroidManifest.xml` includes the internet permission:
        ```xml
        <uses-permission android:name="android.permission.INTERNET" />
        ```
    *   Allow Android Studio to sync the project with Gradle.
4.  **Configure Backend URL:**
    *   Open `app/src/main/java/com/example/dynamictvboard/MainActivity.java`.
    *   Locate the `backendBaseUrl` variable (e.g., `private String backendBaseUrl = "http://10.0.2.2:3000";`).
    *   Change `10.0.2.2` to the correct IP address of your backend server if it's not running on your development machine's localhost accessible by the emulator this way. For physical devices, use the actual network IP of the backend machine.
5.  **Configure Emulator/Device:**
    *   If using an emulator, create a Google TV AVD (Android Virtual Device) through the AVD Manager in Android Studio.
    *   If using a physical device, enable Developer Options and USB Debugging, then connect it to your development machine.

### Building and Running
1.  Select your target emulator or device from the dropdown menu in Android Studio.
2.  Click the "Run" button (green play icon) or select "Run" > "Run 'app'" from the menu.

## Project Structure (Key Files for MVP)

```
google-tv-app/
└── app/
    └── src/
        ├── main/
        │   ├── java/com/example/dynamictvboard/  # Package name
        │   │   └── MainActivity.java             # Main activity for pairing code & WebView
        │   ├── res/
        │   │   └── ... (standard Android resources like layouts, values)
        │   ├── assets/
        │   │   └── table_display.html          # Local HTML, CSS, and JS for table rendering
        │   └── AndroidManifest.xml             # App manifest including permissions
        └── build.gradle                        # App-level Gradle build script
```

## Core Functionality

### 1. Pairing Code Display
*   `MainActivity.java`:
    *   Generates a random 6-digit code upon `onPageFinished` loading of the WebView.
    *   This code is stored as `currentDisplayId`.
    *   Calls the `AndroidTVInterface.setPairingCode(code)` JavaScript function within `table_display.html` to display the code.

### 2. Table Display
*   `MainActivity.java` loads `table_display.html` into a full-screen `WebView`.
*   `table_display.html`:
    *   Contains HTML structure, CSS for styling, and JavaScript functions (`displayTable`, `updatePairingCode`, `updateStatus`, and the `AndroidTVInterface` object).
    *   The `AndroidTVInterface.setTableData(jsonData)` function is called by `MainActivity.java` to pass data.
    *   This JavaScript parses the JSON and dynamically populates the HTML table.
*   `MainActivity.java`:
    *   Periodically polls the backend endpoint `GET /display/{currentDisplayId}` (default every 10 seconds).
    *   Passes the fetched JSON data string to the `AndroidTVInterface.setTableData` JavaScript function.

## Backend Interaction
*   **Endpoint:** `GET /display/{displayId}` (where `displayId` is the 6-digit code shown on TV)
*   **Polling Interval:** Every 10 seconds (defined by `POLLING_INTERVAL_MS` in `MainActivity.java`).
*   **Data Format from Backend:** Expects JSON like:
    ```json
    {
      "headers": ["Header1", "Header2"],
      "rows": [
        ["Data1A", "Data1B"],
        ["Data2A", "Data2B"]
      ]
    }
    ```
    Or, if the display ID is not found or has no data:
    ```json
    {
      "headers": ["Status"],
      "rows": [["Display Not Found or No Data Yet"]]
    }
    ```

This README reflects the current state of the MVP.
