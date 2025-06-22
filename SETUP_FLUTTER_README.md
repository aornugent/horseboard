# Flutter Command-Line Development Environment Setup (User-Mode)

This document accompanies the `setup.sh` script, which configures a command-line based development environment for Flutter Android applications on Ubuntu Linux. This script installs software into user directories to minimize the need for `sudo` privileges during setup and daily use.

## Prerequisites

The script assumes the target Ubuntu Linux environment has the following tools available:
- `wget`
- `tar`
- `unzip`
- Standard Unix utilities (`mkdir`, `rm`, `mv`, `grep`, `echo`, `bash`, `sed`)
- **Java Development Kit (JDK)**: OpenJDK 17 is recommended. Flutter also generally works with OpenJDK 11 or 8. The script will check for Java and guide you if it's missing. You may need `sudo` to install it, e.g.:
  ```bash
  sudo apt-get update && sudo apt-get install openjdk-17-jdk
  ```
  Ensure `JAVA_HOME` is set correctly in your environment after installation. The script will attempt to locate common JDK paths but manual configuration of `JAVA_HOME` in `~/.bashrc` might be necessary.

## Setup Instructions

1.  **Download the Script**
    Ensure `setup.sh` is in your desired directory.

2.  **Make the Script Executable**
    Navigate to the directory containing `setup.sh` and make it executable:
    ```bash
    chmod +x setup.sh
    ```

3.  **Run the Script**
    Execute the script. It generally does not require `sudo` as it installs into your home directory:
    ```bash
    ./setup.sh
    ```
    The script will:
    *   Check for a compatible Java installation and advise if manual installation is needed.
    *   Download and extract the Flutter SDK to `~/flutter_sdk`.
    *   Download and set up the Android SDK command-line tools in `~/Android/Sdk`.
    *   Install necessary Android SDK packages (platform-tools, build-tools, NDK, platform APIs) using `sdkmanager`.
    *   Update your `~/.bashrc` file to include Flutter and Android SDK tools in your `PATH`.
    *   Run `flutter doctor` and attempt to accept Android licenses.

4.  **Update Your Shell Environment**
    After the script completes, you need to source your `~/.bashrc` file to apply the `PATH` changes to your current terminal session:
    ```bash
    source ~/.bashrc
    ```
    Alternatively, you can open a new terminal window, which will automatically load the updated `~/.bashrc`.

5.  **Verify Installation**
    Run `flutter doctor` again in your terminal:
    ```bash
    flutter doctor -v
    ```
    Review the output. The script attempts to resolve most dependencies, but `flutter doctor` is the definitive tool for identifying any remaining issues. Pay close attention to:
    *   **Java Development Kit**: Ensure `flutter doctor` finds your JDK installation and that `JAVA_HOME` is correctly set. If not, install/configure it as mentioned in prerequisites.
    *   **Android toolchain**: Ensure it reports that Android SDK is found at `~/Android/Sdk` and tools are available.
    *   **Android Studio**: The script configures Flutter with the Android SDK path. `flutter doctor` might show "Android Studio not found" or complain about a missing Android Studio installation directory. This is usually acceptable for a purely command-line environment as long as the Android SDK itself is correctly set up. The script attempts to set `flutter config --android-studio-dir` to the SDK root to satisfy this check.
    *   **Licenses**: The script attempts to accept all necessary licenses. If `flutter doctor` still reports license issues, run `flutter doctor --android-licenses` and accept them manually. Also, you can try `yes | $HOME/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses`.

## Important Notes

*   **Sudo Usage**: The `setup.sh` script itself is designed to run without `sudo`. However, you might need `sudo` to install prerequisites like the Java Development Kit (e.g., `sudo apt-get install openjdk-17-jdk`).
*   **Internet Connection**: The script requires an active internet connection to download the Flutter and Android SDKs and related packages.
*   **Installation Paths**:
    *   Flutter SDK is installed in `~/flutter_sdk`.
    *   Android SDK is installed in `~/Android/Sdk`.
    These paths are configurable at the top of the `setup.sh` script if needed.
*   **`~/.bashrc` Modification**: The script appends environment variable exports to your `~/.bashrc`. If you use a different shell (e.g., `zsh`), you'll need to manually add the corresponding exports to your shell's configuration file (e.g., `~/.zshrc`).
    The lines added are typically:
    ```bash
    # Flutter SDK (User Install)
    export FLUTTER_HOME="$HOME/flutter_sdk"
    export PATH="$FLUTTER_HOME/bin:$PATH"

    # Android SDK (User Install)
    export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
    export ANDROID_HOME="$HOME/Android/Sdk" # Also sets ANDROID_HOME
    export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH" # Corrected path for latest cmdline-tools structure
    export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
    export PATH="$ANDROID_SDK_ROOT/emulator:$PATH"
    # JAVA_HOME should be set based on your JDK installation, e.g.:
    # export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
    ```
*   **Troubleshooting with `flutter doctor`**: If `flutter doctor` indicates any issues after running the script and sourcing `~/.bashrc`, carefully read its output and follow the recommended steps. Common issues might involve Java setup (ensure `JAVA_HOME` is correctly set and points to a valid JDK), specific Android SDK package versions, or NDK paths.
*   **Permissions**: All files are installed within your user's home directory, so file permission issues should be minimal. If you encounter any, ensure `~/flutter_sdk` and `~/Android` directories and their contents are owned and writable by your user.

This setup provides a foundation for developing Flutter Android applications entirely from the command line with minimal system-wide modifications. You can use commands like `flutter create <app_name>`, `flutter run`, `flutter build apk`, and `flutter build appbundle`.
