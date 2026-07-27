# Figuras de los juegos (WebP transparentes)

Coloca aquí **una imagen transparente por juego**, con el subtítulo/figura grande
que describe el juego (como en el mockup): bomba para Buscaminas, mano de
cartas para Solitario, gema para Figures, etc.

## Nombres EXACTOS (uno por juego)

| Archivo | Juego |
|---|---|
| `figures.webp` | Figures (gema/diamante) |
| `glotono.webp` | Glótono (slime/planeta verde) |
| `minesweeper.webp` | Buscaminas (bomba) |
| `sudoku.webp` | Sudoku (números/rejilla) |
| `solitaire.webp` | Solitario (mano de cartas) |
| `bloques.webp` | Bloques (piezas/gemas) |
| `ajedrez.webp` | Ajedrez (rey/caballo) |

## Especificaciones

- **Formato:** WebP con **fondo transparente** (calidad ~90).
- **Tamaño:** cuadrado, **512×512** px. No lo subas de ahí: estas figuras se
  ven como mucho a ~176 px, y el navegador descodifica cada imagen a su
  resolución original, así que el exceso se paga en RAM aunque no se note en
  pantalla. Las 8 figuras juntas ocupan ya ~7 MB descodificadas.
- **Composición:** sujeto **centrado**, con un poco de aire alrededor (se
  escala con `object-contain`, no se recorta).
- **Peso:** < 120 KB cada uno (se precachean para offline).

Para convertir un PNG nuevo al formato correcto:

```sh
python3 -c "
from PIL import Image
im = Image.open('nuevo.png').convert('RGBA')
if max(im.size) > 512:
    s = 512 / max(im.size)
    im = im.resize((round(im.width*s), round(im.height*s)), Image.LANCZOS)
im.save('public/art/<id>.webp', 'WEBP', quality=90, method=6)
"
```

## Dónde aparecen

- **Tarjeta del hub (grid):** la figura va **centrada en la parte superior** de
  la tarjeta; el título/tagline quedan debajo.
- **Tarjeta "Reto del día" (hero):** la figura va **a la derecha**; el texto, a
  la izquierda.

Si un archivo no existe, la tarjeta simplemente no muestra figura (no se rompe
nada). Al agregarlos aquí, se incluyen automáticamente en el build y en el
precache PWA.
