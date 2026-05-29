# Ficha de Google Play — SesoLibre Games

Textos y respuestas para la ficha de tienda, Data Safety y clasificación de
contenido. Basado en la app **v1.0.0** (sin anuncios, sin IAP, sin recolección de
datos). Actualizar cuando se integre la monetización.

---

## 1. Descripción corta (máx. 80 caracteres)

**Español:**

> Ajedrez, sudoku, solitario y más: 7 juegos para tu mente, sin conexión.

**Inglés:**

> Chess, sudoku, solitaire & more: 7 brain games that work fully offline.

---

## 2. Descripción larga (máx. 4000 caracteres)

**Español:**

> **SesoLibre Games** reúne 7 juegos clásicos para entrenar tu mente en una sola
> app, ligera y sin distracciones. Juega donde sea: funciona **completamente sin
> conexión**.
>
> 🎮 **7 juegos en uno:**
> ♟️ **Ajedrez** — Partidas por turnos para dos jugadores en el mismo dispositivo.
> 🔢 **Sudoku** — Tres niveles de dificultad para retar tu lógica.
> 💣 **Buscaminas** — Despeja el campo sin pisar una mina. Contra reloj.
> 🃏 **Solitario** — Klondike clásico, a 1 o 3 cartas por turno.
> 💎 **Figures** — Match‑3: combina 3 o más figuras y supera tu récord.
> 🧊 **Bloques** — Encaja las piezas que caen y completa líneas.
> 🟢 **Glótono** — Devora orbes en el laberinto y esquiva los virus.
>
> ✨ **Pensada para disfrutarse:**
> • **Sin conexión** — juega en el avión, el metro o donde no haya señal.
> • **Sin anuncios** y **sin compras** en esta versión.
> • **Sin registro** — entra y juega, no pedimos cuenta ni datos.
> • **Privacidad total** — no recopilamos ningún dato; tu progreso se guarda solo
>   en tu dispositivo.
> • **Tema claro y oscuro**, efectos de sonido y animaciones configurables.
> • **Español e inglés**.
> • **Recompensas y logros** — gana monedas, mantén tu racha y desbloquea
>   reversos de carta cosméticos.
>
> Ideal para ratos libres, relajarte o mantener la mente activa. Descarga
> **SesoLibre Games** y lleva tus clásicos favoritos siempre contigo.

**Inglés:**

> **SesoLibre Games** brings together 7 classic brain games in a single,
> lightweight, distraction‑free app. Play anywhere: it works **fully offline**.
>
> 🎮 **7 games in one:**
> ♟️ **Chess** — Turn‑based matches for two players on the same device.
> 🔢 **Sudoku** — Three difficulty levels to challenge your logic.
> 💣 **Minesweeper** — Clear the field without hitting a mine. Beat the clock.
> 🃏 **Solitaire** — Classic Klondike, 1 or 3 cards per turn.
> 💎 **Figures** — Match‑3: line up 3 or more figures and beat your record.
> 🧊 **Bloques** — Fit the falling pieces and clear lines.
> 🟢 **Glótono** — Devour orbs in the maze and dodge the viruses.
>
> ✨ **Made to enjoy:**
> • **Offline** — play on a plane, on the subway, or with no signal.
> • **No ads** and **no purchases** in this version.
> • **No sign‑up** — just open and play; no account or data required.
> • **Full privacy** — we collect no data; your progress is stored only on your
>   device.
> • **Light and dark theme**, configurable sound effects and animations.
> • **Spanish and English**.
> • **Rewards and achievements** — earn coins, keep your streak, and unlock
>   cosmetic card backs.
>
> Perfect for short breaks, relaxing, or keeping your mind sharp. Download
> **SesoLibre Games** and take your favorite classics with you everywhere.

---

## 3. Data Safety (Seguridad de los datos)

Definición de Google: "recopilar" = transmitir datos **fuera del dispositivo**.
Los datos que se guardan **solo en el dispositivo** NO cuentan como recopilados.

| Pregunta | Respuesta |
|---|---|
| ¿La app recopila o comparte alguno de los tipos de datos requeridos? | **No** |
| ¿La app recopila datos? | **No** (todo se guarda solo en el dispositivo) |
| ¿La app comparte datos con terceros? | **No** |
| Tipos de datos recopilados | **Ninguno** |
| ¿Los datos se cifran en tránsito? | **N/A** (no se transmiten datos) |
| ¿Los usuarios pueden solicitar la eliminación de datos? | Los datos viven solo en el dispositivo; se eliminan borrando los datos de la app o desinstalándola. |

**Resultado esperado en la ficha:** "No se recopilan datos" / "No data collected".

> Nota: cuando se integre AdMob/Play Billing, habrá que declarar (p. ej.):
> identificadores de publicidad, interacciones con anuncios, e historial de
> compras, y marcar el cifrado en tránsito.

---

## 4. Clasificación de contenido (cuestionario IARC)

| Pregunta del cuestionario | Respuesta |
|---|---|
| Categoría de la app | **Juego** |
| ¿Contiene violencia (real o de fantasía)? | **No** |
| ¿Sangre o gore? | **No** |
| ¿Contenido sexual o desnudez? | **No** |
| ¿Lenguaje soez / groserías? | **No** |
| ¿Referencias a drogas, alcohol o tabaco? | **No** |
| ¿Juegos de azar con dinero real? | **No** |
| ¿Juegos de azar simulados (estilo casino)? | **No** |
| ¿Contenido que asusta o perturba? | **No** |
| ¿Interacción entre usuarios / chat / mensajería? | **No** |
| ¿Comparte la ubicación del usuario? | **No** |
| ¿Permite comprar bienes digitales? | **No** (sin IAP en v1.0.0) |
| ¿Contiene anuncios? | **No** (en v1.0.0) |
| ¿Recopila o comparte información personal? | **No** |

**Resultado esperado:** clasificación "Para todos" (ESRB Everyone / PEGI 3 /
IARC 3+).

> Nota: las monedas virtuales del sistema de recompensas **no tienen valor real**,
> no se compran ni se canjean por dinero, por lo que no constituyen "juego de
> azar" ni "compras" a efectos del cuestionario.

---

## 5. Otras secciones de "Datos de la app"

- **Política de privacidad (URL):** publicar `docs/PRIVACY.md` en una URL pública
  (ver opciones más abajo).
- **Acceso a la app:** todo el contenido está disponible sin restricciones (no hay
  login) → "No se requieren credenciales especiales".
- **Anuncios:** declarar **"No, mi app no contiene anuncios"** (en v1.0.0).
- **Público objetivo:** apta para todas las edades. Incluir grupos infantiles
  obliga a cumplir la política de Familias (la app cumple: sin datos, sin ads),
  pero es una decisión aparte.
- **Apps de gobierno / finanzas / salud / noticias:** **No**.
