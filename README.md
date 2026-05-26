# SesoLibre Games

Colección de juegos casuales **offline-first**, jugable en web (PWA instalable) y
empaquetable como app nativa (Android primero, iOS después) mediante Capacitor.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · React Router · Zustand · vite-plugin-pwa · Capacitor

## Juegos

| Juego      | Estado     |
|------------|------------|
| Figures (match-3) | Por portar |
| Pac-Man    | Por portar |
| Buscaminas | Planificado |
| Sudoku     | Planificado |
| Solitario (Klondike) | Planificado |

## Desarrollo

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo
npm run build    # build de producción (dist/, estático, corre sin servidor)
npm run preview  # previsualizar el build
npm run test     # tests de lógica (Vitest)
npm run lint     # ESLint
```

## App nativa (fase posterior)

```bash
npm run build
npx cap add android   # primera vez
npm run cap:sync
npx cap open android  # abrir en Android Studio
```

## Documentación

Ver [`docs/`](./docs): [PLAN](./docs/PLAN.md) · [ARCHITECTURE](./docs/ARCHITECTURE.md) · [ROADMAP](./docs/ROADMAP.md)
