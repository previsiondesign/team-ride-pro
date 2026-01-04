# Updated Authentication Requirements

## Role Structure (3 Roles)

1. **coach-admin**: Full site access
2. **ride_leader**: Access ONLY to "Coach Assignments" tab
3. **rider**: Access ONLY to "Rider Assignments" tab

## Authentication Methods

### Coach-Admin
- **Login Method**: Email + Password only
- **Access**: Full site access (all tabs)
- **Session**: Persists on device

### Ride Leader
- **Login Methods**: 
  - Phone number + SMS code (primary, for mobile)
  - Email + Password (alternative option)
- **Access**: "Coach Assignments" tab only
- **Session**: Persists on device (automatic "remember me" functionality)
- **Mobile-Optimized**: Primarily designed for smartphone access

### Rider
- **Login Methods**:
  - Phone number + SMS code (primary, for mobile)
  - Email + Password (alternative option)
- **Access**: "Rider Assignments" tab only
- **Session**: Persists on device (automatic "remember me" functionality)
- **Mobile-Optimized**: Primarily designed for smartphone access

## Implementation Notes

### "Remember Me" Functionality
- Supabase sessions persist by default in the browser/device
- Users remain logged in until they explicitly log out
- No additional "remember me" checkbox needed - this is the default behavior
- Sessions survive browser restarts and app refreshes
- For mobile devices, this provides the desired "remember me" experience automatically

### Email OR Phone Authentication
- Both ride leaders and riders can choose their preferred authentication method
- Phone authentication requires Twilio SMS setup
- Email authentication uses standard Supabase email/password flow
- The system should present both options on the login screen
- User can choose based on their preference or device capability

### Phone Number Verification
- Before sending SMS, system verifies phone exists in appropriate table (coaches for ride_leader, riders for rider)
- This prevents unauthorized SMS sends and reduces costs
- Phone numbers must be in E.164 format: +14155551234
- Phone numbers must match exactly in the database

### Email Verification
- Email authentication works with standard Supabase email/password
- Users can sign up with email if they don't have a phone number in the system
- Email must exist in the appropriate table (coaches for ride_leader, riders for rider)
- Or admin can create accounts and assign roles manually



