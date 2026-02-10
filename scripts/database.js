// API Wrapper Functions for Supabase Database Operations
// Note: Don't initialize client here - it will be initialized by supabase-config.js

// ============ RIDERS ============

async function getAllRiders() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('riders')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error fetching riders:', error);
        return [];
    }
    
    // Map database structure to app structure
    return (data || []).map(rider => ({
        ...(rider.extra_data || {}),
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        email: rider.email,
        grade: rider.grade,
        gender: rider.gender,
        racingGroup: rider.racing_group,
        fitness: rider.fitness,
        skills: rider.skills,
        photo: rider.photo,
        notes: rider.notes
    }));
}

async function getRiderById(id) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('riders')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching rider:', error);
        return null;
    }
    
    // Map database structure to app structure
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        grade: data.grade,
        gender: data.gender,
        racingGroup: data.racing_group,
        fitness: data.fitness,
        skills: data.skills,
        photo: data.photo,
        notes: data.notes
    };
}

async function createRider(riderData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {
        name: riderData.name,
        phone: riderData.phone,
        email: riderData.email || null,
        grade: riderData.grade,
        gender: riderData.gender,
        racing_group: riderData.racing_group || riderData.racingGroup,
        fitness: riderData.fitness,
        skills: riderData.skills,
        photo: riderData.photo || null,
        notes: riderData.notes || null,
        extra_data: (() => {
            const { id, ...rest } = riderData || {};
            return rest;
        })()
    };
    
    const { data, error } = await client
        .from('riders')
        .insert([dbData])
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        grade: data.grade,
        gender: data.gender,
        racingGroup: data.racing_group,
        fitness: data.fitness,
        photo: data.photo,
        notes: data.notes
    };
}

async function updateRider(id, riderData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {};
    if (riderData.name !== undefined) dbData.name = riderData.name;
    if (riderData.phone !== undefined) dbData.phone = riderData.phone;
    if (riderData.email !== undefined) dbData.email = riderData.email;
    if (riderData.grade !== undefined) dbData.grade = riderData.grade;
    if (riderData.gender !== undefined) dbData.gender = riderData.gender;
    if (riderData.racing_group !== undefined) dbData.racing_group = riderData.racing_group;
    if (riderData.racingGroup !== undefined) dbData.racing_group = riderData.racingGroup;
    if (riderData.fitness !== undefined) dbData.fitness = riderData.fitness;
    if (riderData.skills !== undefined) dbData.skills = riderData.skills;
    if (riderData.photo !== undefined) dbData.photo = riderData.photo;
    if (riderData.notes !== undefined) dbData.notes = riderData.notes;
    if (riderData.extra_data !== undefined) dbData.extra_data = riderData.extra_data;
    if (riderData.extraData !== undefined) dbData.extra_data = riderData.extraData;
    
    const { data, error } = await client
        .from('riders')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        grade: data.grade,
        gender: data.gender,
        racingGroup: data.racing_group,
        fitness: data.fitness,
        photo: data.photo,
        notes: data.notes
    };
}

async function deleteRider(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('riders')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

// Alias for consistency
async function deleteRiderFromDB(id) {
    return deleteRider(id);
}

// ============ COACHES ============

async function getAllCoaches() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('coaches')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error fetching coaches:', error);
        return [];
    }
    
    // Map database structure to app structure
    return (data || []).map(coach => ({
        ...(coach.extra_data || {}),
        id: coach.id,
        name: coach.name,
        phone: coach.phone,
        email: coach.email,
        level: coach.level,
        coachingLicenseLevel: coach.level,
        fitness: coach.fitness,
        skills: coach.skills,
        photo: coach.photo,
        notes: coach.notes,
        user_id: coach.user_id
    }));
}

async function getCoachById(id) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('coaches')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching coach:', error);
        return null;
    }
    
    // Map database structure to app structure
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        level: data.level,
        coachingLicenseLevel: data.level,
        fitness: data.fitness,
        skills: data.skills,
        photo: data.photo,
        notes: data.notes,
        user_id: data.user_id
    };
}

async function createCoach(coachData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const dbData = {
        name: coachData.name,
        phone: coachData.phone || null,
        email: coachData.email || null,
        level: coachData.coachingLicenseLevel || coachData.level || '1',
        fitness: coachData.fitness || '5',
        skills: coachData.skills || null,
        photo: coachData.photo || null,
        notes: coachData.notes || null,
        extra_data: (() => {
            const { id, ...rest } = coachData || {};
            return rest;
        })()
    };
    
    const { data, error } = await client
        .from('coaches')
        .insert([dbData])
        .select()
        .single();
    
    if (error) throw error;
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        level: data.level,
        coachingLicenseLevel: data.level,
        fitness: data.fitness,
        skills: data.skills,
        photo: data.photo,
        notes: data.notes,
        user_id: data.user_id
    };
}

