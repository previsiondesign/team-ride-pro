        // ============================================================
        // app-main.js  -  Bootstrap / init / data persistence / navigation
        // All other functions have been split into separate module files.
        // Load order: app-state.js, app-utils.js, app-scales.js, then
        // feature modules, then this file LAST.
        // ============================================================

        // ===== INIT =====
        async function init() {
            // Keep tab content hidden during bootstrap to avoid showing stale/default
            // dashboard content before auth + welcome routing complete.
            try {
                if (document.body) document.body.classList.add('app-initializing');
            } catch (e) {}

            // Auto-logout detection: if the browser tab/session was closed since the
            // last visit, clear stale auth token BEFORE Supabase init/auth checks.
            if (typeof checkAutoLogoutOnOpen === 'function') {
                checkAutoLogoutOnOpen();
            }

            // Check for simplified login view mode (any view param triggers simplified login)
            const urlParams = new URLSearchParams(window.location.search);
            const viewParam = urlParams.get('view');
            const isSimplifiedView = viewParam === 'assignments' || viewParam === 'rider' || viewParam === 'coach'; // Support old URLs too
            
            // Check for existing simplified login in sessionStorage
            try {
                const stored = window.sessionStorage.getItem('simplifiedLogin');
                if (stored) {
                    simplifiedLoginInfo = JSON.parse(stored);
                    // Check if stored info is still valid (within 24 hours)
                    const age = Date.now() - (simplifiedLoginInfo.timestamp || 0);
                    if (age < 24 * 60 * 60 * 1000) {
                        simplifiedLoginMode = simplifiedLoginInfo.type;
                    } else {
                        // Expired, clear it
                        window.sessionStorage.removeItem('simplifiedLogin');
                        simplifiedLoginInfo = null;
                    }
                }
            } catch (e) {
                console.warn('Error reading simplified login info:', e);
            }
            
            // Restore developer mode flag (per browser session; cleared on logout)
            try {
                const dev = localStorage.getItem(DEV_MODE_STORAGE_KEY);
                if (dev === 'true') {
                    isDeveloperMode = true;
                    window.isDeveloperMode = true;
                    const banner = document.getElementById('developer-mode-banner');
                    if (banner) banner.style.display = 'flex';
                    const toggle = document.getElementById('developer-mode-toggle');
                    if (toggle) toggle.checked = true;
                    requestAnimationFrame(() => { if (typeof updateSidebarTop === 'function') updateSidebarTop(); });
                }
            } catch (e) {
                console.warn('Error reading developer mode flag:', e);
            }
            
            // If URL param indicates simplified view but no stored login, they need to log in
            if (isSimplifiedView && !simplifiedLoginInfo) {
                // Will show simplified login form in handleAuthStateChange
            } else if (simplifiedLoginInfo) {
                // Use stored login info and apply appropriate view
                simplifiedLoginMode = simplifiedLoginInfo.type;
                if (simplifiedLoginMode === 'rider') {
                    enableSimplifiedViewMode('rider');
                } else if (simplifiedLoginMode === 'coach') {
                    enableSimplifiedViewMode('coach');
                }
            }
            
            // Initialize Supabase client
            if (typeof initSupabase === 'function') {
                initSupabase();
            }
            
            // Initialize authentication (this will call handleAuthStateChange)
            if (typeof initAuth === 'function') {
                initAuth();
            } else {
                // Fallback: if auth not available, use localStorage mode
                await loadApplicationData();
            }

            setupAutoLogoutOnClose();

            // Register page lifecycle handlers so data is saved when tab goes to background
            // (e.g., Mac desktop switch) and reloaded when it comes back
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('focus', handleWindowFocus);
        }

        // Load application data (from Supabase if authenticated, otherwise localStorage)
        // isFreshLogin: true when user just entered credentials (show welcome);
        //               false on page refresh or session restore (restore last tab).
        async function loadApplicationData(isFreshLogin) {
            const mainContainer = document.querySelector('.container');
            // Only hide container on initial/fresh login — not on background data reloads
            // (focus/visibility reloads should refresh data silently without a visual flash)
            if (mainContainer && isFreshLogin) {
                mainContainer.style.visibility = 'hidden';
            }

            // Check if we should load from Supabase
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const hasSimplifiedLogin = simplifiedLoginInfo !== null;
            
            // Load from Supabase if:
            // 1. User is fully authenticated (has Supabase auth user), OR
            // 2. User has simplified login (rider/coach login via phone/email)
            // Developer mode still READS from Supabase (only writes are blocked)
            if (client && (currentUser || hasSimplifiedLogin) && typeof loadDataFromSupabase === 'function') {
                // Try to load from Supabase (works for both authenticated and simplified login users)
                try {
                    await loadDataFromSupabase();
                    // In developer mode, snapshot the fresh Supabase data to localStorage
                    // so local edits persist across the session without writing back to Supabase
                    if (isDeveloperMode) {
                        console.log('Developer mode: loaded fresh data from Supabase (read-only). Snapshotting to localStorage.');
                        try {
                            const dataToSave = {
                                riders: data.riders,
                                coaches: data.coaches,
                                rides: data.rides,
                                routes: data.routes,
                                races: data.races || [],
                                currentRide: data.currentRide,
                                seasonSettings: data.seasonSettings,
                                autoAssignSettings: data.autoAssignSettings,
                                coachRoles: data.coachRoles || [],
                                riderRoles: data.riderRoles || []
                            };
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                        } catch (e) {
                            console.warn('Developer mode: could not snapshot data to localStorage:', e);
                        }
                    }
                } catch (error) {
                    // Only fall back if it's a critical error, not just missing settings
                    const isSettingsError = error?.message?.includes('season') || error?.message?.includes('auto-assign') || error?.status === 406;
                    if (isSettingsError && hasSimplifiedLogin) {
                        // For simplified login, settings errors are expected - continue with loaded data
                        console.log('Settings not available for simplified login (expected)');
                    } else {
                        console.warn('Error loading from Supabase, falling back to localStorage:', error);
                        loadData();
                    }
                }
            } else {
                // Unauthenticated - load from localStorage only
                console.warn('Not authenticated - loading from localStorage (fallback mode)');
                loadData();
            }
            
            // Upgrade/normalize data structure
            upgradeData();
            
            // Load season settings (needed for settings tab to display correctly on refresh)
            loadSeasonSettings();

            // Load per-user UI preferences from cloud (cross-device sync).
            await loadUserUiPreferencesFromCloud();
            
            // Apply team name from settings to header (Supabase → localStorage → HTML default)
            {
                let teamName = (data.seasonSettings && data.seasonSettings.teamName) || '';
                if (!teamName) {
                    try { teamName = localStorage.getItem(TEAM_NAME_STORAGE_KEY) || ''; } catch (e) {}
                }
                if (teamName) {
                    applyTeamName(teamName);
                }
                // Header visibility is controlled by .sticky-top — no need
                // to force it visible here (would flash during welcome).
            }
            
            // Re-normalize rides after rosters are loaded to validate assignments
            if (Array.isArray(data.rides)) {
                data.rides = data.rides.map(ride => {
                    const { ride: normalizedRide, changed: rideChanged } = normalizeRideStructure(ride);
                    if (rideChanged) {
                        saveData(); // Save normalized ride
                    }
                    return normalizedRide;
                });
            }
            
            // Render everything
            renderRiders();
            renderCoaches();
            renderRides();
            renderRoutes();
            
            // Team name already applied from loadApplicationData() — no duplicate call needed

            // --- STARTUP ROUTING ---
            let welcomeShowing = false;
            if (isFreshLogin && !simplifiedLoginInfo && isWelcomeScreenEnabledForUser()) {
                welcomeShowing = showWelcomeScreen();
            }
            if (welcomeShowing) {
                // App chrome stays hidden; welcome overlay covers viewport.
            } else {
                restoreLastActiveTab();
                revealAppChrome();
            }

            // Hide the loading spinner now that content is ready
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            try {
                if (document.body) document.body.classList.remove('app-initializing');
            } catch (e) {}
            appBootComplete = true;
            
            // Suppress Mapbox/WebGL errors from Strava embeds (these are harmless or caused by context limits)
            const originalConsoleError = console.error;
            console.error = function(...args) {
                const errorMsg = args.join(' ');
                if (errorMsg.includes('Image "null"') || 
                    errorMsg.includes('Expected value to be of type number, but found null') ||
                    errorMsg.includes('styleimagemissing') ||
                    errorMsg.includes('map.addImage') ||
                    errorMsg.includes('sprite') ||
                    errorMsg.includes('too many active WebGL contexts') ||
                    errorMsg.includes('t.actor.send') ||
                    errorMsg.includes('history.replaceState() more than 100 times') ||
                    (errorMsg.includes('SecurityError') && errorMsg.includes('replaceState')) ||
                    (errorMsg.includes("undefined is not an object") && errorMsg.includes("i[0]"))) {
                    return; // Suppress Strava/Mapbox iframe noise
                }
                originalConsoleError.apply(console, args);
            };
        }

        // ===== DATA PERSISTENCE & NAVIGATION =====
        function upgradeData() {
            let changed = false;

            // Ensure arrays exist - preserve existing data from Supabase
            if (!Array.isArray(data.coaches)) {
                data.coaches = [];
            }
            if (!Array.isArray(data.riders)) {
                data.riders = [];
            }
            
            // Initialize auto-assignment settings if missing
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                data.autoAssignSettings = {
                    parameters: [
                        { id: 'ridersPerCoach', name: 'Riders per Coach', value: 6, priority: 1, enabled: true, requirement: true, type: 'number', min: 1, max: 20, description: 'Maximum riders per coach (capacity multiplier)' },
                        { id: 'minLeaderLevel', name: 'Minimum Leader Level', value: 2, priority: 2, enabled: true, requirement: true, type: 'number', min: 1, max: 3, description: 'Minimum coach level required to lead a group' },
                        { id: 'preferredGroupSize', name: 'Preferred Min/Max Total Group Size', valueMin: 4, valueMax: 10, priority: 3, enabled: true, requirement: false, type: 'range', min: 1, max: 30, description: 'Preferred group size range (may be exceeded to meet requirements)' },
                        { id: 'organizeByPace', name: 'Organize Groups by Pace', value: 2, priority: 4, enabled: true, requirement: false, type: 'number', min: 0, max: 10, description: 'Preferred maximum pace range within groups' }
                    ]
                };
                changed = true;
            } else {
                // Migrate old parameters to new structure
                const oldParams = data.autoAssignSettings.parameters;
                const newParams = [];
                
                // Check if migration needed (old structure doesn't have requirement field)
                const needsMigration = !oldParams.some(p => p.hasOwnProperty('requirement'));
                
                if (needsMigration) {
                    // Find ridersPerCoach
                    const ridersPerCoach = oldParams.find(p => p.id === 'ridersPerCoach') || { id: 'ridersPerCoach', name: 'Riders per Coach', value: 6, enabled: true };
                    newParams.push({ ...ridersPerCoach, priority: 1, requirement: true, type: 'number', min: 1, max: 20, description: 'Maximum riders per coach (capacity multiplier)' });
                    
                    // Find minLeaderLevel
                    const minLeaderLevel = oldParams.find(p => p.id === 'minLeaderLevel') || { id: 'minLeaderLevel', name: 'Minimum Leader Level', value: 2, enabled: true };
                    newParams.push({ ...minLeaderLevel, priority: 2, requirement: true, type: 'number', min: 1, max: 3, description: 'Minimum coach level required to lead a group' });
                    
                    // Combine min/max/preferred into single range parameter
                    const minGroupSize = oldParams.find(p => p.id === 'minGroupSize')?.value || 4;
                    const maxGroupSize = oldParams.find(p => p.id === 'maxGroupSize')?.value || 10;
                    newParams.push({ 
                        id: 'preferredGroupSize', 
                        name: 'Preferred Min/Max Total Group Size', 
                        valueMin: minGroupSize, 
                        valueMax: maxGroupSize, 
                        priority: 3, 
                        enabled: true, 
                        requirement: false, 
                        type: 'range', 
                        min: 1, 
                        max: 30, 
                        description: 'Preferred group size range (may be exceeded to meet requirements)' 
                    });
                    
                    // Convert maxFitnessSpread to organizeByPace
                    const maxFitnessSpread = oldParams.find(p => p.id === 'maxFitnessSpread') || { id: 'maxFitnessSpread', value: 2, enabled: true };
                    newParams.push({ 
                        id: 'organizeByPace', 
                        name: 'Organize Groups by Pace', 
                        value: maxFitnessSpread.value || 2, 
                        priority: 4, 
                        enabled: maxFitnessSpread.enabled !== false, 
                        requirement: false, 
                        type: 'number', 
                        min: 0, 
                        max: 10, 
                        description: 'Preferred maximum pace range within groups' 
                    });
                    
                    data.autoAssignSettings.parameters = newParams;
                    changed = true;
                }
            }

            data.coaches = data.coaches.map((coach, index) => {
                // Normalize phone number to 10 digits only
                let normalizedPhone = (coach.phone || '').replace(/\D/g, ''); // Remove all non-digits
                if (normalizedPhone.length !== 10) {
                    // If not 10 digits, generate a valid one based on index
                    normalizedPhone = `415555${(100 + index).toString().padStart(4, '0')}`;
                    changed = true;
                }
                
                // Support both old 'level' and new 'coachingLicenseLevel' fields
                const coachingLicenseLevel = coach.coachingLicenseLevel || coach.level || '1';
                
                // Preserve ALL existing fields, then override only the ones that need normalization
                const upgraded = {
                    ...coach, // Preserve all existing fields first
                    id: coach.id || Date.now(),
                    name: coach.name || '',
                    phone: normalizedPhone,
                    coachingLicenseLevel: coachingLicenseLevel,
                    level: coachingLicenseLevel, // Keep for backward compatibility
                    fitness: coach.fitness ? String(coach.fitness) : (coach.rideLevel ? String(convertRideLevelToFitness(coach.rideLevel)) : '5'),
                    photo: coach.photo || '',
                    notes: coach.notes || '',
                    // Ensure these fields exist (but don't overwrite if already present)
                    email: coach.email || '',
                    gender: coach.gender || '',
                    registered: coach.registered || '',
                    paid: coach.paid || '',
                    backgroundCheck: coach.backgroundCheck || '',
                    workPhone: coach.workPhone || '',
                    homePhone: coach.homePhone || ''
                };
                // Check if normalization actually changed anything
                // Since we use spread operator, all fields are preserved, so we only check normalized fields
                const originalPhone = (coach.phone || '').replace(/\D/g, '');
                const originalLevel = coach.coachingLicenseLevel || coach.level || '1';
                const originalFitness = coach.fitness ? String(coach.fitness) : (coach.rideLevel ? String(convertRideLevelToFitness(coach.rideLevel)) : '5');
                
                if (upgraded.phone !== originalPhone || 
                    upgraded.coachingLicenseLevel !== originalLevel ||
                    upgraded.fitness !== originalFitness) {
                    changed = true;
                }
                return upgraded;
            });

            const skillToFitness = {
                beginner: '2',
                intermediate: '4',
                advanced: '7',
                expert: '9'
            };

            data.riders = data.riders.map((rider, index) => {
                const normalizedGenderInput = (rider.gender || rider.sex || '').toString().trim().toUpperCase();
                const normalizedGender = ['M', 'F', 'NB'].includes(normalizedGenderInput) ? normalizedGenderInput : '';
                
                // Normalize phone number to 10 digits only
                let normalizedPhone = (rider.phone || '').replace(/\D/g, ''); // Remove all non-digits
                if (normalizedPhone.length !== 10) {
                    // If not 10 digits, generate a valid one based on index
                    normalizedPhone = `415556${(200 + index).toString().padStart(4, '0')}`;
                    changed = true;
                }
                
                // Preserve ALL existing fields, then override only the ones that need normalization
                const upgraded = {
                    ...rider, // Preserve all existing fields first
                    id: rider.id || Date.now(),
                    name: rider.name || '',
                    phone: normalizedPhone,
                    grade: normalizeGradeValue(rider.grade || '9th'),
                    racingGroup: rider.racingGroup || 'Freshman',
                    fitness: rider.fitness
                        ? String(rider.fitness)
                        : rider.abilityRanking
                            ? String(mapAbilityToFitness(rider.abilityRanking))
                            : (skillToFitness[rider.skillLevel] || '5'),
                    photo: rider.photo || '',
                    notes: rider.notes || '',
                    gender: normalizedGender,
                    // keep legacy skillLevel if present for compatibility
                    skillLevel: rider.skillLevel || undefined
                };
                if (!rider.fitness && (rider.abilityRanking || rider.skillLevel)) {
                    changed = true;
                }
                // Check if normalization actually changed anything
                // Since we use spread operator, all fields are preserved, so we only check normalized fields
                const originalPhone = (rider.phone || '').replace(/\D/g, '');
                const originalGrade = normalizeGradeValue(rider.grade || '9th');
                const originalRacingGroup = rider.racingGroup || 'Freshman';
                const originalFitness = rider.fitness ? String(rider.fitness) : (rider.abilityRanking ? String(mapAbilityToFitness(rider.abilityRanking)) : (skillToFitness[rider.skillLevel] || '5'));
                const originalGender = normalizedGender;
                
                if (upgraded.phone !== originalPhone ||
                    upgraded.grade !== originalGrade ||
                    upgraded.racingGroup !== originalRacingGroup ||
                    upgraded.fitness !== originalFitness ||
                    upgraded.gender !== originalGender) {
                    changed = true;
                }
                return upgraded;
            });

            // Initialize empty arrays if they don't exist
            if (!Array.isArray(data.riders)) {
                data.riders = [];
                changed = true;
            }
            if (!Array.isArray(data.coaches)) {
                data.coaches = [];
                changed = true;
            }

            if (!Array.isArray(data.rides)) {
                data.rides = [];
                changed = true;
            } else {
                data.rides = data.rides.map(ride => {
                    const { ride: normalizedRide, changed: rideChanged } = normalizeRideStructure(ride);
                    if (rideChanged) {
                        changed = true;
                    }
                    return normalizedRide;
                });
            }

            const previousSeasonState = JSON.stringify(data.seasonSettings || {});
            if (!data.seasonSettings || typeof data.seasonSettings !== 'object') {
                data.seasonSettings = buildDefaultSeasonSettings();
            }

            const normalizedPractices = Array.isArray(data.seasonSettings.practices)
                ? data.seasonSettings.practices
                    .map(practice => {
                        if (!practice || typeof practice !== 'object') {
                            return null;
                        }
                        
                        // Handle single practices (with specificDate) differently from recurring practices
                        const isSinglePractice = practice.specificDate !== null && practice.specificDate !== undefined;
                        
                        if (isSinglePractice) {
                            // Single practice: require specificDate and time
                            const time = normalizeTimeValue(practice.time || practice.startTime || '');
                            if (!time || !practice.specificDate) {
                                return null;
                            }
                            
                            return {
                                id: practice.id || generateId(),
                                dayOfWeek: null,
                                specificDate: practice.specificDate,
                                time: time,
                                endTime: normalizeTimeValue(practice.endTime || '') || '',
                                description: practice.description || '',
                                meetLocation: practice.meetLocation || '',
                                locationLat: practice.locationLat || null,
                                locationLng: practice.locationLng || null,
                                rosterFilter: practice.rosterFilter || null,
                                excludeFromPlanner: practice.excludeFromPlanner || false
                            };
                        } else {
                            // Recurring practice: require dayOfWeek and time
                            const normalized = normalizePracticeEntry(practice);
                            if (!normalized) return null;
                            
                            // Preserve ALL fields from the original practice
                            return {
                                id: practice.id || normalized.id || generateId(),
                                dayOfWeek: normalized.dayOfWeek,
                                specificDate: null,
                                time: normalized.time,
                                endTime: practice.endTime || normalized.endTime || '',
                                description: practice.description || '',
                                meetLocation: practice.meetLocation || '',
                                locationLat: practice.locationLat || null,
                                locationLng: practice.locationLng || null,
                                rosterFilter: practice.rosterFilter || null,
                                excludeFromPlanner: practice.excludeFromPlanner || false
                            };
                        }
                    })
                    .filter(Boolean)
                : [];

            // Keep practices in the order they were created (no sorting)

            const normalizedSeason = {
                startDate: data.seasonSettings.startDate || '',
                endDate: data.seasonSettings.endDate || '',
                practices: normalizedPractices,
                // Preserve scale settings and other fields
                fitnessScale: data.seasonSettings.fitnessScale !== undefined ? data.seasonSettings.fitnessScale : 6,
                skillsScale: data.seasonSettings.fitnessScale !== undefined ? data.seasonSettings.fitnessScale : 6,
                climbingScale: data.seasonSettings.fitnessScale !== undefined ? data.seasonSettings.fitnessScale : 6,
                paceScaleOrder: normalizePaceScaleOrder(data.seasonSettings.paceScaleOrder),
                groupPaceOrder: normalizeGroupPaceOrder(data.seasonSettings.groupPaceOrder)
            };
            
            // Preserve any other fields from the original seasonSettings (like Google Sheet URLs, etc.)
            Object.keys(data.seasonSettings).forEach(key => {
                if (!normalizedSeason.hasOwnProperty(key)) {
                    normalizedSeason[key] = data.seasonSettings[key];
                }
            });

            // Only update if the normalized version is actually different
            // This prevents unnecessary overwrites when data is already correct
            const normalizedSeasonStr = JSON.stringify(normalizedSeason);
            if (normalizedSeasonStr !== previousSeasonState) {
                changed = true;
                // Preserve all existing fields in seasonSettings (like csvFieldMappings, fitnessScale, etc.)
                data.seasonSettings = {
                    ...data.seasonSettings,
                    ...normalizedSeason
                };
            }
            // If unchanged, keep the original data.seasonSettings (preserves any extra fields)

            if (changed) {
                saveData();
            }
        }

        function handleFileChange(inputId, labelId) {
            const input = document.getElementById(inputId);
            const label = document.getElementById(labelId);
            if (!label) return;
            const defaultText = label.dataset.default || 'No file selected';

            if (input && input.files && input.files.length > 0) {
                label.textContent = input.files[0].name;
            } else {
                label.textContent = defaultText;
            }
        }

        function readPhotoFile(inputId) {
            return new Promise(resolve => {
                const input = document.getElementById(inputId);
                if (!input || !input.files || input.files.length === 0) {
                    resolve('');
                    return;
                }

                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }

        // Data persistence functions (using localStorage)
        // STORAGE_KEY, OLD_STORAGE_KEY, DEV_MODE_STORAGE_KEY are in app-state.js

        // Show visible error alert when database saves fail
        function showSaveError(title, message, error) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            const fullMessage = `${message}\n\nError details: ${errorMsg}\n\nYour changes were NOT saved. Please try again or contact support if the problem persists.`;
            alert(`⚠️ ${title}\n\n${fullMessage}`);
            console.error(`Save error - ${title}:`, error);
        }

        async function saveData() {
            if (isReadOnlyMode) {
                console.warn('Read-only mode: saveData blocked.');
                return;
            }
            if (isDeveloperMode) {
                // In developer mode, persist all changes to localStorage only (no Supabase writes)
                try {
                    const dataToSave = {
                        riders: data.riders,
                        coaches: data.coaches,
                        rides: data.rides,
                        routes: data.routes,
                        races: data.races || [],
                        currentRide: data.currentRide,
                        seasonSettings: data.seasonSettings,
                        autoAssignSettings: data.autoAssignSettings,
                        coachRoles: data.coachRoles || [],
                        riderRoles: data.riderRoles || []
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                    console.log('Developer mode: data saved to localStorage only (no Supabase write).');
                } catch (error) {
                    console.error('Developer mode: error saving to localStorage:', error);
                    alert('⚠️ Developer mode is enabled, but saving to local storage failed. Your changes may not persist.');
                }
                return;
            }
            // Check if user is authenticated - only save to Supabase for authenticated users
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser && typeof updateSeasonSettings === 'function' && typeof updateAutoAssignSettings === 'function') {
                // Authenticated user - save to Supabase only (no localStorage fallback)
                try {
                    // Check if user has coach-admin role before saving settings
                    const hasPermission = typeof hasRole === 'function' ? hasRole('coach-admin') : false;
                    
                    // Save season settings (including timeEstimationSettings) - only if user has permission
                    if (data.seasonSettings && hasPermission) {
                        try {
                            const seasonData = {
                                id: 'current',
                                start_date: data.seasonSettings.startDate || null,
                                end_date: data.seasonSettings.endDate || null,
                                practices: data.seasonSettings.practices || [],
                                fitnessScale: data.seasonSettings.fitnessScale !== undefined ? data.seasonSettings.fitnessScale : 6,
                                climbingScale: data.seasonSettings.climbingScale !== undefined ? data.seasonSettings.climbingScale : 6,
                                skillsScale: data.seasonSettings.skillsScale !== undefined ? data.seasonSettings.skillsScale : 6,
                                paceScaleOrder: normalizePaceScaleOrder(data.seasonSettings.paceScaleOrder),
                                groupPaceOrder: normalizeGroupPaceOrder(data.seasonSettings.groupPaceOrder),
                                csvFieldMappings: data.seasonSettings.csvFieldMappings || {},
                                coachRoles: Array.isArray(data.coachRoles) ? data.coachRoles : [],
                                riderRoles: Array.isArray(data.riderRoles) ? data.riderRoles : [],
                                teamName: data.seasonSettings.teamName || '',
                                timeEstimationSettings: data.timeEstimationSettings || {
                                    fastSpeedBase: 12.5,
                                    slowSpeedBase: 10,
                                    fastSpeedMin: 5.5,
                                    slowSpeedMin: 4,
                                    elevationAdjustment: 0.5,
                                    lengthAdjustmentFactor: 0.1
                                }
                            };
                            const result = await updateSeasonSettings(seasonData);
                        } catch (error) {
                            // Handle RLS errors gracefully - user may not have coach-admin role yet
                            if (error.message && error.message.includes('row-level security')) {
                                console.warn('User does not have permission to save season settings. They may need to be assigned the coach-admin role.');
                                // Don't show error to user - this is expected for new users without roles
                            } else {
                                throw error; // Re-throw other errors
                            }
                        }
                    } else if (data.seasonSettings && !hasPermission) {
                        console.warn('User does not have coach-admin role - skipping season settings save');
                    }
                    
                    // Save auto-assign settings - only if user has permission
                    if (data.autoAssignSettings && data.autoAssignSettings.parameters && hasPermission) {
                        try {
                            const autoAssignData = {
                                id: 'current',
                                parameters: data.autoAssignSettings.parameters
                            };
                            await updateAutoAssignSettings(autoAssignData);
                        } catch (error) {
                            // Handle RLS errors gracefully
                            if (error.message && error.message.includes('row-level security')) {
                                console.warn('User does not have permission to save auto-assign settings.');
                            } else {
                                throw error; // Re-throw other errors
                            }
                        }
                    }
                    
                    // Save races - only if user has permission
                    if (typeof upsertAllRaces === 'function' && Array.isArray(data.races) && hasPermission) {
                        try {
                            await upsertAllRaces(data.races);
                        } catch (error) {
                            // Handle RLS errors gracefully
                            if (error.message && error.message.includes('row-level security')) {
                                console.warn('User does not have permission to save races.');
                            } else {
                                throw error; // Re-throw other errors
                            }
                        }
                    }
                    
                } catch (error) {
                    // Handle network errors more gracefully
                    const isNetworkError = error?.message?.includes('Failed to fetch') || 
                                         error?.message?.includes('NetworkError') ||
                                         error?.name === 'TypeError' && error?.message?.includes('fetch');
                    
                    if (isNetworkError) {
                        console.warn('Network error saving to Supabase, falling back to localStorage:', error);
                        // Fallback to localStorage if network fails
                        try {
                            const dataToSave = {
                                riders: data.riders,
                                coaches: data.coaches,
                                rides: data.rides,
                                routes: data.routes,
                                races: data.races || [],
                                currentRide: data.currentRide,
                                seasonSettings: data.seasonSettings,
                                autoAssignSettings: data.autoAssignSettings,
                                coachRoles: data.coachRoles || [],
                                riderRoles: data.riderRoles || []
                            };
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                            console.log('Data saved to localStorage (network fallback)');
                            // Don't show error for network issues - just use localStorage fallback
                            return;
                        } catch (localError) {
                            // If localStorage also fails, show error
                            showSaveError(
                                'Failed to Save Settings',
                                'An error occurred while saving your settings. Network error and local storage both failed.',
                                error
                            );
                            throw error;
                        }
                    } else {
                        // Show error for other types of errors
                    showSaveError(
                        'Failed to Save Settings',
                        'An error occurred while saving your settings to the database.',
                        error
                    );
                    throw error; // Re-throw to prevent silent failures
                    }
                }
            } else {
                // Not authenticated - use localStorage (edge case, should rarely happen)
                // For simplified login users, this is expected (they can read from Supabase but save to localStorage)
                const hasSimplifiedLogin = simplifiedLoginInfo !== null;
                if (!hasSimplifiedLogin) {
                    if (!client || !currentUser) {
                        console.warn('User not authenticated - saving to localStorage as fallback');
                    } else {
                        console.warn('Database functions not available - saving to localStorage as fallback');
                    }
                } else {
                    // Simplified login user - silently save to localStorage (expected behavior)
                    console.log('Simplified login user - saving to localStorage (read-only mode)');
                }
                
                try {
                    const dataToSave = {
                        riders: data.riders,
                        coaches: data.coaches,
                        rides: data.rides,
                        routes: data.routes,
                        races: data.races || [],
                        currentRide: data.currentRide,
                        seasonSettings: data.seasonSettings,
                        autoAssignSettings: data.autoAssignSettings,
                        coachRoles: data.coachRoles || [],
                        riderRoles: data.riderRoles || []
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                    console.log('Data saved to localStorage (fallback mode)');
                } catch (error) {
                    console.error('Error saving to localStorage:', error);
                    alert('⚠️ Unable to save data. Local storage may be full. Please log in to save to the database.');
                }
            }
        }

        // Load data from Supabase (authenticated users only - no localStorage fallback)
        async function loadDataFromSupabase() {
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const hasSimplifiedLogin = simplifiedLoginInfo !== null;
            
            if (!client) {
                throw new Error('Supabase client not available');
            }
            
            // Allow loading for authenticated users OR simplified login users
            // Simplified login users can read data if RLS policies allow
            if (!currentUser && !hasSimplifiedLogin) {
                throw new Error('Not authenticated - cannot load from Supabase');
            }
            
            if (typeof getAllRiders === 'undefined' || typeof getAllCoaches === 'undefined') {
                throw new Error('Database functions not available');
            }
            
            try {
                // For simplified login users, skip settings that require authentication
                // They only need riders, coaches, rides, and routes for the assignments view
                const loadPromises = [
                    getAllRiders().catch(err => { console.error('Error loading riders:', err); return []; }),
                    getAllCoaches().catch(err => { console.error('Error loading coaches:', err); return []; }),
                    getAllRides().catch(err => { console.error('Error loading rides:', err); return []; }),
                    getAllRoutes().catch(err => { console.error('Error loading routes:', err); return []; })
                ];
                
                // Only load settings if user is fully authenticated (not simplified login)
                let seasonSettings = null;
                let autoAssignSettings = null;
                if (currentUser) {
                    // Fully authenticated user - load settings
                    loadPromises.push(
                        getSeasonSettings().catch(err => { 
                            // Silently handle 406 errors for simplified login users
                            if (err?.code !== 'PGRST301' && err?.status !== 406) {
                                console.error('Error loading season settings:', err); 
                            }
                            return null; 
                        }),
                        getAutoAssignSettings().catch(err => { 
                            // Silently handle 406 errors for simplified login users
                            if (err?.code !== 'PGRST301' && err?.status !== 406) {
                                console.error('Error loading auto-assign settings:', err); 
                            }
                            return null; 
                        })
                    );
                } else {
                    // Simplified login user - skip settings (not needed for assignments view)
                    loadPromises.push(Promise.resolve(null), Promise.resolve(null));
                }
                
                // Load races if function is available
                loadPromises.push(
                    typeof getAllRaces === 'function' 
                        ? getAllRaces().catch(err => { console.error('Error loading races in Promise.all:', err); return []; }) 
                        : Promise.resolve([])
                );

                // Load scheduled absences
                loadPromises.push(
                    typeof loadScheduledAbsences === 'function'
                        ? loadScheduledAbsences().catch(err => { console.error('Error loading scheduled absences:', err); return []; })
                        : Promise.resolve([])
                );
                
                const [riders, coaches, rides, routes, seasonSettingsResult, autoAssignSettingsResult, races, scheduledAbsences] = await Promise.all(loadPromises);
                seasonSettings = seasonSettingsResult;
                autoAssignSettings = autoAssignSettingsResult;
                
                // Map data to app structure
                data.riders = riders || [];
                data.coaches = coaches || [];
                data.routes = routes || [];
                data.scheduledAbsences = scheduledAbsences || [];
                
                // Normalize rides - keep only valid coach IDs if roster is loaded
                const validCoachIds = new Set((data.coaches || []).map(coach => {
                    const id = typeof coach.id === 'string' ? parseInt(coach.id, 10) : coach.id;
                    return Number.isFinite(id) ? id : coach.id;
                }));
                const hasCoachRoster = validCoachIds.size > 0;
                data.rides = (rides || []).map(ride => {
                    const normalizedRide = { ...ride };
                    if (Array.isArray(normalizedRide.availableCoaches)) {
                        normalizedRide.availableCoaches = normalizedRide.availableCoaches
                            .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                            .filter(id => Number.isFinite(id) && (!hasCoachRoster || validCoachIds.has(id)));
                        normalizedRide.availableCoaches = Array.from(new Set(normalizedRide.availableCoaches)); // Deduplicate
                    }
                    if (Array.isArray(normalizedRide.availableRiders)) {
                        normalizedRide.availableRiders = normalizedRide.availableRiders
                            .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                            .filter(id => Number.isFinite(id));
                    }
                    if (!normalizedRide.rescheduledFrom && (normalizedRide.rescheduled_from || normalizedRide.settings?.rescheduledFrom)) {
                        const val = normalizedRide.rescheduled_from || normalizedRide.settings?.rescheduledFrom;
                        normalizedRide.rescheduledFrom = typeof val === 'string' ? val.substring(0, 10) : val;
                    }
                    return normalizedRide;
                });
                // Debug: Log deleted rides loaded from Supabase
                const deletedRides = data.rides.filter(r => r.deleted);
                
                // Map season settings (getSeasonSettings already returns app format with fitnessScale and skillsScale)
                if (seasonSettings) {
                    if (false) console.log('Season settings from Supabase:', { 
                        fitnessScale: seasonSettings.fitnessScale, 
                        skillsScale: seasonSettings.skillsScale,
                        paceScaleOrder: seasonSettings.paceScaleOrder,
                        groupPaceOrder: seasonSettings.groupPaceOrder,
                        hasFitnessScale: 'fitnessScale' in seasonSettings,
                        hasSkillsScale: 'skillsScale' in seasonSettings
                    });
                    // Use ONLY Supabase data (no localStorage preservation)
                    // Convert null/undefined to empty string for consistency
                    const startDate = seasonSettings.startDate || seasonSettings.start_date || '';
                    const endDate = seasonSettings.endDate || seasonSettings.end_date || '';
                    data.seasonSettings = {
                        startDate: startDate,
                        endDate: endDate,
                        practices: seasonSettings.practices || [],
                        fitnessScale: seasonSettings.fitnessScale !== undefined && seasonSettings.fitnessScale !== null ? seasonSettings.fitnessScale : 6,
                        climbingScale: seasonSettings.climbingScale !== undefined && seasonSettings.climbingScale !== null ? seasonSettings.climbingScale : 6,
                        skillsScale: seasonSettings.skillsScale !== undefined && seasonSettings.skillsScale !== null ? seasonSettings.skillsScale : 6,
                        paceScaleOrder: seasonSettings.paceScaleOrder || 'fastest_to_slowest',
                        groupPaceOrder: seasonSettings.groupPaceOrder || 'fastest_to_slowest',
                        csvFieldMappings: seasonSettings.csvFieldMappings || seasonSettings.csv_field_mappings || {},
                        teamName: seasonSettings.teamName || ''
                    };
                    if (seasonSettings.lastOpenedRideId !== undefined && seasonSettings.lastOpenedRideId !== null) {
                        data.seasonSettings.lastOpenedRideId = seasonSettings.lastOpenedRideId;
                    }
                    // Restore last-opened practice so it persists between sessions and across users
                    const lastId = data.seasonSettings.lastOpenedRideId;
                    if (lastId != null && data.rides && data.rides.length > 0) {
                        const ride = data.rides.find(r => String(r.id) === String(lastId) && !r.deleted);
                        if (ride) data.currentRide = ride.id;
                    }
                    
                    // Load coachRoles and riderRoles from season settings
                    if (Array.isArray(seasonSettings.coachRoles)) {
                        data.coachRoles = seasonSettings.coachRoles;
                    } else {
                        data.coachRoles = [];
                    }
                    if (Array.isArray(seasonSettings.riderRoles)) {
                        data.riderRoles = seasonSettings.riderRoles;
                    } else {
                        data.riderRoles = [];
                    }
                    
                    // Map timeEstimationSettings from seasonSettings
                    if (seasonSettings.timeEstimationSettings) {
                        data.timeEstimationSettings = seasonSettings.timeEstimationSettings;
                    } else {
                        // Provide defaults if not present
                        data.timeEstimationSettings = {
                            fastSpeedBase: 12.5,
                            slowSpeedBase: 10,
                            fastSpeedMin: 5.5,
                            slowSpeedMin: 4,
                            elevationAdjustment: 0.5,
                            lengthAdjustmentFactor: 0.1
                        };
                    }
                    // Auto-migrate if old per-skill scales differ
                    if (typeof migrateToUnifiedScale === 'function') migrateToUnifiedScale();
                } else {
                    console.log('No season settings from Supabase - using defaults');
                    data.seasonSettings = {
                        startDate: '',
                        endDate: '',
                        practices: [],
                        fitnessScale: 6,
                        skillsScale: 6,
                        climbingScale: 6,
                        paceScaleOrder: 'fastest_to_slowest',
                        groupPaceOrder: 'fastest_to_slowest'
                    };
                    // Initialize timeEstimationSettings with defaults if no season settings
                    data.timeEstimationSettings = {
                        fastSpeedBase: 12.5,
                        slowSpeedBase: 10,
                        fastSpeedMin: 5.5,
                        slowSpeedMin: 4,
                        elevationAdjustment: 0.5,
                        lengthAdjustmentFactor: 0.1
                    };
                }
                
                // Map auto-assign settings
                if (autoAssignSettings && autoAssignSettings.parameters) {
                    data.autoAssignSettings = {
                        parameters: autoAssignSettings.parameters
                    };
                }
                
                // Map races
                if (Array.isArray(races)) {
                    data.races = races;
                } else {
                    data.races = [];
                }
                
                if (false) console.log('Data loaded from Supabase:', {
                    riders: data.riders.length,
                    coaches: data.coaches.length,
                    rides: data.rides.length,
                    routes: data.routes.length,
                    races: data.races.length,
                    seasonSettings: !!data.seasonSettings,
                    autoAssignSettings: !!data.autoAssignSettings,
                    timeEstimationSettings: !!data.timeEstimationSettings
                });
                
                // Update scale inputs immediately after data loads (before DOMContentLoaded handler runs)
                updateScaleInputsFromData();
                
                // Update season settings UI (including date range button) after data loads
                loadSeasonSettings();
                
                // Apply team name from settings to header (Supabase → localStorage → HTML default)
                {
                    let tn = (data.seasonSettings && data.seasonSettings.teamName) || '';
                    if (!tn) {
                        try { tn = localStorage.getItem(TEAM_NAME_STORAGE_KEY) || ''; } catch (e) {}
                    }
                    if (tn) {
                        applyTeamName(tn);
                        if (data.seasonSettings) data.seasonSettings.teamName = tn;
                    } else {
                        const hdr = document.getElementById('header-team-name');
                        if (hdr) hdr.style.visibility = 'visible';
                    }
                }
            } catch (error) {
                console.error('Error loading from Supabase:', error);
                // Do NOT fallback to localStorage - show error instead
                showSaveError(
                    'Failed to Load Data',
                    'An error occurred while loading data from the database. Please refresh the page or contact support if the problem persists.',
                    error
                );
                throw error; // Re-throw to prevent continuation with empty data
            }
        }

        function loadData() {
            // Check if user is authenticated - if so, don't load from localStorage
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser) {
                // Authenticated user - localStorage should NOT be used
                // Silently return (this is expected when renderRides() calls loadData())
                return;
            }
            
            try {
                // First, try to load from new key
                let stored = localStorage.getItem(STORAGE_KEY);
                
                // If not found, check for old key and migrate
                if (!stored) {
                    const oldStored = localStorage.getItem(OLD_STORAGE_KEY);
                    if (oldStored) {
                        console.log('Migrating data from old localStorage key...');
                        // Copy old data to new key
                        localStorage.setItem(STORAGE_KEY, oldStored);
                        stored = oldStored;
                        // Optionally remove old key (commented out to be safe)
                        // localStorage.removeItem(OLD_STORAGE_KEY);
                    }
                }
                
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // Merge with existing data structure - preserve ALL fields
                    if (parsed.riders) data.riders = parsed.riders;
                    if (parsed.coaches) data.coaches = parsed.coaches;
                    if (parsed.rides) data.rides = parsed.rides;
                    if (parsed.routes) data.routes = parsed.routes;
                    if (Array.isArray(parsed.races)) data.races = parsed.races;
                    if (parsed.currentRide !== undefined) data.currentRide = parsed.currentRide;
                    if (parsed.seasonSettings) {
                        // Preserve the entire seasonSettings object
                        data.seasonSettings = parsed.seasonSettings;
                    }
                    if (parsed.autoAssignSettings) data.autoAssignSettings = parsed.autoAssignSettings;
                    if (parsed.timeEstimationSettings) data.timeEstimationSettings = parsed.timeEstimationSettings;
                    if (Array.isArray(parsed.coachRoles)) data.coachRoles = parsed.coachRoles;
                    else if (!data.coachRoles) data.coachRoles = [];
                    if (Array.isArray(parsed.riderRoles)) data.riderRoles = parsed.riderRoles;
                    else if (!data.riderRoles) data.riderRoles = [];
                    
                    // Ensure scale settings exist
                    if (!data.seasonSettings) {
                        data.seasonSettings = buildDefaultSeasonSettings();
                    }
                    if (data.seasonSettings.fitnessScale === undefined || data.seasonSettings.fitnessScale === null) {
                        data.seasonSettings.fitnessScale = 6;
                    }
                    // Unify: ensure climbing & skills match the fitnessScale
                    data.seasonSettings.skillsScale  = data.seasonSettings.fitnessScale;
                    data.seasonSettings.climbingScale = data.seasonSettings.fitnessScale;

                    // Migrate old per-skill ratings to unified scale
                    if (typeof migrateToUnifiedScale === 'function') migrateToUnifiedScale();

                    function updateScaleInputs() {
                        const scaleInput   = document.getElementById('unified-scale');
                        const scaleDisplay = document.getElementById('unified-scale-display');
                        const saved = data.seasonSettings?.fitnessScale;
                        if (scaleInput && saved !== undefined && saved !== null) {
                            scaleInput.value = saved;
                            scaleInput.setAttribute('value', saved);
                            if (scaleDisplay) scaleDisplay.textContent = saved;
                        }
                        updateBikeSkillsDescriptions();
                        updateClimbingDescriptions();
                        updateInputMaxAttributes();
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', updateScaleInputs);
                    } else {
                        setTimeout(updateScaleInputs, 100);
                    }
                    setTimeout(updateScaleInputs, 500);
                    setTimeout(updateScaleInputs, 1000);
                    
                    console.log('Data loaded from localStorage:', {
                        riders: data.riders.length,
                        coaches: data.coaches.length,
                        rides: data.rides.length,
                        routes: data.routes.length,
                        seasonSettings: data.seasonSettings ? {
                            startDate: data.seasonSettings.startDate,
                            endDate: data.seasonSettings.endDate,
                            practicesCount: data.seasonSettings.practices?.length || 0,
                            fitnessScale: data.seasonSettings.fitnessScale,
                            skillsScale: data.seasonSettings.skillsScale
                        } : null
                    });
                } else {
                    console.log('No data found in localStorage');
                }
            } catch (error) {
                console.error('Error loading from localStorage:', error);
            }
        }

        // Save rider to database or localStorage
        async function saveRiderToDB(riderData) {
            if (isReadOnlyMode) {
                console.warn('Read-only mode: saveRiderToDB blocked.');
                return;
            }
            if (isDeveloperMode) {
                console.log('Developer mode: skipping Supabase rider save for', riderData && riderData.id);
                return;
            }
            // Check if database functions are available and user is authenticated
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser && typeof updateRider !== 'undefined' && typeof createRider !== 'undefined') {
                // Authenticated user - save to Supabase only
                try {
                    // Map app fields to database fields
                    const dbData = {
                        name: riderData.name,
                        phone: riderData.phone || null,
                        email: riderData.email || null,
                        grade: riderData.grade || null,
                        gender: riderData.gender || null,
                        racing_group: riderData.racingGroup || riderData.racing_group || null,
                        fitness: riderData.fitness || '5',
                        skills: riderData.skills || '3',
                        photo: riderData.photo || null,
                        notes: riderData.notes || null
                    };
                    
                    if (riderData.id && data.riders.find(r => r.id === riderData.id)) {
                        // Update existing - pass app format data (with racingGroup) not db format
                        const updated = await updateRider(riderData.id, riderData);
                        // Update local data (merge with existing fields)
                        const index = data.riders.findIndex(r => r.id === riderData.id);
                        if (index !== -1) {
                            data.riders[index] = { ...data.riders[index], ...riderData, ...updated };
                        }
                    } else {
                        // Create new
                        const created = await createRider(riderData);
                        // Merge with local extra fields and add to local data
                        const newRider = { ...riderData, ...created };
                        data.riders.push(newRider);
                        return newRider;
                    }
                    return;
                } catch (error) {
                    showSaveError(
                        'Failed to Save Rider',
                        `An error occurred while saving ${riderData.name || 'the rider'}.`,
                        error
                    );
                    throw error; // Re-throw to prevent silent failures
                }
            } else {
                // Not authenticated - use localStorage (edge case)
                console.warn('User not authenticated - saving rider to localStorage as fallback');
                if (riderData.id && data.riders.find(r => r.id === riderData.id)) {
                    // Update existing
                    const index = data.riders.findIndex(r => r.id === riderData.id);
                    if (index !== -1) {
                        data.riders[index] = { ...data.riders[index], ...riderData };
                    }
                } else {
                    // Create new
                    const newRider = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        ...riderData
                    };
                    data.riders.push(newRider);
                    return newRider;
                }
                await saveData();
            }
        }

        // Save coach to database or localStorage
        async function saveCoachToDB(coachData) {
            if (isReadOnlyMode) {
                console.warn('Read-only mode: saveCoachToDB blocked.');
                return;
            }
            if (isDeveloperMode) {
                console.log('Developer mode: skipping Supabase coach save for', coachData && coachData.id);
                return;
            }
            // Check if database functions are available and user is authenticated
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser && typeof updateCoach !== 'undefined' && typeof createCoach !== 'undefined') {
                // Authenticated user - save to Supabase only
                try {
                    // Map app fields to database fields (database supports: name, phone, email, level, fitness, skills, photo, notes, user_id)
                    const dbData = {
                        name: coachData.name,
                        phone: coachData.phone || null,
                        email: coachData.email || null,
                        level: coachData.coachingLicenseLevel || coachData.level || '1',
                        fitness: coachData.fitness || '5',
                        skills: coachData.skills || '3',
                        photo: coachData.photo || null,
                        notes: coachData.notes || null
                    };
                    
                    if (coachData.id && data.coaches.find(c => c.id === coachData.id)) {
                        // Update existing
                        const updated = await updateCoach(coachData.id, coachData);
                        // Update local data
                        const index = data.coaches.findIndex(c => c.id === coachData.id);
                        if (index !== -1) {
                            // Merge database response with local extra fields
                            data.coaches[index] = { ...data.coaches[index], ...coachData, ...updated };
                        }
                    } else {
                        // Create new
                        const created = await createCoach(coachData);
                        // Merge with local extra fields and add to local data
                        const newCoach = { ...coachData, ...created };
                        data.coaches.push(newCoach);
                        return newCoach;
                    }
                    return;
                } catch (error) {
                    showSaveError(
                        'Failed to Save Coach',
                        `An error occurred while saving ${coachData.name || 'the coach'}.`,
                        error
                    );
                    throw error; // Re-throw to prevent silent failures
                }
            } else {
                // Not authenticated - use localStorage (edge case)
                console.warn('User not authenticated - saving coach to localStorage as fallback');
                if (coachData.id && data.coaches.find(c => c.id === coachData.id)) {
                    // Update existing
                    const index = data.coaches.findIndex(c => c.id === coachData.id);
                    if (index !== -1) {
                        data.coaches[index] = { ...data.coaches[index], ...coachData };
                    }
                } else {
                    // Create new
                    const newCoach = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        ...coachData
                    };
                    data.coaches.push(newCoach);
                    return newCoach;
                }
                await saveData();
            }
        }

        // Debounced ride save function (using localStorage)
        window.rideSaveTimeout = null;
        function debouncedSaveRide(ride) {
            if (!ride || !ride.id) return;
            
            clearTimeout(window.rideSaveTimeout);
            window.rideSaveTimeout = setTimeout(() => {
                saveRideToDB(ride);
            }, 500); // Save 0.5 seconds after last change
        }

        // Save ride to database or localStorage
        async function saveRideToDB(rideData) {
            if (isReadOnlyMode) {
                console.warn('Read-only mode: saveRideToDB blocked.');
                return;
            }
            // STEP 1: Always update local data immediately (synchronous)
            // This ensures data is available even if navigation happens before async save completes
            if (rideData.id && data.rides.find(r => r.id === rideData.id)) {
                // Update existing - preserve all fields
                const index = data.rides.findIndex(r => r.id === rideData.id);
                if (index !== -1) {
                    // Merge to preserve all existing fields
                    data.rides[index] = { ...data.rides[index], ...rideData };
                }
            } else {
                // Create new
                const newRide = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    date: rideData.date,
                    time: rideData.time || '',
                    endTime: rideData.endTime || '',
                    description: rideData.description || '',
                    meetLocation: rideData.meetLocation || '',
                    locationLat: rideData.locationLat != null ? rideData.locationLat : null,
                    locationLng: rideData.locationLng != null ? rideData.locationLng : null,
                    goals: rideData.goals || null,
                    availableCoaches: rideData.availableCoaches || [],
                    availableRiders: rideData.availableRiders || [],
                    assignments: rideData.assignments || {},
                    groups: rideData.groups || [],
                    cancelled: rideData.cancelled || false,
                    publishedGroups: rideData.publishedGroups || false,
                    ...rideData // Include any other fields from rideData
                };
                data.rides.push(newRide);
            }
            
            // STEP 2: Always save to localStorage immediately (synchronous backup)
            // This ensures data persists even if Supabase save fails or user navigates away
            try {
                const dataToSave = {
                    riders: data.riders,
                    coaches: data.coaches,
                    rides: data.rides,
                    routes: data.routes,
                    currentRide: data.currentRide,
                    seasonSettings: data.seasonSettings,
                    autoAssignSettings: data.autoAssignSettings,
                    sampleVersion: data.sampleVersion,
                    coachRoles: data.coachRoles || [],
                    riderRoles: data.riderRoles || []
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (error) {
                console.error('Error saving to localStorage:', error);
                // Continue even if localStorage save fails - try Supabase
            }
            
            // STEP 3: Save to Supabase if authenticated (async)
            if (isDeveloperMode) {
                console.log('Developer mode: skipping Supabase ride save for', rideData && rideData.id);
                return;
            }
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser && typeof updateRide !== 'undefined' && typeof createRide !== 'undefined') {
                // Authenticated user - save to Supabase (single schema in database.js)
                // Pass app-shaped rideData so updateRide/buildRideDbData build payload once (availableRiders etc. preserved)
                try {
                    const shouldCreateInDb = rideData.isPersisted !== true;
                    if (!shouldCreateInDb && rideData.id && data.rides.find(r => r.id === rideData.id)) {
                        // Update existing
                        console.log('🟢 saveRideToDB: Sending to Supabase', { rideId: rideData.id, availableRidersLength: Array.isArray(rideData.availableRiders) ? rideData.availableRiders.length : 0, availableRidersFirst5: (rideData.availableRiders || []).slice(0, 5) });
                        const updated = await updateRide(rideData.id, rideData);
                        // Update local data (merge with existing fields)
                        // Use availableCoaches from rideData (not from updated) to avoid corrupted timestamp IDs
                        const index = data.rides.findIndex(r => r.id === rideData.id);
                        if (index !== -1) {
                            const merged = { ...data.rides[index], ...rideData, ...updated };
                            // Override with rideData so DB response never overwrites what we just saved (e.g. group colorName)
                            if (rideData.availableCoaches !== undefined) {
                                merged.availableCoaches = rideData.availableCoaches;
                            }
                            if (rideData.availableRiders !== undefined) {
                                merged.availableRiders = rideData.availableRiders;
                            }
                            if (rideData.groups !== undefined) {
                                merged.groups = rideData.groups;
                            }
                            // Preserve location fields from rideData
                            if (rideData.meetLocation !== undefined) {
                                merged.meetLocation = rideData.meetLocation;
                            }
                            if (rideData.locationLat !== undefined) {
                                merged.locationLat = rideData.locationLat;
                            }
                            if (rideData.locationLng !== undefined) {
                                merged.locationLng = rideData.locationLng;
                            }
                            // Preserve rescheduledFrom - DB may return null if column missing or RLS omits it
                            if (rideData.rescheduledFrom !== undefined) {
                                merged.rescheduledFrom = rideData.rescheduledFrom;
                            }
                            data.rides[index] = merged;
                            // Update localStorage again with merged data
                            try {
                                const dataToSave = {
                                    riders: data.riders,
                                    coaches: data.coaches,
                                    rides: data.rides,
                                    routes: data.routes,
                                    currentRide: data.currentRide,
                                    seasonSettings: data.seasonSettings,
                                    autoAssignSettings: data.autoAssignSettings,
                                    sampleVersion: data.sampleVersion,
                                    coachRoles: data.coachRoles || [],
                                    riderRoles: data.riderRoles || []
                                };
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                            } catch (error) {
                                console.error('Error updating localStorage after Supabase save:', error);
                            }
                        }
                    } else {
                        // Create new (pass app-shaped rideData; createRide builds payload)
                        const created = await createRide(rideData);
                        // Merge with local extra fields and add to local data
                        const newRide = { ...rideData, ...created };
                        const index = data.rides.findIndex(r => r.id === rideData.id || (!rideData.id && r.date === rideData.date && r.time === rideData.time));
                        if (index !== -1) {
                            data.rides[index] = newRide;
                        } else {
                        data.rides.push(newRide);
                        }
                        if (data.currentRide === rideData.id && newRide.id) {
                            data.currentRide = newRide.id;
                        }
                        // Update localStorage with new ride ID
                        try {
                            const dataToSave = {
                                riders: data.riders,
                                coaches: data.coaches,
                                rides: data.rides,
                                routes: data.routes,
                                currentRide: data.currentRide,
                                seasonSettings: data.seasonSettings,
                                autoAssignSettings: data.autoAssignSettings,
                                sampleVersion: data.sampleVersion,
                                coachRoles: data.coachRoles || [],
                                riderRoles: data.riderRoles || []
                            };
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                        } catch (error) {
                            console.error('Error updating localStorage after Supabase create:', error);
                        }
                        return newRide;
                    }
                    return;
                } catch (error) {
                    // Supabase save failed, but localStorage already has the data
                    console.error('Failed to save ride to Supabase (localStorage backup already saved):', error);
                    showSaveError(
                        'Failed to Save Practice to Cloud',
                        `An error occurred while saving the practice for ${rideData.date || 'this date'} to the cloud. Your changes have been saved locally and will be synced when you return.`,
                        error
                    );
                    // Don't throw - localStorage backup is already saved
                }
            } else {
                // Not authenticated - localStorage already saved above
                console.log('User not authenticated - ride saved to localStorage only');
            }
        }

        // Tab switching
        function switchTab(tabName, element) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.mobile-menu-item').forEach(t => t.classList.remove('active'));
            
            if (element) {
                element.classList.add('active');
            }
            const tab = document.getElementById(tabName + '-tab');
            if (tab) {
                tab.classList.add('active');
            }
            
            // Save active tab to localStorage for persistence
            try {
                localStorage.setItem('lastActiveTab', tabName);
                const userScopedTabKey = getUserLastActiveTabStorageKey();
                if (userScopedTabKey) {
                    localStorage.setItem(userScopedTabKey, tabName);
                }
            } catch (e) {
                console.warn('Could not save tab state:', e);
            }
            saveLastActiveTabPreference(tabName);
            
            // Update mobile menu
            updateMobileMenu(tabName);
            
            // Hide/show headers and navigation in mobile view for assignments tab
            updateMobileHeaderVisibility(tabName);
            
            // Hide sidebars for all non-practice tabs; for rides tab, show only if a practice is loaded
            if (tabName !== 'rides') {
                hideSidebars();
            }
            
            if (tabName === 'rides') {
                if (USE_PRACTICE_PLANNER_LANDING) {
                    practicePlannerView = 'home';
                } else {
                    practicePlannerView = 'planner';
                }
                renderRides();
                if (data.currentRide && practicePlannerView === 'planner') {
                    showSidebars();
                } else {
                    hideSidebars();
                }
            } else if (tabName === 'settings') {
                loadSeasonSettings();
                renderSeasonCalendarForSettings();
            } else if (tabName === 'site-settings') {
                loadSeasonSettings();
                updateRoleDropdowns();
                loadTeamName();
                loadWelcomeScreenPreferenceControl();
                if (typeof renderAutoAssignSettingsInline === 'function') {
                    renderAutoAssignSettingsInline();
                }
                if (typeof loadUsersList === 'function') {
                    loadUsersList();
                }
                if (typeof loadAdminInvitations === 'function') {
                    loadAdminInvitations();
                }
            } else if (tabName === 'roster') {
                applyRosterPreferences();
            } else if (tabName === 'assignments') {
                renderRideAssignments();
            } else if (tabName === 'coach-assignments') {
                renderCoachAssignments();
            } else if (tabName === 'practice-reporting') {
                renderPracticeReporting();
            } else if (tabName === 'routes') {
                // Routes tab doesn't need any special rendering
            }
            
            // Update header button visibility when switching tabs
            updateHeaderEditSeasonButton();
        }

        let _mobileMenuAutoCloseTimer = null;

        function toggleMobileMenu() {
            const dropdown = document.getElementById('mobile-menu-dropdown');
            const button = document.getElementById('mobile-menu-button');
            if (dropdown && button) {
                const isOpen = dropdown.classList.contains('show');
                clearTimeout(_mobileMenuAutoCloseTimer);
                if (isOpen) {
                    dropdown.classList.remove('show');
                    button.classList.remove('open');
                } else {
                    dropdown.classList.add('show');
                    button.classList.add('open');
                    const closeMobile = () => {
                        dropdown.classList.remove('show');
                        button.classList.remove('open');
                        clearTimeout(_mobileMenuAutoCloseTimer);
                    };
                    const scheduleClose = () => {
                        clearTimeout(_mobileMenuAutoCloseTimer);
                        _mobileMenuAutoCloseTimer = setTimeout(() => { if (dropdown.classList.contains('show')) closeMobile(); }, 2000);
                    };
                    dropdown.addEventListener('mouseenter', () => clearTimeout(_mobileMenuAutoCloseTimer));
                    dropdown.addEventListener('mouseleave', scheduleClose);
                    scheduleClose();
                }
            }
        }

        function toggleSiteSettings() {
            const content = document.getElementById('site-settings-content');
            const toggle = document.getElementById('site-settings-toggle');
            if (content && toggle) {
                const isOpen = content.style.display !== 'none';
                content.style.display = isOpen ? 'none' : 'block';
                toggle.textContent = isOpen ? '▼' : '▲';
            }
        }

        // ============ TEAM NAME ============
        const TEAM_NAME_STORAGE_KEY = 'teamridepro_team_name';
        const PREF_KEY_SHOW_WELCOME_SCREEN = 'showWelcomeScreen';
        const PREF_KEY_LAST_ACTIVE_TAB = 'lastActiveTab';
        const preferenceSaveWarningShownAt = {};

        function notifyPreferenceSaveFailure(preferenceLabel, error) {
            const now = Date.now();
            const lastShown = preferenceSaveWarningShownAt[preferenceLabel] || 0;
            // Avoid spamming repeated alerts during rapid UI actions (e.g., tab switching).
            if (now - lastShown < 60000) return;
            preferenceSaveWarningShownAt[preferenceLabel] = now;

            const title = 'Cloud Preference Save Failed';
            const message = `Could not save "${preferenceLabel}" to Supabase.\n\nThis change may only apply on this device until cloud sync is restored.`;
            if (typeof showSaveError === 'function') {
                showSaveError(title, message, error);
            } else {
                const errMsg = error?.message || error?.toString() || 'Unknown error';
                alert(`⚠️ ${title}\n\n${message}\n\nError details: ${errMsg}`);
            }
        }

        function loadTeamName() {
            // Priority: Supabase (via data.seasonSettings) → localStorage → current header text
            let teamName = (data.seasonSettings && data.seasonSettings.teamName) || '';
            if (!teamName) {
                try { teamName = localStorage.getItem(TEAM_NAME_STORAGE_KEY) || ''; } catch (e) {}
            }
            if (!teamName) {
                // Fall back to whatever is currently in the header (the HTML default)
                const header = document.getElementById('header-team-name');
                if (header) teamName = header.textContent.trim();
            }
            const input = document.getElementById('team-name-input');
            if (input) input.value = teamName;
            applyTeamName(teamName);
        }

        function applyTeamName(name) {
            const header = document.getElementById('header-team-name');
            if (header && name) {
                header.textContent = name;
                document.title = name + ' - TeamRide Pro';
            }
        }

        function revealHeaderTeamName() {
            const header = document.getElementById('header-team-name');
            if (header) header.style.visibility = 'visible';
        }

        function updateTeamNamePreview(value) {
            // Live preview in header as user types
            const header = document.getElementById('header-team-name');
            if (header && value.trim()) {
                header.textContent = value.trim();
            }
        }

        async function saveTeamName() {
            const input = document.getElementById('team-name-input');
            if (!input) return;
            const name = input.value.trim();
            if (!name) {
                alert('Please enter a team name.');
                return;
            }
            if (!data.seasonSettings) data.seasonSettings = {};
            data.seasonSettings.teamName = name;

            // Always save to localStorage as a reliable fallback
            try { localStorage.setItem(TEAM_NAME_STORAGE_KEY, name); } catch (e) {}

            applyTeamName(name);

            // Save to Supabase (may fail if team_name column migration hasn't been run yet)
            try {
                await saveData();
                alert('Team name saved!');
            } catch (error) {
                console.warn('Supabase save failed (team_name column may not exist yet). Saved to localStorage.', error);
                alert('Team name saved locally! To persist across devices, run the ADD_TEAM_NAME_TO_SEASON_SETTINGS.sql migration in Supabase.');
            }
        }

        function selectMobileTab(tabName) {
            // Find the corresponding desktop tab button
            const tabs = document.querySelectorAll('#desktop-tabs .tab');
            let targetElement = null;
            tabs.forEach(tab => {
                if (tab.textContent.trim() === getTabLabel(tabName)) {
                    targetElement = tab;
                }
            });
            
            switchTab(tabName, targetElement);
            toggleMobileMenu(); // Close the dropdown
        }

        function getTabLabel(tabName) {
            const labels = {
                'settings': 'Season Dashboard',
                'roster': 'Roster',
                'coaches': 'Coach Roster',
                'team': 'Team Roster',
                'rides': 'Practice Planner',
                'assignments': 'Rider Assignments',
                'coach-assignments': 'Coach Assignments',
                'site-settings': 'Settings',
                'practice-reporting': 'Reporting',
                'routes': 'Routes'
            };
            return labels[tabName] || tabName;
        }

        function updateMobileMenu(activeTabName) {
            const menuItems = document.querySelectorAll('.mobile-menu-item');
            
            menuItems.forEach(item => {
                item.classList.remove('active');
                const onclickAttr = item.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/'([^']+)'/);
                    if (match && match[1] === activeTabName) {
                        item.classList.add('active');
                    }
                }
            });
        }

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            const menuContainer = document.querySelector('.mobile-menu-container');
            const dropdown = document.getElementById('mobile-menu-dropdown');
            const button = document.getElementById('mobile-menu-button');
            
            if (menuContainer && dropdown && button) {
                if (!menuContainer.contains(event.target) && dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                    button.classList.remove('open');
                }
            }
        });

        // Initialize mobile menu on page load
        document.addEventListener('DOMContentLoaded', function() {
            // Set initial active tab for mobile menu
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const tabId = activeTab.id;
                if (tabId) {
                    const tabName = tabId.replace('-tab', '');
                    updateMobileMenu(tabName);
                    // Apply mobile header hiding for assignments tab
                    updateMobileHeaderVisibility(tabName);
                }
            }
            
            // Don't set defaults here - wait for data to load from Supabase
            // updateScaleInputsFromData() will be called after loadDataFromSupabase() completes
            
            // Initialize Google OAuth after data is loaded
            setTimeout(() => {
                if (typeof loadGoogleToken === 'function') loadGoogleToken();
                if (typeof getGoogleClientId === 'function' && getGoogleClientId()) {
                    if (typeof initGoogleOAuth === 'function') initGoogleOAuth();
                }
                if (typeof updateGoogleAuthStatus === 'function') updateGoogleAuthStatus();
            }, 1000);

            if (typeof setupTruncationObserver === 'function') setupTruncationObserver();
        });
        
        // Handle window resize to show/hide headers appropriately
        window.addEventListener('resize', function() {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const tabId = activeTab.id;
                if (tabId) {
                    const tabName = tabId.replace('-tab', '');
                    updateMobileHeaderVisibility(tabName);
                }
            }
            if (typeof updateSidebarTop === 'function') updateSidebarTop();
        });

        // Size the header spacer on initial load
        requestAnimationFrame(function() {
            if (typeof updateSidebarTop === 'function') updateSidebarTop();
        });
        
        function updateMobileHeaderVisibility(tabName) {
            const headerBar = document.querySelector('.header-bar');
            const desktopTabs = document.getElementById('desktop-tabs');
            const isMobile = window.innerWidth <= 768;

            // In simplified rider/coach mode we always hide the desktop tab bar,
            // regardless of viewport size, and we don't auto-toggle it on resize.
            if (typeof simplifiedLoginInfo !== 'undefined' && simplifiedLoginInfo) {
                if (desktopTabs) desktopTabs.style.display = 'none';
                return;
            }
            
            if (isMobile && (tabName === 'assignments' || tabName === 'coach-assignments')) {
                // Hide header and tabs in mobile view for assignments tabs
                if (headerBar) headerBar.style.display = 'none';
                if (desktopTabs) desktopTabs.style.display = 'none';
            } else {
                // Show header and tabs for other tabs or desktop view
                if (headerBar) headerBar.style.display = '';
                if (desktopTabs) {
                    // Restore to the original display if we have it
                    const original = desktopTabs.dataset?.originalDisplay || '';
                    desktopTabs.style.display = original;
                }
            }
        }

        // Rider management

        // ===== USERS / BACKUP / TAB STATE / ROLES =====
        // ============ USERS MANAGEMENT ============
        
        function formatAdminInvitationError(error) {
            if (!error) return 'Failed to send invitation.';
            const message = String(error.message || '');
            const status = error.status || error?.response?.status;
            if (status === 404 || message.includes('404')) {
                return 'Admin invitations table not found. Please run sql/ADD_ADMIN_INVITATIONS_TABLE.sql in Supabase.';
            }
            if (status === 401 || status === 403) {
                return 'Permission denied. Please ensure you are signed in as a coach-admin.';
            }
            return message || 'Failed to send invitation.';
        }

        async function sendAdminInvitation() {
            const emailInput = document.getElementById('admin-invite-email');
            const statusDiv = document.getElementById('admin-invite-status');
            
            if (!emailInput || !statusDiv) return;
            
            const email = emailInput.value.trim();
            if (!email) {
                statusDiv.textContent = 'Please enter an email address.';
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#d32f2f';
                return;
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                statusDiv.textContent = 'Please enter a valid email address.';
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#d32f2f';
                return;
            }
            
            statusDiv.textContent = 'Sending invitation...';
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#666';
            
            try {
                if (typeof getAdminInvitationsByEmail === 'function') {
                    const existingInvites = await getAdminInvitationsByEmail(email);
                    if (existingInvites && existingInvites.length > 0) {
                        const latest = existingInvites[0];
                        const isExpired = new Date(latest.expires_at) < new Date();
                        if (latest.used) {
                            // Check if user actually still exists in auth/user_roles
                            // If user was deleted from auth, allow re-invitation
                            let userStillExists = false;
                            if (typeof getAllUsersWithLoginInfo === 'function') {
                                try {
                                    const allUsers = await getAllUsersWithLoginInfo();
                                    if (allUsers && allUsers.length > 0) {
                                        userStillExists = allUsers.some(user => 
                                            user.email && user.email.toLowerCase() === email.toLowerCase()
                                        );
                                    }
                                } catch (checkError) {
                                    console.warn('Error checking if user exists:', checkError);
                                    // If check fails, assume user exists to be safe
                                    userStillExists = true;
                                }
                            }
                            
                            if (userStillExists) {
                                statusDiv.textContent = 'This email is already registered. Ask them to sign in or use password reset.';
                                statusDiv.style.color = '#d32f2f';
                                return;
                            } else {
                                // User was deleted but invitation marked as used - allow re-invitation
                                console.log('Invitation was used but user no longer exists - allowing re-invitation');
                            }
                        }
                        if (!isExpired && !latest.used) {
                            statusDiv.textContent = 'An active invitation already exists for this email. Please use the existing invite link.';
                            statusDiv.style.color = '#d32f2f';
                            return;
                        }
                    }
                }

                const invitation = await createAdminInvitation(email);
                
                // Generate invitation URL
                const invitationUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}accept-invitation.html?token=${invitation.token}`;
                
                // Send invitation email via Edge Function
                try {
                    const currentUser = getCurrentUser();
                    const inviterName = currentUser?.user_metadata?.name || currentUser?.email || 'An administrator';
                    
                    const anonKey = window.SUPABASE_ANON_KEY || '';
                    const supabaseUrl = window.SUPABASE_URL || '';
                    
                    if (anonKey && supabaseUrl) {
                        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-admin-invitation`;
                        
                        const response = await fetch(edgeFunctionUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': anonKey,
                                'Authorization': `Bearer ${anonKey}`
                            },
                            body: JSON.stringify({
                                email: email,
                                invitationUrl: invitationUrl,
                                inviterName: inviterName
                            })
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            statusDiv.innerHTML = `
                                <div style="padding: 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; margin-top: 8px;">
                                    <strong style="color: #2e7d32;">Invitation sent successfully!</strong><br>
                                    <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">An email has been sent to ${email} with the invitation link.</span>
                                </div>
                            `;
                            statusDiv.style.color = '#2e7d32';
                            emailInput.value = ''; // Clear the input
                        } else {
                            // If email fails, still show the link as fallback
                            const errorText = await response.text();
                            console.warn('Email sending failed:', errorText);
                            throw new Error('Email sending failed');
                        }
                    } else {
                        throw new Error('Supabase credentials not available');
                    }
                } catch (emailError) {
                    console.warn('Failed to send invitation email, showing link instead:', emailError);
                    // Fallback: Show the link in the UI (current behavior)
                    statusDiv.innerHTML = `
                        <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-top: 8px;">
                            <strong style="color: #856404;">Invitation created (email not sent)</strong><br>
                            <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">Please send this link to ${email}:</span>
                            <div style="margin-top: 8px; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; word-break: break-all; font-family: monospace;">
                                ${invitationUrl}
                            </div>
                            <p style="font-size: 11px; color: #666; margin-top: 8px; margin-bottom: 0;">
                                <strong>Note:</strong> Email sending failed. Copy the link above and send it manually.
                            </p>
                        </div>
                    `;
                    statusDiv.style.color = '#856404';
                }
                
                // Refresh invitations list
                await loadAdminInvitations();
                
            } catch (error) {
                console.error('Error sending invitation:', error);
                statusDiv.textContent = `Error: ${formatAdminInvitationError(error)}`;
                statusDiv.style.color = '#d32f2f';
            }
        }

        async function handleDeleteAdminInvitation(invitationId, email) {
            if (!confirm(`Are you sure you want to delete the invitation for ${email}? This cannot be undone.`)) {
                return;
            }

            const statusDiv = document.getElementById('admin-invite-status');
            if (statusDiv) {
                statusDiv.textContent = 'Deleting invitation...';
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#666';
            }

            try {
                // Call the database function from scripts/database.js
                if (typeof deleteAdminInvitation === 'function') {
                    const result = await deleteAdminInvitation(invitationId);
                    console.log('Delete invitation result:', result);
                    
                    if (statusDiv) {
                        statusDiv.innerHTML = `
                            <div style="padding: 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; margin-top: 8px;">
                                <strong style="color: #2e7d32;">Invitation deleted successfully!</strong>
                            </div>
                        `;
                        statusDiv.style.color = '#2e7d32';
                    }

                    // Refresh invitations list
                    await loadAdminInvitations();
                } else {
                    throw new Error('deleteAdminInvitation function not available. Make sure scripts/database.js is loaded.');
                }
            } catch (error) {
                console.error('Error deleting invitation:', error);
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    invitationId: invitationId
                });
                if (statusDiv) {
                    statusDiv.textContent = `Error: ${error.message || formatAdminInvitationError(error)}`;
                    statusDiv.style.color = '#d32f2f';
                }
            }
        }

        async function resendAdminInvitation(email) {
            const statusDiv = document.getElementById('admin-invite-status');
            if (!statusDiv) return;

            statusDiv.textContent = 'Resending invitation...';
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#666';

            try {
                if (typeof expireAdminInvitationsByEmail === 'function') {
                    await expireAdminInvitationsByEmail(email);
                }

                const invitation = await createAdminInvitation(email);
                const invitationUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}accept-invitation.html?token=${invitation.token}`;

                statusDiv.innerHTML = `
                    <div style="padding: 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px; margin-top: 8px;">
                        <strong style="color: #2e7d32;">Invitation resent successfully!</strong><br>
                        <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">New invitation link (send this to ${email}):</span>
                        <div style="margin-top: 8px; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; word-break: break-all; font-family: monospace;">
                            ${invitationUrl}
                        </div>
                    </div>
                `;
                statusDiv.style.color = '#2e7d32';

                await loadAdminInvitations();
            } catch (error) {
                console.error('Error resending invitation:', error);
                statusDiv.textContent = `Error: ${formatAdminInvitationError(error)}`;
                statusDiv.style.color = '#d32f2f';
            }
        }
        
        async function loadAdminInvitations() {
            const container = document.getElementById('admin-invitations-content');
            if (!container) return;
            
            container.innerHTML = '<p style="color: #666; margin: 0;">Loading invitations...</p>';
            
            try {
                const invitations = await getAllAdminInvitations();
                
                if (!invitations || invitations.length === 0) {
                    container.innerHTML = '<p style="color: #666; margin: 0;">No invitations found.</p>';
                    return;
                }

                const visibleInvites = invitations.filter(inv => !inv.used);
                if (visibleInvites.length === 0) {
                    container.innerHTML = '<p style="color: #666; margin: 0;">No active invitations. (Used invitations are hidden)</p>';
                    return;
                }

                let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
                html += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">';
                html += '<th style="padding: 8px; text-align: left;">Email</th>';
                html += '<th style="padding: 8px; text-align: left;">Status</th>';
                html += '<th style="padding: 8px; text-align: left;">Expires</th>';
                html += '<th style="padding: 8px; text-align: left;">Created</th>';
                html += '<th style="padding: 8px; text-align: left;">Actions</th>';
                html += '</tr></thead><tbody>';

                visibleInvites.forEach(inv => {
                    const isExpired = new Date(inv.expires_at) < new Date();
                    const status = inv.used ? 'Used' : (isExpired ? 'Expired' : 'Pending');
                    const statusColor = inv.used ? '#4caf50' : (isExpired ? '#f44336' : '#ff9800');
                    
                    html += '<tr style="border-bottom: 1px solid #eee;">';
                    html += `<td style="padding: 8px;">${escapeHtml(inv.email)}</td>`;
                    html += `<td style="padding: 8px; color: ${statusColor}; font-weight: 600;">${status}</td>`;
                    html += `<td style="padding: 8px;">${new Date(inv.expires_at).toLocaleDateString()}</td>`;
                    html += `<td style="padding: 8px;">${new Date(inv.created_at).toLocaleDateString()}</td>`;
                    html += `<td style="padding: 8px;">${!inv.used ? `<div style="display: flex; gap: 6px;"><button class="btn-small secondary" onclick="resendAdminInvitation('${escapeHtml(inv.email)}')">Resend</button><button class="btn-small secondary" onclick="handleDeleteAdminInvitation('${inv.id}', '${escapeHtml(inv.email)}')" style="background-color: #f44336; color: white; border-color: #f44336;">Delete</button></div>` : ''}</td>`;
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
                
            } catch (error) {
                console.error('Error loading invitations:', error);
                container.innerHTML = `<p style="color: #d32f2f; margin: 0;">Error loading invitations: ${escapeHtml(formatAdminInvitationError(error))}</p>`;
            }
        }
        
        async function loadUsersList() {
            const container = document.getElementById('users-list');
            if (!container) return;
            
            container.innerHTML = '<p style="color: #666; margin: 0;">Loading users...</p>';
            
            try {
                if (typeof getAllUsersWithLoginInfo !== 'function') {
                    container.innerHTML = '<p style="color: #d32f2f; margin: 0;">Error: Database functions not available. Please ensure you are authenticated.</p>';
                    return;
                }
                
                const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                const users = await getAllUsersWithLoginInfo();
                
                if (!users || users.length === 0) {
                    container.innerHTML = '<p style="color: #666; margin: 0;">No registered users found.</p>';
                    return;
                }
                
                let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
                html += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">';
                html += '<th style="padding: 8px; text-align: left;">Name</th>';
                html += '<th style="padding: 8px; text-align: left;">Email</th>';
                html += '<th style="padding: 8px; text-align: left;">Phone</th>';
                html += '<th style="padding: 8px; text-align: left;">Role</th>';
                html += '<th style="padding: 8px; text-align: center;">Allow Dev Access</th>';
                html += '<th style="padding: 8px; text-align: left;">Registered</th>';
                html += '<th style="padding: 8px; text-align: left;">Actions</th>';
                html += '</tr></thead><tbody>';
                
                users.forEach(user => {
                    const isDisabled = user.isDisabled === true;
                    const rowStyle = isDisabled ? 'opacity: 0.6; font-style: italic;' : '';
                    const linkIcon = user.matchedType ? '<span title="Linked to roster record" style="margin-left: 6px;">🔗</span>' : '';
                    html += `<tr style="border-bottom: 1px solid #eee; ${rowStyle}">`;
                    html += `<td style="padding: 8px;">${escapeHtml(user.name || 'N/A')}${linkIcon}</td>`;
                    html += `<td style="padding: 8px;">${escapeHtml(user.email || 'N/A')}</td>`;
                    html += `<td style="padding: 8px;">${escapeHtml(user.phone || 'N/A')}</td>`;
                    html += `<td style="padding: 8px;">${escapeHtml(user.role || 'N/A')}</td>`;
                    const devChecked = user.allowDevAccess ? 'checked' : '';
                    const devDisabledAttr = isDisabled ? 'disabled' : '';
                    html += `<td style="padding: 8px; text-align: center;"><input type="checkbox" ${devChecked} ${devDisabledAttr} onchange="toggleAllowDevAccess('${user.id}', this.checked)" style="transform: scale(1.2); cursor: pointer;"></td>`;
                    const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
                    html += `<td style="padding: 8px;">${regDate}</td>`;
                    const isCurrentUser = currentUser && user.id === currentUser.id;
                    const actionButton = user.role === 'coach-admin'
                        ? (isDisabled
                            ? `<button class="btn-small secondary" onclick="enableAdmin('${user.id}')">Enable Admin</button>`
                            : (isCurrentUser ? '' : `<button class="btn-small danger" onclick="disableAdmin('${user.id}', '${escapeHtml(user.email || '')}')">Disable Admin</button>`))
                        : '';
                    html += `<td style="padding: 8px;">${actionButton}</td>`;
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                container.innerHTML = html;
            } catch (error) {
                console.error('Error loading users:', error);
                container.innerHTML = `<p style="color: #d32f2f; margin: 0;">Error loading users: ${escapeHtml(error.message || 'Unknown error')}</p>`;
            }
        }

        async function disableAdmin(userId, email) {
            if (!userId) return;
            if (!confirm('Disable admin access for this user? They will no longer be able to access the site.')) return;

            try {
                if (typeof disableAdminUser !== 'function') {
                    throw new Error('Admin disable function not available.');
                }
                await disableAdminUser(userId, email || null);
                await loadUsersList();
            } catch (error) {
                console.error('Error disabling admin:', error);
                alert(error.message || 'Failed to disable admin.');
            }
        }

        async function enableAdmin(userId) {
            if (!userId) return;
            try {
                if (typeof enableAdminUser !== 'function') {
                    throw new Error('Admin enable function not available.');
                }
                await enableAdminUser(userId);
                await loadUsersList();
            } catch (error) {
                console.error('Error enabling admin:', error);
                alert(error.message || 'Failed to enable admin.');
            }
        }

        async function toggleAllowDevAccess(userId, allowed) {
            if (!userId) return;
            try {
                if (typeof setAllowDevAccess !== 'function') {
                    throw new Error('Function not available.');
                }
                await setAllowDevAccess(userId, allowed);
            } catch (error) {
                console.error('Error updating dev access:', error);
                alert(error.message || 'Failed to update dev access setting.');
                await loadUsersList();
            }
        }
        
        // ============ BACKUP ENCRYPTION & EXPORT ============

        async function encryptBackupData(plaintext) {
            try {
                const encoder = new TextEncoder();
                const dataBytes = encoder.encode(plaintext);
                const keyMaterial = await crypto.subtle.importKey(
                    'raw', encoder.encode(ENCRYPTION_KEY_BASE.padEnd(32, '0').substring(0, 32)),
                    { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
                );
                const key = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: encoder.encode('TeamRideProSalt'), iterations: 100000, hash: 'SHA-256' },
                    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
                );
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, dataBytes);
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                let binaryString = '';
                for (let i = 0; i < combined.length; i++) { binaryString += String.fromCharCode(combined[i]); }
                return btoa(binaryString);
            } catch (error) {
                console.error('Encryption error:', error);
                throw new Error('Failed to encrypt backup data');
            }
        }

        async function decryptBackupData(encryptedBase64) {
            try {
                const binaryString = atob(encryptedBase64);
                const combined = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) { combined[i] = binaryString.charCodeAt(i); }
                const iv = combined.slice(0, 12);
                const encrypted = combined.slice(12);
                const encoder = new TextEncoder();
                const keyMaterial = await crypto.subtle.importKey(
                    'raw', encoder.encode(ENCRYPTION_KEY_BASE.padEnd(32, '0').substring(0, 32)),
                    { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
                );
                const key = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: encoder.encode('TeamRideProSalt'), iterations: 100000, hash: 'SHA-256' },
                    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
                );
                const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, encrypted);
                return new TextDecoder().decode(decrypted);
            } catch (error) {
                console.error('Decryption error:', error);
                throw new Error('Failed to decrypt backup data. The file may be corrupted or not encrypted with this version.');
            }
        }

        async function exportAllData() {
            saveData();
            let riderFeedback = [], rideNotes = [], riderAvailability = [], colorNames = [];
            const client = getSupabaseClient();
            if (client) {
                try { const { data: fb } = await client.from('rider_feedback').select('*'); riderFeedback = fb || []; } catch (e) {}
                try { const { data: rn } = await client.from('ride_notes').select('*'); rideNotes = rn || []; } catch (e) {}
                try { const { data: ra } = await client.from('rider_availability').select('*'); riderAvailability = ra || []; } catch (e) {}
                try { const { data: cn } = await client.from('color_names').select('*').order('sort_order', { ascending: true }); colorNames = cn || []; } catch (e) {}
            }
            const exportData = {
                version: '3.0', exportedAt: new Date().toISOString(),
                data: {
                    riders: data.riders || [], coaches: data.coaches || [], rides: data.rides || [],
                    routes: data.routes || [], races: data.races || [], currentRide: data.currentRide || null,
                    seasonSettings: data.seasonSettings || null, autoAssignSettings: data.autoAssignSettings || null,
                    timeEstimationSettings: data.timeEstimationSettings || null,
                    coachRoles: data.coachRoles || [], riderRoles: data.riderRoles || [],
                    riderFeedback, rideNotes, riderAvailability, colorNames
                }
            };
            const jsonString = JSON.stringify(exportData, null, 2);
            const encryptedData = await encryptBackupData(jsonString);
            const encryptedWrapper = { encrypted: true, version: '3.0', data: encryptedData };
            const encryptedJsonString = JSON.stringify(encryptedWrapper);
            const blob = new Blob([encryptedJsonString], { type: 'application/json' });
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: `team-ride-pro-backup-${new Date().toISOString().split('T')[0]}.trpb`,
                        types: [{ description: 'Team Ride Pro Backup files', accept: { 'application/json': ['.trpb'] } }]
                    });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    alert('Complete team data backup exported successfully!');
                    return;
                } catch (error) {
                    if (error.name === 'AbortError') return;
                    console.error('File System Access API error:', error);
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `team-ride-pro-backup-${new Date().toISOString().split('T')[0]}.trpb`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Complete team data backup exported successfully!');
        }

        // ============ BACKUP MANAGEMENT ============
        
        // Create a complete backup of all data (FULL snapshot)
        async function getAllDataForBackup() {
            const backupData = {
                riders: data.riders || [],
                coaches: data.coaches || [],
                rides: data.rides || [],
                routes: data.routes || [],
                races: data.races || [],
                seasonSettings: data.seasonSettings || {},
                autoAssignSettings: data.autoAssignSettings || {},
                coachRoles: data.coachRoles || [],
                riderRoles: data.riderRoles || [],
                timeEstimationSettings: data.timeEstimationSettings || {},
                currentRide: data.currentRide || null,
                backupTimestamp: new Date().toISOString(),
                backupVersion: '2.0'
            };

            // Fetch additional tables from Supabase for a FULL picture
            const client = getSupabaseClient();
            if (client) {
                try {
                    // Fetch all rider feedback
                    const { data: feedback } = await client.from('rider_feedback').select('*');
                    backupData.riderFeedback = feedback || [];
                } catch (e) { console.warn('Backup: could not fetch rider_feedback', e); backupData.riderFeedback = []; }

                try {
                    // Fetch all ride notes
                    const { data: notes } = await client.from('ride_notes').select('*');
                    backupData.rideNotes = notes || [];
                } catch (e) { console.warn('Backup: could not fetch ride_notes', e); backupData.rideNotes = []; }

                try {
                    // Fetch all rider availability records
                    const { data: avail } = await client.from('rider_availability').select('*');
                    backupData.riderAvailability = avail || [];
                } catch (e) { console.warn('Backup: could not fetch rider_availability', e); backupData.riderAvailability = []; }

                try {
                    // Fetch color names
                    const { data: colors } = await client.from('color_names').select('*').order('sort_order', { ascending: true });
                    backupData.colorNames = colors || [];
                } catch (e) { console.warn('Backup: could not fetch color_names', e); backupData.colorNames = []; }
            }

            return backupData;
        }
        
        // Create automatic backup (on login/logout)
        async function createAutomaticBackup(backupType) {
            try {
                if (typeof createBackup !== 'function') {
                    console.warn('createBackup function not available');
                    return;
                }
                
                const backupData = await getAllDataForBackup();
                const backupName = `Auto Backup - ${backupType === 'auto_login' ? 'Login' : 'Logout'} - ${new Date().toLocaleString()}`;
                
                await createBackup(backupName, backupData, backupType);
                console.log(`✅ Automatic backup created: ${backupName}`);
            } catch (error) {
                console.error('Error creating automatic backup:', error);
                throw error;
            }
        }
        
        // Create manual backup
        async function createManualBackup() {
            try {
                if (isDeveloperMode) {
                    alert('In developer mode, backups are not saved to the server. Your data is already saved locally in this browser.');
                    return;
                }
                if (typeof createBackup !== 'function') {
                    alert('Backup function not available. Please ensure you are authenticated.');
                    return;
                }
                
                const backupName = prompt('Enter a name for this backup:', `Manual Backup - ${new Date().toLocaleString()}`);
                if (!backupName) {
                    return; // User cancelled
                }
                
                const backupData = await getAllDataForBackup();
                
                await createBackup(backupName, backupData, 'manual');
                alert('Backup created successfully!');
                
                // Refresh backups list
                await loadBackupsList();
            } catch (error) {
                console.error('Error creating backup:', error);
                alert('Error creating backup: ' + (error.message || 'Unknown error'));
            }
        }
        
        // Load and display backups list
        async function loadBackupsList() {
            const container = document.getElementById('backups-list');
            if (!container) return;
            
            container.innerHTML = '<p style="color: #666; margin: 0;">Loading backups...</p>';
            
            try {
                if (typeof getAllBackups !== 'function') {
                    container.innerHTML = '<p style="color: #d32f2f; margin: 0;">Error: Database functions not available. Please ensure you are authenticated.</p>';
                    return;
                }
                
                const backups = await getAllBackups();
                
                if (!backups || backups.length === 0) {
                    container.innerHTML = '<p style="color: #666; margin: 0;">No backups found.</p>';
                    return;
                }
                
                let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
                
                backups.forEach(backup => {
                    const backupDate = new Date(backup.created_at).toLocaleString();
                    const backupTypeLabel = backup.backup_type === 'manual' ? 'Manual' : 
                                          backup.backup_type === 'auto_login' ? 'Auto (Login)' : 
                                          backup.backup_type === 'auto_logout' ? 'Auto (Logout)' : 'Unknown';
                    
                    html += `<div style="padding: 12px; border: 1px solid #ddd; border-radius: 4px; background: white;">`;
                    html += `<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">`;
                    html += `<div style="flex: 1;">`;
                    html += `<strong style="display: block; margin-bottom: 4px;">${escapeHtml(backup.backup_name || 'Unnamed Backup')}</strong>`;
                    html += `<span style="color: #666; font-size: 12px;">${backupDate} • ${backupTypeLabel}</span>`;
                    html += `</div>`;
                    html += `<div style="display: flex; gap: 8px;">`;
                    html += `<button class="btn-small" onclick="restoreFromBackup(${backup.id})" style="padding: 4px 12px; font-size: 12px;">Restore</button>`;
                    html += `<button class="btn-small danger" onclick="deleteBackupById(${backup.id})" style="padding: 4px 12px; font-size: 12px;">Delete</button>`;
                    html += `</div>`;
                    html += `</div>`;
                    html += `</div>`;
                });
                
                html += '</div>';
                container.innerHTML = html;
            } catch (error) {
                console.error('Error loading backups:', error);
                container.innerHTML = `<p style="color: #d32f2f; margin: 0;">Error loading backups: ${escapeHtml(error.message || 'Unknown error')}</p>`;
            }
        }
        
        // Restore from backup
        async function restoreFromBackup(backupId) {
            if (!confirm('⚠️ WARNING: This will replace ALL current data with the backup data. This action cannot be undone. Continue?')) {
                return;
            }
            
            if (!confirm('Are you absolutely sure? All current data will be lost.')) {
                return;
            }
            
            try {
                if (typeof getBackupById !== 'function') {
                    alert('Backup function not available. Please ensure you are authenticated.');
                    return;
                }
                
                const backup = await getBackupById(backupId);
                if (!backup || !backup.backup_data) {
                    alert('Backup not found or invalid.');
                    return;
                }
                
                const backupData = backup.backup_data;
                
                // Restore all data (core)
                data.riders = backupData.riders || [];
                data.coaches = backupData.coaches || [];
                data.rides = backupData.rides || [];
                data.routes = backupData.routes || [];
                data.races = backupData.races || [];
                data.seasonSettings = backupData.seasonSettings || {};
                data.autoAssignSettings = backupData.autoAssignSettings || {};
                data.coachRoles = backupData.coachRoles || [];
                data.riderRoles = backupData.riderRoles || [];
                data.timeEstimationSettings = backupData.timeEstimationSettings || {};
                if (backupData.currentRide !== undefined) data.currentRide = backupData.currentRide;

                // Restore additional tables (v2.0+ backups)
                if (Array.isArray(backupData.riderFeedback)) data.riderFeedback = backupData.riderFeedback;
                if (Array.isArray(backupData.rideNotes)) data.rideNotes = backupData.rideNotes;
                if (Array.isArray(backupData.riderAvailability)) data.riderAvailability = backupData.riderAvailability;
                if (Array.isArray(backupData.colorNames)) data.colorNames = backupData.colorNames;
                
                // Save to localStorage immediately
                saveData();
                
                if (!isDeveloperMode) {
                    // Save ALL data to Supabase (riders, coaches, rides, routes, etc.)
                    alert('Restoring data to Supabase — this may take a moment. Do NOT close the page.');
                    await saveAllDataToSupabase();
                } else {
                    console.log('Developer mode: backup restore applied locally only (not written to Supabase).');
                }
                
                alert('✅ Backup restored successfully! The page will now reload.');
                
                // Reload page to reflect changes
                window.location.reload();
            } catch (error) {
                console.error('Error restoring backup:', error);
                alert('Error restoring backup: ' + (error.message || 'Unknown error'));
            }
        }
        
        // Delete backup
        async function deleteBackupById(backupId) {
            if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
                return;
            }
            
            try {
                if (typeof deleteBackup !== 'function') {
                    alert('Backup function not available. Please ensure you are authenticated.');
                    return;
                }
                
                await deleteBackup(backupId);
                alert('Backup deleted successfully.');
                
                // Refresh backups list
                await loadBackupsList();
            } catch (error) {
                console.error('Error deleting backup:', error);
                alert('Error deleting backup: ' + (error.message || 'Unknown error'));
            }
        }
        
        // Save all data to Supabase (used during restore)
        // This performs a FULL sync: upserts all local data into Supabase tables.
        async function saveAllDataToSupabase() {
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!client || !currentUser) {
                console.warn('saveAllDataToSupabase: Supabase client or user not available. Data saved to localStorage only.');
                return;
            }

            const errors = [];
            let progress = 0;
            const totalSteps = 9; // riders, coaches, rides, routes, races, season settings, auto-assign, color_names, rider_feedback/ride_notes/rider_availability

            function logProgress(step) {
                progress++;
                console.log(`saveAllDataToSupabase [${progress}/${totalSteps}]: ${step}`);
            }

            // --- 1. Riders ---
            try {
                logProgress('Saving riders...');
                if (Array.isArray(data.riders) && data.riders.length > 0 && typeof updateRider === 'function' && typeof createRider === 'function') {
                    for (const rider of data.riders) {
                        try {
                            if (rider.id) {
                                await updateRider(rider.id, rider);
                            } else {
                                const created = await createRider(rider);
                                rider.id = created.id;
                            }
                        } catch (e) {
                            errors.push(`Rider ${rider.name || rider.id}: ${e.message}`);
                        }
                    }
                }
            } catch (e) { errors.push(`Riders batch: ${e.message}`); }

            // --- 2. Coaches ---
            try {
                logProgress('Saving coaches...');
                if (Array.isArray(data.coaches) && data.coaches.length > 0 && typeof updateCoach === 'function' && typeof createCoach === 'function') {
                    for (const coach of data.coaches) {
                        try {
                            if (coach.id) {
                                await updateCoach(coach.id, coach);
                            } else {
                                const created = await createCoach(coach);
                                coach.id = created.id;
                            }
                        } catch (e) {
                            errors.push(`Coach ${coach.name || coach.id}: ${e.message}`);
                        }
                    }
                }
            } catch (e) { errors.push(`Coaches batch: ${e.message}`); }

            // --- 3. Rides ---
            try {
                logProgress('Saving rides...');
                if (Array.isArray(data.rides) && data.rides.length > 0) {
                    for (const ride of data.rides) {
                        try {
                            await saveRideToDB(ride);
                        } catch (e) {
                            errors.push(`Ride ${ride.date || ride.id}: ${e.message}`);
                        }
                    }
                }
            } catch (e) { errors.push(`Rides batch: ${e.message}`); }

            // --- 4. Routes ---
            try {
                logProgress('Saving routes...');
                if (Array.isArray(data.routes) && data.routes.length > 0 && typeof updateRoute === 'function' && typeof createRoute === 'function') {
                    for (const route of data.routes) {
                        try {
                            if (route.id) {
                                await updateRoute(route.id, route);
                            } else {
                                const created = await createRoute(route);
                                route.id = created.id;
                            }
                        } catch (e) {
                            errors.push(`Route ${route.name || route.id}: ${e.message}`);
                        }
                    }
                }
            } catch (e) { errors.push(`Routes batch: ${e.message}`); }

            // --- 5. Races ---
            try {
                logProgress('Saving races...');
                if (Array.isArray(data.races) && data.races.length > 0 && typeof updateRace === 'function' && typeof createRace === 'function') {
                    for (const race of data.races) {
                        try {
                            if (race.id) {
                                await updateRace(race.id, race);
                            } else {
                                const created = await createRace(race);
                                race.id = created.id;
                            }
                        } catch (e) {
                            errors.push(`Race ${race.name || race.id}: ${e.message}`);
                        }
                    }
                }
            } catch (e) { errors.push(`Races batch: ${e.message}`); }

            // --- 6. Season Settings ---
            try {
                logProgress('Saving season settings...');
                if (data.seasonSettings && typeof saveSeasonSettings === 'function') {
                    await saveSeasonSettings(data.seasonSettings);
                }
            } catch (e) { errors.push(`Season settings: ${e.message}`); }

            // --- 7. Auto-Assign Settings ---
            try {
                logProgress('Saving auto-assign settings...');
                if (data.autoAssignSettings && typeof saveAutoAssignSettings === 'function') {
                    await saveAutoAssignSettings(data.autoAssignSettings);
                }
            } catch (e) { errors.push(`Auto-assign settings: ${e.message}`); }

            // --- 8. Color Names ---
            try {
                logProgress('Saving color names...');
                if (Array.isArray(data.colorNames) && data.colorNames.length > 0) {
                    // Bulk upsert color names
                    const { error: colorError } = await client
                        .from('color_names')
                        .upsert(data.colorNames.map(cn => ({
                            id: cn.id,
                            name: cn.name,
                            sort_order: cn.sort_order !== undefined ? cn.sort_order : cn.sortOrder
                        })), { onConflict: 'id' });
                    if (colorError) errors.push(`Color names: ${colorError.message}`);
                }
            } catch (e) { errors.push(`Color names: ${e.message}`); }

            // --- 9. Rider Feedback, Ride Notes, Rider Availability ---
            try {
                logProgress('Saving rider feedback, ride notes, rider availability...');
                if (Array.isArray(data.riderFeedback) && data.riderFeedback.length > 0) {
                    const { error: fbError } = await client
                        .from('rider_feedback')
                        .upsert(data.riderFeedback, { onConflict: 'id' });
                    if (fbError) errors.push(`Rider feedback: ${fbError.message}`);
                }
                if (Array.isArray(data.rideNotes) && data.rideNotes.length > 0) {
                    const { error: notesError } = await client
                        .from('ride_notes')
                        .upsert(data.rideNotes, { onConflict: 'ride_id' });
                    if (notesError) errors.push(`Ride notes: ${notesError.message}`);
                }
                if (Array.isArray(data.riderAvailability) && data.riderAvailability.length > 0) {
                    const { error: availError } = await client
                        .from('rider_availability')
                        .upsert(data.riderAvailability, { onConflict: 'ride_id,rider_id' });
                    if (availError) errors.push(`Rider availability: ${availError.message}`);
                }
            } catch (e) { errors.push(`Feedback/notes/availability: ${e.message}`); }

            if (errors.length > 0) {
                console.error('saveAllDataToSupabase completed with errors:', errors);
                alert(`Restore saved to Supabase with ${errors.length} error(s). Check the console (F12) for details.\n\nFirst error: ${errors[0]}`);
            } else {
                console.log('saveAllDataToSupabase: All data saved to Supabase successfully.');
            }
        }
        
        // ============ TAB STATE PERSISTENCE ============
        function getPreferenceScopeId() {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (user && user.id) return `user:${user.id}`;
            if (simplifiedLoginInfo && simplifiedLoginInfo.type && simplifiedLoginInfo.id != null) {
                return `simple:${simplifiedLoginInfo.type}:${simplifiedLoginInfo.id}`;
            }
            return null;
        }

        function getUserLastActiveTabStorageKey() {
            const scope = getPreferenceScopeId();
            return scope ? `lastActiveTab:${scope}` : null;
        }

        function getUserWelcomeScreenStorageKey() {
            const scope = getPreferenceScopeId();
            return scope ? `showWelcomeScreen:${scope}` : null;
        }

        function getStoredLastActiveTab() {
            try {
                const scopedKey = getUserLastActiveTabStorageKey();
                if (scopedKey) {
                    const scopedTab = localStorage.getItem(scopedKey);
                    if (scopedTab) return scopedTab;
                }
                return localStorage.getItem('lastActiveTab');
            } catch (e) {
                console.warn('Could not read tab state:', e);
                return null;
            }
        }

        async function saveLastActiveTabPreference(tabName) {
            if (!tabName) return;
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.id || typeof setUserPreference !== 'function') return;
            try {
                await setUserPreference(PREF_KEY_LAST_ACTIVE_TAB, { tab: tabName });
            } catch (e) {
                console.warn('Could not sync last active tab preference:', e);
                notifyPreferenceSaveFailure('Last opened tab', e);
            }
        }

        async function saveWelcomeScreenPreferenceToCloud(enabled) {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.id || typeof setUserPreference !== 'function') return;
            try {
                await setUserPreference(PREF_KEY_SHOW_WELCOME_SCREEN, { enabled: !!enabled });
            } catch (e) {
                console.warn('Could not sync welcome screen preference:', e);
                notifyPreferenceSaveFailure('Show welcome screen with shortcut options', e);
            }
        }

        async function loadUserUiPreferencesFromCloud() {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.id || typeof getUserPreference !== 'function') return;

            try {
                const welcomePref = await getUserPreference(PREF_KEY_SHOW_WELCOME_SCREEN);
                if (welcomePref && typeof welcomePref.enabled === 'boolean') {
                    setWelcomeScreenEnabledForUser(!!welcomePref.enabled, false);
                }
            } catch (e) {
                console.warn('Could not load welcome screen preference from cloud:', e);
            }

            try {
                const tabPref = await getUserPreference(PREF_KEY_LAST_ACTIVE_TAB);
                if (tabPref && typeof tabPref.tab === 'string' && tabPref.tab) {
                    const scopedKey = getUserLastActiveTabStorageKey();
                    if (scopedKey) {
                        localStorage.setItem(scopedKey, tabPref.tab);
                    }
                    localStorage.setItem('lastActiveTab', tabPref.tab);
                }
            } catch (e) {
                console.warn('Could not load last active tab preference from cloud:', e);
            }
        }

        function isWelcomeScreenEnabledForUser() {
            try {
                const key = getUserWelcomeScreenStorageKey();
                if (!key) return true;
                const stored = localStorage.getItem(key);
                return stored !== 'false';
            } catch (e) {
                console.warn('Could not read welcome screen preference:', e);
                return true;
            }
        }

        function setWelcomeScreenEnabledForUser(enabled, syncToCloud = true) {
            try {
                const key = getUserWelcomeScreenStorageKey();
                if (!key) return;
                localStorage.setItem(key, enabled ? 'true' : 'false');
            } catch (e) {
                console.warn('Could not save welcome screen preference:', e);
            }
            if (syncToCloud) {
                saveWelcomeScreenPreferenceToCloud(enabled);
            }
        }

        function getTabButtonElement(tabName) {
            const tabs = document.querySelectorAll('#desktop-tabs .tab');
            let targetTab = null;
            tabs.forEach(tab => {
                const onclick = tab.getAttribute('onclick') || '';
                if (onclick.includes(`'${tabName}'`)) {
                    targetTab = tab;
                }
            });
            return targetTab;
        }

        function switchToTabByName(tabName) {
            const targetTab = getTabButtonElement(tabName);
            switchTab(tabName, targetTab);
        }

        function getWelcomeUserName() {
            let fullName = '';
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (user) {
                fullName = user.user_metadata?.name || user.email || '';
            }
            if (!fullName && simplifiedLoginInfo && simplifiedLoginInfo.name) {
                fullName = simplifiedLoginInfo.name;
            }
            if (!fullName) return 'there';
            // Strip email domain if it's an email, then use first name only
            const name = fullName.split('@')[0];
            const firstName = name.split(/[\s]+/)[0];
            return firstName || name || 'there';
        }

        function getTimeOfDayGreeting() {
            const hour = new Date().getHours();
            if (hour < 12) return 'morning';
            if (hour < 18) return 'afternoon';
            return 'evening';
        }

        function showWelcomeScreen() {
            const welcome = document.getElementById('welcome-screen');
            if (!welcome) return false;
            const welcomeTitle = document.getElementById('welcome-title');
            const welcomeTeamName = document.getElementById('welcome-team-name');
            const disableCheckbox = document.getElementById('welcome-disable-checkbox');
            const greeting = getTimeOfDayGreeting();
            const userName = getWelcomeUserName();
            if (welcomeTitle) {
                welcomeTitle.textContent = `Good ${greeting} ${userName}, what would you like to do?`;
            }
            if (welcomeTeamName) {
                const headerEl = document.getElementById('header-team-name');
                const teamName = (data.seasonSettings && data.seasonSettings.teamName)
                    || (headerEl && headerEl.textContent.trim())
                    || '';
                welcomeTeamName.textContent = teamName;
                welcomeTeamName.style.display = teamName ? '' : 'none';
            }
            if (disableCheckbox) disableCheckbox.checked = false;
            welcome.style.display = 'flex';
            return true;
        }

        function hideWelcomeScreen() {
            const welcome = document.getElementById('welcome-screen');
            if (welcome) welcome.style.display = 'none';
            // NOTE: Do NOT change sticky-top / container visibility here.
            // App chrome is revealed by handleWelcomeAction() or loadApplicationData routing.
        }

        function revealAppChrome() {
            const st = document.querySelector('.sticky-top');
            const mc = document.querySelector('.container');
            if (st) st.style.visibility = 'visible';
            if (mc) mc.style.visibility = 'visible';
            revealHeaderTeamName();
        }

        // Legacy wrapper — routing now uses isFreshLogin flag directly.
        function maybeShowWelcomeScreen() {
            return false;
        }

        function handleWelcomeAction(action) {
            hideWelcomeScreen();
            revealAppChrome();

            if (action === 'rides') {
                switchToTabByName('rides');
                return;
            }
            if (action === 'routes') {
                switchToTabByName('routes');
                return;
            }
            if (action === 'roster') {
                switchToTabByName('roster');
                return;
            }
            // "full-site" defaults to user's last active tab
            restoreLastActiveTab();
        }

        function handleWelcomeDisableToggle(isChecked) {
            if (!isChecked) return;
            // Checked means "don't show welcome screen" => disable it for this user
            setWelcomeScreenEnabledForUser(false);
            const settingsToggle = document.getElementById('welcome-screen-enabled-toggle');
            if (settingsToggle) settingsToggle.checked = false;
            handleWelcomeAction('full-site');
        }

        function loadWelcomeScreenPreferenceControl() {
            const toggle = document.getElementById('welcome-screen-enabled-toggle');
            if (!toggle) return;
            toggle.checked = isWelcomeScreenEnabledForUser();
        }

        function handleWelcomeScreenSettingToggle(isEnabled) {
            setWelcomeScreenEnabledForUser(!!isEnabled);
        }
        
        // Restore last active tab on page load
        function restoreLastActiveTab() {
            try {
                const lastTab = getStoredLastActiveTab();
                if (lastTab) {
                    const targetTab = getTabButtonElement(lastTab);
                    if (targetTab) {
                        // Switch to the last active tab
                        switchTab(lastTab, targetTab);
                        return;
                    }
                }
                // Fallback if nothing is stored or tab is no longer available
                switchToTabByName('settings');
            } catch (e) {
                console.warn('Could not restore tab state:', e);
            }
        }
        
        function addCoachRole() {
            const roleNameInput = document.getElementById('new-coach-role-name');
            const coachSelect = document.getElementById('new-coach-role-coach');
            
            if (!roleNameInput || !coachSelect) return;
            
            const roleName = roleNameInput.value.trim();
            const coachId = parseInt(coachSelect.value, 10);
            
            if (!roleName) {
                alert('Please enter a role name');
                return;
            }
            
            if (!coachId) {
                alert('Please select a coach');
                return;
            }
            
            // Check if coach already has a role
            const existingRole = data.coachRoles.find(r => r.coachId === coachId);
            if (existingRole) {
                if (!confirm(`Coach already has role "${existingRole.roleName}". Replace it?`)) {
                    return;
                }
                // Remove existing role
                data.coachRoles = data.coachRoles.filter(r => r.coachId !== coachId);
            }
            
            // Add new role
            data.coachRoles.push({ roleName, coachId });
            saveData();
            
            // Clear inputs
            roleNameInput.value = '';
            coachSelect.value = '';
            
            // Refresh display
            renderCoachRoles();
            renderCoaches();
        }
        
        function addRiderRole() {
            const roleNameInput = document.getElementById('new-rider-role-name');
            const riderSelect = document.getElementById('new-rider-role-rider');
            
            if (!roleNameInput || !riderSelect) return;
            
            const roleName = roleNameInput.value.trim();
            const riderId = parseInt(riderSelect.value, 10);
            
            if (!roleName) {
                alert('Please enter a role name');
                return;
            }
            
            if (!riderId) {
                alert('Please select a rider');
                return;
            }
            
            // Check if rider already has a role
            const existingRole = data.riderRoles.find(r => r.riderId === riderId);
            if (existingRole) {
                if (!confirm(`Rider already has role "${existingRole.roleName}". Replace it?`)) {
                    return;
                }
                // Remove existing role
                data.riderRoles = data.riderRoles.filter(r => r.riderId !== riderId);
            }
            
            // Add new role
            data.riderRoles.push({ roleName, riderId });
            saveData();
            
            // Clear inputs
            roleNameInput.value = '';
            riderSelect.value = '';
            
            // Refresh display
            renderRiderRoles();
            renderRiders();
        }
        
        function removeCoachRole(index) {
            if (confirm('Remove this coach role?')) {
                data.coachRoles.splice(index, 1);
                saveData();
                renderCoachRoles();
                renderCoaches();
            }
        }
        
        function removeRiderRole(index) {
            if (confirm('Remove this rider role?')) {
                data.riderRoles.splice(index, 1);
                saveData();
                renderRiderRoles();
                renderRiders();
            }
        }
        
        // Helper to get role for a coach/rider
        function getCoachRole(coachId) {
            if (!data.coachRoles) return null;
            const role = data.coachRoles.find(r => r.coachId === coachId);
            return role ? role.roleName : null;
        }
        
        function getRiderRole(riderId) {
            if (!data.riderRoles) return null;
            const role = data.riderRoles.find(r => r.riderId === riderId);
            return role ? role.roleName : null;
        }

        function toggleRosterView(view) {
            const ridersView = document.getElementById('roster-riders-view');
            const coachesView = document.getElementById('roster-coaches-view');
            const ridersBtn = document.getElementById('roster-toggle-riders');
            const coachesBtn = document.getElementById('roster-toggle-coaches');
            const riderGroupBy = document.getElementById('rider-group-by');
            const coachGroupBy = document.getElementById('coach-group-by');
            const groupByLabel = document.getElementById('roster-group-by-label');
            
            if (view === 'riders') {
                if (ridersView) ridersView.style.display = 'block';
                if (coachesView) coachesView.style.display = 'none';
                if (ridersBtn) {
                    ridersBtn.classList.remove('secondary');
                    ridersBtn.classList.add('active');
                }
                if (coachesBtn) {
                    coachesBtn.classList.remove('active');
                    coachesBtn.classList.add('secondary');
                }
                if (riderGroupBy) riderGroupBy.style.display = 'block';
                if (coachGroupBy) coachGroupBy.style.display = 'none';
                if (groupByLabel) groupByLabel.setAttribute('for', 'rider-group-by');
                renderRiders();
            } else {
                if (ridersView) ridersView.style.display = 'none';
                if (coachesView) coachesView.style.display = 'block';
                if (ridersBtn) {
                    ridersBtn.classList.remove('active');
                    ridersBtn.classList.add('secondary');
                }
                if (coachesBtn) {
                    coachesBtn.classList.remove('secondary');
                    coachesBtn.classList.add('active');
                }
                if (riderGroupBy) riderGroupBy.style.display = 'none';
                if (coachGroupBy) coachGroupBy.style.display = 'block';
                if (groupByLabel) groupByLabel.setAttribute('for', 'coach-group-by');
                renderCoaches();
            }
            try {
                localStorage.setItem('rosterView', view);
            } catch (e) {
                console.warn('Could not save roster view preference:', e);
            }
        }

        function applyRosterPreferences() {
            let savedView = 'riders';
            let savedRiderGroupBy = '';
            let savedCoachGroupBy = '';
            try {
                savedView = localStorage.getItem('rosterView') || 'riders';
                savedRiderGroupBy = localStorage.getItem('rosterRiderGroupBy') || '';
                savedCoachGroupBy = localStorage.getItem('rosterCoachGroupBy') || '';
            } catch (e) {
                console.warn('Could not load roster preferences:', e);
            }
            const riderGroupBySelect = document.getElementById('rider-group-by');
            if (riderGroupBySelect && savedRiderGroupBy) {
                riderGroupBySelect.value = savedRiderGroupBy;
            }
            const coachGroupBySelect = document.getElementById('coach-group-by');
            if (coachGroupBySelect && savedCoachGroupBy) {
                coachGroupBySelect.value = savedCoachGroupBy;
            }
            riderGroupBy = savedRiderGroupBy || '';
            coachGroupBy = savedCoachGroupBy || '';
            toggleRosterView(savedView);
        }


        // ===== PRACTICE ATTENDANCE & PLANNER RENDERING =====
        function renderPracticeAttendanceLists() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                console.error('❌ No ride found in renderPracticeAttendanceLists');
                return;
            }
            
            console.log('🔵 renderPracticeAttendanceLists: Starting for ride ID:', ride.id);
            console.log('🔵 renderPracticeAttendanceLists: ride.availableRiders BEFORE initialization:', {
                isArray: Array.isArray(ride.availableRiders),
                length: ride.availableRiders?.length,
                value: ride.availableRiders,
                first10: ride.availableRiders?.slice(0, 10)
            });
            
            // Ensure default attendance is set (all riders for regular practices, filtered for refined)
            const isRefined = isRideRefined(ride);
            ensureRideAttendanceDefaults(ride);
            
            console.log('🔵 renderPracticeAttendanceLists: ride.availableRiders BEFORE normalization:', {
                length: ride.availableRiders.length,
                first10: ride.availableRiders.slice(0, 10),
                types: ride.availableRiders.slice(0, 10).map(id => typeof id)
            });
            
            // Normalize availableRiders IDs for consistency
            ride.availableRiders = ride.availableRiders.map(id => {
                const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                return Number.isFinite(normalized) ? normalized : id;
            });
            
            console.log('🔵 renderPracticeAttendanceLists: ride.availableRiders AFTER normalization:', {
                length: ride.availableRiders.length,
                first10: ride.availableRiders.slice(0, 10),
                types: ride.availableRiders.slice(0, 10).map(id => typeof id)
            });
            if (!Array.isArray(ride.availableCoaches)) {
                ride.availableCoaches = []; // No coaches available by default
            } else {
                const validCoachIds = new Set((data.coaches || []).map(coach => {
                    const id = typeof coach.id === 'string' ? parseInt(coach.id, 10) : coach.id;
                    return Number.isFinite(id) ? id : coach.id;
                }));
                const hasRoster = validCoachIds.size > 0;
                // Normalize IDs to numbers for consistent comparison
                ride.availableCoaches = ride.availableCoaches
                    .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                    .filter(id => Number.isFinite(id) && (!hasRoster || validCoachIds.has(id)));
                ride.availableCoaches = Array.from(new Set(ride.availableCoaches)); // Deduplicate
            }
            
            // Build rider assignment map
            const riderAssignmentMap = {};
            const groupLabelMap = {};
            ride.groups.forEach(group => {
                groupLabelMap[group.id] = group.label;
                group.riders.forEach(riderId => {
                    riderAssignmentMap[riderId] = group.id;
                });
            });
            
            // Build coach assignment map
            const coachAssignmentMap = getCoachAssignmentMap(ride);
            
            // Get sort preferences
            const ridersSort = ride.practiceRidersSort || 'pace';
            const coachesSort = ride.practiceCoachesSort || 'pace';
            const ridersSortDirection = ride.practiceRidersSortDirection || 'asc';
            const coachesSortDirection = ride.practiceCoachesSortDirection || 'asc';
            
            // Process and sort riders (show all riders)
            // Normalize availableRiders IDs for comparison
            const normalizedAvailableRiderIds = new Set(ride.availableRiders.map(id => {
                const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                return Number.isFinite(normalized) ? normalized : id;
            }));
            
            // FINAL STEP: For refined practices, filter to only show qualifying riders
            let ridersToShow = data.riders || [];
            if (isRefined) {
                const practice = getPracticeForRide(ride);
                if (practice) {
                    const filteredRiders = getFilteredRidersForPractice(practice);
                    // Normalize IDs for consistent comparison
                    const qualifyingRiderIds = new Set(filteredRiders.map(r => {
                        const id = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id;
                        return Number.isFinite(id) ? id : r.id;
                    }));
                    ridersToShow = ridersToShow.filter(rider => {
                        const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                        const normalizedId = Number.isFinite(riderId) ? riderId : rider.id;
                        return qualifyingRiderIds.has(normalizedId);
                    });
                    console.log('🔵 renderPracticeAttendanceLists: Refined practice - showing', ridersToShow.length, 'qualifying riders out of', (data.riders || []).length, 'total riders');
                }
            }
            
            const ridersData = ridersToShow.map(rider => {
                // Normalize rider ID for comparison
                const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                const isAvailable = Number.isFinite(riderId) ? normalizedAvailableRiderIds.has(riderId) : ride.availableRiders.includes(rider.id);
                const assignedGroupId = riderAssignmentMap[rider.id];
                const assignedGroupLabel = assignedGroupId ? groupLabelMap[assignedGroupId] : null;
                
                const fitnessScale = getFitnessScale();
                const skillsScale = getSkillsScale();
                
                // Extract firstName and lastName
                let firstName = rider.firstName || '';
                let lastName = rider.lastName || '';
                if (!firstName && !lastName && rider.name) {
                    const nameParts = rider.name.trim().split(' ');
                    if (nameParts.length > 1) {
                        lastName = nameParts.pop() || '';
                        firstName = nameParts.join(' ') || '';
                    } else {
                        firstName = nameParts[0] || '';
                    }
                }
                
                return {
                    rider,
                    isAvailable,
                    assignedGroupId,
                    assignedGroupLabel,
                    fitness: Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10))),
                    skills: Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10))),
                    grade: parseInt(rider.grade || '0', 10) || 0,
                    gender: (rider.gender || 'M').toUpperCase(),
                    firstName: (firstName || '').toLowerCase(),
                    lastName: (lastName || getSortableLastName(rider.name || '')).toLowerCase(),
                    name: (rider.name || '').toLowerCase()
                };
            });
            
            // Separate attending (available) and non-attending riders, then sort each group
            const attendingRiders = ridersData.filter(r => r.isAvailable);
            const nonAttendingRiders = ridersData.filter(r => !r.isAvailable);
            
            // STEP 3: For refined practices, sort so available riders are at the top
            // For regular practices, use normal sorting
            // Reuse isRefined variable already declared above
            
            // Helper function to sort riders by the selected criteria
            const sortRidersByCriteria = (a, b) => {
                let compare = 0;
                if (ridersSort === 'assignedGroup') {
                    // Sort by assigned group - unassigned first, then by group label
                    if ((a.assignedGroupId !== null) !== (b.assignedGroupId !== null)) {
                        compare = a.assignedGroupId !== null ? 1 : -1; // Unassigned first
                    } else if (a.assignedGroupId && b.assignedGroupId) {
                        compare = (a.assignedGroupLabel || '').localeCompare(b.assignedGroupLabel || '');
                        if (compare === 0) {
                            compare = a.lastName.localeCompare(b.lastName);
                        }
                    } else {
                        compare = a.lastName.localeCompare(b.lastName);
                    }
                } else if (ridersSort === 'availability') {
                    // Sort by availability - available first
                    if (a.isAvailable !== b.isAvailable) {
                        compare = a.isAvailable ? -1 : 1;
                    } else if ((a.assignedGroupId !== null) !== (b.assignedGroupId !== null)) {
                        compare = a.assignedGroupId !== null ? 1 : -1;
                    } else {
                        compare = a.lastName.localeCompare(b.lastName);
                    }
                } else {
                    // For other sorts, keep existing logic but apply to all riders
                    if (ridersSort === 'pace') {
                        compare = b.fitness !== a.fitness ? b.fitness - a.fitness : a.lastName.localeCompare(b.lastName);
                    } else if (ridersSort === 'skills') {
                        compare = b.skills !== a.skills ? b.skills - a.skills : a.lastName.localeCompare(b.lastName);
                    } else if (ridersSort === 'grade') {
                        compare = b.grade !== a.grade ? b.grade - a.grade : a.lastName.localeCompare(b.lastName);
                    } else if (ridersSort === 'gender') {
                        compare = a.gender !== b.gender ? a.gender.localeCompare(b.gender) : a.lastName.localeCompare(b.lastName);
                    } else if (ridersSort === 'firstName') {
                        const firstNameCompare = a.firstName.localeCompare(b.firstName);
                        compare = firstNameCompare !== 0 ? firstNameCompare : a.lastName.localeCompare(b.lastName);
                    } else if (ridersSort === 'lastName') {
                        const lastNameCompare = a.lastName.localeCompare(b.lastName);
                        compare = lastNameCompare !== 0 ? lastNameCompare : a.firstName.localeCompare(b.firstName);
                    } else { // fallback
                        compare = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                    }
                }
                return ridersSortDirection === 'asc' ? compare : -compare;
            };
            
            // NEW SORTING STRUCTURE:
            // 1. Unassigned attending riders (at top)
            // 2. Divider
            // 3. Assigned attending riders
            // 4. Divider  
            // 5. Not attending riders
            const unassignedAttending = attendingRiders.filter(r => !r.assignedGroupId);
            const assignedAttending = attendingRiders.filter(r => r.assignedGroupId);
            const notAttending = nonAttendingRiders;
            
            // Sort each group by the selected criteria
            const unassignedAttendingSorted = [...unassignedAttending].sort(sortRidersByCriteria);
            const assignedAttendingSorted = [...assignedAttending].sort(sortRidersByCriteria);
            const notAttendingSorted = [...notAttending].sort(sortRidersByCriteria);
            
            // Combine with divider markers
            let sortedRiders = [];
            if (unassignedAttendingSorted.length > 0) {
                sortedRiders.push(...unassignedAttendingSorted);
            }
            if (unassignedAttendingSorted.length > 0 && (assignedAttendingSorted.length > 0 || notAttendingSorted.length > 0)) {
                sortedRiders.push({ isDivider: true, type: 'unassigned-to-assigned' });
            }
            if (assignedAttendingSorted.length > 0) {
                sortedRiders.push(...assignedAttendingSorted);
            }
            if (assignedAttendingSorted.length > 0 && notAttendingSorted.length > 0) {
                sortedRiders.push({ isDivider: true, type: 'assigned-to-unavailable' });
            }
            if (notAttendingSorted.length > 0) {
                sortedRiders.push(...notAttendingSorted);
            }
            
            // Render riders list
            const ridersList = document.getElementById('practice-riders-list');
            // Save scroll position before re-rendering
            let ridersScrollTop = 0;
            if (ridersList) {
                // Find the scrollable content area (the div with overflow-y: auto)
                const ridersScrollable = ridersList.querySelector('.attendance-list, .drop-list') || ridersList.querySelector('div[style*="overflow"]') || ridersList;
                ridersScrollTop = ridersScrollable.scrollTop || 0;
            }
            if (ridersList) {
                const riderCardsHtml = sortedRiders.map((item) => {
                    // Handle divider items
                    if (item.isDivider) {
                        return '<div class="attendance-divider" style="height: 2px; background: #ccc; margin: 12px 0; width: 100%; border-top: 1px solid #999; border-bottom: 1px solid #999;"></div>';
                    }
                    
                    const { rider, isAvailable, assignedGroupLabel, assignedGroupId } = item;
                    const assignmentLabel = assignedGroupLabel 
                        ? `(Group ${assignedGroupLabel.replace('Group ', '')})` 
                        : (assignedGroupId === null ? '(Unassigned)' : '');
                    return renderRiderCardHtml(rider, {
                        draggable: isAvailable,
                        showAttendance: true,
                        isAvailable,
                        assignmentLabel,
                        checkboxHandler: null, // Using event delegation instead
                        compact: true,
                        sortBy: ridersSort,
                        noPhoto: true, // Remove headshots from practice attendance list
                        inGroup: false, // Not in group, but may be unavailable in attendance list
                        showUnavailableStyle: !isAvailable && assignedGroupId !== null // Show styling if unavailable and assigned to group
                    });
                }).join('');
                
                // For refined practices, show count of qualifying riders; for regular, show all riders
                const totalRiders = isRefined ? ridersData.length : (data.riders ? data.riders.length : 0);
                const attendingRidersCount = attendingRiders.length;
                
                // Create header outside scrollable area
                const ridersHeader = document.createElement('div');
                ridersHeader.style.cssText = 'background: #fff; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0;';
                ridersHeader.innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: space-between;">
                        <h3 style="margin: 0;">Riders <span style="font-weight: normal; font-size: 14px; color: #666;">(${attendingRidersCount} of ${totalRiders}${isRefined ? ' qualifying' : ''})</span></h3>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <button class="btn-small" onclick="togglePracticeRidersSortDirection()" title="Reverse sort order" aria-label="Reverse sort order" style="padding: 4px 6px; min-width: 28px;">
                                ${ridersSortDirection === 'asc' ? '↑' : '↓'}
                            </button>
                            <select class="group-sort-select" onchange="changePracticeRidersSort(this.value)" title="Sort by" style="font-size: 12px; padding: 4px 8px;">
                                <option value="pace" ${ridersSort === 'pace' ? 'selected' : ''}>Sort by: Endurance</option>
                                <option value="skills" ${ridersSort === 'skills' ? 'selected' : ''}>Sort by: Descending</option>
                                <option value="climbing" ${ridersSort === 'climbing' ? 'selected' : ''}>Sort by: Climbing</option>
                                <option value="grade" ${ridersSort === 'grade' ? 'selected' : ''}>Sort by: Grade</option>
                                <option value="gender" ${ridersSort === 'gender' ? 'selected' : ''}>Sort by: Gender</option>
                                <option value="firstName" ${ridersSort === 'firstName' ? 'selected' : ''}>Sort by: First Name</option>
                                <option value="lastName" ${ridersSort === 'lastName' ? 'selected' : ''}>Sort by: Last Name</option>
                                <option value="assignedGroup" ${ridersSort === 'assignedGroup' ? 'selected' : ''}>Sort by: Assigned Group</option>
                                <option value="availability" ${ridersSort === 'availability' ? 'selected' : ''}>Sort by: Availability</option>
                            </select>
                            <div class="checkbox-actions">
                                <button class="btn-small" onclick="setAllPracticeRiders(true)">Select All</button>
                                <button class="btn-small secondary" onclick="setAllPracticeRiders(false)">Clear All</button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Create scrollable content area
                const ridersContent = document.createElement('div');
                ridersContent.className = 'rider-drop-list attendance-list';
                ridersContent.setAttribute('data-drop-type', 'rider');
                ridersContent.setAttribute('data-group-id', 'unassigned');
                ridersContent.setAttribute('ondrop', 'drop(event)');
                ridersContent.setAttribute('ondragover', 'allowDrop(event)');
                ridersContent.setAttribute('ondragleave', 'dragLeave(event)');
                ridersContent.style.cssText = 'overflow-y: auto; flex: 1; min-height: 0; border: none;';
                ridersContent.innerHTML = riderCardsHtml || '<div class="empty-message">No riders in roster.</div>';
                
                // Clear and rebuild structure
                ridersList.innerHTML = '';
                ridersList.appendChild(ridersHeader);
                ridersList.appendChild(ridersContent);
                
                // Attach event listeners to checkboxes using event delegation
                // Use 'click' event instead of 'change' to catch the state after it changes
                ridersContent.addEventListener('click', function handleRiderCheckboxClick(e) {
                    // Only handle clicks on checkboxes
                    if (e.target.type !== 'checkbox' || !e.target.classList.contains('attendance-checkbox-input') || e.target.dataset.attendanceType !== 'rider') {
                        return;
                    }
                    
                    // Use setTimeout to read the checkbox state after it's been updated by the browser
                    setTimeout(() => {
                        const riderId = parseInt(e.target.dataset.riderId, 10);
                        const isAvailable = e.target.checked;
                        
                        if (Number.isFinite(riderId)) {
                            toggleRiderAvailability(riderId, isAvailable);
                        } else {
                            console.error('🔴 Invalid riderId:', e.target.dataset.riderId);
                        }
                    }, 0);
                });
                
                // Allow clicking rider names to toggle their attendance checkbox
                ridersContent.addEventListener('click', function handleRiderNameClick(e) {
                    const nameTarget = e.target.closest('.attendance-name');
                    if (!nameTarget) return;
                    
                    const card = nameTarget.closest('.rider-card');
                    const checkbox = card ? card.querySelector('.attendance-checkbox-input') : null;
                    if (!checkbox) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    checkbox.click();
                });
                
                // Restore scroll position after re-rendering
                if (ridersScrollTop > 0) {
                    // Use requestAnimationFrame to ensure DOM is updated
                    requestAnimationFrame(() => {
                        const newScrollable = ridersList.querySelector('.attendance-list') || ridersList.querySelector('.drop-list');
                        if (newScrollable) {
                            newScrollable.scrollTop = ridersScrollTop;
                        }
                    });
                }
            }
            
            // Process and sort coaches - exclude N/A level coaches
            const coachesData = data.coaches
                .filter(coach => {
                    // Exclude coaches with N/A coaching level
                    const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                    return levelRaw !== 'N/A' && levelRaw !== 'N/a' && levelRaw !== 'n/a';
                })
                .map((coach, index) => {
                // Normalize IDs for comparison (handle both string and number IDs)
                const coachId = typeof coach.id === 'string' ? parseInt(coach.id, 10) : coach.id;
                const isAvailable = Number.isFinite(coachId) && ride.availableCoaches.includes(coachId);
                
                // Debug first few coaches
                if (index < 3) {
                }
                
                let assignedGroupId = null;
                let assignedGroupLabel = null;
                
                // Check if coach is assigned to any group using the assignment map
                const assignment = coachAssignmentMap[coach.id];
                if (assignment) {
                    assignedGroupId = assignment.groupId;
                    assignedGroupLabel = groupLabelMap[assignment.groupId];
                }
                
                // Extract firstName and lastName
                let firstName = coach.firstName || '';
                let lastName = coach.lastName || '';
                if (!firstName && !lastName && coach.name) {
                    const nameParts = coach.name.trim().split(' ');
                    if (nameParts.length > 1) {
                        lastName = nameParts.pop() || '';
                        firstName = nameParts.join(' ') || '';
                    } else {
                        firstName = nameParts[0] || '';
                    }
                }
                
                return {
                    coach,
                    isAvailable,
                    assignedGroupId,
                    assignedGroupLabel,
                    fitness: getCoachFitnessValue(coach),
                    level: (() => {
                        const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                        if (levelRaw === 'N/A' || levelRaw === 'N/a' || levelRaw === 'n/a') return 0;
                        return parseInt(levelRaw, 10) || 0;
                    })(),
                    firstName: (firstName || '').toLowerCase(),
                    lastName: (lastName || getSortableLastName(coach.name || '')).toLowerCase(),
                    name: (coach.name || '').toLowerCase()
                };
            });
            
            // Separate attending and non-attending coaches
            const attendingCoaches = coachesData.filter(c => c.isAvailable);
            const nonAttendingCoaches = coachesData.filter(c => !c.isAvailable);
            
            // NEW SORTING STRUCTURE (same as riders):
            // 1. Unassigned attending coaches (at top)
            // 2. Divider
            // 3. Assigned attending coaches
            // 4. Divider  
            // 5. Not attending coaches
            const unassignedAttendingCoaches = attendingCoaches.filter(c => !c.assignedGroupId);
            const assignedAttendingCoaches = attendingCoaches.filter(c => c.assignedGroupId);
            const notAttendingCoaches = nonAttendingCoaches;
            
            // Helper function to sort coaches by the selected criteria
            const sortCoachesByCriteria = (a, b) => {
                let compare = 0;
                if (coachesSort === 'assignedGroup') {
                    // Sort by assigned group - unassigned first, then by group label
                    if ((a.assignedGroupId !== null) !== (b.assignedGroupId !== null)) {
                        compare = a.assignedGroupId !== null ? 1 : -1; // Unassigned first
                    } else if (a.assignedGroupId && b.assignedGroupId) {
                        compare = (a.assignedGroupLabel || '').localeCompare(b.assignedGroupLabel || '');
                        if (compare === 0) {
                            compare = a.lastName.localeCompare(b.lastName);
                        }
                    } else {
                        compare = a.lastName.localeCompare(b.lastName);
                    }
                } else if (coachesSort === 'availability') {
                    // Sort by availability - available first
                    if (a.isAvailable !== b.isAvailable) {
                        compare = a.isAvailable ? -1 : 1;
                    } else if ((a.assignedGroupId !== null) !== (b.assignedGroupId !== null)) {
                        compare = a.assignedGroupId !== null ? 1 : -1;
                    } else {
                        compare = a.lastName.localeCompare(b.lastName);
                    }
                } else {
                    // For other sorts, apply to all coaches
                    if (coachesSort === 'pace') {
                        const fitnessDiff = b.fitness - a.fitness;
                        compare = fitnessDiff !== 0 ? fitnessDiff : a.lastName.localeCompare(b.lastName);
                    } else if (coachesSort === 'level') {
                        const levelDiff = b.level - a.level;
                        compare = levelDiff !== 0 ? levelDiff : a.lastName.localeCompare(b.lastName);
                    } else if (coachesSort === 'firstName') {
                        const firstNameCompare = a.firstName.localeCompare(b.firstName);
                        compare = firstNameCompare !== 0 ? firstNameCompare : a.lastName.localeCompare(b.lastName);
                    } else if (coachesSort === 'lastName') {
                        const lastNameCompare = a.lastName.localeCompare(b.lastName);
                        compare = lastNameCompare !== 0 ? lastNameCompare : a.firstName.localeCompare(b.firstName);
                    } else { // fallback
                        compare = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                    }
                }
                return coachesSortDirection === 'asc' ? compare : -compare;
            };
            
            // Sort each group by the selected criteria
            const unassignedAttendingCoachesSorted = [...unassignedAttendingCoaches].sort(sortCoachesByCriteria);
            const assignedAttendingCoachesSorted = [...assignedAttendingCoaches].sort(sortCoachesByCriteria);
            const notAttendingCoachesSorted = [...notAttendingCoaches].sort(sortCoachesByCriteria);
            
            // Combine with divider markers
            let sortedCoaches = [];
            if (unassignedAttendingCoachesSorted.length > 0) {
                sortedCoaches.push(...unassignedAttendingCoachesSorted);
            }
            if (unassignedAttendingCoachesSorted.length > 0 && (assignedAttendingCoachesSorted.length > 0 || notAttendingCoachesSorted.length > 0)) {
                sortedCoaches.push({ isDivider: true, type: 'unassigned-to-assigned' });
            }
            if (assignedAttendingCoachesSorted.length > 0) {
                sortedCoaches.push(...assignedAttendingCoachesSorted);
            }
            if (assignedAttendingCoachesSorted.length > 0 && notAttendingCoachesSorted.length > 0) {
                sortedCoaches.push({ isDivider: true, type: 'assigned-to-unavailable' });
            }
            if (notAttendingCoachesSorted.length > 0) {
                sortedCoaches.push(...notAttendingCoachesSorted);
            }
            
            // Render coaches list
            const coachesList = document.getElementById('practice-coaches-list');
            // Save scroll position before re-rendering
            let coachesScrollTop = 0;
            if (coachesList) {
                // Find the scrollable content area (the div with overflow-y: auto)
                const coachesScrollable = coachesList.querySelector('.attendance-list') || coachesList.querySelector('.drop-list') || coachesList.querySelector('div[style*="overflow"]');
                if (coachesScrollable) {
                    coachesScrollTop = coachesScrollable.scrollTop || 0;
                }
            }
            if (coachesList) {
                const coachCardsHtml = sortedCoaches.map((item) => {
                    // Handle divider items
                    if (item.isDivider) {
                        return '<div class="attendance-divider" style="height: 2px; background: #ccc; margin: 12px 0; width: 100%; border-top: 1px solid #999; border-bottom: 1px solid #999;"></div>';
                    }
                    
                    const { coach, isAvailable, assignedGroupLabel, assignedGroupId } = item;
                    const assignmentLabel = assignedGroupLabel 
                        ? `(Group ${assignedGroupLabel.replace('Group ', '')})` 
                        : (assignedGroupId === null ? '(Unassigned)' : '');
                    return renderCoachCardHtml(coach, null, 'unassigned', {
                        draggable: isAvailable,
                        showAttendance: true,
                        isAvailable,
                        assignmentLabel,
                        checkboxHandler: null, // Using event delegation instead
                        compact: true,
                        sortBy: coachesSort,
                        noPhoto: true // Remove headshots from practice attendance list
                    });
                }).join('');
                
                const totalCoaches = data.coaches.length;
                const attendingCoachesCount = attendingCoaches.length;
                
                // Create header outside scrollable area
                const coachesHeader = document.createElement('div');
                coachesHeader.style.cssText = 'background: #fff; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0;';
                coachesHeader.innerHTML = `
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: space-between;">
                        <h3 style="margin: 0;">Coaches <span style="font-weight: normal; font-size: 14px; color: #666;">(${attendingCoachesCount} of ${totalCoaches})</span></h3>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                            <button class="btn-small" onclick="togglePracticeCoachesSortDirection()" title="Reverse sort order" aria-label="Reverse sort order" style="padding: 4px 6px; min-width: 28px;">
                                ${coachesSortDirection === 'asc' ? '↑' : '↓'}
                            </button>
                            <select class="group-sort-select" onchange="changePracticeCoachesSort(this.value)" title="Sort by" style="font-size: 12px; padding: 4px 8px;">
                                <option value="pace" ${coachesSort === 'pace' ? 'selected' : ''}>Sort by: Endurance</option>
                                <option value="climbing" ${coachesSort === 'climbing' ? 'selected' : ''}>Sort by: Climbing</option>
                                <option value="level" ${coachesSort === 'level' ? 'selected' : ''}>Sort by: Level</option>
                                <option value="firstName" ${coachesSort === 'firstName' ? 'selected' : ''}>Sort by: First Name</option>
                                <option value="lastName" ${coachesSort === 'lastName' ? 'selected' : ''}>Sort by: Last Name</option>
                                <option value="assignedGroup" ${coachesSort === 'assignedGroup' ? 'selected' : ''}>Sort by: Assigned Group</option>
                                <option value="availability" ${coachesSort === 'availability' ? 'selected' : ''}>Sort by: Availability</option>
                            </select>
                            <div class="checkbox-actions">
                                <button class="btn-small" onclick="setAllPracticeCoaches(true)">Select All</button>
                                <button class="btn-small secondary" onclick="setAllPracticeCoaches(false)">Clear All</button>
                            </div>
                        </div>
                    </div>
                `;
                
                // Create scrollable content area
                const coachesContent = document.createElement('div');
                coachesContent.className = 'coach-drop-list attendance-list';
                coachesContent.setAttribute('data-drop-type', 'coach');
                coachesContent.setAttribute('data-role', 'unassigned');
                coachesContent.setAttribute('data-group-id', 'unassigned');
                coachesContent.setAttribute('ondrop', 'drop(event)');
                coachesContent.setAttribute('ondragover', 'allowDrop(event)');
                coachesContent.setAttribute('ondragleave', 'dragLeave(event)');
                coachesContent.style.cssText = 'overflow-y: auto; flex: 1; min-height: 0; border: none;';
                coachesContent.innerHTML = coachCardsHtml || '<div class="empty-message">No coaches in roster.</div>';
                
                // Clear and rebuild structure
                coachesList.innerHTML = '';
                coachesList.appendChild(coachesHeader);
                coachesList.appendChild(coachesContent);
                
                // Attach event listeners to checkboxes using event delegation
                // Use 'click' event instead of 'change' to catch the state after it changes
                coachesContent.addEventListener('click', function handleCoachCheckboxClick(e) {
                    // Only handle clicks on checkboxes
                    if (e.target.type !== 'checkbox' || !e.target.classList.contains('attendance-checkbox-input') || e.target.dataset.attendanceType !== 'coach') {
                        return;
                    }
                    
                    // Use setTimeout to read the checkbox state after it's been updated by the browser
                    setTimeout(() => {
                        const coachId = parseInt(e.target.dataset.coachId, 10);
                        const isAvailable = e.target.checked;
                        
                        if (Number.isFinite(coachId)) {
                            toggleCoachAvailability(coachId, isAvailable);
                        } else {
                            console.error('🔴 Invalid coachId:', e.target.dataset.coachId);
                        }
                    }, 0);
                });
                
                // Allow clicking coach names to toggle their attendance checkbox
                coachesContent.addEventListener('click', function handleCoachNameClick(e) {
                    const nameTarget = e.target.closest('.attendance-name');
                    if (!nameTarget) return;
                    
                    const card = nameTarget.closest('.coach-card');
                    const checkbox = card ? card.querySelector('.attendance-checkbox-input') : null;
                    if (!checkbox) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    checkbox.click();
                });
                
                // Restore scroll position after re-rendering
                if (coachesScrollTop > 0) {
                    // Use requestAnimationFrame to ensure DOM is updated
                    requestAnimationFrame(() => {
                        const newScrollable = coachesList.querySelector('.attendance-list') || coachesList.querySelector('.drop-list');
                        if (newScrollable) {
                            newScrollable.scrollTop = coachesScrollTop;
                        }
                    });
                }
            }
            truncateOverflowingNames();
        }
        
        async function toggleRiderAvailability(riderId, isAvailable) {
            try {
            const ride = data.rides.find(r => r.id === data.currentRide);
                if (!ride) {
                    console.warn('toggleRiderAvailability: No current ride found');
                    return;
                }
                
                // Save state before change
                saveAssignmentState(ride);
                
                console.log('🔵 toggleRiderAvailability called:', { riderId, isAvailable, rideId: ride.id });
                console.log('🔵 toggleRiderAvailability: ride.availableRiders BEFORE:', {
                    length: ride.availableRiders?.length,
                    isArray: Array.isArray(ride.availableRiders),
                    first10: ride.availableRiders?.slice(0, 10)
                });
                
                // Normalize riderId to handle string/number mismatches
                const normalizedRiderId = typeof riderId === 'string' ? parseInt(riderId, 10) : riderId;
                if (!Number.isFinite(normalizedRiderId)) {
                    console.warn('toggleRiderAvailability: Invalid riderId:', riderId);
                    return;
                }
                
                // If isAvailable is not provided, determine from current state
                if (isAvailable === undefined || isAvailable === null) {
            if (!Array.isArray(ride.availableRiders)) {
                ride.availableRiders = [];
                    }
                    const normalizedAvailableRiders = ride.availableRiders.map(id => {
                        const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                        return Number.isFinite(normalized) ? normalized : id;
                    });
                    isAvailable = !normalizedAvailableRiders.includes(normalizedRiderId);
                }
                
                
                if (!Array.isArray(ride.availableRiders)) {
                    ride.availableRiders = [];
                }
                
                // Normalize IDs in availableRiders for comparison
                let normalizedAvailableRiders = ride.availableRiders.map(id => {
                    const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                    return Number.isFinite(normalized) ? normalized : id;
                });
            
            if (isAvailable) {
                    if (!normalizedAvailableRiders.includes(normalizedRiderId)) {
                        normalizedAvailableRiders.push(normalizedRiderId);
                }
            } else {
                    // When unchecked, remove from availableRiders
                    normalizedAvailableRiders = normalizedAvailableRiders.filter(id => id !== normalizedRiderId);
                    
                    // Check if practice is in the future or past
                    const practiceDate = parseISODate(ride.date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
                    
                    if (practiceDate) {
                        practiceDate.setHours(0, 0, 0, 0);
                        const isFuturePractice = practiceDate >= today;
                        
                        if (isFuturePractice) {
                            // For future practices: Remove rider completely from all groups
                            ride.groups.forEach(group => {
                                group.riders = group.riders.filter(id => {
                                    const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                                    return Number.isFinite(normalized) ? normalized !== normalizedRiderId : id !== normalizedRiderId;
                                });
                            });
                        } else {
                            // For past practices: KEEP rider in groups (they will show as greyed/unavailable)
                            // This preserves historical assignment data
                        }
                    }
                }
                
                // Update ride.availableRiders with the normalized array
                ride.availableRiders = normalizedAvailableRiders;
                ride.attendanceInitialized = true;
                
                console.log('🔵 toggleRiderAvailability: ride.availableRiders AFTER update:', {
                    length: ride.availableRiders.length,
                    first10: ride.availableRiders.slice(0, 10),
                    isAvailable,
                    normalizedRiderId
                });
            
            await saveRideToDB(ride);
            renderAssignments(ride);
            } catch (error) {
                console.error('Error in toggleRiderAvailability:', error);
                alert('Error toggling rider availability: ' + error.message);
            }
        }
        
        function toggleCoachAvailability(coachId, isAvailable) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                console.error('❌ No ride found');
                return;
            }
            
            ride.attendanceInitialized = true;
            
            // Debug: Check riders before modifying coaches
            if (!Array.isArray(ride.availableCoaches)) {
                ride.availableCoaches = [];
            }
            
            
            // Normalize coachId to number for consistent comparison
            const normalizedCoachId = typeof coachId === 'string' ? parseInt(coachId, 10) : coachId;
            if (!Number.isFinite(normalizedCoachId)) {
                console.error('❌ Invalid coachId:', coachId, 'normalized:', normalizedCoachId);
                return;
            }
            
            // Normalize ALL existing IDs in array first to ensure consistency
            const beforeNormalize = [...ride.availableCoaches];
            ride.availableCoaches = ride.availableCoaches.map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(id => Number.isFinite(id));
            
            // Deduplicate (in case normalization created duplicates)
            ride.availableCoaches = Array.from(new Set(ride.availableCoaches));
            
            
            if (isAvailable) {
                if (!ride.availableCoaches.includes(normalizedCoachId)) {
                    ride.availableCoaches.push(normalizedCoachId);
                }
            } else {
                // Coach unchecked - remove from available coaches and from all groups
                // This is allowed even if it makes groups non-compliant (groups will show red with warning)
                ride.availableCoaches = ride.availableCoaches.filter(id => id !== normalizedCoachId);
                
                // Remove coach from all groups (leader, sweep, roam, extraRoam)
                // Then optimize roles (e.g., if sweep removed and roam exists, promote roam to sweep)
                ride.groups.forEach(group => {
                    const leaderId = typeof group.coaches.leader === 'string' ? parseInt(group.coaches.leader, 10) : group.coaches.leader;
                    const sweepId = typeof group.coaches.sweep === 'string' ? parseInt(group.coaches.sweep, 10) : group.coaches.sweep;
                    const roamId = typeof group.coaches.roam === 'string' ? parseInt(group.coaches.roam, 10) : group.coaches.roam;
                    
                    // Track which role was removed
                    let removedRole = null;
                    if (leaderId === normalizedCoachId) {
                        group.coaches.leader = null;
                        removedRole = 'leader';
                    }
                    if (sweepId === normalizedCoachId) {
                        group.coaches.sweep = null;
                        removedRole = 'sweep';
                    }
                    if (roamId === normalizedCoachId) {
                        group.coaches.roam = null;
                        removedRole = 'roam';
                    }
                    if (Array.isArray(group.coaches.extraRoam)) {
                        const hadExtraRoam = group.coaches.extraRoam.includes(normalizedCoachId);
                        group.coaches.extraRoam = group.coaches.extraRoam
                            .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
                            .filter(id => Number.isFinite(id) && id !== normalizedCoachId);
                        if (hadExtraRoam && group.coaches.extraRoam.length === 0) {
                            removedRole = 'extraRoam';
                    }
                    }
                    
                    // Optimize coach roles after removal
                    optimizeGroupCoachRoles(group);
                });
            }
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        function changePracticeRidersSort(sortBy) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const validSorts = ['pace', 'skills', 'grade', 'gender', 'firstName', 'lastName', 'assignedGroup', 'availability'];
            if (!validSorts.includes(sortBy)) {
                sortBy = 'pace';
            }
            
            ride.practiceRidersSort = sortBy;
            saveRideToDB(ride);
            renderPracticeAttendanceLists();
        }

        function togglePracticeRidersSortDirection() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const current = ride.practiceRidersSortDirection || 'asc';
            ride.practiceRidersSortDirection = current === 'asc' ? 'desc' : 'asc';
            saveRideToDB(ride);
            renderPracticeAttendanceLists();
        }

        function getPracticeReportingRides() {
            const rides = Array.isArray(data.rides) ? data.rides.filter(r => r && !r.deleted && r.date) : [];
            const mapped = rides.map(ride => {
                const dateObj = parseISODate(ride.date);
                return Number.isNaN(dateObj?.getTime?.()) ? null : { ride, dateObj };
            }).filter(Boolean);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const completed = mapped.filter(entry => entry.dateObj <= today);
            const list = (completed.length > 0 ? completed : mapped).sort((a, b) => a.dateObj - b.dateObj);
            return list.map(entry => entry.ride);
        }

        function renderPracticeReporting() {
            const dateEl = document.getElementById('practice-reporting-date');
            const summaryEl = document.getElementById('practice-reporting-summary');
            const prevBtn = document.getElementById('practice-reporting-prev');
            const nextBtn = document.getElementById('practice-reporting-next');
            const titleEl = document.getElementById('practice-reporting-title');
            const sortIndicator = document.getElementById('practice-reporting-sort-indicator');
            const tableBody = document.getElementById('practice-reporting-table-body');
            if (!tableBody || !dateEl || !summaryEl || !prevBtn || !nextBtn || !titleEl || !sortIndicator) return;

            const rides = getPracticeReportingRides();
            if (rides.length === 0) {
                practiceReportingRideIndex = null;
                dateEl.textContent = 'No practices found';
                summaryEl.textContent = '';
                titleEl.textContent = 'Practice Reporting';
                sortIndicator.textContent = practiceReportingSortDirection === 'asc' ? '↑' : '↓';
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                tableBody.innerHTML = '<tr><td colspan="2" style="padding: 12px; color: #666;">No practice data yet.</td></tr>';
                return;
            }

            if (practiceReportingRideIndex === null || practiceReportingRideIndex < 0 || practiceReportingRideIndex >= rides.length) {
                practiceReportingRideIndex = rides.length - 1;
            }

            const ride = rides[practiceReportingRideIndex];
            const rideDate = ride?.date ? parseISODate(ride.date) : null;
            const dateLabel = rideDate ? rideDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
            dateEl.textContent = dateLabel;
            titleEl.textContent = `Practice Reporting: ${dateLabel}`;
            sortIndicator.textContent = practiceReportingSortDirection === 'asc' ? '↑' : '↓';

            prevBtn.disabled = practiceReportingRideIndex <= 0;
            nextBtn.disabled = practiceReportingRideIndex >= rides.length - 1;

            const availableIds = Array.isArray(ride.availableRiders) ? ride.availableRiders : [];
            const availableSet = new Set(availableIds.map(id => {
                const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                return Number.isFinite(normalized) ? normalized : id;
            }));

            const sortedRiders = [...(data.riders || [])].sort((a, b) => {
                const aLast = getSortableLastName(a.name || '');
                const bLast = getSortableLastName(b.name || '');
                if (aLast !== bLast) return aLast.localeCompare(bLast);
                const aFirst = (a.name || '').toLowerCase();
                const bFirst = (b.name || '').toLowerCase();
                return aFirst.localeCompare(bFirst);
            });
            if (practiceReportingSortDirection === 'desc') {
                sortedRiders.reverse();
            }

            let attendedCount = 0;
            let absentCount = 0;
            const rows = sortedRiders.map(rider => {
                const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                const attended = availableSet.has(riderId);
                if (attended) attendedCount++;
                else absentCount++;
                const status = attended ? 'Attended' : 'Absent';
                const statusColor = attended ? '#2e7d32' : '#c62828';
                const nameColor = attended ? '#333' : '#c62828';
                return `
                    <tr>
                        <td style="padding: 10px; border-top: 1px solid #eee; color: ${nameColor};">${escapeHtml(rider.name || 'Unnamed Rider')}</td>
                        <td onclick="togglePracticeReportingStatus(${ride.id}, ${riderId})" style="padding: 10px; border-top: 1px solid #eee; color: ${statusColor}; font-weight: 600; cursor: pointer;">${status}</td>
                    </tr>
                `;
            });

            summaryEl.textContent = `${attendedCount} attended, ${absentCount} absent`;
            tableBody.innerHTML = rows.join('') || '<tr><td colspan="2" style="padding: 12px; color: #666;">No riders found.</td></tr>';
        }

        function navigatePracticeReporting(offset) {
            const rides = getPracticeReportingRides();
            if (rides.length === 0) return;
            if (practiceReportingRideIndex === null) {
                practiceReportingRideIndex = rides.length - 1;
            } else {
                practiceReportingRideIndex = Math.max(0, Math.min(rides.length - 1, practiceReportingRideIndex + offset));
            }
            renderPracticeReporting();
        }

        function togglePracticeReportingSort() {
            practiceReportingSortDirection = practiceReportingSortDirection === 'asc' ? 'desc' : 'asc';
            renderPracticeReporting();
        }

        function togglePracticeReportingStatus(rideId, riderId) {
            const ride = data.rides.find(r => r.id === rideId);
            if (!ride) return;
            if (!Array.isArray(ride.availableRiders)) {
                ride.availableRiders = [];
            }
            const normalizedId = typeof riderId === 'string' ? parseInt(riderId, 10) : riderId;
            const idToUse = Number.isFinite(normalizedId) ? normalizedId : riderId;
            const existingIndex = ride.availableRiders.findIndex(id => {
                const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                return (Number.isFinite(normalized) ? normalized : id) === idToUse;
            });
            if (existingIndex >= 0) {
                ride.availableRiders.splice(existingIndex, 1);
            } else {
                ride.availableRiders.push(idToUse);
            }
            ride.attendanceInitialized = true;
            saveRideToDB(ride);
            renderPracticeReporting();
        }

        function toggleUnassignedPaletteVisibility() {
            const palette = document.getElementById('new-attendees-sticky');
            if (!palette) return;
            
            // Check if the pasteboard is currently expanded by looking for the content area
            const hasContent = palette.querySelector('.unassigned-list-container') !== null;
            
            if (hasContent) {
                // Currently expanded, so hide it
                unassignedPaletteVisibility = 'hide';
            } else {
                // Currently collapsed, so show it
                unassignedPaletteVisibility = 'show';
            }
            renderAssignments(data.rides.find(r => r.id === data.currentRide));
        }

        function updateUnassignedPaletteToggleButton(isVisible) {
            const toggleBtn = document.getElementById('unassigned-palette-toggle-btn');
            if (!toggleBtn) return;
            toggleBtn.textContent = isVisible ? 'Hide Pasteboard' : 'Show Pasteboard';
        }

        function startUnassignedPaletteResize(event) {
            event.preventDefault();
            const startY = event.clientY;
            const startHeight = unassignedPaletteHeight;
            const onMove = (moveEvent) => {
                const delta = moveEvent.clientY - startY;
                const nextHeight = Math.max(140, Math.min(600, startHeight + delta));
                unassignedPaletteHeight = nextHeight;
                document.querySelectorAll('[data-unassigned-list="true"]').forEach(list => {
                    list.style.height = `${nextHeight}px`;
                    list.style.maxHeight = `${nextHeight}px`;
                });
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }
        
        function changePracticeCoachesSort(sortBy) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const validSorts = ['pace', 'level', 'firstName', 'lastName', 'assignedGroup', 'availability'];
            if (!validSorts.includes(sortBy)) {
                sortBy = 'pace';
            }
            
            ride.practiceCoachesSort = sortBy;
            saveRideToDB(ride);
            renderPracticeAttendanceLists();
        }

        function togglePracticeCoachesSortDirection() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const current = ride.practiceCoachesSortDirection || 'asc';
            ride.practiceCoachesSortDirection = current === 'asc' ? 'desc' : 'asc';
            saveRideToDB(ride);
            renderPracticeAttendanceLists();
        }
        
        function setAllPracticeRiders(selectAll) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                console.warn('setAllPracticeRiders: No current ride found');
                return;
            }
            
            console.log('🔵 setAllPracticeRiders called:', { selectAll, rideId: ride.id });
            console.log('🔵 setAllPracticeRiders: ride.availableRiders BEFORE:', {
                length: ride.availableRiders?.length,
                first10: ride.availableRiders?.slice(0, 10)
            });
            
            if (selectAll) {
                ride.availableRiders = data.riders ? data.riders.map(r => r.id) : [];
                console.log('🔵 setAllPracticeRiders: Selected all', ride.availableRiders.length, 'riders');
            } else {
                ride.availableRiders = [];
                console.log('🔵 setAllPracticeRiders: Cleared all riders');
                // Remove riders from all groups if clearing all
                ride.groups.forEach(group => {
                    group.riders = [];
                });
            }
            
            ride.attendanceInitialized = true;
            
            console.log('🔵 setAllPracticeRiders: ride.availableRiders AFTER:', {
                length: ride.availableRiders.length,
                first10: ride.availableRiders.slice(0, 10)
            });
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        function setAllPracticeCoaches(selectAll) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            if (selectAll) {
                ride.availableCoaches = data.coaches.map(c => c.id);
            } else {
                ride.availableCoaches = [];
                // Remove coaches from all groups if clearing all
                ride.groups.forEach(group => {
                    if (group.coaches.leader) group.coaches.leader = null;
                    if (group.coaches.sweep) group.coaches.sweep = null;
                    if (group.coaches.roam) group.coaches.roam = null;
                    if (Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = [];
                    }
                });
            }
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        // Attendance frame resizing (state vars in app-state.js)
        
        function startResizeAttendance(event) {
            event.preventDefault();
            attendanceResizeActive = true;
            attendanceResizeStartY = event.clientY;
            const container = document.getElementById('practice-attendance-lists-container');
            if (container) {
                attendanceResizeStartHeight = container.offsetHeight;
            }
            
            document.addEventListener('mousemove', handleAttendanceResize);
            document.addEventListener('mouseup', stopResizeAttendance);
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        }
        
        function handleAttendanceResize(event) {
            if (!attendanceResizeActive) return;
            
            const deltaY = event.clientY - attendanceResizeStartY;
            const container = document.getElementById('practice-attendance-lists-container');
            if (container) {
                const newHeight = Math.max(200, Math.min(800, attendanceResizeStartHeight + deltaY));
                container.style.height = newHeight + 'px';
            }
        }
        
        function stopResizeAttendance() {
            attendanceResizeActive = false;
            document.removeEventListener('mousemove', handleAttendanceResize);
            document.removeEventListener('mouseup', stopResizeAttendance);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        function updateGroupRoute(groupId, routeId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const group = ride.groups.find(g => String(g.id) === String(groupId));
            if (!group) return;
            
            // Handle "Ride Leader's Choice" option
            if (routeId === 'leader-choice') {
                group.routeId = 'leader-choice';
            } else {
                group.routeId = routeId || null;
            }
            saveRideToDB(ride);
            
            // Re-render assignments to show/hide route preview
            renderAssignments(ride);
            // updateRoutePreviews is called inside renderAssignments
        }

        function handleRouteSelectChange(groupId, value, rideId, selectEl) {
            if (value === '__toggle_all_locations__') {
                // Toggle the location filter, then re-render
                toggleRouteLocationFilter(rideId);
                return;
            }
            if (value === '__toggle_this_location__') {
                // Toggle back to filtered, then re-render
                toggleRouteLocationFilter(rideId);
                return;
            }
            // Normal route selection
            updateGroupRoute(groupId, value);
        }

        function toggleRouteLocationFilter(rideId) {
            // Normalize rideId for comparison (could be string or number)
            const numericId = typeof rideId === 'string' ? parseInt(rideId, 10) : rideId;
            if (showAllRouteLocationsForRide === numericId) {
                showAllRouteLocationsForRide = null;
            } else {
                showAllRouteLocationsForRide = numericId;
            }
            const ride = data.rides.find(r => r.id === numericId || String(r.id) === String(rideId));
            if (ride) {
                renderAssignments(ride);
            }
        }

        function renderRouteOptions(selectedRouteId, group, ride) {
            const routes = data.routes || [];
            if (routes.length === 0) {
                return '<option value="">No routes available</option>';
            }

            // Format: DISTANCE/ELEVATION - ROUTENAME [location suffix]
            function routeOptionHtml(route, suffix) {
                const selected = selectedRouteId && String(route.id) === String(selectedRouteId) ? 'selected' : '';
                const dist = route.distance ? escapeHtml(route.distance) : '';
                const elev = route.elevation ? escapeHtml(route.elevation) : '';
                const name = toBoldUnicode(escapeHtml(route.name || 'Unnamed Route'));
                let prefix = '';
                if (dist && elev) prefix = `${dist}/${elev} – `;
                else if (dist) prefix = `${dist} – `;
                else if (elev) prefix = `${elev} – `;
                let routeText = prefix + name;
                if (suffix) routeText += suffix;
                return `<option value="${route.id}" ${selected}>${routeText}</option>`;
            }

            // If no group or ride provided, render all routes (simple mode)
            if (!group || !ride) {
                let html = routes.map(route => routeOptionHtml(route, '')).join('');
                const leaderChoiceSelected = selectedRouteId && String(selectedRouteId) === 'leader-choice' ? 'selected' : '';
                html += `<option value="leader-choice" ${leaderChoiceSelected}>Ride Leader's Choice</option>`;
                return html;
            }

            // Determine practice location for route filtering
            const practiceLocation = (ride.meetLocation || '').trim().toLowerCase();
            const rideIdNum = typeof ride.id === 'string' ? parseInt(ride.id, 10) : ride.id;
            const showAllLocations = showAllRouteLocationsForRide === rideIdNum;

            // Split routes by location match
            let localRoutes = [];
            let otherLocationRoutes = [];

            if (practiceLocation && !showAllLocations) {
                routes.forEach(route => {
                    const routeLoc = (route.startLocation || '').trim().toLowerCase();
                    if (!routeLoc || routeLoc === practiceLocation) {
                        localRoutes.push(route);
                    }
                });
            } else if (practiceLocation && showAllLocations) {
                routes.forEach(route => {
                    const routeLoc = (route.startLocation || '').trim().toLowerCase();
                    if (!routeLoc || routeLoc === practiceLocation) {
                        localRoutes.push(route);
                    } else {
                        otherLocationRoutes.push(route);
                    }
                });
            } else {
                localRoutes = routes.slice();
            }

            // Build HTML — flat list, no time/fitness separators
            let html = '';
            localRoutes.forEach(route => { html += routeOptionHtml(route, ''); });

            // Other-location routes (only when showAllLocations is true)
            if (otherLocationRoutes.length > 0) {
                html += `<option disabled>── Other Locations ──</option>`;
                otherLocationRoutes.forEach(route => { html += routeOptionHtml(route, ` [${escapeHtml(route.startLocation || '')}]`); });
            }

            // Ride Leader's Choice
            const leaderChoiceSelected = selectedRouteId && String(selectedRouteId) === 'leader-choice' ? 'selected' : '';
            html += `<option value="leader-choice" ${leaderChoiceSelected}>Ride Leader's Choice</option>`;

            // Location toggle option at the bottom
            if (practiceLocation) {
                html += `<option disabled>──────────</option>`;
                if (showAllLocations) {
                    html += `<option value="__toggle_this_location__">↩ Show only routes from this location</option>`;
                } else {
                    html += `<option value="__toggle_all_locations__">📍 Load routes from all locations</option>`;
                }
            }

            return html;
        }

        function updateRoutePreviews() {
            // Populate route preview containers; use cached image when available, else cap live Strava embeds to avoid WebGL exhaustion (Safari)
            const previewContainers = document.querySelectorAll('.route-preview-container');
            let liveEmbedCount = 0;
            previewContainers.forEach(container => {
                const routeId = container.getAttribute('data-route-id');
                if (!routeId) return;
                
                const route = getRouteById(routeId);
                if (!route) {
                    container.style.display = 'none';
                    return;
                }
                if (route.cachedPreviewDataUrl) {
                    container.style.display = '';
                    container.innerHTML = `<img src="${escapeHtml(route.cachedPreviewDataUrl)}" alt="${escapeHtml(route.name || 'Route')}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">`;
                    let stravaUrl = route.stravaUrl || '';
                    if (!stravaUrl && route.stravaEmbedCode) {
                        const routeIdMatch = route.stravaEmbedCode.match(/data-embed-id\s*=\s*["']?(\d+)["']?/i);
                        if (routeIdMatch) stravaUrl = 'https://www.strava.com/routes/' + routeIdMatch[1];
                        else {
                            const iframeMatch = route.stravaEmbedCode.match(/src\s*=\s*["']([^"']*strava\.com[^"']*)["']/i);
                            if (iframeMatch) stravaUrl = iframeMatch[1].split('?')[0];
                        }
                    }
                    if (stravaUrl) {
                        const link = document.createElement('a');
                        link.href = stravaUrl;
                        link.target = '_blank';
                        link.rel = 'noopener';
                        link.style.cssText = 'position: absolute; bottom: 6px; right: 6px; font-size: 11px; color: #fc4c02;';
                        link.textContent = 'View on Strava';
                        container.style.position = 'relative';
                        container.appendChild(link);
                    }
                } else if (route.stravaEmbedCode) {
                    container.style.display = '';
                    if (liveEmbedCount < MAX_STRAVA_EMBEDS) {
                        container.innerHTML = route.stravaEmbedCode;
                        liveEmbedCount++;
                    } else {
                        let stravaUrl = route.stravaUrl || '';
                        if (!stravaUrl) {
                            const routeIdMatch = route.stravaEmbedCode.match(/data-embed-id\s*=\s*["']?(\d+)["']?/i);
                            if (routeIdMatch) stravaUrl = 'https://www.strava.com/routes/' + routeIdMatch[1];
                            else {
                                const iframeMatch = route.stravaEmbedCode.match(/src\s*=\s*["']([^"']*strava\.com[^"']*)["']/i);
                                if (iframeMatch) stravaUrl = iframeMatch[1].split('?')[0];
                            }
                        }
                        container.innerHTML = `<div style="padding: 12px; background: #f0f0f0; color: #666; font-size: 12px; text-align: center; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">${escapeHtml(route.name || 'Route')}<br><span style="font-size: 11px;">Map hidden to keep page responsive.</span>${stravaUrl ? `<br><a href="${escapeHtml(stravaUrl)}" target="_blank" rel="noopener" style="color: #fc4c02;">View on Strava</a>` : ''}</div>`;
                    }
                } else {
                    container.style.display = 'none';
                }
            });
        }

        function getCoachFirstNames(group) {
            const coachesList = [];
            
            if (group.coaches.leader) {
                const coach = getCoachById(group.coaches.leader);
                if (coach) coachesList.push(coach);
            }
            if (group.coaches.sweep) {
                const coach = getCoachById(group.coaches.sweep);
                if (coach) coachesList.push(coach);
            }
            if (group.coaches.roam) {
                const coach = getCoachById(group.coaches.roam);
                if (coach) coachesList.push(coach);
            }
            if (Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam.forEach(coachId => {
                    if (coachId) {
                        const coach = getCoachById(coachId);
                        if (coach) coachesList.push(coach);
                    }
                });
            }
            
            if (coachesList.length === 0) return '';
            
            // Extract first names
            const firstNames = coachesList.map(coach => {
                const name = coach.name || '';
                const parts = name.trim().split(/\s+/);
                return parts[0] || name;
            });
            
            // Check for duplicates and add last initial if needed
            const nameCounts = {};
            firstNames.forEach(name => {
                nameCounts[name] = (nameCounts[name] || 0) + 1;
            });
            
            const result = coachesList.map(coach => {
                const name = coach.name || '';
                const parts = name.trim().split(/\s+/);
                const firstName = parts[0] || name;
                
                // If duplicate first name, add last initial
                if (nameCounts[firstName] > 1 && parts.length > 1) {
                    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
                    return `${firstName} ${lastInitial}`;
                }
                return firstName;
            });
            
            return result.join(', ');
        }

        function getRiderFitnessRange(group, ride) {
            if (!group.riders || group.riders.length === 0) {
                return '0 riders';
            }

            const visibleSkills = (ride && ride.visibleSkills) || ['pace'];
            const riderObjects = group.riders
                .map(id => getRiderById(id))
                .filter(Boolean);

            if (riderObjects.length === 0) {
                return `${group.riders.length} riders`;
            }

            const skillConfigs = [
                { key: 'pace', field: 'fitness', label: 'Endurance', icon: '❤' },
                { key: 'climbing', field: 'climbing', label: 'Climbing', icon: '◢' },
                { key: 'skills', field: 'skills', label: 'Descending', icon: '◣' }
            ];

            const parts = [];
            for (const cfg of skillConfigs) {
                if (!visibleSkills.includes(cfg.key)) continue;
                const values = riderObjects
                    .map(r => parseInt(r[cfg.field] || '3', 10))
                    .filter(f => !isNaN(f));
                if (values.length === 0) continue;
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                const range = minVal === maxVal ? `${minVal}` : `${minVal}-${maxVal}`;
                parts.push(`${cfg.icon}${range}`);
            }

            if (parts.length === 0) {
                return `${group.riders.length} riders`;
            }
            return `${group.riders.length} riders, ${parts.join(' ')}`;
        }

        function checkGroupCompliance(group) {
            // Check if group has a leader that meets the minimum level setting
            if (!group.coaches.leader) {
                return false;
            }
            const leader = getCoachById(group.coaches.leader);
            if (!leader) return false;
            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
            const leaderLevel = parseInt(leader.coachingLicenseLevel || leader.level || '1', 10);
            if (!Number.isFinite(leaderLevel) || leaderLevel < minLeaderLevel) {
                return false;
            }
            
            // Check if group has at least one coach
            const coachCount = countGroupCoaches(group);
            if (coachCount === 0) {
                return false;
            }
            
            // Check coach/rider ratio
            const capacity = groupCapacity(group);
            if (coachCount > 0 && group.riders.length > capacity) {
                return false;
            }
            
            return true;
        }

        function updateGroupPaceOrder(value) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const normalized = normalizeGroupPaceOrder(value);
            ride.groupPaceOrder = normalized;
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            data.seasonSettings.groupPaceOrder = normalized;
            saveData();
            renderAssignments(ride);
        }

        function switchUnassignedView(view) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            if (view !== 'riders' && view !== 'coaches') {
                view = 'riders'; // Default to riders if invalid
            }
            
            ride.unassignedView = view;
            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function updateDebugOutput() {
            const debugEl = document.getElementById('auto-assign-debug');
            const copyBtn = document.getElementById('copy-debug-btn');
            if (!debugEl) return;
            if (autoAssignDebugLog) {
                debugEl.style.display = 'block';
                debugEl.textContent = autoAssignDebugLog;
                if (copyBtn) copyBtn.style.display = 'block';
            } else {
                debugEl.style.display = 'none';
                debugEl.textContent = '';
                if (copyBtn) copyBtn.style.display = 'none';
            }
        }
        
        function copyDebugToClipboard() {
            if (!autoAssignDebugLog) return;
            navigator.clipboard.writeText(autoAssignDebugLog).then(() => {
                const btn = document.getElementById('copy-debug-btn');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard. Please select and copy manually.');
            });
        }

        function addGroup() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            // Save state before change
            saveAssignmentState(ride);
            
            // Find next available group number
            const existingLabels = ride.groups.map(g => g.label).filter(Boolean);
            let nextNumber = 1;
            while (existingLabels.includes(`Group ${nextNumber}`)) {
                nextNumber++;
            }
            const group = createGroup(`Group ${nextNumber}`);
            ride.groups.push(group);
            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function changeGroupSort(groupId, sortBy) {
            // Legacy per-group sort — redirect to global
            changeGlobalGroupSort(sortBy);
        }

        function changeGlobalGroupSort(sortBy) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const validSorts = ['pace', 'skills', 'climbing', 'grade', 'gender', 'firstName', 'lastName', 'name'];
            if (!validSorts.includes(sortBy)) {
                sortBy = 'firstName';
            }
            
            ride.globalGroupSort = sortBy;

            // Auto-show skill badge if a skill sort is chosen but that skill isn't visible
            const skillSortMap = { pace: 'pace', climbing: 'climbing', skills: 'skills' };
            if (skillSortMap[sortBy]) {
                if (!ride.visibleSkills) ride.visibleSkills = [];
                if (!ride.visibleSkills.includes(skillSortMap[sortBy])) {
                    ride.visibleSkills.push(skillSortMap[sortBy]);
                }
            }

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        // Toggle visibility of a skill badge type across all groups
        function toggleSkillVisibility(skill) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            if (!ride.visibleSkills) {
                ride.visibleSkills = ['pace']; // default
            }
            
            const idx = ride.visibleSkills.indexOf(skill);
            if (idx >= 0) {
                ride.visibleSkills.splice(idx, 1);
            } else {
                ride.visibleSkills.push(skill);
            }
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function changePasteboardSort(sortBy) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            // Validate sortBy value
            const validSorts = ['pace', 'skills', 'grade', 'gender', 'name'];
            if (!validSorts.includes(sortBy)) {
                sortBy = 'pace'; // Default to pace if invalid
            }
            
            ride.pasteboardSort = sortBy;
            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function startPasteboardDividerResize(event) {
            event.preventDefault();
            event.stopPropagation();
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const startX = event.clientX;
            const container = event.currentTarget.parentElement;
            const ridersDiv = container.querySelector('[data-drop-type="rider"]').parentElement;
            const coachesDiv = container.querySelector('[data-drop-type="coach"]').parentElement;
            
            const startRidersWidth = ride.pasteboardRidersWidth || 1;
            const startCoachesWidth = ride.pasteboardCoachesWidth || 1;
            const totalFlex = startRidersWidth + startCoachesWidth;
            const containerWidth = container.offsetWidth;
            const dividerWidth = 8; // Width of divider
            
            const onMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const deltaPercent = (deltaX / (containerWidth - dividerWidth)) * totalFlex;
                
                let newRidersWidth = startRidersWidth + deltaPercent;
                let newCoachesWidth = startCoachesWidth - deltaPercent;
                
                // Enforce minimum widths (at least 20% each)
                const minWidth = totalFlex * 0.2;
                if (newRidersWidth < minWidth) {
                    newRidersWidth = minWidth;
                    newCoachesWidth = totalFlex - minWidth;
                } else if (newCoachesWidth < minWidth) {
                    newCoachesWidth = minWidth;
                    newRidersWidth = totalFlex - minWidth;
                }
                
                ridersDiv.style.flex = newRidersWidth;
                coachesDiv.style.flex = newCoachesWidth;
            };
            
            const onUp = () => {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) {
                    const container = document.getElementById('new-attendees-sticky');
                    if (container) {
                        const ridersDiv = container.querySelector('[data-drop-type="rider"]').parentElement;
                        const coachesDiv = container.querySelector('[data-drop-type="coach"]').parentElement;
                        const ridersFlex = parseFloat(ridersDiv.style.flex) || 1;
                        const coachesFlex = parseFloat(coachesDiv.style.flex) || 1;
                        ride.pasteboardRidersWidth = ridersFlex;
                        ride.pasteboardCoachesWidth = coachesFlex;
                        saveRideToDB(ride);
                    }
                }
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        function deleteGroup(groupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const numericId = parseInt(groupId, 10);
            if (!Number.isFinite(numericId)) return;

            const group = findGroupById(ride, numericId);
            if (!group) return;

            const hasRiders = group.riders && group.riders.length > 0;
            const hasCoaches = group.coaches && (group.coaches.leader || group.coaches.sweep || group.coaches.roam || (Array.isArray(group.coaches.extraRoam) && group.coaches.extraRoam.filter(Boolean).length > 0));

            if (hasRiders || hasCoaches) {
                if (!confirm('Are you sure you want to delete this group? This will result in any assigned riders and coaches becoming unassigned.')) {
                    return;
                }
            }

            saveAssignmentState(ride);
            ride.groups = ride.groups.filter(g => g.id !== numericId);
            renumberGroups(ride, true);
            saveRideToDB(ride);
            renderAssignments(ride);

            // Open sidebars to show unassigned riders/coaches if any were in the group
            if (hasRiders || hasCoaches) {
                if (typeof expandSidebar === 'function') {
                    if (hasRiders) { sidebarRidersCollapsed = false; sidebarRidersFilter = 'unassigned'; }
                    if (hasCoaches) { sidebarCoachesCollapsed = false; sidebarCoachesFilter = 'unassigned'; }
                    applySidebarCollapsedState();
                    renderSidebars();
                }
            }
        }

        function showGroupMenu(event, groupId) {
            event.stopPropagation();
            closeGroupMenu();

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const numericId = parseInt(groupId, 10);
            const currentGroup = findGroupById(ride, numericId);
            if (!currentGroup) return;

            const otherGroups = ride.groups
                .filter(g => g.id !== numericId)
                .sort((a, b) => {
                    const aNum = parseInt((a.label || '').match(/\d+/)?.[0] || a.id, 10);
                    const bNum = parseInt((b.label || '').match(/\d+/)?.[0] || b.id, 10);
                    return aNum - bNum;
                });

            let menuHtml = '';
            menuHtml += `<div class="group-menu-item" onclick="openRenameGroupDialog(${numericId}); closeGroupMenu();">Rename Group</div>`;
            if (otherGroups.length > 0) {
                menuHtml += `<div class="group-menu-item" onclick="openMergeGroupDialog(${numericId}); closeGroupMenu();">Merge this group with…</div>`;
            }
            menuHtml += `<div class="group-menu-item" onclick="splitGroup(${numericId}); closeGroupMenu();">Split Group</div>`;
            menuHtml += `<div class="group-menu-separator"></div>`;
            menuHtml += `<div class="group-menu-item group-menu-danger" onclick="deleteGroup(${numericId}); closeGroupMenu();">Delete Group</div>`;

            const menu = document.createElement('div');
            menu.id = 'group-context-menu';
            menu.className = 'group-context-menu';
            menu.innerHTML = menuHtml;
            document.body.appendChild(menu);

            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 2) + 'px';
            menu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
            ensureMenuInViewport(menu, rect, 2);

            // Auto-close after 3s unless mouse is hovering
            startContextMenuAutoClose(menu);

            setTimeout(() => {
                document.addEventListener('click', closeGroupMenuOnOutside);
            }, 0);
        }

        // Shared auto-close logic for context menus (2s timeout, paused on hover)
        function startContextMenuAutoClose(menuEl, closeFn) {
            const doClose = closeFn || closeGroupMenu;
            let autoCloseTimer = null;
            let isHovering = false;

            const scheduleClose = () => {
                clearTimeout(autoCloseTimer);
                autoCloseTimer = setTimeout(() => {
                    if (!isHovering && document.body.contains(menuEl)) doClose();
                }, 2000);
            };

            menuEl.addEventListener('mouseenter', () => { isHovering = true; clearTimeout(autoCloseTimer); });
            menuEl.addEventListener('mouseleave', () => { isHovering = false; scheduleClose(); });

            scheduleClose();
        }

        function closeGroupMenu() {
            const menu = document.getElementById('group-context-menu');
            if (menu) menu.remove();
            document.removeEventListener('click', closeGroupMenuOnOutside);
        }

        function closeGroupMenuOnOutside(e) {
            const menu = document.getElementById('group-context-menu');
            if (menu && !menu.contains(e.target)) {
                closeGroupMenu();
            }
        }

        // ---- Merge Group Dialog ----
        function openMergeGroupDialog(sourceGroupId) {
            closeGroupMenu();
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const sourceGroup = findGroupById(ride, sourceGroupId);
            if (!sourceGroup) return;

            const otherGroups = ride.groups
                .filter(g => g.id !== sourceGroupId)
                .sort((a, b) => {
                    const aNum = parseInt((a.label || '').match(/\d+/)?.[0] || a.id, 10);
                    const bNum = parseInt((b.label || '').match(/\d+/)?.[0] || b.id, 10);
                    return aNum - bNum;
                });
            if (otherGroups.length === 0) return;

            const existing = document.getElementById('merge-group-dialog-overlay');
            if (existing) existing.remove();

            let optionsHtml = otherGroups.map(g =>
                `<div class="group-menu-item" onclick="executeMergeGroup(${sourceGroupId}, ${g.id})" style="padding: 8px 16px; cursor: pointer;">${escapeHtml(g.label)}${g.customName ? ' (' + escapeHtml(g.customName) + ')' : ''}</div>`
            ).join('');

            const overlay = document.createElement('div');
            overlay.id = 'merge-group-dialog-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.innerHTML = `
                <div style="background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); padding: 20px; min-width: 260px; max-width: 360px;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 12px;">Merge ${escapeHtml(sourceGroup.label)} with:</div>
                    <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px;">
                        ${optionsHtml}
                    </div>
                    <div style="margin-top: 12px; text-align: right;">
                        <button class="btn-small secondary" onclick="document.getElementById('merge-group-dialog-overlay').remove()">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        }

        function executeMergeGroup(sourceGroupId, targetGroupId) {
            const overlay = document.getElementById('merge-group-dialog-overlay');
            if (overlay) overlay.remove();
            mergeGroups(sourceGroupId, targetGroupId);
        }

        // ---- Rename Group Dialog ----
        function openRenameGroupDialog(groupId) {
            closeGroupMenu();
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const group = findGroupById(ride, groupId);
            if (!group) return;

            const existing = document.getElementById('rename-group-dialog-overlay');
            if (existing) existing.remove();

            const currentCustomName = group.customName || '';
            const useForRiders = group.useCustomNameForRiders !== false;
            const useForCoaches = group.useCustomNameForCoaches !== false;

            const overlay = document.createElement('div');
            overlay.id = 'rename-group-dialog-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.innerHTML = `
                <div style="background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); padding: 20px; min-width: 300px; max-width: 400px;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 12px;">Rename ${escapeHtml(group.label)}</div>
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 13px; color: #555; display: block; margin-bottom: 4px;">Custom Name</label>
                        <input type="text" id="rename-group-input" value="${escapeHtml(currentCustomName)}" placeholder="e.g. Advanced, Beginners..." style="width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 6px;">
                        <label style="font-size: 13px; color: #555; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <input type="checkbox" id="rename-group-riders" ${useForRiders ? 'checked' : ''}> Use this name for Rider Assignments
                        </label>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <label style="font-size: 13px; color: #555; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <input type="checkbox" id="rename-group-coaches" ${useForCoaches ? 'checked' : ''}> Use this name for Coach Assignments
                        </label>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-small secondary" onclick="document.getElementById('rename-group-dialog-overlay').remove()">Cancel</button>
                        <button class="btn-small" onclick="executeRenameGroup(${groupId})">Save</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
            setTimeout(() => { const inp = document.getElementById('rename-group-input'); if (inp) inp.focus(); }, 50);
        }

        function executeRenameGroup(groupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const group = findGroupById(ride, groupId);
            if (!group) return;

            const input = document.getElementById('rename-group-input');
            const ridersCheckbox = document.getElementById('rename-group-riders');
            const coachesCheckbox = document.getElementById('rename-group-coaches');

            const customName = input ? input.value.trim() : '';
            group.customName = customName || '';
            group.useCustomNameForRiders = ridersCheckbox ? ridersCheckbox.checked : true;
            group.useCustomNameForCoaches = coachesCheckbox ? coachesCheckbox.checked : true;

            const overlay = document.getElementById('rename-group-dialog-overlay');
            if (overlay) overlay.remove();

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        // ---- Practice Date Bar ⋯ Menu ----
        function showPracticeMenu(event) {
            event.stopPropagation();
            closePracticeMenu();

            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;

            let menuHtml = '';
            menuHtml += `<div class="group-menu-item" onclick="undoAssignmentChange(); closePracticeMenu();">Undo</div>`;
            menuHtml += `<div class="group-menu-item" onclick="redoAssignmentChange(); closePracticeMenu();">Redo</div>`;
            menuHtml += `<div class="group-menu-separator"></div>`;
            menuHtml += `<div class="group-menu-item" onclick="addGroup(); closePracticeMenu();">Add Group</div>`;
            menuHtml += `<div class="group-menu-item" onclick="toggleGroupColorNames(); closePracticeMenu();">Color Names</div>`;
            menuHtml += `<div class="group-menu-separator"></div>`;
            menuHtml += `<div class="group-menu-item" onclick="unassignAllRiders(); closePracticeMenu();">Unassign All Riders</div>`;
            menuHtml += `<div class="group-menu-item" onclick="unassignAllCoaches(); closePracticeMenu();">Unassign All Coaches</div>`;
            if (ride && ride.groups && ride.groups.length > 1) {
                menuHtml += `<div class="group-menu-separator"></div>`;
                menuHtml += `<div class="group-menu-item" onclick="openReorderGroupsDialog(); closePracticeMenu();">Reorder Groups</div>`;
            }
            menuHtml += `<div class="group-menu-separator"></div>`;
            menuHtml += `<div class="group-menu-item group-menu-danger" onclick="deleteAllGroups(); closePracticeMenu();">Delete All Groups</div>`;
            menuHtml += `<div class="group-menu-item group-menu-danger" onclick="clearAllAndRestartPlanning(); closePracticeMenu();">Clear all and restart planning</div>`;

            const menu = document.createElement('div');
            menu.id = 'practice-context-menu';
            menu.className = 'group-context-menu';
            menu.innerHTML = menuHtml;
            document.body.appendChild(menu);

            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 2) + 'px';
            menu.style.left = Math.min(rect.right - menu.offsetWidth, window.innerWidth - 240) + 'px';
            ensureMenuInViewport(menu, rect, 2);

            startContextMenuAutoClose(menu, closePracticeMenu);

            setTimeout(() => {
                document.addEventListener('click', closePracticeMenuOnOutside);
            }, 0);
        }

        function closePracticeMenu() {
            const menu = document.getElementById('practice-context-menu');
            if (menu) menu.remove();
            document.removeEventListener('click', closePracticeMenuOnOutside);
        }

        function closePracticeMenuOnOutside(e) {
            const menu = document.getElementById('practice-context-menu');
            if (menu && !menu.contains(e.target)) {
                closePracticeMenu();
            }
        }

        function openPracticePickerFromMenu() {
            // Close current planner, then open picker for all practices
            data.currentRide = null;
            hideSidebars();
            const bannerToolbar = document.getElementById('practice-banner-toolbar');
            if (bannerToolbar) { bannerToolbar.style.display = 'none'; bannerToolbar.innerHTML = ''; }

            practicePlannerView = 'picker';
            practicePickerMode = 'all';

            if (typeof renderRides === 'function') renderRides();
            if (typeof renderPracticePickerCalendar === 'function') renderPracticePickerCalendar();

            const titleEl = document.getElementById('practice-calendar-picker-title');
            if (titleEl) titleEl.textContent = 'Select a practice to plan or review';
        }

        function unassignAllRiders() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            if (!confirm('Unassign all riders from groups?')) return;

            saveAssignmentState(ride);
            ride.groups.forEach(group => {
                group.riders = [];
            });
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function deleteAllGroups() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            if (!confirm('Delete all groups? This will unassign all riders and coaches.')) return;

            saveAssignmentState(ride);
            ride.groups = [];
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        // ---- Reorder Groups Dialog ----
        let _reorderOriginalLabels = new Map();

        function openReorderGroupsDialog() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride || !ride.groups || ride.groups.length < 2) return;

            const existing = document.getElementById('reorder-groups-dialog-overlay');
            if (existing) existing.remove();

            // Sort groups by label number so dialog matches the visual order
            ride.groups.sort((a, b) => {
                const aNum = parseInt((a.label || '').match(/\d+/)?.[0] || '0', 10);
                const bNum = parseInt((b.label || '').match(/\d+/)?.[0] || '0', 10);
                return aNum - bNum;
            });

            // Capture original labels keyed by group object reference
            _reorderOriginalLabels = new Map();
            ride.groups.forEach(g => {
                let label = g.label || 'Group';
                if (g.customName) label += ` (${g.customName})`;
                if (g.colorName) label += ` [${g.colorName}]`;
                _reorderOriginalLabels.set(g, label);
            });

            const overlay = document.createElement('div');
            overlay.id = 'reorder-groups-dialog-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            const buildList = () => {
                return ride.groups.map((g, idx) => {
                    const label = _reorderOriginalLabels.get(g) || g.label;
                    return `<div class="reorder-group-row" data-idx="${idx}" draggable="true" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; cursor: grab; user-select: none;">
                        <span style="flex: 1; font-size: 14px; font-weight: 500;">${escapeHtml(label)}</span>
                        <button class="btn-small secondary" style="padding: 2px 8px; font-size: 14px; line-height: 1;" onclick="reorderGroupMove(${idx}, -1)" ${idx === 0 ? 'disabled style="padding: 2px 8px; font-size: 14px; line-height: 1; opacity: 0.3;"' : ''}>▲</button>
                        <button class="btn-small secondary" style="padding: 2px 8px; font-size: 14px; line-height: 1;" onclick="reorderGroupMove(${idx}, 1)" ${idx === ride.groups.length - 1 ? 'disabled style="padding: 2px 8px; font-size: 14px; line-height: 1; opacity: 0.3;"' : ''}>▼</button>
                    </div>`;
                }).join('');
            };

            overlay.innerHTML = `
                <div style="background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); padding: 20px; min-width: 300px; max-width: 420px;">
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 12px;">Reorder Groups</div>
                    <div id="reorder-groups-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto;">
                        ${buildList()}
                    </div>
                    <div style="margin-top: 14px; display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-small secondary" onclick="document.getElementById('reorder-groups-dialog-overlay').remove()">Cancel</button>
                        <button class="btn-small" onclick="applyReorderGroups()">Apply</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const listEl = document.getElementById('reorder-groups-list');
            if (listEl) {
                let dragIdx = null;
                listEl.addEventListener('dragstart', (e) => {
                    const row = e.target.closest('.reorder-group-row');
                    if (row) { dragIdx = parseInt(row.dataset.idx, 10); row.style.opacity = '0.4'; }
                });
                listEl.addEventListener('dragend', (e) => {
                    const row = e.target.closest('.reorder-group-row');
                    if (row) row.style.opacity = '1';
                });
                listEl.addEventListener('dragover', (e) => { e.preventDefault(); });
                listEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const targetRow = e.target.closest('.reorder-group-row');
                    if (!targetRow || dragIdx === null) return;
                    const targetIdx = parseInt(targetRow.dataset.idx, 10);
                    if (dragIdx === targetIdx) return;
                    const [moved] = ride.groups.splice(dragIdx, 1);
                    ride.groups.splice(targetIdx, 0, moved);
                    listEl.innerHTML = buildList();
                    dragIdx = null;
                });
            }
        }

        function reorderGroupMove(idx, direction) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= ride.groups.length) return;

            const temp = ride.groups[idx];
            ride.groups[idx] = ride.groups[newIdx];
            ride.groups[newIdx] = temp;

            const listEl = document.getElementById('reorder-groups-list');
            if (listEl) {
                const buildList = () => {
                    return ride.groups.map((g, i) => {
                        const label = _reorderOriginalLabels.get(g) || g.label;
                        return `<div class="reorder-group-row" data-idx="${i}" draggable="true" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px; cursor: grab; user-select: none;">
                            <span style="flex: 1; font-size: 14px; font-weight: 500;">${escapeHtml(label)}</span>
                            <button class="btn-small secondary" style="padding: 2px 8px; font-size: 14px; line-height: 1;" onclick="reorderGroupMove(${i}, -1)" ${i === 0 ? 'disabled style="padding: 2px 8px; font-size: 14px; line-height: 1; opacity: 0.3;"' : ''}>▲</button>
                            <button class="btn-small secondary" style="padding: 2px 8px; font-size: 14px; line-height: 1;" onclick="reorderGroupMove(${i}, 1)" ${i === ride.groups.length - 1 ? 'disabled style="padding: 2px 8px; font-size: 14px; line-height: 1; opacity: 0.3;"' : ''}>▼</button>
                        </div>`;
                    }).join('');
                };
                listEl.innerHTML = buildList();
            }
        }

        function applyReorderGroups() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            // Relabel groups with their new positions
            ride.groups.forEach((g, i) => { g.label = `Group ${i + 1}`; });
            const overlay = document.getElementById('reorder-groups-dialog-overlay');
            if (overlay) overlay.remove();
            saveAssignmentState(ride);
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function mergeGroups(sourceGroupId, targetGroupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const sourceGroup = findGroupById(ride, sourceGroupId);
            const targetGroup = findGroupById(ride, targetGroupId);
            if (!sourceGroup || !targetGroup) return;

            saveAssignmentState(ride);

            // Move riders
            if (sourceGroup.riders && sourceGroup.riders.length > 0) {
                if (!targetGroup.riders) targetGroup.riders = [];
                sourceGroup.riders.forEach(riderId => {
                    if (!targetGroup.riders.includes(riderId)) {
                        targetGroup.riders.push(riderId);
                    }
                });
            }

            // Move coaches (merge into target, don't overwrite existing)
            if (sourceGroup.coaches) {
                if (!targetGroup.coaches.leader && sourceGroup.coaches.leader) {
                    targetGroup.coaches.leader = sourceGroup.coaches.leader;
                }
                if (!targetGroup.coaches.sweep && sourceGroup.coaches.sweep) {
                    targetGroup.coaches.sweep = sourceGroup.coaches.sweep;
                }
                if (!targetGroup.coaches.roam && sourceGroup.coaches.roam) {
                    targetGroup.coaches.roam = sourceGroup.coaches.roam;
                }
                // Add extra roam coaches
                if (!Array.isArray(targetGroup.coaches.extraRoam)) targetGroup.coaches.extraRoam = [];
                const existingCoachIds = new Set([
                    targetGroup.coaches.leader,
                    targetGroup.coaches.sweep,
                    targetGroup.coaches.roam,
                    ...targetGroup.coaches.extraRoam
                ].filter(Boolean));

                [sourceGroup.coaches.leader, sourceGroup.coaches.sweep, sourceGroup.coaches.roam]
                    .filter(Boolean)
                    .forEach(coachId => {
                        if (!existingCoachIds.has(coachId)) {
                            targetGroup.coaches.extraRoam.push(coachId);
                            existingCoachIds.add(coachId);
                        }
                    });
                if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                    sourceGroup.coaches.extraRoam.forEach(coachId => {
                        if (coachId && !existingCoachIds.has(coachId)) {
                            targetGroup.coaches.extraRoam.push(coachId);
                            existingCoachIds.add(coachId);
                        }
                    });
                }
            }

            // Remove source group
            ride.groups = ride.groups.filter(g => g.id !== sourceGroupId);
            renumberGroups(ride, true);
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function splitGroup(groupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const numericId = parseInt(groupId, 10);
            const group = findGroupById(ride, numericId);
            if (!group) return;

            if (!group.riders || group.riders.length < 2) {
                alert('This group needs at least 2 riders to be split.');
                return;
            }
            if (!confirm(`Split "${group.label || 'this group'}" into two groups?`)) return;

            saveAssignmentState(ride);

            const riderMap = {};
            (data.riders || []).forEach(r => { riderMap[r.id] = r; });

            const sortedRiders = [...group.riders].sort((a, b) => {
                const ra = riderMap[a], rb = riderMap[b];
                const fa = ra ? (parseInt(ra.fitness || '5', 10) || 5) : 5;
                const fb = rb ? (parseInt(rb.fitness || '5', 10) || 5) : 5;
                return fb - fa;
            });

            // Snake-draft: 0->A, 1->B, 2->B, 3->A, 4->A, 5->B ...
            const ridersA = [], ridersB = [];
            sortedRiders.forEach((rid, i) => {
                const cycle = Math.floor(i / 2);
                const pos = i % 2;
                if ((cycle % 2 === 0 && pos === 0) || (cycle % 2 === 1 && pos === 1)) {
                    ridersA.push(rid);
                } else {
                    ridersB.push(rid);
                }
            });

            const groupIdx = ride.groups.indexOf(group);
            const existingLabels = new Set(ride.groups.map(g => g.label).filter(Boolean));
            let nextNum = 1;
            const getNextLabel = () => {
                while (existingLabels.has(`Group ${nextNum}`)) nextNum++;
                const label = `Group ${nextNum}`;
                existingLabels.add(label);
                nextNum++;
                return label;
            };

            const groupA = createGroup(getNextLabel());
            const groupB = createGroup(getNextLabel());
            groupA.riders = ridersA;
            groupB.riders = ridersB;
            groupA.routeId = group.routeId;
            groupB.routeId = group.routeId;
            groupA.sortBy = group.sortBy || 'pace';
            groupB.sortBy = group.sortBy || 'pace';

            // Distribute coaches
            const coachSlots = [];
            if (group.coaches.leader) coachSlots.push({ id: group.coaches.leader, role: 'leader' });
            if (group.coaches.sweep) coachSlots.push({ id: group.coaches.sweep, role: 'sweep' });
            if (group.coaches.roam) coachSlots.push({ id: group.coaches.roam, role: 'roam' });
            (group.coaches.extraRoam || []).forEach(id => {
                if (id) coachSlots.push({ id, role: 'extraRoam' });
            });

            const coachMap = {};
            (data.coaches || []).forEach(c => { coachMap[c.id] = c; });
            const minLeaderLevel = typeof getAutoAssignSetting === 'function' ? getAutoAssignSetting('minLeaderLevel', 2) : 2;

            // Sort coaches: highest level first for best leader selection
            coachSlots.sort((a, b) => {
                const ca = coachMap[a.id], cb = coachMap[b.id];
                const la = ca ? (parseInt(ca.coachingLicenseLevel || ca.level || '0', 10) || 0) : 0;
                const lb = cb ? (parseInt(cb.coachingLicenseLevel || cb.level || '0', 10) || 0) : 0;
                return lb - la;
            });

            const assignCoachToGroup = (targetGroup, coachId) => {
                const coach = coachMap[coachId];
                const level = coach ? (parseInt(coach.coachingLicenseLevel || coach.level || '0', 10) || 0) : 0;
                if (!targetGroup.coaches.leader && level >= minLeaderLevel) {
                    targetGroup.coaches.leader = coachId;
                } else if (!targetGroup.coaches.sweep) {
                    targetGroup.coaches.sweep = coachId;
                } else if (!targetGroup.coaches.roam) {
                    targetGroup.coaches.roam = coachId;
                } else {
                    if (!Array.isArray(targetGroup.coaches.extraRoam)) targetGroup.coaches.extraRoam = [];
                    targetGroup.coaches.extraRoam.push(coachId);
                }
            };

            // Alternate coaches between group A and B
            coachSlots.forEach((slot, i) => {
                assignCoachToGroup(i % 2 === 0 ? groupA : groupB, slot.id);
            });

            // Promote if no leader assigned
            [groupA, groupB].forEach(g => {
                if (g.coaches.leader) return;
                const slots = [
                    { role: 'sweep', id: g.coaches.sweep },
                    { role: 'roam', id: g.coaches.roam },
                    ...((g.coaches.extraRoam || []).map(id => ({ role: 'extraRoam', id })))
                ].filter(s => s.id);
                if (slots.length === 0) return;
                slots.sort((a, b) => {
                    const ca = coachMap[a.id], cb = coachMap[b.id];
                    const la = ca ? (parseInt(ca.coachingLicenseLevel || ca.level || '0', 10) || 0) : 0;
                    const lb = cb ? (parseInt(cb.coachingLicenseLevel || cb.level || '0', 10) || 0) : 0;
                    return lb - la;
                });
                const promoted = slots[0];
                g.coaches.leader = promoted.id;
                if (promoted.role === 'sweep') g.coaches.sweep = null;
                else if (promoted.role === 'roam') g.coaches.roam = null;
                else if (promoted.role === 'extraRoam') {
                    g.coaches.extraRoam = (g.coaches.extraRoam || []).filter(id => id !== promoted.id);
                }
            });

            ride.groups.splice(groupIdx, 1, groupA, groupB);
            renumberGroups(ride, true);
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function moveGroupBefore(groupId, beforeGroupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            saveAssignmentState(ride);

            const group = ride.groups.find(g => g.id === groupId);
            if (!group) return;

            // Remove from current position
            ride.groups = ride.groups.filter(g => g.id !== groupId);

            // Find index of target and insert before
            const targetIdx = ride.groups.findIndex(g => g.id === beforeGroupId);
            if (targetIdx >= 0) {
                ride.groups.splice(targetIdx, 0, group);
            } else {
                ride.groups.push(group);
            }

            // Renumber labels
            ride.groups.forEach((g, i) => {
                g.label = `Group ${i + 1}`;
            });

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function moveGroupToEnd(groupId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            saveAssignmentState(ride);

            const group = ride.groups.find(g => g.id === groupId);
            if (!group) return;

            ride.groups = ride.groups.filter(g => g.id !== groupId);
            ride.groups.push(group);

            ride.groups.forEach((g, i) => {
                g.label = `Group ${i + 1}`;
            });

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        // Drag and drop functions
        function allowDrop(ev) {
            let payload;
            try {
                payload = JSON.parse(ev.dataTransfer.getData('application/json') || '{}');
            } catch (err) {
                payload = {};
            }
            
            // Check if dropping on a sidebar
            const parentSidebar = ev.currentTarget.closest('.practice-sidebar');
            if (parentSidebar) {
                // Only allow correct type on each sidebar
                const sidebarId = parentSidebar.id;
                const dragType = _currentDragType || payload.type;
                if (sidebarId === 'sidebar-riders' && dragType === 'coach') return;
                if (sidebarId === 'sidebar-coaches' && dragType === 'rider') return;
                ev.preventDefault();
                ev.currentTarget.classList.add('drag-over');
                return;
            }

            const isUnassignedPalette = ev.currentTarget.closest('#new-attendees-sticky') || 
                                       ev.currentTarget.dataset.unassignedList === 'true' ||
                                       ev.currentTarget.id === 'new-attendees-sticky' ||
                                       ev.currentTarget.dataset.unassignedPalette === 'true' ||
                                       ev.currentTarget.dataset.sidebarDrop === 'true';
            
            if (!isUnassignedPalette) {
                // For other drop zones, check type matching
                const expectedType = ev.currentTarget.dataset.dropType;
                if (expectedType && payload.type && expectedType !== payload.type) {
                    return;
                }
            }
            
            ev.preventDefault();
            
            // Highlight drop target
            const target = ev.currentTarget;
            if (target.classList.contains('coach-inline-item')) {
                // Highlighting a coach name
                target.style.background = '#e3f2fd';
                target.style.border = '2px solid #1976d2';
            } else if (target.classList.contains('coach-drop-zone')) {
                // Highlighting dropzone
                target.style.background = '#e3f2fd';
                target.style.borderColor = '#1976d2';
                target.style.borderStyle = 'solid';
                // Hide the text when dragging over
                const textSpan = target.querySelector('span');
                if (textSpan) textSpan.style.opacity = '0.5';
            }
            target.classList.add('drag-over');
        }

        function dragLeave(ev) {
            const target = ev.currentTarget;
            target.classList.remove('drag-over');
            
            // Remove highlight
            if (target.classList.contains('coach-inline-item')) {
                const index = parseInt(target.dataset.insertPosition || '0', 10);
                target.style.background = index % 2 === 0 ? '#f9f9f9' : '#fff';
                target.style.border = 'none';
            } else if (target.classList.contains('coach-drop-zone')) {
                target.style.background = '#f9f9f9';
                target.style.borderColor = '#ccc';
                target.style.borderStyle = 'dashed';
                // Show the text again when leaving
                const textSpan = target.querySelector('span');
                if (textSpan) textSpan.style.opacity = '1';
            }
        }

        // Auto-scroll during drag (state vars in app-state.js)

        function ensureScrollIndicators() {
            if (document.getElementById('drag-scroll-top') && document.getElementById('drag-scroll-bottom')) {
                return;
            }
            const topIndicator = document.createElement('div');
            topIndicator.id = 'drag-scroll-top';
            topIndicator.style.position = 'fixed';
            topIndicator.style.top = '0';
            topIndicator.style.left = '0';
            topIndicator.style.right = '0';
            topIndicator.style.height = '100px';
            topIndicator.style.pointerEvents = 'none';
            topIndicator.style.background = 'rgba(33, 150, 243, 0.15)';
            topIndicator.style.borderBottom = '1px dashed rgba(33, 150, 243, 0.5)';
            topIndicator.style.opacity = '0';
            topIndicator.style.transition = 'opacity 0.15s ease';
            topIndicator.style.zIndex = '9999';

            const bottomIndicator = document.createElement('div');
            bottomIndicator.id = 'drag-scroll-bottom';
            bottomIndicator.style.position = 'fixed';
            bottomIndicator.style.bottom = '0';
            bottomIndicator.style.left = '0';
            bottomIndicator.style.right = '0';
            bottomIndicator.style.height = '100px';
            bottomIndicator.style.pointerEvents = 'none';
            bottomIndicator.style.background = 'rgba(33, 150, 243, 0.15)';
            bottomIndicator.style.borderTop = '1px dashed rgba(33, 150, 243, 0.5)';
            bottomIndicator.style.opacity = '0';
            bottomIndicator.style.transition = 'opacity 0.15s ease';
            bottomIndicator.style.zIndex = '9999';

            document.body.appendChild(topIndicator);
            document.body.appendChild(bottomIndicator);
        }

        // Add global mousemove listener to track mouse position during drag
        if (!window.dragScrollListenerAdded) {
            document.addEventListener('mousemove', (e) => {
                if (isAssignmentDragging) {
                    currentMouseY = e.clientY;
                    checkAndScroll();
                }
            });
            document.addEventListener('dragover', (e) => {
                if (isAssignmentDragging) {
                    currentMouseY = e.clientY;
                    checkAndScroll();
                }
            });
            window.dragScrollListenerAdded = true;
        }

        // Auto-scroll functionality
        function startAutoScroll() {
            // Clear any existing interval
            stopAutoScroll();
            
            // Check mouse position periodically during drag
            autoScrollInterval = setInterval(() => {
                if (!isAssignmentDragging) {
                    stopAutoScroll();
                    return;
                }
                
                // Get mouse position (we'll track this via document mousemove)
                checkAndScroll();
            }, 50); // Check every 50ms
        }

        function stopAutoScroll() {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        }

        function checkAndScroll() {
            if (!isAssignmentDragging) return;
            
            const viewportHeight = window.innerHeight;
            const scrollTriggerZone = 100; // 100px from bottom
            const scrollSpeed = 15; // Pixels to scroll per check
            ensureScrollIndicators();
            const topIndicator = document.getElementById('drag-scroll-top');
            const bottomIndicator = document.getElementById('drag-scroll-bottom');
            if (topIndicator && bottomIndicator) {
                topIndicator.style.opacity = '0.25';
                bottomIndicator.style.opacity = '0.25';
            }
            
            // Check if mouse is in the bottom scroll trigger zone
            const distanceFromBottom = viewportHeight - currentMouseY;
            
            if (distanceFromBottom < scrollTriggerZone && distanceFromBottom > 0) {
                if (bottomIndicator) bottomIndicator.style.opacity = '0.7';
                // Calculate scroll amount based on how close to bottom
                // Closer to bottom = faster scroll
                const scrollAmount = Math.max(5, scrollSpeed * (1 - (distanceFromBottom / scrollTriggerZone)));
                
                // Scroll down
                window.scrollBy({
                    top: scrollAmount,
                    behavior: 'auto' // Instant scroll for smooth dragging
                });
            }
            
            // Also check top of viewport for scrolling up
            const scrollTriggerZoneTop = 100; // 100px from top
            if (currentMouseY < scrollTriggerZoneTop && currentMouseY > 0) {
                if (topIndicator) topIndicator.style.opacity = '0.7';
                const scrollAmount = Math.max(5, scrollSpeed * (1 - (currentMouseY / scrollTriggerZoneTop)));
                window.scrollBy({
                    top: -scrollAmount,
                    behavior: 'auto'
                });
            }
        }

        // Track drag state for snap-back on invalid drop
        let _dragDropAccepted = false;
        let _dragSourceCard = null;
        let _dragPlaceholder = null;
        let _currentDragType = null; // 'rider' or 'coach'

        // Sidebar drag proximity: expand when dragging near a collapsed sidebar
        let _sidebarDragProximityActive = false;
        let _sidebarDragExpandedRiders = false;
        let _sidebarDragExpandedCoaches = false;
        let _sidebarDragWidenedRiders = false;
        let _sidebarDragWidenedCoaches = false;

        function _handleDragProximity(e) {
            if (!isAssignmentDragging) return;
            const x = e.clientX;
            const PROXIMITY = 25;

            const sr = document.getElementById('sidebar-riders');
            const sc = document.getElementById('sidebar-coaches');
            const dragType = _currentDragType; // 'rider' or 'coach'

            // Riders sidebar (left) - only accepts riders
            if (sr && sr.style.display !== 'none') {
                const rect = sr.getBoundingClientRect();
                const overBar = x >= rect.left && x <= rect.right;
                const isWrongType = dragType === 'coach';

                if (sidebarRidersCollapsed) {
                    const nearEdge = x <= rect.right + PROXIMITY;

                    if (overBar) {
                        if (isWrongType) {
                            _showSidebarDragMessage(sr, 'Drag to Coach sidebar →');
                            _sidebarDragWidenedRiders = false;
                        } else if (!_sidebarDragExpandedRiders) {
                            _clearSidebarDragMessage(sr);
                            _sidebarDragExpandedRiders = true;
                            _sidebarDragWidenedRiders = false;
                            sr.style.width = '';
                            sidebarRidersCollapsed = false;
                            sidebarRidersFilter = 'unassigned';
                            applySidebarCollapsedState();
                            renderSidebars();
                        }
                    } else if (nearEdge && !_sidebarDragWidenedRiders && !_sidebarDragExpandedRiders) {
                        _sidebarDragWidenedRiders = true;
                        sr.style.transition = 'width 0.15s ease';
                        sr.style.width = '61px';
                    } else if (!nearEdge) {
                        _clearSidebarDragMessage(sr);
                        if (_sidebarDragWidenedRiders && !_sidebarDragExpandedRiders) {
                            _sidebarDragWidenedRiders = false;
                            sr.style.width = '';
                        }
                    }
                } else {
                    // Open sidebar
                    if (overBar && isWrongType) {
                        _showSidebarDragMessage(sr, 'Drag to Coach sidebar →');
                    } else if (!overBar) {
                        _clearSidebarDragMessage(sr);
                    }
                    if (_sidebarDragExpandedRiders && x > rect.right + 50) {
                        _clearSidebarDragMessage(sr);
                        _sidebarDragExpandedRiders = false;
                        sidebarRidersCollapsed = true;
                        applySidebarCollapsedState();
                        renderSidebars();
                    }
                }
            }

            // Coaches sidebar (right) - only accepts coaches
            if (sc && sc.style.display !== 'none') {
                const rect = sc.getBoundingClientRect();
                const overBar = x >= rect.left && x <= rect.right;
                const isWrongType = dragType === 'rider';

                if (sidebarCoachesCollapsed) {
                    const nearEdge = x >= rect.left - PROXIMITY;

                    if (overBar) {
                        if (isWrongType) {
                            _showSidebarDragMessage(sc, '← Drag to Rider sidebar');
                            _sidebarDragWidenedCoaches = false;
                        } else if (!_sidebarDragExpandedCoaches) {
                            _clearSidebarDragMessage(sc);
                            _sidebarDragExpandedCoaches = true;
                            _sidebarDragWidenedCoaches = false;
                            sc.style.width = '';
                            sidebarCoachesCollapsed = false;
                            sidebarCoachesFilter = 'unassigned';
                            applySidebarCollapsedState();
                            renderSidebars();
                        }
                    } else if (nearEdge && !_sidebarDragWidenedCoaches && !_sidebarDragExpandedCoaches) {
                        _sidebarDragWidenedCoaches = true;
                        sc.style.transition = 'width 0.15s ease';
                        sc.style.width = '61px';
                    } else if (!nearEdge) {
                        _clearSidebarDragMessage(sc);
                        if (_sidebarDragWidenedCoaches && !_sidebarDragExpandedCoaches) {
                            _sidebarDragWidenedCoaches = false;
                            sc.style.width = '';
                        }
                    }
                } else {
                    // Open sidebar
                    if (overBar && isWrongType) {
                        _showSidebarDragMessage(sc, '← Drag to Rider sidebar');
                    } else if (!overBar) {
                        _clearSidebarDragMessage(sc);
                    }
                    if (_sidebarDragExpandedCoaches && x < rect.left - 50) {
                        _clearSidebarDragMessage(sc);
                        _sidebarDragExpandedCoaches = false;
                        sidebarCoachesCollapsed = true;
                        applySidebarCollapsedState();
                        renderSidebars();
                    }
                }
            }
        }

        function _showSidebarDragMessage(sidebarEl, msg) {
            const isCollapsed = sidebarEl.classList.contains('collapsed');

            if (isCollapsed) {
                // Collapsed: replace the title text with warning
                const strip = sidebarEl.querySelector('.sidebar-collapsed-strip');
                if (!strip) return;
                const title = strip.querySelector('.sidebar-collapsed-title');
                if (title) {
                    if (!title.dataset.originalText) title.dataset.originalText = title.textContent;
                    title.textContent = msg;
                    title.style.color = '#c62828';
                    title.style.fontSize = '18px';
                }
                const stats = strip.querySelector('.sidebar-collapsed-stats');
                if (stats) stats.style.display = 'none';
            } else {
                // Open: show translucent overlay (use fixed positioning to match the sidebar)
                let overlay = sidebarEl.querySelector('.sidebar-drag-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'sidebar-drag-overlay';
                    const sidebarRect = sidebarEl.getBoundingClientRect();
                    overlay.style.cssText = `position: fixed; top: ${sidebarRect.top}px; left: ${sidebarRect.left}px; width: ${sidebarRect.width}px; height: ${sidebarRect.height}px; background: rgba(255,235,238,0.92); display: flex; align-items: center; justify-content: center; z-index: 100; border-radius: 8px; pointer-events: none;`;
                    overlay.innerHTML = `<span style="color: #c62828; font-weight: 700; font-size: 16px; text-align: center; padding: 20px;">${msg}</span>`;
                    document.body.appendChild(overlay);
                }
            }
        }

        function _clearSidebarDragMessage(sidebarEl) {
            // Restore collapsed strip title
            const strip = sidebarEl.querySelector('.sidebar-collapsed-strip');
            if (strip) {
                const title = strip.querySelector('.sidebar-collapsed-title');
                if (title && title.dataset.originalText) {
                    title.textContent = title.dataset.originalText;
                    title.style.color = '';
                    title.style.fontSize = '';
                    delete title.dataset.originalText;
                }
                const stats = strip.querySelector('.sidebar-collapsed-stats');
                if (stats) stats.style.display = '';
            }
            // Remove open sidebar overlay (appended to body)
            document.querySelectorAll('.sidebar-drag-overlay').forEach(el => el.remove());
        }

        function _resetDragProximity() {
            const sr = document.getElementById('sidebar-riders');
            const sc = document.getElementById('sidebar-coaches');
            if (sr) _clearSidebarDragMessage(sr);
            if (sc) _clearSidebarDragMessage(sc);
            // Clean up any lingering drag-over highlights
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (_sidebarDragExpandedRiders && !_dragDropAccepted) {
                sidebarRidersCollapsed = true;
                applySidebarCollapsedState();
                renderSidebars();
            }
            if (_sidebarDragExpandedCoaches && !_dragDropAccepted) {
                sidebarCoachesCollapsed = true;
                applySidebarCollapsedState();
                renderSidebars();
            }
            if (sr) sr.style.width = '';
            if (sc) sc.style.width = '';
            _sidebarDragExpandedRiders = false;
            _sidebarDragExpandedCoaches = false;
            _sidebarDragWidenedRiders = false;
            _sidebarDragWidenedCoaches = false;
        }

        function drag(ev) {
            const type = ev.target.dataset.dragType;
            if (!type) return;
            _currentDragType = type;

            const payload = { type };
            if (type === 'rider') {
                payload.riderId = parseInt(ev.target.dataset.riderId, 10);
            } else if (type === 'coach') {
                payload.coachId = parseInt(ev.target.dataset.coachId, 10);
                if (ev.target.dataset.sourceGroupId) {
                    payload.sourceGroupId = ev.target.dataset.sourceGroupId;
                }
                if (ev.target.dataset.sourceRole) {
                    payload.sourceRole = ev.target.dataset.sourceRole;
                }
            } else {
                return;
            }

            ev.dataTransfer.setData('application/json', JSON.stringify(payload));
            ev.target.classList.add('dragging');

            _dragDropAccepted = false;
            _dragSourceCard = ev.target;

            // If dragging from inside a group, hide the card and animate the gap closed
            const inGroup = ev.target.closest('.group-riders') || ev.target.closest('.group-coaches') || ev.target.closest('.coach-inline-item');
            if (inGroup) {
                const card = ev.target.closest('.rider-card, .coach-card, .coach-inline-item');
                if (card) {
                    // Create a collapsing placeholder where the card was
                    const h = card.offsetHeight;
                    const cs = getComputedStyle(card);
                    const mt = parseFloat(cs.marginTop) || 0;
                    const mb = parseFloat(cs.marginBottom) || 0;

                    const placeholder = document.createElement('div');
                    placeholder.className = 'drag-collapse-placeholder';
                    placeholder.style.height = (h + mt + mb) + 'px';
                    placeholder.style.overflow = 'hidden';
                    placeholder.style.transition = 'height 0.8s ease';
                    card.parentNode.insertBefore(placeholder, card.nextSibling);
                    _dragPlaceholder = placeholder;

                    // Hide the card immediately (browser shows the drag ghost from before hide)
                    requestAnimationFrame(() => {
                        card.style.display = 'none';
                        // Start collapsing the placeholder
                        requestAnimationFrame(() => {
                            placeholder.style.height = '0px';
                        });
                    });
                }
            } else {
                _dragPlaceholder = null;
            }

            // Start auto-scroll monitoring
            isAssignmentDragging = true;
            ensureScrollIndicators();
            startAutoScroll();

            // Start monitoring drag proximity to collapsed sidebars
            document.addEventListener('dragover', _handleDragProximity);
        }

        function dragEnd(ev) {
            ev.target.classList.remove('dragging');

            // Stop auto-scroll monitoring
            isAssignmentDragging = false;
            stopAutoScroll();
            const topIndicator = document.getElementById('drag-scroll-top');
            const bottomIndicator = document.getElementById('drag-scroll-bottom');
            if (topIndicator) topIndicator.style.opacity = '0';
            if (bottomIndicator) bottomIndicator.style.opacity = '0';

            // If drop was not accepted by a valid zone, snap the card back
            if (!_dragDropAccepted && _dragSourceCard) {
                const card = _dragSourceCard;
                card.style.display = '';
                // Remove placeholder
                if (_dragPlaceholder && _dragPlaceholder.parentNode) {
                    _dragPlaceholder.remove();
                }
            }

            // Clean up sidebar proximity state
            document.removeEventListener('dragover', _handleDragProximity);
            _resetDragProximity();

            _dragDropAccepted = false;
            _dragSourceCard = null;
            _dragPlaceholder = null;
            _currentDragType = null;
        }

        function drop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.remove('drag-over');
            // Clean up any lingering drag-over highlights sitewide
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

            // Mark that a valid drop zone accepted this drag
            _dragDropAccepted = true;

            // Clean up placeholder (no longer needed since re-render will happen)
            if (_dragPlaceholder && _dragPlaceholder.parentNode) {
                _dragPlaceholder.remove();
            }
            _dragPlaceholder = null;

            let payload = null;
            try {
                payload = JSON.parse(ev.dataTransfer.getData('application/json'));
            } catch (err) {
                payload = null;
            }
            if (!payload || !payload.type) return;
            
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            if (payload.type === 'rider') {
                handleRiderDrop(ride, payload, ev.currentTarget);
            } else if (payload.type === 'coach') {
                handleCoachDrop(ride, payload, ev.currentTarget, ev);
            }

            document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
            _dragSourceCard = null;
        }

        function handleRiderDrop(ride, payload, dropTarget) {
            const riderId = parseInt(payload.riderId, 10);
            if (!Number.isFinite(riderId)) return;

            // Save state before any modification for undo support
            saveAssignmentState(ride);

            // Check if dropping on sidebar or unassigned palette
            const isSidebarDrop = dropTarget.closest('.practice-sidebar') ||
                                  dropTarget.dataset.sidebarDrop === 'true';
            const isUnassignedPalette = isSidebarDrop ||
                                       dropTarget.closest('#new-attendees-sticky') || 
                                       dropTarget.dataset.unassignedList === 'true' ||
                                       dropTarget.id === 'new-attendees-sticky';
            
            if (isUnassignedPalette) {
                // Dropping on sidebar/palette - remove from groups and ensure in availableRiders
                removeRiderFromGroups(ride, riderId);
                if (!ride.availableRiders.includes(riderId)) {
                    ride.availableRiders.push(riderId);
                }
                saveRideToDB(ride);
                renderAssignments(ride);
                // Switch sidebar to "unassigned" tab and expand if collapsed
                if (isSidebarDrop) {
                    sidebarRidersFilter = 'unassigned';
                    if (sidebarRidersCollapsed) {
                        sidebarRidersCollapsed = false;
                        applySidebarCollapsedState();
                    }
                    renderSidebars();
                }
                return;
            }

            const dropType = dropTarget.dataset.dropType;
            if (dropType && dropType !== 'rider') return;

            const targetGroupId = dropTarget.dataset.groupId;
            let previousGroupId = null;

            ride.groups.forEach(group => {
                if (group.riders.includes(riderId)) {
                    previousGroupId = group.id;
                }
            });

            removeRiderFromGroups(ride, riderId);

            if (targetGroupId !== 'unassigned') {
                const numericGroupId = parseInt(targetGroupId, 10);
                const group = findGroupById(ride, numericGroupId);
                if (!group) {
                    if (previousGroupId !== null) {
                        const previousGroup = findGroupById(ride, previousGroupId);
                        if (previousGroup) {
                            previousGroup.riders.push(riderId);
                        }
                    }
                    renderAssignments(ride);
                    return;
                }

                // Note: Groups can now exist without coaches - removed coach requirement check
                // Allow adding riders even if it exceeds capacity - group will be marked as non-compliant (red)
                // This allows flexibility when moving things around
                if (!group.riders.includes(riderId)) {
                    group.riders.push(riderId);
                    const rider = getRiderById(riderId);
                    if (!group.fitnessTag && rider) {
                        group.fitnessTag = rider.fitness || null;
                    }
                }
            }
            
            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        // pendingCoachMove, assignmentHistory, assignmentHistoryIndex, MAX_HISTORY, isUndoRedoInProgress in app-state.js
        
        // Snapshot helpers
        function captureRideSnapshot(ride) {
            return {
                rideId: ride.id,
                groups: JSON.parse(JSON.stringify(ride.groups || [])),
                availableRiders: [...(ride.availableRiders || [])],
                availableCoaches: [...(ride.availableCoaches || [])]
            };
        }

        function restoreRideSnapshot(ride, snapshot) {
            ride.groups = JSON.parse(JSON.stringify(snapshot.groups));
            ride.availableRiders = [...snapshot.availableRiders];
            ride.availableCoaches = [...snapshot.availableCoaches];
        }

        function snapshotsEqual(a, b) {
            if (!a || !b) return false;
            return a.rideId === b.rideId &&
                   JSON.stringify(a.groups) === JSON.stringify(b.groups) &&
                   JSON.stringify(a.availableRiders) === JSON.stringify(b.availableRiders) &&
                   JSON.stringify(a.availableCoaches) === JSON.stringify(b.availableCoaches);
        }

        // Save current state BEFORE a modification (pre-change snapshot).
        // assignmentHistory stores sequential snapshots.  assignmentHistoryIndex
        // always points to the entry that matches the current on-screen state.
        //
        // Flow:  saveAssignmentState → modify ride → saveRideToDB → renderAssignments
        // After saveAssignmentState, the snapshot at index IS the current screen.
        // The actual modification will make the screen diverge from that snapshot.
        // On undo, we capture the diverged (post-change) screen first, then step back.
        function saveAssignmentState(ride) {
            if (!ride || isUndoRedoInProgress) return;

            const snapshot = captureRideSnapshot(ride);

            // Trim forward history when a new branch starts after undo
            if (assignmentHistoryIndex < assignmentHistory.length - 1) {
                assignmentHistory = assignmentHistory.slice(0, assignmentHistoryIndex + 1);
            }

            // Skip if last entry is identical (prevents double-saves)
            if (assignmentHistory.length > 0 && snapshotsEqual(assignmentHistory[assignmentHistory.length - 1], snapshot)) {
                updateUndoRedoButtons();
                return;
            }

            assignmentHistory.push(snapshot);

            // Keep at most MAX_HISTORY entries
            while (assignmentHistory.length > MAX_HISTORY) {
                assignmentHistory.shift();
            }
            assignmentHistoryIndex = assignmentHistory.length - 1;

            updateUndoRedoButtons();
        }

        // Undo last assignment change
        function undoAssignmentChange() {
            if (assignmentHistory.length === 0 || assignmentHistoryIndex < 0) return;

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            isUndoRedoInProgress = true;

            const liveSnapshot = captureRideSnapshot(ride);
            const atTip = assignmentHistoryIndex === assignmentHistory.length - 1;

            if (atTip && !snapshotsEqual(liveSnapshot, assignmentHistory[assignmentHistoryIndex])) {
                // Screen has diverged (a change happened after the last save).
                // Push the live state so Redo can get back to it.
                assignmentHistory.push(liveSnapshot);
                // assignmentHistoryIndex still points at the pre-change state — restore it.
            } else if (atTip && snapshotsEqual(liveSnapshot, assignmentHistory[assignmentHistoryIndex])) {
                // Screen matches the tip — just step back one if possible
                if (assignmentHistoryIndex === 0) {
                    isUndoRedoInProgress = false;
                    return; // nothing to undo to
                }
                assignmentHistoryIndex--;
            } else {
                // Already in the middle of history — step back
                if (assignmentHistoryIndex === 0) {
                    isUndoRedoInProgress = false;
                    return;
                }
                assignmentHistoryIndex--;
            }

            const target = assignmentHistory[assignmentHistoryIndex];
            if (!target || target.rideId !== ride.id) {
                isUndoRedoInProgress = false;
                updateUndoRedoButtons();
                return;
            }

            restoreRideSnapshot(ride, target);
            saveRideToDB(ride);
            renderAssignments(ride);

            isUndoRedoInProgress = false;
            updateUndoRedoButtons();
        }

        // Redo last undone change
        function redoAssignmentChange() {
            if (assignmentHistoryIndex >= assignmentHistory.length - 1) return;

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            isUndoRedoInProgress = true;
            assignmentHistoryIndex++;

            const target = assignmentHistory[assignmentHistoryIndex];
            if (!target || target.rideId !== ride.id) {
                assignmentHistoryIndex--;
                isUndoRedoInProgress = false;
                updateUndoRedoButtons();
                return;
            }

            restoreRideSnapshot(ride, target);
            saveRideToDB(ride);
            renderAssignments(ride);

            isUndoRedoInProgress = false;
            updateUndoRedoButtons();
        }

        // Update undo/redo button visual states
        function updateUndoRedoButtons() {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');

            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;

            let canUndo = false;
            if (ride && assignmentHistory.length > 0 && assignmentHistoryIndex >= 0) {
                // Can undo if we're past the first entry, OR the live state differs from the tip
                if (assignmentHistoryIndex > 0) {
                    canUndo = true;
                } else {
                    const live = captureRideSnapshot(ride);
                    canUndo = !snapshotsEqual(live, assignmentHistory[0]);
                }
            }

            if (undoBtn) {
                undoBtn.disabled = !canUndo;
                undoBtn.style.opacity = canUndo ? '1' : '0.5';
                undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
            }

            if (redoBtn) {
                const canRedo = assignmentHistoryIndex < assignmentHistory.length - 1;
                redoBtn.disabled = !canRedo;
                redoBtn.style.opacity = canRedo ? '1' : '0.5';
                redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
            }
        }

        // Clear history when switching rides or clearing assignments
        function clearAssignmentHistory() {
            assignmentHistory = [];
            assignmentHistoryIndex = -1;
            updateUndoRedoButtons();
        }
        
        function showCoachMoveMenu(event, coachId, groupId, rideId) {
            const menu = document.getElementById('coach-move-context-menu');
            if (!menu) return;
            
            const ride = data.rides.find(r => r.id === rideId);
            if (!ride) return;
            
            const group = findGroupById(ride, groupId);
            if (!group) return;
            
            const coach = getCoachById(coachId);
            if (!coach) return;
            
            const currentRole = getCoachRoleInGroup(group, coachId);
            if (!currentRole) return;
            
            // Store move info
            pendingCoachMove = { ride, coachId, groupId, rideId };
            
            // Build role options (other roles in current group)
            const roleOptionsDiv = document.getElementById('coach-move-role-options');
            roleOptionsDiv.innerHTML = '';
            
            const roles = ['leader', 'sweep', 'roam'];
            roles.forEach(role => {
                if (role !== currentRole && role !== 'extraRoam') {
                    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                    const hasCoach = role === 'leader' ? group.coaches.leader : role === 'sweep' ? group.coaches.sweep : group.coaches.roam;
                    
                    // Check if coach can be leader (must meet minimum level requirement)
                    const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (role === 'leader' && (!Number.isFinite(level) || level < minLeaderLevel)) {
                        return; // Skip leader option if not eligible
                    }
                    
                    const button = document.createElement('button');
                    button.className = 'context-menu-item';
                    button.style.cssText = 'width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;';
                    button.textContent = hasCoach ? `Swap with ${roleLabel}` : `Move to ${roleLabel}`;
                    button.onclick = () => {
                        moveCoachToRole(ride, coachId, groupId, role);
                        menu.style.display = 'none';
                        pendingCoachMove = null;
                    };
                    roleOptionsDiv.appendChild(button);
                }
            });
            
            // Build group options (other groups)
            const groupOptionsDiv = document.getElementById('coach-move-group-options');
            groupOptionsDiv.innerHTML = '';
            
            ride.groups.forEach(otherGroup => {
                if (otherGroup.id !== groupId) {
                    const button = document.createElement('button');
                    button.className = 'context-menu-item';
                    button.style.cssText = 'width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;';
                    const groupLabel = otherGroup.label || `Group ${otherGroup.id}`;
                    button.textContent = `Move to ${groupLabel}`;
                    button.onclick = () => {
                        moveCoachToGroup(ride, coachId, groupId, otherGroup.id);
                        menu.style.display = 'none';
                        pendingCoachMove = null;
                    };
                    groupOptionsDiv.appendChild(button);
                }
            });
            
            // Position menu at button location
            menu.style.display = 'block';
            const rect = event.target.getBoundingClientRect();
            menu.style.left = `${rect.right + 5}px`;
            menu.style.top = `${rect.top}px`;
            ensureMenuInViewport(menu, rect, 5);

            startContextMenuAutoClose(menu, () => { menu.style.display = 'none'; pendingCoachMove = null; });
            
            // Close menu when clicking outside
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== event.target) {
                    menu.style.display = 'none';
                    pendingCoachMove = null;
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }
        
        function moveCoachToRole(ride, coachId, groupId, targetRole) {
            // Save state before change
            saveAssignmentState(ride);
            
            const group = findGroupById(ride, groupId);
            if (!group) return;
            
            const coach = getCoachById(coachId);
            if (!coach) return;
            
            // Check minimum level requirement for leader
            if (targetRole === 'leader') {
                const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                if (!Number.isFinite(level) || level < minLeaderLevel) {
                    alert(`Only Level ${minLeaderLevel} or higher coaches can serve as leader.`);
                    return;
                }
            }
            
            const currentRole = getCoachRoleInGroup(group, coachId);
            if (!currentRole) return;
            
            // Get the coach currently in the target role
            let targetCoachId = null;
            if (targetRole === 'leader') targetCoachId = group.coaches.leader;
            else if (targetRole === 'sweep') targetCoachId = group.coaches.sweep;
            else if (targetRole === 'roam') targetCoachId = group.coaches.roam;
            
            // Swap roles
            if (targetCoachId) {
                // Clear both roles
                if (currentRole === 'leader') group.coaches.leader = null;
                else if (currentRole === 'sweep') group.coaches.sweep = null;
                else if (currentRole === 'roam') group.coaches.roam = null;
                else if (currentRole === 'extraRoam' && Array.isArray(group.coaches.extraRoam)) {
                    const index = group.coaches.extraRoam.indexOf(coachId);
                    if (index >= 0) group.coaches.extraRoam.splice(index, 1);
                }
                
                // Assign coaches to new roles
                if (targetRole === 'leader') group.coaches.leader = coachId;
                else if (targetRole === 'sweep') group.coaches.sweep = coachId;
                else if (targetRole === 'roam') group.coaches.roam = coachId;
                
                // Assign target coach to current role
                if (currentRole === 'leader') group.coaches.leader = targetCoachId;
                else if (currentRole === 'sweep') group.coaches.sweep = targetCoachId;
                else if (currentRole === 'roam') group.coaches.roam = targetCoachId;
                else if (currentRole === 'extraRoam') {
                    if (!Array.isArray(group.coaches.extraRoam)) group.coaches.extraRoam = [];
                    group.coaches.extraRoam.push(targetCoachId);
                }
            } else {
                // Target role is empty, just move coach
                if (currentRole === 'leader') group.coaches.leader = null;
                else if (currentRole === 'sweep') group.coaches.sweep = null;
                else if (currentRole === 'roam') group.coaches.roam = null;
                else if (currentRole === 'extraRoam' && Array.isArray(group.coaches.extraRoam)) {
                    const index = group.coaches.extraRoam.indexOf(coachId);
                    if (index >= 0) group.coaches.extraRoam.splice(index, 1);
                }
                
                if (targetRole === 'leader') group.coaches.leader = coachId;
                else if (targetRole === 'sweep') group.coaches.sweep = coachId;
                else if (targetRole === 'roam') group.coaches.roam = coachId;
            }
            
            // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        function moveCoachToGroup(ride, coachId, sourceGroupId, targetGroupId) {
            // Save state before change
            saveAssignmentState(ride);
            
            const sourceGroup = findGroupById(ride, sourceGroupId);
            const targetGroup = findGroupById(ride, targetGroupId);
            if (!sourceGroup || !targetGroup) return;
            
            const coach = getCoachById(coachId);
            if (!coach) return;
            
            // Remove coach from source group
            const currentRole = getCoachRoleInGroup(sourceGroup, coachId);
            if (currentRole) {
                if (currentRole === 'leader') sourceGroup.coaches.leader = null;
                else if (currentRole === 'sweep') sourceGroup.coaches.sweep = null;
                else if (currentRole === 'roam') sourceGroup.coaches.roam = null;
                else if (currentRole === 'extraRoam' && Array.isArray(sourceGroup.coaches.extraRoam)) {
                    const index = sourceGroup.coaches.extraRoam.indexOf(coachId);
                    if (index >= 0) sourceGroup.coaches.extraRoam.splice(index, 1);
                }
            }
            
            // Ensure coach is available
            if (!ride.availableCoaches.includes(coachId)) {
                ride.availableCoaches.push(coachId);
            }
            
            // Add to target group at next available position
            if (!targetGroup.coaches.leader) {
                const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                if (Number.isFinite(level) && level >= minLeaderLevel) {
                    targetGroup.coaches.leader = coachId;
                } else {
                    targetGroup.coaches.sweep = coachId;
                }
            } else if (!targetGroup.coaches.sweep) {
                targetGroup.coaches.sweep = coachId;
            } else if (!targetGroup.coaches.roam) {
                targetGroup.coaches.roam = coachId;
            } else {
                if (!Array.isArray(targetGroup.coaches.extraRoam)) {
                    targetGroup.coaches.extraRoam = [];
                }
                targetGroup.coaches.extraRoam.push(coachId);
            }
            
            // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead
            
            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        function showCoachDropContextMenu(event, ride, coachId, groupId, targetCoachId = null) {
            const menu = document.getElementById('coach-drop-context-menu');
            if (!menu) return;
            
            // Store drop info for context menu actions
            pendingCoachDrop = { ride, coachId, groupId, targetCoachId };
            
            // Position menu at drop location
            menu.style.display = 'block';
            menu.style.left = `${event.clientX}px`;
            menu.style.top = `${event.clientY}px`;
            ensureMenuInViewport(menu, null, 0);
            
            // Remove existing event listeners by cloning
            const addBtn = document.getElementById('coach-drop-add');
            const swapBtn = document.getElementById('coach-drop-swap');
            
            const newAddBtn = addBtn.cloneNode(true);
            const newSwapBtn = swapBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            swapBtn.parentNode.replaceChild(newSwapBtn, swapBtn);
            
            // Update button text if dropping on specific coach
            if (targetCoachId) {
                const targetCoach = getCoachById(targetCoachId);
                newSwapBtn.textContent = targetCoach ? `Swap with ${targetCoach.name}` : 'Swap with Coach';
                newAddBtn.textContent = 'Add Coach to Group';
            } else {
                newSwapBtn.textContent = 'Swap with Coach';
                newAddBtn.textContent = 'Add Coach to Group';
            }
            
            // Add new event listeners
            newAddBtn.addEventListener('click', handleCoachDropAdd);
            newSwapBtn.addEventListener('click', handleCoachDropSwap);

            startContextMenuAutoClose(menu, () => { menu.style.display = 'none'; pendingCoachDrop = null; });
            
            // Close menu when clicking outside
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.style.display = 'none';
                    pendingCoachDrop = null;
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }
        
        function handleCoachDropAdd() {
            if (!pendingCoachDrop) return;
            const { ride, coachId, groupId } = pendingCoachDrop;
            const menu = document.getElementById('coach-drop-context-menu');
            if (menu) menu.style.display = 'none';
            
            const group = findGroupById(ride, groupId);
            if (!group) {
                pendingCoachDrop = null;
                return;
            }
            
            // Save state before change
            saveAssignmentState(ride);
            
            if (!ride.availableCoaches.includes(coachId)) {
                ride.availableCoaches.push(coachId);
            }
            addCoachToGroup(ride, coachId, groupId);
            
            // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead
            
            saveRideToDB(ride);
            renderAssignments(ride);
            pendingCoachDrop = null;
        }
        
        function handleCoachDropSwap() {
            if (!pendingCoachDrop) return;
            const { ride, coachId, groupId, targetCoachId } = pendingCoachDrop;
            const menu = document.getElementById('coach-drop-context-menu');
            if (menu) menu.style.display = 'none';
            
            // Save state before change
            saveAssignmentState(ride);
            
            if (targetCoachId) {
                // Direct swap with specific coach
                swapCoachWithTarget(ride, coachId, groupId, targetCoachId);
                // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead
                saveRideToDB(ride);
                renderAssignments(ride);
            } else {
                // For swap when dropping on group container, show selection dialog
                swapCoachInGroup(ride, coachId, groupId);
            }
            pendingCoachDrop = null;
        }
        
        function insertCoachAtPosition(ride, coachId, groupId, position) {
            const group = findGroupById(ride, groupId);
            if (!group) return;
            
            // Remove coach from any other groups first
            removeCoachFromGroups(ride, coachId);
            
            // Get current coaches in order
            const coachesOrder = [];
            if (group.coaches.leader) coachesOrder.push({ id: group.coaches.leader, role: 'leader' });
            if (group.coaches.sweep) coachesOrder.push({ id: group.coaches.sweep, role: 'sweep' });
            if (group.coaches.roam) coachesOrder.push({ id: group.coaches.roam, role: 'roam' });
            if (Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam.forEach(id => {
                    if (id) coachesOrder.push({ id, role: 'extraRoam' });
                });
            }
            
            // Insert at position
            coachesOrder.splice(position, 0, { id: coachId, role: null });
            
            // Clear all roles
            group.coaches.leader = null;
            group.coaches.sweep = null;
            group.coaches.roam = null;
            group.coaches.extraRoam = [];
            
            // Reassign roles based on new order: Leader, Sweep, Roam, then Roam for rest
            coachesOrder.forEach((coach, index) => {
                const coachObj = getCoachById(coach.id);
                if (!coachObj) return;
                
                if (index === 0) {
                    // First position = Leader (only if meets minimum level requirement)
                    const level = parseInt(coachObj.coachingLicenseLevel || coachObj.level || '1', 10);
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (Number.isFinite(level) && level >= minLeaderLevel) {
                        group.coaches.leader = coach.id;
                    } else {
                        // Not eligible for leader, assign as sweep
                        group.coaches.sweep = coach.id;
                    }
                } else if (index === 1) {
                    // Second position = Sweep (or Leader if first wasn't eligible)
                    if (!group.coaches.leader) {
                        const level = parseInt(coachObj.coachingLicenseLevel || coachObj.level || '1', 10);
                        const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                        if (Number.isFinite(level) && level >= minLeaderLevel) {
                            group.coaches.leader = coach.id;
                        } else {
                            group.coaches.sweep = coach.id;
                        }
                    } else {
                        group.coaches.sweep = coach.id;
                    }
                } else if (index === 2) {
                    // Third position = Roam
                    group.coaches.roam = coach.id;
                } else {
                    // Additional coaches = Roam (in extraRoam array)
                    if (!Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = [];
                    }
                    group.coaches.extraRoam.push(coach.id);
                }
            });
        }
        
        function swapCoachWithTarget(ride, coachId, groupId, targetCoachId) {
            // Save state before change
            saveAssignmentState(ride);
            
            const group = findGroupById(ride, groupId);
            if (!group) return;
            
            // Get the role of the target coach (the one being dropped on)
            const targetRole = getCoachRoleInGroup(group, targetCoachId);
            if (!targetRole) {
                // Target coach not in this group, just add the dragged coach
                if (!ride.availableCoaches.includes(coachId)) {
                    ride.availableCoaches.push(coachId);
                }
                addCoachToGroup(ride, coachId, groupId);
                return;
            }
            
            // Find the dragged coach's current role and group
            let draggedCoachRole = null;
            let draggedCoachGroupId = null;
            ride.groups.forEach(g => {
                const role = getCoachRoleInGroup(g, coachId);
                if (role) {
                    draggedCoachRole = role;
                    draggedCoachGroupId = g.id;
                }
            });
            
            // Ensure both coaches are available
            if (!ride.availableCoaches.includes(coachId)) {
                ride.availableCoaches.push(coachId);
            }
            if (!ride.availableCoaches.includes(targetCoachId)) {
                ride.availableCoaches.push(targetCoachId);
            }
            
            // First, assign dragged coach to target's role (before clearing target)
            if (targetRole === 'extraRoam') {
                if (!Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam = [];
                }
                // Remove target from extraRoam first
                const targetIndex = group.coaches.extraRoam.indexOf(targetCoachId);
                if (targetIndex >= 0) {
                    group.coaches.extraRoam.splice(targetIndex, 1);
                }
                // Add dragged coach
                group.coaches.extraRoam.push(coachId);
            } else {
                // Store target's role temporarily
                // Assign dragged coach to target's role
                group.coaches[targetRole] = coachId;
            }
            
            // Now handle the target coach - assign it to dragged coach's old role
            if (draggedCoachRole) {
                if (draggedCoachGroupId === groupId) {
                    // Both coaches in same group - assign target to dragged coach's old role
                    if (draggedCoachRole === 'extraRoam') {
                        if (!Array.isArray(group.coaches.extraRoam)) {
                            group.coaches.extraRoam = [];
                        }
                        // Remove dragged coach from extraRoam (it's already been moved to targetRole)
                        const draggedIndex = group.coaches.extraRoam.indexOf(coachId);
                        if (draggedIndex >= 0) {
                            group.coaches.extraRoam.splice(draggedIndex, 1);
                        }
                        // Add target to extraRoam
                        group.coaches.extraRoam.push(targetCoachId);
                    } else {
                        // Dragged coach was in a different role, assign target to that role
                        group.coaches[draggedCoachRole] = targetCoachId;
                    }
                } else {
                    // Dragged coach was in different group - assign target to that group/role
                    const sourceGroup = findGroupById(ride, draggedCoachGroupId);
                    if (sourceGroup) {
                        // Remove dragged coach from source group
                        if (draggedCoachRole === 'extraRoam') {
                            if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                                const index = sourceGroup.coaches.extraRoam.indexOf(coachId);
                                if (index >= 0) {
                                    sourceGroup.coaches.extraRoam.splice(index, 1);
                                }
                            }
                        } else {
                            sourceGroup.coaches[draggedCoachRole] = null;
                        }
                        // Assign target to source group
                        if (draggedCoachRole === 'extraRoam') {
                            if (!Array.isArray(sourceGroup.coaches.extraRoam)) {
                                sourceGroup.coaches.extraRoam = [];
                            }
                            sourceGroup.coaches.extraRoam.push(targetCoachId);
                        } else {
                            sourceGroup.coaches[draggedCoachRole] = targetCoachId;
                        }
                    }
                }
            } else {
                // Dragged coach had no role - target becomes unassigned (already cleared above when we assigned dragged coach)
            }
        }

        function handleCoachDrop(ride, payload, dropTarget, ev) {
            const coachId = parseInt(payload.coachId, 10);
            if (!Number.isFinite(coachId)) return;

            // Check if dropping on sidebar or unassigned palette
            const isSidebarDrop = dropTarget.closest('.practice-sidebar') ||
                                  dropTarget.dataset.sidebarDrop === 'true';
            const isUnassignedPalette = isSidebarDrop ||
                                       dropTarget.closest('#new-attendees-sticky') || 
                                       dropTarget.dataset.unassignedList === 'true' ||
                                       dropTarget.id === 'new-attendees-sticky';
            
            if (isUnassignedPalette) {
                // Dropping on sidebar/palette - remove from groups and ensure in availableCoaches
                saveAssignmentState(ride);
                removeCoachFromGroups(ride, coachId);
                if (!ride.availableCoaches.includes(coachId)) {
                    ride.availableCoaches.push(coachId);
                }
                saveRideToDB(ride);
                renderAssignments(ride);
                // Switch sidebar to "unassigned" tab and expand if collapsed
                if (isSidebarDrop) {
                    sidebarCoachesFilter = 'unassigned';
                    if (sidebarCoachesCollapsed) {
                        sidebarCoachesCollapsed = false;
                        applySidebarCollapsedState();
                    }
                    renderSidebars();
                }
                return;
            }

            const dropType = dropTarget.dataset.dropType;
            if (dropType && dropType !== 'coach') return;

            // Save state before change
            saveAssignmentState(ride);

            const targetRole = dropTarget.dataset.role || null;
            const targetGroupIdAttr = dropTarget.dataset.groupId;
            const sourceGroupId = payload.sourceGroupId ? parseInt(payload.sourceGroupId, 10) : null;

            const coach = getCoachById(coachId);
            if (!coach) {
                alert('Selected coach no longer exists.');
                renderAssignments(ride);
                return;
            }

            // Handle drop to unassigned
            if (targetGroupIdAttr === 'unassigned' || !targetGroupIdAttr) {
                removeCoachFromGroups(ride, coachId);
                saveRideToDB(ride);
                renderAssignments(ride);
                return;
            }

            const numericGroupId = parseInt(targetGroupIdAttr, 10);
            if (!Number.isFinite(numericGroupId)) return;

            const group = findGroupById(ride, numericGroupId);
            if (!group) return;

            // Check if dropping on another coach in the same group (reordering)
            if (dropTarget.classList.contains('coach-inline-item')) {
                const targetCoachId = parseInt(dropTarget.dataset.coachId, 10);
                const targetRole = dropTarget.dataset.role;
                
                // If dropping on a coach in the same group, swap roles
                if (sourceGroupId === numericGroupId && Number.isFinite(targetCoachId) && targetCoachId !== coachId) {
                    const draggedRole = payload.sourceRole;
                    const targetCoach = getCoachById(targetCoachId);
                    
                    if (targetCoach && draggedRole) {
                        // Swap the coaches' roles
                        // First, clear both roles temporarily
                        if (draggedRole === 'extraRoam') {
                            if (Array.isArray(group.coaches.extraRoam)) {
                                const index = group.coaches.extraRoam.indexOf(coachId);
                                if (index >= 0) group.coaches.extraRoam.splice(index, 1);
                            }
                        } else {
                            group.coaches[draggedRole] = null;
                        }
                        
                        if (targetRole === 'extraRoam') {
                            if (Array.isArray(group.coaches.extraRoam)) {
                                const index = group.coaches.extraRoam.indexOf(targetCoachId);
                                if (index >= 0) group.coaches.extraRoam.splice(index, 1);
                            }
                        } else {
                            group.coaches[targetRole] = null;
                        }
                        
                        // Assign dragged coach to target's role
                        if (targetRole === 'extraRoam') {
                            if (!Array.isArray(group.coaches.extraRoam)) {
                                group.coaches.extraRoam = [];
                            }
                            if (!group.coaches.extraRoam.includes(coachId)) {
                                group.coaches.extraRoam.push(coachId);
                            }
                        } else {
                            // Check level requirement for leader
                            if (targetRole === 'leader') {
                                const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                                if (!Number.isFinite(level) || level < minLeaderLevel) {
                                    // Can't be leader, restore original state
                                    if (draggedRole === 'extraRoam') {
                                        if (!Array.isArray(group.coaches.extraRoam)) {
                                            group.coaches.extraRoam = [];
                                        }
                                        if (!group.coaches.extraRoam.includes(coachId)) {
                                            group.coaches.extraRoam.push(coachId);
                                        }
                                    } else {
                                        group.coaches[draggedRole] = coachId;
                                    }
                                    if (targetRole === 'extraRoam') {
                                        if (!Array.isArray(group.coaches.extraRoam)) {
                                            group.coaches.extraRoam = [];
                                        }
                                        if (!group.coaches.extraRoam.includes(targetCoachId)) {
                                            group.coaches.extraRoam.push(targetCoachId);
                                        }
                                    } else {
                                        group.coaches[targetRole] = targetCoachId;
                                    }
                                    alert('Only Level 2 or Level 3 coaches can serve as leader.');
                                    saveRideToDB(ride);
                                    renderAssignments(ride);
                                    return;
                                }
                            }
                            group.coaches[targetRole] = coachId;
                        }
                        
                        // Assign target coach to dragged coach's role
                        if (draggedRole === 'extraRoam') {
                            if (!Array.isArray(group.coaches.extraRoam)) {
                                group.coaches.extraRoam = [];
                            }
                            if (!group.coaches.extraRoam.includes(targetCoachId)) {
                                group.coaches.extraRoam.push(targetCoachId);
                            }
                        } else {
                            // Check level requirement for leader
                            if (draggedRole === 'leader') {
                                const targetLevel = parseInt(targetCoach.coachingLicenseLevel || targetCoach.level || '1', 10);
                                if (!Number.isFinite(targetLevel) || targetLevel < 2) {
                                    // Target can't be leader, assign to sweep instead
                                    if (!group.coaches.sweep) {
                                        group.coaches.sweep = targetCoachId;
                                    } else if (!group.coaches.roam) {
                                        group.coaches.roam = targetCoachId;
                                    } else {
                                        if (!Array.isArray(group.coaches.extraRoam)) {
                                            group.coaches.extraRoam = [];
                                        }
                                        if (!group.coaches.extraRoam.includes(targetCoachId)) {
                                            group.coaches.extraRoam.push(targetCoachId);
                                        }
                                    }
                                } else {
                                    group.coaches[draggedRole] = targetCoachId;
                                }
                            } else {
                                group.coaches[draggedRole] = targetCoachId;
                            }
                        }
                        
                        saveRideToDB(ride);
                        renderAssignments(ride);
                        return;
                    }
                }
            }

            // If dropping to a dropzone with a specific role (like leader drop zone), assign to that role
            if (targetRole && targetRole !== 'unassigned') {
                // Dropping to a specific role slot (e.g., leader drop zone)
                const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                if (targetRole === 'leader' && (!Number.isFinite(level) || level < minLeaderLevel)) {
                    alert(`Only Level ${minLeaderLevel} or higher coaches can serve as leader.`);
                    renderAssignments(ride);
                    return;
                }

                if (!ride.availableCoaches.includes(coachId)) {
                    ride.availableCoaches.push(coachId);
                }

                assignCoachToGroup(ride, coachId, numericGroupId, targetRole);
            } else {
                // If dropping to a dropzone (no specific role), add coach to group
                // Remove coach from source group if moving from another group
                if (sourceGroupId && sourceGroupId !== numericGroupId) {
                    removeCoachFromGroups(ride, coachId);
                }
                
                // Add coach to target group (will assign to first available role)
                addCoachToGroup(ride, coachId, numericGroupId);
            }

            // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead

            saveRideToDB(ride);
            renderAssignments(ride);
        }
        
        function getCoachRoleInGroup(group, coachId) {
            if (group.coaches.leader === coachId) return 'leader';
            if (group.coaches.sweep === coachId) return 'sweep';
            if (group.coaches.roam === coachId) return 'roam';
            if (Array.isArray(group.coaches.extraRoam) && group.coaches.extraRoam.includes(coachId)) return 'extraRoam';
            return null;
        }
        
        function addCoachToGroup(ride, coachId, groupId) {
            const group = findGroupById(ride, groupId);
            if (!group) return false;
            
            // Remove coach from any other groups first
            removeCoachFromGroups(ride, coachId);
            
            // Ensure coach is marked as available
            if (!ride.availableCoaches.includes(coachId)) {
                ride.availableCoaches.push(coachId);
            }
            
            // Add to first available role: leader, sweep, roam, then extraRoam
            if (!group.coaches.leader) {
                const coach = getCoachById(coachId);
                if (coach) {
                    const level = parseInt(coach.coachingLicenseLevel || coach.level || '1', 10);
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (Number.isFinite(level) && level >= minLeaderLevel) {
                        group.coaches.leader = coachId;
                        return true;
                    }
                }
            }
            if (!group.coaches.sweep) {
                group.coaches.sweep = coachId;
                return true;
            }
            if (!group.coaches.roam) {
                group.coaches.roam = coachId;
                return true;
            }
            // Add to extraRoam
            if (!Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam = [];
            }
            if (!group.coaches.extraRoam.includes(coachId)) {
                group.coaches.extraRoam.push(coachId);
                return true;
            }
            return false;
        }
        
        function swapCoachInGroup(ride, coachId, groupId) {
            // Save state before change
            saveAssignmentState(ride);
            
            const group = findGroupById(ride, groupId);
            if (!group) return;
            
            // Get list of coaches in group
            const coachesInGroup = [];
            if (group.coaches.leader) {
                const coach = getCoachById(group.coaches.leader);
                if (coach) coachesInGroup.push({ id: coach.id, name: coach.name, role: 'leader' });
            }
            if (group.coaches.sweep) {
                const coach = getCoachById(group.coaches.sweep);
                if (coach) coachesInGroup.push({ id: coach.id, name: coach.name, role: 'sweep' });
            }
            if (group.coaches.roam) {
                const coach = getCoachById(group.coaches.roam);
                if (coach) coachesInGroup.push({ id: coach.id, name: coach.name, role: 'roam' });
            }
            if (Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam.forEach(id => {
                    if (id) {
                        const coach = getCoachById(id);
                        if (coach) coachesInGroup.push({ id: coach.id, name: coach.name, role: 'extraRoam' });
                    }
                });
            }
            
            if (coachesInGroup.length === 0) {
                addCoachToGroup(ride, coachId, groupId);
                return;
            }
            
            // Show selection dialog
            const coachList = coachesInGroup.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
            const selection = prompt(`Select coach to swap with (1-${coachesInGroup.length}):\n\n${coachList}`);
            const selectedIndex = parseInt(selection, 10) - 1;
            
            if (selectedIndex >= 0 && selectedIndex < coachesInGroup.length) {
                const targetCoach = coachesInGroup[selectedIndex];
                const targetRole = targetCoach.role;
                
                // Swap the coaches
                assignCoachToGroup(ride, coachId, groupId, targetRole);
            }
        }
        
        function reorderCoachesInGroup(ride, group, draggedCoachId, targetCoachId) {
            // Get current order of coaches
            const coachesOrder = [];
            if (group.coaches.leader) coachesOrder.push({ id: group.coaches.leader, role: 'leader' });
            if (group.coaches.sweep) coachesOrder.push({ id: group.coaches.sweep, role: 'sweep' });
            if (group.coaches.roam) coachesOrder.push({ id: group.coaches.roam, role: 'roam' });
            if (Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam.forEach(id => {
                    if (id) coachesOrder.push({ id, role: 'extraRoam' });
                });
            }
            
            // Find indices
            const draggedIndex = coachesOrder.findIndex(c => c.id === draggedCoachId);
            const targetIndex = coachesOrder.findIndex(c => c.id === targetCoachId);
            
            if (draggedIndex === -1 || targetIndex === -1) return;
            
            // Remove dragged coach from its position
            const draggedCoach = coachesOrder.splice(draggedIndex, 1)[0];
            
            // Insert at target position
            const newIndex = draggedIndex < targetIndex ? targetIndex : targetIndex;
            coachesOrder.splice(newIndex, 0, draggedCoach);
            
            // Clear all roles
            group.coaches.leader = null;
            group.coaches.sweep = null;
            group.coaches.roam = null;
            group.coaches.extraRoam = [];
            
            // Reassign roles based on new order: Leader, Sweep, Roam, then Roam for rest
            coachesOrder.forEach((coach, index) => {
                const coachObj = getCoachById(coach.id);
                if (!coachObj) return;
                
                if (index === 0) {
                    // First position = Leader (only if meets minimum level requirement)
                    const level = parseInt(coachObj.coachingLicenseLevel || coachObj.level || '1', 10);
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (Number.isFinite(level) && level >= minLeaderLevel) {
                        group.coaches.leader = coach.id;
                    } else {
                        // Not eligible for leader, assign as sweep
                        group.coaches.sweep = coach.id;
                    }
                } else if (index === 1) {
                    // Second position = Sweep (or Leader if first wasn't eligible)
                    if (!group.coaches.leader) {
                        const level = parseInt(coachObj.coachingLicenseLevel || coachObj.level || '1', 10);
                        const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                        if (Number.isFinite(level) && level >= minLeaderLevel) {
                            group.coaches.leader = coach.id;
                        } else {
                            group.coaches.sweep = coach.id;
                        }
                    } else {
                        group.coaches.sweep = coach.id;
                    }
                } else if (index === 2) {
                    // Third position = Roam
                    group.coaches.roam = coach.id;
                } else {
                    // Additional coaches = Roam (in extraRoam array)
                    if (!Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = [];
                    }
                    group.coaches.extraRoam.push(coach.id);
                }
            });
        }

        function moveRiderBetweenGroups(currentGroupId, riderId, direction) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            const currentGroup = findGroupById(ride, currentGroupId);
            if (!currentGroup) return;

            // Verify rider is in current group
            if (!currentGroup.riders.includes(riderId)) return;

            // Groups are sorted by fitness score (descending) in renderAssignments
            // So Group 1 is fastest, Group 2 is next fastest, etc.
            // direction -1 = move to previous group (faster/higher fitness) - UP arrow
            // direction 1 = move to next group (slower/lower fitness) - DOWN arrow
            
            // Get groups sorted by fitness (same order as displayed)
            const sortedGroups = ride.groups.slice().sort(getGroupPaceComparator(ride));

            // Find current group's index in sorted array
            const currentGroupIndex = sortedGroups.findIndex(g => g.id === currentGroupId);
            if (currentGroupIndex === -1) return;

            // Calculate target group index
            const targetGroupIndex = currentGroupIndex + direction;
            if (targetGroupIndex < 0 || targetGroupIndex >= sortedGroups.length) {
                // Cannot move - already at first or last group
                return;
            }

            const targetGroup = sortedGroups[targetGroupIndex];
            if (!targetGroup) return;

            // Check target group has at least one coach
            const coachCount = countGroupCoaches(targetGroup);
            if (coachCount === 0) {
                alert('Target group must have at least one coach assigned before moving riders to it.');
                renderAssignments(ride);
                return;
            }

            // Allow moving riders even if it exceeds capacity - group will be marked as non-compliant (red)
            // This allows flexibility when moving things around

            // Remove rider from current group
            currentGroup.riders = currentGroup.riders.filter(id => id !== riderId);

            // Add rider to target group
            if (!targetGroup.riders.includes(riderId)) {
                targetGroup.riders.push(riderId);
            }

            // Validate requirements for both groups after move
            const currentWarnings = validateGroupRequirements(currentGroup, ride);
            const targetWarnings = validateGroupRequirements(targetGroup, ride);
            const allWarnings = [...currentWarnings, ...targetWarnings];

            if (allWarnings.length > 0) {
                const warningMsg = allWarnings.join('\n');
                alert(`Warning: Moving this rider may violate requirements:\n\n${warningMsg}\n\nThe move has been made, but please review the groups.`);
            }

            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function validateGroupRequirements(group, ride) {
            const warnings = [];
            const coachCount = countGroupCoaches(group);
            const capacity = groupCapacity(group);
            const ridersPerCoach = getAutoAssignSetting('ridersPerCoach', 6);

            // Check minimum leader level requirement
            if (group.coaches.leader) {
                const leader = getCoachById(group.coaches.leader);
                if (leader) {
                    const leaderLevel = parseInt(leader.coachingLicenseLevel || leader.level || '1', 10);
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (!Number.isFinite(leaderLevel) || leaderLevel < minLeaderLevel) {
                        warnings.push(`Leader must be Level ${minLeaderLevel} or higher (current: Level ${leaderLevel || 1})`);
                    }
                }
            } else {
                warnings.push('Group must have a leader assigned');
            }

            // Check leader:rider ratio based on total coaches (not just leader)
            if (coachCount > 0) {
                const ridersPerCoachActual = group.riders.length / coachCount;
                if (ridersPerCoachActual > ridersPerCoach) {
                    warnings.push(`Leader:rider ratio exceeds 1:${ridersPerCoach} (current: 1:${Math.ceil(ridersPerCoachActual)})`);
                }
            }

            // Check riders per coach requirement (for all coaches)
            if (coachCount > 0 && group.riders.length > capacity) {
                warnings.push(`Group exceeds capacity: ${group.riders.length} riders with ${coachCount} coach(es) (capacity: ${capacity} = ${coachCount} × ${ridersPerCoach})`);
            }

            return warnings;
        }

        // Show a popup with group validation warnings when clicking the ⚠ icon
        function showGroupWarningPopup(event, groupId) {
            event.stopPropagation();
            event.preventDefault();

            // Remove any existing popup
            const existing = document.querySelector('.group-warning-popup');
            if (existing) existing.remove();

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            const group = findGroupById(ride, groupId);
            if (!group) return;

            const warnings = validateGroupRequirements(group, ride);
            if (warnings.length === 0) return;

            const popup = document.createElement('div');
            popup.className = 'group-warning-popup';
            popup.innerHTML = `
                <div class="group-warning-popup-title">⚠ ${group.label} Warnings</div>
                <ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
            `;

            document.body.appendChild(popup);

            // Position near the click
            const rect = event.target.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 6}px`;
            ensureMenuInViewport(popup, rect, 6);

            startContextMenuAutoClose(popup, () => popup.remove());

            // Dismiss on click outside
            setTimeout(() => {
                document.addEventListener('click', function dismissPopup(e) {
                    if (!popup.contains(e.target)) {
                        popup.remove();
                        document.removeEventListener('click', dismissPopup);
                    }
                });
            }, 0);
        }


        // Initialize on load
        init();
