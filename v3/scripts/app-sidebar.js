// app-sidebar.js — Sidebar rendering, attendance checkboxes, collapse/expand

        // ===== SIDEBAR FUNCTIONS =====

        function updateSidebarTop() {
            const stickyTop = document.querySelector('.sticky-top');
            const container = document.querySelector('.container');
            const spacer = document.getElementById('sticky-top-spacer');
            let sidebarTop = 0;

            // Detect if a mode banner (developer / read-only) is visible above the header
            const devBanner = document.getElementById('developer-mode-banner');
            const roBanner = document.getElementById('read-only-banner');
            let modeBannerHeight = 0;
            if (devBanner && getComputedStyle(devBanner).display !== 'none') {
                modeBannerHeight = devBanner.offsetHeight;
            } else if (roBanner && getComputedStyle(roBanner).display !== 'none') {
                modeBannerHeight = roBanner.offsetHeight;
            }
            // Push the sticky-top down by the mode banner height + matching gap
            const baseTop = 10; // default gap from top of viewport
            if (stickyTop) {
                stickyTop.style.top = (modeBannerHeight > 0 ? modeBannerHeight + baseTop : baseTop) + 'px';
            }

            // Size the spacer to match the fixed header height + gap
            if (stickyTop && spacer) {
                const headerRect = stickyTop.getBoundingClientRect();
                spacer.style.height = (headerRect.bottom + 5) + 'px';
            }

            if (stickyTop) {
                const rect = stickyTop.getBoundingClientRect();
                document.documentElement.style.setProperty('--sticky-top-height', (rect.bottom + 10) + 'px');
            }

            // Size the practice banner spacer (fixed elements have offsetParent===null, so check height)
            const practiceBanner = document.getElementById('practice-banner');
            const practiceSpacer = document.getElementById('practice-banner-spacer');
            const bannerVisible = practiceBanner && practiceBanner.getBoundingClientRect().height > 0;
            if (bannerVisible && practiceSpacer) {
                practiceSpacer.style.height = practiceBanner.offsetHeight + 'px';
            }

            // Align sidebars: top-aligned with the practice banner, else below header
            if (bannerVisible) {
                const bannerRect = practiceBanner.getBoundingClientRect();
                sidebarTop = bannerRect.top;
            } else if (container && container.offsetParent !== null) {
                sidebarTop = container.getBoundingClientRect().top;
            } else if (stickyTop) {
                sidebarTop = stickyTop.getBoundingClientRect().bottom + 5;
            }
            document.documentElement.style.setProperty('--sidebar-top', sidebarTop + 'px');
        }

        function showSidebars() {
            // Only show sidebars when the Practice Planner tab is active
            const ridesTab = document.getElementById('rides-tab');
            if (!ridesTab || !ridesTab.classList.contains('active')) return;

            const sidebarRiders = document.getElementById('sidebar-riders');
            const sidebarCoaches = document.getElementById('sidebar-coaches');
            const container = document.querySelector('.container');
            if (container) container.classList.add('sidebars-active');
            sidebarsVisible = true;

            // Determine if there are unassigned riders/coaches
            let hasUnassignedRiders = false;
            let hasUnassignedCoaches = false;
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (ride) {
                ensureRideAttendanceDefaults(ride);
                const availableRiderSet = new Set((ride.availableRiders || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id));
                const availableCoachSet = new Set((ride.availableCoaches || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id));
                const riderAssigned = new Set();
                const coachAssignmentMap = getCoachAssignmentMap(ride);
                ride.groups.forEach(g => g.riders.forEach(rid => {
                    const n = typeof rid === 'string' ? parseInt(rid, 10) : rid;
                    riderAssigned.add(Number.isFinite(n) ? n : rid);
                }));
                hasUnassignedRiders = (data.riders || []).some(r => {
                    const rid = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id;
                    const nid = Number.isFinite(rid) ? rid : r.id;
                    return availableRiderSet.has(nid) && !riderAssigned.has(nid);
                });
                hasUnassignedCoaches = (data.coaches || []).some(c => {
                    const cid = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
                    const nid = Number.isFinite(cid) ? cid : c.id;
                    return availableCoachSet.has(nid) && !coachAssignmentMap[nid];
                });
                if (hasUnassignedRiders) sidebarRidersFilter = 'unassigned';
                if (hasUnassignedCoaches) sidebarCoachesFilter = 'unassigned';
            }

            // Show sidebars expanded initially
            sidebarRidersCollapsed = false;
            sidebarCoachesCollapsed = false;

            if (sidebarRiders) sidebarRiders.style.display = 'flex';
            if (sidebarCoaches) sidebarCoaches.style.display = 'flex';

            // Sync sort dropdowns with current state (remembers user's last choice)
            const ridersSortEl = document.getElementById('sidebar-riders-sort');
            const coachesSortEl = document.getElementById('sidebar-coaches-sort');
            if (ridersSortEl) ridersSortEl.value = sidebarRidersSort;
            if (coachesSortEl) coachesSortEl.value = sidebarCoachesSort;

            applySidebarCollapsedState();
            renderSidebars();

            // Calculate top after a frame so the banner has rendered
            requestAnimationFrame(() => updateSidebarTop());

            // In attendance mode, keep sidebars permanently expanded
            if (attendanceMode) return;

            // Auto-collapse after 5 seconds OR on first user interaction,
            // but keep open any sidebar that has unassigned people.
            let autoCollapseTriggered = false;
            const triggerAutoCollapse = () => {
                if (autoCollapseTriggered || !sidebarsVisible) return;
                autoCollapseTriggered = true;
                cleanupInteractionListeners();

                const sr = document.getElementById('sidebar-riders');
                const sc = document.getElementById('sidebar-coaches');
                const ct = document.querySelector('.container');
                const pb = document.getElementById('practice-banner');

                // Apply slow transition
                if (sr) sr.style.transition = 'width 1.5s ease';
                if (sc) sc.style.transition = 'width 1.5s ease';
                if (ct) ct.style.transition = 'margin 1.5s ease';
                if (pb) pb.style.transition = 'left 1.5s ease, right 1.5s ease';

                // Only collapse sidebars that have no unassigned people
                if (!hasUnassignedRiders) sidebarRidersCollapsed = true;
                if (!hasUnassignedCoaches) sidebarCoachesCollapsed = true;
                applySidebarCollapsedState();

                // Revert to normal speed after animation
                setTimeout(() => {
                    if (sr) sr.style.transition = '';
                    if (sc) sc.style.transition = '';
                    if (ct) ct.style.transition = '';
                    if (pb) pb.style.transition = '';
                }, 1600);
            };

            // Listen for user interaction to trigger early collapse
            // (ignore interactions within the sidebars themselves)
            const interactionEvents = ['scroll', 'click', 'mousedown', 'touchstart', 'keydown'];
            const onInteraction = (e) => {
                const sr = document.getElementById('sidebar-riders');
                const sc = document.getElementById('sidebar-coaches');
                if (e.target && (
                    (sr && sr.contains(e.target)) ||
                    (sc && sc.contains(e.target))
                )) {
                    return; // Don't collapse on sidebar interaction
                }
                triggerAutoCollapse();
            };
            interactionEvents.forEach(evt => window.addEventListener(evt, onInteraction, { passive: true }));

            const cleanupInteractionListeners = () => {
                interactionEvents.forEach(evt => window.removeEventListener(evt, onInteraction));
            };

            // Also collapse after 5 seconds if no interaction
            setTimeout(() => triggerAutoCollapse(), 5000);
        }

        function hideSidebars() {
            const sidebarRiders = document.getElementById('sidebar-riders');
            const sidebarCoaches = document.getElementById('sidebar-coaches');
            const container = document.querySelector('.container');
            const practiceBanner = document.getElementById('practice-banner');
            const stickyTop = document.querySelector('.sticky-top');
            if (sidebarRiders) sidebarRiders.style.display = 'none';
            if (sidebarCoaches) sidebarCoaches.style.display = 'none';
            if (container) {
                container.classList.remove('sidebars-active');
                container.style.marginLeft = '';
                container.style.marginRight = '';
            }
            if (practiceBanner) {
                practiceBanner.style.left = '10px';
                practiceBanner.style.right = '10px';
            }
            if (stickyTop) {
                stickyTop.style.left = '';
                stickyTop.style.right = '';
            }
            document.body.style.minWidth = '';
            sidebarsVisible = false;
            attendanceMode = false;
        }

        const SIDEBAR_COLLAPSED_WIDTH = 56;
        const MIN_CENTER_WIDTH = 500;

        function getSidebarExpandedWidth() {
            return window.innerWidth <= 1024 ? 260 : 300;
        }

        function getSidebarEffectiveWidth(collapsed) {
            return collapsed ? SIDEBAR_COLLAPSED_WIDTH : getSidebarExpandedWidth();
        }

        function enforceSidebarConstraints() {
            if (!sidebarsVisible) return;
            const sidebarOffset = 10;
            const gap = 5;
            const expandedW = getSidebarExpandedWidth();
            const collapsedW = SIDEBAR_COLLAPSED_WIDTH;
            const vw = window.innerWidth;

            const bothExpandedTotal = 2 * (sidebarOffset + expandedW + gap);
            if (!sidebarRidersCollapsed && !sidebarCoachesCollapsed && vw - bothExpandedTotal < MIN_CENTER_WIDTH) {
                sidebarCoachesCollapsed = true;
            }

            const oneExpOneCol = (sidebarOffset + expandedW + gap) + (sidebarOffset + collapsedW + gap);
            if ((!sidebarRidersCollapsed || !sidebarCoachesCollapsed) && vw - oneExpOneCol < MIN_CENTER_WIDTH) {
                sidebarRidersCollapsed = true;
                sidebarCoachesCollapsed = true;
            }

            const bothCollapsed = 2 * (sidebarOffset + collapsedW + gap);
            const minTotalWidth = bothCollapsed + MIN_CENTER_WIDTH;
            document.body.style.minWidth = sidebarsVisible ? minTotalWidth + 'px' : '';
        }

        function updateFixedHorizontalOffset() {
            if (!sidebarsVisible) return;
            const sx = window.scrollX || 0;
            const sidebarRiders = document.getElementById('sidebar-riders');
            const sidebarCoaches = document.getElementById('sidebar-coaches');
            const practiceBanner = document.getElementById('practice-banner');
            const stickyTop = document.querySelector('.sticky-top');
            if (sidebarRiders) sidebarRiders.style.left = (10 - sx) + 'px';
            if (sidebarCoaches) sidebarCoaches.style.right = (10 - sx) + 'px';
            if (practiceBanner) {
                const sidebarOffset = 10;
                const gap = 5;
                const mlVal = sidebarOffset + getSidebarEffectiveWidth(sidebarRidersCollapsed) + gap;
                const mrVal = sidebarOffset + getSidebarEffectiveWidth(sidebarCoachesCollapsed) + gap;
                practiceBanner.style.left = (mlVal - sx) + 'px';
                practiceBanner.style.right = (mrVal - sx) + 'px';
            }
            if (stickyTop) {
                stickyTop.style.left = (10 - sx) + 'px';
                stickyTop.style.right = (10 - sx) + 'px';
            }
        }

        window.addEventListener('scroll', () => {
            if (sidebarsVisible) updateFixedHorizontalOffset();
        }, { passive: true });

        function applySidebarCollapsedState() {
            const sidebarRiders = document.getElementById('sidebar-riders');
            const sidebarCoaches = document.getElementById('sidebar-coaches');
            const container = document.querySelector('.container');
            const practiceBanner = document.getElementById('practice-banner');

            enforceSidebarConstraints();

            if (sidebarRiders) sidebarRiders.classList.toggle('collapsed', sidebarRidersCollapsed);
            if (sidebarCoaches) sidebarCoaches.classList.toggle('collapsed', sidebarCoachesCollapsed);
            const sidebarOffset = 10;
            const gap = 5;
            if (container && sidebarsVisible) {
                const ml = (sidebarOffset + getSidebarEffectiveWidth(sidebarRidersCollapsed) + gap) + 'px';
                const mr = (sidebarOffset + getSidebarEffectiveWidth(sidebarCoachesCollapsed) + gap) + 'px';
                container.style.marginLeft = ml;
                container.style.marginRight = mr;
                if (practiceBanner) {
                    practiceBanner.style.left = ml;
                    practiceBanner.style.right = mr;
                }
            } else if (practiceBanner) {
                practiceBanner.style.left = '10px';
                practiceBanner.style.right = '10px';
            }
            updateFixedHorizontalOffset();
            if (typeof truncateOverflowingNames === 'function') {
                setTimeout(truncateOverflowingNames, 50);
                setTimeout(truncateOverflowingNames, 300);
            }
        }

        function collapseSidebar(which) {
            if (attendanceMode) return;
            if (which === 'riders') sidebarRidersCollapsed = true;
            else sidebarCoachesCollapsed = true;
            applySidebarCollapsedState();
        }

        function expandSidebar(which) {
            if (which === 'riders') {
                sidebarRidersCollapsed = false;
                const sidebarOffset = 10, gap = 5, expandedW = getSidebarExpandedWidth();
                const bothExpanded = 2 * (sidebarOffset + expandedW + gap);
                if (window.innerWidth - bothExpanded < MIN_CENTER_WIDTH) {
                    sidebarCoachesCollapsed = true;
                }
            } else {
                sidebarCoachesCollapsed = false;
                const sidebarOffset = 10, gap = 5, expandedW = getSidebarExpandedWidth();
                const bothExpanded = 2 * (sidebarOffset + expandedW + gap);
                if (window.innerWidth - bothExpanded < MIN_CENTER_WIDTH) {
                    sidebarRidersCollapsed = true;
                }
            }
            applySidebarCollapsedState();
            renderSidebars();
        }

        let _sidebarResizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(_sidebarResizeTimer);
            _sidebarResizeTimer = setTimeout(() => {
                if (sidebarsVisible) applySidebarCollapsedState();
            }, 100);
        });

        // ===== SIDEBAR CONTEXT MENU =====

        function showSidebarMenu(event, sidebarType) {
            event.stopPropagation();
            closeSidebarMenu();

            const isRiders = sidebarType === 'riders';
            let menuHtml = '';
            menuHtml += `<div class="group-menu-item" onclick="sidebarMarkAllAttending('${sidebarType}'); closeSidebarMenu();">Mark all ${isRiders ? 'Riders' : 'Coaches'} Attending</div>`;
            menuHtml += `<div class="group-menu-item" onclick="sidebarMarkAllAbsent('${sidebarType}'); closeSidebarMenu();">Mark all ${isRiders ? 'Riders' : 'Coaches'} Absent</div>`;
            menuHtml += `<div class="group-menu-separator"></div>`;
            menuHtml += `<div class="group-menu-item" onclick="sidebarUnassignAll('${sidebarType}'); closeSidebarMenu();">Unassign All ${isRiders ? 'Riders' : 'Coaches'}</div>`;
            menuHtml += `<div class="group-menu-item" onclick="sidebarAutoAssignUnassigned('${sidebarType}'); closeSidebarMenu();">Auto-Assign Unassigned</div>`;

            const menu = document.createElement('div');
            menu.id = 'sidebar-context-menu';
            menu.className = 'group-context-menu';
            menu.innerHTML = menuHtml;
            document.body.appendChild(menu);

            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 2) + 'px';
            menu.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
            if (typeof ensureMenuInViewport === 'function') ensureMenuInViewport(menu, rect, 2);
            if (typeof startContextMenuAutoClose === 'function') startContextMenuAutoClose(menu, closeSidebarMenu);

            setTimeout(() => {
                document.addEventListener('click', closeSidebarMenuOnOutside);
            }, 0);
        }

        function closeSidebarMenu() {
            const menu = document.getElementById('sidebar-context-menu');
            if (menu) menu.remove();
            document.removeEventListener('click', closeSidebarMenuOnOutside);
        }

        function closeSidebarMenuOnOutside(e) {
            const menu = document.getElementById('sidebar-context-menu');
            if (menu && !menu.contains(e.target)) closeSidebarMenu();
        }

        function sidebarMarkAllAttending(type) {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride) return;
            if (type === 'riders') {
                ride.availableRiders = (data.riders || []).filter(r => !r.archived).map(r => r.id);
            } else {
                ride.availableCoaches = (data.coaches || []).filter(c => !c.archived).map(c => c.id);
            }
            saveRideToDB(ride);
            renderSidebars();
        }

        function sidebarMarkAllAbsent(type) {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride) return;
            if (!confirm(`Mark all ${type === 'riders' ? 'riders' : 'coaches'} absent? Any current group assignments will be lost.`)) return;
            if (type === 'riders') {
                ride.availableRiders = [];
                if (ride.groups) ride.groups.forEach(g => { g.riders = []; });
            } else {
                ride.availableCoaches = [];
                if (ride.groups) ride.groups.forEach(g => {
                    g.coaches = { leader: null, sweep: null, roam: null, extraRoam: [] };
                });
            }
            saveRideToDB(ride);
            renderSidebars();
            renderAssignments(ride);
        }

        function sidebarUnassignAll(type) {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride || !ride.groups) return;
            if (!confirm(`Unassign all ${type === 'riders' ? 'riders' : 'coaches'} from groups?`)) return;
            saveAssignmentState(ride);
            if (type === 'riders') {
                ride.groups.forEach(g => { g.riders = []; });
            } else {
                ride.groups.forEach(g => {
                    g.coaches = { leader: null, sweep: null, roam: null, extraRoam: [] };
                });
            }
            saveRideToDB(ride);
            renderAssignments(ride);
            renderSidebars();
        }

        function sidebarAutoAssignUnassigned(type) {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride) return;
            if (!ride.groups || ride.groups.length === 0) {
                alert('No groups exist yet. Please create groups first.');
                return;
            }

            saveAssignmentState(ride);

            if (type === 'riders') {
                const assignedSet = new Set();
                ride.groups.forEach(g => g.riders.forEach(rid => {
                    const n = typeof rid === 'string' ? parseInt(rid, 10) : rid;
                    assignedSet.add(Number.isFinite(n) ? n : rid);
                }));
                const available = (ride.availableRiders || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id);
                const unassigned = available.filter(id => !assignedSet.has(id));
                if (unassigned.length === 0) {
                    alert('All attending riders are already assigned to groups.');
                    return;
                }
                const riderMap = {};
                (data.riders || []).forEach(r => { riderMap[r.id] = r; });
                unassigned.forEach(riderId => {
                    const rider = riderMap[riderId];
                    const riderFitness = rider ? (rider.fitness || rider.endurance || 0) : 0;
                    let bestGroup = null;
                    let bestScore = Infinity;
                    ride.groups.forEach(group => {
                        const groupSize = (group.riders || []).length;
                        let groupAvgFitness = 0;
                        if (groupSize > 0) {
                            const total = group.riders.reduce((sum, rid) => {
                                const r = riderMap[typeof rid === 'string' ? parseInt(rid, 10) : rid];
                                return sum + (r ? (r.fitness || r.endurance || 0) : 0);
                            }, 0);
                            groupAvgFitness = total / groupSize;
                        }
                        const fitnessDiff = Math.abs(riderFitness - groupAvgFitness);
                        const score = groupSize * 2 + fitnessDiff;
                        if (score < bestScore) {
                            bestScore = score;
                            bestGroup = group;
                        }
                    });
                    if (bestGroup) bestGroup.riders.push(riderId);
                });
            } else {
                const coachAssignmentMap = typeof getCoachAssignmentMap === 'function' ? getCoachAssignmentMap(ride) : {};
                const available = (ride.availableCoaches || []).map(id => typeof id === 'string' ? parseInt(id, 10) : id);
                const unassigned = available.filter(id => !coachAssignmentMap[id]);
                if (unassigned.length === 0) {
                    alert('All attending coaches are already assigned to groups.');
                    return;
                }
                const coachMap = {};
                (data.coaches || []).forEach(c => { coachMap[c.id] = c; });
                const minLeaderLevel = typeof getAutoAssignSetting === 'function' ? getAutoAssignSetting('minLeaderLevel', 2) : 2;
                unassigned.forEach(coachId => {
                    const coach = coachMap[coachId];
                    const levelRaw = coach ? (coach.coachingLicenseLevel || coach.level || '1') : '0';
                    const level = parseInt(levelRaw, 10) || 0;
                    let bestGroup = null;
                    let fewestCoaches = Infinity;
                    ride.groups.forEach(group => {
                        let coachCount = 0;
                        if (group.coaches.leader) coachCount++;
                        if (group.coaches.sweep) coachCount++;
                        if (group.coaches.roam) coachCount++;
                        coachCount += (group.coaches.extraRoam || []).length;
                        if (coachCount < fewestCoaches) {
                            fewestCoaches = coachCount;
                            bestGroup = group;
                        }
                    });
                    if (bestGroup) {
                        if (!bestGroup.coaches.leader && Number.isFinite(level) && level >= minLeaderLevel) {
                            bestGroup.coaches.leader = coachId;
                        } else if (!bestGroup.coaches.sweep) {
                            bestGroup.coaches.sweep = coachId;
                        } else if (!bestGroup.coaches.roam) {
                            bestGroup.coaches.roam = coachId;
                        } else {
                            if (!Array.isArray(bestGroup.coaches.extraRoam)) bestGroup.coaches.extraRoam = [];
                            bestGroup.coaches.extraRoam.push(coachId);
                        }
                    }
                });

                // Post-pass: promote a non-leader coach to leader if group has no leader
                ride.groups.forEach(group => {
                    if (group.coaches.leader) return;
                    const slots = [
                        { role: 'sweep', id: group.coaches.sweep },
                        { role: 'roam', id: group.coaches.roam },
                        ...((group.coaches.extraRoam || []).map(id => ({ role: 'extraRoam', id })))
                    ].filter(s => s.id);
                    if (slots.length === 0) return;
                    // Prefer highest-level coach for leader
                    slots.sort((a, b) => {
                        const ca = coachMap[a.id], cb = coachMap[b.id];
                        const la = ca ? (parseInt(ca.leaderLevel || ca.coachingLicenseLevel || '0', 10) || 0) : 0;
                        const lb = cb ? (parseInt(cb.leaderLevel || cb.coachingLicenseLevel || '0', 10) || 0) : 0;
                        return lb - la;
                    });
                    const promoted = slots[0];
                    group.coaches.leader = promoted.id;
                    if (promoted.role === 'sweep') group.coaches.sweep = null;
                    else if (promoted.role === 'roam') group.coaches.roam = null;
                    else if (promoted.role === 'extraRoam') {
                        group.coaches.extraRoam = (group.coaches.extraRoam || []).filter(id => id !== promoted.id);
                    }
                });
            }

            saveRideToDB(ride);
            renderAssignments(ride);
            renderSidebars();
        }

        function setSidebarFilter(sidebar, filter) {
            if (sidebar === 'riders') {
                sidebarRidersFilter = filter;
            } else {
                sidebarCoachesFilter = filter;
            }
            renderSidebars();
        }

        function changeSidebarSort(sidebar, value) {
            if (sidebar === 'riders') {
                sidebarRidersSort = value;
            } else {
                sidebarCoachesSort = value;
            }
            renderSidebars();
        }

        function renderSidebars() {
            const ride = data.rides ? data.rides.find(r => r.id === data.currentRide) : null;
            if (!ride || !sidebarsVisible) return;

            // Ensure attendance defaults
            const isRefined = isRideRefined(ride);
            ensureRideAttendanceDefaults(ride);

            // Normalize availableRiders/Coaches
            if (!Array.isArray(ride.availableRiders)) ride.availableRiders = [];
            ride.availableRiders = ride.availableRiders.map(id => {
                const n = typeof id === 'string' ? parseInt(id, 10) : id;
                return Number.isFinite(n) ? n : id;
            });
            if (!Array.isArray(ride.availableCoaches)) ride.availableCoaches = [];
            ride.availableCoaches = ride.availableCoaches.map(id => {
                const n = typeof id === 'string' ? parseInt(id, 10) : id;
                return Number.isFinite(n) ? n : id;
            });

            const availableRiderSet = new Set(ride.availableRiders);
            const availableCoachSet = new Set(ride.availableCoaches);

            // Build rider assignment map (which riders are in groups)
            const riderAssignmentMap = {};
            const groupLabelMap = {};
            ride.groups.forEach(group => {
                groupLabelMap[group.id] = group.label;
                group.riders.forEach(riderId => {
                    const nId = typeof riderId === 'string' ? parseInt(riderId, 10) : riderId;
                    riderAssignmentMap[Number.isFinite(nId) ? nId : riderId] = group.id;
                });
            });

            // Build coach assignment map
            const coachAssignmentMap = getCoachAssignmentMap(ride);

            // Determine which riders to show based on refined status (exclude archived)
            let ridersPool = (data.riders || []).filter(r => !r.archived);
            if (isRefined) {
                const practice = getPracticeForRide(ride);
                if (practice) {
                    const filteredRiders = getFilteredRidersForPractice(practice);
                    const qualifyingIds = new Set(filteredRiders.map(r => {
                        const id = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id;
                        return Number.isFinite(id) ? id : r.id;
                    }));
                    ridersPool = ridersPool.filter(rider => {
                        const rid = typeof rider.id === 'string' ? parseInt(rider.id, 10) : rider.id;
                        return qualifyingIds.has(Number.isFinite(rid) ? rid : rider.id);
                    });
                }
            }

            // Exclude N/A coaches and archived coaches
            const coachesPool = (data.coaches || []).filter(coach => {
                if (coach.archived) return false;
                const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                return levelRaw !== 'N/A' && levelRaw !== 'N/a' && levelRaw !== 'n/a';
            });

            // ---- RIDERS SIDEBAR ----
            renderSidebarList('riders', ridersPool, availableRiderSet, riderAssignmentMap, groupLabelMap, coachAssignmentMap);

            // ---- COACHES SIDEBAR ----
            renderSidebarList('coaches', coachesPool, availableCoachSet, riderAssignmentMap, groupLabelMap, coachAssignmentMap);
        }

        function renderSidebarList(type, pool, availableSet, riderAssignmentMap, groupLabelMap, coachAssignmentMap) {
            const ride = data.rides.find(r => r.id === data.currentRide);
            if (!ride) return;

            const filter = type === 'riders' ? sidebarRidersFilter : sidebarCoachesFilter;
            const sortBy = type === 'riders' ? sidebarRidersSort : sidebarCoachesSort;
            const listEl = document.getElementById(`sidebar-${type}-list`);
            const tabsEl = document.querySelector(`#sidebar-${type} .sidebar-tabs`);

            if (!listEl) return;

            // Save scroll position
            const scrollTop = listEl.scrollTop || 0;

            // Categorize items
            const attending = [];  // in availableSet
            const absent = [];     // NOT in availableSet
            const unassigned = []; // in availableSet but NOT assigned to any group

            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();

            pool.forEach(item => {
                const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
                const normalizedId = Number.isFinite(itemId) ? itemId : item.id;
                const isAvailable = availableSet.has(normalizedId);

                let isAssigned = false;
                let assignedGroupLabel = null;
                if (type === 'riders') {
                    const gId = riderAssignmentMap[normalizedId];
                    if (gId) {
                        isAssigned = true;
                        assignedGroupLabel = groupLabelMap[gId];
                    }
                } else {
                    const assignment = coachAssignmentMap[normalizedId];
                    if (assignment) {
                        isAssigned = true;
                        assignedGroupLabel = groupLabelMap[assignment.groupId];
                    }
                }

                // Extract sort keys
                let firstName = item.firstName || '';
                let lastName = item.lastName || '';
                if (!firstName && !lastName && item.name) {
                    const parts = item.name.trim().split(/\s+/);
                    if (parts.length > 1) {
                        lastName = parts.pop() || '';
                        firstName = parts.join(' ') || '';
                    } else {
                        firstName = parts[0] || '';
                    }
                }

                // Check for scheduled absence
                const personType = type === 'riders' ? 'rider' : 'coach';
                const rideDate = ride.date || '';
                const absenceStatus = rideDate ? isScheduledAbsent(personType, normalizedId, rideDate) : { absent: false, reason: '' };

                const entry = {
                    item,
                    isAvailable,
                    isAssigned,
                    assignedGroupLabel,
                    normalizedId,
                    scheduledAbsent: absenceStatus.absent,
                    absenceReason: absenceStatus.reason || '',
                    absenceRecord: absenceStatus.absence || null,
                    fitness: type === 'riders'
                        ? Math.max(1, Math.min(fitnessScale, parseInt(item.fitness || Math.ceil(fitnessScale / 2), 10)))
                        : getCoachFitnessValue(item),
                    skills: type === 'riders'
                        ? Math.max(1, Math.min(skillsScale, parseInt(item.skills || Math.ceil(skillsScale / 2), 10)))
                        : 0,
                    grade: parseInt(item.grade || '0', 10) || 0,
                    gender: (item.gender || 'M').toUpperCase(),
                    level: type === 'coaches' ? (() => {
                        const lev = item.coachingLicenseLevel || item.level || '1';
                        return lev === 'N/A' ? 0 : (parseInt(lev, 10) || 0);
                    })() : 0,
                    firstName: firstName.toLowerCase(),
                    lastName: (lastName || getSortableLastName(item.name || '')).toLowerCase()
                };

                if (isAvailable) {
                    attending.push(entry);
                    if (!isAssigned) {
                        unassigned.push(entry);
                    }
                } else {
                    absent.push(entry);
                }
            });

            // Pick the right list for the current filter
            let filtered;
            if (attendanceMode) {
                filtered = [...attending, ...absent];
            } else if (filter === 'attending') filtered = attending;
            else if (filter === 'absent') filtered = absent;
            else filtered = unassigned; // 'unassigned'

            // Sort — scheduled-absent always at the bottom within absent tab
            const sortFn = (a, b) => {
                // Scheduled-absent people always go to the bottom
                if (a.scheduledAbsent !== b.scheduledAbsent) {
                    return a.scheduledAbsent ? 1 : -1;
                }
                let compare = 0;
                if (sortBy === 'pace') {
                    compare = b.fitness !== a.fitness ? b.fitness - a.fitness : a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'firstName') {
                    compare = a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'lastName' || sortBy === 'name') {
                    compare = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                } else if (sortBy === 'grade') {
                    compare = b.grade !== a.grade ? b.grade - a.grade : a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'gender') {
                    compare = a.gender !== b.gender ? a.gender.localeCompare(b.gender) : a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'skills') {
                    compare = b.skills !== a.skills ? b.skills - a.skills : a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'climbing') {
                    const aClimbing = parseInt(a.climbing || '3', 10);
                    const bClimbing = parseInt(b.climbing || '3', 10);
                    compare = bClimbing !== aClimbing ? bClimbing - aClimbing : a.lastName.localeCompare(b.lastName);
                } else if (sortBy === 'level') {
                    compare = b.level !== a.level ? b.level - a.level : a.lastName.localeCompare(b.lastName);
                } else {
                    compare = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
                }
                return compare;
            };
            filtered.sort(sortFn);

            // Render cards
            let html = '';
            if (filtered.length === 0) {
                const emptyMessages = {
                    attending: `No ${type} attending`,
                    absent: `No ${type} absent`,
                    unassigned: `No unassigned ${type}`
                };
                html = `<div class="empty-message">${emptyMessages[filter]}</div>`;
            } else {
                let separatorInserted = false;
                html = filtered.map(entry => {
                    let prefix = '';
                    // Insert horizontal line before first scheduled-absent entry (in absent tab)
                    if (entry.scheduledAbsent && !separatorInserted && filter === 'absent') {
                        separatorInserted = true;
                        prefix = '<hr style="margin: 6px 0; border: none; border-top: 1px solid #ccc;">';
                    }
                    const groupNum = entry.assignedGroupLabel ? entry.assignedGroupLabel.replace('Group ', '') : '';
                    const isUnassigned = !entry.isAssigned;
                    let assignmentLabel = '';
                    if (!attendanceMode && entry.isAvailable) {
                        assignmentLabel = groupNum
                            ? `<span class="group-badge" onclick="showGroupBadgeMenu(event, '${type === 'riders' ? 'rider' : 'coach'}', ${entry.normalizedId})" style="cursor: pointer;">${groupNum}</span>`
                            : `<span class="group-badge unassigned-badge" onclick="showUnassignedBadgeMenu(event, '${type === 'riders' ? 'rider' : 'coach'}', ${entry.normalizedId})" style="cursor: pointer;">?</span>`;
                    }
                    const cardSortBy = (sortBy === 'name' || sortBy === 'firstName' || sortBy === 'lastName') ? sortBy : sortBy;
                    const sidebarVisibleSkills = attendanceMode ? [] : (ride.visibleSkills || ['pace']);
                    let cardHtml;
                    if (type === 'riders') {
                        cardHtml = renderRiderCardHtml(entry.item, {
                            draggable: !attendanceMode && entry.isAvailable,
                            showAttendance: true,
                            isAvailable: entry.isAvailable,
                            assignmentLabel,
                            compact: true,
                            sortBy: cardSortBy,
                            noPhoto: true,
                            inGroup: false,
                            showUnavailableStyle: false,
                            hideBadges: false,
                            isUnassigned: isUnassigned,
                            scheduledAbsent: entry.scheduledAbsent,
                            absenceReasonText: entry.absenceReason || '',
                            visibleSkills: sidebarVisibleSkills,
                            sidebarCard: true
                        });
                    } else {
                        const assignment = coachAssignmentMap[entry.normalizedId];
                        cardHtml = renderCoachCardHtml(entry.item, null, null, {
                            draggable: !attendanceMode && entry.isAvailable,
                            showAttendance: true,
                            isAvailable: entry.isAvailable,
                            assignmentLabel,
                            compact: true,
                            sortBy: cardSortBy,
                            noPhoto: true,
                            isUnassigned: isUnassigned,
                            scheduledAbsent: entry.scheduledAbsent,
                            absenceReasonText: entry.absenceReason || '',
                            visibleSkills: sidebarVisibleSkills,
                            sidebarCard: true
                        });
                    }
                    return prefix + cardHtml;
                }).join('');
            }

            listEl.innerHTML = html;
            truncateOverflowingNames();

            // Restore scroll position
            if (scrollTop > 0) {
                requestAnimationFrame(() => { listEl.scrollTop = scrollTop; });
            }

            // Update active tab
            if (tabsEl) {
                if (attendanceMode) {
                    tabsEl.style.display = 'none';
                } else {
                    tabsEl.style.display = '';
                    tabsEl.querySelectorAll('.sidebar-tab').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.filter === filter);
                    });
                }
            }

            // Update tab counts and visibility (skip in attendance mode)
            if (!attendanceMode) {
                const tabButtons = tabsEl ? tabsEl.querySelectorAll('.sidebar-tab') : [];
                tabButtons.forEach(btn => {
                    const f = btn.dataset.filter;
                    let count = 0;
                    if (f === 'attending') count = attending.length;
                    else if (f === 'absent') count = absent.length;
                    else if (f === 'unassigned') count = unassigned.length;
                    const label = f.charAt(0).toUpperCase() + f.slice(1);
                    btn.textContent = `${label} (${count})`;

                    if (f === 'unassigned') {
                        btn.style.display = (count === 0) ? 'none' : '';
                    }
                });

                // Auto-collapse if currently on unassigned tab and it just emptied
                if (filter === 'unassigned' && unassigned.length === 0) {
                    setTimeout(() => {
                        if (type === 'riders') {
                            sidebarRidersFilter = 'attending';
                            sidebarRidersCollapsed = true;
                        } else {
                            sidebarCoachesFilter = 'attending';
                            sidebarCoachesCollapsed = true;
                        }
                        applySidebarCollapsedState();
                        renderSidebars();
                    }, 1000);
                }
            }

            // Update collapsed sidebar stats
            const statsEl = document.getElementById(`sidebar-${type}-collapsed-stats`);
            if (statsEl) {
                let statsHtml = `<span class="sidebar-collapsed-divider">|</span> ${attending.length} Attending`;
                statsHtml += ` <span class="sidebar-collapsed-divider">|</span> ${absent.length} Absent`;
                if (unassigned.length > 0) {
                    statsHtml += ` <span class="sidebar-collapsed-divider">|</span> ${unassigned.length} Unassigned`;
                }
                statsEl.innerHTML = statsHtml;
            }

            // Attach event delegation for checkboxes
            attachSidebarCheckboxListeners(listEl, type);
        }

        function attachSidebarCheckboxListeners(listEl, type) {
            // Remove old listener by cloning technique
            const newList = listEl.cloneNode(true);
            listEl.parentNode.replaceChild(newList, listEl);

            // Re-attach drag handlers (since cloneNode removes them)
            newList.setAttribute('ondrop', 'drop(event)');
            newList.setAttribute('ondragover', 'allowDrop(event)');
            newList.setAttribute('ondragleave', 'dragLeave(event)');

            // Checkbox click handler
            newList.addEventListener('click', function(e) {
                if (e.target.type !== 'checkbox' || !e.target.classList.contains('attendance-checkbox-input')) return;
                const attendanceType = e.target.dataset.attendanceType;
                const expectedType = type === 'riders' ? 'rider' : 'coach';
                if (attendanceType !== expectedType) return;

                setTimeout(async () => {
                    const idStr = type === 'riders' ? e.target.dataset.riderId : e.target.dataset.coachId;
                    const id = parseInt(idStr, 10);
                    const isAvailable = e.target.checked;
                    if (!Number.isFinite(id)) return;

                    // Check for scheduled absence when trying to mark as attending
                    if (isAvailable) {
                        const personType = type === 'riders' ? 'rider' : 'coach';
                        const ride = data.rides.find(r => r.id === data.currentRide);
                        const rideDate = ride ? ride.date : '';
                        const absenceStatus = rideDate ? isScheduledAbsent(personType, id, rideDate) : { absent: false };

                        if (absenceStatus.absent && absenceStatus.absence) {
                            const person = type === 'riders'
                                ? (data.riders || []).find(r => r.id === id)
                                : (data.coaches || []).find(c => c.id === id);
                            let personName = 'This person';
                            if (person) {
                                if (person.nickname && person.nicknameMode === 'firstName') {
                                    personName = `${person.nickname} ${person.lastName || ''}`.trim();
                                } else if (person.nickname) {
                                    personName = person.nickname;
                                } else {
                                    personName = person.name || 'This person';
                                }
                            }
                            const endFormatted = absenceStatus.absence.endDate
                                ? new Date(absenceStatus.absence.endDate + 'T00:00:00').toLocaleDateString()
                                : 'unknown';
                            const reasonText = absenceStatus.reason || 'an absence';

                            const userConfirmed = confirm(
                                `${personName} has been marked absent due to ${reasonText} through ${endFormatted}. Are they back earlier than expected?`
                            );

                            if (userConfirmed) {
                                // Update the absence end date to one day before the practice date
                                const practiceDate = new Date(rideDate + 'T00:00:00');
                                const newEndDate = new Date(practiceDate);
                                newEndDate.setDate(newEndDate.getDate() - 1);
                                const newEndDateStr = newEndDate.toISOString().split('T')[0];

                                try {
                                    const updated = await updateScheduledAbsence(absenceStatus.absence.id, { endDate: newEndDateStr });
                                    const idx = data.scheduledAbsences.findIndex(a => a.id === absenceStatus.absence.id);
                                    if (idx !== -1) {
                                        data.scheduledAbsences[idx] = updated;
                                    }
                                } catch (err) {
                                    console.error('Failed to update absence end date:', err);
                                }
                            } else {
                                // Revert the checkbox
                                e.target.checked = false;
                                return;
                            }
                        }
                    }

                    if (type === 'riders') {
                        toggleRiderAvailability(id, isAvailable);
                    } else {
                        toggleCoachAvailability(id, isAvailable);
                    }
                }, 0);
            });

            // Name click to toggle checkbox
            newList.addEventListener('click', function(e) {
                const nameTarget = e.target.closest('.attendance-name');
                if (!nameTarget) return;
                const card = nameTarget.closest('.rider-card, .coach-card');
                const checkbox = card ? card.querySelector('.attendance-checkbox-input') : null;
                if (!checkbox) return;
                e.preventDefault();
                e.stopPropagation();
                checkbox.click();
            });
        }

        // ===== END SIDEBAR FUNCTIONS =====

        function ensureRideAttendanceDefaults(ride) {
            if (!ride) return;
            // If the ride already has an availableRiders array (from DB or prior save), never overwrite it.
            // This preserves attendance changes (e.g. marking absent then attending again) across refresh.
            if (Array.isArray(ride.availableRiders)) {
                // Even if already initialized, remove any newly scheduled-absent riders/coaches
                const rideDate = ride.date || '';
                if (rideDate) {
                    ride.availableRiders = ride.availableRiders.filter(id => {
                        const status = isScheduledAbsent('rider', id, rideDate);
                        return !status.absent;
                    });
                    if (Array.isArray(ride.availableCoaches)) {
                        ride.availableCoaches = ride.availableCoaches.filter(id => {
                            const status = isScheduledAbsent('coach', id, rideDate);
                            return !status.absent;
                        });
                    }
                }
                ride.attendanceInitialized = true;
                return;
            }
            
            const isRefined = isRideRefined(ride);
            let defaultAvailableRiders = [];
            if (isRefined) {
                defaultAvailableRiders = getFilteredRiderIdsForRide(ride);
            } else {
                defaultAvailableRiders = (data.riders || []).filter(r => !r.archived).map(r => r.id);
            }

            // Filter out scheduled-absent riders
            const rideDate = ride.date || '';
            if (rideDate) {
                defaultAvailableRiders = defaultAvailableRiders.filter(id => {
                    const status = isScheduledAbsent('rider', id, rideDate);
                    return !status.absent;
                });
            }
            
            ride.availableRiders = defaultAvailableRiders;
            ride.attendanceInitialized = true;
            saveRideToDB(ride);
        }