async function updateCoach(id, coachData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const dbData = {};
    if (coachData.name !== undefined) dbData.name = coachData.name;
    if (coachData.phone !== undefined) dbData.phone = coachData.phone;
    if (coachData.email !== undefined) dbData.email = coachData.email;
    if (coachData.level !== undefined) dbData.level = coachData.level;
    if (coachData.coachingLicenseLevel !== undefined) dbData.level = coachData.coachingLicenseLevel;
    if (coachData.fitness !== undefined) dbData.fitness = coachData.fitness;
    if (coachData.skills !== undefined) dbData.skills = coachData.skills;
    if (coachData.photo !== undefined) dbData.photo = coachData.photo;
    if (coachData.notes !== undefined) dbData.notes = coachData.notes;
    if (coachData.extra_data !== undefined) dbData.extra_data = coachData.extra_data;
    if (coachData.extraData !== undefined) dbData.extra_data = coachData.extraData;
    
    const { data, error } = await client
        .from('coaches')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    return {
        ...(data.extra_data || {}),
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        level: data.level,
        coachingLicenseLevel: data.level,
        fitness: data.fitness,
        skills: data.skills,
        photo: data.photo,
        notes: data.notes,
        user_id: data.user_id
    };
}

async function deleteCoachRecord(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('coaches')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

// Alias for consistency
async function deleteCoachFromDB(id) {
    return deleteCoachRecord(id);
}

// ============ RIDES ============
// Single schema: add new ride fields here only. Write/read use this map so nothing is dropped.
// To add a new ride setting: 1) Add DB column (migration) if not using settings JSONB.
// 2) Add one entry to RIDE_APP_TO_DB (appKey: 'db_column'). Unknown app keys auto-go to settings JSONB.
/** App key -> DB column name. */
const RIDE_APP_TO_DB = {
    date: 'date',
    time: 'time',
    endTime: 'end_time',
    description: 'description',
    meetLocation: 'meet_location',
    locationLat: 'location_lat',
    locationLng: 'location_lng',
    goals: 'goals',
    availableCoaches: 'available_coaches',
    availableRiders: 'available_riders',
    assignments: 'assignments',
    groups: 'groups',
    cancelled: 'cancelled',
    cancellationReason: 'cancellation_reason',
    deleted: 'deleted',
    rescheduledFrom: 'rescheduled_from',
    publishedGroups: 'published_groups',
    settings: 'settings'
};
/** DB column -> app key (for load) */
const RIDE_DB_TO_APP = Object.fromEntries(Object.entries(RIDE_APP_TO_DB).map(([app, db]) => [db, app]));

/**
 * Build DB payload from app ride. Uses RIDE_APP_TO_DB; unknown app keys go into settings JSONB.
 * Call this from saveRideToDB and updateRide so all fields persist.
 */
function buildRideDbData(rideData) {
    const dbData = {};
    const knownAppKeys = new Set(Object.keys(RIDE_APP_TO_DB));
    const extra = {};

    for (const [appKey, dbKey] of Object.entries(RIDE_APP_TO_DB)) {
        if (appKey === 'settings') continue; // filled from extra below
        const value = rideData[appKey];
        if (value === undefined && dbKey !== 'deleted') continue;
        if (dbKey === 'groups') {
            dbData.groups = JSON.parse(JSON.stringify(Array.isArray(rideData.groups) ? rideData.groups : []));
        } else if (dbKey === 'assignments') {
            dbData.assignments = rideData.assignments && typeof rideData.assignments === 'object' ? rideData.assignments : {};
        } else if (dbKey === 'deleted') {
            dbData.deleted = rideData.deleted === true ? true : (rideData.deleted === false ? false : false);
        } else if (dbKey === 'settings') {
            // skip, we'll set from extra
        } else if (dbKey === 'available_riders' || dbKey === 'available_coaches') {
            // Always send arrays so attendance/availability persists (use empty array if undefined)
            dbData[dbKey] = Array.isArray(value) ? value : [];
        } else {
            dbData[dbKey] = value;
        }
    }

    for (const k of Object.keys(rideData || {})) {
        if (k === 'id' || k === 'isPersisted' || knownAppKeys.has(k)) continue;
        const v = rideData[k];
        if (v !== undefined) extra[k] = v;
    }
    // Store rescheduledFrom in settings as fallback when rescheduled_from column is missing
    if (rideData.rescheduledFrom !== undefined && rideData.rescheduledFrom !== null) {
        extra.rescheduledFrom = rideData.rescheduledFrom;
    }
    // Store availableRiders in settings so attendance persists even if available_riders column is missing or RLS omits it
    if (Array.isArray(rideData.availableRiders)) {
        extra.availableRiders = rideData.availableRiders;
    }
    if (Object.keys(extra).length > 0) dbData.settings = extra;

    return dbData;
}

/**
 * Map DB row to app ride. Uses RIDE_DB_TO_APP; settings JSONB is merged onto the result.
 */
function mapRideDbToApp(row) {
    if (!row) return null;
    const result = { id: row.id, isPersisted: true };
    for (const [dbKey, appKey] of Object.entries(RIDE_DB_TO_APP)) {
        if (appKey === 'settings') continue;
        let value = row[dbKey];
        if (dbKey === 'groups') value = Array.isArray(value) ? value : [];
        else if (dbKey === 'deleted') value = value === true ? true : (value === false ? false : false);
        else if (dbKey === 'end_time') value = value ?? '';
        else if (dbKey === 'meet_location') value = value ?? '';
        else if (dbKey === 'available_coaches') value = value || [];
        else if (dbKey === 'available_riders') value = value || [];
        else if (dbKey === 'cancellation_reason') value = value ?? '';
        else if (dbKey === 'rescheduled_from') {
            value = value ?? null;
            // Normalize to YYYY-MM-DD for consistent comparison (DB may return ISO timestamp)
            if (value && typeof value === 'string') {
                const normalized = value.substring(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) value = normalized;
            }
        }
        else if (dbKey === 'published_groups') value = value ?? false;
        result[appKey] = value;
    }
    if (row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)) {
        Object.assign(result, row.settings);
    }
    // Normalize rescheduledFrom from settings fallback (column may be missing)
    if (result.rescheduledFrom && typeof result.rescheduledFrom === 'string') {
        const n = result.rescheduledFrom.substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(n)) result.rescheduledFrom = n;
    }
    // Use settings.availableRiders as source of truth when present (column may not persist due to RLS/schema)
    if (row.settings && Array.isArray(row.settings.availableRiders)) {
        result.availableRiders = row.settings.availableRiders;
    }
    return result;
}

