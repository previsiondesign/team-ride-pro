// app-races.js — Race CRUD, dashboard races list, auto-assign settings modal

        // ============ RACES MANAGEMENT ============
        
        function openAddRacesModal() {
            const modal = document.getElementById('add-races-modal');
            if (!modal) return;
            
            // Initialize races array if needed
            if (!Array.isArray(data.races)) {
                data.races = [];
            }
            
            renderRacesList();
            
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }
        
        function closeAddRacesModal() {
            const modal = document.getElementById('add-races-modal');
            if (!modal) return;
            if (modal.contains(document.activeElement)) document.activeElement.blur();
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
        }

        function renderDashboardRaces() {
            const container = document.getElementById('dashboard-races-list');
            if (!container) return;

            if (!Array.isArray(data.races) || data.races.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 12px; color: #666; font-size: 13px;">No races added yet.</div>';
                return;
            }

            // Sort races by date (earliest first), undated at end
            const sorted = [...data.races].sort((a, b) => {
                if (!a.raceDate && !b.raceDate) return 0;
                if (!a.raceDate) return 1;
                if (!b.raceDate) return -1;
                return a.raceDate.localeCompare(b.raceDate);
            });

            container.innerHTML = sorted.map(race => {
                const name = escapeHtml(race.name || 'Untitled Race');
                const location = race.location ? escapeHtml(race.location) : '';
                const raceDateObj = race.raceDate ? parseISODate(race.raceDate) : null;
                const preRideDateObj = race.preRideDate ? parseISODate(race.preRideDate) : null;
                const raceDate = raceDateObj ? raceDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                const preRideDate = preRideDateObj ? preRideDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                let detailParts = [];
                if (raceDate) detailParts.push(`<span style="white-space: nowrap;">Race: ${raceDate}</span>`);
                if (preRideDate) detailParts.push(`<span style="white-space: nowrap;">Pre-ride: ${preRideDate}</span>`);
                if (location) detailParts.push(`<span>${location}</span>`);

                return `<div style="padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 6px; background: #f9f9f9;">
                    <div style="font-weight: 600; font-size: 13px; color: #333;">${name}</div>
                    ${detailParts.length > 0 ? `<div style="font-size: 12px; color: #666; margin-top: 3px; display: flex; gap: 12px; flex-wrap: wrap;">${detailParts.join('')}</div>` : ''}
                </div>`;
            }).join('');
        }
        
        function renderRacesList() {
            const container = document.getElementById('races-list-container');
            if (!container) return;
            
            if (!Array.isArray(data.races) || data.races.length === 0) {
                container.innerHTML = '<p style="color: #666; font-size: 14px; margin-bottom: 12px;">No races added yet. Click "Add Another Race" to get started.</p>';
                addRaceEntry();
                return;
            }
            
            container.innerHTML = data.races.map((race, index) => {
                const raceDate = race.raceDate || '';
                const preRideDate = race.preRideDate || '';
                const name = escapeHtml(race.name || '');
                const location = escapeHtml(race.location || '');
                
                return `
                    <div class="form-row" style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 12px; background: #f9f9f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
                            <strong style="color: #333;">Race ${index + 1}</strong>
                            <button class="btn-small danger" onclick="removeRaceEntry(${index})" style="padding: 4px 8px; font-size: 11px;">Remove</button>
                        </div>
                        <div style="flex: 1; margin-right: 8px;">
                            <label class="field-label">Race Name</label>
                            <input type="text" id="race-name-${index}" value="${name}" placeholder="e.g., NorCal League Race 1" style="width: 100%;">
                        </div>
                        <div style="flex: 1; margin-right: 8px;">
                            <label class="field-label">Race Date</label>
                            <input type="date" id="race-date-${index}" value="${raceDate}" style="width: 100%;" onchange="handleRaceDateChange(${index})">
                        </div>
                        <div style="flex: 1; margin-right: 8px;">
                            <label class="field-label">Pre-Ride Date</label>
                            <input type="date" id="preride-date-${index}" value="${preRideDate}" style="width: 100%;">
                        </div>
                        <div style="flex: 1;">
                            <label class="field-label">Location</label>
                            <input type="text" id="race-location-${index}" value="${location}" placeholder="e.g., Granite Bay" style="width: 100%;">
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        function addRaceEntry() {
            if (!Array.isArray(data.races)) {
                data.races = [];
            }
            
            // First, save any current form values to data.races before adding a new entry
            const racesContainer = document.getElementById('races-list-container');
            if (racesContainer) {
                const raceInputs = racesContainer.querySelectorAll('[id^="race-name-"]');
                raceInputs.forEach((nameInput, index) => {
                    const raceId = nameInput.id.replace('race-name-', '');
                    const name = nameInput.value.trim();
                    const raceDateInput = document.getElementById(`race-date-${raceId}`);
                    const preRideDateInput = document.getElementById(`preride-date-${raceId}`);
                    const locationInput = document.getElementById(`race-location-${raceId}`);
                    
                    const raceDate = raceDateInput ? raceDateInput.value.trim() : '';
                    const preRideDate = preRideDateInput ? preRideDateInput.value.trim() : '';
                    const location = locationInput ? locationInput.value.trim() : '';
                    
                    // Update or create race entry
                    if (index < data.races.length) {
                        // Update existing race
                        data.races[index].name = name;
                        data.races[index].raceDate = raceDate;
                        data.races[index].preRideDate = preRideDate;
                        data.races[index].location = location;
                    } else {
                        // Create new race entry
                        data.races.push({
                            id: Date.now() + Math.floor(Math.random() * 1000) + index,
                            name: name,
                            raceDate: raceDate,
                            preRideDate: preRideDate,
                            location: location
                        });
                    }
                });
            }
            
            // Now add a new empty race entry
            data.races.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: '',
                raceDate: '',
                preRideDate: '',
                location: ''
            });
            
            renderRacesList();
        }
        
        function handleRaceDateChange(index) {
            const raceDateInput = document.getElementById(`race-date-${index}`);
            const preRideDateInput = document.getElementById(`preride-date-${index}`);
            
            if (!raceDateInput || !preRideDateInput) return;
            
            const raceDate = raceDateInput.value;
            if (!raceDate) return;
            
            // Only auto-fill if preride date is empty
            if (!preRideDateInput.value) {
                const raceDateObj = parseISODate(raceDate);
                if (raceDateObj) {
                    // Set preride date to day before race date
                    const preRideDateObj = new Date(raceDateObj);
                    preRideDateObj.setDate(preRideDateObj.getDate() - 1);
                    preRideDateInput.value = formatDateToISO(preRideDateObj);
                }
            }
        }

        function removeRaceEntry(index) {
            if (!confirm('Are you sure you want to remove this race?')) {
                return;
            }
            
            // First, save all current form values to data.races before removing
            const racesContainer = document.getElementById('races-list-container');
            if (racesContainer) {
                const raceInputs = racesContainer.querySelectorAll('[id^="race-name-"]');
                raceInputs.forEach((nameInput, idx) => {
                    const raceId = nameInput.id.replace('race-name-', '');
                    const name = nameInput.value.trim();
                    const raceDateInput = document.getElementById(`race-date-${raceId}`);
                    const preRideDateInput = document.getElementById(`preride-date-${raceId}`);
                    const locationInput = document.getElementById(`race-location-${raceId}`);
                    
                    const raceDate = raceDateInput ? raceDateInput.value.trim() : '';
                    const preRideDate = preRideDateInput ? preRideDateInput.value.trim() : '';
                    const location = locationInput ? locationInput.value.trim() : '';
                    
                    // Update existing race entry
                    if (idx < data.races.length) {
                        data.races[idx].name = name;
                        data.races[idx].raceDate = raceDate;
                        data.races[idx].preRideDate = preRideDate;
                        data.races[idx].location = location;
                    }
                });
            }
            
            if (Array.isArray(data.races) && index >= 0 && index < data.races.length) {
                data.races.splice(index, 1);
                renderRacesList();
            }
        }
        
        function saveRaces() {
            if (!Array.isArray(data.races)) {
                data.races = [];
            }
            
            // Collect all race data from inputs
            const racesContainer = document.getElementById('races-list-container');
            if (!racesContainer) return;
            
            const raceInputs = racesContainer.querySelectorAll('[id^="race-name-"]');
            const updatedRaces = [];
            
            raceInputs.forEach((nameInput, index) => {
                const raceId = nameInput.id.replace('race-name-', '');
                const name = nameInput.value.trim();
                const raceDateInput = document.getElementById(`race-date-${raceId}`);
                const preRideDateInput = document.getElementById(`preride-date-${raceId}`);
                const locationInput = document.getElementById(`race-location-${raceId}`);
                
                const raceDate = raceDateInput ? raceDateInput.value.trim() : '';
                const preRideDate = preRideDateInput ? preRideDateInput.value.trim() : '';
                const location = locationInput ? locationInput.value.trim() : '';
                
                // Only save if at least name or date is provided
                if (name || raceDate) {
                    // Find existing race by index or create new
                    const existingRace = data.races[index];
                    updatedRaces.push({
                        id: existingRace ? existingRace.id : (Date.now() + Math.floor(Math.random() * 1000) + index),
                        name: name,
                        raceDate: raceDate,
                        preRideDate: preRideDate,
                        location: location
                    });
                }
            });
            
            data.races = updatedRaces;
            saveData();
            
            // Re-render calendar to show races
            renderSeasonCalendar();
            renderSeasonCalendarForSettings();
            renderDashboardRaces();
            
            closeAddRacesModal();
        }

        // Auto-Assign Settings Modal Functions
        function openAutoAssignSettingsModal() {
            const modal = document.getElementById('auto-assign-settings-modal');
            if (!modal) return;

            // Initialize settings if needed
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                if (!data.autoAssignSettings) {
                    data.autoAssignSettings = {
                        parameters: [
                            { id: 'ridersPerCoach', name: 'Riders per Coach', value: 6, priority: 1, enabled: true, type: 'number', min: 1, max: 20, description: 'Maximum riders per coach (capacity multiplier)' },
                            { id: 'minLeaderLevel', name: 'Minimum Leader Level', value: 2, priority: 2, enabled: true, type: 'number', min: 1, max: 3, description: 'Minimum coach level required to lead a group' },
                            { id: 'preferredCoachesPerGroup', name: 'Preferred Coaches per Group', value: 3, priority: 3, enabled: true, type: 'number', min: 1, max: 10, description: 'Target number of coaches per group' },
                            { id: 'preferredGroupSize', name: 'Preferred Group Size Range', valueMin: 4, valueMax: 8, priority: 4, enabled: true, type: 'range', min: 1, max: 30, description: 'Preferred number of riders per group (min-max range)' }
                        ]
                    };
                }
            }

            // Create draft copy
            autoAssignSettingsDraft = {
                parameters: data.autoAssignSettings.parameters.map(p => ({ ...p }))
            };

            renderAutoAssignSettings();
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeAutoAssignSettingsModal() {
            const modal = document.getElementById('auto-assign-settings-modal');
            if (!modal) return;
            if (modal.contains(document.activeElement)) document.activeElement.blur();
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            autoAssignSettingsDraft = null;
        }

        function renderAutoAssignSettings() {
            const container = document.getElementById('auto-assign-settings-list');
            if (!container || !autoAssignSettingsDraft) return;

            // Sort by priority
            const sortedParams = [...autoAssignSettingsDraft.parameters].sort((a, b) => a.priority - b.priority);

            container.innerHTML = sortedParams.map((param, index) => {
                const isRange = param.type === 'range' || (param.valueMin !== undefined && param.valueMax !== undefined);
                
                let inputHtml = '';
                if (isRange) {
                    // Range input (for preferredGroupSize)
                    inputHtml = `
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="font-size: 12px; color: #666;">Min:</label>
                                <input 
                                    type="number" 
                                    id="auto-assign-param-${param.id}-min" 
                                    value="${param.valueMin || param.min || 1}" 
                                    min="${param.min || 1}" 
                                    max="${param.max || 100}"
                                    style="width: 80px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                    onchange="updateAutoAssignParamRange('${param.id}', 'min', this.value)"
                                >
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="font-size: 12px; color: #666;">Max:</label>
                                <input 
                                    type="number" 
                                    id="auto-assign-param-${param.id}-max" 
                                    value="${param.valueMax || param.max || 100}" 
                                    min="${param.min || 1}" 
                                    max="${param.max || 100}"
                                    style="width: 80px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                    onchange="updateAutoAssignParamRange('${param.id}', 'max', this.value)"
                                >
                            </div>
                            <div style="flex: 1; font-size: 12px; color: #999;">
                                Range: ${param.min || 1} - ${param.max || 100}
                            </div>
                        </div>
                    `;
                } else {
                    // Single value input
                    inputHtml = `
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <input 
                                type="number" 
                                id="auto-assign-param-${param.id}" 
                                value="${param.value || 1}" 
                                min="${param.min || 1}" 
                                max="${param.max || 100}"
                                style="width: 100px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                onchange="updateAutoAssignParamValue('${param.id}', this.value)"
                            >
                            <div style="flex: 1; font-size: 12px; color: #999;">
                                Range: ${param.min || 1} - ${param.max || 100}
                            </div>
                        </div>
                    `;
                }
                
                return `
                    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px; background: white;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div style="flex: 1;">
                                <label style="font-weight: 600; color: #333; font-size: 14px; display: block; margin-bottom: 4px;">
                                    ${escapeHtml(param.name)}
                                </label>
                                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                    ${escapeHtml(param.description || '')}
                                </div>
                            </div>
                        </div>
                        ${inputHtml}
                    </div>
                `;
            }).join('');
            
            // Add Group Pace Options at the end
            const ride = data.rides.find(r => r.id === data.currentRide);
            const groupPaceOrder = ride?.groupPaceOrder || data.seasonSettings?.groupPaceOrder || 'fastest_to_slowest';
            container.innerHTML += `
                <div style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <label style="font-weight: 600; color: #333; font-size: 14px; display: block; margin-bottom: 4px;">
                                Group Pace Order
                            </label>
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                                Controls the order in which groups are displayed (fastest to slowest or slowest to fastest)
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <select id="auto-assign-group-pace-order" style="padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 200px;" onchange="updateAutoAssignGroupPaceOrder(this.value)">
                            <option value="fastest_to_slowest" ${groupPaceOrder === 'fastest_to_slowest' ? 'selected' : ''}>Fastest to Slowest</option>
                            <option value="slowest_to_fastest" ${groupPaceOrder === 'slowest_to_fastest' ? 'selected' : ''}>Slowest to Fastest</option>
                        </select>
                    </div>
                </div>
            `;
        }
        
        function updateAutoAssignGroupPaceOrder(value) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;
            const normalized = normalizeGroupPaceOrder(value);
            ride.groupPaceOrder = normalized;
            if (!data.seasonSettings) {
                data.seasonSettings = {};
            }
            data.seasonSettings.groupPaceOrder = normalized;
            saveRideToDB(ride);
            if (typeof updateSeasonSettings === 'function') {
                updateSeasonSettings(data.seasonSettings);
            }
            renderAssignments(ride);
        }

        function updateAutoAssignParamValue(id, value) {
            if (!autoAssignSettingsDraft) return;
            const param = autoAssignSettingsDraft.parameters.find(p => p.id === id);
            if (!param) return;
            const numValue = parseInt(value, 10);
            if (Number.isFinite(numValue)) {
                param.value = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
            }
        }

        function updateAutoAssignParamRange(id, minOrMax, value) {
            if (!autoAssignSettingsDraft) return;
            const param = autoAssignSettingsDraft.parameters.find(p => p.id === id);
            if (!param) return;
            const numValue = parseInt(value, 10);
            if (Number.isFinite(numValue)) {
                if (minOrMax === 'min') {
                    param.valueMin = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
                    // Ensure min doesn't exceed max
                    if (param.valueMax !== undefined && param.valueMin > param.valueMax) {
                        param.valueMin = param.valueMax;
                    }
                } else {
                    param.valueMax = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
                    // Ensure max isn't less than min
                    if (param.valueMin !== undefined && param.valueMax < param.valueMin) {
                        param.valueMax = param.valueMin;
                    }
                }
            }
        }

        function saveAutoAssignSettings() {
            if (!autoAssignSettingsDraft) return;
            
            // Save to data
            data.autoAssignSettings = {
                parameters: autoAssignSettingsDraft.parameters.map(p => ({ ...p }))
            };
            
            // Save to localStorage
            saveData();
            
            closeAutoAssignSettingsModal();
            alert('Auto-assign settings saved successfully!');
        }

        // Inline settings page version of auto-assign settings
        function renderAutoAssignSettingsInline() {
            const container = document.getElementById('settings-auto-assign-list');
            if (!container) return;

            // Ensure settings exist
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                data.autoAssignSettings = {
                    parameters: [
                        { id: 'ridersPerCoach', name: 'Riders per Coach', value: 6, priority: 1, enabled: true, type: 'number', min: 1, max: 20, description: 'Maximum riders per coach (capacity multiplier)' },
                        { id: 'minLeaderLevel', name: 'Minimum Leader Level', value: 2, priority: 2, enabled: true, type: 'number', min: 1, max: 3, description: 'Minimum coach level required to lead a group' },
                        { id: 'preferredCoachesPerGroup', name: 'Preferred Coaches per Group', value: 3, priority: 3, enabled: true, type: 'number', min: 1, max: 10, description: 'Target number of coaches per group' },
                        { id: 'preferredGroupSize', name: 'Preferred Group Size Range', valueMin: 4, valueMax: 8, priority: 4, enabled: true, type: 'range', min: 1, max: 30, description: 'Preferred number of riders per group (min-max range)' }
                    ]
                };
            }

            // Work directly with data (no draft needed for inline)
            const sortedParams = [...data.autoAssignSettings.parameters].sort((a, b) => a.priority - b.priority);

            container.innerHTML = sortedParams.map(param => {
                const isRange = param.type === 'range' || (param.valueMin !== undefined && param.valueMax !== undefined);
                let inputHtml = '';
                if (isRange) {
                    inputHtml = `
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="font-size: 12px; color: #666;">Min:</label>
                                <input type="number" value="${param.valueMin || param.min || 1}" min="${param.min || 1}" max="${param.max || 100}"
                                    style="width: 80px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                    onchange="updateInlineAutoAssignRange('${param.id}', 'min', this.value)">
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="font-size: 12px; color: #666;">Max:</label>
                                <input type="number" value="${param.valueMax || param.max || 100}" min="${param.min || 1}" max="${param.max || 100}"
                                    style="width: 80px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                    onchange="updateInlineAutoAssignRange('${param.id}', 'max', this.value)">
                            </div>
                        </div>`;
                } else {
                    inputHtml = `
                        <input type="number" value="${param.value || 1}" min="${param.min || 1}" max="${param.max || 100}"
                            style="width: 100px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                            onchange="updateInlineAutoAssignValue('${param.id}', this.value)">`;
                }
                return `
                    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; background: #fafafa;">
                        <label style="font-weight: 600; color: #333; font-size: 14px; display: block; margin-bottom: 2px;">${escapeHtml(param.name)}</label>
                        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${escapeHtml(param.description || '')}</div>
                        ${inputHtml}
                    </div>`;
            }).join('');

            // Group pace order
            const groupPaceOrder = data.seasonSettings?.groupPaceOrder || 'fastest_to_slowest';
            container.innerHTML += `
                <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px 16px; margin-bottom: 10px; background: #fafafa;">
                    <label style="font-weight: 600; color: #333; font-size: 14px; display: block; margin-bottom: 2px;">Group Pace Order</label>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Controls the order in which groups are displayed</div>
                    <select style="padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 200px;" onchange="updateInlineGroupPaceOrder(this.value)">
                        <option value="fastest_to_slowest" ${groupPaceOrder === 'fastest_to_slowest' ? 'selected' : ''}>Fastest to Slowest</option>
                        <option value="slowest_to_fastest" ${groupPaceOrder === 'slowest_to_fastest' ? 'selected' : ''}>Slowest to Fastest</option>
                    </select>
                </div>`;
        }

        function updateInlineAutoAssignValue(id, value) {
            if (!data.autoAssignSettings) return;
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param) return;
            const numValue = parseInt(value, 10);
            if (Number.isFinite(numValue)) {
                param.value = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
            }
        }

        function updateInlineAutoAssignRange(id, minOrMax, value) {
            if (!data.autoAssignSettings) return;
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param) return;
            const numValue = parseInt(value, 10);
            if (Number.isFinite(numValue)) {
                if (minOrMax === 'min') {
                    param.valueMin = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
                    if (param.valueMax !== undefined && param.valueMin > param.valueMax) param.valueMin = param.valueMax;
                } else {
                    param.valueMax = Math.max(param.min || 1, Math.min(param.max || 100, numValue));
                    if (param.valueMin !== undefined && param.valueMax < param.valueMin) param.valueMax = param.valueMin;
                }
            }
        }

        function updateInlineGroupPaceOrder(value) {
            if (!data.seasonSettings) data.seasonSettings = {};
            data.seasonSettings.groupPaceOrder = value === 'slowest_to_fastest' ? 'slowest_to_fastest' : 'fastest_to_slowest';
        }

        function saveAutoAssignSettingsInline() {
            saveData();
            if (typeof updateAutoAssignSettings === 'function') {
                updateAutoAssignSettings({ parameters: data.autoAssignSettings.parameters });
            }
            if (data.seasonSettings && typeof updateSeasonSettings === 'function') {
                updateSeasonSettings(data.seasonSettings);
            }
            alert('Group assignment rules saved!');
        }
