# Restore Sample Data

## Problem
When you migrated from localStorage to Supabase, your sample riders and coaches didn't automatically transfer. The database is now empty.

## Solution
I've added a function to restore your sample data! Here are two ways to use it:

---

## Option 1: Automatic Prompt (First Time)

When you log in as a coach and your database is empty, you'll automatically get a prompt asking if you want to load sample data:

1. **Log in** as a coach (make sure you've assigned yourself the "coach" role)
2. If your database is empty, you'll see a prompt after the page loads
3. Click **"OK"** to load sample data
4. Sample data will be added automatically!

---

## Option 2: Manual Button

You can also manually trigger the restore at any time:

1. **Log in** as a coach
2. Look at the top-right of the page, next to "Season Setup..." button
3. Click **"Load Sample Data"** button
4. Confirm when prompted
5. Sample data will be added!

---

## What Gets Added

The sample data includes:
- **20 sample coaches** with names, phone numbers, levels (1-3), fitness ratings, photos, and notes
- **50 sample riders** with names, phone numbers, grades (9th-12th), racing groups, fitness ratings, photos, and notes

---

## Notes

- **This ADDS data** - it doesn't replace or delete existing data
- If you already have coaches/riders, you'll get a confirmation before adding more
- Only **coaches** can restore sample data (security)
- The prompt only shows **once per browser session** to avoid annoying you

---

## Troubleshooting

### "Only coaches can restore sample data"
- Make sure you're logged in
- Make sure you've assigned yourself the "coach" role in Supabase (see SETUP_AUTH.md Step 11)

### Button doesn't appear
- Make sure you're logged in as a coach
- Refresh the page
- Check that your role is correctly assigned

### Data doesn't appear after loading
- Wait a few seconds and refresh the page
- Check the browser console (F12) for any errors
- Make sure your Supabase connection is working

---

## Need Help?

If sample data doesn't restore properly, check:
1. You're logged in as a coach
2. Your Supabase connection is working
3. Check the browser console (F12) for errors
4. Try refreshing the page after loading sample data


