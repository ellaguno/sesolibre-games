# Estado del proyecto — dónde nos quedamos

_Última actualización: 2026-05-26 · versión 0.2.0_

## En vivo
- **Web (PWA):** https://ellaguno.github.io/sesolibre-games/ (auto-deploy en cada push a `main`)
- **APK Android:** Release `v0.2.0` (debug, instalable) — https://github.com/ellaguno/sesolibre-games/releases
- **Repo:** https://github.com/ellaguno/sesolibre-games

## Stack
Vite · React 18 · TypeScript · Tailwind (tema claro/oscuro vía tokens CSS) ·
React Router (HashRouter) · Zustand · vite-plugin-pwa (offline) · Capacitor (Android).
i18n propio es/en con autodetección por SO. 78 tests (Vitest). CI: GitHub Actions
(`web.yml` → Pages, `android.yml` → APK por tag/dispatch).

## Juegos (7)
1. **Figures** — match-3 (portado). Arrastre animado de fichas + destello al eliminar.
2. **Glótono** — maze-chase ORIGINAL (no Pac-Man). Laberinto procedural, enemigos
   con pathfinding (BFS) e inteligencia/velocidad por nivel, niveles encadenados,
   gemas/boca animadas, swipe en toda la pantalla.
3. **Buscaminas** — primer clic seguro, flood-fill, bandera por long-press fiable,
   cuadrícula a todo el ancho, explosión de fuego al perder / luces al ganar.
4. **Sudoku** — generador con solución única, notas, teclado físico, destello al
   completar un número (se deshabilita) + gran explosión al resolver.
5. **Solitario** — Klondike 1/3 (default 3), drag&drop animado, toque=auto-ubicar,
   descarte en abanico, reversos de carta canjeables con monedas.
6. **Bloques** — Tetris con gemas de cristal translúcidas; opción de figura de
   Figures dentro de cada gema.
7. **Ajedrez** — reglas completas (validadas con perft), 2 jugadores y **vs IA**
   con niveles (Fácil/Medio/Difícil, negamax+alfa-beta+quiescencia en Web Worker).
   Tablero a todo el ancho, **reloj** (Sin/3+2/5m/10m) y **vista 3D** (CSS) opcional.

## Sistemas transversales
- **Hub** estilo mockup: fondo dashboard con parallax + destellos, hero "Reto del
  día" (rota), tarjetas con fondo + figura PNG + acento + tagline + mejor marca.
- **Récords** por juego (ScoreService) · **Recompensas**: moneda, recompensa diaria
  con racha, logros, tienda de reversos · **Ajustes**: tema, sonido, animaciones, idioma.
- **Animaciones**: motor de partículas propio (confeti/fuego/celebración) + CSS;
  respeta `prefers-reduced-motion` y el ajuste de animaciones.

## Pendiente / próximos pasos
1. **Battle Chess** 🎬 — animación al COMER una pieza en el ajedrez. Falta definir
   y CREAR los assets (secuencias/sprites de captura, o un set genérico). El usuario
   los generará; luego se integran.
2. **Ajedrez extra (opcional):** elegir color del humano; jugar vs IA externa.
3. **3D fotorrealista (opcional):** sustituir glifos por PNG de piezas 3D.
4. **Optimizar `public/art/bloques.png`** (~1.4 MB) a WebP/menor tamaño.
5. **Tiendas:** firma de producción (keystore como secret) + AAB para Google Play;
   íconos/splash definitivos; luego iOS.
6. **Más juegos** y más pulido de animaciones cuando se quiera.

> Notas: las verificaciones se hacen con build/lint/tests + capturas headless
> (Chromium). Las interacciones táctiles y efectos en movimiento conviene
> probarlas en la web/dispositivo. Ver también `docs/ROADMAP.md` y `docs/BACKLOG.md`.