async function getAllRides() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('rides')
        .select('*')
        .order('date', { ascending: false });
    
    if (error) {
        console.error('Error fetching rides:', error);
        return [];
    }
    
    
    // Map database structure to app structure (single schema)
    const mapped = (data || []).map(ride => mapRideDbToApp(ride));

    return mapped;
}

async function getRideById(id) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('rides')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching ride:', error);
        return null;
    }
    
    return mapRideDbToApp(data);
}

async function createRide(rideData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const dbData = buildRideDbData(rideData);
    const { data, error } = await client
        .from('rides')
        .insert([dbData])
        .select()
        .single();
    if (error) throw error;
    return mapRideDbToApp(data);
}

async function updateRide(id, rideData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const dbData = buildRideDbData(rideData);
    // Debug: confirm attendance payload being sent
    const ar = dbData.available_riders;
    const setAr = dbData.settings && dbData.settings.availableRiders;
    console.log('🟢 updateRide: Payload for ride', id, '| available_riders length:', Array.isArray(ar) ? ar.length : '-', '| settings.availableRiders length:', Array.isArray(setAr) ? setAr.length : '-');
    // Update the record - don't use .single() as RLS might prevent row return
    const { data, error, count } = await client
        .from('rides')
        .update(dbData)
        .eq('id', id)
        .select();
    if (error) {
        console.error('🔴 updateRide: Supabase error', error.code, error.message);
    } else {
        const row = Array.isArray(data) ? data[0] : data;
        const back = row && row.settings && row.settings.availableRiders;
        console.log('🟢 updateRide: Supabase OK | rows returned:', Array.isArray(data) ? data.length : (data ? 1 : 0), '| settings.availableRiders after save:', Array.isArray(back) ? back.length : (back != null ? 'present' : 'missing'));
    }
    if (error) {
        console.error('📥 updateRide: Update error:', error);
        // If it's a PGRST116 (no rows), check if it's because RLS blocked the return
        // The update might have succeeded even if we can't read it back
        if (error.code === 'PGRST116') {
            // Try to verify the update succeeded by checking count
            // If we can't verify, assume it succeeded (RLS blocking read)
            console.warn('Update may have succeeded but RLS prevented reading back the row');
            // Return the input data as confirmation (include deleted field)
            return {
                id: id,
                date: rideData.date,
                availableCoaches: rideData.availableCoaches || [],
                availableRiders: rideData.availableRiders || [],
                assignments: rideData.assignments || {},
                groups: rideData.groups || [],
                cancelled: rideData.cancelled || false,
                deleted: rideData.deleted === true ? true : (rideData.deleted === false ? false : false),
                rescheduledFrom: rideData.rescheduledFrom ?? null,
                publishedGroups: rideData.publishedGroups || false,
                isPersisted: true
            };
        }
        throw error;
    }
    
    if (data && data.length > 0) {
        const result = mapRideDbToApp(data[0]);
        if (rideData.groups !== undefined) result.groups = rideData.groups;
        return result;
    }
    return { id, ...rideData, isPersisted: true };
}

