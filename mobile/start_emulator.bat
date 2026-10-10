@echo off
echo ===================================================
echo   Starting Pixel 7 Android Emulator (GUI Window)
echo ===================================================

:: Linisin ang anumang naiwang lock files
del /f /q "%USERPROFILE%\.android\avd\Pixel_7.avd\*.lock" 2>nul
rmdir /s /q "%USERPROFILE%\.android\avd\Pixel_7.avd\hardware-qemu.ini.lock" 2>nul

:: Simulan ang emulator sa interactive desktop window
start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd Pixel_7

echo Emulator window launched!

