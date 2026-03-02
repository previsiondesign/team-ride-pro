        // ============================================================
        // app-state.js  —  Shared state variables & constants
        // Loaded FIRST so every other module can access these globals.
        // ============================================================

        // Debug logging control (use ?debug=1 or local file to enable verbose logs)
        const DEBUG_LOGS = new URLSearchParams(window.location.search).has('debug') || window.location.protocol === 'file:';
        if (!DEBUG_LOGS) {
            const originalLog = console.log;
            const originalInfo = console.info;
            console.log = () => {};
            console.info = () => {};
            // Preserve originals in case needed elsewhere
            console._originalLog = originalLog;
            console._originalInfo = originalInfo;
        }

        // Data storage
        let data = {
            riders: [],
            coaches: [],
            rides: [],
            routes: [],
            races: [],
            currentRide: null,
            seasonSettings: {
                startDate: '',
                endDate: '',
                practices: [],
                fitnessScale: 6,
                skillsScale: 6,
                climbingScale: 6,
                paceScaleOrder: 'fastest_to_slowest',
                groupPaceOrder: 'fastest_to_slowest'
            },
            scheduledAbsences: [],  // Array of absence records from scheduled_absences table
            coachRoles: [],  // Array of { roleName: string, coachId: number }
            riderRoles: [],  // Array of { roleName: string, riderId: number }
            timeEstimationSettings: {
                fastSpeedBase: 12.5,      // mph - faster rider base speed
                slowSpeedBase: 10,        // mph - slower rider base speed
                fastSpeedMin: 5.5,        // mph - minimum speed for faster rider
                slowSpeedMin: 4,          // mph - minimum speed for slower rider
                elevationAdjustment: 0.5, // mph reduction per 1000 ft elevation
                lengthAdjustmentFactor: 0.1 // mph reduction per mile over 10 miles
            },
            autoAssignSettings: {
                parameters: [
                    { id: 'ridersPerCoach', name: 'Riders per Coach', value: 6, priority: 1, enabled: true, type: 'number', min: 1, max: 20, description: 'Maximum riders per coach (capacity multiplier)' },
                    { id: 'minLeaderLevel', name: 'Minimum Leader Level', value: 2, priority: 2, enabled: true, type: 'number', min: 1, max: 3, description: 'Minimum coach level required to lead a group' },
                    { id: 'preferredCoachesPerGroup', name: 'Preferred Coaches per Group', value: 3, priority: 3, enabled: true, type: 'number', min: 1, max: 10, description: 'Target number of coaches per group' },
                    { id: 'preferredGroupSize', name: 'Preferred Group Size Range', valueMin: 4, valueMax: 8, priority: 4, enabled: true, type: 'range', min: 1, max: 30, description: 'Preferred number of riders per group (min-max range)' }
                ]
            },
        };

        let practiceReportingRideIndex = null;
        let practiceReportingSortDirection = 'asc';

        let autoAssignDebugLog = '';
        let autoAssignSettingsDraft = null;
        
        // Global state for group section collapse/expand (synchronized across all groups)
        let groupSectionsState = {
            coaches: true,  // true = expanded, false = collapsed
            riders: true,
            route: true
        };
        let seasonSettingsDraft = null;
        let practicePlannerView = 'home'; // 'home' | 'groupMethod' | 'planner' | 'picker'
        let practicePickerMode = null;    // 'future' | 'past' when in picker
        const USE_PRACTICE_PLANNER_LANDING = false; // Set true to show "What do you want to do?" and group-method pages
        let _initialRideSelectionDone = false;
        
        let isReadOnlyMode = false;
        window.isReadOnlyMode = false;
        let readOnlyLockInfo = null;
        let readOnlyNoticeShown = false;
        let adminEditLockInterval = null;
        let takeOverCheckInterval = null;
        let isDeveloperMode = false;
        window.isDeveloperMode = false;
        let unassignedPaletteVisibility = 'auto'; // 'auto' | 'show' | 'hide'
        let showAllRouteLocationsForRide = null; // ride ID for which "show all locations" is active (null = default location-filtered)
        let unassignedPaletteHeight = 300;
        let addRouteCachedPreviewDataUrl = null;

        // Sidebar state
        let sidebarRidersFilter = 'absent';   // 'attending' | 'absent' | 'unassigned'
        let sidebarCoachesFilter = 'absent';
        let sidebarRidersSort = 'firstName';
        let sidebarCoachesSort = 'firstName';
        let sidebarsVisible = false;
        let sidebarRidersCollapsed = true;
        let sidebarCoachesCollapsed = true;
        let attendanceMode = false;

        // Storage keys
        const STORAGE_KEY = 'teamRideProData';
        const OLD_STORAGE_KEY = 'mtbRosterData'; // For migration from old filename
        const DEV_MODE_STORAGE_KEY = 'teamRideProDeveloperMode';

        // Grade normalization map
        const GRADE_MAP = {
            '6': '6th', '6th': '6th', '6th grade': '6th', 'sixth': '6th',
            '7': '7th', '7th': '7th', '7th grade': '7th', 'seventh': '7th',
            '8': '8th', '8th': '8th', '8th grade': '8th', 'eighth': '8th',
            '9': '9th', '9th': '9th', '9th grade': '9th', 'ninth': '9th', 'freshman': '9th',
            '10': '10th', '10th': '10th', '10th grade': '10th', 'tenth': '10th', 'sophomore': '10th',
            '11': '11th', '11th': '11th', '11th grade': '11th', 'eleventh': '11th', 'junior': '11th',
            '12': '12th', '12th': '12th', '12th grade': '12th', 'twelfth': '12th', 'senior': '12th'
        };

        // Rider/Coach roster state
        let currentEditingRiderId = null;
        let currentEditingCoachId = null;
        let riderSortColumn = null;
        let riderSortDirection = 'asc';
        let coachSortColumn = null;
        let coachSortDirection = 'asc';
        let showArchivedRiders = false;
        let showArchivedCoaches = false;
        let riderGroupBy = '';
        let coachGroupBy = '';

        // Column resize state
        let resizingColumn = null;
        let resizingStartX = 0;
        let resizingStartWidth = 0;
        let resizingMinWidth = 0;
        let resizingHeaderElement = null;

        // Column drag state
        let draggedColumnKey = null;
        let draggedColumnType = null;

        // Photo crop state
        let photoCropState = {
            canvas: null,
            ctx: null,
            image: null,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            targetSize: 150,
            inputId: null,
            previewId: null,
            callback: null
        };

        // Group count selection state
        let groupCountSelectionState = {
            rideId: null,
            pendingGroupCount: null,
            method: null,
            resolve: null
        };

        // Badge context menu
        let badgeContextMenuData = null;
        let badgeContextMenuTimeout = null;

        // Auth state
        let pendingVerification = null;
        let lockConflictRequestPollTimer = null;
        let takeOverRequestPollTimer = null;
        let takeOverCountdownTimer = null;
        let takeOverCountdownSeconds = 30;
        let takeOverBeforeUnloadHandler = null;
        let simplifiedLoginMode = null;
        let simplifiedLoginInfo = null;
        let lastVisibilityCheck = Date.now();
        let isReloading = false;
        let appBootComplete = false;

        // Season/practice state
        let currentPracticeIdForTimeRange = null;
        let originalPracticeStates = new Map();

        // Location state
        let currentPracticeIdForLocation = null;
        let map = null;
        let mapMarker = null;

        // Roster filter state
        let currentPracticeIdForRoster = null;
        let currentPracticeIdForExceptions = null;
        let rosterFilterSettings = {};

        // Calendar state
        let calendarRenderTimeout = null;
        let contextMenuDate = null;
        let contextMenuTimeout = null;
        let contextMenuCloseHandler = null;
        let cancelPracticeTargetDate = null;

        // Attendance resize state
        let attendanceResizeActive = false;
        let attendanceResizeStartY = 0;
        let attendanceResizeStartHeight = 0;

        // Assignment drag state
        let autoScrollInterval = null;
        let isAssignmentDragging = false;
        let currentMouseY = 0;
        let pendingCoachMove = null;

        // Assignment history (undo/redo)
        let assignmentHistory = [];
        let assignmentHistoryIndex = -1;
        const MAX_HISTORY = 50;
        let isUndoRedoInProgress = false;

        // CSV import state
        let pendingCSVData = null;
        let pendingCSVType = null;
        let pendingCSVHeaders = null;
        let csvFieldMapping = null;
        let additionalFieldCounter = 0;
        let googleAccessToken = null;
        let googleTokenClient = null;

        // Route state
        const MAX_STRAVA_EMBEDS = 0;
        const PROXY_SERVER_URL = 'https://strava-route-proxy.onrender.com';
        let isDragging = false;
        let dragHandle = null;
        let dragSlider = null;
        let dragType = null;
        let dragStartX = 0;
        let dragStartPercent = 0;

        // Encryption key base for backups
        const ENCRYPTION_KEY_BASE = 'TeamRidePro2024SecureBackup';

        // Google Sheets constants defined in app-csv.js

        // Column definitions for roster reordering
        const riderColumnDefs = [
            { key: 'name', label: 'Name', sortable: true, width: 'minmax(220px, 1.8fr)' },
            { key: 'nickname', label: 'Nickname', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'gender', label: 'Gender', sortable: true, width: 'minmax(90px, 0.7fr)' },
            { key: 'grade', label: 'Grade', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'racingGroup', label: 'Racing Group', sortable: true, width: 'minmax(160px, 1fr)' },
            { key: 'phone', label: 'Cell Phone', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'email', label: 'Email', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'address', label: 'Address', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'birthday', label: 'Birthday', sortable: false, width: 'minmax(110px, 0.8fr)' },
            { key: 'pace', label: 'Endurance Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'climbing', label: 'Climbing Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'skills', label: 'Descending Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'bike', label: 'Bike', sortable: false, width: 'minmax(100px, 0.7fr)' },
            { key: 'primaryParentName', label: 'Primary Parent/Guardian', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'primaryParentPhone', label: 'Primary Parent Cell', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'primaryParentEmail', label: 'Primary Parent Email', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'primaryParentAddress', label: 'Primary Parent Address', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'secondParentName', label: 'Second Parent/Guardian', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'secondParentPhone', label: 'Second Parent Cell', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'secondParentEmail', label: 'Second Parent Email', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'alternateContactName', label: 'Alternate Contact', sortable: false, width: 'minmax(160px, 1fr)' },
            { key: 'alternateContactRelationship', label: 'Alt. Contact Relation', sortable: false, width: 'minmax(140px, 0.9fr)' },
            { key: 'alternateContactPhone', label: 'Alt. Contact Cell', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'primaryPhysician', label: 'Primary Physician', sortable: false, width: 'minmax(160px, 1fr)' },
            { key: 'primaryPhysicianPhone', label: 'Physician Phone', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'medicalInsuranceCompany', label: 'Medical Insurance', sortable: false, width: 'minmax(160px, 1fr)' },
            { key: 'medicalInsuranceAccountNumber', label: 'Insurance Account #', sortable: false, width: 'minmax(140px, 1fr)' },
            { key: 'allergiesOrMedicalNeeds', label: 'Allergies/Medical', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'notes', label: 'Notes', sortable: false, width: 'minmax(80px, 0.5fr)' },
            { key: 'actions', label: '', sortable: false, width: 'minmax(160px, 0.9fr)' }
        ];
        
        const coachColumnDefs = [
            { key: 'name', label: 'Name', sortable: true, width: 'minmax(220px, 1.8fr)' },
            { key: 'nickname', label: 'Nickname', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'level', label: 'Coach Level', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'gender', label: 'Gender', sortable: true, width: 'minmax(90px, 0.7fr)' },
            { key: 'phone', label: 'Cell Phone', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'workPhone', label: 'Work Phone', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'homePhone', label: 'Home Phone', sortable: false, width: 'minmax(130px, 1fr)' },
            { key: 'email', label: 'Email', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'pace', label: 'Endurance Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'climbing', label: 'Climbing Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'skills', label: 'Descending Rating', sortable: true, width: 'minmax(130px, 0.9fr)' },
            { key: 'bike', label: 'Bike', sortable: false, width: 'minmax(100px, 0.7fr)' },
            { key: 'registered', label: 'Registered', sortable: false, width: 'minmax(110px, 0.8fr)' },
            { key: 'paid', label: 'Paid', sortable: false, width: 'minmax(80px, 0.6fr)' },
            { key: 'backgroundCheck', label: 'Background Check', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'level3Exam', label: 'Level 3 Exam', sortable: false, width: 'minmax(120px, 0.8fr)' },
            { key: 'pduCeu', label: 'PDU/CEU Units', sortable: false, width: 'minmax(120px, 0.8fr)' },
            { key: 'fieldWorkHours', label: 'Field Work Hours', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'firstAid', label: 'First Aid', sortable: false, width: 'minmax(180px, 1.2fr)' },
            { key: 'cprExpires', label: 'CPR Expires', sortable: false, width: 'minmax(120px, 0.8fr)' },
            { key: 'concussionTraining', label: 'Concussion Training', sortable: false, width: 'minmax(150px, 1fr)' },
            { key: 'nicaPhilosophy', label: 'NICA Philosophy', sortable: false, width: 'minmax(140px, 0.9fr)' },
            { key: 'abuseAwareness', label: 'Abuse Awareness', sortable: false, width: 'minmax(140px, 0.9fr)' },
            { key: 'licenseLevel1', label: 'License Level 1', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'licenseLevel2', label: 'License Level 2', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'licenseLevel3', label: 'License Level 3', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'otbClassroom', label: 'OTB Classroom', sortable: false, width: 'minmax(130px, 0.9fr)' },
            { key: 'otbOutdoor', label: 'OTB Outdoor', sortable: false, width: 'minmax(120px, 0.8fr)' },
            { key: 'nicaSummit', label: 'NICA Summit', sortable: false, width: 'minmax(120px, 0.8fr)' },
            { key: 'notes', label: 'Notes', sortable: false, width: 'minmax(80px, 0.5fr)' },
            { key: 'actions', label: '', sortable: false, width: 'minmax(160px, 0.9fr)' }
        ];

        // Days of week constant
        const DAYS_OF_WEEK = [
            'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        ];

        // Season date range picker state
        let seasonDateRangePickerState = {
            startDate: null,
            endDate: null,
            selecting: 'start',
            currentMonth: new Date().getMonth(),
            currentYear: new Date().getFullYear()
        };
