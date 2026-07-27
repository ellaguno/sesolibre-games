#!/usr/bin/env bash
#
# Aplica al proyecto Android generado las optimizaciones que pide Google Play
# Console ("Optimización de las aplicaciones": porcentaje de ofuscación, de
# reducción y configuración de R8).
#
# Hace falta un script porque `android/` NO se versiona: tanto en local como en
# CI lo regenera `npx cap add android`, que lo crea siempre con R8 desactivado.
# Ejecútalo DESPUÉS de `cap add`/`cap sync` y ANTES de compilar.
#
# Qué hace:
#   1. Sube el Android Gradle Plugin a 9.x (Play avisa si es anterior a 9.0) y
#      el wrapper de Gradle a la versión que ese AGP exige.
#   2. Activa R8 en release: minifyEnabled + shrinkResources, con el fichero de
#      reglas "-optimize" (el otro lleva -dontoptimize y AGP 9 ya lo rechaza).
#   3. Instala las reglas de conservación de la app (puente WebView/Capacitor).
#   4. Declara el modo completo de R8.
#
# Es idempotente y falla en cuanto un patrón no encaja, para que un cambio
# futuro de Capacitor no lo deje sin efecto en silencio.

set -euo pipefail

AGP_VERSION="${AGP_VERSION:-9.0.1}"
GRADLE_VERSION="${GRADLE_VERSION:-9.1.0}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
ROOT_GRADLE="$ANDROID_DIR/build.gradle"
WRAPPER="$ANDROID_DIR/gradle/wrapper/gradle-wrapper.properties"
PROPS="$ANDROID_DIR/gradle.properties"
RULES="$ANDROID_DIR/app/proguard-rules.pro"

die() {
  echo "::error::android-optimize: $1" >&2
  exit 1
}

[ -d "$ANDROID_DIR" ] || die "no existe $ANDROID_DIR (¿falta 'npx cap add android'?)"
for f in "$APP_GRADLE" "$ROOT_GRADLE" "$WRAPPER" "$PROPS"; do
  [ -f "$f" ] || die "no existe $f"
done

# --- 1. AGP y Gradle -------------------------------------------------------
grep -q "com.android.tools.build:gradle:" "$ROOT_GRADLE" ||
  die "no encuentro la dependencia del AGP en build.gradle"
sed -i -E "s#com\.android\.tools\.build:gradle:[0-9.]+#com.android.tools.build:gradle:${AGP_VERSION}#" "$ROOT_GRADLE"

sed -i -E "s#gradle-[0-9.]+-(all|bin)\.zip#gradle-${GRADLE_VERSION}-all.zip#" "$WRAPPER"
grep -q "gradle-${GRADLE_VERSION}-all.zip" "$WRAPPER" || die "no pude fijar la versión de Gradle"

# --- 2. R8 en release ------------------------------------------------------
# El bloque generado por Capacitor es siempre:
#     release {
#         minifyEnabled false
#         proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
#     }
if grep -q "minifyEnabled false" "$APP_GRADLE"; then
  sed -i "s/minifyEnabled false/minifyEnabled true\n            shrinkResources true/" "$APP_GRADLE"
fi
# proguard-android.txt lleva -dontoptimize y AGP 9 lo rechaza de plano.
sed -i "s/getDefaultProguardFile('proguard-android\.txt')/getDefaultProguardFile('proguard-android-optimize.txt')/" "$APP_GRADLE"

grep -q "minifyEnabled true" "$APP_GRADLE" || die "no pude activar minifyEnabled"
grep -q "shrinkResources true" "$APP_GRADLE" || die "no pude activar shrinkResources"
grep -q "proguard-android-optimize.txt" "$APP_GRADLE" || die "no pude fijar el proguard '-optimize'"

# --- 3. Reglas de conservación --------------------------------------------
cp "$ROOT/scripts/android-proguard-rules.pro" "$RULES"

# --- 4. Modo completo de R8 ------------------------------------------------
if ! grep -q "^android.enableR8.fullMode=" "$PROPS"; then
  {
    echo ""
    echo "# Modo completo de R8 (lo que mide Play Console en \"Optimización\")."
    echo "android.enableR8.fullMode=true"
  } >>"$PROPS"
fi

echo "android-optimize: AGP ${AGP_VERSION}, Gradle ${GRADLE_VERSION}, R8 activado."
grep -nE "minifyEnabled|shrinkResources|proguardFiles" "$APP_GRADLE"
