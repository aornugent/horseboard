#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define Flutter SDK version and installation directory
FLUTTER_SDK_VERSION="3.22.2" # Specify a recent stable version
FLUTTER_HOME="$HOME/flutter_sdk"
ANDROID_HOME_DIR="$HOME/Android" # Parent directory for SDK
ANDROID_SDK_ROOT="$ANDROID_HOME_DIR/Sdk"
ANDROID_CMDLINE_TOOLS_VERSION="11076708" # Specify a recent command-line tools version

echo "Starting Flutter and Android SDK setup in user directories..."
echo "Flutter will be installed in: $FLUTTER_HOME"
echo "Android SDK will be installed in: $ANDROID_SDK_ROOT"

# Create installation directories if they don't exist
mkdir -p "$FLUTTER_HOME"
mkdir -p "$ANDROID_SDK_ROOT"

# 0. Check for Java (OpenJDK 17 recommended)
echo "Checking for Java..."
JAVA_VERSION_OUTPUT=""
if command -v java &> /dev/null; then
    JAVA_VERSION_OUTPUT=$(java -version 2>&1)
fi

if [[ $JAVA_VERSION_OUTPUT == *"openjdk version \"17"* ]] || [[ $JAVA_VERSION_OUTPUT == *"openjdk version \"1.8"* ]] || [[ $JAVA_VERSION_OUTPUT == *"openjdk version \"11"* ]]; then # Allow 8, 11, 17 for broader compatibility initially
    echo "Java version: $(java -version 2>&1 | head -n 1)"
    # Try to set JAVA_HOME if not set
    if [ -z "$JAVA_HOME" ]; then
        # Attempt to find a common JDK path - this is a guess and might need user adjustment
        POSSIBLE_JAVA_HOMES=(
            "/usr/lib/jvm/java-17-openjdk-amd64"
            "/usr/lib/jvm/java-11-openjdk-amd64"
            "/usr/lib/jvm/java-8-openjdk-amd64"
            "/usr/lib/jvm/default-java"
        )
        for pjh in "${POSSIBLE_JAVA_HOMES[@]}"; do
            if [ -d "$pjh" ]; then
                export JAVA_HOME="$pjh"
                echo "Attempting to set JAVA_HOME to $JAVA_HOME"
                break
            fi
        done
        if [ -z "$JAVA_HOME" ]; then
             echo "Could not automatically determine JAVA_HOME. flutter doctor might complain."
             echo "If issues arise, please set JAVA_HOME manually in your ~/.bashrc"
        fi
    else
        echo "JAVA_HOME is already set to: $JAVA_HOME"
    fi
else
    echo "Java (OpenJDK 17 recommended, 11 or 8 might work) not found or version is not recognized."
    echo "Please install OpenJDK 17 using: sudo apt-get update && sudo apt-get install openjdk-17-jdk"
    echo "And ensure JAVA_HOME is set correctly (e.g., export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64)."
    echo "Script will continue, but flutter doctor will likely fail on Java dependency."
fi


# 1. Download and Install Flutter SDK
echo "Downloading Flutter SDK v${FLUTTER_SDK_VERSION}..."
if [ -d "$FLUTTER_HOME/bin" ]; then # Check for existing installation more reliably
  echo "Flutter directory $FLUTTER_HOME already seems to contain an SDK. Skipping download and extraction."
