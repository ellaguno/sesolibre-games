#!/usr/bin/env bash
#
# Instala en el proyecto Android generado la configuración de Google Play
# Juegos: el id del proyecto (native/android/games-ids.xml) como recurso de la
# app, que es lo que el plugin capacitor-play-games declara en su manifiesto
# (<meta-data com.google.android.gms.games.APP_ID>).
#
# Hace falta un script porque android/ NO se versiona: lo regenera
# `npx cap add android` tanto en local como en CI. Ejecútalo DESPUÉS de
# `cap add`/`cap sync`.
#
# Si el id sigue siendo 0 (sin configurar) avisa pero no falla: la app compila
# igual y arranca con el ranking global apagado.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/native/android/games-ids.xml"
DEST_DIR="$ROOT/android/app/src/main/res/values"

die() {
  echo "::error::android-play-games: $1" >&2
  exit 1
}

[ -f "$SRC" ] || die "no existe $SRC"
[ -d "$ROOT/android" ] || die "no existe $ROOT/android (¿falta 'npx cap add android'?)"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/games-ids.xml"

APP_ID="$(sed -n 's/.*name="game_services_project_id"[^>]*>\([^<]*\)<.*/\1/p' "$SRC" | tr -d '[:space:]')"
if [ -z "$APP_ID" ] || [ "$APP_ID" = "0" ]; then
  echo "::warning::Play Juegos sin configurar (game_services_project_id=0): el ranking global quedará apagado."
else
  echo "android-play-games: id del proyecto = $APP_ID"
fi
