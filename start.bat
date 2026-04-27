@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi.
  echo Once Node.js kurmaniz gerekiyor: https://nodejs.org/
  echo Kurulumdan sonra bu dosyayi tekrar calistirin.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Gerekli paketler yukleniyor...
  call npm install
  if errorlevel 1 (
    echo npm install basarisiz oldu.
    pause
    exit /b 1
  )
)

echo Uygulama baslatiliyor...
start "" http://localhost:3000
call npm start

pause
