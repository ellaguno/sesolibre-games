# sesolibre-games — Plan general

> Colección de juegos casuales offline-first, jugable en web y empaquetable como
> app nativa (Android primero, iOS después) mediante Capacitor.
>
> Repo: https://github.com/ellaguno/sesolibre-games

## 1. Visión

Una sola aplicación ("game of games") con una pantalla inicial atractiva y
sencilla desde la que se lanzan varios minijuegos. La app:

- Funciona **sin conexión** una vez instalada (PWA + assets locales).
- Lleva **récords de puntuación** por juego, persistentes en el dispositivo.
- Entrega **recompensas periódicas** (diarias / por rachas / por logros).
- Más adelante incorpora **animaciones dinámicas y procedurales** en eventos y
  navegación.
- Se distribuye como web (PWA instalable) y como app nativa vía Capacitor, con
  publicación eventual en Google Play y App Store.

## 2. Catálogo de juegos

| # | Juego        | Origen                          | Estado    | Fase |
|---|--------------|---------------------------------|-----------|------|
| 1 | Figures      | Match-3, repo `sesolibre-figures` (React+Tailwind) | Portar | 2 |
| 2 | Glótono      | Maze-chase **original** (inspirado en el género) | Hecho | 2 |
| 3 | Buscaminas   | Nuevo                           | Crear     | 3 |
| 4 | Sudoku       | Nuevo                           | Crear     | 3 |
| 5 | Solitario    | Klondike (1 ó 3 cartas/turno)   | Crear     | 4 |

### Nota sobre propiedad intelectual

Inspirarse en *géneros* clásicos es legítimo; copiar nombres, personajes, mapas o
sonidos de una marca concreta no. Por eso el maze-chase es un juego **propio**
("Glótono": slime que absorbe orbes y esquiva "virus", laberinto procedural,
audio sintetizado) y **no** un clon de Pac-Man. Los demás juegos (match-3,
buscaminas, sudoku, solitario Klondike) son mecánicas de dominio público; basta
con evitar nombres de marca y arte calcado.

## 3. Decisiones de arquitectura (confirmadas)

1. **App única unificada**: un solo proyecto Vite + React (PWA). El hub y cada
   juego son rutas/componentes dentro del mismo build. Comparten servicios de
   puntuación, recompensas, audio, animaciones y navegación.
2. **TypeScript** en todo el código nuevo.
3. **Portar** los dos juegos existentes al stack común (no embeber).

### Stack

- **Build / dev**: [Vite](https://vitejs.dev) + TypeScript.
- **UI**: React 18 + Tailwind CSS (continuidad con `sesolibre-figures`).
- **Routing**: React Router (rutas hash o memory para compatibilidad con
  `file://` en Capacitor).
- **Estado global ligero**: Zustand (puntuaciones, recompensas, settings).
- **Persistencia**: capa de almacenamiento que usa `@capacitor/preferences` en
  nativo y `localStorage` en web (interfaz única, ver ARCHITECTURE.md).
- **PWA / offline**: `vite-plugin-pwa` (service worker + manifest, precache de
  assets).
- **Render de juegos**: React para UI/menus; `<canvas>` para los juegos de
  acción (Pac-Man) y opcionalmente para los de tablero. La lógica de cada juego
  es TS puro, desacoplada del render, para poder testearla.
- **Nativo**: Capacitor (Android e iOS), reutilizando la experiencia previa.
- **Tests**: Vitest para la lógica de juego (board solvers, generadores, reglas).

> **Sobre "copiar js/css/html y correr sin internet":** el resultado de
> `vite build` es exactamente eso — un `dist/` con HTML+CSS+JS estáticos que
> corren localmente sin servidor ni red. El paso de compilación solo ocurre en
> desarrollo; el artefacto final cumple el requisito de "copiar y correr".

## 4. Pantalla inicial (hub)

- Cuadrícula de tarjetas, una por juego, con ícono/preview y mejor puntuación.
- Acceso a: ajustes (sonido, tema), recompensas/logros, y récords globales.
- Indicador de recompensa disponible (badge).
- Diseño limpio, responsive (móvil first), con tema claro/oscuro.
- En fase posterior: transiciones procedurales entre hub y juego.

## 5. Sistemas transversales

### 5.1 Puntuaciones y récords
- Servicio `ScoreService` con API uniforme por juego: `submitScore`,
  `getBest`, `getHistory`.
- Cada juego declara su tipo de score (puntos, tiempo, movimientos) y si
  "mayor es mejor" o "menor es mejor".
- Persistencia local; estructura preparada para sincronización en la nube en el
  futuro (opcional, fuera del alcance offline inicial).

### 5.2 Recompensas
- `RewardService`: recompensas diarias (login diario), rachas, y logros por
  hitos (p. ej. "primer sudoku resuelto").
- Moneda virtual simple (monedas/gemas) canjeable por cosméticos (temas, mazos,
  skins) — sin pagos reales en la primera etapa.
- Todo local y determinista; nada que requiera servidor.

### 5.3 Audio y ajustes
- Servicio de audio con sonidos cortos precargados; toggle global.
- Ajustes persistentes (tema, sonido, dificultad por defecto).

### 5.4 Animaciones (fase posterior)
- Capa de animación procedural reutilizable: transiciones de navegación,
  partículas en eventos (match, victoria, recompensa), feedback táctil.
- Candidatos: Framer Motion para UI; canvas/WebGL ligero para partículas
  procedurales. Detallado en ROADMAP.md (Fase 5).

## 6. Empaquetado y distribución

- **Web**: deploy de `dist/` (GitHub Pages / Netlify) como PWA instalable.
- **Android**: `npx cap add android`, build con Android Studio / Gradle, APK/AAB
  firmado, publicación en Google Play.
- **iOS** (posterior): `npx cap add ios`, build con Xcode, publicación en App
  Store.
- Credenciales de tiendas se configuran al llegar a la fase de publicación
  (no se versionan en el repo).

## 7. Documentos relacionados

- [ARCHITECTURE.md](./ARCHITECTURE.md) — estructura del repo, contrato de juego,
  capa de persistencia.
- [ROADMAP.md](./ROADMAP.md) — fases, hitos y orden de implementación.
