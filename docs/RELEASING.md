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

## Pendiente para tiendas (después)

- **Firma de producción** (keystore) y `assembleRelease` / `bundleRelease` (AAB)
  para Google Play. La clave NO se versiona: se guarda como *secret* del repo y
  se inyecta en el workflow.
- Íconos y splash definitivos (hoy hay placeholders en `public/icons`).
- Credenciales y ficha en **Google Play Console** (y luego App Store / iOS).
