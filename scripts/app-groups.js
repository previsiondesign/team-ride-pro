// app-groups.js - Group creation, auto-assignment, coach optimization, drag-drop, rendering

        function generateId() {
            return Date.now() + Math.floor(Math.random() * 100000);
        }

        function normalizeCoachId(value) {
            const id = parseInt(value, 10);
            return Number.isFinite(id) ? id : null;
        }

        function normalizeTimeValue(value) {
            if (!value && value !== 0) return '';
            const stringValue = String(value).trim();
            const match = stringValue.match(/^(\d{1,2})(?::?(\d{2}))?$/);
            if (!match) {
                const parts = stringValue.split(':');
                if (parts.length >= 2) {
                    const hour = Math.max(0, Math.min(23, parseInt(parts[0], 10) || 0));
                    const minute = Math.max(0, Math.min(59, parseInt(parts[1], 10) || 0));
                    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                }
                return '';
            }

            const hour = Math.max(0, Math.min(23, parseInt(match[1], 10) || 0));
            const minute = Math.max(0, Math.min(59, parseInt(match[2] !== undefined ? match[2] : '0', 10) || 0));
            return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }

        function normalizePracticeEntry(entry) {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const normalizedDay = Number.isFinite(entry.dayOfWeek)
                ? entry.dayOfWeek
                : Number.isFinite(entry.day)
                    ? entry.day
                    : Number.isFinite(entry.weekday)
                        ? entry.weekday
                        : parseInt(entry.dayOfWeek ?? entry.day ?? entry.weekday, 10);

            const dayOfWeek = Number.isFinite(normalizedDay) ? normalizedDay : NaN;
            if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
                return null;
            }

            const time = normalizeTimeValue(entry.time || entry.startTime || '');
            if (!time) {
                return null;
            }

            const endTime = normalizeTimeValue(entry.endTime || '');

            return {
                id: entry.id || generateId(),
                dayOfWeek,
                time,
                endTime,
                description: entry.description || '',
                meetLocation: entry.meetLocation || '',
                locationLat: entry.locationLat != null && Number.isFinite(parseFloat(entry.locationLat)) ? parseFloat(entry.locationLat) : null,
                locationLng: entry.locationLng != null && Number.isFinite(parseFloat(entry.locationLng)) ? parseFloat(entry.locationLng) : null,
                rosterFilter: entry.rosterFilter || null,
                excludeFromPlanner: entry.excludeFromPlanner || false
            };
        }

        function createGroup(label) {
            return {
                id: generateId(),
                label,
                coaches: {
                    leader: null,
                    sweep: null,
                    roam: null,
                    extraRoam: []
                },
                riders: [],
                fitnessTag: null,
                sortBy: 'pace', // Default sort by pace
                routeId: null // Route assigned to this group
            };
        }

        function computeGroupsInfo(ride) {
            return ride.groups.map(group => {
                const capacity = groupCapacity(group);
                const preferredGroupSizeMin = getAutoAssignSettingMin('preferredGroupSize', 4);
                const preferredGroupSizeMax = getAutoAssignSettingMax('preferredGroupSize', 8);
                const preferredGroupSize = getAutoAssignSetting('preferredGroupSize', 7);
                
                // Determine target sizes based on priority order
                // Capacity (ridersPerCoach) is the absolute limit
                // preferredGroupSize range is used for constraints
                const baseMax = Math.min(preferredGroupSizeMax, capacity);
                const targetMax = Math.max(1, baseMax);
                const targetPreferred = Math.min(preferredGroupSize, targetMax);
                const targetMin = Math.min(preferredGroupSizeMin, targetPreferred);
                
                return {
                    group,
                    capacity,
                    targetMin,
                    targetPreferred,
                    targetMax,
                    fitness: group.fitnessTag != null ? parseInt(group.fitnessTag, 10) : null,
                    // Store priorities for decision making
                    preferredGroupSizePriority: getParamPriority('preferredGroupSize')
                };
            }).filter(info => info.capacity > 0);
        }

        function addExtraCoach(group, coachId) {
            if (!coachId) return;
            if (group.coaches.leader === coachId || group.coaches.sweep === coachId || group.coaches.roam === coachId) {
                return;
            }
            if (!Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam = [];
            }
            if (!group.coaches.extraRoam.includes(coachId)) {
                group.coaches.extraRoam.push(coachId);
            }
        }

        function mergeSmallGroups(ride, debugLines) {
            let mergedSomething = true;
            while (mergedSomething) {
                mergedSomething = false;
                const infos = computeGroupsInfo(ride);
                const minGroupSize = getMIN_GROUP_SIZE();
                for (const info of infos) {
                    const group = info.group;
                    if (group.riders.length >= minGroupSize) {
                        continue;
                    }
                    const sourceFitness = info.fitness;
                    let bestCandidate = null;
                    for (const candidate of infos) {
                        if (candidate.group === group) continue;
                        // Use capacity as the limit (ridersPerCoach × coach count)
                        const capacityLimit = candidate.capacity;
                        if (candidate.group.riders.length + group.riders.length > capacityLimit) continue;
                        const targetFitness = candidate.fitness;
                        const maxFitnessSpread = getMAX_FITNESS_SPREAD();
                        const diff = (sourceFitness != null && targetFitness != null)
                            ? Math.abs(targetFitness - sourceFitness)
                            : maxFitnessSpread;
                        if (diff > maxFitnessSpread) continue;
                        if (
                            !bestCandidate ||
                            diff < bestCandidate.diff ||
                            (diff === bestCandidate.diff && candidate.group.riders.length < bestCandidate.info.group.riders.length)
                        ) {
                            bestCandidate = { info: candidate, diff };
                        }
                    }

                    if (bestCandidate) {
                        const target = bestCandidate.info.group;
                        const groupLabel = `${group.label}`;
                        const targetLabel = `${target.label}`;

                        if (group.coaches.sweep && !target.coaches.sweep) {
                            target.coaches.sweep = group.coaches.sweep;
                        } else {
                            addExtraCoach(target, group.coaches.sweep);
                        }

                        if (group.coaches.roam && !target.coaches.roam) {
                            target.coaches.roam = group.coaches.roam;
                        } else {
                            addExtraCoach(target, group.coaches.roam);
                        }

                        addExtraCoach(target, group.coaches.leader);

                        if (Array.isArray(group.coaches.extraRoam)) {
                            group.coaches.extraRoam.forEach(id => addExtraCoach(target, id));
                        }

                        target.riders = target.riders.concat(group.riders);
                        debugLines.push(`Merged ${groupLabel} (${group.riders.length} riders) into ${targetLabel} (fitness diff ${bestCandidate.diff}).`);

                        ride.groups = ride.groups.filter(g => g !== group);
                        mergedSomething = true;
                        break;
                    }
                }
            }

            const postMergeInfos = computeGroupsInfo(ride);
            const minGroupSize = getMIN_GROUP_SIZE();
            postMergeInfos.forEach(info => {
                if (info.group.riders.length < minGroupSize) {
                    debugLines.push(`⚠️ ${info.group.label} remains below minimum size with ${info.group.riders.length} riders.`);
                }
            });
        }

        function dissolveSmallGroups(ride, debugLines) {
            let dissolved = false;
            let groupsInfo = computeGroupsInfo(ride);
            const minGroupSize = getMIN_GROUP_SIZE();
            const maxFitnessSpread = getMAX_FITNESS_SPREAD();
            groupsInfo
                .filter(info => info.group.riders.length > 0 && info.group.riders.length < minGroupSize)
                .forEach(info => {
                    const sourceGroup = info.group;
                    const sourceFitness = info.fitness;
                    const riderCount = sourceGroup.riders.length;

                    let targetInfo = null;
                    let usedDiff = null;
                    const allowedDiffs = [maxFitnessSpread, maxFitnessSpread + 1, maxFitnessSpread + 2];

                    for (const allowedDiff of allowedDiffs) {
                        const candidates = computeGroupsInfo(ride)
                            .filter(candidate => candidate.group !== sourceGroup)
                            .map(candidate => {
                                const projectedSize = candidate.group.riders.length + riderCount;
                                const diff = (sourceFitness != null && candidate.fitness != null)
                                    ? Math.abs(candidate.fitness - sourceFitness)
                                    : 0;
                                return { candidate, projectedSize, diff };
                            })
                            .filter(entry => {
                                // Use capacity as the limit (ridersPerCoach × coach count)
                                const sizeLimit = entry.candidate.capacity;
                                return entry.projectedSize <= sizeLimit && entry.diff <= allowedDiff;
                            })
                            .sort((a, b) => {
                                if (a.diff !== b.diff) return a.diff - b.diff;
                                return a.candidate.group.riders.length - b.candidate.group.riders.length;
                            });

                        if (candidates.length > 0) {
                            targetInfo = candidates[0].candidate;
                            usedDiff = candidates[0].diff;
                            break;
                        }
                    }

                    if (!targetInfo) {
                        debugLines.push(`⚠️ Unable to dissolve ${sourceGroup.label}; no groups can accept ${riderCount} riders without exceeding size limits.`);
                        return;
                    }

                    const targetGroup = targetInfo.group;

                    sourceGroup.riders.forEach(riderId => {
                        if (!targetGroup.riders.includes(riderId)) {
                            targetGroup.riders.push(riderId);
                        }
                    });

                    if (targetGroup.fitnessTag == null && sourceGroup.fitnessTag != null) {
                        targetGroup.fitnessTag = sourceGroup.fitnessTag;
                    }

                    addExtraCoach(targetGroup, sourceGroup.coaches.leader);
                    if (sourceGroup.coaches.sweep && !targetGroup.coaches.sweep) {
                        targetGroup.coaches.sweep = sourceGroup.coaches.sweep;
                    } else {
                        addExtraCoach(targetGroup, sourceGroup.coaches.sweep);
                    }
                    if (sourceGroup.coaches.roam && !targetGroup.coaches.roam) {
                        targetGroup.coaches.roam = sourceGroup.coaches.roam;
                    } else {
                        addExtraCoach(targetGroup, sourceGroup.coaches.roam);
                    }
                    if (Array.isArray(sourceGroup.coaches.extraRoam)) {
                        sourceGroup.coaches.extraRoam.forEach(id => addExtraCoach(targetGroup, id));
                    }

                    const diffNote = usedDiff != null ? ` (fitness diff ${usedDiff})` : '';
                    debugLines.push(`Dissolved ${sourceGroup.label} (${riderCount} riders) into ${targetGroup.label}${diffNote}.`);
                    ride.groups = ride.groups.filter(group => group !== sourceGroup);
                    dissolved = true;
                });

            // Don't renumber - keep group names persistent
        }

        function renderRiderCardHtml(rider, options = {}) {
            const {
                draggable = true,
                showAttendance = false,
                isAvailable = true,
                assignmentLabel = '',
                checkboxHandler = null,
                compact = false,
                showMoveControls = false,
                groupId = null,
                canMoveUp = false,
                canMoveDown = false,
                sortBy = 'pace',
                noPhoto = false,
                inGroup = false,
                showUnavailableStyle = false,
                hideBadges = false,
                isUnassigned = false,
                visibleSkills = null,
                scheduledAbsent = false,
                absenceReasonText = '',
                sidebarCard = false
            } = options;

            const riderFieldMapping = data.seasonSettings?.csvFieldMappings?.riders?.enabledFields || {};

            // Extract firstName and lastName for formatting
            let firstName = rider.firstName || '';
            let lastName = rider.lastName || '';
            if (!firstName && !lastName && rider.name) {
                const nameParts = rider.name.trim().split(/\s+/);
                if (nameParts.length > 1) {
                    lastName = nameParts.pop() || '';
                    firstName = nameParts.join(' ') || '';
                } else {
                    firstName = nameParts[0] || '';
                }
            }
            
            // Apply nickname based on nicknameMode
            let effectiveFirstName = firstName;
            let effectiveLastName = lastName;
            if (rider.nickname) {
                if (rider.nicknameMode === 'firstName') {
                    effectiveFirstName = rider.nickname;
                } else {
                    effectiveFirstName = rider.nickname;
                    effectiveLastName = '';
                }
            }

            let displayName;
            if (sortBy === 'lastName' && effectiveLastName) {
                displayName = effectiveLastName + (effectiveFirstName ? ', ' + effectiveFirstName : '');
            } else {
                displayName = (effectiveFirstName + ' ' + effectiveLastName).trim() || rider.name || 'Rider';
            }
            const safeName = escapeHtml(displayName);
            const fullName = (effectiveFirstName + ' ' + effectiveLastName).trim() || rider.name || 'Rider';
            const safeFullName = escapeHtml(fullName);
            let shortName;
            if (sortBy === 'lastName' && effectiveLastName && effectiveFirstName) {
                shortName = effectiveLastName + ', ' + effectiveFirstName.charAt(0).toUpperCase() + '.';
            } else {
                shortName = formatShortName(fullName);
            }
            const safeShortName = escapeHtml(shortName);
            const name = rider.name || 'Rider';
            const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
            
            // Apply unavailable styling if in group and unavailable
            const unavailableStyle = (inGroup && showUnavailableStyle) 
                ? 'color: #999; font-style: italic; text-decoration: line-through; opacity: 0.75;' 
                : '';
            const unavailableClass = (inGroup && showUnavailableStyle) ? 'rider-unavailable' : '';
            const unavailableStyleAttr = unavailableStyle ? `style="${unavailableStyle}"` : '';
            
            // Determine photo - use uploaded photo or default based on gender (unless noPhoto is true)
            let photoSrc = null;
            let photo = '';
            if (!noPhoto) {
                photoSrc = rider.photo;
                if (!photoSrc || (!photoSrc.startsWith('data:') && !photoSrc.startsWith('http') && !photoSrc.startsWith('assets/'))) {
                    const gender = (rider.gender || '').toUpperCase();
                    if (gender === 'M') photoSrc = 'assets/male_default.png';
                    else if (gender === 'F') photoSrc = 'assets/female_default.png';
                    else photoSrc = 'assets/nonbinary_default.png';
                }
                photo = photoSrc ? escapeHtml(photoSrc) : '';
            }
            const fitnessScale = getFitnessScale();
            const fitness = String(Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10))));
            const genderValue = (rider.gender || '').toUpperCase();
            const gradeLabel = escapeHtml(formatGradeLabel(rider.grade));
            const classes = ['rider-card'];
            if (showAttendance) classes.push('attendance-card');
            if (!isAvailable) classes.push('attendance-off');
            if (compact) classes.push('compact');
            if (isUnassigned) classes.push('unassigned-card');
            const dragAttributes = (draggable && isAvailable)
                ? `draggable="true"
                     data-drag-type="rider"
                     data-rider-id="${rider.id}"
                     ondragstart="drag(event)"
                     ondragend="dragEnd(event)"`
                : '';
            const checkboxId = showAttendance ? `attendance-rider-${rider.id}` : '';
            const checkboxHtml = showAttendance
                ? `<label class="attendance-checkbox" for="${checkboxId}">
                        <input type="checkbox" id="${checkboxId}" name="attendance-rider-${rider.id}" ${isAvailable ? 'checked' : ''} data-rider-id="${rider.id}" data-attendance-type="rider" class="attendance-checkbox-input" title="${isAvailable ? 'Click to mark absent' : 'Click to mark attending'}">
                   </label>`
                : '';
            const assignmentNote = showAttendance && assignmentLabel
                ? `<span class="attendance-note">${assignmentLabel}</span>`
                : '';
            const nameHtml = showAttendance
                ? `<strong class="attendance-name truncate-name" data-attendance-toggle="true" title="${safeFullName}" data-full-name="${safeName}" data-short-name="${safeShortName}">${safeName}</strong>`
                : `<strong class="truncate-name" title="${safeFullName}" data-full-name="${safeName}" data-short-name="${safeShortName}">${safeName}</strong>`;
            const moveControlsHtml = showMoveControls && groupId !== null
                ? `<div class="rider-move-controls">
                    <button class="rider-move-btn" onclick="moveRiderBetweenGroups(${groupId}, ${rider.id}, -1)" ${!canMoveUp ? 'disabled' : ''} title="Move to previous group (higher fitness)">▲</button>
                    <button class="rider-move-btn" onclick="moveRiderBetweenGroups(${groupId}, ${rider.id}, 1)" ${!canMoveDown ? 'disabled' : ''} title="Move to next group (lower fitness)">▼</button>
                   </div>`
                : '';
            
            // Show badges based on visibleSkills (global toolbar checkboxes)
            // Falls back to sortBy-based badge if no visibleSkills array provided
            const skillsToShow = visibleSkills || [sortBy];
            let badgeHtml = '';
            const visibleBadgeCount = skillsToShow.filter(s => ['pace','climbing','skills','grade','gender'].includes(s)).length;
            const badgeSizeClass = (sidebarCard && visibleBadgeCount >= 2) ? ' badge-sidebar' : '';
            if (scheduledAbsent && absenceReasonText) {
                badgeHtml = `<span class="badge badge-absence" style="background: #9e9e9e; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: auto; white-space: nowrap;">${escapeHtml(absenceReasonText)}</span>`;
            } else if (!hideBadges) {
                const badges = [];
                if (skillsToShow.includes('pace')) {
                    badges.push(`<span class="badge badge-pace-${fitness}${badgeSizeClass}" onclick="handleBadgeClick(event, 'rider', ${rider.id}, 'pace', ${fitness})" style="cursor: pointer;" data-rider-id="${rider.id}" data-badge-type="pace">❤${fitness}</span>`);
                }
                if (skillsToShow.includes('climbing')) {
                    const climbingScale = getClimbingScale();
                    const climbing = Math.max(1, Math.min(climbingScale, parseInt(rider.climbing || '3', 10)));
                    const climbingTooltip = getClimbingTooltip(climbing, climbingScale);
                    badges.push(`<span class="badge badge-climbing-${climbing}${badgeSizeClass}" onclick="handleBadgeClick(event, 'rider', ${rider.id}, 'climbing', ${climbing})" style="cursor: pointer;" title="${climbingTooltip.replace(/\n/g, '&#10;')}" data-rider-id="${rider.id}" data-badge-type="climbing">◢${climbing}</span>`);
                }
                if (skillsToShow.includes('skills')) {
                    const skillsScale = getSkillsScale();
                    const skills = Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10)));
                    const skillsTooltip = getBikeSkillsTooltip(skills, skillsScale);
                    badges.push(`<span class="badge badge-skills-${skills}${badgeSizeClass}" onclick="handleBadgeClick(event, 'rider', ${rider.id}, 'skills', ${skills})" style="cursor: pointer;" title="${skillsTooltip.replace(/\n/g, '&#10;')}" data-rider-id="${rider.id}" data-badge-type="skills">${skills}◣</span>`);
                }
                if (skillsToShow.includes('grade') && gradeLabel && riderFieldMapping.grade !== false) {
                    badges.push(`<span class="badge badge-grade${badgeSizeClass}">${gradeLabel}</span>`);
                }
                if (skillsToShow.includes('gender') && genderValue && riderFieldMapping.gender !== false) {
                    badges.push(`<span class="badge badge-gender${badgeSizeClass}">${escapeHtml(genderValue)}</span>`);
                }
                if (badges.length > 0) {
                    badgeHtml = badges.length > 1 
                        ? `<span class="badge-row-inline">${badges.join('')}</span>` 
                        : badges[0];
                }
            }
            
            // Make unavailable riders in groups clickable to toggle availability (but not the checkbox area)
            const clickHandler = (inGroup && showUnavailableStyle) 
                ? `onclick="if(event.target.type !== 'checkbox' && !event.target.closest('.attendance-checkbox') && !event.target.closest('.attendance-name')) { toggleRiderAvailability(${rider.id}); event.stopPropagation(); }" style="cursor: pointer;"` 
                : '';
            
            // Apply unavailable styling to the entire card when in group and unavailable
            // The CSS class .rider-unavailable will handle the styling via CSS rules
            const baseStyle = "border: none !important; border-style: none !important;";
            
            // Hamburger menu for riders in groups
            const cardMenuHtml = (inGroup && groupId !== null)
                ? `<button class="card-menu-btn" onclick="showCardMenu(event, 'rider', ${rider.id}, ${groupId})" title="Options">⋯</button>`
                : '';

            // Hide assignment note for scheduled-absent riders
            const showAssignment = !scheduledAbsent;

            return `
                <div class="${classes.join(' ')} ${unavailableClass}" ${dragAttributes} ${clickHandler} style="${baseStyle}">
                    ${!noPhoto ? `<div class="avatar-circle">
                        ${photo ? `<img class="avatar-image" src="${photo}" alt="${safeName} photo">` : `<span class="avatar-placeholder">${initial}</span>`}
                    </div>` : ''}
                    ${checkboxHtml}
                    <div class="card-body">
                        ${nameHtml}
                        ${badgeHtml ? `<span class="badge-single">${badgeHtml}</span>` : ''}
                        ${showAssignment ? assignmentNote : ''}
                    </div>
                    ${moveControlsHtml}
                    ${!(scheduledAbsent && inGroup) ? cardMenuHtml : ''}
                </div>
            `;
        }

        function renderCoachCardHtml(coach, sourceGroupId, sourceRole, options = {}) {
            const {
                draggable = true,
                showAttendance = false,
                isAvailable = true,
                assignmentLabel = '',
                compact = false,
                checkboxHandler = null,
                sortBy = 'pace',
                noPhoto = false,
                isUnassigned = false,
                visibleSkills = null,
                scheduledAbsent = false,
                absenceReasonText = '',
                sidebarCard = false,
                inGroupCoach = false,
                levelBadgeHtml = ''
            } = options;

            const coachFieldMapping = data.seasonSettings?.csvFieldMappings?.coaches?.enabledFields || {};

            // Support both old 'level' and new 'coachingLicenseLevel' fields
            const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
            const level = escapeHtml(levelRaw);
            const levelNum = levelRaw === 'N/A' ? 0 : parseInt(levelRaw || '1', 10);
            
            // Get fitness value clamped to current fitness scale (same as roster view)
            const fitnessScale = getFitnessScale();
            const fitnessValue = Math.max(1, Math.min(fitnessScale, parseInt(coach.fitness || Math.ceil(fitnessScale / 2), 10)));
            const fitness = escapeHtml(String(fitnessValue));
            
            // Extract firstName and lastName for formatting
            let firstName = coach.firstName || '';
            let lastName = coach.lastName || '';
            if (!firstName && !lastName && coach.name) {
                const nameParts = coach.name.trim().split(/\s+/);
                if (nameParts.length > 1) {
                    lastName = nameParts.pop() || '';
                    firstName = nameParts.join(' ') || '';
                } else {
                    firstName = nameParts[0] || '';
                }
            }
            
            // Apply nickname based on nicknameMode
            let effectiveFirstName = firstName;
            let effectiveLastName = lastName;
            if (coach.nickname) {
                if (coach.nicknameMode === 'firstName') {
                    effectiveFirstName = coach.nickname;
                } else {
                    effectiveFirstName = coach.nickname;
                    effectiveLastName = '';
                }
            }

            let displayName;
            if (sortBy === 'lastName' && effectiveLastName) {
                displayName = effectiveLastName + (effectiveFirstName ? ', ' + effectiveFirstName : '');
            } else {
                displayName = (effectiveFirstName + ' ' + effectiveLastName).trim() || coach.name || 'Coach';
            }
            const safeName = escapeHtml(displayName);
            const fullName = (effectiveFirstName + ' ' + effectiveLastName).trim() || coach.name || 'Coach';
            const safeFullName = escapeHtml(fullName);
            let shortName;
            if (sortBy === 'lastName' && effectiveLastName && effectiveFirstName) {
                shortName = effectiveLastName + ', ' + effectiveFirstName.charAt(0).toUpperCase() + '.';
            } else {
                shortName = formatShortName(fullName);
            }
            const safeShortName = escapeHtml(shortName);
            const name = coach.name || 'Coach';
            const initial = escapeHtml((name.trim().charAt(0) || '?').toUpperCase());
            // Determine photo - use uploaded photo or default based on gender (same as riders)
            let photoSrc = coach.photo;
            if (!photoSrc || (!photoSrc.startsWith('data:') && !photoSrc.startsWith('http') && !photoSrc.startsWith('assets/'))) {
                const gender = (coach.gender || '').toUpperCase();
                if (gender === 'M') photoSrc = 'assets/male_default.png';
                else if (gender === 'F') photoSrc = 'assets/female_default.png';
                else photoSrc = 'assets/nonbinary_default.png';
            }
            const photo = photoSrc ? escapeHtml(photoSrc) : '';
            const groupAttr = sourceGroupId != null ? `data-source-group-id="${sourceGroupId}"` : '';
            const roleAttr = sourceRole ? `data-source-role="${sourceRole}"` : '';
            const classes = ['coach-card'];
            if (showAttendance) classes.push('attendance-card');
            if (!isAvailable) classes.push('attendance-off');
            if (compact) classes.push('compact');
            if (isUnassigned) classes.push('unassigned-card');
            // Add level-based class for styling
            if (levelRaw === 'N/A' || levelNum === 0) {
                classes.push('coach-level-na');
            } else if (levelNum === 1) classes.push('coach-level-1');
            else if (levelNum === 2) classes.push('coach-level-2');
            else if (levelNum === 3) classes.push('coach-level-3');
            const dragAttributes = (draggable && isAvailable)
                ? `draggable="true"
                     data-drag-type="coach"
                     data-coach-id="${coach.id}"
                     ${groupAttr}
                     ${roleAttr}
                     ondragstart="drag(event)"
                     ondragend="dragEnd(event)"`
                : `${groupAttr} ${roleAttr}`;
            const checkboxId = showAttendance ? `attendance-coach-${coach.id}` : '';
            const checkboxHtml = showAttendance
                ? `<label class="attendance-checkbox" for="${checkboxId}">
                        <input type="checkbox" id="${checkboxId}" name="attendance-coach-${coach.id}" ${isAvailable ? 'checked' : ''} data-coach-id="${coach.id}" data-attendance-type="coach" class="attendance-checkbox-input" title="${isAvailable ? 'Click to mark absent' : 'Click to mark attending'}">
                   </label>`
                : '';
            const assignmentNote = showAttendance && assignmentLabel
                ? `<span class="attendance-note">${assignmentLabel}</span>`
                : '';
            const showAssignment = !scheduledAbsent;
            const nameStyle = inGroupCoach ? ' style="color: #fff;"' : '';
            const nameHtml = showAttendance
                ? `<strong class="attendance-name truncate-name" data-attendance-toggle="true"${nameStyle} title="${safeFullName}" data-full-name="${safeName}" data-short-name="${safeShortName}">${safeName}</strong>`
                : `<strong class="truncate-name"${nameStyle} title="${safeFullName}" data-full-name="${safeName}" data-short-name="${safeShortName}">${safeName}</strong>`;

            // Show badges based on visibleSkills (global toolbar) or sortBy fallback
            const skillsToShow = visibleSkills || [sortBy];
            let badgeHtml = '';
            const coachVisibleBadgeCount = skillsToShow.filter(s => ['pace','climbing','skills','level'].includes(s)).length;
            const coachBadgeSizeClass = (sidebarCard && coachVisibleBadgeCount >= 2) ? ' badge-sidebar' : '';
            // If coach is scheduled absent, show absence reason badge instead of skills
            if (scheduledAbsent && absenceReasonText) {
                badgeHtml = `<span class="badge badge-absence" style="background: #9e9e9e; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: auto; white-space: nowrap;">${escapeHtml(absenceReasonText)}</span>`;
            } else if (compact) {
                const badges = [];
                if (skillsToShow.includes('pace')) {
                    badges.push(`<span class="badge badge-pace-${fitnessValue}${coachBadgeSizeClass}" onclick="handleBadgeClick(event, 'coach', ${coach.id}, 'pace', ${fitnessValue})" style="cursor: pointer;" data-coach-id="${coach.id}" data-badge-type="pace">❤${fitness}</span>`);
                }
                if (skillsToShow.includes('climbing')) {
                    const climbingScale = getClimbingScale();
                    const climbingVal = Math.max(1, Math.min(climbingScale, parseInt(coach.climbing || '3', 10)));
                    const climbingTooltip = getClimbingTooltip(climbingVal, climbingScale);
                    badges.push(`<span class="badge badge-climbing-${climbingVal}${coachBadgeSizeClass}" onclick="handleBadgeClick(event, 'coach', ${coach.id}, 'climbing', ${climbingVal})" style="cursor: pointer;" title="${climbingTooltip.replace(/\n/g, '&#10;')}" data-coach-id="${coach.id}" data-badge-type="climbing">◢${climbingVal}</span>`);
                }
                if (skillsToShow.includes('skills')) {
                    const skillsScale = getSkillsScale();
                    const coachSkills = Math.max(1, Math.min(skillsScale, parseInt(coach.skills || Math.ceil(skillsScale / 2), 10)));
                    badges.push(`<span class="badge badge-skills-${coachSkills}${coachBadgeSizeClass}" style="cursor: pointer;" data-coach-id="${coach.id}" data-badge-type="skills">${coachSkills}◣</span>`);
                }
                if (skillsToShow.includes('level') && coachFieldMapping.coachingLicenseLevel !== false) {
                    const levelDisplay = levelRaw === 'N/A' ? 'N/A' : `Level ${level}`;
                    badges.push(`<span class="badge badge-level${coachBadgeSizeClass}">${levelDisplay}</span>`);
                }
                if (badges.length > 0) {
                    badgeHtml = badges.length > 1
                        ? `<span class="badge-row-inline">${badges.join('')}</span>`
                        : badges[0];
                }
            } else {
                // Non-compact mode: show both level and pace (pace is clickable)
                const showLevel = coachFieldMapping.coachingLicenseLevel !== false;
                badgeHtml = showLevel
                    ? `<div class="coach-meta">Level ${level} · <span class="badge badge-pace-${fitnessValue}" onclick="handleBadgeClick(event, 'coach', ${coach.id}, 'pace', ${fitnessValue})" style="cursor: pointer; display: inline;" data-coach-id="${coach.id}" data-badge-type="pace">❤${fitness}</span></div>`
                    : `<div class="coach-meta"><span class="badge badge-pace-${fitnessValue}" onclick="handleBadgeClick(event, 'coach', ${coach.id}, 'pace', ${fitnessValue})" style="cursor: pointer; display: inline;" data-coach-id="${coach.id}" data-badge-type="pace">❤${fitness}</span></div>`;
            }

            let levelBackgroundColor = 'transparent';

            const coachMenuHtml = (sourceGroupId !== null && sourceGroupId !== undefined && !inGroupCoach)
                ? `<button class="card-menu-btn" onclick="showCardMenu(event, 'coach', ${coach.id}, ${sourceGroupId})" title="Options">⋯</button>`
                : '';

            return `
                <div class="${classes.join(' ')}" ${dragAttributes} style="background: transparent !important; border: none !important; box-shadow: none !important; width: 100%;">
                    ${!noPhoto ? `<div class="avatar-circle coach">
                        ${photo ? `<img class="avatar-image" src="${photo}" alt="${safeName} photo">` : `<span class="avatar-placeholder">${initial}</span>`}
                    </div>` : ''}
                    ${checkboxHtml}
                    <div class="card-body">
                        ${nameHtml}${levelBadgeHtml}
                        ${badgeHtml ? (compact ? `<span class="badge-single">${badgeHtml}</span>` : badgeHtml) : ''}
                        ${showAssignment ? assignmentNote : ''}
                    </div>
                    ${coachMenuHtml}
                </div>
            `;
        }

        function renderGroupCoachesInline(group, ride) {
            // Build list of coaches in order: Leader, Sweep, Roam, then additional Roam
            const coachesList = [];
            
            // Check if leader is missing - if so, we'll show a drop zone for leader first
            const hasLeader = group.coaches.leader && getCoachById(group.coaches.leader);
            
            // Get all coaches with their roles (skip leader if missing - we'll add a drop zone for it)
            if (hasLeader) {
                const coach = getCoachById(group.coaches.leader);
                if (coach) coachesList.push({ coach, role: 'leader', roleLabel: 'Leader' });
            }
            if (group.coaches.sweep) {
                const coach = getCoachById(group.coaches.sweep);
                if (coach) coachesList.push({ coach, role: 'sweep', roleLabel: 'Sweep' });
            }
            if (group.coaches.roam) {
                const coach = getCoachById(group.coaches.roam);
                if (coach) coachesList.push({ coach, role: 'roam', roleLabel: 'Roam' });
            }
            // Add all extraRoam coaches as "Roam"
            if (Array.isArray(group.coaches.extraRoam)) {
                group.coaches.extraRoam.forEach(coachId => {
                    if (coachId) {
                        const coach = getCoachById(coachId);
                        if (coach) coachesList.push({ coach, role: 'extraRoam', roleLabel: 'Roam' });
                    }
                });
            }
            
            // Render coaches as draggable items
            let html = '';
            
            // If leader is missing, show a drop zone for leader first
            if (!hasLeader) {
                html += `
                    <div class="coach-drop-zone leader-drop-zone" 
                         data-drop-type="coach"
                         data-group-id="${group.id}"
                         data-role="leader"
                         ondrop="drop(event)"
                         ondragover="allowDrop(event)"
                         ondragleave="dragLeave(event)"
                         style="display: flex; align-items: center; justify-content: center; margin-bottom: 2px; padding: 8px; border-radius: 4px; background: #ffebee; border: 2px dashed #d32f2f; min-height: 40px; transition: all 0.2s;">
                        <span style="color: #d32f2f; font-weight: 500; font-size: 13px;">⚠️ Drop Leader here (Level ${getAutoAssignSetting('minLeaderLevel', 2)}+)</span>
                    </div>
                `;
            }
            
            coachesList.forEach(({ coach, role, roleLabel }, index) => {
                const isAvailable = ride.availableCoaches.includes(coach.id);
                const assignmentLabel = isAvailable ? '' : 'Unavailable';
                const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                const levelDisplay = levelRaw === 'N/A' ? 'N/A' : `L${parseInt(levelRaw || '1', 10)}`;
                const coachCard = renderCoachCardHtml(coach, group.id, role, {
                    showAttendance: true,
                    isAvailable,
                    assignmentLabel,
                    draggable: true,
                    compact: true,
                    sortBy: ride.globalGroupSort || 'pace',
                    inlineRole: roleLabel,
                    noPhoto: true,
                    visibleSkills: ride.visibleSkills || null,
                    inGroupCoach: true,
                    levelBadgeHtml: (() => {
                        const lvl = parseInt(levelRaw || '1', 10);
                        let bg = '#777', fg = '#fff';
                        if (lvl === 2) { bg = '#ccc'; fg = '#333'; }
                        else if (lvl >= 3) { bg = '#f9a825'; fg = '#333'; }
                        return `<span class="badge" style="font-size: 11px; padding: 2px 6px; background: ${bg}; color: ${fg}; margin-left: 4px; font-weight: 600;">${levelDisplay}</span>`;
                    })()
                });
                
                html += `
                    <div class="coach-inline-item" 
                         data-coach-id="${coach.id}"
                         data-role="${role}"
                         data-group-id="${group.id}"
                         data-drop-type="coach"
                         ondrop="drop(event)"
                         ondragover="allowDrop(event)"
                         ondragleave="dragLeave(event)"
                         style="display: flex; align-items: center; padding: 0 4px 2px 4px; border-radius: 4px; background: #535353; width: 100%; height: 30px; flex-shrink: 0;">
                        <div style="flex: 1; min-width: 0; display: flex; align-items: center;">
                            ${coachCard}
                        </div>
                        <span class="coach-role-badge-fixed" style="background: #e3f2fd; color: #535353; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-right: 2px; white-space: nowrap;">${roleLabel}</span>
                        <button class="card-menu-btn coach-group-menu" onclick="showCardMenu(event, 'coach', ${coach.id}, ${group.id})" title="Options">⋯</button>
                    </div>
                `;
            });
            
            // Add dropzone at the end (matching coach record dimensions)
            html += `
                <div class="coach-drop-zone" 
                     data-drop-type="coach"
                     data-group-id="${group.id}"
                     ondrop="drop(event)"
                     ondragover="allowDrop(event)"
                     ondragleave="dragLeave(event)"
                     style="display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 6px; background: #fff; border: 2px dashed #cfd8dc; min-height: 28px; flex: 1; transition: all 0.2s;">
                    <span style="color: #bbb; font-style: italic; font-size: 12px;">drop coach here</span>
                </div>
            `;
            
            return html;
        }
        
        function renderCoachSlotHtml(group, roleKey, label, ride) {
            let coachId = null;
            if (roleKey === 'extraRoam') {
                coachId = Array.isArray(group.coaches.extraRoam) ? group.coaches.extraRoam[0] : null;
            } else {
                coachId = group.coaches[roleKey];
            }

            const coach = coachId ? getCoachById(coachId) : null;
            const isAvailable = coach ? ride.availableCoaches.includes(coach.id) : false;
            const assignmentLabel = coach
                ? (isAvailable ? '' : 'Unavailable')
                : '';
            const content = coach
                ? renderCoachCardHtml(coach, group.id, roleKey, {
                    showAttendance: true,
                    isAvailable,
                    assignmentLabel,
                    draggable: true,
                    compact: true,
                    sortBy: 'pace', // Coaches in groups always show pace (no sorting for coach slots)
                    noPhoto: true
                })
                : '<div class="coach-slot-empty">Drop coach here</div>';

            return `
                <div class="coach-role-slot ${coach ? '' : 'empty'}"
                     data-drop-type="coach"
                     data-group-id="${group.id}"
                     data-role="${roleKey}"
                     ondrop="drop(event)"
                     ondragover="allowDrop(event)"
                     ondragleave="dragLeave(event)"
                     style="border: none; border-style: none;">
                    <div class="coach-role-label">${label}</div>
                    ${content}
                </div>
            `;
        }

        function rebalanceGroupCoaches(ride, availableCoaches, debugLines) {
            let sortedCoaches = availableCoaches
                .slice()
                .sort((a, b) => {
                    const fitnessDiff = getCoachFitnessValue(b) - getCoachFitnessValue(a);
                    if (fitnessDiff !== 0) return fitnessDiff;
                    const levelDiff = (parseInt(b.level, 10) || 0) - (parseInt(a.level, 10) || 0);
                    if (levelDiff !== 0) return levelDiff;
                    return (b.name || '').localeCompare(a.name || '');
                });

            const groupsOrdered = ride.groups
                .map(group => ({
                    group,
                    fitness: getGroupFitnessScore(group),
                    size: group.riders.length
                }))
                .sort((a, b) => {
                    if (b.fitness !== a.fitness) return b.fitness - a.fitness;
                    return b.size - a.size;
                });

            // Preserve leaders that meet the requirement - don't clear them
            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
            const minLeaderLevelPriority = getParamPriority('minLeaderLevel');
            const useLeaderLevelConstraint = minLeaderLevelPriority < 999;
            const preservedLeaders = new Map(); // group -> leaderId
            
            ride.groups.forEach(group => {
                const currentLeader = getCoachById(group.coaches.leader);
                if (currentLeader) {
                    const leaderLevel = parseInt(currentLeader.level, 10) || 0;
                    if (leaderLevel >= minLeaderLevel) {
                        // Preserve this leader - it meets the requirement
                        preservedLeaders.set(group, currentLeader.id);
                    }
                }
                // Clear sweep, roam, and extraRoam (but preserve leader if it meets requirement)
                group.coaches.sweep = null;
                group.coaches.roam = null;
                if (!Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam = [];
                } else {
                    group.coaches.extraRoam = [];
                }
            });
            
            // Restore preserved leaders
            preservedLeaders.forEach((leaderId, group) => {
                group.coaches.leader = leaderId;
            });
            
            // Remove preserved leaders from available coaches list (they're already assigned)
            const preservedLeaderIds = new Set(Array.from(preservedLeaders.values()));
            sortedCoaches = sortedCoaches.filter(coach => !preservedLeaderIds.has(coach.id));

            const extraAssignments = [];

            const getCoachLevel = coach => {
                const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                if (levelRaw === 'N/A') return 0;
                return parseInt(levelRaw, 10) || 0;
            };
            const popCoach = () => sortedCoaches.length ? sortedCoaches.shift() : null;

            groupsOrdered.forEach(entry => {
                if (sortedCoaches.length === 0) return;

                const picks = [];
                while (picks.length < 3 && sortedCoaches.length > 0) {
                    picks.push(popCoach());
                }

                if (picks.length === 0) return;

                // Only enforce leader level constraint if it's enabled and has priority
                if (useLeaderLevelConstraint && !picks.some(coach => getCoachLevel(coach) >= minLeaderLevel)) {
                    const eligibleIdx = sortedCoaches.findIndex(coach => getCoachLevel(coach) >= minLeaderLevel);
                    if (eligibleIdx >= 0) {
                        picks.push(sortedCoaches.splice(eligibleIdx, 1)[0]);
                    } else {
                        debugLines.push(`⚠️ ${entry.group.label} does not have a Level ${minLeaderLevel}+ coach available; using best available coach as leader.`);
                    }
                }

                if (!entry.group.coaches.leader) {
                    picks.sort((a, b) => getCoachFitnessValue(b) - getCoachFitnessValue(a));

                    let leaderIndex = -1;
                    if (useLeaderLevelConstraint) {
                        leaderIndex = picks.findIndex(coach => getCoachLevel(coach) >= minLeaderLevel);
                    } else {
                        // If constraint not enabled, just use the best coach
                        leaderIndex = 0;
                    }
                    let leaderCoach;
                    if (leaderIndex === -1) {
                        leaderCoach = picks.shift();
                    } else {
                        leaderCoach = picks.splice(leaderIndex, 1)[0];
                    }
                    if (leaderCoach) {
                        entry.group.coaches.leader = leaderCoach.id;
                    }
                }

                if (!entry.group.coaches.sweep) {
                    const sweepCoach = picks.shift();
                    if (sweepCoach) {
                        entry.group.coaches.sweep = sweepCoach.id;
                    }
                }

                if (!entry.group.coaches.roam) {
                    const roamCoach = picks.shift();
                    if (roamCoach) {
                        entry.group.coaches.roam = roamCoach.id;
                    }
                }

                picks.forEach(coach => {
                    if (coach) {
                        sortedCoaches.unshift(coach);
                    }
                });
            });

            // Helper function to count coaches in a group
            const countCoachesInGroup = (group) => {
                let count = 0;
                if (group.coaches.leader) count++;
                if (group.coaches.sweep) count++;
                if (group.coaches.roam) count++;
                if (Array.isArray(group.coaches.extraRoam)) {
                    count += group.coaches.extraRoam.filter(Boolean).length;
                }
                return count;
            };

            // Fair distribution: Only assign 4th coaches after all groups have 3 coaches
            // Only assign 3rd coaches after all groups have at least 2 coaches
            while (sortedCoaches.length > 0) {
                // Check if any group has fewer than 2 coaches
                const groupsWithOneCoach = ride.groups.filter(g => countCoachesInGroup(g) === 1);
                if (groupsWithOneCoach.length > 0) {
                    // Assign to groups with only 1 coach first
                    const targetGroup = groupsWithOneCoach[0];
                    const coach = popCoach();
                    if (coach) {
                        if (!targetGroup.coaches.sweep) {
                            targetGroup.coaches.sweep = coach.id;
                        } else if (!targetGroup.coaches.roam) {
                            targetGroup.coaches.roam = coach.id;
                        }
                    }
                    continue;
                }
                
                // Check if any group has fewer than 3 coaches
                const groupsWithTwoCoaches = ride.groups.filter(g => countCoachesInGroup(g) === 2);
                if (groupsWithTwoCoaches.length > 0) {
                    // Assign to groups with only 2 coaches
                    const targetGroup = groupsWithTwoCoaches[0];
                    const coach = popCoach();
                    if (coach) {
                        if (!targetGroup.coaches.roam) {
                            targetGroup.coaches.roam = coach.id;
                        } else {
                            if (!Array.isArray(targetGroup.coaches.extraRoam)) {
                                targetGroup.coaches.extraRoam = [];
                            }
                            targetGroup.coaches.extraRoam.push(coach.id);
                            extraAssignments.push({ coachId: coach.id, groupId: targetGroup.id });
                        }
                    }
                    continue;
                }
                
                // All groups have at least 3 coaches, now assign 4th coaches
                const groupsWithThreeCoaches = ride.groups.filter(g => countCoachesInGroup(g) === 3);
                if (groupsWithThreeCoaches.length > 0) {
                    const targetGroup = groupsWithThreeCoaches[0];
                    const coach = popCoach();
                    if (coach) {
                        if (!Array.isArray(targetGroup.coaches.extraRoam)) {
                            targetGroup.coaches.extraRoam = [];
                        }
                        targetGroup.coaches.extraRoam.push(coach.id);
                        extraAssignments.push({ coachId: coach.id, groupId: targetGroup.id });
                    }
                    continue;
                }
                
                // All groups have 4+ coaches, break
                break;
            }
            
            const allRolesFilled = ride.groups.every(group =>
                group.coaches.leader && group.coaches.sweep && group.coaches.roam
            );

            return {
                extrasAssigned: extraAssignments.length,
                extraAssignments,
                allGroupsStaffed: allRolesFilled
            };
        }

        function renderEmptyGroupCard() {
            return `
                <div class="coach-group empty-group" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 150px; background: #e3f2fd; border: 2px dashed #90caf9; border-radius: 12px; padding: 30px;">
                    <div class="empty-message" style="margin-bottom: 12px; color: #555;">
                        No groups yet. Add a group to begin assigning riders and coaches.
                    </div>
                    <button type="button" class="btn-small" onclick="addGroup()" style="font-size: 14px; padding: 8px 20px; background: #1976d2; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Add Group</button>
                </div>
            `;
        }

        // Permission check functions (always return true in localStorage mode)
        function canAdjustAssignments() {
            return true; // No authentication in localStorage mode
        }

        function assignCoachToGroup(ride, coachId, groupId, role) {
            if (!canAdjustAssignments()) {
                alert('You do not have permission to adjust assignments');
                return false;
            }

            const group = findGroupById(ride, groupId);
            if (!group) return false;

            // Find what role the dragged coach currently has (if any)
            let draggedCoachCurrentRole = null;
            let draggedCoachCurrentGroupId = null;
            
            ride.groups.forEach(g => {
                if (g.id === groupId) {
                    // Check if coach is already in this group
                    if (g.coaches.leader === coachId) {
                        draggedCoachCurrentRole = 'leader';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (g.coaches.sweep === coachId) {
                        draggedCoachCurrentRole = 'sweep';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (g.coaches.roam === coachId) {
                        draggedCoachCurrentRole = 'roam';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (Array.isArray(g.coaches.extraRoam) && g.coaches.extraRoam.includes(coachId)) {
                        draggedCoachCurrentRole = 'extraRoam';
                        draggedCoachCurrentGroupId = g.id;
                    }
                } else {
                    // Check other groups
                    if (g.coaches.leader === coachId) {
                        draggedCoachCurrentRole = 'leader';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (g.coaches.sweep === coachId) {
                        draggedCoachCurrentRole = 'sweep';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (g.coaches.roam === coachId) {
                        draggedCoachCurrentRole = 'roam';
                        draggedCoachCurrentGroupId = g.id;
                    } else if (Array.isArray(g.coaches.extraRoam) && g.coaches.extraRoam.includes(coachId)) {
                        draggedCoachCurrentRole = 'extraRoam';
                        draggedCoachCurrentGroupId = g.id;
                    }
                }
            });

            // Check if target role is already occupied
            let existingCoachId = null;
            if (role === 'extraRoam') {
                if (Array.isArray(group.coaches.extraRoam) && group.coaches.extraRoam.length > 0) {
                    existingCoachId = group.coaches.extraRoam[0];
                }
            } else {
                existingCoachId = group.coaches[role] || null;
            }

            // If target role is occupied, swap the coaches (works within same group and between groups)
            if (existingCoachId && existingCoachId !== coachId) {
                // Find the source group (where the dragged coach currently is)
                const sourceGroup = draggedCoachCurrentGroupId 
                    ? findGroupById(ride, draggedCoachCurrentGroupId) 
                    : null;
                
                // First, remove both coaches from their current assignments
                removeCoachFromGroups(ride, coachId);
                removeCoachFromGroups(ride, existingCoachId);
                
                // Assign dragged coach to target role in target group
                if (role === 'extraRoam') {
                    if (!Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = [];
                    }
                    group.coaches.extraRoam[0] = coachId;
                    group.coaches.extraRoam = group.coaches.extraRoam.slice(0, 1);
                } else {
                    group.coaches[role] = coachId;
                }
                
                // If dragged coach had a previous role, assign existing coach to that role
                if (draggedCoachCurrentRole && sourceGroup) {
                    if (draggedCoachCurrentRole === 'extraRoam') {
                        if (!Array.isArray(sourceGroup.coaches.extraRoam)) {
                            sourceGroup.coaches.extraRoam = [];
                        }
                        sourceGroup.coaches.extraRoam[0] = existingCoachId;
                        sourceGroup.coaches.extraRoam = sourceGroup.coaches.extraRoam.slice(0, 1);
                    } else {
                        sourceGroup.coaches[draggedCoachCurrentRole] = existingCoachId;
                    }
                }
                // If dragged coach had no previous role, existing coach just becomes unassigned
                // (already handled by removeCoachFromGroups above)
            } else {
                // Target role is empty, just assign normally
                removeCoachFromGroups(ride, coachId);
                
                if (role === 'extraRoam') {
                    if (!Array.isArray(group.coaches.extraRoam)) {
                        group.coaches.extraRoam = [];
                    }
                    group.coaches.extraRoam[0] = coachId;
                    group.coaches.extraRoam = group.coaches.extraRoam.slice(0, 1);
                } else {
                    group.coaches[role] = coachId;
                }
            }
            
            // Save ride immediately after assignment change
            saveRideToDB(ride);
            return true;
        }

        function getCoachById(id) {
            return data.coaches.find(coach => coach.id === id) || null;
        }

        function getRiderById(id) {
            if (id == null) return null;
            // Normalize ID for comparison (handle both string and number IDs)
            const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id;
            if (!Number.isFinite(normalizedId)) return null;
            
            return data.riders.find(rider => {
                // Normalize rider ID for comparison
                const riderId = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                return riderId === normalizedId;
            }) || null;
        }

        function getCoachFitnessValue(coach) {
            const raw = parseInt(coach?.fitness ?? coach?.level ?? '5', 10);
            if (!Number.isFinite(raw)) return 5;
            return getRelativePaceValue(raw);
        }

        function getGroupFitnessScore(group) {
            if (group.fitnessTag != null) {
                const value = parseInt(group.fitnessTag, 10);
                if (Number.isFinite(value)) return getRelativePaceValue(value);
            }

            const riderFitnessValues = group.riders
                .map(id => getRiderById(id))
                .filter(Boolean)
                .map(rider => parseInt(rider.fitness || '5', 10))
                .filter(Number.isFinite)
                .map(value => getRelativePaceValue(value));

            if (riderFitnessValues.length === 0) {
                return 5;
            }

            const sum = riderFitnessValues.reduce((acc, value) => acc + value, 0);
            return Math.round(sum / riderFitnessValues.length);
        }

        function countGroupCoaches(group) {
            const baseCount = ['leader', 'sweep', 'roam'].reduce((count, role) => {
                return count + (group.coaches[role] ? 1 : 0);
            }, 0);
            const extra = Array.isArray(group.coaches.extraRoam) ? group.coaches.extraRoam.filter(Boolean).length : 0;
            return baseCount + extra;
        }

        function optimizeGroupCoachRoles(group) {
            // Optimize coach role assignments after a coach is removed
            // Rules:
            // 1. If sweep is removed and there's a roam coach, promote roam to sweep
            // 2. If leader is removed and there's a sweep or roam coach that's L2/L3, promote them to leader
            // 3. If there are only 2 coaches, they should be leader and sweep (unless neither is L2/L3)
            
            const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
            
            // Get current coaches and their levels (re-fetch after any changes)
            let leader = group.coaches.leader ? getCoachById(group.coaches.leader) : null;
            let sweep = group.coaches.sweep ? getCoachById(group.coaches.sweep) : null;
            let roam = group.coaches.roam ? getCoachById(group.coaches.roam) : null;
            const extraRoam = Array.isArray(group.coaches.extraRoam) 
                ? group.coaches.extraRoam.map(id => getCoachById(id)).filter(Boolean)
                : [];
            
            // Step 1: If sweep is missing and roam exists, promote roam to sweep
            if (!sweep && roam) {
                group.coaches.sweep = group.coaches.roam;
                group.coaches.roam = null;
                // Update local references
                sweep = roam;
                roam = null;
                console.log('🔄 Optimized: Promoted roam coach to sweep');
            }
            
            // Step 2: If leader is missing, try to promote sweep or roam to leader (if L2/L3)
            if (!leader) {
                const sweepLevel = sweep ? parseInt(sweep.coachingLicenseLevel || sweep.level || '1', 10) : 0;
                const roamLevel = roam ? parseInt(roam.coachingLicenseLevel || roam.level || '1', 10) : 0;
                
                if (sweep && Number.isFinite(sweepLevel) && sweepLevel >= minLeaderLevel) {
                    // Promote sweep to leader
                    group.coaches.leader = group.coaches.sweep;
                    group.coaches.sweep = null;
                    // If roam exists, promote it to sweep
                    if (roam) {
                        group.coaches.sweep = group.coaches.roam;
                        group.coaches.roam = null;
                        sweep = roam;
                        roam = null;
                    } else {
                        sweep = null;
                    }
                    leader = getCoachById(group.coaches.leader);
                    console.log('🔄 Optimized: Promoted sweep to leader');
                } else if (roam && Number.isFinite(roamLevel) && roamLevel >= minLeaderLevel) {
                    // Promote roam to leader
                    group.coaches.leader = group.coaches.roam;
                    group.coaches.roam = null;
                    leader = roam;
                    roam = null;
                    console.log('🔄 Optimized: Promoted roam to leader');
                } else if (extraRoam.length > 0) {
                    // Try to promote an extraRoam coach if they're L2/L3
                    const qualifiedExtra = extraRoam.find(c => {
                        const level = parseInt(c.coachingLicenseLevel || c.level || '1', 10);
                        return Number.isFinite(level) && level >= minLeaderLevel;
                    });
                    if (qualifiedExtra) {
                        // Remove from extraRoam and promote to leader
                        group.coaches.leader = qualifiedExtra.id;
                        group.coaches.extraRoam = group.coaches.extraRoam.filter(id => id !== qualifiedExtra.id);
                        leader = qualifiedExtra;
                        console.log('🔄 Optimized: Promoted extraRoam to leader');
                    }
                }
            }
            
            // Step 3: If there are only 2 coaches, ensure they're leader and sweep (unless neither is L2/L3)
            // Recalculate count after optimizations
            const coachCount = countGroupCoaches(group);
            if (coachCount === 2) {
                // Re-fetch current state after optimizations
                const currentLeader = group.coaches.leader ? getCoachById(group.coaches.leader) : null;
                const currentSweep = group.coaches.sweep ? getCoachById(group.coaches.sweep) : null;
                const currentRoam = group.coaches.roam ? getCoachById(group.coaches.roam) : null;
                
                // If we have leader and roam (but no sweep), move roam to sweep
                if (currentLeader && currentRoam && !currentSweep) {
                    group.coaches.sweep = group.coaches.roam;
                    group.coaches.roam = null;
                    console.log('🔄 Optimized: Moved roam to sweep (2-coach group)');
                }
                // If we have sweep and roam (but no leader), check if either is L2/L3
                else if (currentSweep && currentRoam && !currentLeader) {
                    const sweepLvl = parseInt(currentSweep.coachingLicenseLevel || currentSweep.level || '1', 10);
                    const roamLvl = parseInt(currentRoam.coachingLicenseLevel || currentRoam.level || '1', 10);
                    
                    // Promote the one that's L2/L3 to leader, other to sweep
                    if (Number.isFinite(sweepLvl) && sweepLvl >= minLeaderLevel) {
                        group.coaches.leader = group.coaches.sweep;
                        group.coaches.sweep = group.coaches.roam;
                        group.coaches.roam = null;
                        console.log('🔄 Optimized: Promoted sweep to leader, roam to sweep (2-coach group)');
                    } else if (Number.isFinite(roamLvl) && roamLvl >= minLeaderLevel) {
                        group.coaches.leader = group.coaches.roam;
                        group.coaches.sweep = group.coaches.sweep; // Keep existing sweep
                        group.coaches.roam = null;
                        console.log('🔄 Optimized: Promoted roam to leader (2-coach group)');
                    }
                }
            }
        }

        function groupCapacity(group) {
            const ridersPerCoach = getAutoAssignSetting('ridersPerCoach', 6);
            return countGroupCoaches(group) * ridersPerCoach;
        }

        function findGroupById(ride, groupId) {
            return ride.groups.find(group => group.id === groupId) || null;
        }

        function removeRiderFromGroups(ride, riderId) {
            ride.groups.forEach(group => {
                group.riders = group.riders.filter(id => id !== riderId);
                if (group.riders.length === 0) {
                    group.fitnessTag = null;
                }
            });
        }

        function removeCoachFromGroups(ride, coachId) {
            ride.groups.forEach(group => {
                ['leader', 'sweep', 'roam'].forEach(role => {
                    if (group.coaches[role] === coachId) {
                        group.coaches[role] = null;
                    }
                });
                if (Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam = group.coaches.extraRoam.filter(id => id !== coachId);
                }
                // Note: Riders are NOT automatically unassigned - group will be marked non-compliant instead
            });
        }

        // Context menu for group badge in sidebar
        function showGroupBadgeMenu(event, type, id) {
            event.stopPropagation();
            event.preventDefault();

            // Remove any existing menu
            const existing = document.querySelector('.group-badge-menu');
            if (existing) existing.remove();

            // Get current ride
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride || !ride.groups) return;

            // Find which group this person is in
            let currentGroupId = null;
            if (type === 'rider') {
                for (const group of ride.groups) {
                    if (group.riders && group.riders.includes(id)) {
                        currentGroupId = group.id;
                        break;
                    }
                }
            } else {
                for (const group of ride.groups) {
                    if (group.coaches.leader === id || group.coaches.sweep === id || group.coaches.roam === id ||
                        (Array.isArray(group.coaches.extraRoam) && group.coaches.extraRoam.includes(id))) {
                        currentGroupId = group.id;
                        break;
                    }
                }
            }

            if (currentGroupId === null) return;

            // Build menu
            const menu = document.createElement('div');
            menu.className = 'group-badge-menu';

            // "Move to Group X" for each other group
            ride.groups.forEach(group => {
                if (group.id === currentGroupId) return;
                const item = document.createElement('div');
                item.className = 'group-badge-menu-item';
                item.textContent = `Move to ${group.label}`;
                item.onclick = () => {
                    menu.remove();
                    if (type === 'rider') {
                        removeRiderFromGroups(ride, id);
                        if (!group.riders.includes(id)) {
                            group.riders.push(id);
                        }
                    } else {
                        removeCoachFromGroups(ride, id);
                        // Assign to first available role
                        if (!group.coaches.leader) {
                            group.coaches.leader = id;
                        } else if (!group.coaches.sweep) {
                            group.coaches.sweep = id;
                        } else if (!group.coaches.roam) {
                            group.coaches.roam = id;
                        } else {
                            if (!Array.isArray(group.coaches.extraRoam)) group.coaches.extraRoam = [];
                            group.coaches.extraRoam.push(id);
                        }
                    }
                    saveRideToDB(ride);
                    renderAssignments(ride);
                };
                menu.appendChild(item);
            });

            // Divider
            const divider = document.createElement('div');
            divider.className = 'group-badge-menu-divider';
            menu.appendChild(divider);

            // Unassign option
            const unassignItem = document.createElement('div');
            unassignItem.className = 'group-badge-menu-item danger';
            unassignItem.textContent = 'Unassign';
            unassignItem.onclick = () => {
                menu.remove();
                if (type === 'rider') {
                    removeRiderFromGroups(ride, id);
                } else {
                    removeCoachFromGroups(ride, id);
                }
                saveRideToDB(ride);
                renderAssignments(ride);
            };
            menu.appendChild(unassignItem);

            // Position the menu near the click
            document.body.appendChild(menu);
            const rect = event.target.getBoundingClientRect();
            menu.style.left = `${rect.left}px`;
            menu.style.top = `${rect.bottom + 4}px`;
            ensureMenuInViewport(menu, rect, 4);

            if (typeof startContextMenuAutoClose === 'function') {
                startContextMenuAutoClose(menu, () => menu.remove());
            }

            // Dismiss on click outside
            setTimeout(() => {
                document.addEventListener('click', function dismissMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', dismissMenu);
                    }
                });
            }, 0);
        }

        // Hamburger menu on rider/coach cards within groups
        function showCardMenu(event, type, id, currentGroupId) {
            event.stopPropagation();
            event.preventDefault();

            // Remove any existing menus
            const existing = document.querySelector('.group-badge-menu');
            if (existing) existing.remove();

            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride || !ride.groups) return;

            const menu = document.createElement('div');
            menu.className = 'group-badge-menu';

            // "Move to Group X" for each other group
            ride.groups.forEach(group => {
                if (group.id === currentGroupId) return;
                const item = document.createElement('div');
                item.className = 'group-badge-menu-item';
                item.textContent = `Move to ${group.label}`;
                item.onclick = () => {
                    menu.remove();
                    if (type === 'rider') {
                        removeRiderFromGroups(ride, id);
                        if (!group.riders.includes(id)) {
                            group.riders.push(id);
                        }
                    } else {
                        removeCoachFromGroups(ride, id);
                        if (!group.coaches.leader) {
                            group.coaches.leader = id;
                        } else if (!group.coaches.sweep) {
                            group.coaches.sweep = id;
                        } else if (!group.coaches.roam) {
                            group.coaches.roam = id;
                        } else {
                            if (!Array.isArray(group.coaches.extraRoam)) group.coaches.extraRoam = [];
                            group.coaches.extraRoam.push(id);
                        }
                    }
                    saveRideToDB(ride);
                    renderAssignments(ride);
                };
                menu.appendChild(item);
            });

            // For coaches: add "Assign as [role]" swap options
            if (type === 'coach') {
                const currentGroup = findGroupById(ride, currentGroupId);
                if (currentGroup) {
                    // Find current role of this coach
                    let myRole = null;
                    if (currentGroup.coaches.leader === id) myRole = 'leader';
                    else if (currentGroup.coaches.sweep === id) myRole = 'sweep';
                    else if (currentGroup.coaches.roam === id) myRole = 'roam';
                    else if (Array.isArray(currentGroup.coaches.extraRoam) && currentGroup.coaches.extraRoam.includes(id)) myRole = 'extraRoam';

                    // Show swap options for roles occupied by other coaches
                    const roleOptions = [
                        { key: 'leader', label: 'Leader' },
                        { key: 'sweep', label: 'Sweep' },
                        { key: 'roam', label: 'Roam' }
                    ];
                    const swapItems = [];
                    roleOptions.forEach(({ key, label }) => {
                        if (key === myRole) return; // skip own role
                        const otherCoachId = currentGroup.coaches[key];
                        if (!otherCoachId) return; // skip empty slots
                        const otherCoach = getCoachById(otherCoachId);
                        const otherName = otherCoach ? otherCoach.name.split(' ')[0] : '';
                        swapItems.push({ key, label, otherCoachId, otherName });
                    });

                    if (swapItems.length > 0) {
                        const swapDivider = document.createElement('div');
                        swapDivider.className = 'group-badge-menu-divider';
                        menu.appendChild(swapDivider);

                        swapItems.forEach(({ key, label, otherCoachId }) => {
                            const item = document.createElement('div');
                            item.className = 'group-badge-menu-item';
                            item.textContent = `Assign as ${label}`;
                            item.onclick = () => {
                                menu.remove();
                                // Swap: put current coach in the target role, put target coach in current role
                                if (myRole && myRole !== 'extraRoam') {
                                    currentGroup.coaches[myRole] = otherCoachId;
                                } else if (myRole === 'extraRoam') {
                                    // Remove from extraRoam and put the other coach there
                                    currentGroup.coaches.extraRoam = (currentGroup.coaches.extraRoam || []).filter(cid => cid !== id);
                                    currentGroup.coaches.extraRoam.push(otherCoachId);
                                }
                                currentGroup.coaches[key] = id;
                                saveRideToDB(ride);
                                renderAssignments(ride);
                            };
                            menu.appendChild(item);
                        });
                    }
                }
            }

            // Divider
            const divider = document.createElement('div');
            divider.className = 'group-badge-menu-divider';
            menu.appendChild(divider);

            // Unassign
            const unassignItem = document.createElement('div');
            unassignItem.className = 'group-badge-menu-item danger';
            unassignItem.textContent = 'Unassign';
            unassignItem.onclick = () => {
                menu.remove();
                if (type === 'rider') {
                    removeRiderFromGroups(ride, id);
                } else {
                    removeCoachFromGroups(ride, id);
                }
                saveRideToDB(ride);
                renderAssignments(ride);
            };
            menu.appendChild(unassignItem);

            // Position near the button
            document.body.appendChild(menu);
            const rect = event.target.getBoundingClientRect();
            menu.style.left = `${rect.right - 160}px`;
            menu.style.top = `${rect.bottom + 4}px`;
            ensureMenuInViewport(menu, rect, 4);

            // Auto-close after 3s unless hovering
            if (typeof startContextMenuAutoClose === 'function') {
                startContextMenuAutoClose(menu, () => menu.remove());
            }

            // Dismiss on click outside
            setTimeout(() => {
                document.addEventListener('click', function dismissMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', dismissMenu);
                    }
                });
            }, 0);
        }

        // Context menu for unassigned badge (?) in sidebar — allows assigning to a group
        function showUnassignedBadgeMenu(event, type, id) {
            event.stopPropagation();
            event.preventDefault();

            // Remove any existing menu
            const existing = document.querySelector('.group-badge-menu');
            if (existing) existing.remove();

            // Get current ride
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride || !ride.groups || ride.groups.length === 0) {
                alert('No groups available. Add a group first.');
                return;
            }

            // Build menu
            const menu = document.createElement('div');
            menu.className = 'group-badge-menu';

            // Title
            const title = document.createElement('div');
            title.style.cssText = 'padding: 6px 14px; font-weight: 600; font-size: 13px; color: #666; border-bottom: 1px solid #eee;';
            title.textContent = 'Assign to:';
            menu.appendChild(title);

            // "Assign to Group X" for each group
            ride.groups.forEach(group => {
                const item = document.createElement('div');
                item.className = 'group-badge-menu-item';
                item.textContent = group.label;
                item.onclick = () => {
                    menu.remove();
                    if (type === 'rider') {
                        removeRiderFromGroups(ride, id);
                        if (!group.riders.includes(id)) {
                            group.riders.push(id);
                        }
                    } else {
                        removeCoachFromGroups(ride, id);
                        if (!group.coaches.leader) {
                            group.coaches.leader = id;
                        } else if (!group.coaches.sweep) {
                            group.coaches.sweep = id;
                        } else if (!group.coaches.roam) {
                            group.coaches.roam = id;
                        } else {
                            if (!Array.isArray(group.coaches.extraRoam)) group.coaches.extraRoam = [];
                            group.coaches.extraRoam.push(id);
                        }
                    }
                    saveRideToDB(ride);
                    renderAssignments(ride);
                };
                menu.appendChild(item);
            });

            // Position the menu near the click
            document.body.appendChild(menu);
            const rect = event.target.getBoundingClientRect();
            menu.style.left = `${rect.left}px`;
            menu.style.top = `${rect.bottom + 4}px`;
            ensureMenuInViewport(menu, rect, 4);

            // Auto-close after 3s unless hovering
            if (typeof startContextMenuAutoClose === 'function') {
                startContextMenuAutoClose(menu, () => menu.remove());
            }

            // Dismiss on click outside
            setTimeout(() => {
                document.addEventListener('click', function dismissMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', dismissMenu);
                    }
                });
            }, 0);
        }

        function getCoachAssignmentMap(ride) {
            const map = {};
            ride.groups.forEach(group => {
                ['leader', 'sweep', 'roam'].forEach(role => {
                    const coachId = group.coaches[role];
                    if (coachId) {
                        map[coachId] = {
                            groupId: group.id,
                            role
                        };
                    }
                });
                if (Array.isArray(group.coaches.extraRoam)) {
                    group.coaches.extraRoam.forEach((coachId, index) => {
                        if (coachId) {
                            map[coachId] = {
                                groupId: group.id,
                                role: index === 0 ? 'extraRoam' : `extraRoam${index + 1}`
                            };
                        }
                    });
                }
            });
            return map;
        }

        function renumberGroups(ride, sequential = false) {
            if (sequential) {
                // Renumber all groups sequentially (1, 2, 3, 4...) without gaps
                ride.groups.forEach((group, index) => {
                    group.label = `Group ${index + 1}`;
                });
            } else {
                // Only assign labels to groups that don't have them
                // Preserve existing labels to maintain persistence
                const existingLabels = new Set(ride.groups.map(g => g.label).filter(Boolean));
                let nextNumber = 1;
                
                ride.groups.forEach((group) => {
                    if (!group.label || group.label.trim() === '') {
                        // Find next available group number
                        while (existingLabels.has(`Group ${nextNumber}`)) {
                            nextNumber++;
                        }
                        group.label = `Group ${nextNumber}`;
                        existingLabels.add(group.label);
                        nextNumber++;
                    }
                });
            }
        }

        function normalizeRideStructure(ride) {
            const updated = Object.assign({}, ride);
            let changed = false;

            if (!Array.isArray(updated.availableCoaches)) {
                updated.availableCoaches = [];
                changed = true;
            }

            if (!Array.isArray(updated.availableRiders)) {
                updated.availableRiders = [];
                changed = true;
            }

            // Only validate IDs if rosters are loaded - preserve assignments even if rosters aren't loaded yet
            const coachesLoaded = Array.isArray(data.coaches) && data.coaches.length > 0;
            const ridersLoaded = Array.isArray(data.riders) && data.riders.length > 0;
            
            // Normalize IDs when creating Sets for comparison (handle string/number mismatches)
            const validCoachIds = coachesLoaded ? new Set(data.coaches.map(coach => {
                const id = typeof coach.id === 'string' ? parseInt(coach.id, 10) : coach.id;
                return Number.isFinite(id) ? id : coach.id;
            })) : new Set();
            const validRiderIds = ridersLoaded ? new Set(data.riders.map(rider => {
                const id = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                return Number.isFinite(id) ? id : rider.id;
            })) : new Set();

            // If rosters aren't loaded yet, preserve all IDs (they might be valid, just not loaded)
            // Only filter if rosters are loaded
            // Also filter out invalid timestamp IDs (IDs > 1 million are likely timestamps, not valid coach IDs)
            const uniqueCoaches = new Set();
            if (coachesLoaded) {
                updated.availableCoaches = updated.availableCoaches
                    .map(id => parseInt(id, 10))
                    .filter(id => Number.isFinite(id) && validCoachIds.has(id) && !uniqueCoaches.has(id) && uniqueCoaches.add(id));
            } else {
                // Preserve IDs even if rosters aren't loaded - just deduplicate
                updated.availableCoaches = updated.availableCoaches
                    .map(id => parseInt(id, 10))
                    .filter(id => Number.isFinite(id) && !uniqueCoaches.has(id) && uniqueCoaches.add(id));
            }

            const uniqueRiders = new Set();
            if (ridersLoaded) {
                const beforeLength = updated.availableRiders.length;
                updated.availableRiders = updated.availableRiders
                    .map(id => {
                        // Normalize ID to number for consistent comparison
                        const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                        return Number.isFinite(normalized) ? normalized : id;
                    })
                    .filter(id => {
                        // All IDs should be normalized to numbers at this point, but double-check
                        const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                        if (!Number.isFinite(normalized)) {
                            console.warn('🟡 normalizeRideStructure: Invalid rider ID filtered out:', id, '(ride ID:', updated.id, ')');
                            return false;
                        }
                        // Check if normalized ID exists in validRiderIds Set (which also contains normalized IDs)
                        const isValid = validRiderIds.has(normalized);
                        if (!isValid) {
                            console.warn('🟡 normalizeRideStructure: Rider ID not found in roster:', normalized, '(ride ID:', updated.id, ')');
                        }
                        return isValid && !uniqueRiders.has(normalized) && uniqueRiders.add(normalized);
                    });
                const afterLength = updated.availableRiders.length;
                if (beforeLength !== afterLength) {
                    console.log('🟡 normalizeRideStructure: Filtered availableRiders from', beforeLength, 'to', afterLength, 'for ride ID:', updated.id);
                }
            } else {
                // Preserve IDs even if rosters aren't loaded - just deduplicate
                updated.availableRiders = updated.availableRiders
                    .map(id => {
                        const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                        return Number.isFinite(normalized) ? normalized : id;
                    })
                    .filter(id => {
                        const normalized = typeof id === 'string' ? parseInt(id, 10) : id;
                        return Number.isFinite(normalized) && !uniqueRiders.has(normalized) && uniqueRiders.add(normalized);
                    });
            }

            if (!Array.isArray(updated.groups)) {
                updated.groups = [];
                changed = true;
            }

            if (updated.assignments && typeof updated.assignments === 'object') {
                let index = updated.groups.length + 1;
                Object.entries(updated.assignments).forEach(([coachIdStr, riderIds]) => {
                    const coachId = parseInt(coachIdStr, 10);
                    if (!Number.isFinite(coachId)) {
                        return;
                    }

                    const group = createGroup(`Group ${index++}`);
                    const coach = getCoachById(coachId);

                    if (coach) {
                        const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                        const level = levelRaw === 'N/A' ? 0 : parseInt(levelRaw, 10);
                        const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                        if (Number.isFinite(level) && level >= minLeaderLevel) {
                            group.coaches.leader = coachId;
                        } else {
                            group.coaches.sweep = coachId;
                        }

                        if (!updated.availableCoaches.includes(coachId)) {
                            updated.availableCoaches.push(coachId);
                        }
                    }

                    if (Array.isArray(riderIds)) {
                        // Preserve rider IDs even if rosters aren't loaded yet
                        if (ridersLoaded) {
                            group.riders = riderIds
                                .map(id => parseInt(id, 10))
                                .filter(id => Number.isFinite(id) && validRiderIds.has(id));
                        } else {
                            // Preserve all valid numeric IDs - rosters might not be loaded yet
                            group.riders = riderIds
                                .map(id => parseInt(id, 10))
                                .filter(id => Number.isFinite(id));
                        }

                        const shouldAutoIncludeGroupRiders = updated.attendanceInitialized !== true && updated.availableRiders.length === 0;
                        if (shouldAutoIncludeGroupRiders) {
                            group.riders.forEach(riderId => {
                                if (!updated.availableRiders.includes(riderId)) {
                                    updated.availableRiders.push(riderId);
                                }
                            });
                        }
                    }

                    updated.groups.push(group);
                });

                delete updated.assignments;
                changed = true;
            }

            updated.groups = updated.groups.map((group, idx) => {
                // Preserve coach IDs even if rosters aren't loaded yet
                const extraRoam = group.coaches && Array.isArray(group.coaches.extraRoam)
                    ? (coachesLoaded
                        ? group.coaches.extraRoam
                            .map(id => parseInt(id, 10))
                            .filter(id => Number.isFinite(id) && validCoachIds.has(id))
                        : group.coaches.extraRoam
                            .map(id => parseInt(id, 10))
                            .filter(id => Number.isFinite(id)))
                    : [];

                const legacyFitnessTag = group.fitnessTag || group.abilityTag || null;
                const normalized = {
                    id: typeof group.id === 'number' ? group.id : generateId(),
                    label: group.label || `Group ${idx + 1}`,
                    coaches: {
                        leader: group.coaches ? normalizeCoachId(group.coaches.leader) : null,
                        sweep: group.coaches ? normalizeCoachId(group.coaches.sweep) : null,
                        roam: group.coaches ? normalizeCoachId(group.coaches.roam) : null,
                        extraRoam: extraRoam
                    },
                    riders: Array.isArray(group.riders)
                        ? (ridersLoaded
                            ? Array.from(new Set(group.riders.map(id => parseInt(id, 10)).filter(id => Number.isFinite(id) && validRiderIds.has(id))))
                            : Array.from(new Set(group.riders.map(id => parseInt(id, 10)).filter(id => Number.isFinite(id)))))
                        : [],
                    fitnessTag: legacyFitnessTag,
                    routeId: group.routeId !== undefined ? group.routeId : null
                };

                if (!normalized.coaches.leader && normalized.coaches.sweep) {
                    const sweepCoach = getCoachById(normalized.coaches.sweep);
                    const level = sweepCoach ? parseInt(sweepCoach.level, 10) : 0;
                    const minLeaderLevel = getAutoAssignSetting('minLeaderLevel', 2);
                    if (Number.isFinite(level) && level >= minLeaderLevel) {
                        normalized.coaches.leader = normalized.coaches.sweep;
                        normalized.coaches.sweep = null;
                    }
                }

                if (normalized.coaches.leader && !updated.availableCoaches.includes(normalized.coaches.leader)) {
                    updated.availableCoaches.push(normalized.coaches.leader);
                }
                ['sweep', 'roam'].forEach(role => {
                    const coachId = normalized.coaches[role];
                    if (coachId && !updated.availableCoaches.includes(coachId)) {
                        updated.availableCoaches.push(coachId);
                    }
                });
                normalized.coaches.extraRoam.forEach(coachId => {
                    if (coachId && !updated.availableCoaches.includes(coachId)) {
                        updated.availableCoaches.push(coachId);
                    }
                });

                normalized.riders.forEach(riderId => {
                    if (!updated.availableRiders.includes(riderId)) {
                        updated.availableRiders.push(riderId);
                    }
                });

                return normalized;
            });

            updated.groups.forEach((group, index) => {
                group.label = group.label || `Group ${index + 1}`;
                // Ensure routeId exists
                if (group.routeId === undefined) {
                    group.routeId = null;
                    changed = true;
                }
            });

            updated.availableCoaches = Array.from(new Set(updated.availableCoaches));
            updated.availableRiders = Array.from(new Set(updated.availableRiders));

            return { ride: updated, changed };
        }

