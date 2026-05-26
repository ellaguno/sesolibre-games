# Backlog de pulido ("para después")

Mejoras detectadas durante pruebas, a abordar más adelante (varias encajan en la
Fase 5 — animaciones procedurales).

## Glótono

1. **Bug — overlay de fin de partida al reiniciar.** Al ganar/perder aparece
   "Jugar de nuevo"; al pulsarlo el overlay **no desaparece** aunque la partida
   sí reinicia por detrás. Causa: el estado `hud` conserva el `status` anterior
   y el loop solo hace `setHud` cuando cambia el status o el score/vidas; con un
   motor nuevo (score 0, vidas 3) no se dispara hasta comer el primer orbe.
   *Fix (1 línea):* resetear `hud` a `{score:0, lives:3, status:'playing'}` al
   cambiar `seed` (o en el `useEffect` de arranque del motor).

2. **Avance de nivel automático.** Al limpiar el laberinto no pasa a un nivel
   nuevo automáticamente. Deseable: encadenar niveles (nuevo laberinto, quizá
   más rápido/difícil) sin botón intermedio, acumulando puntuación.

3. **Laberinto menos "cuadriculado".** Hoy son celdas cuadradas. Mejorar la
   estética: corredores redondeados/orgánicos, curvas, variación de grosor de
   pared, posibles formas no rectangulares.

4. **Animación de Glótono.** Que se note cómo "entra" y **digiere** los orbes;
   darle una boca que se abre/cierra al moverse y al comer.

5. **Enemigos más expresivos.** Los triángulos son muy simples. Mejorar el arte
   de los "virus"; idealmente que **evolucionen** y aparezca alguno más
   agresivo (variantes de IA/velocidad por tipo).
