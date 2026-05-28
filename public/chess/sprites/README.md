# Sprites del ajedrez (animaciones tipo "battle chess")

Arte **100% original** (lo dibuja la familia). NO se usan assets extraídos de
otros juegos: solo nos inspiramos en el género. Estos PNG alimentan el motor de
animación del tablero.

## Formato

- **Tamaño de cuadro:** 256×256 px, fondo **transparente** (PNG).
- **Estilo:** pixel art retro. Sugerencia: dibuja a baja resolución lógica
  (p. ej. 64×64) y exporta a 256×256 con **vecino más cercano** (sin suavizar)
  para que el pixel quede nítido y los archivos pesen poco. El motor usa
  `image-rendering: pixelated`.
- **Encuadre:** pieza centrada horizontalmente, con los **pies apoyados en la
  base** del cuadro (para que se pare sobre la casilla). Deja un pequeño margen.
- **Orientación:** dibuja la pieza **mirando a la DERECHA**. El motor la
  **espeja** automáticamente cuando va hacia la izquierda. No dibujes la versión
  espejada.

## Hojas (sprite sheets)

Una **tira horizontal** por animación: los cuadros van de izquierda a derecha,
cada uno de 256×256, sin separación. El ancho total = 256 × nº de cuadros.

**Nombre de archivo:** `{color}_{pieza}_{animación}.png`

- color: `w` (blancas) · `b` (negras)
- pieza: `p` peón · `n` caballo · `b` alfil · `r` torre · `q` dama · `k` rey
- animación: `idle` · `walk` · `attack` · `death`

Ejemplos: `w_p_walk.png`, `b_n_attack.png`, `w_q_death.png`.

## Animaciones y nº de cuadros (ver `manifest.json`)

| anim | qué es | cuadros | fps | repite |
| --- | --- | --- | --- | --- |
| `idle` | pieza quieta (respiración sutil) | 2 | 4 | sí |
| `walk` | camina hacia la casilla destino | 8 | 12 | sí |
| `attack` | golpe al comer una pieza | 10 | 14 | no |
| `death` | la pieza capturada cae / desaparece | 8 | 12 | no |

Si una pieza necesita más/menos cuadros, se ajusta en `manifest.json` (se puede
poner por pieza). Mejor mantener estos números al inicio.

## Empezar por el PILOTO (importante)

No dibujes las 48 hojas de golpe. Hacemos primero **solo el peón** (`w_p_*` y
`b_p_*`, las 4 animaciones = 8 hojas) para validar tamaño, ritmo y el motor.
Cuando se vea bien, seguimos con el resto.

Total final: 2 colores × 6 piezas × 4 animaciones = **48 hojas**.

## Cómo probar

Pon los PNG aquí mismo (`public/chess/sprites/`) con el nombre correcto y avísame:
conecto el motor y lo vemos animar en el tablero. Mientras tanto hay
**placeholders** (cuadros numerados) para ver el formato; reemplázalos por el
arte real con el mismo nombre.
