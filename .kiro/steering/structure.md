# Project Structure

```
src/
├── main/                          # Electron main process (Node.js)
│   ├── index.ts                   # App entry point, window creation, tray, shortcuts
│   ├── preload.ts                 # Preload script (context bridge for IPC)
│   ├── database/
│   │   ├── schema.ts              # SQLite schema, migrations, DB singleton
│   │   └── repositories/         # Data access layer (one file per entity)
│   ├── ipc/
│   │   ├── handlers.ts           # Central IPC handler registration
│   │   ├── safe-handle.ts        # Error-safe IPC wrapper
│   │   └── *-handlers.ts         # Domain-specific IPC handlers
│   └── services/                 # Business logic layer
│       ├── ai-service.ts         # AI orchestration
│       ├── ai-provider.ts        # Multi-provider AI abstraction
│       ├── container.ts          # Service container / DI
│       └── *-service.ts          # Domain services
├── renderer/                      # React frontend (Vite-bundled)
│   ├── App.tsx                   # Root component, view routing
│   ├── main.tsx                  # React entry point
│   ├── components/               # UI components (one per file, PascalCase)
│   ├── styles/                   # Global CSS (VS Code-inspired dark theme)
│   ├── types/                    # Renderer-specific types
│   └── utils/                    # Frontend utilities
└── shared/
    └── types/                    # Domain types shared between main and renderer
```

## Architectural Patterns

- **Main/Renderer Separation** — Strict IPC communication. No direct Node.js in renderer (`contextIsolation: true`, `nodeIntegration: false`)
- **Repository Pattern** — Database access abstracted into classes, one per entity
- **Service Layer** — Business logic in services that coordinate repositories and AI
- **IPC Handlers** — Map IPC channels to service/repository methods. Channels use `entity:action` naming (e.g., `entry:create`, `task:getAll`)
- **Shared Types** — Domain interfaces in `src/shared/types/`, consumed by both processes
- **UUIDs** — All entities use UUID primary keys
- **Migration System** — Sequential numbered migrations in `schema.ts` with version tracking

## Key Conventions

- One component per file in `src/renderer/components/` (PascalCase filenames)
- One repository per entity in `src/main/database/repositories/`
- One IPC handler file per domain in `src/main/ipc/`
- Services are singletons accessed via getter functions (e.g., `getConfigService()`)
- DB uses WAL mode with a file lock to prevent concurrent access
- Dark theme UI inspired by VS Code aesthetics
