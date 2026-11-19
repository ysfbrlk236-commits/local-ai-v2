#!/usr/bin/env bash
# Windows kurulum paketini uretir: dist-kurulum/Local-AI-Studio-Kurulum.zip
# Once `npm run build` calistirilmis olmali. data/ ve runtime/ pakete girmez:
# kullanicinin modelleri ve sohbetleri guncellemede ezilmemeli.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
OUT="$ROOT/dist-kurulum"
STAGE="$(mktemp -d)"
PKG="$STAGE/Local-AI-Studio-Kurulum"
mkdir -p "$PKG/dosyalar" "$OUT"

echo "$(git rev-parse --short HEAD 2>/dev/null || echo yerel)-$(date +%s)" > SURUM.txt
zip -qr "$PKG/dosyalar/app.zip" . \
  -x 'node_modules/*' '*/node_modules/*' '.git/*' 'data/*' 'runtime/*' 'dist-kurulum/*' '*.log'
cp SURUM.txt "$PKG/dosyalar/"
cp scripts/desktop/baslat.bat scripts/desktop/kaldir.bat scripts/desktop/simge-yildiz.ico \
   "scripts/desktop/BENI OKU.txt" "$PKG/dosyalar/"
cp scripts/desktop/Kurulum.bat "scripts/desktop/BENI OKU.txt" "$PKG/"
cp scripts/desktop/tasi.ps1 "$PKG/dosyalar/"

rm -f "$OUT/Local-AI-Studio-Kurulum.zip"
(cd "$STAGE" && zip -qr "$OUT/Local-AI-Studio-Kurulum.zip" Local-AI-Studio-Kurulum)
rm -rf "$STAGE"
echo "Hazir: $OUT/Local-AI-Studio-Kurulum.zip ($(cat SURUM.txt))"
