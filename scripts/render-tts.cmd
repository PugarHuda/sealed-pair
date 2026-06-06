@echo off
REM Wrapper that pipes powershell.exe output cleanly (no `tail` requirement).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0render-tts.ps1" -ManifestPath "%~dp0narration.json" -OutDir "%~dp0out\audio"
