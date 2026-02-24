// app-assignments.js — Rider/coach assignment tabs, context menus, drag-drop

        // ============ RIDE ASSIGNMENTS (MOBILE-FRIENDLY) ============

        function getNextUpcomingRide() {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            // Get all non-cancelled, non-deleted rides with dates
            const upcomingRides = (data.rides || [])
                .filter(ride => {
                    if (ride.deleted) return false; // Exclude deleted practices
                    if (ride.cancelled) return false;
                    if (!ride.date) return false;
                    const rideDate = parseISODate(ride.date);
                    if (!rideDate) return false;
                    rideDate.setHours(0, 0, 0, 0);
                    return rideDate >= now;
                })
                .map(ride => ({
                    ride,
                    date: parseISODate(ride.date)
                }))
                .filter(item => item.date !== null)
                .sort((a, b) => a.date - b.date);
            
            return upcomingRides.length > 0 ? upcomingRides[0].ride : null;
        }

        function getRouteById(routeId) {
            if (!routeId) return null;
            return (data.routes || []).find(route => String(route.id) === String(routeId)) || null;
        }

        async function renderRideAssignments() {
            const container = document.getElementById('ride-assignments-container');
            if (!container) return;

            const ride = getNextUpcomingRide();
            
            // Check and auto-unpublish if 12 hours have passed
            if (ride) {
                await checkAndAutoUnpublish(ride);
            }
            
            if (!ride) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 18px; margin-bottom: 8px;">No upcoming ride scheduled</p>
                        <p style="font-size: 14px;">Check the Practice Planner to add practices.</p>
                    </div>
                `;
                return;
            }

            const rideDate = parseISODate(ride.date);
            const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ride.date;
            const goals = (ride.goals || '').trim();
            
            // Get practice time and location
            const practice = getPracticeSettingsForRide(ride);
            const practiceTime = ride.startTime || ride.time || (practice ? practice.time : '');
            const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
            const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
            const locationLat = ride.locationLat || (practice ? practice.locationLat : null);
            const locationLng = ride.locationLng || (practice ? practice.locationLng : null);
            
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
            
            // Always show goals at the top (visible regardless of which groups are opened)
            let html = `
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #333;">${escapeHtml(dateDisplay)}</h2>
                    <div style="margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 14px; color: #555;">
                        ${timeDisplay ? `<div style="margin-bottom: 6px;"><strong>Time:</strong> ${escapeHtml(timeDisplay)}</div>` : ''}
                        ${practiceLocation ? `<div style="margin-bottom: 6px;"><strong>Location:</strong> ${escapeHtml(practiceLocation)}</div>` : ''}
                        <div id="practice-weather" style="margin-top: ${timeDisplay || practiceLocation ? '6px' : '0'};">
                            <div><strong>Weather:</strong> <span id="weather-loading">Loading...</span></div>
                            <div><strong>Precip:</strong> <span id="weather-precip">--</span></div>
                            <div id="weather-alerts" style="margin-top: 4px; color: #b00020;"></div>
                        </div>
                    </div>
                    ${goals ? `<div style="padding: 12px; background: #e3f2fd; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 16px;">
                        <strong style="display: block; margin-bottom: 4px; color: #1976D2;">Practice Goals:</strong>
                        <span style="color: #555;">${escapeHtml(goals)}</span>
                    </div>` : ''}
                </div>
            `;

            // Check if groups are published
            if (!ride.publishedGroups) {
                html += `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 18px; margin-bottom: 8px;">Group Assignments Pending</p>
                        <p style="font-size: 14px; color: #999;">Group assignments will be posted here once they are published.</p>
                    </div>
                `;
            } else if (!Array.isArray(ride.groups) || ride.groups.length === 0) {
                html += `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 16px;">No groups assigned yet</p>
                        <p style="font-size: 14px; margin-top: 8px;">Go to Practice Planner to assign riders and coaches.</p>
                    </div>
                `;
            } else {
                html += '<div class="mobile-assignment-groups">';
                
                // Sort groups sequentially by label (Group 1, Group 2, etc.)
                const sortedGroups = [...ride.groups].sort((a, b) => {
                    const labelA = a.label || '';
                    const labelB = b.label || '';
                    // Extract numbers from labels for comparison
                    const numA = parseInt(labelA.replace(/\D/g, '')) || 0;
                    const numB = parseInt(labelB.replace(/\D/g, '')) || 0;
                    return numA - numB;
                });
                
                sortedGroups.forEach((group, index) => {
                    const groupId = `group-${group.id || index}`;
                    const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                    const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                    const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                    const extraRoam = Array.isArray(group.coaches?.extraRoam) 
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean)
                        : [];
                    
                    const allCoaches = [leader, sweep, roam, ...extraRoam].filter(Boolean);
                    const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                    const route = group.routeId ? getRouteById(group.routeId) : null;
                    
                    // Build coaches with their roles
                    const coachesWithRoles = [];
                    if (leader) coachesWithRoles.push({ coach: leader, role: 'Leader' });
                    if (sweep) coachesWithRoles.push({ coach: sweep, role: 'Sweep' });
                    if (roam) coachesWithRoles.push({ coach: roam, role: 'Roam' });
                    extraRoam.forEach(coach => {
                        coachesWithRoles.push({ coach, role: 'Roam+' });
                    });
                    
                    html += `
                        <div class="mobile-group-card" style="margin-bottom: 0; border: 1px solid #ddd; border-radius: 0; overflow: hidden; background: white; border-top: ${index === 0 ? '1px solid #ddd' : 'none'};">
                            <button class="mobile-group-header" onclick="toggleMobileGroup('${groupId}')" style="width: 100%; padding: 8px 16px; background: #f5f5f5; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600; color: #333;">
                                <span>${escapeHtml((group.customName && group.useCustomNameForRiders !== false) ? (group.label + ' (' + group.customName + ')') : (group.label || `Group ${index + 1}`))}</span>
                                <span class="mobile-group-toggle" id="toggle-${groupId}" style="font-size: 20px; transition: transform 0.2s;">▼</span>
                            </button>
                            <div class="mobile-group-content" id="${groupId}" style="display: none; padding: 16px;">
                                ${riders.length > 0 ? `
                                    <div style="margin-bottom: ${coachesWithRoles.length > 0 ? '20px' : '0'};">
                                        <div class="roster-grid" style="display: flex; flex-direction: column; gap: 2px;">
                                            ${riders.map(rider => {
                                                // Render rider card without any badges
                                                return renderRiderCardHtml(rider, { compact: true, draggable: false, showMoveControls: false, sortBy: 'name', hideBadges: true });
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${coachesWithRoles.length > 0 ? `
                                    <div style="margin-top: ${riders.length > 0 ? '20px' : '0'}; margin-bottom: 16px;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;">Ride Leaders</h3>
                                        <div class="roster-grid" style="display: flex; flex-direction: column; gap: 2px;">
                                            ${coachesWithRoles.map(({ coach, role }) => {
                                                // Build coach card matching rider card structure exactly
                                                // Remove background colors for coaches in rider assignments tab
                                                const name = coach.name || 'Coach';
                                                const safeName = escapeHtml(name);
                                                const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
                                                const photo = coach.photo ? escapeHtml(coach.photo) : '';
                                                const roleBadge = `<span class="badge badge-level" style="background: #e3f2fd; color: #1976D2;">${escapeHtml(role)}</span>`;
                                                return `
                                                    <div class="coach-card compact" style="background: transparent !important;">
                                                        <div class="avatar-circle coach">
                                                            ${photo ? `<img class="avatar-image" src="${photo}" alt="${safeName} photo">` : `<span class="avatar-placeholder">${initial}</span>`}
                                                        </div>
                                                        <div class="card-body">
                                                            <strong>${safeName}</strong>
                                                            <span class="badge-single">${roleBadge}</span>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${route ? (() => {
                                    // Try to get Strava URL from stored field or extract from embed code
                                    let stravaUrl = route.stravaUrl;
                                    if (!stravaUrl && route.stravaEmbedCode) {
                                        // Try to extract URL from embed code
                                        const urlMatch = route.stravaEmbedCode.match(/https?:\/\/[^\s"'<>]+strava\.com[^\s"'<>]*/i);
                                        if (urlMatch) {
                                            stravaUrl = urlMatch[0];
                                        }
                                    }
                                    return `
                                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                                            <strong style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">Route:</strong>
                                            <div style="font-size: 14px; color: #333;">
                                                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(route.name || 'Unnamed Route')}</div>
                                                ${route.distance || route.elevation ? `
                                                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                                        ${route.distance ? `<span>${escapeHtml(route.distance)}</span>` : ''}
                                                        ${route.distance && route.elevation ? ' · ' : ''}
                                                        ${route.elevation ? `<span>${escapeHtml(route.elevation)}</span>` : ''}
                                                    </div>
                                                ` : ''}
                                                ${stravaUrl ? `
                                                    <a href="${escapeHtml(stravaUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; font-size: 12px; color: #FC4C02; text-decoration: none; font-weight: 500;">
                                                        View Full Map on Strava →
                                                    </a>
                                                ` : route.stravaEmbedCode ? `
                                                    <div style="font-size: 11px; color: #999; margin-top: 4px; font-style: italic;">
                                                        (Strava link not available - route may need to be re-saved)
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                })() : ''}
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
            }

            container.innerHTML = html;
            truncateOverflowingNames();
            
            // Load weather data if location is available
            if (locationLat && locationLng && rideDate && practiceTime) {
                loadWeatherForPractice(locationLat, locationLng, rideDate, practiceTime, 'weather');
            } else {
                const weatherEl = document.getElementById('weather-loading');
                if (weatherEl) {
                    weatherEl.textContent = 'Weather unavailable (location or time not set)';
                }
                const precipEl = document.getElementById('weather-precip');
                if (precipEl) {
                    precipEl.textContent = '--';
                }
                const alertsEl = document.getElementById('weather-alerts');
                if (alertsEl) {
                    alertsEl.textContent = '';
                }
            }
        }
        
        async function loadWeatherForPractice(lat, lng, date, time, targetPrefix = 'weather') {
            const weatherEl = document.getElementById(`${targetPrefix}-loading`);
            const precipEl = document.getElementById(`${targetPrefix}-precip`);
            const alertsEl = document.getElementById(`${targetPrefix}-alerts`);
            if (!weatherEl) return;
            
            try {
                // Calculate the practice date/time
                const practiceDateTime = new Date(date);
                const [hours, minutes] = time.split(':').map(Number);
                practiceDateTime.setHours(hours || 15, minutes || 30, 0, 0);
                
                // Use a free weather API - OpenWeatherMap requires API key
                // For now, we'll use a simple approach with Open-Meteo (free, no API key needed)
                // This provides basic weather forecasts
                const now = new Date();
                const daysUntilPractice = Math.ceil((practiceDateTime - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntilPractice < 0) {
                    weatherEl.textContent = 'Practice date has passed';
                    if (precipEl) precipEl.textContent = '--';
                    if (alertsEl) alertsEl.textContent = '';
                    return;
                }
                
                if (daysUntilPractice > 7) {
                    weatherEl.textContent = 'Weather forecast available up to 7 days ahead';
                    if (precipEl) precipEl.textContent = '--';
                    if (alertsEl) alertsEl.textContent = '';
                    return;
                }
                
                // Use Open-Meteo API (free, no API key required)
                // Request temperature in Fahrenheit and use practice location coordinates
                const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode,precipitation_probability&forecast_days=7&timezone=auto&temperature_unit=fahrenheit&alerts=all`;
                
                // Debug: Log the location being used for weather lookup
                const ride = getNextUpcomingRide();
                if (ride) {
                    const practice = getPracticeSettingsForRide(ride);
                    const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
                    console.log('🌤️ Weather lookup:', { lat, lng, date, time, practiceLocation, rideLocation: ride.locationLat || ride.locationLng ? 'from ride' : 'from practice settings' });
                }
                
                const response = await fetch(forecastUrl);
                const data = await response.json();
                
                if (data.hourly && data.hourly.time && data.hourly.temperature_2m) {
                    // Find the closest hour to practice time
                    const practiceHour = practiceDateTime.getHours();
                    const practiceDateStr = practiceDateTime.toISOString().split('T')[0];
                    
                    // Find matching time slot
                    let closestIndex = -1;
                    let minDiff = Infinity;
                    
                    data.hourly.time.forEach((timeStr, index) => {
                        if (timeStr.startsWith(practiceDateStr)) {
                            const hour = new Date(timeStr).getHours();
                            const diff = Math.abs(hour - practiceHour);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closestIndex = index;
                            }
                        }
                    });
                    
                    if (closestIndex >= 0) {
                        const temp = Math.round(data.hourly.temperature_2m[closestIndex]);
                        const weatherCode = data.hourly.weathercode[closestIndex];
                        const precipChance = data.hourly.precipitation_probability
                            ? Math.round(data.hourly.precipitation_probability[closestIndex])
                            : null;
                        
                        // Convert weather code to description
                        const weatherDescriptions = {
                            0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
                            45: 'Foggy', 48: 'Depositing rime fog',
                            51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                            56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
                            61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                            66: 'Light freezing rain', 67: 'Heavy freezing rain',
                            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
                            77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers',
                            82: 'Violent rain showers', 85: 'Slight snow showers', 86: 'Heavy snow showers',
                            95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
                        };
                        
                        const description = weatherDescriptions[weatherCode] || 'Unknown';
                        weatherEl.textContent = `${temp}°F, ${description}`;
                        if (precipEl) {
                            precipEl.textContent = Number.isFinite(precipChance) ? `${precipChance}% chance` : 'N/A';
                        }
                        if (alertsEl) {
                            const alerts = Array.isArray(data.alerts) ? data.alerts : [];
                            if (alerts.length > 0) {
                                const alertTitles = alerts
                                    .map(alert => alert.event || alert.title || alert.description)
                                    .filter(Boolean);
                                alertsEl.textContent = alertTitles.length > 0
                                    ? `Alerts: ${alertTitles.join(' • ')}`
                                    : 'Weather alerts issued for this area';
                            } else {
                                alertsEl.textContent = '';
                            }
                        }
                    } else {
                        weatherEl.textContent = 'Weather forecast not available for this time';
                        if (precipEl) precipEl.textContent = '--';
                        if (alertsEl) alertsEl.textContent = '';
                    }
                } else {
                    weatherEl.textContent = 'Weather data unavailable';
                    if (precipEl) precipEl.textContent = '--';
                    if (alertsEl) alertsEl.textContent = '';
                }
            } catch (error) {
                console.error('Error loading weather:', error);
                if (weatherEl) weatherEl.textContent = 'Weather unavailable';
                if (precipEl) precipEl.textContent = '--';
                if (alertsEl) alertsEl.textContent = '';
            }
        }

        function toggleMobileGroup(groupId) {
            const content = document.getElementById(groupId);
            const toggle = document.getElementById(`toggle-${groupId}`);
            
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▲' : '▼';
            toggle.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        // ============ COACH ASSIGNMENTS (MOBILE-FRIENDLY) ============

        async function renderCoachAssignments() {
            const container = document.getElementById('coach-assignments-container');
            if (!container) return;

            const ride = getNextUpcomingRide();
            
            // Check and auto-unpublish if 12 hours have passed
            if (ride) {
                await checkAndAutoUnpublish(ride);
            }
            
            if (!ride) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 18px; margin-bottom: 8px;">No upcoming ride scheduled</p>
                        <p style="font-size: 14px;">Check the Practice Planner to add practices.</p>
                    </div>
                `;
                return;
            }

            const rideDate = parseISODate(ride.date);
            const dateDisplay = rideDate ? rideDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ride.date;
            const goals = (ride.goals || '').trim();
            
            // Get practice time and location
            const practice = getPracticeSettingsForRide(ride);
            const practiceTime = ride.startTime || ride.time || (practice ? practice.time : '');
            const practiceEndTime = ride.endTime || (practice ? practice.endTime : '');
            const practiceLocation = ride.meetLocation || (practice ? practice.meetLocation : '');
            const locationLat = ride.locationLat || (practice ? practice.locationLat : null);
            const locationLng = ride.locationLng || (practice ? practice.locationLng : null);
            
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
            
            // Always show goals at the top (visible regardless of which groups are opened)
            let html = `
                <div style="margin-bottom: 24px;">
                    <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #333;">${escapeHtml(dateDisplay)}</h2>
                    <div style="margin-bottom: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 14px; color: #555;">
                        ${timeDisplay ? `<div style="margin-bottom: 6px;"><strong>Time:</strong> ${escapeHtml(timeDisplay)}</div>` : ''}
                        ${practiceLocation ? `<div style="margin-bottom: 6px;"><strong>Location:</strong> ${escapeHtml(practiceLocation)}</div>` : ''}
                        <div id="coach-practice-weather" style="margin-top: ${timeDisplay || practiceLocation ? '6px' : '0'};">
                            <div><strong>Weather:</strong> <span id="coach-weather-loading">Loading...</span></div>
                            <div><strong>Precip:</strong> <span id="coach-weather-precip">--</span></div>
                            <div id="coach-weather-alerts" style="margin-top: 4px; color: #b00020;"></div>
                        </div>
                    </div>
                    ${goals ? `<div style="padding: 12px; background: #e3f2fd; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 16px;">
                        <strong style="display: block; margin-bottom: 4px; color: #1976D2;">Practice Goals:</strong>
                        <span style="color: #555;">${escapeHtml(goals)}</span>
                    </div>` : ''}
                </div>
            `;

            // Check if groups are published
            if (!ride.publishedGroups) {
                html += `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 18px; margin-bottom: 8px;">Group Assignments Pending</p>
                        <p style="font-size: 14px; color: #999;">Group assignments will be posted here once they are published.</p>
                    </div>
                `;
            } else if (!Array.isArray(ride.groups) || ride.groups.length === 0) {
                html += `
                    <div style="text-align: center; padding: 40px 20px; color: #666;">
                        <p style="font-size: 16px;">No groups assigned yet</p>
                        <p style="font-size: 14px; margin-top: 8px;">Go to Practice Planner to assign riders and coaches.</p>
                    </div>
                `;
            } else {
                html += '<div class="mobile-assignment-groups">';
                
                // Sort groups sequentially by label (Group 1, Group 2, etc.)
                const sortedGroups = [...ride.groups].sort((a, b) => {
                    const labelA = a.label || '';
                    const labelB = b.label || '';
                    // Extract numbers from labels for comparison
                    const numA = parseInt(labelA.replace(/\D/g, '')) || 0;
                    const numB = parseInt(labelB.replace(/\D/g, '')) || 0;
                    return numA - numB;
                });
                
                sortedGroups.forEach((group, index) => {
                    const groupId = `coach-group-${group.id || index}`;
                    const leader = group.coaches?.leader ? getCoachById(group.coaches.leader) : null;
                    const sweep = group.coaches?.sweep ? getCoachById(group.coaches.sweep) : null;
                    const roam = group.coaches?.roam ? getCoachById(group.coaches.roam) : null;
                    const extraRoam = Array.isArray(group.coaches?.extraRoam) 
                        ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean)
                        : [];
                    
                    const allCoaches = [leader, sweep, roam, ...extraRoam].filter(Boolean);
                    const riders = (group.riders || []).map(id => getRiderById(id)).filter(Boolean);
                    const route = group.routeId ? getRouteById(group.routeId) : null;
                    
                    // Build coaches with their roles
                    const coachesWithRoles = [];
                    if (leader) coachesWithRoles.push({ coach: leader, role: 'Leader' });
                    if (sweep) coachesWithRoles.push({ coach: sweep, role: 'Sweep' });
                    if (roam) coachesWithRoles.push({ coach: roam, role: 'Roam' });
                    extraRoam.forEach(coach => {
                        coachesWithRoles.push({ coach, role: 'Roam+' });
                    });
                    
                    // Check group compliance for header color
                    const isCompliant = checkGroupCompliance(group);
                    const headerColor = isCompliant ? '#2196F3' : '#d32f2f'; // Blue if compliant, red if not
                    
                    html += `
                        <div class="mobile-group-card" style="margin-bottom: 0; border: 1px solid #ddd; border-radius: 0; overflow: hidden; background: white; border-top: ${index === 0 ? '1px solid #ddd' : 'none'};">
                            <button class="mobile-group-header" onclick="toggleMobileGroup('${groupId}')" style="width: 100%; padding: 8px 16px; background: ${headerColor}; color: white; border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 600;">
                                <span>${escapeHtml((group.customName && group.useCustomNameForCoaches !== false) ? (group.label + ' (' + group.customName + ')') : (group.label || `Group ${index + 1}`))}</span>
                                <span class="mobile-group-toggle" id="toggle-${groupId}" style="font-size: 20px; transition: transform 0.2s; color: white;">▼</span>
                            </button>
                            <div class="mobile-group-content" id="${groupId}" style="display: none; padding: 16px;">
                                ${coachesWithRoles.length > 0 ? `
                                    <div style="margin-bottom: ${riders.length > 0 ? '20px' : '0'};">
                                        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;">Ride Leaders</h3>
                                        <div class="roster-grid" style="display: flex; flex-direction: column; gap: 2px;">
                                            ${coachesWithRoles.map(({ coach, role }) => {
                                                // Build coach card matching rider card structure exactly
                                                const name = coach.name || 'Coach';
                                                const safeName = escapeHtml(name);
                                                const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
                                                const photo = coach.photo ? escapeHtml(coach.photo) : '';
                                                const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                                                const levelNum = levelRaw === 'N/A' ? 0 : parseInt(levelRaw || '1', 10);
                                                const classes = ['coach-card', 'compact'];
                                                if (levelNum === 1) classes.push('coach-level-1');
                                                else if (levelNum === 2) classes.push('coach-level-2');
                                                else if (levelNum === 3) classes.push('coach-level-3');
                                                const roleBadge = `<span class="badge badge-level" style="background: #e3f2fd; color: #1976D2;">${escapeHtml(role)}</span>`;
                                                // Get coach phone number
                                                const coachPhone = coach.phone || coach.mobile || '';
                                                const coachPhoneLink = coachPhone ? `tel:${coachPhone.replace(/[^\d+]/g, '')}` : '';
                                                
                                                return `
                                                    <div class="${classes.join(' ')}" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; position: relative;">
                                                        <div class="avatar-circle coach">
                                                            ${photo ? `<img class="avatar-image" src="${photo}" alt="${safeName} photo">` : `<span class="avatar-placeholder">${initial}</span>`}
                                                        </div>
                                                        <strong style="flex: 1; min-width: 0;">${safeName}</strong>
                                                        <div style="flex-shrink: 0; margin-left: auto; margin-right: 4px;">
                                                            <span class="badge-single">${roleBadge}</span>
                                                        </div>
                                                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                                            ${coachPhoneLink ? `
                                                                <a href="${escapeHtml(coachPhoneLink)}" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #4CAF50; color: white; text-decoration: none; flex-shrink: 0;" title="Call ${safeName}">
                                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                                    </svg>
                                                                </a>
                                                            ` : ''}
                                                            <button onclick="showCoachAssignmentMenu(event, 'coach', ${coach.id}, ${group.id}, '${escapeHtml(role)}')" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: transparent; border: none; cursor: pointer; flex-shrink: 0; padding: 0; color: #666;" title="Menu">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                    <circle cx="12" cy="12" r="1"></circle>
                                                                    <circle cx="12" cy="5" r="1"></circle>
                                                                    <circle cx="12" cy="19" r="1"></circle>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${riders.length > 0 ? `
                                    <div style="margin-top: ${coachesWithRoles.length > 0 ? '20px' : '0'};">
                                        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase;">Riders (${riders.length})</h3>
                                        <div class="roster-grid" style="display: flex; flex-direction: column; gap: 2px;">
                                            ${riders.map(rider => {
                                                // Custom rendering for coach assignments tab with phone, fitness, and skills
                                                const name = rider.name || 'Rider';
                                                const safeName = escapeHtml(name);
                                                const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
                                                const photoSrc = rider.photo;
                                                let photo = '';
                                                if (photoSrc && (photoSrc.startsWith('data:') || photoSrc.startsWith('http') || photoSrc.startsWith('assets/'))) {
                                                    photo = escapeHtml(photoSrc);
                                                } else {
                                                    const gender = (rider.gender || '').toUpperCase();
                                                    if (gender === 'M') photo = 'assets/male_default.png';
                                                    else if (gender === 'F') photo = 'assets/female_default.png';
                                                    else photo = 'assets/nonbinary_default.png';
                                                }
                                                
                                                const fitnessScale = getFitnessScale();
                                                const fitness = Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10)));
                                                const skillsScale = getSkillsScale();
                                                const skills = Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10)));
                                                const skillsTooltip = getBikeSkillsTooltip(skills, skillsScale);
                                                
                                                // Get phone number
                                                const phone = rider.phone || rider.mobile || '';
                                                const phoneLink = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';
                                                
                                                const medicalIcon = getMedicalIconHtml(rider.allergiesOrMedicalNeeds || rider.medicalNotes || '');
                                                return `
                                                    <div class="rider-card compact" style="border: none !important; border-style: none !important; display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; position: relative;">
                                                        <div class="avatar-circle">
                                                            ${photo ? `<img class="avatar-image" src="${escapeHtml(photo)}" alt="${safeName} photo">` : `<span class="avatar-placeholder">${initial}</span>`}
                                                        </div>
                                                        <strong style="flex: 1; min-width: 0;">${safeName}${medicalIcon}</strong>
                                                        <div style="display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; margin-left: auto; margin-right: 4px;">
                                                            <span class="badge badge-pace-${fitness}">❤${fitness}</span>
                                                            <span class="badge badge-skills-${skills}" title="${getBikeSkillsTooltip(skills, getSkillsScale()).replace(/\n/g, '&#10;')}" style="cursor: help;">${skills}◣</span>
                                                        </div>
                                                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                                            ${phoneLink ? `
                                                                <a href="${escapeHtml(phoneLink)}" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #4CAF50; color: white; text-decoration: none; flex-shrink: 0;" title="Call ${safeName}">
                                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                                    </svg>
                                                                </a>
                                                            ` : ''}
                                                            <button onclick="showCoachAssignmentMenu(event, 'rider', ${rider.id}, ${group.id})" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: transparent; border: none; cursor: pointer; flex-shrink: 0; padding: 0; color: #666;" title="Menu">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                    <circle cx="12" cy="12" r="1"></circle>
                                                                    <circle cx="12" cy="5" r="1"></circle>
                                                                    <circle cx="12" cy="19" r="1"></circle>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                
                                ${route ? (() => {
                                    // Try to get Strava URL from stored field or extract from embed code
                                    let stravaUrl = route.stravaUrl;
                                    if (!stravaUrl && route.stravaEmbedCode) {
                                        // Try to extract URL from embed code
                                        const urlMatch = route.stravaEmbedCode.match(/https?:\/\/[^\s"'<>]+strava\.com[^\s"'<>]*/i);
                                        if (urlMatch) {
                                            stravaUrl = urlMatch[0];
                                        }
                                    }
                                    return `
                                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                                            <strong style="display: block; margin-bottom: 8px; font-size: 14px; color: #666;">Route:</strong>
                                            <div style="font-size: 14px; color: #333;">
                                                <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(route.name || 'Unnamed Route')}</div>
                                                ${route.distance || route.elevation ? `
                                                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                                        ${route.distance ? `<span>${escapeHtml(route.distance)}</span>` : ''}
                                                        ${route.distance && route.elevation ? ' · ' : ''}
                                                        ${route.elevation ? `<span>${escapeHtml(route.elevation)}</span>` : ''}
                                                    </div>
                                                ` : ''}
                                                ${stravaUrl ? `
                                                    <a href="${escapeHtml(stravaUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; font-size: 12px; color: #FC4C02; text-decoration: none; font-weight: 500;">
                                                        View Full Map on Strava →
                                                    </a>
                                                ` : route.stravaEmbedCode ? `
                                                    <div style="font-size: 11px; color: #999; margin-top: 4px; font-style: italic;">
                                                        (Strava link not available - route may need to be re-saved)
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                })() : ''}
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
            }

            container.innerHTML = html;
            truncateOverflowingNames();
            
            // Load weather data if location is available
            if (locationLat && locationLng && rideDate && practiceTime) {
                loadWeatherForPractice(locationLat, locationLng, rideDate, practiceTime, 'coach-weather');
            } else {
                const weatherEl = document.getElementById('coach-weather-loading');
                if (weatherEl) {
                    weatherEl.textContent = 'Weather unavailable (location or time not set)';
                }
                const precipEl = document.getElementById('coach-weather-precip');
                if (precipEl) {
                    precipEl.textContent = '--';
                }
                const alertsEl = document.getElementById('coach-weather-alerts');
                if (alertsEl) {
                    alertsEl.textContent = '';
                }
            }
        }

        // ============ COACH ASSIGNMENTS CONTEXT MENU ============

        function showCoachAssignmentMenu(event, type, id, groupId, role = null) {
            event.stopPropagation();
            event.preventDefault();
            
            // Remove any existing context menu
            const existingMenu = document.getElementById('coach-assignment-context-menu');
            if (existingMenu) {
                existingMenu.remove();
            }
            
            // Create context menu
            const menu = document.createElement('div');
            menu.id = 'coach-assignment-context-menu';
            menu.style.cssText = `
                position: fixed;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                min-width: 150px;
                padding: 4px 0;
            `;
            
            // Position menu to the left of the button (so it doesn't go off screen)
            const rect = event.target.closest('button').getBoundingClientRect();
            menu.style.right = `${window.innerWidth - rect.right}px`;
            menu.style.top = `${rect.top}px`;
            
            // Add menu items
            const items = [
                { label: 'Absent', action: () => handleAbsent(type, id, groupId, role) },
                { label: 'Moved', action: () => handleMoved(type, id, groupId, role) }
            ];
            
            items.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #333;
                `;
                menuItem.onmouseenter = () => menuItem.style.background = '#f5f5f5';
                menuItem.onmouseleave = () => menuItem.style.background = 'transparent';
                menuItem.onclick = (e) => {
                    e.stopPropagation();
                    item.action();
                    menu.remove();
                };
                menu.appendChild(menuItem);
            });
            
            document.body.appendChild(menu);
            
            // Close menu when clicking outside
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== event.target) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }
        
        function handleAbsent(type, id, groupId, role) {
            const ride = getNextUpcomingRide();
            if (!ride || !ride.groups) return;
            
            const group = ride.groups.find(g => g.id === groupId);
            if (!group) return;
            
            // Get name for confirmation
            const name = type === 'rider' 
                ? (getRiderById(id)?.name || 'Rider')
                : (getCoachById(id)?.name || 'Coach');
            
            // Confirm before marking as absent
            if (!confirm(`Are you sure ${escapeHtml(name)} is absent?`)) {
                return;
            }
            
            if (type === 'rider') {
                // Remove rider from group
                group.riders = group.riders.filter(riderId => riderId !== id);
                // Remove from available riders
                if (ride.availableRiders) {
                    ride.availableRiders = ride.availableRiders.filter(riderId => riderId !== id);
                }
            } else if (type === 'coach') {
                // Remove coach from group based on role
                if (role === 'Leader') {
                    group.coaches.leader = null;
                } else if (role === 'Sweep') {
                    group.coaches.sweep = null;
                } else if (role === 'Roam') {
                    group.coaches.roam = null;
                } else if (role === 'Roam+') {
                    if (Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = group.coaches.extraRoam.filter(coachId => coachId !== id);
                    }
                }
                // Remove from available coaches
                if (ride.availableCoaches) {
                    ride.availableCoaches = ride.availableCoaches.filter(coachId => coachId !== id);
                }
            }
            
            // Save and re-render
            saveRideToDB(ride);
            renderCoachAssignments();
        }
        
        function handleMoved(type, id, groupId, role) {
            const ride = getNextUpcomingRide();
            if (!ride || !ride.groups) return;
            
            const sourceGroup = ride.groups.find(g => g.id === groupId);
            if (!sourceGroup) return;
            
            // Get other groups (excluding current group)
            const otherGroups = ride.groups.filter(g => g.id !== groupId);
            
            if (otherGroups.length === 0) {
                alert('No other groups available to move to.');
                return;
            }
            
            // Create dialog
            const dialog = document.createElement('div');
            dialog.id = 'move-assignment-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2196F3;
                border: 1px solid #1976D2;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10001;
                padding: 20px;
                min-width: 300px;
                max-width: 90%;
            `;
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
            `;
            
            const name = type === 'rider' 
                ? (getRiderById(id)?.name || 'Rider')
                : (getCoachById(id)?.name || 'Coach');
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px; color: white;">Move ${escapeHtml(name)}</h3>
                <p style="margin: 0 0 16px 0; color: rgba(255,255,255,0.9); font-size: 14px;">Select destination group:</p>
                <div style="margin-bottom: 16px;">
                    ${otherGroups.map(g => `
                        <button onclick="completeMove('${type}', ${id}, ${groupId}, ${g.id}, '${role || ''}')" 
                                style="display: block; width: 100%; padding: 12px; margin-bottom: 8px; text-align: left; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer; font-size: 14px; color: white;">
                            ${escapeHtml(g.label || `Group ${ride.groups.indexOf(g) + 1}`)}
                        </button>
                    `).join('')}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button onclick="closeMoveDialog()" class="btn-small secondary" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white;">Cancel</button>
                </div>
            `;
            
            overlay.onclick = closeMoveDialog;
            document.body.appendChild(overlay);
            document.body.appendChild(dialog);
            
            // Store dialog references globally for cleanup
            window.currentMoveDialog = dialog;
            window.currentMoveOverlay = overlay;
        }
        
        function completeMove(type, id, sourceGroupId, targetGroupId, role) {
            const ride = getNextUpcomingRide();
            if (!ride || !ride.groups) return;
            
            const sourceGroup = ride.groups.find(g => g.id === sourceGroupId);
            const targetGroup = ride.groups.find(g => g.id === targetGroupId);
            
            if (!sourceGroup || !targetGroup) return;
            
            if (type === 'rider') {
                // Remove from source group
                sourceGroup.riders = sourceGroup.riders.filter(riderId => riderId !== id);
                // Add to target group
                if (!targetGroup.riders.includes(id)) {
                    targetGroup.riders.push(id);
                }
            } else if (type === 'coach') {
                // Remove from source group based on role
                if (role === 'Leader') {
                    sourceGroup.coaches.leader = null;
                } else if (role === 'Sweep') {
                    sourceGroup.coaches.sweep = null;
                } else if (role === 'Roam') {
                    sourceGroup.coaches.roam = null;
                } else if (role === 'Roam+') {
                    if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                        sourceGroup.coaches.extraRoam = sourceGroup.coaches.extraRoam.filter(coachId => coachId !== id);
                    }
                }
                
                // Add to target group (assign to first available role)
                if (!targetGroup.coaches.leader) {
                    targetGroup.coaches.leader = id;
                } else if (!targetGroup.coaches.sweep) {
                    targetGroup.coaches.sweep = id;
                } else if (!targetGroup.coaches.roam) {
                    targetGroup.coaches.roam = id;
                } else {
                    if (!Array.isArray(targetGroup.coaches.extraRoam)) {
                        targetGroup.coaches.extraRoam = [];
                    }
                    if (!targetGroup.coaches.extraRoam.includes(id)) {
                        targetGroup.coaches.extraRoam.push(id);
                    }
                }
            }
            
            // Save and re-render
            saveRideToDB(ride);
            renderCoachAssignments();
            closeMoveDialog();
        }
        
        function closeMoveDialog() {
            if (window.currentMoveDialog) {
                window.currentMoveDialog.remove();
                window.currentMoveDialog = null;
            }
            if (window.currentMoveOverlay) {
                window.currentMoveOverlay.remove();
                window.currentMoveOverlay = null;
            }
        }
