# Development Guide

This document provides essential information for continuing development on the Tam High MTB Team Roster and Practice Manager.

## Project Structure

```
Team Practice Pro/
├── mtb-roster.html          # Main application file (single-file architecture)
├── README.md                # User documentation
├── CHANGELOG.md             # Version history
├── DEVELOPMENT.md           # This file
├── .gitignore              # Git ignore rules
└── [other assets]          # Images, PDFs, etc.
```

## Architecture

### Single-File Application
- **All code is in `mtb-roster.html`**: HTML, CSS, and JavaScript are in one file
- **No build process**: Just edit and refresh browser
- **No dependencies**: External libraries loaded via CDN when needed (Leaflet.js for maps)

### Data Storage
- **localStorage**: All data stored in browser's localStorage
- **Key**: `'mtbRosterData'`
- **Structure**: JSON object with:
  ```javascript
  {
    riders: [...],
    coaches: [...],
    rides: [...],
    currentRide: id,
    seasonSettings: {
      startDate: 'YYYY-MM-DD',
      endDate: 'YYYY-MM-DD',
      practices: [{
        id: number,
        dayOfWeek: 0-6,
        time: 'HH:MM',
        endTime: 'HH:MM',
        description: string,
        meetLocation: string,
        locationLat: number|null,
        locationLng: number|null
      }]
    },
    routes: [...],
    autoAssignSettings: {...}
  }
  ```

## Key Functions and Components

### Data Management
- `loadData()`: Loads from localStorage
- `saveData()`: Saves to localStorage
- `generateId()`: Creates unique IDs

### Season Settings
- `openSeasonSetupModal()`: Opens season setup dialog
- `saveSeasonSettings()`: Saves season configuration
- `renderPracticeRows()`: Renders practice list in season setup
- `addPracticeRow()`: Adds new practice template
- `updatePracticeDraft()`: Updates practice field in draft
- `normalizePracticeEntry()`: Validates and normalizes practice data

### Location/Map Functions
- `openLocationMap(practiceId)`: Opens map dialog for practice
- `initializeMap(practice)`: Initializes Leaflet map
- `searchLocation()`: Searches for location using Nominatim
- `reverseGeocode(lat, lng)`: Gets address from coordinates
- `saveLocation()`: Saves location to practice
- `closeLocationMapModal()`: Closes map dialog

### Roster Management
- `renderRiders()`: Renders team roster
- `renderCoaches()`: Renders coach roster
- `addRider()`: Adds new rider
- `addCoach()`: Adds new coach
- `saveRider(id)`: Saves rider edits
- `saveCoach(id)`: Saves coach edits

### Practice/Ride Management
- `renderRides()`: Renders practice list
- `loadCurrentRide()`: Loads selected practice
- `createRide()`: Creates new practice
- `renderAssignments(ride)`: Renders group assignment interface
- `autoAssign()`: Automatic group assignment
- `moveRiderBetweenGroups()`: Moves rider between groups

### Mobile Features
- `toggleMobileMenu()`: Toggles hamburger menu
- `selectMobileTab(tabName)`: Switches tabs from mobile menu
- `updateMobileMenu(activeTabName)`: Updates mobile menu state

## CSS Structure

### Main Sections
- **Base styles**: Lines ~8-100
- **Layout**: Container, tabs, sections
- **Forms**: Inputs, buttons, modals
- **Roster grid**: Desktop and mobile layouts
- **Mobile responsive**: Media queries starting ~1800
- **Practice rows**: Custom styling for season setup
- **Map container**: Leaflet integration styles

### Key Classes
- `.roster-grid`: Main roster container
- `.roster-row`: Individual roster item
- `.practice-row`: Practice configuration row
- `.modal-overlay`: Modal backdrop
- `.modal`: Modal dialog
- `.mobile-menu-*`: Mobile navigation

## External Dependencies

### Leaflet.js (Maps)
- **Loaded dynamically**: When location map is opened
- **CDN**: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- **CSS**: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- **Usage**: Only loaded when needed to reduce initial load time

### OpenStreetMap Services
- **Tiles**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Geocoding**: Nominatim API
- **Rate Limits**: Nominatim requires User-Agent header and has rate limits

