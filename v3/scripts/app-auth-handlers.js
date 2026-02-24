        // app-auth-handlers.js — Login flows, lock conflict, developer mode, auto-logout, role-based access

        // Authentication handlers
        function showAuthError(message, type = 'error') {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                if (type === 'success') {
                    errorDiv.style.backgroundColor = '#d4edda';
                    errorDiv.style.color = '#155724';
                    errorDiv.style.borderColor = '#c3e6cb';
                } else {
                    errorDiv.style.backgroundColor = '#f8d7da';
                    errorDiv.style.color = '#721c24';
                    errorDiv.style.borderColor = '#f5c6cb';
                }
            }
        }

        function hideAuthError() {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }

        function showLogin() {
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('admin-request-form').style.display = 'none';
            document.getElementById('password-reset-form').style.display = 'none';
            hideAuthError();
        }

        function showAdminRequest() {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('admin-request-form').style.display = 'block';
            document.getElementById('password-reset-form').style.display = 'none';
            hideAuthError();
        }

        function showPasswordReset() {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('admin-request-form').style.display = 'none';
            document.getElementById('password-reset-form').style.display = 'block';
            document.getElementById('simplified-login-form').style.display = 'none';
            hideAuthError();
        }

        function showSimplifiedLogin() {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('admin-request-form').style.display = 'none';
            document.getElementById('password-reset-form').style.display = 'none';
            document.getElementById('simplified-login-form').style.display = 'block';
            document.getElementById('verification-code-form').style.display = 'none';
            pendingVerification = null; // Clear pending verification
            const subtitle = document.getElementById('login-subtitle');
            if (subtitle) {
                subtitle.textContent = 'Enter your phone or email to access your assignments';
            }
            hideAuthError();
        }

        function resetLoginButtonState() {
            const loginButton = document.querySelector('#login-form button[type="submit"]');
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Sign In';
                loginButton.style.opacity = '1';
                loginButton.style.cursor = 'pointer';
            }
        }

        function showAdminLogin() {
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('admin-request-form').style.display = 'none';
            document.getElementById('password-reset-form').style.display = 'none';
            document.getElementById('simplified-login-form').style.display = 'none';
            const subtitle = document.getElementById('login-subtitle');
            if (subtitle) {
                subtitle.textContent = 'Sign in to access the practice manager';
            }
            const noticeEl = document.getElementById('login-logout-notice');
            if (noticeEl) {
                try {
                    const raw = sessionStorage.getItem('logoutReason');
                    if (raw) {
                        const info = JSON.parse(raw);
                        const atStr = info.at ? new Date(info.at).toLocaleString() : '';
                        noticeEl.textContent = 'You were logged out by ' + (info.by || 'another user') + (atStr ? ' on ' + atStr : '') + '.';
                        noticeEl.style.display = 'block';
                        sessionStorage.removeItem('logoutReason');
                    } else {
                        noticeEl.style.display = 'none';
                    }
                } catch (e) {
                    noticeEl.style.display = 'none';
                }
            }
            hideAuthError();
            resetLoginButtonState(); // Reset button state when showing login form
        }

        // pendingVerification is in app-state.js

        // Simplified login handler for riders/coaches
        async function handleSimplifiedLogin() {
            hideAuthError();
            const input = document.getElementById('simplified-login-input');
            const button = document.getElementById('simplified-login-button');
            
            if (!input || !input.value.trim()) {
                showAuthError('Please enter your phone number or email address');
                return;
            }

            const phoneOrEmail = input.value.trim();
            const isEmail = phoneOrEmail.includes('@');
            
            // Disable button and show loading
            if (button) {
                button.disabled = true;
                button.textContent = 'Looking up...';
            }

            try {
                // Step 1: Lookup user
                const lookupResult = await lookupUserByPhoneOrEmail(phoneOrEmail);
                
                if (!lookupResult) {
                    showAuthError('No matching rider or coach found. Please check your phone number or email address.');
                    if (button) {
                        button.disabled = false;
                        button.textContent = 'Send Verification Code';
                    }
                    return;
                }

                // Step 2: Generate verification code
                if (button) {
                    button.textContent = 'Generating code...';
                }
                
                const { code, id: codeId } = await createVerificationCode(
                    phoneOrEmail,
                    lookupResult.type,
                    lookupResult.id
                );
                
                // Step 3: Send verification code
                if (button) {
                    button.textContent = isEmail ? 'Sending email...' : 'Sending SMS...';
                }
                
                const sendResult = await sendVerificationCode(phoneOrEmail, code, isEmail);
                
                if (!sendResult.success) {
                    // If sending fails but we're in development, show the code
                    if (sendResult.error && sendResult.error.includes('not configured')) {
                        alert(`Development mode: Your verification code is ${code}. The sending service is not configured yet.`);
                    } else {
                        throw new Error(sendResult.error || 'Failed to send verification code');
                    }
                }
                
                // Step 4: Store pending verification and show code input form
                pendingVerification = {
                    phoneOrEmail: phoneOrEmail,
                    userType: lookupResult.type,
                    userId: lookupResult.id,
                    userName: lookupResult.name,
                    codeId: codeId,
                    isEmail: isEmail
                };
                
                // Show verification code form
                showVerificationCodeForm(phoneOrEmail, isEmail);
                
            } catch (error) {
                console.error('Error during simplified login:', error);
                showAuthError(error.message || 'An error occurred. Please try again.');
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Send Verification Code';
                }
            }
        }

        // Show verification code input form
        function showVerificationCodeForm(phoneOrEmail, isEmail) {
            document.getElementById('simplified-login-form').style.display = 'none';
            document.getElementById('verification-code-form').style.display = 'block';
            
            const messageEl = document.getElementById('verification-code-message');
            const phoneEmailEl = document.getElementById('verification-phone-email');
            
            if (messageEl) {
                const method = isEmail ? 'email' : 'SMS';
                messageEl.textContent = `We've sent a verification code via ${method} to `;
            }
            
            if (phoneEmailEl) {
                phoneEmailEl.textContent = phoneOrEmail;
            }
            
            // Focus on code input
            setTimeout(() => {
                const codeInput = document.getElementById('verification-code-input');
                if (codeInput) {
                    codeInput.focus();
                }
            }, 100);
        }

        // Verify the code entered by user
        async function handleVerifyCode() {
            hideAuthError();
            const codeInput = document.getElementById('verification-code-input');
            const verifyButton = document.getElementById('verify-code-button');
            
            if (!codeInput || !codeInput.value.trim()) {
                showAuthError('Please enter the verification code');
                return;
            }
            
            if (!pendingVerification) {
                showAuthError('Session expired. Please start over.');
                showSimplifiedLogin();
                return;
            }
            
            const code = codeInput.value.trim();
            
            if (code.length !== 6 || !/^\d{6}$/.test(code)) {
                showAuthError('Please enter a valid 6-digit code');
                return;
            }
            
            // Disable button and show loading
            if (verifyButton) {
                verifyButton.disabled = true;
                verifyButton.textContent = 'Verifying...';
            }
            
            try {
                const verifyResult = await verifyCode(pendingVerification.phoneOrEmail, code);
                
                if (!verifyResult.valid) {
                    showAuthError(verifyResult.message || 'Invalid or expired code. Please try again or request a new code.');
                    if (verifyButton) {
                        verifyButton.disabled = false;
                        verifyButton.textContent = 'Verify Code';
                    }
                    // Clear the input
                    if (codeInput) {
                        codeInput.value = '';
                        codeInput.focus();
                    }
                    return;
                }
                
                // Verification successful - store login info and redirect
                window.sessionStorage.setItem('simplifiedLogin', JSON.stringify({
                    type: pendingVerification.userType,
                    id: pendingVerification.userId,
                    name: pendingVerification.userName,
                    timestamp: Date.now()
                }));
                
                // Route to assignments view
                window.location.href = 'teamridepro_v3.html?view=assignments';
                
            } catch (error) {
                console.error('Error verifying code:', error);
                showAuthError('An error occurred while verifying the code. Please try again.');
                if (verifyButton) {
                    verifyButton.disabled = false;
                    verifyButton.textContent = 'Verify Code';
                }
            }
        }

        // Resend verification code
        async function handleResendVerificationCode() {
            if (!pendingVerification) {
                showAuthError('Session expired. Please start over.');
                showSimplifiedLogin();
                return;
            }
            
            hideAuthError();
            const resendLink = document.getElementById('resend-code-link');
            
            if (resendLink) {
                resendLink.style.pointerEvents = 'none';
                resendLink.textContent = 'Sending...';
            }
            
            try {
                // Generate new code
                const { code, id: codeId } = await createVerificationCode(
                    pendingVerification.phoneOrEmail,
                    pendingVerification.userType,
                    pendingVerification.userId
                );
                
                // Send new code
                await sendVerificationCode(pendingVerification.phoneOrEmail, code, pendingVerification.isEmail);
                
                // Update pending verification
                pendingVerification.codeId = codeId;
                
                // Show success message
                showAuthError('New verification code sent!', 'success');
                
                // Clear code input
                const codeInput = document.getElementById('verification-code-input');
                if (codeInput) {
                    codeInput.value = '';
                    codeInput.focus();
                }
                
            } catch (error) {
                console.error('Error resending code:', error);
                showAuthError('Failed to resend code. Please try again.');
            } finally {
                if (resendLink) {
                    resendLink.style.pointerEvents = '';
                    resendLink.textContent = 'Resend Code';
                }
            }
        }

        async function handleLogin() {
            hideAuthError();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const loginButton = document.querySelector('#login-form button[type="submit"]');

            if (!email || !password) {
                showAuthError('Please enter both email and password');
                return;
            }

            // Disable button and show loading state to prevent multiple clicks
            if (loginButton) {
                const originalText = loginButton.textContent;
                loginButton.disabled = true;
                loginButton.textContent = 'Signing in...';
                loginButton.style.opacity = '0.6';
                loginButton.style.cursor = 'not-allowed';
            }

            try {
                await signInWithEmail(email, password);
                // Auth state listener will handle UI update and backups
            } catch (error) {
                // Re-enable button on error
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.textContent = 'Sign In';
                    loginButton.style.opacity = '1';
                    loginButton.style.cursor = 'pointer';
                }
                
                // Check if error is about email not verified
                if (error.message && error.message.includes('Email not confirmed')) {
                    showAuthError('Please verify your email first. Check your inbox for the verification link.');
                    document.getElementById('resend-verification').style.display = 'block';
                } else {
                    showAuthError(error.message || 'Login failed. Please check your credentials.');
                }
            }
        }

        async function handleSignup() {
            hideAuthError();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            if (!name || !email || !password) {
                showAuthError('Please fill in all fields');
                return;
            }

            if (password.length < 6) {
                showAuthError('Password must be at least 6 characters');
                return;
            }

            try {
                await signUpWithEmail(email, password, name);
                showAuthError('Account created! Please check your email to verify your account before signing in.');
            } catch (error) {
                showAuthError(error.message || 'Sign up failed. Please try again.');
            }
        }

        async function handleGoogleLogin() {
            hideAuthError();
            try {
                await signInWithGoogle();
                // OAuth will redirect, so no need to handle success here
            } catch (error) {
                showAuthError(error.message || 'Google login failed. Please try again.');
            }
        }

        async function handleAppleLogin() {
            hideAuthError();
            try {
                await signInWithApple();
                // OAuth will redirect, so no need to handle success here
            } catch (error) {
                showAuthError(error.message || 'Apple login failed. Please try again.');
            }
        }

        async function handlePasswordReset() {
            hideAuthError();
            const email = document.getElementById('reset-email').value;

            if (!email) {
                showAuthError('Please enter your email address');
                return;
            }

            try {
                await resetPassword(email);
                showAuthError('Password reset email sent! Check your inbox.');
            } catch (error) {
                showAuthError(error.message || 'Failed to send reset email. Please try again.');
            }
        }

        // Handle logout (Supabase authentication or simplified login)
        async function handleLogout() {
            try {
                // Check if this is simplified login mode
                if (simplifiedLoginInfo) {
                // Clear simplified login info
                window.sessionStorage.removeItem('simplifiedLogin');
                simplifiedLoginInfo = null;
                simplifiedLoginMode = null;
                
                // Redirect to simplified login page
                const urlParams = new URLSearchParams(window.location.search);
                const viewParam = urlParams.get('view');
                if (viewParam === 'assignments' || viewParam === 'rider' || viewParam === 'coach') {
                    window.location.href = 'teamridepro_v3.html?view=assignments';
                } else {
                    window.location.href = 'teamridepro_v3.html';
                }
                return;
                }
                
                // Regular admin logout
                // Create automatic backup before logout (skip in developer mode to avoid DB writes)
                try {
                    if (!isDeveloperMode) {
                        await createAutomaticBackup('auto_logout');
                    } else {
                        console.log('Developer mode: skipping automatic backup on logout.');
                    }
                } catch (backupError) {
                    console.warn('Failed to create backup on logout:', backupError);
                    // Don't block logout if backup fails
                }
                
                // Reset developer mode on logout
                isDeveloperMode = false;
                window.isDeveloperMode = false;
                try {
                    localStorage.removeItem(DEV_MODE_STORAGE_KEY);
                } catch (e) {
                    console.warn('Error clearing developer mode flag on logout:', e);
                }
                const devBanner = document.getElementById('developer-mode-banner');
                if (devBanner) devBanner.style.display = 'none';
                const devToggle = document.getElementById('developer-mode-toggle');
                if (devToggle) devToggle.checked = false;
                
                await releaseAdminEditLock();
                
                // Check if we're using Supabase auth
                if (typeof signOut === 'function') {
                    try {
                        await signOut();
                    } catch (signOutError) {
                        // signOut handles 403/forbidden errors internally, but if it throws something else, log it
                        const message = (signOutError?.message || '').toLowerCase();
                        const isMissingSession = signOutError?.name === 'AuthSessionMissingError' || message.includes('auth session missing');
                        const isForbidden = signOutError?.status === 403 || signOutError?.code === '403' || message.includes('forbidden');
                        if (!isMissingSession && !isForbidden) {
                            console.error('Unexpected error during sign out:', signOutError);
                        }
                    }
                    // Always update UI state after sign out attempt, regardless of errors
                    handleAuthStateChange(false);
                } else {
                    // Fallback: just reload page (localStorage mode)
                    if (confirm('Sign out and reload page?')) {
                        window.location.reload();
                    }
                }
            } catch (error) {
                // Catch any unexpected errors, but still try to update UI
                console.error('Error during logout process:', error);
                handleAuthStateChange(false);
            }
        }

        // Override auth state change handler
        async function handleAuthStateChange(isAuthenticated) {
            const authOverlay = document.getElementById('auth-overlay');
            const userMenu = document.getElementById('user-menu');
            const mainContainer = document.querySelector('.container');

            // Check if we're in simplified login mode (any view param triggers simplified login)
            const urlParams = new URLSearchParams(window.location.search);
            const viewParam = urlParams.get('view');
            const needsSimplifiedLogin = (viewParam === 'assignments' || viewParam === 'rider' || viewParam === 'coach') && !simplifiedLoginInfo;

            if (needsSimplifiedLogin && !isAuthenticated) {
                // Show simplified login form
                if (authOverlay) {
                    authOverlay.classList.remove('hidden');
                    authOverlay.style.display = 'flex';
                }
                if (mainContainer) mainContainer.style.display = 'none';
                if (userMenu) userMenu.style.display = 'none';
                showSimplifiedLogin();
                return;
            }

            if (isAuthenticated || simplifiedLoginInfo) {
                
                // For simplified login, hide auth overlay and show main app
                if (simplifiedLoginInfo && !isAuthenticated) {
                    // Simplified login mode - show main app without full auth
                    if (authOverlay) {
                        authOverlay.classList.add('hidden');
                        authOverlay.style.display = 'none';
                    }
                    if (mainContainer) {
                        mainContainer.style.display = 'block';
                        mainContainer.style.visibility = 'hidden';
                    }
                    
                    // Apply simplified view mode based on stored login info
                    if (simplifiedLoginInfo.type === 'rider') {
                        simplifiedLoginMode = 'rider';
                        enableSimplifiedViewMode('rider');
                    } else if (simplifiedLoginInfo.type === 'coach') {
                        simplifiedLoginMode = 'coach';
                        enableSimplifiedViewMode('coach');
                    }
                    
                    // Load application data
                    await loadApplicationData();
                    return;
                }
                
                // Create automatic backup on login (only if this is a new login, not initial page load)
                // Check if this is a new login by checking if auth overlay was visible
                const wasAuthVisible = authOverlay && !authOverlay.classList.contains('hidden');
                if (wasAuthVisible) {
                    try {
                        if (!isDeveloperMode) {
                            await createAutomaticBackup('auto_login');
                        } else {
                            console.log('Developer mode: skipping automatic backup on login.');
                        }
                    } catch (backupError) {
                        console.warn('Failed to create backup on login:', backupError);
                        // Don't block login if backup fails
                    }
                }
                
                // Hide auth overlay, show loading spinner while data loads
                if (authOverlay) {
                    authOverlay.classList.add('hidden');
                    authOverlay.style.display = 'none';
                }
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) loadingOverlay.style.display = 'flex';

                if (mainContainer) {
                    mainContainer.style.display = 'block';
                    mainContainer.style.visibility = 'hidden';
                }
                // Show user menu
                if (userMenu) {
                    const currentUser = getCurrentUser();
                    const currentRole = getCurrentUserRole();
                    
                    const userNameEl = document.getElementById('user-name');
                    const userRoleEl = document.getElementById('user-role');
                    
                    if (userNameEl && currentUser) {
                        userNameEl.textContent = currentUser.user_metadata?.name || currentUser.email || 'User';
                    }
                    if (userRoleEl && currentRole) {
                        userRoleEl.textContent = currentRole.replace('_', ' ');
                    }
                    
                    userMenu.style.display = 'flex';
                }
                
                // Apply role-based UI restrictions
                applyRoleBasedAccess();
                
                // Wait for role to be fully loaded, then load data
                // Retry a few times if role isn't loaded yet
                let retries = 0;
                const maxRetries = 10; // Increased retries for role loading
                const isFreshLogin = !!wasAuthVisible;
                const checkRoleAndLoad = async () => {
                    const role = getCurrentUserRole();
                    // If role is loaded (even if null), or we've exhausted retries, load data
                    // For coaches, we want to make sure role is definitely loaded
                    if (role !== null || retries >= maxRetries) {
                        // Role is loaded (or null is expected), now load data
                        // Add a small delay to ensure RLS policies have the role
                        await new Promise(resolve => setTimeout(resolve, 300));
                        await loadApplicationData(isFreshLogin);
                        await initAdminEditLock();
                        updateDevModeVisibility();
                    } else {
                        // Wait a bit and retry
                        retries++;
                        setTimeout(checkRoleAndLoad, 300); // Increased delay between retries
                    }
                };
                
                // Start checking after a short delay to let role load
                setTimeout(checkRoleAndLoad, 200);
            } else {
                // --- Clean slate: reset all lock/mode state so nothing persists into the next session ---
                setReadOnlyMode(false, null);
                isDeveloperMode = false;
                window.isDeveloperMode = false;
                const devBanner = document.getElementById('developer-mode-banner');
                if (devBanner) devBanner.style.display = 'none';
                if (adminEditLockInterval) { clearInterval(adminEditLockInterval); adminEditLockInterval = null; }
                if (takeOverCheckInterval) { clearInterval(takeOverCheckInterval); takeOverCheckInterval = null; }
                const lockOverlay = document.getElementById('lock-conflict-overlay');
                if (lockOverlay) lockOverlay.style.display = 'none';
                const loadingOv = document.getElementById('loading-overlay');
                if (loadingOv) loadingOv.style.display = 'none';

                // Hide welcome screen if it's up (so auth overlay isn't trapped behind it)
                const welcomeEl = document.getElementById('welcome-screen');
                if (welcomeEl) welcomeEl.style.display = 'none';

                // Show auth overlay, hide main app
                if (authOverlay) {
                    authOverlay.classList.remove('hidden');
                    authOverlay.style.display = 'flex';
                }
                if (mainContainer) mainContainer.style.display = 'none';
                if (userMenu) userMenu.style.display = 'none';
                
                resetLoginButtonState();
                if (!needsSimplifiedLogin) {
                    showAdminLogin();
                }
            }
        }

        // Apply role-based access control to UI
        function applyRoleBasedAccess() {
            // Hide/show tabs based on role
            const tabs = {
                'settings': document.querySelector('.tab[onclick*="settings"]'),
                'roster': document.querySelector('.tab[onclick*="roster"]'),
                'rides': document.querySelector('.tab[onclick*="rides"]'),
                'routes': document.querySelector('.tab[onclick*="routes"]')
            };

            const tabContents = {
                'settings': document.getElementById('settings-tab'),
                'roster': document.getElementById('roster-tab'),
                'rides': document.getElementById('rides-tab'),
                'routes': document.getElementById('routes-tab')
            };

            // Season Setup button is now in user menu - no need to show/hide header-actions

            if (tabs.routes) {
                tabs.routes.style.display = canViewRoutes() ? 'block' : 'none';
            }

            // Update mobile menu
            const mobileMenuItems = document.querySelectorAll('.mobile-menu-item');
            mobileMenuItems.forEach(item => {
                const text = item.textContent.trim();
                if (text.includes('Routes') && !canViewRoutes()) {
                    item.style.display = 'none';
                } else if (text.includes('Season') && !canViewSeasonSetup()) {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'block';
                }
            });
        }

        function setReadOnlyMode(enabled, lockInfo = null) {
            isReadOnlyMode = enabled === true;
            window.isReadOnlyMode = isReadOnlyMode;
            readOnlyLockInfo = lockInfo || null;
            readOnlyNoticeShown = false;
            const banner = document.getElementById('read-only-banner');
            if (banner) {
                if (isReadOnlyMode) {
                    const name = lockInfo?.user_name || lockInfo?.email || 'another admin';
                    const textEl = document.getElementById('read-only-banner-text');
                    if (textEl) textEl.textContent = `Read-only mode: ${name} is currently logged in with editing access.`;
                    banner.style.display = 'flex';
                } else {
                    banner.style.display = 'none';
                }
                requestAnimationFrame(() => { if (typeof updateSidebarTop === 'function') updateSidebarTop(); });
            }
        }

        function isReadOnlyInteractionAllowed(target) {
            if (!target) return false;
            if (target.closest('.tab')) return true;
            if (target.closest('.mobile-menu-item')) return true;
            if (target.closest('.mobile-menu-button')) return true;
            if (target.closest('#practice-reporting-prev, #practice-reporting-next')) return true;
            if (target.closest('#prior-practice-btn, #next-practice-btn')) return true;
            if (target.closest('[data-readonly-allow="true"]')) return true;
            return false;
        }

        function handleReadOnlyInteraction(event) {
            if (!isReadOnlyMode) return;
            const target = event.target;
            const actionable = target.closest('button, input, select, textarea, a, [onclick], [draggable="true"]');
            if (!actionable) return;
            if (isReadOnlyInteractionAllowed(actionable)) return;
            event.preventDefault();
            event.stopPropagation();
            if (!readOnlyNoticeShown) {
                const name = readOnlyLockInfo?.user_name || readOnlyLockInfo?.email || 'another admin';
                alert(`Read-only mode: ${name} is currently logged in with editing access.`);
                readOnlyNoticeShown = true;
            }
        }

        document.addEventListener('click', handleReadOnlyInteraction, true);
        document.addEventListener('change', handleReadOnlyInteraction, true);
        document.addEventListener('input', handleReadOnlyInteraction, true);
        document.addEventListener('dragstart', handleReadOnlyInteraction, true);

        // lockConflictRequestPollTimer, takeOverRequestPollTimer, takeOverCountdownTimer, takeOverCountdownSeconds are in app-state.js

        function showLockConflictDialog(lock) {
            const name = lock.user_name || lock.email || 'another admin';
            const overlay = document.getElementById('lock-conflict-overlay');
            const dialog = document.getElementById('lock-conflict-dialog');
            const waiting = document.getElementById('lock-conflict-waiting');
            const msg = document.getElementById('lock-conflict-message');
            const nameSpan = document.getElementById('lock-conflict-name');
            if (!overlay || !dialog || !waiting || !msg || !nameSpan) return;
            msg.textContent = name + ' is currently logged in with editing access. How do you want to continue?';
            nameSpan.textContent = name;
            dialog.style.display = 'block';
            waiting.style.display = 'none';
            overlay.style.display = 'flex';

            document.getElementById('lock-conflict-readonly').onclick = () => {
                overlay.style.display = 'none';
                setReadOnlyMode(true, lock);
            };
            document.getElementById('lock-conflict-request').onclick = async () => {
                if (typeof createTakeOverRequest !== 'function' || typeof getTakeOverRequest !== 'function') return;
                const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
                if (!currentUser) return;
                try {
                    await createTakeOverRequest({
                        user_id: currentUser.id,
                        user_name: currentUser.user_metadata?.name || currentUser.email || 'You',
                        user_email: currentUser.email || null
                    });
                } catch (e) {
                    console.warn('Create take over request failed:', e);
                    alert('Could not send request. Please try Read-Only or Developer Mode.');
                    return;
                }
                dialog.style.display = 'none';
                document.getElementById('lock-conflict-waiting-text').textContent = 'Waiting for ' + name + ' to respond…';
                waiting.style.display = 'block';
                const cancelBtn = document.getElementById('lock-conflict-waiting-cancel');
                if (cancelBtn) {
                    cancelBtn.onclick = () => {
                        if (lockConflictRequestPollTimer) clearInterval(lockConflictRequestPollTimer);
                        lockConflictRequestPollTimer = null;
                        overlay.style.display = 'none';
                        dialog.style.display = 'block';
                        waiting.style.display = 'none';
                        setReadOnlyMode(true, lock);
                    };
                }
                if (lockConflictRequestPollTimer) clearInterval(lockConflictRequestPollTimer);
                lockConflictRequestPollTimer = setInterval(async () => {
                    try {
                        const req = await getTakeOverRequest();
                        if (!req || req.status === 'pending') return;
                        clearInterval(lockConflictRequestPollTimer);
                        lockConflictRequestPollTimer = null;
                        overlay.style.display = 'none';
                        // Clean up the processed request row so it does not block future requests
                        if (typeof clearTakeOverRequest === 'function') await clearTakeOverRequest();
                        if (req.status === 'granted') {
                            if (typeof releaseAdminEditLock === 'function') await releaseAdminEditLock();
                            await upsertAdminEditLock({ user_id: currentUser.id, email: currentUser.email || null, user_name: currentUser.user_metadata?.name || currentUser.email || 'Admin' });
                            setReadOnlyMode(false, null);
                            if (adminEditLockInterval) clearInterval(adminEditLockInterval);
                            adminEditLockInterval = setInterval(async () => {
                                if (isReadOnlyMode) return;
                                await upsertAdminEditLock({ user_id: currentUser.id, email: currentUser.email || null, user_name: currentUser.user_metadata?.name || currentUser.email || 'Admin' });
                            }, 60 * 1000);
                        } else {
                            setReadOnlyMode(true, lock);
                            if (req.response_message) alert('Access denied. ' + req.response_message);
                        }
                    } catch (e) {
                        console.warn('Take over poll error:', e);
                    }
                }, 1500);
            };
            document.getElementById('lock-conflict-developer').onclick = () => {
                if (lockConflictRequestPollTimer) clearInterval(lockConflictRequestPollTimer);
                lockConflictRequestPollTimer = null;
                overlay.style.display = 'none';
                enterDeveloperMode();
            };
        }

        async function initAdminEditLock() {
            // Always start from a clean slate so stale flags from a prior session don't linger
            setReadOnlyMode(false, null);

            if (!isCoach()) return;
            if (isDeveloperMode) {
                // In developer mode we never hold the global admin edit lock so others are not blocked
                setReadOnlyMode(false, null);
                return;
            }
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!currentUser) return;
            if (typeof getAdminEditLock !== 'function' || typeof upsertAdminEditLock !== 'function') {
                return;
            }
            try {
                const lock = await getAdminEditLock();
                const now = new Date();
                const lockUpdatedAt = lock?.updated_at ? new Date(lock.updated_at) : null;
                const lockFresh = lockUpdatedAt && (now - lockUpdatedAt) < 2 * 60 * 1000;
                if (lockFresh && lock.user_id && lock.user_id !== currentUser.id) {
                    showLockConflictDialog(lock);
                    return;
                }

                await upsertAdminEditLock({
                    user_id: currentUser.id,
                    email: currentUser.email || null,
                    user_name: currentUser.user_metadata?.name || currentUser.email || 'Admin'
                });
                setReadOnlyMode(false, null);

                if (adminEditLockInterval) {
                    clearInterval(adminEditLockInterval);
                }
                adminEditLockInterval = setInterval(async () => {
                    if (isReadOnlyMode) return;
                    await upsertAdminEditLock({
                        user_id: currentUser.id,
                        email: currentUser.email || null,
                        user_name: currentUser.user_metadata?.name || currentUser.email || 'Admin'
                    });
                }, 60 * 1000);
                if (takeOverCheckInterval) clearInterval(takeOverCheckInterval);
                takeOverCheckInterval = setInterval(async () => {
                    if (isReadOnlyMode) return;
                    if (typeof getTakeOverRequest !== 'function') return;
                    try {
                        const req = await getTakeOverRequest();
                        if (!req || req.status !== 'pending' || req.requesting_user_id === currentUser.id) return;
                        clearInterval(takeOverCheckInterval);
                        takeOverCheckInterval = null;
                        clearInterval(adminEditLockInterval);
                        adminEditLockInterval = null;
                        showTakeOverRequestPopup(req);
                    } catch (e) {
                        console.warn('Take over check poll error:', e);
                    }
                }, 2500);
            } catch (error) {
                console.warn('Failed to initialize admin edit lock:', error);
            }
        }

        // takeOverBeforeUnloadHandler is in app-state.js

        function showTakeOverRequestPopup(req) {
            const overlay = document.getElementById('take-over-request-overlay');
            const msgEl = document.getElementById('take-over-request-message');
            const countdownEl = document.getElementById('take-over-request-countdown');
            const buttonsDiv = document.getElementById('take-over-request-buttons');
            const denyReasonDiv = document.getElementById('take-over-deny-reason');
            const denyInput = document.getElementById('take-over-deny-reason-input');
            if (!overlay || !msgEl) return;
            const name = req.requesting_user_name || req.requesting_user_email || 'Another user';
            msgEl.textContent = name + ' is requesting access. Will you allow them to log you out?';
            buttonsDiv.style.display = 'flex';
            denyReasonDiv.style.display = 'none';
            if (denyInput) denyInput.value = '';
            overlay.style.display = 'flex';

            // Prevent closing by clicking backdrop
            const stopBackdropClose = (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            overlay.addEventListener('click', stopBackdropClose);

            // Warn if user tries to close tab/window without responding (after 30s they are auto-logged out)
            if (takeOverBeforeUnloadHandler) window.removeEventListener('beforeunload', takeOverBeforeUnloadHandler);
            takeOverBeforeUnloadHandler = () => 'Someone is waiting for your response. If you leave without answering, you will be logged out in 30 seconds.';
            window.addEventListener('beforeunload', takeOverBeforeUnloadHandler);

            let responded = false;
            const cleanup = () => {
                overlay.removeEventListener('click', stopBackdropClose);
                if (takeOverBeforeUnloadHandler) {
                    window.removeEventListener('beforeunload', takeOverBeforeUnloadHandler);
                    takeOverBeforeUnloadHandler = null;
                }
            };
            const respond = async (grant) => {
                if (responded) return;
                responded = true;
                cleanup();
                if (takeOverCountdownTimer) clearInterval(takeOverCountdownTimer);
                try {
                    if (grant) {
                        if (typeof respondToTakeOverRequest === 'function') await respondToTakeOverRequest('granted');
                        // Brief delay so the requester's poll can read the 'granted' status before we delete the row
                        await new Promise(r => setTimeout(r, 3000));
                        if (typeof clearTakeOverRequest === 'function') await clearTakeOverRequest();
                        try {
                            sessionStorage.setItem('logoutReason', JSON.stringify({ by: name, at: new Date().toISOString() }));
                        } catch (e) {}
                        await releaseAdminEditLock();
                        if (typeof signOut === 'function') await signOut();
                        if (typeof handleAuthStateChange === 'function') handleAuthStateChange(false);
                    }
                } catch (e) {
                    console.warn('Take over respond error:', e);
                }
                overlay.style.display = 'none';
            };
            document.getElementById('take-over-allow').onclick = () => respond(true);
            document.getElementById('take-over-deny').onclick = () => {
                buttonsDiv.style.display = 'none';
                denyReasonDiv.style.display = 'block';
            };
            document.getElementById('take-over-deny-submit').onclick = async () => {
                const reason = denyInput ? denyInput.value.trim() : '';
                if (!reason) {
                    alert('Please enter a reason for declining.');
                    return;
                }
                if (responded) return;
                responded = true;
                cleanup();
                if (takeOverCountdownTimer) clearInterval(takeOverCountdownTimer);
                try {
                    if (typeof respondToTakeOverRequest === 'function') await respondToTakeOverRequest('denied', reason);
                    // Brief delay so the requester's poll can read the 'denied' status before we delete the row
                    await new Promise(r => setTimeout(r, 3000));
                    if (typeof clearTakeOverRequest === 'function') await clearTakeOverRequest();
                } catch (e) {
                    console.warn('Take over deny error:', e);
                }
                overlay.style.display = 'none';
            };
            takeOverCountdownSeconds = 30;
            if (countdownEl) countdownEl.textContent = 'Auto-allowing in ' + takeOverCountdownSeconds + ' seconds…';
            if (takeOverCountdownTimer) clearInterval(takeOverCountdownTimer);
            takeOverCountdownTimer = setInterval(() => {
                takeOverCountdownSeconds--;
                if (countdownEl) countdownEl.textContent = 'Auto-allowing in ' + takeOverCountdownSeconds + ' seconds…';
                if (takeOverCountdownSeconds <= 0) {
                    clearInterval(takeOverCountdownTimer);
                    takeOverCountdownTimer = null;
                    respond(true);
                }
            }, 1000);
        }

        async function releaseAdminEditLock() {
            if (adminEditLockInterval) {
                clearInterval(adminEditLockInterval);
                adminEditLockInterval = null;
            }
            if (takeOverCheckInterval) {
                clearInterval(takeOverCheckInterval);
                takeOverCheckInterval = null;
            }
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!currentUser || typeof clearAdminEditLock !== 'function') return;
            await clearAdminEditLock(currentUser.id);
        }

        function handleDeveloperModeToggle(checked) {
            if (checked) {
                enterDeveloperMode();
            } else {
                handleExitDeveloperMode();
            }
        }

        async function enterDeveloperMode() {
            if (typeof getCurrentUserDevAccess === 'function') {
                try {
                    const allowed = await getCurrentUserDevAccess();
                    if (!allowed) {
                        alert('Your account does not have Developer Mode access. An admin can enable this in Settings > Registered Users.');
                        const toggle = document.getElementById('developer-mode-toggle');
                        if (toggle) toggle.checked = false;
                        return;
                    }
                } catch (e) {
                    console.warn('Could not check dev access permission:', e);
                }
            }

            await releaseAdminEditLock();

            // Leaving read-only, entering developer
            isReadOnlyMode = false;
            window.isReadOnlyMode = false;
            const roBanner = document.getElementById('read-only-banner');
            if (roBanner) roBanner.style.display = 'none';

            isDeveloperMode = true;
            window.isDeveloperMode = true;
            try {
                localStorage.setItem(DEV_MODE_STORAGE_KEY, 'true');
            } catch (e) {
                console.warn('Could not persist developer mode flag:', e);
            }
            try {
                const dataToSave = {
                    riders: data.riders,
                    coaches: data.coaches,
                    rides: data.rides,
                    routes: data.routes,
                    races: data.races || [],
                    currentRide: data.currentRide,
                    seasonSettings: data.seasonSettings,
                    autoAssignSettings: data.autoAssignSettings,
                    coachRoles: data.coachRoles || [],
                    riderRoles: data.riderRoles || []
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (e) {
                console.warn('Developer mode: could not snapshot data to localStorage:', e);
            }
            const banner = document.getElementById('developer-mode-banner');
            if (banner) banner.style.display = 'flex';
            const toggle = document.getElementById('developer-mode-toggle');
            if (toggle) toggle.checked = true;
            requestAnimationFrame(() => { if (typeof updateSidebarTop === 'function') updateSidebarTop(); });
            alert('Developer mode is ON. All changes will be saved only in this browser. Other admins can use the site normally.');
        }

        async function updateDevModeVisibility() {
            let allowed = false;
            if (typeof getCurrentUserDevAccess === 'function') {
                try { allowed = await getCurrentUserDevAccess(); } catch (e) { /* ignore */ }
            }
            const section = document.getElementById('developer-mode-section');
            if (section) section.style.display = allowed ? '' : 'none';
            const lockDevBtn = document.getElementById('lock-conflict-developer');
            if (lockDevBtn) lockDevBtn.style.display = allowed ? '' : 'none';
            const roBannerDevBtn = document.querySelector('#read-only-banner button[data-readonly-allow]');
            if (roBannerDevBtn) roBannerDevBtn.style.display = allowed ? '' : 'none';
        }

        function exitDeveloperMode() {
            isDeveloperMode = false;
            window.isDeveloperMode = false;
            try {
                localStorage.removeItem(DEV_MODE_STORAGE_KEY);
            } catch (e) {
                console.warn('Could not clear developer mode flag:', e);
            }
            const banner = document.getElementById('developer-mode-banner');
            if (banner) banner.style.display = 'none';
            const toggle = document.getElementById('developer-mode-toggle');
            if (toggle) toggle.checked = false;
            requestAnimationFrame(() => { if (typeof updateSidebarTop === 'function') updateSidebarTop(); });
        }

        async function handleExitDeveloperMode() {
            const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (!currentUser) {
                exitDeveloperMode();
                location.reload();
                return;
            }

            try {
                const lock = typeof getAdminEditLock === 'function' ? await getAdminEditLock() : null;
                const now = new Date();
                const lockUpdatedAt = lock?.updated_at ? new Date(lock.updated_at) : null;
                const lockFresh = lockUpdatedAt && (now - lockUpdatedAt) < 2 * 60 * 1000;
                const lockedByOther = lockFresh && lock.user_id && lock.user_id !== currentUser.id;

                if (lockedByOther) {
                    exitDeveloperMode();
                    showLockConflictDialog(lock);
                } else {
                    exitDeveloperMode();

                    if (typeof saveAllDataToSupabase === 'function') {
                        try {
                            await saveAllDataToSupabase();
                        } catch (e) {
                            console.warn('Failed to save data on dev mode exit:', e);
                        }
                    }

                    await initAdminEditLock();
                }
            } catch (e) {
                console.warn('Error checking lock on dev mode exit:', e);
                exitDeveloperMode();
                location.reload();
            }
        }

        // simplifiedLoginMode, simplifiedLoginInfo are in app-state.js

        // Initialize
        async function init() {
            // Auto-logout detection: if the browser was closed since the last
            // visit, sessionStorage will be empty and checkAutoLogoutOnOpen()
            // clears the stale auth token BEFORE Supabase tries to use it.
            checkAutoLogoutOnOpen();

            // Check for simplified login view mode (any view param triggers simplified login)
            const urlParams = new URLSearchParams(window.location.search);
            const viewParam = urlParams.get('view');
            const isSimplifiedView = viewParam === 'assignments' || viewParam === 'rider' || viewParam === 'coach'; // Support old URLs too
            
            // Check for existing simplified login in sessionStorage
            try {
                const stored = window.sessionStorage.getItem('simplifiedLogin');
                if (stored) {
                    simplifiedLoginInfo = JSON.parse(stored);
                    // Check if stored info is still valid (within 24 hours)
                    const age = Date.now() - (simplifiedLoginInfo.timestamp || 0);
                    if (age < 24 * 60 * 60 * 1000) {
                        simplifiedLoginMode = simplifiedLoginInfo.type;
                    } else {
                        // Expired, clear it
                        window.sessionStorage.removeItem('simplifiedLogin');
                        simplifiedLoginInfo = null;
                    }
                }
            } catch (e) {
                console.warn('Error reading simplified login info:', e);
            }
            
            // Restore developer mode flag (per browser session; cleared on logout)
            try {
                const dev = localStorage.getItem(DEV_MODE_STORAGE_KEY);
                if (dev === 'true') {
                    isDeveloperMode = true;
                    window.isDeveloperMode = true;
                    const banner = document.getElementById('developer-mode-banner');
                    if (banner) banner.style.display = 'block';
                    const toggle = document.getElementById('developer-mode-toggle');
                    if (toggle) toggle.checked = true;
                    requestAnimationFrame(() => { if (typeof updateSidebarTop === 'function') updateSidebarTop(); });
                }
            } catch (e) {
                console.warn('Error reading developer mode flag:', e);
            }
            
            // If URL param indicates simplified view but no stored login, they need to log in
            if (isSimplifiedView && !simplifiedLoginInfo) {
                // Will show simplified login form in handleAuthStateChange
            } else if (simplifiedLoginInfo) {
                // Use stored login info and apply appropriate view
                simplifiedLoginMode = simplifiedLoginInfo.type;
                if (simplifiedLoginMode === 'rider') {
                    enableSimplifiedViewMode('rider');
                } else if (simplifiedLoginMode === 'coach') {
                    enableSimplifiedViewMode('coach');
                }
            }
            
            // Initialize Supabase client
            if (typeof initSupabase === 'function') {
                initSupabase();
            }
            
            // Initialize authentication (this will call handleAuthStateChange)
            if (typeof initAuth === 'function') {
                initAuth();
            } else {
                // Fallback: if auth not available, use localStorage mode
                await loadApplicationData();
            }

            setupAutoLogoutOnClose();

            // Register page lifecycle handlers so data is saved when tab goes to background
            // (e.g., Mac desktop switch) and reloaded when it comes back
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('focus', handleWindowFocus);
        }

        function setupAutoLogoutOnClose() {
            // Mark this browser session as active.
            // sessionStorage survives page refreshes but is cleared when the
            // browser/tab is closed — we use this to distinguish refresh vs close.
            sessionStorage.setItem('teamridepro_session_active', 'true');

            const handleBeforeUnload = () => {
                // Flush data to localStorage synchronously (survives page unload)
                try {
                    if (data && typeof JSON !== 'undefined') {
                        localStorage.setItem('teamRideProData', JSON.stringify(data));
                    }
                } catch (e) {}

                // Clear intervals synchronously
                if (adminEditLockInterval) { clearInterval(adminEditLockInterval); adminEditLockInterval = null; }
                if (takeOverCheckInterval) { clearInterval(takeOverCheckInterval); takeOverCheckInterval = null; }

                try {
                    const url = window.SUPABASE_URL || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
                    const key = window.SUPABASE_ANON_KEY || (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');
                    if (!url || !key) return;

                    // Retrieve auth token for the Authorization header
                    let token = key;
                    try {
                        const projectRef = new URL(url).hostname.split('.')[0];
                        const sessionStr = localStorage.getItem('sb-' + projectRef + '-auth-token');
                        if (sessionStr) {
                            const session = JSON.parse(sessionStr);
                            if (session && session.access_token) token = session.access_token;
                        }
                    } catch (e) {}

                    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

                    // Release admin edit lock (safe on refresh — lock is re-acquired on load)
                    if (currentUser) {
                        fetch(url + '/rest/v1/admin_edit_locks?id=eq.current&user_id=eq.' + currentUser.id, {
                            method: 'DELETE',
                            headers: {
                                'apikey': key,
                                'Authorization': 'Bearer ' + token,
                                'Content-Type': 'application/json'
                            },
                            keepalive: true
                        }).catch(() => {});
                    }

                    // NOTE: We do NOT sign out or clear the auth token here.
                    // beforeunload fires on both refresh AND close — we cannot
                    // distinguish the two.  Instead, auto-logout on true browser
                    // close is handled by checkAutoLogoutOnOpen() which runs at
                    // startup and detects that sessionStorage was cleared
                    // (indicating the browser was closed, not just refreshed).
                } catch (error) {
                    console.warn('Auto-logout cleanup on unload failed:', error);
                }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        // Called once at startup (from init).  If sessionStorage is empty it means
        // the browser was closed since the last visit — clear the stored Supabase
        // auth token so the user must sign in again.
        function checkAutoLogoutOnOpen() {
            const wasActive = sessionStorage.getItem('teamridepro_session_active');
            let navigationType = '';
            try {
                const nav = performance.getEntriesByType('navigation');
                if (Array.isArray(nav) && nav[0] && nav[0].type) {
                    navigationType = nav[0].type;
                }
            } catch (e) {
                navigationType = '';
            }

            if (wasActive) {
                // This is a page refresh (or same-tab navigation) — session continues.
                return;
            }

            // Reload in the same tab should keep auth; true fresh opens should not.
            if (navigationType === 'reload') {
                return;
            }

            // Browser/tab was closed → clear Supabase auth artifacts from localStorage
            try {
                const url = window.SUPABASE_URL || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
                let projectRef = '';
                try {
                    if (url) {
                        projectRef = new URL(url).hostname.split('.')[0] || '';
                    }
                } catch (e) {
                    projectRef = '';
                }

                const keysToClear = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key) continue;
                    if (projectRef) {
                        if (key.startsWith('sb-' + projectRef + '-') && key.includes('auth-token')) {
                            keysToClear.push(key);
                        }
                    } else if (/^sb-.*-auth-token/.test(key)) {
                        keysToClear.push(key);
                    }
                }

                keysToClear.forEach(k => {
                    try { localStorage.removeItem(k); } catch (e) {}
                });
                if (keysToClear.length > 0) {
                    console.log(`Auto-logout: cleared ${keysToClear.length} stale auth token entr${keysToClear.length === 1 ? 'y' : 'ies'} after close.`);
                }
            } catch (e) {
                console.warn('checkAutoLogoutOnOpen error:', e);
            }

            // Also clear developer mode flag
            try {
                localStorage.removeItem(DEV_MODE_STORAGE_KEY);
            } catch (e) {}
        }
        
        function enableRiderViewMode() {
            // Legacy function - redirect to new generic function
            enableSimplifiedViewMode('rider');
        }

        function enableSimplifiedViewMode(type) {
            // Hide the desktop tab bar entirely in simplified view (desktop + mobile)
            const desktopTabs = document.getElementById('desktop-tabs');
            if (desktopTabs) {
                if (!desktopTabs.dataset.originalDisplay) {
                    desktopTabs.dataset.originalDisplay = desktopTabs.style.display || 'flex';
                }
                desktopTabs.style.display = 'none';
            }

            // Hide all tabs except the appropriate assignment tab
            const allTabs = document.querySelectorAll('.tab, .mobile-menu-item');
            const targetTabName = type === 'rider' ? 'Rider Assignments' : 'Coach Assignments';
            const targetTabId = type === 'rider' ? 'assignments' : 'coach-assignments';
            
            allTabs.forEach(tab => {
                const tabText = tab.textContent.trim();
                const onClickAttr = tab.getAttribute('onclick') || '';
                const isTargetTab = tabText.includes(targetTabName) || onClickAttr.includes(targetTabId);
                
                if (!isTargetTab) {
                    tab.style.display = 'none';
                } else {
                    tab.style.display = '';
                }
            });
            
            // Hide header actions (user menu, etc.) except sign out
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
                // Keep user menu but show simplified user info
                const userNameEl = document.getElementById('user-name');
                if (userNameEl && simplifiedLoginInfo) {
                    userNameEl.textContent = simplifiedLoginInfo.name || (type === 'rider' ? 'Rider' : 'Coach');
                }
                const userRoleEl = document.getElementById('user-role');
                if (userRoleEl) {
                    userRoleEl.textContent = type === 'rider' ? 'Rider' : 'Coach';
                }
            }
            
            // Switch to the appropriate assignments tab
            setTimeout(() => {
                const targetTab = type === 'rider' 
                    ? document.querySelector('.tab[onclick*="assignments"]:not([onclick*="coach-assignments"])')
                    : document.querySelector('.tab[onclick*="coach-assignments"]');
                    
                if (targetTab) {
                    targetTab.click();
                } else {
                    // Fallback: switch programmatically
                    switchTab(targetTabId, null);
                }
            }, 100);
            
            // Prevent tab switching (override switchTab function for simplified view)
            const originalSwitchTab = window.switchTab;
            window.switchTab = function(tabName, element) {
                if (tabName !== targetTabId) {
                    // Only allow switching to the target assignment tab
                    return;
                }
                // Call original function
                if (originalSwitchTab) {
                    originalSwitchTab.call(this, tabName, element);
                }
            };
        }
        
        // lastVisibilityCheck, isReloading are in app-state.js
        
        // Flush any pending ride saves before reloading (async version for DB saves)
        async function flushPendingRideSavesAsync() {
            // Save current ride if it exists and has changes
            if (data.currentRide) {
                const ride = data.rides.find(r => r.id === data.currentRide);
                if (ride) {
                    try {
                        await saveRideToDB(ride);
                    } catch (error) {
                        console.error('Error flushing ride save:', error);
                    }
                }
            }
        }

        function flushPendingSaves() {
            // Flush any pending debounced ride save
            if (window.rideSaveTimeout) {
                clearTimeout(window.rideSaveTimeout);
                window.rideSaveTimeout = null;
            }
            // Synchronously write current data to localStorage so it survives tab freeze/close
            try {
                const STORAGE_KEY_FLUSH = 'teamRideProData';
                if (data && typeof JSON !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY_FLUSH, JSON.stringify(data));
                }
            } catch (e) {
                console.warn('flushPendingSaves: localStorage write failed', e);
            }
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                // Page going to background (e.g., Mac desktop switch) -- flush pending saves
                flushPendingSaves();
            } else if (!isReloading) {
                // Don't reload before initial auth/boot has completed
                if (!appBootComplete) return;

                // Don't reload while the welcome screen is showing
                const welcomeEl = document.getElementById('welcome-screen');
                if (welcomeEl && welcomeEl.style.display !== 'none') return;

                // Page became visible again -- reload from Supabase to pick up any changes
                // Use a long throttle (60s) to avoid overwriting in-progress edits
                const now = Date.now();
                if (now - lastVisibilityCheck > 60000) {
                    // Snapshot ephemeral per-ride state before reload (color names, visible skills)
                    // so we can restore them if Supabase didn't persist them (e.g. developer mode)
                    let groupColorSnapshot = null;
                    let visibleSkillsSnapshot = null;
                    const preReloadRide = data.rides && data.rides.find(r => r.id === data.currentRide);
                    if (preReloadRide && Array.isArray(preReloadRide.groups)) {
                        const cm = {};
                        preReloadRide.groups.forEach(g => { if (g && g.id && g.colorName) cm[g.id] = g.colorName; });
                        if (Object.keys(cm).length > 0) groupColorSnapshot = cm;
                        if (Array.isArray(preReloadRide.visibleSkills)) visibleSkillsSnapshot = preReloadRide.visibleSkills.slice();
                    }

                    lastVisibilityCheck = now;
                    const loadPromise = loadApplicationData();
                    initAdminEditLock();

                    // After reload completes, restore ephemeral state if Supabase lost it
                    if (groupColorSnapshot || visibleSkillsSnapshot) {
                        Promise.resolve(loadPromise).then(() => {
                            const ride = data.rides && data.rides.find(r => r.id === data.currentRide);
                            if (!ride) return;
                            let needsRender = false;
                            if (groupColorSnapshot && Array.isArray(ride.groups)) {
                                ride.groups.forEach(g => {
                                    if (g && g.id && !g.colorName && groupColorSnapshot[g.id]) {
                                        g.colorName = groupColorSnapshot[g.id];
                                        needsRender = true;
                                    }
                                });
                            }
                            if (visibleSkillsSnapshot && !ride.visibleSkills) {
                                ride.visibleSkills = visibleSkillsSnapshot;
                                needsRender = true;
                            }
                            if (needsRender && typeof renderAssignments === 'function') {
                                renderAssignments(ride);
                            }
                        }).catch(() => {});
                    }
                }
            }
        }
        
        function handleWindowFocus() {
            // Disabled: the window.focus handler was reloading data on every click-back
            // from dev tools or alt-tab, which overwrote unsaved edits.
            // Visibility-change (tab switch/minimize) is sufficient for cross-device sync.
        }
