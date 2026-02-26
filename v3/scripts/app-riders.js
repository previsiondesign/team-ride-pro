        // app-riders.js — Rider CRUD, edit modal, roster rendering, column reorder/resize, sorting/grouping, archive
        async function addRider() {
            if (!canEditRiders()) {
                alert('You do not have permission to add riders');
                return;
            }

            const name = document.getElementById('rider-name').value.trim();
            const phone = document.getElementById('rider-phone').value.trim();
            const grade = document.getElementById('rider-grade').value;
            const racingGroup = document.getElementById('rider-racing-group').value;
            const gender = document.getElementById('rider-gender').value || '';
            const fitnessInput = document.getElementById('rider-fitness').value;
            const notes = document.getElementById('rider-notes').value.trim();
            
            if (!name) {
                alert('Please enter a team rider name');
                return;
            }

            const fitnessValue = Math.max(1, Math.min(10, parseInt(fitnessInput || '5', 10)));

            const photo = await readPhotoFile('rider-photo');
            
            const riderData = {
                name,
                photo,
                phone,
                grade: normalizeGradeValue(grade),
                racing_group: racingGroup,
                gender: gender.toUpperCase(),
                fitness: String(fitnessValue),
                notes
            };

            const added = await saveRiderToDB(riderData);
            if (added && added.id) {
                addNewRiderToAttendanceLists(added.id);
                if (data.currentRide) {
                    const r = data.rides.find(x => x.id === data.currentRide);
                    if (r) renderAssignments(r);
                }
                if (sidebarsVisible) renderSidebars();
            }
            resetRiderForm();
            renderRiders();
        }

        function resetRiderForm() {
            document.getElementById('rider-photo').value = '';
            document.getElementById('rider-name').value = '';
            document.getElementById('rider-phone').value = '';
            document.getElementById('rider-grade').value = '9th';
            document.getElementById('rider-racing-group').value = 'Freshman';
            document.getElementById('rider-gender').value = '';
            document.getElementById('rider-fitness').value = '5';
            document.getElementById('rider-notes').value = '';
            handleFileChange('rider-photo', 'rider-photo-name');
        }

        /** Add a newly created rider to availableRiders (attendance) for all non-deleted rides. */
        function addNewRiderToAttendanceLists(newRiderId) {
            if (!newRiderId || !Array.isArray(data.rides)) return;
            data.rides.forEach(ride => {
                if (ride.deleted) return;
                if (!Array.isArray(ride.availableRiders)) ride.availableRiders = [];
                if (ride.availableRiders.includes(newRiderId)) return;
                ride.availableRiders.push(newRiderId);
                saveRideToDB(ride);
            });
        }

        async function deleteRider(id) {
            if (!canEditRiders()) {
                alert('You do not have permission to delete riders');
                return;
            }

            if (confirm('Delete this rider?')) {
                // Remove from riders array
                data.riders = data.riders.filter(r => r.id !== id);
                
                // Also update any rides that reference this rider
                for (const ride of data.rides) {
                    if (ride.availableRiders && ride.availableRiders.includes(id)) {
                        ride.availableRiders = ride.availableRiders.filter(riderId => riderId !== id);
                        // Update groups if needed
                        if (ride.groups) {
                            ride.groups.forEach(group => {
                                if (group.riders) {
                                    group.riders = group.riders.filter(riderId => riderId !== id);
                                }
                            });
                        }
                        saveRideToDB(ride);
                    }
                }
                
                saveData();
                renderRiders();
                if (data.currentRide) {
                    renderRides();
                }
            }
        }

        function openEditRiderModal(id) {
            const rider = data.riders.find(r => r.id === id);
            if (!rider) return;

            currentEditingRiderId = id;
            const modal = document.getElementById('edit-rider-modal');
            if (!modal) return;

            const titleEl = document.getElementById('edit-rider-modal-title');
            if (titleEl) titleEl.textContent = 'Edit Team Rider';
            
            const deleteBtn = document.getElementById('delete-rider-btn');
            if (deleteBtn) deleteBtn.style.display = 'block';

            // Show archive/restore button
            const archiveRiderBtn = document.getElementById('archive-rider-btn');
            if (archiveRiderBtn) {
                archiveRiderBtn.style.display = 'inline-block';
                archiveRiderBtn.textContent = rider.archived ? 'Restore' : 'Archive';
                archiveRiderBtn.style.background = rider.archived ? '#2a7d2a' : '#888';
            }

            // Populate name fields (prefer explicit first/last if present, otherwise split full name)
            const riderFirstNameInput = document.getElementById('edit-rider-first-name');
            const riderLastNameInput = document.getElementById('edit-rider-last-name');
            const fullName = rider.name || '';
            let firstName = rider.firstName || '';
            let lastName = rider.lastName || '';
            if (!firstName && !lastName && fullName) {
                const parts = fullName.trim().split(' ');
                if (parts.length > 1) {
                    lastName = parts.pop();
                    firstName = parts.join(' ');
                } else {
                    firstName = fullName;
                }
            }
            if (riderFirstNameInput) riderFirstNameInput.value = firstName || '';
            if (riderLastNameInput) riderLastNameInput.value = lastName || '';
            
            // Populate nickname
            const nicknameInput = document.getElementById('edit-rider-nickname');
            if (nicknameInput) nicknameInput.value = rider.nickname || '';
            const riderNickModeFirst = document.getElementById('edit-rider-nickname-mode-first');
            const riderNickModeWhole = document.getElementById('edit-rider-nickname-mode-whole');
            if (riderNickModeFirst) riderNickModeFirst.checked = rider.nicknameMode === 'firstName';
            if (riderNickModeWhole) riderNickModeWhole.checked = rider.nicknameMode === 'wholeName' || (!rider.nicknameMode && !!rider.nickname);
            
            // Populate all CSV fields
            document.getElementById('edit-rider-email').value = rider.email || '';
            
            // Format phone number
            const phone = (rider.phone || '').replace(/\D/g, '');
            if (phone.length === 10) {
                const formattedPhone = `(${phone.substring(0, 3)}) ${phone.substring(3, 6)}-${phone.substring(6, 10)}`;
                document.getElementById('edit-rider-phone').value = formattedPhone;
            } else {
                document.getElementById('edit-rider-phone').value = rider.phone || '';
            }
            
            document.getElementById('edit-rider-address').value = rider.address || '';
            
            const genderValue = (rider.gender || '').toUpperCase();
            document.getElementById('edit-rider-gender').value = (genderValue === 'M' || genderValue === 'F' || genderValue === 'NB') ? genderValue : '';
            document.getElementById('edit-rider-grade').value = rider.grade || '9th';
            document.getElementById('edit-rider-birthday').value = rider.birthday || '';
            
            document.getElementById('edit-rider-primary-parent-name').value = rider.primaryParentName || '';
            const primaryParentPhone = (rider.primaryParentPhone || '').replace(/\D/g, '');
            if (primaryParentPhone.length === 10) {
                document.getElementById('edit-rider-primary-parent-phone').value = `(${primaryParentPhone.substring(0, 3)}) ${primaryParentPhone.substring(3, 6)}-${primaryParentPhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-rider-primary-parent-phone').value = rider.primaryParentPhone || '';
            }
            document.getElementById('edit-rider-primary-parent-email').value = rider.primaryParentEmail || '';
            document.getElementById('edit-rider-primary-parent-address').value = rider.primaryParentAddress || '';
            
            document.getElementById('edit-rider-second-parent-name').value = rider.secondParentName || '';
            const secondParentPhone = (rider.secondParentPhone || '').replace(/\D/g, '');
            if (secondParentPhone.length === 10) {
                document.getElementById('edit-rider-second-parent-phone').value = `(${secondParentPhone.substring(0, 3)}) ${secondParentPhone.substring(3, 6)}-${secondParentPhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-rider-second-parent-phone').value = rider.secondParentPhone || '';
            }
            document.getElementById('edit-rider-second-parent-email').value = rider.secondParentEmail || '';
            
            document.getElementById('edit-rider-alternate-contact-name').value = rider.alternateContactName || '';
            document.getElementById('edit-rider-alternate-contact-relationship').value = rider.alternateContactRelationship || '';
            const alternateContactPhone = (rider.alternateContactPhone || '').replace(/\D/g, '');
            if (alternateContactPhone.length === 10) {
                document.getElementById('edit-rider-alternate-contact-phone').value = `(${alternateContactPhone.substring(0, 3)}) ${alternateContactPhone.substring(3, 6)}-${alternateContactPhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-rider-alternate-contact-phone').value = rider.alternateContactPhone || '';
            }
            
            document.getElementById('edit-rider-primary-physician').value = rider.primaryPhysician || '';
            const primaryPhysicianPhone = (rider.primaryPhysicianPhone || '').replace(/\D/g, '');
            if (primaryPhysicianPhone.length === 10) {
                document.getElementById('edit-rider-primary-physician-phone').value = `(${primaryPhysicianPhone.substring(0, 3)}) ${primaryPhysicianPhone.substring(3, 6)}-${primaryPhysicianPhone.substring(6, 10)}`;
            } else {
                document.getElementById('edit-rider-primary-physician-phone').value = rider.primaryPhysicianPhone || '';
            }
            document.getElementById('edit-rider-medical-insurance-company').value = rider.medicalInsuranceCompany || '';
            document.getElementById('edit-rider-medical-insurance-account').value = rider.medicalInsuranceAccountNumber || '';
            document.getElementById('edit-rider-allergies').value = rider.allergiesOrMedicalNeeds || '';
            
            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();
            document.getElementById('edit-rider-fitness').value = Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10)));
            document.getElementById('edit-rider-skills').value = Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10)));
            document.getElementById('edit-rider-notes').value = rider.notes || '';

            // Update racing group options based on gender, then set value
            updateRacingGroupOptions();
            if (rider.racingGroup) {
                document.getElementById('edit-rider-racing-group').value = rider.racingGroup;
            }

            // Update photo preview - use default if no photo uploaded
            const photoPreview = document.getElementById('edit-rider-photo-preview');
            const photoPlaceholder = document.getElementById('edit-rider-photo-placeholder');
            if (rider.photo && !rider.photo.includes('_default.png')) {
                // Use uploaded photo (not a default)
                photoPreview.src = rider.photo;
                photoPreview.style.display = 'block';
                photoPlaceholder.style.display = 'none';
            } else {
                // Use default based on gender
                const gender = (rider.gender || '').toUpperCase();
                let defaultPhoto = '';
                if (gender === 'M') {
                    defaultPhoto = 'assets/male_default.png';
                } else if (gender === 'F') {
                    defaultPhoto = 'assets/female_default.png';
                } else if (gender === 'NB') {
                    defaultPhoto = 'assets/nonbinary_default.png';
                } else {
                    defaultPhoto = 'assets/nonbinary_default.png';
                }
                photoPreview.src = defaultPhoto;
                photoPreview.style.display = 'block';
                photoPlaceholder.style.display = 'none';
            }

            // Render scheduled absences
            renderRiderAbsencesList(id);
            cancelRiderAbsenceForm();

            // Hide edit modal rows for fields disabled in CSV mapping
            const riderEnabledFields = data.seasonSettings?.csvFieldMappings?.riders?.enabledFields || {};
            const riderFieldToInputId = {
                email: 'edit-rider-email',
                phone: 'edit-rider-phone',
                address: 'edit-rider-address',
                gender: 'edit-rider-gender',
                grade: 'edit-rider-grade',
                birthday: 'edit-rider-birthday',
                primaryParentName: 'edit-rider-primary-parent-name',
                primaryParentPhone: 'edit-rider-primary-parent-phone',
                primaryParentEmail: 'edit-rider-primary-parent-email',
                primaryParentAddress: 'edit-rider-primary-parent-address',
                secondParentName: 'edit-rider-second-parent-name',
                secondParentPhone: 'edit-rider-second-parent-phone',
                secondParentEmail: 'edit-rider-second-parent-email',
                alternateContactName: 'edit-rider-alternate-contact-name',
                alternateContactPhone: 'edit-rider-alternate-contact-phone',
                alternateContactRelationship: 'edit-rider-alternate-contact-relationship',
                primaryPhysician: 'edit-rider-primary-physician',
                primaryPhysicianPhone: 'edit-rider-primary-physician-phone',
                medicalInsuranceCompany: 'edit-rider-medical-insurance-company',
                medicalInsuranceAccountNumber: 'edit-rider-medical-insurance-account',
                allergiesOrMedicalNeeds: 'edit-rider-allergies',
                racingGroup: 'edit-rider-racing-group'
            };
            Object.keys(riderFieldToInputId).forEach(fieldKey => {
                const inputEl = document.getElementById(riderFieldToInputId[fieldKey]);
                if (inputEl) {
                    const row = inputEl.closest('tr');
                    if (row) row.style.display = riderEnabledFields[fieldKey] === false ? 'none' : '';
                }
            });

            // Dynamically inject additional/custom field rows into the edit table
            const riderAdditionalFields = data.seasonSettings?.csvFieldMappings?.riders?.additionalFields || {};
            const riderCustomNames = data.seasonSettings?.csvFieldMappings?.riders?.customFieldNames || {};

            // Remove any previously injected additional field rows
            modal.querySelectorAll('[data-additional-field]').forEach(row => row.remove());

            // Find the Notes row to insert before it
            const notesInput = document.getElementById('edit-rider-notes');
            const notesRow = notesInput ? notesInput.closest('tr') : null;
            const editTable = modal.querySelector('.modal-edit-table');

            if (editTable) {
                Object.keys(riderAdditionalFields).forEach(fieldName => {
                    const displayName = riderCustomNames[fieldName] || fieldName;
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-additional-field', fieldName);
                    const inputId = `edit-rider-additional-${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    tr.innerHTML = `<td class="modal-edit-label">${escapeHtml(displayName)}</td><td><input type="text" id="${inputId}" class="modal-field-input" value="${escapeHtml(rider[fieldName] || '')}"></td>`;
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

        function openAddRiderModal() {
            currentEditingRiderId = null;
            const modal = document.getElementById('edit-rider-modal');
            if (!modal) return;

            const titleEl = document.getElementById('edit-rider-modal-title');
            if (titleEl) titleEl.textContent = 'Add Team Rider';
            
            const deleteBtn = document.getElementById('delete-rider-btn');
            if (deleteBtn) deleteBtn.style.display = 'none';

            const riderFirstNameInput = document.getElementById('edit-rider-first-name');
            const riderLastNameInput = document.getElementById('edit-rider-last-name');
            if (riderFirstNameInput) riderFirstNameInput.value = '';
            if (riderLastNameInput) riderLastNameInput.value = '';
            document.getElementById('edit-rider-phone').value = '';
            document.getElementById('edit-rider-gender').value = '';
            document.getElementById('edit-rider-grade').value = '9th';
            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();
            document.getElementById('edit-rider-fitness').value = Math.ceil(fitnessScale / 2);
            document.getElementById('edit-rider-skills').value = Math.ceil(skillsScale / 2);
            document.getElementById('edit-rider-notes').value = '';

            // Reset racing group options
            updateRacingGroupOptions();

            // Reset photo preview
            const photoPreview = document.getElementById('edit-rider-photo-preview');
            const photoPlaceholder = document.getElementById('edit-rider-photo-placeholder');
            photoPreview.style.display = 'none';
            photoPlaceholder.style.display = 'flex';
            document.getElementById('edit-rider-photo-input').value = '';

            // Clear absences for new rider
            const absencesList = document.getElementById('edit-rider-absences-list');
            if (absencesList) absencesList.innerHTML = '<span class="absence-empty">No absences scheduled</span>';
            cancelRiderAbsenceForm();

            // Show all field rows when adding (no mapping restriction)
            modal.querySelectorAll('tr').forEach(tr => { tr.style.display = ''; });

            // Inject additional/custom field rows with blank values
            const riderAdditionalFields = data.seasonSettings?.csvFieldMappings?.riders?.additionalFields || {};
            const riderCustomNames = data.seasonSettings?.csvFieldMappings?.riders?.customFieldNames || {};
            modal.querySelectorAll('[data-additional-field]').forEach(row => row.remove());
            const addNotesInput = document.getElementById('edit-rider-notes');
            const addNotesRow = addNotesInput ? addNotesInput.closest('tr') : null;
            const addEditTable = modal.querySelector('.modal-edit-table');
            if (addEditTable) {
                Object.keys(riderAdditionalFields).forEach(fieldName => {
                    const displayName = riderCustomNames[fieldName] || fieldName;
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-additional-field', fieldName);
                    const inputId = `edit-rider-additional-${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`;
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

        function closeEditRiderModal() {
            const modal = document.getElementById('edit-rider-modal');
            if (!modal) return;
            // Blur any focused elements before hiding modal to avoid aria-hidden warning
            const focusedElement = document.activeElement;
            if (focusedElement && modal.contains(focusedElement)) {
                focusedElement.blur();
            }
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
            currentEditingRiderId = null;
        }

        async function saveRiderFromModal() {
            if (!canEditRiders()) {
                alert('You do not have permission to edit riders');
                return;
            }

            const firstNameInput = document.getElementById('edit-rider-first-name');
            const lastNameInput = document.getElementById('edit-rider-last-name');
            const firstName = firstNameInput ? firstNameInput.value.trim() : '';
            const lastName = lastNameInput ? lastNameInput.value.trim() : '';
            const name = `${firstName} ${lastName}`.trim();
            if (!firstName && !lastName) {
                alert('Please enter a rider first or last name');
                return;
            }

            const phoneInputEl = document.getElementById('edit-rider-phone');
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
            const gradeEl = document.getElementById('edit-rider-grade');
            const grade = gradeEl ? gradeEl.value.trim() : '9th';
            const racingGroupEl = document.getElementById('edit-rider-racing-group');
            const racingGroup = racingGroupEl ? racingGroupEl.value.trim() : '';
            const fitnessInputEl = document.getElementById('edit-rider-fitness');
            const fitnessInput = fitnessInputEl ? fitnessInputEl.value : String(Math.ceil(getFitnessScale() / 2));
            const skillsInputEl = document.getElementById('edit-rider-skills');
            const skillsInput = skillsInputEl ? skillsInputEl.value : String(Math.ceil(getSkillsScale() / 2));
            const notesEl = document.getElementById('edit-rider-notes');
            const notes = notesEl ? notesEl.value.trim() : '';
            const genderEl = document.getElementById('edit-rider-gender');
            const genderValue = genderEl?.value?.toUpperCase();
            
            if (!genderValue || (genderValue !== 'M' && genderValue !== 'F' && genderValue !== 'NB')) {
                alert('Please select a gender');
                return;
            }
            
            if (!racingGroup) {
                alert('Please select a racing group');
                return;
            }

            const fitnessScale = getFitnessScale();
            const skillsScale = getSkillsScale();
            const fitnessValue = Math.max(1, Math.min(fitnessScale, parseInt(fitnessInput || Math.ceil(fitnessScale / 2), 10)));
            const skillsValue = Math.max(1, Math.min(skillsScale, parseInt(skillsInput || Math.ceil(skillsScale / 2), 10)));

            // Get photo from preview or use default based on gender
            let photo = '';
            const photoPreview = document.getElementById('edit-rider-photo-preview');
            const photoInput = document.getElementById('edit-rider-photo-input');
            
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
                // Use default based on gender
                if (genderValue === 'M') {
                    photo = 'assets/male_default.png';
                } else if (genderValue === 'F') {
                    photo = 'assets/female_default.png';
                } else if (genderValue === 'NB') {
                    photo = 'assets/nonbinary_default.png';
                } else {
                    photo = 'assets/nonbinary_default.png';
                }
            }

            // Helper function to safely get field value
            const getFieldValue = (fieldId, defaultValue = '') => {
                const el = document.getElementById(fieldId);
                return el ? el.value.trim() : defaultValue;
            };
            
            // Helper function to safely get phone value
            const getPhoneValue = (fieldId) => {
                const el = document.getElementById(fieldId);
                if (!el) return '';
                const phoneInput = el.value.trim();
                const phoneDigits = phoneInput.replace(/\D/g, '');
                return phoneDigits.length === 10 ? phoneDigits : '';
            };
            
            // Get all CSV fields
            const email = getFieldValue('edit-rider-email');
            const address = getFieldValue('edit-rider-address');
            const birthday = getFieldValue('edit-rider-birthday');
            
            const primaryParentName = getFieldValue('edit-rider-primary-parent-name');
            const primaryParentPhone = getPhoneValue('edit-rider-primary-parent-phone');
            const primaryParentEmail = getFieldValue('edit-rider-primary-parent-email');
            const primaryParentAddress = getFieldValue('edit-rider-primary-parent-address');
            
            const secondParentName = getFieldValue('edit-rider-second-parent-name');
            const secondParentPhone = getPhoneValue('edit-rider-second-parent-phone');
            const secondParentEmail = getFieldValue('edit-rider-second-parent-email');
            
            const alternateContactName = getFieldValue('edit-rider-alternate-contact-name');
            const alternateContactRelationship = getFieldValue('edit-rider-alternate-contact-relationship');
            const alternateContactPhone = getPhoneValue('edit-rider-alternate-contact-phone');
            
            const primaryPhysician = getFieldValue('edit-rider-primary-physician');
            const primaryPhysicianPhone = getPhoneValue('edit-rider-primary-physician-phone');
            const medicalInsuranceCompany = getFieldValue('edit-rider-medical-insurance-company');
            const medicalInsuranceAccountNumber = getFieldValue('edit-rider-medical-insurance-account');
            const allergiesOrMedicalNeeds = getFieldValue('edit-rider-allergies');
            
            const nickname = getFieldValue('edit-rider-nickname');
            const riderNickModeRadio = document.querySelector('input[name="rider-nickname-mode"]:checked');
            const nicknameMode = nickname ? (riderNickModeRadio ? riderNickModeRadio.value : 'wholeName') : '';

            const riderData = {
                name,
                firstName,
                lastName,
                nickname,
                nicknameMode,
                phone,
                photo,
                email,
                address,
                gender: genderValue,
                grade: normalizeGradeValue(grade || (currentEditingRiderId ? data.riders.find(r => r.id === currentEditingRiderId)?.grade : '9th')),
                birthday,
                primaryParentName,
                primaryParentPhone,
                primaryParentEmail,
                primaryParentAddress,
                secondParentName,
                secondParentPhone,
                secondParentEmail,
                alternateContactName,
                alternateContactRelationship,
                alternateContactPhone,
                primaryPhysician,
                primaryPhysicianPhone,
                medicalInsuranceCompany,
                medicalInsuranceAccountNumber,
                allergiesOrMedicalNeeds,
                racingGroup: racingGroup,
                fitness: String(fitnessValue),
                skills: String(skillsValue),
                notes
            };

            // Read additional/custom field values from dynamically injected rows
            const riderModalEl = document.getElementById('edit-rider-modal');
            if (riderModalEl) {
                riderModalEl.querySelectorAll('[data-additional-field]').forEach(row => {
                    const fieldName = row.getAttribute('data-additional-field');
                    const input = row.querySelector('input');
                    if (fieldName && input) {
                        riderData[fieldName] = input.value.trim();
                    }
                });
            }

            if (currentEditingRiderId) {
                riderData.id = currentEditingRiderId;
            }

            try {
                const added = await saveRiderToDB(riderData);
                if (added && added.id) {
                    addNewRiderToAttendanceLists(added.id);
                    if (sidebarsVisible) renderSidebars();
                }
                renderRiders();
                closeEditRiderModal();
                if (data.currentRide) {
                    const ride = data.rides.find(r => r.id === data.currentRide);
                    if (ride) {
                        renderAssignments(ride);
                    }
                }
            } catch (error) {
                console.error('Error saving rider:', error);
                alert('Error saving rider: ' + (error.message || 'Unknown error'));
            }
        }

        function deleteRiderFromModal() {
            if (!currentEditingRiderId) return;
            if (!confirm('Delete this rider?')) return;
            
            deleteRider(currentEditingRiderId);
            closeEditRiderModal();
        }

        function showNotesModal(id, type) {
            const modal = document.getElementById('notes-modal');
            if (!modal) return;

            let record = null;
            let name = '';
            let notes = '';

            if (type === 'coach') {
                record = data.coaches.find(c => c.id === id);
                name = record ? record.name || 'Coach' : 'Coach';
                notes = record ? record.notes || '' : '';
            } else if (type === 'rider') {
                record = data.riders.find(r => r.id === id);
                name = record ? record.name || 'Rider' : 'Rider';
                notes = record ? record.notes || '' : '';
            }

            document.getElementById('notes-modal-title').textContent = `Notes: ${name}`;
            document.getElementById('notes-modal-content').textContent = notes || '(No notes)';

            modal.classList.add('visible');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeNotesModal() {
            const modal = document.getElementById('notes-modal');
            if (!modal) return;
            modal.classList.remove('visible');
            modal.setAttribute('aria-hidden', 'true');
        }

        async function handleCoachPhotoUpload(coachId, input) {
            if (!input.files || input.files.length === 0) return;
            
            const coach = data.coaches.find(c => c.id === coachId);
            if (!coach) return;

            const file = input.files[0];
            
            // Show crop dialog
            const croppedPhoto = await showPhotoCropDialog(file);
            if (!croppedPhoto) return; // User cancelled
            
            coach.photo = croppedPhoto;
            
            // Save to both localStorage and Supabase
            saveData();
            try {
                await saveCoachToDB(coach);
            } catch (error) {
                console.error('Error saving coach photo to Supabase:', error);
            }
            
            renderCoaches();
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) {
                    renderAssignments(ride);
                }
            }
        }

        async function handleRiderPhotoUpload(riderId, input) {
            if (!input.files || input.files.length === 0) return;
            
            const rider = data.riders.find(r => r.id === riderId);
            if (!rider) return;

            const file = input.files[0];
            
            // Show crop dialog
            const croppedPhoto = await showPhotoCropDialog(file);
            if (!croppedPhoto) return; // User cancelled
            
            rider.photo = croppedPhoto;
            
            // Save to both localStorage and Supabase
            saveData();
            try {
                await saveRiderToDB(rider);
            } catch (error) {
                console.error('Error saving rider photo to Supabase:', error);
            }
            
            renderRiders();
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) {
                    renderAssignments(ride);
                }
            }
        }

        async function handleRiderPhotoUploadInModal(input) {
            if (!input.files || input.files.length === 0) return;
            
            const file = input.files[0];
            
            // Show crop dialog
            const croppedPhoto = await showPhotoCropDialog(file);
            if (!croppedPhoto) return; // User cancelled

            const photoPreview = document.getElementById('edit-rider-photo-preview');
            const photoPlaceholder = document.getElementById('edit-rider-photo-placeholder');
            
            photoPreview.src = croppedPhoto;
            photoPreview.style.display = 'block';
            photoPlaceholder.style.display = 'none';
        }

        async function showPhotoCropDialog(file) {
            return new Promise((resolve) => {
                photoCropState.resolve = resolve;
                
                const modal = document.getElementById('photo-crop-modal');
                const canvas = document.getElementById('photo-crop-canvas');
                const container = canvas.parentElement;
                
                if (!modal || !canvas) {
                    resolve(null);
                    return;
                }
                
                const img = new Image();
                img.onload = () => {
                    photoCropState.image = img;
                    photoCropState.canvas = canvas;
                    photoCropState.ctx = canvas.getContext('2d');
                    
                    // Set container size (square, max 500px)
                    const containerSize = Math.min(500, window.innerWidth - 100);
                    container.style.width = containerSize + 'px';
                    container.style.height = containerSize + 'px';
                    photoCropState.containerWidth = containerSize;
                    photoCropState.containerHeight = containerSize;
                    
                    // Set canvas size
                    canvas.width = containerSize;
                    canvas.height = containerSize;
                    
                    // Calculate initial scale to fit image (square crop)
                    const imgAspect = img.width / img.height;
                    let drawWidth, drawHeight;
                    
                    if (imgAspect > 1) {
                        // Landscape: fit height
                        drawHeight = containerSize;
                        drawWidth = drawHeight * imgAspect;
                    } else {
                        // Portrait or square: fit width
                        drawWidth = containerSize;
                        drawHeight = drawWidth / imgAspect;
                    }
                    
                    photoCropState.scale = drawWidth / img.width;
                    photoCropState.offsetX = (containerSize - drawWidth) / 2;
                    photoCropState.offsetY = (containerSize - drawHeight) / 2;
                    
                    // Reset zoom slider
                    document.getElementById('photo-crop-zoom').value = 1;
                    
                    renderPhotoCrop();
                    
                    // Show modal
                    modal.setAttribute('aria-hidden', 'false');
                    modal.style.display = 'flex';
                };
                
                img.onerror = () => {
                    resolve(null);
                };
                
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.readAsDataURL(file);
            });
        }

        function renderPhotoCrop() {
            const { canvas, ctx, image, scale, offsetX, offsetY, containerWidth, containerHeight } = photoCropState;
            if (!canvas || !ctx || !image) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            
            ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
        }

        function updatePhotoCropZoom(value) {
            const zoom = parseFloat(value);
            const { image, containerWidth, containerHeight } = photoCropState;
            if (!image) return;
            
            const baseScale = photoCropState.scale;
            photoCropState.scale = baseScale * zoom;
            
            // Re-center image
            const drawWidth = image.width * photoCropState.scale;
            const drawHeight = image.height * photoCropState.scale;
            photoCropState.offsetX = Math.max(containerWidth - drawWidth, Math.min(0, (containerWidth - drawWidth) / 2));
            photoCropState.offsetY = Math.max(containerHeight - drawHeight, Math.min(0, (containerHeight - drawHeight) / 2));
            
            renderPhotoCrop();
        }

        function closePhotoCropDialog() {
            const modal = document.getElementById('photo-crop-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            if (photoCropState.resolve) {
                photoCropState.resolve(null);
                photoCropState.resolve = null;
            }
        }

        function applyPhotoCrop() {
            const { canvas, ctx, image, scale, offsetX, offsetY, containerWidth, containerHeight } = photoCropState;
            if (!canvas || !ctx || !image) {
                closePhotoCropDialog();
                return;
            }
            
            // Create output canvas (square)
            const outputSize = Math.min(containerWidth, containerHeight);
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = outputSize;
            outputCanvas.height = outputSize;
            const outputCtx = outputCanvas.getContext('2d');
            
            // Calculate source rectangle (what's visible in the crop area)
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            
            // Source coordinates in the original image
            const sourceX = Math.max(0, -offsetX / scale);
            const sourceY = Math.max(0, -offsetY / scale);
            const sourceWidth = Math.min(image.width - sourceX, outputSize / scale);
            const sourceHeight = Math.min(image.height - sourceY, outputSize / scale);
            
            // Destination in output canvas
            const destSize = Math.min(outputSize, sourceWidth * scale, sourceHeight * scale);
            const destX = (outputSize - destSize) / 2;
            const destY = (outputSize - destSize) / 2;
            
            // Draw cropped image
            outputCtx.drawImage(
                image,
                sourceX, sourceY, sourceWidth, sourceHeight,
                destX, destY, destSize, destSize
            );
            
            // Get result as data URL
            const result = outputCanvas.toDataURL('image/png');
            
            closePhotoCropDialog();
            
            if (photoCropState.resolve) {
                photoCropState.resolve(result);
                photoCropState.resolve = null;
            }
        }

        async function showGroupCountSelectionDialog(options) {
            return new Promise((resolve) => {
                groupCountSelectionState.resolve = resolve;
                
                const modal = document.getElementById('group-count-selection-modal');
                const optionsContainer = document.getElementById('group-count-options');
                
                if (!modal || !optionsContainer) {
                    resolve(null);
                    return;
                }
                
                // Ensure aria-hidden is not set (modal should be accessible)
                if (modal.hasAttribute('aria-hidden')) {
                    modal.removeAttribute('aria-hidden');
                }
                
                // Render options as buttons FIRST (before showing modal)
                // This ensures buttons exist before the modal becomes visible
                optionsContainer.innerHTML = options.map((opt, idx) => `
                    <button 
                        class="btn-small" 
                        style="width: 100%; padding: 12px 16px; text-align: left; font-size: 15px; background: #555; color: white; border: 2px solid #555; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-weight: 500;"
                        onmouseover="this.style.borderColor='#2196F3'; this.style.background='#2196F3'"
                        onmouseout="this.style.borderColor='#555'; this.style.background='#555'"
                        onclick="selectGroupCount(${opt.numGroups})"
                    >
                        <strong>${opt.label}</strong>
                    </button>
                `).join('');
                
                // Show modal immediately after buttons are rendered
                modal.style.display = 'flex';
            });
        }

        function selectGroupCount(numGroups) {
            console.log('🔵 selectGroupCount called with:', numGroups);
            if (groupCountSelectionState.resolve) {
                groupCountSelectionState.resolve(numGroups);
                groupCountSelectionState.resolve = null;
            }
            closeGroupCountSelectionDialog();
        }

        function closeGroupCountSelectionDialog() {
            const modal = document.getElementById('group-count-selection-modal');
            if (modal) {
                // Don't set aria-hidden - just hide with display:none
                // The modal doesn't have aria-hidden in HTML, so we don't need to set it
                modal.style.display = 'none';
            }
            if (groupCountSelectionState.resolve) {
                groupCountSelectionState.resolve(null);
                groupCountSelectionState.resolve = null;
            }
        }

        // Add drag handlers for photo crop
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('photo-crop-canvas');
            if (!canvas) return;
            
            canvas.addEventListener('mousedown', (e) => {
                if (!photoCropState.image) return;
                photoCropState.isDragging = true;
                photoCropState.dragStartX = e.clientX - photoCropState.offsetX;
                photoCropState.dragStartY = e.clientY - photoCropState.offsetY;
            });
            
            canvas.addEventListener('mousemove', (e) => {
                if (!photoCropState.isDragging || !photoCropState.image) return;
                
                const { image, scale, containerWidth, containerHeight } = photoCropState;
                const drawWidth = image.width * scale;
                const drawHeight = image.height * scale;
                
                photoCropState.offsetX = e.clientX - photoCropState.dragStartX;
                photoCropState.offsetY = e.clientY - photoCropState.dragStartY;
                
                // Constrain to keep crop area filled
                photoCropState.offsetX = Math.max(containerWidth - drawWidth, Math.min(0, photoCropState.offsetX));
                photoCropState.offsetY = Math.max(containerHeight - drawHeight, Math.min(0, photoCropState.offsetY));
                
                renderPhotoCrop();
            });
            
            canvas.addEventListener('mouseup', () => {
                photoCropState.isDragging = false;
            });
            
            canvas.addEventListener('mouseleave', () => {
                photoCropState.isDragging = false;
            });
            
            // Touch support
            canvas.addEventListener('touchstart', (e) => {
                if (!photoCropState.image) return;
                e.preventDefault();
                const touch = e.touches[0];
                photoCropState.isDragging = true;
                photoCropState.dragStartX = touch.clientX - photoCropState.offsetX;
                photoCropState.dragStartY = touch.clientY - photoCropState.offsetY;
            });
            
            canvas.addEventListener('touchmove', (e) => {
                if (!photoCropState.isDragging || !photoCropState.image) return;
                e.preventDefault();
                
                const touch = e.touches[0];
                const { image, scale, containerWidth, containerHeight } = photoCropState;
                const drawWidth = image.width * scale;
                const drawHeight = image.height * scale;
                
                photoCropState.offsetX = touch.clientX - photoCropState.dragStartX;
                photoCropState.offsetY = touch.clientY - photoCropState.dragStartY;
                
                photoCropState.offsetX = Math.max(containerWidth - drawWidth, Math.min(0, photoCropState.offsetX));
                photoCropState.offsetY = Math.max(containerHeight - drawHeight, Math.min(0, photoCropState.offsetY));
                
                renderPhotoCrop();
            });
            
            canvas.addEventListener('touchend', () => {
                photoCropState.isDragging = false;
            });
        });

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

        function updateDefaultPhoto() {
            const genderSelect = document.getElementById('edit-rider-gender');
            const photoPreview = document.getElementById('edit-rider-photo-preview');
            const photoPlaceholder = document.getElementById('edit-rider-photo-placeholder');
            const photoInput = document.getElementById('edit-rider-photo-input');
            
            if (!genderSelect || !photoPreview || !photoPlaceholder) return;
            
            // Only update if no photo has been uploaded
            if (photoInput && photoInput.files && photoInput.files.length > 0) {
                return; // Don't change if user has uploaded a photo
            }
            
            // Check if there's an existing photo that's not a default
            if (photoPreview.style.display !== 'none' && photoPreview.src) {
                const src = photoPreview.src;
                // If it's a default image, update it; otherwise keep the uploaded photo
                if (!src.includes('male_default') && !src.includes('female_default') && !src.includes('nonbinary_default')) {
                    return; // Keep uploaded photo
                }
            }
            
            const gender = genderSelect.value;
            let defaultPhoto = '';
            if (gender === 'M') {
                defaultPhoto = 'assets/male_default.png';
            } else if (gender === 'F') {
                defaultPhoto = 'assets/female_default.png';
            } else if (gender === 'NB') {
                defaultPhoto = 'assets/nonbinary_default.png';
            } else {
                defaultPhoto = 'assets/nonbinary_default.png';
            }
            
            if (defaultPhoto) {
                photoPreview.src = defaultPhoto;
                photoPreview.style.display = 'block';
                photoPlaceholder.style.display = 'none';
            } else {
                photoPreview.style.display = 'none';
                photoPlaceholder.style.display = 'flex';
            }
        }

        async function adjustCoachPace(coachId, delta) {
            if (typeof canEditCoaches === 'function' && !canEditCoaches()) {
                alert('You do not have permission to update coach endurance');
                return;
            }

            const coach = data.coaches.find(c => c.id === coachId);
            if (!coach) return;

            const fitnessScale = getFitnessScale();
            const currentPace = Math.max(1, Math.min(fitnessScale, parseInt(coach.fitness || Math.ceil(fitnessScale / 2), 10)));
            const newPace = Math.max(1, Math.min(fitnessScale, currentPace + delta));
            
            coach.fitness = String(newPace);
            updateCoachFitnessDisplay(coachId, newPace);
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) renderAssignments(ride);
            }
            saveCoachToDB(coach).catch(e => console.warn('Coach pace save error:', e));
        }
        
        async function adjustCoachSkills(coachId, delta) {
            if (typeof canEditCoaches === 'function' && !canEditCoaches()) {
                alert('You do not have permission to update coach skills');
                return;
            }

            const coach = data.coaches.find(c => c.id === coachId);
            if (!coach) return;

            const skillsScale = getSkillsScale();
            const currentSkills = Math.max(1, Math.min(skillsScale, parseInt(coach.skills || Math.ceil(skillsScale / 2), 10)));
            const newSkills = Math.max(1, Math.min(skillsScale, currentSkills + delta));
            
            coach.skills = String(newSkills);
            updateCoachSkillsDisplay(coachId, newSkills);
            saveCoachToDB(coach).catch(e => console.warn('Coach skills save error:', e));
        }

        function adjustRiderClimbing(riderId, delta) {
            if (typeof canEditRiders === 'function' && !canEditRiders()) {
                alert('You do not have permission to update rider climbing');
                return;
            }
            const rider = data.riders.find(r => r.id === riderId);
            if (!rider) return;
            const climbingScale = getClimbingScale();
            const current = Math.max(1, Math.min(climbingScale, parseInt(rider.climbing || Math.ceil(climbingScale / 2), 10)));
            const newVal = Math.max(1, Math.min(climbingScale, current + delta));
            rider.climbing = String(newVal);
            const row = document.querySelector(`[data-rider-id="${riderId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Climbing Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'rider', riderId, 'climbing', newVal, climbingScale);
            }
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) renderAssignments(ride);
            }
            saveRiderToDB(rider).catch(e => console.warn('Rider climbing save error:', e));
        }

        function adjustCoachClimbing(coachId, delta) {
            if (typeof canEditCoaches === 'function' && !canEditCoaches()) {
                alert('You do not have permission to update coach climbing');
                return;
            }
            const coach = data.coaches.find(c => c.id === coachId);
            if (!coach) return;
            const climbingScale = getClimbingScale();
            const current = Math.max(1, Math.min(climbingScale, parseInt(coach.climbing || Math.ceil(climbingScale / 2), 10)));
            const newVal = Math.max(1, Math.min(climbingScale, current + delta));
            coach.climbing = String(newVal);
            const row = document.querySelector(`[data-coach-id="${coachId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Climbing Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'coach', coachId, 'climbing', newVal, climbingScale);
            }
            saveCoachToDB(coach).catch(e => console.warn('Coach climbing save error:', e));
        }

        function adjustRiderPace(riderId, delta) {
            if (typeof canEditRiders === 'function' && !canEditRiders()) {
                alert('You do not have permission to update rider endurance');
                return;
            }

            const rider = data.riders.find(r => r.id === riderId);
            if (!rider) return;

            const fitnessScale = getFitnessScale();
            const currentPace = Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10)));
            const newPace = Math.max(1, Math.min(fitnessScale, currentPace + delta));
            
            rider.fitness = String(newPace);
            updateRiderFitnessDisplay(riderId, newPace);
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) renderAssignments(ride);
            }
            saveRiderToDB(rider).catch(e => console.warn('Rider pace save error:', e));
        }

        function handleBadgeClick(event, type, id, badgeType, currentValue) {
            event.stopPropagation();
            
            // Determine min/max values based on badge type
            let minValue = 1;
            let maxValue;
            if (badgeType === 'pace') {
                maxValue = getFitnessScale();
            } else if (badgeType === 'climbing') {
                maxValue = getClimbingScale();
            } else if (badgeType === 'skills') {
                maxValue = getSkillsScale();
            } else {
                maxValue = 10; // fallback
            }

            // All three skill types use the same scale direction (paceScaleOrder setting)
            const paceOrder = getPaceScaleOrder();
            const isFastestFirst = paceOrder === 'fastest_to_slowest';
            // "Improve" means lower number when fastest_to_slowest, higher when slowest_to_fastest
            let increaseDelta = isFastestFirst ? -1 : 1;
            let decreaseDelta = -increaseDelta;

            // Check if we're at min or max to conditionally show options
            const canIncrease = currentValue + increaseDelta >= minValue && currentValue + increaseDelta <= maxValue;
            const canDecrease = currentValue + decreaseDelta >= minValue && currentValue + decreaseDelta <= maxValue;
            
            // Store context menu data
            badgeContextMenuData = {
                type: type, // 'rider' or 'coach'
                id: id,
                badgeType: badgeType, // 'pace' or 'skills'
                currentValue: currentValue,
                minValue: minValue,
                maxValue: maxValue,
                increaseDelta: increaseDelta,
                decreaseDelta: decreaseDelta
            };
            
            const contextMenu = document.getElementById('badge-context-menu');
            if (!contextMenu) return;
            
            // Show/hide buttons based on current value
            const increaseBtn = document.getElementById('badge-increase-btn');
            const decreaseBtn = document.getElementById('badge-decrease-btn');
            if (increaseBtn) {
                increaseBtn.style.display = canIncrease ? 'block' : 'none';
                const increaseLabels = { pace: 'Endurance Increase', climbing: 'Climbing Increase', skills: 'Descending Increase' };
                increaseBtn.textContent = increaseLabels[badgeType] || 'Increase';
            }
            if (decreaseBtn) {
                decreaseBtn.style.display = canDecrease ? 'block' : 'none';
                const decreaseLabels = { pace: 'Endurance Decrease', climbing: 'Climbing Decrease', skills: 'Descending Decrease' };
                decreaseBtn.textContent = decreaseLabels[badgeType] || 'Reduce';
                // Remove border-bottom from decrease if increase is hidden
                if (!canIncrease && decreaseBtn) {
                    decreaseBtn.style.borderBottom = 'none';
                } else if (canIncrease && decreaseBtn) {
                    decreaseBtn.style.borderBottom = '1px solid #eee';
                }
            }
            
            // Don't show menu if no options are available
            if (!canIncrease && !canDecrease) {
                return;
            }
            
            // Close any existing context menus
            const practiceMenu = document.getElementById('practice-context-menu');
            if (practiceMenu) practiceMenu.style.display = 'none';
            
            // Find the badge element that was clicked (similar to calendar context menu)
            // Try multiple strategies to find the badge element
            let badgeElement = event.target;
            
            // Strategy 1: Check if target itself is a badge
            if (badgeElement.classList.contains('badge')) {
                // Found it
            } else {
                // Strategy 2: Look for badge in parent chain
                while (badgeElement && badgeElement.parentElement && !badgeElement.classList.contains('badge')) {
                    badgeElement = badgeElement.parentElement;
                }
                // Strategy 3: If still not found, try finding by data attribute
                if (!badgeElement || !badgeElement.classList.contains('badge')) {
                    const badgeType = event.target.getAttribute('data-badge-type');
                    const riderId = event.target.getAttribute('data-rider-id');
                    const coachId = event.target.getAttribute('data-coach-id');
                    if (badgeType && (riderId || coachId)) {
                        badgeElement = event.target.closest('.badge') || document.querySelector(`.badge[data-badge-type="${badgeType}"][data-${riderId ? 'rider' : 'coach'}-id="${riderId || coachId}"]`);
                    }
                }
            }
            
            // Position menu using getBoundingClientRect() for accurate viewport coordinates
            // This works correctly even after page scrolling
            if (badgeElement && badgeElement.getBoundingClientRect) {
                // Use the badge element's bounding rect for accurate positioning
                // getBoundingClientRect() returns viewport coordinates (accounts for scroll automatically)
                const badgeRect = badgeElement.getBoundingClientRect();
                
                // Position menu to the right of the badge, with top-left corner aligned to top of badge
                // Use fixed positioning with viewport coordinates
                contextMenu.style.position = 'fixed';
                contextMenu.style.left = `${badgeRect.right + 5}px`;
                contextMenu.style.top = `${badgeRect.top}px`;
                
                // Show the menu first so we can measure it
                contextMenu.style.display = 'block';
                contextMenu.style.visibility = 'visible';
                
                // Ensure menu stays within viewport (using requestAnimationFrame to ensure DOM is updated)
                requestAnimationFrame(() => {
                    const menuRect = contextMenu.getBoundingClientRect();
                    // Adjust horizontally if menu goes off right edge - show to the left of badge instead
                    if (menuRect.right > window.innerWidth) {
                        contextMenu.style.left = `${badgeRect.left - menuRect.width - 5}px`;
                    }
                    // Adjust vertically if menu goes off bottom edge - align to bottom of badge
                    if (menuRect.bottom > window.innerHeight) {
                        contextMenu.style.top = `${badgeRect.bottom - menuRect.height}px`;
                    }
                    // Ensure menu doesn't go off left edge
                    if (menuRect.left < 0) {
                        contextMenu.style.left = '10px';
                    }
                    // Ensure menu doesn't go off top edge
                    if (menuRect.top < 0) {
                        contextMenu.style.top = '10px';
                    }
                });
            } else {
                // Fallback to click coordinates if badge element not found
                // Use fixed positioning with viewport coordinates from click event
                contextMenu.style.position = 'fixed';
                const x = event.clientX || (event.touches && event.touches[0].clientX) || 0;
                const y = event.clientY || (event.touches && event.touches[0].clientY) || 0;
                contextMenu.style.left = `${x + 5}px`;
                contextMenu.style.top = `${y}px`;
                contextMenu.style.display = 'block';
                contextMenu.style.visibility = 'visible';
                
                console.warn('Badge element not found for context menu, using click coordinates');
            }
            
            // Close menu after 5 seconds
            if (badgeContextMenuTimeout) {
                clearTimeout(badgeContextMenuTimeout);
            }
            badgeContextMenuTimeout = setTimeout(() => {
                contextMenu.style.display = 'none';
                badgeContextMenuData = null;
            }, 5000);
            
            // Close menu when clicking outside
            const closeMenu = (e) => {
                if (!contextMenu.contains(e.target) && e.target !== event.target && !event.target.closest('.badge')) {
                    contextMenu.style.display = 'none';
                    if (badgeContextMenuTimeout) {
                        clearTimeout(badgeContextMenuTimeout);
                        badgeContextMenuTimeout = null;
                    }
                    document.removeEventListener('click', closeMenu);
                    badgeContextMenuData = null;
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeMenu, { once: true });
            }, 10);
        }

        async function handleBadgeAdjust(direction) {
            if (!badgeContextMenuData) return;
            
            const { type, id, badgeType, increaseDelta, decreaseDelta } = badgeContextMenuData;
            const delta = direction === 'increase' ? (increaseDelta ?? 1) : (decreaseDelta ?? -1);
            
            // Close the menu
            const contextMenu = document.getElementById('badge-context-menu');
            if (contextMenu) {
                contextMenu.style.display = 'none';
            }
            if (badgeContextMenuTimeout) {
                clearTimeout(badgeContextMenuTimeout);
                badgeContextMenuTimeout = null;
            }
            
            // Call the appropriate adjustment function
            if (type === 'rider') {
                if (badgeType === 'pace') {
                    await adjustRiderPace(id, delta);
                } else if (badgeType === 'climbing') {
                    await adjustRiderClimbing(id, delta);
                } else if (badgeType === 'skills') {
                    await adjustRiderSkills(id, delta);
                }
            } else if (type === 'coach') {
                if (badgeType === 'pace') {
                    await adjustCoachPace(id, delta);
                } else if (badgeType === 'climbing') {
                    await adjustCoachClimbing(id, delta);
                } else if (badgeType === 'skills') {
                    await adjustCoachSkills(id, delta);
                }
            }
            
            // Refresh the assignments (and sidebars) to show updated values
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) {
                    renderAssignments(ride);
                }
            }
            
            badgeContextMenuData = null;
        }

        function adjustRiderSkills(riderId, delta) {
            if (typeof canEditRiders === 'function' && !canEditRiders()) {
                alert('You do not have permission to update rider skills');
                return;
            }

            const rider = data.riders.find(r => r.id === riderId);
            if (!rider) return;

            const skillsScale = getSkillsScale();
            const currentSkills = Math.max(1, Math.min(skillsScale, parseInt(rider.skills || Math.ceil(skillsScale / 2), 10)));
            const newSkills = Math.max(1, Math.min(skillsScale, currentSkills + delta));
            
            rider.skills = String(newSkills);
            updateRiderSkillsDisplay(riderId, newSkills);
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) renderAssignments(ride);
            }
            saveRiderToDB(rider).catch(e => console.warn('Rider skills save error:', e));
        }
        
        function updateCoachFitnessDisplay(coachId, value) {
            const row = document.querySelector(`[data-coach-id="${coachId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Endurance Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'coach', coachId, 'pace', value, getFitnessScale());
            }
        }
        
        function updateCoachSkillsDisplay(coachId, value) {
            const row = document.querySelector(`[data-coach-id="${coachId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Descending Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'coach', coachId, 'skills', value, getSkillsScale());
            }
        }
        
        function updateRiderFitnessDisplay(riderId, value) {
            const row = document.querySelector(`[data-rider-id="${riderId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Endurance Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'rider', riderId, 'pace', value, getFitnessScale());
            }
        }
        
        function updateRiderSkillsDisplay(riderId, value) {
            const row = document.querySelector(`[data-rider-id="${riderId}"]`);
            if (row) {
                const cell = row.querySelector('[data-label="Descending Rating"]');
                if (cell) refreshPaceControlsInCell(cell, 'rider', riderId, 'skills', value, getSkillsScale());
            }
        }

        // Load column order from localStorage, reconciling with the full column pool
        function getRiderColumnOrder() {
            const pool = getRiderColumnPool();
            const poolKeys = new Set(pool.map(c => c.key));
            const saved = localStorage.getItem('riderColumnOrder');
            if (saved) {
                try {
                    const order = JSON.parse(saved);
                    const reconciledOrder = order.filter(k => poolKeys.has(k));
                    pool.forEach(c => {
                        if (!reconciledOrder.includes(c.key)) {
                            const actionsIdx = reconciledOrder.indexOf('actions');
                            if (actionsIdx !== -1) reconciledOrder.splice(actionsIdx, 0, c.key);
                            else reconciledOrder.push(c.key);
                        }
                    });
                    return reconciledOrder;
                } catch (e) {
                    console.error('Error parsing rider column order:', e);
                }
            }
            return pool.map(c => c.key);
        }
        
        function getCoachColumnOrder() {
            const pool = getCoachColumnPool();
            const poolKeys = new Set(pool.map(c => c.key));
            const saved = localStorage.getItem('coachColumnOrder');
            if (saved) {
                try {
                    const order = JSON.parse(saved);
                    const reconciledOrder = order.filter(k => poolKeys.has(k));
                    pool.forEach(c => {
                        if (!reconciledOrder.includes(c.key)) {
                            const actionsIdx = reconciledOrder.indexOf('actions');
                            if (actionsIdx !== -1) reconciledOrder.splice(actionsIdx, 0, c.key);
                            else reconciledOrder.push(c.key);
                        }
                    });
                    return reconciledOrder;
                } catch (e) {
                    console.error('Error parsing coach column order:', e);
                }
            }
            return pool.map(c => c.key);
        }
        
        // Save column order to localStorage
        function saveRiderColumnOrder(order) {
            localStorage.setItem('riderColumnOrder', JSON.stringify(order));
        }
        
        function saveCoachColumnOrder(order) {
            localStorage.setItem('coachColumnOrder', JSON.stringify(order));
        }
        
        // Load column widths from localStorage
        function getRiderColumnWidths() {
            const saved = localStorage.getItem('riderColumnWidths');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Error parsing rider column widths:', e);
                }
            }
            return {};
        }
        
        function getCoachColumnWidths() {
            const saved = localStorage.getItem('coachColumnWidths');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Error parsing coach column widths:', e);
                }
            }
            return {};
        }
        
        // Save column widths to localStorage
        function saveRiderColumnWidths(widths) {
            localStorage.setItem('riderColumnWidths', JSON.stringify(widths));
        }
        
        function saveCoachColumnWidths(widths) {
            localStorage.setItem('coachColumnWidths', JSON.stringify(widths));
        }

        // --- Column pool: merge static defs with additional CSV fields ---

        function getRiderColumnPool() {
            const pool = riderColumnDefs.map(c => {
                if (c.key === 'pace' || c.key === 'climbing' || c.key === 'skills') {
                    const lbl = typeof getSkillSortLabel === 'function' ? getSkillSortLabel(c.key) : c.label;
                    return { ...c, label: lbl };
                }
                return { ...c };
            });
            const additionalFields = data.seasonSettings?.csvFieldMappings?.riders?.additionalFields || {};
            const existingKeys = new Set(pool.map(c => c.key));
            Object.keys(additionalFields).forEach(fieldName => {
                if (!existingKeys.has(fieldName)) {
                    pool.splice(pool.length - 1, 0, {
                        key: fieldName,
                        label: fieldName,
                        sortable: false,
                        width: 'minmax(120px, 1fr)',
                        isAdditional: true
                    });
                }
            });
            return pool;
        }

        function getCoachColumnPool() {
            const pool = coachColumnDefs.map(c => {
                if (c.key === 'pace' || c.key === 'climbing' || c.key === 'skills') {
                    const lbl = typeof getSkillSortLabel === 'function' ? getSkillSortLabel(c.key) : c.label;
                    return { ...c, label: lbl };
                }
                return { ...c };
            });
            const additionalFields = data.seasonSettings?.csvFieldMappings?.coaches?.additionalFields || {};
            const existingKeys = new Set(pool.map(c => c.key));
            Object.keys(additionalFields).forEach(fieldName => {
                if (!existingKeys.has(fieldName)) {
                    pool.splice(pool.length - 1, 0, {
                        key: fieldName,
                        label: fieldName,
                        sortable: false,
                        width: 'minmax(120px, 1fr)',
                        isAdditional: true
                    });
                }
            });
            return pool;
        }

        // --- Visible columns persistence ---

        function getRiderVisibleColumns() {
            const saved = localStorage.getItem('riderVisibleColumns');
            if (saved) {
                try { return new Set(JSON.parse(saved)); }
                catch (e) { /* fall through to default */ }
            }
            return new Set(riderColumnDefs.map(c => c.key));
        }

        function saveRiderVisibleColumns(visibleSet) {
            localStorage.setItem('riderVisibleColumns', JSON.stringify([...visibleSet]));
        }

        function getCoachVisibleColumns() {
            const saved = localStorage.getItem('coachVisibleColumns');
            if (saved) {
                try { return new Set(JSON.parse(saved)); }
                catch (e) { /* fall through to default */ }
            }
            return new Set(coachColumnDefs.map(c => c.key));
        }

        function saveCoachVisibleColumns(visibleSet) {
            localStorage.setItem('coachVisibleColumns', JSON.stringify([...visibleSet]));
        }

        // --- Choose Display Fields dialog ---

        let _displayFieldsType = null;

        function openChooseDisplayFieldsDialog() {
            const ridersView = document.getElementById('roster-riders-view');
            _displayFieldsType = (ridersView && ridersView.style.display !== 'none') ? 'riders' : 'coaches';

            const pool = _displayFieldsType === 'riders' ? getRiderColumnPool() : getCoachColumnPool();
            const visible = _displayFieldsType === 'riders' ? getRiderVisibleColumns() : getCoachVisibleColumns();
            const titleEl = document.getElementById('display-fields-modal-title');
            if (titleEl) titleEl.textContent = `Choose Display Fields \u2013 ${_displayFieldsType === 'riders' ? 'Riders' : 'Coaches'}`;

            const records = _displayFieldsType === 'riders' ? (data.riders || []) : (data.coaches || []);
            const alwaysShow = new Set(['name', 'actions']);
            const populatedFields = new Set();
            for (const rec of records) {
                for (const col of pool) {
                    if (alwaysShow.has(col.key) || populatedFields.has(col.key)) continue;
                    const val = rec[col.key];
                    if (val !== undefined && val !== null && val !== '' && val !== 0) {
                        populatedFields.add(col.key);
                    }
                }
            }
            const filteredPool = pool.filter(col =>
                alwaysShow.has(col.key) || populatedFields.has(col.key)
            );

            const list = document.getElementById('display-fields-list');
            if (!list) return;

            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse;';
            filteredPool.forEach(col => {
                if (col.key === 'actions') return;
                const isName = col.key === 'name';
                const isChecked = isName || visible.has(col.key);
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid #f0f0f0; cursor: pointer;';
                tr.onclick = function(e) {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = tr.querySelector('input[type="checkbox"]');
                    if (cb && !cb.disabled) cb.checked = !cb.checked;
                };
                const tdCheck = document.createElement('td');
                tdCheck.style.cssText = 'padding: 7px 8px; width: 30px; text-align: center; vertical-align: middle;';
                tdCheck.innerHTML = `<input type="checkbox" data-col-key="${col.key}" ${isChecked ? 'checked' : ''} ${isName ? 'disabled' : ''}>`;
                const tdLabel = document.createElement('td');
                tdLabel.style.cssText = 'padding: 7px 8px; text-align: left; font-size: 13px; vertical-align: middle;';
                tdLabel.innerHTML = `${escapeHtml(col.label || col.key)}${col.isAdditional ? ' <span style="color:#999; font-size:11px;">(custom)</span>' : ''}`;
                tr.appendChild(tdCheck);
                tr.appendChild(tdLabel);
                table.appendChild(tr);
            });
            list.innerHTML = '';
            list.appendChild(table);

            const modal = document.getElementById('display-fields-modal');
            if (modal) {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');
            }
        }

        function closeDisplayFieldsModal() {
            const modal = document.getElementById('display-fields-modal');
            if (modal) {
                if (modal.contains(document.activeElement)) document.activeElement.blur();
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }
            _displayFieldsType = null;
        }

        function applyDisplayFieldChanges() {
            const list = document.getElementById('display-fields-list');
            if (!list || !_displayFieldsType) return;

            const newVisible = new Set(['name', 'actions']);
            list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.checked && cb.dataset.colKey) {
                    newVisible.add(cb.dataset.colKey);
                }
            });

            if (_displayFieldsType === 'riders') {
                saveRiderVisibleColumns(newVisible);
                const pool = getRiderColumnPool();
                const currentOrder = getRiderColumnOrder();
                const poolKeys = new Set(pool.map(c => c.key));
                const updatedOrder = currentOrder.filter(k => poolKeys.has(k));
                pool.forEach(c => {
                    if (!updatedOrder.includes(c.key)) updatedOrder.splice(updatedOrder.length - 1, 0, c.key);
                });
                saveRiderColumnOrder(updatedOrder);
                renderRiders();
            } else {
                saveCoachVisibleColumns(newVisible);
                const pool = getCoachColumnPool();
                const currentOrder = getCoachColumnOrder();
                const poolKeys = new Set(pool.map(c => c.key));
                const updatedOrder = currentOrder.filter(k => poolKeys.has(k));
                pool.forEach(c => {
                    if (!updatedOrder.includes(c.key)) updatedOrder.splice(updatedOrder.length - 1, 0, c.key);
                });
                saveCoachColumnOrder(updatedOrder);
                renderCoaches();
            }

            closeDisplayFieldsModal();
        }
        
        // Calculate minimum width for a column based on content
        function calculateMinColumnWidth(type, key, order) {
            const items = type === 'rider' ? data.riders : data.coaches;
            if (!items || items.length === 0) {
                const pool = type === 'rider' ? getRiderColumnPool() : getCoachColumnPool();
                const def = pool.find(c => c.key === key);
                return def ? parseInt(def.width.match(/\d+/)?.[0] || '100') : 100;
            }
            
            let maxWidth = 0;
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.whiteSpace = 'nowrap';
            tempDiv.style.fontSize = '14px';
            tempDiv.style.padding = '8px';
            document.body.appendChild(tempDiv);
            
            items.forEach(item => {
                let content = '';
                switch(key) {
                    case 'photo':
                        maxWidth = Math.max(maxWidth, 41);
                        break;
                    case 'name':
                        content = item.name || '';
                        break;
                    case 'phone':
                        content = formatPhoneForDisplay(item.phone || '');
                        break;
                    case 'gender':
                        content = (item.gender || 'M').toUpperCase();
                        break;
                    case 'grade':
                        content = formatGradeLabel(item.grade || '9th');
                        break;
                    case 'racingGroup':
                        content = item.racingGroup || '';
                        break;
                    case 'pace':
                        content = String(Math.max(1, Math.min(getFitnessScale(), parseInt(item.fitness || Math.ceil(getFitnessScale() / 2), 10))));
                        break;
                    case 'skills':
                        content = String(Math.max(1, Math.min(getSkillsScale(), parseInt(item.skills || Math.ceil(getSkillsScale() / 2), 10))));
                        break;
                    case 'level':
                        const levelRaw = item.coachingLicenseLevel || item.level || '1';
                        content = levelRaw === 'N/A' ? 'N/A' : `Level ${levelRaw}`;
                        break;
                    case 'notes':
                        maxWidth = Math.max(maxWidth, 120);
                        break;
                    case 'actions':
                        maxWidth = Math.max(maxWidth, 100);
                        break;
                }
                if (content) {
                    tempDiv.textContent = content;
                    maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
                }
            });
            
            document.body.removeChild(tempDiv);
            
            // Add padding and ensure minimum
            return Math.max(maxWidth + 20, 80);
        }
        
        // Get grid template columns string based on order and widths
        function getRiderGridTemplate(order) {
            const widths = getRiderColumnWidths();
            const pool = getRiderColumnPool();
            return order.filter(key => key !== 'photo').map((key, index) => {
                if (widths[key]) {
                    return `${widths[key]}px`;
                }
                const def = pool.find(c => c.key === key);
                return def ? def.width : 'minmax(120px, 1fr)';
            }).join(' ');
        }
        
        function getCoachGridTemplate(order) {
            const widths = getCoachColumnWidths();
            const pool = getCoachColumnPool();
            return order.filter(key => key !== 'photo').map((key, index) => {
                if (widths[key]) {
                    return `${widths[key]}px`;
                }
                const def = pool.find(c => c.key === key);
                return def ? def.width : 'minmax(120px, 1fr)';
            }).join(' ');
        }
        
        function handleColumnResizeStart(event, type, key) {
            event.preventDefault();
            event.stopPropagation();
            
            resizingColumn = { type, key };
            resizingStartX = event.clientX;
            resizingHeaderElement = event.target.closest('.roster-header');
            
            const order = type === 'rider' ? getRiderColumnOrder() : getCoachColumnOrder();
            const widths = type === 'rider' ? getRiderColumnWidths() : getCoachColumnWidths();
            const currentWidth = widths[key];
            
            if (currentWidth) {
                resizingStartWidth = currentWidth;
            } else {
                const pool = type === 'rider' ? getRiderColumnPool() : getCoachColumnPool();
                const def = pool.find(c => c.key === key);
                const match = def ? def.width.match(/(\d+)px/) : null;
                resizingStartWidth = match ? parseInt(match[1]) : 200;
            }
            
            resizingMinWidth = calculateMinColumnWidth(type, key, order);
            
            document.addEventListener('mousemove', handleColumnResize);
            document.addEventListener('mouseup', handleColumnResizeEnd);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        
        function handleColumnResize(event) {
            if (!resizingColumn) return;
            
            const deltaX = event.clientX - resizingStartX;
            const newWidth = Math.max(resizingMinWidth, resizingStartWidth + deltaX);
            
            const widths = resizingColumn.type === 'rider' ? getRiderColumnWidths() : getCoachColumnWidths();
            widths[resizingColumn.key] = newWidth;
            
            if (resizingColumn.type === 'rider') {
                saveRiderColumnWidths(widths);
                renderRiders();
            } else {
                saveCoachColumnWidths(widths);
                renderCoaches();
            }
        }
        
        function handleColumnResizeEnd(event) {
            if (resizingColumn) {
                resizingColumn = null;
                resizingHeaderElement = null;
                document.removeEventListener('mousemove', handleColumnResize);
                document.removeEventListener('mouseup', handleColumnResizeEnd);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        }
        
        function handleColumnDragStart(event, type, key) {
            // Prevent dragging the name column (it's locked in position)
            if (key === 'name') {
                event.preventDefault();
                return false;
            }
            draggedColumnKey = key;
            draggedColumnType = type;
            event.dataTransfer.effectAllowed = 'move';
            event.target.style.opacity = '0.5';
        }
        
        function handleColumnDragOver(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            const target = event.currentTarget;
            if (target !== event.target) {
                target.style.backgroundColor = '#e3f2fd';
            }
        }
        
        function handleColumnDrop(event, type, targetKey) {
            event.preventDefault();
            event.stopPropagation();
            
            // Prevent dropping on or moving the name column
            if (targetKey === 'name' || draggedColumnKey === 'name') {
                event.target.style.backgroundColor = '';
                return;
            }
            
            if (draggedColumnKey && draggedColumnType === type && draggedColumnKey !== targetKey) {
                // Prevent moving name column or dropping on name column
                if (draggedColumnKey === 'name' || targetKey === 'name') {
                    event.target.style.backgroundColor = '';
                    return;
                }
                
                let order = type === 'rider' ? getRiderColumnOrder() : getCoachColumnOrder();
                const draggedIndex = order.indexOf(draggedColumnKey);
                const targetIndex = order.indexOf(targetKey);
                
                // Ensure name column stays in its position (index 0, first column)
                if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== 0 && targetIndex !== 0) {
                    // Remove dragged column from its position
                    order.splice(draggedIndex, 1);
                    // Insert at target position (but not at position 0 where name is)
                    const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
                    if (insertIndex !== 0) {
                        order.splice(insertIndex, 0, draggedColumnKey);
                    } else {
                        // If trying to insert at name position, insert after it
                        order.splice(1, 0, draggedColumnKey);
                    }
                    
                    // Save new order
                    if (type === 'rider') {
                        saveRiderColumnOrder(order);
                        renderRiders();
                    } else {
                        saveCoachColumnOrder(order);
                        renderCoaches();
                    }
                }
            }
            
            // Reset visual feedback
            event.target.style.backgroundColor = '';
        }
        
        function handleColumnDragEnd(event) {
            event.target.style.opacity = '';
            // Reset all header backgrounds
            const headers = document.querySelectorAll('.roster-header > div');
            headers.forEach(h => h.style.backgroundColor = '');
            draggedColumnKey = null;
            draggedColumnType = null;
        }

        function sortRiders(column) {
            // Toggle direction if clicking the same column
            if (riderSortColumn === column) {
                riderSortDirection = riderSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                riderSortColumn = column;
                riderSortDirection = 'asc';
            }
            renderRiders();
        }

        function sortCoaches(column) {
            // Toggle direction if clicking the same column
            if (coachSortColumn === column) {
                coachSortDirection = coachSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                coachSortColumn = column;
                coachSortDirection = 'asc';
            }
            renderCoaches();
        }

        function getSortableLastName(name) {
            if (!name) return '';
            const parts = name.trim().split(/\s+/);
            return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : (parts[0] || '').toLowerCase();
        }

        function getGradeSortValue(grade) {
            const gradeMap = { '9th': 1, '10th': 2, '11th': 3, '12th': 4 };
            return gradeMap[grade] || 0;
        }

        function getRacingGroupSortValue(racingGroup) {
            const groupOrder = {
                'Varsity Boys': 1, 'Varsity Girls': 2,
                'JV1 Boys': 3, 'JV1 Girls': 4,
                'JV2 Boys': 5, 'JV2 Girls': 6,
                'Freshman Boys': 7, 'Freshman Girls': 8
            };
            return groupOrder[racingGroup] || 99;
        }

        function groupRiders(groupBy) {
            riderGroupBy = groupBy || '';
            try {
                localStorage.setItem('rosterRiderGroupBy', riderGroupBy);
            } catch (e) {
                console.warn('Could not save rider group-by preference:', e);
            }
            renderRiders();
        }

        function groupCoaches(groupBy) {
            coachGroupBy = groupBy || '';
            try {
                localStorage.setItem('rosterCoachGroupBy', coachGroupBy);
            } catch (e) {
                console.warn('Could not save coach group-by preference:', e);
            }
            renderCoaches();
        }

        function getRiderGroupValue(rider, groupBy) {
            if (!groupBy) return '';
            switch (groupBy) {
                case 'firstName':
                    const rFirstParts = (rider.name || '').trim().split(/\s+/);
                    const rFirst = rFirstParts[0] || '';
                    return rFirst ? rFirst.charAt(0).toUpperCase() : 'Other';
                case 'lastName':
                case 'name':
                    const rLast = getSortableLastName(rider.name || '');
                    return rLast ? rLast.charAt(0).toUpperCase() : 'Other';
                case 'gender':
                    return (rider.gender || 'M').toUpperCase();
                case 'grade':
                    return formatGradeLabel(rider.grade || '9th');
                case 'racingGroup':
                    return rider.racingGroup || 'No Group';
                case 'pace':
                    return `Pace ${rider.fitness || '5'}`;
                case 'climbing':
                    return `Climbing ${rider.climbing || '3'}`;
                case 'skills':
                    return `Bike Skills ${rider.skills || '2'}`;
                default:
                    return '';
            }
        }

        function getCoachGroupValue(coach, groupBy) {
            if (!groupBy) return '';
            switch (groupBy) {
                case 'firstName':
                    const cFirstParts = (coach.name || '').trim().split(/\s+/);
                    const cFirst = cFirstParts[0] || '';
                    return cFirst ? cFirst.charAt(0).toUpperCase() : 'Other';
                case 'lastName':
                case 'name':
                    const cLast = getSortableLastName(coach.name || '');
                    return cLast ? cLast.charAt(0).toUpperCase() : 'Other';
                case 'level':
                    const levelRaw = coach.coachingLicenseLevel || coach.level || '1';
                    return levelRaw === 'N/A' ? 'N/A' : `Level ${levelRaw}`;
                case 'pace':
                    return `Pace ${coach.fitness || '5'}`;
                default:
                    return '';
            }
        }

        function toggleShowArchivedRiders() {
            showArchivedRiders = !showArchivedRiders;
            renderRiders();
        }

        function toggleShowArchivedCoaches() {
            showArchivedCoaches = !showArchivedCoaches;
            renderCoaches();
        }

        async function archiveRiderFromModal() {
            if (!currentEditingRiderId) return;
            const rider = data.riders.find(r => r.id === currentEditingRiderId);
            if (!rider) return;
            const newState = !rider.archived;
            const action = newState ? 'archive' : 'restore';
            if (!confirm(`${newState ? 'Archive' : 'Restore'} this rider?`)) return;
            rider.archived = newState;
            try {
                await updateRider(rider.id, { archived: newState });
            } catch (e) { console.warn('Error updating archived state:', e); }
            renderRiders();
            closeEditRiderModal();
        }

        async function archiveCoachFromModal() {
            if (!currentEditingCoachId) return;
            const coach = data.coaches.find(c => c.id === currentEditingCoachId);
            if (!coach) return;
            const newState = !coach.archived;
            if (!confirm(`${newState ? 'Archive' : 'Restore'} this coach?`)) return;
            coach.archived = newState;
            try {
                await updateCoach(coach.id, { archived: newState });
            } catch (e) { console.warn('Error updating archived state:', e); }
            renderCoaches();
            closeEditCoachModal();
        }

        function updateSkillLabelsInDOM() {
            if (typeof getSkillSortLabel !== 'function') return;
            const paceLabel = getSkillSortLabel('pace');
            const climbLabel = getSkillSortLabel('climbing');
            const descendLabel = getSkillSortLabel('skills');

            const skillMap = { pace: paceLabel, climbing: climbLabel, skills: descendLabel };
            Object.entries(skillMap).forEach(([val, label]) => {
                document.querySelectorAll(`select option[value="${val}"]`).forEach(opt => {
                    if (opt.closest('#sidebar-riders-sort') || opt.closest('#sidebar-coaches-sort')) return;
                    opt.textContent = label;
                });
            });

            const inputLabelMap = {
                'edit-rider-fitness': paceLabel, 'edit-rider-climbing': climbLabel, 'edit-rider-skills': descendLabel,
                'edit-coach-fitness': paceLabel, 'edit-coach-climbing': climbLabel, 'edit-coach-skills': descendLabel
            };
            Object.entries(inputLabelMap).forEach(([inputId, label]) => {
                const input = document.getElementById(inputId);
                if (input) {
                    const td = input.closest('td');
                    if (td && td.previousElementSibling && td.previousElementSibling.classList.contains('modal-edit-label')) {
                        td.previousElementSibling.textContent = label;
                    }
                }
            });
        }

        function renderRiders() {
            updateSkillLabelsInDOM();
            const list = document.getElementById('riders-list');
            const activeRiders = data.riders.filter(r => !r.archived);
            const archivedRidersList = data.riders.filter(r => r.archived);
            const visibleRiders = showArchivedRiders ? activeRiders : activeRiders;
            if (activeRiders.length === 0 && (!showArchivedRiders || archivedRidersList.length === 0)) {
                const archivedCount = archivedRidersList.length;
                const msg = archivedCount > 0
                    ? `No active riders. ${archivedCount} archived rider(s) hidden. <button class="btn-small secondary" style="margin-left:8px;" onclick="toggleShowArchivedRiders()">Show Archived</button>`
                    : 'No riders yet. Click "Add Team Rider" below to get started.';
                list.innerHTML = `<div class="empty-state">${msg}</div>`;
                return;
            }
            
            const _sortRiderArray = (arr) => {
                if (!riderSortColumn) return [...arr];
                return [...arr].sort((a, b) => {
                    let aVal, bVal;
                    switch (riderSortColumn) {
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
                        case 'gender':
                            aVal = (a.gender || '').toUpperCase();
                            bVal = (b.gender || '').toUpperCase();
                            break;
                        case 'grade':
                            aVal = getGradeSortValue(a.grade || '9th');
                            bVal = getGradeSortValue(b.grade || '9th');
                            break;
                        case 'racingGroup':
                            aVal = getRacingGroupSortValue(a.racingGroup || '');
                            bVal = getRacingGroupSortValue(b.racingGroup || '');
                            if (aVal === bVal) {
                                // Secondary sort by name of group if same level
                                aVal = (a.racingGroup || '').toLowerCase();
                                bVal = (b.racingGroup || '').toLowerCase();
                            }
                            break;
                        case 'pace':
                            aVal = parseInt(a.fitness || '5', 10);
                            bVal = parseInt(b.fitness || '5', 10);
                            break;
                        case 'skills':
                            aVal = parseInt(a.skills || '2', 10);
                            bVal = parseInt(b.skills || '2', 10);
                            break;
                        case 'climbing':
                            aVal = parseInt(a.climbing || '3', 10);
                            bVal = parseInt(b.climbing || '3', 10);
                            break;
                        default:
                            return 0;
                    }
                    
                    let comparison = 0;
                    if (aVal < bVal) comparison = -1;
                    if (aVal > bVal) comparison = 1;
                    
                    return riderSortDirection === 'asc' ? comparison : -comparison;
                });
            };
            
            let sortedRiders = _sortRiderArray(visibleRiders);
            
            const getSortIndicator = (column) => { return ''; };
            
            // Get column order, filtered by visibility
            const fullColumnOrder = getRiderColumnOrder();
            const visibleColumns = getRiderVisibleColumns();
            const columnPool = getRiderColumnPool();
            const columnOrder = fullColumnOrder.filter(k => visibleColumns.has(k) || k === 'name' || k === 'actions');
            const gridTemplate = getRiderGridTemplate(columnOrder);
            
            // Build header cells in order
            const headerCells = columnOrder.map(key => {
                const def = columnPool.find(c => c.key === key);
                if (!def) return '<div></div>';
                
                let content = '';
                // Name column is not draggable (locked in position)
                const isDraggable = key !== 'name';
                const draggableAttr = isDraggable ? 'draggable="true"' : 'draggable="false"';
                const dragHandlers = isDraggable ? `ondragstart="handleColumnDragStart(event, 'rider', '${key}')" ondragover="handleColumnDragOver(event)" ondrop="handleColumnDrop(event, 'rider', '${key}')" ondragend="handleColumnDragEnd(event)"` : '';
                
                // Add resize handle for resizable columns (not actions)
                const resizeHandle = (key !== 'actions') ? `<div class="column-resize-handle" onmousedown="handleColumnResizeStart(event, 'rider', '${key}')"></div>` : '';
                
                const isSkillCol = (key === 'pace' || key === 'climbing' || key === 'skills');
                const displayLabel = isSkillCol && typeof getSkillSortLabel === 'function'
                    ? getSkillSortLabel(key === 'pace' ? 'pace' : key, true)
                    : def.label;
                if (def.sortable) {
                    const sortKey = key === 'name' ? 'name' : key === 'pace' ? 'pace' : key === 'skills' ? 'skills' : key;
                    content = `<div class="roster-header-sortable" style="position: relative;" onclick="sortRiders('${sortKey}')" title="Click to sort by ${def.label}" ${draggableAttr} ${dragHandlers}>${displayLabel}${resizeHandle}</div>`;
                } else {
                    content = `<div style="position: relative;" ${draggableAttr} ${dragHandlers}>${displayLabel}${resizeHandle}</div>`;
                }
                return content;
            });
            
            const header = `
                <div class="roster-header rider-grid-template" style="grid-template-columns: ${gridTemplate};">
                    ${headerCells.join('')}
                </div>
            `;

            // Group riders if grouping is enabled
            let groupedRiders = [];
            if (riderGroupBy) {
                const groups = new Map();
                sortedRiders.forEach(rider => {
                    const groupValue = getRiderGroupValue(rider, riderGroupBy);
                    if (!groups.has(groupValue)) {
                        groups.set(groupValue, []);
                    }
                    groups.get(groupValue).push(rider);
                });
                
                // Sort group keys
                const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (riderGroupBy === 'name') {
                        return a.localeCompare(b);
                    } else if (riderGroupBy === 'grade') {
                        return getGradeSortValue(a) - getGradeSortValue(b);
                    } else if (riderGroupBy === 'racingGroup') {
                        return getRacingGroupSortValue(a) - getRacingGroupSortValue(b);
                    } else if (riderGroupBy === 'pace') {
                        const aPace = parseInt(a.replace('Pace ', '') || '5', 10);
                        const bPace = parseInt(b.replace('Pace ', '') || '5', 10);
                        return aPace - bPace;
                    } else if (riderGroupBy === 'skills') {
                        const aSkills = parseInt(a.replace('Bike Skills ', '').replace('Skills ', '') || '2', 10);
                        const bSkills = parseInt(b.replace('Skills ', '') || '2', 10);
                        return aSkills - bSkills;
                    }
                    return a.localeCompare(b);
                });
                
                sortedGroupKeys.forEach(groupKey => {
                    groupedRiders.push({ type: 'header', value: groupKey });
                    groups.get(groupKey).forEach(rider => {
                        groupedRiders.push({ type: 'rider', data: rider });
                    });
                });
            } else {
                sortedRiders.forEach(rider => {
                    groupedRiders.push({ type: 'rider', data: rider });
                });
            }

            let htmlContent = header;
            groupedRiders.forEach(item => {
                if (item.type === 'header') {
                    // Convert gender values to display labels
                    let displayValue = item.value;
                    if (riderGroupBy === 'gender') {
                        if (item.value === 'F') {
                            displayValue = 'Girls';
                        } else if (item.value === 'M') {
                            displayValue = 'Boys';
                        }
                    }
                    htmlContent += `<div class="roster-group-header">${escapeHtml(displayValue)}</div>`;
                } else {
                    const rider = item.data;
                    const fitnessScale = getFitnessScale();
                    const fitnessValue = Math.max(1, Math.min(fitnessScale, parseInt(rider.fitness || Math.ceil(fitnessScale / 2), 10)));
                    const gradeValue = formatGradeLabel(rider.grade);
                    const racingValue = rider.racingGroup || '';
                    const genderValue = (rider.gender || 'M').toUpperCase();
                    const hasNotes = rider.notes && rider.notes.trim().length > 0;
                    const notesIcon = hasNotes ? `<span class="notes-icon" onclick="showNotesModal(${rider.id}, 'rider')" title="View notes">📝</span>` : '';

                    // Build row cells in column order
                    const rowCells = columnOrder.filter(key => key !== 'photo').map(key => {
                        switch(key) {
                            case 'name':
                                const riderRole = getRiderRole(rider.id);
                                const riderNickname = (rider.nickname || '').trim();
                                let riderNameWithNickname;
                                if (riderNickname && rider.nicknameMode === 'firstName') {
                                    riderNameWithNickname = `${riderNickname} ${rider.lastName || ''}`.trim();
                                } else if (riderNickname) {
                                    riderNameWithNickname = riderNickname;
                                } else {
                                    riderNameWithNickname = rider.name || '';
                                }
                                const riderNameDisplay = riderRole 
                                    ? `${escapeHtml(riderNameWithNickname)} <span style="font-style: italic; color: #666; margin-left: 8px; font-weight: normal;">${escapeHtml(riderRole)}</span>`
                                    : escapeHtml(riderNameWithNickname);
                                const medicalIcon = getMedicalIconHtml(rider.allergiesOrMedicalNeeds || rider.medicalNotes || '');
                                return `<div class="roster-cell roster-name" data-label="Name">
                                    ${riderNameDisplay}
                                    ${medicalIcon}
                                    ${rider.phone ? `<a href="${formatPhoneForTel(rider.phone)}" class="roster-phone-icon" title="Call ${formatPhoneForDisplay(rider.phone)}" aria-label="Call ${formatPhoneForDisplay(rider.phone)}">📞</a>` : ''}
                                </div>`;
                            case 'phone':
                                return `<div class="roster-cell" data-label="Phone">
                                    ${formatPhoneForDisplay(rider.phone || '')}
                                </div>`;
                            case 'primaryParentPhone':
                                return `<div class="roster-cell" data-label="Primary Parent Cell">${formatPhoneForDisplay(rider.primaryParentPhone || '')}</div>`;
                            case 'secondParentPhone':
                                return `<div class="roster-cell" data-label="Second Parent Cell">${formatPhoneForDisplay(rider.secondParentPhone || '')}</div>`;
                            case 'alternateContactPhone':
                                return `<div class="roster-cell" data-label="Alt. Contact Cell">${formatPhoneForDisplay(rider.alternateContactPhone || '')}</div>`;
                            case 'primaryPhysicianPhone':
                                return `<div class="roster-cell" data-label="Physician Phone">${formatPhoneForDisplay(rider.primaryPhysicianPhone || '')}</div>`;
                            case 'email':
                                const riderEmail = rider.email || '';
                                return `<div class="roster-cell" data-label="Email">${riderEmail ? `<a href="mailto:${escapeHtml(riderEmail)}" style="color:#1976d2;text-decoration:none;">${escapeHtml(riderEmail)}</a>` : ''}</div>`;
                            case 'primaryParentEmail':
                                const ppEmail = rider.primaryParentEmail || '';
                                return `<div class="roster-cell" data-label="Primary Parent Email">${ppEmail ? `<a href="mailto:${escapeHtml(ppEmail)}" style="color:#1976d2;text-decoration:none;">${escapeHtml(ppEmail)}</a>` : ''}</div>`;
                            case 'secondParentEmail':
                                const spEmail = rider.secondParentEmail || '';
                                return `<div class="roster-cell" data-label="Second Parent Email">${spEmail ? `<a href="mailto:${escapeHtml(spEmail)}" style="color:#1976d2;text-decoration:none;">${escapeHtml(spEmail)}</a>` : ''}</div>`;
                            case 'bike':
                                const rBikeManual = rider.bikeManual !== false;
                                const rBikeElectric = rider.bikeElectric || false;
                                let rBikeLabel = 'Manual';
                                if (rBikeManual && rBikeElectric) {
                                    rBikeLabel = rider.bikePrimary === 'electric' ? 'Both (E)' : 'Both (M)';
                                } else if (rBikeElectric) {
                                    rBikeLabel = 'Electric';
                                }
                                return `<div class="roster-cell" data-label="Bike">${escapeHtml(rBikeLabel)}</div>`;
                            case 'gender':
                                return `<div class="roster-cell" data-label="Gender">
                                    ${escapeHtml(genderValue)}
                                </div>`;
                            case 'grade':
                                return `<div class="roster-cell" data-label="Grade">
                                    ${escapeHtml(gradeValue)}
                                </div>`;
                            case 'racingGroup':
                                return `<div class="roster-cell" data-label="Racing Group">
                                    ${escapeHtml(racingValue)}
                                </div>`;
                            case 'pace':
                                return `<div class="roster-cell" data-label="Endurance Rating">
                                    ${buildPaceControlsHtml('rider', rider.id, 'pace', fitnessValue, fitnessScale)}
                                </div>`;
                            case 'skills':
                                const riderSkillsScale = getSkillsScale();
                                const riderSkillsValue = Math.max(1, Math.min(riderSkillsScale, parseInt(rider.skills || Math.ceil(riderSkillsScale / 2), 10)));
                                return `<div class="roster-cell" data-label="Descending Rating">
                                    ${buildPaceControlsHtml('rider', rider.id, 'skills', riderSkillsValue, riderSkillsScale)}
                                </div>`;
                            case 'climbing':
                                const riderClimbingScale = getClimbingScale();
                                const riderClimbingValue = Math.max(1, Math.min(riderClimbingScale, parseInt(rider.climbing || '3', 10)));
                                return `<div class="roster-cell" data-label="Climbing Rating">
                                    ${buildPaceControlsHtml('rider', rider.id, 'climbing', riderClimbingValue, riderClimbingScale)}
                                </div>`;
                            case 'notes':
                                return `<div class="roster-cell" data-label="Notes">
                                    ${notesIcon}
                                </div>`;
                            case 'actions':
                                return `<div class="roster-actions">
                                    <button class="btn-small" onclick="openEditRiderModal(${rider.id})">View/Edit Full Record</button>
                                </div>`;
                            default:
                                const additionalVal = rider[key] || '';
                                const colDef = columnPool.find(c => c.key === key);
                                return `<div class="roster-cell" data-label="${escapeHtml(colDef ? colDef.label : key)}">${escapeHtml(String(additionalVal))}</div>`;
                        }
                    });
                    
                    const archivedClass = rider.archived ? ' roster-row-archived' : '';
                    htmlContent += `
                        <div class="roster-row rider-grid-template${archivedClass}" data-rider-id="${rider.id}" style="grid-template-columns: ${gridTemplate};">
                            ${rowCells.join('')}
                        </div>
                    `;
                }
            });

            // Archived riders section: shown at the bottom, sorted by name, separated by a divider
            const archivedCount = archivedRidersList.length;
            if (showArchivedRiders && archivedCount > 0) {
                const sortedArchived = [...archivedRidersList].sort((a, b) => {
                    const aName = getSortableLastName(a.name || '');
                    const bName = getSortableLastName(b.name || '');
                    return aName.localeCompare(bName);
                });
                htmlContent += `<div class="roster-archived-divider" style="grid-column: 1 / -1; padding: 10px 16px 6px; margin-top: 12px; border-top: 2px solid #ccc; color: #888; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Archived Riders (${archivedCount})</div>`;
                sortedArchived.forEach(rider => {
                    const rowCells = columnOrder.filter(key => key !== 'photo').map(key => {
                        switch(key) {
                            case 'name':
                                const riderRole = getRiderRole(rider.id);
                                const riderNickname = (rider.nickname || '').trim();
                                let riderNameWithNickname;
                                if (riderNickname && rider.nicknameMode === 'firstName') {
                                    riderNameWithNickname = `${riderNickname} ${rider.lastName || ''}`.trim();
                                } else if (riderNickname) {
                                    riderNameWithNickname = riderNickname;
                                } else {
                                    riderNameWithNickname = rider.name || '';
                                }
                                const riderNameDisplay = riderRole 
                                    ? `${escapeHtml(riderNameWithNickname)} <span style="font-style: italic; color: #666; margin-left: 8px; font-weight: normal;">${escapeHtml(riderRole)}</span>`
                                    : escapeHtml(riderNameWithNickname);
                                const medicalIcon = getMedicalIconHtml(rider.allergiesOrMedicalNeeds || rider.medicalNotes || '');
                                return `<div class="roster-cell roster-name" data-label="Name">
                                    ${riderNameDisplay}
                                    ${medicalIcon}
                                    ${rider.phone ? `<a href="${formatPhoneForTel(rider.phone)}" class="roster-phone-icon" title="Call ${formatPhoneForDisplay(rider.phone)}" aria-label="Call ${formatPhoneForDisplay(rider.phone)}">📞</a>` : ''}
                                </div>`;
                            case 'actions':
                                return `<div class="roster-actions">
                                    <button class="btn-small" onclick="openEditRiderModal(${rider.id})">View/Edit Full Record</button>
                                </div>`;
                            default:
                                const additionalVal = rider[key] || '';
                                const colDef = columnPool.find(c => c.key === key);
                                return `<div class="roster-cell" data-label="${escapeHtml(colDef ? colDef.label : key)}">${escapeHtml(String(additionalVal))}</div>`;
                        }
                    });
                    htmlContent += `
                        <div class="roster-row rider-grid-template roster-row-archived" data-rider-id="${rider.id}" style="grid-template-columns: ${gridTemplate};">
                            ${rowCells.join('')}
                        </div>
                    `;
                });
            }

            if (archivedCount > 0) {
                htmlContent += `<div style="text-align:center; padding:8px;">
                    <button class="btn-small secondary show-archived-btn" onclick="toggleShowArchivedRiders()">${showArchivedRiders ? 'Hide' : 'Show'} Archived Riders (${archivedCount})</button>
                </div>`;
            }

            list.innerHTML = htmlContent;

            requestAnimationFrame(() => { if (typeof syncSkillHeaderWrap === 'function') syncSkillHeaderWrap(); });

            // Update CSV button label based on roster state
            const csvBtn = document.getElementById('btn-csv-riders');
            if (csvBtn) {
                const activeRiders = data.riders.filter(r => !r.archived);
                csvBtn.textContent = activeRiders.length > 0 ? 'Update Riders from CSV' : 'Import Riders from CSV';
            }
        }

        // ============ RIDER ABSENCE FUNCTIONS ============

        function renderRiderAbsencesList(riderId) {
            const container = document.getElementById('edit-rider-absences-list');
            if (!container) return;
            const absences = getAbsencesForPerson('rider', riderId);
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
                    <button class="absence-delete-btn" onclick="removeRiderAbsence(${a.id})" title="Remove absence">✕</button>
                </div>`;
            }).join('');
        }

        function showRiderAbsenceForm() {
            const form = document.getElementById('edit-rider-absence-form');
            if (form) {
                form.style.display = 'block';
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('edit-rider-absence-start').value = today;
                document.getElementById('edit-rider-absence-end').value = today;
                document.getElementById('edit-rider-absence-reason').value = 'injured';
            }
            const addBtn = document.getElementById('edit-rider-add-absence-btn');
            if (addBtn) addBtn.style.display = 'none';
        }

        function cancelRiderAbsenceForm() {
            const form = document.getElementById('edit-rider-absence-form');
            if (form) form.style.display = 'none';
            const addBtn = document.getElementById('edit-rider-add-absence-btn');
            if (addBtn) addBtn.style.display = '';
        }

        async function saveRiderAbsence() {
            if (!currentEditingRiderId) return;
            const startDate = document.getElementById('edit-rider-absence-start').value;
            const endDate = document.getElementById('edit-rider-absence-end').value;
            const reason = document.getElementById('edit-rider-absence-reason').value;

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
                    personType: 'rider',
                    personId: currentEditingRiderId,
                    startDate: startDate,
                    endDate: endDate,
                    reason: reason
                });
                data.scheduledAbsences.push(newAbsence);
                renderRiderAbsencesList(currentEditingRiderId);
                cancelRiderAbsenceForm();
            } catch (err) {
                console.error('Failed to save rider absence:', err);
                alert('Failed to save absence. Please try again.');
            }
        }

        async function removeRiderAbsence(absenceId) {
            if (!confirm('Remove this scheduled absence?')) return;
            try {
                await deleteScheduledAbsence(absenceId);
                data.scheduledAbsences = data.scheduledAbsences.filter(a => a.id !== absenceId);
                if (currentEditingRiderId) {
                    renderRiderAbsencesList(currentEditingRiderId);
                }
            } catch (err) {
                console.error('Failed to remove rider absence:', err);
                alert('Failed to remove absence. Please try again.');
            }
        }