## Development Workflow

### Making Changes
1. Open `mtb-roster.html` in a code editor
2. Make changes to HTML, CSS, or JavaScript
3. Save file
4. Refresh browser to see changes
5. Test functionality
6. Commit changes with descriptive message

### Testing
- Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- Test on mobile devices or browser dev tools mobile view
- Test localStorage persistence (close/reopen browser)
- Test with empty data (clear localStorage)
- Test with large datasets

### Common Tasks

#### Adding a New Field to Riders/Coaches
1. Add input field to form HTML
2. Update `addRider()` or `addCoach()` to capture value
3. Update `saveRider()` or `saveCoach()` to save value
4. Update `renderRiders()` or `renderCoaches()` to display value
5. Update mobile roster display if needed

#### Adding a New Tab/Section
1. Add tab button to tabs section
2. Add tab content div with unique ID (`{name}-tab`)
3. Add `switchTab()` handler
4. Update mobile menu if needed

#### Modifying Group Assignment Logic
- See `autoAssign()` function
- Review `autoAssignSettings` structure
- Check `validateGroupRequirements()` for validation rules

## Data Migration

If data structure changes:
1. Add migration logic in `loadData()` or `init()`
2. Check for old structure
3. Transform to new structure
4. Save migrated data

Example:
```javascript
function migrateData() {
  if (data.riders && data.riders[0] && !data.riders[0].newField) {
    data.riders.forEach(rider => {
      rider.newField = defaultValue;
    });
    saveData();
  }
}
```

## Browser Compatibility Notes

- **localStorage**: Supported in all modern browsers
- **Flexbox/Grid**: Used extensively, requires modern browser
- **ES6 Features**: Arrow functions, template literals, etc.
- **Fetch API**: Used for geocoding

## Performance Considerations

- **Large rosters**: Consider pagination if roster exceeds 100+ items
- **Map loading**: Leaflet only loads when needed
- **localStorage limits**: ~5-10MB typically, monitor data size
- **Rendering**: Uses efficient DOM manipulation, but may need optimization for very large datasets

## Known Issues / Future Improvements

### Potential Enhancements
- Export/import data functionality
- Print-friendly views
- Email notifications
- Integration with calendar systems
- Multi-season support
- Backup/restore functionality
- User authentication (if multi-user needed)

### Current Limitations
- Single-user (localStorage is per-browser)
- No server-side persistence
- No real-time collaboration
- Map requires internet connection

## Debugging Tips

### Check localStorage
```javascript
// In browser console:
JSON.parse(localStorage.getItem('mtbRosterData'))
```

### Clear Data
```javascript
// In browser console:
localStorage.removeItem('mtbRosterData')
location.reload()
```

### Common Issues
- **Data not saving**: Check browser console for errors
- **Map not loading**: Check internet connection, Leaflet CDN availability
- **Mobile menu not working**: Check JavaScript console for errors
- **Styles not applying**: Check for CSS syntax errors, browser cache

## Git Workflow Recommendations

### Commit Messages
Use descriptive commit messages:
```
feat: Add location map picker for practices
fix: Correct mobile menu toggle behavior
docs: Update README with location setup instructions
style: Improve practice row field styling
refactor: Extract map initialization logic
```

### Branch Strategy
- `main`: Production-ready code
- `develop`: Development branch (optional)
- Feature branches: `feature/description` (optional)

### Before Committing
1. Test all functionality
2. Check browser console for errors
3. Test on mobile if UI changes
4. Update CHANGELOG.md if needed
5. Update DEVELOPMENT.md if architecture changes

## Getting Help

If you need to continue development in a new chat session:
1. Read this DEVELOPMENT.md file
2. Review CHANGELOG.md for recent changes
3. Check git commit history for context
4. Examine the code structure using search tools
5. Use browser dev tools to inspect current state

## Code Style

- **Indentation**: 4 spaces
- **Quotes**: Single quotes for JavaScript, double for HTML attributes
- **Naming**: camelCase for variables/functions, kebab-case for CSS classes
- **Comments**: Add comments for complex logic
- **Functions**: Keep functions focused and reasonably sized




