# Reorganize: move v3/ app to repo root, leave v3/ as redirect only.
#
# YOU MUST DO THESE MANUALLY:
#   1. Merge v3-dev into main (from "TeamRide Pro" folder): git fetch origin && git merge origin/v3-dev -m "Merge v3-dev for v3-at-root"
#   2. Run THIS script (see below).
#   3. Commit and push: git add -A && git commit -m "Reorganize: v3 at root" && git push origin main
#
# THIS SCRIPT DOES: copy v3/* to root, set root index.html redirect, replace v3/ with only v3/index.html redirect.
# It does NOT do git merge, commit, or push.
#
# HOW TO RUN (from "TeamRide Pro" folder, on branch main):
#   cd "D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\TeamRide Pro"
#   .\scripts\reorganize-v3-to-root.ps1
# If PowerShell blocks scripts: powershell -ExecutionPolicy Bypass -File .\scripts\reorganize-v3-to-root.ps1

$ErrorActionPreference = "Stop"
if (-not (Test-Path "v3\teamridepro_v3.html")) {
    Write-Error "v3/ folder not found. Run this script from the main worktree (TeamRide Pro) where v3/ exists."
}

Write-Host "Copying v3/ app files to root..."
Copy-Item "v3\teamridepro_v3.html" "teamridepro_v3.html" -Force
Copy-Item "v3\accept-invitation.html" "accept-invitation.html" -Force
Copy-Item "v3\verify-account.html" "verify-account.html" -Force
Copy-Item "v3\privacy-policy.html" "privacy-policy.html" -Force
Copy-Item "v3\styles.css" "styles.css" -Force
Copy-Item "v3\styles-overrides.css" "styles-overrides.css" -Force
Copy-Item "v3\scripts\*" "scripts\" -Force -Recurse
Copy-Item "v3\assets\*" "assets\" -Force -Recurse
Copy-Item "v3\index.html" "index.html" -Force
# Root index should redirect to teamridepro_v3.html (no v3/ path)
@"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tam High MTB Team</title>
</head>
<body>
    <script>
        var target = 'teamridepro_v3.html' + window.location.hash;
        window.location.replace(target);
    </script>
</body>
</html>
"@ | Set-Content "index.html" -Encoding UTF8

Write-Host "Replacing v3/ with only v3/index.html redirect..."
Remove-Item "v3\*" -Recurse -Force
$null = New-Item -ItemType Directory -Path "v3" -Force
@"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirect</title>
</head>
<body>
    <script>
        window.location.replace('../teamridepro_v3.html' + window.location.hash);
    </script>
    <p>Redirecting to <a href="../teamridepro_v3.html">app</a>...</p>
</body>
</html>
"@ | Set-Content "v3\index.html" -Encoding UTF8

Write-Host "Done. Next: git add -A && git status && git commit -m 'Reorganize: v3 app at root, v3/ only redirect' && git push origin main"
