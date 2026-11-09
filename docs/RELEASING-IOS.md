# Publicar en iOS (App Store / TestFlight)

Todo se compila y firma en GitHub Actions (`.github/workflows/ios.yml`, runner
`macos-latest`); no hace falta una Mac.

| Dato | Valor |
|---|---|
| Bundle ID | `com.sesolibre.sesolibregames` (el mismo appId que Android) |
| Team ID | `PLNS58WDQF` |
| Certificado | Apple Distribution (vence 9-nov-2027) |
| Perfil | `SesoLibre Games App Store` (IOS_APP_STORE, lo baja/recrea `scripts/asc-profile.py` por API en cada build) |
| Versión | `version` de package.json; build = `github.run_number` |

## Cuándo corre

- Al empujar un tag `v*` (junto con el APK y el AAB): compila y sube a TestFlight.
- A mano: Actions → "iOS (TestFlight)" → Run workflow (casilla "Subir a TestFlight").

## Secrets del repo

`APPLE_TEAM_ID`, `APPLE_CERT_P12_BASE64` (dist.p12), `APPLE_CERT_PASSWORD`,
`KEYCHAIN_PASSWORD` (aleatorio), `ASC_KEY_ID`, `ASC_ISSUER_ID`,
`ASC_PRIVATE_KEY` (contenido del .p8). Se cargan siempre por stdin:

```bash
gh secret set APPLE_CERT_PASSWORD --repo ellaguno/sesolibre-games   # pide el valor sin mostrarlo
base64 -w0 ~/apple-certs/dist.p12 | gh secret set APPLE_CERT_P12_BASE64 --repo ellaguno/sesolibre-games
```

## Qué hace el workflow

1. `npm ci`, lint, tests y build de la web.
2. `cap add ios` + `cap sync ios` (ios/ no se versiona).
3. Íconos y pantalla de arranque con `@capacitor/assets` desde `assets/`
   (generados por `npm run icons`).
4. `scripts/ios-configure.sh`: `ITSAppUsesNonExemptEncryption=false`, solo
   vertical, versión/build, firma manual del target App,
   `PrivacyInfo.xcprivacy` (de `native/ios/`) e ícono sin alfa.
5. Importa el .p12 a un keychain temporal e instala el perfil.
6. `xcodebuild archive` → `-exportArchive` (app-store-connect) → `altool --upload-app`.
7. El .ipa queda además como artefacto (`sesolibre-games-ipa`).

## Diferencias con Android

- Google Play Juegos no existe en iOS: Récords muestra solo marcas locales y
  no aparece la invitación a la prueba de SesoLibre Mind (`src/core/platform.ts`),
  porque Apple rechaza referencias a otras plataformas (guía 2.3.10).
- Pendiente opcional: ranking global con Game Center.

## Cuando venza algo

- **Certificado (nov-2027)**: crear uno nuevo, exportar el .p12 y volver a cargar
  `APPLE_CERT_P12_BASE64` y `APPLE_CERT_PASSWORD`. El perfil se recrea solo.
- **Llave de la API**: crear otra en App Store Connect → Usuarios y acceso →
  Integraciones y cargar `ASC_KEY_ID` / `ASC_PRIVATE_KEY`.
