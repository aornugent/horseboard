# Dynamic Information Board MVP

This project is a Minimum Viable Product (MVP) for a dynamic information board system. It consists of a backend service, a Google TV app for display, and a React Native mobile app for controlling the content shown on the TV.

## Project Overview

The system allows a user to:
1.  View a unique pairing code on the Google TV app.
2.  Enter this code into the mobile app to "pair" with the TV.
3.  Edit tabular data on the mobile app.
4.  Send this data to the backend.
5.  The Google TV app polls the backend and displays the updated table data.

## Components

The project is divided into three main components:

*   **[Backend (`backend/`)](./backend/README.md):** A Node.js/Express server that handles data storage (in-memory for MVP), pairing logic, and API requests.
*   **[Google TV App (`google-tv-app/`)](./google-tv-app/README.md):** An Android app for Google TV that displays a pairing code and renders table data received from the backend via a WebView.
*   **[Mobile App (`mobile-app/DynamicInfoBoardMobile/`)](./mobile-app/DynamicInfoBoardMobile/README.md):** A React Native app that allows users to pair with a TV, edit table data, and send it to the backend. (Note: The main mobile app code is within the `DynamicInfoBoardMobile` subdirectory).

## Core Technologies

*   **Backend:** Node.js, Express.js
*   **Google TV App:** Java, Android SDK, WebView, OkHttp
*   **Mobile App:** React Native, JavaScript/JSX

## Getting Started

1.  **Prerequisites:**
    *   Node.js (for backend and React Native)
    *   Android Studio (for Google TV app development and Android emulator)
    *   React Native development environment (see React Native documentation for setup)
    *   A physical Google TV device or a Google TV emulator.
    *   An Android emulator/device or iOS simulator/device for the mobile app.

2.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <your-repository-url>
    ```

3.  **Setup and run each component:**
    *   Follow the instructions in the `README.md` file within each component's directory:
        *   [Backend Setup](./backend/README.md)
        *   [Google TV App Setup](./google-tv-app/README.md)
        *   [Mobile App Setup](./mobile-app/DynamicInfoBoardMobile/README.md)

    *   **General Workflow:**
        1.  Start the backend server.
        2.  Run the Google TV app. Note the pairing code.
        3.  Run the mobile app. Enter the pairing code from the TV to connect.
        4.  Edit data in the mobile app and send it to the TV. The TV display should update shortly.

## Notes for Development

*   **Backend URL Configuration:** The Google TV app and Mobile app need to be configured with the correct IP address and port of your running backend server. For emulators/simulators connecting to a backend on the same machine:
    *   Android Emulator usually uses `10.0.2.2` to refer to the host machine's localhost.
    *   iOS Simulator can usually use `localhost`.
    *   Physical devices need the actual network IP of the machine running the backend.
*   The default backend port is `3000`.

See `IMPLEMENTATION_PLAN.md` for the task breakdown and `TECHNICAL_SPECIFICATION.md` for more detailed specifications.
