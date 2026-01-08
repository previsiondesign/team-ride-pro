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
        notes: riderData.notes || null
    };
    
    const { data, error } = await client
        .from('riders')
        .insert([dbData])
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
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
    
    const { data, error } = await client
        .from('riders')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
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
        id: coach.id,
        name: coach.name,
        phone: coach.phone,
        email: coach.email,
        level: coach.level,
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
        id: data.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        level: data.level,
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
    
    const { data, error } = await client
        .from('coaches')
        .insert([coachData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function updateCoach(id, coachData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client
        .from('coaches')
        .update(coachData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function deleteCoach(id) {
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
    return deleteCoach(id);
}

// ============ RIDES ============

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
    
    // Map database structure to app structure
    return (data || []).map(ride => ({
        id: ride.id,
        date: ride.date,
        availableCoaches: ride.available_coaches || [],
        availableRiders: ride.available_riders || [],
        assignments: ride.assignments || {},
        groups: ride.groups || [],
        cancelled: ride.cancelled || false,
        publishedGroups: ride.published_groups || false
    }));
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
    
    // Map database structure to app structure
    return {
        id: data.id,
        date: data.date,
        availableCoaches: data.available_coaches || [],
        availableRiders: data.available_riders || [],
        assignments: data.assignments || {},
        groups: data.groups || [],
        cancelled: data.cancelled || false,
        publishedGroups: data.published_groups || false,
        endTime: data.end_time || data.endTime || ''
    };
}

async function createRide(rideData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {
        date: rideData.date,
        available_coaches: rideData.availableCoaches || rideData.available_coaches || [],
        available_riders: rideData.availableRiders || rideData.available_riders || [],
        assignments: rideData.assignments || {},
        groups: rideData.groups || [],
        cancelled: rideData.cancelled || false,
        published_groups: rideData.publishedGroups || rideData.published_groups || false
    };
    
    const { data, error } = await client
        .from('rides')
        .insert([dbData])
        .select()
        .single();
    
    if (error) throw error;
    
    // Map back to app structure
    return {
        id: data.id,
        date: data.date,
        availableCoaches: data.available_coaches || [],
        availableRiders: data.available_riders || [],
        assignments: data.assignments || {},
        groups: data.groups || [],
        cancelled: data.cancelled || false,
        publishedGroups: data.published_groups || false
    };
}

async function updateRide(id, rideData) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app structure to database structure
    const dbData = {};
    if (rideData.date !== undefined) dbData.date = rideData.date;
    if (rideData.availableCoaches !== undefined) dbData.available_coaches = rideData.availableCoaches;
    if (rideData.available_riders !== undefined) dbData.available_riders = rideData.available_riders;
    if (rideData.availableRiders !== undefined) dbData.available_riders = rideData.availableRiders;
    if (rideData.assignments !== undefined) dbData.assignments = rideData.assignments;
    if (rideData.groups !== undefined) dbData.groups = rideData.groups;
    if (rideData.cancelled !== undefined) dbData.cancelled = rideData.cancelled;
    if (rideData.publishedGroups !== undefined) dbData.published_groups = rideData.publishedGroups;
    if (rideData.published_groups !== undefined) dbData.published_groups = rideData.published_groups;
    
    // Update the record - don't use .single() as RLS might prevent row return
    const { data, error, count } = await client
        .from('rides')
        .update(dbData)
        .eq('id', id)
        .select();
    
    if (error) {
        // If it's a PGRST116 (no rows), check if it's because RLS blocked the return
        // The update might have succeeded even if we can't read it back
        if (error.code === 'PGRST116') {
            // Try to verify the update succeeded by checking count
            // If we can't verify, assume it succeeded (RLS blocking read)
            console.warn('Update may have succeeded but RLS prevented reading back the row');
            // Return the input data as confirmation
            return {
                id: id,
                date: rideData.date,
                availableCoaches: rideData.availableCoaches || [],
                availableRiders: rideData.availableRiders || [],
                assignments: rideData.assignments || {},
                groups: rideData.groups || [],
                cancelled: rideData.cancelled || false,
                publishedGroups: rideData.publishedGroups || false
            };
        }
        throw error;
    }
    
    // If we got data back, use it; otherwise return the input data
    if (data && data.length > 0) {
        const updated = data[0];
            return {
                id: updated.id,
                date: updated.date,
                availableCoaches: updated.available_coaches || [],
                availableRiders: updated.available_riders || [],
                assignments: updated.assignments || {},
                groups: updated.groups || [],
                cancelled: updated.cancelled || false,
                publishedGroups: updated.published_groups || false
            };
    } else {
        // Update succeeded but no data returned (RLS blocking)
        // Return the input data as confirmation
        return {
            id: id,
            date: rideData.date,
            availableCoaches: rideData.availableCoaches || [],
            availableRiders: rideData.availableRiders || [],
            assignments: rideData.assignments || {},
            groups: rideData.groups || [],
            cancelled: rideData.cancelled || false
        };
    }
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

// ============ SEASON SETTINGS ============

async function getSeasonSettings() {
    const client = getSupabaseClient();
    if (!client) return null;
    
    const { data, error } = await client
        .from('season_settings')
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
            console.error('Error fetching season settings:', error);
        }
        return null;
    }
    
    // Map database format to app format
    const result = {
        id: data.id,
        start_date: data.start_date,
        end_date: data.end_date,
        startDate: data.start_date,
        endDate: data.end_date,
        practices: data.practices || [],
        fitnessScale: data.fitness_scale !== null && data.fitness_scale !== undefined ? data.fitness_scale : 5,
        skillsScale: data.skills_scale !== null && data.skills_scale !== undefined ? data.skills_scale : 3
    };
    
    // Map time_estimation_settings from database to app format
    if (data.time_estimation_settings) {
        result.timeEstimationSettings = data.time_estimation_settings;
    } else {
        // Provide defaults if not present
        result.timeEstimationSettings = {
            fastSpeedBase: 12.5,
            slowSpeedBase: 10,
            fastSpeedMin: 5.5,
            slowSpeedMin: 4,
            elevationAdjustment: 0.5,
            lengthAdjustmentFactor: 0.1
        };
    }
    
    return result;
}

async function updateSeasonSettings(settings) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    // Map app format to database format
    const dbData = {
        id: settings.id || 'current',
        start_date: settings.start_date || settings.startDate || null,
        end_date: settings.end_date || settings.endDate || null,
        practices: settings.practices || []
    };
    
    // Map scale settings (fitnessScale -> fitness_scale, skillsScale -> skills_scale)
    if (settings.fitnessScale !== undefined) {
        dbData.fitness_scale = settings.fitnessScale;
    }
    if (settings.skillsScale !== undefined) {
        dbData.skills_scale = settings.skillsScale;
    }
    
    // Map timeEstimationSettings to time_estimation_settings
    if (settings.timeEstimationSettings !== undefined) {
        dbData.time_estimation_settings = settings.timeEstimationSettings;
    }
    
    const { data, error } = await client
        .from('season_settings')
        .upsert(dbData, { onConflict: 'id' })
        .select()
        .single();
    
    if (error) throw error;
    
    // Map database format back to app format
    const result = {
        id: data.id,
        start_date: data.start_date,
        end_date: data.end_date,
        startDate: data.start_date,
        endDate: data.end_date,
        practices: data.practices || [],
        fitnessScale: data.fitness_scale !== null && data.fitness_scale !== undefined ? data.fitness_scale : 5,
        skillsScale: data.skills_scale !== null && data.skills_scale !== undefined ? data.skills_scale : 3
    };
    
    // Map time_estimation_settings back to app format
    if (data.time_estimation_settings) {
        result.timeEstimationSettings = data.time_estimation_settings;
    } else {
        result.timeEstimationSettings = {
            fastSpeedBase: 12.5,
            slowSpeedBase: 10,
            fastSpeedMin: 5.5,
            slowSpeedMin: 4,
            elevationAdjustment: 0.5,
            lengthAdjustmentFactor: 0.1
        };
    }
    
    return result;
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

// ============ RACES ============

async function getAllRaces() {
    const client = getSupabaseClient();
    if (!client) {
        console.warn('getAllRaces: Supabase client not available');
        return [];
    }
    
    const { data, error } = await client
        .from('races')
        .select('*')
        .order('race_date', { ascending: true });
    
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
    
    console.log('getAllRaces: Loaded', mappedRaces.length, 'races from database');
    return mappedRaces;
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
        stravaEmbedCode: route.strava_embed_code
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
        stravaEmbedCode: data.strava_embed_code
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
            strava_embed_code: route.stravaEmbedCode
        })
        .select()
        .single();
    
    if (error) throw error;
    
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        stravaEmbedCode: data.strava_embed_code
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
            strava_embed_code: route.stravaEmbedCode,
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
        stravaEmbedCode: data.strava_embed_code
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
