@echo off

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("config.env") do (
    set "%%A=%%~B"
)

mkdir "windows\windows_build"

python -m pip install pyinstaller cryptography
python -m PyInstaller --onefile --distpath "windows\windows_build" src\main.py

> "windows\windows_build\%NAME%.json" (
    echo {
    echo    "name": "%NAME%",
    echo    "description": "%DESCRIPTION%",
    echo    "type": "stdio",
    echo    "allowed_origins": [
    echo        "chrome-extension://%ID%/"
    echo    ],
    echo    "path": "C:\\Program Files\\%NAME%\\main.exe"
    echo }
)

> "windows\windows_build\installer.iss" (
    echo [Setup]
    echo AppName=%NAME%
    echo AppVersion=1.0.0
    echo ArchitecturesInstallIn64BitMode=x64
    echo DefaultDirName={pf}\%NAME%
    echo OutputBaseFilename=Install
    echo OutputDir=..\
    echo Compression=lzma2
    echo SolidCompression=yes
    echo PrivilegesRequired=admin
    echo.
    echo [Files]
    echo Source: "main.exe"; DestDir: "{app}"; Flags: ignoreversion
    echo Source: "%NAME%.json"; DestDir: "{app}"; Flags: ignoreversion
    echo.
    echo [Registry]
    echo Root: HKLM; Subkey: "Software\Google\Chrome\NativeMessagingHosts\%NAME%"; ValueType: string; ValueName: ""; ValueData: "{app}\%NAME%.json"; Flags: uninsdeletekey
    echo Root: HKLM; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\%NAME%"; ValueType: string; ValueName: ""; ValueData: "{app}\%NAME%.json"; Flags: uninsdeletekey
)

set "ISCC="

for /f "delims=" %%I in ('where iscc.exe 2^>nul') do if not defined ISCC set "ISCC=%%I"

if not defined ISCC if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%LOCALAPPDATA%\Programs\Inno Setup 5\ISCC.exe" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 5\ISCC.exe"

if not defined ISCC if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles(x86)%\Inno Setup 5\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 5\ISCC.exe"

if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 5\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 5\ISCC.exe"

if not defined ISCC (
    echo ERROR: Inno Setup not found.
    echo Install Inno Setup from https://jrsoftware.org/isdl.php
    exit /b 1
)

echo Found Inno Setup.
"%ISCC%" "windows\windows_build\installer.iss"