# Changelog

All notable changes to the Tam High MTB Team Roster and Practice Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Season Setup dialog with wider layout (900px)
- Description field for practices (defaults to "Weekly Practice 1", "Weekly Practice 2", etc.)
- Meet Location text field for practices
- Map-based location picker with GPS coordinates
- Location map modal with Leaflet.js integration
- Search functionality for locations
- Reverse geocoding to get addresses from coordinates
- Visual indicators for practices with saved locations (📍 vs 🗺️ icons)

### Changed
- Season Setup modal width increased from 520px to 900px
- Practice rows now use a 5-column grid layout
- Improved styling for practice row fields with focus states

## [1.0.0] - Initial Release

### Added
- Team Roster management with photos, contact info, and rider attributes
- Coach Roster management with levels and fitness ratings
- Practice Scheduler with season calendar
- Season Setup for configuring recurring practices
- Automatic group assignment with AI-powered logic
- Manual group assignment with drag-and-drop
- Mobile-responsive design with hamburger menu
- Route management with Strava integration
- Phone number click-to-call on mobile
- Grouping and sorting options for rosters
- Visual differentiation for coach levels (Level 2 and 3 have darker backgrounds)
- Compact card layout for assignment views
- Up/down arrows to move riders between groups
- Group requirement validation with warnings
- Attendance tracking
- Data persistence via localStorage

### Technical
- Single-file HTML application
- Pure JavaScript (no frameworks)
- Responsive CSS with mobile-first approach
- OpenStreetMap integration for location services




