#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define Flutter SDK version and installation directory
FLUTTER_SDK_VERSION="3.22.2" # Specify a recent stable version
FLUTTER_HOME="/opt/flutter"
ANDROID_SDK_ROOT="/opt/android-sdk"
ANDROID_CMDLINE_TOOLS_VERSION="11076708" # Specify a recent command-line tools version e.g. 11076708 for version 11.0

echo "Starting Flutter and Android SDK setup..."

# 1. Download and Install Flutter SDK
echo "Downloading Flutter SDK v${FLUTTER_SDK_VERSION}..."
if [ -d "$FLUTTER_HOME" ]; then
  echo "Flutter directory $FLUTTER_HOME already exists. Skipping download and extraction."
else
  sudo mkdir -p /opt
  sudo wget -q "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz" -P /tmp
  echo "Extracting Flutter SDK to $FLUTTER_HOME..."
  sudo tar xf "/tmp/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz" -C /opt
  sudo chown -R $(whoami):$(whoami) $FLUTTER_HOME
  rm "/tmp/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz"
fi

# 2. Add Flutter to PATH
echo "Adding Flutter to PATH in ~/.bashrc..."
if ! grep -q "$FLUTTER_HOME/bin" ~/.bashrc; then
  echo '' >> ~/.bashrc
  echo '# Flutter SDK' >> ~/.bashrc
  echo "export FLUTTER_HOME=\"$FLUTTER_HOME\"" >> ~/.bashrc
  echo 'export PATH="$FLUTTER_HOME/bin:$PATH"' >> ~/.bashrc
  echo "Flutter PATH added. Please source ~/.bashrc or open a new terminal."
else
  echo "Flutter PATH already configured in ~/.bashrc."
fi

# Export PATH for current session to use flutter command immediately
export FLUTTER_HOME="$FLUTTER_HOME"
export PATH="$FLUTTER_HOME/bin:$PATH"

# 3. Run flutter doctor to check initial status
echo "Running flutter doctor..."
flutter doctor -v

# 4. Install Android SDK and command-line tools
echo "Installing Android SDK and command-line tools..."

# Install OpenJDK 17 (common requirement for Android development)
# Check if Java is installed and if it's OpenJDK 17
JAVA_VERSION_OUTPUT=$(java -version 2>&1)
if [[ $JAVA_VERSION_OUTPUT == *"openjdk version \"17"* ]]; then
    echo "OpenJDK 17 is already installed."
else
    echo "OpenJDK 17 not found. Installing..."
    sudo apt-get update -qq
    sudo apt-get install -y openjdk-17-jdk -qq
fi

# Set JAVA_HOME if not already set
if [ -z "$JAVA_HOME" ]; then
    # Try to find OpenJDK 17 path
    JDK_PATH=$(update-java-alternatives -l | grep '1.17' | head -n 1 | awk '{print $3}')
    if [ -n "$JDK_PATH" ]; then
        export JAVA_HOME="$JDK_PATH"
        if ! grep -q "export JAVA_HOME=" ~/.bashrc; then
            echo "export JAVA_HOME=\"$JAVA_HOME\"" >> ~/.bashrc
            echo "JAVA_HOME set to $JAVA_HOME and added to ~/.bashrc"
        fi
    else
        echo "Could not automatically determine JDK 17 path for JAVA_HOME."
    fi
else
    echo "JAVA_HOME is already set to: $JAVA_HOME"
fi


# Install Android SDK command-line tools
if [ -d "$ANDROID_SDK_ROOT" ]; then
  echo "Android SDK directory $ANDROID_SDK_ROOT already exists. Skipping download."
