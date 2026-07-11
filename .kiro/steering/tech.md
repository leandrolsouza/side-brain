# Tech Stack

## Core Technologies

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 43 |
| Language | TypeScript 7.0 (strict mode) |
| Frontend | React 19 + Vite 8 |
| Database | better-sqlite3 (SQLite with WAL mode) |
| AI | Multi-provider (AWS Bedrock, OpenAI, Google Gemini, Grok, Local OpenAI-compatible) |
| Icons | lucide-react |
| Packaging | electron-builder |
| Testing | Vitest + @testing-library/react |

## Key Dependencies

- `better-sqlite3` — Native SQLite binding (requires electron-rebuild)
- `electron-updater` — Auto-update via GitHub Releases
- `react-force-graph-2d` — Connection graph visualization
- `react-markdown` + `remark-gfm` — Markdown rendering
- `uuid` — UUID generation for all entity IDs
- `concurrently` — Parallel dev process orchestration

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Full dev environment (Vite + tsc watch + Electron) |
| `npm run build` | Production build (renderer + main) |
| `npm run build:renderer` | Vite build of the renderer |
| `npm run build:main` | TypeScript compilation of main process |
| `npm run start` | Run the compiled app |
| `npm test` | Run main process tests with Vitest |
| `npm run test:renderer` | Run renderer tests |
| `npm run test:all` | Run all tests (main + renderer) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run pack` | Package with electron-builder (no dist) |
| `npm run dist` | Package for distribution |

## Build & Release

- CI runs tests on push/PR to main
- Creating a `v*` tag triggers automated builds for Windows (NSIS/MSI/Portable), macOS (DMG), and Linux (AppImage)
- Auto-update uses `electron-updater` with GitHub Releases as the provider

## Dev Environment Notes

- `postinstall` runs `electron-rebuild` to compile native modules (better-sqlite3)
- Dev mode starts Vite on port 5173 and Electron loads from the dev server
- Production loads from `dist/renderer/index.html`
- Tests require `npm rebuild better-sqlite3` (handled by `test:rebuild` script)
