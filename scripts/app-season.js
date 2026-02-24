// app-season.js — Season setup modal, practice rows, date range/time range pickers

        function openSeasonSetupModal() {
            // Switch to settings tab instead of opening modal
            switchTab('settings', document.querySelector('.tab[onclick*="settings"]'));
        }

        function closeSeasonSetupModal() {
            const modal = document.getElementById('season-setup-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            seasonSettingsDraft = null;
        }

        function openPracticesModal() {
            const modal = document.getElementById('practices-modal');
            if (!modal) return;
            
            ensureSeasonDraft();
            renderPracticeRows('practice-rows-modal');
            
            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closePracticesModal() {
            const modal = document.getElementById('practices-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            
            // Re-render the dashboard practice rows to show updated list
            renderPracticeRows('practice-rows');
        }

        function addPracticeRowInModal() {
            addPracticeRow();
            renderPracticeRows('practice-rows-modal');
        }

        function openAddSinglePracticeModalInModal() {
            addSinglePracticeRow();
            renderPracticeRows('practice-rows-modal');
        }

        // Time Range Picker Modal (currentPracticeIdForTimeRange in app-state.js)

        function openTimeRangePickerModal(practiceId) {
            currentPracticeIdForTimeRange = practiceId;
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;

            const modal = document.getElementById('time-range-picker-modal');
            if (!modal) return;

            const startInput = document.getElementById('time-range-start');
            const endInput = document.getElementById('time-range-end');
            const preview = document.getElementById('time-range-preview');

            if (startInput) startInput.value = practice.time || '';
            if (endInput) endInput.value = practice.endTime || '';
            
            updateTimeRangePreview();

            // Add event listeners for live preview
            if (startInput) {
                startInput.oninput = updateTimeRangePreview;
            }
            if (endInput) {
                endInput.oninput = updateTimeRangePreview;
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeTimeRangePickerModal() {
            const modal = document.getElementById('time-range-picker-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            currentPracticeIdForTimeRange = null;
        }

        function updateTimeRangePreview() {
            const startInput = document.getElementById('time-range-start');
            const endInput = document.getElementById('time-range-end');
            const preview = document.getElementById('time-range-preview');

            if (!preview) return;

            const startTime = startInput ? startInput.value : '';
            const endTime = endInput ? endInput.value : '';

            if (startTime && endTime) {
                const startFormatted = formatTimeForDisplay(startTime);
                const endFormatted = formatTimeForDisplay(endTime);
                preview.textContent = `${startFormatted} – ${endFormatted}`;
            } else if (startTime) {
                preview.textContent = `${formatTimeForDisplay(startTime)} – (no end time)`;
            } else if (endTime) {
                preview.textContent = `(no start time) – ${formatTimeForDisplay(endTime)}`;
            } else {
                preview.textContent = '—';
            }
        }

        function saveTimeRange() {
            if (!currentPracticeIdForTimeRange) return;

            const startInput = document.getElementById('time-range-start');
            const endInput = document.getElementById('time-range-end');

            const startTime = startInput ? startInput.value : '';
            const endTime = endInput ? endInput.value : '';

            if (startTime) {
                updatePracticeDraft(currentPracticeIdForTimeRange, 'time', startTime);
            }
            if (endTime) {
                updatePracticeDraft(currentPracticeIdForTimeRange, 'endTime', endTime);
            }

            closeTimeRangePickerModal();
        }

        // Season Date Range Picker (seasonDateRangePickerState in app-state.js)

        function openSeasonDateRangePickerModal() {
            const modal = document.getElementById('season-date-range-picker-modal');
            if (!modal) return;

            // Load current season dates
            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const startDate = settings.startDate ? parseISODate(settings.startDate) : null;
            const endDate = settings.endDate ? parseISODate(settings.endDate) : null;

            seasonDateRangePickerState = {
                currentMonth: startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), 1) : new Date(),
                startDate: startDate,
                endDate: endDate,
                selectingStart: !startDate
            };

            renderSeasonDateRangeCalendars();
            updateSeasonDateRangePreview();

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeSeasonDateRangePickerModal() {
            const modal = document.getElementById('season-date-range-picker-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            updateSeasonDateRangeButton();
        }

        function navigateSeasonDateRangeMonths(delta) {
            const newDate = new Date(seasonDateRangePickerState.currentMonth);
            newDate.setMonth(newDate.getMonth() + delta);
            seasonDateRangePickerState.currentMonth = newDate;
            renderSeasonDateRangeCalendars();
        }

        function renderSeasonDateRangeCalendars() {
            const container = document.getElementById('season-date-range-calendars');
            const monthsDisplay = document.getElementById('season-date-range-months-display');
            if (!container || !monthsDisplay) return;

            const month1 = new Date(seasonDateRangePickerState.currentMonth);
            const month2 = new Date(month1);
            month2.setMonth(month2.getMonth() + 1);

            const month1Name = month1.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const month2Name = month2.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            monthsDisplay.textContent = `${month1Name} & ${month2Name}`;

            const calendar1 = renderSeasonDateRangeCalendar(month1, 0);
            const calendar2 = renderSeasonDateRangeCalendar(month2, 1);

            container.innerHTML = calendar1 + calendar2;
        }

        function renderSeasonDateRangeCalendar(month, index) {
            const year = month.getFullYear();
            const monthIndex = month.getMonth();

            const firstDay = new Date(year, monthIndex, 1);
            const lastDay = new Date(year, monthIndex + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startingDayOfWeek = firstDay.getDay();

            const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

            let html = `
                <div class="season-date-range-calendar" style="flex: 1;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #333;">${monthName}</div>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
                        ${dayLabels.map(label => `
                            <div style="text-align: center; font-size: 11px; font-weight: 600; color: #666; padding: 8px 4px;">${label}</div>
                        `).join('')}
            `;

            // Add empty cells for days before month starts
            for (let i = 0; i < startingDayOfWeek; i++) {
                html += `<div style="padding: 8px;"></div>`;
            }

            // Add day cells
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, monthIndex, day);
                const dateKey = formatDateToISO(date);
                const isSelected = isDateInRange(date, seasonDateRangePickerState.startDate, seasonDateRangePickerState.endDate);
                const isStart = seasonDateRangePickerState.startDate && formatDateToISO(seasonDateRangePickerState.startDate) === dateKey;
                const isEnd = seasonDateRangePickerState.endDate && formatDateToISO(seasonDateRangePickerState.endDate) === dateKey;
                const isToday = formatDateToISO(new Date()) === dateKey;

                let bgColor = 'transparent';
                let textColor = '#333';
                if (isStart || isEnd) {
                    bgColor = '#2196F3';
                    textColor = 'white';
                } else if (isSelected) {
                    bgColor = '#e3f2fd';
                    textColor = '#1976d2';
                } else if (isToday) {
                    bgColor = '#fff9c4';
                    textColor = '#333';
                }

                const hoverBg = isStart || isEnd ? bgColor : '#f5f5f5';
                html += `
                    <div onclick="selectSeasonDateRange('${dateKey}')" 
                         data-date-key="${dateKey}"
                         data-is-start="${isStart}"
                         data-is-end="${isEnd}"
                         data-bg-color="${bgColor}"
                         style="padding: 8px; text-align: center; cursor: pointer; border-radius: 4px; background: ${bgColor}; color: ${textColor}; ${(isStart || isEnd) ? 'font-weight: 600;' : ''} transition: background 0.2s;"
                         onmouseover="if (this.dataset.isStart !== 'true' && this.dataset.isEnd !== 'true') this.style.background='${hoverBg}';"
                         onmouseout="this.style.background=this.dataset.bgColor;">
                        ${day}
                    </div>
                `;
            }

            html += `</div></div>`;
            return html;
        }

        function isDateInRange(date, startDate, endDate) {
            if (!startDate || !endDate) return false;
            const dateKey = formatDateToISO(date);
            const startKey = formatDateToISO(startDate);
            const endKey = formatDateToISO(endDate);
            return dateKey >= startKey && dateKey <= endKey;
        }

        function selectSeasonDateRange(dateKey) {
            const date = parseISODate(dateKey);
            if (!date) return;

            if (!seasonDateRangePickerState.startDate || 
                (seasonDateRangePickerState.startDate && seasonDateRangePickerState.endDate)) {
                // Start new selection
                seasonDateRangePickerState.startDate = date;
                seasonDateRangePickerState.endDate = null;
                seasonDateRangePickerState.selectingStart = false;
            } else if (seasonDateRangePickerState.startDate && formatDateToISO(date) < formatDateToISO(seasonDateRangePickerState.startDate)) {
                // New start date is before current start, swap them
                seasonDateRangePickerState.endDate = seasonDateRangePickerState.startDate;
                seasonDateRangePickerState.startDate = date;
            } else {
                // Complete the range
                seasonDateRangePickerState.endDate = date;
                seasonDateRangePickerState.selectingStart = true;
            }

            renderSeasonDateRangeCalendars();
            updateSeasonDateRangePreview();
        }

        function updateSeasonDateRangePreview() {
            const preview = document.getElementById('season-date-range-preview');
            if (!preview) return;

            const previewText = preview.querySelector('div:last-child');
            if (!previewText) return;

            if (seasonDateRangePickerState.startDate && seasonDateRangePickerState.endDate) {
                const startStr = seasonDateRangePickerState.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = seasonDateRangePickerState.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                previewText.textContent = `${startStr} – ${endStr}`;
            } else if (seasonDateRangePickerState.startDate) {
                const startStr = seasonDateRangePickerState.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                previewText.textContent = `${startStr} – (select end date)`;
            } else {
                previewText.textContent = '—';
            }
        }

        function clearSeasonDateRange() {
            seasonDateRangePickerState.startDate = null;
            seasonDateRangePickerState.endDate = null;
            seasonDateRangePickerState.selectingStart = true;
            renderSeasonDateRangeCalendars();
            updateSeasonDateRangePreview();
        }

        function syncSeasonDatesToMain() {
            // Sync dates from setup modal inputs to main inputs (they share the same IDs)
            const startSetup = document.getElementById('season-start-date-setup');
            const endSetup = document.getElementById('season-end-date-setup');
            const startMain = document.getElementById('season-start-date');
            const endMain = document.getElementById('season-end-date');
            
            if (startSetup && startMain) startMain.value = startSetup.value;
            if (endSetup && endMain) endMain.value = endSetup.value;
            
            updateSeasonDateRange();
            updateSeasonDateRangeButton();
        }

        function saveSeasonDateRange() {
            if (!seasonDateRangePickerState.startDate) {
                alert('Please select a start date.');
                return;
            }
            if (!seasonDateRangePickerState.endDate) {
                alert('Please select an end date.');
                return;
            }

            const startDateStr = formatDateToISO(seasonDateRangePickerState.startDate);
            const endDateStr = formatDateToISO(seasonDateRangePickerState.endDate);

            // Update all date inputs (main and setup modal)
            const startInput = document.getElementById('season-start-date');
            const endInput = document.getElementById('season-end-date');
            const startInputSetup = document.getElementById('season-start-date-setup');
            const endInputSetup = document.getElementById('season-end-date-setup');

            if (startInput) startInput.value = startDateStr;
            if (endInput) endInput.value = endDateStr;
            if (startInputSetup) startInputSetup.value = startDateStr;
            if (endInputSetup) endInputSetup.value = endDateStr;

            // Save to data.seasonSettings immediately
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            data.seasonSettings.startDate = startDateStr;
            data.seasonSettings.endDate = endDateStr;
            
            // Save to database
            saveData();
            
            // Update UI
            updateSeasonDateRange();
            updateSeasonDateRangeButton();
            
            // Refresh calendar to show new dates
            renderAllCalendars();
            
            closeSeasonDateRangePickerModal();
        }

        function updateSeasonDateRangeButton() {
            const button = document.getElementById('season-date-range-button');
            const buttonSetup = document.getElementById('season-date-range-button-setup');
            const buttons = [button, buttonSetup].filter(Boolean);

            if (buttons.length === 0) return;

            const settings = data.seasonSettings || buildDefaultSeasonSettings();
            const startDate = settings.startDate ? parseISODate(settings.startDate) : null;
            const endDate = settings.endDate ? parseISODate(settings.endDate) : null;

            let buttonText = 'Select Date Range';
            if (startDate && endDate) {
                const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                buttonText = `${startStr} – ${endStr}`;
            } else if (startDate) {
                const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                buttonText = `${startStr} – (no end date)`;
            }

            buttons.forEach(btn => {
                if (btn.id === 'season-date-range-button') {
                    btn.textContent = 'Season dates. . .';
                } else {
                    btn.textContent = buttonText;
                }
            });
        }

        function ensureSeasonDraft() {
            if (!seasonSettingsDraft) {
                const settings = data.seasonSettings || buildDefaultSeasonSettings();
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
                            rosterFilter: practice.rosterFilter || null,
                            excludeFromPlanner: practice.excludeFromPlanner || false
                        }))
                        : []
                };
            }
        }

        // originalPracticeStates in app-state.js

        function renderPracticeRows(containerId = 'practice-rows') {
            ensureSeasonDraft();
            const container = document.getElementById(containerId);
            if (!container) return;

            if (!seasonSettingsDraft || seasonSettingsDraft.practices.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:12px;">
                        No regular practices yet. Add one to get started.
                    </div>
                `;
                originalPracticeStates.clear();
                return;
            }
            
            // Store original states if not already stored
            seasonSettingsDraft.practices.forEach(practice => {
                const key = String(practice.id);
                if (!originalPracticeStates.has(key)) {
                    originalPracticeStates.set(key, JSON.parse(JSON.stringify(practice)));
                }
            });
            
            // Determine if this is read-only view (dashboard) or editable view (modal)
            const isReadOnly = containerId === 'practice-rows';
            
            // Keep practices in the order they were created (no sorting)
            const rowsHtml = seasonSettingsDraft.practices.map((practice, index) => {
                const isSinglePractice = practice.specificDate !== null && practice.specificDate !== undefined;
                const hasLocation = practice.locationLat && practice.locationLng;
                
                // Generate description if not set
                let defaultDescription = practice.description;
                if (!defaultDescription || defaultDescription.startsWith('Weekly Practice')) {
                    if (isSinglePractice) {
                        const practiceDate = parseISODate(practice.specificDate);
                        if (practiceDate) {
                            const dayName = DAYS_OF_WEEK[practiceDate.getDay()];
                            defaultDescription = generatePracticeDescription(dayName, practice.time || '15:30');
                        } else {
                            defaultDescription = 'Practice';
                        }
                    } else if (practice.dayOfWeek !== null && practice.dayOfWeek !== undefined) {
                        const dayName = DAYS_OF_WEEK[practice.dayOfWeek];
                        defaultDescription = generatePracticeDescription(dayName, practice.time || '15:30');
                    } else {
                        defaultDescription = `Practice ${index + 1}`;
                    }
                }

                // Render day of week or date field
                let dayFieldHtml = '';
                if (isReadOnly) {
                    if (isSinglePractice) {
                        const practiceDate = parseISODate(practice.specificDate);
                        const dateStr = practiceDate ? practiceDate.toLocaleDateString() : practice.specificDate || '';
                        dayFieldHtml = `
                            <div class="practice-row-field">
                                <label>Date</label>
                                <div style="padding: 4px 6px; font-size: 12px; color: #333;">${dateStr}</div>
                            </div>
                        `;
                    } else {
                        const dayName = practice.dayOfWeek !== null && practice.dayOfWeek !== undefined 
                            ? DAYS_OF_WEEK[practice.dayOfWeek] 
                            : '';
                        dayFieldHtml = `
                            <div class="practice-row-field">
                                <label>Day of Week</label>
                                <div style="padding: 4px 6px; font-size: 12px; color: #333;">${dayName}</div>
                            </div>
                        `;
                    }
                } else {
                    // Editable fields for modal
                    if (isSinglePractice) {
                        dayFieldHtml = `
                            <div class="practice-row-field">
                                <label>Date</label>
                                <input type="date" value="${practice.specificDate || ''}" onchange="updatePracticeDraft(${practice.id}, 'specificDate', this.value); updatePracticeDescription(${practice.id});">
                            </div>
                        `;
                    } else {
                        const options = DAYS_OF_WEEK.map((day, dayIndex) => `
                            <option value="${dayIndex}" ${practice.dayOfWeek === dayIndex ? 'selected' : ''}>${day}</option>
                        `).join('');
                        dayFieldHtml = `
                            <div class="practice-row-field">
                                <label>Day of Week</label>
                                <select onchange="updatePracticeDraft(${practice.id}, 'dayOfWeek', this.value); updatePracticeDescription(${practice.id});">
                                    ${options}
                                </select>
                            </div>
                        `;
                    }
                }

                // Format time range for display
                const timeRange = (practice.time || '') && (practice.endTime || '') 
                    ? `${practice.time} – ${practice.endTime}`
                    : practice.time || practice.endTime || '';
                
                // Format time range for button display
                let timeRangeDisplay = 'Set Time Range';
                if (practice.time && practice.endTime) {
                    timeRangeDisplay = `${formatTimeForDisplay(practice.time)} – ${formatTimeForDisplay(practice.endTime)}`;
                } else if (practice.time) {
                    timeRangeDisplay = `${formatTimeForDisplay(practice.time)} – (no end time)`;
                } else if (practice.endTime) {
                    timeRangeDisplay = `(no start time) – ${formatTimeForDisplay(practice.endTime)}`;
                }

                if (isReadOnly) {
                    const isExcluded = !!practice.excludeFromPlanner;
                    return `
                        <div class="practice-row${isExcluded ? ' practice-row-excluded' : ''}" data-practice-id="${practice.id}" style="grid-template-columns: auto minmax(80px, 0.8fr) minmax(120px, 1fr) minmax(140px, 1.2fr) minmax(100px, 1fr);">
                            <div class="practice-row-field" style="display: flex; align-items: center; justify-content: center; min-width: 32px;">
                                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; color: #666; white-space: nowrap;" title="${isExcluded ? 'Not included in Practice Planner' : 'Included in Practice Planner'}">
                                    <input type="checkbox" ${isExcluded ? '' : 'checked'} onchange="togglePracticeExcludeFromPlanner(${practice.id}, !this.checked, this)" style="margin: 0; cursor: pointer;">
                                    <span>Plan</span>
                                </label>
                            </div>
                            ${dayFieldHtml}
                            <div class="practice-row-field">
                                <label>Time Range</label>
                                <div style="padding: 4px 6px; font-size: 12px; color: #333; white-space: nowrap;">${timeRangeDisplay}</div>
                            </div>
                            <div class="practice-row-field">
                                <label>Description</label>
                                <div style="padding: 4px 6px; font-size: 12px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(defaultDescription)}">${escapeHtml(defaultDescription)}</div>
                            </div>
                            <div class="practice-row-field">
                                <label>Meet Location</label>
                                <div style="padding: 4px 6px; font-size: 12px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(practice.meetLocation || '')}">${escapeHtml(practice.meetLocation || '—')}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // Editable view for modal - buttons on separate line
                    return `
                        <div style="border: 1px solid #e0e0e0; border-radius: 4px; background: #f9f9f9; padding: 10px; margin-bottom: 10px;">
                            <div class="practice-row" data-practice-id="${practice.id}" style="grid-template-columns: minmax(140px, 1fr) minmax(180px, 1.2fr) minmax(200px, 1.5fr) minmax(200px, 1.5fr); border: none; background: transparent; padding: 0; margin: 0;">
                                ${dayFieldHtml}
                                <div class="practice-row-field">
                                    <label>Time Range</label>
                                    <button type="button" class="btn-small secondary" onclick="openTimeRangePickerModal(${practice.id})" style="width: 100%; text-align: left; justify-content: flex-start; padding: 8px 12px; background: white; border: 1px solid #ddd; cursor: pointer; color: #333;">
                                        ${escapeHtml(timeRangeDisplay)}
                                    </button>
                                </div>
                                <div class="practice-row-field">
                                    <label>Description</label>
                                    <input type="text" value="${escapeHtml(defaultDescription)}" placeholder="Practice description" onchange="updatePracticeDraft(${practice.id}, 'description', this.value)" id="practice-desc-${practice.id}" style="width: 100%;">
                                </div>
                                <div class="practice-row-field">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label>Meet Location</label>
                                        <span style="font-size: 10px; color: #666; margin-right: 4px;">Map</span>
                                    </div>
                                    <div style="display: flex; gap: 4px; align-items: flex-start;">
                                        <input type="text" value="${escapeHtml(practice.meetLocation || '')}" placeholder="Enter location" onchange="updatePracticeDraft(${practice.id}, 'meetLocation', this.value)" style="flex: 1; min-height: 32px; box-sizing: border-box;">
                                        <button type="button" class="btn-small location-button" onclick="openLocationMap(${practice.id})" title="Set location on map" style="height: 32px; padding: 6px 12px; display: flex; align-items: center; justify-content: center; margin-top: 0;">
                                            ${hasLocation ? '📍' : '🗺️'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid #e0e0e0; margin-top: 12px;">
                                <button type="button" class="btn-small secondary" onclick="openRosterRefinement(${practice.id})" style="white-space: nowrap;">Refine Roster...</button>
                                ${(function(){ const ex = getPracticeExceptions(practice); return ex.length > 0 ? `<button type="button" class="btn-small secondary" onclick="openViewExceptionsDialog(${practice.id})" style="white-space: nowrap;">View Exceptions (${ex.length})</button>` : ''; })()}
                                <div style="flex: 1;"></div>
                                <div id="practice-actions-${practice.id}" style="display: none; gap: 8px;">
                                    <button class="btn-small" onclick="savePracticeChanges(${practice.id})">Save Changes</button>
                                    <button class="btn-small secondary" onclick="discardPracticeChanges(${practice.id})">Discard</button>
                                </div>
                                <button class="btn-small danger" onclick="removePracticeRow(${practice.id})">Remove</button>
                            </div>
                        </div>
                    `;
                }
            }).join('');
            
            container.innerHTML = rowsHtml;
            
            // Check for changes and show/hide buttons
            seasonSettingsDraft.practices.forEach(practice => {
                checkPracticeChanges(practice.id);
            });
        }
        
        function checkPracticeChanges(practiceId) {
            const key = String(practiceId);
            const original = originalPracticeStates.get(key);
            if (!original) return;
            
            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;
            
            // Compare current state with original
            // Also check rosterFilter by comparing JSON strings
            const originalRosterFilter = original.rosterFilter ? JSON.stringify(original.rosterFilter) : null;
            const currentRosterFilter = practice.rosterFilter ? JSON.stringify(practice.rosterFilter) : null;
            const rosterFilterChanged = originalRosterFilter !== currentRosterFilter;
            
            const hasChanges = (
                practice.dayOfWeek !== original.dayOfWeek ||
                practice.specificDate !== original.specificDate ||
                practice.time !== original.time ||
                practice.endTime !== original.endTime ||
                practice.description !== original.description ||
                practice.meetLocation !== original.meetLocation ||
                practice.locationLat !== original.locationLat ||
                practice.locationLng !== original.locationLng ||
                rosterFilterChanged
            );
            
            const actionsDiv = document.getElementById(`practice-actions-${practiceId}`);
            if (actionsDiv) {
                actionsDiv.style.display = hasChanges ? 'flex' : 'none';
            }
        }

        function updatePracticeDraft(id, field, value) {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practiceIndex = seasonSettingsDraft.practices.findIndex(practice => String(practice.id) === String(id));
            if (practiceIndex === -1) return;

            if (field === 'dayOfWeek') {
                const day = parseInt(value, 10);
                if (Number.isFinite(day) && day >= 0 && day <= 6) {
                    seasonSettingsDraft.practices[practiceIndex].dayOfWeek = day;
                    seasonSettingsDraft.practices[practiceIndex].specificDate = null; // Clear specific date when day of week is set
                    updatePracticeDescription(id);
                    // Refresh calendar to show updated practice days
                    renderAllCalendars();
                }
            } else if (field === 'specificDate') {
                seasonSettingsDraft.practices[practiceIndex].specificDate = value || null;
                seasonSettingsDraft.practices[practiceIndex].dayOfWeek = null; // Clear day of week when specific date is set
                updatePracticeDescription(id);
                // Refresh calendar to show updated practice dates
                renderAllCalendars();
            } else if (field === 'time') {
                const normalizedTime = normalizeTimeValue(value);
                seasonSettingsDraft.practices[practiceIndex].time = normalizedTime;
                updatePracticeDescription(id);
                // Refresh calendar when time changes (affects display)
                renderAllCalendars();
            } else if (field === 'endTime') {
                const normalizedTime = normalizeTimeValue(value);
                seasonSettingsDraft.practices[practiceIndex].endTime = normalizedTime;
            } else if (field === 'description') {
                seasonSettingsDraft.practices[practiceIndex].description = value || '';
            } else if (field === 'meetLocation') {
                seasonSettingsDraft.practices[practiceIndex].meetLocation = value || '';
            } else if (field === 'locationLat') {
                const lat = parseFloat(value);
                seasonSettingsDraft.practices[practiceIndex].locationLat = Number.isFinite(lat) ? lat : null;
            } else if (field === 'locationLng') {
                const lng = parseFloat(value);
                seasonSettingsDraft.practices[practiceIndex].locationLng = Number.isFinite(lng) ? lng : null;
            }

            // Re-render both containers if they exist
            renderPracticeRows('practice-rows');
            renderPracticeRows('practice-rows-modal');
            // Check for changes after update
            checkPracticeChanges(id);
        }

        function addPracticeRow() {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const defaultDay = seasonSettingsDraft.practices.length > 0
                ? (seasonSettingsDraft.practices[seasonSettingsDraft.practices.length - 1].dayOfWeek + 2) % 7
                : 2; // Wednesday default

            const practiceNumber = seasonSettingsDraft.practices.length + 1;
            const dayName = DAYS_OF_WEEK[defaultDay];
            const timeStr = '15:30';
            const description = generatePracticeDescription(dayName, timeStr);

            const newPractice = {
                id: generateId(),
                dayOfWeek: defaultDay,
                specificDate: null, // Recurring practice
                time: timeStr,
                endTime: '17:00',
                description: description,
                meetLocation: '',
                locationLat: null,
                locationLng: null,
                rosterFilter: null
            };

            seasonSettingsDraft.practices.push(newPractice);

            // Immediately save to data.seasonSettings so it persists and shows on calendar
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            if (!Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices = [];
            }
            
            // Normalize and add to data.seasonSettings
            const normalized = normalizePracticeEntry(newPractice);
            if (normalized) {
                data.seasonSettings.practices.push({
                    ...normalized,
                    description: newPractice.description || '',
                    meetLocation: newPractice.meetLocation || '',
                    locationLat: newPractice.locationLat || null,
                    locationLng: newPractice.locationLng || null,
                    rosterFilter: newPractice.rosterFilter || null
                });
                
                // Save to database/localStorage
                saveData();
                
                // Refresh calendar to show new practice
                renderAllCalendars();
            }

            // Re-render both containers if they exist
            renderPracticeRows('practice-rows');
            renderPracticeRows('practice-rows-modal');
            
            // Always refresh calendar when any practice field changes (ensures calendar stays in sync)
            renderAllCalendars();
        }

        function addSinglePracticeRow() {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            // Default to today's date
            const today = new Date();
            const defaultDate = today.toISOString().split('T')[0];
            
            // Get day name for description
            const dayName = DAYS_OF_WEEK[today.getDay()];
            const timeStr = '15:30';
            const description = generatePracticeDescription(dayName, timeStr);

            const newPractice = {
                id: generateId(),
                dayOfWeek: null, // Single practice uses specificDate instead
                specificDate: defaultDate,
                time: timeStr,
                endTime: '17:00',
                description: description,
                meetLocation: '',
                locationLat: null,
                locationLng: null,
                rosterFilter: null
            };

            seasonSettingsDraft.practices.push(newPractice);

            // Immediately save to data.seasonSettings so it persists and shows on calendar
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            if (!Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices = [];
            }
            
            // Single practices use specificDate, so save directly (don't normalize)
            data.seasonSettings.practices.push({
                id: newPractice.id,
                dayOfWeek: null,
                specificDate: newPractice.specificDate,
                time: newPractice.time,
                endTime: newPractice.endTime,
                description: newPractice.description || '',
                meetLocation: newPractice.meetLocation || '',
                locationLat: newPractice.locationLat || null,
                locationLng: newPractice.locationLng || null,
                rosterFilter: newPractice.rosterFilter || null
            });
            
            // Save to database/localStorage
            saveData();
            
            // Refresh calendar to show new practice
            renderAllCalendars();

            renderPracticeRows();
        }

        function parseISODate(dateStr) {
            if (!dateStr) return null;
            try {
                const date = new Date(dateStr + 'T00:00:00');
                if (isNaN(date.getTime())) return null;
                return date;
            } catch (e) {
                return null;
            }
        }

        function generatePracticeDescription(dayName, timeStr) {
            if (!dayName || !timeStr) return 'Practice';
            
            // Parse time to determine morning/afternoon/evening
            const timeParts = timeStr.split(':');
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            const totalMinutes = hour * 60 + minute;
            
            let timeOfDay = 'practice';
            if (totalMinutes < 12 * 60) {
                timeOfDay = 'morning practice';
            } else if (totalMinutes < 17 * 60) {
                timeOfDay = 'afternoon practice';
            } else {
                timeOfDay = 'evening practice';
            }
            
            return `${dayName} ${timeOfDay}`;
        }

        function updatePracticeDescription(practiceId) {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practiceIndex = seasonSettingsDraft.practices.findIndex(p => String(p.id) === String(practiceId));
            if (practiceIndex === -1) return;

            const practice = seasonSettingsDraft.practices[practiceIndex];
            
            // Only update if description hasn't been manually edited (starts with day name pattern)
            const descInput = document.getElementById(`practice-desc-${practiceId}`);
            if (!descInput) return;
            
            const currentDesc = descInput.value.trim();
            // Check if description matches auto-generated pattern (day name + time of day)
            const isAutoGenerated = currentDesc && (
                currentDesc.includes('morning practice') ||
                currentDesc.includes('afternoon practice') ||
                currentDesc.includes('evening practice') ||
                currentDesc.startsWith('Weekly Practice') ||
                currentDesc === 'Practice'
            );
            
            if (isAutoGenerated || !currentDesc) {
                let dayName = null;
                
                if (practice.specificDate) {
                    const practiceDate = parseISODate(practice.specificDate);
                    if (practiceDate) {
                        dayName = DAYS_OF_WEEK[practiceDate.getDay()];
                    }
                } else if (practice.dayOfWeek !== null && practice.dayOfWeek !== undefined) {
                    dayName = DAYS_OF_WEEK[practice.dayOfWeek];
                }
                
                if (dayName && practice.time) {
                    const newDescription = generatePracticeDescription(dayName, practice.time);
                    practice.description = newDescription;
                    descInput.value = newDescription;
                }
            }
        }

        function savePracticeChanges(practiceId) {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;
            
            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (!practice) return;
            
            // Get the practice row inputs
            const row = document.querySelector(`[data-practice-id="${practiceId}"]`);
            if (!row) return;
            
            // Get updated values from the row
            const dayOfWeekSelect = row.querySelector('select[onchange*="dayOfWeek"]');
            const dateInput = row.querySelector('input[type="date"]');
            const timeInput = row.querySelector('input[type="time"]:not([placeholder="End"])');
            const endTimeInput = row.querySelector('input[type="time"][placeholder="End"]');
            const descriptionInput = row.querySelector('input[id^="practice-desc-"]');
            const locationInput = row.querySelector('input[onchange*="meetLocation"]');
            
            // Get updated values
            // Determine practice type based on which input exists (select = recurring, date input = single)
            const isRecurringPractice = dayOfWeekSelect !== null;
            const isSinglePractice = dateInput !== null && !dayOfWeekSelect;
            
            let updatedDayOfWeek = null;
            let updatedSpecificDate = null;
            
            if (isRecurringPractice) {
                // Recurring practice - get day of week from select
                const dayValue = dayOfWeekSelect.value;
                if (dayValue !== '' && dayValue !== null && dayValue !== undefined) {
                    const parsedDay = parseInt(dayValue, 10);
                    if (Number.isFinite(parsedDay) && parsedDay >= 0 && parsedDay <= 6) {
                        updatedDayOfWeek = parsedDay;
                    }
                }
                // Always fallback to practice.dayOfWeek if select value is invalid or empty
                // This handles cases where the select exists but hasn't been changed yet
                if ((updatedDayOfWeek === null || updatedDayOfWeek === undefined) && 
                    practice.dayOfWeek !== null && practice.dayOfWeek !== undefined && 
                    Number.isFinite(practice.dayOfWeek)) {
                    updatedDayOfWeek = practice.dayOfWeek;
                }
            } else if (isSinglePractice) {
                // Single practice - get specific date from date input
                updatedSpecificDate = dateInput.value || practice.specificDate || null;
            } else {
                // Neither input found - use practice data
                if (practice.dayOfWeek !== null && practice.dayOfWeek !== undefined && Number.isFinite(practice.dayOfWeek)) {
                    updatedDayOfWeek = practice.dayOfWeek;
                } else if (practice.specificDate) {
                    updatedSpecificDate = practice.specificDate;
                }
            }
            
            const updatedTime = timeInput ? timeInput.value : practice.time;
            const updatedEndTime = endTimeInput ? endTimeInput.value : practice.endTime;
            const updatedDescription = descriptionInput ? descriptionInput.value : practice.description;
            const updatedMeetLocation = locationInput ? locationInput.value : practice.meetLocation;
            
            // Get location from practice draft (may have been set via map)
            const updatedLocationLat = practice.locationLat;
            const updatedLocationLng = practice.locationLng;
            
            // Validate that we have either a day of week or specific date
            // Check if dayOfWeek is a valid number (0-6, where 0 is Sunday)
            const hasValidDayOfWeek = updatedDayOfWeek !== null && 
                                      updatedDayOfWeek !== undefined && 
                                      Number.isFinite(updatedDayOfWeek) && 
                                      updatedDayOfWeek >= 0 && 
                                      updatedDayOfWeek <= 6;
            const hasSpecificDate = updatedSpecificDate && updatedSpecificDate.trim() !== '';
            
            if (!hasValidDayOfWeek && !hasSpecificDate) {
                alert('Practice must have either a day of week or a specific date.');
                return;
            }
            
            const isRecurring = hasValidDayOfWeek && !hasSpecificDate;
            const isSingle = hasSpecificDate && !hasValidDayOfWeek;
            
            // Find all practices in the same series (same dayOfWeek for recurring, or same specificDate for single)
            // Exclude cancelled, rescheduled, and deleted practices
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (isRecurring) {
                // Apply to all practices with the same dayOfWeek that are not cancelled, rescheduled, or deleted
                data.rides.forEach(ride => {
                    if (!ride.date || ride.deleted || ride.cancelled || ride.rescheduledFrom) return;
                    
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return;
                    
                    // Check if this ride matches the day of week
                    if (rideDate.getDay() === updatedDayOfWeek && rideDate >= today) {
                        // Update this practice
                        ride.time = updatedTime;
                        ride.endTime = updatedEndTime;
                        ride.description = updatedDescription;
                        ride.meetLocation = updatedMeetLocation;
                        ride.locationLat = updatedLocationLat;
                        ride.locationLng = updatedLocationLng;
                    }
                });
            } else if (isSingle) {
                // For single practices, only update that specific practice
                const targetDate = parseISODate(updatedSpecificDate);
                if (targetDate) {
                    const targetDateKey = formatDateToISO(targetDate);
                    const ride = data.rides.find(r => {
                        if (!r.date || r.deleted || r.cancelled || r.rescheduledFrom) return false;
                        return formatDateToISO(parseISODate(r.date)) === targetDateKey;
                    });
                    
                    if (ride) {
                        ride.time = updatedTime;
                        ride.endTime = updatedEndTime;
                        ride.description = updatedDescription;
                        ride.meetLocation = updatedMeetLocation;
                        ride.locationLat = updatedLocationLat;
                        ride.locationLng = updatedLocationLng;
                    }
                }
            }
            
            // Also update the draft practice
            practice.dayOfWeek = isRecurring ? updatedDayOfWeek : null;
            practice.specificDate = isSingle ? updatedSpecificDate : null;
            practice.time = updatedTime;
            practice.endTime = updatedEndTime;
            practice.description = updatedDescription;
            practice.meetLocation = updatedMeetLocation;
            practice.locationLat = updatedLocationLat;
            practice.locationLng = updatedLocationLng;
            // Preserve rosterFilter from draft (it's already there from saveRosterRefinement)
            const rosterFilter = practice.rosterFilter || null;
            
            // Save to data.seasonSettings.practices
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            if (!Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices = [];
            }
            
            const settingsPracticeIndex = data.seasonSettings.practices.findIndex(
                p => String(p.id) === String(practiceId)
            );
            if (settingsPracticeIndex >= 0) {
                // Update existing practice in seasonSettings
                data.seasonSettings.practices[settingsPracticeIndex].dayOfWeek = practice.dayOfWeek;
                data.seasonSettings.practices[settingsPracticeIndex].specificDate = practice.specificDate;
                data.seasonSettings.practices[settingsPracticeIndex].time = practice.time;
                data.seasonSettings.practices[settingsPracticeIndex].endTime = practice.endTime;
                data.seasonSettings.practices[settingsPracticeIndex].description = practice.description;
                data.seasonSettings.practices[settingsPracticeIndex].meetLocation = practice.meetLocation;
                data.seasonSettings.practices[settingsPracticeIndex].locationLat = practice.locationLat;
                data.seasonSettings.practices[settingsPracticeIndex].locationLng = practice.locationLng;
                data.seasonSettings.practices[settingsPracticeIndex].rosterFilter = rosterFilter;
            }
            
            // Save changes
            saveData();
            
            // Update original state to reflect saved changes
            const key = String(practiceId);
            originalPracticeStates.set(key, JSON.parse(JSON.stringify(practice)));
            
            // Re-render both containers
            renderPracticeRows('practice-rows');
            renderPracticeRows('practice-rows-modal');
            renderAllCalendars();
            
            alert('Practice changes have been saved and applied to all practices in the series (excluding cancelled, rescheduled, and deleted practices).');
        }
        
        function discardPracticeChanges(practiceId) {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;
            
            const key = String(practiceId);
            const original = originalPracticeStates.get(key);
            if (!original) return;
            
            const practiceIndex = seasonSettingsDraft.practices.findIndex(p => String(p.id) === String(practiceId));
            if (practiceIndex === -1) return;
            
            // Restore original values
            const practice = seasonSettingsDraft.practices[practiceIndex];
            practice.dayOfWeek = original.dayOfWeek;
            practice.specificDate = original.specificDate;
            practice.time = original.time;
            practice.endTime = original.endTime;
            practice.description = original.description;
            practice.meetLocation = original.meetLocation;
            practice.locationLat = original.locationLat;
            practice.locationLng = original.locationLng;
            
            // Re-render both containers to show original values
            renderPracticeRows('practice-rows');
            renderPracticeRows('practice-rows-modal');
        }

        function removePracticeRow(id) {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            // Find the practice to check if it's a single practice
            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(id));
            const isSinglePractice = practice && practice.specificDate != null && practice.specificDate !== undefined && practice.specificDate !== '';

            // Remove from original states
            originalPracticeStates.delete(String(id));
            
            seasonSettingsDraft.practices = seasonSettingsDraft.practices.filter(practice => String(practice.id) !== String(id));
            
            // Also remove from data.seasonSettings and save to database
            if (data.seasonSettings && Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices = data.seasonSettings.practices.filter(practice => String(practice.id) !== String(id));
                saveData(); // Persist the deletion to Supabase
            }
            
            // If this is a single practice, also mark the corresponding ride as deleted
            if (isSinglePractice && practice.specificDate) {
                const ride = data.rides.find(r => r.date === practice.specificDate && !r.deleted);
                if (ride) {
                    ride.deleted = true;
                    saveData();
                }
            }
            
            // Re-render both containers
            renderPracticeRows('practice-rows');
            renderPracticeRows('practice-rows-modal');
            
            // Refresh calendar to immediately reflect the deletion
            renderAllCalendars();
        }


        function togglePracticeExcludeFromPlanner(practiceId, exclude, checkboxEl) {
            if (exclude) {
                // Show warning when excluding
                const proceed = confirm(
                    'Alert: These rides will no longer show up in the practice planner. ' +
                    'This option may be appropriate for small groups or casual rides that don\'t require much coordination. ' +
                    'Do you want to proceed with this?'
                );
                if (!proceed) {
                    // Revert checkbox
                    if (checkboxEl) checkboxEl.checked = true;
                    return;
                }
            }

            ensureSeasonDraft();
            if (!seasonSettingsDraft) return;

            const practice = seasonSettingsDraft.practices.find(p => String(p.id) === String(practiceId));
            if (practice) {
                practice.excludeFromPlanner = exclude;
            }

            // Also update data.seasonSettings immediately
            if (data.seasonSettings && Array.isArray(data.seasonSettings.practices)) {
                const livePractice = data.seasonSettings.practices.find(p => String(p.id) === String(practiceId));
                if (livePractice) {
                    livePractice.excludeFromPlanner = exclude;
                }
            }

            saveData();
            renderPracticeRows('practice-rows');
            renderAllCalendars();
        }

        // Helper: check if a ride date belongs to an excluded practice series
        function isRideDateExcludedFromPlanner(dateStr) {
            const settings = data.seasonSettings || {};
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            if (practices.length === 0) return false;

            const rideDate = parseISODate(dateStr);
            if (!rideDate) return false;
            const weekday = rideDate.getDay();
            const dateKey = formatDateToISO(rideDate);

            // Check specific-date practices first
            const specificMatch = practices.find(p => p.specificDate === dateKey);
            if (specificMatch) return !!specificMatch.excludeFromPlanner;

            // Check recurring day-of-week practices
            const recurringMatches = practices.filter(p => {
                const practiceDay = Number(p.dayOfWeek);
                const hasSpecificDate = p.specificDate != null && p.specificDate !== undefined && p.specificDate !== '';
                return Number.isFinite(practiceDay) && practiceDay === weekday && !hasSpecificDate;
            });

            // If any matching series is excluded, the ride is excluded
            // (If multiple series match the same day, exclude if ALL are excluded)
            if (recurringMatches.length > 0) {
                return recurringMatches.every(p => !!p.excludeFromPlanner);
            }

            return false;
        }

        // Helper: get excluded practice weekdays for calendar rendering
        function getExcludedPracticeDays() {
            const settings = data.seasonSettings || {};
            const practices = Array.isArray(settings.practices) ? settings.practices : [];
            const excludedDays = new Set();
            const excludedSpecificDates = new Set();

            practices.forEach(p => {
                if (!p.excludeFromPlanner) return;
                if (p.specificDate) {
                    excludedSpecificDates.add(p.specificDate);
                } else if (p.dayOfWeek !== null && p.dayOfWeek !== undefined) {
                    excludedDays.add(Number(p.dayOfWeek));
                }
            });

            return { excludedDays, excludedSpecificDates };
        }

        function updateSeasonDateRange() {
            const startInput = document.getElementById('season-start-date');
            const endInput = document.getElementById('season-end-date');
            if (startInput && endInput && startInput.value && endInput.value) {
                const startDate = parseISODate(startInput.value);
                const endDate = parseISODate(endInput.value);
                if (startDate && endDate && startDate > endDate) {
                    // Auto-adjust end date if it's before start date
                    endInput.value = startInput.value;
                }
            }
        }

        function applySeasonUpdates(scope) {
            const applyAll = confirm('Apply updates to the whole season?\n\nOK = Whole season (cancelled/rescheduled practices will be lost)\nCancel = Only from today forward');
            const fromDate = applyAll ? new Date(0) : new Date();
            fromDate.setHours(0, 0, 0, 0);
            
            // Persist current season settings (dates + regular practices) to data before re-rendering
            ensureSeasonDraft();
            const startInput = document.getElementById('season-start-date');
            const endInput = document.getElementById('season-end-date');
            const startDateValue = startInput ? startInput.value : '';
            const endDateValue = endInput ? endInput.value : '';
            const cleanedPractices = (seasonSettingsDraft?.practices || [])
                .map(practice => {
                    if (!practice || typeof practice !== 'object') {
                        return null;
                    }
                    
                    // Handle single practices (with specificDate) differently from recurring practices
                    const isSinglePractice = practice.specificDate !== null && practice.specificDate !== undefined && practice.specificDate !== '';
                    
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
                        // Recurring practice: use normalizePracticeEntry
                        const normalized = normalizePracticeEntry(practice);
                        if (!normalized) return null;
                        return {
                            ...normalized,
                            description: practice.description || '',
                            meetLocation: practice.meetLocation || '',
                            locationLat: practice.locationLat || null,
                            locationLng: practice.locationLng || null,
                            rosterFilter: practice.rosterFilter || null,
                            excludeFromPlanner: practice.excludeFromPlanner || false
                        };
                    }
                })
                .filter(Boolean);
            const practicesData = cleanedPractices;
            // Preserve all existing fields in seasonSettings (like csvFieldMappings, fitnessScale, etc.)
            data.seasonSettings = {
                ...data.seasonSettings,
                startDate: startDateValue || '',
                endDate: endDateValue || '',
                practices: practicesData
            };
            
            // Update the date range button to reflect saved dates
            updateSeasonDateRangeButton();
            
            // Determine current season range (if set)
            const seasonStart = startDateValue ? parseISODate(startDateValue) : null;
            const seasonEnd = endDateValue ? parseISODate(endDateValue) : null;
            if (seasonStart) seasonStart.setHours(0,0,0,0);
            if (seasonEnd) seasonEnd.setHours(0,0,0,0);
            
            // If applying to whole season, drop rescheduled instances entirely and force recalculation
            if (applyAll) {
                data.rides = (data.rides || []).filter(ride => !ride.rescheduledFrom);
                data.currentRide = null; // force next practice recalculation
                
                // If no regular practices remain, clear all generated rides
                if (practicesData.length === 0) {
                    data.rides = [];
                } else if (seasonStart && seasonEnd) {
                    // Trim rides outside the new season range
                    data.rides = (data.rides || []).filter(ride => {
                        if (!ride.date) return false;
                        const d = parseISODate(ride.date);
                        if (!d) return false;
                        d.setHours(0,0,0,0);
                        return d >= seasonStart && d <= seasonEnd;
                    });
                }
            }
            
            (data.rides || []).forEach(ride => {
                const rideDate = parseISODate(ride.date);
                if (!rideDate) return;
                rideDate.setHours(0, 0, 0, 0);
                if (rideDate >= fromDate) {
                    ride.cancelled = false;
                    ride.cancellationReason = '';
                    ride.rescheduledFrom = null;
                    ride.deleted = false;
                }
            });
            
            saveData();
            // Recompute calendars and current ride after cleaning
            renderAllCalendars();
            renderRides();
            alert('Updates applied. Cancelled and rescheduled practices within the selected range have been reset.');
        }

        async function saveSeasonSettings() {
            ensureSeasonDraft();
            const startInput = document.getElementById('season-start-date');
            const endInput = document.getElementById('season-end-date');

            const startDateValue = startInput ? startInput.value : '';
            const endDateValue = endInput ? endInput.value : '';

            if (startDateValue && endDateValue) {
                const startDate = parseISODate(startDateValue);
                const endDate = parseISODate(endDateValue);
                if (startDate && endDate && startDate > endDate) {
                    alert('Season end date must be on or after the start date.');
                    return;
                }
            }

            const cleanedPractices = (seasonSettingsDraft?.practices || [])
                .map(practice => {
                    if (!practice || typeof practice !== 'object') {
                        return null;
                    }
                    
                    // Handle single practices (with specificDate) differently from recurring practices
                    const isSinglePractice = practice.specificDate !== null && practice.specificDate !== undefined && practice.specificDate !== '';
                    
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
                        // Recurring practice: use normalizePracticeEntry
                        const normalized = normalizePracticeEntry(practice);
                        if (!normalized) return null;
                        return {
                            ...normalized,
                            description: practice.description || '',
                            meetLocation: practice.meetLocation || '',
                            locationLat: practice.locationLat || null,
                            locationLng: practice.locationLng || null,
                            rosterFilter: practice.rosterFilter || null,
                            excludeFromPlanner: practice.excludeFromPlanner || false
                        };
                    }
                })
                .filter(Boolean);

            const practicesData = cleanedPractices;

            // Get unified scale setting
            const scaleInput = document.getElementById('unified-scale');
            const paceScaleOrderInput = document.getElementById('pace-scale-order');

            const oldScale = data.seasonSettings?.fitnessScale || 6;
            let newScale = oldScale;
            if (scaleInput) {
                const v = parseInt(scaleInput.value, 10);
                if (Number.isFinite(v) && v >= 2 && v <= 9) newScale = v;
            }

            data.seasonSettings = {
                ...data.seasonSettings,
                startDate: startDateValue || '',
                endDate: endDateValue || '',
                practices: practicesData,
                fitnessScale:  newScale,
                skillsScale:   newScale,
                climbingScale:  newScale,
                paceScaleOrder: normalizePaceScaleOrder(paceScaleOrderInput?.value || data.seasonSettings?.paceScaleOrder),
                groupPaceOrder: normalizeGroupPaceOrder(data.seasonSettings?.groupPaceOrder)
            };

            if (newScale !== oldScale) {
                convertAllRatingsToNewScales(oldScale, newScale, oldScale, newScale, oldScale, newScale);
            }

            const scaleDisplay = document.getElementById('unified-scale-display');
            if (scaleDisplay) scaleDisplay.textContent = newScale;

            // Save to localStorage
            saveData();
            
            closeSeasonSetupModal();
            renderAllCalendars();
            updateHeaderEditSeasonButton();
            // Only re-render rides if Practice Planner tab is active
            const ridesTab = document.getElementById('rides-tab');
            if (ridesTab && ridesTab.classList.contains('active')) {
                renderRides();
            }
        }

        async function exportSeasonSettings() {
            ensureSeasonDraft();
            if (!seasonSettingsDraft) {
                alert('No season settings to export.');
                return;
            }

            const startInput = document.getElementById('season-start-date');
            const endInput = document.getElementById('season-end-date');
            
            const exportData = {
                startDate: startInput ? startInput.value : seasonSettingsDraft.startDate || '',
                endDate: endInput ? endInput.value : seasonSettingsDraft.endDate || '',
                practices: (seasonSettingsDraft.practices || []).map(practice => ({
                    id: practice.id,
                    dayOfWeek: practice.dayOfWeek,
                    specificDate: practice.specificDate || null,
                    time: practice.time || '',
                    endTime: practice.endTime || '',
                    description: practice.description || '',
                    meetLocation: practice.meetLocation || '',
                    locationLat: practice.locationLat || null,
                    locationLng: practice.locationLng || null
                })),
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Try to use File System Access API for save dialog (modern browsers)
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: `team-ride-pro-settings-${new Date().toISOString().split('T')[0]}.json`,
                        types: [{
                            description: 'JSON files',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return;
                } catch (error) {
                    // User cancelled or error - fall back to download
                    if (error.name !== 'AbortError') {
                        console.error('File System Access API error:', error);
                    }
                }
            }
            
            // Fallback to download (for browsers without File System Access API)
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `team-ride-pro-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function importSeasonSettings() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.trpb';
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        
                        if (!importedData || typeof importedData !== 'object') {
                            throw new Error('Invalid file format');
                        }

                        // Check if this is a full backup (version 2.0/3.0) or old season settings format
                        const isFullBackup = (importedData.version === '2.0' || importedData.version === '3.0') && importedData.data;
                        let dataToImport = null;
                        if (isFullBackup) {
                            // Full backup format - restore all data
                            if (!confirm('This is a complete backup file. This will REPLACE ALL existing data (riders, coaches, rides, assignments, settings, etc.). This action cannot be undone. Continue?')) {
                                return;
                            }
                            dataToImport = importedData.data;
                        } else {
                            // Old format - just season settings
                            dataToImport = importedData;
                        }

                        // If it's a full backup, restore everything
                        if (isFullBackup) {
                            // Restore all core data
                            if (Array.isArray(dataToImport.riders)) data.riders = dataToImport.riders;
                            if (Array.isArray(dataToImport.coaches)) data.coaches = dataToImport.coaches;
                            if (Array.isArray(dataToImport.rides)) data.rides = dataToImport.rides;
                            if (Array.isArray(dataToImport.routes)) data.routes = dataToImport.routes;
                            if (Array.isArray(dataToImport.races)) data.races = dataToImport.races;
                            if (dataToImport.currentRide !== undefined) data.currentRide = dataToImport.currentRide;
                            if (dataToImport.seasonSettings) data.seasonSettings = dataToImport.seasonSettings;
                            if (dataToImport.autoAssignSettings) data.autoAssignSettings = dataToImport.autoAssignSettings;
                            if (dataToImport.timeEstimationSettings) data.timeEstimationSettings = dataToImport.timeEstimationSettings;
                            if (Array.isArray(dataToImport.coachRoles)) data.coachRoles = dataToImport.coachRoles;
                            if (Array.isArray(dataToImport.riderRoles)) data.riderRoles = dataToImport.riderRoles;

                            // Restore additional tables (v2.0+/v3.0 backups)
                            if (Array.isArray(dataToImport.riderFeedback)) data.riderFeedback = dataToImport.riderFeedback;
                            if (Array.isArray(dataToImport.rideNotes)) data.rideNotes = dataToImport.rideNotes;
                            if (Array.isArray(dataToImport.riderAvailability)) data.riderAvailability = dataToImport.riderAvailability;
                            if (Array.isArray(dataToImport.colorNames)) data.colorNames = dataToImport.colorNames;

                            // Save to localStorage
                            saveData();

                            // Save to Supabase if authenticated
                            if (!isDeveloperMode) {
                                alert('Restoring data to Supabase — this may take a moment. Do NOT close the page.');
                                await saveAllDataToSupabase();
                            }

                            // Reload season settings into UI
                            loadSeasonSettings();

                            // Re-render everything
                            renderRiders();
                            renderCoaches();
                            renderRides();
                            renderRoutes();
                            renderAllCalendars();
                            updateHeaderEditSeasonButton();

                            alert('Complete backup restored successfully! All data has been restored.');
                            return;
                        }

                        // Old format: Just season settings
                        // Validate and import season settings data
                        if (dataToImport.startDate) {
                            const startInput = document.getElementById('season-start-date');
                            if (startInput) startInput.value = dataToImport.startDate;
                        }

                        if (dataToImport.endDate) {
                            const endInput = document.getElementById('season-end-date');
                            if (endInput) endInput.value = dataToImport.endDate;
                        }

                        if (Array.isArray(dataToImport.practices)) {
                            ensureSeasonDraft();
                            if (seasonSettingsDraft) {
                                // Merge imported practices (or replace if user confirms)
                                if (seasonSettingsDraft.practices.length > 0) {
                                    if (!confirm(`You currently have ${seasonSettingsDraft.practices.length} practices. Import will ${dataToImport.practices.length > 0 ? 'replace' : 'clear'} them. Continue?`)) {
                                        return;
                                    }
                                }
                                
                                seasonSettingsDraft.practices = dataToImport.practices.map(practice => ({
                                    id: practice.id || generateId(),
                                    dayOfWeek: practice.specificDate ? null : (practice.dayOfWeek !== undefined ? practice.dayOfWeek : 0),
                                    specificDate: practice.specificDate || null,
                                    time: practice.time || '15:30',
                                    endTime: practice.endTime || '17:00',
                                    description: practice.description || '',
                                    meetLocation: practice.meetLocation || '',
                                    locationLat: practice.locationLat || null,
                                    locationLng: practice.locationLng || null
                                }));
                                
                                renderPracticeRows();
                                alert(`Successfully imported ${dataToImport.practices.length} practice(s).`);
                            }
                        } else {
                            alert('No practices found in imported file.');
                        }
                    } catch (error) {
                        console.error('Import error:', error);
                        alert('Error importing settings: ' + (error.message || 'Invalid file format'));
                    }
                };
                reader.onerror = () => {
                    alert('Error reading file.');
                };
                reader.readAsText(file);
            };
            input.click();
        }
