# Roadmap — sesolibre-games

Fases incrementales. Cada fase deja la app en estado utilizable y desplegable.

## Fase 0 — Andamiaje (base del proyecto) ✅
- [x] `git init`, conectar a `github.com/ellaguno/sesolibre-games`.
- [x] Scaffold Vite + React + TypeScript + Tailwind.
- [x] Configurar ESLint, Prettier, Vitest.
- [x] Configurar `vite-plugin-pwa` (manifest + service worker básico).
- [x] `base: './'` y router compatible con Capacitor (HashRouter).
- [x] Estructura de carpetas (ver ARCHITECTURE.md).
- [x] Capa de `storage.ts` (Capacitor Preferences / localStorage).

**Entregable:** app vacía que arranca, instala como PWA y persiste un valor de prueba. ✔

## Fase 1 — Hub + servicios transversales ✅
- [x] `HubScreen` con catálogo (tarjetas leídas de `registry.ts`).
- [x] `ScoreService` (récords por juego) + UI de mejores puntuaciones.
- [x] Ajustes (tema claro/oscuro, sonido) persistentes.
- [x] `AudioService` con sonidos base (WebAudio sintetizado).
- [x] Tema visual y componentes UI compartidos (Button, Screen).

**Entregable:** hub navegable y atractivo, sin juegos aún (placeholders). ✔

## Fase 2 — Juegos arcade (existentes + maze-chase propio) ✅
- [x] **Glótono** — maze-chase ORIGINAL (no clon de Pac-Man, por IP): laberinto
      procedural, slime vs. virus, orbes de poder, vidas, controles teclado +
      swipe táctil, integrado con `ScoreService`. Lógica testeada.
- [x] Portar **Figures** (match-3) al stack común: `board.ts`/`figures.ts`
      tipados, `Gem.tsx`, `FiguresGame.tsx`, animaciones CSS, SVGs vía Vite,
      integrado con `ScoreService` y `AudioService`. 9 tests de tablero.
- [x] Offline (PWA precache de chunks + assets) y arranque desde el hub.

**Entregable:** 2 juegos jugables e integrados con récords. ✔
Pendientes de pulido (Glótono) anotados en [BACKLOG.md](./BACKLOG.md).

## Fase 3 — Juegos de tablero nuevos
- [ ] **Buscaminas**: tamaños/dificultades, primer clic seguro, flood-fill,
      banderas, cronómetro; score por tiempo. Tests de lógica.
- [ ] **Sudoku**: generador con solución única + solver, dificultades, notas,
      validación, pistas; score por tiempo/errores. Tests de unicidad.

**Entregable:** 4 juegos disponibles.

## Fase 4 — Solitario + recompensas
- [ ] **Solitario (Klondike)**: modo 1 y 3 cartas por turno, arrastrar/soltar,
      auto-completar, deshacer; score por tiempo/movimientos. Tests de reglas.
- [ ] **RewardService**: recompensa diaria, rachas, logros, moneda virtual.
- [ ] Pantalla de recompensas/logros + badge en el hub.
- [ ] Cosméticos canjeables básicos (temas / mazos / skins).

**Entregable:** 5 juegos + sistema de recompensas completo.

## Fase 5 — Animaciones dinámicas / procedurales
- [ ] Capa de transiciones de navegación (hub ↔ juego).
- [ ] Partículas procedurales en eventos (match, victoria, recompensa).
- [ ] Feedback de interacción (micro-animaciones, haptics en nativo).
- [ ] Evaluar Framer Motion (UI) + canvas/WebGL ligero (partículas).

**Entregable:** experiencia pulida y animada.

## Fase 6 — Empaquetado nativo y publicación
- [ ] Integrar Capacitor; `cap add android`; build AAB firmado.
- [ ] Íconos, splash, ajustes de WebView, controles táctiles revisados.
- [ ] Publicar PWA web (GitHub Pages / Netlify).
- [ ] Cuenta y credenciales Google Play → publicar.
- [ ] (Posterior) `cap add ios`, build Xcode, App Store.

**Entregable:** app publicada en web y Google Play; iOS encaminado.

## Riesgos / notas
- **Rutas en WebView nativo**: usar router hash/memory y `base: './'`.
- **Controles táctiles** para Pac-Man (juego pensado a teclado).
- **Sudoku**: el generador debe garantizar solución única (parte más delicada).
- **Tamaño de bundle**: usar `React.lazy` por juego para arranque offline rápido.
- **Recompensas offline**: usar reloj del dispositivo; aceptar que es manipulable
  (no hay servidor que valide en la etapa offline).
