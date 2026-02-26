// Supabase Configuration and Client Setup
// Replace these with your actual Supabase project credentials

const SUPABASE_URL = 'https://kweharxfvvjwrnswrooo.supabase.co'; // Set via environment variable or replace with your Supabase URL
const SUPABASE_ANON_KEY = 'sb_publishable_8-l_iq6y5mqzkGPZtMYNvg_oi7n00tY'; // Set via environment variable or replace with your Supabase anon key

// Initialize Supabase client
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return supabaseClient;

    const url = window.SUPABASE_URL || SUPABASE_URL || '';
    const key = window.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY || '';
    
    if (key && !window.SUPABASE_ANON_KEY) {
        window.SUPABASE_ANON_KEY = key;
    }
    if (url && !window.SUPABASE_URL) {
        window.SUPABASE_URL = url;
    }
    
    if (!url || !key) {
        console.error('Supabase credentials not configured.');
        console.error('Please add your credentials to supabase-config.js:');
        console.error('1. Get your Project URL from Supabase: Settings > API > Project URL');
        console.error('2. Get your Publishable key from: Settings > API Keys > Publishable key');
        console.error('3. Add them to supabase-config.js');
        console.error('See SETUP_AUTH.md or QUICK_FIX_CREDENTIALS.md for detailed instructions.');
        return null;
    }
    
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(url, key, {
            auth: {
                storage: window.localStorage,
                persistSession: true,
                autoRefreshToken: true
            }
        });
        return supabaseClient;
    } else {
        console.error('Supabase JS library not loaded. Please include the Supabase script.');
        return null;
    }
}

// Get the Supabase client instance
function getSupabaseClient() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initSupabase, getSupabaseClient };
}

