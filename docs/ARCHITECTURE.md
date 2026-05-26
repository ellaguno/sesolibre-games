# Arquitectura — sesolibre-games

## Estructura de carpetas propuesta

```
sesolibre-games/
├── docs/                     # Este plan y documentación
├── public/                   # Assets estáticos (íconos, sonidos, manifest)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── capacitor.config.ts
├── src/
│   ├── main.tsx              # Bootstrap React + router
│   ├── App.tsx               # Layout + rutas
│   ├── hub/                  # Pantalla inicial (catálogo de juegos)
│   │   ├── HubScreen.tsx
│   │   └── GameCard.tsx
│   ├── core/                 # Servicios transversales (sin UI de juego)
│   │   ├── storage.ts        # Capa persistencia (Capacitor Preferences / localStorage)
│   │   ├── ScoreService.ts
│   │   ├── RewardService.ts
│   │   ├── AudioService.ts
│   │   ├── settings.ts
│   │   └── registry.ts       # Registro central de juegos (metadata)
│   ├── ui/                   # Componentes compartidos (botones, modales, temas)
│   ├── games/
│   │   ├── figures/          # Portado de sesolibre-figures
│   │   │   ├── logic/        # board.ts, figures.ts (TS puro, testeable)
│   │   │   ├── components/
│   │   │   └── FiguresGame.tsx
│   │   ├── pacman/           # Portado de pacman (canvas)
│   │   │   ├── engine.ts     # Lógica/loop del juego
│   │   │   └── PacmanGame.tsx # Monta el canvas
│   │   ├── minesweeper/
│   │   │   ├── logic.ts      # Generación de tablero, flood-fill, reglas
│   │   │   └── MinesweeperGame.tsx
│   │   ├── sudoku/
│   │   │   ├── generator.ts  # Generador + solver (unicidad de solución)
│   │   │   └── SudokuGame.tsx
│   │   └── solitaire/
│   │       ├── logic.ts      # Reglas Klondike, 1/3 cartas
│   │       └── SolitaireGame.tsx
│   └── styles/
└── tests/                    # Vitest (lógica de juegos)
```

## Contrato de juego (`GameModule`)

Cada juego se registra en `core/registry.ts` con una metadata uniforme, de modo
que el hub pueda listarlos y enrutarlos sin acoplarse a su implementación.

```ts
export type ScoreKind = 'points' | 'time' | 'moves';

export interface GameMeta {
  id: string;                 // 'minesweeper'
  title: string;              // 'Buscaminas'
  description: string;
  icon: string;               // ruta a asset o nombre de ícono
  scoreKind: ScoreKind;
  higherIsBetter: boolean;    // points -> true; time/moves -> false
  // carga diferida del componente para code-splitting
  load: () => Promise<{ default: React.ComponentType<GameProps> }>;
}

export interface GameProps {
  onScore: (score: number, meta?: Record<string, unknown>) => void;
  onExit: () => void;
  difficulty?: string;
}
```

- Los componentes de juego se cargan con `React.lazy` para mantener el bundle
  inicial pequeño (mejor arranque offline).
- La **lógica** de cada juego vive en archivos `.ts` puros (sin React) para
  poder probarla con Vitest y reusarla en distintos renders.

## Capa de persistencia

Una sola interfaz, dos implementaciones según plataforma:

```ts
export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
```

- **Nativo (Capacitor)**: `@capacitor/preferences`.
- **Web**: `localStorage` (con fallback a memoria).
- Detección en runtime con `Capacitor.isNativePlatform()`.
- Claves namespaced: `scores:<gameId>`, `rewards:state`, `settings`.

## Routing y compatibilidad Capacitor

- Usar `HashRouter` o `createMemoryRouter` para evitar problemas de rutas con el
  esquema `file://`/`capacitor://` en WebView nativo.
- `base: './'` en `vite.config.ts` para rutas relativas en el build.

## Portado de los juegos existentes

### Figures (`sesolibre-figures`)
- Ya es React + Tailwind: el portado es mayormente mover componentes y
  convertir `board.js`/`figures.js` a TS bajo `games/figures/logic/`.
- Reemplazar su manejo de score por `ScoreService`.

### Pac-Man (`pacman`)
- Es canvas vanilla (`game.js`, `styles.css`, `pacman.html`).
- Estrategia: envolver el motor en `engine.ts` (TS) y un componente
  `PacmanGame.tsx` que crea el `<canvas>`, instancia el motor en `useEffect`,
  y limpia en unmount. La lógica de juego cambia poco; se adapta el ciclo de
  vida y la entrada (teclado + controles táctiles para móvil).

## Estándares
- ESLint + Prettier.
- Conventional commits.
- Tests de lógica obligatorios para sudoku (unicidad de solución), buscaminas
  (primer clic seguro, flood-fill) y solitario (reglas de movimiento).
