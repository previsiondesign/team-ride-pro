// Routes modals — injected at startup.
// Extracted from teamridepro_v3.html to reduce file size.
document.body.insertAdjacentHTML('beforeend', `

    <div id="routes-manager-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 1000px; width: min(1000px, 95%);">
            <div class="modal-header">
                <span>Manage Routes</span>
                <button class="btn-small secondary" onclick="closeRoutesManagerModal()">Close</button>
            </div>
            <div class="modal-body">
                <div id="routes-manager-list" style="max-height: 500px; overflow-y: auto;">
                    <!-- Routes list will be loaded dynamically -->
                </div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 12px; align-items: center;">
                    <button class="btn-small" onclick="openAddRouteModal(null)">Add New Route</button>
                </div>
            </div>
        </div>
    </div>

    <div id="add-route-modal" class="modal-overlay" aria-hidden="true">
        <div class="modal" style="max-width: 700px;">
            <div class="modal-header" id="add-route-modal-header">
                <span id="add-route-modal-title">Add New Route</span>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Use Strava Route toggle button -->
                    <div id="strava-toggle-section">
                        <button type="button" id="strava-toggle-btn" class="btn-small" onclick="toggleStravaRouteSection()" style="background-color: #fc5200; color: white; border-color: #fc5200; width: 100%; padding: 10px 16px; font-size: 14px; font-weight: 600;">Use Strava Route</button>
                    </div>
                    <!-- Strava embed code section (hidden by default) -->
                    <div id="strava-embed-section" style="display: none;">
                        <div style="position: relative;">
                            <label for="route-embed-code" class="field-label" style="display: flex; align-items: center; gap: 6px;">
                                Strava Embed Code
                                <span class="info-icon" style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background-color: #666; color: white; font-size: 11px; font-weight: bold; cursor: help; user-select: none;" onmouseenter="showEmbedCodeTooltip(event)" onmouseleave="hideEmbedCodeTooltip()">i</span>
                            </label>
                            <div id="embed-code-tooltip" style="position: absolute; background-color: #333; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 10000; pointer-events: none; display: none; max-width: 300px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); white-space: normal; line-height: 1.4;">To get the embed code: Go to your Strava route page → Click the "Share" button → Copy the embed code</div>
                            <textarea id="route-embed-code" class="modal-field-input" rows="6" placeholder="Paste the Strava embed iframe code here..."></textarea>
                            <div id="fetch-route-data-container" style="margin-top: 12px;">
                                <button type="button" id="fetch-route-data-btn" class="btn-small" onclick="fetchRouteDataFromEmbed()" disabled>
                                    Auto-fill Route Info from Strava
                                </button>
                                <span id="fetch-route-status" style="margin-left: 8px; font-size: 12px; color: #666;"></span>
                                <div style="margin-top: 6px; font-size: 11px; color: #888; font-style: italic;">
                                    Note: Initial autofill may take up to 30 seconds if the server is sleeping.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label for="route-name" class="field-label">Route Name</label>
                        <input type="text" id="route-name" class="modal-field-input" placeholder="Enter route name">
                    </div>
                    <div>
                        <label for="route-start-location" class="field-label">Start Location</label>
                        <select id="route-start-location" class="modal-field-input">
                            <option value="">-- Select start location --</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div style="flex:1;">
                            <label for="route-distance" class="field-label">Distance (Optional)</label>
                            <input type="text" id="route-distance" class="modal-field-input" placeholder="Will be auto-filled from Strava">
                        </div>
                        <div style="flex:1;">
                            <label for="route-elevation" class="field-label">Elevation Gain (Optional)</label>
                            <input type="text" id="route-elevation" class="modal-field-input" placeholder="Will be auto-filled from Strava">
                        </div>
                    </div>
                    <div>
                        <label class="field-label">Most appropriate Endurance Range</label>
                        <div id="route-fitness-slider-container" style="position: relative; padding: 5px 0;">
                            <div id="route-fitness-slider-track" style="position: relative; height: 6px; background: #e0e0e0; border-radius: 3px; margin: 8px 0;">
                                <div id="route-fitness-slider-range" style="position: absolute; height: 100%; background: #2196F3; border-radius: 3px; left: 0%; width: 100%; top: 0;"></div>
                                <div id="route-fitness-min-handle" class="slider-handle" data-slider="fitness" data-type="min" style="position: absolute; left: 0%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <div id="route-fitness-max-handle" class="slider-handle" data-slider="fitness" data-type="max" style="position: absolute; left: 100%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <input type="range" id="route-fitness-min" min="1" max="5" value="1" step="1" style="display: none;" oninput="updateFitnessRange()">
                                <input type="range" id="route-fitness-max" min="2" max="5" value="5" step="1" style="display: none;" oninput="updateFitnessRange()">
                            </div>
                            <div id="route-fitness-labels" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #666;">
                                <!-- Labels will be generated dynamically -->
                            </div>
                            <div style="text-align: center; margin-top: 4px; font-size: 12px; font-weight: 600; color: #2196F3;">
                                <span id="route-fitness-min-value">1</span> - <span id="route-fitness-max-value">5</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label class="field-label">Most appropriate Descending Range</label>
                        <div id="route-skills-slider-container" style="position: relative; padding: 5px 0;">
                            <div id="route-skills-slider-track" style="position: relative; height: 6px; background: #e0e0e0; border-radius: 3px; margin: 8px 0;">
                                <div id="route-skills-slider-range" style="position: absolute; height: 100%; background: #2196F3; border-radius: 3px; left: 0%; width: 100%; top: 0;"></div>
                                <div id="route-skills-min-handle" class="slider-handle" data-slider="skills" data-type="min" style="position: absolute; left: 0%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <div id="route-skills-max-handle" class="slider-handle" data-slider="skills" data-type="max" style="position: absolute; left: 100%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <input type="range" id="route-skills-min" min="1" max="3" value="1" step="1" style="display: none;" oninput="updateSkillsRange()">
                                <input type="range" id="route-skills-max" min="2" max="3" value="3" step="1" style="display: none;" oninput="updateSkillsRange()">
                            </div>
                            <div id="route-skills-labels" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #666;">
                                <!-- Labels will be generated dynamically -->
                            </div>
                            <div style="text-align: center; margin-top: 4px; font-size: 12px; font-weight: 600; color: #2196F3;">
                                <span id="route-skills-min-value">1</span> - <span id="route-skills-max-value">3</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label class="field-label">Most appropriate Climbing Range</label>
                        <div id="route-climbing-slider-container" style="position: relative; padding: 5px 0;">
                            <div id="route-climbing-slider-track" style="position: relative; height: 6px; background: #e0e0e0; border-radius: 3px; margin: 8px 0;">
                                <div id="route-climbing-slider-range" style="position: absolute; height: 100%; background: #2196F3; border-radius: 3px; left: 0%; width: 100%; top: 0;"></div>
                                <div id="route-climbing-min-handle" class="slider-handle" data-slider="climbing" data-type="min" style="position: absolute; left: 0%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <div id="route-climbing-max-handle" class="slider-handle" data-slider="climbing" data-type="max" style="position: absolute; left: 100%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: #2196F3; border-radius: 50%; cursor: grab; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: auto; top: 50%;"></div>
                                <input type="range" id="route-climbing-min" min="1" max="3" value="1" step="1" style="display: none;" oninput="updateClimbingRange()">
                                <input type="range" id="route-climbing-max" min="2" max="3" value="3" step="1" style="display: none;" oninput="updateClimbingRange()">
                            </div>
                            <div id="route-climbing-labels" style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #666;">
                                <!-- Labels will be generated dynamically -->
                            </div>
                            <div style="text-align: center; margin-top: 4px; font-size: 12px; font-weight: 600; color: #2196F3;">
                                <span id="route-climbing-min-value">1</span> - <span id="route-climbing-max-value">3</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label for="route-description" class="field-label">Notes (Optional)</label>
                        <textarea id="route-description" class="modal-field-input" rows="3" placeholder="Brief description of the route..."></textarea>
                    </div>
                    <div id="route-cached-preview-section">
                        <label for="route-cached-preview-file" class="field-label">Cached map preview (optional)</label>
                        <input type="file" id="route-cached-preview-file" class="modal-field-input" accept="image/*" onchange="onRouteCachedPreviewFileChange(event)">
                        <small style="display: block; margin-top: 6px; font-size: 11px; color: #888;">Upload a screenshot of the route map to avoid loading live Strava embeds and keep the page fast.</small>
                        <span id="route-cached-preview-status" style="font-size: 12px; color: #666; margin-top: 4px; display: none;"></span>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
                <button id="delete-route-btn" class="btn-small danger" onclick="deleteRouteFromEditModal()" style="display: none;">Delete Route</button>
                <div style="display: flex; gap: 8px; margin-left: auto;">
                    <button class="btn-small secondary" onclick="closeAddRouteModal()">Cancel</button>
                    <button class="btn-small" onclick="saveRoute()">Save Route</button>
                </div>
            </div>
        </div>
    </div>

`);
