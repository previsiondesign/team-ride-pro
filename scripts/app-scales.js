// app-scales.js — Scale/rating helpers, auto-assign settings, sample data constants

        
        // Unified skill rating scale — all skills share the same 1-to-N range (default 6, user-configurable 2–9)
        function getUnifiedScale() {
            const s = data.seasonSettings && data.seasonSettings.fitnessScale;
            return (Number.isFinite(s) && s >= 2 && s <= 9) ? s : 6;
        }
        function getFitnessScale() { return getUnifiedScale(); }
        function getSkillsScale()  { return getUnifiedScale(); }
        function getClimbingScale(){ return getUnifiedScale(); }

        function normalizePaceScaleOrder(value, fallback = 'fastest_to_slowest') {
            if (value === 'fastest_to_slowest' || value === 'slowest_to_fastest') {
                return value;
            }
            return fallback;
        }

        function getPaceScaleOrder() {
            return normalizePaceScaleOrder(data.seasonSettings && data.seasonSettings.paceScaleOrder);
        }

        function normalizeGroupPaceOrder(value, fallback = 'fastest_to_slowest') {
            if (value === 'fastest_to_slowest' || value === 'slowest_to_fastest') {
                return value;
            }
            return fallback;
        }

        function getGroupPaceOrderForRide(ride) {
            return normalizeGroupPaceOrder(ride?.groupPaceOrder || data.seasonSettings?.groupPaceOrder);
        }

        function getGroupPaceComparator(ride) {
            const groupPaceOrder = getGroupPaceOrderForRide(ride);
            const sortDescending = groupPaceOrder === 'fastest_to_slowest';
            return (a, b) => {
                const fitnessA = getGroupFitnessScore(a);
                const fitnessB = getGroupFitnessScore(b);
                if (fitnessB !== fitnessA) return sortDescending ? (fitnessB - fitnessA) : (fitnessA - fitnessB);
                const sizeDiff = b.riders.length - a.riders.length;
                if (sizeDiff !== 0) return sizeDiff;
                return a.id - b.id;
            };
        }

        function invertPaceValue(value, scale) {
            return scale + 1 - value;
        }

        function getRelativePaceValue(value) {
            const scale = getFitnessScale();
            const normalized = normalizePaceScaleOrder(data.seasonSettings && data.seasonSettings.paceScaleOrder);
            if (!Number.isFinite(value)) return value;
            return normalized === 'fastest_to_slowest' ? invertPaceValue(value, scale) : value;
        }

        function convertAllPaceRatingsForOrderChange(oldOrder, newOrder, scale) {
            const normalizedOld = normalizePaceScaleOrder(oldOrder);
            const normalizedNew = normalizePaceScaleOrder(newOrder);
            if (normalizedOld === normalizedNew) return 0;

            let convertedCount = 0;
            const applyInversion = (entry) => {
                const oldValue = parseInt(entry.fitness, 10);
                if (!isNaN(oldValue) && oldValue >= 1 && oldValue <= scale) {
                    entry.fitness = String(invertPaceValue(oldValue, scale));
                    convertedCount++;
                }
            };

            if (data.riders) {
                data.riders.forEach(rider => {
                    if (rider.fitness) {
                        applyInversion(rider);
                    }
                });
            }

            if (data.coaches) {
                data.coaches.forEach(coach => {
                    if (coach.fitness) {
                        applyInversion(coach);
                    }
                });
            }

            return convertedCount;
        }
        
        // Dynamic level labels for any scale from 2–9
        const SKILL_LEVEL_LABELS = {
            2: ['Beginner', 'Advanced'],
            3: ['Beginner', 'Intermediate', 'Advanced'],
            4: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
            5: ['Beginner', 'Developing', 'Intermediate', 'Advanced', 'Expert'],
            6: ['Beginner', 'Developing', 'Intermediate', 'Proficient', 'Advanced', 'Expert'],
            7: ['Beginner', 'Developing', 'Intermediate', 'Proficient', 'Advanced', 'Expert', 'Elite'],
            8: ['Beginner', 'Novice', 'Developing', 'Intermediate', 'Proficient', 'Advanced', 'Expert', 'Elite'],
            9: ['Beginner', 'Novice', 'Developing', 'Intermediate', 'Competent', 'Proficient', 'Advanced', 'Expert', 'Elite']
        };

        function getSkillLevelLabel(level, scale) {
            if (!scale) scale = getUnifiedScale();
            const labels = SKILL_LEVEL_LABELS[scale] || SKILL_LEVEL_LABELS[6];
            return labels[level - 1] || `Level ${level}`;
        }

        // Descending skill tooltips (generic, scale-adaptive)
        function getBikeSkillsTooltip(level, scale) {
            if (!scale) scale = getSkillsScale();
            const label = getSkillLevelLabel(level, scale);
            const descs = {
                'Beginner':     'Building foundational skills and confidence. Focus on safe braking, body position, and control at lower speeds.',
                'Novice':       'Developing basic trail skills. Comfortable on smooth trails and gentle descents with consistent braking.',
                'Developing':   'Growing confidence on varied terrain. Can handle moderate descents with rocks, roots, and uneven surfaces.',
                'Intermediate': 'Comfortable on varied trails with consistent bike control, thoughtful line choice, and predictable group riding.',
                'Competent':    'Handles challenging descents with good technique, strong line selection, and confident body positioning.',
                'Proficient':   'Confident on demanding terrain. Navigates steep grades, tight turns, and complex trail conditions efficiently.',
                'Advanced':     'Handles demanding terrain at higher speeds with strong handling skills and tactical awareness.',
                'Expert':       'Excels on the most demanding descents. Composed at high speed with advanced handling and race-level instinct.',
                'Elite':        'Top-level descending ability. Masters any terrain with exceptional speed, control, and instinct.'
            };
            return `${label}\n${descs[label] || ''}`;
        }

        // Climbing skill tooltips (generic, scale-adaptive)
        function getClimbingTooltip(level, scale) {
            if (!scale) scale = getClimbingScale();
            const label = getSkillLevelLabel(level, scale);
            const descs = {
                'Beginner':     'Developing climbing endurance. Comfortable on gradual inclines but may need to walk on steeper climbs.',
                'Novice':       'Can complete short climbs but needs rest stops on moderate gradients. Building cadence awareness.',
                'Developing':   'Handles moderate climbs with occasional rest stops. Building cadence control and pacing skills.',
                'Intermediate': 'Sustains moderate climbs without stopping. Proper pacing, cadence control, and efficient body position.',
                'Competent':    'Handles sustained climbs with good technique. Efficient gear selection and consistent pacing.',
                'Proficient':   'Powers through steep climbs with strong technique and composure on long ascents.',
                'Advanced':     'Strong climber on steep and sustained ascents with tactical awareness for group climbing.',
                'Expert':       'Excels on the most demanding climbs with high power output and strong tactical sense.',
                'Elite':        'Top-level climbing ability. Dominates any ascent with exceptional power and race-level tactics.'
            };
            return `${label}\n${descs[label] || ''}`;
        }

        function getSkillLevelDescriptions(skillName, scale) {
            if (!scale) scale = getUnifiedScale();
            const labels = SKILL_LEVEL_LABELS[scale] || SKILL_LEVEL_LABELS[6];
            return labels.map((label, i) => ({
                level: i + 1,
                label: `Level ${i + 1}: ${label}`,
                description: skillName === 'climbing'
                    ? getClimbingTooltip(i + 1, scale).split('\n')[1] || ''
                    : getBikeSkillsTooltip(i + 1, scale).split('\n')[1] || ''
            }));
        }
        function getBikeSkillsLevelDescriptions(scale) { return getSkillLevelDescriptions('descending', scale); }
        function getClimbingLevelDescriptions(scale)    { return getSkillLevelDescriptions('climbing', scale); }

        function updateBikeSkillsDescriptions() {
            const container = document.getElementById('bike-skills-descriptions');
            if (!container) return;
            const scale = getSkillsScale();
            const descriptions = getBikeSkillsLevelDescriptions(scale);
            if (descriptions.length === 0) { container.innerHTML = ''; return; }
            let html = '<div style="font-weight: 600; margin-bottom: 8px; color: #333;">Descending Level Descriptions:</div>';
            descriptions.forEach(desc => {
                html += `<div style="margin-bottom: 10px; padding: 8px; background: white; border-left: 3px solid #2196F3; border-radius: 2px;">
                    <div style="font-weight: 600; color: #2196F3; margin-bottom: 4px;">${escapeHtml(desc.label)}</div>
                    <div style="color: #555;">${escapeHtml(desc.description)}</div></div>`;
            });
            container.innerHTML = html;
        }

        function updateClimbingDescriptions() {
            const container = document.getElementById('climbing-descriptions');
            if (!container) return;
            const scale = getClimbingScale();
            const descriptions = getClimbingLevelDescriptions(scale);
            if (descriptions.length === 0) { container.innerHTML = ''; return; }
            let html = '<div style="font-weight: 600; margin-bottom: 8px; color: #333;">Climbing Level Descriptions:</div>';
            descriptions.forEach(desc => {
                html += `<div style="margin-bottom: 10px; padding: 8px; background: white; border-left: 3px solid #2196F3; border-radius: 2px;">
                    <div style="font-weight: 600; color: #2196F3; margin-bottom: 4px;">${escapeHtml(desc.label)}</div>
                    <div style="color: #555;">${escapeHtml(desc.description)}</div></div>`;
            });
            container.innerHTML = html;
        }

        // Proportional scale conversion — works for any old/new range
        function convertScale(value, oldMax, newMax) {
            if (oldMax === newMax) return value;
            if (value < 1) return 1;
            if (value > oldMax) value = oldMax;
            if (oldMax === 1) return 1;
            const proportion = (value - 1) / (oldMax - 1);
            return Math.max(1, Math.min(newMax, Math.round(proportion * (newMax - 1) + 1)));
        }
        function convertClimbingScale(value, oldScale, newScale)   { return convertScale(value, oldScale, newScale); }
        function convertBikeSkillsScale(value, oldScale, newScale) { return convertScale(value, oldScale, newScale); }
        
        // Helper functions to get auto-assignment settings
        function getAutoAssignSetting(id, defaultValue) {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return defaultValue;
            }
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param || !param.enabled) return defaultValue;
            return param.value;
        }

        // Get range parameter min value
        function getAutoAssignSettingMin(id, defaultValue) {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return defaultValue;
            }
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param || !param.enabled) return defaultValue;
            return param.valueMin || param.min || defaultValue;
        }

        // Get range parameter max value
        function getAutoAssignSettingMax(id, defaultValue) {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return defaultValue;
            }
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param || !param.enabled) return defaultValue;
            return param.valueMax || param.max || defaultValue;
        }
        
        // Get priority of a parameter (lower number = higher priority)
        function getParamPriority(id) {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return 999; // Low priority if not found
            }
            const param = data.autoAssignSettings.parameters.find(p => p.id === id);
            if (!param || !param.enabled) return 999;
            return param.priority;
        }
        
        // Get all enabled parameters sorted by priority (requirements first)
        function getEnabledParamsByPriority() {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return [];
            }
            return data.autoAssignSettings.parameters
                .filter(p => p.enabled)
                .sort((a, b) => {
                    // Requirements always come first
                    if (a.requirement && !b.requirement) return -1;
                    if (!a.requirement && b.requirement) return 1;
                    // Then sort by priority
                    return a.priority - b.priority;
                });
        }
        
        // Get all requirements sorted by priority
        function getRequirements() {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return [];
            }
            return data.autoAssignSettings.parameters
                .filter(p => p.enabled && p.requirement)
                .sort((a, b) => a.priority - b.priority);
        }
        
        // Get all preferences sorted by priority
        function getPreferences() {
            if (!data.autoAssignSettings || !Array.isArray(data.autoAssignSettings.parameters)) {
                return [];
            }
            return data.autoAssignSettings.parameters
                .filter(p => p.enabled && !p.requirement)
                .sort((a, b) => a.priority - b.priority);
        }
        
        // Check if constraint A can be relaxed in favor of constraint B
        function canRelaxConstraint(constraintAId, constraintBId) {
            return getParamPriority(constraintAId) > getParamPriority(constraintBId);
        }
        
        // Legacy constants for backward compatibility (now use getAutoAssignSetting)
        function getMIN_GROUP_SIZE() { 
            const param = data.autoAssignSettings?.parameters?.find(p => p.id === 'preferredGroupSize');
            return param?.valueMin || 4; 
        }
        function getMAX_FITNESS_SPREAD() { return getAutoAssignSetting('organizeByPace', 2); }
        // DAYS_OF_WEEK defined in app-state.js

        const COACH_NAMES_MALE = [
            'Alex Johnson', 'David Patel', 'Owen McCarthy', 'Cole Ramirez', 'Marcus Lee',
            'Noah Foster', 'Declan Scott', 'Gavin Brooks', 'Ryan Mitchell', 'James Wilson',
            'Michael Thompson', 'Christopher Davis', 'Daniel Martinez', 'Matthew Anderson'
        ];
        
        const COACH_NAMES_FEMALE = [
            'Maria Chen', 'Lisa Hernandez', 'Priya Singh', 'Jenna King', 'Emily Baker',
            'Harper Wright', 'Sofia Navarro', 'Sarah Johnson', 'Jessica Taylor', 'Amanda White',
            'Jennifer Brown', 'Nicole Garcia', 'Rachel Martinez', 'Lauren Rodriguez'
        ];
        
        const COACH_NAMES = [...COACH_NAMES_MALE, ...COACH_NAMES_FEMALE];

        const COACH_NOTES = [
            'Focuses on fundamentals and beginner confidence.',
            'Great with route planning and pacing.',
            'Specializes in technical climbing drills.',
            'Leads safety briefings and mechanical checks.',
            'Encourages endurance development on long rides.'
        ];

        const COACH_FITNESS_SAMPLES = [1, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10];

        const RIDER_NAMES_MALE = [
            'Ethan Cole', 'Logan Price', 'Wyatt Brooks', 'Benjamin Ortiz', 'Caleb Jordan',
            'Landon Hayes', 'Julian Foster', 'Isaiah Blake', 'Xavier Dunn', 'Grayson Tate',
            'Leo Ramirez', 'Connor Walsh', 'Miles Curtis', 'Sebastian Ford', 'Jordan Knox',
            'Noah Parker', 'Lucas Bennett', 'Owen Carter', 'Mason Reed', 'Ethan Mitchell',
            'Aiden Cooper', 'Jackson Hill', 'Liam Walker', 'Hunter Scott', 'Carter Johnson',
            'Tyler Davis', 'Ryan Martinez', 'Nathan Brown', 'Dylan Wilson', 'Cole Anderson',
            'Blake Taylor', 'Jake Thompson', 'Luke Garcia'
        ];
        
        const RIDER_NAMES_FEMALE = [
            'Mia Torres', 'Ava Reed', 'Chloe Sanders', 'Layla Kim', 'Nora Fields',
            'Scarlett Evans', 'Zoe McCoy', 'Riley Porter', 'Paisley Grant', 'Brooklyn Shaw',
            'Piper Klein', 'Sage Elliott', 'Ellie Benson', 'Adeline Harper', 'Mila Lawson',
            'Sophia Martinez', 'Emma Davis', 'Olivia Wilson', 'Isabella Garcia', 'Amelia Rodriguez',
            'Charlotte Brown', 'Harper Lee', 'Evelyn Taylor', 'Abigail Moore'
        ];
        
        const RIDER_NAMES = [...RIDER_NAMES_MALE, ...RIDER_NAMES_FEMALE];

        const RIDER_NOTES = [
            'Consistent climber with strong endurance.',
            'Working on cornering technique.',
            'Prefers technical terrain and rock gardens.',
            'Great with group communication and morale.',
            'Developing sprint speed for race finishes.'
        ];

        const RIDER_FITNESS_SAMPLES = [
            1, 2,
            3, 3, 3, 3, 3,
            4, 4, 4, 4, 4, 4,
            5, 5, 5, 5, 5,
            6, 6, 6, 6, 6,
            7, 7, 7,
            8, 8,
            9,
            10
        ];
        const RIDER_GENDER_SAMPLES = ['M', 'F'];


        function buildDefaultSeasonSettings() {
            return {
                startDate: '',
                endDate: '',
                practices: [],
                fitnessScale: 6,
                skillsScale: 6,
                climbingScale: 6,
                paceScaleOrder: 'fastest_to_slowest',
                groupPaceOrder: 'fastest_to_slowest'
            };
        }
        
        // Convert all fitness, skills, and climbing ratings when scales change
        function convertAllRatingsToNewScales(oldFitnessScale, newFitnessScale, oldSkillsScale, newSkillsScale, oldClimbingScale, newClimbingScale) {
            let convertedCount = 0;
            
            // Convert rider fitness, skills, and climbing
            if (data.riders) {
                data.riders.forEach(rider => {
                    if (rider.fitness && oldFitnessScale !== newFitnessScale) {
                        const oldValue = parseInt(rider.fitness, 10);
                        if (!isNaN(oldValue) && oldValue >= 1 && oldValue <= oldFitnessScale) {
                            rider.fitness = String(convertScale(oldValue, oldFitnessScale, newFitnessScale));
                            convertedCount++;
                        }
                    }
                    if (rider.skills && oldSkillsScale !== newSkillsScale) {
                        const oldValue = parseInt(rider.skills, 10);
                        if (!isNaN(oldValue) && oldValue >= 1 && oldValue <= oldSkillsScale) {
                            rider.skills = String(convertBikeSkillsScale(oldValue, oldSkillsScale, newSkillsScale));
                            convertedCount++;
                        }
                    }
                    if (rider.climbing && oldClimbingScale !== newClimbingScale) {
                        rider.climbing = String(convertClimbingScale(parseInt(rider.climbing || '3', 10), oldClimbingScale, newClimbingScale));
                        convertedCount++;
                    }
                });
            }
            
            // Convert coach fitness, skills, and climbing
            if (data.coaches) {
                data.coaches.forEach(coach => {
                    if (coach.fitness && oldFitnessScale !== newFitnessScale) {
                        const oldValue = parseInt(coach.fitness, 10);
                        if (!isNaN(oldValue) && oldValue >= 1 && oldValue <= oldFitnessScale) {
                            coach.fitness = String(convertScale(oldValue, oldFitnessScale, newFitnessScale));
                            convertedCount++;
                        }
                    }
                    if (coach.skills && oldSkillsScale !== newSkillsScale) {
                        const oldValue = parseInt(coach.skills, 10);
                        if (!isNaN(oldValue) && oldValue >= 1 && oldValue <= oldSkillsScale) {
                            coach.skills = String(convertBikeSkillsScale(oldValue, oldSkillsScale, newSkillsScale));
                            convertedCount++;
                        }
                    }
                    if (coach.climbing && oldClimbingScale !== newClimbingScale) {
                        coach.climbing = String(convertClimbingScale(parseInt(coach.climbing || '3', 10), oldClimbingScale, newClimbingScale));
                        convertedCount++;
                    }
                });
            }
            
            if (convertedCount > 0) {
                alert(`Converted ${convertedCount} rating(s) to the new scale(s).`);
            }
        }
        
        // Update scale settings UI when changed
        // Update scale inputs from data object (called after data loads)
        // Only sets values if data.seasonSettings exists - doesn't initialize defaults
        // Defaults are only set when we confirm Supabase has no saved data
        function updateScaleInputsFromData() {
            const scaleInput = document.getElementById('unified-scale');
            const scaleDisplay = document.getElementById('unified-scale-display');
            const paceScaleOrderInput = document.getElementById('pace-scale-order');

            if (!scaleInput) return;

            if (data.seasonSettings) {
                const saved = data.seasonSettings.fitnessScale;
                const savedPaceScaleOrder = normalizePaceScaleOrder(data.seasonSettings.paceScaleOrder);

                if (saved !== undefined && saved !== null) {
                    scaleInput.value = saved;
                    scaleInput.setAttribute('value', saved);
                    if (scaleDisplay) scaleDisplay.textContent = saved;
                }
                if (paceScaleOrderInput) {
                    paceScaleOrderInput.value = savedPaceScaleOrder;
                }
                updateInputMaxAttributes();
            }
        }
        
        function updateScaleSettings() {
            const scaleInput = document.getElementById('unified-scale');
            const scaleDisplay = document.getElementById('unified-scale-display');
            const paceScaleOrderInput = document.getElementById('pace-scale-order');

            if (!scaleInput) return;
            if (scaleDisplay) scaleDisplay.textContent = scaleInput.value;

            updateInputMaxAttributes();
            updateBikeSkillsDescriptions();
            updateClimbingDescriptions();

            const scaleVal = parseInt(scaleInput.value, 10);
            const nextPaceScaleOrder = normalizePaceScaleOrder(paceScaleOrderInput?.value);

            if (Number.isFinite(scaleVal) && scaleVal >= 2 && scaleVal <= 9) {
                if (!data.seasonSettings) data.seasonSettings = buildDefaultSeasonSettings();

                const oldScale = data.seasonSettings.fitnessScale || 6;
                const oldPaceScaleOrder = normalizePaceScaleOrder(data.seasonSettings.paceScaleOrder, nextPaceScaleOrder);

                data.seasonSettings.fitnessScale  = scaleVal;
                data.seasonSettings.skillsScale   = scaleVal;
                data.seasonSettings.climbingScale  = scaleVal;
                data.seasonSettings.paceScaleOrder = nextPaceScaleOrder;

                if (oldPaceScaleOrder !== nextPaceScaleOrder) {
                    const convertedCount = convertAllPaceRatingsForOrderChange(oldPaceScaleOrder, nextPaceScaleOrder, scaleVal);
                    if (convertedCount > 0) {
                        alert(`Reassigned ${convertedCount} pace rating(s) due to scale direction change.`);
                    }
                }

                saveData();
            }
        }

        function updateInputMaxAttributes() {
            const scale = getUnifiedScale();

            // Coach & rider edit-modal inputs
            ['edit-coach-fitness','edit-coach-skills','edit-coach-climbing',
             'edit-rider-fitness','edit-rider-skills','edit-rider-climbing'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.max = scale;
            });

            // Route fitness/skills range inputs
            const routeFitnessMin = document.getElementById('route-fitness-min');
            const routeFitnessMax = document.getElementById('route-fitness-max');
            const routeSkillsMin  = document.getElementById('route-skills-min');
            const routeSkillsMax  = document.getElementById('route-skills-max');

            function clampRange(minEl, maxEl) {
                if (minEl) {
                    minEl.max = scale - 1;
                    let v = Math.round(parseFloat(minEl.value) || 1);
                    minEl.value = Math.max(1, Math.min(v, scale - 1));
                }
                if (maxEl) {
                    maxEl.max = scale;
                    const curMin = minEl ? Math.round(parseFloat(minEl.value) || 1) : 1;
                    maxEl.min = Math.max(2, curMin + 1);
                    let v = Math.round(parseFloat(maxEl.value) || scale);
                    maxEl.value = Math.max(maxEl.min, Math.min(v, scale));
                }
            }
            clampRange(routeFitnessMin, routeFitnessMax);
            clampRange(routeSkillsMin, routeSkillsMax);

            if (routeFitnessMin || routeFitnessMax) updateFitnessRange();
            if (routeSkillsMin  || routeSkillsMax)  updateSkillsRange();
        }
        
        function updateRouteSliderLabels() {
            const scale = getUnifiedScale();
            ['route-fitness-labels', 'route-skills-labels'].forEach(id => {
                const container = document.getElementById(id);
                if (!container) return;
                container.innerHTML = '';
                for (let i = 1; i <= scale; i++) {
                    const span = document.createElement('span');
                    span.textContent = i;
                    container.appendChild(span);
                }
            });
        }

        async function syncScaleSettings() {
            const scaleInput = document.getElementById('unified-scale');
            const paceScaleOrderInput = document.getElementById('pace-scale-order');

            if (!scaleInput) {
                alert('Scale input not found. Please refresh the page.');
                return;
            }

            const newScale = parseInt(scaleInput.value, 10);
            if (!Number.isFinite(newScale) || newScale < 2 || newScale > 9) {
                alert('Skill rating scale must be between 2 and 9.');
                return;
            }

            try {
                if (!data.seasonSettings) data.seasonSettings = buildDefaultSeasonSettings();

                const oldFitness  = data.seasonSettings.fitnessScale  || 6;
                const oldSkills   = data.seasonSettings.skillsScale   || 6;
                const oldClimbing = data.seasonSettings.climbingScale  || 6;

                data.seasonSettings.fitnessScale  = newScale;
                data.seasonSettings.skillsScale   = newScale;
                data.seasonSettings.climbingScale  = newScale;
                if (paceScaleOrderInput) {
                    data.seasonSettings.paceScaleOrder = normalizePaceScaleOrder(paceScaleOrderInput.value);
                }

                if (newScale !== oldFitness || newScale !== oldSkills || newScale !== oldClimbing) {
                    convertAllRatingsToNewScales(oldFitness, newScale, oldSkills, newScale, oldClimbing, newScale);
                }

                const scaleDisplay = document.getElementById('unified-scale-display');
                if (scaleDisplay) scaleDisplay.textContent = newScale;

                updateInputMaxAttributes();
                saveData();

                if (typeof updateSeasonSettings === 'function') {
                    try {
                        await updateSeasonSettings({
                            id: 'current',
                            start_date: data.seasonSettings.startDate || null,
                            end_date: data.seasonSettings.endDate || null,
                            practices: data.seasonSettings.practices || [],
                            fitnessScale: newScale,
                            skillsScale: newScale,
                            climbingScale: newScale,
                            paceScaleOrder: normalizePaceScaleOrder(data.seasonSettings.paceScaleOrder),
                            groupPaceOrder: normalizeGroupPaceOrder(data.seasonSettings.groupPaceOrder)
                        });
                    } catch (error) {
                        console.warn('Could not sync scale settings to Supabase:', error);
                    }
                }

                alert(`Scale updated to 1–${newScale} for all skills.\n\nAll ratings have been converted to the new scale.`);

            } catch (error) {
                console.error('Error syncing scale settings:', error);
                alert('Error updating scale settings. Please try again.');
            }
        }

        // One-time migration: if the three per-skill scales differ, unify them
        // to fitnessScale and proportionally convert all existing ratings.
        function migrateToUnifiedScale() {
            if (!data.seasonSettings) return;
            const target  = data.seasonSettings.fitnessScale  || 6;
            const oldSk   = data.seasonSettings.skillsScale   || 6;
            const oldCl   = data.seasonSettings.climbingScale  || 6;
            if (oldSk === target && oldCl === target) return;

            console.log(`Migrating to unified scale ${target} (skills was ${oldSk}, climbing was ${oldCl})`);
            convertAllRatingsToNewScales(target, target, oldSk, target, oldCl, target);
            data.seasonSettings.skillsScale  = target;
            data.seasonSettings.climbingScale = target;
        }
