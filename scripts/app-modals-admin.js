// Admin / CSV / dev-mode modals — injected at startup.
// Extracted from teamridepro_v3.html to reduce file size.
document.body.insertAdjacentHTML('beforeend', `

    <!-- Google Sheets Sync Modal -->
    <div id="google-sheets-modal" class="modal-overlay" aria-hidden="true" style="display: none;">
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <span id="google-sheets-modal-title">Sync from Google Sheet</span>
                <button class="btn-small secondary" onclick="closeGoogleSheetsModal()">Close</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- Simple Option: Public Sheet -->
                    <div style="padding: 12px; background: #e8f5e9; border: 1px solid #4caf50; border-radius: 4px;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #2e7d32;">✓ Easiest Option: Make Sheet Viewable by Link</div>
                        <div style="font-size: 12px; color: #666; line-height: 1.5; margin-bottom: 8px;">
                            <strong>No setup required!</strong> Just make your Google Sheet viewable:
                            <ol style="margin: 8px 0; padding-left: 20px;">
                                <li>Open your Google Sheet</li>
                                <li>Click <strong>"Share"</strong> button (top right)</li>
                                <li>Change to <strong>"Anyone with the link"</strong> → <strong>"Viewer"</strong></li>
                                <li>Click <strong>"Done"</strong></li>
                            </ol>
                            The sheet will be readable but not editable by others. This works immediately with no configuration!
                        </div>
                    </div>

                    <!-- Google Sheet URL -->
                    <div>
                        <label class="field-label">Google Sheet URL:</label>
                        <input type="text" id="modal-google-sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="">
                        <button class="btn-small" onclick="saveModalGoogleSheetUrl()" style="margin-top: 8px; padding: 6px 12px;">Save Link</button>
                    </div>

                    <!-- Advanced Option: Private Sheet with OAuth (Collapsible) -->
                    <details style="padding: 12px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 4px;">
                        <summary style="font-weight: 600; cursor: pointer; color: #e65100; margin-bottom: 8px;">Advanced: Access Private Sheets (Requires Setup)</summary>
                        <div style="margin-top: 12px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                                If you need to keep the sheet completely private, you can set up Google OAuth. This requires a free Google Cloud account (no paid subscription needed).
                            </div>

                            <!-- Google OAuth Client ID Configuration -->
                            <div style="padding: 12px; background: #fff; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 12px;">
                                <label class="field-label" style="margin-bottom: 8px; display: block;">Google OAuth Client ID:</label>
                                <input type="text" id="modal-google-client-id" placeholder="Enter your Google OAuth Client ID" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px;" value="">
                                <button class="btn-small" onclick="saveGoogleClientId()" style="padding: 6px 12px; margin-bottom: 8px;">Save Client ID</button>
                                <div style="font-size: 11px; color: #666; line-height: 1.4;">
                                    <strong>Free Setup (5 minutes):</strong><br>
                                    1. Go to <a href="https://console.cloud.google.com/" target="_blank" style="color: #2196F3;">Google Cloud Console</a> (free account)<br>
                                    2. Create a project (free)<br>
                                    3. Enable "Google Sheets API" (free)<br>
                                    4. Create OAuth 2.0 credentials → Web application (free)<br>
                                    5. Add your domain to authorized origins<br>
                                    6. Copy the Client ID and paste above
                                </div>
                            </div>

                            <!-- Google Authorization -->
                            <div style="padding: 12px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <label class="field-label" style="margin: 0;">Google Access:</label>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span id="modal-google-auth-status" style="font-size: 12px; color: #666;">Not authorized</span>
                                        <button id="modal-google-auth-btn" class="btn-small" onclick="requestGoogleAuthorization()" style="padding: 6px 12px; background: #4285f4; color: white; border: none;">Sign in with Google</button>
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    After saving your Client ID above, click "Sign in with Google" to authorize access.
                                </div>
                            </div>
                        </div>
                    </details>

                    <!-- Info Note -->
                    <div style="padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 12px; color: #856404;">
                        <div id="modal-google-sheets-note"></div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button class="btn-small secondary" onclick="closeGoogleSheetsModal()">Cancel</button>
                <button id="modal-sync-button" class="btn-small" onclick="syncFromModal()" style="background-color: #2196F3; color: white; border-color: #2196F3;">Sync Now</button>
            </div>
        </div>
    </div>

    <!-- CSV Field Mapping Modal -->
    <div id="csv-field-mapping-modal" class="modal-overlay" aria-hidden="true" style="display: none;">
        <div class="modal" style="max-width: 900px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation();">
            <div class="modal-header">
                <span id="csv-mapping-modal-title">Map CSV Fields</span>
                <button class="btn-small secondary" onclick="closeCSVFieldMappingModal()">Close</button>
            </div>
            <div class="modal-body">
                <div id="csv-mapping-instructions" style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border: 1px solid #2196F3; border-radius: 4px; font-size: 12px;">
                    <strong>Instructions:</strong> Map your CSV columns to TeamRide Pro fields below.
                    Required fields will use default values if no CSV column is selected.
                    Check optional CSV columns to include them as custom fields.
                </div>
                <div id="csv-mapping-warning" style="display:none; margin-bottom: 16px; padding: 12px; background: #fff3e0; border: 1px solid #ff9800; border-radius: 4px; font-size: 12px;">
                </div>

                <!-- Name format is always "split" (First + Last) -->
                <input type="radio" name="name-format" id="name-format-split" value="split" checked style="display:none;">
                <input type="radio" name="name-format" id="name-format-single" value="single" style="display:none;">

                <div id="csv-field-mapping-container" style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Required field mappings generated here -->
                </div>

                <div id="csv-optional-fields-container" style="margin-top: 20px;">
                    <!-- Optional CSV columns checklist generated here -->
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button class="btn-small secondary" onclick="closeCSVFieldMappingModal()">Cancel</button>
                <button id="csv-mapping-apply-btn" class="btn-small" onclick="applyCSVFieldMapping()" style="background-color: #2196F3; color: white; border-color: #2196F3;">Import Riders/Coaches</button>
            </div>
        </div>
    </div>

    <!-- CSV Field Order Modal -->
    <div id="csv-field-order-modal" class="modal-overlay" aria-hidden="true" style="display: none;">
        <div class="modal" style="max-width: 600px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation();">
            <div class="modal-header">
                <span>Arrange Field Order on Record Cards</span>
                <button class="btn-small secondary" onclick="cancelFieldOrderModal()" style="float:right;">Cancel</button>
            </div>
            <div class="modal-body">
                <p style="font-size:13px; color:#555; margin-bottom:12px;">Drag or use arrows to reorder the fields as they will appear on rider/coach cards. Name fields are fixed at the top.</p>
                <div id="csv-field-order-list" style="border:1px solid #ddd; border-radius:4px; background:#fafafa; min-height:60px;"></div>
            </div>
            <div class="modal-footer" style="text-align:right; padding:12px 16px;">
                <button class="btn primary" onclick="applyFieldOrder()">Continue</button>
            </div>
        </div>
    </div>

    <!-- CSV Review Modal -->
    <div id="csv-review-modal" class="modal-overlay" aria-hidden="true" style="display: none;" onclick="if(event.target === this) closeCSVReviewModal();">
        <div class="modal" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation();">
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span id="csv-review-modal-title">Review CSV Changes</span>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="csv-review-mapping-btn" class="btn-small secondary" onclick="reopenMappingFromReview()" style="font-size:11px;">Mapping Settings...</button>
                    <button class="btn-small secondary" onclick="closeCSVReviewModal()">Cancel</button>
                </div>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 16px; padding: 12px; background: #e3f2fd; border: 1px solid #2196F3; border-radius: 4px; font-size: 12px;">
                    <strong>Review Changes:</strong> Review the changes below and make selections for each item, then click "Update Roster" when ready.
                </div>
                <div id="csv-review-content" style="max-height: 60vh; overflow-y: auto;">
                    <!-- Review content will be populated here -->
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; align-items: center; padding: 16px; border-top: 1px solid #e0e0e0;">
                <div style="display: flex; gap: 8px;">
                    <button class="btn-small secondary" onclick="closeCSVReviewModal()">Cancel</button>
                    <button class="btn-small" onclick="applyCSVReviewChanges()" style="background-color: #2196F3; color: white; border-color: #2196F3;">Update Roster</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Dev Mode Exit Modal -->
    <div id="dev-mode-exit-modal" class="modal-overlay" aria-hidden="true" style="display: none;" onclick="if(event.target === this) closeDevModeExitModal();">
        <div class="modal" style="max-width: 480px;" onclick="event.stopPropagation();">
            <div class="modal-header">
                <span>Exit Developer Mode</span>
                <button class="btn-small secondary" onclick="closeDevModeExitModal()">Close</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #334155;">
                    You are exiting Developer Mode. What would you like to do with the changes you made?
                </p>
                <div id="dev-mode-exit-activity" style="display:none; margin: 12px 0; padding: 10px 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; font-size: 13px; color: #92400e;"></div>
            </div>
            <div class="modal-footer" style="display: flex; flex-direction: column; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button id="dev-mode-exit-discard" class="btn-small" onclick="executeDevModeExit('discard')" style="background-color: #2196F3; color: white; border-color: #2196F3; padding: 10px 16px; font-size: 13px; width: 100%;">
                    Discard Changes from Dev Mode
                </button>
                <button id="dev-mode-exit-save" class="btn-small secondary" onclick="executeDevModeExit('save')" style="padding: 10px 16px; font-size: 13px; width: 100%;">
                    Save Changes Made in Dev Mode to Database
                </button>
            </div>
        </div>
    </div>

    <!-- Dev Mode Save Confirmation Modal -->
    <div id="dev-mode-save-confirm-modal" class="modal-overlay" aria-hidden="true" style="display: none;" onclick="if(event.target === this) closeDevModeSaveConfirmModal();">
        <div class="modal" style="max-width: 480px;" onclick="event.stopPropagation();">
            <div class="modal-header" style="background: #fef2f2; border-bottom: 1px solid #fca5a5;">
                <span style="color: #991b1b;">Confirm: Overwrite Database</span>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; font-weight: 500;">
                    This action will overwrite the live database with your local changes.
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                    Any changes saved by other users while you were in Developer Mode will be lost.
                </p>
                <div id="dev-mode-save-confirm-activity" style="display:none; margin: 12px 0; padding: 10px 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; font-size: 13px; color: #92400e;"></div>
            </div>
            <div class="modal-footer" style="display: flex; flex-direction: column; gap: 8px; padding: 16px; border-top: 1px solid #e0e0e0;">
                <button id="dev-mode-save-cancel" class="btn-small" onclick="closeDevModeSaveConfirmModal()" style="background-color: #2196F3; color: white; border-color: #2196F3; padding: 10px 16px; font-size: 13px; width: 100%;">
                    Go Back — Don't Save
                </button>
                <button id="dev-mode-save-execute" class="btn-small secondary" onclick="executeDevModeExit('force-save')" style="padding: 10px 16px; font-size: 13px; width: 100%; color: #991b1b; border-color: #fca5a5;">
                    Yes, Overwrite Database with My Changes
                </button>
            </div>
        </div>
    </div>

`);
