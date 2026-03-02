// app-coaches.js — Coach CRUD, edit modal, roster rendering, bike field logic

        // Coach management
        async function addCoach() {
            if (!canEditCoaches()) {
                alert('You do not have permission to add coaches');
                return;
            }

            const name = document.getElementById('coach-name').value.trim();
            const phone = document.getElementById('coach-phone').value.trim();
            const level = document.getElementById('coach-level').value;
            const fitnessInput = document.getElementById('coach-fitness').value;
            const notes = document.getElementById('coach-notes').value.trim();
            
            if (!name) {
                alert('Please enter a coach name');
                return;
            }

            const fitnessValue = Math.max(1, Math.min(10, parseInt(fitnessInput || '5', 10)));

            // Read photo (readPhotoFile returns a Promise)
            const photo = await readPhotoFile('coach-photo');
            
            const coachData = {
                name,
                photo,
                phone,
                level,
                fitness: String(fitnessValue),
                notes
            };

            saveCoachToDB(coachData);
            resetCoachForm();
            renderCoaches();
        }

        function resetCoachForm() {
            document.getElementById('coach-photo').value = '';
            document.getElementById('coach-name').value = '';
            document.getElementById('coach-phone').value = '';
            document.getElementById('coach-level').value = '1';
            document.getElementById('coach-fitness').value = '5';
            document.getElementById('coach-notes').value = '';
            handleFileChange('coach-photo', 'coach-photo-name');
        }

        async function deleteCoach(id, skipConfirm = false) {
            if (!canEditCoaches()) {
                alert('You do not have permission to delete coaches');
                return;
            }

            if (skipConfirm || confirm('Delete this coach?')) {
                try {
                    const client = getSupabaseClient();
                    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                    if (client && currentUser && typeof deleteCoachFromDB === 'function') {
                        await deleteCoachFromDB(id);
                    }
                } catch (error) {
                    console.error('Error deleting coach from database:', error);
                    alert(error.message || 'Failed to delete coach.');
                    return;
                }
                
                // Remove from coaches array
                data.coaches = data.coaches.filter(c => c.id !== id);
                
                // Also update any rides that reference this coach
                for (const ride of data.rides) {
                    if (ride.availableCoaches && ride.availableCoaches.includes(id)) {
                        ride.availableCoaches = ride.availableCoaches.filter(coachId => coachId !== id);
                        // Update groups if needed
                        if (ride.groups) {
                            ride.groups.forEach(group => {
                                if (group.coaches) {
                                    Object.keys(group.coaches).forEach(key => {
                                        if (group.coaches[key] === id) {
                                            group.coaches[key] = null;
                                        }
                                    });
                                    // Also check extraRoam array
                                    if (Array.isArray(group.coaches.extraRoam)) {
                                        group.coaches.extraRoam = group.coaches.extraRoam.filter(coachId => coachId !== id);
                                    }
                                }
                            });
                        }
                        saveRideToDB(ride);
                    }
                }
                
                saveData();
                renderCoaches();
                if (data.currentRide) {
                    renderRides();
                }
            }
        }

        function renderCoaches() {
            const list = document.getElementById('coaches-list');
            const activeCoaches = data.coaches.filter(c => !c.archived);
            const archivedCoachesList = data.coaches.filter(c => c.archived);
            if (activeCoaches.length === 0 && (!showArchivedCoaches || archivedCoachesList.length === 0)) {
                const archivedCount = archivedCoachesList.length;
                const msg = archivedCount > 0
                    ? `No active coaches. ${archivedCount} archived coach(es) hidden. <button class="btn-small secondary" style="margin-left:8px;" onclick="toggleShowArchivedCoaches()">Show Archived</button>`
                    : 'No coaches yet. Click "Add Coach" below to get started.';
                list.innerHTML = `<div class="empty-state">${msg}</div>`;
                return;
            }
            
            // Separate active coaches with roles from those without
            const coachesWithRoles = [];
            const coachesWithoutRoles = [];
            
            activeCoaches.forEach(coach => {
                if (getCoachRole(coach.id)) {
                    coachesWithRoles.push(coach);
                } else {
                    coachesWithoutRoles.push(coach);
                }
            });
            
            // Sort coaches
            let sortedCoachesWithRoles = [...coachesWithRoles];
            let sortedCoachesWithoutRoles = [...coachesWithoutRoles];
            
            const sortCoachesArray = (coaches) => {
                if (!coachSortColumn) return coaches;
                return [...coaches].sort((a, b) => {
                    let aVal, bVal;
                    switch (coachSortColumn) {
                        case 'name':
                            const aLastName = getSortableLastName(a.name || '');
                            const bLastName = getSortableLastName(b.name || '');
                            if (aLastName !== bLastName) {
                                aVal = aLastName;
                                bVal = bLastName;
                            } else {
                                // If last names are equal, sort by first name
                                const aParts = (a.name || '').trim().split(/\s+/);
                                const bParts = (b.name || '').trim().split(/\s+/);
                                aVal = aParts[0] ? aParts[0].toLowerCase() : '';
                                bVal = bParts[0] ? bParts[0].toLowerCase() : '';
                            }
                            break;
                        case 'level':
                            // Support both old 'level' and new 'coachingLicenseLevel' fields
                            const aLevelRaw = a.coachingLicenseLevel || a.level || '1';
                            const bLevelRaw = b.coachingLicenseLevel || b.level || '1';
                            // Handle N/A as 0 for sorting
                            aVal = (aLevelRaw === 'N/A' || aLevelRaw === 'NA') ? 0 : parseInt(aLevelRaw, 10);
                            bVal = (bLevelRaw === 'N/A' || bLevelRaw === 'NA') ? 0 : parseInt(bLevelRaw, 10);
                            break;
                        case 'pace':
                            aVal = parseInt(a.fitness || '5', 10);
                            bVal = parseInt(b.fitness || '5', 10);
                            break;
                        case 'skills':
                            const skillsScale = getSkillsScale();
                            aVal = Math.max(1, Math.min(skillsScale, parseInt(a.skills || Math.ceil(skillsScale / 2), 10)));
                            bVal = Math.max(1, Math.min(skillsScale, parseInt(b.skills || Math.ceil(skillsScale / 2), 10)));
                            break;
                        case 'climbing':
                            const climbScale = getClimbingScale();
                            aVal = Math.max(1, Math.min(climbScale, parseInt(a.climbing || Math.ceil(climbScale / 2), 10)));
                            bVal = Math.max(1, Math.min(climbScale, parseInt(b.climbing || Math.ceil(climbScale / 2), 10)));
                            break;
                        default:
                            return 0;
                    }
                    
                    let comparison = 0;
                    if (aVal < bVal) comparison = -1;
                    if (aVal > bVal) comparison = 1;
                    
                    return coachSortDirection === 'asc' ? comparison : -comparison;
                });
            };
            
            sortedCoachesWithRoles = sortCoachesArray(sortedCoachesWithRoles);
            sortedCoachesWithoutRoles = sortCoachesArray(sortedCoachesWithoutRoles);
            
            // Combine: role coaches first, then others
            const sortedCoaches = [...sortedCoachesWithRoles, ...sortedCoachesWithoutRoles];
            
            const getSortIndicator = (column) => { return ''; };
            
            // Get column order, filtered by visibility
            const fullColumnOrder = getCoachColumnOrder();
            const visibleColumns = getCoachVisibleColumns();
            const columnPool = getCoachColumnPool();
            const columnOrder = fullColumnOrder.filter(k => visibleColumns.has(k) || k === 'name' || k === 'actions');
            const gridTemplate = getCoachGridTemplate(columnOrder);
            
            // Build header cells in order
            const headerCells = columnOrder.map(key => {
                const def = columnPool.find(c => c.key === key);
                if (!def) return '<div></div>';
                
                // Name column is not draggable (locked in position)
                const isDraggable = key !== 'name';
                const draggableAttr = isDraggable ? 'draggable="true"' : 'draggable="false"';
                const dragHandlers = isDraggable ? `ondragstart="handleColumnDragStart(event, 'coach', '${key}')" ondragover="handleColumnDragOver(event)" ondrop="handleColumnDrop(event, 'coach', '${key}')" ondragend="handleColumnDragEnd(event)"` : '';
                
                // Add resize handle for resizable columns (not actions)
                const resizeHandle = (key !== 'actions') ? `<div class="column-resize-handle" onmousedown="handleColumnResizeStart(event, 'coach', '${key}')"></div>` : '';
                
                let content = '';
                const isSkillCol = (key === 'pace' || key === 'climbing' || key === 'skills');
                const displayLabel = isSkillCol && typeof getSkillSortLabel === 'function'
                    ? getSkillSortLabel(key === 'pace' ? 'pace' : key, true)
                    : def.label;
                if (def.sortable) {
                    const sortKey = key === 'level' ? 'level' : key === 'pace' ? 'pace' : key === 'skills' ? 'skills' : key === 'climbing' ? 'climbing' : 'name';
                    content = `<div class="roster-header-sortable" style="position: relative;" onclick="sortCoaches('${sortKey}')" title="Click to sort by ${def.label}" ${draggableAttr} ${dragHandlers}>${displayLabel}${resizeHandle}</div>`;
                } else {
                    content = `<div style="position: relative;" ${draggableAttr} ${dragHandlers}>${displayLabel}${resizeHandle}</div>`;
                }
                return content;
            });
            
            const header = `
                <div class="roster-header coach-grid-template" style="grid-template-columns: ${gridTemplate};">
                    ${headerCells.join('')}
                </div>
            `;

            // Group coaches if grouping is enabled
            let groupedCoaches = [];
            if (coachGroupBy) {
                const groups = new Map();
                // Use sortedCoaches which was created above
                sortedCoaches.forEach(coach => {
                    const groupValue = getCoachGroupValue(coach, coachGroupBy);
                    if (!groups.has(groupValue)) {
                        groups.set(groupValue, []);
                    }
                    groups.get(groupValue).push(coach);
                });
                
                // Sort group keys
                const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (coachGroupBy === 'name') {
                        return a.localeCompare(b);
                    } else if (coachGroupBy === 'level') {
                        const levelOrder = (label) => {
                            if (label === 'N/A') return 99;
                            const parsed = parseInt(label.replace('Level ', '') || '1', 10);
                            if (!Number.isFinite(parsed)) return 98;
                            return -parsed;
                        };
                        return levelOrder(a) - levelOrder(b);
                    } else if (coachGroupBy === 'pace') {
                        const aPace = parseInt(a.replace('Pace ', '') || '5', 10);
                        const bPace = parseInt(b.replace('Pace ', '') || '5', 10);
                        return aPace - bPace;
                    }
                    return a.localeCompare(b);
                });
                
                sortedGroupKeys.forEach(groupKey => {
                    groupedCoaches.push({ type: 'header', value: groupKey });
                    groups.get(groupKey).forEach(coach => {
                        groupedCoaches.push({ type: 'coach', data: coach });
                    });
                });
            } else {
                sortedCoaches.forEach(coach => {
                    groupedCoaches.push({ type: 'coach', data: coach });
                });
            }

            let htmlContent = header;
            let isFirstNonRoleCoach = true;
            let hasRoleCoaches = sortedCoachesWithRoles.length > 0;
            let lastItemWasRoleCoach = false;
            groupedCoaches.forEach((item, index) => {
                if (item.type === 'header') {
                    htmlContent += `<div class="roster-group-header">${escapeHtml(item.value)}</div>`;
                    lastItemWasRoleCoach = false;
                } else {
                    const coach = item.data;
                    // Check if this is the first coach without a role (after role coaches)
                    const hasRole = getCoachRole(coach.id);
                    if (hasRoleCoaches && !hasRole && isFirstNonRoleCoach) {
                        htmlContent += `<div style="grid-column: 1 / -1; height: 1px; background: #ddd; margin: 12px 0;"></div>`;
                        isFirstNonRoleCoach = false;
                    }
                    lastItemWasRoleCoach = hasRole;
                    // Support both old 'level' and new 'coachingLicenseLevel' fields
                    const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                    const levelNum = levelRaw === 'N/A' ? 0 : parseInt(levelRaw || '1', 10);
                    
                    const fitnessScale = getFitnessScale();
                    const fitnessValue = Math.max(1, Math.min(fitnessScale, parseInt(coach.fitness || Math.ceil(fitnessScale / 2), 10)));
                    const levelLabel = levelRaw === 'N/A' ? 'N/A' : `Level ${levelRaw}`;
                    const hasNotes = coach.notes && coach.notes.trim().length > 0;
                    const notesIcon = hasNotes ? `<span class="notes-icon" onclick="showNotesModal(${coach.id}, 'coach')" title="View notes">📝</span>` : '';
                    const levelClass = levelRaw === 'N/A' || levelNum === 0 ? 'coach-level-na' : levelNum === 1 ? 'coach-level-1' : levelNum === 2 ? 'coach-level-2' : levelNum === 3 ? 'coach-level-3' : '';

                    // Build row cells in column order
                    const rowCells = columnOrder.filter(key => key !== 'photo').map(key => {
                        switch(key) {
                            case 'name':
                                const coachRole = getCoachRole(coach.id);
                                const coachNickname = (coach.nickname || '').trim();
                                let coachNameWithNickname;
                                if (coachNickname && coach.nicknameMode === 'firstName') {
                                    coachNameWithNickname = `${coachNickname} ${coach.lastName || ''}`.trim();
                                } else if (coachNickname) {
                                    coachNameWithNickname = coachNickname;
                                } else {
                                    coachNameWithNickname = coach.name || '';
                                }
                                const coachNameDisplay = coachRole 
                                    ? `${escapeHtml(coachNameWithNickname)} <span style="font-style: italic; color: #666; margin-left: 8px; font-weight: normal;">${escapeHtml(coachRole)}</span>`
                                    : escapeHtml(coachNameWithNickname);
                                return `<div class="roster-cell roster-name" data-label="Name">
                                    ${coachNameDisplay}
                                    ${coach.phone ? `<a href="${formatPhoneForTel(coach.phone)}" class="roster-phone-icon coach-phone-icon" title="Call ${formatPhoneForDisplay(coach.phone)}" aria-label="Call ${formatPhoneForDisplay(coach.phone)}">📞</a>` : ''}
                                </div>`;
                            case 'phone':
                                return `<div class="roster-cell" data-label="Phone">
                                    ${formatPhoneForDisplay(coach.phone || '')}
                                </div>`;
                            case 'workPhone':
                                return `<div class="roster-cell" data-label="Work Phone">${formatPhoneForDisplay(coach.workPhone || '')}</div>`;
                            case 'homePhone':
                                return `<div class="roster-cell" data-label="Home Phone">${formatPhoneForDisplay(coach.homePhone || '')}</div>`;
                            case 'email':
                                const coachEmail = coach.email || '';
                                return `<div class="roster-cell" data-label="Email">${coachEmail ? `<a href="mailto:${escapeHtml(coachEmail)}" style="color:#1976d2;text-decoration:none;">${escapeHtml(coachEmail)}</a>` : ''}</div>`;
                            case 'gender':
                                return `<div class="roster-cell" data-label="Gender">${escapeHtml((coach.gender || '').toUpperCase())}</div>`;
                            case 'level':
                                return `<div class="roster-cell" data-label="Coach Level">
                                    ${escapeHtml(levelLabel)}
                                </div>`;
                            case 'bike':
                                const bikeManual = coach.bikeManual !== false;
                                const bikeElectric = coach.bikeElectric || false;
                                let bikeLabel = 'Manual';
                                if (bikeManual && bikeElectric) {
                                    bikeLabel = coach.bikePrimary === 'electric' ? 'Both (E)' : 'Both (M)';
                                } else if (bikeElectric) {
                                    bikeLabel = 'Electric';
                                }
                                return `<div class="roster-cell" data-label="Bike">
                                    ${escapeHtml(bikeLabel)}
                                </div>`;
                            case 'pace':
                                return `<div class="roster-cell" data-label="Endurance Rating">
                                    ${buildPaceControlsHtml('coach', coach.id, 'pace', fitnessValue, fitnessScale)}
                                </div>`;
                            case 'skills':
                                const coachSkillsScale = getSkillsScale();
                                const coachSkillsValue = Math.max(1, Math.min(coachSkillsScale, parseInt(coach.skills || Math.ceil(coachSkillsScale / 2), 10)));
                                return `<div class="roster-cell" data-label="Descending Rating">
                                    ${buildPaceControlsHtml('coach', coach.id, 'skills', coachSkillsValue, coachSkillsScale)}
                                </div>`;
                            case 'climbing':
                                const coachClimbingScale = getClimbingScale();
                                const coachClimbingValue = Math.max(1, Math.min(coachClimbingScale, parseInt(coach.climbing || '3', 10)));
                                return `<div class="roster-cell" data-label="Climbing Rating">
                                    ${buildPaceControlsHtml('coach', coach.id, 'climbing', coachClimbingValue, coachClimbingScale)}
                                </div>`;
                            case 'notes':
                                return `<div class="roster-cell" data-label="Notes">
                                    ${notesIcon}
                                </div>`;
                            case 'actions':
                                return `<div class="roster-actions">
                                    <button class="btn-small" onclick="openEditCoachModal(${coach.id})">View/Edit Full Record</button>
                                </div>`;
                            default:
                                const additionalVal = coach[key] || '';
                                const colDef = columnPool.find(c => c.key === key);
                                return `<div class="roster-cell" data-label="${escapeHtml(colDef ? colDef.label : key)}">${escapeHtml(String(additionalVal))}</div>`;
                        }
                    });
                    
                    const coachArchivedClass = coach.archived ? ' roster-row-archived' : '';
                    htmlContent += `
                        <div class="roster-row coach-grid-template ${levelClass}${coachArchivedClass}" data-coach-id="${coach.id}" style="grid-template-columns: ${gridTemplate};">
                            ${rowCells.join('')}
                        </div>
                    `;
                }
            });

            // Archived coaches section: shown at the bottom, sorted by name, separated by a divider
            const archivedCoachCount = archivedCoachesList.length;
            if (showArchivedCoaches && archivedCoachCount > 0) {
                const sortedArchivedCoaches = [...archivedCoachesList].sort((a, b) => {
                    const aName = getSortableLastName(a.name || '');
                    const bName = getSortableLastName(b.name || '');
                    return aName.localeCompare(bName);
                });
                htmlContent += `<div class="roster-archived-divider" style="grid-column: 1 / -1; padding: 10px 16px 6px; margin-top: 12px; border-top: 2px solid #ccc; color: #888; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Archived Coaches (${archivedCoachCount})</div>`;
                sortedArchivedCoaches.forEach(coach => {
                    const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                    const levelNum = levelRaw === 'N/A' ? 0 : parseInt(levelRaw || '1', 10);
                    const levelClass = levelRaw === 'N/A' || levelNum === 0 ? 'coach-level-na' : levelNum === 1 ? 'coach-level-1' : levelNum === 2 ? 'coach-level-2' : levelNum === 3 ? 'coach-level-3' : '';
                    const rowCells = columnOrder.filter(key => key !== 'photo').map(key => {
                        switch(key) {
                            case 'name':
                                const coachNickname = (coach.nickname || '').trim();
                                let coachNameWithNickname;
                                if (coachNickname && coach.nicknameMode === 'firstName') {
                                    coachNameWithNickname = `${coachNickname} ${coach.lastName || ''}`.trim();
                                } else if (coachNickname) {
                                    coachNameWithNickname = coachNickname;
                                } else {
                                    coachNameWithNickname = coach.name || '';
                                }
                                return `<div class="roster-cell roster-name" data-label="Name">
                                    ${escapeHtml(coachNameWithNickname)}
                                    ${coach.phone ? `<a href="${formatPhoneForTel(coach.phone)}" class="roster-phone-icon coach-phone-icon" title="Call ${formatPhoneForDisplay(coach.phone)}">📞</a>` : ''}
                                </div>`;
                            case 'actions':
                                return `<div class="roster-actions">
                                    <button class="btn-small" onclick="openEditCoachModal(${coach.id})">View/Edit Full Record</button>
                                </div>`;
                            default:
                                const additionalVal = coach[key] || '';
                                const colDef = columnPool.find(c => c.key === key);
                                return `<div class="roster-cell" data-label="${escapeHtml(colDef ? colDef.label : key)}">${escapeHtml(String(additionalVal))}</div>`;
                        }
                    });
                    htmlContent += `
                        <div class="roster-row coach-grid-template ${levelClass} roster-row-archived" data-coach-id="${coach.id}" style="grid-template-columns: ${gridTemplate};">
                            ${rowCells.join('')}
                        </div>
                    `;
                });
            }

            if (archivedCoachCount > 0) {
                htmlContent += `<div style="text-align:center; padding:8px;">
                    <button class="btn-small secondary show-archived-btn" onclick="toggleShowArchivedCoaches()">${showArchivedCoaches ? 'Hide' : 'Show'} Archived Coaches (${archivedCoachCount})</button>
                </div>`;
            }

            list.innerHTML = htmlContent;

            requestAnimationFrame(() => { if (typeof syncSkillHeaderWrap === 'function') syncSkillHeaderWrap(); });

            // Update CSV button label based on roster state
            const csvBtn = document.getElementById('btn-csv-coaches');
            if (csvBtn) {
                const activeCoaches = data.coaches.filter(c => !c.archived);
                csvBtn.textContent = activeCoaches.length > 0 ? 'Update Coaches from CSV' : 'Import Coaches from CSV';
            }
        }

        function openEditCoachModal(id) {
            const coach = data.coaches.find(c => c.id === id);
            if (!coach) return;

            currentEditingCoachId = id;
            const modal = document.getElementById('edit-coach-modal');
            if (!modal) return;

            const titleEl = document.getElementById('edit-coach-modal-title');
            if (titleEl) titleEl.textContent = 'Edit Coach';
            
            const deleteBtn = document.getElementById('delete-coach-btn');
            if (deleteBtn) deleteBtn.style.display = 'block';

            // Show archive/restore button
            const archiveCoachBtn = document.getElementById('archive-coach-btn');
            if (archiveCoachBtn) {
                archiveCoachBtn.style.display = 'inline-block';
                archiveCoachBtn.textContent = coach.archived ? 'Restore' : 'Archive';
                archiveCoachBtn.style.background = coach.archived ? '#2a7d2a' : '#888';
            }

            // Populate name fields (prefer explicit first/last if present, otherwise split full name)
            const coachFirstNameInput = document.getElementById('edit-coach-first-name');
            const coachLastNameInput = document.getElementById('edit-coach-last-name');
            const coachFullName = coach.name || '';
            let coachFirstName = coach.firstName || '';
            let coachLastName = coach.lastName || '';
            if (!coachFirstName && !coachLastName && coachFullName) {
                const nameParts = coachFullName.trim().split(' ');
                if (nameParts.length > 1) {
                    coachLastName = nameParts.pop();
                    coachFirstName = nameParts.join(' ');
                } else {
                    coachFirstName = coachFullName;
                }
            }
            if (coachFirstNameInput) coachFirstNameInput.value = coachFirstName || '';
            if (coachLastNameInput) coachLastNameInput.value = coachLastName || '';
            
            // Populate nickname
            const coachNicknameInput = document.getElementById('edit-coach-nickname');
            if (coachNicknameInput) coachNicknameInput.value = coach.nickname || '';
            const coachNickModeFirst = document.getElementById('edit-coach-nickname-mode-first');
            const coachNickModeWhole = document.getElementById('edit-coach-nickname-mode-whole');
            if (coachNickModeFirst) coachNickModeFirst.checked = coach.nicknameMode === 'firstName';
            if (coachNickModeWhole) coachNickModeWhole.checked = coach.nicknameMode === 'wholeName' || (!coach.nicknameMode && !!coach.nickname);
            
            // Populate bike fields
            const bikeManualCb = document.getElementById('edit-coach-bike-manual');
            const bikeElectricCb = document.getElementById('edit-coach-bike-electric');
            const bikePrimarySelect = document.getElementById('edit-coach-bike-primary');
            if (bikeManualCb) bikeManualCb.checked = coach.bikeManual !== false;
            if (bikeElectricCb) bikeElectricCb.checked = coach.bikeElectric || false;
            if (bikePrimarySelect) bikePrimarySelect.value = coach.bikePrimary || 'manual';
            toggleBikePrimaryDropdown();
            
            // Format phone number
            const coachPhone = (coach.phone || '').replace(/\D/g, '');
            if (coachPhone.length === 10) {
                const formattedPhone = `(${coachPhone.substring(0, 3)}) ${coachPhone.substring(3, 6)}-${coachPhone.substring(6, 10)}`;
                document.getElementById('edit-coach-phone').value = formattedPhone;
            } else if (coach.phone) {
                document.getElementById('edit-coach-phone').value = formatPhoneForDisplay(coach.phone);
            } else {
                document.getElementById('edit-coach-phone').value = '';
            }
            
            // Populate all CSV fields
            document.getElementById('edit-coach-email').value = coach.email || '';
            
            // Format work phone
            const workPhone = (coach.workPhone || '').replace(/\D/g, '');
            if (workPhone.length === 10) {
                document.getElementById('edit-coach-work-phone').value = `(${workPhone.substring(0, 3)}) ${workPhone.substring(3, 6)}-${workPhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-coach-work-phone').value = coach.workPhone || '';
            }
            
            // Format home phone
            const homePhone = (coach.homePhone || '').replace(/\D/g, '');
            if (homePhone.length === 10) {
                document.getElementById('edit-coach-home-phone').value = `(${homePhone.substring(0, 3)}) ${homePhone.substring(3, 6)}-${homePhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-coach-home-phone').value = coach.homePhone || '';
            }
            
            document.getElementById('edit-coach-gender').value = coach.gender || '';
            
            // Support both old 'level' and new 'coachingLicenseLevel' fields
            const coachLevel = coach.coachingLicenseLevel || coach.level || '1';
            document.getElementById('edit-coach-level').value = coachLevel;
            
            document.getElementById('edit-coach-registered').value = coach.registered || '';
            document.getElementById('edit-coach-paid').value = coach.paid || '';
            document.getElementById('edit-coach-background-check').value = coach.backgroundCheck || '';
            document.getElementById('edit-coach-level3-exam').value = coach.level3ExamCompleted || '';
            document.getElementById('edit-coach-pdu-ceu').value = coach.pduCeuUnits || '';
            document.getElementById('edit-coach-field-work-hours').value = coach.fieldWorkHours || '';
            document.getElementById('edit-coach-first-aid').value = coach.firstAidTypeExpires || '';
            document.getElementById('edit-coach-cpr-expires').value = coach.cprExpires || '';
            document.getElementById('edit-coach-concussion-training').value = coach.concussionTrainingCompleted || '';
            document.getElementById('edit-coach-nica-philosophy').value = coach.nicaPhilosophyCompleted || '';
            document.getElementById('edit-coach-abuse-awareness').value = coach.athleteAbuseAwarenessCompleted || '';
            document.getElementById('edit-coach-license-level1').value = coach.licenseLevel1Completed || '';
            document.getElementById('edit-coach-license-level2').value = coach.licenseLevel2Completed || '';
            document.getElementById('edit-coach-license-level3').value = coach.licenseLevel3Completed || '';
            document.getElementById('edit-coach-otb-classroom').value = coach.otbSkills101ClassroomCompleted || '';
            document.getElementById('edit-coach-otb-outdoor').value = coach.otbSkills101OutdoorCompleted || '';
            document.getElementById('edit-coach-nica-summit').value = coach.nicaLeaderSummitCompleted || '';
            
            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();
            const climbingScale = getClimbingScale();
            document.getElementById('edit-coach-fitness').value = Math.max(1, Math.min(fitnessScale, parseInt(coach.fitness || Math.ceil(fitnessScale / 2), 10)));
            document.getElementById('edit-coach-climbing').value = Math.max(1, Math.min(climbingScale, parseInt(coach.climbing || Math.ceil(climbingScale / 2), 10)));
            document.getElementById('edit-coach-skills').value = Math.max(1, Math.min(skillsScale, parseInt(coach.skills || Math.ceil(skillsScale / 2), 10)));
            document.getElementById('edit-coach-notes').value = coach.notes || '';

            // Update photo preview
            const photoPreview = document.getElementById('edit-coach-photo-preview');
            const photoPlaceholder = document.getElementById('edit-coach-photo-placeholder');
            if (coach.photo) {
                photoPreview.src = coach.photo;
                photoPreview.style.display = 'block';
                photoPlaceholder.style.display = 'none';
            } else {
                photoPreview.style.display = 'none';
                photoPlaceholder.style.display = 'flex';
            }

            // Render scheduled absences
            renderCoachAbsencesList(id);
            cancelCoachAbsenceForm();

            // Hide edit modal rows for fields disabled in CSV mapping
            const coachEnabledFields = data.seasonSettings?.csvFieldMappings?.coaches?.enabledFields || {};
            const coachFieldToInputId = {
                email: 'edit-coach-email',
                workPhone: 'edit-coach-work-phone',
                homePhone: 'edit-coach-home-phone',
                gender: 'edit-coach-gender',
                coachingLicenseLevel: 'edit-coach-level',
                registered: 'edit-coach-registered',
                paid: 'edit-coach-paid',
                backgroundCheck: 'edit-coach-background-check',
                level3ExamCompleted: 'edit-coach-level3-exam',
                pduCeuUnits: 'edit-coach-pdu-ceu',
                fieldWorkHours: 'edit-coach-field-work-hours',
                firstAidTypeExpires: 'edit-coach-first-aid',
                cprExpires: 'edit-coach-cpr-expires',
                concussionTrainingCompleted: 'edit-coach-concussion-training',
                nicaPhilosophyCompleted: 'edit-coach-nica-philosophy',
                athleteAbuseAwarenessCompleted: 'edit-coach-abuse-awareness',
                licenseLevel1Completed: 'edit-coach-license-level1',
                licenseLevel2Completed: 'edit-coach-license-level2',
                licenseLevel3Completed: 'edit-coach-license-level3',
                otbSkills101ClassroomCompleted: 'edit-coach-otb-classroom',
                otbSkills101OutdoorCompleted: 'edit-coach-otb-outdoor',
                nicaLeaderSummitCompleted: 'edit-coach-nica-summit'
            };
            Object.keys(coachFieldToInputId).forEach(fieldKey => {
                const inputEl = document.getElementById(coachFieldToInputId[fieldKey]);
                if (inputEl) {
                    const row = inputEl.closest('tr');
                    if (row) row.style.display = coachEnabledFields[fieldKey] === false ? 'none' : '';
                }
            });

            // Dynamically inject additional/custom field rows into the edit table
            const coachAdditionalFields = data.seasonSettings?.csvFieldMappings?.coaches?.additionalFields || {};
            const coachCustomNames = data.seasonSettings?.csvFieldMappings?.coaches?.customFieldNames || {};

            // Remove any previously injected additional field rows
            modal.querySelectorAll('[data-additional-field]').forEach(row => row.remove());

            // Find the Notes row to insert before it
            const notesInput = document.getElementById('edit-coach-notes');
            const notesRow = notesInput ? notesInput.closest('tr') : null;
            const editTable = modal.querySelector('.modal-edit-table');

            if (editTable) {
                Object.keys(coachAdditionalFields).forEach(fieldName => {
                    const displayName = coachCustomNames[fieldName] || fieldName;
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-additional-field', fieldName);
                    const inputId = `edit-coach-additional-${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    tr.innerHTML = `<td class="modal-edit-label">${escapeHtml(displayName)}</td><td><input type="text" id="${inputId}" class="modal-field-input" value="${escapeHtml(coach[fieldName] || '')}"></td>`;
                    if (notesRow) {
                        notesRow.parentNode.insertBefore(tr, notesRow);
                    } else {
                        const tbody = editTable.querySelector('tbody') || editTable;
                        tbody.appendChild(tr);
                    }
                });
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function openAddCoachModal() {
            currentEditingCoachId = null;
            const modal = document.getElementById('edit-coach-modal');
            if (!modal) return;

            const titleEl = document.getElementById('edit-coach-modal-title');
            if (titleEl) titleEl.textContent = 'Add Coach';
            
            const deleteBtn = document.getElementById('delete-coach-btn');
            if (deleteBtn) deleteBtn.style.display = 'none';

            const coachFirstNameInput = document.getElementById('edit-coach-first-name');
            const coachLastNameInput = document.getElementById('edit-coach-last-name');
            if (coachFirstNameInput) coachFirstNameInput.value = '';
            if (coachLastNameInput) coachLastNameInput.value = '';
            document.getElementById('edit-coach-phone').value = '';
            document.getElementById('edit-coach-level').value = 'N/A';
            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();
            document.getElementById('edit-coach-fitness').value = Math.ceil(fitnessScale / 2);
            document.getElementById('edit-coach-skills').value = Math.ceil(skillsScale / 2);
            document.getElementById('edit-coach-notes').value = '';

            // Reset photo preview
            const photoPreview = document.getElementById('edit-coach-photo-preview');
            const photoPlaceholder = document.getElementById('edit-coach-photo-placeholder');
            photoPreview.style.display = 'none';
            photoPlaceholder.style.display = 'flex';
            document.getElementById('edit-coach-photo-input').value = '';

            // Clear absences for new coach
            const absencesList = document.getElementById('edit-coach-absences-list');
            if (absencesList) absencesList.innerHTML = '<span class="absence-empty">No absences scheduled</span>';
            cancelCoachAbsenceForm();

            // Show all field rows when adding (no mapping restriction)
            modal.querySelectorAll('tr').forEach(tr => { tr.style.display = ''; });

            // Inject additional/custom field rows with blank values
            const addCoachAdditionalFields = data.seasonSettings?.csvFieldMappings?.coaches?.additionalFields || {};
            const addCoachCustomNames = data.seasonSettings?.csvFieldMappings?.coaches?.customFieldNames || {};
            modal.querySelectorAll('[data-additional-field]').forEach(row => row.remove());
            const addNotesInput = document.getElementById('edit-coach-notes');
            const addNotesRow = addNotesInput ? addNotesInput.closest('tr') : null;
            const addEditTable = modal.querySelector('.modal-edit-table');
            if (addEditTable) {
                Object.keys(addCoachAdditionalFields).forEach(fieldName => {
                    const displayName = addCoachCustomNames[fieldName] || fieldName;
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-additional-field', fieldName);
                    const inputId = `edit-coach-additional-${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    tr.innerHTML = `<td class="modal-edit-label">${escapeHtml(displayName)}</td><td><input type="text" id="${inputId}" class="modal-field-input" value=""></td>`;
                    if (addNotesRow) {
                        addNotesRow.parentNode.insertBefore(tr, addNotesRow);
                    } else {
                        const tbody = addEditTable.querySelector('tbody') || addEditTable;
                        tbody.appendChild(tr);
                    }
                });
            }

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function toggleBikePrimaryDropdown() {
            const manualCb = document.getElementById('edit-coach-bike-manual');
            const electricCb = document.getElementById('edit-coach-bike-electric');
            const primaryDropdown = document.getElementById('edit-coach-bike-primary');
            if (!manualCb || !electricCb || !primaryDropdown) return;
            // Show dropdown only when both are checked
            primaryDropdown.style.display = (manualCb.checked && electricCb.checked) ? 'inline-block' : 'none';
        }

        function closeEditCoachModal() {
            const modal = document.getElementById('edit-coach-modal');
            if (!modal) return;
            // Blur any focused elements before hiding modal to avoid aria-hidden warning
            const focusedElement = document.activeElement;
            if (focusedElement && modal.contains(focusedElement)) {
                focusedElement.blur();
            }
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            currentEditingCoachId = null;
        }

        async function saveCoachFromModal() {
            // Permission check - allow if canEditCoaches exists, otherwise allow by default
            if (typeof canEditCoaches === 'function' && !canEditCoaches()) {
                alert('You do not have permission to edit coach records');
                return;
            }

            const coachFirstNameInput = document.getElementById('edit-coach-first-name');
            const coachLastNameInput = document.getElementById('edit-coach-last-name');
            const firstName = coachFirstNameInput ? coachFirstNameInput.value.trim() : '';
            const lastName = coachLastNameInput ? coachLastNameInput.value.trim() : '';
            const name = `${firstName} ${lastName}`.trim();
            if (!firstName && !lastName) {
                alert('Please enter a coach first or last name');
                return;
            }

            const phoneInputEl = document.getElementById('edit-coach-phone');
            if (!phoneInputEl) {
                alert('Phone input field not found');
                return;
            }
            const phoneInput = phoneInputEl.value.trim();
            const phoneDigits = phoneInput.replace(/\D/g, '');
            
            if (phoneDigits.length !== 10) {
                alert('Please enter a valid 10-digit phone number');
                return;
            }
            
            const phone = phoneDigits; // Store as digits only
            const levelInputEl = document.getElementById('edit-coach-level');
            const levelValue = levelInputEl ? levelInputEl.value : '1';
            const fitnessInputEl = document.getElementById('edit-coach-fitness');
            const fitnessInput = fitnessInputEl ? fitnessInputEl.value : String(Math.ceil(getFitnessScale() / 2));
            const notesInputEl = document.getElementById('edit-coach-notes');
            const notes = notesInputEl ? notesInputEl.value.trim() : '';

            const fitnessScale = getFitnessScale();
            const fitnessValue = Math.max(1, Math.min(fitnessScale, parseInt(fitnessInput || Math.ceil(fitnessScale / 2), 10)));
            const coachingLicenseLevel = ['1', '2', '3', 'N/A'].includes(levelValue) ? levelValue : 'N/A';

            // Get gender value (needed for photo default and coachData)
            const genderEl = document.getElementById('edit-coach-gender');
            const gender = genderEl ? (genderEl.value || '').toUpperCase() : '';

            // Get photo from preview or input
            let photo = '';
            const photoPreview = document.getElementById('edit-coach-photo-preview');
            const photoInput = document.getElementById('edit-coach-photo-input');
            
            // Check if a new photo was uploaded
            if (photoInput && photoInput.files && photoInput.files.length > 0) {
                // Read the uploaded file
                const file = photoInput.files[0];
                const reader = new FileReader();
                photo = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(file);
                });
            } else if (photoPreview && photoPreview.style.display !== 'none' && photoPreview.src) {
                // Use existing photo from preview
                photo = photoPreview.src;
            } else {
                // If no photo uploaded, use default based on gender
                if (gender === 'M') photo = 'assets/male_default.png';
                else if (gender === 'F') photo = 'assets/female_default.png';
                else photo = 'assets/nonbinary_default.png';
            }

            // Get all CSV fields
            const emailEl = document.getElementById('edit-coach-email');
            const email = emailEl ? emailEl.value.trim() : '';
            const workPhoneInputEl = document.getElementById('edit-coach-work-phone');
            const workPhoneInput = workPhoneInputEl ? workPhoneInputEl.value.trim() : '';
            const workPhoneDigits = workPhoneInput.replace(/\D/g, '');
            const workPhone = workPhoneDigits.length === 10 ? workPhoneDigits : '';
            const homePhoneInputEl = document.getElementById('edit-coach-home-phone');
            const homePhoneInput = homePhoneInputEl ? homePhoneInputEl.value.trim() : '';
            const homePhoneDigits = homePhoneInput.replace(/\D/g, '');
            const homePhone = homePhoneDigits.length === 10 ? homePhoneDigits : '';
            
            // Helper function to safely get field value
            const getFieldValue = (fieldId, defaultValue = '') => {
                const el = document.getElementById(fieldId);
                return el ? el.value.trim() : defaultValue;
            };
            
            const skillsInputEl = document.getElementById('edit-coach-skills');
            const skillsScale = getSkillsScale();
            const skillsValue = skillsInputEl ? Math.max(1, Math.min(skillsScale, parseInt(skillsInputEl.value || Math.ceil(skillsScale / 2), 10))) : Math.ceil(skillsScale / 2);
            const climbingInputEl = document.getElementById('edit-coach-climbing');
            const climbingScale = getClimbingScale();
            const climbingValue = climbingInputEl ? Math.max(1, Math.min(climbingScale, parseInt(climbingInputEl.value || Math.ceil(climbingScale / 2), 10))) : Math.ceil(climbingScale / 2);
            
            const nickname = getFieldValue('edit-coach-nickname');
            const coachNickModeRadio = document.querySelector('input[name="coach-nickname-mode"]:checked');
            const nicknameMode = nickname ? (coachNickModeRadio ? coachNickModeRadio.value : 'wholeName') : '';
            
            // Get bike field values
            const bikeManualCb = document.getElementById('edit-coach-bike-manual');
            const bikeElectricCb = document.getElementById('edit-coach-bike-electric');
            const bikePrimarySelect = document.getElementById('edit-coach-bike-primary');
            const bikeManual = bikeManualCb ? bikeManualCb.checked : true;
            const bikeElectric = bikeElectricCb ? bikeElectricCb.checked : false;
            const bikePrimary = (bikeManual && bikeElectric && bikePrimarySelect) ? bikePrimarySelect.value : (bikeElectric ? 'electric' : 'manual');
            
            const coachData = {
                name,
                firstName,
                lastName,
                nickname,
                nicknameMode,
                phone,
                photo,
                email,
                workPhone,
                homePhone,
                gender,
                coachingLicenseLevel,
                bikeManual,
                bikeElectric,
                bikePrimary,
                registered: getFieldValue('edit-coach-registered'),
                paid: getFieldValue('edit-coach-paid'),
                backgroundCheck: getFieldValue('edit-coach-background-check'),
                level3ExamCompleted: getFieldValue('edit-coach-level3-exam'),
                pduCeuUnits: getFieldValue('edit-coach-pdu-ceu'),
                fieldWorkHours: getFieldValue('edit-coach-field-work-hours'),
                firstAidTypeExpires: getFieldValue('edit-coach-first-aid'),
                cprExpires: getFieldValue('edit-coach-cpr-expires'),
                concussionTrainingCompleted: getFieldValue('edit-coach-concussion-training'),
                nicaPhilosophyCompleted: getFieldValue('edit-coach-nica-philosophy'),
                athleteAbuseAwarenessCompleted: getFieldValue('edit-coach-abuse-awareness'),
                licenseLevel1Completed: getFieldValue('edit-coach-license-level1'),
                licenseLevel2Completed: getFieldValue('edit-coach-license-level2'),
                licenseLevel3Completed: getFieldValue('edit-coach-license-level3'),
                otbSkills101ClassroomCompleted: getFieldValue('edit-coach-otb-classroom'),
                otbSkills101OutdoorCompleted: getFieldValue('edit-coach-otb-outdoor'),
                nicaLeaderSummitCompleted: getFieldValue('edit-coach-nica-summit'),
                fitness: String(fitnessValue),
                climbing: String(climbingValue),
                skills: String(skillsValue),
                notes
            };

            // Read additional/custom field values from dynamically injected rows
            const modalEl = document.getElementById('edit-coach-modal');
            if (modalEl) {
                modalEl.querySelectorAll('[data-additional-field]').forEach(row => {
                    const fieldName = row.getAttribute('data-additional-field');
                    const input = row.querySelector('input');
                    if (fieldName && input) {
                        coachData[fieldName] = input.value.trim();
                    }
                });
            }

            if (currentEditingCoachId) {
                coachData.id = currentEditingCoachId;
            }

            try {
                await saveCoachToDB(coachData);
                renderCoaches();
                closeEditCoachModal();
                if (data.currentRide) {
                    const ride = data.rides.find(r => r.id === data.currentRide);
                    if (ride) {
                        renderAssignments(ride);
                    }
                }
            } catch (error) {
                console.error('Error saving coach:', error);
                alert('Error saving coach: ' + (error.message || 'Unknown error'));
            }
        }

        async function handleCoachPhotoUploadInModal(input) {
            if (!input.files || input.files.length === 0) return;
            
            const file = input.files[0];
            
            // Show crop dialog
            const croppedPhoto = await showPhotoCropDialog(file);
            if (!croppedPhoto) return; // User cancelled

            const photoPreview = document.getElementById('edit-coach-photo-preview');
            const photoPlaceholder = document.getElementById('edit-coach-photo-placeholder');
            
            photoPreview.src = croppedPhoto;
            photoPreview.style.display = 'block';
            photoPlaceholder.style.display = 'none';
        }

        function deleteCoachFromModal() {
            if (!currentEditingCoachId) return;
            deleteCoach(currentEditingCoachId, true);
            closeEditCoachModal();
        }

        // ============ COACH ABSENCE FUNCTIONS ============

        function renderCoachAbsencesList(coachId) {
            const container = document.getElementById('edit-coach-absences-list');
            if (!container) return;
            const absences = getAbsencesForPerson('coach', coachId);
            if (absences.length === 0) {
                container.innerHTML = '<span class="absence-empty">No absences scheduled</span>';
                return;
            }
            container.innerHTML = absences.map(a => {
                const startFormatted = a.startDate ? new Date(a.startDate + 'T00:00:00').toLocaleDateString() : '';
                const endFormatted = a.endDate ? new Date(a.endDate + 'T00:00:00').toLocaleDateString() : '';
                return `<div class="absence-row">
                    <span class="absence-dates">${startFormatted} – ${endFormatted}</span>
                    <span class="absence-reason">${formatAbsenceReason(a.reason)}</span>
                    <button class="absence-delete-btn" onclick="removeCoachAbsence(${a.id})" title="Remove absence">✕</button>
                </div>`;
            }).join('');
        }

        function showCoachAbsenceForm() {
            const form = document.getElementById('edit-coach-absence-form');
            if (form) {
                form.style.display = 'block';
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('edit-coach-absence-start').value = today;
                document.getElementById('edit-coach-absence-end').value = today;
                document.getElementById('edit-coach-absence-reason').value = 'injured';
            }
            const addBtn = document.getElementById('edit-coach-add-absence-btn');
            if (addBtn) addBtn.style.display = 'none';
        }

        function cancelCoachAbsenceForm() {
            const form = document.getElementById('edit-coach-absence-form');
            if (form) form.style.display = 'none';
            const addBtn = document.getElementById('edit-coach-add-absence-btn');
            if (addBtn) addBtn.style.display = '';
        }

        async function saveCoachAbsence() {
            if (!currentEditingCoachId) return;
            const startDate = document.getElementById('edit-coach-absence-start').value;
            const endDate = document.getElementById('edit-coach-absence-end').value;
            const reason = document.getElementById('edit-coach-absence-reason').value;

            if (!startDate || !endDate) {
                alert('Please select both start and end dates.');
                return;
            }
            if (endDate < startDate) {
                alert('End date must be on or after start date.');
                return;
            }

            try {
                const newAbsence = await createScheduledAbsence({
                    personType: 'coach',
                    personId: currentEditingCoachId,
                    startDate: startDate,
                    endDate: endDate,
                    reason: reason
                });
                data.scheduledAbsences.push(newAbsence);
                renderCoachAbsencesList(currentEditingCoachId);
                cancelCoachAbsenceForm();
            } catch (err) {
                console.error('Failed to save coach absence:', err);
                alert('Failed to save absence. Please try again.');
            }
        }

        async function removeCoachAbsence(absenceId) {
            if (!confirm('Remove this scheduled absence?')) return;
            try {
                await deleteScheduledAbsence(absenceId);
                data.scheduledAbsences = data.scheduledAbsences.filter(a => a.id !== absenceId);
                if (currentEditingCoachId) {
                    renderCoachAbsencesList(currentEditingCoachId);
                }
            } catch (err) {
                console.error('Failed to remove coach absence:', err);
                alert('Failed to remove absence. Please try again.');
            }
        }
