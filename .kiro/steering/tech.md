# Tech Stack

## Core

- **Runtime**: Electron 35
- **Language**: TypeScript 5.8 (strict mode)
- **Frontend**: React 19 + Vite 8
- **Database**: better-sqlite3 (SQLite with WAL mode)
- **AI**: AWS Bedrock Converse API (fetch-based, API Key auth)

## Key Libraries

- `lucide-react` — Icons
- `uuid` — ID generation
- `concurrently` — Parallel dev scripts
- `electron-builder` — Packaging/distribution

## Build System

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full dev environment (renderer + main + electron) |
| `npm run build` | Production build (renderer + main) |
| `npm run build:renderer` | Vite build for renderer |
| `npm run build:main` | TypeScript compile for main process |
| `npm run start` | Launch built electron app |
| `npm run pack` | Package with electron-builder (unpacked) |
| `npm run dist` | Package for distribution |
| `npm run postinstall` | Rebuild native modules (better-sqlite3) |

## TypeScript Configuration

- Main process: CommonJS modules, Node module resolution, outputs to `dist/main`
- Renderer: ESNext modules, bundler resolution (handled by Vite)
- Shared code is included in both compilation targets
- Path alias: `@shared` → `src/shared`

## Development

- Vite dev server runs on port 5173 (strict port)
- Main process TypeScript is compiled in watch mode
- Electron loads from dev server in development, from built files in production
- `contextIsolation: true`, `nodeIntegration: false` — communication via IPC only
