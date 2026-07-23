@echo off
title Demarrage Sopal
cd /D "%~dp0"

echo ==========================================
echo   Demarrage de l'application Sopal
echo ==========================================
echo.

echo [1/2] Demarrage du serveur Sopal (Laravel)...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo     Le serveur Sopal tourne deja sur le port 8000.
) else (
    start "Serveur Sopal" cmd /k "php artisan serve"
)

echo [2/2] Ouverture du site...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/commandes"

echo.
echo Tout est lance ! Tu peux fermer cette fenetre.
timeout /t 5
