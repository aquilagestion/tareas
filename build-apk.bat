@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\build-apk-local.ps1" -Root "%ROOT%"
if errorlevel 1 (
  echo.
  echo ERROR: build APK local fallido.
  exit /b 1
)

echo.
echo APK en: %ROOT%\releases\
endlocal
