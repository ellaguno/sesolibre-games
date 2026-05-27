# Figuras de los juegos (PNG transparentes)

Coloca aquí **un PNG transparente por juego**, con el subtítulo/figura grande
que describe el juego (como en el mockup): bomba para Buscaminas, mano de
cartas para Solitario, gema para Figures, etc.

## Nombres EXACTOS (uno por juego)

| Archivo | Juego |
|---|---|
| `figures.png` | Figures (gema/diamante) |
| `glotono.png` | Glótono (slime/planeta verde) |
| `minesweeper.png` | Buscaminas (bomba) |
| `sudoku.png` | Sudoku (números/rejilla) |
| `solitaire.png` | Solitario (mano de cartas) |
| `bloques.png` | Bloques (piezas/gemas) |
| `ajedrez.png` | Ajedrez (rey/caballo) |

## Especificaciones

- **Formato:** PNG con **fondo transparente**.
- **Tamaño recomendado:** cuadrado, **512×512** o **600×600** px.
- **Composición:** sujeto **centrado**, con un poco de aire alrededor (se
  escala con `object-contain`, no se recorta).
- **Peso:** idealmente < 200 KB cada uno (se precachean para offline).

## Dónde aparecen

- **Tarjeta del hub (grid):** la figura va **centrada en la parte superior** de
  la tarjeta; el título/tagline quedan debajo.
- **Tarjeta "Reto del día" (hero):** la figura va **a la derecha**; el texto, a
  la izquierda.

Si un archivo no existe, la tarjeta simplemente no muestra figura (no se rompe
nada). Al agregarlos aquí, se incluyen automáticamente en el build y en el
precache PWA.
