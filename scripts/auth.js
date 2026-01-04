// Authentication Functions using Supabase Auth

let currentUser = null;
let currentUserRole = null;

// Initialize auth state listener
function initAuth() {
    const client = getSupabaseClient();
    if (!client) return;
    
    // Listen for auth state changes
    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            loadUserRole().then(() => {
                // Only call if handleAuthStateChange is defined (may not be during initial load)
                if (typeof handleAuthStateChange === 'function') {
                    handleAuthStateChange(true);
                }
            });
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentUserRole = null;
            if (typeof handleAuthStateChange === 'function') {
                handleAuthStateChange(false);
            }
        }
    });
    
    // Check for existing session
    client.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            loadUserRole().then(() => {
                handleAuthStateChange(true);
            });
        } else {
            handleAuthStateChange(false);
        }
    });
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Get current user role
function getCurrentUserRole() {
    return currentUserRole;
}

// Load user role from database
async function loadUserRole() {
    if (!currentUser) {
        currentUserRole = null;
        return;
    }
    
    const client = getSupabaseClient();
    if (!client) {
        currentUserRole = null;
        return;
    }
    
    try {
        const { data, error } = await client
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id)
            .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully
        
        if (error) {
            // 406 errors might occur if RLS is blocking, but we'll handle gracefully
            if (error.code === 'PGRST116' || error.code === 'PGRST204') {
                // No role found - this is expected for new users
                console.log('User role not found (user may need role assignment)');
            } else {
                console.warn('Error loading user role:', error);
            }
            currentUserRole = null;
        } else if (!data) {
            // No role assigned yet
            console.log('User role not found, defaulting to null');
            currentUserRole = null;
        } else {
            currentUserRole = data.role;
        }
    } catch (err) {
        console.error('Error loading user role:', err);
        currentUserRole = null;
    }
}

// Sign up with email and password
async function signUpWithEmail(email, password, name) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase credentials not configured. Please add your Project URL and API key to supabase-config.js. See SETUP_AUTH.md for instructions.');
    }
    
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                name: name || ''
            },
            emailRedirectTo: window.location.origin + window.location.pathname.replace(/mtb-roster\.html$/, 'verify-account.html')
        }
    });
    
    if (error) throw error;
    return data;
}

// Sign in with email and password
async function signInWithEmail(email, password) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) throw error;
    
    currentUser = data.user;
    await loadUserRole();
    return data;
}

// Sign in with Google OAuth
async function signInWithGoogle() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    
    if (error) throw error;
    return data;
}

// Sign in with Apple OAuth
async function signInWithApple() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'apple',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    
    if (error) throw error;
    return data;
}

// Sign out
async function signOut() {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { error } = await client.auth.signOut();
    if (error) throw error;
    
    currentUser = null;
    currentUserRole = null;
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Handle auth state changes (override this in main app)
function handleAuthStateChange(isAuthenticated) {
    // This will be overridden in the main application
    console.log('Auth state changed:', isAuthenticated);
}

// Password reset
async function resetPassword(email) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '?mode=reset-password'
    });
    
    if (error) throw error;
}

// Update password
async function updatePassword(newPassword) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    const { error } = await client.auth.updateUser({
        password: newPassword
    });
    
    if (error) throw error;
}

// Resend verification email
async function resendVerificationEmail(email) {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { error } = await client.auth.resend({
        type: 'signup',
        email: email,
        options: {
            emailRedirectTo: window.location.origin + window.location.pathname.replace(/mtb-roster\.html$/, 'verify-account.html')
        }
    });
    
    if (error) throw error;
}

