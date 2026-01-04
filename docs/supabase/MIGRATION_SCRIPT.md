# Data Migration Script

This guide explains how to migrate your existing localStorage data to Supabase.

## Pre-Migration Checklist

- [ ] Supabase project is set up
- [ ] Database schema has been run (see COMPLETE_SETUP_GUIDE.md Step 3)
- [ ] You have exported your localStorage data (backup)
- [ ] You have your Supabase project URL and anon key

## Migration Options

### Option 1: Browser Console Script (Recommended)

This script runs in your browser console and migrates data directly to Supabase.

1. Open your application in the browser
2. Open Developer Console (F12)
3. Make sure Supabase is configured in `scripts/supabase-config.js`
4. Paste and run this script:

```javascript
// ============================================
// Team Ride Pro - Data Migration Script
// ============================================

async function migrateToSupabase() {
    console.log('Starting migration to Supabase...');
    
    // Load data from localStorage
    const localData = JSON.parse(localStorage.getItem('teamRideProData') || '{}');
    
    if (!localData.riders && !localData.coaches) {
        console.error('No data found in localStorage');
        return;
    }
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('Supabase client not initialized. Check supabase-config.js');
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
}

// Run migration
migrateToSupabase();
```

### Option 2: Export/Import via CSV (For Large Datasets)

If you have CSV exports of riders/coaches:

1. Go to Supabase Dashboard → Table Editor
2. Select the table (riders or coaches)
3. Click "Insert row" → "Import data via CSV"
4. Upload your CSV file
5. Map columns correctly

**Note**: This method doesn't preserve IDs and won't migrate rides/settings.

### Option 3: SQL Import (Advanced)

For advanced users familiar with SQL:

1. Export your data to JSON (using Option 1 script but with console.log output)
2. Convert JSON to SQL INSERT statements
3. Run SQL in Supabase SQL Editor

## Post-Migration Tasks

### 1. Verify Data

Check that all data was migrated:

```javascript
// Verification script - run in browser console
async function verifyMigration() {
    const client = getSupabaseClient();
    
    const { data: riders } = await client.from('riders').select('count');
    const { data: coaches } = await client.from('coaches').select('count');
    const { data: rides } = await client.from('rides').select('count');
    
    console.log('Migrated counts:');
    console.log(`Riders: ${riders?.length || 0}`);
    console.log(`Coaches: ${coaches?.length || 0}`);
    console.log(`Rides: ${rides?.length || 0}`);
}

verifyMigration();
```

### 2. Create Admin Coach Account

See COMPLETE_SETUP_GUIDE.md Step 4.3 for instructions on creating your first admin account.

### 3. Normalize Phone Numbers

Ensure all phone numbers are in consistent format (E.164):

```sql
-- Run in Supabase SQL Editor
UPDATE coaches 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;

UPDATE riders 
SET phone = '+' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL 
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10;
```

### 4. Handle ID Mapping (If Needed)

**Important**: If your rides reference rider/coach IDs, those IDs will have changed after migration.

You have two options:

**Option A**: Re-run assignments (recommended)
- The application will re-assign riders/coaches to rides based on availability
- Old assignments may need to be recreated

**Option B**: Create ID mapping and update rides
- Create a mapping of old IDs → new IDs
- Update ride.available_coaches and ride.available_riders arrays
- This is complex and error-prone

## Troubleshooting

### "RLS policy violation" errors

This means your user doesn't have proper permissions. Ensure:
1. You've created an admin user account
2. The user_roles table has an entry for your user
3. The role is set to 'admin' or 'coach'

### "Duplicate key" errors

Data already exists in the database. Options:
1. Clear existing data (dangerous - backup first!)
2. Skip duplicates (modify script to check before insert)
3. Use upsert instead of insert

### Phone number format issues

Phone numbers must be consistent. Run the normalization SQL (see Post-Migration Task #3).

### Migration partially complete

If migration stops partway:
1. Check console for error messages
2. Note which records succeeded/failed
3. Re-run script (it will try to insert duplicates)
4. Manually fix any errors

## Rolling Back

If you need to roll back:

1. **Delete all data** (dangerous - ensure you have backup!):

```sql
-- Run in Supabase SQL Editor - DELETES ALL DATA!
TRUNCATE TABLE rides, rider_availability, rider_feedback, ride_notes, 
              riders, coaches, routes, season_settings, auto_assign_settings, user_roles;
```

2. **Restore from backup**:
   - Your original localStorage backup is still in your browser
   - Or use the exported JSON file

3. **Start over** with migration script

---

## Next Steps After Migration

1. ✅ Verify all data migrated correctly
2. ✅ Create admin coach account
3. ✅ Normalize phone numbers
4. ⏭️ Test login with admin account
5. ⏭️ Set up phone authentication
6. ⏭️ Test phone login for coaches/riders
7. ⏭️ Update application to use Supabase (instead of localStorage)



