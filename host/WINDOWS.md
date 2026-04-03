# Windows

## Prerequisites

- Install [Python](https://www.python.org/downloads/)
- Install [Inno Setup](https://jrsoftware.org/isdl.php)

## Configure to Google Chrome

1. Open Google Chrome.
2. Go to `chrome://extensions/`.
3. Copy `ID` from `chrome://extensions/`.
4. Paste `ID` into `config.env`.

## Configure to Microsoft Edge

1. Open Microsoft Edge.
2. Go to `edge://extensions/`.
3. Copy `ID` from `edge://extensions/`.
4. Paste `ID` into `config.env`.

## Build

```bash
.\build_windows.bat
```

## Install

```bash
.\windows\Install.exe
```