async function deleteRide(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('rides')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

// ============ RIDER FEEDBACK ============

async function getRiderFeedback(rideId, riderId = null) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    let query = client
        .from('rider_feedback')
        .select('*')
        .eq('ride_id', rideId);
    
    if (riderId) {
        query = query.eq('rider_id', riderId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching rider feedback:', error);
        return [];
    }
    return data || [];
}

async function createRiderFeedback(feedbackData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');
    
    const data = {
        ...feedbackData,
        coach_id: currentUser.id,
        created_at: new Date().toISOString()
    };
    
    const { data: result, error } = await client
        .from('rider_feedback')
        .insert([data])
        .select()
        .single();
    
    if (error) throw error;
    return result;
}

async function updateRiderFeedback(id, feedbackData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('rider_feedback')
        .update(feedbackData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ============ RIDE NOTES ============

async function getRideNotes(rideId) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('ride_notes')
        .select('*')
        .eq('ride_id', rideId)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching ride notes:', error);
        return null;
    }
    return data;
}

async function upsertRideNotes(rideId, notes) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await client
        .from('ride_notes')
        .upsert({
            ride_id: rideId,
            notes: notes,
            updated_by: currentUser.id,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ============ RIDER AVAILABILITY ============

async function getRiderAvailability(rideId) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('rider_availability')
        .select('*')
        .eq('ride_id', rideId);
    
    if (error) {
        console.error('Error fetching rider availability:', error);
        return [];
    }
    return data || [];
}

async function setRiderAvailability(rideId, riderId, available) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('rider_availability')
        .upsert({
            ride_id: rideId,
            rider_id: riderId,
            available: available,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ============ COLOR NAMES (for group color names feature) ============

async function getColorNames() {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
        .from('color_names')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true });
    if (error) {
        console.error('Error fetching color names:', error);
        return [];
    }
    return (data || []).map(row => ({ id: row.id, name: row.name, sortOrder: row.sort_order }));
}

// ============ SEASON SETTINGS ============
// Single schema: add new season setting fields here only.
/** App key -> DB column name. */
const SEASON_APP_TO_DB = {
    id: 'id',
    startDate: 'start_date',
    endDate: 'end_date',
    practices: 'practices',
    fitnessScale: 'fitness_scale',
    skillsScale: 'skills_scale',
    paceScaleOrder: 'pace_scale_order',
    groupPaceOrder: 'group_pace_order',
    csvFieldMappings: 'csv_field_mappings',
    timeEstimationSettings: 'time_estimation_settings',
    coachRoles: 'coach_roles',
    riderRoles: 'rider_roles',
    settings: 'settings'
};
const SEASON_DB_TO_APP = Object.fromEntries(Object.entries(SEASON_APP_TO_DB).map(([app, db]) => [db, app]));

const SEASON_DEFAULTS = {
    fitnessScale: 5,
    skillsScale: 3,
    paceScaleOrder: 'fastest_to_slowest',
    groupPaceOrder: 'fastest_to_slowest',
    timeEstimationSettings: {
        fastSpeedBase: 12.5,
        slowSpeedBase: 10,
        fastSpeedMin: 5.5,
        slowSpeedMin: 4,
        elevationAdjustment: 0.5,
        lengthAdjustmentFactor: 0.1
    }
};

function buildSeasonDbData(settings) {
    const dbData = { id: settings.id || 'current' };
    const knownAppKeys = new Set(Object.keys(SEASON_APP_TO_DB));
    const extra = {};
    for (const [appKey, dbKey] of Object.entries(SEASON_APP_TO_DB)) {
        if (appKey === 'id' || appKey === 'settings') continue;
        const value = settings[appKey] ?? settings[dbKey];
        if (value === undefined) continue;
        if (dbKey === 'start_date') dbData.start_date = value ?? null;
        else if (dbKey === 'end_date') dbData.end_date = value ?? null;
        else if (dbKey === 'practices') dbData.practices = Array.isArray(value) ? value : [];
        else if (dbKey === 'coach_roles') dbData.coach_roles = Array.isArray(value) ? value : [];
        else if (dbKey === 'rider_roles') dbData.rider_roles = Array.isArray(value) ? value : [];
        else dbData[dbKey] = value;
    }
    for (const k of Object.keys(settings || {})) {
        if (knownAppKeys.has(k)) continue;
        const v = settings[k];
        if (v !== undefined) extra[k] = v;
    }
    if (Object.keys(extra).length > 0) dbData.settings = extra;
    return dbData;
}

function mapSeasonDbToApp(row) {
    if (!row) return null;
    const result = { id: row.id };
    result.startDate = row.start_date ?? null;
    result.endDate = row.end_date ?? null;
    result.start_date = row.start_date;
    result.end_date = row.end_date;
    result.practices = row.practices || [];
    result.fitnessScale = row.fitness_scale !== null && row.fitness_scale !== undefined ? row.fitness_scale : SEASON_DEFAULTS.fitnessScale;
    result.skillsScale = row.skills_scale !== null && row.skills_scale !== undefined ? row.skills_scale : SEASON_DEFAULTS.skillsScale;
    result.paceScaleOrder = row.pace_scale_order || SEASON_DEFAULTS.paceScaleOrder;
    result.groupPaceOrder = row.group_pace_order || SEASON_DEFAULTS.groupPaceOrder;
    result.csvFieldMappings = row.csv_field_mappings || {};
    result.coachRoles = Array.isArray(row.coach_roles) ? row.coach_roles : [];
    result.riderRoles = Array.isArray(row.rider_roles) ? row.rider_roles : [];
    result.timeEstimationSettings = row.time_estimation_settings && typeof row.time_estimation_settings === 'object'
        ? row.time_estimation_settings
        : SEASON_DEFAULTS.timeEstimationSettings;
    if (row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)) {
        Object.assign(result, row.settings);
    }
    return result;
}

async function getSeasonSettings() {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('season_settings')
        .select('*')
        .single();
    
    if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST301' || error.status === 406 || error.statusCode === 406) {
            return null;
        }
        if (error.message && !error.message.includes('Row Level Security')) {
            console.error('Error fetching season settings:', error);
        }
        return null;
    }
    return mapSeasonDbToApp(data);
}

async function updateSeasonSettings(settings) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const dbData = buildSeasonDbData(settings);
    const { data, error } = await client
        .from('season_settings')
        .upsert(dbData, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return mapSeasonDbToApp(data);
}

// ============ AUTO ASSIGN SETTINGS ============

