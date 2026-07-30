# Google Play Juegos (estadísticas y ranking global)

La app puede enviar las puntuaciones a **Google Play Juegos** (Play Games
Services) para que Google lleve las estadísticas de jugadores y para mostrar,
dentro de la pantalla de **Récords**, quién tiene las mejores marcas.

Qué hay ya hecho en el repo y qué falta por hacer en Play Console:

| Parte | Estado |
| --- | --- |
| Plugin nativo (Android) | ✅ `plugins/capacitor-play-games/` |
| Envío de puntuaciones al terminar una partida | ✅ `src/hub/GameHost.tsx` |
| Ranking dentro de la pantalla de Récords | ✅ `src/hub/RecordsScreen.tsx` |
| Configuración del proyecto en CI | ✅ `scripts/android-play-games.sh` |
| **Proyecto de Play Juegos + tablas en Play Console** | ⛔ **manual (ver abajo)** |
| **Pegar los ids en el repo** | ⛔ **manual (ver abajo)** |

Mientras falten los dos últimos pasos la app funciona igual: el ranking global
queda apagado y Récords muestra solo las marcas locales.

## Cómo funciona

- **Solo en Android** y solo en instalaciones de Google Play firmadas con una
  clave dada de alta en Play Console. En la web (PWA) no hay ranking global:
  Play Juegos no tiene versión web.
- El inicio de sesión se intenta **en silencio** al arrancar. Si el jugador
  nunca ha entrado, Récords muestra un botón para conectarse (la pantalla de
  Google necesita un gesto del usuario; no se abre sola).
- Las puntuaciones se envían con `submitScore`, que **encola** si no hay red y
  reintenta cuando vuelve.
- El ranking se lee con `loadTopScores` y se pinta con nuestro diseño; el botón
  *Ver en Google Play Juegos* abre la pantalla nativa de Google.

## 1) Crear el proyecto de Play Juegos

En [Play Console](https://play.google.com/console) → tu app → **Crecimiento** →
**Play Juegos** → *Configurar Play Juegos*:

1. Crea el proyecto de Play Juegos y **vincúlalo con la app**
   (`com.sesolibre.sesolibregames`).
2. Anota el **ID del proyecto** (un número largo, p. ej. `123456789012`).
3. **Credenciales**: crea una credencial de tipo *Android* y asóciale las
   huellas **SHA-1** de:
   - la **clave de firma de la app** (Play App Signing → *Firma de la app*), y
   - la **upload key** (`~/.sesolibre-keys/upload-keystore.jks`), para poder
     probar con los AAB que subimos, y
   - la clave de **depuración** (`~/.android/debug.keystore`, contraseña
     `android`) si quieres probar el APK debug:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
       -storepass android -keypass android | grep SHA1
     ```
   Sin la SHA-1 correcta el inicio de sesión falla con `SIGN_IN_REQUIRED` /
   `DEVELOPER_ERROR`.
4. **Testers**: en la pestaña de *Testers* de Play Juegos añade las cuentas que
   probarán antes de publicar. Mientras el proyecto esté sin publicar, solo esas
   cuentas pueden iniciar sesión.

## 2) Crear una tabla de clasificación por juego

Play Juegos → **Clasificaciones** → *Crear clasificación*. Una por juego, con
esta configuración (importante: el orden decide quién va primero):

| Juego | Formato | Orden |
| --- | --- | --- |
| Figures | Numérico | Mayor es mejor |
| Glótono | Numérico | Mayor es mejor |
| Bloques | Numérico | Mayor es mejor |
| Buscaminas | Tiempo | **Menor es mejor** |
| Sudoku | Tiempo | **Menor es mejor** |
| Solitario (movimientos) | Numérico | **Menor es mejor** |
| Ajedrez (jugadas) | Numérico | **Menor es mejor** |

> Las tablas de tipo **Tiempo** se miden en **milisegundos**; la app ya
> multiplica por 1000 los tiempos (que lleva en segundos). Ver
> `toLeaderboardScore` en `src/core/playGames/config.ts`.

Copia el **id** de cada tabla (tienen la forma `CgkIxxxxxxxxxxx`).

## 3) Pegar los ids en el repo

1. **Id del proyecto** → `native/android/games-ids.xml`:
   ```xml
   <string name="game_services_project_id" translatable="false">123456789012</string>
   ```
2. **Ids de las tablas** → `src/core/playGames/config.ts`:
   ```ts
   export const LEADERBOARD_IDS: Record<string, string> = {
     figures: 'CgkI...',
     glotono: 'CgkI...',
     // …un id por juego; vacío = ese juego se queda sin ranking global
   };
   ```

Ninguno de los dos es un secreto (viajan dentro del APK), por eso se versionan.

## 4) Compilar y probar

```bash
npm run android:apk     # sincroniza, aplica la config de Play Juegos y compila
```

Para probar el inicio de sesión hacen falta las tres cosas: APK firmado con una
clave registrada en la credencial, cuenta añadida como tester y la app de
**Google Play Juegos** instalada en el dispositivo.

En CI ya está integrado: `android.yml` y `play-aab.yml` ejecutan
`scripts/android-play-games.sh` después de `cap sync`.

## 5) Antes de publicar

- **Publicar** el proyecto de Play Juegos (si sigue en borrador, solo los
  testers pueden entrar).
- **Data safety / Seguridad de los datos** en Play Console: al usar Play Juegos
  la app deja de ser 100 % sin conexión. Hay que declarar que, *si el jugador
  se conecta*, se comparten con Google el identificador de jugador, el nombre
  visible y las puntuaciones. La política de privacidad ya lo recoge
  (`docs/PRIVACY.md`).

## Detalles de implementación

- `plugins/capacitor-play-games/` — plugin de Capacitor con el código Android
  (Java). Expone `initialize`, `signIn`, `isSignedIn`, `getPlayer`,
  `submitScore`, `loadTopScores`, `loadPlayerScore`, `showLeaderboard` y
  `showAllLeaderboards`. `loadTopScores` es lo que permite pintar el ranking con
  nuestro diseño en vez de abrir la pantalla de Google.
- El plugin **quita del manifiesto** el `PlayGamesInitProvider` del SDK (que se
  inicializa solo al arrancar) y llama a `PlayGamesSdk.initialize()` a mano solo
  cuando hay un id válido, para que un id sin configurar no pueda tumbar el
  arranque de la app.
- `src/core/playGames/` — cara TypeScript: `plugin.ts` (tipos + registro, con
  implementación web que responde "no disponible"), `config.ts` (ids y
  conversión de puntuaciones) y `service.ts` (estado de sesión con Zustand y las
  operaciones de alto nivel).

## Posibles siguientes pasos

- **Logros**: `RewardService` ya tiene logros locales; se podrían espejar como
  logros de Play Juegos (el plugin necesitaría `unlockAchievement`).
- **Partidas guardadas** (Saved Games) para sincronizar el progreso entre
  dispositivos.
- **iOS**: el equivalente es Game Center; habría que añadir la parte Swift al
  plugin.
