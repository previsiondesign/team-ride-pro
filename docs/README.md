# Tam High MTB Team Roster and Practice Manager

A comprehensive web application for managing the Tamalpais High School Mountain Bike Team roster, coaches, practice schedules, and ride assignments.

## Features

### Team Management
- **Team Roster**: Add, edit, and manage rider information including:
  - Photos, names, contact information
  - Grade, gender, racing group, pace level
  - Notes and custom fields
  - Grouping and sorting by various criteria

### Coach Management
- **Coach Roster**: Manage coach information including:
  - Photos, names, contact information
  - Coach level (1, 2, or 3) with visual differentiation
  - Fitness level (1-10)
  - Notes and availability

### Practice Planning
- **Season Setup**: Configure season dates and regular practice schedules
  - Set season start and end dates
  - Define recurring weekly practices with:
    - Day of week and time
    - Description (e.g., "Weekly Practice 1")
    - Meet location with map-based location picker
    - GPS coordinates for precise location
- **Practice Scheduler**: Create and manage individual practice sessions
  - Auto-generate practices from season settings
  - Add additional practices
  - Cancel or delete practices
  - View season calendar

### Group Assignment
- **Automatic Assignment**: AI-powered group assignment based on:
  - Rider pace, grade, gender
  - Coach availability and level
  - Group size requirements
  - Custom assignment rules
- **Manual Assignment**: Drag-and-drop interface for manual adjustments
- **Group Management**: 
  - Move riders between groups
  - Validate group requirements
  - Visual indicators for coach levels

### Routes
- **Route Management**: Store and display Strava route information
- **Route Embedding**: Display routes with official Strava embed codes

### Mobile-Friendly
- Responsive design optimized for mobile devices
- Hamburger menu navigation
- Compact roster displays
- Touch-friendly interface
- Phone number click-to-call functionality

## Getting Started

### Installation

1. **Download the Application**
   - The application is a single HTML file: `mtb-roster.html`
   - No server or build process required

2. **Open in Browser**
   - Simply open `mtb-roster.html` in any modern web browser
   - All data is stored locally in your browser's localStorage

3. **First Time Setup**
   - Click "Season Setup" to configure your season dates
   - Add regular practices with descriptions and locations
   - Add riders and coaches to the rosters

### Usage

#### Setting Up Season Practices

1. Click **"Season Setup"** button
2. Enter season start and end dates
3. Click **"Add Practice"** to create regular weekly practices
4. For each practice:
   - Select day of week
   - Set start and end times
   - Enter a description (e.g., "Weekly Practice 1")
   - Enter meet location text
   - Click the map icon (🗺️) to set precise GPS location
5. Click **"Save Settings"**

#### Adding Riders

1. Go to **"Team Roster"** tab
2. Fill in rider information:
   - Upload or enter photo URL
   - Name, phone, email
   - Grade, gender, racing group
   - Pace level (1-10)
   - Notes
3. Click **"Add Rider"**

#### Adding Coaches

1. Go to **"Coach Roster"** tab
2. Fill in coach information:
   - Upload or enter photo URL
   - Name, phone
   - Coach level (1, 2, or 3)
   - Fitness level (1-10)
   - Notes
3. Click **"Add Coach"**

#### Creating a Practice Session

1. Go to **"Practice Scheduler"** tab
2. Practices are auto-generated from season settings
3. Click on a practice date to load it
4. Or click **"Add Additional Practice"** for one-off practices

#### Assigning Riders to Groups

1. Load a practice from the Practice Scheduler
2. Use **"🤖 Autofill Assignments"** for automatic assignment
3. Or manually drag riders and coaches to groups
4. Use up/down arrows to move riders between groups
5. System validates group requirements and shows warnings

#### Setting Practice Locations

1. In Season Setup, click the map icon (🗺️) next to a practice's meet location
2. In the map dialog:
   - Search for a location
   - Click on the map to set a pin
   - Or manually enter latitude/longitude
   - Address is auto-populated from coordinates
3. Click **"Save Location"**

## Data Storage

- All data is stored in your browser's **localStorage**
- Data persists between browser sessions
- To backup data: Export from browser developer tools or use browser's backup feature
- To restore: Import data into localStorage

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Requires localStorage support

## Technical Details

- **Technology**: Pure HTML, CSS, and JavaScript (no frameworks)
- **Storage**: Browser localStorage
- **Maps**: Leaflet.js with OpenStreetMap
- **External Services**: 
  - OpenStreetMap for mapping
  - Nominatim for geocoding
  - Strava for route embeds (optional)

## Support

For issues or questions, refer to the DEVELOPMENT.md file for technical details or contact the development team.

## License

Internal use for Tamalpais High School MTB Team.




