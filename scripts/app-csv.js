// app-csv.js — CSV import, Google Sheets integration, field mapping, review screen

        function _handleCSVFileSelected(entityType, csvText) {
            const parsed = parseCSV(csvText);
            if (parsed.length < 2) {
                alert('CSV file must contain at least a header row and one data row.');
                return;
            }

            pendingCSVData = csvText;
            pendingCSVType = entityType;
            pendingCSVHeaders = parsed[0];
            window._pendingCSVReviewData = csvText;

            const roster = entityType === 'riders' ? data.riders : data.coaches;
            const activeCount = (roster || []).filter(r => !r.archived).length;
            const isInitialImport = activeCount === 0;

            if (isInitialImport) {
                openCSVFieldMappingModal(entityType, parsed[0], true);
            } else {
                const savedMapping = loadCSVFieldMappingFromStorage(entityType) || data.seasonSettings?.csvFieldMappings?.[entityType];
                if (!savedMapping) {
                    openCSVFieldMappingModal(entityType, parsed[0], false);
                } else {
                    const validation = validateCSVHeadersAgainstSavedMapping(parsed[0], savedMapping);
                    if (!validation.isMatch) {
                        openCSVFieldMappingModal(entityType, parsed[0], false, validation);
                    } else {
                        pendingCSVType = entityType;
                        const fieldMapping = {
                            mapping: savedMapping.mapping,
                            enabledFields: savedMapping.enabledFields,
                            additionalFields: savedMapping.additionalFields,
                            customFieldNames: savedMapping.customFieldNames || {},
                            nameFormat: savedMapping.nameFormat,
                            unmappedFieldActions: savedMapping.unmappedFieldActions || {},
                            userCustomFields: savedMapping.userCustomFields || []
                        };
                        window._csvMappingContext = { type: entityType, csvHeaders: parsed[0], isImport: false };
                        if (entityType === 'riders') {
                            updateRidersFromCSVWithMapping(csvText, fieldMapping);
                        } else {
                            updateCoachesFromCSVWithMapping(csvText, fieldMapping);
                        }
                    }
                }
            }
        }

        function _openCSVFilePicker(entityType) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.style.display = 'none';

            fileInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    if (document.body.contains(fileInput)) document.body.removeChild(fileInput);
                    return;
                }
                try {
                    const text = await readFileAsText(file);
                    _handleCSVFileSelected(entityType, text);
                } catch (error) {
                    console.error('Error reading file:', error);
                    alert('Error reading CSV file: ' + (error.message || 'Unknown error'));
                } finally {
                    if (document.body.contains(fileInput)) document.body.removeChild(fileInput);
                }
            };

            document.body.appendChild(fileInput);
            fileInput.click();
        }

        function importRidersFromCSV() {
            _openCSVFilePicker('riders');
        }

        function importCoachesFromCSV() {
            _openCSVFilePicker('coaches');
        }
        
        // Helper to read file as text
        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
        }

        // Google Sheets integration
        function extractGoogleSheetId(url) {
            if (!url) return null;
            
            // Handle different Google Sheets URL formats
            // Format 1: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={GID}
            // Format 2: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?gid={GID}
            // Format 3: https://docs.google.com/spreadsheets/d/{SHEET_ID}
            
            const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!match) return null;
            
            const sheetId = match[1];
            
            // Extract GID if present
            let gid = '0'; // Default to first sheet
            const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
            if (gidMatch) {
                gid = gidMatch[1];
            }
            
            return { sheetId, gid };
        }

        function getGoogleSheetCSVUrl(sheetId, gid = '0') {
            return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
        }

        // Google OAuth configuration (uses app-state.js if loaded; fallback for standalone)
        // NOTE: You need to set up a Google Cloud Project and OAuth 2.0 Client ID
        // 1. Go to https://console.cloud.google.com/
        // 2. Create a project or select existing
        // 3. Enable Google Sheets API
        // 4. Create OAuth 2.0 credentials (Web application)
        // 5. Add your domain to authorized JavaScript origins
        // 6. Set the client ID in seasonSettings.googleClientId or GOOGLE_CLIENT_ID_DEFAULT
        if (typeof GOOGLE_CLIENT_ID_DEFAULT === 'undefined') { var GOOGLE_CLIENT_ID_DEFAULT = ''; }
        if (typeof GOOGLE_SCOPES === 'undefined') { var GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'; }
        function getGoogleClientId() {
            return data.seasonSettings?.googleClientId || GOOGLE_CLIENT_ID_DEFAULT;
        }

        // Initialize Google OAuth
        function initGoogleOAuth() {
            const clientId = getGoogleClientId();
            if (!clientId) {
                console.warn('Google Client ID not configured. OAuth will not work. Set data.seasonSettings.googleClientId or GOOGLE_CLIENT_ID_DEFAULT constant.');
                return;
            }

            if (typeof google !== 'undefined' && google.accounts) {
                try {
                    google.accounts.id.initialize({
                        client_id: clientId
                    });

                    google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: GOOGLE_SCOPES,
                        callback: (response) => {
                            if (response.access_token) {
                                googleAccessToken = response.access_token;
                                // Store token securely (encrypted in localStorage)
                                try {
                                    localStorage.setItem('google_access_token', response.access_token);
                                    localStorage.setItem('google_token_expiry', String(Date.now() + (response.expires_in * 1000)));
                                } catch (e) {
                                    console.warn('Could not store Google token:', e);
                                }
                                // Update status display
                                updateGoogleAuthStatus();
                            }
                        }
                    }).then(client => {
                        googleTokenClient = client;
                    }).catch(err => {
                        console.error('Error initializing Google OAuth:', err);
                    });
                } catch (err) {
                    console.error('Error setting up Google OAuth:', err);
                }
            } else {
                console.warn('Google API not loaded. Make sure the Google API scripts are included in the page.');
            }
        }

        // Load stored Google token
        function loadGoogleToken() {
            try {
                const storedToken = localStorage.getItem('google_access_token');
                const expiry = localStorage.getItem('google_token_expiry');
                if (storedToken && expiry && Date.now() < parseInt(expiry, 10)) {
                    googleAccessToken = storedToken;
                    return true;
                } else {
                    // Token expired or doesn't exist
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_token_expiry');
                    googleAccessToken = null;
                    return false;
                }
            } catch (e) {
                return false;
            }
        }

        // Request Google OAuth authorization
        async function authorizeGoogle() {
            const clientId = getGoogleClientId();
            if (!clientId) {
                alert('Google OAuth is not configured. Please set up a Google Cloud Project and OAuth Client ID.\n\nSee instructions in the code comments or contact your administrator.');
                return false;
            }

            if (!googleTokenClient) {
                initGoogleOAuth();
                // Wait a bit for initialization
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!googleTokenClient) {
                    alert('Google OAuth initialization failed. Please refresh the page and try again.');
                    return false;
                }
            }

            return new Promise((resolve) => {
                try {
                    googleTokenClient.requestAccessToken({ prompt: 'consent' });
                    // The callback will set googleAccessToken
                    // Check after a delay to allow OAuth popup
                    setTimeout(() => {
                        if (googleAccessToken) {
                            updateGoogleAuthStatus();
                        }
                        resolve(!!googleAccessToken);
                    }, 2000);
                } catch (err) {
                    console.error('Error requesting access token:', err);
                    resolve(false);
                }
            });
        }

        // Public function to request authorization (called by button)
        async function requestGoogleAuthorization() {
            const authorized = await authorizeGoogle();
            if (authorized) {
                alert('Successfully authorized Google access! You can now sync private Google Sheets.');
            } else {
                alert('Authorization failed. Please try again or make sure your Google Sheet is publicly viewable.');
            }
        }

        // Update the authorization status display
        function updateGoogleAuthStatus() {
            const riderStatus = document.getElementById('rider-google-auth-status');
            const coachStatus = document.getElementById('coach-google-auth-status');
            const modalStatus = document.getElementById('modal-google-auth-status');
            const riderBtn = document.getElementById('rider-google-auth-btn');
            const coachBtn = document.getElementById('coach-google-auth-btn');
            const modalBtn = document.getElementById('modal-google-auth-btn');
            
            const isAuthorized = !!googleAccessToken;
            const statusText = isAuthorized ? '✓ Authorized' : 'Not authorized';
            const statusColor = isAuthorized ? '#4caf50' : '#666';
            const btnText = isAuthorized ? 'Re-authorize' : 'Sign in with Google';
            
            if (riderStatus) {
                riderStatus.textContent = statusText;
                riderStatus.style.color = statusColor;
            }
            if (coachStatus) {
                coachStatus.textContent = statusText;
                coachStatus.style.color = statusColor;
            }
            if (modalStatus) {
                modalStatus.textContent = statusText;
                modalStatus.style.color = statusColor;
            }
            if (riderBtn) {
                riderBtn.textContent = btnText;
            }
            if (coachBtn) {
                coachBtn.textContent = btnText;
            }
            if (modalBtn) {
                modalBtn.textContent = btnText;
            }
        }

        // Fetch Google Sheet using Sheets API v4 (with OAuth) or CSV export (public)
        async function fetchGoogleSheetCSV(url, useAuth = true) {
            try {
                const sheetInfo = extractGoogleSheetId(url);
                if (!sheetInfo) {
                    throw new Error('Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/SHEET_ID/edit');
                }

                // Try authenticated API first if token is available
                if (useAuth && googleAccessToken) {
                    try {
                        // First, get sheet metadata to find the sheet name by GID
                        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetInfo.sheetId}?fields=sheets.properties`;
                        const metadataResponse = await fetch(metadataUrl, {
                            headers: {
                                'Authorization': `Bearer ${googleAccessToken}`
                            }
                        });

                        let sheetName = 'Sheet1'; // Default
                        if (metadataResponse.ok) {
                            const metadata = await metadataResponse.json();
                            const targetSheet = metadata.sheets?.find(sheet => 
                                String(sheet.properties.sheetId) === String(sheetInfo.gid)
                            );
                            if (targetSheet) {
                                sheetName = targetSheet.properties.title;
                            } else if (metadata.sheets && metadata.sheets.length > 0) {
                                // Fallback to first sheet if GID doesn't match
                                sheetName = metadata.sheets[0].properties.title;
                            }
                        }

                        // Use Google Sheets API v4
                        const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetInfo.sheetId}/values/${encodeURIComponent(sheetName)}?alt=json`;
                        const response = await fetch(apiUrl, {
                            headers: {
                                'Authorization': `Bearer ${googleAccessToken}`
                            }
                        });

                        if (response.ok) {
                            const data = await response.json();
                            // Convert to CSV format
                            const rows = data.values || [];
                            if (rows.length === 0) {
                                throw new Error('Sheet appears to be empty');
                            }
                            const csvRows = rows.map(row => {
                                // Escape commas and quotes in CSV
                                return row.map(cell => {
                                    if (cell === null || cell === undefined) return '';
                                    const cellStr = String(cell);
                                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                        return `"${cellStr.replace(/"/g, '""')}"`;
                                    }
                                    return cellStr;
                                }).join(',');
                            });
                            return csvRows.join('\n');
                        } else if (response.status === 401) {
                            // Token expired or invalid, try to re-authorize
                            googleAccessToken = null;
                            localStorage.removeItem('google_access_token');
                            localStorage.removeItem('google_token_expiry');
                            throw new Error('AUTH_REQUIRED');
                        } else {
                            throw new Error(`API Error: ${response.status} ${response.statusText}`);
                        }
                    } catch (apiError) {
                        if (apiError.message === 'AUTH_REQUIRED') {
                            throw apiError;
                        }
                        console.warn('Google Sheets API failed, falling back to CSV export:', apiError);
                        // Fall through to CSV export
                    }
                }

                // Fallback to public CSV export
                const csvUrl = getGoogleSheetCSVUrl(sheetInfo.sheetId, sheetInfo.gid);
                const response = await fetch(csvUrl);
                if (!response.ok) {
                    if (useAuth && !googleAccessToken) {
                        throw new Error('AUTH_REQUIRED');
                    }
                    throw new Error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}. The sheet may be private. Please authorize access or make the sheet publicly viewable.`);
                }
                
                const csvText = await response.text();
                return csvText;
            } catch (error) {
                console.error('Error fetching Google Sheet:', error);
                throw error;
            }
        }

        function saveRiderGoogleSheetUrl() {
            const urlInput = document.getElementById('rider-google-sheet-url');
            if (!urlInput) return;
            
            const url = urlInput.value.trim();
            if (!url) {
                alert('Please enter a Google Sheets URL.');
                return;
            }

            // Validate URL
            const sheetInfo = extractGoogleSheetId(url);
            if (!sheetInfo) {
                alert('Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/SHEET_ID/edit');
                return;
            }

            // Save to settings
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            data.seasonSettings.riderGoogleSheetUrl = url;
            saveData();
            
            alert('Google Sheet URL saved! You can now use "Sync from Google Sheet" to update riders.');
        }

        function saveCoachGoogleSheetUrl() {
            const urlInput = document.getElementById('coach-google-sheet-url');
            if (!urlInput) return;
            
            const url = urlInput.value.trim();
            if (!url) {
                alert('Please enter a Google Sheets URL.');
                return;
            }

            // Validate URL
            const sheetInfo = extractGoogleSheetId(url);
            if (!sheetInfo) {
                alert('Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/SHEET_ID/edit');
                return;
            }

            // Save to settings
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            data.seasonSettings.coachGoogleSheetUrl = url;
            saveData();
            
            alert('Google Sheet URL saved! You can now use "Sync from Google Sheet" to update coaches.');
        }

        // Save Google Client ID
        function saveGoogleClientId() {
            const clientIdInput = document.getElementById('modal-google-client-id');
            if (!clientIdInput) return;
            
            const clientId = clientIdInput.value.trim();
            if (!clientId) {
                alert('Please enter a Google OAuth Client ID.');
                return;
            }

            // Save to settings
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            data.seasonSettings.googleClientId = clientId;
            saveData();
            
            // Re-initialize OAuth with new client ID
            initGoogleOAuth();
            updateGoogleAuthStatus();
            
            alert('Google Client ID saved! You can now authorize access to private Google Sheets.');
        }

        // Open Google Sheets modal
        function openGoogleSheetsModal(type) {
            const modal = document.getElementById('google-sheets-modal');
            const title = document.getElementById('google-sheets-modal-title');
            const urlInput = document.getElementById('modal-google-sheet-url');
            const clientIdInput = document.getElementById('modal-google-client-id');
            const note = document.getElementById('modal-google-sheets-note');
            
            if (!modal) return;
            
            // Set type (riders or coaches)
            modal.dataset.syncType = type;
            
            // Update title
            if (title) {
                title.textContent = `Sync ${type === 'riders' ? 'Riders' : 'Coaches'} from Google Sheet`;
            }
            
            // Load Client ID
            if (clientIdInput) {
                clientIdInput.value = getGoogleClientId() || '';
            }
            
            // Load URL
            if (urlInput) {
                const urlKey = type === 'riders' ? 'riderGoogleSheetUrl' : 'coachGoogleSheetUrl';
                urlInput.value = data.seasonSettings?.[urlKey] || '';
            }
            
            // Update note
            if (note) {
                if (type === 'riders') {
                    note.innerHTML = '<strong>Note:</strong> Only updates: name, email, phone, grade, gender, address, parent info, medical info.<br>Preserves: fitness, bike skills, photo, notes, racing group.';
                } else {
                    note.innerHTML = '<strong>Note:</strong> Only updates: name, email, phone, level, gender, registration info.<br>Preserves: fitness, photo, notes.';
                }
            }
            
            // Update auth status
            updateGoogleAuthStatus();
            
            // Show modal
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeGoogleSheetsModal() {
            const modal = document.getElementById('google-sheets-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
        }

        function saveModalGoogleSheetUrl() {
            const modal = document.getElementById('google-sheets-modal');
            const type = modal?.dataset.syncType;
            const urlInput = document.getElementById('modal-google-sheet-url');
            
            if (!type || !urlInput) return;
            
            const url = urlInput.value.trim();
            if (!url) {
                alert('Please enter a Google Sheets URL.');
                return;
            }

            // Validate URL
            const sheetInfo = extractGoogleSheetId(url);
            if (!sheetInfo) {
                alert('Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/SHEET_ID/edit');
                return;
            }

            // Save to settings
            if (!data.seasonSettings) {
                data.seasonSettings = buildDefaultSeasonSettings();
            }
            const urlKey = type === 'riders' ? 'riderGoogleSheetUrl' : 'coachGoogleSheetUrl';
            data.seasonSettings[urlKey] = url;
            saveData();
            
            alert('Google Sheet URL saved!');
        }

        async function syncFromModal() {
            const modal = document.getElementById('google-sheets-modal');
            const type = modal?.dataset.syncType;
            
            if (!type) return;
            
            if (type === 'riders') {
                await syncRidersFromGoogleSheet();
            } else {
                await syncCoachesFromGoogleSheet();
            }
            
            // Close modal after sync
            closeGoogleSheetsModal();
        }

        async function syncRidersFromGoogleSheet() {
            const url = data.seasonSettings?.riderGoogleSheetUrl;
            if (!url) {
                alert('No Google Sheet URL configured. Please enter a URL and click "Save Link" first.');
                return;
            }

            if (!confirm('Sync riders from Google Sheet? This will update existing riders and add new ones, but will preserve fitness, bike skills, photo, and notes.')) {
                return;
            }

            try {
                // Load stored token or initialize OAuth
                loadGoogleToken();
                if (!googleAccessToken && getGoogleClientId()) {
                    initGoogleOAuth();
                }

                // Show loading message
                const loadingMsg = document.createElement('div');
                loadingMsg.id = 'google-sheet-loading';
                loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid #2196F3; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
                loadingMsg.innerHTML = '<div style="text-align: center;"><div style="margin-bottom: 10px;">⏳</div><div>Fetching data from Google Sheet...</div></div>';
                document.body.appendChild(loadingMsg);

                // Fetch CSV from Google Sheet
                let csvText;
                try {
                    csvText = await fetchGoogleSheetCSV(url, true);
                } catch (error) {
                    if (error.message === 'AUTH_REQUIRED') {
                        // Remove loading message
                        document.body.removeChild(loadingMsg);
                        
                        // Request authorization
                        if (confirm('This Google Sheet requires authorization. Click OK to authorize access to your Google account.')) {
                            const authorized = await authorizeGoogle();
                            if (!authorized) {
                                alert('Authorization failed. Please try again or make the sheet publicly viewable.');
                                return;
                            }
                            
                            // Show loading again
                            document.body.appendChild(loadingMsg);
                            csvText = await fetchGoogleSheetCSV(url, true);
                        } else {
                            return;
                        }
                    } else {
                        throw error;
                    }
                }
                
                // Remove loading message
                document.body.removeChild(loadingMsg);

                // Parse CSV to get headers
                const parsed = parseCSV(csvText);
                if (parsed.length < 2) {
                    alert('Google Sheet must contain at least a header row and one data row.');
                    return;
                }
                
                // Store for mapping
                pendingCSVData = csvText;
                pendingCSVType = 'riders';
                pendingCSVHeaders = parsed[0];
                
                // Show mapping modal
                openCSVFieldMappingModal('riders', parsed[0]);
            } catch (error) {
                const loadingMsg = document.getElementById('google-sheet-loading');
                if (loadingMsg) document.body.removeChild(loadingMsg);
                
                console.error('Error syncing from Google Sheet:', error);
                const errorMsg = error.message || 'Unknown error';
                if (errorMsg.includes('AUTH_REQUIRED')) {
                    alert('This Google Sheet requires authorization. Please authorize access or make the sheet publicly viewable (Share > Anyone with the link can view).');
                } else {
                    alert('Error syncing from Google Sheet: ' + errorMsg + '\n\nMake sure:\n1. The Google Sheet URL is correct\n2. You have authorized access (if the sheet is private)\n3. The sheet has a header row');
                }
            }
        }

        async function syncCoachesFromGoogleSheet() {
            const url = data.seasonSettings?.coachGoogleSheetUrl;
            if (!url) {
                alert('No Google Sheet URL configured. Please enter a URL and click "Save Link" first.');
                return;
            }

            if (!confirm('Sync coaches from Google Sheet? This will update existing coaches and add new ones, but will preserve fitness, photo, and notes.')) {
                return;
            }

            try {
                // Load stored token or initialize OAuth
                loadGoogleToken();
                if (!googleAccessToken && getGoogleClientId()) {
                    initGoogleOAuth();
                }

                // Show loading message
                const loadingMsg = document.createElement('div');
                loadingMsg.id = 'google-sheet-loading';
                loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border: 2px solid #2196F3; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
                loadingMsg.innerHTML = '<div style="text-align: center;"><div style="margin-bottom: 10px;">⏳</div><div>Fetching data from Google Sheet...</div></div>';
                document.body.appendChild(loadingMsg);

                // Fetch CSV from Google Sheet
                let csvText;
                try {
                    csvText = await fetchGoogleSheetCSV(url, true);
                } catch (error) {
                    if (error.message === 'AUTH_REQUIRED') {
                        // Remove loading message
                        document.body.removeChild(loadingMsg);
                        
                        // Request authorization
                        if (confirm('This Google Sheet requires authorization. Click OK to authorize access to your Google account.')) {
                            const authorized = await authorizeGoogle();
                            if (!authorized) {
                                alert('Authorization failed. Please try again or make the sheet publicly viewable.');
                                return;
                            }
                            
                            // Show loading again
                            document.body.appendChild(loadingMsg);
                            csvText = await fetchGoogleSheetCSV(url, true);
                        } else {
                            return;
                        }
                    } else {
                        throw error;
                    }
                }
                
                // Remove loading message
                document.body.removeChild(loadingMsg);

                // Parse CSV to get headers
                const parsed = parseCSV(csvText);
                if (parsed.length < 2) {
                    alert('Google Sheet must contain at least a header row and one data row.');
                    return;
                }
                
                // Store for mapping
                pendingCSVData = csvText;
                pendingCSVType = 'coaches';
                pendingCSVHeaders = parsed[0];
                
                // Show mapping modal
                openCSVFieldMappingModal('coaches', parsed[0]);
            } catch (error) {
                const loadingMsg = document.getElementById('google-sheet-loading');
                if (loadingMsg) document.body.removeChild(loadingMsg);
                
                console.error('Error syncing from Google Sheet:', error);
                const errorMsg = error.message || 'Unknown error';
                if (errorMsg.includes('AUTH_REQUIRED')) {
                    alert('This Google Sheet requires authorization. Please authorize access or make the sheet publicly viewable (Share > Anyone with the link can view).');
                } else {
                    alert('Error syncing from Google Sheet: ' + errorMsg + '\n\nMake sure:\n1. The Google Sheet URL is correct\n2. You have authorized access (if the sheet is private)\n3. The sheet has a header row');
                }
            }
        }

        // Update riders from CSV file picker
        function updateRidersFromCSVFile() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.style.display = 'none';
            
            fileInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                    }
                    return;
                }

                try {
                    const ridersText = await readFileAsText(file);
                    const parsed = parseCSV(ridersText);
                    if (parsed.length < 2) {
                        alert('CSV file must contain at least a header row and one data row.');
                        return;
                    }
                    
                    pendingCSVData = ridersText;
                    pendingCSVType = 'riders';
                    pendingCSVHeaders = parsed[0];
                    
                    openCSVFieldMappingModal('riders', parsed[0]);
                } catch (error) {
                    console.error('Error reading file:', error);
                    alert('Error reading CSV file: ' + (error.message || 'Unknown error'));
                } finally {
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                    }
                }
            };
            
            document.body.appendChild(fileInput);
            fileInput.click();
        }

        // Update coaches from CSV file picker
        function updateCoachesFromCSVFile() {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.style.display = 'none';
            
            fileInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                    }
                    return;
                }

                try {
                    const coachesText = await readFileAsText(file);
                    const parsed = parseCSV(coachesText);
                    if (parsed.length < 2) {
                        alert('CSV file must contain at least a header row and one data row.');
                        return;
                    }
                    
                    pendingCSVData = coachesText;
                    pendingCSVType = 'coaches';
                    pendingCSVHeaders = parsed[0];
                    
                    openCSVFieldMappingModal('coaches', parsed[0]);
                } catch (error) {
                    console.error('Error reading file:', error);
                    alert('Error reading CSV file: ' + (error.message || 'Unknown error'));
                } finally {
                    if (document.body.contains(fileInput)) {
                        document.body.removeChild(fileInput);
                    }
                }
            };
            
            document.body.appendChild(fileInput);
            fileInput.click();
        }
        
        // Purge all riders
        function purgeRiders() {
            if (!confirm('Are you sure you want to delete ALL riders? This action cannot be undone.')) {
                return;
            }
            
            if (!confirm('This will permanently delete all rider records. Are you absolutely sure?')) {
                return;
            }
            
            data.riders = [];
            saveData();
            renderRiders();
            alert('All riders have been deleted.');
        }
        
        // Purge all coaches
        async function purgeCoaches() {
            if (!confirm('Are you sure you want to delete ALL coaches? This action cannot be undone.')) {
                return;
            }
            
            if (!confirm('This will permanently delete all coach records. Are you absolutely sure?')) {
                return;
            }
            try {
                const client = getSupabaseClient();
                const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                if (client && currentUser && typeof deleteCoachFromDB === 'function') {
                    for (const coach of data.coaches) {
                        await deleteCoachFromDB(coach.id);
                    }
                }
            } catch (error) {
                console.error('Error deleting coaches from database:', error);
                alert(error.message || 'Failed to delete all coaches.');
                return;
            }
            
            data.coaches = [];
            saveData();
            renderCoaches();
            alert('All coaches have been deleted.');
        }
        
        // Process riders CSV import
        async function processRidersCSVImport(ridersText) {
            try {
                // Parse CSV
                const riders = parseCSV(ridersText);
                if (riders.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Get header mapping
                const headers = riders[0];
                const headerMap = getRiderHeaderMap(headers);

                // Import riders
                const importedRiders = [];
                for (let i = 1; i < riders.length; i++) { // Skip header row
                    const row = riders[i];
                    if (!row || row.length === 0) continue; // Skip empty rows

                    // Get name fields using header map
                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 0;
                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 1;
                    const firstName = (row[firstNameIdx] || '').trim();
                    const lastName = (row[lastNameIdx] || '').trim();
                    if (!firstName && !lastName) continue;

                    const name = `${firstName} ${lastName}`.trim();

                    // Get gender and determine default photo
                    const genderIdx = headerMap['gender'];
                    const genderRaw = genderIdx !== undefined ? (row[genderIdx] || '').trim().toUpperCase() : '';
                    let gender = '';
                    if (genderRaw === 'M' || genderRaw === 'MALE' || genderRaw === 'MALE') gender = 'M';
                    else if (genderRaw === 'F' || genderRaw === 'FEMALE' || genderRaw === 'FEMALE') gender = 'F';
                    else if (genderRaw === 'NB' || genderRaw === 'NONBINARY' || genderRaw === 'NON-BINARY') gender = 'NB';

                    let defaultPhoto = '';
                    if (!gender) {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    } else if (gender === 'M') {
                        defaultPhoto = 'assets/male_default.png';
                    } else if (gender === 'F') {
                        defaultPhoto = 'assets/female_default.png';
                    } else if (gender === 'NB') {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    }

                    // Helper function to get value from CSV row using header map
                    const getValue = (fieldName) => {
                        const idx = headerMap[fieldName];
                        return idx !== undefined ? (row[idx] || '').trim() : '';
                    };

                    // Helper function to get phone value
                    const getPhoneValue = (fieldName) => {
                        const val = getValue(fieldName);
                        return normalizePhoneNumber(val);
                    };

                    // Get grade
                    const gradeRaw = getValue('grade');
                    const grade = normalizeGradeValue(gradeRaw);

                    const riderData = {
                        id: Date.now() + Math.floor(Math.random() * 1000) + i * 1000,
                        name: name,
                        firstName,
                        lastName,
                        photo: defaultPhoto,
                        email: getValue('email'),
                        phone: getPhoneValue('phone'),
                        address: getValue('address'),
                        gender: gender,
                        grade: grade,
                        birthday: getValue('birthday'),
                        primaryParentName: getValue('primaryParentName'),
                        primaryParentPhone: getPhoneValue('primaryParentPhone'),
                        primaryParentEmail: getValue('primaryParentEmail'),
                        primaryParentAddress: getValue('primaryParentAddress'),
                        secondParentName: getValue('secondParentName'),
                        secondParentPhone: getPhoneValue('secondParentPhone'),
                        secondParentEmail: getValue('secondParentEmail'),
                        alternateContactName: getValue('alternateContactName'),
                        alternateContactRelationship: getValue('alternateContactRelationship'),
                        alternateContactPhone: getPhoneValue('alternateContactPhone'),
                        primaryPhysician: getValue('primaryPhysician'),
                        primaryPhysicianPhone: getPhoneValue('primaryPhysicianPhone'),
                        medicalInsuranceCompany: getValue('medicalInsuranceCompany'),
                        medicalInsuranceAccountNumber: getValue('medicalInsuranceAccountNumber'),
                        allergiesOrMedicalNeeds: getValue('allergiesOrMedicalNeeds'),
                        // Default values for fields not in CSV
                        racingGroup: 'Freshman',
                        fitness: String(Math.ceil(getFitnessScale() / 2)),
                        skills: String(Math.ceil(getSkillsScale() / 2)),
                        notes: ''
                    };
                    importedRiders.push(riderData);
                }

                // COMPLETELY REPLACE existing rider data
                data.riders = [];
                data.riders = importedRiders;
                
                // Force save to localStorage
                saveData();
                
                // Re-render
                renderRiders();

                alert(`Successfully imported ${importedRiders.length} riders from CSV file.\n\nAll existing rider data has been replaced.`);
            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error importing CSV file: ' + (error.message || 'Unknown error'));
            }
        }
        
        // Process coaches CSV import
        async function processCoachesCSVImport(coachesText) {
            try {
                // Parse CSV
                const coaches = parseCSV(coachesText);
                if (coaches.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Get header mapping
                const headers = coaches[0];
                const headerMap = getCoachHeaderMap(headers);

                // Import coaches
                const importedCoaches = [];
                for (let i = 1; i < coaches.length; i++) { // Skip header row
                    const row = coaches[i];
                    if (!row || row.length === 0) continue; // Skip empty rows

                    // Get name fields using header map
                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 0;
                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 1;
                    const lastName = (row[lastNameIdx] || '').trim();
                    const firstName = (row[firstNameIdx] || '').trim();
                    if (!firstName && !lastName) continue;

                    const name = `${firstName} ${lastName}`.trim();

                    // Helper function to get value from CSV row using header map
                    const getValue = (fieldName) => {
                        const idx = headerMap[fieldName];
                        if (idx === undefined) {
                            // Debug: log missing header mapping for important fields
                            if (fieldName === 'coachingLicenseLevel') {
                                console.log('Warning: coachingLicenseLevel header not found in CSV. Available headers:', headers);
                                console.log('Normalized headers:', headers.map(h => normalizeHeaderName(h)));
                                console.log('Header map:', headerMap);
                            }
                            return '';
                        }
                        const rawValue = row[idx];
                        const value = (rawValue || '').trim();
                        // Debug for license level
                        if (fieldName === 'coachingLicenseLevel') {
                            console.log(`Coach: ${name}, Column index: ${idx}, Raw CSV value: "${rawValue}", Trimmed: "${value}"`);
                        }
                        return value;
                    };

                    // Helper function to get phone value
                    const getPhoneValue = (fieldName) => {
                        const val = getValue(fieldName);
                        return normalizePhoneNumber(val);
                    };

                    // Get license level - handle various formats
                    const licenseLevelRaw = getValue('coachingLicenseLevel');
                    if (!licenseLevelRaw) {
                        console.log(`No license level value found for coach: ${name} (header map has index: ${headerMap['coachingLicenseLevel']})`);
                    }
                    const licenseLevelNormalized = licenseLevelRaw.trim().toUpperCase();
                    let licenseLevel = 'N/A';
                    
                    // Check for just the number (1, 2, 3) or with "LEVEL" prefix, handle various formats
                    // First check for exact number matches
                    if (licenseLevelNormalized === '1' || licenseLevelNormalized === 'LEVEL 1' || licenseLevelNormalized === 'LEVEL1' || licenseLevelNormalized === 'L1') {
                        licenseLevel = '1';
                    } else if (licenseLevelNormalized === '2' || licenseLevelNormalized === 'LEVEL 2' || licenseLevelNormalized === 'LEVEL2' || licenseLevelNormalized === 'L2') {
                        licenseLevel = '2';
                    } else if (licenseLevelNormalized === '3' || licenseLevelNormalized === 'LEVEL 3' || licenseLevelNormalized === 'LEVEL3' || licenseLevelNormalized === 'L3') {
                        licenseLevel = '3';
                    } else if (licenseLevelNormalized === 'N/A' || licenseLevelNormalized === 'NA' || licenseLevelNormalized === '' || licenseLevelNormalized === 'NULL' || licenseLevelNormalized === 'NONE') {
                        licenseLevel = 'N/A';
                    } else {
                        // Try to extract number from the string (e.g., "Level 1", "1", etc.)
                        const numberMatch = licenseLevelNormalized.match(/\b([123])\b/);
                        if (numberMatch) {
                            licenseLevel = numberMatch[1];
                            console.log(`Extracted license level "${licenseLevel}" from "${licenseLevelNormalized}" (raw: "${licenseLevelRaw}") for coach: ${name}`);
                        } else {
                            // Debug: log unexpected values
                            console.log('Unexpected license level value:', licenseLevelNormalized, '(raw:', licenseLevelRaw, ') for coach:', name);
                        }
                    }

                    // Get gender
                    const genderRaw = getValue('gender').toUpperCase();
                    let gender = '';
                    if (genderRaw === 'M' || genderRaw === 'MALE') gender = 'M';
                    else if (genderRaw === 'F' || genderRaw === 'FEMALE') gender = 'F';
                    else if (genderRaw === 'NB' || genderRaw === 'NONBINARY') gender = 'NB';

                    // Determine default photo based on gender
                    let defaultPhoto = '';
                    if (!gender) {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    } else if (gender === 'M') {
                        defaultPhoto = 'assets/male_default.png';
                    } else if (gender === 'F') {
                        defaultPhoto = 'assets/female_default.png';
                    } else if (gender === 'NB') {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    }

                    const coachData = {
                        id: Date.now() + Math.floor(Math.random() * 1000) + i * 10000,
                        name: name,
                        firstName,
                        lastName,
                        photo: defaultPhoto,
                        phone: getPhoneValue('phone'),
                        email: getValue('email'),
                        coachingLicenseLevel: licenseLevel,
                        workPhone: getPhoneValue('workPhone'),
                        homePhone: getPhoneValue('homePhone'),
                        gender: gender,
                        registered: getValue('registered'),
                        paid: getValue('paid'),
                        backgroundCheck: getValue('backgroundCheck'),
                        level3ExamCompleted: getValue('level3ExamCompleted'),
                        pduCeuUnits: getValue('pduCeuUnits'),
                        fieldWorkHours: getValue('fieldWorkHours'),
                        firstAidTypeExpires: getValue('firstAidTypeExpires'),
                        cprExpires: getValue('cprExpires'),
                        concussionTrainingCompleted: getValue('concussionTrainingCompleted'),
                        nicaPhilosophyCompleted: getValue('nicaPhilosophyCompleted'),
                        athleteAbuseAwarenessCompleted: getValue('athleteAbuseAwarenessCompleted'),
                        licenseLevel1Completed: getValue('licenseLevel1Completed'),
                        licenseLevel2Completed: getValue('licenseLevel2Completed'),
                        licenseLevel3Completed: getValue('licenseLevel3Completed'),
                        otbSkills101ClassroomCompleted: getValue('otbSkills101ClassroomCompleted'),
                        otbSkills101OutdoorCompleted: getValue('otbSkills101OutdoorCompleted'),
                        nicaLeaderSummitCompleted: getValue('nicaLeaderSummitCompleted'),
                        // Default values for fields not in CSV
                        fitness: String(Math.ceil(getFitnessScale() / 2)),
                        skills: String(Math.ceil(getSkillsScale() / 2)),
                        notes: ''
                    };
                    importedCoaches.push(coachData);
                }

                // COMPLETELY REPLACE existing coach data
                data.coaches = [];
                data.coaches = importedCoaches;
                
                // Force save to localStorage
                saveData();
                
                // Re-render
                renderCoaches();

                alert(`Successfully imported ${importedCoaches.length} coaches from CSV file.\n\nAll existing coach data has been replaced.`);
            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error importing CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        function parseCSV(text) {
            const lines = [];
            let currentLine = [];
            let currentField = '';
            let inQuotes = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = text[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        currentField += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    currentLine.push(currentField);
                    currentField = '';
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (char === '\r' && nextChar === '\n') {
                        i++; // Skip \n after \r
                    }
                    currentLine.push(currentField);
                    lines.push(currentLine);
                    currentLine = [];
                    currentField = '';
                } else {
                    currentField += char;
                }
            }

            // Add last field and line
            if (currentField || currentLine.length > 0) {
                currentLine.push(currentField);
                lines.push(currentLine);
            }

            return lines;
        }

        // Helper function to normalize CSV header names for matching
        function normalizeHeaderName(header) {
            return header.trim().toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\s+/g, '');
        }

        // Map CSV headers to rider field names
        function getRiderHeaderMap(headers) {
            const map = {};
            headers.forEach((header, index) => {
                const normalized = normalizeHeaderName(header);
                // Map common variations
                if (normalized.includes('firstname') || normalized === 'firstname') {
                    map['firstName'] = index;
                } else if (normalized.includes('lastname') || normalized === 'lastname') {
                    map['lastName'] = index;
                } else if (normalized.includes('nickname') || normalized.includes('preferredname') || normalized.includes('goby')) {
                    map['nickname'] = index;
                } else if (normalized.includes('rideremail') || (normalized.includes('email') && !normalized.includes('parent'))) {
                    map['email'] = index;
                } else if (normalized.includes('ridercell') || normalized.includes('cellnumber') || (normalized.includes('phone') && !normalized.includes('parent') && !normalized.includes('physician'))) {
                    map['phone'] = index;
                } else if (normalized.includes('rideraddress') || (normalized.includes('address') && !normalized.includes('parent'))) {
                    map['address'] = index;
                } else if (normalized.includes('ridergender') || (normalized.includes('gender') && !normalized.includes('parent'))) {
                    map['gender'] = index;
                } else if (normalized.includes('ridergrade') || (normalized.includes('grade') && !normalized.includes('parent'))) {
                    map['grade'] = index;
                } else if (normalized.includes('riderbirthday') || normalized.includes('birthday') || normalized.includes('dateofbirth') || normalized.includes('dob')) {
                    map['birthday'] = index;
                } else if (normalized.includes('headshot') || normalized.includes('photo') || normalized.includes('picture') || normalized.includes('avatar')) {
                    map['photo'] = index;
                } else if (normalized.includes('endurance') || normalized.includes('pace') || normalized.includes('fitness')) {
                    map['fitness'] = index;
                } else if (normalized.includes('climbing') || normalized.includes('climb')) {
                    map['climbing'] = index;
                } else if (normalized.includes('descending') || normalized.includes('descent') || normalized.includes('bikeskill') || normalized.includes('technicalskill')) {
                    map['skills'] = index;
                } else if (normalized.includes('medicalcondition') || normalized.includes('allerg') || normalized.includes('medicalneeds') || normalized.includes('healthcondition')) {
                    map['allergiesOrMedicalNeeds'] = index;
                } else if (normalized.includes('primaryparent') && normalized.includes('cell')) {
                    map['primaryParentPhone'] = index;
                } else if (normalized.includes('primaryparent') && normalized.includes('email')) {
                    map['primaryParentEmail'] = index;
                } else if (normalized.includes('primaryparent') && normalized.includes('address')) {
                    map['primaryParentAddress'] = index;
                } else if (normalized.includes('primaryparentguardian') || (normalized.includes('primaryparent') && normalized.includes('name'))) {
                    map['primaryParentName'] = index;
                } else if (normalized.includes('secondparent') && normalized.includes('name')) {
                    map['secondParentName'] = index;
                } else if (normalized.includes('secondparent') && normalized.includes('cell')) {
                    map['secondParentPhone'] = index;
                } else if (normalized.includes('secondparent') && normalized.includes('email')) {
                    map['secondParentEmail'] = index;
                } else if (normalized.includes('alternate') && normalized.includes('contact') && normalized.includes('name')) {
                    map['alternateContactName'] = index;
                } else if (normalized.includes('alternate') && normalized.includes('relationship')) {
                    map['alternateContactRelationship'] = index;
                } else if (normalized.includes('alternate') && normalized.includes('cell')) {
                    map['alternateContactPhone'] = index;
                } else if (normalized.includes('primaryphysician') && !normalized.includes('phone')) {
                    map['primaryPhysician'] = index;
                } else if (normalized.includes('primaryphysician') && normalized.includes('phone')) {
                    map['primaryPhysicianPhone'] = index;
                } else if (normalized.includes('medicalinsurance') && normalized.includes('company')) {
                    map['medicalInsuranceCompany'] = index;
                } else if (normalized.includes('medicalinsurance') && (normalized.includes('account') || normalized.includes('number'))) {
                    map['medicalInsuranceAccountNumber'] = index;
                } else if (normalized.includes('ridegroup') || normalized.includes('racinggroup')) {
                    map['racingGroup'] = index;
                } else if (normalized.includes('note') && !normalized.includes('parent')) {
                    map['notes'] = index;
                }
            });
            return map;
        }

        // Map CSV headers to coach field names
        function getCoachHeaderMap(headers) {
            const map = {};
            headers.forEach((header, index) => {
                const normalized = normalizeHeaderName(header);
                if (normalized.includes('lastname') || normalized === 'lastname') {
                    map['lastName'] = index;
                } else if (normalized.includes('firstname') || normalized === 'firstname') {
                    map['firstName'] = index;
                } else if (normalized.includes('nickname') || normalized.includes('preferredname') || normalized.includes('goby')) {
                    map['nickname'] = index;
                } else if (normalized.includes('headshot') || normalized.includes('photo') || normalized.includes('picture') || normalized.includes('avatar')) {
                    map['photo'] = index;
                } else if (normalized.includes('endurance') || normalized.includes('pace') || normalized.includes('fitness')) {
                    map['fitness'] = index;
                } else if (normalized.includes('climbing') || normalized.includes('climb')) {
                    map['climbing'] = index;
                } else if (normalized.includes('descending') || normalized.includes('descent') || normalized.includes('bikeskill') || normalized.includes('technicalskill')) {
                    map['skills'] = index;
                } else if (normalized.includes('medicalcondition') || normalized.includes('allerg') || normalized.includes('medicalneeds') || normalized.includes('healthcondition')) {
                    map['allergiesOrMedicalNeeds'] = index;
                } else if (normalized.includes('leaderlevel') || (normalized.includes('leader') && normalized.includes('level')) ||
                          normalized.includes('coachinglicenselevel') || (normalized.includes('license') && normalized.includes('level') && !normalized.includes('completed'))) {
                    map['leaderLevel'] = index;
                } else if (normalized.includes('biketype') || normalized.includes('bikemanual') || (normalized.includes('manual') && normalized.includes('mtb'))) {
                    map['bikeManual'] = index;
                } else if (normalized.includes('electricmtb') || normalized.includes('ebike') || normalized.includes('electricbike')) {
                    map['bikeElectric'] = index;
                } else if (normalized.includes('primaryride') || normalized.includes('primarybike') || normalized.includes('bikeprimary')) {
                    map['bikePrimary'] = index;
                } else if (normalized.includes('email') && !normalized.includes('parent')) {
                    map['email'] = index;
                } else if (normalized.includes('cellphone') || (normalized.includes('phone') && !normalized.includes('work') && !normalized.includes('home') && !normalized.includes('physician'))) {
                    map['phone'] = index;
                } else if (normalized.includes('workphone')) {
                    map['workPhone'] = index;
                } else if (normalized.includes('homephone')) {
                    map['homePhone'] = index;
                } else if (normalized.includes('gender')) {
                    map['gender'] = index;
                } else if (normalized.includes('registered')) {
                    map['registered'] = index;
                } else if (normalized.includes('paid')) {
                    map['paid'] = index;
                } else if (normalized.includes('backgroundcheck')) {
                    map['backgroundCheck'] = index;
                } else if (normalized.includes('level3exam')) {
                    map['level3ExamCompleted'] = index;
                } else if (normalized.includes('pdu') || normalized.includes('ceu')) {
                    map['pduCeuUnits'] = index;
                } else if (normalized.includes('fieldwork')) {
                    map['fieldWorkHours'] = index;
                } else if (normalized.includes('firstaid')) {
                    map['firstAidTypeExpires'] = index;
                } else if (normalized.includes('cpr') && normalized.includes('expires')) {
                    map['cprExpires'] = index;
                } else if (normalized.includes('concussion')) {
                    map['concussionTrainingCompleted'] = index;
                } else if (normalized.includes('nicaphilosophy') || normalized.includes('safetyrisk')) {
                    map['nicaPhilosophyCompleted'] = index;
                } else if (normalized.includes('athleteabuse')) {
                    map['athleteAbuseAwarenessCompleted'] = index;
                } else if (normalized.includes('licenselevel1')) {
                    map['licenseLevel1Completed'] = index;
                } else if (normalized.includes('licenselevel2')) {
                    map['licenseLevel2Completed'] = index;
                } else if (normalized.includes('licenselevel3')) {
                    map['licenseLevel3Completed'] = index;
                } else if (normalized.includes('otbskills101classroom')) {
                    map['otbSkills101ClassroomCompleted'] = index;
                } else if (normalized.includes('otbskills101outdoor') || normalized.includes('otbskills101training')) {
                    map['otbSkills101OutdoorCompleted'] = index;
                } else if (normalized.includes('nicaleadersummit')) {
                    map['nicaLeaderSummitCompleted'] = index;
                } else if (normalized.includes('note') && !normalized.includes('parent')) {
                    map['notes'] = index;
                }
            });
            return map;
        }

        // Define all possible rider fields
        // Required fields always import (defaulted if no CSV header mapped)
        // Optional fields can be toggled on/off during mapping
        const RIDER_FIELDS = [
            // --- Required fields ---
            { key: 'name', label: 'Name (Full)', required: true, section: 'required' },
            { key: 'firstName', label: 'First Name', required: true, section: 'required' },
            { key: 'lastName', label: 'Last Name', required: true, section: 'required' },
            { key: 'nickname', label: 'Nickname', required: true, section: 'required', defaultValue: '' },
            { key: 'phone', label: 'Phone Number', required: true, section: 'required', defaultValue: '' },
            { key: 'photo', label: 'Headshot', required: true, section: 'required', defaultValue: '' },
            { key: 'fitness', label: 'Skills: Endurance', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'climbing', label: 'Skills: Climbing', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'skills', label: 'Skills: Descending', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'allergiesOrMedicalNeeds', label: 'Medical Conditions', required: true, section: 'required', defaultValue: '' },
            // --- Optional fields ---
            { key: 'email', label: 'Email', required: false, section: 'optional' },
            { key: 'address', label: 'Address', required: false, section: 'optional' },
            { key: 'gender', label: 'Gender', required: false, section: 'optional' },
            { key: 'grade', label: 'Grade', required: false, section: 'optional' },
            { key: 'birthday', label: 'Birthday', required: false, section: 'optional' },
            { key: 'racingGroup', label: 'Ride Group', required: false, section: 'optional' },
            { key: 'notes', label: 'Notes', required: false, section: 'optional' },
            { key: 'primaryParentName', label: 'Primary Parent Name', required: false, section: 'optional' },
            { key: 'primaryParentPhone', label: 'Primary Parent Phone', required: false, section: 'optional' },
            { key: 'primaryParentEmail', label: 'Primary Parent Email', required: false, section: 'optional' },
            { key: 'primaryParentAddress', label: 'Primary Parent Address', required: false, section: 'optional' },
            { key: 'secondParentName', label: 'Second Parent Name', required: false, section: 'optional' },
            { key: 'secondParentPhone', label: 'Second Parent Phone', required: false, section: 'optional' },
            { key: 'secondParentEmail', label: 'Second Parent Email', required: false, section: 'optional' },
            { key: 'alternateContactName', label: 'Alternate Contact Name', required: false, section: 'optional' },
            { key: 'alternateContactRelationship', label: 'Alternate Contact Relationship', required: false, section: 'optional' },
            { key: 'alternateContactPhone', label: 'Alternate Contact Phone', required: false, section: 'optional' },
            { key: 'primaryPhysician', label: 'Primary Physician', required: false, section: 'optional' },
            { key: 'primaryPhysicianPhone', label: 'Primary Physician Phone', required: false, section: 'optional' },
            { key: 'medicalInsuranceCompany', label: 'Medical Insurance Company', required: false, section: 'optional' },
            { key: 'medicalInsuranceAccountNumber', label: 'Medical Insurance Account Number', required: false, section: 'optional' }
        ];

        // Define all possible coach fields
        const COACH_FIELDS = [
            // --- Required fields ---
            { key: 'name', label: 'Name (Full)', required: true, section: 'required' },
            { key: 'firstName', label: 'First Name', required: true, section: 'required' },
            { key: 'lastName', label: 'Last Name', required: true, section: 'required' },
            { key: 'nickname', label: 'Nickname', required: true, section: 'required', defaultValue: '' },
            { key: 'phone', label: 'Phone Number', required: true, section: 'required', defaultValue: '' },
            { key: 'photo', label: 'Headshot', required: true, section: 'required', defaultValue: '' },
            { key: 'fitness', label: 'Skills: Endurance', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'climbing', label: 'Skills: Climbing', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'skills', label: 'Skills: Descending', required: true, section: 'required', defaultValue: 'middle' },
            { key: 'allergiesOrMedicalNeeds', label: 'Medical Conditions', required: true, section: 'required', defaultValue: '' },
            { key: 'leaderLevel', label: 'Leader Level', required: true, section: 'required', defaultValue: '1' },
            { key: 'bikeManual', label: 'Bike: Manual MTB', required: true, section: 'required', defaultValue: true },
            { key: 'bikeElectric', label: 'Bike: Electric MTB', required: true, section: 'required', defaultValue: false },
            { key: 'bikePrimary', label: 'Bike: Primary Ride', required: true, section: 'required', defaultValue: 'manual' },
            // --- Optional fields ---
            { key: 'email', label: 'Email', required: false, section: 'optional' },
            { key: 'workPhone', label: 'Work Phone', required: false, section: 'optional' },
            { key: 'homePhone', label: 'Home Phone', required: false, section: 'optional' },
            { key: 'gender', label: 'Gender', required: false, section: 'optional' },
            { key: 'notes', label: 'Notes', required: false, section: 'optional' },
            { key: 'coachingLicenseLevel', label: 'Coaching License Level', required: false, section: 'optional' },
            { key: 'registered', label: 'Registered', required: false, section: 'optional' },
            { key: 'paid', label: 'Paid', required: false, section: 'optional' },
            { key: 'backgroundCheck', label: 'Background Check', required: false, section: 'optional' },
            { key: 'level3ExamCompleted', label: 'Level 3 Exam Completed', required: false, section: 'optional' },
            { key: 'pduCeuUnits', label: 'PDU/CEU Units', required: false, section: 'optional' },
            { key: 'fieldWorkHours', label: 'Field Work Hours', required: false, section: 'optional' },
            { key: 'firstAidTypeExpires', label: 'First Aid Type/Expires', required: false, section: 'optional' },
            { key: 'cprExpires', label: 'CPR Expires', required: false, section: 'optional' },
            { key: 'concussionTrainingCompleted', label: 'Concussion Training Completed', required: false, section: 'optional' },
            { key: 'nicaPhilosophyCompleted', label: 'NICA Philosophy Completed', required: false, section: 'optional' },
            { key: 'athleteAbuseAwarenessCompleted', label: 'Athlete Abuse Awareness Completed', required: false, section: 'optional' },
            { key: 'licenseLevel1Completed', label: 'License Level 1 Completed', required: false, section: 'optional' },
            { key: 'licenseLevel2Completed', label: 'License Level 2 Completed', required: false, section: 'optional' },
            { key: 'licenseLevel3Completed', label: 'License Level 3 Completed', required: false, section: 'optional' },
            { key: 'otbSkills101ClassroomCompleted', label: 'OTB Skills 101 Classroom Completed', required: false, section: 'optional' },
            { key: 'otbSkills101OutdoorCompleted', label: 'OTB Skills 101 Outdoor Completed', required: false, section: 'optional' },
            { key: 'nicaLeaderSummitCompleted', label: 'NICA Leader Summit Completed', required: false, section: 'optional' }
        ];

        // Persist CSV field mapping to localStorage
        function saveCSVFieldMappingToStorage(type, mappingData) {
            try {
                const storageKey = `teamridepro_csv_mapping_${type}`;
                localStorage.setItem(storageKey, JSON.stringify(mappingData));
            } catch (e) {
                console.warn('Could not save CSV mapping to localStorage:', e);
            }
        }

        // Load CSV field mapping from localStorage
        function loadCSVFieldMappingFromStorage(type) {
            try {
                const storageKey = `teamridepro_csv_mapping_${type}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) return JSON.parse(stored);
            } catch (e) {
                console.warn('Could not load CSV mapping from localStorage:', e);
            }
            return null;
        }

        function validateCSVHeadersAgainstSavedMapping(csvHeaders, savedMapping) {
            if (!savedMapping || !savedMapping.csvHeaders) {
                return { isMatch: true, newHeaders: [], missingHeaders: [] };
            }
            const savedSet = new Set(savedMapping.csvHeaders.map(h => (h || '').trim().toLowerCase()));
            const currentSet = new Set(csvHeaders.map(h => (h || '').trim().toLowerCase()));
            const newHeaders = csvHeaders.filter(h => !savedSet.has((h || '').trim().toLowerCase()));
            const missingHeaders = savedMapping.csvHeaders.filter(h => !currentSet.has((h || '').trim().toLowerCase()));
            const isMatch = newHeaders.length === 0 && missingHeaders.length === 0;
            return { isMatch, newHeaders, missingHeaders };
        }

        function reopenMappingFromReview() {
            const ctx = window._csvMappingContext;
            if (!ctx) return;
            closeCSVReviewModal();
            const savedMapping = loadCSVFieldMappingFromStorage(ctx.type) || data.seasonSettings?.csvFieldMappings?.[ctx.type];
            const validation = validateCSVHeadersAgainstSavedMapping(ctx.csvHeaders, savedMapping);
            pendingCSVData = window._pendingCSVReviewData || pendingCSVData;
            pendingCSVType = ctx.type;
            pendingCSVHeaders = ctx.csvHeaders;
            openCSVFieldMappingModal(ctx.type, ctx.csvHeaders, false, validation.isMatch ? null : validation);
        }

        // Open CSV field mapping modal
        function openCSVFieldMappingModal(type, csvHeaders, isImport = false, warningInfo = null) {
            const modal = document.getElementById('csv-field-mapping-modal');
            const title = document.getElementById('csv-mapping-modal-title');
            const container = document.getElementById('csv-field-mapping-container');
            const optContainer = document.getElementById('csv-optional-fields-container');
            
            if (!modal || !container) return;

            // Stash context so reopenMappingFromReview can recall this
            window._csvMappingContext = { type, csvHeaders, isImport };
            
            // Set type
            pendingCSVType = type;
            if (isImport) {
                pendingCSVType = type + '_import';
            }
            
            // Update title
            const entity = type === 'riders' ? 'Riders' : 'Coaches';
            if (title) {
                const action = isImport ? 'Import' : 'Update';
                title.textContent = `Map CSV Fields - ${action} ${entity}`;
            }

            // Update apply button label
            const applyBtn = document.getElementById('csv-mapping-apply-btn');
            if (applyBtn) {
                applyBtn.textContent = isImport ? `Import ${entity}` : `Apply Mapping & Continue`;
            }

            // Show/hide header mismatch warning
            const warningEl = document.getElementById('csv-mapping-warning');
            if (warningEl) {
                if (warningInfo) {
                    let warnHtml = '<strong>Warning:</strong> The CSV columns differ from the previously saved mapping.';
                    if (warningInfo.newHeaders && warningInfo.newHeaders.length) {
                        warnHtml += `<br>New columns: <strong>${warningInfo.newHeaders.map(h => escapeHtml(h)).join(', ')}</strong>`;
                    }
                    if (warningInfo.missingHeaders && warningInfo.missingHeaders.length) {
                        warnHtml += `<br>Missing columns: <strong>${warningInfo.missingHeaders.map(h => escapeHtml(h)).join(', ')}</strong>`;
                    }
                    warnHtml += '<br>Please review and update your field mappings before proceeding.';
                    warningEl.innerHTML = warnHtml;
                    warningEl.style.display = 'block';
                } else {
                    warningEl.style.display = 'none';
                }
            }
            
            // Get field definitions
            const fields = type === 'riders' ? RIDER_FIELDS : COACH_FIELDS;
            
            // Get auto-mapped header map for initial suggestions
            const autoMap = type === 'riders' ? getRiderHeaderMap(csvHeaders) : getCoachHeaderMap(csvHeaders);
            
            // Load saved mapping
            const savedMapping = loadCSVFieldMappingFromStorage(type) || data.seasonSettings?.csvFieldMappings?.[type];
            const savedNameFormat = savedMapping?.nameFormat || 'split';
            
            // Set name format radio button
            const nameFormatRadio = document.getElementById(savedNameFormat === 'single' ? 'name-format-single' : 'name-format-split');
            const otherRadio = document.getElementById(savedNameFormat === 'single' ? 'name-format-split' : 'name-format-single');
            if (savedMapping && nameFormatRadio) {
                nameFormatRadio.checked = true;
                if (otherRadio) otherRadio.checked = false;
            }
            
            // Clear containers
            container.innerHTML = '';
            if (optContainer) optContainer.innerHTML = '';
            additionalFieldCounter = 0;
            
            // Handle name format
            const checkedNameFormatRadio = document.querySelector('input[name="name-format"]:checked');
            const nameFormat = checkedNameFormatRadio ? checkedNameFormatRadio.value : (savedNameFormat || 'split');
            
            // Separate required from optional fields
            const requiredFields = fields.filter(f => f.section === 'required');

            // --- Required Fields Section (2-column: Field | CSV Column) ---
            const reqWrapper = document.createElement('div');
            reqWrapper.style.marginBottom = '16px';
            
            const reqHeader = document.createElement('div');
            reqHeader.style.cssText = 'padding: 8px 12px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; background: #e3f2fd; color: #1565c0; border: 1px solid #bbdefb; border-bottom: none;';
            reqHeader.textContent = 'Required Fields';
            reqWrapper.appendChild(reqHeader);

            const reqTable = document.createElement('table');
            reqTable.className = 'csv-mapping-required-table';
            
            const reqThead = document.createElement('thead');
            reqThead.innerHTML = `
                <tr>
                    <th style="width: 220px;">TeamRide Pro Field</th>
                    <th>Use Values from CSV Column...</th>
                </tr>
            `;
            reqTable.appendChild(reqThead);
            
            const reqTbody = document.createElement('tbody');
            const mappedColumnIndices = new Set();
            
            requiredFields.forEach(field => {
                if (nameFormat === 'single' && (field.key === 'firstName' || field.key === 'lastName')) return;
                if (nameFormat === 'split' && field.key === 'name') return;
                
                const savedColumnIdx = savedMapping?.mapping?.[field.key];
                const savedUnmappedAction = savedMapping?.unmappedFieldActions?.[field.key];
                const autoMappedIdx = savedColumnIdx !== undefined ? savedColumnIdx : autoMap[field.key];
                const selectId = `field-${field.key}-column`;
                const checkboxId = `field-${field.key}-enabled`;
                
                const csvOptions = csvHeaders.map((header, idx) =>
                    `<option value="${idx}">${escapeHtml(header || 'Column ' + (idx + 1))}</option>`
                ).join('');
                
                const noDataOptions = isImport
                    ? `<option value="keep">No CSV data \u2013 Leave Blank or use Default Values</option>`
                    : `<option value="keep">Not in CSV data \u2013 Keep Existing Data</option>
                            <option value="clear">Not in CSV data \u2013 Clear Existing Data</option>`;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(field.label)}</td>
                    <td>
                        <input type="checkbox" id="${checkboxId}" checked disabled style="display:none;">
                        <select id="${selectId}" onchange="handleRequiredFieldSelectChange(this, '${escapeHtml(field.label)}')">
                            ${noDataOptions}
                            ${csvOptions}
                        </select>
                    </td>
                `;
                reqTbody.appendChild(row);
                
                setTimeout(() => {
                    const select = document.getElementById(selectId);
                    if (select) {
                        if (savedUnmappedAction === 'clear') {
                            select.value = 'clear';
                        } else if (savedColumnIdx !== undefined && savedColumnIdx !== null) {
                            select.value = String(savedColumnIdx);
                        } else if (savedUnmappedAction === 'keep') {
                            select.value = 'keep';
                        } else if (autoMappedIdx !== undefined && autoMappedIdx !== null) {
                            select.value = String(autoMappedIdx);
                        }
                        const v = select.value;
                        if (v !== '' && v !== 'keep' && v !== 'clear' && !isNaN(parseInt(v, 10))) {
                            mappedColumnIndices.add(parseInt(v, 10));
                        }
                    }
                }, 10);
            });
            
            reqTable.appendChild(reqTbody);
            reqWrapper.appendChild(reqTable);
            container.appendChild(reqWrapper);

            // --- Optional Fields Section (CSV column checklist) ---
            if (optContainer) {
                const optHeader = document.createElement('div');
                optHeader.style.cssText = 'padding: 8px 12px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; background: #f5f5f5; color: #555; border: 1px solid #ddd; border-bottom: none;';
                optHeader.textContent = 'Other CSV Fields (select which CSV columns to import)';
                optContainer.appendChild(optHeader);

                const optListWrapper = document.createElement('div');
                optListWrapper.id = 'csv-optional-fields-list';
                optListWrapper.style.cssText = 'border: 1px solid #ddd; border-top: none;';

                // Column header row
                const colHeaderRow = document.createElement('div');
                colHeaderRow.className = 'csv-optional-field-row';
                colHeaderRow.style.cssText = 'background: #f9f9f9; font-weight: 600; font-size: 12px; border-bottom: 2px solid #ddd;';
                colHeaderRow.innerHTML = `
                    <span style="width:20px;"></span>
                    <span class="csv-col-name">CSV Column</span>
                    <span style="width:180px; flex-shrink:0; text-align:center;">Rename Field (optional)</span>
                `;
                optListWrapper.appendChild(colHeaderRow);

                // Load saved custom field names and additional fields
                const savedCustomNames = savedMapping?.customFieldNames || {};
                const savedAdditionalFields = savedMapping?.additionalFields || {};
                const savedEnabledFields = savedMapping?.enabledFields || {};
                const savedMappingMap = savedMapping?.mapping || {};
                const savedCsvHeaders = savedMapping?.csvHeaders || [];

                // Build reverse map: columnIndex -> fieldName for additional fields
                const savedAdditionalByIdx = {};
                Object.keys(savedAdditionalFields).forEach(fn => {
                    savedAdditionalByIdx[savedAdditionalFields[fn]] = fn;
                });

                // Build set of column indices previously enabled from saved mapping metadata
                const savedEnabledOptCols = new Set();
                Object.values(savedAdditionalFields).forEach(idx => {
                    if (idx !== null && idx !== undefined) savedEnabledOptCols.add(idx);
                });
                const optFieldKeys = new Set(fields.filter(f => f.section === 'optional').map(f => f.key));
                Object.keys(savedEnabledFields).forEach(key => {
                    if (savedEnabledFields[key] && optFieldKeys.has(key) && savedMappingMap[key] !== undefined && savedMappingMap[key] !== null) {
                        savedEnabledOptCols.add(savedMappingMap[key]);
                    }
                });

                // Also inspect actual rider/coach data to find fields that have values,
                // so checkboxes reflect reality even if saved mapping is outdated or absent.
                const currentAutoMap = type === 'riders' ? getRiderHeaderMap(csvHeaders) : getCoachHeaderMap(csvHeaders);
                const currentRoster = type === 'riders' ? (data.riders || []) : (data.coaches || []);
                const activeRoster = currentRoster.filter(r => !r.archived);
                const fieldsWithData = new Set();
                const optFieldList = fields.filter(f => f.section === 'optional');
                optFieldList.forEach(f => {
                    const hasData = activeRoster.some(rec => {
                        const val = rec[f.key];
                        return val !== undefined && val !== null && val !== '';
                    });
                    if (hasData) fieldsWithData.add(f.key);
                });
                // Map field keys with data back to CSV column indices via auto-map
                const colsWithLiveData = new Set();
                Object.keys(currentAutoMap).forEach(fieldKey => {
                    if (fieldsWithData.has(fieldKey)) {
                        colsWithLiveData.add(currentAutoMap[fieldKey]);
                    }
                });

                // Determine which CSV columns are truly new (not in previously saved headers)
                const prevHeadersLower = new Set(savedCsvHeaders.map(h => (h || '').trim().toLowerCase()));
                const isNewColumn = (header) => {
                    if (!savedMapping || !savedCsvHeaders.length) return false;
                    return !prevHeadersLower.has((header || '').trim().toLowerCase());
                };

                csvHeaders.forEach((header, idx) => {
                    const headerName = header || `Column ${idx + 1}`;
                    const fieldRow = document.createElement('div');
                    fieldRow.className = 'csv-optional-field-row';
                    fieldRow.setAttribute('data-col-idx', idx);

                    const csvColIsNew = isNewColumn(header);
                    if (csvColIsNew || (warningInfo && warningInfo.newHeaders && warningInfo.newHeaders.includes(header))) {
                        fieldRow.classList.add('highlighted');
                    }

                    const isMissing = warningInfo && warningInfo.missingHeaders && warningInfo.missingHeaders.includes(header);
                    if (isMissing) fieldRow.classList.add('missing-field');

                    // A column is "in use" if the saved mapping says so OR if actual data exists for the corresponding field
                    const wasPrevChecked = savedEnabledOptCols.has(idx) || colsWithLiveData.has(idx);
                    const shouldBeChecked = csvColIsNew ? false : wasPrevChecked;
                    const savedRename = savedCustomNames[headerName] || savedAdditionalByIdx[idx] || '';
                    const newLabel = csvColIsNew ? `<span style="color:#e65100; font-size:11px; font-weight:600; margin-right:4px;">[NEW]</span>` : '';

                    fieldRow.innerHTML = `
                        <input type="checkbox" class="csv-opt-col-check" data-col-idx="${idx}" data-was-prev="${wasPrevChecked ? '1' : '0'}" ${shouldBeChecked ? 'checked' : ''}>
                        <span class="csv-col-name">${newLabel}${escapeHtml(headerName)}</span>
                        <input type="text" class="csv-rename-input" data-col-idx="${idx}" placeholder="Rename Field (optional)" value="${escapeHtml(savedRename)}">
                    `;
                    optListWrapper.appendChild(fieldRow);
                });

                optContainer.appendChild(optListWrapper);

                // --- Custom User Fields Section ---
                const customHeader = document.createElement('div');
                customHeader.style.cssText = 'padding: 8px 12px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; background: #f5f5f5; color: #555; border: 1px solid #ddd; border-bottom: none; margin-top: 20px;';
                customHeader.textContent = 'Custom Fields (add your own fields not in CSV or TeamRide Pro)';
                optContainer.appendChild(customHeader);

                const customListWrapper = document.createElement('div');
                customListWrapper.id = 'csv-custom-fields-list';
                customListWrapper.style.cssText = 'border: 1px solid #ddd; border-top: none; padding: 8px 12px;';

                const savedUserCustomFields = savedMapping?.userCustomFields || [];
                savedUserCustomFields.forEach(fieldName => {
                    customListWrapper.appendChild(_createCustomFieldRow(fieldName));
                });

                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'btn-small secondary';
                addBtn.style.cssText = 'margin-top: 8px; font-size: 12px;';
                addBtn.textContent = '+ Add Custom Field';
                addBtn.onclick = () => {
                    const list = document.getElementById('csv-custom-fields-list');
                    if (list) list.insertBefore(_createCustomFieldRow(''), addBtn);
                };
                customListWrapper.appendChild(addBtn);
                optContainer.appendChild(customListWrapper);
            }

            // Grey out mapped columns after a tick
            setTimeout(() => { updateRequiredFieldMappedColumns(); }, 30);
            
            // Name format change handler
            const nameFormatRadios = document.querySelectorAll('input[name="name-format"]');
            nameFormatRadios.forEach(radio => {
                const newRadio = radio.cloneNode(true);
                radio.parentNode.replaceChild(newRadio, radio);
                newRadio.addEventListener('change', () => {
                    setTimeout(() => {
                        openCSVFieldMappingModal(type, csvHeaders, isImport, warningInfo);
                    }, 50);
                });
            });
            
            // Show modal
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
        }

        function handleRequiredFieldSelectChange(selectEl, fieldLabel) {
            if (selectEl.value === 'clear') {
                const ok = confirm(
                    `Warning: "${fieldLabel}" is set to "Clear Existing Data".\n\n` +
                    `This will erase any existing values for this field on all records when the CSV update is applied.\n\n` +
                    `Continue with this selection?`
                );
                if (!ok) {
                    selectEl.value = 'keep';
                }
            }
            updateRequiredFieldMappedColumns();
        }

        function updateRequiredFieldMappedColumns() {
            const mapped = new Set();
            document.querySelectorAll('#csv-field-mapping-container select').forEach(sel => {
                const v = sel.value;
                if (v !== '' && v !== 'keep' && v !== 'clear' && !isNaN(parseInt(v, 10))) {
                    mapped.add(parseInt(v, 10));
                }
            });
            document.querySelectorAll('#csv-optional-fields-list .csv-optional-field-row[data-col-idx]').forEach(row => {
                const idx = parseInt(row.getAttribute('data-col-idx'), 10);
                if (mapped.has(idx)) {
                    row.classList.add('greyed-out');
                    const cb = row.querySelector('.csv-opt-col-check');
                    if (cb) { cb.checked = false; cb.disabled = true; }
                } else {
                    row.classList.remove('greyed-out');
                    const cb = row.querySelector('.csv-opt-col-check');
                    if (cb) cb.disabled = false;
                }
            });
        }

        function closeCSVFieldMappingModal() {
            const modal = document.getElementById('csv-field-mapping-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            // Clear pending data
            pendingCSVData = null;
            pendingCSVType = null;
            pendingCSVHeaders = null;
            csvFieldMapping = null;
        }

        function _createCustomFieldRow(initialName) {
            const row = document.createElement('div');
            row.className = 'csv-custom-field-row';
            row.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 4px 0;';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'csv-custom-field-name';
            input.placeholder = 'Enter field name...';
            input.value = initialName || '';
            input.style.cssText = 'flex: 1; padding: 5px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;';
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-small secondary';
            removeBtn.textContent = 'Remove';
            removeBtn.style.cssText = 'padding: 4px 10px; font-size: 11px;';
            removeBtn.onclick = () => row.remove();
            row.appendChild(input);
            row.appendChild(removeBtn);
            return row;
        }

        function updateFieldMappingCheckbox(fieldKey) {
            const checkbox = document.getElementById(`field-${fieldKey}-enabled`);
            const select = document.getElementById(`field-${fieldKey}-column`);
            
            if (checkbox && select) {
                if (!checkbox.checked) {
                    // Unchecked - clear selection
                    select.value = '';
                }
                select.disabled = !checkbox.checked;
            }
        }

        function updateFieldMappingSelect(fieldKey) {
            // Validation can be added here if needed
        }

        // Add additional field mapping
        function addAdditionalFieldMapping() {
            const container = document.getElementById('additional-fields-list');
            if (!container || !pendingCSVHeaders) return;
            
            const fieldId = `additional-field-${additionalFieldCounter++}`;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.padding = '8px';
            row.style.background = 'white';
            row.style.border = '1px solid #ddd';
            row.style.borderRadius = '4px';
            
            const csvOptions = pendingCSVHeaders.map((header, idx) => 
                `<option value="${idx}">${escapeHtml(header || `Column ${idx + 1}`)}</option>`
            ).join('');
            
            row.innerHTML = `
                <input type="text" 
                       id="${fieldId}-name" 
                       placeholder="Field name (e.g., customField1)" 
                       style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"
                       onchange="updateAdditionalFieldName('${fieldId}')">
                <span style="color: #666;">→</span>
                <select id="${fieldId}-column" 
                        style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">-- Select CSV Column --</option>
                    ${csvOptions}
                </select>
                <button type="button" 
                        class="btn-small secondary" 
                        onclick="removeAdditionalFieldMapping('${fieldId}')"
                        style="padding: 6px 12px;">Remove</button>
            `;
            
            container.appendChild(row);
        }

        function removeAdditionalFieldMapping(fieldId) {
            const field = document.getElementById(`${fieldId}-name`);
            if (field && field.parentElement) {
                field.parentElement.remove();
            }
        }

        function updateAdditionalFieldName(fieldId) {
            // Validation can be added here if needed
        }

        // Apply field mapping and proceed with import
        async function applyCSVFieldMapping() {
            if (!pendingCSVData || !pendingCSVType || !pendingCSVHeaders) {
                alert('No CSV data to import.');
                return;
            }
            
            const nameFormat = document.querySelector('input[name="name-format"]:checked')?.value || 'split';
            const type = pendingCSVType.replace('_import', '');
            const fields = type === 'riders' ? RIDER_FIELDS : COACH_FIELDS;
            const requiredFields = fields.filter(f => f.section === 'required');
            const mapping = {};
            const enabledFields = {};
            const additionalFields = {};
            const customFieldNames = {};
            
            const unmappedFieldActions = {};

            // Process required fields from the new 2-column table
            requiredFields.forEach(field => {
                if (nameFormat === 'single' && (field.key === 'firstName' || field.key === 'lastName')) return;
                if (nameFormat === 'split' && field.key === 'name') return;
                
                const select = document.getElementById(`field-${field.key}-column`);
                if (select) {
                    const val = select.value;
                    if (val === 'keep' || val === 'clear') {
                        enabledFields[field.key] = true;
                        mapping[field.key] = null;
                        unmappedFieldActions[field.key] = val;
                    } else {
                        const columnIdx = val !== '' ? parseInt(val, 10) : null;
                        enabledFields[field.key] = true;
                        mapping[field.key] = columnIdx;
                    }
                }
            });
            
            // Build auto-map lookup: normalized header -> TeamRide Pro field key
            const optionalFields = fields.filter(f => f.section === 'optional');
            const autoMap = type === 'riders' ? getRiderHeaderMap(pendingCSVHeaders) : getCoachHeaderMap(pendingCSVHeaders);
            const autoMapByIdx = {};
            Object.keys(autoMap).forEach(key => { autoMapByIdx[autoMap[key]] = key; });

            // Process optional CSV columns from the checklist
            const optRows = document.querySelectorAll('#csv-optional-fields-list .csv-optional-field-row[data-col-idx]');
            optRows.forEach(row => {
                const cb = row.querySelector('.csv-opt-col-check');
                const renameInput = row.querySelector('.csv-rename-input');
                if (!cb || !cb.checked) return;
                
                const colIdx = parseInt(row.getAttribute('data-col-idx'), 10);
                const headerName = (pendingCSVHeaders[colIdx] || `Column ${colIdx + 1}`).trim();
                const renameTo = renameInput ? renameInput.value.trim() : '';

                // Check if this CSV column auto-maps to a known optional TeamRide Pro field
                const knownFieldKey = autoMapByIdx[colIdx];
                const knownOptField = knownFieldKey ? optionalFields.find(f => f.key === knownFieldKey) : null;

                if (knownOptField && !renameTo) {
                    enabledFields[knownOptField.key] = true;
                    mapping[knownOptField.key] = colIdx;
                } else {
                    const fieldName = renameTo || headerName;
                    additionalFields[fieldName] = colIdx;
                    if (renameTo) {
                        customFieldNames[headerName] = renameTo;
                    }
                }
            });
            
            // Process user-created custom fields
            const userCustomFields = [];
            document.querySelectorAll('#csv-custom-fields-list .csv-custom-field-row').forEach(row => {
                const input = row.querySelector('.csv-custom-field-name');
                const name = input ? input.value.trim() : '';
                if (name) {
                    userCustomFields.push(name);
                    if (additionalFields[name] === undefined) {
                        additionalFields[name] = null;
                    }
                }
            });

            // Ensure unchecked optional fields are marked as disabled
            optionalFields.forEach(field => {
                if (enabledFields[field.key] === undefined) {
                    enabledFields[field.key] = false;
                }
            });

            // Bridge leaderLevel → coachingLicenseLevel: the required field uses key
            // 'leaderLevel' but coach data objects use 'coachingLicenseLevel'
            if (enabledFields.leaderLevel !== undefined) {
                enabledFields.coachingLicenseLevel = enabledFields.leaderLevel;
                if (mapping.leaderLevel !== undefined) {
                    mapping.coachingLicenseLevel = mapping.leaderLevel;
                }
                if (unmappedFieldActions.leaderLevel !== undefined) {
                    unmappedFieldActions.coachingLicenseLevel = unmappedFieldActions.leaderLevel;
                }
            }

            // Validate name mapping
            if (nameFormat === 'single') {
                if (mapping['name'] === undefined) {
                    alert('Please map the Name field.');
                    return;
                }
            } else if (nameFormat === 'split') {
                if (mapping['firstName'] === undefined && mapping['lastName'] === undefined) {
                    alert('Please map at least First Name or Last Name.');
                    return;
                }
            }
            
            // Collect column indices already mapped to required fields
            const requiredMappedColIndices = new Set();
            requiredFields.forEach(field => {
                const select = document.getElementById(`field-${field.key}-column`);
                if (select) {
                    const v = select.value;
                    if (v !== '' && v !== 'keep' && v !== 'clear' && !isNaN(parseInt(v, 10))) {
                        requiredMappedColIndices.add(parseInt(v, 10));
                    }
                }
            });

            // Check for previously-imported fields that are now unchecked and NOT reassigned to a required field
            const purgeList = [];
            const purgeFieldKeys = [];
            const purgeAdditionalNames = [];
            const optRows2 = document.querySelectorAll('#csv-optional-fields-list .csv-optional-field-row[data-col-idx]');
            optRows2.forEach(row => {
                const cb = row.querySelector('.csv-opt-col-check');
                if (cb && !cb.checked && cb.dataset.wasPrev === '1') {
                    const colIdx = parseInt(row.getAttribute('data-col-idx'), 10);
                    if (!requiredMappedColIndices.has(colIdx)) {
                        const headerName = pendingCSVHeaders[colIdx] || `Column ${colIdx + 1}`;
                        purgeList.push(headerName);
                        // Determine the field key for this column
                        const knownKey = autoMapByIdx[colIdx];
                        if (knownKey) {
                            purgeFieldKeys.push(knownKey);
                        }
                        // Check if it was an additional/custom field
                        const savedMapping = loadCSVFieldMappingFromStorage(type) || data.seasonSettings?.csvFieldMappings?.[type];
                        if (savedMapping?.additionalFields) {
                            Object.keys(savedMapping.additionalFields).forEach(fn => {
                                if (savedMapping.additionalFields[fn] === colIdx) {
                                    purgeAdditionalNames.push(fn);
                                }
                            });
                        }
                    }
                }
            });
            if (purgeList.length > 0) {
                const list = purgeList.map(n => `  • ${n}`).join('\n');
                const ok = confirm(
                    `The following previously imported fields are now unchecked and will be removed from all rider/coach cards. Their data will be purged from the database:\n\n${list}\n\n` +
                    `You can restore this data later by re-importing from CSV.\n\nContinue?`
                );
                if (!ok) return;

                // Purge the field data from all existing records
                const records = type === 'riders' ? data.riders : data.coaches;
                if (Array.isArray(records)) {
                    records.forEach(record => {
                        purgeFieldKeys.forEach(key => {
                            if (record.hasOwnProperty(key)) record[key] = '';
                        });
                        purgeAdditionalNames.forEach(fn => {
                            if (record.hasOwnProperty(fn)) delete record[fn];
                        });
                    });
                    saveData();
                    if (type === 'riders' && typeof syncRidersToSupabase === 'function') {
                        syncRidersToSupabase();
                    } else if (type === 'coaches' && typeof syncCoachesToSupabase === 'function') {
                        syncCoachesToSupabase();
                    }
                }
            }

            const fieldMapping = {
                mapping,
                enabledFields,
                additionalFields,
                customFieldNames,
                nameFormat,
                unmappedFieldActions,
                userCustomFields
            };
            
            // Save mapping
            if (!data.seasonSettings) data.seasonSettings = {};
            if (!data.seasonSettings.csvFieldMappings) data.seasonSettings.csvFieldMappings = {};
            const mappingRecord = {
                mapping,
                enabledFields,
                additionalFields,
                customFieldNames,
                nameFormat,
                unmappedFieldActions,
                userCustomFields,
                csvHeaders: [...pendingCSVHeaders],
                lastUsed: new Date().toISOString()
            };
            data.seasonSettings.csvFieldMappings[type] = mappingRecord;
            
            saveData();
            saveCSVFieldMappingToStorage(type, mappingRecord);
            
            const isImport = pendingCSVType && pendingCSVType.includes('_import');
            const csvType = pendingCSVType ? pendingCSVType.replace('_import', '') : type;
            const csvData = pendingCSVData;
            
            closeCSVFieldMappingModal();
            
            if (isImport) {
                if (csvType === 'riders') {
                    await processRidersCSVImportWithMapping(csvData, fieldMapping);
                } else {
                    await processCoachesCSVImportWithMapping(csvData, fieldMapping);
                }
            } else {
                if (csvType === 'riders') {
                    await updateRidersFromCSVWithMapping(csvData, fieldMapping);
                } else {
                    await updateCoachesFromCSVWithMapping(csvData, fieldMapping);
                }
            }
        }

        // Helper function to get value from CSV row using custom mapping
        function getValueFromMapping(row, fieldName, mapping) {
            const idx = mapping[fieldName];
            // If mapping is null, it means "None" was selected - return empty string
            if (idx === null) return '';
            // If mapping is undefined, field wasn't mapped - return empty string
            if (idx === undefined) return '';
            // Otherwise, get value from CSV column
            return (row[idx] || '').trim();
        }

        // Process riders CSV import with custom mapping
        async function processRidersCSVImportWithMapping(ridersText, fieldMapping) {
            try {
                if (!fieldMapping) {
                    alert('No field mapping found. Please try again.');
                    return;
                }

                const nameFormat = fieldMapping.nameFormat || 'split';
                const additionalFields = fieldMapping.additionalFields || {};
                const mapping = fieldMapping.mapping;
                const enabledFields = fieldMapping.enabledFields;
                
                // Parse CSV
                const riders = parseCSV(ridersText);
                if (riders.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Import riders
                const importedRiders = [];
                for (let i = 1; i < riders.length; i++) {
                    const row = riders[i];
                    if (!row || row.length === 0) continue;

                    // Get name fields based on format
                    let name = '';
                    let firstName = '';
                    let lastName = '';
                    
                    if (nameFormat === 'single') {
                        name = getValueFromMapping(row, 'name', mapping);
                        if (!name) continue;
                        // Try to split name into first/last for compatibility
                        const nameParts = name.trim().split(/\s+/);
                        if (nameParts.length > 1) {
                            lastName = nameParts.pop() || '';
                            firstName = nameParts.join(' ') || '';
                        } else {
                            firstName = name;
                        }
                    } else {
                        firstName = getValueFromMapping(row, 'firstName', mapping);
                        lastName = getValueFromMapping(row, 'lastName', mapping);
                        if (!firstName && !lastName) continue;
                        name = `${firstName} ${lastName}`.trim();
                    }

                    // Get gender and determine default photo
                    const gender = normalizeGenderValue(getValueFromMapping(row, 'gender', mapping));

                    let defaultPhoto = '';
                    if (!gender) {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    } else if (gender === 'M') {
                        defaultPhoto = 'assets/male_default.png';
                    } else if (gender === 'F') {
                        defaultPhoto = 'assets/female_default.png';
                    } else if (gender === 'NB') {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    }

                    // Build rider object using mapping
                    // Helper to get field value - use mapping if field is enabled OR if it has a mapping (for backwards compatibility)
                    const getFieldValue = (fieldKey, defaultValue = '', transform = null) => {
                        const hasMapping = mapping[fieldKey] !== undefined && mapping[fieldKey] !== null;
                        const isEnabled = enabledFields[fieldKey];
                        if (isEnabled || hasMapping) {
                            const value = getValueFromMapping(row, fieldKey, mapping);
                            return transform ? transform(value) : (value || defaultValue);
                        }
                        return defaultValue;
                    };
                    
                    const riderData = {
                        id: Date.now() + Math.floor(Math.random() * 1000) + importedRiders.length * 1000,
                        name: name,
                        firstName: firstName,
                        lastName: lastName,
                        photo: getFieldValue('photo', defaultPhoto),
                        email: getFieldValue('email', ''),
                        phone: getFieldValue('phone', '', normalizePhoneNumber),
                        address: getFieldValue('address', ''),
                        gender: enabledFields.gender ? gender : '',
                        grade: getFieldValue('grade', '', normalizeGradeValue),
                        birthday: getFieldValue('birthday', ''),
                        primaryParentName: getFieldValue('primaryParentName', ''),
                        primaryParentPhone: getFieldValue('primaryParentPhone', '', normalizePhoneNumber),
                        primaryParentEmail: getFieldValue('primaryParentEmail', ''),
                        primaryParentAddress: getFieldValue('primaryParentAddress', ''),
                        secondParentName: getFieldValue('secondParentName', ''),
                        secondParentPhone: getFieldValue('secondParentPhone', '', normalizePhoneNumber),
                        secondParentEmail: getFieldValue('secondParentEmail', ''),
                        alternateContactName: getFieldValue('alternateContactName', ''),
                        alternateContactRelationship: getFieldValue('alternateContactRelationship', ''),
                        alternateContactPhone: getFieldValue('alternateContactPhone', '', normalizePhoneNumber),
                        primaryPhysician: getFieldValue('primaryPhysician', ''),
                        primaryPhysicianPhone: getFieldValue('primaryPhysicianPhone', '', normalizePhoneNumber),
                        medicalInsuranceCompany: getFieldValue('medicalInsuranceCompany', ''),
                        medicalInsuranceAccountNumber: getFieldValue('medicalInsuranceAccountNumber', ''),
                        allergiesOrMedicalNeeds: getFieldValue('allergiesOrMedicalNeeds', ''),
                        fitness: getFieldValue('fitness', String(Math.ceil(getFitnessScale() / 2))),
                        skills: getFieldValue('skills', String(Math.ceil(getSkillsScale() / 2))),
                        racingGroup: getFieldValue('racingGroup', 'Freshman'),
                        notes: getFieldValue('notes', '')
                    };
                    
                    // Add additional fields
                    Object.keys(additionalFields).forEach(fieldName => {
                        const columnIdx = additionalFields[fieldName];
                        if (columnIdx !== null && columnIdx !== undefined) {
                            riderData[fieldName] = (row[columnIdx] || '').trim();
                        } else {
                            riderData[fieldName] = '';
                        }
                    });
                    
                    importedRiders.push(riderData);
                }

                // COMPLETELY REPLACE existing rider data
                data.riders = [];
                data.riders = importedRiders;
                
                // Update name format in season settings if changed
                if (nameFormat && nameFormat !== (data.seasonSettings?.nameFormat || 'split')) {
                    if (!data.seasonSettings) data.seasonSettings = {};
                    data.seasonSettings.nameFormat = nameFormat;
                }
                
                // Force save to localStorage
                saveData();
                
                // Re-render
                renderRiders();

                alert(`Successfully imported ${importedRiders.length} riders from CSV file.\n\nAll existing rider data has been replaced.`);
            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error importing CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        // Process coaches CSV import with custom mapping
        async function processCoachesCSVImportWithMapping(coachesText, fieldMapping) {
            try {
                if (!fieldMapping) {
                    alert('No field mapping found. Please try again.');
                    return;
                }

                const nameFormat = fieldMapping.nameFormat || 'split';
                const additionalFields = fieldMapping.additionalFields || {};
                const mapping = fieldMapping.mapping;
                const enabledFields = fieldMapping.enabledFields;
                
                // Parse CSV
                const coaches = parseCSV(coachesText);
                if (coaches.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Import coaches
                const importedCoaches = [];
                for (let i = 1; i < coaches.length; i++) {
                    const row = coaches[i];
                    if (!row || row.length === 0) continue;

                    // Get name fields based on format
                    let name = '';
                    let firstName = '';
                    let lastName = '';
                    
                    if (nameFormat === 'single') {
                        name = getValueFromMapping(row, 'name', mapping);
                        if (!name) continue;
                        // Try to split name into first/last for compatibility
                        const nameParts = name.trim().split(/\s+/);
                        if (nameParts.length > 1) {
                            lastName = nameParts.pop() || '';
                            firstName = nameParts.join(' ') || '';
                        } else {
                            firstName = name;
                        }
                    } else {
                        firstName = getValueFromMapping(row, 'firstName', mapping);
                        lastName = getValueFromMapping(row, 'lastName', mapping);
                        if (!firstName && !lastName) continue;
                        name = `${firstName} ${lastName}`.trim();
                    }

                    // Get gender and determine default photo (same as riders)
                    const gender = enabledFields.gender ? normalizeGenderValue(getValueFromMapping(row, 'gender', mapping)) : '';

                    let defaultPhoto = '';
                    if (!gender) {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    } else if (gender === 'M') {
                        defaultPhoto = 'assets/male_default.png';
                    } else if (gender === 'F') {
                        defaultPhoto = 'assets/female_default.png';
                    } else if (gender === 'NB') {
                        defaultPhoto = 'assets/nonbinary_default.png';
                    }

                    // Build coach object using mapping
                    const coachData = {
                        id: Date.now() + Math.floor(Math.random() * 1000) + importedCoaches.length * 1000,
                        name: name,
                        firstName: firstName,
                        lastName: lastName,
                        photo: enabledFields.photo ? (getValueFromMapping(row, 'photo', mapping) || defaultPhoto) : defaultPhoto,
                        email: enabledFields.email ? getValueFromMapping(row, 'email', mapping) : '',
                        phone: enabledFields.phone ? normalizePhoneNumber(getValueFromMapping(row, 'phone', mapping)) : '',
                        workPhone: enabledFields.workPhone ? normalizePhoneNumber(getValueFromMapping(row, 'workPhone', mapping)) : '',
                        homePhone: enabledFields.homePhone ? normalizePhoneNumber(getValueFromMapping(row, 'homePhone', mapping)) : '',
                        gender: gender,
                        coachingLicenseLevel: enabledFields.coachingLicenseLevel ? (getValueFromMapping(row, 'coachingLicenseLevel', mapping) || '1') : '1',
                        registered: enabledFields.registered ? getValueFromMapping(row, 'registered', mapping) : '',
                        paid: enabledFields.paid ? getValueFromMapping(row, 'paid', mapping) : '',
                        backgroundCheck: enabledFields.backgroundCheck ? getValueFromMapping(row, 'backgroundCheck', mapping) : '',
                        level3ExamCompleted: enabledFields.level3ExamCompleted ? getValueFromMapping(row, 'level3ExamCompleted', mapping) : '',
                        pduCeuUnits: enabledFields.pduCeuUnits ? getValueFromMapping(row, 'pduCeuUnits', mapping) : '',
                        fieldWorkHours: enabledFields.fieldWorkHours ? getValueFromMapping(row, 'fieldWorkHours', mapping) : '',
                        firstAidTypeExpires: enabledFields.firstAidTypeExpires ? getValueFromMapping(row, 'firstAidTypeExpires', mapping) : '',
                        cprExpires: enabledFields.cprExpires ? getValueFromMapping(row, 'cprExpires', mapping) : '',
                        concussionTrainingCompleted: enabledFields.concussionTrainingCompleted ? getValueFromMapping(row, 'concussionTrainingCompleted', mapping) : '',
                        nicaPhilosophyCompleted: enabledFields.nicaPhilosophyCompleted ? getValueFromMapping(row, 'nicaPhilosophyCompleted', mapping) : '',
                        athleteAbuseAwarenessCompleted: enabledFields.athleteAbuseAwarenessCompleted ? getValueFromMapping(row, 'athleteAbuseAwarenessCompleted', mapping) : '',
                        licenseLevel1Completed: enabledFields.licenseLevel1Completed ? getValueFromMapping(row, 'licenseLevel1Completed', mapping) : '',
                        licenseLevel2Completed: enabledFields.licenseLevel2Completed ? getValueFromMapping(row, 'licenseLevel2Completed', mapping) : '',
                        licenseLevel3Completed: enabledFields.licenseLevel3Completed ? getValueFromMapping(row, 'licenseLevel3Completed', mapping) : '',
                        otbSkills101ClassroomCompleted: enabledFields.otbSkills101ClassroomCompleted ? getValueFromMapping(row, 'otbSkills101ClassroomCompleted', mapping) : '',
                        otbSkills101OutdoorCompleted: enabledFields.otbSkills101OutdoorCompleted ? getValueFromMapping(row, 'otbSkills101OutdoorCompleted', mapping) : '',
                        nicaLeaderSummitCompleted: enabledFields.nicaLeaderSummitCompleted ? getValueFromMapping(row, 'nicaLeaderSummitCompleted', mapping) : '',
                        fitness: enabledFields.fitness ? (getValueFromMapping(row, 'fitness', mapping) || String(Math.ceil(getFitnessScale() / 2))) : String(Math.ceil(getFitnessScale() / 2)),
                        climbing: enabledFields.climbing ? (getValueFromMapping(row, 'climbing', mapping) || String(Math.ceil(getClimbingScale() / 2))) : String(Math.ceil(getClimbingScale() / 2)),
                        skills: enabledFields.skills ? (getValueFromMapping(row, 'skills', mapping) || String(Math.ceil(getSkillsScale() / 2))) : String(Math.ceil(getSkillsScale() / 2)),
                        notes: enabledFields.notes ? getValueFromMapping(row, 'notes', mapping) : ''
                    };
                    
                    // Add additional fields
                    Object.keys(additionalFields).forEach(fieldName => {
                        const columnIdx = additionalFields[fieldName];
                        if (columnIdx !== null && columnIdx !== undefined) {
                            coachData[fieldName] = (row[columnIdx] || '').trim();
                        } else {
                            coachData[fieldName] = '';
                        }
                    });
                    
                    importedCoaches.push(coachData);
                }

                // COMPLETELY REPLACE existing coach data
                data.coaches = [];
                data.coaches = importedCoaches;
                
                // Update name format in season settings if changed
                if (nameFormat && nameFormat !== (data.seasonSettings?.nameFormat || 'split')) {
                    if (!data.seasonSettings) data.seasonSettings = {};
                    data.seasonSettings.nameFormat = nameFormat;
                }
                
                // Force save to localStorage
                saveData();
                
                // Re-render
                renderCoaches();

                alert(`Successfully imported ${importedCoaches.length} coaches from CSV file.\n\nAll existing coach data has been replaced.`);
            } catch (error) {
                console.error('CSV import error:', error);
                alert('Error importing CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        // ============ FUZZY MATCHING ============

        // Compute Levenshtein distance between two strings
        function levenshteinDistance(a, b) {
            if (!a || !b) return Math.max((a || '').length, (b || '').length);
            a = a.toLowerCase();
            b = b.toLowerCase();
            const m = a.length, n = b.length;
            const dp = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    dp[i][j] = a[i-1] === b[j-1]
                        ? dp[i-1][j-1]
                        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
                }
            }
            return dp[m][n];
        }

        // Compute name similarity (0-1, 1 = perfect match)
        function nameSimilarity(name1, name2) {
            if (!name1 && !name2) return 1;
            if (!name1 || !name2) return 0;
            const a = name1.toLowerCase().replace(/\s+/g, ' ').trim();
            const b = name2.toLowerCase().replace(/\s+/g, ' ').trim();
            if (a === b) return 1;
            const maxLen = Math.max(a.length, b.length);
            if (maxLen === 0) return 1;
            return 1 - (levenshteinDistance(a, b) / maxLen);
        }

        // Normalize phone for comparison (digits only)
        function normalizePhoneForComparison(phone) {
            if (!phone) return '';
            return String(phone).replace(/\D/g, '').slice(-10); // last 10 digits
        }

        // Find the best matching existing record for a CSV row
        // Returns { match: record, score: number, matchType: string } or null
        function findBestMatch(csvRecord, existingRecords) {
            const csvFirst = (csvRecord.firstName || '').toLowerCase().trim();
            const csvLast = (csvRecord.lastName || '').toLowerCase().trim();
            const csvFullName = `${csvFirst} ${csvLast}`.trim();
            const csvPhone = normalizePhoneForComparison(csvRecord.phone);
            const csvEmail = (csvRecord.email || '').toLowerCase().trim();

            let bestMatch = null;
            let bestScore = 0;
            let bestType = '';

            for (const record of existingRecords) {
                if (record.archived) continue; // Skip archived records for matching

                const recFirst = (record.firstName || '').toLowerCase().trim();
                const recLast = (record.lastName || '').toLowerCase().trim();
                const recFullName = record.name ? record.name.toLowerCase().trim() : `${recFirst} ${recLast}`.trim();
                const recPhone = normalizePhoneForComparison(record.phone);
                const recEmail = (record.email || '').toLowerCase().trim();

                let score = 0;
                let matchType = '';

                // 1. Exact name match (highest confidence)
                if (csvFirst && csvLast && recFirst === csvFirst && recLast === csvLast) {
                    score = 1.0;
                    matchType = 'exact-name';
                }
                // 2. Phone match (very high confidence if non-empty)
                else if (csvPhone && recPhone && csvPhone === recPhone) {
                    score = 0.95;
                    matchType = 'phone';
                    // Boost if name is also similar
                    const ns = nameSimilarity(csvFullName, recFullName);
                    if (ns > 0.5) score = Math.min(1.0, score + ns * 0.05);
                }
                // 3. Email match (very high confidence)
                else if (csvEmail && recEmail && csvEmail === recEmail) {
                    score = 0.93;
                    matchType = 'email';
                    const ns = nameSimilarity(csvFullName, recFullName);
                    if (ns > 0.5) score = Math.min(1.0, score + ns * 0.05);
                }
                // 4. Fuzzy name match
                else {
                    // Compare first+last separately for better accuracy
                    const firstSim = nameSimilarity(csvFirst, recFirst);
                    const lastSim = nameSimilarity(csvLast, recLast);
                    
                    // Weight last name more heavily (more unique identifier)
                    const combinedNameSim = (firstSim * 0.4) + (lastSim * 0.6);
                    
                    // Also check full name similarity (handles reordered names)
                    const fullNameSim = nameSimilarity(csvFullName, recFullName);
                    
                    const nameScore = Math.max(combinedNameSim, fullNameSim);
                    
                    if (nameScore >= 0.85) {
                        score = nameScore * 0.9; // Cap at 0.9 for fuzzy matches
                        matchType = 'fuzzy-name';
                        
                        // Boost score if phone or email also matches partially
                        if (csvPhone && recPhone && csvPhone === recPhone) {
                            score = Math.min(1.0, score + 0.1);
                            matchType = 'fuzzy-name+phone';
                        }
                        if (csvEmail && recEmail && csvEmail === recEmail) {
                            score = Math.min(1.0, score + 0.08);
                            matchType = 'fuzzy-name+email';
                        }
                    }
                    // 5. Check for swapped first/last names
                    else if (csvFirst && csvLast) {
                        const swapFirstSim = nameSimilarity(csvFirst, recLast);
                        const swapLastSim = nameSimilarity(csvLast, recFirst);
                        const swapScore = (swapFirstSim * 0.4) + (swapLastSim * 0.6);
                        if (swapScore >= 0.85) {
                            score = swapScore * 0.85;
                            matchType = 'swapped-name';
                        }
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = record;
                    bestType = matchType;
                }
            }

            // Only return match if score is above threshold
            if (bestScore >= 0.7) {
                return { match: bestMatch, score: bestScore, matchType: bestType };
            }
            return null;
        }

        // ============ CSV UPDATE WITH MAPPING ============

        // Update riders from CSV with custom mapping
        async function updateRidersFromCSVWithMapping(ridersText, fieldMapping) {
            try {
                if (!fieldMapping) {
                    alert('No field mapping found. Please try again.');
                    return;
                }

                const nameFormat = fieldMapping.nameFormat || 'split';
                const additionalFields = fieldMapping.additionalFields || {};
                const mapping = fieldMapping.mapping;
                const enabledFields = fieldMapping.enabledFields;
                const unmappedActions = fieldMapping.unmappedFieldActions || {};
                
                // Parse CSV
                const riders = parseCSV(ridersText);
                if (riders.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Helper function to get value from CSV row using custom mapping
                const getValue = (row, fieldName) => {
                    if (!enabledFields[fieldName]) return '';
                    const value = getValueFromMapping(row, fieldName, mapping);
                    if (fieldName === 'gender') {
                        return normalizeGenderValue(value);
                    }
                    return value;
                };

                const getPhoneValue = (row, fieldName) => {
                    const val = getValue(row, fieldName);
                    return normalizePhoneNumber(val);
                };

                // Build parsed CSV records for fuzzy matching
                const csvRecords = [];
                for (let i = 1; i < riders.length; i++) {
                    const row = riders[i];
                    if (!row || row.length === 0) continue;

                    let firstName = '';
                    let lastName = '';
                    
                    if (nameFormat === 'single') {
                        const name = getValue(row, 'name');
                        if (!name) continue;
                        const nameParts = name.trim().split(/\s+/);
                        if (nameParts.length > 1) {
                            lastName = nameParts.pop() || '';
                            firstName = nameParts.join(' ') || '';
                        } else {
                            firstName = name;
                        }
                    } else {
                        firstName = getValue(row, 'firstName');
                        lastName = getValue(row, 'lastName');
                        if (!firstName && !lastName) continue;
                    }

                    csvRecords.push({
                        row,
                        firstName,
                        lastName,
                        phone: getPhoneValue(row, 'phone'),
                        email: getValue(row, 'email'),
                        nickname: getValue(row, 'nickname')
                    });
                }

                // Fields that should NOT be updated from CSV (preserve existing values unless explicitly mapped)
                const preserveFields = ['id'];

                const originalRiders = Array.isArray(data.riders) ? [...data.riders] : [];
                const activeRiders = originalRiders.filter(r => !r.archived);
                
                // Use fuzzy matching to pair CSV records with existing riders
                const updatedRiders = [];
                const addedRiders = [];
                const matchedExistingIds = new Set();
                const matchedCsvIndices = new Set();
                let updatedCount = 0;
                let totalFieldsUpdated = 0;
                let archivedCount = 0;

                // First pass: find matches for each CSV record
                const matches = [];
                csvRecords.forEach((csvRec, csvIdx) => {
                    const result = findBestMatch(csvRec, activeRiders);
                    if (result && !matchedExistingIds.has(result.match.id)) {
                        matches.push({ csvIdx, csvRec, ...result });
                    }
                });

                // Sort by score descending to resolve conflicts (highest confidence first)
                matches.sort((a, b) => b.score - a.score);

                // Apply matches greedily
                for (const m of matches) {
                    if (matchedExistingIds.has(m.match.id) || matchedCsvIndices.has(m.csvIdx)) continue;
                    matchedExistingIds.add(m.match.id);
                    matchedCsvIndices.add(m.csvIdx);
                    
                    // Update matched rider from CSV
                    const rider = m.match;
                    const csvRow = m.csvRec.row;
                    const updatedRider = { ...rider };
                    updatedCount++;
                    
                    // Update name if it changed
                    if (m.csvRec.firstName) updatedRider.firstName = m.csvRec.firstName;
                    if (m.csvRec.lastName) updatedRider.lastName = m.csvRec.lastName;
                    updatedRider.name = `${updatedRider.firstName || ''} ${updatedRider.lastName || ''}`.trim();
                    
                    // Update enabled fields
                    Object.keys(enabledFields).forEach(fieldKey => {
                        if (enabledFields[fieldKey] && !preserveFields.includes(fieldKey) && 
                            fieldKey !== 'firstName' && fieldKey !== 'lastName' && fieldKey !== 'name') {

                            if (unmappedActions[fieldKey] === 'keep') return;
                            if (unmappedActions[fieldKey] === 'clear') {
                                const oldValue = String(rider[fieldKey] || '');
                                if (oldValue) {
                                    updatedRider[fieldKey] = '';
                                    totalFieldsUpdated++;
                                }
                                return;
                            }

                            const oldValue = String(rider[fieldKey] || '');
                            let newValue = '';
                            
                            if (fieldKey === 'phone' || fieldKey.includes('Phone')) {
                                newValue = getPhoneValue(csvRow, fieldKey);
                            } else if (fieldKey === 'grade') {
                                newValue = normalizeGradeValue(getValue(csvRow, fieldKey));
                            } else if (fieldKey === 'gender') {
                                newValue = normalizeGenderValue(getValue(csvRow, fieldKey));
                            } else {
                                newValue = getValue(csvRow, fieldKey);
                            }
                            
                            // Only update if CSV actually has a value for this field
                            if (newValue && oldValue !== newValue) {
                                updatedRider[fieldKey] = newValue;
                                totalFieldsUpdated++;
                            }
                        }
                    });
                    
                    // Additional fields
                    Object.keys(additionalFields).forEach(fieldName => {
                        const columnIdx = additionalFields[fieldName];
                        if (columnIdx !== null && columnIdx !== undefined) {
                            updatedRider[fieldName] = (csvRow[columnIdx] || '').trim();
                        } else if (!updatedRider.hasOwnProperty(fieldName)) {
                            updatedRider[fieldName] = '';
                        }
                    });
                    
                    updatedRiders.push(updatedRider);
                }

                // Keep existing riders that weren't matched (they'll be handled in review screen)
                // For now, add unmatched existing riders as-is (archive-not-delete handled in review)
                for (const rider of activeRiders) {
                    if (!matchedExistingIds.has(rider.id)) {
                        // Rider not in CSV - mark for potential archival (handled in review screen)
                        updatedRiders.push(rider);
                        archivedCount++;
                    }
                }

                // Always keep archived riders
                for (const rider of originalRiders) {
                    if (rider.archived) {
                        updatedRiders.push(rider);
                    }
                }

                // Add new riders from CSV (unmatched CSV records)
                let addedCount = 0;
                csvRecords.forEach((csvRec, csvIdx) => {
                    if (!matchedCsvIndices.has(csvIdx)) {
                        addedCount++;
                        const { firstName, lastName, row: csvRow } = csvRec;
                        const name = `${firstName} ${lastName}`.trim();

                        const gender = normalizeGenderValue(getValue(csvRow, 'gender'));
                        let defaultPhoto = 'assets/nonbinary_default.png';
                        if (gender === 'M') defaultPhoto = 'assets/male_default.png';
                        else if (gender === 'F') defaultPhoto = 'assets/female_default.png';

                        const gradeRaw = getValue(csvRow, 'grade');
                        const grade = normalizeGradeValue(gradeRaw);
                        const midFitness = String(Math.ceil(getFitnessScale() / 2));
                        const midSkills = String(Math.ceil(getSkillsScale() / 2));
                        const midClimbing = String(Math.ceil(getClimbingScale() / 2));

                        const newRider = {
                            id: Date.now() + Math.floor(Math.random() * 1000) + addedCount * 1000,
                            name,
                            firstName,
                            lastName,
                            nickname: getValue(csvRow, 'nickname') || '',
                            photo: enabledFields.photo ? (getValue(csvRow, 'photo') || defaultPhoto) : defaultPhoto,
                            email: getValue(csvRow, 'email'),
                            phone: getPhoneValue(csvRow, 'phone'),
                            address: getValue(csvRow, 'address'),
                            gender,
                            grade,
                            birthday: getValue(csvRow, 'birthday'),
                            primaryParentName: getValue(csvRow, 'primaryParentName'),
                            primaryParentPhone: getPhoneValue(csvRow, 'primaryParentPhone'),
                            primaryParentEmail: getValue(csvRow, 'primaryParentEmail'),
                            primaryParentAddress: getValue(csvRow, 'primaryParentAddress'),
                            secondParentName: getValue(csvRow, 'secondParentName'),
                            secondParentPhone: getPhoneValue(csvRow, 'secondParentPhone'),
                            secondParentEmail: getValue(csvRow, 'secondParentEmail'),
                            alternateContactName: getValue(csvRow, 'alternateContactName'),
                            alternateContactRelationship: getValue(csvRow, 'alternateContactRelationship'),
                            alternateContactPhone: getPhoneValue(csvRow, 'alternateContactPhone'),
                            primaryPhysician: getValue(csvRow, 'primaryPhysician'),
                            primaryPhysicianPhone: getPhoneValue(csvRow, 'primaryPhysicianPhone'),
                            medicalInsuranceCompany: getValue(csvRow, 'medicalInsuranceCompany'),
                            medicalInsuranceAccountNumber: getValue(csvRow, 'medicalInsuranceAccountNumber'),
                            allergiesOrMedicalNeeds: getValue(csvRow, 'allergiesOrMedicalNeeds'),
                            fitness: enabledFields.fitness ? (getValue(csvRow, 'fitness') || midFitness) : midFitness,
                            climbing: enabledFields.climbing ? (getValue(csvRow, 'climbing') || midClimbing) : midClimbing,
                            skills: enabledFields.skills ? (getValue(csvRow, 'skills') || midSkills) : midSkills,
                            racingGroup: enabledFields.racingGroup ? (getValue(csvRow, 'racingGroup') || 'Freshman') : 'Freshman',
                            notes: enabledFields.notes ? getValue(csvRow, 'notes') : ''
                        };
                        
                        // Additional fields
                        Object.keys(additionalFields).forEach(fieldName => {
                            const columnIdx = additionalFields[fieldName];
                            if (columnIdx !== null && columnIdx !== undefined) {
                                newRider[fieldName] = (csvRow[columnIdx] || '').trim();
                            } else {
                                newRider[fieldName] = '';
                            }
                        });
                        
                        updatedRiders.push(newRider);
                        addedRiders.push(newRider);
                    }
                });

                // Update name format in season settings if changed
                if (nameFormat && nameFormat !== (data.seasonSettings?.nameFormat || 'split')) {
                    if (!data.seasonSettings) data.seasonSettings = {};
                    data.seasonSettings.nameFormat = nameFormat;
                }

                // Store the diff data for the review screen instead of applying immediately
                window._pendingCSVUpdate = {
                    type: 'riders',
                    updatedRiders,
                    addedRiders,
                    originalRiders,
                    matchedExistingIds,
                    archivedCount,
                    addedCount,
                    updatedCount,
                    totalFieldsUpdated,
                    csvRecords,
                    matchedCsvIndices
                };

                // Open review screen
                openCSVReviewScreen(window._pendingCSVUpdate);

            } catch (error) {
                console.error('CSV update error:', error);
                alert('Error updating from CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        // Update coaches from CSV with custom mapping
        async function updateCoachesFromCSVWithMapping(coachesText, fieldMapping) {
            try {
                if (!fieldMapping) {
                    alert('No field mapping found. Please try again.');
                    return;
                }

                const nameFormat = fieldMapping.nameFormat || 'split';
                const additionalFields = fieldMapping.additionalFields || {};
                const mapping = fieldMapping.mapping;
                const enabledFields = fieldMapping.enabledFields;
                const unmappedActions = fieldMapping.unmappedFieldActions || {};
                
                // Parse CSV
                const coaches = parseCSV(coachesText);
                if (coaches.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Helper function to get value from CSV row using custom mapping
                const getValue = (row, fieldName) => {
                    if (!enabledFields[fieldName]) return '';
                    return getValueFromMapping(row, fieldName, mapping);
                };

                const getPhoneValue = (row, fieldName) => {
                    const val = getValue(row, fieldName);
                    return normalizePhoneNumber(val);
                };

                // Build parsed CSV records for fuzzy matching
                const csvRecords = [];
                for (let i = 1; i < coaches.length; i++) {
                    const row = coaches[i];
                    if (!row || row.length === 0) continue;

                    let firstName = '';
                    let lastName = '';
                    
                    if (nameFormat === 'single') {
                        const name = getValue(row, 'name');
                        if (!name) continue;
                        const nameParts = name.trim().split(/\s+/);
                        if (nameParts.length > 1) {
                            lastName = nameParts.pop() || '';
                            firstName = nameParts.join(' ') || '';
                        } else {
                            firstName = name;
                        }
                    } else {
                        firstName = getValue(row, 'firstName');
                        lastName = getValue(row, 'lastName');
                        if (!firstName && !lastName) continue;
                    }

                    csvRecords.push({
                        row,
                        firstName,
                        lastName,
                        phone: getPhoneValue(row, 'phone'),
                        email: getValue(row, 'email'),
                        nickname: getValue(row, 'nickname')
                    });
                }

                const preserveFields = ['id'];
                const originalCoaches = Array.isArray(data.coaches) ? [...data.coaches] : [];
                const activeCoaches = originalCoaches.filter(c => !c.archived);
                
                const updatedCoaches = [];
                const addedCoaches = [];
                const matchedExistingIds = new Set();
                const matchedCsvIndices = new Set();
                let updatedCount = 0;
                let totalFieldsUpdated = 0;
                let archivedCount = 0;

                // Fuzzy match CSV records to existing coaches
                const matches = [];
                csvRecords.forEach((csvRec, csvIdx) => {
                    const result = findBestMatch(csvRec, activeCoaches);
                    if (result && !matchedExistingIds.has(result.match.id)) {
                        matches.push({ csvIdx, csvRec, ...result });
                    }
                });
                matches.sort((a, b) => b.score - a.score);

                for (const m of matches) {
                    if (matchedExistingIds.has(m.match.id) || matchedCsvIndices.has(m.csvIdx)) continue;
                    matchedExistingIds.add(m.match.id);
                    matchedCsvIndices.add(m.csvIdx);
                    
                    const coach = m.match;
                    const csvRow = m.csvRec.row;
                    const updatedCoach = { ...coach };
                    updatedCount++;
                    
                    if (m.csvRec.firstName) updatedCoach.firstName = m.csvRec.firstName;
                    if (m.csvRec.lastName) updatedCoach.lastName = m.csvRec.lastName;
                    updatedCoach.name = `${updatedCoach.firstName || ''} ${updatedCoach.lastName || ''}`.trim();
                    
                    Object.keys(enabledFields).forEach(fieldKey => {
                        if (enabledFields[fieldKey] && !preserveFields.includes(fieldKey) && 
                            fieldKey !== 'firstName' && fieldKey !== 'lastName' && fieldKey !== 'name') {

                            if (unmappedActions[fieldKey] === 'keep') return;
                            if (unmappedActions[fieldKey] === 'clear') {
                                const oldValue = String(coach[fieldKey] || '');
                                if (oldValue) {
                                    updatedCoach[fieldKey] = '';
                                    totalFieldsUpdated++;
                                }
                                return;
                            }

                            const oldValue = String(coach[fieldKey] || '');
                            let newValue = '';
                            
                            if (fieldKey === 'phone' || fieldKey.includes('Phone')) {
                                newValue = getPhoneValue(csvRow, fieldKey);
                            } else if (fieldKey === 'gender') {
                                newValue = normalizeGenderValue(getValue(csvRow, fieldKey));
                            } else {
                                newValue = getValue(csvRow, fieldKey);
                            }
                            
                            if (newValue && oldValue !== newValue) {
                                updatedCoach[fieldKey] = newValue;
                                totalFieldsUpdated++;
                            }
                        }
                    });
                    
                    Object.keys(additionalFields).forEach(fieldName => {
                        const columnIdx = additionalFields[fieldName];
                        if (columnIdx !== null && columnIdx !== undefined) {
                            updatedCoach[fieldName] = (csvRow[columnIdx] || '').trim();
                        } else if (!updatedCoach.hasOwnProperty(fieldName)) {
                            updatedCoach[fieldName] = '';
                        }
                    });
                    
                    updatedCoaches.push(updatedCoach);
                }

                // Keep unmatched existing coaches (handled in review)
                for (const coach of activeCoaches) {
                    if (!matchedExistingIds.has(coach.id)) {
                        updatedCoaches.push(coach);
                        archivedCount++;
                    }
                }

                // Keep archived coaches
                for (const coach of originalCoaches) {
                    if (coach.archived) {
                        updatedCoaches.push(coach);
                    }
                }

                // Add new coaches from CSV
                let addedCount = 0;
                csvRecords.forEach((csvRec, csvIdx) => {
                    if (!matchedCsvIndices.has(csvIdx)) {
                        addedCount++;
                        const { firstName, lastName, row: csvRow } = csvRec;
                        const name = `${firstName} ${lastName}`.trim();

                        const gender = normalizeGenderValue(getValue(csvRow, 'gender'));
                        let defaultPhoto = 'assets/nonbinary_default.png';
                        if (gender === 'M') defaultPhoto = 'assets/male_default.png';
                        else if (gender === 'F') defaultPhoto = 'assets/female_default.png';

                        const midFitness = String(Math.ceil(getFitnessScale() / 2));
                        const midSkills = String(Math.ceil(getSkillsScale() / 2));
                        const midClimbing = String(Math.ceil(getClimbingScale() / 2));

                        const newCoach = {
                            id: Date.now() + Math.floor(Math.random() * 1000) + addedCount * 1000,
                            name,
                            firstName,
                            lastName,
                            nickname: getValue(csvRow, 'nickname') || '',
                            photo: enabledFields.photo ? (getValue(csvRow, 'photo') || defaultPhoto) : defaultPhoto,
                            email: getValue(csvRow, 'email'),
                            phone: getPhoneValue(csvRow, 'phone'),
                            workPhone: getPhoneValue(csvRow, 'workPhone'),
                            homePhone: getPhoneValue(csvRow, 'homePhone'),
                            gender,
                            coachingLicenseLevel: getValue(csvRow, 'coachingLicenseLevel') || '1',
                            leaderLevel: getValue(csvRow, 'leaderLevel') || '1',
                            bikeManual: true,
                            bikeElectric: false,
                            bikePrimary: 'manual',
                            registered: getValue(csvRow, 'registered'),
                            paid: getValue(csvRow, 'paid'),
                            backgroundCheck: getValue(csvRow, 'backgroundCheck'),
                            level3ExamCompleted: getValue(csvRow, 'level3ExamCompleted'),
                            pduCeuUnits: getValue(csvRow, 'pduCeuUnits'),
                            fieldWorkHours: getValue(csvRow, 'fieldWorkHours'),
                            firstAidTypeExpires: getValue(csvRow, 'firstAidTypeExpires'),
                            cprExpires: getValue(csvRow, 'cprExpires'),
                            concussionTrainingCompleted: getValue(csvRow, 'concussionTrainingCompleted'),
                            nicaPhilosophyCompleted: getValue(csvRow, 'nicaPhilosophyCompleted'),
                            athleteAbuseAwarenessCompleted: getValue(csvRow, 'athleteAbuseAwarenessCompleted'),
                            licenseLevel1Completed: getValue(csvRow, 'licenseLevel1Completed'),
                            licenseLevel2Completed: getValue(csvRow, 'licenseLevel2Completed'),
                            licenseLevel3Completed: getValue(csvRow, 'licenseLevel3Completed'),
                            otbSkills101ClassroomCompleted: getValue(csvRow, 'otbSkills101ClassroomCompleted'),
                            otbSkills101OutdoorCompleted: getValue(csvRow, 'otbSkills101OutdoorCompleted'),
                            nicaLeaderSummitCompleted: getValue(csvRow, 'nicaLeaderSummitCompleted'),
                            allergiesOrMedicalNeeds: getValue(csvRow, 'allergiesOrMedicalNeeds'),
                            fitness: enabledFields.fitness ? (getValue(csvRow, 'fitness') || midFitness) : midFitness,
                            climbing: enabledFields.climbing ? (getValue(csvRow, 'climbing') || midClimbing) : midClimbing,
                            skills: enabledFields.skills ? (getValue(csvRow, 'skills') || midSkills) : midSkills,
                            notes: enabledFields.notes ? getValue(csvRow, 'notes') : ''
                        };
                        
                        Object.keys(additionalFields).forEach(fieldName => {
                            const columnIdx = additionalFields[fieldName];
                            if (columnIdx !== null && columnIdx !== undefined) {
                                newCoach[fieldName] = (csvRow[columnIdx] || '').trim();
                            } else {
                                newCoach[fieldName] = '';
                            }
                        });
                        
                        updatedCoaches.push(newCoach);
                        addedCoaches.push(newCoach);
                    }
                });

                if (nameFormat && nameFormat !== (data.seasonSettings?.nameFormat || 'split')) {
                    if (!data.seasonSettings) data.seasonSettings = {};
                    data.seasonSettings.nameFormat = nameFormat;
                }

                // Store the diff data for the review screen
                window._pendingCSVUpdate = {
                    type: 'coaches',
                    updatedCoaches,
                    addedCoaches,
                    originalCoaches,
                    matchedExistingIds,
                    archivedCount,
                    addedCount,
                    updatedCount,
                    totalFieldsUpdated,
                    csvRecords,
                    matchedCsvIndices
                };

                openCSVReviewScreen(window._pendingCSVUpdate);

            } catch (error) {
                console.error('CSV update error:', error);
                alert('Error updating from CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        async function syncRidersToSupabase(originalRiders, updatedRiders, addedRiders) {
            if (isDeveloperMode) {
                console.log('Developer mode: skipping rider sync to Supabase.');
                return;
            }
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const debugEnabled = typeof DEBUG_LOGS !== 'undefined' && DEBUG_LOGS;
            if (!client || !currentUser || typeof updateRider === 'undefined' || typeof createRider === 'undefined') {
                if (debugEnabled) {
                    console.warn('CSV sync riders skipped - missing auth or database helpers', {
                        hasClient: !!client,
                        hasUser: !!currentUser,
                        hasUpdate: typeof updateRider !== 'undefined',
                        hasCreate: typeof createRider !== 'undefined'
                    });
                }
                return;
            }
            
            const updatedIdSet = new Set(updatedRiders.map(r => r.id));
            const addedIdSet = new Set(addedRiders.map(r => r.id));
            const removedIds = originalRiders
                .map(r => r.id)
                .filter(id => !updatedIdSet.has(id));
            
            if (debugEnabled) {
                console.log('CSV sync riders starting', {
                    total: updatedRiders.length,
                    added: addedRiders.length,
                    removed: removedIds.length
                });
            }
            
            for (const rider of updatedRiders) {
                const isNew = addedIdSet.has(rider.id);
                try {
                    if (isNew) {
                        const created = await createRider(rider);
                        const oldId = rider.id;
                        const index = data.riders.findIndex(r => r.id === oldId);
                        if (index !== -1) {
                            data.riders[index] = { ...rider, ...created };
                        } else {
                            data.riders.push({ ...rider, ...created });
                        }
                        
                        if (created?.id && created.id !== oldId) {
                            data.rides.forEach(ride => {
                                if (Array.isArray(ride.availableRiders)) {
                                    ride.availableRiders = ride.availableRiders.map(id => (id === oldId ? created.id : id));
                                }
                                if (Array.isArray(ride.groups)) {
                                    ride.groups.forEach(group => {
                                        if (Array.isArray(group.riders)) {
                                            group.riders = group.riders.map(id => (id === oldId ? created.id : id));
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        try {
                            const updated = await updateRider(rider.id, { ...rider, extra_data: rider });
                            const index = data.riders.findIndex(r => r.id === rider.id);
                            if (index !== -1) {
                                data.riders[index] = { ...rider, ...updated };
                            }
                        } catch (error) {
                            const missingRow = error?.code === 'PGRST116' || (error?.message || '').includes('No rows');
                            if (missingRow) {
                                const created = await createRider(rider);
                                const index = data.riders.findIndex(r => r.id === rider.id);
                                if (index !== -1) {
                                    data.riders[index] = { ...rider, ...created };
                                } else {
                                    data.riders.push({ ...rider, ...created });
                                }
                            } else {
                                throw error;
                            }
                        }
                    }
                } catch (error) {
                    showSaveError(
                        'Failed to Save Rider',
                        `An error occurred while saving ${rider.name || 'a rider'}.`,
                        error
                    );
                }
            }
            
            if (typeof deleteRiderFromDB === 'function') {
                for (const id of removedIds) {
                    try {
                        await deleteRiderFromDB(id);
                    } catch (error) {
                        showSaveError(
                            'Failed to Delete Rider',
                            `An error occurred while deleting rider ID ${id}.`,
                            error
                        );
                    }
                }
            }
        }

        async function syncCoachesToSupabase(originalCoaches, updatedCoaches, addedCoaches) {
            if (isDeveloperMode) {
                console.log('Developer mode: skipping coach sync to Supabase.');
                return;
            }
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            const debugEnabled = typeof DEBUG_LOGS !== 'undefined' && DEBUG_LOGS;
            if (!client || !currentUser || typeof updateCoach === 'undefined' || typeof createCoach === 'undefined') {
                if (debugEnabled) {
                    console.warn('CSV sync coaches skipped - missing auth or database helpers', {
                        hasClient: !!client,
                        hasUser: !!currentUser,
                        hasUpdate: typeof updateCoach !== 'undefined',
                        hasCreate: typeof createCoach !== 'undefined'
                    });
                }
                return;
            }
            
            const updatedIdSet = new Set(updatedCoaches.map(c => c.id));
            const addedIdSet = new Set(addedCoaches.map(c => c.id));
            const removedIds = originalCoaches
                .map(c => c.id)
                .filter(id => !updatedIdSet.has(id));
            
            if (debugEnabled) {
                console.log('CSV sync coaches starting', {
                    total: updatedCoaches.length,
                    added: addedCoaches.length,
                    removed: removedIds.length
                });
            }
            
            for (const coach of updatedCoaches) {
                const isNew = addedIdSet.has(coach.id);
                try {
                    if (isNew) {
                        const created = await createCoach(coach);
                        const oldId = coach.id;
                        const index = data.coaches.findIndex(c => c.id === oldId);
                        if (index !== -1) {
                            data.coaches[index] = { ...coach, ...created };
                        } else {
                            data.coaches.push({ ...coach, ...created });
                        }
                        
                        if (created?.id && created.id !== oldId) {
                            data.rides.forEach(ride => {
                                if (Array.isArray(ride.availableCoaches)) {
                                    ride.availableCoaches = ride.availableCoaches.map(id => (id === oldId ? created.id : id));
                                }
                                if (Array.isArray(ride.groups)) {
                                    ride.groups.forEach(group => {
                                        if (group.coaches) {
                                            if (group.coaches.leader === oldId) group.coaches.leader = created.id;
                                            if (group.coaches.sweep === oldId) group.coaches.sweep = created.id;
                                            if (group.coaches.roam === oldId) group.coaches.roam = created.id;
                                            if (Array.isArray(group.coaches.extraRoam)) {
                                                group.coaches.extraRoam = group.coaches.extraRoam.map(id => (id === oldId ? created.id : id));
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        try {
                            const updated = await updateCoach(coach.id, { ...coach, extra_data: coach });
                            const index = data.coaches.findIndex(c => c.id === coach.id);
                            if (index !== -1) {
                                data.coaches[index] = { ...coach, ...updated };
                            }
                        } catch (error) {
                            const missingRow = error?.code === 'PGRST116' || (error?.message || '').includes('No rows');
                            if (missingRow) {
                                const created = await createCoach(coach);
                                const index = data.coaches.findIndex(c => c.id === coach.id);
                                if (index !== -1) {
                                    data.coaches[index] = { ...coach, ...created };
                                } else {
                                    data.coaches.push({ ...coach, ...created });
                                }
                            } else {
                                throw error;
                            }
                        }
                    }
                } catch (error) {
                    showSaveError(
                        'Failed to Save Coach',
                        `An error occurred while saving ${coach.name || 'a coach'}.`,
                        error
                    );
                }
            }
            
            if (typeof deleteCoachFromDB === 'function') {
                for (const id of removedIds) {
                    try {
                        await deleteCoachFromDB(id);
                    } catch (error) {
                        showSaveError(
                            'Failed to Delete Coach',
                            `An error occurred while deleting coach ID ${id}.`,
                            error
                        );
                    }
                }
            }
        }

        // Update riders from CSV (matches by name, updates fields, adds new, archives missing)
        async function updateRidersFromCSV(ridersText) {
            try {
                // Parse CSV
                const riders = parseCSV(ridersText);
                if (riders.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Get header mapping
                const headers = riders[0];
                const headerMap = getRiderHeaderMap(headers);

                // Helper function to get value from CSV row using header map
                const getValue = (row, fieldName) => {
                    const idx = headerMap[fieldName];
                    return idx !== undefined ? (row[idx] || '').trim() : '';
                };

                const getPhoneValue = (row, fieldName) => {
                    const val = getValue(row, fieldName);
                    return normalizePhoneNumber(val);
                };

                // Create a map of CSV riders by name (firstName + lastName)
                const csvRidersMap = new Map();
                for (let i = 1; i < riders.length; i++) {
                    const row = riders[i];
                    if (!row || row.length === 0) continue;

                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 0;
                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 1;
                    let firstName = (row[firstNameIdx] || '').trim();
                    let lastName = (row[lastNameIdx] || '').trim();
                    
                    // Handle cases where name might be in a single field
                    if (!firstName && !lastName) continue;
                    if (!lastName && firstName) {
                        // Try to split if only one name field has data
                        const parts = firstName.split(/\s+/);
                        if (parts.length > 1) {
                            lastName = parts.pop();
                            firstName = parts.join(' ');
                        }
                    }
                    
                    // Normalize: lowercase and remove extra spaces
                    firstName = firstName.toLowerCase().replace(/\s+/g, ' ').trim();
                    lastName = lastName.toLowerCase().replace(/\s+/g, ' ').trim();
                    
                    const nameKey = `${firstName}|${lastName}`;
                    csvRidersMap.set(nameKey, row);
                }

                // Fields that should NOT be updated from CSV (preserve existing values)
                const preserveFields = ['fitness', 'skills', 'notes', 'racingGroup', 'photo', 'id'];

                // Helper function to extract firstName and lastName from rider object
                const getRiderNames = (rider) => {
                    let firstName = (rider.firstName || '').trim();
                    let lastName = (rider.lastName || '').trim();
                    
                    // If firstName/lastName don't exist, try to split the name field
                    if (!firstName && !lastName && rider.name) {
                        const parts = rider.name.trim().split(/\s+/);
                        if (parts.length > 1) {
                            lastName = parts.pop();
                            firstName = parts.join(' ');
                        } else {
                            firstName = rider.name.trim();
                        }
                    }
                    
                    // Normalize: lowercase and remove extra spaces
                    firstName = firstName.toLowerCase().replace(/\s+/g, ' ').trim();
                    lastName = lastName.toLowerCase().replace(/\s+/g, ' ').trim();
                    
                    return { firstName, lastName };
                };

                // Debug output
                const debugOutput = [];
                debugOutput.push('=== CSV UPDATE DEBUG ===');
                debugOutput.push(`CSV Riders in file: ${csvRidersMap.size}`);
                debugOutput.push(`Existing Riders in roster: ${data.riders.length}`);
                debugOutput.push('');
                
                // Debug: Show sample rider object structure
                if (data.riders.length > 0) {
                    const sampleRider = data.riders[0];
                    debugOutput.push('Sample Rider Object Fields:');
                    const riderFields = Object.keys(sampleRider).sort();
                    riderFields.forEach(field => {
                        const value = sampleRider[field];
                        const displayValue = (value === undefined || value === null) ? 'undefined/null' : (value === '' ? '""' : String(value).substring(0, 50));
                        debugOutput.push(`  ${field}: ${displayValue}`);
                    });
                    debugOutput.push('');
                }
                
                // Debug: Show header mapping
                debugOutput.push('Header Mapping:');
                Object.keys(headerMap).sort().forEach(fieldName => {
                    const colIndex = headerMap[fieldName];
                    const headerName = headers[colIndex] || 'UNKNOWN';
                    debugOutput.push(`  ${fieldName} -> Column ${colIndex}: "${headerName}"`);
                });
                debugOutput.push('');
                
                debugOutput.push('CSV Name Keys:');
                for (const [key, row] of csvRidersMap.entries()) {
                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 0;
                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 1;
                    const firstName = (row[firstNameIdx] || '').trim();
                    const lastName = (row[lastNameIdx] || '').trim();
                    debugOutput.push(`  "${key}" -> "${firstName} ${lastName}"`);
                }
                debugOutput.push('');
                debugOutput.push('Roster Name Keys:');
                for (const rider of data.riders) {
                    const { firstName, lastName } = getRiderNames(rider);
                    const nameKey = `${firstName}|${lastName}`;
                    debugOutput.push(`  "${nameKey}" -> "${rider.name || 'NO NAME'}" (ID: ${rider.id})`);
                }
                debugOutput.push('');

                // Update existing riders and track which ones were found in CSV
                const updatedRiders = [];
                const csvKeysFound = new Set();
                let removedCount = 0;
                let updatedCount = 0;
                let totalFieldsUpdated = 0;
                const changedFields = [];

                for (const rider of data.riders) {
                    const { firstName, lastName } = getRiderNames(rider);
                    const nameKey = `${firstName}|${lastName}`;
                    
                    // Debug: log if name key is empty or malformed
                    if (!firstName && !lastName) {
                        console.warn('Rider has no name:', rider);
                        continue; // Skip riders with no name
                    }
                    
                    if (csvRidersMap.has(nameKey)) {
                        // Rider found in CSV - update fields from CSV
                        csvKeysFound.add(nameKey);
                        updatedCount++;
                        const csvRow = csvRidersMap.get(nameKey);
                        
                        // Create updated rider object, preserving non-CSV fields
                        const updatedRider = { ...rider };
                        let fieldsChanged = 0;
                        const riderChangedFields = [];
                        
                        // Helper to compare and update field
                        const updateField = (fieldName, newVal) => {
                            // Get the actual current value from the original rider object
                            // Check if property exists using 'in' operator to handle undefined vs missing property
                            const oldVal = (fieldName in rider) ? rider[fieldName] : undefined;
                            // Normalize for comparison: treat undefined, null, and empty string as equivalent
                            const normalizedOld = (oldVal === undefined || oldVal === null || oldVal === '') ? '' : String(oldVal).trim();
                            const normalizedNew = (newVal === undefined || newVal === null || newVal === '') ? '' : String(newVal).trim();
                            
                            // Only update if values are actually different
                            if (normalizedOld !== normalizedNew) {
                                updatedRider[fieldName] = newVal;
                                fieldsChanged++;
                                riderChangedFields.push(`${fieldName}: "${normalizedOld}" -> "${normalizedNew}"`);
                                return true;
                            }
                            return false;
                        };
                        
                        // Update fields from CSV (only if they exist in CSV)
                        if (headerMap['phone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'phone');
                            updateField('phone', newVal);
                        }
                        if (headerMap['address'] !== undefined) {
                            const newVal = getValue(csvRow, 'address');
                            updateField('address', newVal);
                        }
                        if (headerMap['gender'] !== undefined) {
                            const genderRaw = getValue(csvRow, 'gender').toUpperCase();
                            let newGender = '';
                            if (genderRaw === 'M' || genderRaw === 'MALE') newGender = 'M';
                            else if (genderRaw === 'F' || genderRaw === 'FEMALE') newGender = 'F';
                            else if (genderRaw === 'NB' || genderRaw === 'NONBINARY') newGender = 'NB';
                            updateField('gender', newGender);
                        }
                        if (headerMap['grade'] !== undefined) {
                            const gradeRaw = getValue(csvRow, 'grade');
                            const newGrade = normalizeGradeValue(gradeRaw);
                            updateField('grade', newGrade);
                        }
                        if (headerMap['birthday'] !== undefined) {
                            const newVal = getValue(csvRow, 'birthday');
                            updateField('birthday', newVal);
                        }
                        if (headerMap['primaryParentName'] !== undefined) {
                            const newVal = getValue(csvRow, 'primaryParentName');
                            updateField('primaryParentName', newVal);
                        }
                        if (headerMap['primaryParentPhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'primaryParentPhone');
                            updateField('primaryParentPhone', newVal);
                        }
                        if (headerMap['primaryParentEmail'] !== undefined) {
                            const newVal = getValue(csvRow, 'primaryParentEmail');
                            updateField('primaryParentEmail', newVal);
                        }
                        if (headerMap['primaryParentAddress'] !== undefined) {
                            const newVal = getValue(csvRow, 'primaryParentAddress');
                            updateField('primaryParentAddress', newVal);
                        }
                        if (headerMap['secondParentName'] !== undefined) {
                            const newVal = getValue(csvRow, 'secondParentName');
                            updateField('secondParentName', newVal);
                        }
                        if (headerMap['secondParentPhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'secondParentPhone');
                            updateField('secondParentPhone', newVal);
                        }
                        if (headerMap['secondParentEmail'] !== undefined) {
                            const newVal = getValue(csvRow, 'secondParentEmail');
                            updateField('secondParentEmail', newVal);
                        }
                        if (headerMap['alternateContactName'] !== undefined) {
                            const newVal = getValue(csvRow, 'alternateContactName');
                            updateField('alternateContactName', newVal);
                        }
                        if (headerMap['alternateContactRelationship'] !== undefined) {
                            const newVal = getValue(csvRow, 'alternateContactRelationship');
                            updateField('alternateContactRelationship', newVal);
                        }
                        if (headerMap['alternateContactPhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'alternateContactPhone');
                            updateField('alternateContactPhone', newVal);
                        }
                        if (headerMap['primaryPhysician'] !== undefined) {
                            const newVal = getValue(csvRow, 'primaryPhysician');
                            updateField('primaryPhysician', newVal);
                        }
                        if (headerMap['primaryPhysicianPhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'primaryPhysicianPhone');
                            updateField('primaryPhysicianPhone', newVal);
                        }
                        if (headerMap['medicalInsuranceCompany'] !== undefined) {
                            const newVal = getValue(csvRow, 'medicalInsuranceCompany');
                            updateField('medicalInsuranceCompany', newVal);
                        }
                        if (headerMap['medicalInsuranceAccountNumber'] !== undefined) {
                            const newVal = getValue(csvRow, 'medicalInsuranceAccountNumber');
                            updateField('medicalInsuranceAccountNumber', newVal);
                        }
                        if (headerMap['allergiesOrMedicalNeeds'] !== undefined) {
                            const newVal = getValue(csvRow, 'allergiesOrMedicalNeeds');
                            updateField('allergiesOrMedicalNeeds', newVal);
                        }
                        
                        // Update name fields (use original case from CSV)
                        const csvFirstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 0;
                        const csvLastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 1;
                        const csvFirstName = (csvRow[csvFirstNameIdx] || '').trim();
                        const csvLastName = (csvRow[csvLastNameIdx] || '').trim();
                        const newName = `${csvFirstName} ${csvLastName}`.trim();
                        updateField('firstName', csvFirstName);
                        updateField('lastName', csvLastName);
                        updateField('name', newName);
                        
                        totalFieldsUpdated += fieldsChanged;
                        if (fieldsChanged > 0) {
                            debugOutput.push(`✓ MATCHED: "${nameKey}" (${rider.name || 'NO NAME'}) - ${fieldsChanged} field(s) changed:`);
                            riderChangedFields.forEach(f => debugOutput.push(`    ${f}`));
                        } else {
                            debugOutput.push(`✓ MATCHED: "${nameKey}" (${rider.name || 'NO NAME'}) - No changes`);
                        }
                        updatedRiders.push(updatedRider);
                    } else {
                        // Rider not in CSV - archive them instead of deleting
                        removedCount++;
                        debugOutput.push(`✗ NOT IN CSV: "${nameKey}" (${rider.name || 'NO NAME'}) - Will be ARCHIVED`);
                        const archivedRider = { ...rider, archived: true };
                        updatedRiders.push(archivedRider);
                    }
                }

                // Add new riders from CSV that weren't in the roster
                let addedCount = 0;
                for (const [nameKey, csvRow] of csvRidersMap.entries()) {
                    if (!csvKeysFound.has(nameKey)) {
                        // New rider from CSV
                        const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 0;
                        const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 1;
                        const firstName = (csvRow[firstNameIdx] || '').trim();
                        const lastName = (csvRow[lastNameIdx] || '').trim();
                        const name = `${firstName} ${lastName}`.trim();
                        debugOutput.push(`+ NEW IN CSV: "${nameKey}" (${firstName} ${lastName}) - Will be ADDED`);

                        // Get gender for default photo
                        const genderRaw = getValue(csvRow, 'gender').toUpperCase();
                        let gender = '';
                        if (genderRaw === 'M' || genderRaw === 'MALE') gender = 'M';
                        else if (genderRaw === 'F' || genderRaw === 'FEMALE') gender = 'F';
                        else if (genderRaw === 'NB' || genderRaw === 'NONBINARY') gender = 'NB';

                        let defaultPhoto = '';
                        if (!gender) {
                            defaultPhoto = 'assets/nonbinary_default.png';
                        } else if (gender === 'M') {
                            defaultPhoto = 'assets/male_default.png';
                        } else if (gender === 'F') {
                            defaultPhoto = 'assets/female_default.png';
                        } else if (gender === 'NB') {
                            defaultPhoto = 'assets/nonbinary_default.png';
                        }

                        const gradeRaw = getValue(csvRow, 'grade');
                        const grade = normalizeGradeValue(gradeRaw);

                        const newRider = {
                            id: Date.now() + Math.floor(Math.random() * 1000) + addedCount * 1000,
                            name: name,
                            firstName,
                            lastName,
                            photo: defaultPhoto,
                            email: getValue(csvRow, 'email'),
                            phone: getPhoneValue(csvRow, 'phone'),
                            address: getValue(csvRow, 'address'),
                            gender: gender,
                            grade: grade,
                            birthday: getValue(csvRow, 'birthday'),
                            primaryParentName: getValue(csvRow, 'primaryParentName'),
                            primaryParentPhone: getPhoneValue(csvRow, 'primaryParentPhone'),
                            primaryParentEmail: getValue(csvRow, 'primaryParentEmail'),
                            primaryParentAddress: getValue(csvRow, 'primaryParentAddress'),
                            secondParentName: getValue(csvRow, 'secondParentName'),
                            secondParentPhone: getPhoneValue(csvRow, 'secondParentPhone'),
                            secondParentEmail: getValue(csvRow, 'secondParentEmail'),
                            alternateContactName: getValue(csvRow, 'alternateContactName'),
                            alternateContactRelationship: getValue(csvRow, 'alternateContactRelationship'),
                            alternateContactPhone: getPhoneValue(csvRow, 'alternateContactPhone'),
                            primaryPhysician: getValue(csvRow, 'primaryPhysician'),
                            primaryPhysicianPhone: getPhoneValue(csvRow, 'primaryPhysicianPhone'),
                            medicalInsuranceCompany: getValue(csvRow, 'medicalInsuranceCompany'),
                            medicalInsuranceAccountNumber: getValue(csvRow, 'medicalInsuranceAccountNumber'),
                            allergiesOrMedicalNeeds: getValue(csvRow, 'allergiesOrMedicalNeeds'),
                            racingGroup: 'Freshman',
                            fitness: String(Math.ceil(getFitnessScale() / 2)),
                            skills: String(Math.ceil(getSkillsScale() / 2)),
                            notes: ''
                        };
                        updatedRiders.push(newRider);
                        addedCount++;
                    }
                }

                // Update data
                data.riders = updatedRiders;
                saveData();
                renderRiders();

                // Build alert message
                const alertParts = [];
                if (totalFieldsUpdated > 0) {
                    alertParts.push(`${totalFieldsUpdated} field(s) updated`);
                }
                if (addedCount > 0) {
                    alertParts.push(`Added ${addedCount} new rider(s)`);
                }
                if (removedCount > 0) {
                    alertParts.push(`Archived ${removedCount} rider(s) not found in CSV`);
                }
                if (alertParts.length === 0) {
                    alertParts.push('No changes detected');
                }
                
                // Add summary to debug output
                debugOutput.push('');
                debugOutput.push('=== SUMMARY ===');
                debugOutput.push(`Total fields updated: ${totalFieldsUpdated}`);
                debugOutput.push(`Riders matched and updated: ${updatedCount}`);
                debugOutput.push(`New riders added: ${addedCount}`);
                debugOutput.push(`Riders removed: ${removedCount}`);
                
                // Display debug output
                const debugDiv = document.getElementById('rider-update-debug');
                if (debugDiv) {
                    debugDiv.innerHTML = debugOutput.join('<br>');
                    debugDiv.style.display = 'block';
                }
                
                alert(`Roster update complete!\n\n${alertParts.join('\n')}`);
            } catch (error) {
                console.error('CSV update error:', error);
                alert('Error updating from CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        // Update coaches from CSV (matches by name, updates fields, adds new, removes missing)
        async function updateCoachesFromCSV(coachesText) {
            try {
                // Parse CSV
                const coaches = parseCSV(coachesText);
                if (coaches.length < 2) {
                    alert('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Get header mapping
                const headers = coaches[0];
                const headerMap = getCoachHeaderMap(headers);

                // Debug output
                const debugOutput = [];
                debugOutput.push('=== CSV UPDATE DEBUG ===');
                debugOutput.push(`CSV Coaches in file: ${coaches.length - 1}`);
                debugOutput.push(`Existing Coaches in roster: ${data.coaches.length}`);
                debugOutput.push('');
                
                // Debug: Show sample coach object structure
                if (data.coaches.length > 0) {
                    const sampleCoach = data.coaches[0];
                    debugOutput.push('Sample Coach Object Fields:');
                    const coachFields = Object.keys(sampleCoach).sort();
                    coachFields.forEach(field => {
                        const value = sampleCoach[field];
                        const displayValue = (value === undefined || value === null) ? 'undefined/null' : (value === '' ? '""' : String(value).substring(0, 50));
                        debugOutput.push(`  ${field}: ${displayValue}`);
                    });
                    debugOutput.push('');
                }
                
                // Debug: Show header mapping
                debugOutput.push('Header Mapping:');
                Object.keys(headerMap).sort().forEach(fieldName => {
                    const colIndex = headerMap[fieldName];
                    const headerName = headers[colIndex] || 'UNKNOWN';
                    debugOutput.push(`  ${fieldName} -> Column ${colIndex}: "${headerName}"`);
                });
                debugOutput.push('');
                
                // Debug: Check if coachingLicenseLevel is mapped
                if (!headerMap['coachingLicenseLevel']) {
                    debugOutput.push('WARNING: coachingLicenseLevel not found in header map!');
                    debugOutput.push('Available headers:', headers.join(', '));
                }

                // Helper function to get value from CSV row using header map
                const getValue = (row, fieldName) => {
                    const idx = headerMap[fieldName];
                    if (idx === undefined) {
                        // Debug: log missing header mapping for important fields
                        if (fieldName === 'coachingLicenseLevel') {
                            console.log('Warning: coachingLicenseLevel header not found in CSV. Available headers:', headers);
                            console.log('Header map:', headerMap);
                            debugOutput.push(`ERROR: ${fieldName} header not found!`);
                        }
                        return '';
                    }
                    const value = (row[idx] || '').trim();
                    return value;
                };

                const getPhoneValue = (row, fieldName) => {
                    const val = getValue(row, fieldName);
                    return normalizePhoneNumber(val);
                };

                // Create a map of CSV coaches by name (firstName + lastName)
                const csvCoachesMap = new Map();
                for (let i = 1; i < coaches.length; i++) {
                    const row = coaches[i];
                    if (!row || row.length === 0) continue;

                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 0;
                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 1;
                    let lastName = (row[lastNameIdx] || '').trim();
                    let firstName = (row[firstNameIdx] || '').trim();
                    
                    // Handle cases where name might be in a single field
                    if (!firstName && !lastName) continue;
                    if (!lastName && firstName) {
                        // Try to split if only one name field has data
                        const parts = firstName.split(/\s+/);
                        if (parts.length > 1) {
                            lastName = parts.pop();
                            firstName = parts.join(' ');
                        }
                    }
                    
                    // Normalize: lowercase and remove extra spaces
                    firstName = firstName.toLowerCase().replace(/\s+/g, ' ').trim();
                    lastName = lastName.toLowerCase().replace(/\s+/g, ' ').trim();
                    
                    const nameKey = `${firstName}|${lastName}`;
                    csvCoachesMap.set(nameKey, row);
                }
                
                // Helper function to extract firstName and lastName from coach object
                const getCoachNames = (coach) => {
                    let firstName = (coach.firstName || '').trim();
                    let lastName = (coach.lastName || '').trim();
                    
                    // If firstName/lastName don't exist, try to split the name field
                    if (!firstName && !lastName && coach.name) {
                        const parts = coach.name.trim().split(/\s+/);
                        if (parts.length > 1) {
                            lastName = parts.pop();
                            firstName = parts.join(' ');
                        } else {
                            firstName = coach.name.trim();
                        }
                    }
                    
                    // Normalize: lowercase and remove extra spaces
                    firstName = firstName.toLowerCase().replace(/\s+/g, ' ').trim();
                    lastName = lastName.toLowerCase().replace(/\s+/g, ' ').trim();
                    
                    return { firstName, lastName };
                };
                
                debugOutput.push('CSV Name Keys:');
                for (const [key, row] of csvCoachesMap.entries()) {
                    const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 0;
                    const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 1;
                    const lastName = (row[lastNameIdx] || '').trim();
                    const firstName = (row[firstNameIdx] || '').trim();
                    debugOutput.push(`  "${key}" -> "${firstName} ${lastName}"`);
                }
                debugOutput.push('');
                debugOutput.push('Roster Name Keys:');
                for (const coach of data.coaches) {
                    const { firstName, lastName } = getCoachNames(coach);
                    const nameKey = `${firstName}|${lastName}`;
                    debugOutput.push(`  "${nameKey}" -> "${coach.name || 'NO NAME'}" (ID: ${coach.id})`);
                }
                debugOutput.push('');

                // Fields that should NOT be updated from CSV (preserve existing values)
                const preserveFields = ['fitness', 'notes', 'photo', 'id'];

                // Update existing coaches and track which ones were found in CSV
                const updatedCoaches = [];
                const csvKeysFound = new Set();
                let removedCount = 0;
                let updatedCount = 0;
                let totalFieldsUpdated = 0;

                for (const coach of data.coaches) {
                    const { firstName, lastName } = getCoachNames(coach);
                    const nameKey = `${firstName}|${lastName}`;
                    
                    // Debug: log if name key is empty or malformed
                    if (!firstName && !lastName) {
                        console.warn('Coach has no name:', coach);
                        continue; // Skip coaches with no name
                    }
                    
                    if (csvCoachesMap.has(nameKey)) {
                        // Coach found in CSV - update fields from CSV
                        csvKeysFound.add(nameKey);
                        updatedCount++;
                        const csvRow = csvCoachesMap.get(nameKey);
                        
                        // Create updated coach object, preserving non-CSV fields
                        const updatedCoach = { ...coach };
                        let fieldsChanged = 0;
                        const coachChangedFields = [];
                        
                        // Helper to compare and update field
                        const updateField = (fieldName, newVal) => {
                            // Get the actual current value from the original coach object
                            // Use 'in' operator to check if property exists (handles undefined vs missing property)
                            const oldVal = (fieldName in coach) ? coach[fieldName] : undefined;
                            // Normalize for comparison: treat undefined, null, and empty string as equivalent
                            const normalizedOld = (oldVal === undefined || oldVal === null || oldVal === '') ? '' : String(oldVal).trim();
                            const normalizedNew = (newVal === undefined || newVal === null || newVal === '') ? '' : String(newVal).trim();
                            
                            // Only update if values are actually different
                            if (normalizedOld !== normalizedNew) {
                                updatedCoach[fieldName] = newVal;
                                fieldsChanged++;
                                coachChangedFields.push(`${fieldName}: "${normalizedOld}" -> "${normalizedNew}"`);
                                return true;
                            }
                            return false;
                        };
                        
                        // Update fields from CSV (only if they exist in CSV)
                        if (headerMap['email'] !== undefined) {
                            const newVal = getValue(csvRow, 'email');
                            updateField('email', newVal);
                        }
                        if (headerMap['phone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'phone');
                            updateField('phone', newVal);
                        }
                        if (headerMap['workPhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'workPhone');
                            updateField('workPhone', newVal);
                        }
                        if (headerMap['homePhone'] !== undefined) {
                            const newVal = getPhoneValue(csvRow, 'homePhone');
                            updateField('homePhone', newVal);
                        }
                        if (headerMap['coachingLicenseLevel'] !== undefined) {
                            const licenseLevelRaw = getValue(csvRow, 'coachingLicenseLevel');
                            const licenseLevelNormalized = licenseLevelRaw.trim().toUpperCase();
                            let newLevel = 'N/A';
                            
                            // Check for just the number (1, 2, 3) or with "LEVEL" prefix
                            if (licenseLevelNormalized === '1' || licenseLevelNormalized === 'LEVEL 1' || licenseLevelNormalized === 'LEVEL1' || licenseLevelNormalized === 'L1') {
                                newLevel = '1';
                            } else if (licenseLevelNormalized === '2' || licenseLevelNormalized === 'LEVEL 2' || licenseLevelNormalized === 'LEVEL2' || licenseLevelNormalized === 'L2') {
                                newLevel = '2';
                            } else if (licenseLevelNormalized === '3' || licenseLevelNormalized === 'LEVEL 3' || licenseLevelNormalized === 'LEVEL3' || licenseLevelNormalized === 'L3') {
                                newLevel = '3';
                            } else if (licenseLevelNormalized === 'N/A' || licenseLevelNormalized === 'NA' || licenseLevelNormalized === '' || licenseLevelNormalized === 'NULL' || licenseLevelNormalized === 'NONE') {
                                newLevel = 'N/A';
                            } else {
                                // Try to extract number from the string (e.g., "Level 1", "1", etc.)
                                const numberMatch = licenseLevelNormalized.match(/\b([123])\b/);
                                if (numberMatch) {
                                    newLevel = numberMatch[1];
                                    debugOutput.push(`  Extracted license level "${newLevel}" from "${licenseLevelNormalized}" (raw: "${licenseLevelRaw}")`);
                                } else {
                                    debugOutput.push(`  Warning: Unexpected license level value: "${licenseLevelNormalized}" (raw: "${licenseLevelRaw}") - defaulting to N/A`);
                                }
                            }
                            updateField('coachingLicenseLevel', newLevel);
                        }
                        if (headerMap['gender'] !== undefined) {
                            const genderRaw = getValue(csvRow, 'gender').toUpperCase();
                            let newGender = '';
                            if (genderRaw === 'M' || genderRaw === 'MALE') newGender = 'M';
                            else if (genderRaw === 'F' || genderRaw === 'FEMALE') newGender = 'F';
                            else if (genderRaw === 'NB' || genderRaw === 'NONBINARY') newGender = 'NB';
                            updateField('gender', newGender);
                        }
                        if (headerMap['registered'] !== undefined) {
                            const newVal = getValue(csvRow, 'registered');
                            updateField('registered', newVal);
                        }
                        if (headerMap['paid'] !== undefined) {
                            const newVal = getValue(csvRow, 'paid');
                            updateField('paid', newVal);
                        }
                        if (headerMap['backgroundCheck'] !== undefined) {
                            const newVal = getValue(csvRow, 'backgroundCheck');
                            updateField('backgroundCheck', newVal);
                        }
                        if (headerMap['level3ExamCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'level3ExamCompleted');
                            updateField('level3ExamCompleted', newVal);
                        }
                        if (headerMap['pduCeuUnits'] !== undefined) {
                            const newVal = getValue(csvRow, 'pduCeuUnits');
                            updateField('pduCeuUnits', newVal);
                        }
                        if (headerMap['fieldWorkHours'] !== undefined) {
                            const newVal = getValue(csvRow, 'fieldWorkHours');
                            updateField('fieldWorkHours', newVal);
                        }
                        if (headerMap['firstAidTypeExpires'] !== undefined) {
                            const newVal = getValue(csvRow, 'firstAidTypeExpires');
                            updateField('firstAidTypeExpires', newVal);
                        }
                        if (headerMap['cprExpires'] !== undefined) {
                            const newVal = getValue(csvRow, 'cprExpires');
                            updateField('cprExpires', newVal);
                        }
                        if (headerMap['concussionTrainingCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'concussionTrainingCompleted');
                            updateField('concussionTrainingCompleted', newVal);
                        }
                        if (headerMap['nicaPhilosophyCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'nicaPhilosophyCompleted');
                            updateField('nicaPhilosophyCompleted', newVal);
                        }
                        if (headerMap['athleteAbuseAwarenessCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'athleteAbuseAwarenessCompleted');
                            updateField('athleteAbuseAwarenessCompleted', newVal);
                        }
                        if (headerMap['licenseLevel1Completed'] !== undefined) {
                            const newVal = getValue(csvRow, 'licenseLevel1Completed');
                            updateField('licenseLevel1Completed', newVal);
                        }
                        if (headerMap['licenseLevel2Completed'] !== undefined) {
                            const newVal = getValue(csvRow, 'licenseLevel2Completed');
                            updateField('licenseLevel2Completed', newVal);
                        }
                        if (headerMap['licenseLevel3Completed'] !== undefined) {
                            const newVal = getValue(csvRow, 'licenseLevel3Completed');
                            updateField('licenseLevel3Completed', newVal);
                        }
                        if (headerMap['otbSkills101ClassroomCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'otbSkills101ClassroomCompleted');
                            updateField('otbSkills101ClassroomCompleted', newVal);
                        }
                        if (headerMap['otbSkills101OutdoorCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'otbSkills101OutdoorCompleted');
                            updateField('otbSkills101OutdoorCompleted', newVal);
                        }
                        if (headerMap['nicaLeaderSummitCompleted'] !== undefined) {
                            const newVal = getValue(csvRow, 'nicaLeaderSummitCompleted');
                            updateField('nicaLeaderSummitCompleted', newVal);
                        }
                        
                        // Update name fields (use original case from CSV)
                        const csvLastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 0;
                        const csvFirstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 1;
                        const csvLastName = (csvRow[csvLastNameIdx] || '').trim();
                        const csvFirstName = (csvRow[csvFirstNameIdx] || '').trim();
                        const newName = `${csvFirstName} ${csvLastName}`.trim();
                        updateField('firstName', csvFirstName);
                        updateField('lastName', csvLastName);
                        updateField('name', newName);
                        
                        totalFieldsUpdated += fieldsChanged;
                        if (fieldsChanged > 0) {
                            debugOutput.push(`✓ MATCHED: "${nameKey}" (${coach.name || 'NO NAME'}) - ${fieldsChanged} field(s) changed:`);
                            coachChangedFields.forEach(f => debugOutput.push(`    ${f}`));
                        } else {
                            debugOutput.push(`✓ MATCHED: "${nameKey}" (${coach.name || 'NO NAME'}) - No changes`);
                        }
                        updatedCoaches.push(updatedCoach);
                    } else {
                        // Coach not in CSV - archive them instead of deleting
                        removedCount++;
                        debugOutput.push(`✗ NOT IN CSV: "${nameKey}" (${coach.name || 'NO NAME'}) - Will be ARCHIVED`);
                        const archivedCoach = { ...coach, archived: true };
                        updatedCoaches.push(archivedCoach);
                    }
                }

                // Add new coaches from CSV that weren't in the roster
                let addedCount = 0;
                for (const [nameKey, csvRow] of csvCoachesMap.entries()) {
                    if (!csvKeysFound.has(nameKey)) {
                        // New coach from CSV
                        const lastNameIdx = headerMap['lastName'] !== undefined ? headerMap['lastName'] : 0;
                        const firstNameIdx = headerMap['firstName'] !== undefined ? headerMap['firstName'] : 1;
                        const lastName = (csvRow[lastNameIdx] || '').trim();
                        const firstName = (csvRow[firstNameIdx] || '').trim();
                        const name = `${firstName} ${lastName}`.trim();
                        debugOutput.push(`+ NEW IN CSV: "${nameKey}" (${firstName} ${lastName}) - Will be ADDED`);

                        // Get gender for default photo
                        const genderRaw = getValue(csvRow, 'gender').toUpperCase();
                        let gender = '';
                        if (genderRaw === 'M' || genderRaw === 'MALE') gender = 'M';
                        else if (genderRaw === 'F' || genderRaw === 'FEMALE') gender = 'F';
                        else if (genderRaw === 'NB' || genderRaw === 'NONBINARY') gender = 'NB';

                        let defaultPhoto = '';
                        if (!gender) {
                            defaultPhoto = 'assets/nonbinary_default.png';
                        } else if (gender === 'M') {
                            defaultPhoto = 'assets/male_default.png';
                        } else if (gender === 'F') {
                            defaultPhoto = 'assets/female_default.png';
                        } else if (gender === 'NB') {
                            defaultPhoto = 'assets/nonbinary_default.png';
                        }

                        const licenseLevelRaw = getValue(csvRow, 'coachingLicenseLevel').trim().toUpperCase();
                        let licenseLevel = 'N/A';
                        // Check for just the number (1, 2, 3) or with "LEVEL" prefix
                        if (licenseLevelRaw === '1' || licenseLevelRaw === 'LEVEL 1' || licenseLevelRaw === 'LEVEL1') licenseLevel = '1';
                        else if (licenseLevelRaw === '2' || licenseLevelRaw === 'LEVEL 2' || licenseLevelRaw === 'LEVEL2') licenseLevel = '2';
                        else if (licenseLevelRaw === '3' || licenseLevelRaw === 'LEVEL 3' || licenseLevelRaw === 'LEVEL3') licenseLevel = '3';
                        else if (licenseLevelRaw === 'N/A' || licenseLevelRaw === 'NA' || licenseLevelRaw === '') licenseLevel = 'N/A';

                        const newCoach = {
                            id: Date.now() + Math.floor(Math.random() * 1000) + addedCount * 10000,
                            name: name,
                            firstName,
                            lastName,
                            photo: defaultPhoto,
                            phone: getPhoneValue(csvRow, 'phone'),
                            email: getValue(csvRow, 'email'),
                            coachingLicenseLevel: licenseLevel,
                            workPhone: getPhoneValue(csvRow, 'workPhone'),
                            homePhone: getPhoneValue(csvRow, 'homePhone'),
                            gender: gender,
                            registered: getValue(csvRow, 'registered'),
                            paid: getValue(csvRow, 'paid'),
                            backgroundCheck: getValue(csvRow, 'backgroundCheck'),
                            level3ExamCompleted: getValue(csvRow, 'level3ExamCompleted'),
                            pduCeuUnits: getValue(csvRow, 'pduCeuUnits'),
                            fieldWorkHours: getValue(csvRow, 'fieldWorkHours'),
                            firstAidTypeExpires: getValue(csvRow, 'firstAidTypeExpires'),
                            cprExpires: getValue(csvRow, 'cprExpires'),
                            concussionTrainingCompleted: getValue(csvRow, 'concussionTrainingCompleted'),
                            nicaPhilosophyCompleted: getValue(csvRow, 'nicaPhilosophyCompleted'),
                            athleteAbuseAwarenessCompleted: getValue(csvRow, 'athleteAbuseAwarenessCompleted'),
                            licenseLevel1Completed: getValue(csvRow, 'licenseLevel1Completed'),
                            licenseLevel2Completed: getValue(csvRow, 'licenseLevel2Completed'),
                            licenseLevel3Completed: getValue(csvRow, 'licenseLevel3Completed'),
                            otbSkills101ClassroomCompleted: getValue(csvRow, 'otbSkills101ClassroomCompleted'),
                            otbSkills101OutdoorCompleted: getValue(csvRow, 'otbSkills101OutdoorCompleted'),
                            nicaLeaderSummitCompleted: getValue(csvRow, 'nicaLeaderSummitCompleted'),
                            fitness: String(Math.ceil(getFitnessScale() / 2)),
                            skills: String(Math.ceil(getSkillsScale() / 2)),
                            notes: ''
                        };
                        updatedCoaches.push(newCoach);
                        addedCount++;
                    }
                }

                // Update data
                data.coaches = updatedCoaches;
                saveData();
                renderCoaches();

                // Build alert message
                const alertParts = [];
                if (totalFieldsUpdated > 0) {
                    alertParts.push(`${totalFieldsUpdated} field(s) updated`);
                }
                if (addedCount > 0) {
                    alertParts.push(`Added ${addedCount} new coach(es)`);
                }
                if (removedCount > 0) {
                    alertParts.push(`Archived ${removedCount} coach(es) not found in CSV`);
                }
                if (alertParts.length === 0) {
                    alertParts.push('No changes detected');
                }
                
                // Add summary to debug output
                debugOutput.push('');
                debugOutput.push('=== SUMMARY ===');
                debugOutput.push(`Total fields updated: ${totalFieldsUpdated}`);
                debugOutput.push(`Coaches matched and updated: ${updatedCount}`);
                debugOutput.push(`New coaches added: ${addedCount}`);
                debugOutput.push(`Coaches removed: ${removedCount}`);
                
                // Display debug output
                const debugDiv = document.getElementById('coach-update-debug');
                if (debugDiv) {
                    debugDiv.innerHTML = debugOutput.join('<br>');
                    debugDiv.style.display = 'block';
                }
                
                alert(`Roster update complete!\n\n${alertParts.join('\n')}`);
            } catch (error) {
                console.error('CSV update error:', error);
                alert('Error updating from CSV file: ' + (error.message || 'Unknown error'));
            }
        }

        // Helper function to let user select and read a CSV file
        function selectAndReadCSVFile(type) {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.style.display = 'none';
                
                let resolved = false;
                
                input.onchange = (event) => {
                    const file = event.target.files[0];
                    if (!file) {
                        if (!resolved) {
                            resolved = true;
                            resolve(null);
                        }
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (!resolved) {
                            resolved = true;
                            resolve(e.target.result);
                        }
                    };
                    reader.onerror = () => {
                        if (!resolved) {
                            resolved = true;
                            resolve(null);
                        }
                    };
                    reader.readAsText(file);
                };
                
                // Trigger file selection
                document.body.appendChild(input);
                input.click();
                
                // Clean up and timeout
                setTimeout(() => {
                    if (document.body.contains(input)) {
                        document.body.removeChild(input);
                    }
                    if (!resolved) {
                        resolved = true;
                        resolve(null);
                    }
                }, 60000); // 60 second timeout
            });
        }

        function normalizePhoneNumber(phone) {
            if (!phone) return '';
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                return digits;
            } else if (digits.length === 11 && digits[0] === '1') {
                return digits.substring(1);
            }
            return '';
        }

        // ============ CSV REVIEW SCREEN ============

        // Open the review screen showing new/changed/removed records
        function _getFieldLabel(fieldKey) {
            const labels = {
                firstName: 'First Name', lastName: 'Last Name', name: 'Name',
                nickname: 'Nickname', phone: 'Cell Number', email: 'Email',
                address: 'Address', gender: 'Gender', grade: 'Grade',
                birthday: 'Birthday', racingGroup: 'Ride Group',
                allergiesOrMedicalNeeds: 'Medical Conditions', notes: 'Notes',
                fitness: 'Endurance', climbing: 'Climbing', skills: 'Descending',
                photo: 'Headshot', primaryParentName: 'Primary Parent Name',
                primaryParentPhone: 'Primary Parent Phone', primaryParentEmail: 'Primary Parent Email',
                primaryParentAddress: 'Primary Parent Address', secondParentName: 'Second Parent Name',
                secondParentPhone: 'Second Parent Phone', secondParentEmail: 'Second Parent Email',
                alternateContactName: 'Alternate Contact Name', alternateContactPhone: 'Alternate Contact Phone',
                alternateContactRelationship: 'Alternate Contact Relationship',
                primaryPhysician: 'Primary Physician', primaryPhysicianPhone: 'Primary Physician Phone',
                medicalInsuranceCompany: 'Medical Insurance Company',
                medicalInsuranceAccountNumber: 'Medical Insurance Account Number',
                leaderLevel: 'Leader Level', bikeManual: 'Bike: Manual MTB',
                bikeElectric: 'Bike: Electric MTB', bikePrimary: 'Bike: Primary Ride',
                workPhone: 'Work Phone', homePhone: 'Home Phone',
                coachingLicenseLevel: 'Coaching License Level'
            };
            return labels[fieldKey] || fieldKey;
        }

        function openCSVReviewScreen(pendingUpdate) {
            const modal = document.getElementById('csv-review-modal');
            const titleEl = document.getElementById('csv-review-modal-title');
            const content = document.getElementById('csv-review-content');
            if (!modal || !content) {
                console.error('CSV review modal not found');
                applyCSVReviewChangesDirectly(pendingUpdate);
                return;
            }

            const isRiders = pendingUpdate.type === 'riders';
            const entityName = isRiders ? 'Riders' : 'Coaches';
            const entitySingular = isRiders ? 'Rider' : 'Coach';
            if (titleEl) titleEl.textContent = `Update ${entityName} from CSV`;

            // --- Changed Fields Section (computed first so summary can use actual counts) ---
            const updatedRecords = isRiders ? pendingUpdate.updatedRiders : pendingUpdate.updatedCoaches;
            const originalRecords = isRiders ? pendingUpdate.originalRiders : pendingUpdate.originalCoaches;
            const origMap = new Map();
            originalRecords.forEach(r => origMap.set(r.id, r));

            const allFieldsToCheck = [
                'name', 'firstName', 'lastName', 'nickname', 'phone', 'email', 'address',
                'gender', 'grade', 'birthday', 'racingGroup', 'notes',
                'allergiesOrMedicalNeeds', 'fitness', 'climbing', 'skills',
                'primaryParentName', 'primaryParentPhone', 'primaryParentEmail',
                'primaryParentAddress', 'secondParentName', 'secondParentPhone',
                'secondParentEmail', 'alternateContactName', 'alternateContactRelationship',
                'alternateContactPhone', 'primaryPhysician', 'primaryPhysicianPhone',
                'medicalInsuranceCompany', 'medicalInsuranceAccountNumber'
            ];
            if (!isRiders) {
                allFieldsToCheck.push('workPhone', 'homePhone', 'coachingLicenseLevel',
                    'leaderLevel', 'bikeManual', 'bikeElectric', 'bikePrimary');
            }

            function normalizeForCompare(field, val) {
                const s = String(val || '');
                if (field === 'gender') return normalizeGenderValue(s);
                return s;
            }

            const changedRecords = updatedRecords.filter(r => {
                if (!origMap.has(r.id)) return false;
                const orig = origMap.get(r.id);
                return allFieldsToCheck.some(f => normalizeForCompare(f, r[f]) !== normalizeForCompare(f, orig[f]));
            });

            // Count actual field-level changes (post-normalization)
            let actualFieldChanges = 0;
            changedRecords.forEach(r => {
                const orig = origMap.get(r.id);
                if (orig) actualFieldChanges += allFieldsToCheck.filter(f => normalizeForCompare(f, r[f]) !== normalizeForCompare(f, orig[f])).length;
            });

            const addedRecords = isRiders ? pendingUpdate.addedRiders : pendingUpdate.addedCoaches;
            const archivedCount = pendingUpdate.archivedCount || 0;

            let html = '';
            // --- Summary ---
            html += `<div style="margin-bottom:16px; padding:12px; background:#f9f9f9; border:1px solid #ddd; border-radius:4px;">`;
            html += `<strong>Summary:</strong> `;
            const parts = [];
            if (changedRecords.length > 0) parts.push(`${changedRecords.length} updated`);
            if (addedRecords && addedRecords.length > 0) parts.push(`${addedRecords.length} new`);
            if (archivedCount > 0) parts.push(`${archivedCount} not in CSV`);
            if (actualFieldChanges > 0) parts.push(`${actualFieldChanges} field change(s)`);
            if (parts.length === 0) parts.push('No changes detected');
            html += parts.join(', ');
            html += `</div>`;

            if (changedRecords.length > 0) {
                html += `<div class="csv-review-section">`;
                html += `<div class="csv-review-section-header changes">Updated Records (${changedRecords.length})</div>`;

                changedRecords.forEach(rec => {
                    const orig = origMap.get(rec.id);
                    if (!orig) return;
                    const displayName = rec.name || `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
                    const diffs = allFieldsToCheck.filter(f => normalizeForCompare(f, rec[f]) !== normalizeForCompare(f, orig[f]));
                    if (diffs.length === 0) return;

                    html += `<div class="csv-review-record">`;
                    html += `<div class="csv-review-record-name">${escapeHtml(displayName)}</div>`;
                    html += `<table class="csv-review-changes-table">`;
                    html += `<thead><tr>`;
                    html += `<th class="col-field">Field</th>`;
                    html += `<th class="col-existing">Existing Data</th>`;
                    html += `<th class="col-csv">CSV Data</th>`;
                    html += `<th class="col-action">Action</th>`;
                    html += `</tr></thead><tbody>`;

                    diffs.forEach(field => {
                        const oldVal = String(orig[field] || '');
                        const newVal = String(rec[field] || '');
                        const label = (field === 'firstName' || field === 'lastName' || field === 'name')
                            ? 'Name Update' : _getFieldLabel(field);
                        const radioName = `field-${rec.id}-${field}`;

                        html += `<tr>`;
                        html += `<td class="col-field">${escapeHtml(label)}</td>`;
                        html += `<td class="col-existing">${escapeHtml(oldVal || '(empty)')}</td>`;
                        html += `<td class="col-csv">${escapeHtml(newVal || '(empty)')}</td>`;
                        html += `<td class="col-action">`;
                        html += `<label><input type="radio" name="${radioName}" value="csv" data-id="${rec.id}" data-field="${field}" checked> Use CSV data</label>`;
                        html += `<label><input type="radio" name="${radioName}" value="keep" data-id="${rec.id}" data-field="${field}"> Keep existing data</label>`;
                        html += `</td>`;
                        html += `</tr>`;
                    });

                    html += `</tbody></table>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }

            // --- New Records Section ---
            if (addedRecords && addedRecords.length > 0) {
                html += `<div class="csv-review-section">`;
                html += `<div class="csv-review-section-header new-records">New Records (${addedRecords.length})</div>`;
                addedRecords.forEach((rec, idx) => {
                    const name = rec.name || `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
                    const radioName = `new-${idx}`;
                    html += `<div class="csv-review-new-record">`;
                    html += `<span class="record-name">${escapeHtml(name)}</span>`;
                    html += `<span class="radio-group">`;
                    html += `<label><input type="radio" name="${radioName}" value="import" data-action="new" data-index="${idx}" checked> Import</label>`;
                    html += `<label><input type="radio" name="${radioName}" value="skip" data-action="new" data-index="${idx}"> Do Not Import</label>`;
                    html += `<label><input type="radio" name="${radioName}" value="archive" data-action="new" data-index="${idx}"> Add to Archive</label>`;
                    html += `</span>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }

            // --- Missing Records Section ---
            if (pendingUpdate.archivedCount > 0) {
                const activeOriginals = originalRecords.filter(r => !r.archived);
                const unmatchedRecords = activeOriginals.filter(r => !pendingUpdate.matchedExistingIds.has(r.id));

                if (unmatchedRecords.length > 0) {
                    html += `<div class="csv-review-section">`;
                    html += `<div class="csv-review-section-header missing-records">Not Found in CSV (${unmatchedRecords.length})</div>`;
                    unmatchedRecords.forEach((rec, idx) => {
                        const name = rec.name || `${rec.firstName || ''} ${rec.lastName || ''}`.trim();
                        const radioName = `missing-${rec.id}`;
                        html += `<div class="csv-review-missing-record">`;
                        html += `<span class="record-name">${escapeHtml(name)}</span>`;
                        html += `<span class="radio-group">`;
                        html += `<label><input type="radio" name="${radioName}" value="archive" data-action="missing" data-id="${rec.id}" checked> Archive ${entitySingular}</label>`;
                        html += `<label><input type="radio" name="${radioName}" value="retain" data-action="missing" data-id="${rec.id}"> Retain ${entitySingular}</label>`;
                        html += `</span>`;
                        html += `</div>`;
                    });
                    html += `</div>`;
                }
            }

            if (!pendingUpdate.addedCount && !pendingUpdate.archivedCount && !pendingUpdate.totalFieldsUpdated && changedRecords.length === 0) {
                html += `<div style="padding:24px; text-align:center; color:#666;">No changes detected between CSV and existing roster.</div>`;
            }

            content.innerHTML = html;
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeCSVReviewModal() {
            const modal = document.getElementById('csv-review-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            window._pendingCSVUpdate = null;
        }

        async function applyCSVReviewChanges() {
            const pendingUpdate = window._pendingCSVUpdate;
            if (!pendingUpdate) {
                alert('No pending changes to apply.');
                return;
            }

            const isRiders = pendingUpdate.type === 'riders';
            const originalRecords = isRiders ? pendingUpdate.originalRiders : pendingUpdate.originalCoaches;
            const addedRecords = isRiders ? pendingUpdate.addedRiders : pendingUpdate.addedCoaches;
            const updatedRecords = isRiders ? pendingUpdate.updatedRiders : pendingUpdate.updatedCoaches;

            const origMap = new Map();
            originalRecords.forEach(r => origMap.set(r.id, r));

            // 1. Process field-level radio choices (changed records)
            const keepFields = {};
            document.querySelectorAll('.csv-review-changes-table input[type="radio"]:checked').forEach(radio => {
                if (radio.value === 'keep' && radio.dataset.id && radio.dataset.field) {
                    const id = radio.dataset.id;
                    if (!keepFields[id]) keepFields[id] = new Set();
                    keepFields[id].add(radio.dataset.field);
                }
            });

            // 2. Process new records radio choices
            const newRecordActions = {};
            document.querySelectorAll('input[type="radio"][data-action="new"]:checked').forEach(radio => {
                newRecordActions[radio.dataset.index] = radio.value;
            });

            // 3. Process missing records radio choices
            const missingRecordActions = {};
            document.querySelectorAll('input[type="radio"][data-action="missing"]:checked').forEach(radio => {
                missingRecordActions[radio.dataset.id] = radio.value;
            });

            // Build final records
            const finalRecords = [];
            let addedCount = 0;
            let archivedCount = 0;
            let updatedFieldCount = 0;

            for (const rec of updatedRecords) {
                const isNewRecord = addedRecords.some(a => a.id === rec.id);
                if (isNewRecord) continue;

                const isUnmatched = !pendingUpdate.matchedExistingIds.has(rec.id);
                if (isUnmatched) {
                    const action = missingRecordActions[String(rec.id)] || 'archive';
                    if (action === 'archive') {
                        finalRecords.push({ ...rec, archived: true });
                        archivedCount++;
                    } else {
                        finalRecords.push(rec);
                    }
                    continue;
                }

                // Matched record - apply field choices
                if (keepFields[rec.id]) {
                    const orig = origMap.get(rec.id);
                    if (orig) {
                        const fixedRec = { ...rec };
                        keepFields[rec.id].forEach(field => {
                            fixedRec[field] = orig[field];
                        });
                        if (keepFields[rec.id].has('firstName') || keepFields[rec.id].has('lastName')) {
                            fixedRec.name = `${fixedRec.firstName || ''} ${fixedRec.lastName || ''}`.trim();
                        }
                        finalRecords.push(fixedRec);
                        updatedFieldCount++;
                        continue;
                    }
                }
                finalRecords.push(rec);
                if (origMap.has(rec.id)) updatedFieldCount++;
            }

            // Process new records
            const acceptedAdds = [];
            addedRecords.forEach((rec, idx) => {
                const action = newRecordActions[String(idx)] || 'import';
                if (action === 'import') {
                    acceptedAdds.push(rec);
                    addedCount++;
                } else if (action === 'archive') {
                    acceptedAdds.push({ ...rec, archived: true });
                    addedCount++;
                }
                // 'skip' -> do nothing
            });
            finalRecords.push(...acceptedAdds);

            // Save
            if (isRiders) {
                data.riders = finalRecords;
                saveData();
                await syncRidersToSupabase(originalRecords, finalRecords, acceptedAdds);
                renderRiders();
            } else {
                data.coaches = finalRecords;
                saveData();
                await syncCoachesToSupabase(originalRecords, finalRecords, acceptedAdds);
                renderCoaches();
            }

            const summaryParts = [];
            if (addedCount > 0) summaryParts.push(`Added ${addedCount} new record(s)`);
            if (archivedCount > 0) summaryParts.push(`Archived ${archivedCount} record(s)`);
            if (updatedFieldCount > 0) summaryParts.push(`Updated ${updatedFieldCount} record(s)`);
            if (summaryParts.length === 0) summaryParts.push('No changes applied');

            closeCSVReviewModal();
            alert(`Roster update complete!\n\n${summaryParts.join('\n')}`);
        }

        async function applyCSVReviewChangesDirectly(pendingUpdate) {
            const isRiders = pendingUpdate.type === 'riders';
            const records = isRiders ? pendingUpdate.updatedRiders : pendingUpdate.updatedCoaches;
            const added = isRiders ? pendingUpdate.addedRiders : pendingUpdate.addedCoaches;
            const original = isRiders ? pendingUpdate.originalRiders : pendingUpdate.originalCoaches;

            if (isRiders) {
                data.riders = records;
                saveData();
                await syncRidersToSupabase(original, records, added);
                renderRiders();
            } else {
                data.coaches = records;
                saveData();
                await syncCoachesToSupabase(original, records, added);
                renderCoaches();
            }

            const parts = [];
            if (pendingUpdate.addedCount > 0) parts.push(`Added ${pendingUpdate.addedCount} new record(s)`);
            if (pendingUpdate.archivedCount > 0) parts.push(`${pendingUpdate.archivedCount} record(s) not in CSV (kept as-is)`);
            if (pendingUpdate.totalFieldsUpdated > 0) parts.push(`Updated ${pendingUpdate.totalFieldsUpdated} field(s)`);
            if (parts.length === 0) parts.push('No changes detected');
            alert(`Roster update complete!\n\n${parts.join('\n')}`);
        }