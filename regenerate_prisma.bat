@echo off
echo Generating Prisma Client...
cd /d "%~dp0"
where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx not found in PATH
    echo Please run manually: npx prisma generate
    pause
    exit /b 1
)
npx prisma generate
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Prisma client generated
) else (
    echo FAILED: Prisma generation failed
)
pause
