# Updated Migration Script - Coach Level Handling

The migration script needs to handle coach levels that can be '1', '2', '3', 'N/A', or NULL.

## Updated Coach Migration Section

Replace the coach migration section in your migration script with this:

```javascript
// Migrate Coaches
if (localData.coaches && localData.coaches.length > 0) {
    console.log(`Migrating ${localData.coaches.length} coaches...`);
    for (const coach of localData.coaches) {
        try {
            // Validate level - must be '1', '2', '3', 'N/A', or null
            let level = coach.level;
            if (level && !['1', '2', '3', 'N/A'].includes(level)) {
                // Convert invalid values to null
                level = null;
            }
            // If level is empty string, null, or undefined, use null
            if (!level) level = null;
            
            const dbData = {
                name: coach.name || '',
                phone: coach.phone || null,
                email: coach.email || null,
                level: level,  // Can be '1', '2', '3', 'N/A', or null
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
```

## Before Running Migration

Make sure you've run `sql/UPDATE_COACH_LEVEL_CONSTRAINT.sql` to update the database constraint first!