async function getAutoAssignSettings() {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('auto_assign_settings')
        .select('*')
        .single();
    
    if (error) {
        // PGRST116 = no rows returned (expected if no settings exist)
        // 406 = Not Acceptable (RLS blocking - user doesn't have role, suppress error)
        // PGRST301 = similar to 406, RLS blocking
        if (error.code === 'PGRST116' || error.code === 'PGRST301' || error.status === 406 || error.statusCode === 406) {
            // Silently return null - this is expected for non-coach users
            return null;
        }
        // Only log unexpected errors (but don't spam console)
        if (error.message && !error.message.includes('Row Level Security')) {
            console.error('Error fetching auto assign settings:', error);
        }
        return null;
    }
    return data;
}

async function updateAutoAssignSettings(settings) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('auto_assign_settings')
        .upsert(settings, { onConflict: 'id' })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ============ USER ROLES ============

async function getUserRole(userId) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching user role:', error);
        return null;
    }
    return data ? data.role : null;
}

async function setUserRole(userId, role) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('user_roles')
        .upsert({
            user_id: userId,
            role: role
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAllUsersWithRoles() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    // This would typically require a join with auth.users, 
    // which might need a database function or view
    // For now, return user_roles and we'll handle user details separately
    const { data, error } = await client
        .from('user_roles')
        .select('*');
    
    if (error) {
        console.error('Error fetching users with roles:', error);
        return [];
    }
    return data || [];
}

// ============ ADMIN INVITATIONS ============

async function createAdminInvitation(email) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Get current user from Supabase session
    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) throw new Error('User must be authenticated');
    const currentUser = session.user;
    
    // Generate a secure token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const { data, error } = await client
        .from('admin_invitations')
        .insert([{
            email: email,
            token: token,
            created_by: currentUser.id,
            expires_at: expiresAt.toISOString()
        }])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAdminInvitationByToken(token) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('admin_invitations')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();
    
    if (error) {
        console.error('Error fetching invitation:', error);
        return null;
    }
    
    // Check if invitation has expired
    if (data && new Date(data.expires_at) < new Date()) {
        return null; // Expired
    }
    
    return data;
}

async function markInvitationAsUsed(token, userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('admin_invitations')
        .update({
            used: true,
            used_at: new Date().toISOString(),
            used_by: userId
        })
        .eq('token', token)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAllAdminInvitations() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('admin_invitations')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching invitations:', error);
        return [];
    }
    return data || [];
}

async function getAdminInvitationsByEmail(email) {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
        .from('admin_invitations')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching invitations by email:', error);
        return [];
    }
    return data || [];
}

async function expireAdminInvitationsByEmail(email) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const { data, error } = await client
        .from('admin_invitations')
        .update({
            used: true,
            used_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('used', false)
        .select();

    if (error) throw error;
    return data || [];
}

async function deleteAdminInvitation(invitationId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const { error } = await client
        .from('admin_invitations')
        .delete()
        .eq('id', invitationId);

    if (error) throw error;
    return true;
}

// ============ RACES ============

async function getAllRaces() {
    const client = getSupabaseClient();
    if (!client) {
        console.warn('getAllRaces: Supabase client not available');
        return [];
    }
    
    try {
        // Add timeout to prevent long waits (5 seconds max)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('getAllRaces timeout')), 5000)
        );
        
        const queryPromise = client
            .from('races')
            .select('*')
            .order('race_date', { ascending: true })
            .then(result => result); // Ensure it's a promise
        
        const result = await Promise.race([queryPromise, timeoutPromise]);
        const { data, error } = result;
        
        if (error) {
            // Log the error with more details
            console.error('Error fetching races:', error);
            console.error('Error code:', error.code, 'Error message:', error.message);
            // Don't throw - return empty array so app can continue
            return [];
        }
        
        // Map database structure to app structure
        const mappedRaces = (data || []).map(race => ({
            id: race.id,
            name: race.name,
            raceDate: race.race_date,
            preRideDate: race.pre_ride_date,
            location: race.location
        }));
        
        return mappedRaces;
    } catch (err) {
        if (err.message === 'getAllRaces timeout') {
            console.warn('getAllRaces: Query timed out after 5 seconds, returning empty array');
        } else {
            console.error('getAllRaces: Unexpected error:', err);
        }
        return [];
    }
}

async function createRace(raceData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {
        name: raceData.name,
        race_date: raceData.raceDate || raceData.race_date || null,
        pre_ride_date: raceData.preRideDate || raceData.pre_ride_date || null,
        location: raceData.location || null
    };
    
    const { data, error } = await client
        .from('races')
        .insert([dbData])
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
        id: data.id,
        name: data.name,
        raceDate: data.race_date,
        preRideDate: data.pre_ride_date,
        location: data.location
    };
}

async function updateRace(id, raceData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {
        name: raceData.name,
        race_date: raceData.raceDate || raceData.race_date || null,
        pre_ride_date: raceData.preRideDate || raceData.pre_ride_date || null,
        location: raceData.location || null
    };
    
    const { data, error } = await client
        .from('races')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
        id: data.id,
        name: data.name,
        raceDate: data.race_date,
        preRideDate: data.pre_ride_date,
        location: data.location
    };
}

