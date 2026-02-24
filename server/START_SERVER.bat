@echo off
echo Starting Strava Route Proxy Server...
echo.

REM Try to find node.exe
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using node from PATH...
    node server.js
) else (
    echo Node.js not found in PATH. Trying default installation location...
    if exist "C:\Program Files\nodejs\node.exe" (
        "C:\Program Files\nodejs\node.exe" server.js
    ) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
        "C:\Program Files (x86)\nodejs\node.exe" server.js
    ) else (
        echo ERROR: Node.js not found!
        echo Please install Node.js from https://nodejs.org/
        echo Or add Node.js to your system PATH.
        pause
        exit /b 1
    )
)

pause



