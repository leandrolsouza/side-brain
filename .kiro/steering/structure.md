# Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry point, window creation, global shortcuts
│   ├── preload.ts           # Preload script (context bridge)
│   ├── database/
│   │   ├── schema.ts        # SQLite schema init, migrations, DB singleton
│   │   └── repositories/    # Data access layer (one file per entity)
│   │       ├── entry-repository.ts
│   │       ├── project-repository.ts
│   │       ├── settings-repository.ts
│   │       └── task-repository.ts
│   ├── ipc/
│   │   └── handlers.ts      # All IPC handler registrations
│   └── services/            # Business logic
│       ├── ai-service.ts    # Bedrock API calls (categorization, summaries)
│       ├── digest-service.ts
│       ├── entry-service.ts
│       └── notification-service.ts
├── renderer/                # React frontend (Vite-bundled)
│   ├── App.tsx              # Root component, view routing, global state
│   ├── main.tsx             # React entry point
│   ├── index.html           # HTML template
│   ├── components/          # UI components (one per file)
│   ├── styles/
│   │   └── global.css       # Global styles (VS Code-inspired theme)
│   └── types/
│       └── electron.d.ts    # Type declarations for preload API
└── shared/
    └── types.ts             # Domain types shared between main and renderer
```

## Architecture Patterns

- **Main/Renderer split**: Strict separation via Electron IPC. No direct Node.js access from renderer.
- **Repository pattern**: Database access abstracted into repository classes per entity.
- **Service layer**: Business logic in service classes that coordinate repositories and AI.
- **IPC handlers**: Single registration file maps IPC channels to service/repository methods.
- **Shared types**: Domain interfaces and enums in `src/shared/types.ts`, consumed by both processes.
- **No state management library**: React component state + prop drilling. Views managed by top-level `App.tsx`.

## Conventions

- One component per file in `src/renderer/components/`
- Repository and service classes are instantiated in the IPC handler registration
- Database uses a singleton pattern (`getDatabase()`)
- IPC channels follow the pattern `entity:action` (e.g., `entry:create`, `task:getAll`)
- UUIDs for all entity IDs
