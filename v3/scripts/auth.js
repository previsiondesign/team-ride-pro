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
async function signUpWithEmail(email, password, name, redirectUrl) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase credentials not configured. Please add your Project URL and API key to supabase-config.js. See SETUP_AUTH.md for instructions.');
    }
    const defaultRedirect = window.location.origin + window.location.pathname.replace(/mtb-roster\.html$/, 'verify-account.html');
    const emailRedirectTo = redirectUrl || defaultRedirect;

    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                name: name || ''
            },
            emailRedirectTo: emailRedirectTo
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
    
    // Always clear local state first
    currentUser = null;
    currentUserRole = null;
    
    // Try to sign out from Supabase, but don't fail if session is already invalid
    try {
        const { error } = await client.auth.signOut();
        if (error) {
            const message = (error.message || '').toLowerCase();
            const isMissingSession = error.name === 'AuthSessionMissingError' || message.includes('auth session missing');
            const isForbidden = error.status === 403 || error.code === '403' || message.includes('forbidden');
            if (!isMissingSession && !isForbidden) {
                throw error;
            }
            // Session is already invalid or forbidden - this is fine, just clear local storage
            console.warn('Sign out skipped: no active session or forbidden.');
        }
    } catch (err) {
        // If signOut fails for any reason, still clear local state
        const message = (err?.message || '').toLowerCase();
        const isMissingSession = err?.name === 'AuthSessionMissingError' || message.includes('auth session missing');
        const isForbidden = err?.status === 403 || err?.code === '403' || message.includes('forbidden');
        if (!isMissingSession && !isForbidden) {
            throw err;
        }
        console.warn('Sign out skipped: no active session or forbidden.');
    }
    
    // Manually clear sessionStorage to ensure session is cleared
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            // Clear all Supabase-related session storage
            const keysToRemove = [];
            for (let i = 0; i < window.sessionStorage.length; i++) {
                const key = window.sessionStorage.key(i);
                if (key && (key.includes('supabase') || key.includes('auth'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => window.sessionStorage.removeItem(key));
        }
    } catch (storageError) {
        console.warn('Error clearing sessionStorage:', storageError);
    }
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

