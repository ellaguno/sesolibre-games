#!/usr/bin/env bash
#
# Ajusta el AndroidManifest.xml que genera `cap add android` (android/ no se
# versiona). Ejecútalo DESPUÉS de `cap add`/`cap sync`. Es idempotente.
#
# 1. Orientación vertical: los juegos no están diseñados para horizontal.
# 2. android.hardware.screen.portrait como OPCIONAL: fijar screenOrientation
#    hace que Android lo declare *obligatorio*, y Google Play entonces oculta la
#    app en tablets, Chromebooks, Google Play Games para PC y Android XR
#    ("Las declaraciones de funciones de hardware obligatorias restringen la
#    disponibilidad de tu app"). En esos equipos se muestra en vertical igual.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
[ -f "$MANIFEST" ] || { echo "::error::android-manifest: no existe $MANIFEST" >&2; exit 1; }

if ! grep -q 'android:screenOrientation=' "$MANIFEST"; then
  grep -q 'android:launchMode="singleTask"' "$MANIFEST" ||
    { echo "::error::android-manifest: no encuentro launchMode en la actividad" >&2; exit 1; }
  sed -i 's/android:launchMode="singleTask"/android:launchMode="singleTask"\n            android:screenOrientation="portrait"/' "$MANIFEST"
fi

if ! grep -q 'android.hardware.screen.portrait' "$MANIFEST"; then
  sed -i 's#^\(\s*\)<application#\1<uses-feature android:name="android.hardware.screen.portrait" android:required="false" />\n\n\1<application#' "$MANIFEST"
fi

grep -q 'android:screenOrientation="portrait"' "$MANIFEST" &&
  grep -q 'android.hardware.screen.portrait" android:required="false"' "$MANIFEST" ||
  { echo "::error::android-manifest: no se pudo ajustar el manifiesto" >&2; exit 1; }
echo "android-manifest: vertical + screen.portrait opcional"
