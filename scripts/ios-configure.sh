#!/usr/bin/env bash
#
# Ajusta el proyecto iOS que genera `npx cap add ios` (ios/ NO se versiona, igual
# que android/) para poder firmarlo y subirlo a App Store / TestFlight.
# Ejecútalo DESPUÉS de `cap add ios`, `cap sync ios` y de generar los íconos.
#
# Uso: scripts/ios-configure.sh <versión> <build> <team-id> <nombre-del-perfil>
#   versión  CFBundleShortVersionString (la de package.json)
#   build    CFBundleVersion (github.run_number: siempre creciente)
#
# Qué hace:
#   1. Info.plist: ITSAppUsesNonExemptEncryption=false (sin trámite de
#      exportación), solo vertical (como Android) y pantalla completa en iPad
#      (con eso Apple no exige soportar todas las orientaciones).
#   2. Versión y número de build en el target App.
#   3. Firma manual de Release con "Apple Distribution" + el perfil App Store
#      SOLO en el target App (pasarla por línea de comandos a xcodebuild la
#      aplicaría también a los paquetes SPM de Capacitor, que no la admiten).
#   4. Copia native/ios/PrivacyInfo.xcprivacy y lo añade a los recursos.
#   5. Garantiza que el ícono de 1024 no tenga canal alfa (App Store lo rechaza).
#
# Requiere macOS (PlistBuddy, sips) y la gema xcodeproj (viene con CocoaPods en
# los runners de GitHub; si no, `gem install xcodeproj`).

set -euo pipefail

VERSION="${1:?versión}"
BUILD="${2:?build}"
TEAM_ID="${3:?team id}"
PROFILE="${4:?nombre del perfil}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/ios/App"
PLIST="$APP_DIR/App/Info.plist"
PROJECT="$APP_DIR/App.xcodeproj"

die() {
  echo "::error::ios-configure: $1" >&2
  exit 1
}

[ -f "$PLIST" ] || die "no existe $PLIST (¿falta 'npx cap add ios'?)"
[ -d "$PROJECT" ] || die "no existe $PROJECT"

PB=/usr/libexec/PlistBuddy
set_plist() { # clave tipo valor
  "$PB" -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$1 $2 $3" "$PLIST"
}

# --- 1. Info.plist ----------------------------------------------------------
set_plist ITSAppUsesNonExemptEncryption bool false
set_plist UIRequiresFullScreen bool true
for key in UISupportedInterfaceOrientations UISupportedInterfaceOrientations~ipad; do
  "$PB" -c "Delete :$key" "$PLIST" >/dev/null 2>&1 || true
  "$PB" -c "Add :$key array" "$PLIST"
  "$PB" -c "Add :$key:0 string UIInterfaceOrientationPortrait" "$PLIST"
done
# Versión explícita (además de las build settings) por si la plantilla no usa
# $(MARKETING_VERSION)/$(CURRENT_PROJECT_VERSION).
set_plist CFBundleShortVersionString string "$VERSION"
set_plist CFBundleVersion string "$BUILD"

# --- 4. Manifiesto de privacidad ---------------------------------------------
cp "$ROOT/native/ios/PrivacyInfo.xcprivacy" "$APP_DIR/App/PrivacyInfo.xcprivacy"

# --- 2, 3 y 4: proyecto Xcode -----------------------------------------------
VERSION="$VERSION" BUILD="$BUILD" TEAM_ID="$TEAM_ID" PROFILE="$PROFILE" PROJECT="$PROJECT" ruby <<'RUBY'
require 'xcodeproj'

project = Xcodeproj::Project.open(ENV['PROJECT'])
target = project.targets.find { |t| t.name == 'App' } or abort 'no hay target App'

target.build_configurations.each do |config|
  s = config.build_settings
  s['MARKETING_VERSION'] = ENV['VERSION']
  s['CURRENT_PROJECT_VERSION'] = ENV['BUILD']
  s['DEVELOPMENT_TEAM'] = ENV['TEAM_ID']
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  next unless config.name == 'Release'

  s['CODE_SIGN_STYLE'] = 'Manual'
  s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  s['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
  s['PROVISIONING_PROFILE_SPECIFIER'] = ENV['PROFILE']
end

group = project.main_group.find_subpath('App', false) or abort 'no hay grupo App'
unless group.files.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  ref = group.new_reference('PrivacyInfo.xcprivacy')
  target.resources_build_phase.add_file_reference(ref, true)
end

project.save
puts "Proyecto: versión #{ENV['VERSION']} (#{ENV['BUILD']}), firma manual con '#{ENV['PROFILE']}'"
RUBY

# --- 5. Ícono de 1024 sin alfa ---------------------------------------------
ICONSET="$APP_DIR/App/Assets.xcassets/AppIcon.appiconset"
for icon in "$ICONSET"/*.png; do
  [ -e "$icon" ] || continue
  if sips -g hasAlpha "$icon" | grep -q 'hasAlpha: yes'; then
    # PNG -> JPEG -> PNG elimina el canal alfa sin herramientas extra.
    sips -s format jpeg "$icon" --out "$icon.jpg" >/dev/null
    sips -s format png "$icon.jpg" --out "$icon" >/dev/null
    rm -f "$icon.jpg"
    echo "Alfa eliminado: $(basename "$icon")"
  fi
done

echo "ios-configure: listo"
