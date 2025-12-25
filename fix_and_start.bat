@echo off
echo "[QuantEdge] Permanent Website Reset and Fix..."
echo.

echo 1. Killing any existing Node/Next.js processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM next.exe /T 2>nul

echo.
echo 2. Clearing build caches...
if exist .next rmdir /S /Q .next
echo.

echo 3. Verifying dependencies (Quick check)...
if not exist node_modules (
    echo [ERROR] node_modules missing. Please run 'npm install' first.
    pause
    exit /b
)

echo 4. Starting Dev Server (Standard Mode)...
echo.
echo %DATE% %TIME% - Starting Next.js... >> server_start.log
.\npx.bat next dev

pause