else
  sudo mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  echo "Downloading Android command-line tools..."
  sudo wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" -P /tmp
  echo "Extracting Android command-line tools..."
  sudo unzip -q /tmp/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip -d /tmp/android-cmdline-tools
  # The tools are extracted into a `cmdline-tools` directory, we need to move its contents up.
  sudo mv /tmp/android-cmdline-tools/cmdline-tools/* "$ANDROID_SDK_ROOT/cmdline-tools/"
  sudo rm -rf /tmp/android-cmdline-tools /tmp/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip
  sudo chown -R $(whoami):$(whoami) $ANDROID_SDK_ROOT
fi

# Add Android SDK to PATH
echo "Adding Android SDK to PATH in ~/.bashrc..."
if ! grep -q "ANDROID_SDK_ROOT" ~/.bashrc; then
  echo '' >> ~/.bashrc
  echo '# Android SDK' >> ~/.bashrc
  echo "export ANDROID_SDK_ROOT=\"$ANDROID_SDK_ROOT\"" >> ~/.bashrc
  echo 'export PATH="$ANDROID_SDK_ROOT/cmdline-tools/bin:$PATH"' >> ~/.bashrc
  echo 'export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"' >> ~/.bashrc
  echo 'export PATH="$ANDROID_SDK_ROOT/emulator:$PATH"' >> ~/.bashrc # If emulator is needed
  echo "Android SDK PATH added. Please source ~/.bashrc or open a new terminal."
else
  echo "Android SDK PATH already configured in ~/.bashrc."
fi

# Export ANDROID_SDK_ROOT for current session
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/bin:$PATH"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
export PATH="$ANDROID_SDK_ROOT/emulator:$PATH"

# Check if sdkmanager is available
if ! command -v sdkmanager &> /dev/null; then
    echo "sdkmanager not found. Please ensure Android command-line tools are in PATH."
    echo "Current PATH: $PATH"
    # Attempt to locate sdkmanager if not in PATH
    if [ -f "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" ]; then
        echo "sdkmanager found at $ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager"
        export PATH="$ANDROID_SDK_ROOT/cmdline-tools/bin:$PATH"
    elif [ -f "$ANDROID_SDK_ROOT/tools/bin/sdkmanager" ]; then # Older structure
        echo "sdkmanager found at $ANDROID_SDK_ROOT/tools/bin/sdkmanager (older structure)"
        export PATH="$ANDROID_SDK_ROOT/tools/bin:$PATH"
    else
        echo "Could not locate sdkmanager. Please check Android SDK installation."
        exit 1
    fi
fi


# Use sdkmanager to install platform-tools, build-tools, platforms, and NDK
echo "Installing Android SDK packages (platform-tools, build-tools, platforms, NDK)..."
# Ensure sdkmanager accepts licenses non-interactively
# This might not be enough for all licenses, see step 5.
yes | sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" --licenses > /dev/null || true

echo "Installing platform-tools..."
sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "platform-tools" --install_latest_version > /dev/null || echo "Failed to install platform-tools. Continuing..."

echo "Installing latest build-tools (will pick a recent stable one)..."
# sdkmanager might list multiple build-tools, let's try to install a specific recent one or let it pick.
# For more specific control, list available and pick one:
# sdkmanager --list | grep build-tools
sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "build-tools;34.0.0" --install > /dev/null || sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "build-tools;33.0.2" --install > /dev/null || sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" --install "build-tools;$(sdkmanager --list | grep 'build-tools;' | tail -n 1 | awk '{print $1}')" > /dev/null || echo "Failed to install build-tools. Continuing..."


echo "Installing Android API 34 platform..."
sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "platforms;android-34" --install > /dev/null || echo "Failed to install Android API 34 platform. Continuing..."

echo "Installing Android NDK (side-by-side)..."
# This will install the latest available NDK version specified by Flutter or a default one.
# Flutter doctor will guide if a specific version is needed.
# Example: "ndk;25.2.9519653" or simply "ndk-bundle" for older setups.
# For side-by-side, it's better to let Flutter/Android Gradle Plugin handle specific NDK versions if possible,
# or install a commonly used one.
# Listing available NDKs: sdkmanager --list | grep ndk
# Using a recent NDK version:
sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "ndk;26.3.11579264" --install > /dev/null || sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" "ndk;25.2.9519653" --install > /dev/null || echo "Failed to install NDK. Flutter might prompt for it later."

# 5. Accept Android licenses
echo "Accepting Android licenses..."
# This is crucial and often requires 'yes' piped to the command.
yes | sudo "$FLUTTER_HOME/bin/flutter" doctor --android-licenses || echo "Some licenses might not have been accepted. Manual intervention may be required if flutter doctor still complains."
# Also try with sdkmanager directly if flutter's command doesn't catch all
yes | sudo "$ANDROID_SDK_ROOT/cmdline-tools/bin/sdkmanager" --licenses > /dev/null || true


# 6. Set Android SDK path for Flutter
flutter config --android-sdk "$ANDROID_SDK_ROOT"
flutter config --android-studio-dir "$ANDROID_SDK_ROOT" # While we don't install Android Studio, Flutter checks this path.

# 7. Run flutter doctor again to confirm setup
echo "Running flutter doctor again to verify setup..."
flutter doctor -v

echo ""
echo "Setup complete!"
echo "Please run 'source ~/.bashrc' or open a new terminal to apply PATH changes."
echo "If flutter doctor still reports issues, please follow its recommendations."

# Grant execute permissions to the script itself if run with sudo ./setup.sh
if [ -f "$0" ]; then
    sudo chmod +x "$0"
fi
