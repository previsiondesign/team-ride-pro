// Re-migrate Failed Coaches with Level Validation (supports 'N/A' and NULL)
// Run this in browser console after updating the coach level constraint
// Wrap in function to avoid variable conflicts

(async function reMigrateCoaches() {
    const client = getSupabaseClient();
    if (!client) {
        console.error('Supabase client not initialized');
        return;
    }
    
    const localData = JSON.parse(localStorage.getItem('teamRideProData') || '{}');
    if (!localData.coaches) {
        console.error('No coaches data found in localStorage');
        return;
    }

    const failedCoaches = [
        "Andrew O'Reilly", "Andy Schumont", "Anna Soman", "Bill Dauphinais",
        "Brian Foster", "Brian Sutherland", "Brianne Martin", "Charles Moore",
        "Cory Creath", "Daniel Cressman", "David Collman", "Don Imwalle",
        "Douglas Newman", "Eric Eberhardt", "Esther Chang", "Gena D'Angona",
        "Jennifer Foster", "John Clothier", "Josefin Moore", "Mark Lawler",
        "MATTHEW MOSELEY", "Matthew Pullen", "Michael Heacock", "Mike Van Allen",
        "Mustafa Al-Alami", "Pep Moore", "Quinlan Brow", "Renee Shelton",
        "Robin Martin", "Stacey Evans", "Swen Kolterman", "Will Paton"
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const coachName of failedCoaches) {
        const coach = localData.coaches.find(c => c.name === coachName);
        if (!coach) {
            console.log(`Coach not found: ${coachName}`);
            errorCount++;
            continue;
        }
        
        // Validate level - must be '1', '2', '3', 'N/A', or null
        let level = coach.level;
        if (level && !['1', '2', '3', 'N/A'].includes(level)) {
            console.log(`Converting invalid level "${level}" for ${coachName} -> null`);
            level = null;
        }
        // If level is empty string, null, or undefined, use null
        if (!level) level = null;
        
        const dbData = {
            name: coach.name || '',
            phone: coach.phone || null,
            email: coach.email || null,
            level: level,  // Can now be '1', '2', '3', 'N/A', or null
            fitness: coach.fitness || '5',
            photo: coach.photo || null,
            notes: coach.notes || null,
            user_id: null
        };
        
        try {
            const { data, error } = await client
                .from('coaches')
                .insert([dbData])
                .select()
                .single();
            
            if (error) {
                console.error(`Error migrating ${coachName}:`, error);
                errorCount++;
            } else {
                console.log(`✓ Migrated: ${coachName} (new ID: ${data.id})`);
                successCount++;
            }
        } catch (err) {
            console.error(`Error migrating ${coachName}:`, err);
            errorCount++;
        }
    }
    
    console.log('\n=== Re-migration Complete ===');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
})();


