# Backlog de pulido ("para después")

Mejoras detectadas durante pruebas, a abordar más adelante (varias encajan en la
Fase 5 — animaciones procedurales).

> **Nota:** al final de la Fase 5 toca una ronda de pulido de CADA juego
> (feedback del usuario). Validar visualmente los 5 en `npm run dev`.

## ✅ Resueltos en la ronda de pulido (commit de pulido)

- **Sudoku** — cuadrícula rehecha con bordes reales (box-border) y celdas
  `aspect-square` que llenan el track; celda activa muy visible + resaltado de
  fila/col/caja/mismo número; teclado físico (1-9, borrar, flechas, N) y teclado
  en pantalla deshabilitado hasta seleccionar. Verificado por captura headless.
- **Hub** — el título "SesoLibre" se cortaba; header reestructurado (título a la
  izquierda, nav a la derecha con `shrink-0`).
- **Solitario** — las columnas (cartas absolutas) tapaban los controles; ahora
  cada pila tiene altura dinámica según nº de cartas.
- **Glótono #1** — overlay "Jugar de nuevo" no desaparecía al reiniciar;
  resuelto reseteando el HUD al cambiar `seed`.

## Glótono ✅ (segunda ronda de pulido)

1. ~~Avance de nivel automático~~ — **hecho**: al limpiar el laberinto se genera
   uno nuevo automáticamente, sube el nivel (HUD + aviso "¡Nivel N!"), enemigos
   más rápidos por nivel y la puntuación se acumula.
2. ~~Laberinto menos "cuadriculado"~~ — **hecho**: paredes orgánicas (esquinas
   redondeadas según vecinos → tubos suaves) con degradado.
3. ~~Animación de Glótono~~ — **hecho**: boca que se abre/cierra ("mastica")
   orientada a la dirección de movimiento, con ojo.
4. ~~Enemigos más expresivos~~ — **hecho**: virus con púas y ojos; los
   "agresivos" (morados, más grandes, persiguen sin titubear) aparecen y
   aumentan con el nivel.

Posibles mejoras futuras: corredores de grosor variable / formas no rectangulares;
animación específica al digerir cada orbe; más tipos de enemigo.

## Otras mejoras futuras

- **Tienda de cosméticos** para gastar las monedas (temas / mazos / skins).
- **Haptics** en nativo (Capacitor, Fase 6).
