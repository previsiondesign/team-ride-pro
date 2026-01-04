// ============================================
// Team Ride Pro - Standalone Data Migration Script
// ============================================
// This version can be run directly in the browser console
// It includes all necessary initialization code

(async function migrateToSupabase() {
    console.log('Starting migration to Supabase...');
    
    // Initialize Supabase client (use your credentials from supabase-config.js)
    const SUPABASE_URL = 'https://kweharxfvvjwrnswrooo.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_8-l_iq6y5mqzkGPZtMYNvg_oi7n00tY';
    
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Please run this script on a page that has the Supabase script loaded.');
        console.error('Make sure you open teamridepro_v2.html in your browser first.');
        return;
    }
    
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Load data from localStorage
    const localData = JSON.parse(localStorage.getItem('teamRideProData') || '{}');
    
    if (!localData.riders && !localData.coaches) {
        console.error('No data found in localStorage');
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Migrate Riders
    if (localData.riders && localData.riders.length > 0) {
        console.log(`Migrating ${localData.riders.length} riders...`);
        for (const rider of localData.riders) {
            try {
                const dbData = {
                    name: rider.name || '',
                    phone: rider.phone || null,
                    email: rider.email || null,
                    grade: rider.grade || null,
                    gender: rider.gender || null,
                    racing_group: rider.racingGroup || rider.racing_group || null,
                    fitness: rider.fitness || '5',
                    photo: rider.photo || null,
                    notes: rider.notes || null
                };
                
                const { data, error } = await client
                    .from('riders')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating rider ${rider.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated rider: ${rider.name} (old ID: ${rider.id}, new ID: ${data.id})`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating rider ${rider.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Coaches
    if (localData.coaches && localData.coaches.length > 0) {
        console.log(`Migrating ${localData.coaches.length} coaches...`);
        for (const coach of localData.coaches) {
            try {
                const dbData = {
                    name: coach.name || '',
                    phone: coach.phone || null,
                    email: coach.email || null,
                    level: coach.level || '1',
                    fitness: coach.fitness || '5',
                    photo: coach.photo || null,
                    notes: coach.notes || null,
                    user_id: null // Will be linked later if they have auth account
                };
                
                const { data, error } = await client
                    .from('coaches')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating coach ${coach.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated coach: ${coach.name} (old ID: ${coach.id}, new ID: ${data.id})`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating coach ${coach.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Routes
    if (localData.routes && localData.routes.length > 0) {
        console.log(`Migrating ${localData.routes.length} routes...`);
        for (const route of localData.routes) {
            try {
                const dbData = {
                    name: route.name || '',
                    description: route.description || null,
                    strava_embed_code: route.stravaEmbedCode || route.strava_embed_code || null
                };
                
                const { data, error } = await client
                    .from('routes')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating route ${route.name}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated route: ${route.name}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating route ${route.name}:`, err);
                errorCount++;
            }
        }
    }
    
    // Migrate Season Settings
    if (localData.seasonSettings) {
        console.log('Migrating season settings...');
        try {
            const settingsData = {
                id: 'current',
                start_date: localData.seasonSettings.startDate || null,
                end_date: localData.seasonSettings.endDate || null,
                practices: localData.seasonSettings.practices || []
            };
            
            const { data, error } = await client
                .from('season_settings')
                .upsert([settingsData], { onConflict: 'id' })
                .select()
                .single();
            
            if (error) {
                console.error('Error migrating season settings:', error);
                errorCount++;
            } else {
                console.log('✓ Migrated season settings');
                successCount++;
            }
        } catch (err) {
            console.error('Error migrating season settings:', err);
            errorCount++;
        }
    }
    
    // Migrate Auto Assign Settings
    if (localData.autoAssignSettings && localData.autoAssignSettings.parameters) {
        console.log('Migrating auto assign settings...');
        try {
            const settingsData = {
                id: 'current',
                parameters: localData.autoAssignSettings.parameters || []
            };
            
            const { data, error } = await client
                .from('auto_assign_settings')
                .upsert([settingsData], { onConflict: 'id' })
                .select()
                .single();
            
            if (error) {
                console.error('Error migrating auto assign settings:', error);
                errorCount++;
            } else {
                console.log('✓ Migrated auto assign settings');
                successCount++;
            }
        } catch (err) {
            console.error('Error migrating auto assign settings:', err);
            errorCount++;
        }
    }
    
    // Migrate Rides (More complex - includes groups and assignments)
    if (localData.rides && localData.rides.length > 0) {
        console.log(`Migrating ${localData.rides.length} rides...`);
        for (const ride of localData.rides) {
            try {
                const dbData = {
                    date: ride.date || null,
                    available_coaches: ride.availableCoaches || ride.available_coaches || [],
                    available_riders: ride.availableRiders || ride.available_riders || [],
                    assignments: ride.assignments || {},
                    groups: ride.groups || [],
                    cancelled: ride.cancelled || false,
                    published_groups: ride.publishedGroups || ride.published_groups || false
                };
                
                const { data, error } = await client
                    .from('rides')
                    .insert([dbData])
                    .select()
                    .single();
                
                if (error) {
                    console.error(`Error migrating ride ${ride.date}:`, error);
                    errorCount++;
                } else {
                    console.log(`✓ Migrated ride: ${ride.date}`);
                    successCount++;
                }
            } catch (err) {
                console.error(`Error migrating ride ${ride.date}:`, err);
                errorCount++;
            }
        }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('\nNote: Rider/Coach IDs have changed. Rides reference old IDs.');
    console.log('You may need to update ride assignments manually or run ID mapping script.');
})();