async function deleteRace(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('races')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

async function upsertAllRaces(racesArray) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Get all existing races
    const existingRaces = await getAllRaces();
    const existingRaceIds = new Set(existingRaces.map(r => r.id));
    const newRaceIds = new Set(racesArray.map(r => r.id).filter(id => id != null));
    
    // Delete races that are no longer in the array
    const racesToDelete = existingRaces.filter(r => !newRaceIds.has(r.id));
    for (const race of racesToDelete) {
        await deleteRace(race.id);
    }
    
    // Upsert all races (insert new, update existing)
    // For races with IDs that exist in the database, update them
    // For races without IDs or with IDs that don't exist, create new ones
    for (const race of racesArray) {
        // Only process races with at least a name or date
        if (!race.name && !race.raceDate) continue;
        
        if (race.id && existingRaceIds.has(race.id)) {
            // Update existing race
            await updateRace(race.id, race);
        } else {
            // Create new race (database will generate ID)
            await createRace(race);
        }
    }
    
    // Return all races after upsert
    return await getAllRaces();
}

// ============ ROUTES ============

async function getAllRoutes() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('routes')
        .select('*')
        .order('name');
    
    if (error) {
        console.error('Error fetching routes:', error);
        return [];
    }
    
    // Map database structure to app structure
    return (data || []).map(route => ({
        id: route.id,
        name: route.name,
        description: route.description,
        stravaEmbedCode: route.strava_embed_code,
        stravaUrl: route.strava_url || null,
        cachedPreviewDataUrl: route.cached_preview_data_url || null,
        distance: route.distance || null,
        elevation: route.elevation || null,
        estimatedTime: route.estimated_time || null,
        fitnessMin: route.fitness_min || 1,
        fitnessMax: route.fitness_max || null,
        skillsMin: route.skills_min || 1,
        skillsMax: route.skills_max || null
    }));
}

async function getRouteById(id) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('routes')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error fetching route:', error);
        return null;
    }
    
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        stravaEmbedCode: data.strava_embed_code,
        stravaUrl: data.strava_url || null,
        cachedPreviewDataUrl: data.cached_preview_data_url || null,
        distance: data.distance || null,
        elevation: data.elevation || null,
        estimatedTime: data.estimated_time || null,
        fitnessMin: data.fitness_min || 1,
        fitnessMax: data.fitness_max || null,
        skillsMin: data.skills_min || 1,
        skillsMax: data.skills_max || null
    };
}

async function createRoute(route) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('routes')
        .insert({
            name: route.name,
            description: route.description || null,
            strava_embed_code: route.stravaEmbedCode || null,
            strava_url: route.stravaUrl || null,
            cached_preview_data_url: route.cachedPreviewDataUrl || null,
            distance: route.distance || null,
            elevation: route.elevation || null,
            estimated_time: route.estimatedTime || null,
            fitness_min: route.fitnessMin || 1,
            fitness_max: route.fitnessMax || null,
            skills_min: route.skillsMin || 1,
            skills_max: route.skillsMax || null
        })
        .select()
        .single();
    
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        stravaEmbedCode: data.strava_embed_code,
        stravaUrl: data.strava_url || null,
        cachedPreviewDataUrl: data.cached_preview_data_url || null,
        distance: data.distance || null,
        elevation: data.elevation || null,
        estimatedTime: data.estimated_time || null,
        fitnessMin: data.fitness_min || 1,
        fitnessMax: data.fitness_max || null,
        skillsMin: data.skills_min || 1,
        skillsMax: data.skills_max || null
    };
}

async function updateRoute(id, route) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('routes')
        .update({
            name: route.name,
            description: route.description || null,
            strava_embed_code: route.stravaEmbedCode || null,
            strava_url: route.stravaUrl || null,
            cached_preview_data_url: route.cachedPreviewDataUrl || null,
            distance: route.distance || null,
            elevation: route.elevation || null,
            estimated_time: route.estimatedTime || null,
            fitness_min: route.fitnessMin || 1,
            fitness_max: route.fitnessMax || null,
            skills_min: route.skillsMin || 1,
            skills_max: route.skillsMax || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        stravaEmbedCode: data.strava_embed_code,
        stravaUrl: data.strava_url || null,
        distance: data.distance || null,
        elevation: data.elevation || null,
        estimatedTime: data.estimated_time || null,
        fitnessMin: data.fitness_min || 1,
        fitnessMax: data.fitness_max || null,
        skillsMin: data.skills_min || 1,
        skillsMax: data.skills_max || null
    };
}

