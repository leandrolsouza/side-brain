# SideBrain

<p align="center">
  <img src="assets/icon.png" alt="SideBrain" width="128" />
</p>

<p align="center">
  <strong>Your second brain for organizing work.</strong>
</p>

A desktop application for organizing work notes with automatic AI categorization. Capture free-text throughout your day and let AI organize it into projects, classify by type and status, and rewrite for clarity.

## Features

- **Quick Capture** — Free-text input automatically categorized into projects, entry types, and action items
- **Projects & Entries** — Entries organized by project with customizable types (information, decision, request, idea, blocker, update) and action statuses
- **Review Inbox** — AI suggestions go through a review workflow (auto-approved, pending, approved, corrected)
- **Task Kanban** — Tasks derived from entries with statuses (todo, in-progress, waiting, done)
- **Daily Digest** — AI-generated summary on app launch with overdue tasks, previous day activity, and suggestions
- **Global Search** — Ctrl+K to search across entries, tasks, and projects
- **Smart Chat** — Conversational AI with context from your data for questions about your work
- **Meetings** — Meeting mode for note capture with AI processing
- **Connections** — Visual graph of relationships between entries and projects
- **Reports** — Productivity insights and activity reports
- **AI Usage Dashboard** — API consumption and cost tracking
- **Custom Fields** — Customizable entry types and action statuses
- **Auto-update** — Automatic updates via GitHub Releases
- **Automatic Backup** — Periodic SQLite database backups

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 43.1 |
| Language | TypeScript 7.0 (strict mode) |
| Frontend | React 19.2 + Vite 8.1 |
| Database | better-sqlite3 12.11 (SQLite with WAL mode) |
| AI | Multi-provider (Bedrock, OpenAI, Gemini, Grok, Local LLM) |
| i18n | i18next + react-i18next |
| Icons | lucide-react |
| Packaging | electron-builder |
| Testing | Vitest + @testing-library/react |

## Supported AI Providers

| Provider | Default Model |
|----------|--------------|
| AWS Bedrock | Claude Sonnet 4 |
| OpenAI | GPT-4.1 |
| Google Gemini | Gemini 3.5 Flash |
| Grok | Grok 4.3 |
| Local (OpenAI-compatible) | Configurable (e.g., LM Studio) |

## Prerequisites

- Node.js 20+
- npm

## Installation

```bash
git clone https://github.com/leandrolsouza/my-agent.git
cd my-agent
npm install
```

The `postinstall` script runs `electron-rebuild` to compile native modules (better-sqlite3).

## Development

```bash
npm run dev
```

This starts in parallel:
- Vite dev server (port 5173) for the renderer
- TypeScript compiler in watch mode for the main process
- Electron pointing to the dev server

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Full development environment |
| `npm run build` | Production build (renderer + main) |
| `npm run build:renderer` | Vite build of the renderer |
| `npm run build:main` | TypeScript compilation of the main process |
| `npm run start` | Run the compiled app |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | Lint and format check with Biome |
| `npm run lint:fix` | Auto-fix lint/format issues |
| `npm run typecheck` | TypeScript type check (main + renderer) |
| `npm run check-i18n` | Verify i18n keys are in sync across locales |
| `npm run pack` | Package with electron-builder (no distribution) |
| `npm run dist` | Package for distribution |

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Entry point, window creation, global shortcuts
│   ├── preload.ts           # Preload script (context bridge)
│   ├── database/
│   │   ├── schema.ts        # SQLite schema, migrations, DB singleton
│   │   └── repositories/    # Data access layer (one file per entity)
│   ├── ipc/
│   │   └── handlers.ts      # IPC handler registration (+ domain-specific files)
│   └── services/            # Business logic
├── renderer/                # React frontend (Vite-bundled)
│   ├── App.tsx              # Root component, view routing
│   ├── components/          # UI components (one per file)
│   └── styles/
│       └── global.css       # Global styles (VS Code-inspired theme)
└── shared/
    └── types/               # Domain types shared between main and renderer
```

### Architectural Patterns

- **Main/Renderer Separation** — Strict IPC communication. No direct Node.js access in the renderer (`contextIsolation: true`, `nodeIntegration: false`)
- **Repository Pattern** — Database access abstracted into per-entity classes
- **Service Layer** — Business logic in services that coordinate repositories and AI
- **IPC Handlers** — Handlers map IPC channels to service/repository methods
- **Shared Types** — Domain interfaces in `src/shared/types/`, consumed by both processes
- **IPC Channels** — Follow the `entity:action` naming pattern (e.g., `entry:create`, `task:getAll`)
- **IDs** — UUIDs for all entities

## Build & Distribution

The project uses `electron-builder` and GitHub Actions for CI/CD:

- **CI (Tests)** — Runs lint, type check, build, and main/renderer tests (including i18n tests) on push/PR to main
- **Release** — Runs CI and builds Windows, macOS, and Linux packages when a `v*` tag is created
- **Auto-update** — `electron-updater` checks for new versions via GitHub Releases

### Creating a Release

```bash
# Update package.json and package-lock.json, commit, and create the matching tag
npm version 0.9.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release 0.9.1"
git tag v0.9.1
git push origin main --follow-tags
```

The tag must match the package version. The workflow validates the update manifests and artifacts before publishing a draft; failed builds can be retried without replacing a published release. Automatic updates require publicly accessible releases in `leandrolsouza/side-brain`. Builds are currently unsigned: macOS distribution and automatic updates require a signed application and appropriate notarization. Test an installed update on each supported platform before relying on a release.

## Author

**Leandro Souza**

- [LinkedIn](https://www.linkedin.com/in/leandrolsouza/)
- [GitHub](https://github.com/leandrolsouza/)

## License

Private project.
