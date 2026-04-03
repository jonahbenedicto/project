# Mac

## Prerequisites

- Install [Python](https://www.python.org/downloads/)

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
./build_mac.sh
```

## Install
```bash
hdiutil attach mac/Install.dmg
sudo cp -R "/Volumes/com.project.host/Install.pkg" /Applications/
hdiutil detach "/Volumes/com.project.host"
```