async function deleteRoute(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('routes')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

// ============ BACKUPS ============

async function createBackup(backupName, backupData, backupType = 'manual') {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const currentUser = getCurrentUser();
    const { data, error } = await client
        .from('backups')
        .insert({
            backup_name: backupName,
            backup_data: backupData,
            created_by: currentUser ? currentUser.id : null,
            backup_type: backupType
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAllBackups() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    const { data, error } = await client
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching backups:', error);
        return [];
    }
    return data || [];
}

async function getBackupById(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('backups')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) throw error;
    return data;
}

async function deleteBackup(id) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client
        .from('backups')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

// ============ USERS ============

// Get all users with their roles and login info
// Note: This requires a database function or view to access auth.users
// For now, we'll query user_roles and coaches/riders tables to get user info
async function getAllUsersWithLoginInfo() {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        // Prefer RPC that can access auth.users (coach-admins only)
        const { data: rpcUsers, error: rpcError } = await client
            .rpc('get_users_with_auth');

        if (!rpcError && Array.isArray(rpcUsers)) {
            return rpcUsers.map(user => ({
                id: user.user_id,
                role: user.role,
                email: user.email || null,
                name: user.name || null,
                phone: user.phone || null,
                createdAt: user.created_at || null,
                lastLogin: null,
                matchedType: user.matched_type || null,
                matchedId: user.matched_id || null,
                isDisabled: user.is_disabled === true
            }));
        }

        if (rpcError) {
            console.warn('RPC get_users_with_auth failed, falling back:', rpcError);
        }

        // Get all user roles
        const { data: userRoles, error: rolesError } = await client
            .from('user_roles')
            .select('*');
        
        if (rolesError) {
            console.error('Error fetching user roles:', rolesError);
            return [];
        }
        
        // For each user, try to get email from coaches or riders table
        // Note: We can't directly query auth.users from the client
        // This is a limitation - we'd need a database function to join with auth.users
        const users = [];
        
        for (const userRole of (userRoles || [])) {
            // Try to find email in coaches table
            const { data: coach } = await client
                .from('coaches')
                .select('email, name, phone')
                .eq('user_id', userRole.user_id)
                .maybeSingle();
            
            // Try to find email in riders table (if rider role)
            let rider = null;
            if (userRole.role === 'rider') {
                // We'd need to match by phone or email, which is complex
                // For now, just use what we have
            }
            
            users.push({
                id: userRole.user_id,
                role: userRole.role,
                email: coach?.email || null,
                name: coach?.name || null,
                phone: coach?.phone || null,
                createdAt: userRole.created_at,
                lastLogin: null // Would need auth.users access to get this
            });
        }
        
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

async function disableAdminUser(userId, email) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const { data: { session } } = await client.auth.getSession();
    if (!session || !session.user) throw new Error('User must be authenticated');

    const { error: insertError } = await client
        .from('admin_disabled_users')
        .insert([{
            user_id: userId,
            email: email || null,
            disabled_by: session.user.id
        }]);
    if (insertError) throw insertError;

    const { error: deleteError } = await client
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'coach-admin');
    if (deleteError) throw deleteError;
}

async function enableAdminUser(userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');

    const { error: deleteError } = await client
        .from('admin_disabled_users')
        .delete()
        .eq('user_id', userId);
    if (deleteError) throw deleteError;

    const { error: upsertError } = await client
        .from('user_roles')
        .upsert([{
            user_id: userId,
            role: 'coach-admin'
        }], { onConflict: 'user_id' });
    if (upsertError) throw upsertError;
}

// ============ ADMIN EDIT LOCK ============

async function getAdminEditLock() {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
        .from('admin_edit_locks')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();
    if (error) {
        console.warn('Error fetching admin edit lock:', error);
        return null;
    }
    return data || null;
}

async function upsertAdminEditLock(lockInfo) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    const { error } = await client
        .from('admin_edit_locks')
        .upsert([{
            id: 'current',
            user_id: lockInfo.user_id,
            email: lockInfo.email || null,
            user_name: lockInfo.user_name || null,
            updated_at: new Date().toISOString()
        }], { onConflict: 'id' });
    if (error) throw error;
}

async function clearAdminEditLock(userId) {
    const client = getSupabaseClient();
    if (!client) return;
    // Only clear if the lock is owned by the current user
    const { data, error } = await client
        .from('admin_edit_locks')
        .select('user_id')
        .eq('id', 'current')
        .maybeSingle();
    if (error) {
        console.warn('Error checking admin edit lock owner:', error);
        return;
    }
    if (data && data.user_id === userId) {
        await client.from('admin_edit_locks').delete().eq('id', 'current');
    }
}

// ============ SIMPLIFIED LOGIN LOOKUP ============

// Normalize phone number by removing all non-digit characters
function normalizePhoneForLookup(phone) {
    if (!phone) return null;
    return phone.replace(/\D/g, '');
}

