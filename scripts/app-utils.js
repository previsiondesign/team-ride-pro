        // app-utils.js — Utility functions shared across modules

        function buildPaceControlsHtml(entityType, entityId, skillType, value, scale) {
            const paceOrder = getPaceScaleOrder();
            const isFastestFirst = paceOrder === 'fastest_to_slowest';

            let adjustFn;
            if (skillType === 'pace') {
                adjustFn = entityType === 'rider' ? 'adjustRiderPace' : 'adjustCoachPace';
            } else if (skillType === 'climbing') {
                adjustFn = entityType === 'rider' ? 'adjustRiderClimbing' : 'adjustCoachClimbing';
            } else {
                adjustFn = entityType === 'rider' ? 'adjustRiderSkills' : 'adjustCoachSkills';
            }

            // All three ratings use the same scale direction (paceScaleOrder setting).
            // fastest_to_slowest: 1 = best/fastest, so + (improve) = decrease number → + on left
            // slowest_to_fastest: 1 = worst/slowest, so + (improve) = increase number → + on right
            const plusOnLeft = isFastestFirst;

            const plusDelta = plusOnLeft ? -1 : 1;
            const minusDelta = plusOnLeft ? 1 : -1;

            const canPlus = (value + plusDelta >= 1) && (value + plusDelta <= scale);
            const canMinus = (value + minusDelta >= 1) && (value + minusDelta <= scale);

            const leftSymbol = plusOnLeft ? '+' : '−';
            const rightSymbol = plusOnLeft ? '−' : '+';
            const leftDelta = plusOnLeft ? plusDelta : minusDelta;
            const rightDelta = plusOnLeft ? minusDelta : plusDelta;
            const canLeft = plusOnLeft ? canPlus : canMinus;
            const canRight = plusOnLeft ? canMinus : canPlus;

            const leftClass = canLeft ? 'pace-arrow' : 'pace-arrow pace-arrow-disabled';
            const rightClass = canRight ? 'pace-arrow' : 'pace-arrow pace-arrow-disabled';

            const leftClick = canLeft ? ` onclick="${adjustFn}(${entityId}, ${leftDelta})"` : '';
            const rightClick = canRight ? ` onclick="${adjustFn}(${entityId}, ${rightDelta})"` : '';

            return `<div class="pace-controls">
                <span class="${leftClass}"${leftClick}>${leftSymbol}</span>
                <span class="pace-value">${value}</span>
                <span class="${rightClass}"${rightClick}>${rightSymbol}</span>
            </div>`;
        }

        function refreshPaceControlsInCell(cell, entityType, entityId, skillType, newValue, scale) {
            if (!cell) return;
            cell.innerHTML = buildPaceControlsHtml(entityType, entityId, skillType, newValue, scale);
        }

        // Returns nickname if set, otherwise full name
        function getDisplayName(person) {
            if (!person) return '';
            return person.nickname ? person.nickname : (person.name || '');
        }

        function escapeHtml(value) {
            if (value === undefined || value === null) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatShortName(fullName) {
            if (!fullName) return '';
            const parts = fullName.trim().split(/\s+/);
            if (parts.length <= 1) return fullName;
            const last = parts.pop();
            return parts.join(' ') + ' ' + last.charAt(0).toUpperCase() + '.';
        }

        let _truncateScheduled = false;
        let _truncateCanvas = null;
        function truncateOverflowingNames() {
            if (_truncateScheduled) return;
            _truncateScheduled = true;
            requestAnimationFrame(() => {
                _truncateScheduled = false;
                const elements = document.querySelectorAll('[data-short-name]');
                if (!elements.length) return;
                if (!_truncateCanvas) _truncateCanvas = document.createElement('canvas');
                const ctx = _truncateCanvas.getContext('2d');

                // Phase 1: batch-read all measurements (avoids layout thrashing)
                const items = [];
                elements.forEach(el => {
                    const full = el.getAttribute('data-full-name') || '';
                    const short = el.getAttribute('data-short-name') || '';
                    if (!short || short === full) {
                        items.push({ el, full, useShort: false });
                        return;
                    }
                    const style = getComputedStyle(el);
                    ctx.font = style.font;
                    const fullTextWidth = ctx.measureText(full).width;
                    const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
                    const available = el.clientWidth - pad;
                    items.push({ el, full, short, useShort: available > 0 && fullTextWidth > available });
                });

                // Phase 2: batch-write all text changes
                items.forEach(({ el, full, short, useShort }) => {
                    el.textContent = useShort ? short : full;
                });
            });
        }

        let _truncateResizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(_truncateResizeTimer);
            _truncateResizeTimer = setTimeout(truncateOverflowingNames, 150);
        });

        let _truncateObserver = null;
        function setupTruncationObserver() {
            if (_truncateObserver) return;
            if (typeof ResizeObserver === 'undefined') return;
            _truncateObserver = new ResizeObserver(() => {
                truncateOverflowingNames();
            });
            const container = document.querySelector('.container');
            if (container) _truncateObserver.observe(container);
        }

        // Convert ASCII text to Unicode Mathematical Bold characters for use in <option> elements
        function toBoldUnicode(str) {
            return str.replace(/[A-Za-z0-9]/g, ch => {
                const code = ch.charCodeAt(0);
                if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + (code - 65));   // A-Z
                if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + (code - 97));   // a-z
                if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7CE + (code - 48));     // 0-9
                return ch;
            });
        }

        function mapAbilityToFitness(ability) {
            const numeric = parseInt(ability, 10);
            if (Number.isFinite(numeric)) {
                return Math.min(10, Math.max(1, numeric * 2));
            }
            return 5;
        }

        function convertRideLevelToFitness(level) {
            if (!level) return 5;
            const normalized = String(level).toLowerCase();
            const mapping = {
                'barely hanging on': 2,
                'ok for roam or sweep': 4,
                'ok to lead lower/middle groups': 7,
                'these kids are slow': 9
            };
            return mapping[normalized] || 5;
        }

        // Depends on GRADE_MAP from app-state.js (load app-state.js before app-utils.js)
        function normalizeGradeValue(value) {
            if (!value) return '9th';
            const key = value.toString().trim().toLowerCase();
            return GRADE_MAP[key] || value.toString();
        }

        function formatGradeLabel(grade) {
            return normalizeGradeValue(grade);
        }

        function handleFileChange(inputId, labelId) {
            const input = document.getElementById(inputId);
            const label = document.getElementById(labelId);
            if (!label) return;
            const defaultText = label.dataset.default || 'No file selected';

            if (input && input.files && input.files.length > 0) {
                label.textContent = input.files[0].name;
            } else {
                label.textContent = defaultText;
            }
        }

        function readPhotoFile(inputId) {
            return new Promise(resolve => {
                const input = document.getElementById(inputId);
                if (!input || !input.files || input.files.length === 0) {
                    resolve('');
                    return;
                }

                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }

        // Show visible error alert when database saves fail
        function showSaveError(title, message, error) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            const fullMessage = `${message}\n\nError details: ${errorMsg}\n\nYour changes were NOT saved. Please try again or contact support if the problem persists.`;
            alert(`⚠️ ${title}\n\n${fullMessage}`);
            console.error(`Save error - ${title}:`, error);
        }

        function readPhotoFileFromInput(input) {
            return new Promise(resolve => {
                if (!input || !input.files || input.files.length === 0) {
                    resolve('');
                    return;
                }

                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }

        function formatPhoneNumber(input) {
            let value = input.value.replace(/\D/g, ''); // Remove all non-digits
            
            if (value.length > 10) {
                value = value.substring(0, 10); // Limit to 10 digits
            }
            
            let formattedValue = '';
            if (value.length > 0) {
                formattedValue = '(' + value.substring(0, 3);
            }
            if (value.length > 3) {
                formattedValue += ') ' + value.substring(3, 6);
            }
            if (value.length > 6) {
                formattedValue += '-' + value.substring(6, 10);
            }
            
            input.value = formattedValue;
        }

        function formatPhoneForDisplay(phone) {
            if (!phone) return '';
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
            }
            return phone;
        }

        function formatPhoneForTel(phone) {
            if (!phone) return '';
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                return `tel:+1${digits}`;
            } else if (digits.length === 11 && digits.startsWith('1')) {
                return `tel:+${digits}`;
            } else if (digits.length > 0) {
                return `tel:+${digits}`;
            }
            return '';
        }

        function updateRacingGroupOptions() {
            const genderSelect = document.getElementById('edit-rider-gender');
            const racingGroupSelect = document.getElementById('edit-rider-racing-group');
            
            if (!genderSelect || !racingGroupSelect) return;
            
            const gender = genderSelect.value;
            const currentValue = racingGroupSelect.value; // Save current selection
            
            // Clear existing options
            racingGroupSelect.innerHTML = '';
            racingGroupSelect.disabled = false;
            
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select Racing Group';
            racingGroupSelect.appendChild(placeholder);
            
            // Set options based on gender (or all if gender unknown)
            const options = gender === 'M'
                ? ['Varsity Boys', 'JV1 Boys', 'JV2 Boys', 'Freshman Boys']
                : gender === 'F'
                    ? ['Varsity Girls', 'JV1 Girls', 'JV2 Girls', 'Freshman Girls']
                    : [
                        'Varsity Boys', 'Varsity Girls',
                        'JV1 Boys', 'JV1 Girls',
                        'JV2 Boys', 'JV2 Girls',
                        'Freshman Boys', 'Freshman Girls'
                    ];
            
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                racingGroupSelect.appendChild(opt);
            });
            
            // Restore previous selection only if it's still valid for the new gender
            if (currentValue && options.includes(currentValue)) {
                racingGroupSelect.value = currentValue;
            } else {
                // Clear selection if it's not valid for the new gender
                racingGroupSelect.value = '';
            }
        }

        function normalizeGenderValue(raw) {
            const value = (raw || '').toString().trim().toLowerCase();
            if (!value) return '';
            if (value === 'm' || value === 'male' || value === 'man' || value === 'men' || value === 'boy' || value === 'boys') return 'M';
            if (value === 'f' || value === 'female' || value === 'woman' || value === 'women' || value === 'girl' || value === 'girls') return 'F';
            if (value === 'nb' || value === 'nonbinary' || value === 'non-binary' || value === 'non binary') return 'NB';
            return value.toUpperCase();
        }

        function hasMedicalCondition(value) {
            const raw = (value || '').toString().trim();
            if (!raw) return false;
            const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!normalized) return false;
            const emptyValues = new Set(['no', 'none', 'na', 'n/a', 'nil', 'false', '0']);
            return !emptyValues.has(normalized);
        }

        function getMedicalIconHtml(noteValue) {
            if (!hasMedicalCondition(noteValue)) return '';
            const title = escapeHtml(noteValue);
            return `
                <span title="${title}" aria-label="Medical or allergy info" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: 6px; flex-shrink: 0;">
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#1976D2" d="M12 2l7 3v6c0 5.25-3.5 9.92-7 11-3.5-1.08-7-5.75-7-11V5l7-3z"/>
                        <path fill="#fff" d="M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4z"/>
                    </svg>
                </span>
            `;
        }

        function parseISODate(dateStr) {
            if (!dateStr) return null;
            try {
                const date = new Date(dateStr + 'T00:00:00');
                if (isNaN(date.getTime())) return null;
                return date;
            } catch (e) {
                return null;
            }
        }

        // ============ SCHEDULED ABSENCE HELPERS ============

        function formatAbsenceReason(reason) {
            switch (reason) {
                case 'injured': return 'Injured';
                case 'vacation': return 'Vacation/Travel';
                case 'suspension': return 'Behavior/Suspension';
                case 'other': return 'Other';
                default: return reason || 'Other';
            }
        }

        function getActiveAbsences(personType, personId, dateStr) {
            if (!data.scheduledAbsences || !data.scheduledAbsences.length) return [];
            const pid = typeof personId === 'string' ? parseInt(personId, 10) : personId;
            const checkDate = dateStr || new Date().toISOString().split('T')[0];
            return data.scheduledAbsences.filter(a => {
                const aId = typeof a.personId === 'string' ? parseInt(a.personId, 10) : a.personId;
                return a.personType === personType &&
                    aId === pid &&
                    a.startDate <= checkDate &&
                    a.endDate >= checkDate;
            });
        }

        function isScheduledAbsent(personType, personId, dateStr) {
            const absences = getActiveAbsences(personType, personId, dateStr);
            if (absences.length === 0) return { absent: false, reason: '' };
            return {
                absent: true,
                reason: formatAbsenceReason(absences[0].reason),
                absence: absences[0]
            };
        }

        function getAbsencesForPerson(personType, personId) {
            if (!data.scheduledAbsences || !data.scheduledAbsences.length) return [];
            const pid = typeof personId === 'string' ? parseInt(personId, 10) : personId;
            return data.scheduledAbsences.filter(a => {
                const aId = typeof a.personId === 'string' ? parseInt(a.personId, 10) : a.personId;
                return a.personType === personType && aId === pid;
            });
        }

        // Animate a card being removed from a group:
        //   Phase 1 (0.3s): checkbox visually unchecked, brief pause
        //   Phase 2 (0.5s): card fades out
        //   Phase 3 (0.5s): gap collapses as siblings slide to fill
        // Then calls onComplete callback.
        function animateCardRemoval(cardEl, onComplete) {
            if (!cardEl) { if (onComplete) onComplete(); return; }

            // Lock the card to its current size immediately so there's no layout
            // shift when transitioning from phase 2 to phase 3.
            const computed = getComputedStyle(cardEl);
            const fullHeight = cardEl.offsetHeight;
            const mt = parseFloat(computed.marginTop) || 0;
            const mb = parseFloat(computed.marginBottom) || 0;
            const pt = parseFloat(computed.paddingTop) || 0;
            const pb = parseFloat(computed.paddingBottom) || 0;

            cardEl.style.height = fullHeight + 'px';
            cardEl.style.marginTop = mt + 'px';
            cardEl.style.marginBottom = mb + 'px';
            cardEl.style.paddingTop = pt + 'px';
            cardEl.style.paddingBottom = pb + 'px';
            cardEl.style.overflow = 'hidden';
            cardEl.style.boxSizing = 'border-box';

            // Phase 1: pause 0.3s so user sees the unchecked state
            setTimeout(() => {
                // Phase 2: fade out over 0.5s
                cardEl.style.transition = 'opacity 0.5s ease';
                cardEl.style.opacity = '0';

                setTimeout(() => {
                    // Phase 3: collapse height over 0.8s (element already locked at explicit size)
                    cardEl.style.transition = 'height 0.8s ease, margin-top 0.8s ease, margin-bottom 0.8s ease, padding-top 0.8s ease, padding-bottom 0.8s ease';
                    cardEl.style.height = '0px';
                    cardEl.style.marginTop = '0px';
                    cardEl.style.marginBottom = '0px';
                    cardEl.style.paddingTop = '0px';
                    cardEl.style.paddingBottom = '0px';

                    setTimeout(() => {
                        if (onComplete) onComplete();
                    }, 800);
                }, 500);
            }, 300);
        }

        /**
         * Ensures a positioned menu/popup element is fully visible within the viewport.
         * Call after appending to the DOM and setting initial position.
         * @param {HTMLElement} menuEl - The menu element (must already have position: fixed/absolute and style.top/left set)
         * @param {DOMRect} [anchorRect] - The trigger element's bounding rect; used to flip above anchor when overflowing bottom
         * @param {number} [gap=4] - Spacing between menu and anchor edge
         */
        function ensureMenuInViewport(menuEl, anchorRect, gap) {
            if (!menuEl) return;
            gap = gap || 4;
            const mRect = menuEl.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            if (mRect.right > vw) {
                menuEl.style.left = Math.max(8, vw - mRect.width - 8) + 'px';
            }
            if (mRect.left < 0) {
                menuEl.style.left = '8px';
            }
            if (mRect.bottom > vh) {
                if (anchorRect) {
                    menuEl.style.top = (anchorRect.top - mRect.height - gap) + 'px';
                } else {
                    menuEl.style.top = Math.max(8, vh - mRect.height - 8) + 'px';
                }
            }
            const finalTop = menuEl.getBoundingClientRect().top;
            if (finalTop < 0) {
                menuEl.style.top = '8px';
            }
        }
