# Interval Timer - Handoff Document

## Project Overview

A web-based interval timer designed for MTB (mountain bike) team training. The timer provides voice announcements and visual feedback for work/rest intervals, optimized for smartphone use in portrait mode.

**Live Site**: Available via GitHub Pages (if configured)
**Repository**: `https://github.com/previsiondesign/team-ride-pro.git`
**Location**: `utilities/interval timer/interval-timer.html`

## Current Features

### Core Functionality
- ✅ Work and rest interval timing with custom durations (minutes + seconds)
- ✅ Multiple intervals (1-100)
- ✅ Custom "Work" and "Rest" phrases (used in voice announcements)
- ✅ 5-second countdown before timer starts
- ✅ Fullscreen mode optimized for smartphones
- ✅ Large, digital clock-style display (Allerta Stencil font)
- ✅ Time format: "M:SS" (e.g., "0:30" instead of "00:30")

### Audio Features
- ✅ **Voice Announcements** (Web Speech API):
  - "Work for X" / "Rest for X" at interval start
  - "Starting Interval X of Y in 3, 2, 1" at end of rest (except final interval)
  - Countdown "3, 2, 1" at end of work and rest periods
  - "Workout complete! Great job!" at completion
- ✅ **Bell Chime** (Web Audio API):
  - Bell-like tone with harmonics (C5, E5, G5 chord)
  - Maximum volume
  - Plays at start/end of each interval
  - 600ms pause after chime before voice announcement
- ✅ Mobile voice compatibility (iOS Safari workarounds implemented)

### Visual Features
- ✅ Phase indicators (WORK/REST) with color coding
- ✅ Interval counter display
- ✅ Pulsing effect in last 3 seconds
- ✅ Completion screen with "✓ DONE", "COMPLETE", "Great work!"
- ✅ Responsive design for mobile (optimized for max-width: 500px, 400px, 360px)
- ✅ Auto-resizing phase text to prevent overflow

### Controls
- ✅ Pause/Resume functionality
- ✅ Stop button (returns to setup)
- ✅ Timestamp-based timing (continues accurately even if JavaScript throttled)

### Offline Support
- ✅ Progressive Web App (PWA) with service worker
- ✅ Offline caching of HTML and Google Fonts
- ✅ Manifest.json for app installation
- ✅ Works offline after first load

## Technical Implementation

### File Structure
```
utilities/interval timer/
├── interval-timer.html      # Main application (single-file HTML/CSS/JS)
├── service-worker.js         # PWA service worker for offline support
├── manifest.json             # PWA manifest
├── IntervalTimerApp.swift    # Native iOS app (SwiftUI) - optional
├── ContentView.swift         # Native iOS app views - optional
├── TimerManager.swift        # Native iOS app logic - optional
├── Info.plist               # iOS app configuration - optional
└── README_iOS_App.md        # iOS app build instructions - optional
```

### Key Technologies
- **HTML5** - Single-file application
- **CSS3** - Responsive design with media queries, flexbox
- **JavaScript** - Vanilla JS (no frameworks)
- **Web Speech API** - Voice announcements
- **Web Audio API** - Bell chime generation
- **Service Workers** - Offline support
- **PWA** - Progressive Web App capabilities

### Important Code Sections

#### Audio Context (iOS Safari Compatibility)
```javascript
// Persistent AudioContext required for iOS Safari
let audioContext = null;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    } else if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}
```

#### Timestamp-Based Timing
Uses `Date.now()` for accurate timing that works even when JavaScript is throttled in background:
```javascript
const elapsed = Math.floor((Date.now() - phaseStartTime - pausedTime * 1000) / 1000);
timeRemaining = Math.max(0, phaseDuration - elapsed);
```

#### Voice Announcements
- Uses `window.speechSynthesis` with voice caching for mobile compatibility
- Special handling for iOS Safari (immediate activation on user interaction)

#### Bell Chime
- Multi-oscillator bell sound (3 frequencies: 523.25, 659.25, 783.99 Hz)
- Maximum volume (gain: 1.0)
- 600ms delay before voice announcements

## Known Limitations

### iOS Safari Background Execution
⚠️ **Critical Limitation**: iOS Safari does NOT support true background execution when screen is off.

- Timer pauses when screen is locked/turned off
- Voice announcements don't work when app is in background
- **Workaround**: Screen must stay on during use
- **Solution**: Native iOS app available (see `README_iOS_App.md`) but requires Mac + Xcode to build

