# Publicación y builds (Fase 6)

La app se distribuye de dos formas, ambas automatizadas con GitHub Actions.
No hace falta compilar en tu máquina.

## Web (PWA) — automático

Workflow: [`.github/workflows/web.yml`](../.github/workflows/web.yml)

- Se ejecuta en cada push a `main` (y a mano).
- Hace `npm ci && npm run build` y publica `dist/` en **GitHub Pages**.
- URL: `https://ellaguno.github.io/sesolibre-games/`

**Paso manual (una sola vez):** GitHub → *Settings → Pages → Build and
deployment → Source* = **GitHub Actions**. El token del CI no puede crear el
sitio de Pages por sí solo; tras activarlo, vuelve a correr el workflow
(*Actions → Deploy web → Re-run*) y a partir de ahí cada push a `main` lo
publica solo.

La app usa `base: './'` + `HashRouter`, así que funciona bajo el subpath de
Pages sin configuración extra.

## Android (APK) — a demanda / por tag

Workflow: [`.github/workflows/android.yml`](../.github/workflows/android.yml)

- Se ejecuta **manualmente** (Actions → *Android APK* → *Run workflow*) o al
  **publicar un tag** `vX.Y.Z`.
- En CI: build web → `cap add android` (la plataforma se genera, NO se versiona)
  → `cap sync` → `gradlew assembleDebug`.
- Resultado: un **APK de depuración** (instalable; firmado con la clave debug de
  Android, **aún no firmado para tiendas**). Queda como *artefacto* del run y,
  si fue por tag, también como **Release** del repo.

### Publicar una versión con APK

```bash
git tag v0.1.0
git push origin v0.1.0
```

Esto dispara el workflow y crea el Release con `sesolibre-games-v0.1.0.apk`.

### Instalar el APK de prueba

Descárgalo del Release o del artefacto y ábrelo en Android (hay que permitir
"instalar apps de orígenes desconocidos").

## Google Play (AAB firmado)

Workflow: [`.github/workflows/play-aab.yml`](../.github/workflows/play-aab.yml)

Genera un **Android App Bundle (`.aab`) de release** firmado con la *upload key*,
listo para subir a Google Play. Se ejecuta a mano (Actions → *Play AAB* → *Run
workflow*) o al publicar un tag `vX.Y.Z`. El `.aab` queda como **artefacto** del
run (se descarga desde la pestaña Actions; no se publica como Release).

- `versionCode` = número de run (incremental, requisito de Play).
- `versionName` = `version` de `package.json`.
- Local (sin firmar): `npm run android:aab`.

### 1) Crear la upload key (una sola vez, guárdala MUY bien)

```bash
keytool -genkeypair -v -keystore upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 9125
```

Anota la contraseña del almacén y de la clave. **No subas el `.jks` al repo.**
Con **Play App Signing** (recomendado, se activa al crear la app), Google
custodia la clave de firma final y esta solo es la *llave de subida*.

### 2) Cargar los secrets en GitHub

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload-keystore.jks` (todo el texto) |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del almacén |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | contraseña de la clave |

Sin estos secrets el workflow genera el AAB **sin firmar** (solo para validar).

### 3) Subir a Play

Actions → *Play AAB* → *Run workflow* → descarga el artefacto
`sesolibre-games-aab` → súbelo en Play Console (prueba interna o cerrada).

> **Pendiente posible:** Play puede exigir `targetSdkVersion` reciente. Hoy es
> **34** (`android/variables.gradle`, vía Capacitor 6). Si Play lo rechaza, hay
> que subir el target (o actualizar Capacitor).

## Estado de la ficha de Play (v1.0.0)

Ficha de **Play Console** — todo lo de abajo ya está cargado:

- ✅ **Política de privacidad (URL):** <https://sesolibre.com/politica-de-privacidad-sesolibre-games/>
  (200, pública, bilingüe es/en). Texto fuente en [`PRIVACY.md`](PRIVACY.md).
- ✅ **Seguridad de los datos:** "No se recopilan datos" (respuestas en
  [`PLAY-LISTING.md`](PLAY-LISTING.md)).
- ✅ **Clasificación de contenido (IARC):** "Para todos".
- ✅ **Ícono 512×512:** subido manualmente en la consola (NO se referencia por
  URL; Play lo guarda en sus servidores).
- ✅ **Gráfico de funciones 1024×500:** `assets/play/feature-graphic.png`.
- ✅ **Capturas de teléfono:** 4 subidas (mínimo de Play = 2).
- ✅ **AAB v1.0.0** subido al track de prueba cerrada (versionCode incremental
  por el workflow; p. ej. `4 (1.0.0)` = versionCode 4 / versionName 1.0.0).

## Prueba cerrada: cómo se unen los testers

Cuenta personal nueva ⇒ **obligatorio**: prueba **cerrada con ≥12 testers que
hagan opt-in y se mantengan 14 días seguidos** antes de poder *solicitar* acceso
a producción. El contador de 14 días sólo corre mientras haya ≥12 opted-in.

> **Google NO manda invitaciones automáticas. El enlace lo compartes tú.**

1. **Agregar testers** — *Pruebas → Prueba cerrada → pestaña "Testers"*: lista de
   correos o un Grupo de Google. Esto sólo autoriza esas cuentas; no notifica nada.
2. **Copiar el enlace de aceptación** — misma pestaña, sección *"Cómo se unen los
   testers"*: enlace web tipo
   `https://play.google.com/apps/testing/com.sesolibre.sesolibregames`.
   Ese enlace lo mandas tú (WhatsApp/correo) a los testers.
3. **Cada tester** (en el teléfono, con la **misma cuenta Google** que está en su
   Play Store): abre el enlace → *Become a tester / Aceptar* → instala desde Play
   → deja la app instalada ~14 días.

Avisos:
- ⏳ El enlace de aceptación **tarda en activarse** (horas–1 día) tras publicar la
  versión en el track. Abrirlo antes da error; reintentar.
- 🔑 Error #1: el correo agregado debe ser **la cuenta Google del teléfono** del
  tester. Por eso conviene pedirles su correo de Google *antes* de agregarlos.
- 📊 Sólo cuentan los que aceptan (opt-in). Tener ~17 listados da colchón sobre los 12.
- Al cumplir 12 opted-in × 14 días, aparece el botón para **solicitar producción**.

## Pendiente (después)

- iOS / App Store.
