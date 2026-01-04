# Folder Organization Summary

This document describes the organized folder structure for the Team Ride Pro application.

## Current Structure

```
Team Practice Pro/
├── teamridepro.html          # Main application file
├── rider-view.html           # Public rider view page
├── verify-account.html       # Email verification page (if using auth)
│
├── docs/                     # Documentation
│   ├── README.md             # Main readme
│   ├── DEVELOPMENT.md        # Development guide
│   ├── CHANGELOG.md          # Change log
│   ├── SETUP_GIT.md          # Git setup guide
│   │
│   ├── supabase/             # Supabase-related documentation
│   │   ├── SETUP_AUTH.md
│   │   ├── README_AUTH.md
│   │   ├── FIX_EMAIL_VERIFICATION.md
│   │   ├── FIX_REDIRECT_URL.md
│   │   ├── FIX_SUPABASE_PORT_8000.md
│   │   ├── FIX_PORT_REDIRECT.md
│   │   ├── DISABLE_EMAIL_VERIFICATION.md
│   │   ├── MANUAL_VERIFICATION.md
│   │   ├── QUICK_VERIFY.md
│   │   ├── QUICK_FIX_CREDENTIALS.md
│   │   ├── QUICK_FIX_WRONG_PORT.md
│   │   ├── QUICK_CHECK_AFTER_LOGIN.md
│   │   ├── NEXT_STEPS_AFTER_LOGIN.md
│   │   ├── AFTER_LOGIN_CHECKLIST.md
│   │   ├── FIND_USER_ID.md
│   │   ├── UPDATE_SUPABASE_REDIRECT.md
│   │   └── URL_REQUIREMENTS.md
│   │
│   └── troubleshooting/     # Troubleshooting guides
│       ├── AFTER_RLS_FIX_STATUS.md
│       ├── APPLY_RLS_FIX_PARTS.md
│       ├── CONSOLE_ERRORS_EXPLAINED.md
│       ├── CONSOLE_ERRORS_SUMMARY.md
│       ├── DIAGNOSE_406_ERRORS.md
│       ├── FINAL_FIXES_APPLIED.md
│       ├── FIX_406_ERRORS.md
│       ├── FIX_406_MISSING_ROLE.md
│       ├── FIX_EXPIRED_LINK.md
│       ├── HOW_TO_FIX_RLS_ERROR.md
│       ├── IMPLEMENTATION_STATUS.md
│       ├── NOW_RUN_POLICIES.md
│       ├── RESTORE_SAMPLE_DATA.md
│       ├── RLS_FIX_COMPLETE.md
│       ├── RUN_COMPREHENSIVE_RLS_FIX.md
│       ├── RUN_FUNCTIONS_FIRST.md
│       ├── RUN_THIS_TO_FIX_406.md
│       ├── SIMPLE_RLS_FIX.md
│       └── USE_BETTER_RLS_FIX.md
│
├── sql/                      # SQL scripts
│   ├── database-schema.sql
│   ├── FIX_ALL_RLS_RECURSION.sql
│   ├── FIX_RLS_FUNCTIONS_ONLY.sql
│   ├── FIX_RLS_POLICIES_ONLY.sql
│   ├── FIX_RLS_RECURSION_V2.sql
│   ├── FIX_RLS_RECURSION.sql
│   ├── FIX_RLS_STEP_BY_STEP.sql
│   ├── FIX_SEASON_AND_AUTO_ASSIGN_POLICIES.sql
│   └── CHECK_AND_FIX_ROLE.sql
│
├── scripts/                  # JavaScript files
│   ├── auth.js               # Authentication functions
│   ├── roles.js              # Role checking utilities
│   ├── supabase-config.js    # Supabase configuration
│   └── api/
│       └── database.js       # Database API wrapper
│
├── assets/                   # Images and assets
│   ├── tam-high-logo.png
│   └── TAMMTB Clipart/       # Logo variations
│
└── temp/                     # Temporary/archive files
    └── (various temp files)
```

## Notes

- **Main HTML files** remain in the root directory for easy access
- **Documentation** is organized by topic (main docs, Supabase setup, troubleshooting)
- **SQL scripts** are grouped together for easy reference
- **JavaScript files** are in scripts/ (currently not used since we rolled back to localStorage)
- **Assets** (images, logos) are in assets/

## Manual Organization

If files weren't moved automatically, you can manually organize them using the structure above. The PowerShell commands had some issues with existing files, but the folder structure is created and ready.

