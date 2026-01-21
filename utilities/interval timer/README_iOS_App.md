# Native iOS Interval Timer App

This is a native iOS app built with SwiftUI that provides true background execution for interval training, even when the screen is off or the device is in a pocket.

## Features

✅ **Background Execution** - Timer continues running even when screen is locked  
✅ **Background Audio** - Voice announcements work when screen is off  
✅ **Screen Off Support** - Designed for MTB training with phone in pocket  
✅ **All Original Features** - Same functionality as web version

## Requirements

To build and run this app, you'll need:

1. **Mac computer** with macOS (required for Xcode)
2. **Xcode** (free from Mac App Store)
3. **Apple Developer Account** (options below)

## Apple Developer Account Options

### Option 1: Free Personal Team (Limited)
- **Cost**: Free
- **Limitation**: Apps expire after 7 days, need to reinstall
- **Good for**: Testing and personal use

### Option 2: Paid Developer Account (Recommended)
- **Cost**: $99/year
- **Benefits**: 
  - Apps don't expire
  - Can distribute to team members via TestFlight (free)
  - Can install on multiple devices
  - No App Store listing required

## Building the App

### Step 1: Create New Xcode Project

1. Open Xcode
2. File → New → Project
3. Choose **iOS** → **App**
4. Fill in:
   - **Product Name**: IntervalTimer
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Organization Identifier**: com.yourname (e.g., com.yourname)
5. Choose a location to save

### Step 2: Replace Files

Copy the Swift files from this folder into your Xcode project:
- `IntervalTimerApp.swift` → Replace App file
- `ContentView.swift` → Replace ContentView
- `TimerManager.swift` → Add new file (File → New → File → Swift File)

### Step 3: Configure Background Audio

1. In Xcode, select your project in the navigator
2. Select your app target
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **Background Modes**
6. Check **Audio, AirPlay, and Picture in Picture**

### Step 4: Update Info.plist

The `Info.plist` file should already have the background audio mode configured. If not, add:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### Step 5: Set Signing

1. Still in **Signing & Capabilities**
2. Select your **Team** (or create a free personal team)
3. Xcode will automatically manage provisioning profiles

### Step 6: Build and Run

1. Connect your iPhone via USB
2. Trust your computer on the iPhone if prompted
3. Select your device in Xcode's device menu
4. Click **Run** (▶️ button) or press `Cmd+R`
5. App will install on your phone

## Distribution Methods

### Method 1: Direct Installation (Free Account)
- Connect device via USB
- Build and run from Xcode
- App expires in 7 days (need to rebuild)

### Method 2: TestFlight (Paid Account)
1. Archive the app in Xcode (Product → Archive)
2. Upload to App Store Connect
3. Add internal/external testers
4. They install via TestFlight app (free)
5. No App Store listing required
6. Apps don't expire

### Method 3: Ad Hoc Distribution (Paid Account)
1. Register device UDID in Apple Developer portal
2. Create ad hoc provisioning profile
3. Archive and export
4. Install via file sharing or email
5. Works offline, no expiration

## Background Audio Setup

The app is configured to:
- Continue running in background
- Play voice announcements even when screen is off
- Work when device is locked

This is achieved through:
- Background audio capability
- AVSpeechSynthesizer for voice
- Timer-based updates that work in background

## Testing Background Functionality

1. Start a timer
2. Lock your phone (press power button)
3. Put phone in pocket
4. Wait for announcements
5. Unlock phone - timer should show correct time

## Notes

- Voice announcements use iOS's built-in text-to-speech
- Background audio mode allows the app to continue running
- The app doesn't need to be in the App Store to work
- Works on all iOS devices (iPhone/iPad)

## Troubleshooting

**App won't install**: Make sure device is trusted and developer mode is enabled (Settings → Privacy & Security → Developer Mode)

**Background audio not working**: Verify Background Modes → Audio is enabled in capabilities

**Voice not working**: Check device volume and silent switch

**Timer stops when screen off**: Verify background audio mode is enabled and Info.plist is configured correctly
