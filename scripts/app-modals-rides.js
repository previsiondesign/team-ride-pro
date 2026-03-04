// Rides / season / practice modals — injected at startup.
// Extracted from teamridepro_v3.html to reduce file size.
document.body.insertAdjacentHTML('beforeend', `

    <div id="season-setup-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 900px; width: min(900px, 95%);">
            <div class="modal-header">
                <span>Season Setup</span>
                <button class="btn-small secondary" onclick="closeSeasonSetupModal()">Close</button>
                </div>
            <div class="modal-body">
                <div class="form-row">
                    <div style="flex:1;">
                        <label class="field-label">Season Date Range</label>
                        <button type="button" class="btn-small secondary" onclick="openSeasonDateRangePickerModal()" id="season-date-range-button-setup" style="width: 100%; text-align: left; justify-content: flex-start; padding: 8px 12px; background: white; border: 1px solid #ddd; cursor: pointer; color: #333;">
                            Select Date Range
                        </button>
                        <!-- Hidden inputs for backwards compatibility with existing code - sharing IDs with main settings inputs -->
                        <input type="date" id="season-start-date-setup" style="display: none;" onchange="syncSeasonDatesToMain();">
                        <input type="date" id="season-end-date-setup" style="display: none;" onchange="syncSeasonDatesToMain();">
                    </div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <label class="field-label" style="margin:0;">Regular Practices</label>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-small secondary" onclick="addPracticeRow()">Add Recurring Practice</button>
                            <button class="btn-small secondary" onclick="openAddSinglePracticeModal()">Add single practice</button>
                            <button class="btn-small secondary" onclick="openAddRacesModal()">Add Races</button>
                        </div>
                    </div>
                    <div id="practice-rows" class="practice-rows"></div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 8px;">
                    <button class="btn-small secondary" onclick="importSeasonSettings()">Import Settings</button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-small secondary" onclick="closeSeasonSetupModal()">Cancel</button>
                    <button class="btn-small" onclick="saveSeasonSettings()">Save Settings</button>
                </div>
            </div>
        </div>
    </div>

    <div id="location-map-modal" class="modal-overlay" style="z-index: 2100;" aria-hidden="true">
        <div class="modal" style="max-width: 800px; width: min(800px, 95%);">
            <div class="modal-header">
                <span>Select Meet Location</span>
                <button class="btn-small secondary" onclick="closeLocationMapModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 12px;">
                    <label for="location-previous" class="field-label">Previous Locations</label>
                    <select id="location-previous" onchange="selectPreviousLocation(this.value)" style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; background: white; cursor: pointer;">
                        <option value="">-- Select from previous locations --</option>
                    </select>
                </div>
                <div style="margin-bottom: 12px;">
                    <label for="location-search" class="field-label">Search Location</label>
                    <input type="text" id="location-search" placeholder="Search for a location..." style="width: 100%; padding: 8px; margin-bottom: 8px;" onkeypress="if(event.key === 'Enter') searchLocation();">
                    <button class="btn-small" onclick="searchLocation()">Search</button>
                </div>
                <div id="map-container" style="width: 100%; height: 400px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 12px; background: #f0f0f0; position: relative; z-index: 1;">
                    <div id="map-placeholder" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #666; z-index: 0;">
                        <p>Map will load here</p>
                        <p style="font-size: 12px; margin-top: 8px;">Click on the map to set location</p>
                    </div>
                </div>
                <div class="form-row">
                    <div style="flex: 1;">
                        <label for="location-latitude" class="field-label">Latitude</label>
                        <input type="number" id="location-latitude" step="0.000001" placeholder="0.000000" style="width: 100%;">
                    </div>
                    <div style="flex: 1;">
                        <label for="location-longitude" class="field-label">Longitude</label>
                        <input type="number" id="location-longitude" step="0.000001" placeholder="0.000000" style="width: 100%;">
                    </div>
                </div>
                <div style="margin-top: 12px;">
                    <label for="location-address" class="field-label">Address</label>
                    <input type="text" id="location-address" placeholder="Address will appear here" style="width: 100%;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeLocationMapModal()">Cancel</button>
                <button class="btn-small" onclick="saveLocation()">Save Location</button>
            </div>
        </div>
    </div>

    <!-- Roster Refinement Modal -->
    <div id="roster-refinement-modal" class="modal-overlay" style="z-index: 2000;" aria-hidden="true">
        <div class="modal-content" style="width: 900px; height: 80vh; max-width: 900px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; background: #ffffff !important; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <div class="modal-header" style="background-color: #2196F3; color: white;">
                <h3>Refine Roster</h3>
                <button class="modal-close" onclick="closeRosterRefinement()" aria-label="Close">&times;</button>
            </div>
            <div style="padding: 16px; overflow-y: auto; flex: 1; background: #ffffff !important;">
                <div style="margin-bottom: 16px;">
                    <label for="roster-filter-type" style="display: block; margin-bottom: 8px; font-weight: 500;">Filter by...</label>
                    <select id="roster-filter-type" onchange="updateRosterFilterOptions()" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="">-- Select filter type --</option>
                        <option value="grade">Grade</option>
                        <option value="gender">Gender</option>
                        <option value="racingGroup">Racing Group</option>
                    </select>
                </div>
                <div id="roster-filter-options" style="margin-bottom: 16px; display: none;">
                    <!-- Filter checkboxes will be populated here -->
                </div>
                <div style="margin-bottom: 16px; border-top: 1px solid #ddd; padding-top: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <strong>Riders (<span id="roster-filtered-count">0</span> shown)</strong>
                    </div>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="background: #f5f5f5; position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd; width: 30px;"></th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Name</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Grade</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Gender</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Racing Group</th>
                                </tr>
                            </thead>
                            <tbody id="roster-filtered-list">
                                <!-- Riders will be populated here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeRosterRefinement()">Cancel</button>
                <button class="btn-small" onclick="saveRosterRefinement()">OK</button>
            </div>
        </div>
    </div>

    <!-- View Exceptions Modal (deleted individual practices within a series) -->
    <div id="view-exceptions-modal" class="modal-overlay" style="z-index: 2000;" aria-hidden="true" onclick="if(event.target === this) closeViewExceptionsDialog()">
        <div class="modal-content" style="width: 480px; max-width: 95vw; background: #ffffff !important; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <div class="modal-header" style="background-color: #FF9800; color: white;">
                <h3>View Exceptions</h3>
                <button class="modal-close" onclick="closeViewExceptionsDialog()" aria-label="Close">&times;</button>
            </div>
            <div style="padding: 16px;">
                <p id="view-exceptions-intro" style="margin: 0 0 12px 0; color: #555; font-size: 14px;">These dates were removed from the calendar. Restore to show them again.</p>
                <ul id="view-exceptions-list" style="list-style: none; margin: 0; padding: 0;">
                    <!-- Filled by openViewExceptionsDialog -->
                </ul>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeViewExceptionsDialog()">Close</button>
            </div>
        </div>
    </div>

    <div id="add-practice-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal">
            <div class="modal-header">
                <span>Add Additional Practice</span>
                <button class="btn-small secondary" onclick="closeAddPracticeModal()">Close</button>
                </div>
            <div class="modal-body">
                <div class="form-row">
                    <div style="flex:1;">
                        <label for="practice-date" class="field-label">Date</label>
                        <input type="date" id="practice-date">
                    </div>
                    <div style="flex:1;">
                        <label for="practice-time" class="field-label">Time</label>
                        <input type="time" id="practice-time">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeAddPracticeModal()">Cancel</button>
                <button class="btn-small" onclick="saveAddPractice()">Add Practice</button>
            </div>
        </div>
    </div>

    <div id="add-races-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 700px; width: min(700px, 95%);">
            <div class="modal-header">
                <span>Add Races</span>
                <button class="btn-small secondary" onclick="closeAddRacesModal()">Close</button>
            </div>
            <div class="modal-body">
                <div id="races-list-container" style="margin-bottom: 16px;">
                    <!-- Race entries will be added here -->
                </div>
                <button class="btn-small secondary" onclick="addRaceEntry()" style="margin-bottom: 12px;">+ Add Another Race</button>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeAddRacesModal()">Cancel</button>
                <button class="btn-small" onclick="saveRaces()">Save Races</button>
            </div>
        </div>
    </div>

    <div id="practices-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 900px; width: min(900px, 95%);">
            <div class="modal-header">
                <span>Add/Edit Practices</span>
                <button class="btn-small secondary" onclick="closePracticesModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <label class="field-label" style="margin:0;">Regular Practices</label>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-small" onclick="addPracticeRowInModal()">Add Recurring Practice</button>
                        <button class="btn-small secondary" onclick="openAddSinglePracticeModalInModal()">Add Single Practice</button>
                        <button class="btn-small secondary" onclick="applySeasonUpdates('practices')" title="Update calendar after changing regular practices">Update Practices</button>
                    </div>
                </div>
                <div id="practice-rows-modal" class="practice-rows"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closePracticesModal()">Close</button>
            </div>
        </div>
    </div>

    <div id="time-range-picker-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 500px; width: min(500px, 95%);">
            <div class="modal-header">
                <span>Set Practice Time Range</span>
                <button class="btn-small secondary" onclick="closeTimeRangePickerModal()">Close</button>
            </div>
            <div class="modal-body">
                <div class="form-row" style="flex-direction: column; gap: 20px;">
                    <div style="flex: 1;">
                        <label class="field-label">Start Time</label>
                        <input type="time" id="time-range-start" style="width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="flex: 1;">
                        <label class="field-label">End Time</label>
                        <input type="time" id="time-range-end" style="width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="padding: 12px; background: #f5f5f5; border-radius: 4px; text-align: center;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Time Range</div>
                        <div id="time-range-preview" style="font-size: 18px; font-weight: 600; color: #333;">—</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeTimeRangePickerModal()">Cancel</button>
                <button class="btn-small" onclick="saveTimeRange()">Save Time Range</button>
            </div>
        </div>
    </div>

    <div id="season-date-range-picker-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 700px; width: min(700px, 95%);">
            <div class="modal-header">
                <span>Select Season Date Range</span>
                <button class="btn-small secondary" onclick="closeSeasonDateRangePickerModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="padding: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <button type="button" onclick="navigateSeasonDateRangeMonths(-1)" style="background: none; border: none; cursor: pointer; font-size: 20px; color: #666; padding: 8px;">&lt;</button>
                        <div id="season-date-range-months-display" style="font-size: 16px; font-weight: 600; color: #333;"></div>
                        <button type="button" onclick="navigateSeasonDateRangeMonths(1)" style="background: none; border: none; cursor: pointer; font-size: 20px; color: #666; padding: 8px;">&gt;</button>
                    </div>
                    <div id="season-date-range-calendars" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                        <!-- Calendars will be rendered here -->
                    </div>
                    <div id="season-date-range-preview" style="margin-top: 20px; padding: 12px; background: #f5f5f5; border-radius: 4px; text-align: center;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Selected Range</div>
                        <div style="font-size: 16px; font-weight: 600; color: #333;">—</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="clearSeasonDateRange()">Clear</button>
                <button class="btn-small secondary" onclick="closeSeasonDateRangePickerModal()">Cancel</button>
                <button class="btn-small" onclick="saveSeasonDateRange()">Save Date Range</button>
            </div>
        </div>
    </div>

    <div id="auto-assign-settings-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 700px; width: min(700px, 95%);">
            <div class="modal-header">
                <span>Auto-Assign Settings</span>
                <button class="btn-small secondary" onclick="closeAutoAssignSettingsModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        Adjust these settings to control how the auto-assignment algorithm creates groups and assigns riders and coaches.
                    </p>
                    <div id="auto-assign-settings-list">
                        <!-- Settings will be rendered here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeAutoAssignSettingsModal()">Cancel</button>
                <button class="btn-small" onclick="saveAutoAssignSettings()">Save Settings</button>
            </div>
        </div>
    </div>

    <div id="copy-groups-prior-practice-modal" class="modal-overlay" aria-hidden="true" onclick="if(event.target === this) closeCopyGroupsFromPriorPracticeDialog()">
        <div class="modal" style="max-width: 600px; width: min(600px, 95%);">
            <div class="modal-header">
                <span>Copy Prior Practice</span>
                <button class="btn-small secondary" onclick="closeCopyGroupsFromPriorPracticeDialog()">Close</button>
            </div>
            <div class="modal-body">
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        Select a prior practice to copy group assignments from:
                    </p>
                    <div id="prior-practices-list" style="max-height: 400px; overflow-y: auto;">
                        <!-- Prior practices will be rendered here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeCopyGroupsFromPriorPracticeDialog()">Cancel</button>
            </div>
        </div>
    </div>

    <div id="group-count-selection-modal" class="modal-overlay" onclick="if(event.target === this) closeGroupCountSelectionDialog()" style="display: none;">
        <div class="modal" style="max-width: 500px; width: min(500px, 95%);">
            <div class="modal-header">
                <span>Select Number of Groups</span>
                <button class="btn-small secondary" onclick="closeGroupCountSelectionDialog()">Close</button>
            </div>
            <div class="modal-body">
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        Insufficient coaches available to create compliant groups. Please select the number of groups to create:
                    </p>
                    <div id="group-count-options" style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Options will be rendered here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeGroupCountSelectionDialog()">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Practice Context Menu -->
    <div id="practice-context-menu" class="context-menu" style="display: none; position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10000; min-width: 180px;">
        <button id="go-to-planner-btn" class="context-menu-item" onclick="goToPracticePlannerFromContext()" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #1976d2; font-weight: 500; display: none;">Go to Practice Planner</button>
        <button class="context-menu-item" onclick="deletePracticeFromContext()" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;">Delete Practice</button>
        <button class="context-menu-item" onclick="cancelPracticeFromContext()" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;">Cancel Practice</button>
        <button id="restore-practice-btn" class="context-menu-item" onclick="restoreCancelledPractice()" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; display: none;">Restore Practice</button>
        <button class="context-menu-item" onclick="reschedulePracticeFromContext()" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;">Reschedule Practice</button>
    </div>

    <!-- Pace/Skills Badge Context Menu -->
    <div id="badge-context-menu" class="context-menu" style="display: none; position: fixed; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10001; min-width: 150px;">
        <button class="context-menu-item" id="badge-increase-btn" onclick="handleBadgeAdjust('increase')" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333; border-bottom: 1px solid #eee;">Increase</button>
        <button class="context-menu-item" id="badge-decrease-btn" onclick="handleBadgeAdjust('decrease')" style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 14px; color: #333;">Decrease</button>
    </div>

    <div id="coach-move-context-menu" class="context-menu" style="display: none; position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10000; min-width: 180px;">
        <div id="coach-move-role-options"></div>
        <hr style="margin: 4px 0; border: none; border-top: 1px solid #ddd;">
        <div id="coach-move-group-options"></div>
    </div>

    <!-- Cancel Practice Modal -->
    <div id="cancel-practice-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <span>Cancel Practice</span>
                <button class="btn-small secondary" onclick="closeCancelPracticeModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <p style="font-size: 14px; color: #666; margin: 0;">Please select a reason for cancelling this practice:</p>
                    <div>
                        <label for="cancel-reason" class="field-label">Cancellation Reason</label>
                        <select id="cancel-reason" class="modal-field-input">
                            <option value="Weather">Weather</option>
                            <option value="Staffing">Staffing</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button class="btn-small secondary" onclick="closeCancelPracticeModal()">Cancel</button>
                <button class="btn-small" onclick="confirmCancelPractice()" style="background-color: #f44336; color: white; border-color: #f44336;">Cancel Practice</button>
            </div>
        </div>
    </div>

    <!-- Reschedule Practice Modal -->
    <div id="reschedule-practice-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 500px;" onclick="event.stopPropagation();">
            <div class="modal-header">
                <span>Reschedule Practice</span>
                <button class="btn-small secondary" onclick="closeReschedulePracticeModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <label for="reschedule-date" class="field-label">New Date</label>
                        <input type="date" id="reschedule-date" class="modal-field-input">
                    </div>
                    <div class="form-row">
                        <div style="flex: 1;">
                            <label for="reschedule-time" class="field-label">Time</label>
                            <input type="time" id="reschedule-time" class="modal-field-input">
                        </div>
                        <div style="flex: 1;">
                            <label for="reschedule-end-time" class="field-label">End Time</label>
                            <input type="time" id="reschedule-end-time" class="modal-field-input">
                        </div>
                    </div>
                    <div>
                        <label for="reschedule-location" class="field-label">Location</label>
                        <input type="text" id="reschedule-location" class="modal-field-input" placeholder="Enter location">
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button class="btn-small secondary" onclick="closeReschedulePracticeModal()">Cancel</button>
                <button class="btn-small" onclick="confirmReschedulePractice()" style="background-color: #2196F3; color: white; border-color: #2196F3;">Reschedule</button>
            </div>
        </div>
    </div>

`);
