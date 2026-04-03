#!/bin/bash

source config.env

python3 -m pip install cryptography

mkdir -p "mac/dmg_build"
mkdir -p "mac/Payload/Library/Application Support/${NAME}"
mkdir -p "mac/Payload/Library/Google/Chrome/NativeMessagingHosts"
mkdir -p "mac/Payload/Library/Microsoft Edge/NativeMessagingHosts"

cp src/main.py "mac/Payload/Library/Application Support/${NAME}/"

write_host_manifest() {
  local output_path="$1"

  cat > "$output_path" << EOF
{
  "name": "${NAME}",
  "description": "${DESCRIPTION}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${ID}/"
  ],
  "path": "/Library/Application Support/${NAME}/main.py"
}
EOF
}

write_host_manifest "mac/Payload/Library/Google/Chrome/NativeMessagingHosts/${NAME}.json"
write_host_manifest "mac/Payload/Library/Microsoft Edge/NativeMessagingHosts/${NAME}.json"

chmod 755 "mac/Payload/Library/Application Support/${NAME}/main.py"
chmod 644 "mac/Payload/Library/Google/Chrome/NativeMessagingHosts/${NAME}.json"
chmod 644 "mac/Payload/Library/Microsoft Edge/NativeMessagingHosts/${NAME}.json"

pkgbuild \
  --root "mac/Payload" \
  --identifier "${NAME}" \
  --version "1.0.0" \
  --install-location "/" \
  "mac/dmg_build/Install.pkg"

hdiutil create \
  -volname "${NAME}" \
  -srcfolder "mac/dmg_build" \
  -ov \
  -format UDZO \
  "mac/Install.dmg"