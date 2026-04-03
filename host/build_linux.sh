#!/bin/bash

source config.env

python3 -m pip install cryptography

mkdir -p "linux/deb_build/opt/${NAME}"
mkdir -p "linux/deb_build/DEBIAN"

cp src/main.py "linux/deb_build/opt/${NAME}/"

cat > "linux/deb_build/opt/${NAME}/${NAME}.json" << EOF
{
  "name": "${NAME}",
  "description": "${DESCRIPTION}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${ID}/"
  ],
  "path": "/opt/${NAME}/main.py"
}
EOF

cat > "linux/deb_build/DEBIAN/control" << EOF
Package: ${NAME}
Version: 1.0.0
Architecture: all
Maintainer: Jonah Benedicto <jb@jonahbenedicto.com>
Depends: python3
Description: ${DESCRIPTION}
EOF

cat > "linux/deb_build/DEBIAN/postinst" << EOF
#!/bin/bash
set -e

HOST_DIR="/opt/${NAME}"
HOST_FILE="$HOST_DIR/${NAME}.json"

BROWSER_DIRS=(
  "/etc/opt/chrome/native-messaging-hosts"
  "/etc/opt/edge/native-messaging-hosts"
)

for BROWSER_DIR in "${BROWSER_DIRS[@]}"; do
  mkdir -p "$BROWSER_DIR"
  ln -sf "$HOST_FILE" "$BROWSER_DIR/${NAME}.json"
  chmod 644 "$BROWSER_DIR/${NAME}.json"
done

exit 0
EOF

chmod 755 "linux/deb_build/opt/${NAME}/main.py"
chmod 644 "linux/deb_build/opt/${NAME}/${NAME}.json"
chmod 755 "linux/deb_build/DEBIAN/postinst"

dpkg-deb --build "linux/deb_build" "linux/Install.deb"