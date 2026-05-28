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

## Pendiente para tiendas (después)

- Ficha de **Play Console**: política de privacidad (URL), Seguridad de los
  datos, clasificación de contenido, público objetivo, ícono 512×512, gráfico de
  funciones 1024×500 y capturas.
- Prueba **cerrada** con 12 testers durante 14 días (requisito de cuentas
  personales nuevas) antes de pedir acceso a producción.
- iOS / App Store.
