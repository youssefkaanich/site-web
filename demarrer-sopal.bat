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
    start "Serveur Sopal" cmd /k "php artisan serve --host=0.0.0.0 --port=8000"
)

echo [2/2] Ouverture du site...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/commandes"

echo.
echo Tout est lance ! Tu peux fermer cette fenetre.
echo.
echo Depuis ton telephone (connecte au MEME Wi-Fi que ce PC) :
echo   1. Repere l'adresse IPv4 de la carte "Wi-Fi" ci-dessous
echo   2. Ouvre http://CETTE_ADRESSE:8000 dans le navigateur du telephone
echo.
ipconfig | findstr /C:"IPv4"
echo.
timeout /t 10
