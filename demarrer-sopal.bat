@echo off
title Demarrage Sopal
cd /D "%~dp0"

echo ==========================================
echo   Demarrage de l'application Sopal
echo ==========================================
echo.

echo [1/3] Demarrage de MySQL (XAMPP)...
tasklist /FI "IMAGENAME eq mysqld.exe" | find /I "mysqld.exe" >nul
if %errorlevel%==0 (
    echo     MySQL tourne deja, pas besoin de le redemarrer.
) else (
    start "MySQL - XAMPP" /min "C:\xampp\mysql_start.bat"
)

echo [2/3] Ouverture du panneau XAMPP...
timeout /t 3 /nobreak >nul
start "" "C:\xampp\xampp-control.exe"

echo [3/3] Demarrage du serveur Sopal (Laravel)...
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo     Le serveur Sopal tourne deja sur le port 8000.
) else (
    start "Serveur Sopal" cmd /k "php artisan serve"
)

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/gestion"

echo.
echo Tout est lance ! Tu peux fermer cette fenetre.
timeout /t 5