// Look up rider or coach by phone number or email
// Returns: { type: 'rider' | 'coach', id: number, name: string } or null
async function lookupUserByPhoneOrEmail(phoneOrEmail) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    if (!phoneOrEmail || !phoneOrEmail.trim()) return null;
    
    const searchValue = phoneOrEmail.trim();
    const normalizedPhone = normalizePhoneForLookup(searchValue);
    const isEmail = searchValue.includes('@');
    
    try {
        // Search by email first if it looks like an email
        if (isEmail) {
            // Search riders
            const { data: riderData, error: riderError } = await client
                .from('riders')
                .select('id, name, email')
                .eq('email', searchValue)
                .maybeSingle();
            
            if (!riderError && riderData) {
                return { type: 'rider', id: riderData.id, name: riderData.name };
            }
            
            // Search coaches
            const { data: coachData, error: coachError } = await client
                .from('coaches')
                .select('id, name, email')
                .eq('email', searchValue)
                .maybeSingle();
            
            if (!coachError && coachData) {
                return { type: 'coach', id: coachData.id, name: coachData.name };
            }
        }
        
        // Search by phone (try normalized and original formats)
        if (normalizedPhone && normalizedPhone.length >= 10) {
            // Get all riders and coaches, then filter by normalized phone
            // This approach handles various phone formats better
            const [ridersResult, coachesResult] = await Promise.all([
                client.from('riders').select('id, name, phone'),
                client.from('coaches').select('id, name, phone')
            ]);
            
            // Check riders
            if (ridersResult.data) {
                for (const rider of ridersResult.data) {
                    if (rider.phone) {
                        const riderPhoneNormalized = normalizePhoneForLookup(rider.phone);
                        // Match if last 10 digits match (handles country codes, formatting)
                        const inputLast10 = normalizedPhone.slice(-10);
                        const riderLast10 = riderPhoneNormalized.slice(-10);
                        if (inputLast10 === riderLast10 && riderLast10.length === 10) {
                            return { type: 'rider', id: rider.id, name: rider.name };
                        }
                    }
                }
            }
            
            // Check coaches
            if (coachesResult.data) {
                for (const coach of coachesResult.data) {
                    if (coach.phone) {
                        const coachPhoneNormalized = normalizePhoneForLookup(coach.phone);
                        // Match if last 10 digits match (handles country codes, formatting)
                        const inputLast10 = normalizedPhone.slice(-10);
                        const coachLast10 = coachPhoneNormalized.slice(-10);
                        if (inputLast10 === coachLast10 && coachLast10.length === 10) {
                            return { type: 'coach', id: coach.id, name: coach.name };
                        }
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error looking up user:', error);
        return null;
    }
}

// ============ VERIFICATION CODE FUNCTIONS ============

// Generate a random 6-digit code
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a verification code in the database
// Returns: { code: string, id: uuid }
async function createVerificationCode(phoneOrEmail, userType, userId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not available');
    
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    
    const { data, error } = await client
        .from('verification_codes')
        .insert({
            phone_or_email: phoneOrEmail.trim(),
            code: code,
            user_type: userType,
            user_id: userId,
            expires_at: expiresAt.toISOString(),
            verified: false
        })
        .select()
        .single();
    
    if (error) {
        console.error('Error creating verification code:', error);
        throw error;
    }
    
    return { code, id: data.id };
}

// Verify a code
// Returns: { valid: boolean, userType?: string, userId?: number, message?: string }
async function verifyCode(phoneOrEmail, code) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not available');
    
    const { data, error } = await client
        .from('verification_codes')
        .select('*')
        .eq('phone_or_email', phoneOrEmail.trim())
        .eq('code', code.trim())
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error) {
        console.error('Error verifying code:', error);
        throw error;
    }
    
    if (!data) {
        return { valid: false, message: 'Invalid or expired code. Please request a new code.' };
    }
    
    // Mark code as verified
    const { error: updateError } = await client
        .from('verification_codes')
        .update({ verified: true })
        .eq('id', data.id);
    
    if (updateError) {
        console.error('Error marking code as verified:', updateError);
        // Don't fail verification if update fails
    }
    
    return {
        valid: true,
        userType: data.user_type,
        userId: data.user_id
    };
}

// Send verification code via SMS or Email
// Returns: { success: boolean, method: 'sms' | 'email', error?: string }
async function sendVerificationCode(phoneOrEmail, code, isEmail = false) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not available');
    
    // Get the anon key and URL for anonymous access (needed for unauthenticated users)
    // The credentials should be exposed on window by supabase-config.js
    // If not on window, try to get from the client's internal config
    let anonKey = window.SUPABASE_ANON_KEY || '';
    let supabaseUrl = window.SUPABASE_URL || '';
    
    // Fallback: Try to get from client if available
    if (!anonKey && client) {
        // The Supabase client stores the key internally, but we can't access it directly
        // So we rely on window.SUPABASE_ANON_KEY being set by supabase-config.js
        console.warn('⚠️ SUPABASE_ANON_KEY not found on window. Make sure supabase-config.js is loaded before database.js');
    }
    
    if (!anonKey || !supabaseUrl) {
        console.error('❌ Missing Supabase credentials:', {
            hasAnonKey: !!anonKey,
            hasUrl: !!supabaseUrl,
            windowKeys: Object.keys(window).filter(k => k.includes('SUPABASE'))
        });
        throw new Error('Supabase credentials not available. Make sure supabase-config.js is loaded.');
    }
    
    try {
        // Use direct fetch to Edge Function with explicit headers for anonymous access
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-verification-code`;
        
        // Debug: Log what we're sending (without exposing the full key)
        console.log('🔐 Calling Edge Function:', {
            url: edgeFunctionUrl,
            hasAnonKey: !!anonKey,
            anonKeyPrefix: anonKey ? anonKey.substring(0, 20) + '...' : 'missing',
            isEmail: isEmail
        });
        
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({ phoneOrEmail, code, isEmail })
        });
        
        // Debug: Log response details
        console.log('📡 Edge Function Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Edge Function Error Response:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `Edge Function returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { 
            success: true, 
            method: isEmail ? 'email' : 'sms',
            data: data 
        };
    } catch (error) {
        console.error('Error sending verification code:', error);
        // If Edge Function doesn't exist, log the code (for development)
        if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
            console.warn('Edge Function not found - code would be:', code);
            // In development, you might want to show the code in an alert
            return { success: false, method: isEmail ? 'email' : 'sms', error: 'Sending service not configured' };
        }
        throw error;
    }
}