### Android
- Better background execution support
- Wake Lock API works more reliably
- Background audio generally supported

### Browser Compatibility
- ✅ Chrome/Edge: Full support
- ✅ Safari (iOS): Works but screen must stay on
- ✅ Safari (macOS): Full support
- ✅ Firefox: Full support

## Recent Changes (Latest First)

1. **600ms pause after chime** - Increased delay before voice announcements
2. **iOS Safari audio fix** - Persistent AudioContext with resume handling
3. **Bell chime improvements** - Multi-harmonic bell sound, maximum volume
4. **Background execution attempt** - Timestamp-based timing (works on Android, limited on iOS)
5. **Offline PWA support** - Service worker and manifest for offline use
6. **Mobile voice compatibility** - Voice loading and activation fixes for iOS

## Design Decisions

### Single-File Application
- All code in one HTML file for simplicity
- Easy to deploy (just one file)
- No build process required

### Portrait-Only Optimization
- Designed specifically for smartphone portrait mode
- Large text optimized for viewing while riding
- No desktop/landscape optimization needed

### Custom Phrases
- Users can customize "Work" and "Rest" phrases
- Voice uses custom phrases in announcements
- Display shows uppercase version

## Future Considerations

### Potential Enhancements
1. **Native iOS App** - Already created (Swift files), needs building
2. **Sound file option** - Could use actual audio files instead of Web Audio API
3. **Preset configurations** - Save/load common interval setups
4. **Statistics** - Track completed workouts
5. **Different chime sounds** - User-selectable chime tones

### iOS Background Execution
If true background execution is critical:
- Build the native iOS app (files provided)
- Requires: Mac computer, Xcode, Apple Developer account ($99/year or free with limitations)
- See `README_iOS_App.md` for detailed instructions

## Testing Checklist

When making changes, test:
- [ ] Timer counts down accurately
- [ ] Voice announcements play correctly
- [ ] Bell chime plays at interval transitions
- [ ] Pause/Resume works correctly
- [ ] Stop returns to setup screen
- [ ] Completion screen displays properly
- [ ] Responsive design works on small screens (360px, 400px, 500px)
- [ ] iOS Safari: Voice and chime work (screen on)
- [ ] Android: Background execution (if applicable)
- [ ] Offline mode: Works after first load

## Deployment

### Current Setup
- Code is in GitHub repository
- GitHub Pages can be enabled for live hosting
- Service worker enables offline functionality

### To Update Live Site
1. Make changes to `interval-timer.html`
2. Commit: `git add "utilities/interval timer/interval-timer.html"`
3. Commit: `git commit -m "Description of changes"`
4. Push: `git push origin main`
5. GitHub Pages updates automatically (may take 1-2 minutes)

## Key Functions Reference

### Main Functions
- `startTimer()` - Initializes and starts the timer
- `startActualTimer()` - Begins actual interval timing after countdown
- `tick()` - Main timer loop (runs every 100ms)
- `playDing()` - Plays bell chime sound
- `speak(text)` - Voice announcement
- `pauseResume()` - Toggle pause state
- `stopTimer()` - Stop and return to setup
- `completeTimer()` - Handle workout completion

### Helper Functions
- `formatTimeForSpeech(seconds)` - Converts seconds to spoken format
- `updateDisplay()` - Updates all UI elements
- `autoResizePhaseText(element)` - Dynamically resizes phase text
- `initAudioContext()` - Initializes audio for iOS compatibility
- `loadVoices()` - Loads speech synthesis voices

## Contact/Context

- **Purpose**: MTB team training interval timer
- **Primary Use Case**: Phone in pocket during training (screen on requirement)
- **User**: Adam Phillips / MTB Team
- **Repository**: Team Practice Pro project

## Notes for Next Developer

1. **iOS Background Issue**: This is a fundamental iOS Safari limitation, not a bug. The native app solution exists but requires building.

2. **Single File**: Everything is in one HTML file - easy to edit but can be long (1305 lines). Use search to find specific sections.

3. **Mobile-First**: All design decisions prioritize mobile portrait mode. Desktop experience is not optimized.

4. **Audio Complexity**: iOS Safari requires special handling for both Web Speech API and Web Audio API. Both have workarounds implemented.

5. **Offline Support**: Service worker caches the HTML and fonts. First load requires internet, subsequent uses work offline.

---

**Last Updated**: Based on commit `d4fd7f3` - "Increase chime-to-voice delay to 600ms"
**Status**: Production-ready for screen-on use. Native iOS app available for true background execution.
