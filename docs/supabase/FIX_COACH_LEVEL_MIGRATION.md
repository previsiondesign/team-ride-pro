# Fix Coach Level Migration Issues

Some coaches failed to migrate because their `level` values don't match the database constraint. The constraint now allows '1', '2', '3', 'N/A', or NULL.

## Step 1: Update the Constraint to Allow 'N/A' and NULL

Run this SQL in Supabase SQL Editor to update the constraint:

```sql
-- Update constraint to allow NULL, 'N/A', '1', '2', or '3'
ALTER TABLE coaches DROP CONSTRAINT IF EXISTS coaches_level_check;
ALTER TABLE coaches 
ADD CONSTRAINT coaches_level_check 
CHECK (level IS NULL OR level IN ('1', '2', '3', 'N/A'));
```

Or use the file: `sql/UPDATE_COACH_LEVEL_CONSTRAINT.sql`

## Step 2: Fix Any Existing Invalid Levels (if needed)

Run this SQL to fix any coaches with invalid level values:

```sql
-- Fix coaches with invalid level values (set to NULL if not valid)
UPDATE coaches
SET level = NULL
WHERE level IS NOT NULL AND level NOT IN ('1', '2', '3', 'N/A');
```

## Step 3: Re-migrate Failed Coaches

After updating the constraint, you can re-run the migration for just the failed coaches:

```javascript
// Re-migrate failed coaches with level validation
const client = getSupabaseClient();
const localData = JSON.parse(localStorage.getItem('teamRideProData') || '{}');

// List of failed coach names from your errors
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

for (const coachName of failedCoaches) {
    const coach = localData.coaches.find(c => c.name === coachName);
    if (!coach) {
        console.log(`Coach not found: ${coachName}`);
        continue;
    }
    
    // Validate level - must be '1', '2', '3', 'N/A', or null
    let level = coach.level;
    if (level && !['1', '2', '3', 'N/A'].includes(level)) {
        // Convert invalid values to null
        console.log(`Converting invalid level "${level}" for ${coachName} -> null`);
        level = null;
    }
    // If level is empty string, null, or undefined, use null
    if (!level) level = null;
    
    const dbData = {
        name: coach.name || '',
        phone: coach.phone || null,
        email: coach.email || null,
        level: level,
        fitness: coach.fitness || '5',
        photo: coach.photo || null,
        notes: coach.notes || null,
        user_id: null
    };
    
    const { data, error } = await client
        .from('coaches')
        .insert([dbData])
        .select()
        .single();
    
    if (error) {
        console.error(`Error migrating ${coachName}:`, error);
    } else {
        console.log(`✓ Migrated: ${coachName} (new ID: ${data.id})`);
    }
}
```

## Valid Level Values

The database now accepts:
- `'1'`, `'2'`, `'3'` - Specific coach levels
- `'N/A'` - Explicitly marked as not applicable
- `NULL` - No level assigned (default for empty values)

## For Future Migrations

The migration script should validate coach levels. Valid values are '1', '2', '3', 'N/A', or null. Invalid values will be converted to null.

