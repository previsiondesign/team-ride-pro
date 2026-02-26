// app-rides.js - Ride CRUD, practice planner, calendar, practice location/roster filtering

        function getRideStartTime(ride) {
            let startTime = ride.startTime || ride.time || '';
            if (!startTime && ride.date) {
                const settings = data.seasonSettings || {};
                const practices = Array.isArray(settings.practices) ? settings.practices : [];
                const rideDateObj = parseISODate(ride.date);
                if (rideDateObj) {
                    const weekday = rideDateObj.getDay();
                    const matchedPractice = practices.find(p => p.dayOfWeek === weekday);
                    if (matchedPractice) startTime = matchedPractice.time || matchedPractice.startTime || '';
                }
            }
            return startTime;
        }

        function isRidePastByStartTime(ride) {
            const rideDate = parseISODate(ride.date);
            if (!rideDate) return false;
            const now = new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            rideDate.setHours(0, 0, 0, 0);
            if (rideDate > today) return false;
            if (rideDate < today) return true;
            const startTime = getRideStartTime(ride);
            if (!startTime) return false;
            const [h, m] = startTime.split(':').map(Number);
            if (isNaN(h)) return false;
            const startDateTime = new Date(rideDate);
            startDateTime.setHours(h, m || 0, 0, 0);
            return now >= startDateTime;
        }

        function getValidPracticeDates() {
            // Returns a Set of valid practice date strings (ISO format) that match the calendar
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const startDate = parseISODate(settings.startDate);
            const endDate = parseISODate(settings.endDate);
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            
            const validDates = new Set();
            let seasonStart = null;
            let seasonEnd = null;
            
            // If season dates are set, use them; otherwise determine from individual rides
            if (startDate && endDate && startDate <= endDate) {
                seasonStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                seasonEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                
                // Add regular practices based on day of week (excluding planner-excluded series)
                const cursor = new Date(seasonStart.getTime());
                while (cursor <= seasonEnd) {
                    const dateKey = formatDateToISO(cursor);
                    const weekday = cursor.getDay();
                    const matchedPractices = practices.filter(practice => practice.dayOfWeek === weekday && !practice.excludeFromPlanner);
                    if (matchedPractices.length > 0) {
                        validDates.add(dateKey);
                    }
                    cursor.setDate(cursor.getDate() + 1);
                }
            } else {
                // No season dates set - determine range from individual rides
                const rideDates = [];
                if (Array.isArray(data.rides)) {
                    data.rides.forEach(ride => {
                        if (!ride.date) return;
                        const rideDate = parseISODate(ride.date);
                        if (rideDate) rideDates.push(rideDate);
                    });
                }
                
                if (rideDates.length === 0) {
                    return validDates; // Empty set
                }
                
                rideDates.sort((a, b) => a - b);
                seasonStart = new Date(rideDates[0].getFullYear(), rideDates[0].getMonth(), 1);
                const lastRideDate = rideDates[rideDates.length - 1];
                seasonEnd = new Date(lastRideDate.getFullYear(), lastRideDate.getMonth() + 1, 0);
            }
            
            // Add individual practices from data.rides that fall within the season date range
            // Exclude deleted practices and include rescheduled practices on their new date
            if (Array.isArray(data.rides) && seasonStart && seasonEnd) {
                data.rides.forEach(ride => {
                    if (!ride.date) return;
                    // Skip deleted practices
                    if (ride.deleted) return;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return;
                    
                    // Check if ride date is within season range
                    if (rideDate >= seasonStart && rideDate <= seasonEnd) {
                        const dateKey = formatDateToISO(rideDate);
                        // Include rescheduled practices on their new date
                        if (ride.rescheduledFrom) {
                            validDates.add(dateKey);
                        } else {
                            // For regular practices, only add if it matches a scheduled practice day
                            // (This prevents deleted/superseded practices from being considered valid)
                            const weekday = rideDate.getDay();
                            const matchedPractices = practices.filter(practice => practice.dayOfWeek === weekday);
                            if (matchedPractices.length > 0) {
                                validDates.add(dateKey);
                            }
                        }
                    }
                });
            }
            
            return validDates;
        }

        function cleanInvalidRides() {
            // Remove rides that are outside the season date range (if season is set)
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const startDate = parseISODate(settings.startDate);
            const endDate = parseISODate(settings.endDate);
            let cleaned = false;
            
            // Only clean up if season dates are explicitly set
            if (!startDate || !endDate || startDate > endDate) {
                // No season set, keep all rides (but remove ones without dates)
                const beforeLength = data.rides.length;
                data.rides = data.rides.filter(ride => {
                    if (!ride.date) {
                        cleaned = true;
                        return false;
                    }
                    return true;
                });
                if (cleaned && data.rides.length !== beforeLength) {
                    // Check if current ride was removed
                    if (data.currentRide && !data.rides.find(r => r.id === data.currentRide)) {
                        data.currentRide = null;
                    }
                    saveData();
                }
                return cleaned;
            }
            
            const seasonStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const seasonEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            
            // Build set of valid scheduled practice dates (dates that match recurring schedule)
            const validScheduledDates = new Set();
            if (practices.length > 0) {
                const cursor = new Date(seasonStart.getTime());
                while (cursor <= seasonEnd) {
                    const dateKey = formatDateToISO(cursor);
                    const weekday = cursor.getDay();
                    const matchedPractices = practices.filter(practice => practice.dayOfWeek === weekday);
                    if (matchedPractices.length > 0) {
                        validScheduledDates.add(dateKey);
                    }
                    cursor.setDate(cursor.getDate() + 1);
                }
            }
            
            // Remove rides outside season range, without dates, or that don't match the schedule
            const beforeLength = data.rides.length;
            data.rides = data.rides.filter(ride => {
                if (!ride.date) {
                    cleaned = true;
                    return false; // Remove rides without dates
                }
                const rideDate = parseISODate(ride.date);
                if (!rideDate) {
                    cleaned = true;
                    return false; // Remove rides with invalid dates
                }
                rideDate.setHours(0, 0, 0, 0);
                if (rideDate < seasonStart || rideDate > seasonEnd) {
                    cleaned = true;
                    return false; // Remove rides outside season range
                }
                
                // If there are scheduled practices defined, remove rides that don't match the schedule
                // BUT exclude rescheduled practices (they are exceptions and should be kept)
                if (practices.length > 0 && !ride.rescheduledFrom && !validScheduledDates.has(ride.date)) {
                    cleaned = true;
                    return false; // Remove rides that don't match the current schedule (unless rescheduled)
                }
                
                return true; // Keep rides within season range and matching schedule (or keep all if no schedule)
            });
            
            // If current ride was removed, clear it
            if (data.currentRide && !data.rides.find(r => r.id === data.currentRide)) {
                data.currentRide = null;
                cleaned = true;
            }
            
            if (cleaned) {
                saveData();
            }
            
            return cleaned;
        }

        // Helper function to determine if a ride corresponds to a refined practice
        // Helper function to get the practice object for a ride
        function getPracticeForRide(ride) {
            if (!ride || !ride.date) return null;
            
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            
            // Check for specific date practice first
            const specificPractice = practices.find(p => p.specificDate === ride.date);
            if (specificPractice) return specificPractice;
            
            // Check for recurring day-of-week practice
            const rideDate = parseISODate(ride.date);
            if (rideDate) {
                const weekday = rideDate.getDay(); // Returns 0-6 (0 = Sunday)
                // Normalize dayOfWeek to number for comparison (handle string/number mismatches)
                const recurringPractice = practices.find(p => {
                    const practiceDayOfWeek = typeof p.dayOfWeek === 'string' ? parseInt(p.dayOfWeek, 10) : p.dayOfWeek;
                    const hasSpecificDate = p.specificDate != null && p.specificDate !== undefined && p.specificDate !== '';
                    return Number(practiceDayOfWeek) === weekday && !hasSpecificDate;
                });
                if (recurringPractice) return recurringPractice;
            }
            
            return null;
        }
        
        // Helper function to determine if a ride corresponds to a refined practice
        function isRideRefined(ride) {
            const practice = getPracticeForRide(ride);
            if (practice && practice.rosterFilter && practice.rosterFilter.filterType) {
                console.log('🔵 isRideRefined: Found refined practice for date', ride.date);
                return true;
            }
            return false;
        }
        
        // Helper function to get filtered rider IDs for a refined ride
        function getFilteredRiderIdsForRide(ride) {
            const practice = getPracticeForRide(ride);
            if (!practice || !practice.rosterFilter || !practice.rosterFilter.filterType) {
                // Not refined - return all non-archived rider IDs
                return (data.riders || []).filter(r => !r.archived).map(r => r.id);
            }
            
            // Get filtered riders using existing function
            const filteredRiders = getFilteredRidersForPractice(practice);
            return filteredRiders.map(r => r.id);
        }
        
        async function ensureRidesFromSchedule() {
            // Create rides for any scheduled practice dates that don't have rides yet
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const startDate = parseISODate(settings.startDate);
            const endDate = parseISODate(settings.endDate);
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            
            if (!startDate || !endDate || startDate > endDate || practices.length === 0) {
                return; // No schedule to create rides from
            }
            
            const seasonStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const seasonEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            
            // Get existing ride dates (non-deleted only)
            const existingRideDates = new Set();
            const deletedRideDates = new Set(); // Track deleted dates so we don't recreate them
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.date) {
                        if (ride.deleted) {
                            deletedRideDates.add(ride.date);
                        } else {
                            existingRideDates.add(ride.date);
                        }
                    }
                });
            }
            
            // Create rides for each scheduled practice date
            const cursor = new Date(seasonStart.getTime());
            let ridesCreated = false;
            
            while (cursor <= seasonEnd) {
                const dateKey = formatDateToISO(cursor);
                const weekday = cursor.getDay();
                
                // Check for specific date practice first, then day-of-week
                const specificPractice = practices.find(p => p.specificDate === dateKey);
                const matchedPractices = specificPractice 
                    ? [specificPractice]
                    : practices.filter(practice => practice.dayOfWeek === weekday && !practice.specificDate);
                
                // If this date has a scheduled practice and no non-deleted ride exists, create one
                // But skip if this date was explicitly deleted
                if (matchedPractices.length > 0 && !existingRideDates.has(dateKey) && !deletedRideDates.has(dateKey)) {
                    // Use the first practice time if multiple match the same day
                    const practice = matchedPractices[0];
                    const allRiderIds = (data.riders || []).map(r => r.id);
                    
                    // STEP 1 & 2: For refined rides, select only riders that qualify under the filter
                    // For regular rides, default to all riders selected
                    const isRefined = practice.rosterFilter != null && practice.rosterFilter.filterType != null;
                    let defaultAvailableRiders;
                    if (isRefined) {
                        // Get filtered riders that match the refinement rules
                        const filteredRiders = getFilteredRidersForPractice(practice);
                        defaultAvailableRiders = filteredRiders.map(r => r.id);
                        console.log('🔵 ensureRidesFromSchedule: Creating refined ride with', defaultAvailableRiders.length, 'filtered riders for date', dateKey);
                    } else {
                        // Regular ride - all riders selected by default
                        defaultAvailableRiders = [...allRiderIds];
                    }
                    
                    const ride = {
                        id: Date.now() + Math.floor(Math.random() * 1000) + cursor.getTime(),
                        date: dateKey,
                        time: practice.time || practice.startTime || '',
                        endTime: practice.endTime || '',
                        description: practice.description || '',
                        meetLocation: practice.meetLocation || '',
                        locationLat: practice.locationLat || null,
                        locationLng: practice.locationLng || null,
                        goals: '',
                        groups: [],
                        availableRiders: defaultAvailableRiders,
                        availableCoaches: [],
                        cancelled: false,
                        deleted: false // Ensure new rides are not marked as deleted
                    };
                    
                    ridesCreated = true;
                    
                    // Save to Supabase if authenticated - call Supabase directly to avoid local createRide function shadowing
                    const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
                    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                    if (client && currentUser) {
                        try {
                            console.log('🔵 ensureRidesFromSchedule: Creating ride in Supabase for date', dateKey);
                            // Map ride to database format (same as scripts/database.js createRide does)
                            const dbData = {
                                date: ride.date,
                                time: ride.time || '',
                                end_time: ride.endTime || '',
                                description: ride.description || '',
                                meet_location: ride.meetLocation || '',
                                location_lat: ride.locationLat != null ? ride.locationLat : null,
                                location_lng: ride.locationLng != null ? ride.locationLng : null,
                                goals: ride.goals || '',
                                available_coaches: ride.availableCoaches || [],
                                available_riders: ride.availableRiders || [],
                                assignments: ride.assignments || {},
                                groups: ride.groups || [],
                                cancelled: ride.cancelled || false,
                                cancellation_reason: '',
                                deleted: ride.deleted || false,
                                rescheduled_from: null,
                                published_groups: ride.publishedGroups || false
                            };
                            // Call Supabase directly (same as scripts/database.js createRide function)
                            const { data: createdData, error } = await client
                                .from('rides')
                                .insert([dbData])
                                .select()
                                .single();
                            if (error) throw error;
                            // Map back to app structure (same as scripts/database.js createRide does)
                            const created = {
                                id: createdData.id,
                                date: createdData.date,
                                time: createdData.time || '',
                                endTime: createdData.end_time || createdData.endTime || '',
                                description: createdData.description || '',
                                meetLocation: createdData.meet_location || createdData.meetLocation || '',
                                locationLat: createdData.location_lat != null ? createdData.location_lat : (createdData.locationLat != null ? createdData.locationLat : null),
                                locationLng: createdData.location_lng != null ? createdData.location_lng : (createdData.locationLng != null ? createdData.locationLng : null),
                                goals: createdData.goals || '',
                                availableCoaches: createdData.available_coaches || [],
                                availableRiders: createdData.available_riders || [],
                                assignments: createdData.assignments || {},
                                groups: createdData.groups || [],
                                cancelled: createdData.cancelled || false,
                                cancellationReason: createdData.cancellation_reason || createdData.cancellationReason || '',
                                deleted: createdData.deleted || false,
                                rescheduledFrom: createdData.rescheduled_from || createdData.rescheduledFrom || null,
                                publishedGroups: createdData.published_groups || false,
                                isPersisted: true
                            };
                            console.log('🔵 ensureRidesFromSchedule: Created ride in Supabase, id:', created.id, 'date:', created.date);
                            // Use the Supabase ID and merge with local data
                            const newRide = { ...ride, ...created };
                            data.rides.push(newRide);
                            // Also save to localStorage as backup
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
                            } catch (lsError) {
                                console.error('Error saving to localStorage:', lsError);
                            }
                        } catch (error) {
                            console.error('🔵 ensureRidesFromSchedule: Error creating ride in Supabase:', error);
                            // If create fails, add to local array as fallback
                            data.rides.push(ride);
                        }
                    } else {
                        // Not authenticated - add to local array
                        data.rides.push(ride);
                    }
                }
                
                cursor.setDate(cursor.getDate() + 1);
            }
            
            if (ridesCreated) {
                saveData(); // Also save to localStorage as backup
            }
        }
        
        function renderRides() {
            // Reload data to ensure we have the latest practice dates from team dashboard
            // This ensures practice dates are refreshed every time Practice Planner is opened
            const currentRideId = data.currentRide; // Preserve current selection
            loadData();
            if (currentRideId) {
                data.currentRide = currentRideId; // Restore current selection
            }
            
            // Clean up any rides that don't match the calendar before rendering calendar/current ride
            cleanInvalidRides();
            
            // Create rides for any scheduled practice dates that don't have rides yet
            ensureRidesFromSchedule();

            // Calendar is now rendered in settings tab, not here - refresh it to show latest dates
            renderSeasonCalendarForSettings();
            updateHeaderEditSeasonButton();
            
            // Get valid practice dates from the calendar (reads from refreshed data.seasonSettings)
            const validDates = getValidPracticeDates();
            
            // Find the next chronological practice based on current date
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
            
            // Filter rides: exclude deleted, include cancelled (but not for auto-selection), include rescheduled on new date
            // First, get all valid rides (not deleted, not yet started based on start time)
            const allValidRides = (data.rides || [])
                .filter(ride => {
                    if (!ride.date) return false;
                    if (ride.deleted) return false;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return false;
                    rideDate.setHours(0, 0, 0, 0);
                    if (rideDate < today) return false;
                    if (isRidePastByStartTime(ride)) return false;
                    return true;
                });
            
            // Separate cancelled and non-cancelled rides
            const cancelledRides = allValidRides.filter(ride => ride.cancelled);
            const nonCancelledRides = allValidRides.filter(ride => !ride.cancelled);
            
            // For auto-selection, use only non-cancelled rides that match calendar (or rescheduled)
            // Also exclude rides from practice series marked as excluded from planner
            const upcomingRides = nonCancelledRides
                .filter(ride => {
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return false;
                    const dateKey = formatDateToISO(rideDate);
                    
                    // Exclude rides from excluded practice series
                    if (isRideDateExcludedFromPlanner(ride.date)) return false;
                    
                    // Include if it matches calendar OR if it's rescheduled (rescheduled practices are exceptions)
                    if (ride.rescheduledFrom) {
                        return true; // Always include rescheduled practices
                    }
                    
                    // For regular practices, must match a valid calendar date
                    if (validDates.size > 0 && !validDates.has(dateKey)) return false;
                    
                    return true;
                })
                .sort((a, b) => {
                    const dateA = parseISODate(a.date);
                    const dateB = parseISODate(b.date);
                    if (!dateA || !dateB) return 0;
                    return dateA - dateB;
                });
            
            // When landing is disabled, auto-select next practice (old behavior: go straight to planner)
            if (!USE_PRACTICE_PLANNER_LANDING && upcomingRides.length > 0) {
                const nextRide = upcomingRides[0];
                const currentRide = data.currentRide ? data.rides.find(r => r.id === data.currentRide) : null;
                // Always override when there's no valid currentRide (null/deleted/missing)
                let shouldSetNext = !data.currentRide || !currentRide;
                // On the very first render of a session, default to the next upcoming
                // practice regardless of what lastOpenedRideId was stored. This handles
                // stale persisted rides (past, far-future, excluded, etc.). After this
                // first render, respect whatever practice the user navigates to — past
                // practices, future practices, etc. are all valid explicit choices.
                if (!shouldSetNext && !_initialRideSelectionDone && currentRide.id !== nextRide.id) {
                    shouldSetNext = true;
                }
                _initialRideSelectionDone = true;
                if (shouldSetNext) {
                    data.currentRide = nextRide.id;
                    persistLastOpenedRide();
                    saveData();
                }
                if (practicePlannerView === 'home' || practicePlannerView === 'groupMethod' || practicePlannerView === 'picker') {
                    practicePlannerView = 'planner';
                }
                if (practicePlannerView === 'planner') {
                    const selectedRide = data.rides.find(r => r.id === data.currentRide);
                    if (selectedRide && !selectedRide.planningStarted && (!selectedRide.groups || selectedRide.groups.length === 0)) {
                        practicePlannerView = 'plannerSetup';
                    }
                }
            }
            
            // Update "Plan the Next Practice on [DATE]" button label and disabled state
            const nextRide = upcomingRides.length > 0 ? upcomingRides[0] : null;
            const nextDateLabel = document.getElementById('next-practice-date-label');
            const planNextBtn = document.getElementById('plan-next-practice-btn');
            const nextDateFormatted = (() => {
                if (!nextRide) return '';
                const rideDate = parseISODate(nextRide.date);
                return rideDate ? rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : nextRide.date;
            })();
            if (nextDateLabel) {
                nextDateLabel.textContent = nextDateFormatted || 'No upcoming practice';
            }
            if (planNextBtn) {
                planNextBtn.disabled = !nextRide;
            }
            const homeNextDateEl = document.getElementById('practice-home-next-date');
            if (homeNextDateEl) {
                homeNextDateEl.textContent = nextDateFormatted ? `Next Practice: ${nextDateFormatted}` : '';
            }
            
            // Show/hide views based on practicePlannerView
            const homeEl = document.getElementById('practice-planner-home');
            const groupMethodEl = document.getElementById('practice-group-method-home');
            const pickerEl = document.getElementById('practice-calendar-picker');
            const plannerEl = document.getElementById('current-ride');
            const setupEl = document.getElementById('practice-planner-setup');
            const attendEl = document.getElementById('practice-attendance-view');
            const postAttendEl = document.getElementById('practice-post-attendance');
            const copyPriorEl = document.getElementById('practice-copy-prior-view');

            const allViews = [homeEl, groupMethodEl, pickerEl, plannerEl, setupEl, attendEl, postAttendEl, copyPriorEl];
            allViews.forEach(el => { if (el) el.style.display = 'none'; });

            if (practicePlannerView === 'home') {
                if (homeEl) homeEl.style.display = '';
            } else if (practicePlannerView === 'groupMethod') {
                if (groupMethodEl) groupMethodEl.style.display = '';
            } else if (practicePlannerView === 'picker') {
                if (pickerEl) pickerEl.style.display = '';
            } else if (practicePlannerView === 'plannerSetup') {
                if (setupEl) setupEl.style.display = '';
                const setupHeading = document.getElementById('planner-setup-heading');
                if (setupHeading && data.currentRide) {
                    const setupRide = data.rides.find(r => r.id === data.currentRide);
                    if (setupRide) {
                        const setupDate = parseISODate(setupRide.date);
                        const formattedDate = setupDate
                            ? setupDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                            : setupRide.date;
                        const isNextLabel = (() => {
                            if (!setupDate) return false;
                            const upcomingCheck = (data.rides || [])
                                .filter(r => !r.deleted && !r.cancelled && r.date && !isRidePastByStartTime(r) && !isRideDateExcludedFromPlanner(r.date))
                                .sort((a, b) => (parseISODate(a.date) || 0) - (parseISODate(b.date) || 0));
                            return upcomingCheck.length > 0 && upcomingCheck[0].id === setupRide.id;
                        })();
                        const suffix = isNextLabel ? ' (next)' : '';
                        setupHeading.textContent = `How would you like to start planning the ${formattedDate}${suffix} practice?`;
                    }
                }
            } else if (practicePlannerView === 'attendance') {
                if (attendEl) attendEl.style.display = '';
                if (data.currentRide) {
                    const ride = data.rides.find(r => r.id === data.currentRide);
                    if (ride) {
                        showSidebars();
                    }
                }
            } else if (practicePlannerView === 'postAttendance') {
                if (postAttendEl) postAttendEl.style.display = '';
            } else if (practicePlannerView === 'copyPrior') {
                if (copyPriorEl) copyPriorEl.style.display = '';
            } else if (practicePlannerView === 'planner') {
                if (data.currentRide) {
                    const currentRide = data.rides.find(r => r.id === data.currentRide);
                    if (currentRide && !currentRide.deleted) {
                        if (plannerEl) plannerEl.style.display = 'block';
                        loadCurrentRide();
                    } else {
                        data.currentRide = null;
                        hideSidebars();
                        practicePlannerView = 'home';
                        if (homeEl) homeEl.style.display = '';
                    }
                } else {
                    practicePlannerView = 'home';
                    hideSidebars();
                    if (homeEl) homeEl.style.display = '';
                }
            }
            
            const navSection = document.getElementById('practice-navigation');
            if (navSection) navSection.style.display = practicePlannerView === 'planner' ? '' : 'none';
        }

        function updateHeaderEditSeasonButton() {
            // Season Setup button is now always visible in user menu - no need to show/hide
            // Function kept for backwards compatibility but does nothing
        }

        function loadRide(rideId) {
            data.currentRide = rideId;
            saveData();
            practicePlannerView = 'planner';
            loadCurrentRide();
        }

        async function persistLastOpenedRide() {
            if (data.currentRide == null) return;
            if (!data.seasonSettings) data.seasonSettings = {};
            data.seasonSettings.lastOpenedRideId = data.currentRide;
            if (typeof updateSeasonSettings === 'function') {
                try {
                    await updateSeasonSettings(data.seasonSettings);
                } catch (e) {
                    console.warn('Could not persist last-opened practice:', e);
                }
            }
        }

        function openPlanNextPractice() {
            const validDates = getValidPracticeDates();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingRides = (data.rides || [])
                .filter(ride => {
                    if (!ride.date || ride.deleted || ride.cancelled) return false;
                    if (isRideDateExcludedFromPlanner(ride.date)) return false;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return false;
                    rideDate.setHours(0, 0, 0, 0);
                    if (rideDate < today) return false;
                    if (isRidePastByStartTime(ride)) return false;
                    const dateKey = formatDateToISO(rideDate);
                    if (ride.rescheduledFrom) return true;
                    if (validDates.size > 0 && !validDates.has(dateKey)) return false;
                    return true;
                })
                .sort((a, b) => {
                    const dateA = parseISODate(a.date);
                    const dateB = parseISODate(b.date);
                    return (dateA || 0) - (dateB || 0);
                });
            if (upcomingRides.length === 0) {
                alert('No upcoming practices found. Add practices in Season Dashboard first.');
                return;
            }
            const nextRide = upcomingRides[0];
            data.currentRide = nextRide.id;
            saveData();
            if (nextRide.planningStarted || (nextRide.groups && nextRide.groups.length > 0)) {
                practicePlannerView = 'planner';
            } else {
                practicePlannerView = 'plannerSetup';
            }
            renderRides();
        }

        function closeGroupMethodView() {
            practicePlannerView = 'home';
            data.currentRide = null;
            hideSidebars();
            saveData();
            renderRides();
        }

        function openBuildNewGroups() {
            practicePlannerView = 'planner';
            renderRides();
        }

        function openCopyGroupsFromPrior() {
            practicePlannerView = 'planner';
            renderRides();
        }

        function switchToWizardFromPlanner() {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride) return;

            const hasAssignedRiders = ride.groups && ride.groups.some(g => g.riders && g.riders.length > 0);
            const hasAssignedCoaches = ride.groups && ride.groups.some(g => {
                if (!g.coaches) return false;
                return g.coaches.leader || g.coaches.sweep || g.coaches.roam ||
                    (Array.isArray(g.coaches.extraRoam) && g.coaches.extraRoam.some(id => id));
            });

            if (hasAssignedRiders || hasAssignedCoaches) {
                if (!confirm('Current groups and assignments will be lost. Continue to the Practice Planner Wizard?')) return;
            }

            ride.groups = [];
            ride.assignments = {};
            ride.publishedGroups = false;
            ride.planningStarted = false;
            saveRideToDB(ride);

            attendanceMode = false;
            hideSidebars();
            practicePlannerView = 'plannerSetup';
            renderRides();
        }

        // --- Practice Planner Onboarding Flow ---

        function closePlannerSetup() {
            practicePlannerView = 'home';
            data.currentRide = null;
            hideSidebars();
            saveData();
            renderRides();
        }

        function openAttendanceMarking() {
            attendanceMode = true;
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (ride) {
                ensureRideAttendanceDefaults(ride);
                const rideDate = parseISODate(ride.date);
                const dateLabel = document.getElementById('attendance-date-label');
                if (dateLabel && rideDate) {
                    dateLabel.textContent = rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                }
            }
            practicePlannerView = 'attendance';
            renderRides();
        }

        function markAllRidersAttending() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            ride.availableRiders = (data.riders || []).filter(r => !r.archived).map(r => r.id);
            saveRideToDB(ride);
            renderSidebars();
        }

        function markAllCoachesAttending() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            ride.availableCoaches = (data.coaches || []).filter(c => !c.archived).map(c => c.id);
            saveRideToDB(ride);
            renderSidebars();
        }

        function markAllRidersAbsent() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            ride.availableRiders = [];
            saveRideToDB(ride);
            renderSidebars();
        }

        function markAllCoachesAbsent() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            ride.availableCoaches = [];
            saveRideToDB(ride);
            renderSidebars();
        }

        function finishAttendanceMarking() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (ride) {
                ride.planningStarted = true;
                saveRideToDB(ride);
            }
            attendanceMode = false;
            hideSidebars();
            practicePlannerView = 'postAttendance';
            renderRides();
        }

        function backToAttendance() {
            openAttendanceMarking();
        }

        function openPostAttendanceAutoGenerate() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (ride) {
                ride.planningStarted = true;
                saveRideToDB(ride);
            }
            attendanceMode = false;
            practicePlannerView = 'planner';
            renderRides();
            setTimeout(() => { autoAssign(); }, 100);
        }

        function openManualBuildFromSetup() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (ride) {
                ride.planningStarted = true;
                ensureRideAttendanceDefaults(ride);
                if (!Array.isArray(ride.availableCoaches) || ride.availableCoaches.length === 0) {
                    ride.availableCoaches = [];
                }
                saveRideToDB(ride);
            }
            attendanceMode = false;
            sidebarRidersFilter = 'attending';
            sidebarCoachesFilter = 'absent';
            practicePlannerView = 'planner';
            renderRides();
            setTimeout(() => showSidebars({ persistent: true }), 50);
        }

        let _copyPriorSource = null;
        let _selectedPriorRideId = null;

        function openCopyFromPriorSetup(source) {
            _copyPriorSource = source;
            _selectedPriorRideId = null;
            practicePlannerView = 'copyPrior';

            const riderAttCb = document.getElementById('copy-prior-include-rider-attendance');
            if (riderAttCb) {
                riderAttCb.checked = (source === 'setup');
                riderAttCb.onchange = function() {
                    if (this.checked && _copyPriorSource === 'postAttendance') {
                        if (!confirm('This will overwrite your current attendance selections. Continue?')) {
                            this.checked = false;
                        }
                    }
                };
            }
            const coachAttCb = document.getElementById('copy-prior-include-coach-attendance');
            if (coachAttCb) coachAttCb.checked = true;
            const routesCb = document.getElementById('copy-prior-include-routes');
            if (routesCb) routesCb.checked = true;

            const executeBtn = document.getElementById('copy-prior-execute-btn');
            if (executeBtn) executeBtn.disabled = true;

            populateCopyPriorList();
            renderRides();
        }

        function populateCopyPriorList() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const currentDate = parseISODate(ride.date);
            if (!currentDate) return;

            const ridesWithGroups = (data.rides || [])
                .filter(r => {
                    if (!r.date || r.deleted || r.cancelled) return false;
                    if (isRideDateExcludedFromPlanner(r.date)) return false;
                    const rDate = parseISODate(r.date);
                    if (!rDate) return false;
                    return rDate < currentDate && r.groups && r.groups.length > 0;
                })
                .map(r => ({ ride: r, date: parseISODate(r.date) }))
                .filter(r => r.date)
                .sort((a, b) => b.date - a.date);

            const listEl = document.getElementById('copy-prior-practices-list');
            if (!listEl) return;

            if (ridesWithGroups.length === 0) {
                listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No previous practices with group assignments found.</div>';
                return;
            }

            listEl.innerHTML = ridesWithGroups.map(({ ride: srcRide, date }) => {
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                const groupCount = srcRide.groups ? srcRide.groups.length : 0;
                const riderCount = (srcRide.availableRiders || []).length;
                const coachCount = (srcRide.availableCoaches || []).length;
                return `
                    <div class="copy-prior-practice-item" data-ride-id="${srcRide.id}" style="padding: 12px; margin-bottom: 4px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.15s;" 
                         onmouseover="if(!this.classList.contains('selected'))this.style.background='#f5f5f5'" 
                         onmouseout="if(!this.classList.contains('selected'))this.style.background='white'"
                         onclick="selectPriorPractice(${srcRide.id}, this)">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${dateStr}</div>
                        <div style="font-size: 13px; color: #666;">${groupCount} group${groupCount !== 1 ? 's' : ''} &middot; ${riderCount} riders &middot; ${coachCount} coaches</div>
                    </div>
                `;
            }).join('');
        }

        function selectPriorPractice(rideId, el) {
            _selectedPriorRideId = rideId;
            document.querySelectorAll('.copy-prior-practice-item').forEach(item => {
                item.classList.remove('selected');
                item.style.background = 'white';
                item.style.borderColor = '#ddd';
            });
            if (el) {
                el.classList.add('selected');
                el.style.background = '#e3f2fd';
                el.style.borderColor = '#1976d2';
            }
            const executeBtn = document.getElementById('copy-prior-execute-btn');
            if (executeBtn) executeBtn.disabled = false;
        }

        function closeCopyFromPriorView() {
            if (_copyPriorSource === 'postAttendance') {
                practicePlannerView = 'postAttendance';
            } else {
                practicePlannerView = 'plannerSetup';
            }
            _copyPriorSource = null;
            _selectedPriorRideId = null;
            renderRides();
        }

        function executeCopyFromPrior() {
            if (!_selectedPriorRideId) {
                alert('Please select a practice to copy from first.');
                return;
            }
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const sourceRide = data.rides.find(r => r.id === _selectedPriorRideId);
            if (!sourceRide || !sourceRide.groups || sourceRide.groups.length === 0) {
                alert('Source practice not found or has no groups.');
                return;
            }

            const includeRiderAtt = document.getElementById('copy-prior-include-rider-attendance')?.checked;
            const includeCoachAtt = document.getElementById('copy-prior-include-coach-attendance')?.checked;
            const includeRoutes = document.getElementById('copy-prior-include-routes')?.checked;

            const rideDate = ride.date || '';
            const isRiderAbsent = (id) => rideDate && isScheduledAbsent('rider', id, rideDate).absent;
            const isCoachAbsent = (id) => rideDate && isScheduledAbsent('coach', id, rideDate).absent;

            if (includeRiderAtt) {
                ride.availableRiders = (sourceRide.availableRiders ? [...sourceRide.availableRiders] : [])
                    .filter(id => !isRiderAbsent(id));
            } else {
                ensureRideAttendanceDefaults(ride);
            }
            if (includeCoachAtt) {
                ride.availableCoaches = (sourceRide.availableCoaches ? [...sourceRide.availableCoaches] : [])
                    .filter(id => !isCoachAbsent(id));
            } else if (!Array.isArray(ride.availableCoaches) || ride.availableCoaches.length === 0) {
                ride.availableCoaches = (data.coaches || []).filter(c => !c.archived).map(c => c.id);
            }

            const currentAvailableRiders = new Set(ride.availableRiders || []);
            const currentAvailableCoaches = new Set(ride.availableCoaches || []);

            ride.groups = sourceRide.groups.map(srcGroup => {
                const newGroup = createGroup(srcGroup.label);
                newGroup.riders = srcGroup.riders ? srcGroup.riders.filter(id => currentAvailableRiders.has(id) && !isRiderAbsent(id)) : [];
                if (srcGroup.coaches) {
                    newGroup.coaches.leader = (srcGroup.coaches.leader && currentAvailableCoaches.has(srcGroup.coaches.leader) && !isCoachAbsent(srcGroup.coaches.leader)) ? srcGroup.coaches.leader : null;
                    newGroup.coaches.sweep = (srcGroup.coaches.sweep && currentAvailableCoaches.has(srcGroup.coaches.sweep) && !isCoachAbsent(srcGroup.coaches.sweep)) ? srcGroup.coaches.sweep : null;
                    newGroup.coaches.roam = (srcGroup.coaches.roam && currentAvailableCoaches.has(srcGroup.coaches.roam) && !isCoachAbsent(srcGroup.coaches.roam)) ? srcGroup.coaches.roam : null;
                    newGroup.coaches.extraRoam = Array.isArray(srcGroup.coaches.extraRoam)
                        ? srcGroup.coaches.extraRoam.filter(id => currentAvailableCoaches.has(id) && !isCoachAbsent(id))
                        : [];
                }
                newGroup.routeId = includeRoutes ? (srcGroup.routeId || null) : null;
                newGroup.sortBy = srcGroup.sortBy;
                return newGroup;
            });

            ride.planningStarted = true;
            saveRideToDB(ride);

            // Warn about unassigned attending riders/coaches (exclude scheduled-absent)
            const assignedRiderIds = new Set();
            const assignedCoachIds = new Set();
            ride.groups.forEach(g => {
                (g.riders || []).forEach(id => assignedRiderIds.add(id));
                if (g.coaches?.leader) assignedCoachIds.add(g.coaches.leader);
                if (g.coaches?.sweep) assignedCoachIds.add(g.coaches.sweep);
                if (g.coaches?.roam) assignedCoachIds.add(g.coaches.roam);
                (g.coaches?.extraRoam || []).forEach(id => { if (id) assignedCoachIds.add(id); });
            });
            const unassignedRiders = (ride.availableRiders || []).filter(id => {
                if (assignedRiderIds.has(id)) return false;
                if (rideDate && isScheduledAbsent('rider', id, rideDate).absent) return false;
                return true;
            });
            const unassignedCoaches = (ride.availableCoaches || []).filter(id => {
                if (assignedCoachIds.has(id)) return false;
                if (rideDate && isScheduledAbsent('coach', id, rideDate).absent) return false;
                return true;
            });
            if (unassignedRiders.length > 0 || unassignedCoaches.length > 0) {
                const parts = [];
                if (unassignedRiders.length > 0) parts.push(`${unassignedRiders.length} rider${unassignedRiders.length !== 1 ? 's' : ''}`);
                if (unassignedCoaches.length > 0) parts.push(`${unassignedCoaches.length} coach${unassignedCoaches.length !== 1 ? 'es' : ''}`);
                alert(`Groups copied. Note: ${parts.join(' and ')} marked as attending are currently unassigned and need to be placed in groups.`);
            }

            _copyPriorSource = null;
            _selectedPriorRideId = null;
            attendanceMode = false;
            practicePlannerView = 'planner';
            renderRides();
        }

        // --- End Practice Planner Onboarding Flow ---

        function openPlanFuturePracticePicker() {
            practicePlannerView = 'picker';
            practicePickerMode = 'future';
            const titleEl = document.getElementById('practice-calendar-picker-title');
            if (titleEl) titleEl.textContent = 'Select a future practice to plan';
            renderPracticePickerCalendar();
            renderRides();
        }

        function openReviewPriorPracticePicker() {
            practicePlannerView = 'picker';
            practicePickerMode = 'past';
            const titleEl = document.getElementById('practice-calendar-picker-title');
            if (titleEl) titleEl.textContent = 'Select a past practice to review';
            renderPracticePickerCalendar();
            renderRides();
        }

        function closePracticeCalendarPicker() {
            practicePlannerView = 'home';
            practicePickerMode = null;
            renderRides();
        }

        function closePracticePlannerView() {
            practicePlannerView = 'home';
            data.currentRide = null;
            hideSidebars();
            // Hide the toolbar in the banner
            const bannerToolbar = document.getElementById('practice-banner-toolbar');
            if (bannerToolbar) { bannerToolbar.style.display = 'none'; bannerToolbar.innerHTML = ''; }
            saveData();
            renderRides();
        }

        async function handlePracticeDateClickForPicker(dateKey) {
            if (!practicePickerMode || !dateKey) return;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateObj = parseISODate(dateKey);
            if (!dateObj) return;
            dateObj.setHours(0, 0, 0, 0);
            if (practicePickerMode === 'future' && dateObj < today) return;
            if (practicePickerMode === 'past' && dateObj >= today) return;
            let ride = (data.rides || []).find(r => r.date && String(r.date).substring(0, 10) === dateKey && !r.deleted);
            if (!ride) {
                ride = {
                    id: generateId(),
                    date: dateKey,
                    time: '',
                    endTime: '',
                    meetLocation: '',
                    availableCoaches: [],
                    availableRiders: [],
                    assignments: {},
                    groups: [],
                    goals: '',
                    cancelled: false
                };
                data.rides.push(ride);
                ensureRidesFromSchedule();
                if (typeof saveRideToDB === 'function') await saveRideToDB(ride);
            }
            data.currentRide = ride.id;
            saveData();
            practicePlannerView = 'planner';
            practicePickerMode = null;
            renderRides();
        }

        function renderPracticePickerCalendar() {
            const container = document.getElementById('practice-calendar-picker-calendar');
            if (!container) return;
            renderSeasonCalendarToContainer(container, { pickerMode: practicePickerMode });
        }

        function loadSeasonSettings() {
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            
            // Populate date fields (main and setup modal)
            const startDateInput = document.getElementById('season-start-date');
            const endDateInput = document.getElementById('season-end-date');
            const startDateInputSetup = document.getElementById('season-start-date-setup');
            const endDateInputSetup = document.getElementById('season-end-date-setup');
            
            const startDateValue = settings.startDate || '';
            const endDateValue = settings.endDate || '';
            
            if (startDateInput) startDateInput.value = startDateValue;
            if (endDateInput) endDateInput.value = endDateValue;
            if (startDateInputSetup) startDateInputSetup.value = startDateValue;
            if (endDateInputSetup) endDateInputSetup.value = endDateValue;
            
            // Update the date range button display
            updateSeasonDateRangeButton();
            
            // Load unified scale input
            const scaleInput   = document.getElementById('unified-scale');
            const scaleDisplay = document.getElementById('unified-scale-display');
            const saved = settings.fitnessScale;
            if (scaleInput) {
                if (saved !== undefined && saved !== null) scaleInput.value = saved;
                if (scaleDisplay) scaleDisplay.textContent = saved || scaleInput.value || 6;
            }
            
            // Load practice rows
            seasonSettingsDraft = {
                startDate: settings.startDate || '',
                endDate: settings.endDate || '',
                practices: Array.isArray(settings.practices)
                    ? settings.practices.map(practice => ({
                        id: practice.id || generateId(),
                        dayOfWeek: practice.dayOfWeek,
                        specificDate: practice.specificDate || null,
                        time: practice.time || practice.startTime || '',
                        endTime: practice.endTime || '',
                        description: practice.description || '',
                        meetLocation: practice.meetLocation || '',
                        locationLat: practice.locationLat || null,
                        locationLng: practice.locationLng || null,
                        rosterFilter: practice.rosterFilter || null, // Preserve rosterFilter when loading
                        excludeFromPlanner: practice.excludeFromPlanner || false
                    }))
                    : []
            };
            
            renderPracticeRows();
            renderDashboardRaces();
            
            // Load and render roles
            renderCoachRoles();
            renderRiderRoles();
            updateRoleDropdowns();
            
            // Load Google Sheet URLs
            const riderSheetUrlInput = document.getElementById('rider-google-sheet-url');
            const coachSheetUrlInput = document.getElementById('coach-google-sheet-url');
            
            // Update Google auth status
            if (typeof updateGoogleAuthStatus === 'function') updateGoogleAuthStatus();
            
            if (riderSheetUrlInput && settings.riderGoogleSheetUrl) {
                riderSheetUrlInput.value = settings.riderGoogleSheetUrl;
            }
            if (coachSheetUrlInput && settings.coachGoogleSheetUrl) {
                coachSheetUrlInput.value = settings.coachGoogleSheetUrl;
            }
        }
        
        // Role management functions
        function renderCoachRoles() {
            const container = document.getElementById('coach-roles-container');
            if (!container) return;
            
            if (!data.coachRoles || data.coachRoles.length === 0) {
                container.innerHTML = '<div style="color: #666; font-style: italic; padding: 8px;">No coach roles assigned</div>';
                return;
            }
            
            let html = '';
            data.coachRoles.forEach((role, index) => {
                const coach = data.coaches.find(c => c.id === role.coachId);
                const coachName = coach ? coach.name : `Coach ID: ${role.coachId}`;
                html += `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px;">
                        <span style="flex: 1; font-weight: 600;">${escapeHtml(role.roleName)}</span>
                        <span style="flex: 1;">${escapeHtml(coachName)}</span>
                        <button class="btn-small danger" onclick="removeCoachRole(${index})">Remove</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        function renderRiderRoles() {
            const container = document.getElementById('rider-roles-container');
            if (!container) return;
            
            if (!data.riderRoles || data.riderRoles.length === 0) {
                container.innerHTML = '<div style="color: #666; font-style: italic; padding: 8px;">No rider roles assigned</div>';
                return;
            }
            
            let html = '';
            data.riderRoles.forEach((role, index) => {
                const rider = data.riders.find(r => r.id === role.riderId);
                const riderName = rider ? rider.name : `Rider ID: ${role.riderId}`;
                html += `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 8px;">
                        <span style="flex: 1; font-weight: 600;">${escapeHtml(role.roleName)}</span>
                        <span style="flex: 1;">${escapeHtml(riderName)}</span>
                        <button class="btn-small danger" onclick="removeRiderRole(${index})">Remove</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        function updateRoleDropdowns() {
            // Update coach dropdown
            const coachSelect = document.getElementById('new-coach-role-coach');
            if (coachSelect) {
                coachSelect.innerHTML = '<option value="">Select Coach</option>';
                data.coaches.forEach(coach => {
                    const option = document.createElement('option');
                    option.value = coach.id;
                    option.textContent = coach.name || 'Unnamed Coach';
                    coachSelect.appendChild(option);
                });
            }
            
            // Update rider dropdown
            const riderSelect = document.getElementById('new-rider-role-rider');
            if (riderSelect) {
                riderSelect.innerHTML = '<option value="">Select Rider</option>';
                data.riders.forEach(rider => {
                    const option = document.createElement('option');
                    option.value = rider.id;
                    option.textContent = rider.name || 'Unnamed Rider';
                    riderSelect.appendChild(option);
                });
            }
        }
        
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
            let aborted = false;
            let progress = 0;
            const totalSteps = 9;

            function logProgress(step) {
                progress++;
                console.log(`saveAllDataToSupabase [${progress}/${totalSteps}]: ${step}`);
            }

            function checkAuth() {
                const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                if (!user) {
                    aborted = true;
                    console.warn('saveAllDataToSupabase: session expired mid-save — aborting remaining steps.');
                    return false;
                }
                return true;
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
            if (!checkAuth()) { errors.push('Session expired after riders step'); }

            // --- 2. Coaches ---
            if (!aborted) try {
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
            if (!checkAuth()) { errors.push('Session expired after coaches step'); }

            // --- 3. Rides ---
            if (!aborted) try {
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
            if (!checkAuth()) { errors.push('Session expired after rides step'); }

            // --- 4. Routes ---
            if (!aborted) try {
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
            if (!aborted) try {
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
            if (!aborted) try {
                logProgress('Saving season settings...');
                if (data.seasonSettings && typeof saveSeasonSettings === 'function') {
                    await saveSeasonSettings(data.seasonSettings);
                }
            } catch (e) { errors.push(`Season settings: ${e.message}`); }

            // --- 7. Auto-Assign Settings ---
            if (!aborted) try {
                logProgress('Saving auto-assign settings...');
                if (data.autoAssignSettings && typeof saveAutoAssignSettings === 'function') {
                    await saveAutoAssignSettings(data.autoAssignSettings);
                }
            } catch (e) { errors.push(`Auto-assign settings: ${e.message}`); }

            // --- 8. Color Names ---
            if (!aborted) try {
                logProgress('Saving color names...');
                if (Array.isArray(data.colorNames) && data.colorNames.length > 0) {
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
            if (!aborted) try {
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

            if (aborted) {
                console.warn('saveAllDataToSupabase: aborted — session expired mid-save. Some data may not have been written.');
                alert('Save aborted: your session expired during the save. Please log in again and retry.');
            } else if (errors.length > 0) {
                console.error('saveAllDataToSupabase completed with errors:', errors);
                alert(`Restore saved to Supabase with ${errors.length} error(s). Check the console (F12) for details.\n\nFirst error: ${errors[0]}`);
            } else {
                console.log('saveAllDataToSupabase: All data saved to Supabase successfully.');
            }
        }
        
        // ============ TAB STATE PERSISTENCE ============
        
        // Restore last active tab on page load
        function restoreLastActiveTab() {
            try {
                const lastTab = localStorage.getItem('lastActiveTab');
                if (lastTab) {
                    // Find the tab button
                    const tabs = document.querySelectorAll('#desktop-tabs .tab');
                    let targetTab = null;
                    tabs.forEach(tab => {
                        if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(`'${lastTab}'`)) {
                            targetTab = tab;
                        }
                    });
                    
                    if (targetTab) {
                        // Switch to the last active tab
                        switchTab(lastTab, targetTab);
                    }
                }
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

        // Location map modal functions
        function openLocationMap(practiceId) {
            currentPracticeIdForLocation = practiceId;
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;

            const modal = document.getElementById('location-map-modal');
            if (!modal) return;

            // Load Leaflet CSS and JS if not already loaded
            if (!document.querySelector('link[href*="leaflet"]')) {
                const leafletCSS = document.createElement('link');
                leafletCSS.rel = 'stylesheet';
                leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
                leafletCSS.crossOrigin = '';
                document.head.appendChild(leafletCSS);
            }

            if (!window.L) {
                const leafletJS = document.createElement('script');
                leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                leafletJS.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                leafletJS.crossOrigin = '';
                leafletJS.onload = () => {
                    setTimeout(() => initializeMap(practice), 100);
                };
                document.head.appendChild(leafletJS);
            } else {
                setTimeout(() => initializeMap(practice), 100);
            }

            const latInput = document.getElementById('location-latitude');
            const lngInput = document.getElementById('location-longitude');
            const addressInput = document.getElementById('location-address');
            const searchInput = document.getElementById('location-search');
            const previousSelect = document.getElementById('location-previous');

            if (latInput) latInput.value = practice.locationLat || '';
            if (lngInput) lngInput.value = practice.locationLng || '';
            if (addressInput) addressInput.value = practice.meetLocation || '';
            if (searchInput) searchInput.value = '';
            
            // Populate previous locations dropdown
            if (previousSelect) {
                populatePreviousLocations(previousSelect);
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }
        
        function populatePreviousLocations(selectElement) {
            if (!selectElement) return;
            
            // Get all unique meet locations from all practices (including saved ones)
            const locations = new Map();
            
            // Get from season settings practices
            if (data.seasonSettings && Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices.forEach(practice => {
                    if (practice.meetLocation && practice.locationLat && practice.locationLng) {
                        const key = `${practice.locationLat},${practice.locationLng}`;
                        if (!locations.has(key)) {
                            locations.set(key, {
                                address: practice.meetLocation,
                                lat: practice.locationLat,
                                lng: practice.locationLng
                            });
                        }
                    }
                });
            }
            
            // Get from all rides (practices)
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.meetLocation && ride.locationLat && ride.locationLng) {
                        const key = `${ride.locationLat},${ride.locationLng}`;
                        if (!locations.has(key)) {
                            locations.set(key, {
                                address: ride.meetLocation,
                                lat: ride.locationLat,
                                lng: ride.locationLng
                            });
                        }
                    }
                });
            }
            
            // Clear and populate dropdown
            selectElement.innerHTML = '<option value="">-- Select from previous locations --</option>';
            locations.forEach((location, key) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = location.address;
                selectElement.appendChild(option);
            });
        }
        
        function selectPreviousLocation(value) {
            if (!value) return;
            
            const [latStr, lngStr] = value.split(',');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            
            // Update inputs
            const latInput = document.getElementById('location-latitude');
            const lngInput = document.getElementById('location-longitude');
            const addressInput = document.getElementById('location-address');
            
            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;
            
            // Find the address from the location
            const locations = new Map();
            if (data.seasonSettings && Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices.forEach(practice => {
                    if (practice.meetLocation && practice.locationLat && practice.locationLng) {
                        const key = `${practice.locationLat},${practice.locationLng}`;
                        if (!locations.has(key)) {
                            locations.set(key, practice.meetLocation);
                        }
                    }
                });
            }
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.meetLocation && ride.locationLat && ride.locationLng) {
                        const key = `${ride.locationLat},${ride.locationLng}`;
                        if (!locations.has(key)) {
                            locations.set(key, ride.meetLocation);
                        }
                    }
                });
            }
            
            const address = locations.has(value) ? locations.get(value) : '';
            
            if (addressInput) {
                addressInput.value = address;
            }
            
            // If we have a practice ID, update the practice draft and the practice row input field
            if (currentPracticeIdForLocation !== null && address) {
                ensureSeasonDraft();
                if (seasonSettingsDraft) {
                    const practiceIndex = seasonSettingsDraft.practices.findIndex(
                        p => String(p.id) === String(currentPracticeIdForLocation)
                    );
                    if (practiceIndex !== -1) {
                        // Update practice draft with location
                        seasonSettingsDraft.practices[practiceIndex].meetLocation = address;
                        seasonSettingsDraft.practices[practiceIndex].locationLat = lat;
                        seasonSettingsDraft.practices[practiceIndex].locationLng = lng;
                        
                        // Update the practice row input field directly in both containers
                        const practiceRows = document.querySelectorAll(`.practice-row[data-practice-id="${currentPracticeIdForLocation}"]`);
                        practiceRows.forEach(practiceRow => {
                            const meetLocationInput = practiceRow.querySelector('input[onchange*="meetLocation"]');
                            if (meetLocationInput) {
                                meetLocationInput.value = address;
                            }
                        });
                    }
                }
            } else if (!address) {
                // Reverse geocode to get address if not found in saved locations
                reverseGeocode(lat, lng);
            }
            
            // Update map if it exists
            if (map) {
                map.setView([lat, lng], 15);
                if (mapMarker) {
                    mapMarker.setLatLng([lat, lng]);
                } else {
                    mapMarker = L.marker([lat, lng]).addTo(map);
                }
            }
        }

        function initializeMap(practice) {
            const mapContainer = document.getElementById('map-container');
            if (!mapContainer || !window.L) {
                setTimeout(() => initializeMap(practice), 100);
                return;
            }

            // Clear existing map
            if (map) {
                map.remove();
                map = null;
                mapMarker = null;
            }

            // Remove placeholder if it exists
            const placeholder = document.getElementById('map-placeholder');
            if (placeholder) {
                placeholder.remove();
            }

            // Default to Tamalpais High School area (Mill Valley, CA)
            const defaultLat = 37.9069;
            const defaultLng = -122.5446;
            
            const lat = practice.locationLat && Number.isFinite(practice.locationLat) ? practice.locationLat : defaultLat;
            const lng = practice.locationLng && Number.isFinite(practice.locationLng) ? practice.locationLng : defaultLng;
            // Zoom level: ~5 miles view = zoom level 12-13 (higher number = more zoomed in)
            // 10 = ~50 miles, 12 = ~10 miles, 13 = ~5 miles, 15 = ~1 mile
            const zoom = practice.locationLat && practice.locationLng ? 15 : 13;

            try {
                map = L.map('map-container').setView([lat, lng], zoom);

                // Use Google Maps tiles via Leaflet
                // Google Maps tile layer (roadmap style)
                // Note: For production, you should use a Google Maps API key
                // This uses Google Maps tiles directly - may have usage limits
                L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                    attribution: '© Google Maps',
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
                }).addTo(map);

                if (practice.locationLat && practice.locationLng && Number.isFinite(practice.locationLat) && Number.isFinite(practice.locationLng)) {
                    mapMarker = L.marker([practice.locationLat, practice.locationLng]).addTo(map);
                }

                map.on('click', function(e) {
                    const lat = e.latlng.lat;
                    const lng = e.latlng.lng;

                    if (mapMarker) {
                        mapMarker.setLatLng([lat, lng]);
                    } else {
                        mapMarker = L.marker([lat, lng]).addTo(map);
                    }

                    updateLocationInputs(lat, lng);
                    reverseGeocode(lat, lng);
                });

                // Update inputs when manually changed
                const latInput = document.getElementById('location-latitude');
                const lngInput = document.getElementById('location-longitude');
                
                const updateMapFromInputs = () => {
                    const lat = parseFloat(latInput.value);
                    const lng = parseFloat(lngInput.value);
                    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        map.setView([lat, lng], 15);
                        if (mapMarker) {
                            mapMarker.setLatLng([lat, lng]);
                        } else {
                            mapMarker = L.marker([lat, lng]).addTo(map);
                        }
                        reverseGeocode(lat, lng);
                    }
                };

                if (latInput) {
                    latInput.addEventListener('change', updateMapFromInputs);
                    latInput.addEventListener('blur', updateMapFromInputs);
                }
                if (lngInput) {
                    lngInput.addEventListener('change', updateMapFromInputs);
                    lngInput.addEventListener('blur', updateMapFromInputs);
                }
            } catch (error) {
                console.error('Map initialization error:', error);
                mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Error loading map. Please refresh and try again.</div>';
            }
        }

        function updateLocationInputs(lat, lng) {
            const latInput = document.getElementById('location-latitude');
            const lngInput = document.getElementById('location-longitude');
            if (latInput) latInput.value = lat.toFixed(6);
            if (lngInput) lngInput.value = lng.toFixed(6);
        }

        function reverseGeocode(lat, lng) {
            // Use Nominatim (OpenStreetMap geocoding service) with delay to respect rate limits
            // Only update address field if it's empty (don't overwrite user-entered text)
            setTimeout(() => {
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                    headers: {
                        'User-Agent': 'MTB Team Practice Manager'
                    }
                })
                    .then(response => response.json())
                    .then(data => {
                        const addressInput = document.getElementById('location-address');
                        // Only update if field is empty - preserve user-entered text
                        if (addressInput && data.display_name && !addressInput.value.trim()) {
                            addressInput.value = data.display_name;
                        }
                    })
                    .catch(error => {
                        console.error('Geocoding error:', error);
                    });
            }, 500);
        }

        function searchLocation() {
            const searchInput = document.getElementById('location-search');
            if (!searchInput || !searchInput.value.trim()) {
                alert('Please enter a location to search');
                return;
            }

            if (!map) {
                alert('Map is not loaded yet. Please wait a moment and try again.');
                return;
            }

            const query = encodeURIComponent(searchInput.value.trim());
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
                headers: {
                    'User-Agent': 'MTB Team Practice Manager'
                }
            })
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const result = data[0];
                        const lat = parseFloat(result.lat);
                        const lng = parseFloat(result.lon);

                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            map.setView([lat, lng], 15);
                            if (mapMarker) {
                                mapMarker.setLatLng([lat, lng]);
                            } else {
                                mapMarker = L.marker([lat, lng]).addTo(map);
                            }
                            updateLocationInputs(lat, lng);
                            
                            const addressInput = document.getElementById('location-address');
                            // Only update if field is empty - preserve user-entered text
                            if (addressInput && (!addressInput.value.trim())) {
                                addressInput.value = result.display_name;
                            }
                        }
                    } else {
                        alert('Location not found. Please try a different search.');
                    }
                })
                .catch(error => {
                    console.error('Search error:', error);
                    alert('Error searching for location. Please try again.');
                });
        }

        function saveLocation() {
            if (currentPracticeIdForLocation === null) return;

            const latInput = document.getElementById('location-latitude');
            const lngInput = document.getElementById('location-longitude');
            const addressInput = document.getElementById('location-address');

            const lat = latInput ? parseFloat(latInput.value) : null;
            const lng = lngInput ? parseFloat(lngInput.value) : null;
            const address = addressInput ? addressInput.value.trim() : '';

            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practiceIndex = seasonSettingsDraft.practices.findIndex(
                p => String(p.id) === String(currentPracticeIdForLocation)
            );
            if (practiceIndex === -1) return;

            if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                seasonSettingsDraft.practices[practiceIndex].locationLat = lat;
                seasonSettingsDraft.practices[practiceIndex].locationLng = lng;
            } else {
                seasonSettingsDraft.practices[practiceIndex].locationLat = null;
                seasonSettingsDraft.practices[practiceIndex].locationLng = null;
            }

            if (address) {
                seasonSettingsDraft.practices[practiceIndex].meetLocation = address;
            }

            closeLocationMapModal();
            renderPracticeRows();
            // Check for changes after location is saved
            checkPracticeChanges(currentPracticeIdForLocation);
        }

        function closeLocationMapModal() {
            const modal = document.getElementById('location-map-modal');
            if (!modal) return;

            if (map) {
                try {
                    map.remove();
                } catch (e) {
                    console.error('Error removing map:', e);
                }
                map = null;
                mapMarker = null;
            }

            if (modal.contains(document.activeElement)) document.activeElement.blur();
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            currentPracticeIdForLocation = null;
        }

        // Roster Refinement Functions
        // Helper function to get filtered riders based on practice roster filter
        function getRosterFilterDescription(practice) {
            if (!practice || !practice.rosterFilter) {
                return 'All';
            }
            
            const filter = practice.rosterFilter;
            const filterType = filter.filterType || '';
            
            if (filterType === 'grade') {
                const selectedGrades = [];
                const grades = ['9th', '10th', '11th', '12th'];
                grades.forEach(grade => {
                    if (filter.grade && filter.grade[grade] !== false) {
                        selectedGrades.push(grade);
                    }
                });
                if (selectedGrades.length === 0) return 'All';
                if (selectedGrades.length === 1) return `${selectedGrades[0]} Only`;
                if (selectedGrades.length === 4) return 'All Grades';
                return selectedGrades.join(', ');
            } else if (filterType === 'gender') {
                const selectedGenders = [];
                if (filter.gender && filter.gender['M'] !== false) selectedGenders.push('Male');
                if (filter.gender && filter.gender['F'] !== false) selectedGenders.push('Female');
                if (filter.gender && filter.gender['NB'] !== false) selectedGenders.push('Nonbinary');
                if (selectedGenders.length === 0) return 'All';
                if (selectedGenders.length === 1) return `${selectedGenders[0]} Only`;
                if (selectedGenders.length === 3) return 'All';
                return selectedGenders.join(', ');
            } else if (filterType === 'racingGroup') {
                const selectedGroups = [];
                if (filter.racingGroup) {
                    Object.keys(filter.racingGroup).forEach(group => {
                        if (filter.racingGroup[group] !== false) {
                            selectedGroups.push(group);
                        }
                    });
                }
                if (selectedGroups.length === 0) return 'All';
                if (selectedGroups.length === 1) return `${selectedGroups[0]} Only`;
                return selectedGroups.join(', ');
            }
            
            return 'All';
        }

        function getFilteredRidersForPractice(practice) {
            if (!practice || !practice.rosterFilter) {
                // No filter - return all non-archived riders
                return (data.riders || []).filter(r => !r.archived);
            }
            
            const filter = practice.rosterFilter;
            return (data.riders || []).filter(rider => {
                if (rider.archived) return false;
                // Filter by grade
                if (filter.filterType === 'grade' || filter.filterType === '') {
                    const riderGrade = normalizeGradeValue(rider.grade || '9th');
                    if (!filter.grade[riderGrade]) {
                        return false;
                    }
                }
                
                // Filter by gender
                if (filter.filterType === 'gender' || filter.filterType === '') {
                    const riderGender = (rider.gender || '').toString().toUpperCase();
                    let genderKey = '';
                    if (riderGender === 'M' || riderGender === 'MALE') {
                        genderKey = 'M';
                    } else if (riderGender === 'F' || riderGender === 'FEMALE') {
                        genderKey = 'F';
                    } else if (riderGender === 'NB' || riderGender === 'NONBINARY') {
                        genderKey = 'NB';
                    }
                    if (genderKey && !filter.gender[genderKey]) {
                        return false;
                    }
                }
                
                // Filter by racing group
                if (filter.filterType === 'racingGroup' || filter.filterType === '') {
                    const riderGroup = rider.racingGroup || '';
                    if (riderGroup && !filter.racingGroup[riderGroup]) {
                        return false;
                    }
                }
                
                return true;
            });
        }

        // Get practice settings for a ride date
        function getPracticeSettingsForRide(ride) {
            if (!ride || !ride.date) return null;
            
            const settings = data.seasonSettings || {};
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            
            const rideDate = parseISODate(ride.date);
            if (!rideDate) return null;
            
            // Check for specific date match first
            const dateKey = formatDateToISO(rideDate);
            const specificPractice = practices.find(p => p.specificDate === dateKey);
            if (specificPractice) return specificPractice;
            
            // Check for day of week match
            const weekday = rideDate.getDay();
            const recurringPractice = practices.find(p => p.dayOfWeek === weekday);
            return recurringPractice || null;
        }

        /** Returns list of { dateKey, rideId, dateLabel } for dates in this practice that have a deleted ride (exceptions). */
        function getPracticeExceptions(practice) {
            if (!practice || !data.rides || !data.rides.length) return [];
            const settings = seasonSettingsDraft || data.seasonSettings || {};
            const startStr = settings.startDate || settings.start_date || '';
            const endStr = settings.endDate || settings.end_date || '';
            const startDate = parseISODate(startStr);
            const endDate = parseISODate(endStr);
            const exceptions = [];
            const rides = data.rides;

            function formatRescheduledSuffix(dateKey) {
                const rescheduledRide = rides.find(r => !r.deleted && r.rescheduledFrom && String(r.rescheduledFrom).substring(0, 10) === dateKey);
                if (!rescheduledRide || !rescheduledRide.date) return '';
                const newDate = parseISODate(rescheduledRide.date);
                if (!newDate) return '';
                const m = newDate.getMonth() + 1, d = newDate.getDate(), y = String(newDate.getFullYear()).slice(-2);
                return ` (rescheduled for ${m}/${d}/${y})`;
            }

            if (practice.specificDate != null && practice.specificDate !== undefined && practice.specificDate !== '') {
                const dateKey = (typeof practice.specificDate === 'string' && practice.specificDate.length >= 10)
                    ? practice.specificDate.substring(0, 10) : formatDateToISO(parseISODate(practice.specificDate));
                const deletedRide = rides.find(r => r.date && String(r.date).substring(0, 10) === dateKey && r.deleted);
                const rescheduledRide = rides.find(r => !r.deleted && r.rescheduledFrom && String(r.rescheduledFrom).substring(0, 10) === dateKey);
                // Prefer rescheduled entry (one Restore per date): move ride back; only show deleted if no reschedule
                if (rescheduledRide) {
                    const d = parseISODate(dateKey);
                    let dateLabel = d ? (d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) : dateKey;
                    dateLabel += formatRescheduledSuffix(dateKey);
                    exceptions.push({ dateKey, rideId: rescheduledRide.id, dateLabel, isRescheduled: true });
                } else if (deletedRide) {
                    const d = parseISODate(dateKey);
                    let dateLabel = d ? (d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) : dateKey;
                    dateLabel += formatRescheduledSuffix(dateKey);
                    exceptions.push({ dateKey, rideId: deletedRide.id, dateLabel, isRescheduled: false });
                }
                return exceptions;
            }

            const dayOfWeek = Number(practice.dayOfWeek);
            if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startDate || !endDate) return exceptions;

            const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const seasonEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            const seenDateKeys = new Set();
            while (cursor <= seasonEnd) {
                if (cursor.getDay() === dayOfWeek) {
                    const dateKey = formatDateToISO(cursor);
                    const deletedRide = rides.find(r => r.date && String(r.date).substring(0, 10) === dateKey && r.deleted);
                    const rescheduledRide = rides.find(r => !r.deleted && r.rescheduledFrom && String(r.rescheduledFrom).substring(0, 10) === dateKey);
                    // Prefer rescheduled entry (one Restore per date)
                    if (rescheduledRide && !seenDateKeys.has(dateKey)) {
                        seenDateKeys.add(dateKey);
                        let dateLabel = cursor.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        dateLabel += formatRescheduledSuffix(dateKey);
                        exceptions.push({ dateKey, rideId: rescheduledRide.id, dateLabel, isRescheduled: true });
                    } else if (deletedRide && !seenDateKeys.has(dateKey)) {
                        seenDateKeys.add(dateKey);
                        let dateLabel = cursor.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        dateLabel += formatRescheduledSuffix(dateKey);
                        exceptions.push({ dateKey, rideId: deletedRide.id, dateLabel, isRescheduled: false });
                    }
                }
                cursor.setDate(cursor.getDate() + 1);
            }
            return exceptions;
        }

        function openViewExceptionsDialog(practiceId) {
            ensureSeasonDraft();
            const practices = (seasonSettingsDraft && seasonSettingsDraft.practices) ? seasonSettingsDraft.practices : (data.seasonSettings && data.seasonSettings.practices) || [];
            const practice = practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;
            const exceptions = getPracticeExceptions(practice);
            const listEl = document.getElementById('view-exceptions-list');
            const introEl = document.getElementById('view-exceptions-intro');
            if (!listEl) return;
            if (exceptions.length === 0) {
                listEl.innerHTML = '<li style="padding: 8px 0; color: #666;">No deleted exceptions for this practice.</li>';
                if (introEl) introEl.textContent = 'There are no removed dates for this practice.';
            } else {
                if (introEl) introEl.textContent = 'These dates were removed from the calendar. Click Restore to show them again.';
                listEl.innerHTML = exceptions.map(ex => `
                    <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                        <span>${escapeHtml(ex.dateLabel)}</span>
                        <button type="button" class="btn-small" onclick="restoreExceptionRide(${JSON.stringify(String(ex.rideId)).replace(/"/g, '&quot;')})">Restore</button>
                    </li>
                `).join('');
            }
            currentPracticeIdForExceptions = practiceId;
            const modal = document.getElementById('view-exceptions-modal');
            if (modal) {
                modal.classList.add('visible');
                modal.setAttribute('aria-hidden', 'false');
            }
        }

        function closeViewExceptionsDialog() {
            const modal = document.getElementById('view-exceptions-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
            }
            currentPracticeIdForExceptions = null;
        }

        async function restoreExceptionRide(rideId) {
            const ride = (data.rides || []).find(r => String(r.id) === String(rideId));
            if (!ride) {
                alert('Could not find that practice. Try refreshing the page and opening View Exceptions again.');
                return;
            }
            if (ride.rescheduledFrom && !ride.deleted) {
                const originalDateKey = String(ride.rescheduledFrom).substring(0, 10);
                ride.date = originalDateKey;
                ride.rescheduledFrom = null;
                const tombstones = (data.rides || []).filter(r => r.date && String(r.date).substring(0, 10) === originalDateKey && r.deleted);
                for (const t of tombstones) {
                    data.rides.splice(data.rides.indexOf(t), 1);
                    if (typeof deleteRide === 'function') {
                        try { await deleteRide(t.id); } catch (e) { console.error('Error deleting tombstone:', e); }
                    }
                }
                await saveRideToDB(ride);
            } else {
                ride.deleted = false;
                await saveRideToDB(ride);
            }
            renderAllCalendars();
            if (currentPracticeIdForExceptions != null) {
                const practices = (seasonSettingsDraft && seasonSettingsDraft.practices) ? seasonSettingsDraft.practices : (data.seasonSettings && data.seasonSettings.practices) || [];
                const practice = practices.find(p => String(p.id) === String(currentPracticeIdForExceptions));
                const exceptions = practice ? getPracticeExceptions(practice) : [];
                const listEl = document.getElementById('view-exceptions-list');
                const introEl = document.getElementById('view-exceptions-intro');
                if (listEl) {
                    if (exceptions.length === 0) {
                        if (introEl) introEl.textContent = 'All exceptions for this practice have been restored.';
                        listEl.innerHTML = '<li style="padding: 8px 0; color: #4CAF50;">No remaining deleted dates.</li>';
                        setTimeout(closeViewExceptionsDialog, 1200);
                    } else {
                        if (introEl) introEl.textContent = 'These dates were removed from the calendar. Click Restore to show them again.';
                        listEl.innerHTML = exceptions.map(ex => `
                            <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                                <span>${escapeHtml(ex.dateLabel)}</span>
                                <button type="button" class="btn-small" onclick="restoreExceptionRide(${JSON.stringify(String(ex.rideId)).replace(/"/g, '&quot;')})">Restore</button>
                            </li>
                        `).join('');
                    }
                }
            }
        }

        function openRosterRefinement(practiceId) {
            currentPracticeIdForRoster = practiceId;
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;
            
            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;
            
            // Load existing filter settings or use defaults
            if (practice.rosterFilter) {
                rosterFilterSettings = JSON.parse(JSON.stringify(practice.rosterFilter));
            } else {
                // Reset to defaults
                rosterFilterSettings = {
                    filterType: '',
                    grade: { '9th': true, '10th': true, '11th': true, '12th': true },
                    gender: { 'M': true, 'F': true, 'NB': true },
                    racingGroup: {}
                };
                // Get all unique racing groups from riders
                const allRacingGroups = new Set();
                (data.riders || []).forEach(rider => {
                    if (rider.racingGroup) {
                        allRacingGroups.add(rider.racingGroup);
                    }
                });
                allRacingGroups.forEach(group => {
                    rosterFilterSettings.racingGroup[group] = true;
                });
            }
            
            // Set filter type dropdown
            const filterTypeSelect = document.getElementById('roster-filter-type');
            if (filterTypeSelect) {
                filterTypeSelect.value = rosterFilterSettings.filterType || '';
            }
            
            updateRosterFilterOptions();
            renderFilteredRoster();
            
            const modal = document.getElementById('roster-refinement-modal');
            if (modal) {
                modal.classList.add('visible');
                modal.setAttribute('aria-hidden', 'false');
            }
        }

        function updateRosterFilterOptions() {
            const filterTypeSelect = document.getElementById('roster-filter-type');
            const filterOptionsDiv = document.getElementById('roster-filter-options');
            if (!filterTypeSelect || !filterOptionsDiv) return;
            
            const filterType = filterTypeSelect.value;
            rosterFilterSettings.filterType = filterType;
            
            if (!filterType) {
                filterOptionsDiv.style.display = 'none';
                renderFilteredRoster();
                return;
            }
            
            filterOptionsDiv.style.display = 'block';
            let optionsHtml = '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
            
            if (filterType === 'grade') {
                const grades = ['9th', '10th', '11th', '12th'];
                grades.forEach(grade => {
                    const checked = rosterFilterSettings.grade[grade] !== false;
                    optionsHtml += `
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" value="${grade}" ${checked ? 'checked' : ''} onchange="toggleRosterFilterOption('grade', '${grade}', this.checked)">
                            <span>${grade}</span>
                        </label>
                    `;
                });
            } else if (filterType === 'gender') {
                const genders = [
                    { value: 'M', label: 'Male' },
                    { value: 'F', label: 'Female' },
                    { value: 'NB', label: 'Nonbinary' }
                ];
                genders.forEach(g => {
                    const checked = rosterFilterSettings.gender[g.value] !== false;
                    optionsHtml += `
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" value="${g.value}" ${checked ? 'checked' : ''} onchange="toggleRosterFilterOption('gender', '${g.value}', this.checked)">
                            <span>${g.label}</span>
                        </label>
                    `;
                });
            } else if (filterType === 'racingGroup') {
                // Get all unique racing groups from riders
                const allRacingGroups = new Set();
                (data.riders || []).forEach(rider => {
                    if (rider.racingGroup) {
                        allRacingGroups.add(rider.racingGroup);
                    }
                });
                const sortedGroups = Array.from(allRacingGroups).sort();
                sortedGroups.forEach(group => {
                    if (!rosterFilterSettings.racingGroup.hasOwnProperty(group)) {
                        rosterFilterSettings.racingGroup[group] = true;
                    }
                    const checked = rosterFilterSettings.racingGroup[group] !== false;
                    optionsHtml += `
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" value="${escapeHtml(group)}" ${checked ? 'checked' : ''} onchange="toggleRosterFilterOption('racingGroup', '${escapeHtml(group)}', this.checked)">
                            <span>${escapeHtml(group)}</span>
                        </label>
                    `;
                });
            }
            
            optionsHtml += '</div>';
            filterOptionsDiv.innerHTML = optionsHtml;
            
            renderFilteredRoster();
        }

        function toggleRosterFilterOption(type, value, checked) {
            if (type === 'grade') {
                rosterFilterSettings.grade[value] = checked;
            } else if (type === 'gender') {
                rosterFilterSettings.gender[value] = checked;
            } else if (type === 'racingGroup') {
                rosterFilterSettings.racingGroup[value] = checked;
            }
            renderFilteredRoster();
        }

        function renderFilteredRoster() {
            const tbody = document.getElementById('roster-filtered-list');
            const countSpan = document.getElementById('roster-filtered-count');
            if (!tbody) return;
            
            let filteredRiders = (data.riders || []).filter(rider => {
                // Filter by grade
                if (rosterFilterSettings.filterType === 'grade' || rosterFilterSettings.filterType === '') {
                    const riderGrade = normalizeGradeValue(rider.grade || '9th');
                    if (!rosterFilterSettings.grade[riderGrade]) {
                        return false;
                    }
                }
                
                // Filter by gender
                if (rosterFilterSettings.filterType === 'gender' || rosterFilterSettings.filterType === '') {
                    const riderGender = (rider.gender || '').toString().toUpperCase();
                    let genderKey = '';
                    if (riderGender === 'M' || riderGender === 'MALE') {
                        genderKey = 'M';
                    } else if (riderGender === 'F' || riderGender === 'FEMALE') {
                        genderKey = 'F';
                    } else if (riderGender === 'NB' || riderGender === 'NONBINARY') {
                        genderKey = 'NB';
                    }
                    if (genderKey && !rosterFilterSettings.gender[genderKey]) {
                        return false;
                    }
                }
                
                // Filter by racing group
                if (rosterFilterSettings.filterType === 'racingGroup' || rosterFilterSettings.filterType === '') {
                    const riderGroup = rider.racingGroup || '';
                    if (riderGroup && !rosterFilterSettings.racingGroup[riderGroup]) {
                        return false;
                    }
                }
                
                return true;
            });
            
            // Sort by name
            filteredRiders.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            let html = '';
            filteredRiders.forEach(rider => {
                const grade = normalizeGradeValue(rider.grade || '9th');
                const gender = (rider.gender || '').toString().toUpperCase();
                let genderLabel = '';
                if (gender === 'M' || gender === 'MALE') {
                    genderLabel = 'Male';
                } else if (gender === 'F' || gender === 'FEMALE') {
                    genderLabel = 'Female';
                } else if (gender === 'NB' || gender === 'NONBINARY') {
                    genderLabel = 'Nonbinary';
                } else {
                    genderLabel = gender || '';
                }
                const racingGroup = rider.racingGroup || '';
                
                html += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">✓</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(rider.name || '')}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(grade)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(genderLabel)}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(racingGroup)}</td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            if (countSpan) {
                countSpan.textContent = filteredRiders.length;
            }
        }

        function saveRosterRefinement() {
            if (currentPracticeIdForRoster === null) return;
            
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;
            
            const practiceIndex = seasonSettingsDraft.practices.findIndex(
                p => String(p.id) === String(currentPracticeIdForRoster)
            );
            if (practiceIndex === -1) return;
            
            // Save filter settings to practice in draft
            const savedRosterFilter = JSON.parse(JSON.stringify(rosterFilterSettings));
            seasonSettingsDraft.practices[practiceIndex].rosterFilter = savedRosterFilter;
            
            // Also immediately save to data.seasonSettings.practices and persist to Supabase
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            if (!Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices = [];
            }
            
            const settingsPracticeIndex = data.seasonSettings.practices.findIndex(
                p => String(p.id) === String(currentPracticeIdForRoster)
            );
            if (settingsPracticeIndex >= 0) {
                data.seasonSettings.practices[settingsPracticeIndex].rosterFilter = savedRosterFilter;
            } else {
                // Practice not found in data.seasonSettings - add it
                const practice = seasonSettingsDraft.practices[practiceIndex];
                data.seasonSettings.practices.push({
                    ...practice,
                    rosterFilter: savedRosterFilter
                });
            }
            
            // Persist to Supabase
            saveData();
            
            closeRosterRefinement();
            renderPracticeRows();
            
            // Update original state to reflect saved changes
            const key = String(currentPracticeIdForRoster);
            originalPracticeStates.set(key, JSON.parse(JSON.stringify(seasonSettingsDraft.practices[practiceIndex])));
            
            // Check for changes - should show no changes now since we saved
            checkPracticeChanges(currentPracticeIdForRoster);
        }

        function closeRosterRefinement() {
            const modal = document.getElementById('roster-refinement-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
            }
            currentPracticeIdForRoster = null;
        }

        function formatDateToISO(date) {
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function parseISODate(dateString) {
            if (!dateString) return null;
            // Parse date string (YYYY-MM-DD) in local time to avoid timezone issues
            const parts = dateString.split('-');
            if (parts.length !== 3) {
                // Fallback to standard parsing if format is unexpected
                const parsed = new Date(dateString);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(parts[2], 10);
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                return null;
            }
            const parsed = new Date(year, month, day);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function openAddPracticeModal() {
            const modal = document.getElementById('add-practice-modal');
            if (!modal) return;

            const dateInput = document.getElementById('practice-date');
            const timeInput = document.getElementById('practice-time');
            
            if (dateInput) dateInput.value = '';
            if (timeInput) timeInput.value = '';

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');

            if (dateInput) {
                setTimeout(() => dateInput.focus(), 0);
            }
        }

        function closeAddPracticeModal() {
            const modal = document.getElementById('add-practice-modal');
            if (!modal) return;
            if (modal.contains(document.activeElement)) document.activeElement.blur();
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
        }

        function saveAddPractice() {
            const dateInput = document.getElementById('practice-date');
            const timeInput = document.getElementById('practice-time');
            
            const dateValue = dateInput ? dateInput.value : '';
            const timeValue = timeInput ? timeInput.value : '';

            if (!dateValue) {
                alert('Please select a date');
                return;
            }

            if (!timeValue) {
                alert('Please select a time');
                return;
            }

            const existingRide = data.rides.find(ride => ride.date === dateValue);
            let rideId;

            if (existingRide) {
                rideId = existingRide.id;
            } else {
                const ride = {
                    id: generateId(),
                    date: dateValue,
                    time: timeValue,
                    availableCoaches: [],
                    availableRiders: [],
                    assignments: {},
                    groups: []
                };
                data.rides.push(ride);
                rideId = ride.id;
            }

            data.currentRide = rideId;
            saveData();
            closeAddPracticeModal();
            renderRides();
            loadCurrentRide();
        }

        function formatTimeForDisplay(time) {
            if (!time) return '';
            const [hourStr, minuteStr = '00'] = time.split(':');
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10) || 0;
            if (!Number.isFinite(hour)) return time;
            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = ((hour + 11) % 12) + 1;
            return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
        }

        function renderSeasonCalendar() {
            // Render to rides tab calendar if it exists
            const ridesContainer = document.getElementById('season-calendar');
            if (ridesContainer) {
                renderSeasonCalendarToContainer(ridesContainer);
            }
        }

        function renderSeasonCalendarForSettings() {
            // Render to settings tab calendar if it exists
            const settingsContainer = document.getElementById('season-calendar-settings');
            if (settingsContainer) {
                renderSeasonCalendarToContainer(settingsContainer);
            }
        }

        // Debounce calendar rendering to prevent multiple rapid updates
        function renderAllCalendars() {
            // Clear any pending render
            if (calendarRenderTimeout) {
                clearTimeout(calendarRenderTimeout);
            }
            
            // Debounce the render to ensure all updates are complete
            calendarRenderTimeout = setTimeout(() => {
                // Force complete rebuild by clearing both containers first
                const ridesContainer = document.getElementById('season-calendar');
                const settingsContainer = document.getElementById('season-calendar-settings');
                
                if (ridesContainer) {
                    ridesContainer.innerHTML = '';
                    ridesContainer.className = '';
                }
                if (settingsContainer) {
                    settingsContainer.innerHTML = '';
                    settingsContainer.className = '';
                }
                
                // Use requestAnimationFrame to ensure DOM is ready
                requestAnimationFrame(() => {
            // Render to both calendars if they exist
            renderSeasonCalendar();
            renderSeasonCalendarForSettings();
                    calendarRenderTimeout = null;
                });
            }, 50); // Small delay to batch multiple updates
        }

        function renderSeasonCalendarToContainer(container, options) {
            if (!container) return;
            const pickerMode = options && options.pickerMode; // 'future' | 'past'

            // Clear container first to ensure fresh render (prevents old practice days from persisting)
            container.innerHTML = '';
            container.className = '';

            // Use draft settings if available (for live preview of changes), otherwise use saved settings
            // Merge draft with base settings to preserve all fields (fitnessScale, skillsScale, etc.)
            const baseSettings = data.seasonSettings || buildDefaultSeasonSettings();
            let settings, practices;
            if (seasonSettingsDraft) {
                // Use draft settings, but preserve other fields from base (fitnessScale, skillsScale, etc.)
                settings = { ...baseSettings, ...seasonSettingsDraft };
                // Explicitly use draft practices to ensure we see the latest changes
                practices = Array.isArray(seasonSettingsDraft.practices) ? seasonSettingsDraft.practices : [];
            } else {
                settings = baseSettings;
                practices = Array.isArray(settings.practices) ? settings.practices : [];
            }
            const startDate = parseISODate(settings.startDate);
            const endDate = parseISODate(settings.endDate);

            const practiceDateMap = new Map();
            let seasonStart = null;
            let seasonEnd = null;

            // If season dates are set, use them; otherwise determine from individual rides
            if (startDate && endDate && startDate <= endDate) {
                seasonStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                seasonEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

                // Add regular practices based on day of week
                const cursor = new Date(seasonStart.getTime());
                while (cursor <= seasonEnd) {
                    const dateKey = formatDateToISO(cursor);
                    const weekday = cursor.getDay();
                    // Ensure type-safe comparison (dayOfWeek might be string or number)
                    // IMPORTANT: Filter out practices that have specificDate (single practices should not appear on recurring days)
                    const matchedPractices = practices.filter(practice => {
                        const practiceDay = Number(practice.dayOfWeek);
                        const hasSpecificDate = practice.specificDate != null && practice.specificDate !== undefined && practice.specificDate !== '';
                        return Number.isFinite(practiceDay) && practiceDay === weekday && !hasSpecificDate;
                    });
                    if (matchedPractices.length > 0) {
                        practiceDateMap.set(dateKey, matchedPractices.map(practice => practice.time || ''));
                    }
                    cursor.setDate(cursor.getDate() + 1);
                }
                
                // Add single practices (with specificDate) to the calendar. Treat as single if specificDate is set (ignore dayOfWeek).
                const singlePracticeDates = [];
                practices.forEach(practice => {
                    if (practice.specificDate != null && practice.specificDate !== undefined && practice.specificDate !== '') {
                        const practiceDate = parseISODate(practice.specificDate);
                        if (practiceDate) {
                            singlePracticeDates.push(practiceDate);
                            const dateKey = formatDateToISO(practiceDate);
                            const inRange = practiceDate >= seasonStart && practiceDate <= seasonEnd;
                            if (inRange) {
                                const existingTimes = practiceDateMap.get(dateKey) || [];
                                const practiceTime = practice.time || '';
                                if (practiceTime && !existingTimes.includes(practiceTime)) {
                                    existingTimes.push(practiceTime);
                                }
                                practiceDateMap.set(dateKey, existingTimes.length > 0 ? existingTimes : []);
                            }
                        }
                    }
                });
                // Expand season range to include single practices outside it so they show on the calendar
                if (singlePracticeDates.length > 0) {
                    const minSingle = new Date(Math.min(...singlePracticeDates.map(d => d.getTime())));
                    const maxSingle = new Date(Math.max(...singlePracticeDates.map(d => d.getTime())));
                    if (minSingle < seasonStart) seasonStart = new Date(minSingle.getFullYear(), minSingle.getMonth(), minSingle.getDate());
                    if (maxSingle > seasonEnd) seasonEnd = new Date(maxSingle.getFullYear(), maxSingle.getMonth(), maxSingle.getDate());
                    singlePracticeDates.forEach(practiceDate => {
                        const dateKey = formatDateToISO(practiceDate);
                        if (!practiceDateMap.has(dateKey)) {
                            const practice = practices.find(p => {
                                const d = parseISODate(p.specificDate);
                                return d && formatDateToISO(d) === dateKey;
                            });
                            const practiceTime = practice && practice.time ? practice.time : '';
                            practiceDateMap.set(dateKey, practiceTime ? [practiceTime] : []);
                        }
                    });
                }

                // Add rescheduled dates: any non-deleted ride date that isn't in practiceDateMap (e.g. rescheduled to a different weekday)
                if (Array.isArray(data.rides) && seasonStart && seasonEnd) {
                    const rescheduledDates = [];
                    data.rides.forEach(ride => {
                        if (!ride.date || ride.deleted) return;
                        const rideDate = parseISODate(ride.date);
                        if (!rideDate) return;
                        const dateKey = formatDateToISO(rideDate);
                        if (!practiceDateMap.has(dateKey)) {
                            const rideDateNorm = new Date(rideDate.getFullYear(), rideDate.getMonth(), rideDate.getDate());
                            rescheduledDates.push(rideDateNorm);
                            const times = ride.time ? [ride.time] : [];
                            practiceDateMap.set(dateKey, times);
                        }
                    });
                    // Expand season range to include rescheduled dates outside it
                    if (rescheduledDates.length > 0) {
                        const minResched = new Date(Math.min(...rescheduledDates.map(d => d.getTime())));
                        const maxResched = new Date(Math.max(...rescheduledDates.map(d => d.getTime())));
                        if (minResched < seasonStart) seasonStart = new Date(minResched.getFullYear(), minResched.getMonth(), minResched.getDate());
                        if (maxResched > seasonEnd) seasonEnd = new Date(maxResched.getFullYear(), maxResched.getMonth(), maxResched.getDate());
                    }
                }
            } else {
                // No season dates set - try to determine range from practices or rides
                const practiceDates = [];
                const rideDates = [];
                
                // Collect dates from single practices
                practices.forEach(practice => {
                    if (practice.specificDate) {
                        const practiceDate = parseISODate(practice.specificDate);
                        if (practiceDate) practiceDates.push(practiceDate);
                    }
                });
                
                // Collect dates from rides
                if (Array.isArray(data.rides)) {
                    data.rides.forEach(ride => {
                        if (!ride.date) return;
                        const rideDate = parseISODate(ride.date);
                        if (rideDate) rideDates.push(rideDate);
                    });
                }
                
                // Use practice dates if available, otherwise use ride dates
                const allDates = practiceDates.length > 0 ? practiceDates : rideDates;
                
                if (allDates.length === 0) {
                    container.className = 'season-calendar-empty';
                    container.innerHTML = `
                        Set your season dates and practices to populate the calendar.
                    `;
                    return;
                }

                allDates.sort((a, b) => a - b);
                seasonStart = new Date(allDates[0].getFullYear(), allDates[0].getMonth(), 1);
                const lastDate = allDates[allDates.length - 1];
                seasonEnd = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
                
                // Add recurring practices to the calendar even without season dates
                if (practices.length > 0) {
                    const cursor = new Date(seasonStart.getTime());
                    while (cursor <= seasonEnd) {
                        const dateKey = formatDateToISO(cursor);
                        const weekday = cursor.getDay();
                        // Ensure type-safe comparison (dayOfWeek might be string or number)
                        const matchedPractices = practices.filter(practice => {
                            const practiceDay = Number(practice.dayOfWeek);
                            return Number.isFinite(practiceDay) && practiceDay === weekday && !practice.specificDate;
                        });
                        if (matchedPractices.length > 0) {
                            practiceDateMap.set(dateKey, matchedPractices.map(practice => practice.time || ''));
                        }
                        cursor.setDate(cursor.getDate() + 1);
                    }
                    
                    // Add single practices (treat as single if specificDate is set)
                    practices.forEach(practice => {
                        if (practice.specificDate != null && practice.specificDate !== undefined && practice.specificDate !== '') {
                            const practiceDate = parseISODate(practice.specificDate);
                            if (practiceDate && practiceDate >= seasonStart && practiceDate <= seasonEnd) {
                                const dateKey = formatDateToISO(practiceDate);
                                const existingTimes = practiceDateMap.get(dateKey) || [];
                                const practiceTime = practice.time || '';
                                if (practiceTime && !existingTimes.includes(practiceTime)) {
                                    existingTimes.push(practiceTime);
                                }
                                practiceDateMap.set(dateKey, existingTimes.length > 0 ? existingTimes : []);
                            }
                        }
                    });
                }
            }

            // Track practice states: cancelled, deleted, rescheduled
            const cancelledDates = new Set();
            const deletedDates = new Set();
            const rescheduledDates = new Map(); // dateKey -> { originalDate, newDate }
            const rescheduledOriginalDates = new Set(); // Track original dates of rescheduled practices
            
            // Track race dates
            const raceDates = new Map(); // dateKey -> { name, location, isPreRide: boolean }
            if (Array.isArray(data.races)) {
                data.races.forEach(race => {
                    if (race.raceDate) {
                        const raceDate = parseISODate(race.raceDate);
                        if (raceDate && raceDate >= seasonStart && raceDate <= seasonEnd) {
                            const dateKey = formatDateToISO(raceDate);
                            const existing = raceDates.get(dateKey) || { names: [], locations: [], isPreRide: false };
                            existing.names.push(race.name || 'Race');
                            existing.locations.push(race.location || '');
                            existing.isPreRide = false;
                            raceDates.set(dateKey, existing);
                        }
                    }
                    if (race.preRideDate && race.preRideDate !== race.raceDate) {
                        const preRideDate = parseISODate(race.preRideDate);
                        if (preRideDate && preRideDate >= seasonStart && preRideDate <= seasonEnd) {
                            const dateKey = formatDateToISO(preRideDate);
                            const existing = raceDates.get(dateKey) || { names: [], locations: [], isPreRide: true };
                            existing.names.push(race.name || 'Race');
                            existing.locations.push(race.location || '');
                            existing.isPreRide = true;
                            raceDates.set(dateKey, existing);
                        }
                    }
                });
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Find current/next practice
            let currentPracticeDate = null;
            const upcomingRides = (data.rides || [])
                .filter(ride => {
                    if (!ride.date || ride.deleted || ride.cancelled) return false;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return false;
                    rideDate.setHours(0, 0, 0, 0);
                    return rideDate >= today;
                })
                .sort((a, b) => {
                    const dateA = parseISODate(a.date);
                    const dateB = parseISODate(b.date);
                    if (!dateA || !dateB) return 0;
                    return dateA - dateB;
                });
            if (upcomingRides.length > 0) {
                const nextRideDate = parseISODate(upcomingRides[0].date);
                if (nextRideDate) {
                    nextRideDate.setHours(0, 0, 0, 0);
                    currentPracticeDate = nextRideDate;
                }
            }
            
            // IMPORTANT: Only use data.rides for tracking cancelled/deleted/rescheduled states
            // Set window.DEBUG_RESCHEDULE = true in console to debug reschedule flow
            const debugReschedule = typeof window !== 'undefined' && window.DEBUG_RESCHEDULE === true;
            if (Array.isArray(data.rides)) {
                const ridesWithRescheduled = data.rides.filter(r => r.rescheduledFrom && !r.deleted);
                if (debugReschedule) {
                    console.log('🔄 RESCHEDULE DEBUG: Total rides:', data.rides.length, 'with rescheduledFrom:', ridesWithRescheduled.length, ridesWithRescheduled.length > 0 ? ridesWithRescheduled.map(r => ({ id: r.id, date: r.date, rescheduledFrom: r.rescheduledFrom })) : '(none - rescheduledFrom may be lost after save)');
                }
                data.rides.forEach(ride => {
                    if (!ride.date) return;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return;
                    
                    // Skip deleted practices
                    if (ride.deleted) {
                        const dateKey = formatDateToISO(rideDate);
                        deletedDates.add(dateKey);
                        return;
                    }
                    
                    // Track rescheduled practices: hide original date, show new date
                    if (ride.rescheduledFrom) {
                        if (debugReschedule) {
                            console.log('🔄 RESCHEDULE DEBUG: Processing ride', ride.id, 'date:', ride.date, 'rescheduledFrom:', ride.rescheduledFrom);
                        }
                        const originalDate = parseISODate(ride.rescheduledFrom);
                        if (originalDate) {
                            const originalKey = formatDateToISO(originalDate);
                            const newKey = formatDateToISO(rideDate);
                            rescheduledDates.set(originalKey, { originalDate, newDate: rideDate });
                            rescheduledOriginalDates.add(originalKey);
                            // Treat original date as deleted so it does not render
                            deletedDates.add(originalKey);
                            // Rescheduled rides MUST show on new date - add to practiceDateMap if not already there
                            if (!practiceDateMap.has(newKey)) {
                                const times = ride.time ? [ride.time] : [];
                                practiceDateMap.set(newKey, times);
                                if (debugReschedule) {
                                    console.log('🔄 RESCHEDULE DEBUG: Added new date to calendar:', newKey);
                                }
                                // Expand season range if rescheduled date falls outside
                                const rideDateNorm = new Date(rideDate.getFullYear(), rideDate.getMonth(), rideDate.getDate());
                                if (rideDateNorm < seasonStart) seasonStart = new Date(rideDateNorm.getTime());
                                if (rideDateNorm > seasonEnd) seasonEnd = new Date(rideDateNorm.getTime());
                            } else if (debugReschedule) {
                                console.log('🔄 RESCHEDULE DEBUG: New date', newKey, 'already in practiceDateMap');
                            }
                        } else if (debugReschedule) {
                            console.log('🔄 RESCHEDULE DEBUG: Failed to parse rescheduledFrom:', ride.rescheduledFrom);
                        }
                    }
                    
                    // Check if ride date is within season range
                    if (rideDate >= seasonStart && rideDate <= seasonEnd) {
                        const dateKey = formatDateToISO(rideDate);
                        
                        // Track cancelled practices
                        if (ride.cancelled) {
                            cancelledDates.add(dateKey);
                        }
                        
                        // Update times for existing dates; rescheduled new dates already added above
                        if (practiceDateMap.has(dateKey)) {
                        const existingTimes = practiceDateMap.get(dateKey) || [];
                        const rideTime = ride.time || '';
                        if (rideTime && !existingTimes.includes(rideTime)) {
                            existingTimes.push(rideTime);
                            practiceDateMap.set(dateKey, existingTimes);
                        }
                        }
                    }
                });
            }
            
            
            // Single-practice dates must stay on calendar even if a deleted ride exists (e.g. old ride was deleted; single practice is the source of truth)
            const singlePracticeDates = new Set();
            practices.forEach(p => {
                if (p.specificDate != null && p.specificDate !== undefined && p.specificDate !== '') {
                    const d = parseISODate(p.specificDate);
                    if (d) singlePracticeDates.add(formatDateToISO(d));
                }
            });
            // Remove deleted dates from practice map, but never remove a date that is a single practice's specificDate
            deletedDates.forEach(dateKey => {
                if (singlePracticeDates.has(dateKey)) {
                    return;
                }
                const wasRemoved = practiceDateMap.delete(dateKey);
                if (wasRemoved) {
                } else {
                }
            });
            

            if (practiceDateMap.size === 0) {
                container.className = 'season-calendar-empty';
                container.innerHTML = `
                    None of the saved practices fall within the chosen season dates.
                `;
                return;
            }

            let firstMonth = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), 1);
            let lastMonth = new Date(seasonEnd.getFullYear(), seasonEnd.getMonth(), 1);

            // In picker mode, hide months that don't apply
            if (pickerMode) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (pickerMode === 'future') {
                    // Only show from current month onward
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    if (monthStart > firstMonth) firstMonth = new Date(monthStart.getTime());
                } else if (pickerMode === 'past') {
                    // Only show through end of last month
                    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
                    if (lastMonthStart < lastMonth) lastMonth = new Date(lastMonthStart.getTime());
                }
            }

            const months = [];
            const monthCursor = new Date(firstMonth.getTime());
            while (monthCursor <= lastMonth) {
                months.push({
                    year: monthCursor.getFullYear(),
                    month: monthCursor.getMonth()
                });
                monthCursor.setMonth(monthCursor.getMonth() + 1);
            }

            if (months.length === 0) {
                container.className = 'season-calendar-empty';
                container.innerHTML = pickerMode === 'future'
                    ? 'No future practices in the season.'
                    : 'No past practices in the season.';
                return;
            }

            const weekdaysHeader = DAYS_OF_WEEK.map(day => day.slice(0, 3));

            const monthsHtml = months.map(({ year, month }) => {
                const monthStart = new Date(year, month, 1);
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstWeekday = monthStart.getDay();

                let cellsHtml = weekdaysHeader.map(day => `<div class="weekday">${day}</div>`).join('');

                for (let i = 0; i < firstWeekday; i++) {
                    cellsHtml += '<div class="month-cell empty"></div>';
                }

                for (let day = 1; day <= daysInMonth; day++) {
                    const currentDate = new Date(year, month, day);
                    const dateKey = formatDateToISO(currentDate);
                    const practiceTimes = practiceDateMap.get(dateKey);
                    const isPractice = Array.isArray(practiceTimes);
                    const isRescheduledOriginal = rescheduledOriginalDates.has(dateKey);
                    const isRescheduledNew = Array.from(rescheduledDates.values()).some(entry => formatDateToISO(entry.newDate) === dateKey);
                    const raceInfo = raceDates.get(dateKey);
                    const isRace = !!raceInfo;
                    
                    // Also check if this is a rescheduled original date (even if not in practice map)
                    const isPracticeOrRescheduled = isPractice || isRescheduledOriginal || isRescheduledNew;
                    
                    const tooltip = isPractice && practiceTimes.length > 0 ? practiceTimes.map(formatTimeForDisplay).join(', ') : '';
                    let titleText = '';
                    if (isRace) {
                        const raceNames = raceInfo.names.join(', ');
                        const raceType = raceInfo.isPreRide ? 'Pre-Ride' : 'Race';
                        titleText = `${raceType}: ${raceNames}`;
                        if (raceInfo.locations.some(loc => loc)) {
                            titleText += ` (${raceInfo.locations.filter(loc => loc).join(', ')})`;
                        }
                    } else if (tooltip) {
                        titleText = `Practice at ${tooltip}`;
                    } else if (isPracticeOrRescheduled) {
                        titleText = 'Practice';
                    }
                    const titleAttr = titleText ? ` title="${escapeHtml(titleText)}"` : '';
                    
                    let ariaLabel = '';
                    if (isRace) {
                        const raceNames = raceInfo.names.join(', ');
                        const raceType = raceInfo.isPreRide ? 'Pre-Ride' : 'Race';
                        ariaLabel = `${raceType} on ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${raceNames}`;
                    } else if (tooltip) {
                        ariaLabel = `Practice on ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${tooltip}`;
                    } else if (isPracticeOrRescheduled) {
                        ariaLabel = `Practice on ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
                    } else {
                        ariaLabel = `No practice on ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
                    }
                    const ariaAttr = ` aria-label="${escapeHtml(ariaLabel)}"`;

                    // In picker mode: hide races, only show relevant practice dates with simplified styling
                    // Also exclude practices from excluded series in future picker mode
                    const isPickerRelevant = pickerMode && (isPractice || isRescheduledNew) && !isRescheduledOriginal && !deletedDates.has(dateKey);
                    const isPickerSelectable = isPickerRelevant && (() => {
                        currentDate.setHours(0, 0, 0, 0);
                        const isPast = currentDate < today;
                        if (pickerMode === 'future' && !isPast) {
                            // In future picker, exclude planner-excluded practices
                            return !isRideDateExcludedFromPlanner(dateKey);
                        }
                        if (pickerMode === 'past' && isPast) {
                            return !isRideDateExcludedFromPlanner(dateKey);
                        }
                        return false;
                    })();

                    if (pickerMode) {
                        // Picker: races and non-matching dates = plain cells; matching practices = selectable
                        if (isRace || !isPickerSelectable) {
                            cellsHtml += `
                                <div class="month-cell"${ariaAttr}>
                                    <div class="day-number">${day}</div>
                                </div>
                            `;
                        } else {
                            const titleText = isPractice && practiceTimes.length > 0 ? `Practice at ${practiceTimes.map(formatTimeForDisplay).join(', ')}` : 'Practice';
                            cellsHtml += `
                                <div class="month-cell practice" title="${escapeHtml(titleText)}" aria-label="Practice on ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}" data-date="${dateKey}" onclick="handlePracticeDateClickForPicker('${dateKey}')" style="background: #2196F3; color: white; cursor: pointer;">
                                    <div class="day-number">${day}</div>
                                </div>
                            `;
                        }
                    } else if (isPracticeOrRescheduled || isRace) {
                        const isCancelled = cancelledDates.has(dateKey);
                        const isDeleted = deletedDates.has(dateKey);
                        
                        // Determine if past, current (next), or future
                        currentDate.setHours(0, 0, 0, 0);
                        const isPast = currentDate < today;
                        const isNext = currentPracticeDate && formatDateToISO(currentDate) === formatDateToISO(currentPracticeDate);
                        
                        if (isDeleted && !isRace) {
                            // Don't show deleted practices (but still show races)
                            cellsHtml += `
                                <div class="month-cell"${ariaAttr}>
                                    <div class="day-number">${day}</div>
                                </div>
                            `;
                            continue;
                        }
                        
                        let cellClass = isRace ? 'race' : 'practice';
                        let cellStyle = '';
                        
                        if (isRace) {
                            if (raceInfo.isPreRide) {
                                cellClass += ' race preride';
                            } else {
                                cellClass += ' race';
                            }
                            cellStyle = '';
                        } else if (isCancelled) {
                            // Light blue with red slash for cancelled
                            cellClass += ' cancelled';
                            cellStyle = 'background: #B3E5FC; position: relative;';
                        } else if (isRescheduledOriginal || isRescheduledNew) {
                            // Light blue for rescheduled
                            cellClass += ' rescheduled';
                            cellStyle = 'background: #B3E5FC;';
                        } else if (isNext) {
                            // Orange circle only (styled in CSS)
                            cellClass += ' next';
                            cellStyle = '';
                        } else if (isPast) {
                            // Grey circle only (styled in CSS)
                            cellClass += ' past';
                            cellStyle = '';
                        }

                        if (!isRace && !isCancelled && !isDeleted && isRideDateExcludedFromPlanner(dateKey)) {
                            cellClass += isPast ? ' planner-excluded past' : ' planner-excluded';
                            cellStyle = '';
                        }
                        
                        const slashStyle = isCancelled ? '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center;"><div style="width: 100%; height: 2px; background: #f44336; transform: rotate(-45deg);"></div></div>' : '';
                        
                        const onClick = `handlePracticeDateClick('${dateKey}', event)`;
                        const onclickAttr = ` onclick="${onClick}"`;
                        
                        cellsHtml += `
                            <div class="month-cell ${cellClass}"${titleAttr}${ariaAttr} data-date="${dateKey}"${onclickAttr} style="${cellStyle}">
                                <div class="day-number">${day}</div>
                                ${slashStyle}
                            </div>
                        `;
                    } else {
                        cellsHtml += `
                            <div class="month-cell"${ariaAttr}>
                                <div class="day-number">${day}</div>
                            </div>
                        `;
                    }
                }

                return `
                    <div class="season-month">
                        <div class="month-header">${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                        <div class="month-grid">
                            ${cellsHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            container.className = 'season-calendar';
            container.innerHTML = monthsHtml;
        }

        function handlePracticeDateClick(dateString, event) {
            if (!dateString) return;
            
            const contextMenu = document.getElementById('practice-context-menu');
            if (!contextMenu) return;
            
            // If clicking the same date that's already open, close it
            if (contextMenuDate === dateString && contextMenu.style.display === 'block') {
                contextMenu.style.display = 'none';
                if (contextMenuTimeout) {
                    clearTimeout(contextMenuTimeout);
                    contextMenuTimeout = null;
                }
                if (contextMenuCloseHandler) {
                    document.removeEventListener('click', contextMenuCloseHandler);
                    contextMenuCloseHandler = null;
                }
                contextMenuDate = null;
                return;
            }
            
            // Close any existing menu and clear its timeout/handler
            if (contextMenuTimeout) {
                clearTimeout(contextMenuTimeout);
                contextMenuTimeout = null;
            }
            if (contextMenuCloseHandler) {
                document.removeEventListener('click', contextMenuCloseHandler);
                contextMenuCloseHandler = null;
            }
            contextMenu.style.display = 'none';
            
            // Store the date for context menu actions
            contextMenuDate = dateString;
            
            const cancelledRide = (data.rides || []).find(r => r.date === dateString && !r.deleted && r.cancelled);
            const rescheduledRide = (data.rides || []).find(r => r.date === dateString && !r.deleted && r.rescheduledFrom);
            const restoreBtn = document.getElementById('restore-practice-btn');
            if (restoreBtn) {
                restoreBtn.style.display = (cancelledRide || rescheduledRide) ? 'block' : 'none';
                restoreBtn.textContent = rescheduledRide ? 'Move back to original date' : 'Restore Practice';
            }

            const goToPlannerBtn = document.getElementById('go-to-planner-btn');
            if (goToPlannerBtn) {
                const isExcluded = isRideDateExcludedFromPlanner(dateString);
                const existingRide = (data.rides || []).find(r => r.date === dateString && !r.deleted);
                goToPlannerBtn.style.display = (!isExcluded && existingRide && !existingRide.cancelled) ? 'block' : 'none';
            }
            
            // Position menu to the right of the clicked calendar cell
            if (event) {
                // Find the actual calendar cell element (might be event.target or its parent)
                let cellElement = event.target;
                while (cellElement && !cellElement.hasAttribute('data-date')) {
                    cellElement = cellElement.parentElement;
                }
                
                if (cellElement) {
                    // Use the cell's bounding rect for accurate positioning
                    const cellRect = cellElement.getBoundingClientRect();
                    
                    // Position menu to the right of the cell, with top-left corner aligned to top of cell
                    // Add small offset (5px) to prevent overlap with the cell
                    contextMenu.style.left = `${cellRect.right + 5}px`;
                    contextMenu.style.top = `${cellRect.top}px`;
                    
                    // Show the menu first so we can measure it
                    contextMenu.style.display = 'block';
                    contextMenu.style.visibility = 'visible';
                    
                    // Ensure menu stays within viewport
                    requestAnimationFrame(() => {
                        const menuRect = contextMenu.getBoundingClientRect();
                        // Adjust horizontally if menu goes off right edge - show to the left of cell instead
                        if (menuRect.right > window.innerWidth) {
                            contextMenu.style.left = `${cellRect.left - menuRect.width - 5}px`;
                        }
                        // Adjust vertically if menu goes off bottom edge - align to bottom of cell
                        if (menuRect.bottom > window.innerHeight) {
                            contextMenu.style.top = `${cellRect.bottom - menuRect.height}px`;
                        }
                        // Ensure menu doesn't go off left edge
                        if (menuRect.left < 0) {
                            contextMenu.style.left = '10px';
                        }
                        // Ensure menu doesn't go off top edge
                        if (menuRect.top < 0) {
                            contextMenu.style.top = '10px';
                        }
                    });
                } else {
                    // Fallback to click coordinates if cell not found
                const x = event.clientX || (event.touches && event.touches[0].clientX);
                const y = event.clientY || (event.touches && event.touches[0].clientY);
                    contextMenu.style.left = `${x + 10}px`;
                contextMenu.style.top = `${y}px`;
                    contextMenu.style.display = 'block';
                    contextMenu.style.visibility = 'visible';
                }
            } else {
                // Fallback positioning
                contextMenu.style.left = '50%';
                contextMenu.style.top = '50%';
                contextMenu.style.display = 'block';
                contextMenu.style.visibility = 'visible';
            }
            
            // Auto-close menu after 5 seconds
            contextMenuTimeout = setTimeout(() => {
                if (contextMenuDate === dateString) { // Only close if this is still the active menu
                    contextMenu.style.display = 'none';
                    contextMenuDate = null;
                    if (contextMenuCloseHandler) {
                        document.removeEventListener('click', contextMenuCloseHandler);
                        contextMenuCloseHandler = null;
                    }
                }
                contextMenuTimeout = null;
            }, 5000);
            
            // Close menu when clicking outside or on a different date
            setTimeout(() => {
                contextMenuCloseHandler = function closeMenu(e) {
                    // Check if click is on a calendar date cell
                    const clickedCell = e.target.closest('[data-date]');
                    const clickedDate = clickedCell ? clickedCell.getAttribute('data-date') : null;
                    
                    // If clicking on a different date, the handlePracticeDateClick will handle closing/opening
                    // So we only need to close if clicking outside the menu and not on any date cell
                    if (!contextMenu.contains(e.target) && !clickedCell) {
                        // Clicking outside menu and not on any date - close the menu
                        if (contextMenuDate === dateString) { // Only close if this is still the active menu
                        contextMenu.style.display = 'none';
                            contextMenuDate = null;
                            if (contextMenuTimeout) {
                                clearTimeout(contextMenuTimeout);
                                contextMenuTimeout = null;
                            }
                            document.removeEventListener('click', contextMenuCloseHandler);
                            contextMenuCloseHandler = null;
                        }
                    } else if (clickedDate && clickedDate !== dateString) {
                        // Clicking on a different date - close this menu (new menu will open via handlePracticeDateClick)
                        if (contextMenuDate === dateString) { // Only close if this is still the active menu
                            contextMenu.style.display = 'none';
                            contextMenuDate = null;
                            if (contextMenuTimeout) {
                                clearTimeout(contextMenuTimeout);
                                contextMenuTimeout = null;
                            }
                            document.removeEventListener('click', contextMenuCloseHandler);
                            contextMenuCloseHandler = null;
                        }
                    }
                };
                document.addEventListener('click', contextMenuCloseHandler);
            }, 10);
        }

        function goToPracticePlannerFromContext() {
            const dateString = contextMenuDate;
            const contextMenu = document.getElementById('practice-context-menu');
            if (contextMenu) contextMenu.style.display = 'none';
            if (contextMenuTimeout) { clearTimeout(contextMenuTimeout); contextMenuTimeout = null; }
            if (contextMenuCloseHandler) { document.removeEventListener('click', contextMenuCloseHandler); contextMenuCloseHandler = null; }
            contextMenuDate = null;
            if (!dateString) return;

            const ride = (data.rides || []).find(r => r.date === dateString && !r.deleted);
            if (!ride) return;

            data.currentRide = ride.id;
            saveData();

            if (ride.planningStarted || (ride.groups && ride.groups.length > 0)) {
                practicePlannerView = 'planner';
            } else {
                practicePlannerView = 'plannerSetup';
            }

            if (typeof switchTab === 'function') {
                switchTab('rides');
            } else {
                const ridesTab = document.querySelector('[onclick*="switchTab(\'rides\')"]');
                if (ridesTab) ridesTab.click();
            }
            renderRides();
        }

        async function deletePracticeFromContext() {
            if (!contextMenuDate) return;
            
            if (!confirm(`Are you sure you want to delete the practice on ${contextMenuDate}? This action cannot be undone.`)) {
                document.getElementById('practice-context-menu').style.display = 'none';
                return;
            }
            
            // Find existing ride or create a new one to mark as deleted
            let ride = data.rides.find(r => r.date === contextMenuDate && !r.deleted);
            console.log('🗑️ deletePracticeFromContext: Looking for ride with date', contextMenuDate, 'found:', !!ride);
            if (!ride) {
                // No ride exists yet - create one marked as deleted so deletion persists
                // This ensures deleted dates from recurring schedule are saved
                ride = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    date: contextMenuDate,
                    time: '',
                    endTime: '',
                    description: '',
                    meetLocation: '',
                    locationLat: null,
                    locationLng: null,
                    goals: '',
                    groups: [],
                    availableRiders: [],
                    availableCoaches: [],
                    assignments: {},
                    cancelled: false,
                    deleted: true,
                    publishedGroups: false
                };
                data.rides.push(ride);
                console.log('🗑️ deletePracticeFromContext: Created new deleted ride with id', ride.id, 'date', contextMenuDate);
            } else {
                ride.deleted = true;
                console.log('🗑️ deletePracticeFromContext: Marked existing ride as deleted, id', ride.id, 'date', contextMenuDate);
                // If this ride was rescheduled from another date, ensure original date stays hidden
                if (ride.rescheduledFrom) {
                    const originalDate = formatDateToISO(parseISODate(ride.rescheduledFrom));
                    // Mark any ride on original date as deleted too
                    const originalRide = data.rides.find(r => r.date === originalDate && !r.deleted);
                    if (originalRide) {
                        originalRide.deleted = true;
                        await saveRideToDB(originalRide);
                    }
                }
            }
            
            // If this is a single practice (with specificDate), also delete it from seasonSettings
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            const singlePractice = practices.find(p => p.specificDate === contextMenuDate);
            if (singlePractice) {
                console.log('🗑️ Deleting single practice:', singlePractice.id, 'for date:', contextMenuDate);
                // Remove from seasonSettings
                settings.practices = practices.filter(p => String(p.id) !== String(singlePractice.id));
                // Remove from seasonSettingsDraft if it exists
                if (seasonSettingsDraft) {
                    seasonSettingsDraft.practices = seasonSettingsDraft.practices.filter(p => String(p.id) !== String(singlePractice.id));
                }
                // Remove from original states
                originalPracticeStates.delete(String(singlePractice.id));
                // Re-render practice rows to reflect deletion
                renderPracticeRows('practice-rows');
                renderPracticeRows('practice-rows-modal');
                // Save season settings to persist single practice deletion
                saveData();
            }
            
            // Save ride deletion to Supabase (will create if new, update if existing)
            console.log('🗑️ deletePracticeFromContext: Saving deleted ride to Supabase, id', ride.id, 'date', contextMenuDate, 'deleted:', ride.deleted);
            await saveRideToDB(ride);
            console.log('🗑️ deletePracticeFromContext: Saved deleted ride to Supabase, id', ride.id);
            
            renderAllCalendars();
            document.getElementById('practice-context-menu').style.display = 'none';
        }

        function cancelPracticeFromContext() {
            if (!contextMenuDate) return;
            
            // Preserve the date before the context menu auto-close timeout clears it
            cancelPracticeTargetDate = contextMenuDate;

            // Clear the auto-close timeout so it doesn't null out contextMenuDate
            if (contextMenuTimeout) {
                clearTimeout(contextMenuTimeout);
                contextMenuTimeout = null;
            }

            const modal = document.getElementById('cancel-practice-modal');
            if (modal) {
                modal.classList.add('visible');
                modal.setAttribute('aria-hidden', 'false');
                document.getElementById('practice-context-menu').style.display = 'none';
            }
        }

        function closeCancelPracticeModal() {
            const modal = document.getElementById('cancel-practice-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
            }
            cancelPracticeTargetDate = null;
        }

        function openClonePracticeModal() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No practice selected.');
                return;
            }
            if (ride.cancelled) {
                alert('Cannot clone to a cancelled practice.');
                return;
            }
            if (ride.groups && ride.groups.length > 0) {
                alert('Cannot clone when groups are already assigned. Please clear assignments first.');
                return;
            }

            const modal = document.getElementById('clone-practice-modal');
            const listContainer = document.getElementById('clone-practice-list');
            if (!modal || !listContainer) return;

            const currentDate = parseISODate(ride.date);
            if (!currentDate) {
                alert('Invalid practice date.');
                return;
            }

            // Get all practices with groups assigned (excluding current practice)
            const allRides = (data.rides || [])
                .filter(r => {
                    if (!r.date || r.deleted || r.cancelled) return false;
                    if (r.id === ride.id) return false; // Exclude current practice
                    if (!r.groups || r.groups.length === 0) return false; // Only practices with groups
                    return true;
                })
                .map(r => ({
                    ride: r,
                    date: parseISODate(r.date)
                }))
                .filter(r => r.date)
                .sort((a, b) => b.date - a.date); // Most recent first

            if (allRides.length === 0) {
                listContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No other practices with group assignments found.</p>';
            } else {
                listContainer.innerHTML = allRides.map(({ ride: sourceRide, date: sourceDate }) => {
                    const dateStr = sourceDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    const groupCount = sourceRide.groups ? sourceRide.groups.length : 0;
                    const riderCount = sourceRide.availableRiders ? sourceRide.availableRiders.length : 0;
                    const coachCount = sourceRide.availableCoaches ? sourceRide.availableCoaches.length : 0;
                    return `
                        <button class="btn-small" onclick="cloneEntirePractice(${sourceRide.id})" style="text-align: left; padding: 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; transition: background 0.2s;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${dateStr}</div>
                            <div style="font-size: 12px; color: #666;">${groupCount} group${groupCount !== 1 ? 's' : ''}, ${riderCount} rider${riderCount !== 1 ? 's' : ''}, ${coachCount} coach${coachCount !== 1 ? 'es' : ''}</div>
                        </button>
                    `;
                }).join('');
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeClonePracticeModal() {
            const modal = document.getElementById('clone-practice-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
            }
        }

        function cloneEntirePractice(sourceRideId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No practice selected.');
                return;
            }
            if (ride.cancelled) {
                alert('Cannot clone to a cancelled practice.');
                return;
            }
            if (ride.groups && ride.groups.length > 0) {
                alert('Cannot clone when groups are already assigned. Please clear assignments first.');
                return;
            }

            const sourceRide = data.rides.find(r => r.id === sourceRideId);
            if (!sourceRide || !sourceRide.groups || sourceRide.groups.length === 0) {
                alert('Source practice not found or has no groups assigned.');
                return;
            }

            // Confirm with user
            const sourceDate = parseISODate(sourceRide.date);
            const sourceDateStr = sourceDate ? sourceDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : sourceRide.date;
            const currentDate = parseISODate(ride.date);
            const currentDateStr = currentDate ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ride.date;
            
            if (!confirm(`Clone entire practice from ${sourceDateStr} to ${currentDateStr}?\n\nThis will:\n- Copy all groups and assignments\n- Override attendance settings (riders and coaches) from the source practice\n- Copy routes from the source practice`)) {
                return;
            }

            // Clone attendance settings (override current practice's attendance)
            ride.availableCoaches = sourceRide.availableCoaches ? [...sourceRide.availableCoaches] : [];
            ride.availableRiders = sourceRide.availableRiders ? [...sourceRide.availableRiders] : [];

            // Deep clone groups (create new group objects to avoid reference issues)
            ride.groups = sourceRide.groups.map(sourceGroup => {
                const newGroup = createGroup(sourceGroup.label);
                
                // Copy riders (use all riders from source group)
                newGroup.riders = sourceGroup.riders ? [...sourceGroup.riders] : [];
                
                // Copy coaches
                if (sourceGroup.coaches) {
                    if (sourceGroup.coaches.leader) {
                        newGroup.coaches.leader = sourceGroup.coaches.leader;
                    }
                    if (sourceGroup.coaches.sweep) {
                        newGroup.coaches.sweep = sourceGroup.coaches.sweep;
                    }
                    if (sourceGroup.coaches.roam) {
                        newGroup.coaches.roam = sourceGroup.coaches.roam;
                    }
                    if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                        newGroup.coaches.extraRoam = [...sourceGroup.coaches.extraRoam];
                    }
                }
                
                // Copy other group properties including routeId
                newGroup.routeId = sourceGroup.routeId || null;
                newGroup.sortBy = sourceGroup.sortBy;
                
                return newGroup;
            });

            // Close modal
            closeClonePracticeModal();

            // Save and render
            saveRideToDB(ride);
            renderAssignments(ride);

            // Show the More/Fewer Groups buttons
            const moreGroupsBtn = document.getElementById('more-groups-btn');
            const fewerGroupsBtn = document.getElementById('fewer-groups-btn');
            if (moreGroupsBtn) moreGroupsBtn.style.display = '';
            if (fewerGroupsBtn) fewerGroupsBtn.style.display = '';
        }

        async function confirmCancelPractice() {
            const targetDate = cancelPracticeTargetDate || contextMenuDate;
            if (!targetDate) return;
            
            const reason = document.getElementById('cancel-reason').value;
            if (!reason) return;
            
            // Find or create ride
            let ride = data.rides.find(r => r.date === targetDate && !r.deleted);
            if (!ride) {
                ride = {
                    id: generateId(),
                    date: targetDate,
                    availableCoaches: [],
                    availableRiders: [],
                    assignments: {},
                    groups: []
                };
                data.rides.push(ride);
            }
            
            ride.cancelled = true;
            ride.cancellationReason = reason;
            
            // Save ride state to Supabase
            await saveRideToDB(ride);
            
            cancelPracticeTargetDate = null;
            closeCancelPracticeModal();
            renderAllCalendars();
        }

        function getDefaultPracticeForDate(dateStr) {
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            const date = parseISODate(dateStr);
            if (!date) return {};
            const iso = formatDateToISO(date);
            // Specific date takes priority
            const specific = practices.find(p => p.specificDate === iso);
            if (specific) return { time: specific.time || '', endTime: specific.endTime || '', meetLocation: specific.meetLocation || '' };
            // Fallback to day-of-week recurring
            const dow = date.getDay();
            const recurring = practices.find(p => p.dayOfWeek === dow);
            if (recurring) return { time: recurring.time || '', endTime: recurring.endTime || '', meetLocation: recurring.meetLocation || '' };
            return {};
        }

        function reschedulePracticeFromContext() {
            if (!contextMenuDate) return;
            
            // Remove the context menu's document click listener so it doesn't intercept clicks inside the modal (e.g. Reschedule button)
            if (contextMenuCloseHandler) {
                document.removeEventListener('click', contextMenuCloseHandler);
                contextMenuCloseHandler = null;
            }
            if (contextMenuTimeout) {
                clearTimeout(contextMenuTimeout);
                contextMenuTimeout = null;
            }
            
            // Find existing ride to get current values (include cancelled), or the original if rescheduled
            let ride = data.rides.find(r => r.date === contextMenuDate && !r.deleted);
            if (!ride) {
                ride = data.rides.find(r => r.rescheduledFrom === contextMenuDate && !r.deleted);
            }
            const defaults = getDefaultPracticeForDate(contextMenuDate);
            
            const modal = document.getElementById('reschedule-practice-modal');
            if (modal) {
                // Pre-fill with current values
                document.getElementById('reschedule-date').value = contextMenuDate;
                document.getElementById('reschedule-time').value = ride ? (ride.time || defaults.time || '') : (defaults.time || '');
                document.getElementById('reschedule-end-time').value = ride ? (ride.endTime || defaults.endTime || '') : (defaults.endTime || '');
                document.getElementById('reschedule-location').value = ride ? (ride.meetLocation || defaults.meetLocation || '') : (defaults.meetLocation || '');
                
                // Blur the context menu button so focus is not retained on a hidden element; avoids aria-hidden + focused descendant
                document.activeElement && document.activeElement.blur();
                document.getElementById('practice-context-menu').style.display = 'none';
                // Set aria-hidden false before showing so the modal is not hidden when focus moves into it
                modal.setAttribute('aria-hidden', 'false');
                modal.classList.add('visible');
                // Move focus into the modal so it's not on an aria-hidden ancestor
                requestAnimationFrame(() => {
                    const firstFocusable = modal.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
                    if (firstFocusable) firstFocusable.focus();
                });
            }
        }

        function closeReschedulePracticeModal() {
            const modal = document.getElementById('reschedule-practice-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
            }
        }

        async function confirmReschedulePractice() {
            if (!contextMenuDate) return;
            
            const newDate = document.getElementById('reschedule-date').value;
            const newTime = document.getElementById('reschedule-time').value;
            const newEndTime = document.getElementById('reschedule-end-time').value;
            const newLocation = document.getElementById('reschedule-location').value;
            
            if (!newDate) {
                alert('Please select a new date.');
                return;
            }
            
            // Parse contextMenuDate - it might be in ISO format already or a date string
            const originalDateParsed = parseISODate(contextMenuDate) || new Date(contextMenuDate);
            const originalDateKey = formatDateToISO(originalDateParsed);
            const newDateParsed = parseISODate(newDate);
            if (!newDateParsed) {
                alert('Invalid date selected.');
                return;
            }
            const newDateKey = formatDateToISO(newDateParsed);
            
            // Find existing ride on the original date (including those already rescheduled from this date)
            let ride = data.rides.find(r => r.date === originalDateKey && !r.deleted);
            
            // Also check if there's already a ride rescheduled from this date
            if (!ride) {
                ride = data.rides.find(r => r.rescheduledFrom === originalDateKey && !r.deleted);
            }
            
            if (!ride) {
                // If no ride exists, try to find one on a scheduled practice day for this date
                // This handles cases where we're rescheduling a practice that was auto-generated
                const originalDateObj = parseISODate(originalDateKey);
                if (originalDateObj) {
                    const weekday = originalDateObj.getDay();
                    const settings = data.seasonSettings || {};
                    const practices = Array.isArray(settings.practices) ? settings.practices : [];
                    const hasScheduledPractice = practices.some(p => p.dayOfWeek === weekday);
                    
                    if (hasScheduledPractice) {
                        // Create a new ride for rescheduling
                        ride = {
                            id: generateId(),
                            date: originalDateKey,
                            availableCoaches: [],
                            availableRiders: [],
                            assignments: {},
                            groups: [],
                            goals: '',
                            cancelled: false
                        };
                        data.rides.push(ride);
                    } else {
                        alert('No practice found on this date to reschedule.');
                        return;
                    }
                } else {
                    alert('Invalid date selected.');
                    return;
                }
            }
            
            // Check if there's already a ride on the new date
            const existingRideOnNewDate = data.rides.find(r => r.date === newDateKey && !r.deleted && r.id !== ride.id);
            if (existingRideOnNewDate) {
                // Merge data into existing ride
                existingRideOnNewDate.rescheduledFrom = originalDateKey;
                if (newTime) existingRideOnNewDate.time = newTime;
                if (newEndTime) existingRideOnNewDate.endTime = newEndTime;
                if (newLocation) existingRideOnNewDate.meetLocation = newLocation;
                // Preserve other fields from the original ride
                if (ride.availableCoaches) existingRideOnNewDate.availableCoaches = ride.availableCoaches;
                if (ride.availableRiders) existingRideOnNewDate.availableRiders = ride.availableRiders;
                if (ride.groups) existingRideOnNewDate.groups = ride.groups;
                if (ride.goals) existingRideOnNewDate.goals = ride.goals;
                
                // Mark original ride as deleted
                ride.deleted = true;
                ride = existingRideOnNewDate;
            } else {
                // Store original date for tracking (simpler approach: no tombstone; calendar hides original via rescheduledFrom)
                ride.rescheduledFrom = originalDateKey;
                // Update to new date and values
                ride.date = newDateKey;
                if (newTime) ride.time = newTime;
                if (newEndTime) ride.endTime = newEndTime;
                if (newLocation) ride.meetLocation = newLocation;
            }
            
            // Mark any other rides on the original date as deleted
            const ridesToUpdate = [];
            data.rides.forEach(r => {
                if (r.date === originalDateKey && !r.deleted && r.id !== ride.id) {
                    r.deleted = true;
                    ridesToUpdate.push(r);
                }
            });
            
            // Save all modified rides to Supabase
            await saveRideToDB(ride);
            if (existingRideOnNewDate) {
                await saveRideToDB(existingRideOnNewDate);
            }
            for (const r of ridesToUpdate) {
                await saveRideToDB(r);
            }
            
            closeReschedulePracticeModal();
            document.activeElement?.blur(); // Fix aria-hidden warning
            renderAllCalendars();
            renderRides();
            
            // Update current ride if we just rescheduled it
            if (data.currentRide && data.rides.find(r => r.id === data.currentRide && !r.deleted)) {
                loadCurrentRide();
            }
        }

        async function restoreCancelledPractice() {
            if (!contextMenuDate) return;
            const ride = data.rides.find(r => r.date === contextMenuDate && !r.deleted && (r.cancelled || r.rescheduledFrom));
            if (ride) {
                if (ride.rescheduledFrom) {
                    const originalDateKey = String(ride.rescheduledFrom).substring(0, 10);
                    ride.date = originalDateKey;
                    ride.rescheduledFrom = null;
                    const tombstones = (data.rides || []).filter(r => r.date && String(r.date).substring(0, 10) === originalDateKey && r.deleted);
                    for (const t of tombstones) {
                        data.rides.splice(data.rides.indexOf(t), 1);
                        if (typeof deleteRide === 'function') {
                            try { await deleteRide(t.id); } catch (e) { console.error('Error deleting tombstone:', e); }
                        }
                    }
                    await saveRideToDB(ride);
                } else {
                    ride.cancelled = false;
                    ride.cancellationReason = '';
                    await saveRideToDB(ride);
                }
                renderAllCalendars();
                renderRides();
            }
            document.getElementById('practice-context-menu').style.display = 'none';
        }

        function updatePracticeNavigation() {
            const priorBtn = document.getElementById('prior-practice-btn');
            const nextBtn = document.getElementById('next-practice-btn');

            if (!priorBtn || !nextBtn) return;

            const currentRide = data.rides.find(r => r.id === data.currentRide);
            if (!currentRide) return;

            const rescheduledOriginalDates = new Set();
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.rescheduledFrom && !ride.deleted) {
                        const originalDateKey = typeof ride.rescheduledFrom === 'string'
                            ? ride.rescheduledFrom
                            : formatDateToISO(parseISODate(ride.rescheduledFrom));
                        if (originalDateKey) rescheduledOriginalDates.add(originalDateKey);
                    }
                });
            }

            const allRides = (data.rides || [])
                .filter(r => {
                    if (!r.date || r.deleted) return false;
                    const dateKey = formatDateToISO(parseISODate(r.date));
                    if (rescheduledOriginalDates.has(dateKey) && !r.rescheduledFrom) return false;
                    return true;
                })
                .map(r => ({ id: r.id, date: parseISODate(r.date) }))
                .filter(r => r.date)
                .sort((a, b) => a.date - b.date);

            const currentIndex = allRides.findIndex(r => r.id === data.currentRide);
            const hasPrior = currentIndex > 0;
            const hasNext  = currentIndex >= 0 && currentIndex < allRides.length - 1;

            priorBtn.disabled     = !hasPrior;
            priorBtn.style.opacity = hasPrior ? '1' : '0.4';
            priorBtn.style.cursor  = hasPrior ? 'pointer' : 'not-allowed';

            nextBtn.disabled     = !hasNext;
            nextBtn.style.opacity = hasNext ? '1' : '0.4';
            nextBtn.style.cursor  = hasNext ? 'pointer' : 'not-allowed';
        }
        
        function toggleGroupAssignments() {
            const content = document.getElementById('group-assignments-content');
            const arrow = document.getElementById('group-assignments-arrow');
            if (!content || !arrow) return;
            
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            arrow.textContent = isVisible ? '▼' : '▲';
        }

        function navigateToPriorPractice() {
            // Build a set of original dates that have been rescheduled (to exclude them)
            const rescheduledOriginalDates = new Set();
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.rescheduledFrom && !ride.deleted) {
                        const originalDateKey = typeof ride.rescheduledFrom === 'string' 
                            ? ride.rescheduledFrom 
                            : formatDateToISO(parseISODate(ride.rescheduledFrom));
                        if (originalDateKey) {
                            rescheduledOriginalDates.add(originalDateKey);
                        }
                    }
                });
            }
            
            const allRides = (data.rides || [])
                .filter(r => {
                    // Exclude deleted practices
                    if (!r.date || r.deleted) return false;
                    // Exclude planner-excluded practices
                    if (isRideDateExcludedFromPlanner(r.date)) return false;
                    
                    // Exclude rescheduled practices on their original date
                    const dateKey = formatDateToISO(parseISODate(r.date));
                    if (rescheduledOriginalDates.has(dateKey) && !r.rescheduledFrom) {
                        return false;
                    }
                    
                    return true;
                })
                .map(r => ({ id: r.id, date: parseISODate(r.date) }))
                .filter(r => r.date)
                .sort((a, b) => a.date - b.date);
            
            let currentIndex = allRides.findIndex(r => r.id === data.currentRide);
            if (currentIndex === -1 && allRides.length > 0) {
                const curRide = data.rides.find(r => r.id === data.currentRide);
                const curDate = curRide ? parseISODate(curRide.date) : null;
                if (curDate) {
                    for (let i = allRides.length - 1; i >= 0; i--) {
                        if (allRides[i].date < curDate) { currentIndex = i + 1; break; }
                    }
                    if (currentIndex === -1) currentIndex = 0;
                }
            }
            if (currentIndex > 0) {
                data.currentRide = allRides[currentIndex - 1].id;
                saveData();
                loadCurrentRide();
            }
        }

        function navigateToNextPractice() {
            const rescheduledOriginalDates = new Set();
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.rescheduledFrom && !ride.deleted) {
                        const originalDateKey = typeof ride.rescheduledFrom === 'string' 
                            ? ride.rescheduledFrom 
                            : formatDateToISO(parseISODate(ride.rescheduledFrom));
                        if (originalDateKey) {
                            rescheduledOriginalDates.add(originalDateKey);
                        }
                    }
                });
            }
            
            const allRides = (data.rides || [])
                .filter(r => {
                    if (!r.date || r.deleted) return false;
                    if (isRideDateExcludedFromPlanner(r.date)) return false;
                    const dateKey = formatDateToISO(parseISODate(r.date));
                    if (rescheduledOriginalDates.has(dateKey) && !r.rescheduledFrom) {
                        return false;
                    }
                    return true;
                })
                .map(r => ({ id: r.id, date: parseISODate(r.date) }))
                .filter(r => r.date)
                .sort((a, b) => a.date - b.date);
            
            let currentIndex = allRides.findIndex(r => r.id === data.currentRide);
            if (currentIndex === -1 && allRides.length > 0) {
                const curRide = data.rides.find(r => r.id === data.currentRide);
                const curDate = curRide ? parseISODate(curRide.date) : null;
                if (curDate) {
                    currentIndex = -1;
                    for (let i = 0; i < allRides.length; i++) {
                        if (allRides[i].date > curDate) { currentIndex = i - 1; break; }
                    }
                    if (currentIndex === -1) currentIndex = allRides.length - 1;
                }
            }
            if (currentIndex >= 0 && currentIndex < allRides.length - 1) {
                data.currentRide = allRides[currentIndex + 1].id;
                saveData();
                loadCurrentRide();
            }
        }

        function loadCurrentRide() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                document.getElementById('current-ride').style.display = 'none';
                const navSection = document.getElementById('practice-navigation');
                if (navSection) navSection.style.display = 'none';
                // Clear history when no ride is selected
                clearAssignmentHistory();
                return;
            }
            
            // Clear undo/redo history when loading a new ride
            clearAssignmentHistory();
            
            // Save initial state so first undo works
            saveAssignmentState(ride);
            
            // Ensure default attendance selection for this practice
            ensureRideAttendanceDefaults(ride);
            
            document.getElementById('current-ride').style.display = 'block';
            const rideDate = parseISODate(ride.date);
            const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ride.date;
            document.getElementById('ride-title').textContent = dateDisplay;
            
            const backBtn = document.getElementById('practice-planner-back-btn');
            if (backBtn) backBtn.style.display = USE_PRACTICE_PLANNER_LANDING ? '' : 'none';
            
            // Persist last-opened practice so it reopens for this session and other users
            persistLastOpenedRide();
            
            // Sync meetLocation from practice settings if not set on ride
            if (!ride.meetLocation && ride.date) {
                const settings = data.seasonSettings || {};
                const practices = Array.isArray(settings.practices) ? settings.practices : [];
                const rideDateObj = parseISODate(ride.date);
                if (rideDateObj) {
                    const weekday = rideDateObj.getDay();
                    const matchedPractice = practices.find(p => p.dayOfWeek === weekday);
                    if (matchedPractice && matchedPractice.meetLocation) {
                        ride.meetLocation = matchedPractice.meetLocation;
                        ride.locationLat = matchedPractice.locationLat || null;
                        ride.locationLng = matchedPractice.locationLng || null;
                        saveRideToDB(ride);
                    }
                }
            }
            
            // Display location and time inline after the date
            const rideDetails = document.getElementById('ride-details');
            if (rideDetails) {
                const parts = [];
                const meetLocation = ride.meetLocation || '';
                if (meetLocation.trim()) {
                    parts.push(meetLocation.trim());
                }
                // Fall back to practice settings for time if ride has none
                let startTime = ride.startTime || ride.time || '';
                let endTime = ride.endTime || '';
                if (!startTime && ride.date) {
                    const settings = data.seasonSettings || {};
                    const practices = Array.isArray(settings.practices) ? settings.practices : [];
                    const rideDateObj = parseISODate(ride.date);
                    if (rideDateObj) {
                        const weekday = rideDateObj.getDay();
                        const matchedPractice = practices.find(p => p.dayOfWeek === weekday);
                        if (matchedPractice) {
                            startTime = matchedPractice.time || matchedPractice.startTime || '';
                            if (!endTime) endTime = matchedPractice.endTime || '';
                        }
                    }
                }
                if (startTime) {
                    const formattedStart = formatTimeForDisplay(startTime);
                    if (endTime) {
                        const formattedEnd = formatTimeForDisplay(endTime);
                        parts.push(`${formattedStart} – ${formattedEnd}`);
                    } else {
                        parts.push(formattedStart);
                    }
                }
                rideDetails.textContent = parts.length > 0 ? parts.join(' • ') : '';
            }
            
            // Ensure group assignments section is visible (no longer collapsible)
            const groupContent = document.getElementById('group-assignments-content');
            if (groupContent) {
                groupContent.style.display = 'block';
            }
            
            // Show sidebars for practice planner
            showSidebars();
            
            // Load practice goals
            const goalsInput = document.getElementById('practice-goals');
            if (goalsInput) {
                goalsInput.value = ride.goals || '';
            }
            
            // Update button based on cancellation status
            const cancelButton = document.getElementById('cancel-practice-btn');
            if (cancelButton) {
                if (ride.cancelled) {
                    cancelButton.textContent = 'Reinstate Practice';
                    cancelButton.className = 'btn-small';
                    cancelButton.style.backgroundColor = '#4CAF50';
                    cancelButton.style.color = '#ffffff';
                    cancelButton.style.borderColor = '#4CAF50';
                    cancelButton.onclick = reinstatePractice;
                } else {
                    cancelButton.textContent = 'Cancel Practice';
                    cancelButton.className = 'danger btn-small';
                    cancelButton.style.backgroundColor = '';
                    cancelButton.style.color = '';
                    cancelButton.style.borderColor = '';
                    cancelButton.onclick = deleteCurrentRide;
                }
            }
            
            // Disable toolbar action buttons if practice is cancelled
            const toolbarBtns = document.querySelectorAll('#practice-banner-toolbar .btn-small');
            if (ride.cancelled) {
                toolbarBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                });
            } else {
                toolbarBtns.forEach(btn => {
                    if (!btn.id || (btn.id !== 'undo-btn' && btn.id !== 'redo-btn')) {
                        btn.disabled = false;
                        btn.style.opacity = '';
                        btn.style.cursor = '';
                    }
                });
            }
            
            if (!ride.cancelled) {
            renderAssignments(ride);
            } else {
                // Show message that practice is cancelled
                const assignmentsContainer = document.getElementById('assignments');
                if (assignmentsContainer) {
                    assignmentsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #757575;"><p style="font-size: 16px; margin: 0;">This practice has been cancelled.</p><p style="font-size: 14px; margin: 10px 0 0 0;">Assignments are not available for cancelled practices.</p></div>';
                }
                // Update buttons even for cancelled rides
                updatePublishButtons();
            }

            updatePracticeNavigation();
        }

        function setAllCoaches(selectAll) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            if (selectAll) {
                ride.availableCoaches = Array.from(new Set(data.coaches.map(coach => coach.id)));
            } else {
                ride.availableCoaches = [];
                if (!Array.isArray(ride.groups)) {
                    ride.groups = [];
                }
                ride.groups.forEach(group => {
                    group.coaches.leader = null;
                    group.coaches.sweep = null;
                    group.coaches.roam = null;
                    group.coaches.extraRoam = [];
                    group.riders = [];
                    group.fitnessTag = null;
                });
            }

            saveData();
            renderAssignments(ride);
        }

        function setAllRiders(selectAll) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            if (selectAll) {
                // For refined rides, only select filtered riders; for regular rides, select all
                const isRefined = isRideRefined(ride);
                if (isRefined) {
                    ride.availableRiders = getFilteredRiderIdsForRide(ride);
                } else {
                    ride.availableRiders = data.riders ? data.riders.map(r => r.id) : [];
                }
            } else {
                ride.availableRiders = [];
                if (!Array.isArray(ride.groups)) {
                    ride.groups = [];
                }
                ride.groups.forEach(group => {
                    group.riders = [];
                    group.fitnessTag = null;
                });
            }

            saveData();
            renderAssignments(ride);
        }

        // This function is deprecated - use toggleCoachAvailability(coachId, isAvailable) instead

        // Old toggleRiderAvailability function removed - using the newer version below that doesn't remove riders from groups

        function deleteCurrentRide() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            ride.cancelled = true;
            saveData();
            renderRides();
            loadCurrentRide();
        }

        function reinstatePractice() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            ride.cancelled = false;
            saveData();
            renderRides();
            loadCurrentRide();
        }

        function permanentlyDeleteCurrentRide() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No practice selected to delete.');
                return;
            }
            
            const rideDate = ride.date ? parseISODate(ride.date) : null;
            const dateDisplay = rideDate 
                ? rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : 'this practice';
            
            if (!confirm(`Are you sure you want to permanently delete the practice on ${dateDisplay}?\n\nThis will remove it from the calendar and cannot be undone.`)) {
                return;
            }
            
            // Mark the ride as deleted instead of removing it (so it stays in exception list)
            ride.deleted = true;
            
            // Clear current ride selection
            data.currentRide = null;
            hideSidebars();
            
            saveData();
            renderRides();
            renderAllCalendars();
            
            // Hide the current ride section
            const currentRideSection = document.getElementById('current-ride');
            if (currentRideSection) {
                currentRideSection.style.display = 'none';
            }
        }

        // Helper function to validate requirements
        function validateRequirements(availableCoaches, availableRiders, debugLines) {
            const requirements = getRequirements();
            
            for (const req of requirements) {
                if (req.id === 'ridersPerCoach') {
                    const ridersPerCoach = req.value || 6;
                    const totalCapacity = availableCoaches.length * ridersPerCoach;
                    if (availableRiders.length > totalCapacity) {
                        const errorMsg = `Not enough coaches to meet requirement: ${availableRiders.length} riders need ${Math.ceil(availableRiders.length / ridersPerCoach)} coaches (at ${ridersPerCoach} riders per coach), but only ${availableCoaches.length} coaches available.`;
                        debugLines.push(`❌ Requirement validation failed: ${errorMsg}`);
                        alert(errorMsg);
                        return false;
                    }
                    debugLines.push(`✓ Requirement 1 (Riders per Coach): ${availableRiders.length} riders can be accommodated by ${availableCoaches.length} coaches (capacity: ${totalCapacity})`);
                } else if (req.id === 'minLeaderLevel') {
                    const minLeaderLevel = req.value || 2;
                    const leaders = availableCoaches.filter(coach => {
                        const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                        const level = parseInt(levelRaw, 10);
                        return Number.isFinite(level) && level >= minLeaderLevel;
                    });
                    if (leaders.length === 0) {
                        const errorMsg = `Not enough qualifying coaches to meet minimum requirements: Need at least one Level ${minLeaderLevel}+ coach, but none available.`;
                        debugLines.push(`❌ Requirement validation failed: ${errorMsg}`);
                        alert(errorMsg);
                        return false;
                    }
                    const ridersPerLeader = Math.ceil(availableRiders.length / leaders.length);
                    const ridersPerCoach = getAutoAssignSetting('ridersPerCoach', 6);
                    if (ridersPerLeader > ridersPerCoach * 2) { // Allow some flexibility, but warn if way over
                        debugLines.push(`⚠️ Warning: Dividing ${availableRiders.length} riders among ${leaders.length} Level ${minLeaderLevel}+ leaders results in ~${ridersPerLeader} riders per leader, which may exceed capacity.`);
                    }
                    debugLines.push(`✓ Requirement 2 (Minimum Leader Level): ${leaders.length} Level ${minLeaderLevel}+ coaches available for ${availableRiders.length} riders (~${ridersPerLeader} riders per leader)`);
                }
            }
            return true;
        }
        
        // Auto-assignment algorithm - SEQUENTIAL REQUIREMENT-BASED VERSION
        function autoGenerateFromPlanner() {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride) return;
            if (ride.groups && ride.groups.length > 0) {
                if (!confirm('Auto-generating groups will replace all current groups and their rider/coach assignments. Continue?')) return;
            }
            autoAssign();
        }

        async function autoAssign(targetNumGroups = null) {
            try {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (!ride) {
                    alert('No practice selected.');
                    return;
                }
                if (ride.cancelled) {
                    alert('Cannot assign riders and coaches to a cancelled practice.');
                    return;
                }

                clearGroupResizeMemory(ride.id);

                // Save state before autofill (allows undo of autofill)
                saveAssignmentState(ride);
                
                // Clear history after autofill (autofill is a major operation, start fresh history)
                // But first save the state above so autofill itself can be undone

                const debugLines = [];
                debugLines.push(`=== AUTO-ASSIGN RUN AT ${new Date().toLocaleString()} ===`);
                debugLines.push('');

                // CRITICAL: Re-read the ride object from data.rides to ensure we have the latest state
                // This is important because saveRideToDB is async and might have updated data.rides
                const rideId = data.currentRide;
                const currentRide = data.rides.find(r => r.id === rideId);
                if (currentRide && currentRide !== ride) {
                    console.log('🔴 AUTO-ASSIGN: Found updated ride object in data.rides, using it instead');
                    Object.assign(ride, currentRide); // Merge latest state into our ride reference
                }

                // STEP 1 & 2: For refined rides, select only riders that qualify under the filter
                // For regular rides, default to all riders selected
                const totalRidersInRoster = data.riders ? data.riders.length : 0;
                const isRefined = isRideRefined(ride);
                console.log('🔴 AUTO-ASSIGN: Initial check - ride.availableRiders:', {
                    isArray: Array.isArray(ride.availableRiders),
                    length: ride.availableRiders?.length,
                    totalRidersInRoster,
                    rideId: ride.id,
                    isRefined: isRefined
                });
                
                // Ensure availableRiders is an array
                if (!Array.isArray(ride.availableRiders)) {
                    ride.availableRiders = [];
                }
                
                // Auto-initialize empty arrays based on whether refined
                if (ride.availableRiders.length === 0) {
                    if (isRefined) {
                        // STEP 2: For refined rides, select all riders that qualify under the filter
                        const filteredRiderIds = getFilteredRiderIdsForRide(ride);
                        console.log('🔴 AUTO-ASSIGN: ride.availableRiders is empty on REFINED ride - initializing with', filteredRiderIds.length, 'filtered riders');
                        debugLines.push(`⚠️ Refined ride with empty availableRiders - initialized with ${filteredRiderIds.length} filtered riders`);
                        ride.availableRiders = filteredRiderIds;
                        // CRITICAL: Update both the ride reference AND the ride in data.rides array
                        const rideIndex = data.rides.findIndex(r => r.id === rideId);
                        if (rideIndex !== -1) {
                            data.rides[rideIndex].availableRiders = ride.availableRiders;
                        }
                        // Save the reset to persist it
                        saveRideToDB(ride);
                    } else if (totalRidersInRoster > 0) {
                        // Regular ride - initialize with all riders
                        console.log('🔴 AUTO-ASSIGN: ride.availableRiders is empty on regular ride - initializing with all', totalRidersInRoster, 'riders');
                        debugLines.push(`⚠️ ride.availableRiders was empty on regular ride - initialized with all ${totalRidersInRoster} riders`);
                        ride.availableRiders = data.riders.map(r => r.id);
                        // CRITICAL: Update both the ride reference AND the ride in data.rides array
                        const rideIndex = data.rides.findIndex(r => r.id === rideId);
                        if (rideIndex !== -1) {
                            data.rides[rideIndex].availableRiders = ride.availableRiders;
                        }
                        // Save the reset to persist it
                        saveRideToDB(ride);
                    }
                    console.log('🔴 AUTO-ASSIGN: After initialization - ride.availableRiders:', {
                        length: ride.availableRiders.length,
                        first10: ride.availableRiders.slice(0, 10)
                    });
                } else {
                    console.log('🔴 AUTO-ASSIGN: ride.availableRiders already has', ride.availableRiders.length, 'riders, skipping initialization');
                }

                // Get available coaches and riders
                // IMPORTANT: Only use coaches explicitly marked as available in attendance list
                // Filter out coaches with "N/A" level as they are not eligible
                if (!Array.isArray(ride.availableCoaches)) {
                    ride.availableCoaches = [];
                }
                debugLines.push('=== DEBUG: COACH ATTENDANCE CHECK ===');
                debugLines.push(`ride.availableCoaches array length: ${ride.availableCoaches.length}`);
                debugLines.push(`ride.availableCoaches IDs: ${ride.availableCoaches ? ride.availableCoaches.join(', ') : 'none'}`);
                debugLines.push('');

                // First, get all coaches from the availableCoaches list
                console.log('🔴 AUTO-ASSIGN: ride.availableCoaches:', ride.availableCoaches, 'Types:', ride.availableCoaches?.map(id => typeof id));
                const allAvailableCoaches = ride.availableCoaches
                    .map(id => {
                        const coach = getCoachById(id);
                        if (!coach) {
                            console.warn('🔴 AUTO-ASSIGN: Coach ID not found:', id, 'Type:', typeof id);
                            debugLines.push(`  ⚠️ Coach ID ${id} not found in database`);
                            return null;
                        }
                        console.log('🔴 AUTO-ASSIGN: Found coach:', coach.name, 'ID:', coach.id, 'ID Type:', typeof coach.id, 'Lookup ID:', id, 'Lookup ID Type:', typeof id);
                        return coach;
                    })
                    .filter(Boolean);
                console.log('🔴 AUTO-ASSIGN: allAvailableCoaches count:', allAvailableCoaches.length);

                // Filter out coaches with "N/A" level - these should not be in attendance list
                const availableCoaches = allAvailableCoaches.filter(coach => {
                    const levelRaw = coach.coachingLicenseLevel || coach.level || 'N/A';
                    const level = levelRaw.toString().toUpperCase();
                    // Exclude coaches with N/A, NA, or empty level
                    const isValid = level !== 'N/A' && level !== 'NA' && level !== '' && level !== 'NULL' && level !== 'UNDEFINED';
                    if (!isValid) {
                        debugLines.push(`  ⚠️ Excluding ${coach.name || 'Coach'} (ID: ${coach.id}) - Level is ${levelRaw} (not eligible)`);
                    }
                    return isValid;
                });
                
                // Normalize IDs for consistency
                console.log('🔴 AUTO-ASSIGN: ride.availableRiders BEFORE normalization:', {
                    length: ride.availableRiders.length,
                    first10: ride.availableRiders.slice(0, 10),
                    allTypes: ride.availableRiders.slice(0, 10).map(id => typeof id)
                });
                console.log('🔴 AUTO-ASSIGN: Sample rider IDs from data.riders:', data.riders?.slice(0, 5).map(r => ({ id: r.id, idType: typeof r.id, name: r.name })));
                
                debugLines.push(`=== DEBUG: RIDER ATTENDANCE CHECK ===`);
                debugLines.push(`ride.availableRiders before normalization: ${JSON.stringify(ride.availableRiders?.slice(0, 10))} (showing first 10, total: ${ride.availableRiders?.length || 0})`);
                debugLines.push(`Sample rider IDs from data.riders: ${data.riders?.slice(0, 5).map(r => ({ id: r.id, idType: typeof r.id })).map(r => `${r.id}(${r.idType})`).join(', ') || 'none'}`);
                
                ride.availableRiders = ride.availableRiders.map(id => {
                    const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                    return Number.isFinite(normalized) ? normalized : id;
                });
                
                console.log('🔴 AUTO-ASSIGN: ride.availableRiders AFTER normalization:', {
                    length: ride.availableRiders.length,
                    first10: ride.availableRiders.slice(0, 10),
                    allTypes: ride.availableRiders.slice(0, 10).map(id => typeof id)
                });
                debugLines.push(`ride.availableRiders after normalization: ${JSON.stringify(ride.availableRiders?.slice(0, 10))} (showing first 10)`);
                
                // For refined practices, use filtered riders instead of all availableRiders
                // This ensures autofill only considers the riders that qualify under the refinement filter
                // Note: isRefined was already checked earlier, so we check again here
                let ridersToUse = ride.availableRiders;
                if (isRefined) {
                    const filteredRiderIds = getFilteredRiderIdsForRide(ride);
                    console.log('🔴 AUTO-ASSIGN: Refined practice detected - using filtered riders:', {
                        filteredCount: filteredRiderIds.length,
                        availableRidersCount: ride.availableRiders.length,
                        filteredIds: filteredRiderIds.slice(0, 10)
                    });
                    debugLines.push(`⚠️ Refined practice: Using ${filteredRiderIds.length} filtered riders instead of ${ride.availableRiders.length} available riders`);
                    ridersToUse = filteredRiderIds;
                }
                
                // Use filtered riders for refined practices, or all available riders for regular practices
                console.log('🔴 AUTO-ASSIGN: Looking up riders...');
                const availableRiders = ridersToUse
                    .map(id => {
                        const rider = getRiderById(id);
                        if (!rider) {
                            console.warn(`🔴 AUTO-ASSIGN: Rider ID ${id} (type: ${typeof id}) NOT FOUND in data.riders`);
                            debugLines.push(`  ⚠️ Rider ID ${id} (type: ${typeof id}) not found in data.riders`);
                        } else {
                            console.log(`🔴 AUTO-ASSIGN: Found rider: ${rider.name || 'Unknown'} (ID: ${rider.id}, type: ${typeof rider.id}, lookup ID: ${id}, lookup type: ${typeof id})`);
                        }
                        return rider;
                    })
                    .filter(Boolean);

                console.log('🔴 AUTO-ASSIGN: Final results:', {
                    rideAvailableRidersLength: ride.availableRiders.length,
                    availableRidersAfterLookup: availableRiders.length,
                    totalRidersInRoster: data.riders ? data.riders.length : 0,
                    foundRiders: availableRiders.map(r => ({ id: r.id, name: r.name }))
                });

                debugLines.push(`Available Coaches (before filtering): ${allAvailableCoaches.length}`);
                debugLines.push(`Available Coaches (after filtering out N/A level): ${availableCoaches.length}`);
                debugLines.push(`Available Riders (ride.availableRiders.length): ${ride.availableRiders.length}`);
                debugLines.push(`Riders to use for autofill${isRefined ? ' (refined practice - filtered)' : ''}: ${ridersToUse.length}`);
                debugLines.push(`Available Riders (after lookup): ${availableRiders.length}`);
                debugLines.push(`Total Riders in Roster: ${data.riders ? data.riders.length : 0}`);
                
                // List all eligible available coaches with their details
                debugLines.push('Eligible Available Coaches Details:');
                availableCoaches.forEach((coach, idx) => {
                    const level = coach.coachingLicenseLevel || coach.level || 'N/A';
                    const fitness = getCoachFitnessValue(coach);
                    debugLines.push(`  ${idx + 1}. ${coach.name || 'Coach'} - Level ${level}, End ${fitness}, ID: ${coach.id}`);
                });
                debugLines.push('');

                // Note: Groups can be created without coaches if needed
                if (availableCoaches.length === 0) {
                    debugLines.push('⚠️ Warning: No coaches selected. Groups will be created without coaches.');
                }

                if (availableRiders.length === 0) {
                    alert('Please select available riders first');
                    autoAssignDebugLog = debugLines.concat('❌ Aborted: no riders selected.').join('\n');
                    updateDebugOutput();
                    return;
                }

                // If targetNumGroups is specified (from More/Fewer Groups buttons), only redistribute
                // coaches and riders that are currently assigned to groups. Leave unassigned ones untouched.
                let coachesToRedistribute = availableCoaches;
                let ridersToRedistribute = availableRiders;
                
                if (targetNumGroups !== null && ride.groups && ride.groups.length > 0) {
                    // Track which coaches/riders are currently assigned to groups
                    const assignedCoachIds = new Set();
                    const assignedRiderIds = new Set();
                    
                    ride.groups.forEach(group => {
                        // Track assigned coaches
                        if (group.coaches.leader) assignedCoachIds.add(group.coaches.leader);
                        if (group.coaches.sweep) assignedCoachIds.add(group.coaches.sweep);
                        if (group.coaches.roam) assignedCoachIds.add(group.coaches.roam);
                        if (Array.isArray(group.coaches.extraRoam)) {
                            group.coaches.extraRoam.forEach(id => {
                                if (id) assignedCoachIds.add(id);
                            });
                        }
                        // Track assigned riders
                        if (Array.isArray(group.riders)) {
                            group.riders.forEach(riderId => assignedRiderIds.add(riderId));
                        }
                    });
                    
                    // Only redistribute coaches/riders that are currently assigned
                    coachesToRedistribute = availableCoaches.filter(coach => assignedCoachIds.has(coach.id));
                    ridersToRedistribute = availableRiders.filter(rider => assignedRiderIds.has(rider.id));
                    
                    debugLines.push(`=== RESIZING GROUPS ===`);
                    debugLines.push(`Current groups: ${ride.groups.length}, Target groups: ${targetNumGroups}`);
                    debugLines.push(`Assigned coaches to redistribute: ${coachesToRedistribute.length} of ${availableCoaches.length}`);
                    debugLines.push(`Assigned riders to redistribute: ${ridersToRedistribute.length} of ${availableRiders.length}`);
                    debugLines.push(`Unassigned coaches/riders will remain in unassigned palette`);
                    debugLines.push('');
                }

                // Get settings
                const ridersPerCoach = getAutoAssignSetting('ridersPerCoach', 6);
                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                const preferredCoachesPerGroup = getAutoAssignSetting('preferredCoachesPerGroup', 3);
                const preferredGroupSizeMin = getAutoAssignSettingMin('preferredGroupSize', 4);
                const preferredGroupSizeMax = getAutoAssignSettingMax('preferredGroupSize', 8);
                // These are hardcoded preferences based on the PDF logic
                const avoidOneLeaderGroups = true; // Priority: Avoid 1 Leader Groups
                const noOneLeaderOneRider = true; // Requirement: No 1 Leader group may have only one rider

                debugLines.push('=== SETTINGS ===');
                debugLines.push(`Riders per Coach: ${ridersPerCoach}`);
                debugLines.push(`Minimum Leader Level: ${minLeaderLevel}`);
                debugLines.push(`Preferred Coaches per Group: ${preferredCoachesPerGroup}`);
                debugLines.push(`Preferred Group Size Range: ${preferredGroupSizeMin}-${preferredGroupSizeMax}`);
                debugLines.push(`Avoid 1 Leader Groups: ${avoidOneLeaderGroups}`);
                debugLines.push(`No 1 Leader + 1 Rider: ${noOneLeaderOneRider}`);
                debugLines.push('');

                // STEP 1: Validate Requirements
                debugLines.push('=== STEP 1: VALIDATE REQUIREMENTS ===');
                
                // Get Level 2/3 coaches (eligible leaders) - but not required
                // Use coachesToRedistribute if resizing, otherwise use all availableCoaches
                const coachesForAssignment = targetNumGroups !== null && ride.groups && ride.groups.length > 0 
                    ? coachesToRedistribute 
                    : availableCoaches;
                    
                const eligibleLeaders = coachesForAssignment.filter(coach => {
                    const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                    const level = parseInt(levelRaw, 10);
                    return Number.isFinite(level) && level >= minLeaderLevel;
                });

                debugLines.push(`Level ${minLeaderLevel}+ Coaches (Eligible Leaders): ${eligibleLeaders.length}`);
                debugLines.push(`Note: Groups can be created without leaders if needed.`);
                
                // Calculate possible group counts based on rider count and preferred group size
                // Use ridersToRedistribute if resizing, otherwise use all availableRiders
                const ridersForAssignment = targetNumGroups !== null && ride.groups && ride.groups.length > 0
                    ? ridersToRedistribute
                    : availableRiders;
                    
                const totalRiders = ridersForAssignment.length;
                const minGroups = Math.ceil(totalRiders / preferredGroupSizeMax);
                const maxGroups = Math.floor(totalRiders / preferredGroupSizeMin);
                
                // Also consider coach capacity
                const totalCapacity = availableCoaches.length * ridersPerCoach;
                const maxGroupsByCapacity = Math.floor(totalRiders / preferredGroupSizeMin);
                const actualMaxGroups = Math.min(maxGroups, maxGroupsByCapacity, totalRiders);
                
                debugLines.push(`Possible group counts: ${minGroups} to ${actualMaxGroups} (based on ${totalRiders} riders, preferred size ${preferredGroupSizeMin}-${preferredGroupSizeMax})`);
                
                // Check if compliant groups can be made based on attendance
                // A compliant group means:
                // 1. Group size within preferred range (preferredGroupSizeMin to preferredGroupSizeMax)
                // 2. Has enough coaches for preferred coaches per group
                // 3. Has eligible leaders (if minLeaderLevel > 0)
                // 4. Total capacity sufficient (ridersPerCoach)
                
                let normalGroupCount = 0;
                let canMakeCompliantGroups = false;
                
                // Calculate possible group counts within preferred size range
                const possibleGroupCounts = [];
                for (let numGroups = minGroups; numGroups <= actualMaxGroups; numGroups++) {
                    const avgRidersPerGroup = totalRiders / numGroups;
                    if (avgRidersPerGroup >= preferredGroupSizeMin && avgRidersPerGroup <= preferredGroupSizeMax) {
                        possibleGroupCounts.push(numGroups);
                    }
                }
                
                if (possibleGroupCounts.length === 0) {
                    // Can't make groups within preferred size range
                    canMakeCompliantGroups = false;
                    normalGroupCount = Math.max(1, Math.floor(totalRiders / preferredGroupSizeMin));
                    debugLines.push(`Cannot create groups within preferred size range (${preferredGroupSizeMin}-${preferredGroupSizeMax})`);
                } else {
                    // Check each possible group count to see if we can make compliant groups
                    for (const numGroups of possibleGroupCounts) {
                        const avgRidersPerGroup = totalRiders / numGroups;
                        const coachesNeeded = numGroups * preferredCoachesPerGroup;
                        const totalCapacity = coachesForAssignment.length * ridersPerCoach;
                        
                        // Check if we have enough coaches
                        const hasEnoughCoaches = coachesForAssignment.length >= coachesNeeded;
                        
                        // Check if we have enough eligible leaders (if required)
                        // If minLeaderLevel is 1, all coaches are eligible, so check total coaches
                        // Otherwise, need enough eligible leaders
                        const hasEnoughLeaders = minLeaderLevel === 1 
                            ? coachesForAssignment.length >= numGroups 
                            : eligibleLeaders.length >= numGroups;
                        
                        // Check if total capacity is sufficient
                        const hasEnoughCapacity = totalRiders <= totalCapacity || availableCoaches.length === 0;
                        
                        // Check if group size is within preferred range
                        const groupSizeCompliant = avgRidersPerGroup >= preferredGroupSizeMin && avgRidersPerGroup <= preferredGroupSizeMax;
                        
                        if (hasEnoughCoaches && hasEnoughLeaders && hasEnoughCapacity && groupSizeCompliant) {
                            // This group count is compliant - use it
                            normalGroupCount = numGroups;
                            canMakeCompliantGroups = true;
                            debugLines.push(`Found compliant group configuration: ${numGroups} groups`);
                            debugLines.push(`  - Average riders per group: ${avgRidersPerGroup.toFixed(1)} (within ${preferredGroupSizeMin}-${preferredGroupSizeMax})`);
                            debugLines.push(`  - Coaches needed: ${coachesNeeded}, Available: ${coachesForAssignment.length}`);
                            debugLines.push(`  - Eligible leaders: ${eligibleLeaders.length}, Needed: ${numGroups}`);
                            debugLines.push(`  - Total capacity: ${totalCapacity}, Riders: ${totalRiders}`);
                            break;
                        }
                    }
                    
                    if (!canMakeCompliantGroups) {
                        // No compliant configuration found - use best available
                        normalGroupCount = possibleGroupCounts[0] || Math.max(1, Math.floor(totalRiders / preferredGroupSizeMin));
                        debugLines.push(`Cannot create fully compliant groups - will use ${normalGroupCount} groups`);
                        debugLines.push(`  Available coaches: ${coachesForAssignment.length}, Eligible leaders: ${eligibleLeaders.length}`);
                    }
                }
                
                debugLines.push(`Can make compliant groups: ${canMakeCompliantGroups}, Normal group count: ${normalGroupCount}`);
                
                // Track if we showed the dialog (only when insufficient coaches)
                let showedDialogForInsufficientCoaches = false;
                
                // If targetNumGroups is not specified, decide group count (or use existing)
                if (targetNumGroups === null) {
                    if (ride.groups && ride.groups.length > 0) {
                        // Re-running autofill with existing groups: use current group count so we redistribute and assign coaches (no dialog)
                        targetNumGroups = ride.groups.length;
                        debugLines.push(`Using existing group count: ${targetNumGroups} (autofill will redistribute into current groups and assign coaches)`);
                    } else if (canMakeCompliantGroups) {
                        // Can make compliant groups - use normal group count
                        targetNumGroups = normalGroupCount;
                        debugLines.push(`Using normal group count: ${targetNumGroups} (compliant groups can be made)`);
                    } else {
                        // No existing groups and cannot make compliant groups - show dialog for user to select number of groups
                        showedDialogForInsufficientCoaches = true;
                        debugLines.push(`Cannot make compliant groups - showing dialog for user to select number of groups`);
                        
                        const validGroupOptions = [];
                        for (let numGroups = minGroups; numGroups <= actualMaxGroups; numGroups++) {
                            const avgRiders = totalRiders / numGroups;
                            const minRiders = Math.floor(totalRiders / numGroups);
                            const maxRiders = Math.ceil(totalRiders / numGroups);
                            
                            let label = `${numGroups} groups of `;
                            if (minRiders === maxRiders) {
                                label += `${minRiders} riders/group`;
                            } else {
                                label += `${minRiders}-${maxRiders} riders/group`;
                            }
                            
                            validGroupOptions.push({ numGroups, label, avgRiders });
                        }
                        
                        if (validGroupOptions.length === 0) {
                            alert(`Cannot create groups: ${totalRiders} riders cannot be divided into groups of size ${preferredGroupSizeMin}-${preferredGroupSizeMax}.`);
                            autoAssignDebugLog = debugLines.join('\n');
                            updateDebugOutput();
                            return;
                        }
                        
                        // Show modal dialog with buttons instead of prompt
                        const selectedNumGroups = await showGroupCountSelectionDialog(validGroupOptions);
                        
                        if (selectedNumGroups === null) {
                            // User cancelled
                            return;
                        }
                        
                        targetNumGroups = selectedNumGroups;
                        debugLines.push(`User selected: ${targetNumGroups} groups (insufficient coaches - coaches will remain unassigned)`);
                    }
                }
                
                // Track if we had insufficient coaches and showed the dialog
                // Only skip coach assignment if we showed the dialog (not if targetNumGroups was passed in as parameter)
                const hadInsufficientCoaches = showedDialogForInsufficientCoaches;
                
                // Check rider/coach ratio - use filtered lists when resizing
                const ridersPerGroup = ridersForAssignment.length / targetNumGroups;
                const coachesForCapacity = coachesForAssignment.length;

                debugLines.push(`Selected Groups: ${targetNumGroups}`);
                debugLines.push(`Total Capacity (${coachesForCapacity} coaches × ${ridersPerCoach}): ${coachesForCapacity * ridersPerCoach}`);
                debugLines.push(`Riders per Group (if evenly distributed): ${ridersPerGroup.toFixed(1)}`);

                // Note: Groups can be created even with insufficient coaches
                // Any coaches that can't be assigned will remain in unassigned area
                if (coachesForCapacity > 0 && ridersForAssignment.length > (coachesForCapacity * ridersPerCoach)) {
                    const neededCoaches = Math.ceil(ridersForAssignment.length / ridersPerCoach);
                    debugLines.push(`⚠️ Warning: ${ridersForAssignment.length} riders ideally need ${neededCoaches} coaches (at ${ridersPerCoach} riders per coach), but only ${coachesForCapacity} coaches available.`);
                    debugLines.push(`   Groups will still be created, and available coaches will be assigned where possible.`);
                } else if (coachesForCapacity === 0) {
                    debugLines.push(`⚠️ No coaches available - groups will be created without coaches`);
                }

                if (ridersPerGroup > ridersPerCoach) {
                    const warningMsg = `⚠️ Warning: Average ${ridersPerGroup.toFixed(1)} riders per group exceeds ${ridersPerCoach} riders per coach. Consider adding more coaches or reducing riders.`;
                    debugLines.push(warningMsg);
                } else {
                    debugLines.push(`✓ Requirements met: ${ridersPerGroup.toFixed(1)} riders/group < ${ridersPerCoach} riders/coach`);
                }
                debugLines.push('');

                // STEP 2: Calculate Possible Group Configurations
                debugLines.push('=== STEP 2: CALCULATE POSSIBLE GROUP CONFIGURATIONS ===');
                
                // Use the selected targetNumGroups
                const validGroupCounts = [targetNumGroups];
                debugLines.push(`Using selected number of groups: ${targetNumGroups}`);
                debugLines.push('');

                // Step 2B: Calculate coach distributions for each valid group count
                debugLines.push('Step 2B: Calculate coach distributions:');
                const totalCoaches = coachesForAssignment.length;
                
                // Smart function to generate candidate coach distributions (limited set)
                function generateCoachDistributions(numGroups, totalCoaches, targetCoachesPerGroup) {
                    const distributions = [];
                    const maxDistributions = 100; // Limit to prevent memory issues
                    
                    // Strategy 1: Start with even distribution, then vary
                    const baseCoaches = Math.floor(totalCoaches / numGroups);
                    const remainder = totalCoaches % numGroups;
                    
                    // Create base distribution
                    const baseDist = Array(numGroups).fill(baseCoaches);
                    for (let i = 0; i < remainder; i++) {
                        baseDist[i]++;
                    }
                    distributions.push([...baseDist]);
                    
                    // Strategy 2: Try distributions around targetCoachesPerGroup
                    if (targetCoachesPerGroup > 0) {
                        const targetTotal = targetCoachesPerGroup * numGroups;
                        if (targetTotal <= totalCoaches) {
                            const targetDist = Array(numGroups).fill(targetCoachesPerGroup);
                            const extra = totalCoaches - targetTotal;
                            for (let i = 0; i < extra && i < numGroups; i++) {
                                targetDist[i]++;
                            }
                            distributions.push([...targetDist]);
                        }
                    }
                    
                    // Strategy 3: Generate variations by redistributing coaches
                    // Limit to reasonable variations to prevent explosion
                    const variations = [];
                    for (let attempt = 0; attempt < 50 && variations.length < maxDistributions; attempt++) {
                        const dist = Array(numGroups).fill(1); // Start with 1 coach per group (minimum)
                        let remaining = totalCoaches - numGroups;
                        
                        // Distribute remaining coaches, preferring groups that need more
                        while (remaining > 0) {
                            // Find groups that could use more coaches (below target)
                            const candidates = [];
                            for (let i = 0; i < numGroups; i++) {
                                if (dist[i] < targetCoachesPerGroup + 2) { // Allow some flexibility
                                    candidates.push(i);
                                }
                            }
                            
                            if (candidates.length === 0) {
                                // All groups are at or above target, distribute evenly
                                for (let i = 0; i < numGroups && remaining > 0; i++) {
                                    dist[i]++;
                                    remaining--;
                                }
                            } else {
                                // Add to random candidate
                                const idx = candidates[Math.floor(Math.random() * candidates.length)];
                                dist[idx]++;
                                remaining--;
                            }
                        }
                        
                        // Check if this is a new unique distribution
                        const distStr = [...dist].sort((a, b) => b - a).join(',');
                        if (!variations.some(v => v.join(',') === distStr)) {
                            variations.push([...dist]);
                        }
                    }
                    
                    distributions.push(...variations);
                    
                    // Strategy 4: Try to minimize 1-coach groups
                    if (avoidOneLeaderGroups) {
                        const minOneLeaderDist = Array(numGroups).fill(2); // Start with 2 coaches per group
                        let remaining = totalCoaches - (numGroups * 2);
                        
                        if (remaining >= 0) {
                            // Distribute remaining coaches
                            while (remaining > 0) {
                                for (let i = 0; i < numGroups && remaining > 0; i++) {
                                    minOneLeaderDist[i]++;
                                    remaining--;
                                }
                            }
                            const distStr = [...minOneLeaderDist].sort((a, b) => b - a).join(',');
                            if (!distributions.some(d => [...d].sort((a, b) => b - a).join(',') === distStr)) {
                                distributions.push([...minOneLeaderDist]);
                            }
                        }
                    }
                    
                    // Remove duplicates and limit total
                    const unique = [];
                    const seen = new Set();
                    for (const dist of distributions) {
                        const sorted = [...dist].sort((a, b) => b - a);
                        const key = sorted.join(',');
                        if (!seen.has(key) && unique.length < maxDistributions) {
                            seen.add(key);
                            unique.push(sorted);
                        }
                    }
                    
                    return unique;
                }

                let bestConfig = null;
                let bestScore = -Infinity;

                for (const numGroups of validGroupCounts) {
                    debugLines.push(`  Testing ${numGroups} groups with ${totalCoaches} coaches:`);
                    
                    // If no coaches, create empty distribution
                    let distributions = [];
                    if (totalCoaches === 0) {
                        distributions = [Array(numGroups).fill(0)];
                        debugLines.push(`    No coaches available - using empty distribution`);
                    } else {
                        distributions = generateCoachDistributions(numGroups, totalCoaches, preferredCoachesPerGroup);
                        debugLines.push(`    Generated ${distributions.length} candidate distributions`);
                    }
                    
                    for (const sortedDist of distributions) {
                        const oneLeaderGroups = sortedDist.filter(c => c === 1).length;
                        const avgCoaches = sortedDist.reduce((a, b) => a + b, 0) / sortedDist.length;
                        const deviationFromPreferred = Math.abs(avgCoaches - preferredCoachesPerGroup);
                        
                        // Score: prefer fewer 1-leader groups, then closer to preferred coaches per group
                        // Bonus: add points for each group with exactly preferred number of coaches
                        let score = 1000;
                        if (avoidOneLeaderGroups && oneLeaderGroups > 0) {
                            score -= oneLeaderGroups * 500; // Heavy penalty for 1-leader groups
                        }
                        score -= deviationFromPreferred * 10; // Prefer closer to preferred
                        
                        // Bonus for groups with exactly preferred number of coaches (breaks ties)
                        const groupsWithPreferred = sortedDist.filter(c => c === preferredCoachesPerGroup).length;
                        score += groupsWithPreferred * 5; // Bonus for each group with exactly preferred coaches
                        
                        const distStr = sortedDist.join(',');
                        debugLines.push(`    Distribution [${distStr}]: ${oneLeaderGroups} one-leader groups, avg ${avgCoaches.toFixed(1)} coaches/group (score: ${score.toFixed(0)})`);
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestConfig = {
                                numGroups,
                                coachDistribution: sortedDist,
                                oneLeaderGroups,
                                avgCoaches
                            };
                        }
                    }
                }

                if (!bestConfig) {
                    debugLines.push('❌ ERROR: Could not find valid configuration');
                    autoAssignDebugLog = debugLines.join('\n');
                    updateDebugOutput();
                    return;
                }

                // Calculate expected rider distribution
                // Use ridersForAssignment when resizing to only redistribute assigned riders
                const avgRidersPerGroup = ridersForAssignment.length / bestConfig.numGroups;
                const baseRidersPerGroup = Math.floor(avgRidersPerGroup);
                const remainder = ridersForAssignment.length % bestConfig.numGroups;
                const riderDistribution = Array(bestConfig.numGroups).fill(baseRidersPerGroup);
                for (let i = 0; i < remainder; i++) {
                    riderDistribution[i]++;
                }
                riderDistribution.sort((a, b) => b - a); // Sort descending for display

                debugLines.push('');
                debugLines.push(`✓ SELECTED CONFIGURATION: ${bestConfig.numGroups} groups`);
                debugLines.push(`  Coach Distribution: [${bestConfig.coachDistribution.join(', ')}]`);
                debugLines.push(`  One-Leader Groups: ${bestConfig.oneLeaderGroups}`);
                debugLines.push(`  Average Coaches per Group: ${bestConfig.avgCoaches.toFixed(1)}`);
                debugLines.push(`  Average Riders per Group: ${avgRidersPerGroup.toFixed(1)}`);
                debugLines.push(`  Rider Distribution: [${riderDistribution.join(',')}]`);
                debugLines.push('');

                // STEP 3: Distribute Riders
                debugLines.push('=== STEP 3: DISTRIBUTE RIDERS ===');
                
                // Step 3: Rank riders by fitness (fastest to slowest)
                // Use ridersForAssignment when resizing to only redistribute assigned riders
                const sortedRiders = [...ridersForAssignment].sort((a, b) => {
                    const aFitness = parseInt(a.fitness || '5', 10);
                    const bFitness = parseInt(b.fitness || '5', 10);
                    const aRelative = getRelativePaceValue(aFitness);
                    const bRelative = getRelativePaceValue(bFitness);
                    return bRelative - aRelative; // Fastest first (relative to pace sorting)
                });

                debugLines.push('Riders ranked by pace (fastest to slowest):');
                sortedRiders.forEach((rider, idx) => {
                    const fitness = parseInt(rider.fitness || '5', 10);
                    debugLines.push(`  ${idx + 1}. ${rider.name || 'Rider'} - End ${fitness}`);
                });
                debugLines.push('');

                // Step 3A: Distribute riders evenly as possible into groups (fill each group sequentially)
                debugLines.push('Step 3A: Initial even distribution:');
                ride.groups = [];
                
                for (let i = 0; i < bestConfig.numGroups; i++) {
                    const group = createGroup(`Group ${i + 1}`);
                    ride.groups.push(group);
                }

                // Fill each group sequentially using the riderDistribution calculated earlier
                // Group 1 gets first N riders, Group 2 gets next N, etc.
                // Make last/slowest group smallest if numbers don't divide evenly
                let riderIndex = 0;
                for (let groupIdx = 0; groupIdx < ride.groups.length; groupIdx++) {
                    // Get how many riders this group should get from the distribution
                    // Note: riderDistribution is sorted descending, but we want to fill groups in order
                    // So we need to use the unsorted distribution
                    const ridersForThisGroup = baseRidersPerGroup + (groupIdx < remainder ? 1 : 0);
                    
                    // Add riders sequentially to this group
                    for (let i = 0; i < ridersForThisGroup && riderIndex < sortedRiders.length; i++) {
                        ride.groups[groupIdx].riders.push(sortedRiders[riderIndex].id);
                        riderIndex++;
                    }
                }
                debugLines.push('');

                // Log initial distribution with full details
                ride.groups.forEach((group, idx) => {
                    const riders = group.riders.map(id => getRiderById(id)).filter(Boolean);
                    const fitnessValues = riders.map(r => parseInt(r.fitness || '5', 10));
                    const avgFitness = fitnessValues.length > 0 
                        ? (fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length).toFixed(1)
                        : 'N/A';
                    
                    // Group riders by fitness for detailed output
                    const ridersByFitness = {};
                    riders.forEach(rider => {
                        const fitness = parseInt(rider.fitness || '5', 10);
                        if (!ridersByFitness[fitness]) {
                            ridersByFitness[fitness] = [];
                        }
                        ridersByFitness[fitness].push(rider);
                    });
                    
                    debugLines.push(`  ${group.label}: ${riders.length} riders, avg fitness ${avgFitness}`);
                    // List all riders with their fitness
                    riders.forEach((rider, riderIdx) => {
                        const fitness = parseInt(rider.fitness || '5', 10);
                        debugLines.push(`    ${riderIdx + 1}. ${rider.name || 'Rider'} - End ${fitness}`);
                    });
                });
                debugLines.push('');

                // Step 3B: Optimize - group riders with same fitness together (if within size constraints)
                debugLines.push('Step 3B: Optimize rider distribution (group same fitness together):');
                
                let optimizationRound = 0;
                const maxOptimizationRounds = 50;
                let madeChanges = true;

                while (madeChanges && optimizationRound < maxOptimizationRounds) {
                    optimizationRound++;
                    madeChanges = false;
                    debugLines.push(`  Round ${optimizationRound}:`);

                    for (let i = 0; i < ride.groups.length; i++) {
                        const sourceGroup = ride.groups[i];
                        const sourceRiders = sourceGroup.riders.map(id => getRiderById(id)).filter(Boolean);
                        
                        if (sourceRiders.length === 0) continue;

                        // Get fitness distribution in this group
                        const fitnessCounts = {};
                        sourceRiders.forEach(rider => {
                            const fitness = parseInt(rider.fitness || '5', 10);
                            fitnessCounts[fitness] = (fitnessCounts[fitness] || 0) + 1;
                        });

                        // Find riders that are in minority fitness levels
                        for (const rider of sourceRiders) {
                            const riderFitness = parseInt(rider.fitness || '5', 10);
                            const sameFitnessInGroup = fitnessCounts[riderFitness] || 0;
                            
                            // If this rider is alone or in small minority, try to move them
                            if (sameFitnessInGroup <= 1 && sourceRiders.length > 1) {
                                // Find a target group with riders of same fitness
                                for (let j = 0; j < ride.groups.length; j++) {
                                    if (i === j) continue;
                                    
                                    const targetGroup = ride.groups[j];
                                    const targetRiders = targetGroup.riders.map(id => getRiderById(id)).filter(Boolean);
                                    
                                    // Check if target has riders with same fitness
                                    const hasSameFitness = targetRiders.some(r => 
                                        parseInt(r.fitness || '5', 10) === riderFitness
                                    );
                                    
                                    if (hasSameFitness) {
                                        // Check if move would keep both groups within size constraints
                                        const sourceNewSize = sourceRiders.length - 1;
                                        const targetNewSize = targetRiders.length + 1;
                                        
                                        const sourceValid = sourceNewSize >= preferredGroupSizeMin && sourceNewSize <= preferredGroupSizeMax;
                                        const targetValid = targetNewSize >= preferredGroupSizeMin && targetNewSize <= preferredGroupSizeMax;
                                        
                                        // Allow slight flexibility if it helps group same fitness
                                        const sourceFlexible = sourceNewSize >= preferredGroupSizeMin - 1 && sourceNewSize <= preferredGroupSizeMax + 1;
                                        const targetFlexible = targetNewSize >= preferredGroupSizeMin - 1 && targetNewSize <= preferredGroupSizeMax + 1;
                                        
                                        if ((sourceValid && targetValid) || (sourceFlexible && targetFlexible && sourceNewSize >= 2 && targetNewSize <= preferredGroupSizeMax + 1)) {
                                            // Move rider
                                            sourceGroup.riders = sourceGroup.riders.filter(id => id !== rider.id);
                                            targetGroup.riders.push(rider.id);
                                            
                                            debugLines.push(`    ✓ Moved ${rider.name || 'Rider'} (Pace ${riderFitness}) from ${sourceGroup.label} to ${targetGroup.label}`);
                                            debugLines.push(`      ${sourceGroup.label}: ${sourceNewSize} riders, ${targetGroup.label}: ${targetNewSize} riders`);
                                            madeChanges = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!madeChanges && optimizationRound === 1) {
                        debugLines.push('    No optimizations needed');
                    }
                }

                if (optimizationRound >= maxOptimizationRounds) {
                    debugLines.push(`  ⚠️ Optimization stopped after ${maxOptimizationRounds} rounds (safety limit)`);
                } else if (madeChanges) {
                    debugLines.push(`  ✓ Optimization completed in ${optimizationRound} rounds`);
                } else {
                    debugLines.push(`  ✓ Optimization completed in ${optimizationRound} rounds (no changes needed)`);
                }
                debugLines.push('');

                // Log final rider distribution
                debugLines.push('Final Rider Distribution:');
                ride.groups.forEach((group, idx) => {
                    const riders = group.riders.map(id => getRiderById(id)).filter(Boolean);
                    const fitnessValues = riders.map(r => parseInt(r.fitness || '5', 10));
                    const fitnessCounts = {};
                    fitnessValues.forEach(f => fitnessCounts[f] = (fitnessCounts[f] || 0) + 1);
                    const fitnessStr = Object.entries(fitnessCounts)
                        .sort((a, b) => b[0] - a[0])
                        .map(([f, c]) => `${c}x Pace ${f}`)
                        .join(', ');
                    
                    debugLines.push(`  ${group.label}: ${riders.length} riders [${fitnessStr}]`);
                });
                debugLines.push('');

                // STEP 4: Assign Coaches
                debugLines.push('=== STEP 4: ASSIGN COACHES ===');
                
                // Step 4: Determine which groups get which number of coaches
                debugLines.push('Step 4: Assigning coach counts to groups:');
                
                // Sort groups by size (largest first), then by fitness variance
                const groupInfo = ride.groups.map((group, idx) => {
                    const riders = group.riders.map(id => getRiderById(id)).filter(Boolean);
                    const fitnessValues = riders.map(r => parseInt(r.fitness || '5', 10));
                    const uniqueFitness = new Set(fitnessValues);
                    const variance = uniqueFitness.size > 1 ? uniqueFitness.size : 0;
                    const avgFitness = fitnessValues.length > 0 
                        ? fitnessValues.reduce((a, b) => a + b, 0) / fitnessValues.length
                        : 0;
                    
                    return {
                        group,
                        index: idx,
                        size: riders.length,
                        variance,
                        avgFitness
                    };
                });

                // Sort: largest first, then by variance (more variance = slower), then by avg fitness (slower first)
                groupInfo.sort((a, b) => {
                    if (b.size !== a.size) return b.size - a.size;
                    if (b.variance !== a.variance) return b.variance - a.variance;
                    return a.avgFitness - b.avgFitness;
                });

                // Assign coach counts based on sorted order
                const coachDistribution = [...bestConfig.coachDistribution].sort((a, b) => b - a);
                groupInfo.forEach((info, idx) => {
                    info.coachCount = coachDistribution[idx] || 1;
                    debugLines.push(`  ${info.group.label}: ${info.size} riders, ${info.variance} fitness levels, ${info.coachCount} coaches`);
                });
                debugLines.push('');

                // Step 4A: Rank L2/3 coaches by fitness
                debugLines.push('Step 4A: Ranking L2/3 coaches by fitness:');
                const sortedLeaders = coachesForAssignment.length > 0 ? [...eligibleLeaders].sort((a, b) => {
                    const aFitness = getCoachFitnessValue(a);
                    const bFitness = getCoachFitnessValue(b);
                    return bFitness - aFitness; // Highest fitness first
                }) : [];

                if (sortedLeaders.length > 0) {
                    sortedLeaders.forEach((coach, idx) => {
                        const fitness = getCoachFitnessValue(coach);
                        const level = coach.coachingLicenseLevel || coach.level || '1';
                        debugLines.push(`  ${idx + 1}. ${coach.name || 'Coach'} - Level ${level}, End ${fitness}`);
                    });
                } else {
                    debugLines.push('  No eligible leaders available.');
                }
                debugLines.push('');

                // Step 4B: Assign Leaders (optional - groups can exist without leaders)
                // Only skip coach assignment when there are no coaches to assign (so we always place attending coaches into groups when possible)
                if (coachesForAssignment.length === 0) {
                    debugLines.push('Step 4B: No coaches to assign (coaches list is empty).');
                    debugLines.push('');
                    debugLines.push('Step 4C: Skipped (no coaches).');
                    debugLines.push('');
                    debugLines.push('Step 4D: Skipped (no coaches).');
                    debugLines.push('');
                } else {
                    debugLines.push('Step 4B: Assigning ride leaders:');
                    let leaderIndex = 0;
                    groupInfo.forEach((info) => {
                        if (leaderIndex < sortedLeaders.length) {
                            info.group.coaches.leader = sortedLeaders[leaderIndex].id;
                            debugLines.push(`  ${info.group.label} Leader: ${sortedLeaders[leaderIndex].name || 'Coach'}`);
                            leaderIndex++;
                        } else {
                            debugLines.push(`  ${info.group.label} Leader: None (no eligible leaders available)`);
                        }
                    });
                    debugLines.push('');

                    // Step 4C: Get remaining coaches (L1 + unassigned L2/3)
                    debugLines.push('Step 4C: Remaining coaches (L1 + unassigned L2/3):');
                    const remainingCoaches = coachesForAssignment.length > 0 ? coachesForAssignment
                        .filter(coach => {
                            // Not already assigned as leader
                            return !groupInfo.some(info => info.group.coaches.leader === coach.id);
                        })
                        .sort((a, b) => {
                            const aFitness = getCoachFitnessValue(a);
                            const bFitness = getCoachFitnessValue(b);
                            return bFitness - aFitness; // Highest fitness first
                        }) : [];

                    if (remainingCoaches.length > 0) {
                        remainingCoaches.forEach((coach, idx) => {
                            const fitness = getCoachFitnessValue(coach);
                            const level = coach.coachingLicenseLevel || coach.level || '1';
                            debugLines.push(`  ${idx + 1}. ${coach.name || 'Coach'} - Level ${level}, End ${fitness}`);
                        });
                    } else {
                        debugLines.push('  No remaining coaches available.');
                    }
                    debugLines.push('');

                    // Step 4D: Assign additional coaches (Sweep, Roam)
                    debugLines.push('Step 4D: Assigning additional coaches:');
                    let remainingCoachIndex = 0;

                    // Sort groups by coach count needed (most first)
                    const groupsNeedingCoaches = groupInfo
                        .filter(info => info.coachCount > 1)
                        .sort((a, b) => b.coachCount - a.coachCount);

                    for (const info of groupsNeedingCoaches) {
                        // Calculate coaches needed: if group has leader, need coachCount - 1, otherwise need coachCount
                        const hasLeader = !!info.group.coaches.leader;
                        const coachesNeeded = hasLeader ? info.coachCount - 1 : info.coachCount;
                        let coachesAssigned = 0;

                        while (coachesAssigned < coachesNeeded && remainingCoachIndex < remainingCoaches.length) {
                            const coach = remainingCoaches[remainingCoachIndex];
                            
                            if (!info.group.coaches.sweep) {
                                info.group.coaches.sweep = coach.id;
                                debugLines.push(`  ${info.group.label} Sweep: ${coach.name || 'Coach'}`);
                                coachesAssigned++;
                            } else if (!info.group.coaches.roam) {
                                info.group.coaches.roam = coach.id;
                                debugLines.push(`  ${info.group.label} Roam: ${coach.name || 'Coach'}`);
                                coachesAssigned++;
                            } else {
                                // Add as extraRoam
                                if (!Array.isArray(info.group.coaches.extraRoam)) {
                                    info.group.coaches.extraRoam = [];
                                }
                                info.group.coaches.extraRoam.push(coach.id);
                                debugLines.push(`  ${info.group.label} Extra Roam: ${coach.name || 'Coach'}`);
                                coachesAssigned++;
                            }
                            
                            remainingCoachIndex++;
                        }
                    }
                    debugLines.push('');
                }

                // Validate no 1-leader + 1-rider groups if required
                if (noOneLeaderOneRider) {
                    debugLines.push('Validating: No 1-leader + 1-rider groups:');
                    let violations = 0;
                    ride.groups.forEach(group => {
                        const coachCount = countGroupCoaches(group);
                        if (coachCount === 1 && group.riders.length === 1) {
                            violations++;
                            debugLines.push(`  ❌ ${group.label}: 1 coach + 1 rider (VIOLATION)`);
                        }
                    });
                    if (violations > 0) {
                        debugLines.push(`  ⚠️ Warning: ${violations} group(s) violate the "No 1 Leader + 1 Rider" requirement`);
                    } else {
                        debugLines.push(`  ✓ All groups meet requirement`);
                    }
                    debugLines.push('');
                }

                // Final summary
                debugLines.push('=== FINAL SUMMARY ===');
                ride.groups.forEach((group, idx) => {
                    const riders = group.riders.map(id => getRiderById(id)).filter(Boolean);
                    const leader = getCoachById(group.coaches.leader);
                    const sweep = getCoachById(group.coaches.sweep);
                    const roam = getCoachById(group.coaches.roam);
                    const extraRoam = Array.isArray(group.coaches.extraRoam) 
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean)
                        : [];
                    
                    debugLines.push(`${group.label}:`);
                    debugLines.push(`  Riders: ${riders.length}`);
                    debugLines.push(`  Leader: ${leader ? leader.name || 'Coach' : 'None'}`);
                    debugLines.push(`  Sweep: ${sweep ? sweep.name || 'Coach' : 'None'}`);
                    debugLines.push(`  Roam: ${roam ? roam.name || 'Coach' : 'None'}`);
                    if (extraRoam.length > 0) {
                        debugLines.push(`  Extra Roam: ${extraRoam.map(c => c.name || 'Coach').join(', ')}`);
                    }
                });

                // Track which coaches were assigned to groups
                const assignedCoachIds = new Set();
                ride.groups.forEach(group => {
                    if (group.coaches.leader) assignedCoachIds.add(group.coaches.leader);
                    if (group.coaches.sweep) assignedCoachIds.add(group.coaches.sweep);
                    if (group.coaches.roam) assignedCoachIds.add(group.coaches.roam);
                    if (Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam.forEach(id => assignedCoachIds.add(id));
                    }
                });
                
                // Any coaches that weren't assigned remain in availableCoaches (will show in unassigned palette)
                const unassignedCoaches = availableCoaches.filter(coach => !assignedCoachIds.has(coach.id));
                if (unassignedCoaches.length > 0) {
                    debugLines.push('');
                    debugLines.push(`=== UNASSIGNED COACHES ===`);
                    debugLines.push(`${unassignedCoaches.length} coach(es) could not be assigned to groups and remain in unassigned area:`);
                    unassignedCoaches.forEach(coach => {
                        debugLines.push(`  - ${coach.name || 'Coach'} (Level ${coach.coachingLicenseLevel || coach.level || '1'})`);
                    });
                    debugLines.push('');
                }

                // Clear new attendees when autofill runs (they're now assigned)
                ride.newAttendees = null;

                // Save and render
                saveRideToDB(ride);
                renderAssignments(ride);

                // Show the More/Fewer Groups buttons after successful autofill
                const moreGroupsBtn = document.getElementById('more-groups-btn');
                const fewerGroupsBtn = document.getElementById('fewer-groups-btn');
                if (moreGroupsBtn) moreGroupsBtn.style.display = '';
                if (fewerGroupsBtn) fewerGroupsBtn.style.display = '';

                autoAssignDebugLog = debugLines.join('\n');
                updateDebugOutput();

            } catch (error) {
                console.error('Error in autoAssign:', error);
                alert(`Error during auto-assignment: ${error.message}\n\nCheck the browser console and debug output for details.`);
                autoAssignDebugLog = `Error: ${error.message}\n\nStack trace:\n${error.stack}`;
                updateDebugOutput();
            }
        }

        function openCopyGroupsFromPriorPracticeDialog() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No practice selected.');
                return;
            }
            if (ride.cancelled) {
                alert('Cannot assign riders and coaches to a cancelled practice.');
                return;
            }

            const currentDate = parseISODate(ride.date);
            if (!currentDate) {
                alert('Invalid practice date.');
                return;
            }

            // Get all rides sorted by date (descending - most recent first)
            const allRides = (data.rides || [])
                .filter(r => {
                    if (!r.date || r.deleted || r.cancelled) return false;
                    if (isRideDateExcludedFromPlanner(r.date)) return false;
                    const rDate = parseISODate(r.date);
                    if (!rDate) return false;
                    return rDate < currentDate; // Only practices before current
                })
                .map(r => ({
                    ride: r,
                    date: parseISODate(r.date)
                }))
                .filter(r => r.date)
                .sort((a, b) => b.date - a.date); // Most recent first

            // Filter to only practices with group assignments
            const ridesWithGroups = allRides.filter(({ ride: candidateRide }) => 
                candidateRide.groups && candidateRide.groups.length > 0
            );

            if (ridesWithGroups.length === 0) {
                alert('No previous practices with group assignments found.');
                return;
            }

            // Render the list
            const listContainer = document.getElementById('prior-practices-list');
            if (!listContainer) return;

            listContainer.innerHTML = ridesWithGroups.map(({ ride: sourceRide, date }) => {
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                const groupCount = sourceRide.groups ? sourceRide.groups.length : 0;
                return `
                    <div style="padding: 12px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: white; transition: background 0.2s;" 
                         onmouseover="this.style.background='#f5f5f5'" 
                         onmouseout="this.style.background='white'"
                         onclick="copyGroupsFromPriorPractice(${sourceRide.id})">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${dateStr}</div>
                        <div style="font-size: 13px; color: #666;">${groupCount} group${groupCount !== 1 ? 's' : ''}</div>
                    </div>
                `;
            }).join('');

            // Show modal
            const modal = document.getElementById('copy-groups-prior-practice-modal');
            if (modal) {
                modal.setAttribute('aria-hidden', 'false');
                modal.style.display = 'flex';
            }
        }

        function closeCopyGroupsFromPriorPracticeDialog() {
            const modal = document.getElementById('copy-groups-prior-practice-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
            }
        }

        function copyGroupsFromPriorPractice(sourceRideId) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            // Convert sourceRideId to number if it's a string (from onclick attribute)
            const sourceId = typeof sourceRideId === 'string' ? parseInt(sourceRideId, 10) : sourceRideId;
            const sourceRide = data.rides.find(r => {
                // Try both string and number comparison
                return r.id === sourceId || r.id === sourceRideId || String(r.id) === String(sourceRideId);
            });
            
            if (!ride) {
                alert('Error: Current practice not found.');
                return;
            }
            
            if (!sourceRide) {
                console.error('Source ride not found. Looking for ID:', sourceRideId, 'Available ride IDs:', data.rides.map(r => ({ id: r.id, type: typeof r.id })));
                alert(`Error: Prior practice not found (ID: ${sourceRideId}).`);
                return;
            }

            // Close modal
            closeCopyGroupsFromPriorPracticeDialog();

            // Save state before change
            saveAssignmentState(ride);

            // Get current practice's available coaches and riders
            const currentAvailableCoaches = new Set(ride.availableCoaches || []);
            const currentAvailableRiders = new Set(ride.availableRiders || []);

            // Get source practice's available coaches and riders
            const sourceAvailableCoaches = new Set(sourceRide.availableCoaches || []);
            const sourceAvailableRiders = new Set(sourceRide.availableRiders || []);

            // Find new attendees (attending current but not source)
            const newCoaches = Array.from(currentAvailableCoaches).filter(id => !sourceAvailableCoaches.has(id));
            const newRiders = Array.from(currentAvailableRiders).filter(id => !sourceAvailableRiders.has(id));

            // Find missing attendees (were in source but not attending current)
            const missingCoaches = Array.from(sourceAvailableCoaches).filter(id => !currentAvailableCoaches.has(id));
            const missingRiders = Array.from(sourceAvailableRiders).filter(id => !currentAvailableRiders.has(id));

            // Build scheduled-absence lookup for the current ride date
            const rideDate = ride.date || '';
            const isRiderAbsent = (id) => rideDate && isScheduledAbsent('rider', id, rideDate).absent;
            const isCoachAbsent = (id) => rideDate && isScheduledAbsent('coach', id, rideDate).absent;

            // Copy groups from source practice
            ride.groups = sourceRide.groups.map(sourceGroup => {
                const newGroup = createGroup(sourceGroup.label);
                
                // Copy riders (only those available in current practice and not scheduled absent)
                newGroup.riders = sourceGroup.riders.filter(riderId => currentAvailableRiders.has(riderId) && !isRiderAbsent(riderId));
                
                // Copy coaches (only those available in current practice and not scheduled absent)
                if (sourceGroup.coaches.leader && currentAvailableCoaches.has(sourceGroup.coaches.leader) && !isCoachAbsent(sourceGroup.coaches.leader)) {
                    newGroup.coaches.leader = sourceGroup.coaches.leader;
                }
                if (sourceGroup.coaches.sweep && currentAvailableCoaches.has(sourceGroup.coaches.sweep) && !isCoachAbsent(sourceGroup.coaches.sweep)) {
                    newGroup.coaches.sweep = sourceGroup.coaches.sweep;
                }
                if (sourceGroup.coaches.roam && currentAvailableCoaches.has(sourceGroup.coaches.roam) && !isCoachAbsent(sourceGroup.coaches.roam)) {
                    newGroup.coaches.roam = sourceGroup.coaches.roam;
                }
                if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                    newGroup.coaches.extraRoam = sourceGroup.coaches.extraRoam.filter(id => currentAvailableCoaches.has(id) && !isCoachAbsent(id));
                }
                
                // Auto-promote qualified L2/L3 coach to leader if original leader is absent
                if (!newGroup.coaches.leader) {
                    // Check for qualified coaches in the group (sweep, roam, extraRoam)
                    const qualifiedCoaches = [];
                    
                    // Check sweep
                    if (newGroup.coaches.sweep) {
                        const coach = getCoachById(newGroup.coaches.sweep);
                        if (coach) {
                            const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                            const level = parseInt(levelRaw, 10);
                            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                            if (Number.isFinite(level) && level >= minLeaderLevel) {
                                qualifiedCoaches.push({ id: coach.id, role: 'sweep', level });
                            }
                        }
                    }
                    
                    // Check roam
                    if (newGroup.coaches.roam) {
                        const coach = getCoachById(newGroup.coaches.roam);
                        if (coach) {
                            const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                            const level = parseInt(levelRaw, 10);
                            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                            if (Number.isFinite(level) && level >= minLeaderLevel) {
                                qualifiedCoaches.push({ id: coach.id, role: 'roam', level });
                            }
                        }
                    }
                    
                    // Check extraRoam
                    if (Array.isArray(newGroup.coaches.extraRoam)) {
                        newGroup.coaches.extraRoam.forEach(coachId => {
                            const coach = getCoachById(coachId);
                            if (coach) {
                                const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                                const level = parseInt(levelRaw, 10);
                                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                                if (Number.isFinite(level) && level >= minLeaderLevel) {
                                    qualifiedCoaches.push({ id: coach.id, role: 'extraRoam', level });
                                }
                            }
                        });
                    }
                    
                    // If we found qualified coaches, promote the highest level one (prefer L3 over L2)
                    if (qualifiedCoaches.length > 0) {
                        // Sort by level (descending) to prefer L3 over L2
                        qualifiedCoaches.sort((a, b) => b.level - a.level);
                        const promotedCoach = qualifiedCoaches[0];
                        
                        // Promote to leader
                        newGroup.coaches.leader = promotedCoach.id;
                        
                        // Remove from original role
                        if (promotedCoach.role === 'sweep') {
                            newGroup.coaches.sweep = null;
                        } else if (promotedCoach.role === 'roam') {
                            newGroup.coaches.roam = null;
                        } else if (promotedCoach.role === 'extraRoam') {
                            newGroup.coaches.extraRoam = newGroup.coaches.extraRoam.filter(id => id !== promotedCoach.id);
                        }
                    }
                    // If no qualified coach found, group will be marked red by checkGroupCompliance
                }
                
                // Copy other group properties (but not routeId - routes must be chosen fresh for each practice)
                newGroup.routeId = null; // Routes are not copied - must be chosen fresh for each practice
                newGroup.sortBy = sourceGroup.sortBy;
                
                return newGroup;
            });

            // Store new attendees for display
            ride.newAttendees = {
                coaches: newCoaches,
                riders: newRiders
            };

            // Save and render
            saveRideToDB(ride);
            renderAssignments(ride);

            // Show the More/Fewer Groups buttons
            const moreGroupsBtn = document.getElementById('more-groups-btn');
            const fewerGroupsBtn = document.getElementById('fewer-groups-btn');
            if (moreGroupsBtn) moreGroupsBtn.style.display = '';
            if (fewerGroupsBtn) fewerGroupsBtn.style.display = '';
        }

        // ---- Group Resize Memory ----
        // Stores snapshots of group configurations at different group counts so the user
        // can cycle between More/Fewer Groups and return to a previously visited layout.
        let _groupResizeMemory = {};

        function saveGroupsToResizeMemory(ride) {
            const key = ride.id + '_' + ride.groups.length;
            _groupResizeMemory[key] = JSON.parse(JSON.stringify(ride.groups));
        }

        function getGroupsFromResizeMemory(rideId, numGroups) {
            const key = rideId + '_' + numGroups;
            const saved = _groupResizeMemory[key];
            return saved ? JSON.parse(JSON.stringify(saved)) : null;
        }

        function clearGroupResizeMemory(rideId) {
            if (rideId) {
                const prefix = rideId + '_';
                Object.keys(_groupResizeMemory).forEach(key => {
                    if (key.startsWith(prefix)) delete _groupResizeMemory[key];
                });
            } else {
                _groupResizeMemory = {};
            }
        }

        function placeCoachInNextSlot(group, coachId) {
            if (!group.coaches.leader) {
                group.coaches.leader = coachId;
            } else if (!group.coaches.sweep) {
                group.coaches.sweep = coachId;
            } else if (!group.coaches.roam) {
                group.coaches.roam = coachId;
            } else {
                if (!Array.isArray(group.coaches.extraRoam)) group.coaches.extraRoam = [];
                group.coaches.extraRoam.push(coachId);
            }
        }

        function redistributeCoachesAfterResize(ride, extraCoachIds) {
            const allCoachIds = extraCoachIds ? [...extraCoachIds] : [];
            ride.groups.forEach(group => {
                if (group.coaches.leader) allCoachIds.push(group.coaches.leader);
                if (group.coaches.sweep) allCoachIds.push(group.coaches.sweep);
                if (group.coaches.roam) allCoachIds.push(group.coaches.roam);
                if (Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam.forEach(id => { if (id) allCoachIds.push(id); });
                }
            });

            ride.groups.forEach(group => {
                group.coaches = { leader: null, sweep: null, roam: null, extraRoam: [] };
            });

            const coachObjs = allCoachIds.map(id => getCoachById(id)).filter(Boolean);
            if (coachObjs.length === 0) return;

            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
            const leaders = coachObjs.filter(c => {
                const level = parseInt(c.coachingLicenseLevel || c.level || '1', 10);
                return Number.isFinite(level) && level >= minLeaderLevel;
            }).sort((a, b) => getCoachFitnessValue(b) - getCoachFitnessValue(a));

            const nonLeaders = coachObjs.filter(c => {
                const level = parseInt(c.coachingLicenseLevel || c.level || '1', 10);
                return !(Number.isFinite(level) && level >= minLeaderLevel);
            }).sort((a, b) => getCoachFitnessValue(b) - getCoachFitnessValue(a));

            leaders.forEach((coach, i) => {
                if (i < ride.groups.length) {
                    ride.groups[i].coaches.leader = coach.id;
                } else {
                    const target = ride.groups.reduce((best, g) =>
                        countGroupCoaches(g) < countGroupCoaches(best) ? g : best, ride.groups[0]);
                    placeCoachInNextSlot(target, coach.id);
                }
            });

            nonLeaders.forEach(coach => {
                const target = ride.groups.reduce((best, g) =>
                    countGroupCoaches(g) < countGroupCoaches(best) ? g : best, ride.groups[0]);
                placeCoachInNextSlot(target, coach.id);
            });
        }

        // ---- More / Fewer Groups ----

        function tryMoreGroups() {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride || !ride.groups || ride.groups.length === 0) return;

            const currentNumGroups = ride.groups.length;
            const totalRiders = ride.groups.reduce((sum, g) => sum + g.riders.length, 0);
            const targetCount = currentNumGroups + 1;

            if (totalRiders < targetCount) {
                alert(`Cannot add more groups: only ${totalRiders} rider(s) across ${currentNumGroups} groups.`);
                return;
            }

            saveAssignmentState(ride);
            saveGroupsToResizeMemory(ride);

            const saved = getGroupsFromResizeMemory(ride.id, targetCount);
            if (saved) {
                ride.groups = saved;
                saveRideToDB(ride);
                renderAssignments(ride);
                return;
            }

            // Target sizes for N+1 groups
            const targetPerGroup = Math.floor(totalRiders / targetCount);
            const extra = totalRiders % targetCount;
            const targetSizes = [];
            for (let i = 0; i < targetCount; i++) {
                targetSizes.push(i < extra ? targetPerGroup + 1 : targetPerGroup);
            }

            // Append an empty group at the end
            ride.groups.push(createGroup(`Group ${targetCount}`));

            // Cascade downward through adjacent groups:
            // Each group sheds its slowest (bottom) riders to the next group.
            // Received riders are faster than the next group's existing riders,
            // so they go to the TOP (unshift). The cascade naturally grows as it
            // flows down, and the new last group receives its riders from the
            // group just above it.
            for (let i = 0; i < currentNumGroups; i++) {
                const group = ride.groups[i];
                const excess = group.riders.length - targetSizes[i];
                if (excess > 0) {
                    const taken = group.riders.splice(group.riders.length - excess, excess);
                    ride.groups[i + 1].riders.unshift(...taken);
                }
            }

            redistributeCoachesAfterResize(ride);
            ride.groups.forEach((g, i) => g.label = `Group ${i + 1}`);

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function tryFewerGroups() {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride || !ride.groups || ride.groups.length <= 1) return;

            const currentNumGroups = ride.groups.length;
            const targetCount = currentNumGroups - 1;

            saveAssignmentState(ride);
            saveGroupsToResizeMemory(ride);

            const saved = getGroupsFromResizeMemory(ride.id, targetCount);
            if (saved) {
                ride.groups = saved;
                saveRideToDB(ride);
                renderAssignments(ride);
                return;
            }

            // Dissolve last group, collect its coaches
            const lastGroup = ride.groups.pop();
            const dissolvedCoachIds = [];
            if (lastGroup.coaches.leader) dissolvedCoachIds.push(lastGroup.coaches.leader);
            if (lastGroup.coaches.sweep) dissolvedCoachIds.push(lastGroup.coaches.sweep);
            if (lastGroup.coaches.roam) dissolvedCoachIds.push(lastGroup.coaches.roam);
            if (Array.isArray(lastGroup.coaches.extraRoam)) {
                lastGroup.coaches.extraRoam.forEach(id => { if (id) dissolvedCoachIds.push(id); });
            }

            // Append dissolved group's riders to the adjacent group above (they're slower)
            ride.groups[targetCount - 1].riders.push(...lastGroup.riders);

            // Target sizes for N-1 groups
            const totalRiders = ride.groups.reduce((sum, g) => sum + g.riders.length, 0);
            const targetPerGroup = Math.floor(totalRiders / targetCount);
            const extra = totalRiders % targetCount;
            const targetSizes = [];
            for (let i = 0; i < targetCount; i++) {
                targetSizes.push(i < extra ? targetPerGroup + 1 : targetPerGroup);
            }

            // Cascade upward through adjacent groups:
            // Each oversized group sheds its fastest (top) riders to the group above.
            // Those riders are slower than the receiving group's existing riders,
            // so they go to the BOTTOM (push). The cascade flows upward until balanced.
            for (let i = targetCount - 1; i >= 1; i--) {
                const group = ride.groups[i];
                const excess = group.riders.length - targetSizes[i];
                if (excess > 0) {
                    const taken = group.riders.splice(0, excess);
                    ride.groups[i - 1].riders.push(...taken);
                }
            }

            redistributeCoachesAfterResize(ride, dissolvedCoachIds);
            ride.groups.forEach((g, i) => g.label = `Group ${i + 1}`);

            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function toggleGroupSection(section) {
            // Toggle the state
            groupSectionsState[section] = !groupSectionsState[section];
            
            // Find all sections of this type across all groups
            const sections = document.querySelectorAll(`[data-section="${section}"]`);
            sections.forEach(el => {
                el.style.display = groupSectionsState[section] ? '' : 'none';
            });
            
            // Update all header indicators - find headers by checking onclick attribute
            const allHeaders = document.querySelectorAll('[onclick*="toggleGroupSection"]');
            allHeaders.forEach(header => {
                const onclickAttr = header.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(`'${section}'`)) {
                    const spans = header.querySelectorAll('span');
                    if (spans.length >= 2) {
                        const indicator = spans[spans.length - 1];
                        indicator.textContent = groupSectionsState[section] ? '▼' : '▶';
                    }
                }
            });
        }

        function unassignAllCoaches() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            if (!confirm('Unassign all coaches from groups? Coaches will be moved to the unassigned palette.')) return;
            
            // Save state before change (for undo/redo)
            saveAssignmentState(ride);
            
            // Collect all coach IDs that are assigned to groups
            const assignedCoachIds = new Set();
            ride.groups.forEach(group => {
                if (group.coaches.leader) assignedCoachIds.add(group.coaches.leader);
                if (group.coaches.sweep) assignedCoachIds.add(group.coaches.sweep);
                if (group.coaches.roam) assignedCoachIds.add(group.coaches.roam);
                if (Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam.forEach(id => {
                        if (id) assignedCoachIds.add(id);
                    });
                }
            });
            
            // Remove all coaches from all groups
            ride.groups.forEach(group => {
                group.coaches.leader = null;
                group.coaches.sweep = null;
                group.coaches.roam = null;
                group.coaches.extraRoam = [];
            });
            
            // Ensure all unassigned coaches are in availableCoaches
            assignedCoachIds.forEach(coachId => {
                if (!ride.availableCoaches.includes(coachId)) {
                    ride.availableCoaches.push(coachId);
                }
            });
            
            // Make the unassigned palette visible
            unassignedPaletteVisibility = 'show';
            
            // Save and render
            saveRideToDB(ride);
            renderAssignments(ride);
        }

        function rideUsesGroupColorNames(ride) {
            return ride && Array.isArray(ride.groups) && ride.groups.length > 0 && ride.groups.every(g => g.colorName);
        }

        function getSortedGroupsForPrintOrPublish(ride) {
            const useColorNames = rideUsesGroupColorNames(ride);
            return [...ride.groups].sort((a, b) => {
                if (useColorNames && a.colorName && b.colorName) return (a.colorName || '').localeCompare(b.colorName || '');
                const numA = parseInt((a.label || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.label || '').replace(/\D/g, '')) || 0;
                return numA - numB;
            });
        }

        function getGroupDisplayTitleForPrint(group, index, useColorNames) {
            if (useColorNames && group.colorName) return `${group.colorName} Group`;
            const baseLabel = group.label || `Group ${index + 1}`;
            if (group.customName) return `${baseLabel} (${group.customName})`;
            return baseLabel;
        }

        /** Returns { displayName, isLeaderChoice, route, stravaUrl } for use in print/export. Handles "Ride Leader's Choice". */
        function getRouteDisplayForGroup(group) {
            if (group.routeId === 'leader-choice' || group.routeId === '') {
                return { displayName: "Ride Leader's Choice", isLeaderChoice: true, route: null, stravaUrl: null };
            }
            const route = getRouteById(group.routeId);
            if (!route) return { displayName: '', isLeaderChoice: false, route: null, stravaUrl: null };
            let stravaUrl = route.stravaUrl || null;
            if (!stravaUrl && route.stravaEmbedCode) {
                const urlMatch = route.stravaEmbedCode.match(/https?:\/\/[^\s"'<>]+strava\.com[^\s"'<>]*/i);
                if (urlMatch) stravaUrl = urlMatch[0];
            }
            return { displayName: route.name || 'Unnamed Route', isLeaderChoice: false, route, stravaUrl };
        }

        async function toggleGroupColorNames() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride || !Array.isArray(ride.groups) || ride.groups.length === 0) {
                alert('Please add at least one group first.');
                return;
            }
            if (rideUsesGroupColorNames(ride)) {
                ride.groups.forEach(g => { delete g.colorName; });
            } else {
                const names = typeof getColorNames === 'function' ? await getColorNames() : [];
                const colorNames = (names.length > 0 ? names.map(n => n.name) : []).filter(Boolean);
                if (colorNames.length < ride.groups.length) {
                    alert('Not enough color names in the list. Add more in Supabase (color_names table) or use fewer groups.');
                    return;
                }
                const shuffled = colorNames.slice().sort(() => Math.random() - 0.5);
                ride.groups.forEach((g, i) => { g.colorName = shuffled[i]; });
            }
            await saveRideToDB(ride);
            renderAssignments(ride);
            updateGroupColorNamesButton(ride);
        }

        function updateGroupColorNamesButton(ride) {
            const btn = document.getElementById('group-color-names-btn');
            if (!btn) return;
            btn.textContent = rideUsesGroupColorNames(ride) ? 'Remove Color Names' : 'Color Names!';
        }

        function clearAssignments() {
            if (!confirm('Clear all assignments? This will delete all groups and remove all rider and coach assignments.')) return;
            
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            clearGroupResizeMemory(ride.id);
            
            // Clear undo/redo history when clearing assignments
            clearAssignmentHistory();
            
            // Delete all groups
            ride.groups = [];
            ride.assignments = {};
            ride.newAttendees = null; // Clear new attendees when clearing assignments
            ride.publishedGroups = false; // Reset published status when clearing
            // Save immediately to localStorage
            saveRideToDB(ride);
            renderAssignments(ride);
            
            // Hide the More/Fewer Groups buttons after clearing
            const moreGroupsBtn = document.getElementById('more-groups-btn');
            const fewerGroupsBtn = document.getElementById('fewer-groups-btn');
            if (moreGroupsBtn) moreGroupsBtn.style.display = 'none';
            if (fewerGroupsBtn) fewerGroupsBtn.style.display = 'none';
            
            autoAssignDebugLog = `Assignments cleared at ${new Date().toLocaleString()}.`;
            updateDebugOutput();
        }

        function clearAllAndRestartPlanning() {
            if (!confirm('Clear all groups, attendance, and restart planning from scratch? This cannot be undone.')) return;

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            clearGroupResizeMemory(ride.id);
            clearAssignmentHistory();

            ride.groups = [];
            ride.assignments = {};
            ride.availableRiders = [];
            ride.availableCoaches = [];
            ride.newAttendees = null;
            ride.publishedGroups = false;
            ride.planningStarted = false;

            saveRideToDB(ride);

            attendanceMode = false;
            hideSidebars();
            practicePlannerView = 'plannerSetup';
            renderRides();
        }

        function showGroupValidationErrorModal(title, errors, options) {
            options = options || {};
            const syncAndRetry = options.syncAndRetry || null;

            // Create or get modal element
            let modal = document.getElementById('group-validation-error-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'group-validation-error-modal';
                modal.className = 'modal-overlay';
                modal.setAttribute('aria-hidden', 'true');
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        closeGroupValidationErrorModal();
                    }
                };
                modal.innerHTML = `
                    <div class="modal" style="max-width: 600px; width: min(600px, 95%);">
                        <div class="modal-header">
                            <span style="color: #d32f2f; font-weight: 600;">${escapeHtml(title)}</span>
                            <button class="btn-small secondary" onclick="closeGroupValidationErrorModal()">Close</button>
                        </div>
                        <div class="modal-body" id="group-validation-error-body" style="max-height: calc(100vh - 200px); overflow-y: auto;">
                            <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">Please fix the following errors:</p>
                            <ul id="group-validation-error-list" style="margin: 0; padding-left: 20px; color: #333;">
                            </ul>
                        </div>
                        <div class="modal-footer" id="group-validation-error-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                            <button class="btn-small" onclick="closeGroupValidationErrorModal()">OK</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            // Show or hide "Mark as not attending and continue" button
            const footer = modal.querySelector('#group-validation-error-footer');
            const existingSyncBtn = modal.querySelector('#group-validation-sync-btn');
            if (existingSyncBtn) existingSyncBtn.remove();
            if (syncAndRetry && footer) {
                const syncBtn = document.createElement('button');
                syncBtn.id = 'group-validation-sync-btn';
                syncBtn.className = 'btn-small';
                syncBtn.style.background = '#1976d2';
                syncBtn.style.color = '#fff';
                syncBtn.textContent = 'Mark unassigned as not attending and continue';
                syncBtn.onclick = function() {
                    runSyncAttendanceAndRetry(syncAndRetry);
                };
                footer.insertBefore(syncBtn, footer.firstChild);
            }
            
            // Update title
            const titleElement = modal.querySelector('.modal-header span');
            if (titleElement) {
                titleElement.textContent = title;
            }
            
            // Update error list
            const errorList = modal.querySelector('#group-validation-error-list');
            if (errorList) {
                errorList.innerHTML = errors.map(error => `<li style="margin-bottom: 8px;">${escapeHtml(error)}</li>`).join('');
            }
            
            // Show modal first to measure content
            modal.style.display = 'flex';
            modal.removeAttribute('aria-hidden');
            
            // Calculate optimal height for modal body (fit content without scrolling if possible)
            const modalBody = modal.querySelector('#group-validation-error-body');
            const modalElement = modal.querySelector('.modal');
            if (modalBody && modalElement) {
                // Use requestAnimationFrame to ensure DOM is rendered
                requestAnimationFrame(() => {
                    // Reset max-height to allow measurement
                    const originalMaxHeight = modalBody.style.maxHeight;
                    modalBody.style.maxHeight = 'none';
                    const bodyHeight = modalBody.scrollHeight;
                    const viewportHeight = window.innerHeight;
                    const headerHeight = modal.querySelector('.modal-header')?.offsetHeight || 60;
                    const footerHeight = modal.querySelector('.modal-footer')?.offsetHeight || 60;
                    const padding = 40; // Extra padding for modal margins
                    const maxBodyHeight = viewportHeight - headerHeight - footerHeight - padding;
                    
                    // Set max-height to fit content or viewport, whichever is smaller
                    if (bodyHeight <= maxBodyHeight) {
                        modalBody.style.maxHeight = bodyHeight + 'px';
                        modalBody.style.overflowY = 'visible';
                    } else {
                        modalBody.style.maxHeight = maxBodyHeight + 'px';
                        modalBody.style.overflowY = 'auto';
                    }
                });
            }
        }
        
        function closeGroupValidationErrorModal() {
            const modal = document.getElementById('group-validation-error-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        }

        function runSyncAttendanceAndRetry(syncAndRetry) {
            const { ride, assignedCoachIds, assignedRiderIds, action } = syncAndRetry;
            const normalizeId = (id) => { const n = typeof id === 'string' ? parseInt(id, 10) : id; return Number.isFinite(n) ? n : id; };
            const isAssignedCoach = (id) => { const n = normalizeId(id); return assignedCoachIds.has(n) || assignedCoachIds.has(String(n)); };
            const isAssignedRider = (id) => { const n = normalizeId(id); return assignedRiderIds.has(n) || assignedRiderIds.has(String(n)); };

            ride.availableCoaches = (ride.availableCoaches || []).filter(isAssignedCoach);
            ride.availableRiders = (ride.availableRiders || []).filter(isAssignedRider);

            saveRideToDB(ride);
            if (typeof updateRide === 'function') {
                try {
                    const dbData = { available_coaches: ride.availableCoaches, available_riders: ride.availableRiders };
                    updateRide(ride.id, dbData);
                } catch (e) {
                    console.warn('Supabase update after sync attendance:', e);
                }
            }

            closeGroupValidationErrorModal();
            if (action === 'publish') {
                publishGroupAssignments();
            } else if (action === 'print') {
                printGroupAssignments();
            }
        }
        
        async function publishGroupAssignments() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No ride selected. Please select a ride first.');
                return;
            }

            if (!Array.isArray(ride.groups) || ride.groups.length === 0) {
                alert('No groups to publish. Please create groups first.');
                return;
            }

            // Validate before publishing - check for unassigned attendees first (only those marked attending)
            const allErrors = [];
            
            const normalizeId = (id) => { const n = typeof id === 'string' ? parseInt(id, 10) : id; return Number.isFinite(n) ? n : id; };
            const addAssigned = (set, id) => { const n = normalizeId(id); if (Number.isFinite(n)) { set.add(n); set.add(String(n)); } };
            
            const assignedRiderIds = new Set();
            const assignedCoachIds = new Set();
            ride.groups.forEach(group => {
                if (Array.isArray(group.riders)) {
                    group.riders.forEach(riderId => addAssigned(assignedRiderIds, riderId));
                }
                if (group.coaches) {
                    if (group.coaches.leader) addAssigned(assignedCoachIds, group.coaches.leader);
                    if (group.coaches.sweep) addAssigned(assignedCoachIds, group.coaches.sweep);
                    if (group.coaches.roam) addAssigned(assignedCoachIds, group.coaches.roam);
                    if (Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam.forEach(id => { if (id != null && id !== '') addAssigned(assignedCoachIds, id); });
                    }
                }
            });
            
            // Only coaches in ride.availableCoaches (marked attending) need to be assigned; absent coaches are ignored
            const isRefined = isRideRefined(ride);
            const ridersToCheck = isRefined ? getFilteredRiderIdsForRide(ride) : (ride.availableRiders || []);
            const availableRiderIds = new Set(ridersToCheck.map(id => normalizeId(id)).filter(id => Number.isFinite(id)));
            const availableCoachIds = new Set((ride.availableCoaches || []).map(id => normalizeId(id)).filter(id => Number.isFinite(id)));
            
            const unassignedRiders = Array.from(availableRiderIds).filter(id => !assignedRiderIds.has(id) && !assignedRiderIds.has(String(id)));
            const unassignedCoaches = Array.from(availableCoachIds).filter(id => !assignedCoachIds.has(id) && !assignedCoachIds.has(String(id)));
            
            // Debug: why are coaches considered unassigned? (helps trace type/source mismatch)
            console.log('🔴 PUBLISH VALIDATION (unassigned coaches)', {
                rideId: ride.id,
                rideDate: ride.date,
                rideAvailableCoachesRaw: ride.availableCoaches,
                rideAvailableCoachesLength: (ride.availableCoaches || []).length,
                rideAvailableCoachesTypes: (ride.availableCoaches || []).slice(0, 5).map(id => ({ id, type: typeof id })),
                groupsCoachIds: ride.groups.map((g, i) => ({
                    groupIndex: i,
                    label: g.label,
                    leader: g.coaches?.leader,
                    leaderType: g.coaches?.leader != null ? typeof g.coaches.leader : null,
                    sweep: g.coaches?.sweep,
                    roam: g.coaches?.roam,
                    extraRoam: g.coaches?.extraRoam
                })),
                assignedCoachIdsSize: assignedCoachIds.size,
                assignedCoachIdsSample: Array.from(assignedCoachIds).slice(0, 20),
                availableCoachIdsSize: availableCoachIds.size,
                availableCoachIdsSample: Array.from(availableCoachIds).slice(0, 20),
                unassignedCoachesCount: unassignedCoaches.length,
                unassignedCoachIds: unassignedCoaches
            });
            unassignedCoaches.forEach(id => {
                const coach = getCoachById(id);
                console.log('🔴 Unassigned coach detail', {
                    id,
                    idType: typeof id,
                    hasNumber: assignedCoachIds.has(id),
                    hasString: assignedCoachIds.has(String(id)),
                    name: coach ? coach.name : null
                });
            });
            
            if (unassignedRiders.length > 0) {
                const riderNames = unassignedRiders.map(id => {
                    const rider = getRiderById(id);
                    return rider ? rider.name : `Rider ${id}`;
                }).slice(0, 5); // Show first 5 names
                const moreCount = unassignedRiders.length > 5 ? ` and ${unassignedRiders.length - 5} more` : '';
                allErrors.push(`${unassignedRiders.length} unassigned rider${unassignedRiders.length !== 1 ? 's' : ''}: ${riderNames.join(', ')}${moreCount}`);
            }
            
            if (unassignedCoaches.length > 0) {
                const coachNames = unassignedCoaches.map(id => {
                    const coach = getCoachById(id);
                    return coach ? coach.name : `Coach ${id}`;
                }).slice(0, 5); // Show first 5 names
                const moreCount = unassignedCoaches.length > 5 ? ` and ${unassignedCoaches.length - 5} more` : '';
                allErrors.push(`${unassignedCoaches.length} unassigned coach${unassignedCoaches.length !== 1 ? 'es' : ''}: ${coachNames.join(', ')}${moreCount}`);
            }
            
            // Then check group-specific errors
            const groupErrors = [];
            ride.groups.forEach((group, index) => {
                const groupLabel = group.label || `Group ${index + 1}`;
                const issues = [];
                
                // Check if group is compliant
                if (!checkGroupCompliance(group)) {
                    issues.push('not compliant (missing leader, missing coaches, or over capacity)');
                }
                
                // Check if route is assigned (but allow "Ride Leader's Choice")
                if (!group.routeId || group.routeId === '') {
                    issues.push('no route assigned');
                }
                
                // Only add error if there are issues
                if (issues.length > 0) {
                    groupErrors.push(`${groupLabel}: ${issues.join(', ')}`);
                }
            });
            
            // Combine all errors (unassigned first, then group errors)
            allErrors.push(...groupErrors);
            
            if (allErrors.length > 0) {
                const syncAndRetry = (groupErrors.length === 0) ? { ride, assignedCoachIds, assignedRiderIds, action: 'publish' } : null;
                showGroupValidationErrorModal('Cannot publish group assignments', allErrors, syncAndRetry ? { syncAndRetry } : {});
                return;
            }

            if (!confirm('Publish group assignments? This will make the groups visible to coaches and riders.')) {
                return;
            }

            try {
                // Mark groups as published
                ride.publishedGroups = true;
                
                // Save to database
                saveRideToDB(ride);
                
                // Also save to Supabase if available
                if (typeof updateRide === 'function') {
                    try {
                        await updateRide(ride.id, {
                            publishedGroups: true,
                            groups: ride.groups
                        });
                    } catch (error) {
                        console.warn('Could not save to Supabase:', error);
                        // Continue anyway - local save succeeded
                    }
                }
                
                // Refresh views
                renderAssignments(ride);
                renderRideAssignments();
                renderCoachAssignments();
                
                alert('Group assignments published successfully!');
            } catch (error) {
                console.error('Error publishing group assignments:', error);
                alert('Error publishing group assignments. Please try again.');
            }
        }

        async function unpublishGroupAssignments() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No ride selected. Please select a ride first.');
                return;
            }

            if (!confirm('Unpublish group assignments? This will hide the groups from coaches and riders until they are published again.')) {
                return;
            }

            try {
                // Mark groups as unpublished
                ride.publishedGroups = false;
                
                // Save to database
                saveRideToDB(ride);
                
                // Also save to Supabase if available
                if (typeof updateRide === 'function') {
                    try {
                        await updateRide(ride.id, {
                            publishedGroups: false,
                            groups: ride.groups
                        });
                    } catch (error) {
                        console.warn('Could not save to Supabase:', error);
                        // Continue anyway - local save succeeded
                    }
                }
                
                // Refresh views
                renderAssignments(ride);
                renderRideAssignments();
                renderCoachAssignments();
                
                alert('Group assignments unpublished successfully.');
            } catch (error) {
                console.error('Error unpublishing group assignments:', error);
                alert('Error unpublishing group assignments. Please try again.');
            }
        }

        async function sendGroupAssignmentNotification() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No ride selected. Please select a ride first.');
                return;
            }

            if (!Array.isArray(ride.groups) || ride.groups.length === 0) {
                alert('No groups to notify about. Please create groups first.');
                return;
            }

            if (!ride.publishedGroups) {
                if (!confirm('Groups are not yet published. Do you want to publish them and send the notification?')) {
                    return;
                }
                // Publish first
                ride.publishedGroups = true;
                saveRideToDB(ride);
                if (typeof updateRide === 'function') {
                    try {
                        await updateRide(ride.id, {
                            publishedGroups: true,
                            groups: ride.groups
                        });
                    } catch (error) {
                        console.warn('Could not save to Supabase:', error);
                    }
                }
                renderAssignments(ride);
                renderRideAssignments();
                renderCoachAssignments();
            }

            try {
                // Send SMS notification
                await sendSMSNotification('4153597951', 'Ride Group Assignments are ready!');
                alert('Notification sent successfully!');
            } catch (error) {
                console.error('Error sending notification:', error);
                alert('Error sending notification. Please try again.');
            }
        }

        // Helper function to format date as short format (e.g., "1-14" for January 14)
        function formatShortDate(dateString) {
            const rideDate = parseISODate(dateString);
            if (!rideDate) return '';
            const month = rideDate.getMonth() + 1; // 1-12
            const day = rideDate.getDate(); // 1-31
            return `${month}-${day}`;
        }

        function printGroupAssignments() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) {
                alert('No ride selected. Please select a ride first.');
                return;
            }

            if (!Array.isArray(ride.groups) || ride.groups.length === 0) {
                alert('No groups to print. Please create groups first.');
                return;
            }

            // Validate before printing - check for unassigned attendees first (only those marked attending)
            const allErrors = [];
            
            const normalizeId = (id) => { const n = typeof id === 'string' ? parseInt(id, 10) : id; return Number.isFinite(n) ? n : id; };
            const addAssigned = (set, id) => { const n = normalizeId(id); if (Number.isFinite(n)) { set.add(n); set.add(String(n)); } };
            
            const assignedRiderIds = new Set();
            const assignedCoachIds = new Set();
            ride.groups.forEach(group => {
                if (Array.isArray(group.riders)) {
                    group.riders.forEach(riderId => addAssigned(assignedRiderIds, riderId));
                }
                if (group.coaches) {
                    if (group.coaches.leader) addAssigned(assignedCoachIds, group.coaches.leader);
                    if (group.coaches.sweep) addAssigned(assignedCoachIds, group.coaches.sweep);
                    if (group.coaches.roam) addAssigned(assignedCoachIds, group.coaches.roam);
                    if (Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam.forEach(id => { if (id != null && id !== '') addAssigned(assignedCoachIds, id); });
                    }
                }
            });
            
            // Only coaches in ride.availableCoaches (marked attending) need to be assigned; absent coaches are ignored
            const isRefined = isRideRefined(ride);
            const ridersToCheck = isRefined ? getFilteredRiderIdsForRide(ride) : (ride.availableRiders || []);
            const availableRiderIds = new Set(ridersToCheck.map(id => normalizeId(id)).filter(id => Number.isFinite(id)));
            const availableCoachIds = new Set((ride.availableCoaches || []).map(id => normalizeId(id)).filter(id => Number.isFinite(id)));
            
            const unassignedRiders = Array.from(availableRiderIds).filter(id => !assignedRiderIds.has(id) && !assignedRiderIds.has(String(id)));
            const unassignedCoaches = Array.from(availableCoachIds).filter(id => !assignedCoachIds.has(id) && !assignedCoachIds.has(String(id)));
            
            // Debug: trace why coaches counted as unassigned (same as publish)
            console.log('🔴 PRINT VALIDATION (unassigned coaches)', {
                rideId: ride.id,
                rideDate: ride.date,
                rideAvailableCoachesRaw: ride.availableCoaches,
                rideAvailableCoachesLength: (ride.availableCoaches || []).length,
                groupsCoachIds: ride.groups.map((g, i) => ({ groupIndex: i, label: g.label, leader: g.coaches?.leader, leaderType: g.coaches?.leader != null ? typeof g.coaches.leader : null, sweep: g.coaches?.sweep, roam: g.coaches?.roam, extraRoam: g.coaches?.extraRoam })),
                assignedCoachIdsSize: assignedCoachIds.size,
                assignedCoachIdsSample: Array.from(assignedCoachIds).slice(0, 20),
                availableCoachIdsSize: availableCoachIds.size,
                availableCoachIdsSample: Array.from(availableCoachIds).slice(0, 20),
                unassignedCoachesCount: unassignedCoaches.length,
                unassignedCoachIds: unassignedCoaches
            });
            unassignedCoaches.forEach(id => {
                const coach = getCoachById(id);
                console.log('🔴 [Print] Unassigned coach detail', { id, idType: typeof id, hasNumber: assignedCoachIds.has(id), hasString: assignedCoachIds.has(String(id)), name: coach ? coach.name : null });
            });
            
            if (unassignedRiders.length > 0) {
                const riderNames = unassignedRiders.map(id => {
                    const rider = getRiderById(id);
                    return rider ? rider.name : `Rider ${id}`;
                }).slice(0, 5); // Show first 5 names
                const moreCount = unassignedRiders.length > 5 ? ` and ${unassignedRiders.length - 5} more` : '';
                allErrors.push(`${unassignedRiders.length} unassigned rider${unassignedRiders.length !== 1 ? 's' : ''}: ${riderNames.join(', ')}${moreCount}`);
            }
            
            if (unassignedCoaches.length > 0) {
                const coachNames = unassignedCoaches.map(id => {
                    const coach = getCoachById(id);
                    return coach ? coach.name : `Coach ${id}`;
                }).slice(0, 5); // Show first 5 names
                const moreCount = unassignedCoaches.length > 5 ? ` and ${unassignedCoaches.length - 5} more` : '';
                allErrors.push(`${unassignedCoaches.length} unassigned coach${unassignedCoaches.length !== 1 ? 'es' : ''}: ${coachNames.join(', ')}${moreCount}`);
            }
            
            // Then check group-specific errors
            const groupErrors = [];
            ride.groups.forEach((group, index) => {
                const groupLabel = group.label || `Group ${index + 1}`;
                const issues = [];
                
                // Check if group is compliant
                if (!checkGroupCompliance(group)) {
                    issues.push('not compliant (missing leader, missing coaches, or over capacity)');
                }
                
                // Check if route is assigned (but allow "Ride Leader's Choice")
                if (!group.routeId || group.routeId === '') {
                    issues.push('no route assigned');
                }
                
                // Only add error if there are issues
                if (issues.length > 0) {
                    groupErrors.push(`${groupLabel}: ${issues.join(', ')}`);
                }
            });
            
            // Combine all errors (unassigned first, then group errors)
            allErrors.push(...groupErrors);
            
            if (allErrors.length > 0) {
                const syncAndRetry = (groupErrors.length === 0) ? { ride, assignedCoachIds, assignedRiderIds, action: 'print' } : null;
                showGroupValidationErrorModal('Cannot print group assignments', allErrors, syncAndRetry ? { syncAndRetry } : {});
                return;
            }

            try {
                // Check if jsPDF is available
                if (typeof window.jspdf === 'undefined') {
                    alert('PDF library not loaded. Please refresh the page and try again.');
                    return;
                }

                // Generate both PDFs and HTML export
                generateMobileFriendlyPDF(ride);
                generateDesktopPrintFriendlyPDF(ride);
                generateHTMLExport(ride);
                
            } catch (error) {
                console.error('Error generating exports:', error);
                alert('Error generating exports. Please try again.');
            }
        }

        function generateHTMLExport(ride) {
            try {
                const rideDate = parseISODate(ride.date);
                const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                }) : ride.date;
                
                const practice = getPracticeSettingsForRide(ride);
                const practiceTime = ride.startTime || ride.time || (practice ? practice.time : '');
                const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
                const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
                const goals = (ride.goals || '').trim();

                // Format time display
                let timeDisplay = '';
                if (practiceTime) {
                    const formattedStart = formatTimeForDisplay(practiceTime);
                    if (practiceEndTime) {
                        const formattedEnd = formatTimeForDisplay(practiceEndTime);
                        timeDisplay = `${formattedStart} - ${formattedEnd}`;
                    } else {
                        timeDisplay = formattedStart;
                    }
                }

                // Sort groups (alphabetically by color name when using color names, else by number)
                const useColorNamesForExport = rideUsesGroupColorNames(ride);
                const sortedGroups = getSortedGroupsForPrintOrPublish(ride);

                // Generate groups HTML with collapsible functionality matching the tab
                let groupsHtmlWithCollapse = '';
                sortedGroups.forEach((group, index) => {
                    const groupId = `group-${group.id || index}`;
                    const groupTitle = getGroupDisplayTitleForPrint(group, index, useColorNamesForExport);
                    const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                    const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                    const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                    const extraRoam = Array.isArray(group.coaches?.extraRoam) 
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean)
                        : [];
                    
                    const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                    const routeDisplay = getRouteDisplayForGroup(group);
                    
                    // Build coaches with their roles
                    const coachesWithRoles = [];
                    if (leader) coachesWithRoles.push({ coach: leader, role: 'Leader' });
                    if (sweep) coachesWithRoles.push({ coach: sweep, role: 'Sweep' });
                    if (roam) coachesWithRoles.push({ coach: roam, role: 'Roam' });
                    extraRoam.forEach(coach => {
                        coachesWithRoles.push({ coach, role: 'Roam+' });
                    });

                    // Render rider cards (without badges)
                    const riderCardsHtml = riders.map(rider => {
                        const name = rider.name || 'Rider';
                        const safeName = escapeHtml(name);
                        const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
                        // Only use photos if they're data URLs (base64 embedded), otherwise omit to avoid broken links
                        const photoSrc = rider.photo && rider.photo.startsWith('data:') ? rider.photo : null;
                        const photo = photoSrc ? escapeHtml(photoSrc) : '';
                        return '<div class="rider-card compact" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px;">' +
                            '<div class="avatar-circle" style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #e0e0e0; display: flex; align-items: center; justify-content: center;">' +
                            (photo ? '<img src="' + photo + '" alt="' + safeName + '" style="width: 100%; height: 100%; object-fit: cover;">' : '<span style="font-size: 18px; color: #666;">' + initial + '</span>') +
                            '</div>' +
                            '<div style="flex: 1; min-width: 0;">' +
                            '<strong style="font-size: 14px;">' + safeName + '</strong>' +
                            '</div>' +
                            '</div>';
                    }).join('');

                    groupsHtmlWithCollapse += `
                        <div class="mobile-group-card" style="margin-bottom: 0; border: 1px solid #ddd; border-radius: 0; overflow: hidden; background: white; border-top: ${index === 0 ? '1px solid #ddd' : 'none'};">
                            <button class="mobile-group-header" onclick="toggleMobileGroup('${groupId}')" style="width: 100%; padding: 8px 16px; background: #f5f5f5; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600; color: #333;">
                                <span>${escapeHtml(groupTitle)}</span>
                                <span class="mobile-group-toggle" id="toggle-${groupId}" style="font-size: 20px; transition: transform 0.2s;">▼</span>
                            </button>
                            <div class="mobile-group-content" id="${groupId}" style="display: block; padding: 16px;">
                                ${riders.length > 0 ? `
                                    <div style="margin-bottom: ${coachesWithRoles.length > 0 ? '20px' : '0'};">
                                        <div style="display: flex; flex-direction: column; gap: 2px;">
                                            ${riderCardsHtml}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${coachesWithRoles.length > 0 ? `
                                    <div style="margin-top: ${riders.length > 0 ? '20px' : '0'}; margin-bottom: 16px;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;">Ride Leaders</h3>
                                        <div style="display: flex; flex-direction: column; gap: 2px;">
                                            ${coachesWithRoles.map(({ coach, role }) => {
                                                const name = coach.name || 'Coach';
                                                const safeName = escapeHtml(name);
                                                const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
                                                // Only use photos if they're data URLs (base64 embedded), otherwise omit to avoid broken links
                                                const photoSrc = coach.photo && coach.photo.startsWith('data:') ? coach.photo : null;
                                                const photo = photoSrc ? escapeHtml(photoSrc) : '';
                                                return `
                                                    <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                                                        <div class="avatar-circle" style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: #e0e0e0; display: flex; align-items: center; justify-content: center;">
                                                            ${photo ? '<img src="' + photo + '" alt="' + safeName + '" style="width: 100%; height: 100%; object-fit: cover;">' : '<span style="font-size: 18px; color: #666;">' + initial + '</span>'}
                                                        </div>
                                                        <div style="flex: 1; min-width: 0;">
                                                            <strong style="font-size: 14px;">${safeName}</strong>
                                                            <span style="margin-left: 8px; padding: 2px 8px; background: #e3f2fd; color: #1976D2; border-radius: 12px; font-size: 11px; font-weight: 500;">${escapeHtml(role)}</span>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${routeDisplay.displayName ? `
                                    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                                        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #666;">Route</h4>
                                        <div style="font-size: 14px; color: #333;">
                                            <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(routeDisplay.displayName)}</div>
                                            ${routeDisplay.route && (routeDisplay.route.distance || routeDisplay.route.elevation) ? `
                                                <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                                    ${routeDisplay.route.distance ? '<span>' + escapeHtml(routeDisplay.route.distance) + '</span>' : ''}
                                                    ${routeDisplay.route.distance && routeDisplay.route.elevation ? ' · ' : ''}
                                                    ${routeDisplay.route.elevation ? '<span>' + escapeHtml(routeDisplay.route.elevation) + '</span>' : ''}
                                                </div>
                                            ` : ''}
                                            ${!routeDisplay.isLeaderChoice && routeDisplay.stravaUrl ? `
                                                <a href="${escapeHtml(routeDisplay.stravaUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; font-size: 12px; color: #FC4C02; text-decoration: none; font-weight: 500;">
                                                    View Full Map on Strava →
                                                </a>
                                            ` : ''}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });

                const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Assignments - ${escapeHtml(dateDisplay)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            margin: 0;
            background: white;
            padding: 20px;
            box-sizing: border-box;
        }
        h1 {
            font-size: 28px;
            margin-bottom: 8px;
            color: #333;
        }
        h2 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #666;
        }
        .info-section {
            margin-bottom: 24px;
            padding: 16px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .goals-section {
            padding: 12px;
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            border-radius: 4px;
            margin-bottom: 24px;
        }
        .goals-section strong {
            display: block;
            margin-bottom: 4px;
            color: #1976D2;
        }
        .mobile-group-header {
            transition: background-color 0.2s;
        }
        .mobile-group-header:hover {
            background-color: #e8e8e8 !important;
        }
        .mobile-group-content {
            transition: all 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Tam High MTB Team</h1>
        <h2>Group Assignments</h2>
        
        <div class="info-section">
            <div style="margin-bottom: 6px;"><strong>Date:</strong> ${escapeHtml(dateDisplay)}</div>
            ${timeDisplay ? `<div style="margin-bottom: 6px;"><strong>Time:</strong> ${escapeHtml(timeDisplay)}</div>` : ''}
            ${practiceLocation ? `<div><strong>Location:</strong> ${escapeHtml(practiceLocation)}</div>` : ''}
        </div>
        
        ${goals ? `
            <div class="goals-section">
                <strong>Practice Goals:</strong>
                <span>${escapeHtml(goals)}</span>
            </div>
        ` : ''}
        
        <div class="mobile-assignment-groups">
            ${groupsHtmlWithCollapse}
        </div>
    </div>
    
    <script>
        function toggleMobileGroup(groupId) {
            const content = document.getElementById(groupId);
            const toggle = document.getElementById('toggle-' + groupId);
            
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▲' : '▼';
            toggle.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    <\/script>
</body>
</html>`;

                // Create blob and download
                const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const shortDate = formatShortDate(ride.date);
                const filename = `Groups for ${shortDate}.html`;
                
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
            } catch (error) {
                console.error('Error generating HTML export:', error);
                alert('Error generating HTML export. Please try again.');
            }
        }

        // Generate mobile-friendly PDF (existing format)
        function generateMobileFriendlyPDF(ride) {
            try {
                const { jsPDF } = window.jspdf;

                const rideDate = parseISODate(ride.date);
                const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                }) : ride.date;

                const practice = getPracticeSettingsForRide(ride);
                const practiceTime = ride.startTime || ride.time || (practice ? practice.time : '');
                const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
                const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
                const goals = (ride.goals || '').trim();

                let timeDisplay = '';
                if (practiceTime) {
                    const formattedStart = formatTimeForDisplay(practiceTime);
                    if (practiceEndTime) {
                        timeDisplay = `${formattedStart} - ${formatTimeForDisplay(practiceEndTime)}`;
                    } else {
                        timeDisplay = formattedStart;
                    }
                }

                const mobileWidth = 90;
                const margin = 8;
                const maxWidth = mobileWidth - (margin * 2);

                const useColorNamesMobile = rideUsesGroupColorNames(ride);
                const sortedGroups = getSortedGroupsForPrintOrPublish(ride);

                // --- Precise height measurement pass ---
                // Create a temporary doc just to get accurate splitTextToSize results
                const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mobileWidth, 5000] });
                let measuredY = margin;

                // Header
                measuredY += 6; // team name
                measuredY += 7; // subtitle
                measuredY += 5; // date
                if (timeDisplay) measuredY += 5;
                if (practiceLocation) measuredY += 5;
                if (goals) {
                    measuredY += 3; // gap
                    measuredY += 5; // label
                    tempDoc.setFontSize(9);
                    measuredY += tempDoc.splitTextToSize(goals, maxWidth).length * 5;
                }
                measuredY += 5; // space before groups

                sortedGroups.forEach((group) => {
                    measuredY += 6; // group title

                    const coachesList = [];
                    const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                    const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                    const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                    const extraRoam = Array.isArray(group.coaches?.extraRoam)
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean) : [];
                    if (leader) coachesList.push(1);
                    if (sweep) coachesList.push(1);
                    if (roam) coachesList.push(1);
                    extraRoam.forEach(() => coachesList.push(1));
                    const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                    const routeDisplay = getRouteDisplayForGroup(group);

                    measuredY += 5; // "Ride Leaders:" label
                    measuredY += Math.max(coachesList.length, 1) * 5; // coach names or "No coaches"
                    measuredY += 2; // gap

                    measuredY += 5; // "Riders:" label
                    measuredY += Math.max(riders.length, 1) * 5; // rider names or "No riders"

                    if (routeDisplay.displayName) {
                        measuredY += 2; // gap
                        measuredY += 5; // "Route:" label
                        tempDoc.setFontSize(11);
                        const routeLines = tempDoc.splitTextToSize(routeDisplay.displayName, maxWidth);
                        const routeLineH = 11 * 0.4; // fontSize * 0.4
                        measuredY += routeLines.length * routeLineH;
                        measuredY += 6; // space after route name
                        measuredY += 7; // space after button

                        if (routeDisplay.route && (routeDisplay.route.distance || routeDisplay.route.elevation)) {
                            measuredY += 5;
                        }
                    }

                    measuredY += 8; // spacing between groups
                });

                const customPageHeight = measuredY + 10; // 10mm fixed buffer

                // --- Create the real doc with precise height ---
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: [mobileWidth, customPageHeight]
                });

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                let yPos = margin;

                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                doc.text('Tam High MTB Team', margin, yPos);
                yPos += 6;

                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text('Group Assignments', margin, yPos);
                yPos += 7;

                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.text(`Date: ${dateDisplay}`, margin, yPos);
                yPos += 5;

                if (timeDisplay) {
                    doc.text(`Time: ${timeDisplay}`, margin, yPos);
                    yPos += 5;
                }

                if (practiceLocation) {
                    doc.text(`Location: ${practiceLocation}`, margin, yPos);
                    yPos += 5;
                }

                if (goals) {
                    yPos += 3;
                    doc.setFont(undefined, 'bold');
                    doc.text('Practice Goals:', margin, yPos);
                    yPos += 5;
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(9);
                    const goalsLines = doc.splitTextToSize(goals, maxWidth);
                    doc.text(goalsLines, margin, yPos);
                    yPos += goalsLines.length * 5;
                    doc.setFontSize(10);
                }

                yPos += 5;

                const bookmarks = [];

                sortedGroups.forEach((group, index) => {
                    const groupLabel = getGroupDisplayTitleForPrint(group, index, useColorNamesMobile);
                    const bookmarkY = yPos;

                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(33, 150, 243);
                    doc.text(groupLabel, margin, yPos);
                    yPos += 6;

                    const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                    const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                    const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                    const extraRoam = Array.isArray(group.coaches?.extraRoam)
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean) : [];
                    const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                    const routeDisplay = getRouteDisplayForGroup(group);

                    doc.setFontSize(9);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text('Ride Leaders:', margin, yPos);
                    yPos += 5;

                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(11);
                    const coachesList = [];
                    if (leader) coachesList.push(`${leader.name || 'Coach'} (Leader)`);
                    if (sweep) coachesList.push(`${sweep.name || 'Coach'} (Sweep)`);
                    if (roam) coachesList.push(`${roam.name || 'Coach'} (Roam)`);
                    extraRoam.forEach(coach => coachesList.push(`${coach.name || 'Coach'} (Roam+)`));

                    if (coachesList.length > 0) {
                        coachesList.forEach(coachText => {
                            doc.text(coachText, margin, yPos);
                            yPos += 5;
                        });
                    } else {
                        doc.text('No coaches assigned', margin, yPos);
                        yPos += 5;
                    }

                    yPos += 2;

                    doc.setFontSize(9);
                    doc.setFont(undefined, 'bold');
                    doc.text(`Riders (${riders.length}):`, margin, yPos);
                    yPos += 5;

                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(11);
                    if (riders.length > 0) {
                        riders.forEach(rider => {
                            doc.text(`${rider.name || 'Rider'}`, margin, yPos);
                            yPos += 5;
                        });
                    } else {
                        doc.text('No riders assigned', margin, yPos);
                        yPos += 5;
                    }

                    if (routeDisplay.displayName) {
                        yPos += 2;
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'bold');
                        doc.text('Route:', margin, yPos);
                        yPos += 5;
                        doc.setFont(undefined, 'normal');
                        doc.setFontSize(11);

                        const stravaUrl = routeDisplay.isLeaderChoice ? null : routeDisplay.stravaUrl;
                        const routeName = routeDisplay.displayName;
                        const routeNameLines = doc.splitTextToSize(routeName, maxWidth);
                        let maxRouteNameWidth = 0;
                        routeNameLines.forEach(line => {
                            maxRouteNameWidth = Math.max(maxRouteNameWidth, doc.getTextWidth(line));
                        });

                        if (stravaUrl && typeof doc.textWithLink === 'function') {
                            doc.setTextColor(0, 0, 255);
                            let currentY = yPos;
                            routeNameLines.forEach(line => {
                                doc.textWithLink(line, margin, currentY, { url: stravaUrl });
                                const lineWidth = doc.getTextWidth(line);
                                doc.setDrawColor(0, 0, 255);
                                doc.setLineWidth(0.3);
                                doc.line(margin, currentY + 1.5, margin + lineWidth, currentY + 1.5);
                                currentY += doc.getFontSize() * 0.4;
                            });
                            yPos = currentY;
                        } else if (stravaUrl) {
                            doc.setTextColor(0, 0, 255);
                            doc.text(routeNameLines, margin, yPos);
                            routeNameLines.forEach((line, lineIndex) => {
                                const lineWidth = doc.getTextWidth(line);
                                const lineY = yPos + (lineIndex * (doc.getFontSize() * 0.4));
                                doc.setDrawColor(0, 0, 255);
                                doc.setLineWidth(0.3);
                                doc.line(margin, lineY + 1.5, margin + lineWidth, lineY + 1.5);
                            });
                            const totalTextHeight = routeNameLines.length * (doc.getFontSize() * 0.4);
                            const textBaselineFromBottom = pageHeight - yPos;
                            const linkBottom = textBaselineFromBottom - totalTextHeight - (doc.getFontSize() * 0.4) * 0.3;
                            const linkHeight = totalTextHeight + (doc.getFontSize() * 0.4) * 0.6;
                            yPos += totalTextHeight;
                            try {
                                doc.link(margin, linkBottom, maxRouteNameWidth, linkHeight, { url: stravaUrl });
                            } catch (error) {
                                console.error('Error adding link to PDF:', error);
                            }
                        } else {
                            doc.setTextColor(0, 0, 0);
                            doc.text(routeNameLines, margin, yPos);
                            yPos += routeNameLines.length * (doc.getFontSize() * 0.4);
                        }

                        doc.setTextColor(0, 0, 0);
                        doc.setDrawColor(0, 0, 0);
                        doc.setFontSize(8);
                        yPos += 6;

                        doc.setFont(undefined, 'normal');
                        doc.setFontSize(8);
                        yPos += 7;

                        if (routeDisplay.route && (routeDisplay.route.distance || routeDisplay.route.elevation)) {
                            const routeDetails = [];
                            if (routeDisplay.route.distance) routeDetails.push(routeDisplay.route.distance);
                            if (routeDisplay.route.elevation) routeDetails.push(routeDisplay.route.elevation);
                            doc.text(routeDetails.join(' / '), margin + 5, yPos);
                            yPos += 5;
                        }
                    }

                    yPos += 8;

                    bookmarks.push({ title: groupLabel, top: bookmarkY, left: margin, level: 0 });
                });

                if (bookmarks.length > 0 && doc.outline) {
                    bookmarks.forEach(bookmark => {
                        doc.outline.add(null, bookmark.title, { top: bookmark.top, left: bookmark.left });
                    });
                }

                const shortDate = formatShortDate(ride.date);
                const filename = `Groups for ${shortDate}_mobile-friendly.pdf`;

                try {
                    if (doc.internal && doc.internal.put) {
                        doc.internal.put('/OpenAction', `[0 /XYZ null null 1.0]`);
                    }
                } catch (e) {
                    // PDF zoom hint not critical
                }

                doc.save(filename);

            } catch (error) {
                console.error('Error generating mobile-friendly PDF:', error);
                throw error;
            }
        }

        // Generate desktop/print-friendly PDF (letter-sized with boxes around groups)
        function generateDesktopPrintFriendlyPDF(ride) {
            try {
                const { jsPDF } = window.jspdf;

                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'letter'
                });

                const rideDate = parseISODate(ride.date);
                const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                }) : ride.date;

                const practice = getPracticeSettingsForRide(ride);
                const practiceTime = ride.startTime || ride.time || (practice ? practice.time : '');
                const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
                const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
                const goals = (ride.goals || '').trim();

                let timeDisplay = '';
                if (practiceTime) {
                    const formattedStart = formatTimeForDisplay(practiceTime);
                    if (practiceEndTime) {
                        timeDisplay = `${formattedStart} - ${formatTimeForDisplay(practiceEndTime)}`;
                    } else {
                        timeDisplay = formattedStart;
                    }
                }

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 10;
                const maxWidth = pageWidth - (margin * 2);

                const useColorNamesDesktop = rideUsesGroupColorNames(ride);
                const sortedGroups = getSortedGroupsForPrintOrPublish(ride);

                const numColumns = 3;
                const columnGap = 3;
                const columnWidth = (maxWidth - (numColumns - 1) * columnGap) / numColumns;
                const rowGap = 4;

                // --- Scalable font/spacing system ---
                // Base sizes at scale 1.0; will be reduced if content overflows
                const BASE = {
                    teamNameFont: 20, teamNameLead: 7,
                    subtitleFont: 16, subtitleLead: 8,
                    infoFont: 11, infoLead: 6,
                    goalsLabelFont: 11, goalsFont: 10, goalsLineLead: 4.5,
                    groupTitleFont: 12, groupTitleLead: 5,
                    sectionLabelFont: 10, sectionLabelLead: 4.5,
                    bodyFont: 10, bodyLineLead: 4.5,
                    boxTopPad: 3, sectionGap: 3, boxBottomPad: 4,
                    titleTopPad: 4
                };

                function scaled(base, s) { return +(base * s).toFixed(2); }

                // Measure header height at a given scale
                function measureHeader(s) {
                    let h = 0;
                    h += scaled(BASE.teamNameLead, s);
                    h += scaled(BASE.subtitleLead, s);
                    h += scaled(BASE.infoLead, s); // date
                    if (timeDisplay) h += scaled(BASE.infoLead, s);
                    if (practiceLocation) h += scaled(BASE.infoLead, s);
                    if (goals) {
                        h += scaled(3, s); // space
                        h += scaled(BASE.infoLead, s); // label
                        doc.setFontSize(scaled(BASE.goalsFont, s));
                        const gl = doc.splitTextToSize(goals, maxWidth);
                        h += gl.length * scaled(BASE.goalsLineLead, s);
                    }
                    h += scaled(4, s); // space before groups
                    return h;
                }

                // Build group data and measure height at a given scale
                function measureGroups(s) {
                    return sortedGroups.map((group) => {
                        const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                        const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                        const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                        const extraRoam = Array.isArray(group.coaches?.extraRoam)
                            ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean) : [];
                        const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                        const routeDisplay = getRouteDisplayForGroup(group);

                        const coachesList = [];
                        if (leader) coachesList.push(`${leader.name || 'Coach'} (Leader)`);
                        if (sweep) coachesList.push(`${sweep.name || 'Coach'} (Sweep)`);
                        if (roam) coachesList.push(`${roam.name || 'Coach'} (Roam)`);
                        extraRoam.forEach(c => coachesList.push(`${c.name || 'Coach'} (Roam+)`));

                        const lh = scaled(BASE.bodyLineLead, s);
                        let height = scaled(BASE.titleTopPad, s);
                        height += scaled(BASE.groupTitleLead, s);
                        height += scaled(BASE.sectionLabelLead, s); // "Ride Leaders:"
                        doc.setFontSize(scaled(BASE.bodyFont, s));
                        if (coachesList.length > 0) {
                            coachesList.forEach(ct => {
                                height += doc.splitTextToSize(ct, columnWidth - 6).length * lh;
                            });
                        } else {
                            height += lh;
                        }
                        height += scaled(BASE.sectionGap, s);
                        height += scaled(BASE.sectionLabelLead, s); // "Riders:"
                        if (riders.length > 0) {
                            riders.forEach(r => {
                                height += doc.splitTextToSize(r.name || 'Rider', columnWidth - 6).length * lh;
                            });
                        } else {
                            height += lh;
                        }
                        if (routeDisplay.displayName) {
                            height += scaled(BASE.sectionGap, s);
                            height += scaled(BASE.sectionLabelLead, s); // "Route:"
                            height += doc.splitTextToSize(routeDisplay.displayName, columnWidth - 6).length * lh;
                        }
                        height += scaled(BASE.boxBottomPad, s);

                        return { group, height, routeDisplay, coachesList, riders };
                    });
                }

                // Calculate total groups height from measured group data
                function totalGroupsHeight(groupData, s) {
                    let total = 0;
                    for (let i = 0; i < groupData.length; i += numColumns) {
                        const row = groupData.slice(i, i + numColumns);
                        const maxH = Math.max(...row.map(g => g.height)) + scaled(BASE.groupTitleLead, s);
                        total += maxH + rowGap;
                    }
                    return total;
                }

                // Find optimal scale: try 1.0 first, step down if needed
                const availableHeight = pageHeight - margin * 2;
                let scale = 1.0;
                const MIN_SCALE = 0.65;
                let groupData, headerH, groupsH;

                for (let attempt = 0; attempt < 8; attempt++) {
                    headerH = measureHeader(scale);
                    groupData = measureGroups(scale);
                    groupsH = totalGroupsHeight(groupData, scale);
                    if (headerH + groupsH <= availableHeight || scale <= MIN_SCALE) break;
                    scale = Math.max(MIN_SCALE, scale - 0.05);
                }

                // --- Render header ---
                function renderHeader(isFirstPage) {
                    let yPos = margin;
                    if (isFirstPage) {
                        doc.setFontSize(scaled(BASE.teamNameFont, scale));
                        doc.setFont(undefined, 'bold');
                        doc.text('Tam High MTB Team', margin, yPos);
                        yPos += scaled(BASE.teamNameLead, scale);

                        doc.setFontSize(scaled(BASE.subtitleFont, scale));
                        doc.text('Group Assignments', margin, yPos);
                        yPos += scaled(BASE.subtitleLead, scale);

                        doc.setFontSize(scaled(BASE.infoFont, scale));
                        doc.setFont(undefined, 'normal');
                        doc.text(`Date: ${dateDisplay}`, margin, yPos);
                        yPos += scaled(BASE.infoLead, scale);

                        if (timeDisplay) {
                            doc.text(`Time: ${timeDisplay}`, margin, yPos);
                            yPos += scaled(BASE.infoLead, scale);
                        }
                        if (practiceLocation) {
                            doc.text(`Location: ${practiceLocation}`, margin, yPos);
                            yPos += scaled(BASE.infoLead, scale);
                        }
                        if (goals) {
                            yPos += scaled(3, scale);
                            doc.setFont(undefined, 'bold');
                            doc.text('Practice Goals:', margin, yPos);
                            yPos += scaled(BASE.infoLead, scale);
                            doc.setFont(undefined, 'normal');
                            doc.setFontSize(scaled(BASE.goalsFont, scale));
                            const goalsLines = doc.splitTextToSize(goals, maxWidth);
                            doc.text(goalsLines, margin, yPos);
                            yPos += goalsLines.length * scaled(BASE.goalsLineLead, scale);
                        }
                        yPos += scaled(4, scale);
                    } else {
                        doc.setFontSize(scaled(BASE.infoFont, scale));
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(120, 120, 120);
                        doc.text(`Group Assignments — ${dateDisplay} (continued)`, margin, yPos);
                        doc.setTextColor(0, 0, 0);
                        yPos += scaled(BASE.infoLead, scale) + 2;
                    }
                    return yPos;
                }

                // --- Render groups ---
                let currentY = renderHeader(true);
                const lh = scaled(BASE.bodyLineLead, scale);

                for (let rowIndex = 0; rowIndex < groupData.length; rowIndex += numColumns) {
                    const rowGroups = groupData.slice(rowIndex, rowIndex + numColumns);
                    const maxHeightInRow = Math.max(...rowGroups.map(g => g.height)) + scaled(BASE.groupTitleLead, scale);

                    // Page break if this row won't fit
                    if (currentY + maxHeightInRow > pageHeight - margin) {
                        doc.addPage();
                        currentY = renderHeader(false);
                    }

                    rowGroups.forEach((gd, colIndex) => {
                        const group = gd.group;
                        const boxX = margin + colIndex * (columnWidth + columnGap);
                        const groupIndex = rowIndex + colIndex;
                        const groupLabel = getGroupDisplayTitleForPrint(group, groupIndex, useColorNamesDesktop);

                        let contentY = currentY;
                        doc.setFontSize(scaled(BASE.groupTitleFont, scale));
                        doc.setFont(undefined, 'bold');
                        doc.setTextColor(33, 150, 243);
                        doc.text(groupLabel, boxX + 2, contentY);
                        contentY += scaled(BASE.groupTitleLead, scale);

                        const boxY = contentY;
                        doc.setDrawColor(200, 200, 200);
                        doc.setLineWidth(0.3);
                        const boxHeight = gd.height - scaled(BASE.titleTopPad, scale);
                        doc.rect(boxX, boxY, columnWidth, boxHeight);

                        contentY = boxY + scaled(BASE.boxTopPad, scale);

                        // Coaches
                        doc.setFontSize(scaled(BASE.sectionLabelFont, scale));
                        doc.setFont(undefined, 'bold');
                        doc.setTextColor(0, 0, 0);
                        doc.text('Ride Leaders:', boxX + 3, contentY);
                        contentY += scaled(BASE.sectionLabelLead, scale);

                        doc.setFont(undefined, 'normal');
                        doc.setFontSize(scaled(BASE.bodyFont, scale));
                        if (gd.coachesList.length > 0) {
                            gd.coachesList.forEach(ct => {
                                const wl = doc.splitTextToSize(ct, columnWidth - 6);
                                doc.text(wl, boxX + 3, contentY);
                                contentY += wl.length * lh;
                            });
                        } else {
                            doc.text('No coaches assigned', boxX + 3, contentY);
                            contentY += lh;
                        }

                        contentY += scaled(BASE.sectionGap, scale);

                        // Riders
                        doc.setFontSize(scaled(BASE.sectionLabelFont, scale));
                        doc.setFont(undefined, 'bold');
                        doc.text(`Riders (${gd.riders.length}):`, boxX + 3, contentY);
                        contentY += scaled(BASE.sectionLabelLead, scale);

                        doc.setFont(undefined, 'normal');
                        doc.setFontSize(scaled(BASE.bodyFont, scale));
                        if (gd.riders.length > 0) {
                            gd.riders.forEach(rider => {
                                const wl = doc.splitTextToSize(rider.name || 'Rider', columnWidth - 6);
                                doc.text(wl, boxX + 3, contentY);
                                contentY += wl.length * lh;
                            });
                        } else {
                            doc.text('No riders assigned', boxX + 3, contentY);
                            contentY += lh;
                        }

                        // Route
                        const routeDisplay = gd.routeDisplay;
                        if (routeDisplay.displayName) {
                            contentY += scaled(BASE.sectionGap, scale);
                            doc.setFontSize(scaled(BASE.sectionLabelFont, scale));
                            doc.setFont(undefined, 'bold');
                            doc.text('Route:', boxX + 3, contentY);
                            contentY += scaled(BASE.sectionLabelLead, scale);
                            doc.setFont(undefined, 'normal');
                            doc.setFontSize(scaled(BASE.bodyFont, scale));

                            const routeName = routeDisplay.displayName;
                            const stravaUrl = routeDisplay.isLeaderChoice ? null : routeDisplay.stravaUrl;
                            const routeNameLines = doc.splitTextToSize(routeName, columnWidth - 6);

                            if (stravaUrl) {
                                doc.setTextColor(0, 0, 255);
                                let ry = contentY;
                                routeNameLines.forEach(line => {
                                    if (typeof doc.textWithLink === 'function') {
                                        doc.textWithLink(line, boxX + 3, ry, { url: stravaUrl });
                                    } else {
                                        doc.text(line, boxX + 3, ry);
                                    }
                                    const lw = doc.getTextWidth(line);
                                    doc.setDrawColor(0, 0, 255);
                                    doc.setLineWidth(0.3);
                                    doc.line(boxX + 3, ry + 1.5, boxX + 3 + lw, ry + 1.5);
                                    ry += lh;
                                });
                                contentY = ry;
                            } else {
                                doc.setTextColor(0, 0, 0);
                                doc.text(routeNameLines, boxX + 3, contentY);
                                contentY += routeNameLines.length * lh;
                            }

                            doc.setTextColor(0, 0, 0);
                            doc.setDrawColor(0, 0, 0);
                        }
                    });

                    currentY += maxHeightInRow + rowGap;
                }

                const shortDate = formatShortDate(ride.date);
                doc.save(`Groups for ${shortDate}.pdf`);

            } catch (error) {
                console.error('Error generating desktop/print-friendly PDF:', error);
                throw error;
            }
        }

        async function checkAndAutoUnpublish(ride) {
            if (!ride || !ride.publishedGroups) return false; // Only check if published
            
            // Get practice end time
            const practice = getPracticeSettingsForRide(ride);
            const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
            
            if (!practiceEndTime) return false; // Can't check without end time
            
            // Get ride date
            const rideDate = parseISODate(ride.date);
            if (!rideDate) return false;
            
            // Parse end time (format: "HH:MM" or "HH:MM:SS")
            const timeParts = practiceEndTime.split(':');
            if (timeParts.length < 2) return false;
            
            const endHour = parseInt(timeParts[0], 10);
            const endMinute = parseInt(timeParts[1], 10);
            
            if (!Number.isFinite(endHour) || !Number.isFinite(endMinute)) return false;
            
            // Create practice end datetime
            const practiceEndDateTime = new Date(rideDate);
            practiceEndDateTime.setHours(endHour, endMinute, 0, 0);
            
            // Add 12 hours to get the unpublish time
            const unpublishDateTime = new Date(practiceEndDateTime);
            unpublishDateTime.setHours(unpublishDateTime.getHours() + 12);
            
            // Check if current time is past the unpublish time
            const now = new Date();
            if (now >= unpublishDateTime) {
                // Auto-unpublish
                ride.publishedGroups = false;
                saveRideToDB(ride);
                
                // Also save to Supabase if available
                if (typeof updateRide === 'function') {
                    try {
                        await updateRide(ride.id, {
                            publishedGroups: false,
                            groups: ride.groups
                        });
                    } catch (error) {
                        console.warn('Could not save auto-unpublish to Supabase:', error);
                    }
                }
                
                return true; // Indicates unpublish happened
            }
            
            return false; // No unpublish needed
        }

        function updatePublishButtons() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            const publishBtn = document.getElementById('publish-groups-btn');
            const unpublishBtn = document.getElementById('unpublish-groups-btn');
            const notificationBtn = document.getElementById('send-notification-btn');
            const printBtn = document.getElementById('print-groups-btn');
            
            if (!publishBtn || !unpublishBtn || !notificationBtn || !printBtn) return;
            
            if (!ride) {
                publishBtn.style.display = 'none';
                unpublishBtn.style.display = 'none';
                notificationBtn.style.display = 'none';
                printBtn.style.display = 'none';
                return;
            }
            
            const hasGroups = Array.isArray(ride.groups) && ride.groups.length > 0;
            const isPublished = ride.publishedGroups === true;
            
            if (hasGroups) {
                // Print button shows whenever there are groups (published or not)
                printBtn.style.display = 'block';
                
                if (isPublished) {
                    publishBtn.style.display = 'none';
                    unpublishBtn.style.display = 'block';
                    notificationBtn.style.display = 'block';
                } else {
                    publishBtn.style.display = 'block';
                    unpublishBtn.style.display = 'none';
                    notificationBtn.style.display = 'none';
                }
            } else {
                publishBtn.style.display = 'none';
                unpublishBtn.style.display = 'none';
                notificationBtn.style.display = 'none';
                printBtn.style.display = 'none';
            }
        }

        async function sendSMSNotification(phoneNumber, message) {
            // Remove any non-digit characters from phone number
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            
            // Format phone number for SMS (add +1 for US numbers if not present)
            let formattedPhone = cleanPhone;
            if (formattedPhone.length === 10) {
                formattedPhone = '+1' + formattedPhone;
            } else if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+' + formattedPhone;
            }
            
            try {
                // Try to use Supabase Edge Function for SMS if available
                const client = getSupabaseClient();
                if (client) {
                    try {
                        const { error } = await client.functions.invoke('send-sms', {
                            body: {
                                to: formattedPhone,
                                message: message
                            }
                        });
                        
                        if (error) {
                            console.warn('SMS Edge Function not available or failed:', error);
                            // Fall through to alternative method
                        } else {
                            console.log('SMS sent via Edge Function');
                            return;
                        }
                    } catch (error) {
                        console.warn('SMS Edge Function not available:', error);
                        // Fall through to alternative method
                    }
                }
                
                // Alternative: Use a simple HTTP endpoint if available
                // This would need to be configured on your server
                // For now, we'll log it and the user can set up SMS service later
                console.log('SMS notification requested:', {
                    to: formattedPhone,
                    message: message
                });
                
                // If you have a server endpoint for SMS, uncomment and configure:
                /*
                const response = await fetch('/api/send-sms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        to: formattedPhone,
                        message: message
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to send SMS');
                }
                */
                
                // For now, we'll just log it - user can set up SMS service (Twilio, etc.) later
                console.warn('SMS service not configured. Please set up SMS service to send notifications.');
                
            } catch (error) {
                console.error('Error sending SMS:', error);
                // Don't throw - SMS failure shouldn't block publishing
            }
        }

        // Assignment rendering and drag-drop
        async function renderAssignments(ride) {
            const container = document.getElementById('assignments');
            if (!container) return;
            
            // Check and auto-unpublish if 12 hours have passed
            if (ride) {
                await checkAndAutoUnpublish(ride);
            }
            
            // Note: updatePublishButtons() is called after container.innerHTML is set

            const groupPaceOrder = getGroupPaceOrderForRide(ride);
            ride.groupPaceOrder = groupPaceOrder;

            // Sort groups by fitness based on pace order setting
            ride.groups.sort(getGroupPaceComparator(ride));
            
            renumberGroups(ride);

            const coachAssignmentMap = getCoachAssignmentMap(ride);
            const assignedCoachIds = new Set(
                Object.keys(coachAssignmentMap)
                    .map(id => parseInt(id, 10))
                    .filter(id => Number.isFinite(id))
            );

            const totalAssignedRiders = ride.groups.reduce((sum, group) => sum + group.riders.length, 0);
            const riderAssignmentMap = {};
            const groupLabelMap = {};
            ride.groups.forEach(group => {
                groupLabelMap[group.id] = group.label;
                group.riders.forEach(riderId => {
                    riderAssignmentMap[riderId] = group.id;
                });
            });
            
            // Get sort preference for pasteboard (default to 'pace')
            const pasteboardSort = ride.pasteboardSort || 'pace';
            const unassignedRidersSort = pasteboardSort; // Use pasteboard sort for riders
            
            // For refined practices, use filtered riders instead of all availableRiders
            const isRefined = isRideRefined(ride);
            const ridersToCheck = isRefined ? getFilteredRiderIdsForRide(ride) : ride.availableRiders;
            
            const unassignedRiders = data.riders
                .filter(rider => !riderAssignmentMap[rider.id])
                .map(rider => {
                    const isAvailable = ridersToCheck.includes(rider.id);
                    return {
                        rider,
                        isAvailable,
                        fitness: (() => {
                            const fitnessScale = getFitnessScale();
                            return Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10)));
                        })(),
                        skills: (() => {
                            const skillsScale = getSkillsScale();
                            return Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10)));
                        })(),
                        grade: parseInt(rider.grade || '0', 10) || 0,
                        gender: (rider.gender || 'M').toUpperCase(),
                        lastName: getSortableLastName(rider.name || ''),
                        name: (rider.name || '').toLowerCase()
                    };
                }).sort((a, b) => {
                    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
                    
                    if (unassignedRidersSort === 'pace') {
                        const aPace = getRelativePaceValue(a.fitness);
                        const bPace = getRelativePaceValue(b.fitness);
                        if (bPace !== aPace) return bPace - aPace;
                        return a.lastName.localeCompare(b.lastName);
                    } else if (unassignedRidersSort === 'skills') {
                        if (b.skills !== a.skills) return b.skills - a.skills;
                        return a.lastName.localeCompare(b.lastName);
                    } else if (unassignedRidersSort === 'grade') {
                        if (b.grade !== a.grade) return b.grade - a.grade;
                        return a.lastName.localeCompare(b.lastName);
                    } else if (unassignedRidersSort === 'gender') {
                        if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
                        return a.lastName.localeCompare(b.lastName);
                    } else { // name
                        return a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name);
                    }
                });

            const riderCardsHtml = unassignedRiders
                .map(({ rider, isAvailable }) => renderRiderCardHtml(rider, {
                    draggable: true,
                    showAttendance: true,
                    isAvailable,
                    assignmentLabel: isAvailable ? '' : 'Unavailable',
                    checkboxHandler: `toggleRiderAvailability(${rider.id})`,
                    compact: true,
                    sortBy: unassignedRidersSort,
                    noPhoto: true
                }))
                .join('');

            // Use pasteboard sort for coaches too
            const unassignedCoachesSort = pasteboardSort;
            
            const unassignedCoaches = data.coaches
                .filter(coach => !coachAssignmentMap[coach.id])
                .map(coach => {
                const isAvailable = ride.availableCoaches.includes(coach.id);
                const fitness = getCoachFitnessValue(coach);
                const level = parseInt(coach.level || '1', 10);
                return {
                    coach,
                    isAvailable,
                    fitness,
                    level,
                    lastName: getSortableLastName(coach.name || ''),
                    name: (coach.name || '').toLowerCase()
                };
            }).sort((a, b) => {
                if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
                
                if (unassignedCoachesSort === 'pace') {
                    const fitnessDiff = b.fitness - a.fitness;
                    if (fitnessDiff !== 0) return fitnessDiff;
                    return a.lastName.localeCompare(b.lastName);
                } else if (unassignedCoachesSort === 'skills') {
                    // Coaches don't have skills, so fall back to pace then name
                    const fitnessDiff = b.fitness - a.fitness;
                    if (fitnessDiff !== 0) return fitnessDiff;
                    return a.lastName.localeCompare(b.lastName);
                } else if (unassignedCoachesSort === 'grade') {
                    // Coaches don't have grade, so fall back to pace then name
                    const fitnessDiff = b.fitness - a.fitness;
                    if (fitnessDiff !== 0) return fitnessDiff;
                    return a.lastName.localeCompare(b.lastName);
                } else if (unassignedCoachesSort === 'gender') {
                    // Coaches don't have gender, so fall back to pace then name
                    const fitnessDiff = b.fitness - a.fitness;
                    if (fitnessDiff !== 0) return fitnessDiff;
                    return a.lastName.localeCompare(b.lastName);
                } else if (unassignedCoachesSort === 'level') {
                    const levelDiff = b.level - a.level;
                    if (levelDiff !== 0) return levelDiff;
                    return a.lastName.localeCompare(b.lastName);
                } else { // name
                    return a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name);
                }
            });

            const coachCardsHtml = unassignedCoaches
                .map(({ coach, isAvailable }) => renderCoachCardHtml(coach, null, 'unassigned', {
                    draggable: true,
                    showAttendance: true,
                    isAvailable,
                    assignmentLabel: isAvailable ? '' : 'Unavailable',
                    checkboxHandler: `toggleCoachAvailability(${coach.id}, event.target.checked)`,
                    compact: true,
                    sortBy: unassignedCoachesSort,
                    noPhoto: true
                }))
                .join('');

            // Calculate max coaches across all groups to equalize coach section height
            const maxCoachSlots = Math.max(...ride.groups.map(g => {
                let count = 0;
                if (g.coaches.leader) count++;
                if (g.coaches.sweep) count++;
                if (g.coaches.roam) count++;
                if (Array.isArray(g.coaches.extraRoam)) count += g.coaches.extraRoam.filter(Boolean).length;
                return count + 1; // +1 for the drop zone
            }), 2);
            // Each coach row is 30px fixed, drop zone min 28px
            const coachSectionMinHeight = (maxCoachSlots * 30) + 28;

            const renderGroupCard = (group) => {
                const coachCount = countGroupCoaches(group);
                const capacity = groupCapacity(group);
                const warnings = [];

                const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                if (group.coaches.leader) {
                    const leader = getCoachById(group.coaches.leader);
                    const leaderLevel = leader ? parseInt(leader.coachingLicenseLevel || leader.level || '1', 10) : 0;
                    if (!Number.isFinite(leaderLevel) || leaderLevel < minLeaderLevel) {
                        warnings.push(`Leader must be Level ${minLeaderLevel}+`);
                    }
                }

                if (coachCount > 0 && group.riders.length > capacity) {
                    warnings.push('Group is over capacity');
                }

                const riderFitnesses = group.riders
                    .map(id => getRiderById(id))
                    .filter(Boolean)
                    .map(r => String(Math.max(1, Math.min(10, parseInt(r.fitness || '5', 10)))));

                if (riderFitnesses.length === 0) {
                    group.fitnessTag = null;
                } else {
                    const uniqueFitnesses = Array.from(new Set(riderFitnesses));
                    if (uniqueFitnesses.length === 1) {
                        group.fitnessTag = uniqueFitnesses[0];
                    } else if (!group.fitnessTag) {
                        group.fitnessTag = uniqueFitnesses[0];
                    }
                }

                // Get global sort preference (default to 'pace')
                const sortBy = ride.globalGroupSort || 'pace';
                
                const riderObjects = group.riders
                    .map(id => getRiderById(id))
                    .filter(Boolean)
                    .sort((a, b) => {
                        if (sortBy === 'pace') {
                            const aPace = getRelativePaceValue(parseInt(a.fitness || '5', 10));
                            const bPace = getRelativePaceValue(parseInt(b.fitness || '5', 10));
                            if (bPace !== aPace) return bPace - aPace; // Descending (fastest first)
                            // If pace is equal, sort by name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'skills') {
                            const aSkills = parseInt(a.skills || '2', 10);
                            const bSkills = parseInt(b.skills || '2', 10);
                            if (bSkills !== aSkills) return bSkills - aSkills; // Descending (higher skills first)
                            // If skills is equal, sort by name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'climbing') {
                            const aClimbing = parseInt(a.climbing || '3', 10);
                            const bClimbing = parseInt(b.climbing || '3', 10);
                            if (bClimbing !== aClimbing) return bClimbing - aClimbing; // Descending (higher climbing first)
                            // If climbing is equal, sort by name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'grade') {
                            const aGrade = parseInt(a.grade || '0', 10) || 0;
                            const bGrade = parseInt(b.grade || '0', 10) || 0;
                            if (bGrade !== aGrade) return bGrade - aGrade; // Descending (higher grade first)
                            // If grade is equal, sort by name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'gender') {
                            const aGender = (a.gender || 'M').toUpperCase();
                            const bGender = (b.gender || 'M').toUpperCase();
                            if (aGender !== bGender) return aGender.localeCompare(bGender);
                            // If gender is equal, sort by name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'firstName') {
                            const aFirstName = (a.firstName || a.name || '').toLowerCase();
                            const bFirstName = (b.firstName || b.name || '').toLowerCase();
                            if (aFirstName !== bFirstName) return aFirstName.localeCompare(bFirstName);
                            // If first name is equal, sort by last name
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || ''));
                        } else if (sortBy === 'lastName') {
                            const aLastName = getSortableLastName(a.name || '');
                            const bLastName = getSortableLastName(b.name || '');
                            if (aLastName !== bLastName) return aLastName.localeCompare(bLastName);
                            // If last name is equal, sort by first name
                            const aFirstName = (a.firstName || a.name || '').toLowerCase();
                            const bFirstName = (b.firstName || b.name || '').toLowerCase();
                            return aFirstName.localeCompare(bFirstName);
                        } else { // name (default)
                            return getSortableLastName(a.name || '').localeCompare(getSortableLastName(b.name || '')) || (a.name || '').localeCompare(b.name || '');
                        }
                    });

                // Get groups sorted by fitness to determine if we can move up/down
                const sortedGroups = ride.groups.slice().sort(getGroupPaceComparator(ride));
                const currentGroupIndex = sortedGroups.findIndex(g => g.id === group.id);
                const canMoveUp = currentGroupIndex > 0;
                const canMoveDown = currentGroupIndex >= 0 && currentGroupIndex < sortedGroups.length - 1;

                // Filter to get only attending riders for count (normalize IDs for comparison)
                const normalizedAvailableRiderIds = new Set(ride.availableRiders.map(id => {
                    const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                    return Number.isFinite(normalized) ? normalized : id;
                }));
                
                const attendingRiders = riderObjects.filter(rider => {
                    const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                    const normalizedId = Number.isFinite(riderId) ? riderId : rider.id;
                    return normalizedAvailableRiderIds.has(normalizedId);
                });
                const attendingCount = attendingRiders.length;
                const totalAssigned = riderObjects.length;

                const ridersHtml = riderObjects
                    .map((rider, index) => {
                        // Normalize IDs for consistent comparison
                        const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                        const normalizedId = Number.isFinite(riderId) ? riderId : rider.id;
                        const isAvailable = normalizedAvailableRiderIds.has(normalizedId);
                        
                        // Check scheduled absence for this rider
                        const rideDate = ride.date || '';
                        const riderAbsenceStatus = rideDate ? isScheduledAbsent('rider', normalizedId, rideDate) : { absent: false, reason: '' };

                        return renderRiderCardHtml(rider, {
                            draggable: isAvailable,
                            showAttendance: true,
                            isAvailable,
                            assignmentLabel: '',
                            checkboxHandler: null,
                            compact: true,
                            showMoveControls: false,
                            groupId: group.id,
                            canMoveUp: canMoveUp,
                            canMoveDown: canMoveDown,
                            sortBy: sortBy,
                            inGroup: true,
                            showUnavailableStyle: !isAvailable,
                            noPhoto: true,
                            visibleSkills: ride.visibleSkills || null,
                            scheduledAbsent: riderAbsenceStatus.absent,
                            absenceReasonText: riderAbsenceStatus.reason || ''
                        });
                    })
                    .join('') || '<div class="empty-message">No riders assigned</div>';

                // Warnings now shown via clickable ⚠ icon in header instead of inline text
                const warningsHtml = '';
                
                // Get coach names for header
                const coachNames = getCoachFirstNames(group);
                
                // Get route name for header
                const route = group.routeId ? getRouteById(group.routeId) : null;
                const routeName = route ? escapeHtml(route.name || 'Unnamed Route') : '';
                
                // Check if group is compliant
                const isCompliant = checkGroupCompliance(group);
                
                // Validation warnings are accessed via the ⚠ popup on click
                const validationWarnings = validateGroupRequirements(group, ride);
                
                // All groups use the same styling — non-compliance shown only as a subtle ⚠ icon
                const headerColor = '#2196F3';
                const groupBorderColor = '#ddd';
                const groupBorderWidth = '1px';
                
                return `
                    <div class="coach-group" data-group-id="${group.id}" style="border: ${groupBorderWidth} solid ${groupBorderColor}; border-radius: 8px; background: #b8b8b8; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 0; margin: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="coach-group-header" style="background-color: ${headerColor}; color: white; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; border: none !important;">
                            <span style="font-weight: 600; font-size: 16px; color: white;">${group.label}${group.customName ? ` (${escapeHtml(group.customName)})` : ''}${group.colorName && !group.customName ? ` (${group.colorName})` : ''}${!isCompliant ? ' <span class="group-warning-icon" onclick="showGroupWarningPopup(event, ' + group.id + ')" title="Click to see warnings" style="opacity: 0.8;">⚠</span>' : ''}</span>
                            <div style="display: flex; align-items: center; gap: 8px; position: relative;">
                                <button class="group-menu-btn" onclick="showGroupMenu(event, ${group.id})" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 16px; font-weight: 700; line-height: 1;" title="Group options">⋯</button>
                            </div>
                        </div>
                        <div style="padding: 8px 12px; flex: 1; display: flex; flex-direction: column;">
                        <div class="group-body" style="display: flex; flex-direction: column; border: none !important; border-style: none !important; flex: 1;">
                            <!-- Coaches Section -->
                            <div style="margin-bottom: 4px;">
                                <div onclick="toggleGroupSection('coaches')" style="cursor: pointer; padding: 2px 0; display: flex; align-items: center; justify-content: space-between; user-select: none; border-bottom: 1px solid #ddd;">
                                    <span style="font-weight: 600; font-size: 13px; color: #555;">Coaches${coachNames ? `: ${coachNames}` : ''}</span>
                                    <span style="font-size: 11px; color: #999;">${groupSectionsState.coaches ? '▼' : '▶'}</span>
                                </div>
                                <div class="group-coaches" 
                                     data-group-id="${group.id}"
                                     data-section="coaches"
                                     style="width: 100%; margin-top: 2px; min-height: ${groupSectionsState.coaches ? coachSectionMinHeight + 'px' : '30px'}; display: ${groupSectionsState.coaches ? 'flex' : 'none'}; flex-direction: column;">
                                    ${renderGroupCoachesInline(group, ride)}
                                </div>
                            </div>
                            
                            <!-- Riders Section -->
                            <div style="margin-bottom: 4px; flex: 1;">
                                <div onclick="toggleGroupSection('riders')" style="cursor: pointer; padding: 2px 0; display: flex; align-items: center; justify-content: space-between; user-select: none; border-bottom: 1px solid #ddd;">
                                    <span style="font-weight: 600; font-size: 13px; color: #555;">${getRiderFitnessRange(group, ride)}</span>
                                    <span style="font-size: 11px; color: #999;">${groupSectionsState.riders ? '▼' : '▶'}</span>
                                </div>
                                <div class="group-riders"
                                     data-drop-type="rider"
                                     data-group-id="${group.id}"
                                     data-section="riders"
                                     ondrop="drop(event)"
                                     ondragover="allowDrop(event)"
                                     ondragleave="dragLeave(event)"
                                     style="width: 100%; margin-top: 2px; ${groupSectionsState.riders ? '' : 'display: none;'}">
                                    ${ridersHtml}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Route Section -->
                        <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                            <div onclick="toggleGroupSection('route')" style="cursor: pointer; padding: 4px 8px; background: #f5f5f5; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; user-select: none; margin-bottom: 4px;">
                                <span style="font-weight: 600; font-size: 13px; color: #333;">Route${routeName ? `: ${routeName}` : ''}</span>
                                <span style="font-size: 12px; color: #666;">${groupSectionsState.route ? '▼' : '▶'}</span>
                            </div>
                            <div data-section="route" style="${groupSectionsState.route ? '' : 'display: none;'}">
                                <select onchange="handleRouteSelectChange(${group.id}, this.value, '${ride.id}', this)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                                    <option value="">-- Select Route --</option>
                                    ${renderRouteOptions(group.routeId, group, ride)}
                                </select>
                            </div>
                        </div>
                        ${warningsHtml}
                        </div>
                    </div>
                `;
            };

            const groupsHtml = ride.groups.length
                ? ride.groups.slice().sort((a, b) => {
                    // Extract numeric value from group label (e.g., "Group 1" -> 1)
                    const getGroupNumber = (group) => {
                        const label = group.label || `Group ${group.id}`;
                        const match = label.match(/\d+/);
                        return match ? parseInt(match[0], 10) : group.id;
                    };
                    return getGroupNumber(a) - getGroupNumber(b);
                }).map(renderGroupCard).join('')
                : renderEmptyGroupCard();

            const cloneButtonHtml = '';
            
            // Build global toolbar for sort + skill visibility + action buttons — render into the fixed practice banner
            const globalSort = ride.globalGroupSort || 'pace';
            const visibleSkills = ride.visibleSkills || ['pace'];
            const _paceLabel = typeof getSkillSortLabel === 'function' ? getSkillSortLabel('pace') : 'Endurance Rating';
            const _climbLabel = typeof getSkillSortLabel === 'function' ? getSkillSortLabel('climbing') : 'Climbing Rating';
            const _descendLabel = typeof getSkillSortLabel === 'function' ? getSkillSortLabel('skills') : 'Descending Rating';
            const _numGroups = ride.groups.length;
            const _groupSizes = ride.groups.map(g => (g.riders || []).length);
            const _minSize = _groupSizes.length > 0 ? Math.min(..._groupSizes) : 0;
            const _maxSize = _groupSizes.length > 0 ? Math.max(..._groupSizes) : 0;
            const _sizeRange = _minSize === _maxSize ? `${_minSize}` : `${_minSize}–${_maxSize}`;
            const _fewerDisabled = _numGroups <= 1;
            const _hasAssignments = ride.groups.some(g => {
                if ((g.riders || []).length > 0) return true;
                if (g.coaches && (g.coaches.leader || g.coaches.sweep || g.coaches.roam || (Array.isArray(g.coaches.extraRoam) && g.coaches.extraRoam.some(id => id)))) return true;
                return false;
            });
            const _hasRidersInGroups = _groupSizes.some(s => s > 0);

            const bannerToolbar = document.getElementById('practice-banner-toolbar');
            if (bannerToolbar) {
                bannerToolbar.style.display = '';
                bannerToolbar.innerHTML = `
                    <div class="groups-toolbar" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                        <div class="groups-toolbar-section" style="gap: 4px;">
                            <label style="font-weight: 600; font-size: 13px; color: #333; margin-right: 2px;">Show Skills:</label>
                            <label class="skill-checkbox-label" title="${escapeHtml(_paceLabel)}">
                                <input type="checkbox" ${visibleSkills.includes('pace') ? 'checked' : ''} onchange="toggleSkillVisibility('pace')">
                                <span class="skill-icon skill-icon-pace">❤</span> <span class="skill-label-text">${escapeHtml(_paceLabel)}</span>
                            </label>
                            <label class="skill-checkbox-label" title="${escapeHtml(_climbLabel)}">
                                <input type="checkbox" ${visibleSkills.includes('climbing') ? 'checked' : ''} onchange="toggleSkillVisibility('climbing')">
                                <span class="skill-icon skill-icon-climbing">◢</span> <span class="skill-label-text">${escapeHtml(_climbLabel)}</span>
                            </label>
                            <label class="skill-checkbox-label" title="${escapeHtml(_descendLabel)}">
                                <input type="checkbox" ${visibleSkills.includes('skills') ? 'checked' : ''} onchange="toggleSkillVisibility('skills')">
                                <span class="skill-icon skill-icon-skills">◣</span> <span class="skill-label-text">${escapeHtml(_descendLabel)}</span>
                            </label>
                        </div>
                        <div style="flex: 1;"></div>
                        <div class="groups-toolbar-section">
                            <label style="font-weight: 600; font-size: 13px; color: #333; margin-right: 6px;">Sort by:</label>
                            <select onchange="changeGlobalGroupSort(this.value)" style="padding: 3px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; cursor: pointer;">
                                <option value="firstName" ${globalSort === 'firstName' ? 'selected' : ''}>First Name</option>
                                <option value="lastName" ${globalSort === 'lastName' ? 'selected' : ''}>Last Name</option>
                                <option value="grade" ${globalSort === 'grade' ? 'selected' : ''}>Grade</option>
                                <option value="gender" ${globalSort === 'gender' ? 'selected' : ''}>Gender</option>
                                ${visibleSkills.includes('pace') || globalSort === 'pace' ? `<option value="pace" ${globalSort === 'pace' ? 'selected' : ''}>${escapeHtml(_paceLabel)}</option>` : ''}
                                ${visibleSkills.includes('climbing') || globalSort === 'climbing' ? `<option value="climbing" ${globalSort === 'climbing' ? 'selected' : ''}>${escapeHtml(_climbLabel)}</option>` : ''}
                                ${visibleSkills.includes('skills') || globalSort === 'skills' ? `<option value="skills" ${globalSort === 'skills' ? 'selected' : ''}>${escapeHtml(_descendLabel)}</option>` : ''}
                            </select>
                        </div>
                    </div>
                    ${_hasAssignments ? `
                    <div id="groups-resize-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; flex-wrap: wrap;">
                        <span style="font-size: 15px; color: #333; font-weight: 600;">${_numGroups} Group${_numGroups !== 1 ? 's' : ''}${_hasRidersInGroups ? `, ${_sizeRange} Riders/Group` : ''}</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button id="fewer-groups-btn" type="button" class="btn-small" onclick="tryFewerGroups()" ${_fewerDisabled ? 'disabled' : ''} style="font-size: 12px; padding: 5px 12px; background: #757575; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;${_fewerDisabled ? ' opacity:0.4; cursor:not-allowed;' : ''}">Make Larger Groups</button>
                            <button id="more-groups-btn" type="button" class="btn-small" onclick="tryMoreGroups()" style="font-size: 12px; padding: 5px 12px; background: #757575; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">Make Smaller Groups</button>
                        </div>
                    </div>
                    ` : ''}
                `;
                requestAnimationFrame(() => {
                    if (typeof updateSidebarTop === 'function') updateSidebarTop();
                });
            }

            const addGroupHtml = ride.groups.length > 0 ? `
                <div id="add-group-placeholder" class="add-group-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 10px 0; min-height: 200px; background: #e3f2fd; border: 2px dashed #90caf9; border-radius: 12px; transition: background 0.15s;">
                    <div id="add-group-buttons-row" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                        <button type="button" class="btn-small" onclick="event.stopPropagation(); addGroup()" style="font-size: 14px; padding: 8px 20px; background: #1976d2; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Add Group</button>
                        <button type="button" class="btn-small" onclick="event.stopPropagation(); autoGenerateFromPlanner()" style="font-size: 14px; padding: 8px 20px; background: #4CAF50; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Auto-Generate Groups</button>
                    </div>
                    <button type="button" class="btn-small" onclick="event.stopPropagation(); switchToWizardFromPlanner()" style="font-size: 13px; padding: 7px 20px; background: #fff; color: #1976d2; border: 2px solid #1976d2; border-radius: 6px; cursor: pointer; font-weight: 600;">Use Practice Planner Wizard</button>
                </div>
            ` : '';

            const centerColumnHtml = `
                <div id="groups-grid" class="assignment-column groups-column" style="width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; max-width: 100%; padding: 0; border: none; align-items: stretch;">
                    ${groupsHtml}
                    ${addGroupHtml}
                </div>
                <div id="publish-groups-container" style="display: flex; justify-content: center; gap: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; flex-wrap: wrap;">
                    <button id="publish-groups-btn" class="btn-small" onclick="publishGroupAssignments()" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Publish Group Assignments</button>
                    <button id="unpublish-groups-btn" class="btn-small" onclick="unpublishGroupAssignments()" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Unpublish Group Assignments</button>
                    <button id="send-notification-btn" class="btn-small" onclick="sendGroupAssignmentNotification()" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Send Notification</button>
                    <button id="print-groups-btn" class="btn-small" onclick="printGroupAssignments()" style="padding: 12px 24px; font-size: 16px; font-weight: 600; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">Print Group Assignments</button>
                </div>
            `;

            container.innerHTML = centerColumnHtml;
            truncateOverflowingNames();
            updateDebugOutput();
            
            // Adjust "Add Group" placeholder: span full width if it's alone on its row
            requestAnimationFrame(() => {
                const placeholder = document.getElementById('add-group-placeholder');
                const grid = document.getElementById('groups-grid');
                if (placeholder && grid) {
                    const groupCards = grid.querySelectorAll('.coach-group');
                    const lastCard = groupCards.length > 0 ? groupCards[groupCards.length - 1] : null;
                    const placeholderTop = placeholder.getBoundingClientRect().top;
                    const lastCardTop = lastCard ? lastCard.getBoundingClientRect().top : -1;
                    const isAloneOnRow = !lastCard || Math.abs(placeholderTop - lastCardTop) > 10;
                    if (isAloneOnRow) {
                        placeholder.style.gridColumn = '1 / -1';
                        placeholder.style.minHeight = '48px';
                        placeholder.style.borderRadius = '8px';
                    }
                }
                // Match wizard button width to the row of buttons above it
                document.querySelectorAll('#add-group-buttons-row').forEach(row => {
                    const wizardBtn = row.parentElement && row.parentElement.querySelector('button[onclick*="switchToWizardFromPlanner"]');
                    if (row && wizardBtn) {
                        wizardBtn.style.width = row.offsetWidth + 'px';
                    }
                });
            });

            // Update publish buttons after container is updated
            updatePublishButtons();
            updateGroupColorNamesButton(ride);
            
            // Update undo/redo button states (must happen after toolbar HTML is in DOM)
            updateUndoRedoButtons();
            
            // Add event delegation for checkboxes in group riders containers
            // This allows checkboxes in groups to toggle rider availability
            // Use a single delegated listener on the assignments container for better performance
            const assignmentsContainer = document.getElementById('assignments');
            if (assignmentsContainer) {
                // Remove any existing listener by cloning (but keep content)
                const existingHandler = assignmentsContainer._groupCheckboxHandler;
                if (existingHandler) {
                    assignmentsContainer.removeEventListener('click', existingHandler);
                }
                
                // Create new handler function
                const groupCheckboxHandler = function handleGroupCheckboxClick(e) {
                    // Handle clicks on checkboxes (both riders and coaches) within group containers
                    if (e.target.type !== 'checkbox' || !e.target.classList.contains('attendance-checkbox-input')) {
                        return;
                    }
                    
                    const attendanceType = e.target.dataset.attendanceType;
                    if (attendanceType !== 'rider' && attendanceType !== 'coach') {
                        return;
                    }
                    
                    const groupRidersContainer = e.target.closest('.group-riders');
                    const groupCoachesContainer = e.target.closest('.group-coaches');
                    const coachInlineItem = e.target.closest('.coach-inline-item');
                    const isPasteboard = !!e.target.closest('[data-unassigned-list="true"]');
                    const isAvailable = e.target.checked;
                    
                    if (attendanceType === 'rider' && (groupRidersContainer || isPasteboard)) {
                        const riderId = parseInt(e.target.dataset.riderId, 10);
                        if (!Number.isFinite(riderId)) { console.error('Invalid riderId:', e.target.dataset.riderId); return; }

                        // Animate out when unchecking a rider inside a group
                        const card = e.target.closest('.rider-card, .coach-card, .attendance-card');
                        if (!isAvailable && card && groupRidersContainer) {
                            animateCardRemoval(card, () => toggleRiderAvailability(riderId, false));
                        } else {
                            setTimeout(() => toggleRiderAvailability(riderId, isAvailable), 0);
                        }
                    } else if (attendanceType === 'coach' && (groupCoachesContainer || coachInlineItem || isPasteboard)) {
                        const coachId = parseInt(e.target.dataset.coachId, 10);
                        if (!Number.isFinite(coachId)) { console.error('Invalid coachId:', e.target.dataset.coachId); return; }

                        const card = e.target.closest('.rider-card, .coach-card, .coach-inline-item');
                        if (!isAvailable && card && (groupCoachesContainer || coachInlineItem)) {
                            animateCardRemoval(card, () => toggleCoachAvailability(coachId, false));
                        } else {
                            setTimeout(() => toggleCoachAvailability(coachId, isAvailable), 0);
                        }
                    }
                };
                
                // Store reference to handler for future removal
                assignmentsContainer._groupCheckboxHandler = groupCheckboxHandler;
                assignmentsContainer.addEventListener('click', groupCheckboxHandler);
            }
            
            // Allow clicking names in assignment cards to toggle attendance checkboxes
            if (assignmentsContainer) {
                const existingNameHandler = assignmentsContainer._attendanceNameHandler;
                if (existingNameHandler) {
                    assignmentsContainer.removeEventListener('click', existingNameHandler);
                }
                
                const attendanceNameHandler = function handleAssignmentNameClick(e) {
                    const nameTarget = e.target.closest('.attendance-name');
                    if (!nameTarget) return;
                    
                    const card = nameTarget.closest('.rider-card, .coach-card');
                    const checkbox = card ? card.querySelector('.attendance-checkbox-input') : null;
                    if (!checkbox) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    checkbox.click();
                };
                
                assignmentsContainer._attendanceNameHandler = attendanceNameHandler;
                assignmentsContainer.addEventListener('click', attendanceNameHandler);
            }
            
            // Update route previews after rendering
            updateRoutePreviews();
            
            // Update sidebars (replaces old attendance lists)
            if (sidebarsVisible) {
                renderSidebars();
            }
        }

        function updatePracticeGoals() {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            
            const goalsInput = document.getElementById('practice-goals');
            if (goalsInput) {
                ride.goals = goalsInput.value.trim();
                saveRideToDB(ride);
            }
        }
        
