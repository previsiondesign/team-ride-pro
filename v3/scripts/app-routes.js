// app-routes.js — Route CRUD, Strava integration, route modal, slider controls

        // ============ ROUTES MANAGEMENT ============

        // Helper functions for parsing route values for sorting
        function parseDistance(distStr) {
            if (!distStr) return 0;
            const match = distStr.match(/([\d.]+)/);
            return match ? parseFloat(match[1]) : 0;
        }

        function parseElevation(elevStr) {
            if (!elevStr) return 0;
            const match = elevStr.replace(/,/g, '').match(/([\d.]+)/);
            return match ? parseFloat(match[1]) : 0;
        }

        function parseTime(timeStr) {
            if (!timeStr) return 0;
            // Handle formats like "1:30:00", "1h 30m", "90:00", etc.
            const parts = timeStr.match(/(\d+)/g);
            if (!parts) return 0;
            
            if (parts.length === 3) {
                // HH:MM:SS format
                return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
            } else if (parts.length === 2) {
                // MM:SS or HH:MM format
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else if (parts.length === 1) {
                // Single number (minutes)
                return parseInt(parts[0]) * 60;
            }
            return 0;
        }

        function parseTimeMidpoint(timeStr) {
            if (!timeStr || timeStr === 'N/A') return 0;
            
            // Handle time ranges like "1:30:00 - 2:00:00" or "1:30-2:00"
            const rangeMatch = timeStr.match(/(.+?)\s*-\s*(.+)/);
            if (rangeMatch) {
                const time1 = parseTime(rangeMatch[1].trim());
                const time2 = parseTime(rangeMatch[2].trim());
                // Return midpoint
                return (time1 + time2) / 2;
            }
            
            // Single time value
            return parseTime(timeStr);
        }

        function getRoutesViewMode() { return 'list'; }
        function setRoutesViewMode() {}
        function updateRoutesViewToggle() {}

        const _collapsedRouteGroups = new Set();
        let _lastRouteGroupBy = 'none';

        function getDistanceGroup(distStr) {
            const miles = parseDistance(distStr);
            if (miles < 5) return { label: 'Under 5 miles', order: 0 };
            const low = Math.floor(miles / 5) * 5;
            const high = low + 5;
            return { label: `${low}–${high} miles`, order: low };
        }

        function getElevationGroup(elevStr) {
            const ft = parseElevation(elevStr);
            if (ft < 500) return { label: 'Under 500 ft', order: 0 };
            const low = Math.floor(ft / 500) * 500;
            const high = low + 500;
            return { label: `${low.toLocaleString()}–${high.toLocaleString()} ft`, order: low };
        }

        function groupRoutes(routes, groupBy, ascending) {
            const groups = new Map();
            routes.forEach(route => {
                let key, label, order;
                if (groupBy === 'start') {
                    label = route.startLocation || 'Unknown';
                    key = label.toLowerCase();
                    order = key;
                } else if (groupBy === 'distance') {
                    const g = getDistanceGroup(route.distance);
                    label = g.label;
                    key = String(g.order);
                    order = g.order;
                } else if (groupBy === 'elevation') {
                    const g = getElevationGroup(route.elevation);
                    label = g.label;
                    key = String(g.order);
                    order = g.order;
                } else {
                    return;
                }
                if (!groups.has(key)) groups.set(key, { key, label, order, routes: [] });
                groups.get(key).routes.push(route);
            });

            const asc = ascending !== false;
            const sorted = [...groups.values()];
            sorted.sort((a, b) => {
                if (typeof a.order === 'string') {
                    return asc ? a.order.localeCompare(b.order) : b.order.localeCompare(a.order);
                }
                return asc ? a.order - b.order : b.order - a.order;
            });
            return sorted;
        }

        function toggleRouteGroupCollapse(event, groupKey) {
            event.stopPropagation();
            if (_collapsedRouteGroups.has(groupKey)) {
                _collapsedRouteGroups.delete(groupKey);
            } else {
                _collapsedRouteGroups.add(groupKey);
            }
            renderRoutes();
        }

        // Safari (and other browsers) limit WebGL contexts (~8). Each Strava route embed uses Mapbox = 1 context.
        // Cap live embeds so the Routes tab stays responsive; extra routes show a placeholder.
        // MAX_STRAVA_EMBEDS (from app-state.js)

        function setRoutesSortBy(value) {
            const sortBySelect = document.getElementById('routes-sort-by');
            if (sortBySelect) {
                // Add the option if it doesn't exist (for name/start sorts not in the dropdown)
                let option = sortBySelect.querySelector(`option[value="${value}"]`);
                if (!option) {
                    option = document.createElement('option');
                    option.value = value;
                    option.textContent = value; // hidden, not important
                    sortBySelect.appendChild(option);
                }
                sortBySelect.value = value;
            }
            renderRoutes();
        }

        function sortRoutesArray(routes, sortBy) {
            if (!Array.isArray(routes) || routes.length === 0) return routes;
            return [...routes].sort((a, b) => {
                let compareA, compareB;
                try {
                    if (sortBy.startsWith('name-')) {
                        compareA = (a.name || '').toLowerCase();
                        compareB = (b.name || '').toLowerCase();
                        return sortBy.endsWith('-asc') ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
                    } else if (sortBy.startsWith('start-')) {
                        compareA = (a.startLocation || '').toLowerCase();
                        compareB = (b.startLocation || '').toLowerCase();
                        return sortBy.endsWith('-asc') ? compareA.localeCompare(compareB) : compareB.localeCompare(compareA);
                    } else if (sortBy.startsWith('distance-')) {
                        compareA = parseDistance(a.distance || '0');
                        compareB = parseDistance(b.distance || '0');
                    } else if (sortBy.startsWith('elevation-')) {
                        compareA = parseElevation(a.elevation || '0');
                        compareB = parseElevation(b.elevation || '0');
                    } else {
                        return 0;
                    }
                    return sortBy.endsWith('-asc') ? compareA - compareB : compareB - compareA;
                } catch (error) {
                    return 0;
                }
            });
        }

        function renderRoutes() {
            const container = document.getElementById('routes-grid');
            if (!container) return;

            if (!Array.isArray(data.routes) || data.routes.length === 0) {
                container.innerHTML = '<div class="empty-state">No routes added yet. Click "Add New Route" to get started.</div>';
                return;
            }

            const sortBySelect = document.getElementById('routes-sort-by');
            const groupBySelect = document.getElementById('routes-group-by');
            const sortBy = sortBySelect ? sortBySelect.value : 'name-asc';
            const groupBy = groupBySelect ? groupBySelect.value : 'none';

            if (groupBy !== _lastRouteGroupBy) {
                _collapsedRouteGroups.clear();
                _lastRouteGroupBy = groupBy;
            }

            function sortHeader(label, colKey) {
                const isSorted = sortBy.startsWith(colKey + '-');
                const isAsc = sortBy === colKey + '-asc';
                const arrow = isSorted ? (isAsc ? ' ▲' : ' ▼') : '';
                const nextDir = isSorted && !isAsc ? 'asc' : (isSorted && isAsc ? 'desc' : 'asc');
                return `<th style="cursor: pointer; user-select: none; white-space: nowrap;" onclick="setRoutesSortBy('${colKey}-${nextDir}')">${label}${arrow}</th>`;
            }

            function buildRouteRow(route) {
                const name = escapeHtml(route.name || 'Untitled Route');
                const isStrava = !!route.stravaEmbedCode;
                const stravaIcon = isStrava ? '<img src="assets/strava_logo.png" alt="Strava" style="height: 16px; width: auto; vertical-align: middle; margin-right: 6px;">' : '';
                const previewBtn = isStrava
                    ? `<button class="btn-preview" onclick="event.stopPropagation(); previewStravaRoute(${route.id})" title="Preview Strava map">Preview</button>`
                    : '';
                const start = escapeHtml(route.startLocation || '—');
                const distance = escapeHtml(route.distance || 'N/A');
                const elevation = escapeHtml(route.elevation || 'N/A');
                return `<tr>
                    <td>
                        <span class="route-name-cell">
                            ${stravaIcon}${name}
                            <span class="route-name-actions">
                                ${previewBtn}
                                <span class="route-actions-menu-cell">
                                    <button class="route-menu-btn" onclick="toggleRouteMenu(event, ${route.id})" title="Options">⋯</button>
                                    <div class="route-menu-dropdown" id="route-menu-${route.id}">
                                        <div class="route-menu-item" onclick="openRouteAssignDialog(${route.id})">Assign Route</div>
                                        <div class="route-menu-item" onclick="openAddRouteModal(${route.id})">Edit Route</div>
                                        <div class="route-menu-separator"></div>
                                        <div class="route-menu-item route-menu-danger" onclick="deleteRouteHandler(${route.id})">Delete Route</div>
                                    </div>
                                </span>
                            </span>
                        </span>
                    </td>
                    <td>${start}</td>
                    <td>${distance}</td>
                    <td>${elevation}</td>
                </tr>`;
            }

            const theadHtml = `<thead><tr>
                ${sortHeader('Route Name', 'name')}
                ${sortHeader('Start', 'start')}
                ${sortHeader('Distance', 'distance')}
                ${sortHeader('Elev Gain', 'elevation')}
            </tr></thead>`;

            if (groupBy === 'none') {
                const allRoutes = sortRoutesArray(data.routes, sortBy);
                const rows = allRoutes.map(buildRouteRow).join('');
                container.innerHTML = `<div class="routes-list-table"><table>${theadHtml}<tbody>${rows}</tbody></table></div>`;
            } else {
                const allRoutes = sortRoutesArray(data.routes, sortBy);
                const groupSortMap = { start: 'start', distance: 'distance', elevation: 'elevation' };
                const matchingCol = groupSortMap[groupBy];
                const groupAsc = (matchingCol && sortBy.startsWith(matchingCol + '-')) ? sortBy.endsWith('-asc') : true;
                const groups = groupRoutes(allRoutes, groupBy, groupAsc);
                let bodyHtml = '';
                groups.forEach(g => {
                    const collapsed = _collapsedRouteGroups.has(g.key);
                    const chevron = collapsed ? '▸' : '▾';
                    const safeKey = escapeHtml(g.key).replace(/'/g, "\\'");
                    bodyHtml += `<tr class="route-group-header" ondblclick="toggleRouteGroupCollapse(event, '${safeKey}')">
                        <td colspan="4">
                            <span class="route-group-header-inner">
                                <span>${escapeHtml(g.label)} (${g.routes.length})</span>
                                <button class="route-group-collapse-btn" onclick="toggleRouteGroupCollapse(event, '${safeKey}')" title="${collapsed ? 'Expand' : 'Collapse'}">${chevron}</button>
                            </span>
                        </td>
                    </tr>`;
                    if (!collapsed) {
                        bodyHtml += g.routes.map(buildRouteRow).join('');
                    }
                });
                container.innerHTML = `<div class="routes-list-table"><table>${theadHtml}<tbody>${bodyHtml}</tbody></table></div>`;
            }
        }

        let _routeMenuAutoCloseTimer = null;

        function _closeRouteMenu(menu) {
            menu.classList.remove('open', 'flip-up');
            clearTimeout(_routeMenuAutoCloseTimer);
        }

        function toggleRouteMenu(event, routeId) {
            event.stopPropagation();
            clearTimeout(_routeMenuAutoCloseTimer);
            const allMenus = document.querySelectorAll('.route-menu-dropdown.open');
            allMenus.forEach(m => { if (m.id !== 'route-menu-' + routeId) _closeRouteMenu(m); });
            const menu = document.getElementById('route-menu-' + routeId);
            if (!menu) return;
            const wasOpen = menu.classList.contains('open');
            menu.classList.remove('flip-up');
            menu.classList.toggle('open');
            if (!wasOpen) {
                const mRect = menu.getBoundingClientRect();
                if (mRect.bottom > window.innerHeight) {
                    menu.classList.add('flip-up');
                }
                const mRect2 = menu.getBoundingClientRect();
                if (mRect2.right > window.innerWidth) {
                    menu.style.right = '0';
                    menu.style.left = 'auto';
                }
                const scheduleClose = () => {
                    clearTimeout(_routeMenuAutoCloseTimer);
                    _routeMenuAutoCloseTimer = setTimeout(() => { if (menu.classList.contains('open')) _closeRouteMenu(menu); }, 2000);
                };
                menu.addEventListener('mouseenter', () => clearTimeout(_routeMenuAutoCloseTimer));
                menu.addEventListener('mouseleave', scheduleClose);
                scheduleClose();
            }
        }

        document.addEventListener('click', () => {
            document.querySelectorAll('.route-menu-dropdown.open').forEach(m => m.classList.remove('open', 'flip-up'));
        });

        function renderRouteCard(route, container, isManual = false, stravaIndex = 0) {
            const routeCard = document.createElement('div');
            // Force manual routes to span full width to appear below Strava routes
            if (isManual) {
                routeCard.style.cssText = 'width: 100%; margin-bottom: 0; grid-column: 1 / -1;';
            } else {
                routeCard.style.cssText = 'width: 420px; margin-bottom: 0;';
            }

            if (route.stravaEmbedCode && !isManual) {
                // Embed container - same size for cached image, live map, or placeholder (avoids WebGL exhaustion on Safari)
                const embedContainer = document.createElement('div');
                embedContainer.style.cssText = 'width: 420px; height: 284px; border: none; border-radius: 0; overflow: hidden; position: relative;';

                if (route.cachedPreviewDataUrl) {
                // Cached preview image – no WebGL, no live embed
                const img = document.createElement('img');
                img.src = route.cachedPreviewDataUrl;
                img.alt = route.name || 'Route map';
                img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
                img.loading = 'lazy';
                embedContainer.appendChild(img);
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
                    link.style.cssText = 'position: absolute; bottom: 8px; right: 8px; font-size: 11px; color: #fc4c02;';
                    link.textContent = 'View on Strava';
                    embedContainer.appendChild(link);
                }
                } else if (stravaIndex < MAX_STRAVA_EMBEDS) {
                // Live Strava embed (uses Mapbox/WebGL) – only first MAX_STRAVA_EMBEDS to stay under browser WebGL limit
                const embedWrapper = document.createElement('div');
                embedWrapper.style.cssText = 'transform: scale(0.7); transform-origin: top left; width: 142.86%; height: 142.86%; position: absolute; top: 0; left: 0;';
                const innerContainer = document.createElement('div');
                innerContainer.style.cssText = 'width: 100%; height: 405px; position: relative;';
                innerContainer.innerHTML = route.stravaEmbedCode;
                const scripts = innerContainer.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                if (innerContainer.querySelector('[data-embed-type="route"]') && 
                    !document.querySelector('script[src="https://strava-embeds.com/embed.js"]')) {
                    const stravaScript = document.createElement('script');
                    stravaScript.src = 'https://strava-embeds.com/embed.js';
                    stravaScript.onerror = () => { console.warn('Strava embed script failed to load'); };
                    document.head.appendChild(stravaScript);
                }
                embedWrapper.appendChild(innerContainer);
                embedContainer.appendChild(embedWrapper);
                } else {
                // Placeholder for extra Strava routes – no WebGL (keeps Safari responsive)
                const placeholder = document.createElement('div');
                placeholder.style.cssText = 'width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f0f0f0; color: #666; font-size: 13px; text-align: center; padding: 16px; box-sizing: border-box;';
                let stravaUrl = route.stravaUrl || '';
                if (!stravaUrl && route.stravaEmbedCode) {
                    const routeIdMatch = route.stravaEmbedCode.match(/data-embed-id\s*=\s*["']?(\d+)["']?/i);
                    if (routeIdMatch) stravaUrl = 'https://www.strava.com/routes/' + routeIdMatch[1];
                    else {
                        const iframeMatch = route.stravaEmbedCode.match(/src\s*=\s*["']([^"']*strava\.com[^"']*)["']/i);
                        if (iframeMatch) stravaUrl = iframeMatch[1].split('?')[0];
                    }
                }
                placeholder.innerHTML = `<span style="margin-bottom: 8px;">${escapeHtml(route.name || 'Route')}</span><span style="font-size: 11px; margin-bottom: 8px;">Map hidden to keep the page responsive.</span>${stravaUrl ? `<a href="${escapeHtml(stravaUrl)}" target="_blank" rel="noopener" style="color: #fc4c02;">View on Strava</a>` : ''}`;
                embedContainer.appendChild(placeholder);
                }

                routeCard.appendChild(embedContainer);
                
                // Add route info line below the map
                const routeInfoLine = document.createElement('div');
                routeInfoLine.style.cssText = 'margin-top: 8px; margin-bottom: 20px; font-size: 11px; color: #666; line-height: 1.4;';
                
                const fitnessScale = getFitnessScale();
                const skillsScale = getSkillsScale();
                const fitnessMin = route.fitnessMin !== undefined ? route.fitnessMin : 1;
                const fitnessMax = route.fitnessMax !== undefined ? route.fitnessMax : fitnessScale;
                const skillsMin = route.skillsMin !== undefined ? route.skillsMin : 1;
                const skillsMax = route.skillsMax !== undefined ? route.skillsMax : skillsScale;
                
                const fitnessRange = (fitnessMin === 1 && fitnessMax === fitnessScale) ? 'ALL' : `${fitnessMin}-${fitnessMax}`;
                const skillsRange = (skillsMin === 1 && skillsMax === skillsScale) ? 'ALL' : `${skillsMin}-${skillsMax}`;
                
                routeInfoLine.textContent = `Relative Pace Range: ${fitnessRange} | Bike Skills Range: ${skillsRange}`;
                routeCard.appendChild(routeInfoLine);
            } else {
                // For manual routes, show route info card instead of embed
                const routeInfoCard = document.createElement('div');
                routeInfoCard.style.cssText = 'padding: 20px; background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px;';
                routeInfoCard.innerHTML = `
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">${escapeHtml(route.name || 'Unnamed Route')}</div>
                    ${route.distance || route.elevation ? `
                                        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                                            ${route.distance ? `<span>${escapeHtml(route.distance)}</span>` : ''}
                                            ${route.distance && route.elevation ? ' · ' : ''}
                                            ${route.elevation ? `<span>${escapeHtml(route.elevation)}</span>` : ''}
                                        </div>
                                    ` : ''}
                    ${route.description ? `
                        <div style="font-size: 13px; color: #666; margin-top: 8px; line-height: 1.4;">${escapeHtml(route.description)}</div>
                    ` : ''}
                `;
                routeCard.appendChild(routeInfoCard);
                
                // Add route info line below the card
                const routeInfoLine = document.createElement('div');
                routeInfoLine.style.cssText = 'margin-top: 8px; margin-bottom: 20px; font-size: 11px; color: #666; line-height: 1.4;';
                
                const fitnessScale = getFitnessScale();
                const skillsScale = getSkillsScale();
                const fitnessMin = route.fitnessMin !== undefined ? route.fitnessMin : 1;
                const fitnessMax = route.fitnessMax !== undefined ? route.fitnessMax : fitnessScale;
                const skillsMin = route.skillsMin !== undefined ? route.skillsMin : 1;
                const skillsMax = route.skillsMax !== undefined ? route.skillsMax : skillsScale;
                
                const fitnessRange = (fitnessMin === 1 && fitnessMax === fitnessScale) ? 'ALL' : `${fitnessMin}-${fitnessMax}`;
                const skillsRange = (skillsMin === 1 && skillsMax === skillsScale) ? 'ALL' : `${skillsMin}-${skillsMax}`;
                
                routeInfoLine.textContent = `Relative Pace Range: ${fitnessRange} | Bike Skills Range: ${skillsRange}`;
                routeCard.appendChild(routeInfoLine);
            }
            
            container.appendChild(routeCard);
        }

        function openRoutesManagerModal() {
            const modal = document.getElementById('routes-manager-modal');
            const listContainer = document.getElementById('routes-manager-list');
            if (!modal || !listContainer) return;

            // Render routes list
            const routes = data.routes || [];
            if (routes.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No routes added yet.</div>';
            } else {
                listContainer.innerHTML = routes.map(route => {
                    const isStrava = !!route.stravaEmbedCode;
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e0e0e0;">
                            <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
                                        ${isStrava ? '<img src="assets/strava_logo.png" alt="Strava" style="height: 16px; width: auto; flex-shrink: 0;">' : ''}
                                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">${escapeHtml(route.name || 'Unnamed Route')}</span>
                                    </div>
                                    ${route.startLocation || route.distance || route.elevation ? `
                                        <div style="font-size: 12px; color: #666;">
                                            ${route.startLocation ? `<span style="font-weight: 500;">${escapeHtml(route.startLocation)}</span>` : ''}
                                            ${route.startLocation && (route.distance || route.elevation) ? ' · ' : ''}
                                            ${route.distance ? `<span>${escapeHtml(route.distance)}</span>` : ''}
                                            ${route.distance && route.elevation ? ' · ' : ''}
                                            ${route.elevation ? `<span>${escapeHtml(route.elevation)}</span>` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-small secondary" onclick="openAddRouteModal(${route.id})">Edit</button>
                                <button class="btn-small danger" onclick="deleteRouteHandler(${route.id}); openRoutesManagerModal();">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeRoutesManagerModal() {
            const modal = document.getElementById('routes-manager-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
        }

        function toggleStravaRouteSection() {
            const section = document.getElementById('strava-embed-section');
            const toggleSection = document.getElementById('strava-toggle-section');
            const headerEl = document.getElementById('add-route-modal-header');
            const nameInput = document.getElementById('route-name');
            const distanceInput = document.getElementById('route-distance');
            const elevationInput = document.getElementById('route-elevation');
            const modal = document.getElementById('add-route-modal');
            if (!section) return;
            const isShowing = section.style.display !== 'none';
            if (isShowing) {
                // Hide Strava section
                section.style.display = 'none';
                if (toggleSection) toggleSection.querySelector('button').textContent = 'Use Strava Route';
                if (headerEl) { headerEl.style.backgroundColor = ''; headerEl.style.color = ''; }
                if (modal) modal.setAttribute('data-is-manual-route', 'true');
                if (nameInput) nameInput.placeholder = 'Enter route name';
                if (distanceInput) distanceInput.placeholder = 'Enter distance (e.g., 15.5 mi)';
                if (elevationInput) elevationInput.placeholder = 'Enter elevation gain (e.g., 1,200 ft)';
            } else {
                // Show Strava section
                section.style.display = 'block';
                if (toggleSection) toggleSection.querySelector('button').textContent = 'Hide Strava Route';
                if (headerEl) { headerEl.style.backgroundColor = '#fc5200'; headerEl.style.color = 'white'; }
                if (modal) modal.setAttribute('data-is-manual-route', 'false');
                if (nameInput) nameInput.placeholder = 'Will be auto-filled from Strava, or enter manually';
                if (distanceInput) distanceInput.placeholder = 'Will be auto-filled from Strava';
                if (elevationInput) elevationInput.placeholder = 'Will be auto-filled from Strava';
            }
        }

        function getUniqueStartLocations() {
            const locations = new Map();
            if (data.seasonSettings && Array.isArray(data.seasonSettings.practices)) {
                data.seasonSettings.practices.forEach(practice => {
                    if (practice.meetLocation) {
                        const key = practice.meetLocation.trim().toLowerCase();
                        if (!locations.has(key)) {
                            locations.set(key, practice.meetLocation.trim());
                        }
                    }
                });
            }
            if (Array.isArray(data.rides)) {
                data.rides.forEach(ride => {
                    if (ride.meetLocation) {
                        const key = ride.meetLocation.trim().toLowerCase();
                        if (!locations.has(key)) {
                            locations.set(key, ride.meetLocation.trim());
                        }
                    }
                });
            }
            return Array.from(locations.values()).sort();
        }

        function populateRouteStartLocationDropdown(selectedValue) {
            const select = document.getElementById('route-start-location');
            if (!select) return;
            const locations = getUniqueStartLocations();
            select.innerHTML = '<option value="">-- Select start location --</option>';
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc;
                option.textContent = loc;
                if (selectedValue && loc.toLowerCase() === selectedValue.trim().toLowerCase()) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }

        function openAddRouteModal(routeId, isManualRoute = false) {
            const modal = document.getElementById('add-route-modal');
            const titleEl = document.getElementById('add-route-modal-title');
            const headerEl = document.getElementById('add-route-modal-header');
            const stravaSection = document.getElementById('strava-embed-section');
            const stravaToggleSection = document.getElementById('strava-toggle-section');
            
            if (!modal) return;

            // Close routes manager modal if open
            closeRoutesManagerModal();

            const isEdit = routeId !== null;
            const route = isEdit ? (data.routes || []).find(r => r.id === routeId) : null;
            
            // Determine if this route has Strava data
            const hasStrava = route && route.stravaEmbedCode;
            const isManual = isManualRoute || (route && !route.stravaEmbedCode);
            
            // Show/hide Strava section
            if (stravaSection) {
                stravaSection.style.display = hasStrava ? 'block' : 'none';
            }
            if (stravaToggleSection) {
                stravaToggleSection.querySelector('button').textContent = hasStrava ? 'Hide Strava Route' : 'Use Strava Route';
            }
            
            // Update header styling
            if (headerEl) {
                if (hasStrava) {
                    headerEl.style.backgroundColor = '#fc5200';
                    headerEl.style.color = 'white';
                } else {
                    headerEl.style.backgroundColor = '';
                    headerEl.style.color = '';
                }
            }
            
            // Update title
            if (titleEl) {
                titleEl.textContent = isEdit ? 'Edit Route' : 'Add New Route';
            }

            // Populate or clear form
            document.getElementById('route-name').value = route ? (route.name || '') : '';
            document.getElementById('route-description').value = route ? (route.description || '') : '';
            document.getElementById('route-distance').value = route ? (route.distance || '') : '';
            document.getElementById('route-elevation').value = route ? (route.elevation || '') : '';
            document.getElementById('route-embed-code').value = route ? (route.stravaEmbedCode || '') : '';
            addRouteCachedPreviewDataUrl = route ? (route.cachedPreviewDataUrl || null) : null;
            const cachedPreviewFileInput = document.getElementById('route-cached-preview-file');
            if (cachedPreviewFileInput) cachedPreviewFileInput.value = '';
            const cachedPreviewStatus = document.getElementById('route-cached-preview-status');
            if (cachedPreviewStatus) {
                cachedPreviewStatus.style.display = addRouteCachedPreviewDataUrl ? 'inline' : 'none';
                cachedPreviewStatus.textContent = addRouteCachedPreviewDataUrl ? 'Current route has a cached preview (upload a new image to replace).' : '';
            }
            
            // Populate start location dropdown
            populateRouteStartLocationDropdown(route ? (route.startLocation || '') : '');
            
            // Update placeholder text based on route type
            const nameInput = document.getElementById('route-name');
            const distanceInput = document.getElementById('route-distance');
            const elevationInput = document.getElementById('route-elevation');
            
            if (isManual) {
                if (nameInput) nameInput.placeholder = 'Enter route name';
                if (distanceInput) distanceInput.placeholder = 'Enter distance (e.g., 15.5 mi)';
                if (elevationInput) elevationInput.placeholder = 'Enter elevation gain (e.g., 1,200 ft)';
            } else {
                if (nameInput) nameInput.placeholder = 'Will be auto-filled from Strava, or enter manually';
                if (distanceInput) distanceInput.placeholder = 'Will be auto-filled from Strava';
                if (elevationInput) elevationInput.placeholder = 'Will be auto-filled from Strava';
            }
            
            // Initialize fitness range slider (default to full range: 1 to current fitness scale)
            const fitnessScale = getFitnessScale();
            // For new routes, default to full range (1 to fitnessScale)
            const fitnessMin = route && route.fitnessMin !== undefined ? route.fitnessMin : 1;
            const fitnessMax = route && route.fitnessMax !== undefined ? route.fitnessMax : fitnessScale;
            // Ensure at least 1-value difference, but preserve full range for new routes
            const validFitnessMin = route ? Math.min(fitnessMin, Math.max(1, fitnessMax - 1)) : 1;
            const validFitnessMax = route ? Math.max(fitnessMax, Math.min(fitnessScale, fitnessMin + 1)) : fitnessScale;
            const fitnessMinInput = document.getElementById('route-fitness-min');
            const fitnessMaxInput = document.getElementById('route-fitness-max');
            if (fitnessMinInput && fitnessMaxInput) {
                fitnessMinInput.value = validFitnessMin;
                fitnessMaxInput.value = validFitnessMax;
                fitnessMinInput.max = validFitnessMax - 1;
                fitnessMaxInput.min = validFitnessMin + 1;
                fitnessMaxInput.max = fitnessScale;
            }
            setTimeout(() => {
                updateFitnessRange();
                setupSliderDrag('fitness', 1, fitnessScale, fitnessScale - 1);
            }, 50);
            
            // Initialize bike skills range slider (default to full range: 1 to current skills scale)
            const skillsScale = getSkillsScale();
            // For new routes, default to full range (1 to skillsScale)
            const skillsMin = route && route.skillsMin !== undefined ? route.skillsMin : 1;
            const skillsMax = route && route.skillsMax !== undefined ? route.skillsMax : skillsScale;
            // Ensure at least 1-value difference, but preserve full range for new routes
            const validSkillsMin = route ? Math.min(skillsMin, Math.max(1, skillsMax - 1)) : 1;
            const validSkillsMax = route ? Math.max(skillsMax, Math.min(skillsScale, skillsMin + 1)) : skillsScale;
            const skillsMinInput = document.getElementById('route-skills-min');
            const skillsMaxInput = document.getElementById('route-skills-max');
            if (skillsMinInput && skillsMaxInput) {
                skillsMinInput.value = validSkillsMin;
                skillsMaxInput.value = validSkillsMax;
                skillsMinInput.max = validSkillsMax - 1;
                skillsMaxInput.min = validSkillsMin + 1;
                skillsMaxInput.max = skillsScale;
            }
            setTimeout(() => {
                updateSkillsRange();
                setupSliderDrag('skills', 1, skillsScale, skillsScale - 1);
            }, 50);
            
            // Update max attributes and regenerate scale labels
            updateInputMaxAttributes();
            updateRouteSliderLabels();
            
            // Store route ID for editing and route type
            if (isEdit) {
                modal.setAttribute('data-editing-route-id', routeId);
            } else {
                modal.removeAttribute('data-editing-route-id');
            }

            const deleteBtn = document.getElementById('delete-route-btn');
            if (deleteBtn) deleteBtn.style.display = isEdit ? '' : 'none';
            modal.setAttribute('data-is-manual-route', isManual ? 'true' : 'false');

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');

            // Setup embed code listener for auto-fetch (only for Strava routes)
            if (!isManual) {
                setupRouteDataExtraction();
            }

            // Focus on route name input for manual routes, embed code for Strava routes
            setTimeout(() => {
                if (isManual) {
                    document.getElementById('route-name').focus();
                } else {
                    document.getElementById('route-embed-code').focus();
                }
            }, 100);
        }

        // Configuration for proxy server
        // PROXY_SERVER_URL (from app-state.js)

        function setupRouteDataExtraction() {
            const embedCodeInput = document.getElementById('route-embed-code');
            const fetchBtn = document.getElementById('fetch-route-data-btn');
            if (!embedCodeInput || !fetchBtn) return;
            
            // Enable/disable fetch button based on embed code content
            function updateButtonState() {
                const embedCode = embedCodeInput.value.trim();
                const extractedUrl = embedCode ? extractRouteUrlFromEmbed(embedCode) : null;
                const hasValidUrl = !!extractedUrl;
                
                fetchBtn.disabled = !hasValidUrl;
                
                const statusEl = document.getElementById('fetch-route-status');
                if (!hasValidUrl && embedCode) {
                    // Show helpful message if code is pasted but URL can't be extracted
                    if (statusEl) {
                        statusEl.textContent = 'Make sure the embed code contains a Strava URL';
                        statusEl.style.color = '#ff9800';
                    }
                } else if (hasValidUrl) {
                    // Show that URL was found
                    if (statusEl && !statusEl.textContent.includes('✓') && !statusEl.textContent.includes('Error') && !statusEl.textContent.includes('Fetching')) {
                        statusEl.textContent = 'Ready to fetch';
                        statusEl.style.color = '#4caf50';
                    }
                } else {
                    // Clear status when no embed code
                    if (statusEl && !statusEl.textContent.includes('✓') && !statusEl.textContent.includes('Error')) {
                        statusEl.textContent = '';
                    }
                }
            }
            
            // Check on input
            embedCodeInput.addEventListener('input', updateButtonState);
            
            // Check on paste (with slight delay to let paste complete)
            embedCodeInput.addEventListener('paste', function() {
                setTimeout(updateButtonState, 100);
            });
            
            // Initial state check
            updateButtonState();
        }

        function extractRouteUrlFromEmbed(embedCode) {
            // Method 1: Try to find URL in src attribute of iframe (old format)
            const iframeSrcMatch = embedCode.match(/src=["']([^"']*strava\.com[^"']*)["']/i);
            if (iframeSrcMatch) {
                return iframeSrcMatch[1];
            }
            
            // Method 2: Try to find any Strava URL in the code
            const urlMatch = embedCode.match(/https?:\/\/[^\s"'<>]+strava\.com[^\s"'<>]*/i);
            if (urlMatch) {
                return urlMatch[0];
            }
            
            // Method 3: Extract route ID from new Strava embed format (data-embed-id)
            // Handle both quoted and unquoted values, with optional whitespace
            const routeIdMatch = embedCode.match(/data-embed-id\s*=\s*["']?(\d+)["']?/i);
            if (routeIdMatch) {
                const routeId = routeIdMatch[1];
                // Construct Strava route URL from the route ID
                return `https://www.strava.com/routes/${routeId}`;
            }
            
            // Method 4: Try to find route ID in various patterns
            const routeIdPatterns = [
                /routes\/(\d+)/i,
                /route\/(\d+)/i,
                /\/r\/(\d+)/i
            ];
            
            for (const pattern of routeIdPatterns) {
                const match = embedCode.match(pattern);
                if (match) {
                    return `https://www.strava.com/routes/${match[1]}`;
                }
            }
            
            return null;
        }


        async function fetchRouteDataFromEmbed() {
            const embedCodeInput = document.getElementById('route-embed-code');
            const statusEl = document.getElementById('fetch-route-status');
            const fetchBtn = document.getElementById('fetch-route-data-btn');
            
            if (!embedCodeInput) return;
            
            const embedCode = embedCodeInput.value.trim();
            if (!embedCode) {
                if (statusEl) statusEl.textContent = 'Please paste embed code first';
                return;
            }
            
            const routeUrl = extractRouteUrlFromEmbed(embedCode);
            if (!routeUrl) {
                if (statusEl) statusEl.textContent = 'Could not extract route URL from embed code';
                return;
            }
            
            // Update UI
            if (fetchBtn) {
                fetchBtn.disabled = true;
                fetchBtn.textContent = 'Fetching...';
            }
            if (statusEl) statusEl.textContent = 'Fetching route data...';
            
            try {
                const response = await fetch(`${PROXY_SERVER_URL}/api/fetch-strava-route?url=${encodeURIComponent(routeUrl)}`);
                
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Populate form fields (always populate when auto-fill is clicked)
                if (data.name) {
                    const nameInput = document.getElementById('route-name');
                    if (nameInput) {
                        nameInput.value = data.name;
                    }
                }
                
                if (data.distance) {
                    const distanceInput = document.getElementById('route-distance');
                    if (distanceInput) {
                        distanceInput.value = data.distance;
                    }
                }
                
                if (data.elevation) {
                    const elevationInput = document.getElementById('route-elevation');
                    if (elevationInput) {
                        elevationInput.value = data.elevation;
                    }
                }
                
                if (statusEl) {
                    statusEl.textContent = '✓ Route data fetched successfully!';
                    statusEl.style.color = '#4caf50';
                }
                
            } catch (error) {
                console.error('Error fetching route data:', error);
                
                // Check for connection errors
                const isConnectionError = error.message.includes('Failed to fetch') || 
                                         error.message.includes('network') || 
                                         error.message.toLowerCase().includes('connection') ||
                                         error.message.includes('ERR_CONNECTION_REFUSED') ||
                                         error.name === 'TypeError';
                
                if (statusEl) {
                    if (isConnectionError) {
                        statusEl.innerHTML = '⚠️ Strava API server not available. The auto-fill feature requires a backend server to be running. You can still enter route information manually.';
                        statusEl.style.color = '#ff9800';
                    } else {
                        statusEl.textContent = `Error: ${error.message}`;
                        statusEl.style.color = '#f44336';
                    }
                }
                
                // Only show alert for non-connection errors (connection errors already have status message)
                if (!isConnectionError) {
                    let errorMessage = `Unable to fetch route data automatically.\n\nError: ${error.message}\n\n`;
                    errorMessage += `Make sure the proxy server is running on ${PROXY_SERVER_URL}\n\n`;
                    errorMessage += `You can still enter the route information manually.`;
                    alert(errorMessage);
                }
            } finally {
                if (fetchBtn) {
                    fetchBtn.disabled = false;
                    fetchBtn.textContent = '🔍 Auto-fill Route Info from Strava';
                }
            }
        }

        // Slider drag functionality
        // isDragging, dragHandle, dragSlider, dragType, dragStartX, dragStartPercent (from app-state.js)

        // Global drag handlers (only add once)
        if (!window.sliderDragHandlersAdded) {
            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                handleDrag(e);
            });
            document.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                handleDrag(e);
            });
            document.addEventListener('mouseup', function() {
                stopDrag();
            });
            document.addEventListener('touchend', function() {
                stopDrag();
            });
            window.sliderDragHandlersAdded = true;
        }

        function handleDrag(e) {
            if (!isDragging || !dragSlider) return;
            
            const track = document.getElementById(`route-${dragSlider}-slider-track`);
            if (!track) return;
            
            const rect = track.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let percent = ((clientX - rect.left) / rect.width) * 100;
            percent = Math.max(0, Math.min(100, percent));
            
            // Use actual scale values instead of hardcoded values
            const sliderMax = dragSlider === 'fitness' ? getFitnessScale() : getSkillsScale();
            // Round to ensure whole number values
            const value = Math.round(1 + (percent / 100) * (sliderMax - 1));
            updateSliderValue(dragSlider, dragType, value);
        }

        function stopDrag() {
            if (isDragging) {
                isDragging = false;
                if (dragHandle) dragHandle.style.cursor = 'grab';
                dragHandle = null;
                dragSlider = null;
                dragType = null;
                dragStartX = 0;
                dragStartPercent = 0;
            }
        }

        function setupSliderDrag(sliderName, minValue, maxValue, totalRange) {
            const minHandle = document.getElementById(`route-${sliderName}-min-handle`);
            const maxHandle = document.getElementById(`route-${sliderName}-max-handle`);
            const track = document.getElementById(`route-${sliderName}-slider-track`);
            
            if (!minHandle || !maxHandle || !track) return;

            // Remove existing listeners by cloning and replacing
            const newMinHandle = minHandle.cloneNode(true);
            const newMaxHandle = maxHandle.cloneNode(true);
            minHandle.parentNode.replaceChild(newMinHandle, minHandle);
            maxHandle.parentNode.replaceChild(newMaxHandle, maxHandle);

            function startDrag(e, type) {
                isDragging = true;
                dragHandle = type === 'min' ? newMinHandle : newMaxHandle;
                dragSlider = sliderName;
                dragType = type;
                dragHandle.style.cursor = 'grabbing';
                e.preventDefault();
                e.stopPropagation();
            }

            newMinHandle.addEventListener('mousedown', (e) => startDrag(e, 'min'));
            newMaxHandle.addEventListener('mousedown', (e) => startDrag(e, 'max'));
            newMinHandle.addEventListener('touchstart', (e) => startDrag(e, 'min'));
            newMaxHandle.addEventListener('touchstart', (e) => startDrag(e, 'max'));
        }

        function updateSliderValue(sliderName, type, newValue) {
            // Get elements fresh each time (handles may have been cloned)
            const minHandle = document.getElementById(`route-${sliderName}-min-handle`);
            const maxHandle = document.getElementById(`route-${sliderName}-max-handle`);
            const range = document.getElementById(`route-${sliderName}-slider-range`);
            const minValueDisplay = document.getElementById(`route-${sliderName}-min-value`);
            const maxValueDisplay = document.getElementById(`route-${sliderName}-max-value`);
            const minInput = document.getElementById(`route-${sliderName}-min`);
            const maxInput = document.getElementById(`route-${sliderName}-max`);
            
            if (!minInput || !maxInput) return;
            
            const sliderMax = sliderName === 'fitness' ? getFitnessScale() : getSkillsScale();
            // Round to whole numbers to ensure sliders snap to integer values
            let minValue = Math.round(parseFloat(minInput.value) || 1);
            let maxValue = Math.round(parseFloat(maxInput.value) || sliderMax);
            
            // Round the new value to nearest whole number
            newValue = Math.round(newValue);
            
            if (type === 'min') {
                // Min cannot exceed (max - 1) to maintain at least 1-value range
                newValue = Math.max(1, Math.min(newValue, maxValue - 1));
                minInput.value = newValue;
                minValue = newValue;
                // Update max input's min constraint
                maxInput.min = minValue + 1;
            } else if (type === 'max') {
                // Max cannot go below (min + 1) to maintain at least 1-value range
                newValue = Math.max(minValue + 1, Math.min(newValue, sliderMax));
                maxInput.value = newValue;
                maxValue = newValue;
                // Update min input's max constraint
                minInput.max = maxValue - 1;
            }
            
            // Calculate percentages based on current scale
            const scaleRange = sliderMax - 1;
            const minPercent = scaleRange > 0 ? ((minValue - 1) / scaleRange) * 100 : 0;
            const maxPercent = scaleRange > 0 ? ((maxValue - 1) / scaleRange) * 100 : 100;
            
            if (range && minHandle && maxHandle) {
                range.style.left = minPercent + '%';
                range.style.width = (maxPercent - minPercent) + '%';
                minHandle.style.left = minPercent + '%';
                maxHandle.style.left = maxPercent + '%';
            }
            if (minValueDisplay) minValueDisplay.textContent = minValue;
            if (maxValueDisplay) maxValueDisplay.textContent = maxValue;
        }

        function updateFitnessRange() {
            const minInput = document.getElementById('route-fitness-min');
            const maxInput = document.getElementById('route-fitness-max');
            if (!minInput || !maxInput) return;
            
            const fitnessScale = getFitnessScale();
            // Round to whole numbers to ensure sliders snap to integer values
            let minValue = Math.round(parseFloat(minInput.value) || 1);
            let maxValue = Math.round(parseFloat(maxInput.value) || fitnessScale);
            
            // Clamp values to valid range
            minValue = Math.max(1, Math.min(minValue, fitnessScale));
            maxValue = Math.max(1, Math.min(maxValue, fitnessScale));
            
            // Enforce constraints: min < max and at least 1-value difference
            if (minValue >= maxValue) {
                if (minInput === document.activeElement || dragType === 'min') {
                    maxValue = Math.min(fitnessScale, minValue + 1);
                    maxInput.value = maxValue;
                } else {
                    minValue = Math.max(1, maxValue - 1);
                    minInput.value = minValue;
                }
            }
            
            // Update input values to ensure they're whole numbers
            minInput.value = minValue;
            maxInput.value = maxValue;
            
            // Calculate percentages based on current scale
            const scaleRange = fitnessScale - 1;
            const minPercent = scaleRange > 0 ? ((minValue - 1) / scaleRange) * 100 : 0;
            const maxPercent = scaleRange > 0 ? ((maxValue - 1) / scaleRange) * 100 : 100;
            
            const range = document.getElementById('route-fitness-slider-range');
            const minHandle = document.getElementById('route-fitness-min-handle');
            const maxHandle = document.getElementById('route-fitness-max-handle');
            const minValueDisplay = document.getElementById('route-fitness-min-value');
            const maxValueDisplay = document.getElementById('route-fitness-max-value');
            
            if (range && minHandle && maxHandle) {
                range.style.left = minPercent + '%';
                range.style.width = (maxPercent - minPercent) + '%';
                minHandle.style.left = minPercent + '%';
                maxHandle.style.left = maxPercent + '%';
            }
            if (minValueDisplay) minValueDisplay.textContent = minValue;
            if (maxValueDisplay) maxValueDisplay.textContent = maxValue;
        }
        
        function updateSkillsRange() {
            const minInput = document.getElementById('route-skills-min');
            const maxInput = document.getElementById('route-skills-max');
            if (!minInput || !maxInput) return;
            
            const skillsScale = getSkillsScale();
            // Round to whole numbers to ensure sliders snap to integer values
            let minValue = Math.round(parseFloat(minInput.value) || 1);
            let maxValue = Math.round(parseFloat(maxInput.value) || skillsScale);
            
            // Clamp values to valid range
            minValue = Math.max(1, Math.min(minValue, skillsScale));
            maxValue = Math.max(1, Math.min(maxValue, skillsScale));
            
            // Enforce constraints: min < max and at least 1-value difference
            if (minValue >= maxValue) {
                if (minInput === document.activeElement || dragType === 'min') {
                    maxValue = Math.min(skillsScale, minValue + 1);
                    maxInput.value = maxValue;
                } else {
                    minValue = Math.max(1, maxValue - 1);
                    minInput.value = minValue;
                }
            }
            
            // Update input values to ensure they're whole numbers
            minInput.value = minValue;
            maxInput.value = maxValue;
            
            // Calculate percentages based on current scale
            const scaleRange = skillsScale - 1;
            const minPercent = scaleRange > 0 ? ((minValue - 1) / scaleRange) * 100 : 0;
            const maxPercent = scaleRange > 0 ? ((maxValue - 1) / scaleRange) * 100 : 100;
            
            const range = document.getElementById('route-skills-slider-range');
            const minHandle = document.getElementById('route-skills-min-handle');
            const maxHandle = document.getElementById('route-skills-max-handle');
            const minValueDisplay = document.getElementById('route-skills-min-value');
            const maxValueDisplay = document.getElementById('route-skills-max-value');
            
            if (range && minHandle && maxHandle) {
                range.style.left = minPercent + '%';
                range.style.width = (maxPercent - minPercent) + '%';
                minHandle.style.left = minPercent + '%';
                maxHandle.style.left = maxPercent + '%';
            }
            if (minValueDisplay) minValueDisplay.textContent = minValue;
            if (maxValueDisplay) maxValueDisplay.textContent = maxValue;
        }
        
        function showEmbedCodeTooltip(event) {
            const tooltip = document.getElementById('embed-code-tooltip');
            if (!tooltip) return;
            
            tooltip.style.display = 'block';
            
            // Position tooltip relative to the icon
            const icon = event.target;
            const iconRect = icon.getBoundingClientRect();
            const container = tooltip.parentElement;
            const containerRect = container.getBoundingClientRect();
            
            // Calculate position relative to container
            const relativeLeft = iconRect.left - containerRect.left;
            const relativeTop = iconRect.top - containerRect.top;
            
            // Position to the right of the icon
            tooltip.style.left = (relativeLeft + iconRect.width + 8) + 'px';
            tooltip.style.top = (relativeTop - 4) + 'px';
            
            // Adjust if tooltip would go off screen
            setTimeout(() => {
                const tooltipRect = tooltip.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                if (tooltipRect.right > containerRect.right) {
                    // Position to the left of icon instead
                    tooltip.style.left = (relativeLeft - tooltipRect.width - 8) + 'px';
                }
                
                if (tooltipRect.bottom > containerRect.bottom) {
                    // Position above icon
                    tooltip.style.top = (relativeTop - tooltipRect.height - 8) + 'px';
                }
            }, 0);
        }
        
        function hideEmbedCodeTooltip() {
            const tooltip = document.getElementById('embed-code-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }
        
        function closeAddRouteModal() {
            const modal = document.getElementById('add-route-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            hideEmbedCodeTooltip();
            addRouteCachedPreviewDataUrl = null;
            const cachedPreviewFileInput = document.getElementById('route-cached-preview-file');
            if (cachedPreviewFileInput) cachedPreviewFileInput.value = '';
            const cachedPreviewStatus = document.getElementById('route-cached-preview-status');
            if (cachedPreviewStatus) { cachedPreviewStatus.style.display = 'none'; cachedPreviewStatus.textContent = ''; }
        }

        function onRouteCachedPreviewFileChange(event) {
            const input = event && event.target;
            const statusEl = document.getElementById('route-cached-preview-status');
            if (!input || !input.files || !input.files.length) {
                addRouteCachedPreviewDataUrl = null;
                if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
                return;
            }
            const file = input.files[0];
            if (!file || !file.type.startsWith('image/')) {
                addRouteCachedPreviewDataUrl = null;
                if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'Please choose an image file.'; }
                return;
            }
            const reader = new FileReader();
            reader.onload = function() {
                addRouteCachedPreviewDataUrl = reader.result;
                if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'Preview image selected.'; }
            };
            reader.onerror = function() {
                addRouteCachedPreviewDataUrl = null;
                if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'Could not read file.'; }
            };
            reader.readAsDataURL(file);
        }

        // Store original settings when modal opens for discard functionality
        async function saveRoute() {
            const modal = document.getElementById('add-route-modal');
            const isEdit = modal && modal.hasAttribute('data-editing-route-id');
            const routeId = isEdit ? parseInt(modal.getAttribute('data-editing-route-id'), 10) : null;
            const nameInput = document.getElementById('route-name');
            const descriptionInput = document.getElementById('route-description');
            const distanceInput = document.getElementById('route-distance');
            const elevationInput = document.getElementById('route-elevation');
            const embedCodeInput = document.getElementById('route-embed-code');
            const fitnessMinInput = document.getElementById('route-fitness-min');
            const fitnessMaxInput = document.getElementById('route-fitness-max');
            const skillsMinInput = document.getElementById('route-skills-min');
            const skillsMaxInput = document.getElementById('route-skills-max');

            const name = nameInput.value.trim();
            const embedCode = embedCodeInput ? embedCodeInput.value.trim() : '';
            const fitnessMin = parseInt(fitnessMinInput.value);
            const fitnessMax = parseInt(fitnessMaxInput.value);
            const skillsMin = parseInt(skillsMinInput.value);
            const skillsMax = parseInt(skillsMaxInput.value);

            if (!name) {
                alert('Please enter a route name');
                return;
            }

            // Require start location for all routes
            const startLocationSelect = document.getElementById('route-start-location');
            const startLocationValue = startLocationSelect ? startLocationSelect.value.trim() : '';
            if (!startLocationValue) {
                alert('Please select a start location for this route.');
                return;
            }

            // Determine if Strava section is visible (user chose to use Strava)
            const stravaSection = document.getElementById('strava-embed-section');
            const isStravaVisible = stravaSection && stravaSection.style.display !== 'none';

            // Only require embed code if Strava section is shown
            if (isStravaVisible && !embedCode) {
                alert('Please paste the Strava embed code, or hide the Strava section.');
                return;
            }

            // Extract Strava URL from embed code if it exists
            let stravaUrl = null;
            if (embedCode && isStravaVisible) {
                stravaUrl = extractRouteUrlFromEmbed(embedCode);
                // Clean up URL - remove query parameters that might break the link
                if (stravaUrl) {
                    stravaUrl = stravaUrl.split('?')[0];
                }
            }

            // Initialize routes array if needed
            if (!Array.isArray(data.routes)) {
                data.routes = [];
            }

            // Prepare route data
            const routeData = {
                        name: name,
                        description: descriptionInput.value.trim() || null,
                        stravaEmbedCode: isStravaVisible ? embedCode : null,
                        stravaUrl: isStravaVisible ? stravaUrl : null,
                        cachedPreviewDataUrl: addRouteCachedPreviewDataUrl || null,
                        distance: distanceInput.value.trim() || null,
                        elevation: elevationInput.value.trim() || null,
                        fitnessMin: fitnessMin,
                        fitnessMax: fitnessMax,
                        skillsMin: skillsMin,
                        skillsMax: skillsMax,
                        startLocation: startLocationValue || null
                    };

            // Check if database functions are available and user is authenticated
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (!isDeveloperMode && client && currentUser && typeof updateRoute !== 'undefined' && typeof createRoute !== 'undefined') {
                // Authenticated user - save to Supabase
                try {
                    if (isEdit && routeId) {
                        // Update existing route in Supabase
                        const updated = await updateRoute(routeId, routeData);
                        // Update local data (merge with existing fields, prioritize Supabase response)
                        const routeIndex = data.routes.findIndex(r => r.id === routeId);
                        if (routeIndex >= 0) {
                            data.routes[routeIndex] = { ...data.routes[routeIndex], ...routeData, ...updated };
                }
            } else {
                        // Create new route in Supabase
                        const created = await createRoute(routeData);
                        // Add to local data (use full data from Supabase response)
                        routeData.id = created.id;
                        data.routes.push({ ...routeData, ...created });
                    }
                    // Save to localStorage as backup (after successful Supabase save)
            saveData();
                } catch (error) {
                    console.error('Error saving route to Supabase:', error);
                    // Fall back to localStorage-only save
                    if (isEdit && routeId) {
                        const routeIndex = data.routes.findIndex(r => r.id === routeId);
                        if (routeIndex >= 0) {
                            data.routes[routeIndex] = { ...data.routes[routeIndex], ...routeData };
                        }
                    } else {
                        routeData.id = Date.now() + Math.floor(Math.random() * 1000);
                        data.routes.push(routeData);
                    }
                    saveData();
                }
            } else {
                // Not authenticated - save to localStorage only
                if (isEdit && routeId) {
                    const routeIndex = data.routes.findIndex(r => r.id === routeId);
                    if (routeIndex >= 0) {
                        data.routes[routeIndex] = { ...data.routes[routeIndex], ...routeData };
                    }
                } else {
                    routeData.id = Date.now() + Math.floor(Math.random() * 1000);
                    data.routes.push(routeData);
                }
                saveData();
            }
            
            renderRoutes();
            closeAddRouteModal();
        }

        async function deleteRouteHandler(routeId) {
            if (!confirm('Are you sure you want to delete this route?')) {
                return;
            }

            // Check if database functions are available and user is authenticated
            const client = getSupabaseClient();
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            
            if (client && currentUser && typeof deleteRoute !== 'undefined') {
                // Authenticated user - delete from Supabase
                try {
                    await deleteRoute(routeId);
            // Remove from local data
            data.routes = data.routes.filter(r => r.id !== routeId);
                } catch (error) {
                    console.error('Error deleting route from Supabase:', error);
                    // Still remove from local data on error
                    data.routes = data.routes.filter(r => r.id !== routeId);
            saveData();
                }
            } else {
                // Not authenticated - delete from localStorage only
                data.routes = data.routes.filter(r => r.id !== routeId);
                saveData();
            }
            
            renderRoutes();
        }

        function previewStravaRoute(routeId) {
            const route = (data.routes || []).find(r => r.id === routeId);
            if (!route || !route.stravaEmbedCode) return;

            const overlay = document.createElement('div');
            overlay.id = 'route-preview-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            const card = document.createElement('div');
            card.style.cssText = 'background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); padding: 16px; width: 585px; position: relative;';

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'position: absolute; top: 8px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; color: #666; z-index: 1;';
            closeBtn.onclick = () => overlay.remove();
            card.appendChild(closeBtn);

            const embedContainer = document.createElement('div');
            embedContainer.style.cssText = 'width: 100%; height: 600px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; position: relative;';

            if (route.cachedPreviewDataUrl) {
                embedContainer.innerHTML = `<img src="${escapeHtml(route.cachedPreviewDataUrl)}" alt="${escapeHtml(route.name || 'Route')}" style="width:100%;height:100%;object-fit:contain;background:#f5f5f5;">`;
            } else {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'width: 100%; height: 100%; position: relative; overflow: hidden;';
                wrapper.innerHTML = route.stravaEmbedCode;
                const embedEl = wrapper.querySelector('[data-embed-type="route"]');
                if (embedEl) {
                    embedEl.style.width = '100%';
                    embedEl.style.height = '100%';
                }
                const scripts = wrapper.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                embedContainer.appendChild(wrapper);
                if (wrapper.querySelector('[data-embed-type="route"]') &&
                    !document.querySelector('script[src="https://strava-embeds.com/embed.js"]')) {
                    const s = document.createElement('script');
                    s.src = 'https://strava-embeds.com/embed.js';
                    document.head.appendChild(s);
                }
            }

            card.appendChild(embedContainer);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display: flex; gap: 10px; margin-top: 12px; justify-content: center;';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-small';
            editBtn.textContent = 'Edit Route';
            editBtn.onclick = () => { overlay.remove(); openAddRouteModal(route.id); };
            btnRow.appendChild(editBtn);

            const assignBtn = document.createElement('button');
            assignBtn.className = 'btn-small';
            assignBtn.textContent = 'Assign Route to Group';
            assignBtn.onclick = () => { overlay.remove(); openRouteAssignDialog(route.id); };
            btnRow.appendChild(assignBtn);

            card.appendChild(btnRow);

            overlay.appendChild(card);
            document.body.appendChild(overlay);
        }

        function openRouteAssignDialog(routeId) {
            const route = (data.routes || []).find(r => r.id === routeId);
            if (!route) return;

            const rides = data.rides || [];
            let targetRide = null;
            if (data.currentRide) {
                targetRide = rides.find(r => r.id === data.currentRide);
            }
            if (!targetRide) {
                const now = new Date();
                const futureRides = rides.filter(r => {
                    const d = r.date ? new Date(r.date) : null;
                    return d && d >= now && Array.isArray(r.groups) && r.groups.length > 0;
                }).sort((a, b) => new Date(a.date) - new Date(b.date));
                targetRide = futureRides[0] || null;
            }

            if (!targetRide || !Array.isArray(targetRide.groups) || targetRide.groups.length === 0) {
                alert('No practice with groups found. Please create groups in the Practice Planner first.');
                return;
            }

            const useColorNames = typeof rideUsesGroupColorNames === 'function' && rideUsesGroupColorNames(targetRide);
            const rideDate = targetRide.date ? new Date(targetRide.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Current Practice';

            const groupCheckboxes = targetRide.groups.map((group, idx) => {
                let label;
                if (useColorNames && group.colorName) {
                    label = escapeHtml(group.colorName);
                } else {
                    label = 'Group ' + (idx + 1);
                }
                const currentRoute = group.routeId ? (data.routes || []).find(r => String(r.id) === String(group.routeId)) : null;
                const currentLabel = group.routeId === 'leader-choice' ? "Leader's Choice" : (currentRoute ? escapeHtml(currentRoute.name) : 'None');
                const isAssigned = String(group.routeId) === String(routeId);
                return `<label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
                    <input type="checkbox" value="${group.id}" ${isAssigned ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">${label}</div>
                        <div style="font-size: 12px; color: #888;">Current: ${currentLabel}</div>
                    </div>
                </label>`;
            }).join('');

            const overlay = document.createElement('div');
            overlay.id = 'route-assign-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            const dialog = document.createElement('div');
            dialog.style.cssText = 'background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 420px; width: 90%;';
            dialog.innerHTML = `
                <div style="padding: 16px 20px; border-bottom: 1px solid #e0e0e0;">
                    <div style="font-weight: 700; font-size: 16px; color: #333;">Assign Route to Groups</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">${escapeHtml(route.name)} — ${rideDate}</div>
                </div>
                <div style="max-height: 350px; overflow-y: auto;">
                    ${groupCheckboxes}
                </div>
                <div style="padding: 12px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-small secondary" onclick="this.closest('#route-assign-overlay').remove()">Cancel</button>
                    <button class="btn-small" id="route-assign-confirm-btn">Apply</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            document.getElementById('route-assign-confirm-btn').onclick = () => {
                const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    const groupId = cb.value;
                    const group = targetRide.groups.find(g => String(g.id) === groupId);
                    if (!group) return;
                    if (cb.checked) {
                        group.routeId = routeId;
                    } else if (String(group.routeId) === String(routeId)) {
                        group.routeId = null;
                    }
                });
                if (typeof saveRideToDB === 'function') saveRideToDB(targetRide);
                if (typeof renderAssignments === 'function' && data.currentRide === targetRide.id) {
                    renderAssignments(targetRide);
                }
                overlay.remove();
            };
        }

        async function deleteRouteFromEditModal() {
            const modal = document.getElementById('add-route-modal');
            if (!modal || !modal.hasAttribute('data-editing-route-id')) return;
            const routeId = parseInt(modal.getAttribute('data-editing-route-id'), 10);
            if (!routeId) return;
            closeAddRouteModal();
            await deleteRouteHandler(routeId);
        }