else
  # Clean up target directory before extraction if it exists but is not a full SDK
  rm -rf "$FLUTTER_HOME"/*
  wget -q "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz" -P /tmp
  echo "Extracting Flutter SDK to $FLUTTER_HOME..."
  tar xf "/tmp/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz" -C "$HOME" # Extracts to $HOME/flutter, so rename
  if [ "$FLUTTER_HOME" != "$HOME/flutter" ]; then # if FLUTTER_HOME is not the default extraction name
    mv "$HOME/flutter" "$FLUTTER_HOME"
  fi
  rm "/tmp/flutter_linux_${FLUTTER_SDK_VERSION}-stable.tar.xz"
fi

# 2. Add Flutter to PATH
echo "Adding Flutter to PATH in ~/.bashrc..."
# Remove old /opt/flutter paths if they exist
sed -i '/export FLUTTER_HOME="\/opt\/flutter"/d' ~/.bashrc
sed -i '/export PATH="\$FLUTTER_HOME\/bin:\$PATH"/d' ~/.bashrc # General, careful if user has other FLUTTER_HOME
sed -i '/export PATH="\/opt\/flutter\/bin:\$PATH"/d' ~/.bashrc


if ! grep -q "export FLUTTER_HOME=\"$FLUTTER_HOME\"" ~/.bashrc; then
  echo '' >> ~/.bashrc
  echo '# Flutter SDK (User Install)' >> ~/.bashrc
  echo "export FLUTTER_HOME=\"$FLUTTER_HOME\"" >> ~/.bashrc
  echo 'export PATH="$FLUTTER_HOME/bin:$PATH"' >> ~/.bashrc
  echo "Flutter PATH added to ~/.bashrc. Please source ~/.bashrc or open a new terminal."
else
  echo "Flutter PATH for $FLUTTER_HOME already configured in ~/.bashrc."
fi

# Export PATH for current session to use flutter command immediately
export FLUTTER_HOME="$FLUTTER_HOME"
export PATH="$FLUTTER_HOME/bin:$PATH"

# 3. Run flutter doctor to check initial status
echo "Running flutter doctor..."
flutter doctor -v

# 4. Install Android SDK and command-line tools
echo "Installing Android SDK command-line tools to $ANDROID_SDK_ROOT..."

# Install Android SDK command-line tools
CMDLINE_TOOLS_PATH_SUFFIX="cmdline-tools/latest" # New structure for cmdline-tools
# Check if command line tools are already installed (e.g. by checking for sdkmanager)
if [ -f "$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX/bin/sdkmanager" ]; then
    echo "Android SDK command-line tools already seem to be installed in $ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX."
else
    mkdir -p "$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX"
    echo "Downloading Android command-line tools..."
    wget -q "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" -P /tmp
    echo "Extracting Android command-line tools..."
    unzip -q /tmp/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip -d /tmp/android-cmdline-tools-extract
    # The tools are extracted into a `cmdline-tools` directory, we need to move its contents to `cmdline-tools/latest`
    mv /tmp/android-cmdline-tools-extract/cmdline-tools/* "$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX/"
    rm -rf /tmp/android-cmdline-tools-extract /tmp/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip
fi

# Add Android SDK to PATH
echo "Adding Android SDK to PATH in ~/.bashrc..."
# Remove old /opt/android-sdk paths if they exist
sed -i '/export ANDROID_SDK_ROOT="\/opt\/android-sdk"/d' ~/.bashrc
sed -i '/export PATH="\$ANDROID_SDK_ROOT\/cmdline-tools\/bin:\$PATH"/d' ~/.bashrc
sed -i '/export PATH="\/opt\/android-sdk\/cmdline-tools\/bin:\$PATH"/d' ~/.bashrc
sed -i '/export PATH="\$ANDROID_SDK_ROOT\/platform-tools:\$PATH"/d' ~/.bashrc
sed -i '/export PATH="\/opt\/android-sdk\/platform-tools:\$PATH"/d' ~/.bashrc
sed -i '/export PATH="\$ANDROID_SDK_ROOT\/emulator:\$PATH"/d' ~/.bashrc
sed -i '/export PATH="\/opt\/android-sdk\/emulator:\$PATH"/d' ~/.bashrc


# Use ANDROID_HOME as it's often expected by other tools, though Flutter uses ANDROID_SDK_ROOT
# Many tools look for ANDROID_HOME. Flutter internally uses ANDROID_SDK_ROOT, but setting both is safe.
if ! grep -q "export ANDROID_SDK_ROOT=\"$ANDROID_SDK_ROOT\"" ~/.bashrc; then
  echo '' >> ~/.bashrc
  echo '# Android SDK (User Install)' >> ~/.bashrc
  echo "export ANDROID_SDK_ROOT=\"$ANDROID_SDK_ROOT\"" >> ~/.bashrc
  echo "export ANDROID_HOME=\"$ANDROID_SDK_ROOT\"" >> ~/.bashrc # Also set ANDROID_HOME
  # cmdline-tools path structure changed: it's now $SDK_ROOT/cmdline-tools/latest/bin
  echo "export PATH=\"\$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX/bin:\$PATH\"" >> ~/.bashrc
  echo 'export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"' >> ~/.bashrc
  echo 'export PATH="$ANDROID_SDK_ROOT/emulator:$PATH"' >> ~/.bashrc # If emulator is needed
  echo "Android SDK PATH added to ~/.bashrc. Please source ~/.bashrc or open a new terminal."
else
  echo "Android SDK PATH for $ANDROID_SDK_ROOT already configured in ~/.bashrc."
fi

# Export ANDROID_SDK_ROOT and ANDROID_HOME for current session
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX/bin:$PATH"
export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"
export PATH="$ANDROID_SDK_ROOT/emulator:$PATH"

# Check if sdkmanager is available
SDKMANAGER_PATH="$ANDROID_SDK_ROOT/$CMDLINE_TOOLS_PATH_SUFFIX/bin/sdkmanager"
if ! command -v sdkmanager &> /dev/null && ! [ -f "$SDKMANAGER_PATH" ]; then
    echo "sdkmanager not found. Please ensure Android command-line tools are in PATH."
    echo "Expected at: $SDKMANAGER_PATH"
    echo "Current PATH: $PATH"
    exit 1
fi
# Ensure sdkmanager is executable
chmod +x "$SDKMANAGER_PATH"


# Use sdkmanager to install platform-tools, build-tools, platforms, and NDK
echo "Installing Android SDK packages (platform-tools, build-tools, platforms, NDK)..."
# Ensure sdkmanager accepts licenses non-interactively
yes | "$SDKMANAGER_PATH" --licenses > /dev/null || true # Run as user

echo "Installing platform-tools..."
"$SDKMANAGER_PATH" "platform-tools" --install_latest_version > /dev/null || echo "Failed to install platform-tools with sdkmanager. Continuing..."

echo "Installing latest build-tools (will pick a recent stable one, e.g., 34.0.0)..."
"$SDKMANAGER_PATH" "build-tools;34.0.0" --install > /dev/null || "$SDKMANAGER_PATH" "build-tools;33.0.2" --install > /dev/null || "$SDKMANAGER_PATH" --install "build-tools;$( "$SDKMANAGER_PATH" --list | grep 'build-tools;' | tail -n 1 | awk '{print $1}')" > /dev/null || echo "Failed to install build-tools with sdkmanager. Continuing..."

echo "Installing Android API 34 platform..."
"$SDKMANAGER_PATH" "platforms;android-34" --install > /dev/null || echo "Failed to install Android API 34 platform with sdkmanager. Continuing..."

echo "Installing Android NDK (side-by-side, e.g., 25.2.9519653)..."
# Using a known recent NDK version. Flutter doctor will advise if a different one is needed.
"$SDKMANAGER_PATH" "ndk;25.2.9519653" --install > /dev/null || "$SDKMANAGER_PATH" "ndk;26.3.11579264" --install > /dev/null || echo "Failed to install NDK with sdkmanager. Flutter might prompt for it or require manual installation via sdkmanager."


# 5. Accept Android licenses via flutter doctor
echo "Accepting Android licenses via flutter doctor..."
yes | flutter doctor --android-licenses || echo "Some licenses might not have been accepted by flutter doctor. Manual intervention may be required if flutter doctor still complains. You can also try: yes | $SDKMANAGER_PATH --licenses"

# 6. Set Android SDK path for Flutter
flutter config --android-sdk "$ANDROID_SDK_ROOT"
# No need for --android-studio-dir if we are not installing it.
# If flutter doctor complains about it, it can be set to ANDROID_SDK_ROOT as well.
flutter config --android-studio-dir "$ANDROID_SDK_ROOT"

# 7. Run flutter doctor again to confirm setup
echo "Running flutter doctor again to verify setup..."
flutter doctor -v

echo ""
echo "Setup complete!"
echo "Please run 'source ~/.bashrc' or open a new terminal to apply PATH changes."
echo "If flutter doctor still reports issues (especially Java or specific SDK components),"
echo "please follow its recommendations or check the README for prerequisite information."

# Grant execute permissions to the script itself (though it's usually run with bash ./setup.sh)
chmod +x "$0"

echo "If you encounter 'permission denied' errors with sdkmanager or related tools,"
echo "ensure that $ANDROID_SDK_ROOT and its contents are writable by your user."
echo "This script attempts to install everything under $HOME to avoid such issues."
echo "If problems persist, check ownership of $HOME/Android and $HOME/flutter_sdk."
