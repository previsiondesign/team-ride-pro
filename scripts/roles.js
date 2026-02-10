// Role-Based Access Control Utilities

const ROLES = {
    COACH_ADMIN: 'coach-admin',
    RIDE_LEADER: 'ride_leader',
    RIDER: 'rider',
    PUBLIC: 'public' // No authentication required
};

// Check if user has a specific role
function hasRole(role) {
    const currentRole = getCurrentUserRole();
    return currentRole === role;
}

// Check if user is a coach-admin
function isCoach() {
    return hasRole(ROLES.COACH_ADMIN);
}

// Check if user is a ride leader
function isRideLeader() {
    return hasRole(ROLES.RIDE_LEADER);
}

// Check if user is a rider
function isRider() {
    return hasRole(ROLES.RIDER);
}

// Check if user is authenticated (any role)
function isAuthenticatedUser() {
    return isAuthenticated() && getCurrentUserRole() !== null;
}

function isReadOnlyAppMode() {
    return typeof window !== 'undefined' && window.isReadOnlyMode === true;
}

// Check if user can edit rider records
function canEditRiders() {
    return isCoach() && !isReadOnlyAppMode();
}

// Check if user can edit coach records
function canEditCoaches() {
    return isCoach() && !isReadOnlyAppMode();
}

// Check if user can edit their own coach record
function canEditOwnCoachRecord(userId) {
    if (isCoach()) return true;
    if (isRideLeader()) {
        const currentUser = getCurrentUser();
        return currentUser && currentUser.id === userId;
    }
    return false;
}

// Check if user can view season setup
function canViewSeasonSetup() {
    return isCoach();
}

// Check if user can create/edit rides
function canCreateEditRides() {
    return isCoach() && !isReadOnlyAppMode();
}

// Check if user can view practice scheduler
function canViewPracticeScheduler() {
    return isCoach() || isRideLeader();
}

// Check if user can view current ride (ride leaders can view but not create)
function canViewCurrentRide() {
    return isCoach() || isRideLeader();
}

// Check if user can add/edit ride feedback
function canAddRideFeedback() {
    return isCoach() || isRideLeader();
}

// Check if user can mark riders absent
function canMarkAbsent() {
    return isCoach() || isRideLeader();
}

// Check if user can adjust assignments
function canAdjustAssignments() {
    return isCoach() || isRideLeader();
}

// Check if user can view routes management
function canViewRoutes() {
    return isCoach();
}

// Check if user can assign roles
function canAssignRoles() {
    return isCoach();
}

// Check if user can view all data (vs limited view)
function canViewAllData() {
    return isCoach() || isRideLeader();
}

// Get visible tabs based on role
function getVisibleTabs() {
    if (isCoach()) {
        return ['team', 'coaches', 'scheduler', 'season', 'routes'];
    } else if (isRideLeader()) {
        return ['team', 'coaches', 'scheduler']; // Limited scheduler access
    } else if (isRider()) {
        return []; // Riders use public view
    } else {
        return []; // Public view
    }
}

// Check if a tab should be visible
function isTabVisible(tabName) {
    const visibleTabs = getVisibleTabs();
    return visibleTabs.includes(tabName);
}

// Check if user can see sensitive data (phone, email, notes, fitness)
function canViewSensitiveData() {
    return isCoach() || isRideLeader();
}

// Check if user can update rider fitness/pace
function canUpdateRiderFitness() {
    return isCoach() || isRideLeader();
}


