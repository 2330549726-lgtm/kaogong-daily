@echo off
chcp 65001 >nul
title Publish Kaogong Daily
cd /d "%~dp0"

echo ========================================
echo   Publish website to GitHub Pages
echo ========================================
echo.

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo No local changes to publish.
  echo.
  pause
  exit /b 0
)

echo [1/3] Creating a local commit...
git commit -m "Publish website update"
if errorlevel 1 goto :error

echo.
echo [2/3] Syncing remote daily updates...
git pull --rebase origin main
if errorlevel 1 goto :error

echo.
echo [3/3] Uploading to GitHub...
git push origin main
if errorlevel 1 goto :error

echo.
echo Publish complete. GitHub Pages normally updates in 1-3 minutes.
pause
exit /b 0

:error
echo.
echo Publish stopped because a Git command failed.
echo Your files were not deleted. Keep this window open and check the message above.
pause
exit /b 1
