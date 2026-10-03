@echo off
cd /d "%~dp0"
python build-tools\build_public.py --preview
if errorlevel 1 goto end
echo Ouvrez http://127.0.0.1:8090/ ; Supabase doit etre configure pour les cours.
python -m http.server 8090 --bind 127.0.0.1 --directory dist
:end
pause
