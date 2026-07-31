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
| Proyecto de Play Juegos + las 7 tablas | ✅ creados (borrador) |
| Ids pegados en el repo | ✅ hecho |
| Credenciales OAuth (firma de Play + depuración) | ✅ creadas (borrador) |
| **Publicar el proyecto de Play Juegos** | ⛔ **manual (ver abajo)** |

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

En [Play Console](https://play.google.com/console) → tu app → **Aumenta la
cantidad de usuarios** → **Servicios de Play Games** → **Configuración y
administración** → *Configuración*. (Ojo: no es *Configuración avanzada* → *Play
Games Sidekick*, que es el overlay de Gemini y no tiene nada que ver.)

1. Crea el proyecto de Play Juegos vinculándolo a un **proyecto de Google
   Cloud** — aquí se usó `sesolibre`. Un proyecto de Cloud solo se puede
   vincular a un proyecto de PGS, y el vínculo no se deshace desde la Console.
2. **ID del proyecto: `78911605152`** (ya está en `native/android/games-ids.xml`).
3. **Credenciales**: cada credencial es un cliente OAuth de tipo *Android*, y
   cada cliente vale para **una sola** combinación de paquete + SHA-1. Como hay
   varias claves en juego, hacen falta varias: se crea el cliente en Google
   Cloud (*APIs y servicios → Credenciales*, proyecto `sesolibre`) y luego se
   da de alta en Play Console → *Credenciales → Agregar credencial*.

   Las huellas de este proyecto, todas visibles en Play Console →
   *Protegido con Play → Protección de Play Store → Administrar la firma de
   apps de Play*:

   | Clave | SHA-1 | Registrada |
   | --- | --- | --- |
   | Firma de apps de Play | `D6:81:42:BB:28:6E:2D:0B:16:94:4A:53:05:61:FD:9F:7B:55:CD:96` | ✅ |
   | Depuración | `39:8B:36:81:F8:DF:76:33:FD:D3:92:57:CD:B6:99:43:DC:92:B2:C3` | ✅ |
   | Clave de carga | `BF:B4:66:34:58:5E:BA:AE:E3:98:22:7A:A6:B9:06:62:BD:85:F6:98` | ❌ |

   La que **no** puede faltar es la de *Firma de apps de Play*: Google re-firma
   el AAB, así que todo lo instalado desde Play —incluidas las pruebas internas
   y cerradas— lleva esa clave, no la de carga ni la de depuración. Sin la
   SHA-1 correcta el inicio de sesión falla con `SIGN_IN_REQUIRED` /
   `DEVELOPER_ERROR`, y falla en silencio: la app arranca con normalidad.

   La *antipiratería* se dejó desactivada: obliga a que la instalación venga de
   Play y rompe las pruebas con APK local.
4. **Testers**: en la pestaña de *Testers* de Play Juegos añade las cuentas que
   probarán antes de publicar. Mientras el proyecto esté sin publicar, solo esas
   cuentas pueden iniciar sesión.

## 2) Crear una tabla de clasificación por juego

Servicios de Play Games → **Tablas de clasificación** → *Crear una tabla de
clasificación*. Una por juego. **El formato y el orden no se pueden cambiar una
vez publicada la tabla**; el nombre y el orden en la lista sí.

Las siete ya están creadas (en estado *Borrador*):

| Juego | Nombre en Console | Formato | Orden | Mín. | Id |
| --- | --- | --- | --- | --- | --- |
| Figures | Figures | Número | Más altas primero | — | `CgkIoJP--6UCEAIQAA` |
| Glótono | Glotono | Número | Más altas primero | — | `CgkIoJP--6UCEAIQAQ` |
| Bloques | Bloques | Número | Más altas primero | — | `CgkIoJP--6UCEAIQAg` |
| Buscaminas | Buscaminas | Duración | **Más bajas primero** | 1 | `CgkIoJP--6UCEAIQAw` |
| Sudoku | Sudoku | Duración | **Más bajas primero** | 1 | `CgkIoJP--6UCEAIQBA` |
| Solitario | Solitario | Número | **Más bajas primero** | 1 | `CgkIoJP--6UCEAIQBQ` |
| Ajedrez | Ajedrez | Número | **Más bajas primero** | 1 | `CgkIoJP--6UCEAIQBg` |

> Las tablas de formato **Duración** se miden en **milisegundos**; la app ya
> multiplica por 1000 los tiempos (que lleva en segundos). Ver
> `toLeaderboardScore` en `src/core/playGames/config.ts`. La vista previa de
> Console lo confirma: 123.450.000 se muestra como `34:17:30`.

> La **puntuación mínima 1** en las tablas de "más bajas primero" evita que un
> `0` accidental se clave como récord imborrable: en esas tablas 0 es el mejor
> valor posible.

> El campo *Nombre* **no acepta acentos** en el idioma predeterminado (en-US):
> deshabilita el botón de guardar sin mostrar ningún error. Por eso Glótono está
> como "Glotono"; la tilde se puede recuperar añadiendo la traducción al
> español en *Traducciones*.

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
