// Roster modals — injected at startup.
// Extracted from teamridepro_v3.html to reduce file size.
document.body.insertAdjacentHTML('beforeend', `

    <div id="photo-crop-modal" class="modal-overlay" aria-hidden="true" onclick="if(event.target === this) closePhotoCropDialog()">
        <div class="modal" style="max-width: 600px; width: min(600px, 95%);">
            <div class="modal-header">
                <span>Crop Photo</span>
                <button class="btn-small secondary" onclick="closePhotoCropDialog()">Close</button>
            </div>
            <div class="modal-body">
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                        Drag to reposition, scroll to zoom. Photo will be cropped to a square.
                    </p>
                    <div style="position: relative; width: 100%; max-width: 500px; margin: 0 auto; background: #f0f0f0; border: 2px solid #ddd; overflow: hidden; touch-action: none;">
                        <canvas id="photo-crop-canvas" style="display: block; max-width: 100%; cursor: move;"></canvas>
                        <div id="photo-crop-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; border: 2px solid #2196F3; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5);"></div>
                    </div>
                    <div style="margin-top: 16px; text-align: center;">
                        <input type="range" id="photo-crop-zoom" min="1" max="3" step="0.1" value="1" style="width: 200px;" oninput="updatePhotoCropZoom(this.value)">
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">Zoom</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closePhotoCropDialog()">Cancel</button>
                <button class="btn-small" onclick="applyPhotoCrop()">Apply Crop</button>
            </div>
        </div>
    </div>

    <div id="edit-coach-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal">
            <div class="modal-header">
                <span id="edit-coach-modal-title">Edit Coach</span>
                <button class="btn-small secondary" onclick="closeEditCoachModal()">Close</button>
            </div>
            <div class="modal-body">
                <div class="modal-photo-section">
                    <div class="modal-photo-container">
                        <div class="modal-photo" id="edit-coach-photo-container" style="position: relative;">
                            <img id="edit-coach-photo-preview" src="" alt="Coach photo" style="display: none; width: 100%; height: 100%; object-fit: cover;">
                            <span id="edit-coach-photo-placeholder" class="photo-placeholder" style="display: flex;">🚴</span>
                            <div class="photo-edit-overlay">
                                <span class="photo-edit-icon">✏️</span>
                            </div>
                            <input type="file" id="edit-coach-photo-input" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10;" onchange="handleCoachPhotoUploadInModal(this)">
                        </div>
                    </div>
                    <div class="modal-name-field">
                        <div class="modal-name-row">
                            <div class="modal-name-col">
                                <label for="edit-coach-first-name" class="field-label">First Name</label>
                                <input type="text" id="edit-coach-first-name">
                            </div>
                            <div class="modal-name-col">
                                <label for="edit-coach-last-name" class="field-label">Last Name</label>
                                <input type="text" id="edit-coach-last-name">
                            </div>
                        </div>
                    </div>
                </div>
                <div style="max-height: 70vh; overflow-y: auto;">
                <table class="modal-edit-table">
                    <tr><td class="modal-edit-label">Nickname / Display Name</td><td><div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><input type="text" id="edit-coach-nickname" class="modal-field-input" style="flex:1; min-width:120px;" placeholder="Used as display name if set"><label style="display:flex; align-items:center; gap:3px; font-size:11px; white-space:nowrap; cursor:pointer;"><input type="radio" name="coach-nickname-mode" id="edit-coach-nickname-mode-first" value="firstName"> Use for First Name</label><label style="display:flex; align-items:center; gap:3px; font-size:11px; white-space:nowrap; cursor:pointer;"><input type="radio" name="coach-nickname-mode" id="edit-coach-nickname-mode-whole" value="wholeName"> Use for Whole Name</label></div></td></tr>
                    <tr><td class="modal-edit-label">Email</td><td><input type="email" id="edit-coach-email" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Cell Phone</td><td><input type="tel" id="edit-coach-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Work Phone</td><td><input type="tel" id="edit-coach-work-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Home Phone</td><td><input type="tel" id="edit-coach-home-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Gender</td><td><select id="edit-coach-gender" class="modal-field-input"><option value="">Select Gender</option><option value="M">M</option><option value="F">F</option><option value="NB">Nonbinary</option></select></td></tr>
                    <tr><td class="modal-edit-label">Coaching License Level</td><td><select id="edit-coach-level" class="modal-field-input"><option value="N/A">N/A</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></td></tr>
                    <tr><td class="modal-edit-label">Registered</td><td><input type="text" id="edit-coach-registered" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Paid</td><td><input type="text" id="edit-coach-paid" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Background Check</td><td><input type="text" id="edit-coach-background-check" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Level 3 Exam Completed</td><td><input type="text" id="edit-coach-level3-exam" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">PDU/CEU Units</td><td><input type="text" id="edit-coach-pdu-ceu" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Field Work Hours</td><td><input type="text" id="edit-coach-field-work-hours" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">First Aid Type, Expires</td><td><input type="text" id="edit-coach-first-aid" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">CPR Expires</td><td><input type="text" id="edit-coach-cpr-expires" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Concussion Training</td><td><input type="text" id="edit-coach-concussion-training" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">NICA Philosophy</td><td><input type="text" id="edit-coach-nica-philosophy" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Abuse Awareness</td><td><input type="text" id="edit-coach-abuse-awareness" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">License Level 1</td><td><input type="text" id="edit-coach-license-level1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">License Level 2</td><td><input type="text" id="edit-coach-license-level2" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">License Level 3</td><td><input type="text" id="edit-coach-license-level3" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">OTB Skills 101 Classroom</td><td><input type="text" id="edit-coach-otb-classroom" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">OTB Skills 101 Outdoor</td><td><input type="text" id="edit-coach-otb-outdoor" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">NICA Leader Summit</td><td><input type="text" id="edit-coach-nica-summit" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Endurance Rating</td><td><input type="number" id="edit-coach-fitness" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Climbing Rating</td><td><input type="number" id="edit-coach-climbing" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Descending Rating</td><td><input type="number" id="edit-coach-skills" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Bike</td><td><div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"><label style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="edit-coach-bike-manual" onchange="toggleBikePrimaryDropdown()"> Manual</label><label style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><input type="checkbox" id="edit-coach-bike-electric" onchange="toggleBikePrimaryDropdown()"> Electric</label><select id="edit-coach-bike-primary" class="modal-field-input" style="display: none; width: auto; min-width: 140px;"><option value="manual">Rides Manual most</option><option value="electric">Rides Electric most</option></select></div></td></tr>
                    <tr><td class="modal-edit-label" style="vertical-align: top; padding-top: 8px;">Notes</td><td><textarea id="edit-coach-notes" rows="3" class="modal-field-input"></textarea></td></tr>
                    <tr><td class="modal-edit-label" style="vertical-align: top; padding-top: 8px;">Scheduled Absences</td>
                        <td>
                            <div id="edit-coach-absences-list" class="absences-list"></div>
                            <div id="edit-coach-absence-form" class="absence-form" style="display:none;">
                                <div class="absence-form-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                    <label style="display:flex;align-items:center;gap:4px;">Start <input type="date" id="edit-coach-absence-start" class="modal-field-input" style="max-width:115px;"></label>
                                    <label style="display:flex;align-items:center;gap:4px;">End <input type="date" id="edit-coach-absence-end" class="modal-field-input" style="max-width:115px;"></label>
                                    <label style="display:flex;align-items:center;gap:6px;margin-left:4px;"><input type="checkbox" id="edit-coach-absence-remainder" onchange="toggleCoachAbsenceRemainder()"> Remainder of Season</label>
                                </div>
                                <div class="absence-form-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                    <label style="display:flex;align-items:center;gap:6px;flex-shrink:0;"><input type="checkbox" id="edit-coach-absence-specific-practices" onchange="toggleCoachAbsenceSpecificPractices()"> Specific Practices</label>
                                    <div id="edit-coach-absence-practices-wrap" style="display:none;"><select id="edit-coach-absence-practices" class="modal-field-input" multiple style="min-height:52px;min-width:140px;max-width:200px;"></select></div>
                                </div>
                                <div class="absence-form-row">
                                    <label>Reason
                                        <select id="edit-coach-absence-reason" class="modal-field-input">
                                            <option value="injured">Injured</option>
                                            <option value="vacation">Vacation/Travel</option>
                                            <option value="suspension">Behavior/Suspension</option>
                                            <option value="schedule_conflict">Schedule Conflict</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="absence-form-actions">
                                    <button class="btn-small" onclick="saveCoachAbsence()">Save</button>
                                    <button class="btn-small secondary" onclick="cancelCoachAbsenceForm()">Cancel</button>
                                </div>
                            </div>
                            <button class="btn-small secondary" id="edit-coach-add-absence-btn" onclick="showCoachAbsenceForm()" style="margin-top:4px;">+ Add Absence</button>
                        </td>
                    </tr>
                </table>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between;">
                <div style="display: flex; gap: 8px;">
                    <button id="delete-coach-btn" class="btn-small danger" onclick="deleteCoachFromModal()" style="display: none;">Delete Record</button>
                    <button id="archive-coach-btn" class="btn-small" onclick="archiveCoachFromModal()" style="display: none; background:#888; color:#fff;">Archive</button>
                </div>
                <div style="display: flex; gap: 8px; margin-left: auto;">
                    <button class="btn-small secondary" onclick="closeEditCoachModal()">Cancel</button>
                    <button class="btn-small" onclick="saveCoachFromModal()">Save Changes</button>
                </div>
            </div>
        </div>
    </div>

    <div id="edit-rider-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal">
            <div class="modal-header">
                <span id="edit-rider-modal-title">Edit Team Rider</span>
                <button class="btn-small secondary" onclick="closeEditRiderModal()">Close</button>
            </div>
            <div class="modal-body">
                <div class="modal-photo-section">
                    <div class="modal-photo-container">
                        <div class="modal-photo" id="edit-rider-photo-container" style="position: relative;">
                            <img id="edit-rider-photo-preview" src="" alt="Rider photo" style="display: none; width: 100%; height: 100%; object-fit: cover;">
                            <span id="edit-rider-photo-placeholder" class="photo-placeholder" style="display: flex;">👤</span>
                            <div class="photo-edit-overlay">
                                <span class="photo-edit-icon">✏️</span>
                            </div>
                            <input type="file" id="edit-rider-photo-input" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10;" onchange="handleRiderPhotoUploadInModal(this)">
                        </div>
                    </div>
                    <div class="modal-name-field">
                        <div class="modal-name-row">
                            <div class="modal-name-col">
                                <label for="edit-rider-first-name" class="field-label">First Name</label>
                                <input type="text" id="edit-rider-first-name">
                            </div>
                            <div class="modal-name-col">
                                <label for="edit-rider-last-name" class="field-label">Last Name</label>
                                <input type="text" id="edit-rider-last-name">
                            </div>
                        </div>
                    </div>
                </div>
                <div style="max-height: 70vh; overflow-y: auto;">
                <table class="modal-edit-table">
                    <tr><td class="modal-edit-label">Nickname / Display Name</td><td><div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><input type="text" id="edit-rider-nickname" class="modal-field-input" style="flex:1; min-width:120px;" placeholder="Used as display name if set"><label style="display:flex; align-items:center; gap:3px; font-size:11px; white-space:nowrap; cursor:pointer;"><input type="radio" name="rider-nickname-mode" id="edit-rider-nickname-mode-first" value="firstName"> Use for First Name</label><label style="display:flex; align-items:center; gap:3px; font-size:11px; white-space:nowrap; cursor:pointer;"><input type="radio" name="rider-nickname-mode" id="edit-rider-nickname-mode-whole" value="wholeName"> Use for Whole Name</label></div></td></tr>
                    <tr><td class="modal-edit-label">Email</td><td><input type="email" id="edit-rider-email" placeholder="Email" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Cell Phone</td><td><input type="tel" id="edit-rider-phone" placeholder="(XXX) XXX-XXXX" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Address</td><td><input type="text" id="edit-rider-address" placeholder="Address" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Gender</td><td><select id="edit-rider-gender" class="modal-field-input" onchange="updateRacingGroupOptions(); updateDefaultPhoto()"><option value="">Select Gender</option><option value="M">M</option><option value="F">F</option><option value="NB">Nonbinary</option></select></td></tr>
                    <tr><td class="modal-edit-label">Grade</td><td><select id="edit-rider-grade" class="modal-field-input"><option value="9th">9th</option><option value="10th">10th</option><option value="11th">11th</option><option value="12th">12th</option></select></td></tr>
                    <tr><td class="modal-edit-label">Racing Group</td><td><select id="edit-rider-racing-group" class="modal-field-input"><option value="">Select Gender First</option></select></td></tr>
                    <tr><td class="modal-edit-label">Birthday</td><td><input type="text" id="edit-rider-birthday" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Primary Parent/Guardian</td><td><input type="text" id="edit-rider-primary-parent-name" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Primary Parent Cell</td><td><input type="tel" id="edit-rider-primary-parent-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Primary Parent Email</td><td><input type="email" id="edit-rider-primary-parent-email" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Primary Parent Address</td><td><input type="text" id="edit-rider-primary-parent-address" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Second Parent/Guardian</td><td><input type="text" id="edit-rider-second-parent-name" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Second Parent Cell</td><td><input type="tel" id="edit-rider-second-parent-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Second Parent Email</td><td><input type="email" id="edit-rider-second-parent-email" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Alternate Contact Name</td><td><input type="text" id="edit-rider-alternate-contact-name" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Alternate Contact Relationship</td><td><input type="text" id="edit-rider-alternate-contact-relationship" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Alternate Contact Cell</td><td><input type="tel" id="edit-rider-alternate-contact-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Primary Physician</td><td><input type="text" id="edit-rider-primary-physician" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Primary Physician Phone</td><td><input type="tel" id="edit-rider-primary-physician-phone" class="modal-field-input" maxlength="14" oninput="formatPhoneNumber(this)"></td></tr>
                    <tr><td class="modal-edit-label">Medical Insurance Company</td><td><input type="text" id="edit-rider-medical-insurance-company" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Medical Insurance Account #</td><td><input type="text" id="edit-rider-medical-insurance-account" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label" style="vertical-align: top; padding-top: 8px;">Allergies/Medical Needs</td><td><textarea id="edit-rider-allergies" rows="2" class="modal-field-input"></textarea></td></tr>
                    <tr><td class="modal-edit-label">Endurance Rating</td><td><input type="number" id="edit-rider-fitness" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Climbing Rating</td><td><input type="number" id="edit-rider-climbing" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label">Descending Rating</td><td><input type="number" id="edit-rider-skills" min="1" class="modal-field-input"></td></tr>
                    <tr><td class="modal-edit-label" style="vertical-align: top; padding-top: 8px;">Notes</td><td><textarea id="edit-rider-notes" rows="3" class="modal-field-input"></textarea></td></tr>
                    <tr><td class="modal-edit-label" style="vertical-align: top; padding-top: 8px;">Scheduled Absences</td>
                        <td>
                            <div id="edit-rider-absences-list" class="absences-list"></div>
                            <div id="edit-rider-absence-form" class="absence-form" style="display:none;">
                                <div class="absence-form-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                                    <label style="display:flex;align-items:center;gap:4px;">Start <input type="date" id="edit-rider-absence-start" class="modal-field-input" style="max-width:115px;"></label>
                                    <label style="display:flex;align-items:center;gap:4px;">End <input type="date" id="edit-rider-absence-end" class="modal-field-input" style="max-width:115px;"></label>
                                    <label style="display:flex;align-items:center;gap:6px;margin-left:4px;"><input type="checkbox" id="edit-rider-absence-remainder" onchange="toggleRiderAbsenceRemainder()"> Remainder of Season</label>
                                </div>
                                <div class="absence-form-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                    <label style="display:flex;align-items:center;gap:6px;flex-shrink:0;"><input type="checkbox" id="edit-rider-absence-specific-practices" onchange="toggleRiderAbsenceSpecificPractices()"> Specific Practices</label>
                                    <div id="edit-rider-absence-practices-wrap" style="display:none;"><select id="edit-rider-absence-practices" class="modal-field-input" multiple style="min-height:52px;min-width:140px;max-width:200px;"></select></div>
                                </div>
                                <div class="absence-form-row">
                                    <label>Reason
                                        <select id="edit-rider-absence-reason" class="modal-field-input">
                                            <option value="injured">Injured</option>
                                            <option value="vacation">Vacation/Travel</option>
                                            <option value="suspension">Behavior/Suspension</option>
                                            <option value="schedule_conflict">Schedule Conflict</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="absence-form-actions">
                                    <button class="btn-small" onclick="saveRiderAbsence()">Save</button>
                                    <button class="btn-small secondary" onclick="cancelRiderAbsenceForm()">Cancel</button>
                                </div>
                            </div>
                            <button class="btn-small secondary" id="edit-rider-add-absence-btn" onclick="showRiderAbsenceForm()" style="margin-top:4px;">+ Add Absence</button>
                        </td>
                    </tr>
                </table>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between;">
                <div style="display: flex; gap: 8px;">
                    <button id="delete-rider-btn" class="btn-small danger" onclick="deleteRiderFromModal()" style="display: none;">Delete Record</button>
                    <button id="archive-rider-btn" class="btn-small" onclick="archiveRiderFromModal()" style="display: none; background:#888; color:#fff;">Archive</button>
                </div>
                <div style="display: flex; gap: 8px; margin-left: auto;">
                    <button class="btn-small secondary" onclick="closeEditRiderModal()">Cancel</button>
                    <button class="btn-small" onclick="saveRiderFromModal()">Save Changes</button>
                </div>
            </div>
        </div>
    </div>

    <div id="notes-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
                <span id="notes-modal-title">Notes</span>
                <button class="btn-small secondary" onclick="closeNotesModal()">Close</button>
            </div>
            <div class="modal-body">
                <p id="notes-modal-content" style="white-space: pre-wrap; margin: 0;"></p>
            </div>
            <div class="modal-footer">
                <button class="btn-small secondary" onclick="closeNotesModal()">Close</button>
            </div>
        </div>
    </div>

    <!-- Choose Display Fields Modal -->
    <div id="display-fields-modal" class="modal-overlay" aria-hidden="true" style="display: none;" onclick="if(event.target === this) closeDisplayFieldsModal();">
        <div class="modal" style="max-width: 480px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation();">
            <div class="modal-header">
                <span id="display-fields-modal-title">Choose Display Fields</span>
                <button class="btn-small secondary" onclick="closeDisplayFieldsModal()">Close</button>
            </div>
            <div class="modal-body" style="padding: 16px;">
                <div id="display-fields-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button class="btn-small secondary" onclick="closeDisplayFieldsModal()">Cancel</button>
                <button class="btn-small" onclick="applyDisplayFieldChanges()" style="background-color: #2196F3; color: white; border-color: #2196F3;">Apply</button>
            </div>
        </div>
    </div>

`);
