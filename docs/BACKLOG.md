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

## Glótono (pendientes)

1. **Avance de nivel automático.** Al limpiar el laberinto no pasa a un nivel
   nuevo automáticamente. Deseable: encadenar niveles (nuevo laberinto, quizá
   más rápido/difícil) sin botón intermedio, acumulando puntuación.

2. **Laberinto menos "cuadriculado".** Hoy son celdas cuadradas. Mejorar la
   estética: corredores redondeados/orgánicos, curvas, variación de grosor de
   pared, posibles formas no rectangulares.

3. **Animación de Glótono.** Que se note cómo "entra" y **digiere** los orbes;
   darle una boca que se abre/cierra al moverse y al comer.

4. **Enemigos más expresivos.** Los triángulos son muy simples. Mejorar el arte
   de los "virus"; idealmente que **evolucionen** y aparezca alguno más
   agresivo (variantes de IA/velocidad por tipo).

## Otras mejoras futuras

- **Tienda de cosméticos** para gastar las monedas (temas / mazos / skins).
- **Haptics** en nativo (Capacitor, Fase 6).
